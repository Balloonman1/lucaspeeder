// Level definitions: terrain shape, trail/road layout, texture layers, sky palette, foods and props.
// terrain.js, props.js, sky.js and game.js read the active level through `level`.
import * as T from 'three';
import { HALF, smooth, vnoise, settings } from './config.js';
import { A } from './assets.js';

// ---- procedural texture sets for places we have no scanned textures for (snow, ice, asphalt, concrete) ----
function texCanvas(size, draw, srgb) { const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = settings.Q.aniso; if (srgb) t.colorSpace = T.SRGBColorSpace; return t; }
function noiseFill(x, S, base, amp, scales, tint) { const img = x.createImageData(S, S); const d = img.data; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { let n = 0, w = 0; for (const [f, a] of scales) { n += vnoise(i / S * f, j / S * f) * a; w += a; } n /= w; const v = base + (n - 0.5) * amp; const k = (j * S + i) * 4; d[k] = v * tint[0]; d[k + 1] = v * tint[1]; d[k + 2] = v * tint[2]; d[k + 3] = 255; } x.putImageData(img, 0, 0); }
const flatNormal = () => texCanvas(4, (x) => { x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, 4, 4); });
const armTex = (rough) => texCanvas(4, (x) => { x.fillStyle = `rgb(255,${Math.round(rough * 255)},0)`; x.fillRect(0, 0, 4, 4); });
function bumpyNormal(S, strength, scales) { // normal map derived from the same noise as the diffuse
  return texCanvas(S, (x) => { const img = x.createImageData(S, S); const d = img.data; const h = (i, j) => { let n = 0, w = 0; for (const [f, a] of scales) { n += vnoise(((i + S) % S) / S * f, ((j + S) % S) / S * f) * a; w += a; } return n / w; };
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const dx = (h(i + 1, j) - h(i - 1, j)) * strength, dy = (h(i, j + 1) - h(i, j - 1)) * strength; const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1); const k = (j * S + i) * 4; d[k] = 128 - dx * nz * 127; d[k + 1] = 128 - dy * nz * 127; d[k + 2] = 128 + nz * 127; d[k + 3] = 255; } x.putImageData(img, 0, 0); });
}
let PROC = null;
export function proceduralSets() {
  if (PROC) return PROC;
  const snowScales = [[6, .5], [24, .3], [96, .2]], iceScales = [[3, .5], [12, .3], [60, .2]], aspScales = [[40, .3], [200, .7]], conScales = [[8, .3], [60, .7]];
  PROC = {
    snow:     { diff: texCanvas(512, (x, S) => noiseFill(x, S, 236, 22, snowScales, [1, 1.01, 1.04]), true), nor: bumpyNormal(256, 6, snowScales), arm: armTex(0.85) },
    snowPath: { diff: texCanvas(512, (x, S) => { noiseFill(x, S, 205, 40, [[10, .4], [60, .6]], [0.98, 1.0, 1.06]); }, true), nor: bumpyNormal(256, 10, [[10, .4], [60, .6]]), arm: armTex(0.75) },
    ice:      { diff: texCanvas(512, (x, S) => { noiseFill(x, S, 190, 30, iceScales, [0.78, 0.9, 1.0]); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5; for (let i = 0; i < 40; i++) { x.beginPath(); let px = Math.random() * S, py = Math.random() * S; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - .5) * 90; py += (Math.random() - .5) * 90; x.lineTo(px, py); } x.stroke(); } }, true), nor: bumpyNormal(256, 2, iceScales), arm: armTex(0.12) },
    asphalt:  { diff: texCanvas(512, (x, S) => noiseFill(x, S, 58, 26, aspScales, [1, 1, 1.03]), true), nor: bumpyNormal(256, 5, aspScales), arm: armTex(0.9) },
    concrete: { diff: texCanvas(512, (x, S) => { noiseFill(x, S, 168, 24, conScales, [1, 0.99, 0.96]); x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke(); x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke(); } }, true), nor: flatNormal(), arm: armTex(0.85) },
    road:     { diff: texCanvas(512, (x, S) => { noiseFill(x, S, 55, 24, aspScales, [1, 1, 1.03]); x.fillStyle = '#e8c23a'; x.fillRect(S / 2 - 6, 0, 5, S); x.fillRect(S / 2 + 2, 0, 5, S); x.fillStyle = '#e6e6e6'; for (let j = 0; j < S; j += 64) { x.fillRect(S * 0.14, j, 6, 36); x.fillRect(S * 0.86, j, 6, 36); } }, true), nor: bumpyNormal(256, 4, aspScales), arm: armTex(0.9) },
    windows:  { diff: texCanvas(256, (x, S) => { x.fillStyle = '#6a6e78'; x.fillRect(0, 0, S, S); for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const lit = Math.random() < 0.5; x.fillStyle = lit ? `rgb(${200 + Math.random() * 55},${190 + Math.random() * 50},${120 + Math.random() * 60})` : `rgb(${30 + Math.random() * 30},${40 + Math.random() * 30},${60 + Math.random() * 30})`; x.fillRect(i * 42 + 8, j * 32 + 6, 26, 20); } }, true), nor: flatNormal(), arm: armTex(0.4) },
    windows2: { diff: texCanvas(256, (x, S) => { x.fillStyle = '#8a6b52'; x.fillRect(0, 0, S, S); for (let j = 0; j < 8; j++) for (let i = 0; i < 5; i++) { const lit = Math.random() < 0.4; x.fillStyle = lit ? `rgb(${230},${210 + Math.random() * 30},${150})` : `rgb(${40},${45},${60})`; x.fillRect(i * 50 + 10, j * 32 + 6, 30, 18); } for (let j = 0; j <= 8; j++) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, j * 32, S, 3); } }, true), nor: flatNormal(), arm: armTex(0.7) },
    glass:    { diff: texCanvas(256, (x, S) => { x.fillStyle = '#3f5a78'; x.fillRect(0, 0, S, S); x.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i <= 8; i++) { x.fillRect(i * 32, 0, 2, S); x.fillRect(0, i * 32, S, 2); } for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (Math.random() < 0.3) { x.fillStyle = 'rgba(255,240,200,.55)'; x.fillRect(i * 32 + 3, j * 32 + 3, 26, 26); } }, true), nor: flatNormal(), arm: armTex(0.15) },
  };
  return PROC;
}

