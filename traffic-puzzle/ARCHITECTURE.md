# Chorraha Boshqaruvi — Architecture (v3)

A deterministic traffic-rules puzzle: an isometric intersection, vehicles queued on every arm, and the player taps them one at a time. Legal taps move the vehicle through the junction. Illegal taps cost a life, trigger the traffic-police whistle and flash the involved cars red.

This document covers the four deliverables from the brief: **state management**, the **validation algorithm**, the **level data structure** and **rendering performance**. It also documents the geometry, determinism and anti-cheat design these depend on. Section 11 describes what v3 added on top: the content-fit camera, the occlusion-safe city, ambience lighting, the daily/endless modes, achievements, the editor model, routing, the offline PWA and the second Supabase migration.

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
src/core/            pure, framework-free (≈2.3k lines)
  types.ts           domain + level JSON types (ambience, coach steps, end reasons)
  dir.ts             direction algebra, right-hand lane geometry
  path.ts            PathBuilder → uniform arc-length Path (O(1) sample)
  junction.ts        cross / cross_ctrl / roundabout paths + conflict zones (cached)
  kinematics.ts      60 Hz clock, accel/cruise profile, distAt/timeAt
  signals.ts         traffic-light plans (green, green-flash, amber, red+amber, flashing)
  controller.ts      traffic-controller gestures and body sides
  rules.ts           ★ canVehicleMove — priority ladder, yield graph, Tarjan SCC, space-time
  level.ts           validateLevel (Uzbek messages, limits) + loadLevel
  engine.ts          GameEngine: tap(), step(), queues, arrivals, penalties, gridlock, counters, events
  scoring.ts         stars, coin rewards (shared with the server)
  replay.ts          makeReplay / verifyReplay (anti-cheat)
  bot.ts             greedy legal autoplay: solvability proof, par time, hints
src/content/         data + pure game content logic
  campaign*.ts       the frozen 50-level campaign, chapters, bands
  generator.ts       seeded level generator (campaign, daily)
  daily.ts           daily challenge: calendar maths, weekday themes, deterministic level per day, server window
  endless.ts         endless streams (3 variants) that always end in gridlock
  achievements.ts    20 achievements as pure functions of the save
  practice.ts        violation analytics → "practice this rule" level
  garage.ts          models, paints, mods + achievement-only exclusives
src/web/             browser client (canvas renderer + DOM UI, no framework)
  render/            camera, city scene cache, ambience grade, lights/effects, vehicles + sprite LRU, props, compositor
  screens/           menu, levels, play, garage, settings, rules, editor, stats, achievements
  app.ts store.ts    Zustand-shaped store: targets (campaign/daily/endless/custom), runs, achievements, cloud
  save.ts            versioned local save (v2) with migration
  editor-model.ts    pure editor state ⇄ LevelDef (lossless), draft migration, import parsing
  router.ts share.ts hash routes ⇄ screens; level ⇄ "L1." share code
  pwa.ts fx.ts       service-worker registration + install prompt; confetti, count-up, clipboard
  net/               Supabase REST client + offline-first sync, leaderboard
supabase/            SQL migrations (RLS, RPC, v3 daily ids + leaderboard) + submit-run edge function
scripts/             campaign freezer, edge bundler, service-worker + icon generators, static server, e2e/perf
tests/               100 node:test cases (geometry, every rule, engine, campaign, modes, render geometry, editor, web, edge)
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
'won'/'lost' → store.finishRun(target, def, result, replay, {hints}) → reward (campaign/daily) | endless record
            → stats, history, achievements → save (debounced) → pending replay → cloudSync() → leaderboard
