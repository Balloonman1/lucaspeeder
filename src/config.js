// World and match constants shared by every module.
export const WORLD = 520;
export const HALF = WORLD / 2;
export const MAX_PLAYERS = 10;
export const DAY_LEN = 150;          // seconds per in-game day

export const BIKE_COLORS = ['#3b7bff','#ff4d6d','#ffb347','#7cff8a','#ff6ad5','#4df0e0','#b347ff','#f5f5f5','#ff7a1a','#111827'];
export const HATS = { none:'No hat', cap:'Cap', cone:'Party cone', crown:'Crown', horns:'Horns', antenna:'Antenna', tophat:'Top hat' };
export const BOT_NAMES = ['Rex','Zula','Kato','Vex','Nova','Juno','Orin','Pip','Tala','Bram','Mox','Sable'];

// Graphics presets. `tex` picks the texture resolution folder, `ao` enables ground-truth ambient occlusion.
export const QUALITY = {
  low:    { px:0.75, shadows:false, shadowMap:0,    particles:30,  plants:400,  clouds:6,  aniso:1, post:false, ao:false, tex:'1k', rocks:60,  trees:6  },
  medium: { px:1,    shadows:true,  shadowMap:1024, particles:60,  plants:1600, clouds:10, aniso:2, post:true,  ao:false, tex:'1k', rocks:140, trees:14 },
  high:   { px:Math.min(devicePixelRatio,2), shadows:true, shadowMap:2048, particles:120, plants:3600, clouds:14, aniso:8, post:true, ao:true,  tex:'1k', rocks:220, trees:22 },
  ultra:  { px:Math.min(devicePixelRatio,2), shadows:true, shadowMap:4096, particles:200, plants:6000, clouds:18, aniso:16, post:true, ao:true, tex:'2k', rocks:320, trees:30 },
};

export const settings = {
  qualityName: 'high',
  get Q(){ return QUALITY[this.qualityName]; },
};
try {
  const saved = localStorage.getItem('speederQuality');
  const coarse = matchMedia('(pointer:coarse)').matches;
  settings.qualityName = QUALITY[saved] ? saved : (coarse ? 'medium' : 'high');
} catch (e) {}

export const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
export const $ = id => document.getElementById(id);
export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Seeded random so every player builds the same planet from the same seed.
let seedState = 1;
export function setSeed(s) { seedState = s; }
export function srand() { seedState |= 0; seedState = seedState + 0x6D2B79F5 | 0; let t = Math.imul(seedState ^ seedState >>> 15, 1 | seedState); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
export const srange = (a, b) => a + srand() * (b - a);

// Cheap value noise used by terrain coloring, geometry displacement and texture generation.
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const lerp = (a, b, t) => a + (b - a) * t;
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
