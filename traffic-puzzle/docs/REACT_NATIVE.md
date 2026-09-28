# Porting to React Native (or Flutter)

> This is a port guide. The snippets below were **not compiled** in this repository, because the build sandbox has no npm access. `src/core` and `src/content` are the parts you reuse unchanged; they are plain ES2022 TypeScript with no DOM access.

## 1. What moves over as-is

| Module | Reuse |
|---|---|
| `src/core/**` | 100 %: engine, rules, geometry, replay, bot |
| `src/content/**` | 100 %: campaign, garage catalog, Uzbek texts |
| `src/web/render/camera.ts`, `looks.ts` | the projection math and appearance logic port directly |
| `src/web/render/vehicles.ts`, `scene.ts`, `props.ts` | rewrite the drawing calls for Skia; the geometry stays the same |
| `src/web/net/*` | works in RN (`fetch` is available); persist the session with MMKV/AsyncStorage |

Add `.js` import specifiers to Metro's resolver, or copy `core/` into the app as a local package.

## 2. State: real Zustand

The web store (`src/web/store.ts`) mirrors Zustand's `create((set, get) => …)` contract, so the store body ports unchanged:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeReward } from '@chorraha/core/scoring';

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      save: defaultSave(),
      // target = { kind: 'campaign' | 'daily' | 'endless' | 'custom', … } as in src/web/app.ts
      finishRun(target, def, result, replay, extras) {
        const prev = get().save.progress[def.id]?.stars ?? 0;
        const reward = target.kind === 'campaign' ? computeReward(def.band, result, prev) : undefined;
        set((s) => ({ save: { ...s.save, coins: s.save.coins + (reward?.total ?? 0) /* … same as web app.ts */ } }));
        return reward;
      },
      // daily streak, endless records, achievements, buy, equip, cloudSync … copied from src/web/app.ts
    }),
    { name: 'chorraha.save.v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
```

The **engine never goes into Zustand**. Keep it in a ref; React re-renders only the HUD.

## 3. Game loop + rendering with Skia

```tsx
import { Canvas, Picture, Skia, createPicture } from '@shopify/react-native-skia';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { GameEngine, TICK_MS, canVehicleMove } from '@chorraha/core';

export function PlayScreen({ level }) {
  const engine = useRef(new GameEngine(level)).current;
  const acc = useRef(0);
  const frame = useSharedValue(0);

  // fixed 60 Hz simulation, render every display frame (120 Hz devices interpolate)
  useFrameCallback(({ timeSincePreviousFrame: dt }) => {
    acc.current += Math.min(250, dt ?? 16.7);
    while (acc.current >= TICK_MS) { engine.step(); acc.current -= TICK_MS; }
    frame.value += 1;             // triggers the Skia redraw
  }, true);

  const picture = useDerivedValue(() =>
    createPicture((canvas) => drawFrame(canvas, engine, acc.current / TICK_MS)), [frame]);

  const onTap = Gesture.Tap().onEnd((e) => {
    const id = pick(engine, e.x, e.y);   // port of Renderer.pick (convex hull test)
    if (id) runOnJS(() => engine.tap(id))();
  });

  return (
    <GestureDetector gesture={onTap}>
      <Canvas style={{ flex: 1 }}><Picture picture={picture} /></Canvas>
    </GestureDetector>
  );
}
```

Performance mapping from the web renderer:

| Web | React Native Skia |
|---|---|
| offscreen `<canvas>` static scene | record once into an `SkPicture` / `SkImage` (`Skia.Surface.MakeOffscreen`) |
| vehicle sprite LRU (look × 64 headings) | same cache of `SkImage`s; draw with `canvas.drawImage` |
| painter's sort by `x + y` | identical |
| `requestAnimationFrame` + accumulator | `useFrameCallback` + accumulator |

Audio: the whistle, siren and coin sounds are synthesised with WebAudio on the web. In RN, export them once to `.wav` and play them with `expo-av`.

## 4. Flutter / Bloc

- **Engine.** Either run `src/core` in a JS runtime (`flutter_js`), or port it to Dart. It is about 2.2k lines of plain arithmetic, and `tests/*.test.mjs` defines the behaviour the port must reproduce (63 cases). Replay determinism across client and server only holds if the server runs the same implementation.
- **Cold state.** `Cubit<AppState>` holds screen, save, economy and garage.
- **Hot state.** A `CustomPainter` reads the engine each `Ticker` frame, outside the Bloc rebuild path. Wrap it in a `RepaintBoundary`.
- **Sprites.** Use `PictureRecorder` → `toImage()` per (look, heading bucket) and keep them in an LRU map.