```

`GameEvent`s are the only coupling between the simulation and presentation. Audio, haptics, the renderer's effects (exhaust, sparks, shake), the coach and the HUD all subscribe to them.

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
| Static scene (ground, roads, markings, island, the whole city, lamp pools, lit windows) rendered once to an offscreen canvas per level/resize, then one `drawImage` per frame | `render/scene.ts` |
| Ambience is a **colour grade applied at draw time** (`g(color)`, cached per grade): no full-screen multiply/composite pass per frame; light sources use raw colours | `render/color.ts` |
| Vehicles are oriented 3D boxes with back-face culling (`n.x + n.y > 0`). Each (grade, look, heading bucket of 64) is pre-rendered into a **sprite**, kept in an **LRU cache** (360 entries) and invalidated on zoom/DPR change | `render/vehicles.ts` |
| Lights are cached sprites drawn additively: headlight cones per heading bucket (only for front and moving cars — a queued car's beam lies under the car ahead), glow discs for brake lights, lamps and sirens | `render/effects.ts` |
| Particles are pooled (≤ 220); rain is one stroked path per frame | `render/effects.ts` |
| Painter's algorithm: vehicles and tall props (poles, lamps, trees near traffic, monument, controller) sorted by `x + y` each frame, reusing a pooled array | `render/renderer.ts` |
| Fixed 60 Hz simulation with an accumulator (1× / 2×), rendering interpolated between ticks (crossing positions analytically from `distAt`) | `screens/play.ts` |
| DPR-aware canvas (capped at 2×), paused when the tab is hidden, no per-vehicle DOM nodes | |
| Conflict zones precomputed per geometry; the yield graph has ≤ 4 nodes, so a tap costs microseconds | `core/junction.ts`, `core/rules.ts` |

**Measured** with headless Chromium (software rendering, 1280×760), 24 vehicles visible, 6 s per sample (`npm run perf`, which prints this table):

| Ambience | Sprite cache | DPR | Render cost / frame | Frame p99 | FPS |
|---|---|---|---|---|---|
| day | on | 1 | **0.41 ms** | 16.8 ms | 60 |
| day | off (vector) | 1 | 0.96 ms | 16.8 ms | 60 |
| day | on | 2 | **0.55 ms** | 16.8 ms | 60 |
| night (cones, glows, lit city) | on | 1 | 0.80 ms | 16.8 ms | 60 |
| night | on | 2 | 0.72 ms | 16.8 ms | 60 |
| rain (+ streaks, splashes) | on | 1 | 0.72 ms | 16.8 ms | 60 |
| rain | on | 2 | 0.84 ms | 33.3 ms | 59 |

Frame times are capped by vsync; the render cost is the meaningful number, and it stays under 1 ms (≈ 5 % of the 16.7 ms budget) even at night in the rain. Before the cone culling, night at DPR 2 dropped to 38 fps in this software-rasterised setup: additive fill-rate, not draw calls, was the bottleneck. The final boss (30 vehicles, night) renders in 0.6–0.8 ms across runs (`docs/screenshots/12-final-boss-perf.jpg`). The in-game "Performance paneli" setting shows live FPS, render time, cache hit rate, particle count and zoom. These are sandbox measurements, not measurements on real phones.

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
| Geometry, rules, engine (incl. gridlock, counters, waitSince), campaign, daily/endless modes, achievements, practice analytics, coach scripts, save v2 migration, store (runs, streak, records), routing, share codec, editor model round-trip, render geometry (occlusion safety, camera fit, colour grade), Supabase client wire format, sync merge + race, edge function (campaign + daily), SQL/TS consistency | `npm test`: **100 tests**, all passing (CI on every push) |
| All 50 levels solvable, with a verifying replay; 14 consecutive daily levels solvable without penalties; endless always ends | bot + `verifyReplay` in `campaign.test.mjs` / `modes.test.mjs` |
| Real browser (`scripts/e2e.mjs`, headless Chromium, fails on any console error): first play with the coach → wrong tap (penalty, heart lost) → correct taps via real hit-testing → win → save + achievement; keyboard play to 3 stars; "why?" tooltip on hover; queue no-op; lights, roundabout, boss, night, rain; back button, deep links, shared `#/custom/` links; daily; endless; statistics; achievements; garage buy/equip; editor; mobile; service worker + **offline reload and play**; final boss render < 4 ms | 22 checks, all passing |
| Supabase against a **live** project | **Not run** (no network or Postgres in the build sandbox). Both migrations were reviewed, their catalog/params/grants are checked by tests, and the edge handler was tested with mocked GoTrue/PostgREST. See `docs/SUPABASE.md`. |
| React Native port | Guide only (`docs/REACT_NATIVE.md`), not compiled here |
| Real phones | Not tested here (layout checked at 390×844 in headless Chromium) |

Known simplifications of the traffic model: one lane per direction, no pedestrians, trams or U-turns, a single roundabout lane, and a police car without a siren behaves as a normal car.

---

## 11. v3: presentation, modes and platform

### 11.1 Content-fit camera

v2 fitted a disc of radius R (`scale = W / 4R`), but the content is a cross: arm length E spans only ±E·s horizontally and ±E·s/2 vertically. v3 computes E from the level — `stopU + slots·1.6 + 1.0`, where `slots` is the longest initial queue (+1 if the arm has arrivals), capped at 2 on portrait and 4 on landscape — and fits `scale = min((W − 16) / 2E, H_avail / (E + 1.7), 72)`. On a 390×844 phone that is 31 px/unit instead of 21 (tested). Cars queued beyond the screen edge are summarised by a "+N" chip on the lane (red/blue when an emergency vehicle is among them); in endless mode each lane shows its fill "n/7".

### 11.2 Occlusion-safe static city

Everything that never moves (buildings, parked cars, park, T-junction closures, trees far from traffic) is painted once into the static layer, i.e. *under* every vehicle. That is only correct if no static object can cover a vehicle standing behind it. With the 2:1 camera a box of height h covers exactly the ground points `(x − k, y − k)` for `0 < k ≤ 0.95·h` of its footprint, so a vehicle ground point V is wrongly covered iff the ray `V + (k, k)` enters the footprint. `tests/scene.test.mjs` samples every lane and every junction path (with the largest vehicle footprint) on every layout the game or the editor can produce (cross, controller cross, 4 T variants, 5 roundabouts) and checks every static box — including balconies, awnings, canopies and static trees. Trees that *can* overlap traffic are depth-sorted props instead, and fade to 42 % when a waiting car is behind them.

