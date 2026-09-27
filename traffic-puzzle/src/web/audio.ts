/**
 * Synthesised sound effects (WebAudio) — no audio files needed.
 * The AudioContext is created lazily on the first user gesture (autoplay policy).
 */

export class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastSiren = 0;

  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** YPX (traffic police) whistle: two trilled blasts. */
  whistle(): void {
    const ctx = this.ready();
    if (!ctx) return;
    for (const [start, dur] of [
      [0, 0.32],
      [0.4, 0.55],
    ] as const) {
      const t = ctx.currentTime + start;
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 2900;
      lfo.frequency.value = 28;
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.setValueAtTime(0.35, t + dur - 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master!);
      o.start(t);
      lfo.start(t);
      o.stop(t + dur + 0.02);
      lfo.stop(t + dur + 0.02);
    }
  }

  /** Ambulance wail (throttled so it never spams). */
  siren(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastSiren < 3500) return;
    this.lastSiren = now;
    for (let i = 0; i < 2; i++) {
      this.tone(680, 0.6, 'triangle', 0.12, i * 1.2, 1350);
      this.tone(1350, 0.6, 'triangle', 0.12, i * 1.2 + 0.6, 680);
    }
  }

  coin(): void {
    this.tone(988, 0.08, 'square', 0.06);
    this.tone(1319, 0.14, 'square', 0.06, 0.07);
  }

  honk(): void {
    this.tone(350, 0.2, 'square', 0.05);
    this.tone(440, 0.2, 'square', 0.04);
  }

  go(): void {
    this.tone(180, 0.22, 'sawtooth', 0.03, 0, 320);
  }

  click(): void {
    this.tone(1200, 0.03, 'square', 0.03);
  }

  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.12));
  }

  lose(): void {
    this.tone(440, 0.35, 'sawtooth', 0.08, 0, 330);
    this.tone(330, 0.5, 'sawtooth', 0.08, 0.35, 196);
  }
}
