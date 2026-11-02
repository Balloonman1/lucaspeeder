// Vehicle classes, paint/trim/pattern customization and the bike mesh builder.
import * as T from 'three';
import { world } from './engine.js';
import { settings } from './config.js';

// Each class trades speed, acceleration, handling, jump and energy use.
export const BIKES = {
  scout:  { name:'Scout',  blurb:'Balanced all-rounder. Easy to ride.',            speed:28, accel:34, turn:2.3, jump:14, drain:1.00, armor:1.0 },
  blitz:  { name:'Blitz',  blurb:'Fastest top speed, wide turns, burns energy.',    speed:33, accel:30, turn:1.95, jump:13, drain:1.10, armor:1.0 },
  hauler: { name:'Hauler', blurb:'Heavy and efficient. Crashes hurt half as much.', speed:25, accel:42, turn:2.1, jump:12, drain:0.90, armor:0.5 },
  hopper: { name:'Hopper', blurb:'Light pods, sharp steering, huge jumps.',         speed:27, accel:34, turn:2.7, jump:17, drain:1.00, armor:1.0 },
};
export const BIKE_KEYS = Object.keys(BIKES);
export const TRIMS = ['#4df0e0','#ff6ad5','#ffe066','#7cff8a','#ffffff','#ff5a3a','#4da3ff','#b347ff'];
export const PATTERNS = { solid:'Solid', stripe:'Racing stripe', checker:'Checker', hex:'Hex plate', flame:'Flames' };
export function statOf(spec){ return BIKES[spec && spec.bike] || BIKES.scout; }

const texCache = {};
function paintTexture(color, accent, pattern){
  const key = color + accent + pattern; if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 128); x.fillStyle = accent;
  if (pattern === 'stripe') { x.fillRect(0, 50, 256, 28); x.fillStyle = '#ffffff'; x.fillRect(0, 46, 256, 4); x.fillRect(0, 78, 256, 4); }
  else if (pattern === 'checker') { for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 16, j * 16, 16, 16); }
  else if (pattern === 'hex') { for (let j = 0; j < 9; j++) for (let i = 0; i < 12; i++) { const px = i * 24 + (j % 2) * 12, py = j * 16; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6; x.lineTo(px + Math.cos(a) * 9, py + Math.sin(a) * 9); } x.closePath(); x.lineWidth = 2; x.strokeStyle = accent; x.stroke(); } }
  else if (pattern === 'flame') { x.beginPath(); x.moveTo(0, 128); for (let i = 0; i <= 10; i++) { const px = i * 25.6; x.quadraticCurveTo(px + 8, 128 - (i % 2 ? 90 : 30), px + 25.6, 128 - (i % 3 ? 40 : 70)); } x.lineTo(256, 128); x.closePath(); x.fill(); x.fillStyle = '#ffd166'; x.globalAlpha = .6; x.beginPath(); x.moveTo(0, 128); for (let i = 0; i <= 10; i++) { const px = i * 25.6; x.quadraticCurveTo(px + 8, 128 - (i % 2 ? 50 : 18), px + 25.6, 128 - (i % 3 ? 22 : 40)); } x.lineTo(256, 128); x.closePath(); x.fill(); x.globalAlpha = 1; }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = settings.Q.aniso; t.wrapS = t.wrapT = T.RepeatWrapping; texCache[key] = t; return t;
}

const mat = (color, extra = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .1 }, extra));
const metal = (color, extra = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .28, metalness: .85 }, extra));
const glowMat = (color, extra = {}) => new T.MeshStandardMaterial(Object.assign({ color, emissive: color, emissiveIntensity: 0.9, roughness: .3, metalness: 0 }, extra));

export function labelSprite(text, color, w){
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d'); ctx.font = '700 30px Exo 2, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(18,10,31,.6)'; ctx.beginPath(); ctx.roundRect(8, 10, 240, 44, 22); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(text, 128, 33);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); s.scale.set(w || 5, (w || 5) / 4, 1); return s;
}

