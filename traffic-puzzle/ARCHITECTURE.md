# Chorraha Boshqaruvi — Architecture (v2)

A deterministic traffic-rules puzzle: an isometric intersection, vehicles queued on every arm, and the player taps them one at a time. Legal taps move the vehicle through the junction. Illegal taps cost a life, trigger the traffic-police whistle and flash the involved cars red.

This document covers the four deliverables from the brief: **state management**, the **validation algorithm**, the **level data structure** and **rendering performance**. It also documents the geometry, determinism and anti-cheat design these depend on.

---

## 1. Principles

1. **Pure core.** `src/core` has no DOM, no framework and no I/O. The same modules run in the browser, in Node tests, in a React Native / Flutter-JS port and in the Supabase edge function.
2. **Deterministic simulation.** A fixed 60 Hz tick, integer tick clock and one shared kinematic profile. The same tap sequence always produces the same result, which is what makes server-side replay verification possible.
3. **One trajectory for rendering and rules.** Each movement is an arc-length-parametrised path. The renderer draws cars on exactly the path the rule engine reasons about.
4. **Fairness from geometry.** A vehicle only owes right of way to a vehicle whose trajectory it would physically intersect (precomputed conflict zones). No arbitrary "rules" without a reason on the road.
5. **Hot vs cold state.** The engine owns per-tick state and is read directly by the renderer. The store owns session state (screens, save, economy) and changes a few times per minute.

---

## 2. Module map

```
src/core/            pure, framework-free (≈2.2k lines)
  types.ts           domain + level JSON types
  dir.ts             direction algebra, right-hand lane geometry
  path.ts            PathBuilder → uniform arc-length Path (O(1) sample)
  junction.ts        cross / cross_ctrl / roundabout paths + conflict zones (cached)
  kinematics.ts      60 Hz clock, accel/cruise profile, distAt/timeAt
  signals.ts         traffic-light plans (green, green-flash, amber, red+amber, flashing)
  controller.ts      traffic-controller gestures and body sides
  rules.ts           ★ canVehicleMove — priority ladder, yield graph, Tarjan SCC, space-time
  level.ts           validateLevel (Uzbek messages) + loadLevel
  engine.ts          GameEngine: tap(), step(), queues, arrivals, penalties, events
  scoring.ts         stars, coin rewards (shared with the server)
  replay.ts          makeReplay / verifyReplay (anti-cheat)
  bot.ts             greedy legal autoplay: solvability proof, par time, hints
src/content/         campaign data, generator, garage catalog, Uzbek rule texts
src/web/             browser client (canvas renderer + DOM UI, no framework)
  render/            camera, static scene cache, vehicles + sprite LRU, props, compositor
  screens/           menu, levels, play, garage, settings, rules, editor
  net/               Supabase REST client + offline-first sync
supabase/            SQL migration (RLS, RPC) + submit-run edge function
scripts/             campaign freezer, edge bundler, static server, e2e/perf browser checks
tests/               63 node:test cases (geometry, every rule, engine, campaign, web, edge)
```

There are no runtime dependencies. The only dev dependency is TypeScript.

---

## 3. Grid, geometry and the vehicle state machine

### 3.1 Coordinates and lanes

The world is top-down with `x` pointing east and `y` pointing south (y-down). One unit is one lane width. Directions are indexed clockwise, `N=0 E=1 S=2 W=3`, so the rules reduce to modular arithmetic:

```ts
rightOf(d)   = (d + 3) % 4   // arriving from S (heading N), the right-hand arm is E
opposite(d)  = (d + 2) % 4
exitOf(d, t) = heading ± 90° // heading = opposite(d)
```

Traffic drives on the right. The incoming lane of arm `d` is offset 0.5 lanes to the right of the inbound heading (`inLane`), and the outgoing lane mirrors it (`outLane`). For example, a car from the south drives up `x = +0.5`.

### 3.2 Paths

For every movement (4 arms × straight/left/right) `junction.ts` builds the path the **front bumper** follows: stop line → junction → exit lane → despawn point. The path is sampled densely, then resampled at a uniform 0.05-unit step, so `sample(s)` is O(1).

| Geometry | Straight | Right | Left |
|---|---|---|---|
| `cross` | line | r = 0.5 arc around the near corner | r = 1.5 arc around the far-left corner |
| `cross_ctrl` (boss) | line | same | r = 0.5 arc around the centre, so cars drive around the controller |
| `roundabout` | entry Bézier → ring arc (counter-clockwise on the map) → exit Bézier | | |

### 3.3 Conflict zones

For every ordered pair of movements from different arms, the two sampled paths are compared (O(n·m), about 5–15 ms per geometry, computed once and cached). Sample pairs closer than `CLEAR_DIST = 0.72` form the zone:

