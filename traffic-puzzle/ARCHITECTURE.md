# Chorraha Boshqaruvi (Traffic Puzzle) — Architecture Blueprint

> Production-ready architecture for a 2D isometric traffic-management puzzle.
> Target stack: **React Native + TypeScript** (or Flutter) on the client,
> **Supabase** (Postgres + Auth + Edge Functions) for progression & anti-cheat.
> This repository ships the **framework-agnostic game core** (pure TypeScript)
> plus a **runnable browser prototype** so the design is playable today.

---

## 0. Guiding principles

1. **Rules as data + pure functions.** Every road rule is a pure, deterministic
   function over serialisable state. The *same* `canVehicleMove()` runs on the
   client (optimistic UX) and can be re-run on a Supabase Edge Function to
   validate a submitted solution — no logic duplication, no drift.
2. **Simulation ≠ UI state.** The engine owns hot, per-frame mutable state.
   The store (Zustand/Bloc) owns cold, render-relevant session state. React only
   re-renders on cold changes; the canvas reads hot state directly each frame.
3. **Deterministic clock.** Lights and the traffic controller resolve from a
   monotonic `clockMs`. Given the same tap sequence + dt sequence, the outcome
   is bit-for-bit reproducible — essential for replays and server validation.
4. **Fairness is geometric.** A vehicle only yields to another whose trajectory
   it would *physically* conflict with (`pathsConflict`). Every level is
   therefore provably solvable by clearing non-conflicting arms in any order.

---

## 1. Module map

```
src/
├─ core/                 # PURE, framework-agnostic. No DOM, no RN, no Flutter.
│  ├─ types.ts           # Domain model: enums, interfaces, LevelDefinition
│  ├─ geometry.ts        # Direction algebra + pathsConflict (conflict matrix)
│  ├─ lights.ts          # phaseAt(): deterministic traffic-light phase
│  ├─ controller.ts      # controllerPoseAt(): boss regulirovshik poses
│  ├─ rules.ts           # ★ canVehicleMove(): the Rule Validation Engine
│  ├─ level.ts           # hydrateLevel(): LevelDefinition → IntersectionState
│  ├─ engine.ts          # GameEngine: tick, tap, events, queue mgmt, economy
│  └─ index.ts           # public barrel
├─ state/
│  └─ store.ts           # Zustand-shaped store (session/meta state + economy)
├─ levels/
│  ├─ levels.ts          # tutorials + deterministic 1..50 generator (CAMPAIGN)
│  └─ garage.ts          # cosmetic catalog (models & mods)
├─ render/
│  └─ iso.ts             # isometric projection + canvas renderer
└─ demo/
   └─ main.ts            # browser prototype wiring (canvas + HUD + input)
```

The **dependency direction is strictly inward**: `render/` and `demo/` and
`state/` depend on `core/`, never the reverse. Porting to React Native or
Flutter means rewriting only `render/`, `state/` binding, and `demo/`.

---

## 2. State Management Architecture

### 2.1 Two-layer model

| Layer | Owns | Mutates | React re-renders? |
|------|------|---------|-------------------|
| **GameEngine** (`core/engine.ts`) | vehicles, clock, crash timers, lives, coins | every frame (`update(dt)`) | **No** — read imperatively in the render loop |
| **Store** (`state/store.ts`) | levelIndex, totalCoins, garage/owned skins, status flags, a *snapshot* of vehicles, `lastEvent` | on discrete events (tap result, level complete) | **Yes** — via selectors |

Why split? Re-rendering a React tree at 60 fps for 20+ moving cars is wasteful
and janky. Instead:

- The **canvas / RN Skia surface** reads `engine.getVehicles()` directly inside
  `requestAnimationFrame` and paints — no React involved in the hot path.
- The **store** holds only what the *chrome* (HUD, modals, garage) needs and
  updates a few times per second at most.

### 2.2 Zustand shape (React Native)

```ts
import { create } from 'zustand';

export const useGameStore = create<GameStore>()((set, get) => ({
  levelIndex: 0, totalCoins: 0, lives: 3, coins: 0, status: 'idle',
  vehicles: [], ownedSkins: ['default'], equippedSkin: 'default',
  loadLevel(level) { /* build GameEngine, subscribe events → set(...) */ },
  tap(id)          { get().engine?.tap(id); get().syncFromEngine(); },
  syncFromEngine() { /* pull snapshot + lives + coins into store */ },
  buy(item)        { /* economy */ },
  equip(skinId)    { /* cosmetics */ },
}));
```