// ---- road / trail layouts ----
const canyonTrails = [
  (x, z) => Math.abs(z - 70 * Math.sin(x * 0.011) - 10),
  (x, z) => Math.abs(x - 80 * Math.sin(z * 0.013) + 30),
  (x, z) => Math.abs((z - x * 0.6) - 50 * Math.sin((x + z) * 0.009) + 60),
];
const iceTrails = [
  (x, z) => Math.abs(z - 90 * Math.sin(x * 0.009) + 20),
  (x, z) => Math.abs(x - 60 * Math.cos(z * 0.012) - 40),
];
export const BLOCK = 64, STREET = 12; // NYC grid: streets every 64 m, 12 m wide
const nycRoads = [
  (x, z) => { const m = ((x % BLOCK) + BLOCK) % BLOCK; return Math.abs(m - BLOCK / 2) <= STREET / 2 ? 0 : Math.abs(m - BLOCK / 2) - STREET / 2; },
  (x, z) => { const m = ((z % BLOCK) + BLOCK) % BLOCK; return Math.abs(m - BLOCK / 2) <= STREET / 2 ? 0 : Math.abs(m - BLOCK / 2) - STREET / 2; },
];
export const inPark = (x, z) => Math.abs(x) < 100 && Math.abs(z) < 70; // the big central park