### 11.3 Ambience

`LevelDef.ambience` (day / evening / night / rain) is cosmetic; the rules never change. Grades (`GRADES` in `color.ts`) are per-channel multiply + lift + desaturation, applied when a colour is *used*, with one cache per grade, so switching costs nothing and the static layer, props and sprites share them. Emissive things (head/tail lights, lit windows at 60 % night / 25 % evening, lamp bulbs, signal lamps, sirens, the penalty flash) bypass the grade. Night adds lamp pools (static, additive), headlight cones and glows (per frame); rain adds puddles, wet reflections and screen-space streaks with splashes. Campaign: 27 day, 9 evening, 8 rain, 6 night levels.

### 11.4 Modes

- **Daily challenge.** `id = 100000 + dayIndex` (days since 2026-01-01). The weekday picks one of 7 themes (equal roads, main road, lights, roundabout, T, controller, sirens); a seeded generator builds candidates, the bot proves them and sets par. The same id always yields the same level, so the **server rebuilds it from the id** to verify replays. The streak only counts the player's local "today"; the last 6 days stay playable from links, future days never.
- **Endless.** 320 arrivals with shrinking gaps (tuned so even a 0.2 s-reaction bot gridlocks after ~90–115 vehicles). The run ends when lives run out or a lane holds more than 7 vehicles (`EngineOptions.overflowAt`, event `gridlock`, `endReason`). Score = vehicles through. It never pays coins, so the server-authoritative economy is never contradicted; records are local.
- **Custom.** Editor test runs and shared `#/custom/L1.…` links. No rewards.

### 11.5 Learning aids

- **Coach** (`LevelDef.coach`): steps `{ vehicle: "E0", text }` for the teaching levels 1, 2, 3, 5, 11, 21 and 31. Vehicle ids are validated; a test replays every script step by step and requires each step to be a legal move at that moment. The hand points at the car; the step advances when that car departs.
- **"Why?"** Hovering (mouse) or long-pressing (touch, 450 ms) a front car calls `engine.preview(id)` — the same `canVehicleMove` — and shows the verdict, the rule and dashed links to the vehicles it must yield to.
- **Intent badges** above front cars (turn arrow, optional key 1–4), impatience bubbles after 8 s / a honk after 14 s.
- **Practice.** Violations are counted per rule in the save; `weakestRule()` maps the most frequent one to the level that teaches it ("Mashq qilish").

### 11.6 Achievements

Twenty achievements are pure functions of an `AchievementContext` derived from the save (no event log), evaluated after every run, purchase and sync and once at boot (for migrated saves). Rewards are cosmetic exclusives only (oltin / tungi ko'k paint, bayroq flag, qovun melons) that are not in the server shop catalog.

### 11.7 Editor model

`editor-model.ts` maps the form state to a `LevelDef` and back. The mapping is lossless: all 50 campaign levels round-trip to an identical canonical form (tested), which is why the editor can open any campaign level as a template. It covers queues, timed arrivals, hero cars, signs, signal phases/amber/all-red/offset/flashing windows, preset or hand-written controller scripts, ambience, lives, texts and imported coach steps. v1 drafts migrate. The live preview runs a `GameEngine` driven by the greedy bot in a loop.

### 11.8 Routing, sharing, PWA

- Hash routes (`#/levels`, `#/play/12`, `#/daily/2026-09-28`, `#/endless/cross`, `#/custom/<code>`, …) are pure (`router.ts`). Navigation pushes history entries; `popstate` maps back to store actions, so the back button, reloads and links work. Locked levels redirect to the level list.
- Share code: `"L1." + base64url(UTF-8(canonical JSON))`. Canonical form = fixed key order, defaults and derived fields dropped, arrivals sorted, so `encode(decode(code)) === code`. Decoding runs the untrusted-input validator.
- `scripts/build-sw.mjs` (part of `npm run build`) generates `sw.js`: it precaches the page, styles, all compiled modules, the self-hosted Roboto fonts and small icons, with a cache name derived from a SHA-256 over every precached file. Same files → byte-identical worker (CI checks it is committed up to date). Page navigations are network-first with the cached shell as the offline fallback; game files are cache-first so one worker always serves one consistent version; cross-origin (Supabase) requests are never intercepted.

### 11.9 Supabase v3

Migration `20260928000000_v3.sql` widens the level-id checks to `1..1000 ∪ 100000..199999`, tightens display names (trimmed, no control characters), replaces `leaderboard` with a version that returns `is_me` and adds `my_rank(p_level)` for signed-in users. `submit-run` resolves campaign ids or rebuilds in-window daily levels (`dailyAcceptable`: UTC today −7 … +1). The client's `leaderboard()` waits for the in-flight sync so the player's newest verified result is on the board. v3 also fixed a sync race: runs finished while a sync was in flight used to be dropped from the queue; sync requests now chain.