- **cross**: the headings differ, so the zone is the whole overlapping stretch, `[a0,a1]` on A and `[b0,b1]` on B.
- **merge**: the headings become co-directional (same exit lane, or the roundabout ring), so the zone is cut at merge point + `MERGE_LEN`. After that point the cars just follow each other.

Test `geometry.test.mjs` checks the cross-junction matrix against an independent chord-interleaving model of the 8 boundary ports. It gives the standard **16 crossing + 12 merge** conflicts, plus the 2 opposing-left crossings that natural turning arcs produce: 18 crossings in total. Opposing straights and paired right turns never conflict.

### 3.4 Vehicle lifecycle

```
hidden ─spawn→ queued ─front→ approaching ─stops at line→ waiting ─legal tap→ crossing ─exit+1.2→ exiting ─end→ gone
                                                              └─illegal tap→ penalty (lock 0.67 s, flash) ─┘
```

Only `waiting` vehicles can be tapped. Once a vehicle is `crossing` it never stops. That is why every collision decision is made at tap time.

---

## 4. Validation algorithm — `canVehicleMove(vehicleId, state)`

```ts
function canVehicleMove(vehicleId: string, state: IntersectionState): MoveDecision
// MoveDecision = { allowed, verdict: 'go'|'wait'|'violation', reason, culprits[], deadlock }
```

`IntersectionState` is an interface; `GameEngine` implements it, so the engine is passed in directly. The function is pure.

### 4.1 Priority ladder (first failing rung wins)

| # | Rung | Outcome | Reason |
|---|---|---|---|
| 0 | Readiness: only the front vehicle at the stop line | soft `wait`, no penalty | `not_front`, `not_ready`, `locked` |
| 1 | Regulation: the controller's gesture, then the traffic light. Emergency vehicles are exempt. | violation | `controller`, `red_light` |
| 2 | **Space-time**: would we occupy a conflict zone while a crossing vehicle does? | violation | `crossing_traffic`, `roundabout_ring` |
| 3 | **Right-of-way graph** over the vehicles present at the stop lines | violation | `emergency`, `main_road`, `right_hand`, `left_turn` |

### 4.2 Right-of-way as a graph

Nodes are the front vehicles present at their stop lines that the regulation currently lets move. An edge `a → b` means *a must yield to b*. Edges only exist between vehicles whose paths conflict:

```ts
if (b.emergency && !a.emergency) return 'emergency';
switch (mode) {
  case 'controller': case 'signal': return leftTurnRule(a, b);   // left turn yields to oncoming straight/right
  case 'roundabout':                return null;                  // the ring is handled by space-time
  case 'priority':                  if (prio[a] !== prio[b]) return prio[a] < prio[b] ? 'main_road' : null;
                                    // equal priority → fall through
  case 'equal':                     return b.from === rightOf(a.from) ? 'right_hand' : leftTurnRule(a, b);
}
```

The tapped vehicle `v` may go if it has **no outgoing edge**. If it does have one, Tarjan's SCC algorithm runs on the (≤ 4-node) graph. If `v` belongs to a **terminal strongly-connected component with more than one node**, the vehicles are in a genuine deadlock, such as four cars going straight at an equal junction. In that case any member may proceed, as drivers "agree", and the move is flagged `deadlock: true`. Otherwise the move is a violation, and the culprits are `v`'s yield targets.

### 4.3 Space-time check

Every vehicle entering the junction starts from rest with the same profile, `s(t) = ½·a·t²` up to `VMAX`, then linear. `timeAt(s)` is its exact inverse. For a zone `[z0, z1]` and vehicle length `L`, the occupancy window is `[T(z0), T(z1 + L)]`. A crossing vehicle's window is shifted by its start tick:

```ts
const rel = (x.startTick - state.tick) / 60;
overlap = timeAt(z.a0) < rel + timeAt(z.b1 + x.length) + MARGIN
       && rel + timeAt(z.b0) < timeAt(z.a1 + v.length) + MARGIN;
```

This single rule covers "yield to vehicles completing the crossing", opposing left turns, green-phase changeovers and the roundabout rule "circulating traffic has priority", including gap acceptance. Because every profile is identical, a follower can never catch its leader after a merge, so short merge zones are enough.

### 4.4 Coverage

`tests/rules.test.mjs` has 22 scenarios, one per rule: right-hand rule, left turn against oncoming traffic, fairness, main road vs. yield/stop, equal rules among main-road vehicles, emergency priority over signs and red lights, red/amber/green, left turn on green, flashing amber falling back to signs, the controller gesture table and override, the four-way deadlock, the queue no-op, space-time timing, roundabout priority, T-junctions, the post-penalty lock and approaching vehicles.

---

## 5. Queue management