This repo ships a ~30-line `create()` in `state/store.ts` that mirrors Zustand's
`(set, get) => state` + `subscribe/getState/setState` contract so the store runs
dependency-free in the browser. **Swapping in real Zustand is a one-line import
change** — the store body is identical.

### 2.3 Flutter / Bloc equivalent

- `GameEngine` → a plain Dart class (unchanged conceptually).
- Store → a `Cubit<GameState>` where `GameState` is the cold snapshot.
- Hot rendering → a `CustomPainter` reading the engine each `Ticker` frame,
  driven by `SingleTickerProviderStateMixin`, *outside* the Bloc rebuild path.

### 2.4 Event flow

```
 user tap ──► store.tap(id) ──► engine.tap(id)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
        ▼                          ▼                            ▼
  canVehicleMove()          MOVE_STARTED / COLLISION      store folds event
  (pure decision)           / ILLEGAL_TAP emitted         → set() cold state
                                   │
 rAF loop ──► engine.update(dt) ──► MOVE_COMPLETED / LEVEL_COMPLETE / GAME_OVER
```

Events (`GameEvent` union) are the single integration surface between engine and
UI/audio. Add sound, haptics, analytics, or the YPX whistle by subscribing —
never by reaching into engine internals.

---

## 3. The Rule Validation Engine (`canVehicleMove`)

### 3.1 Signature

```ts
function canVehicleMove(vehicleId: string, state: IntersectionState): MoveDecision
```

```ts
interface MoveDecision {
  allowed: boolean;
  reason?: DenyReason;         // machine-readable (drives UI/tutorial)
  conflictsWith: string[];     // ids to crash-animate / highlight
  explanation: string;         // uz-language player-facing text
}
```

### 3.2 The priority ladder (short-circuit, first deny wins)

| # | Rung | Denies when… | `DenyReason` |
|---|------|--------------|--------------|
| 0 | Movability | vehicle isn't front-of-queue & `WAITING` | `NOT_AT_FRONT` / `NOT_MOVABLE` |
| 1 | Traffic light | approach light is RED/YELLOW (and no controller) | `RED_LIGHT` |
| 2 | Controller (boss) | current pose doesn't allow this arm | `CONTROLLER_FORBIDS` |
| 3 | Emergency | a **conflicting** contender is an ambulance/fire truck | `MUST_YIELD_EMERGENCY` |
| 4 | Roundabout | traffic already circulating conflicts | `MUST_YIELD_ROUNDABOUT` |
| 5 | Main road | you're on SECONDARY, a conflicting car is on MAIN | `MUST_YIELD_MAIN_ROAD` |
| 6 | Right-hand rule | a conflicting contender approaches from your right | `MUST_YIELD_RIGHT` |

Only rungs 3–6 consider **path conflicts**; a vehicle whose path doesn't cross
anyone's is always clear (fairness). The ladder mirrors Uzbek PDD precedence:
lights/controller are absolute, emergencies override signs, roundabout entry
yields to the circle, signs beat the default right-hand rule.

### 3.3 Conflict detection — graph/geometry (`geometry.ts`)

Directions are indexed **clockwise** `N=0, E=1, S=2, W=3`, so "the approach on
my right" is pure modular arithmetic:

```ts
// driver faces opposite(from); their right is 90° CW of facing → from-1 (mod 4)
export const approachOnRight = (from) => rotateCW(from, 3);
export const exitDirection   = (from, intent) => { /* facing ± quarter turns */ };
```

`pathsConflict(aFrom,aIntent,bFrom,bIntent)` treats each move as a **chord**
across the intersection square and returns `true` iff the chords cross the
shared centre box:

- same origin → never (single-file queue),
- two right turns → never (hug outer kerb),
- shared exit lane → conflict (merge point),
- otherwise → conflict iff one chord's *swept arc of arms* covers the other's
  origin or destination arm.