function addHat(root, hat){
  const g = new T.Group(); g.position.set(0, 0, .6); root.add(g); const y = 1.87;
  if (hat === 'cap') { const c = new T.Mesh(new T.SphereGeometry(.34, 12, 8, 0, 6.3, 0, 1.5), mat(0xff4d6d)); c.position.set(0, y - .2, -.05); g.add(c); const b = new T.Mesh(new T.BoxGeometry(.5, .05, .35), mat(0xff4d6d)); b.position.set(0, y - .12, .3); g.add(b); }
  else if (hat === 'cone') { const c = new T.Mesh(new T.ConeGeometry(.3, .9, 12), mat(0xffb347)); c.position.set(0, y + .3, -.05); g.add(c); const s = new T.Mesh(new T.TorusGeometry(.2, .05, 6, 12), mat(0x4df0e0)); s.position.set(0, y + .3, -.05); s.rotation.x = Math.PI / 2; g.add(s); const ball = new T.Mesh(new T.SphereGeometry(.09, 8, 8), mat(0xff6ad5)); ball.position.set(0, y + .78, -.05); g.add(ball); }
  else if (hat === 'crown') { const c = new T.Mesh(new T.CylinderGeometry(.34, .3, .3, 8, 1, true), new T.MeshStandardMaterial({ color: 0xffd24d, metalness: .9, roughness: .25, side: T.DoubleSide })); c.position.set(0, y, -.05); g.add(c); for (let i = 0; i < 6; i++) { const sp = new T.Mesh(new T.ConeGeometry(.08, .25, 4), metal(0xffd24d)); const a = i / 6 * Math.PI * 2; sp.position.set(Math.cos(a) * .32, y + .25, -.05 + Math.sin(a) * .32); g.add(sp); } }
  else if (hat === 'horns') { for (const s of [-1, 1]) { const h = new T.Mesh(new T.ConeGeometry(.1, .6, 8), mat(0xf0e6d2)); h.position.set(s * .32, y + .05, -.05); h.rotation.z = -s * .6; g.add(h); } const band = new T.Mesh(new T.TorusGeometry(.33, .05, 6, 16), mat(0x8a5a2a)); band.position.set(0, y - .05, -.05); band.rotation.x = Math.PI / 2; g.add(band); }
  else if (hat === 'antenna') { const st = new T.Mesh(new T.CylinderGeometry(.03, .03, .7, 6), metal(0xcccccc)); st.position.set(0, y + .3, -.05); g.add(st); const b = new T.Mesh(new T.SphereGeometry(.12, 10, 10), glowMat(0x4df0e0)); b.position.set(0, y + .68, -.05); g.add(b); }
  else if (hat === 'tophat') { const b = new T.Mesh(new T.CylinderGeometry(.42, .42, .06, 16), mat(0x1a1a24)); b.position.set(0, y - .1, -.05); g.add(b); const c = new T.Mesh(new T.CylinderGeometry(.28, .3, .6, 16), mat(0x1a1a24)); c.position.set(0, y + .2, -.05); g.add(c); const r = new T.Mesh(new T.CylinderGeometry(.31, .31, .1, 16), mat(0xff6ad5)); r.position.set(0, y, -.05); g.add(r); }
}