Each arm keeps an ordered list of lane vehicles. Every tick, each vehicle drives toward its **slot**: the front slot is the stop line, and each later slot is one vehicle length plus 0.4 further back. Speed follows a braking curve `v ≤ √(2·decel·dist)`, capped by acceleration. A car-following clamp keeps each vehicle at least `Q_MIN_GAP` behind the one ahead, including the vehicle that just departed while it is still on the incoming lane. A front vehicle becomes `waiting` only once it has stopped exactly on the line. Tapping any other vehicle returns `not_front` and does nothing, as the brief requires. Timed `arrivals` spawn at the far end of the arm and join the back of the queue at cruising speed.

---

## 6. State management

### 6.1 Two layers

| Layer | Holds | Changes | Read by |
|---|---|---|---|
| `GameEngine` (hot) | vehicles, lanes, tick, lives, coins earned this level | 60× per second | renderer (directly, every frame), HUD (text diffed) |
| App store (cold) | screen, save data, economy, garage, settings, cloud status | on events | DOM screens via `subscribe` / `subscribeSelector` |

The store is Zustand-shaped (`createStore((set, get, api) => ({ ...state, ...actions }))`, see `src/web/store.ts`). In React Native you swap it for `import { create } from 'zustand'` and the store body stays the same. Keeping 20+ moving vehicles out of the store means no framework has to diff them at 60 fps.

### 6.2 Event flow

```
pointer → Renderer.pick() → engine.tap(id) → canVehicleMove()
                                   ├─ go        → 'depart'  → sound, lane shift
                                   ├─ violation → 'penalty' → whistle, red flash, heart −1, culprit rings
                                   └─ wait      → 'blocked' → horn + hint toast (no penalty)
rAF → accumulator → engine.step() ×N → 'cleared' (+coins popup), 'arrive', 'won' / 'lost'
'won' → store.finishLevel() → computeReward() → save (debounced) → pending replay → cloudSync()
```

`GameEvent`s are the only coupling between the simulation and presentation. Audio, haptics, analytics and tutorials all subscribe to them.

### 6.3 Flutter / Bloc mapping

The `GameEngine` becomes a plain Dart class, or stays in JS via a JS runtime. The cold state becomes a `Cubit<AppState>`. Rendering is a `CustomPainter` driven by a `Ticker` that calls `engine.step()` outside the Bloc rebuild path. See `docs/REACT_NATIVE.md` for the React Native version.

---

## 7. Level data structure

Levels are plain JSON (`LevelDef` in `src/core/types.ts`). There is a JSON Schema at `levels/level.schema.json`, and the campaign is exported to `levels/campaign.json`.

```jsonc
{
  "id": 12, "name": "Asosiy yo'lda chapga", "band": "complex", "junction": "cross",
  "arms": [
    { "dir": "N", "sign": "main",  "queue": [{ "kind": "car", "turn": "straight" }] },
    { "dir": "E", "sign": "stop",  "queue": [{ "kind": "car", "turn": "straight" }] },
    { "dir": "S", "sign": "main",  "queue": [{ "kind": "car", "turn": "left" }, { "kind": "car", "turn": "straight" }] },
    { "dir": "W", "sign": "stop",  "queue": [{ "kind": "car", "turn": "right" }],
      "arrivals": [{ "kind": "ambulance", "turn": "straight", "atMs": 9000 }] }
  ],
  "signals":    { "phases": [{ "green": ["N","S"], "ms": 7000 }, { "green": ["E","W"], "ms": 7000 }], "flashing": [{ "fromMs": 0, "toMs": 14000 }] },
  "controller": { "poses": [{ "gesture": "right_forward", "facing": "S", "ms": 5000 }, { "gesture": "arm_up", "facing": "S", "ms": 1200 }] },
  "lives": 3, "parMs": 8500,
  "intro": { "title": "…", "text": "…" }, "tip": "…"
}
```

(`signals` and `controller` are shown together only to illustrate the shape. The validator rejects a level that has both.)

`validateLevel()` enforces the arm count per junction type, that every turn has an existing exit, that the queue fits on the arm, and that each arm is green in exactly one signal phase. For controller levels it checks that every non-emergency movement is permitted by at least one pose. It reports every problem in Uzbek.

**Campaign pipeline.** 18 levels are hand-made teaching levels: 1–6, 8, 10–12, 16, 20–24, 31 and 36, each introducing one rule. The other 32 come from a seeded generator (`content/generator.ts`) driven by a curriculum spec; bosses 30, 40 and 50 use fixed controller scripts with generated traffic. For each spec the generator tries up to 24 deterministic seeds. It keeps the most "interesting" candidate: most blocked front vehicles at the start, and deadlocks count extra. A candidate only qualifies if it validates **and** the autoplay bot solves it with zero penalties. `npm run campaign` freezes the result into `campaign.data.ts`. Every level's par time is `bot time × 1.25 + 2.5 s`, where the bot reacts in 0.3 s. Result: 50 levels (33 cross, 4 T, 13 roundabout), 545 vehicles (115 timed arrivals, 20 emergency), 5 boss levels, par times from 5.5 s to 83.5 s.