This is an exact, allocation-free proxy for continuous collision simulation and
is what keeps the puzzle fair and the check O(arms).

### 3.4 Why pure?

`canVehicleMove` has **no I/O, no randomness, no mutation**. Consequences:

- Trivially unit-testable (see `tests/engine.test.mjs`, 13 assertions).
- Runs unchanged in a Supabase Edge Function (Deno/TS) to re-validate a
  client-submitted solution → **anti-cheat** without a second implementation.
- Safe to call speculatively for **hints/tooltips** (`engine.preview(id)`).

---

## 4. Queue Management

Each approach is a single-file lane. Invariants enforced by the engine:

- Only the car at `queueIndex === 0` is `WAITING`; the rest are `QUEUED`.
- Tapping a `QUEUED` car returns `NOT_AT_FRONT` → no-op, no penalty.
- When the front car reaches `CLEARED`, `promoteQueue(from)` compacts the lane:
  everyone's `queueIndex` shifts down by one and the new front becomes
  `WAITING`. O(cars-on-arm) per clear.

```ts
// engine.ts (excerpt)
private promoteQueue(from: Direction) {
  const queue = this.getVehicles()
    .filter(v => v.from === from && (v.state === QUEUED || v.state === WAITING))
    .sort((a, b) => a.queueIndex - b.queueIndex);
  queue.forEach((v, idx) => {
    v.queueIndex = idx;
    v.state = idx === 0 ? WAITING : QUEUED;
  });
}
```

---

## 5. Level Data Structure

Levels are **plain data** (`LevelDefinition`) — hand-author, generate, or export
from a designer tool. Full interface in `core/types.ts`; shape summary:

```ts
interface LevelDefinition {
  id: number;
  name: string;
  type: IntersectionType;              // CROSS | T_JUNCTION | ROUNDABOUT
  lives: number;
  starThresholdsMs?: [number, number, number];
  approaches: ApproachDesign[];        // per-arm sign, lights, spawn queue
  controller?: ControllerScript;       // boss levels only (regulirovshik)
  tags?: string[];                     // 'tutorial' | 'boss' | 'signs' | ...
}

interface ApproachDesign {
  direction: Direction;
  sign: SignType;                      // NONE | MAIN_ROAD | YIELD | STOP | ROUNDABOUT
  enabled?: boolean;
  queue: SpawnSpec[];                  // front-to-back
  trafficLight?: TrafficLight;         // deterministic cycle + offset
}

interface SpawnSpec { kind: VehicleKind; intent: TurnIntent; skinId?: string; }
```

### 5.1 Progression (`levels/levels.ts`)

A **seeded, deterministic** generator (mulberry32 PRNG) builds the 50-level
campaign per the design brief, so `generateLevel(id)` is stable across runs and
platforms:

| Band | Levels | Content |
|------|--------|---------|
| Baza | 1–10 | CROSS, equal roads, ≤1 car/arm — teach the right-hand rule |
| Murakkab | 11–30 | main/secondary signs **or** traffic lights, 2–3 car queues |
| Aylanma | 31–50 | ROUNDABOUT topology, heavier traffic |
| **Boss** | 10, 20, 30, 40, 50 | **regulirovshik** `ControllerScript` overrides signs/lights; max tirbandlik |

Levels 1–3 are hand-tuned tutorials with exact uz wording. Determinism means a
leaderboard for "level 27" always refers to the same layout.

---

## 6. Performance — 20+ cars at 60 fps

The requirement is smooth isometric rendering under heavy traffic. Techniques
used (and recommended for the RN/Flutter port):

1. **Static scene caching.** Roads, kerbs, signs, and roundabout island are
   rendered **once** to an offscreen canvas (`renderScene`) and `drawImage`-blitted
   each frame. Only vehicles are re-drawn. → the expensive tile fills happen on
   level load / resize, not per frame.
2. **Single surface, single loop.** One `<canvas>` + one `requestAnimationFrame`
   loop. **No per-vehicle DOM nodes** (the classic mobile-web killer). In RN use
   one `react-native-skia` `Canvas`; in Flutter one `CustomPainter`.
3. **Painter's algorithm for depth.** Vehicles are sorted by projected screen-Y
   (`sortForPaint`) and drawn back-to-front, giving correct isometric overlap
   without a z-buffer. Sort is O(n log n) on ≤~30 items — negligible.