// spec: { color, accent, pattern, bike, hat, name, clone }
export function makeBike(spec){
  const { color = '#3b7bff', accent = '#4df0e0', pattern = 'solid', bike = 'scout', hat = 'none', name = null, clone = false } = spec || {};
  const g = new T.Group(); const c = new T.Color(color);
  const paint = new T.MeshPhysicalMaterial({ map: paintTexture(color, accent, pattern), roughness: .25, metalness: .6, clearcoat: 1, clearcoatRoughness: .1 });
  const paintPlain = new T.MeshPhysicalMaterial({ color: c, roughness: .25, metalness: .6, clearcoat: 1, clearcoatRoughness: .1 });
  const trim = glowMat(new T.Color(accent)); const dark = metal(0x1c1c2a, { roughness: .4 }); const chrome = metal(0xd8dce8, { roughness: .15 });
  const glowC = clone ? new T.Color(0x7cff8a) : new T.Color(accent);
  const thr = glowMat(glowC);
  g.userData.rotors = []; g.userData.exhaust = [];
  const engine = (sx, z, r) => { const eng = new T.Mesh(new T.CylinderGeometry(r, r * 1.15, 1.5, 14), dark); eng.rotation.x = Math.PI / 2; eng.position.set(sx, .55, z); g.add(eng);
    const rim = new T.Mesh(new T.TorusGeometry(r * 1.05, .06, 8, 20), chrome); rim.position.set(sx, .55, z - .76); g.add(rim);
    const rotor = new T.Mesh(new T.CylinderGeometry(r * .9, r * .9, .05, 16), thr); rotor.rotation.x = Math.PI / 2; rotor.position.set(sx, .55, z - .74); g.add(rotor); g.userData.rotors.push(rotor);
    const blades = new T.Group(); for (let i = 0; i < 5; i++) { const b = new T.Mesh(new T.BoxGeometry(.06, r * 1.6, .03), dark); b.rotation.z = i / 5 * Math.PI * 2; blades.add(b); } blades.position.set(sx, .55, z - .7); g.add(blades); g.userData.rotors.push(blades);
    const exhaust = new T.Mesh(new T.ConeGeometry(r * .85, 1.4, 12, 1, true), new T.MeshBasicMaterial({ color: glowC, transparent: true, opacity: .55, side: T.DoubleSide, depthWrite: false })); exhaust.rotation.x = Math.PI / 2; exhaust.position.set(sx, .55, z - 1.5); g.add(exhaust); g.userData.exhaust.push(exhaust); };

  if (bike === 'blitz') {           // long dart: single big turbine, swept canards
    const hull = new T.Mesh(new T.CylinderGeometry(.42, .5, 3.4, 14), paint); hull.rotation.x = Math.PI / 2; hull.position.set(0, .55, .3); hull.scale.set(1, .7, 1); g.add(hull);
    const nose = new T.Mesh(new T.ConeGeometry(.42, 2.2, 14), paint); nose.rotation.x = Math.PI / 2; nose.position.set(0, .5, 3.1); nose.scale.set(1, .7, 1); g.add(nose);
    for (const sx of [-1, 1]) { const v = new T.Mesh(new T.BoxGeometry(1.6, .06, .7), chrome); v.position.set(sx * 1.0, .5, 1.3); v.rotation.z = sx * .3; v.rotation.y = -sx * .35; g.add(v); const tip = new T.Mesh(new T.BoxGeometry(.08, .18, .7), trim); tip.position.set(sx * 1.75, .55, 1.3); tip.rotation.y = -sx * .35; g.add(tip); }
    engine(0, -1.5, .55);
    const fin = new T.Mesh(new T.BoxGeometry(.08, 1.2, 1.3), paintPlain); fin.position.set(0, 1.15, -1.4); fin.rotation.x = -.6; g.add(fin);
  } else if (bike === 'hauler') {   // wide armored sled: twin stacked thrusters, cargo pods
    const hull = new T.Mesh(new T.BoxGeometry(1.7, .7, 3.2), paint); hull.position.set(0, .6, .1); g.add(hull);
    const plate = new T.Mesh(new T.BoxGeometry(1.9, .12, 1.4), dark); plate.position.set(0, 1.0, 1.0); g.add(plate);
    const nose = new T.Mesh(new T.BoxGeometry(1.3, .5, 1.1), paint); nose.position.set(0, .55, 2.2); nose.rotation.x = .15; g.add(nose);
    const bumper = new T.Mesh(new T.BoxGeometry(1.7, .25, .2), chrome); bumper.position.set(0, .4, 2.8); g.add(bumper);
    for (const sx of [-1, 1]) { const pod = new T.Mesh(new T.BoxGeometry(.5, .6, 1.5), mat(0x8a5a2a, { roughness: .9 })); pod.position.set(sx * 1.15, .75, -.3); g.add(pod); const strap = new T.Mesh(new T.BoxGeometry(.54, .08, 1.54), dark); strap.position.set(sx * 1.15, .75, -.3); g.add(strap); const light = new T.Mesh(new T.BoxGeometry(.1, .15, .5), trim); light.position.set(sx * 1.42, .9, .4); g.add(light); }
    engine(-.55, -1.6, .42); engine(.55, -1.6, .42);
  } else if (bike === 'hopper') {   // light frame on four hover pods
    const hull = new T.Mesh(new T.CylinderGeometry(.38, .42, 2.6, 12), paint); hull.rotation.x = Math.PI / 2; hull.position.set(0, .7, .2); hull.scale.set(1, .8, 1); g.add(hull);
    const nose = new T.Mesh(new T.SphereGeometry(.42, 14, 10), paint); nose.position.set(0, .68, 1.5); nose.scale.set(1, .8, 1.3); g.add(nose);
    for (const sx of [-1, 1]) for (const sz of [1.1, -1.1]) { const arm = new T.Mesh(new T.BoxGeometry(1.2, .1, .14), chrome); arm.position.set(sx * .6, .6, sz); g.add(arm);
      const pod = new T.Mesh(new T.CylinderGeometry(.42, .5, .35, 14), dark); pod.position.set(sx * 1.2, .5, sz); g.add(pod); const podGlow = new T.Mesh(new T.CylinderGeometry(.34, .34, .06, 14), thr); podGlow.position.set(sx * 1.2, .3, sz); g.add(podGlow); const ring = new T.Mesh(new T.TorusGeometry(.46, .05, 6, 16), trim); ring.rotation.x = Math.PI / 2; ring.position.set(sx * 1.2, .5, sz); g.add(ring); }
    engine(0, -1.3, .36);
  } else {                          // scout: the classic twin-turbine racer
    const hull = new T.Mesh(new T.CylinderGeometry(.5, .5, 2.8, 14), paint); hull.rotation.x = Math.PI / 2; hull.position.set(0, .55, .2); hull.scale.set(1, .75, 1); g.add(hull);
    const tail = new T.Mesh(new T.SphereGeometry(.5, 14, 10), paint); tail.position.set(0, .55, -1.2); tail.scale.set(1, .75, 1); g.add(tail);
    const nose = new T.Mesh(new T.ConeGeometry(.42, 1.6, 12), paint); nose.rotation.x = Math.PI / 2; nose.position.set(0, .5, 2.6); nose.scale.set(1, .8, 1); g.add(nose);
    const noseTip = new T.Mesh(new T.SphereGeometry(.14, 10, 10), trim); noseTip.position.set(0, .5, 3.4); g.add(noseTip);
    const tank = new T.Mesh(new T.SphereGeometry(.48, 14, 10), paint); tank.scale.set(1, .7, 1.3); tank.position.set(0, .85, .5); g.add(tank);
    for (const sx of [-1, 1]) { const pod = new T.Mesh(new T.BoxGeometry(.5, .45, 1.6), dark); pod.position.set(sx * .8, .5, -.2); g.add(pod); const vent = new T.Mesh(new T.BoxGeometry(.08, .22, 1.0), trim); vent.position.set(sx * 1.07, .5, -.2); g.add(vent); const strut = new T.Mesh(new T.BoxGeometry(.5, .12, .5), chrome); strut.position.set(sx * .45, .55, -.2); g.add(strut); const v = new T.Mesh(new T.BoxGeometry(1.3, .08, .55), chrome); v.position.set(sx * .9, .5, 1.7); v.rotation.z = sx * .18; g.add(v); }
    engine(-.62, -1.6, .38); engine(.62, -1.6, .38);
    const fin = new T.Mesh(new T.BoxGeometry(.08, .9, 1.1), paintPlain); fin.position.set(0, 1.05, -1.5); fin.rotation.x = -.5; g.add(fin);
    const finLight = new T.Mesh(new T.BoxGeometry(.1, .1, .6), glowMat(0xff4d6d)); finLight.position.set(0, 1.4, -1.7); finLight.rotation.x = -.5; g.add(finLight);
  }
  // rider, tucked over the bars
  const seat = new T.Mesh(new T.BoxGeometry(.7, .22, 1.2), new T.MeshStandardMaterial({ color: 0x2a2233, roughness: .9 })); seat.position.set(0, .9, -.5); g.add(seat);
  const suitC = clone ? 0x2a7a3a : c.clone().offsetHSL(0.5, 0, 0);
  const torso = new T.Mesh(new T.BoxGeometry(.6, .85, .42), mat(suitC, { roughness: .7 })); torso.position.set(0, 1.3, -.1); torso.rotation.x = 1.05; g.add(torso);
  const pack = new T.Mesh(new T.BoxGeometry(.42, .32, .3), mat(0x8a5a2a, { roughness: .9 })); pack.position.set(0, 1.55, -.35); pack.rotation.x = 1.05; g.add(pack);
  for (const sx of [-1, 1]) { const arm = new T.Mesh(new T.CylinderGeometry(.09, .09, .9, 8), mat(suitC, { roughness: .7 })); arm.position.set(sx * .42, 1.15, .55); arm.rotation.x = 1.35; g.add(arm);
    const glove = new T.Mesh(new T.SphereGeometry(.11, 8, 8), dark); glove.position.set(sx * .45, 1.0, .98); g.add(glove);
    const leg = new T.Mesh(new T.CylinderGeometry(.11, .1, .9, 8), dark); leg.position.set(sx * .3, .75, .1); leg.rotation.x = 1.3; leg.rotation.z = sx * .25; g.add(leg); }
  const head = new T.Mesh(new T.SphereGeometry(.3, 16, 14), new T.MeshPhysicalMaterial({ color: clone ? 0x9dffb0 : 0xf4f4ff, roughness: .2, metalness: .3, clearcoat: 1 })); head.position.set(0, 1.62, .55); g.add(head);
  const visor = new T.Mesh(new T.SphereGeometry(.28, 14, 10, 0, 6.3, 0, 1.3), thr); visor.position.set(0, 1.62, .55); visor.rotation.x = Math.PI / 2.2; visor.scale.set(1, 1, .95); g.add(visor);
  const bars = new T.Mesh(new T.TorusGeometry(.5, .05, 8, 18, Math.PI), chrome); bars.position.set(0, 1.0, 1.0); bars.rotation.x = Math.PI / 2; bars.rotation.z = Math.PI; g.add(bars);
  const shadow = new T.Mesh(new T.CircleGeometry(1.4, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .3, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.name = 'shadow'; g.add(shadow);
  const under = new T.Mesh(new T.CircleGeometry(1.1, 20), new T.MeshBasicMaterial({ color: glowC, transparent: true, opacity: .12, depthWrite: false })); under.rotation.x = -Math.PI / 2; under.position.y = .02; under.name = 'under'; g.add(under);
  const glow = new T.Mesh(new T.CircleGeometry(.01, 4), new T.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0 })); g.add(glow); g.userData.glow = glow;
  addHat(g, hat);
  if (name) { const l = labelSprite(name, clone ? '#7cff8a' : '#ffffff', 4); l.position.y = 3.3; l.name = 'label'; g.add(l); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = settings.Q.shadows; o.receiveShadow = false; } }); shadow.castShadow = false; under.castShadow = false;
  world.add(g); return g;
}