---

## 8. Rendering performance (20+ cars)

| Technique | Where |
|---|---|
| Static scene (ground, roads, markings, island, background buildings) rendered once to an offscreen canvas per level/resize, then one `drawImage` per frame | `render/scene.ts` |
| Vehicles are oriented 3D boxes with back-face culling (`n.x + n.y > 0`). Each (look, heading bucket of 64) is pre-rendered into a **sprite**, kept in an **LRU cache** (360 entries) and invalidated on zoom/DPR change | `render/vehicles.ts` |
| Painter's algorithm: vehicles and tall props (poles, trees, controller) sorted by `x + y` each frame, reusing a pooled array | `render/renderer.ts` |
| Fixed 60 Hz simulation with an accumulator, rendering interpolated between ticks (crossing positions analytically from `distAt`) | `screens/play.ts` |
| DPR-aware canvas (capped at 2×), paused when the tab is hidden, no per-vehicle DOM nodes | |
| Conflict zones precomputed per geometry; the yield graph has ≤ 4 nodes, so a tap costs microseconds | `core/junction.ts`, `core/rules.ts` |

**Measured** with headless Chromium (software rendering, 1280×760), 24 vehicles visible, 6 s per sample (`npm run perf`). Ranges come from two separate runs:

| Sprite cache | DPR | Render cost / frame | Frame time p50 / p99 | FPS |
|---|---|---|---|---|
| on | 1 | **0.27–0.39 ms** | 16.7 / 16.8 ms | 60 |
| off (vector) | 1 | 0.66–0.89 ms | 16.7 / 16.8 ms | 60 |
| on | 2 | **0.36–0.39 ms** | 16.7 / 16.8 ms | 60 |
| off (vector) | 2 | 0.72–0.78 ms | 16.7 / 16.8 ms | 60 |

Frame times are capped by vsync; the render cost is the meaningful number. The sprite cache makes it roughly **2× cheaper**, and either way under 6 % of the 16.7 ms frame budget is used. The in-game "Performance paneli" setting shows live FPS, render time and cache hit rate. These are sandbox measurements, not measurements on real phones.

---

## 9. Determinism and anti-cheat

- A **replay** is `{ v: 1, levelId, taps: [[tick, vehicleId], …], endTick }`. Only state-changing taps are recorded, i.e. go and violation. Because the simulation is deterministic, the replay *is* the game.
- `verifyReplay` rejects bad versions, level mismatches, oversized or unsorted taps, unknown vehicle ids, taps after the end and incomplete runs, and it requires `endTick` to match exactly. Tests cover each of these tampering cases.
- **Supabase flow.** The client calls `POST /functions/v1/submit-run` with `{ levelId, replay }`. The edge function identifies the user (`GET /auth/v1/user`), re-simulates the replay with the same compiled core and calls `apply_run(...)` (service role only). Under a per-user+level advisory lock, `apply_run` rejects duplicate replays (SHA-256), computes the reward (first-clear bonus is paid once, stars only for newly earned stars), upserts the best progress and credits the coins. Clients can only **read** their own rows (RLS); purchases go through `purchase_item` (an atomic coin check).
- Cross-engine note: path sampling uses `Math.sin`/`Math.cos`, which V8 (Chrome, Node, Deno) computes identically. Zone bounds are rounded and windows compared with a 0.12 s margin, so tiny last-bit differences in other engines cannot flip an outcome in practice.

---

## 10. Verification status

| Area | How it was verified |
|---|---|
| Geometry, rules, engine, campaign, save/economy, Supabase client wire format, sync merge, edge function flow, SQL/TS catalog consistency | `npm test`: 63 tests, all passing |
| All 50 levels solvable, with a verifying replay | bot + `verifyReplay` in `campaign.test.mjs` |
| Real browser: menu → level 1 → wrong tap (penalty, heart lost) → correct taps via real hit-testing → win → save; queue no-op; garage buy/equip; editor; boss, lights, roundabout; mobile layout; 0 console errors | `scripts/e2e.mjs` (headless Chromium) |
| Supabase against a **live** project | **Not run** (no network or Postgres in the build sandbox). The SQL was reviewed and its catalog/params are checked by tests, and the edge handler was tested with mocked GoTrue/PostgREST. See `docs/SUPABASE.md`. |
| React Native port | Guide only (`docs/REACT_NATIVE.md`), not compiled here |

Known simplifications of the traffic model: one lane per direction, no pedestrians, trams or U-turns, a single roundabout lane, and a police car without a siren behaves as a normal car.
