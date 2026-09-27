/** Tiny colour helpers with caching (no per-frame string allocation for hot colours). */

const cache = new Map<string, string>();

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Multiply brightness (k < 1 darker, k > 1 lighter). */
export function shade(hex: string, k: number): string {
  const key = `${hex}|${k.toFixed(3)}`;
  let v = cache.get(key);
  if (!v) {
    const [r, g, b] = parse(hex);
    const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 1 ? c + (255 - c) * (k - 1) : c * k)));
    v = `rgb(${f(r)},${f(g)},${f(b)})`;
    cache.set(key, v);
  }
  return v;
}

export function alpha(hex: string, a: number): string {
  const key = `${hex}|a${a.toFixed(3)}`;
  let v = cache.get(key);
  if (!v) {
    const [r, g, b] = parse(hex);
    v = `rgba(${r},${g},${b},${a})`;
    cache.set(key, v);
  }
  return v;
}

export const PALETTE = {
  grass: '#8cc26a',
  grassDark: '#7bb05a',
  sidewalk: '#dcd5c6',
  curb: '#b7ae9d',
  asphalt: '#4b5059',
  asphaltLight: '#565c66',
  line: '#f5f5f0',
  island: '#77b25a',
  water: '#6cc3e8',
} as const;
