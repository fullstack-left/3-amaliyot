/**
 * Replays — the anti-cheat primitive.
 *
 * The client never submits "I got 3 stars". It submits the list of
 * state-changing taps [tick, vehicleId]. The server re-simulates the level with
 * this exact engine and derives the result itself.
 */
import { GameEngine } from './engine.js';
export const MAX_REPLAY_TAPS = 4000;
/** 15 minutes of simulated time. */
export const MAX_REPLAY_TICKS = 60 * 60 * 15;
export function makeReplay(engine) {
    return {
        v: 1,
        levelId: engine.level.id,
        taps: engine.taps.map(([t, id]) => [t, id]),
        endTick: engine.endTick >= 0 ? engine.endTick : engine.tick,
    };
}
export function verifyReplay(level, replay, parMs) {
    const engine = new GameEngine(level, { parMs });
    const fail = (error) => ({ ok: false, error, result: engine.result() });
    if (!replay || replay.v !== 1)
        return fail('replay_version');
    if (replay.levelId !== level.id)
        return fail('level_mismatch');
    if (!Array.isArray(replay.taps) || replay.taps.length > MAX_REPLAY_TAPS)
        return fail('taps_invalid');
    if (!Number.isInteger(replay.endTick) || replay.endTick < 0 || replay.endTick > MAX_REPLAY_TICKS) {
        return fail('end_tick_invalid');
    }
    let prev = 0;
    for (const tap of replay.taps) {
        if (!Array.isArray(tap) || tap.length !== 2)
            return fail('tap_shape');
        const [t, id] = tap;
        if (!Number.isInteger(t) || t < prev || t > replay.endTick || typeof id !== 'string')
            return fail('tap_order');
        if (!engine.byId.has(id))
            return fail('unknown_vehicle');
        prev = t;
    }
    let i = 0;
    while (engine.status === 'playing' && engine.tick <= replay.endTick) {
        while (i < replay.taps.length && replay.taps[i][0] === engine.tick) {
            engine.tap(replay.taps[i][1]);
            i++;
            if (engine.status !== 'playing')
                break;
        }
        if (engine.status !== 'playing')
            break;
        engine.step();
    }
    if (i < replay.taps.length)
        return fail('taps_after_end');
    const result = engine.result();
    if (!result.completed)
        return { ok: false, error: 'not_completed', result };
    if (result.ticks !== replay.endTick)
        return { ok: false, error: 'end_tick_mismatch', result };
    return { ok: true, result };
}
//# sourceMappingURL=replay.js.map