4. **No hot-path allocations.** Projection returns small literals; the loop
   avoids array/object churn. GC pressure is what causes frame drops on mobile.
5. **Fixed-ish timestep.** `update(dt)` clamps `dt ≤ 50ms` so a stall can't
   teleport cars through the intersection; motion stays deterministic.
6. **Decouple sim from React.** Because the canvas reads engine state directly,
   React never diffs the moving entities — it only re-renders the HUD chrome a
   few times/sec.

**Scaling further (100+ entities):** add a coarse spatial hash for hit-testing,
sprite-atlas the car art (one texture, `drawImage` sub-rects), and move the sim
to a Web Worker / isolate, posting only a typed-array snapshot to the render
thread.

---

## 7. Supabase — progression sync & anti-cheat

### 7.1 Schema (Postgres)

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  total_coins int not null default 0,
  created_at timestamptz default now()
);

create table level_progress (
  user_id uuid references profiles(id) on delete cascade,
  level_id int not null,
  best_time_ms int,
  stars int check (stars between 0 and 3),
  completed_at timestamptz default now(),
  primary key (user_id, level_id)
);

create table garage_inventory (
  user_id uuid references profiles(id) on delete cascade,
  item_id text not null,
  primary key (user_id, item_id)
);
```

Enable **Row Level Security** so each row is readable/writable only by its owner:

```sql
alter table level_progress enable row level security;
create policy "own rows" on level_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### 7.2 Anti-cheat via the shared rule engine

The client submits a **replay** (`levelId`, ordered `tap` sequence, `dt` stream)
rather than a raw score. A Supabase **Edge Function** (Deno/TypeScript) imports
the *same* `core/` modules, re-runs the deterministic simulation, and only then
writes `level_progress`:

```ts
// supabase/functions/submit-run/index.ts (sketch)
import { GameEngine } from '../../core/engine.ts';
import { generateLevel } from '../../levels/levels.ts';

const { levelId, taps, dts } = await req.json();
const engine = new GameEngine(generateLevel(levelId));
let ti = 0;
for (const dt of dts) {
  while (taps[ti]?.atMs <= engine.state.clockMs) engine.tap(taps[ti++].vehicleId);
  engine.update(dt);
}
const s = engine.status();
if (!s.isComplete) return json({ ok: false }, 400);   // reject impossible runs
// upsert best_time / stars with RLS-scoped auth.uid()
```

Because the engine is deterministic and pure, the server's verdict is
authoritative and the client cannot fake a completion or time.

### 7.3 Offline-first sync

Persist progress locally (AsyncStorage / MMKV / Hive) and reconcile with an
`upsert` on reconnect, keeping the better `best_time_ms` / higher `stars`. Coins
are server-authoritative (awarded on validated completion) to protect the economy.

---

## 8. Testing

`tests/engine.test.mjs` runs the compiled engine under Node (no DOM) and asserts
the behaviours the design depends on:

- right-hand rule (exactly one of two conflicting equals yields),
- main-road beats yield, emergency priority,
- queue management (2nd car blocked → promoted → level completes),
- fairness (non-conflicting moves both legal),
- campaign size, boss placement, and generator determinism.

```
npm run build && node tests/engine.test.mjs   # → 13 passed, 0 failed
```

Port these to Vitest/Jest in the app repo; the assertions are engine-level and
UI-independent, so they transfer verbatim.

---

## 9. Porting checklist (RN / Flutter)

- [ ] Keep `core/` **byte-identical** — it's already framework-free.
- [ ] Replace `state/store.ts`'s mini-`create` with real Zustand (RN) or a Cubit (Flutter).
- [ ] Rewrite `render/iso.ts` against `react-native-skia` / `CustomPainter`;
      the projection math (`isoProject`, `laneAnchor`, `crossingPoint`) is reusable as-is.
- [ ] Replace `demo/main.ts` input with `Pressable`/`GestureDetector` hit-tests.
- [ ] Wire `GameEvent`s to audio (YPX whistle, engine SFX), haptics, analytics.
- [ ] Deploy `core/` to a Supabase Edge Function for run validation.