export const LEVELS = {
  canyon: {
    id: 'canyon', name: 'Veyra Canyon', blurb: 'Sunlit canyon valley, dusty trails, warm light.', icon: '🏜️',
    trails: canyonTrails, trailWidth: 7.5, foods: ['rice', 'veg', 'strawberry', 'raspberry', 'milk', 'bagel', 'toast', 'fries', 'icecream'],
    grip: 1.0, startClock: 0.36,
    height(x, z, td) { const roll = 2.2 * Math.sin(x * 0.03) * Math.cos(z * 0.026) + 1.1 * Math.sin(x * 0.08 + z * 0.06) + 0.5 * Math.sin(z * 0.15) * Math.cos(x * 0.12) + (vnoise(x * 0.05, z * 0.05) - 0.5) * 1.2;
      const r = Math.max(Math.abs(x), Math.abs(z)) / HALF; const rim = smooth(0.78, 1.0, r) * 22 + smooth(0.9, 1.0, r) * 18; const carve = -1.4 * smooth(11, 3, td) - 0.5 * Math.exp(-Math.pow(td / 4, 2)); return roll + rim + carve; },
    layers() { return [A.tex.trail, A.tex.grass, A.tex.rocks, A.tex.cliff]; },
    weights(x, z, h, slope, td) { const trail = Math.exp(-Math.pow(td / 7.5, 2)); const n = vnoise(x * 0.03 + 50, z * 0.03 + 50);
      const wT = smooth(0.2, 0.85, trail) + smooth(0.05, 0.25, trail) * 0.45, wC = Math.min(1, smooth(0.35, 0.9, slope) + smooth(7, 18, h));
      const wR = (smooth(0.58, 0.8, n) * 0.75 + smooth(0.2, 0.45, slope) * 0.4 + smooth(0.02, 0.12, trail) * smooth(0.3, 0.0, trail) * 0.6) * (1 - wT) * (1 - wC); return [wT, Math.max(0, 1 - wT - wC - wR), wR, wC]; },
    tint: [0xf0e2cc, 0xcfd6c6], tileM: 4.5,
    sky: { day: 0x8fc3f0, dusk: 0xff8c4a, night: 0x16142e, fogDay: 0xe7d6bd, skyTop: 0x3b7dd1, skyHor: 0xe4ebf1, duskTop: 0x6a3a7a, hemiSky: 0xcfe3ff, hemiGround: 0x9a6a45, sunDay: 0xfff1d8, exposure: 1.0 },
    weather: 'none', mapBg: 'rgba(120,90,55,.6)',
  },
  ice: {
    id: 'ice', name: 'Kaldris Ice Shelf', blurb: 'Frozen planet: snowfields, glass-ice lakes, ice spires. Slippery.', icon: '❄️',
    trails: iceTrails, trailWidth: 9, foods: ['rice', 'veg', 'strawberry', 'raspberry', 'milk', 'bagel', 'toast', 'fries', 'icecream'],
    grip: 0.72, startClock: 0.34,
    height(x, z, td) { const lake = smooth(0.62, 0.72, vnoise(x * 0.012 + 9, z * 0.012 + 4)); const roll = (2.6 * Math.sin(x * 0.022) * Math.cos(z * 0.019) + 1.2 * Math.sin(x * 0.07 + z * 0.05) + (vnoise(x * 0.06, z * 0.06) - 0.5) * 1.6) * (1 - lake) - 0.8 * lake;
      const r = Math.max(Math.abs(x), Math.abs(z)) / HALF; const rim = smooth(0.8, 1.0, r) * 30 + smooth(0.92, 1.0, r) * 24; const carve = -0.6 * smooth(12, 4, td) * (1 - lake); return roll + rim + carve; },
    lake(x, z) { return smooth(0.62, 0.72, vnoise(x * 0.012 + 9, z * 0.012 + 4)); },
    layers() { const P = proceduralSets(); return [P.snowPath, P.snow, P.ice, A.tex.cliff]; },
    weights(x, z, h, slope, td) { const lake = this.lake(x, z); const trail = Math.exp(-Math.pow(td / 9, 2)) * (1 - lake);
      const wI = lake, wT = smooth(0.25, 0.85, trail) * (1 - wI), wC = Math.min(1, smooth(0.5, 1.0, slope) * 0.8 + smooth(12, 26, h) * 0.9) * (1 - wI); return [wT, Math.max(0, 1 - wT - wI - wC), wI, wC]; },
    tint: [0xf4f8ff, 0xdbe6f4], tileM: 6,
    sky: { day: 0xa9cfee, dusk: 0xffa070, night: 0x0c1226, fogDay: 0xdfe9f3, skyTop: 0x2f66b8, skyHor: 0xeaf1f7, duskTop: 0x4b3a7a, hemiSky: 0xd8e8ff, hemiGround: 0x9fb6d0, sunDay: 0xfff6ea, exposure: 1.05 },
    weather: 'snow', mapBg: 'rgba(170,190,215,.6)',
  },
  nyc: {
    id: 'nyc', name: 'New York City', blurb: 'Streets, skyscrapers, Central Park, parked taxis to jump. Pizza!', icon: '🗽',
    trails: nycRoads, trailWidth: 6, foods: ['pizza', 'pizza', 'bagel', 'fries', 'icecream', 'rice', 'veg', 'milk', 'toast', 'strawberry'],
    grip: 1.0, startClock: 0.4,
    height(x, z, td) { const r = Math.max(Math.abs(x), Math.abs(z)) / HALF; const rim = smooth(0.93, 1.0, r) * 6; const park = inPark(x, z) ? (1.2 * Math.sin(x * 0.05) * Math.cos(z * 0.045) + (vnoise(x * 0.08, z * 0.08) - 0.5) * 0.8) * smooth(0, 6, td) : 0; return rim + park + (vnoise(x * 0.5, z * 0.5) - 0.5) * 0.03; },
    layers() { const P = proceduralSets(); return [P.road, A.tex.grass, P.concrete, P.asphalt]; },
    weights(x, z, h, slope, td) { const road = td <= 0.01 ? 1 : 0; const walk = td > 0.01 && td < 4.5 ? 1 : 0; const park = inPark(x, z) && !road && !walk ? 1 : 0; const plaza = (!road && !walk && !park) ? 1 : 0;
      return [road, park, walk + plaza * 0.85, plaza * 0.15]; },
    tint: [0xffffff, 0xf2f2f2], tileM: 6,
    sky: { day: 0x9fc4e8, dusk: 0xff9a5a, night: 0x1a1830, fogDay: 0xd8d2cc, skyTop: 0x3f78c8, skyHor: 0xe6e2dc, duskTop: 0x7a3f6a, hemiSky: 0xcdddf0, hemiGround: 0x6a6660, sunDay: 0xfff1d8, exposure: 0.98 },
    weather: 'none', mapBg: 'rgba(70,70,80,.65)', roadUV: true,
  },
};
export const LEVEL_KEYS = Object.keys(LEVELS);
export let level = LEVELS.canyon;
export function setLevel(id) { level = LEVELS[id] || LEVELS.canyon; return level; }
