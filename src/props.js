// World dressing per level: scenery ring, obstacles (also gameplay collision circles {x,z,r,h}), vegetation, props, weather.
import * as T from 'three';
import { HALF, settings, rand, srand, srange, vnoise, smooth } from './config.js';
import { A, firstGeometry } from './assets.js';
import { world, env, scene } from './engine.js';
import { terrainH, trailDist, trailIndex, makeTriplanarMaterial, shadowify } from './terrain.js';
import { buildClouds } from './sky.js';
import { level, proceduralSets, BLOCK, STREET, inPark } from './levels.js';

export let obstacles = [];
let mats = null, matsLevel = null;
function materials() {
  if (mats && matsLevel === level.id) return mats; const P = proceduralSets();
  mats = {
    cliff: makeTriplanarMaterial(A.tex.cliff, { scale: 0.045 }), cliffFar: makeTriplanarMaterial(A.tex.cliff, { scale: 0.02, color: 0xe8d8c8 }),
    boulder: makeTriplanarMaterial(A.tex.rocks, { scale: 0.22 }), boulder2: makeTriplanarMaterial(A.tex.boulder, { scale: 0.3 }), hoodoo: makeTriplanarMaterial(A.tex.cliff, { scale: 0.09 }),
    snow: makeTriplanarMaterial(P.snow, { scale: 0.12 }), snowFar: makeTriplanarMaterial(P.snow, { scale: 0.03, color: 0xdde8f5 }), iceRock: makeTriplanarMaterial(A.tex.cliff, { scale: 0.06, color: 0x7a8798 }),
    iceSpire: new T.MeshPhysicalMaterial({ color: 0xcfeaff, roughness: .06, metalness: 0, transparent: true, opacity: .78, clearcoat: 1, emissive: 0x16304a, emissiveIntensity: .25, side: T.DoubleSide }),
    glow: new T.MeshStandardMaterial({ color: 0x4df0e0, emissive: 0x4df0e0, emissiveIntensity: 1.6, roughness: .3 }), glowWhite: new T.MeshStandardMaterial({ color: 0x9ff5ff, emissive: 0x9ff5ff, emissiveIntensity: 1.4, roughness: .3 }),
    concrete: makeTriplanarMaterial(P.concrete, { scale: 0.1 }), asphalt: makeTriplanarMaterial(P.asphalt, { scale: 0.2 }),
    win: [P.windows, P.windows2, P.glass].map(t => new T.MeshStandardMaterial({ map: t.diff, roughness: .5, metalness: .2 })),
    roof: new T.MeshStandardMaterial({ color: 0x4a4a52, roughness: .9 }), metal: new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: .4, metalness: .8 }),
    taxi: new T.MeshPhysicalMaterial({ color: 0xf7c21a, roughness: .3, metalness: .4, clearcoat: 1 }), carGlass: new T.MeshPhysicalMaterial({ color: 0x223344, roughness: .1, metalness: .6, clearcoat: 1 }), tire: new T.MeshStandardMaterial({ color: 0x151515, roughness: .95 }),
    hydrant: new T.MeshStandardMaterial({ color: 0xd42a2a, roughness: .5, metalness: .3 }), lamp: new T.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffe9a0, emissiveIntensity: 1.2 }),
  };
  for (const m of mats.win) { m.map.repeat.set(1, 1); }
  matsLevel = level.id; return mats;
}
function displace(geo, amt, freq, seedOff = 0) {
  const pa = geo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); const n = vnoise(x * freq + y * 0.7 + seedOff, z * freq + y * 0.3) - 0.5; const n2 = vnoise(y * freq * 3 + 7 + seedOff, (x + z) * freq * 2) - 0.5; const k = 1 + n * amt + n2 * amt * 0.4; pa.setXYZ(i, x * k, y, z * k); }
  geo.computeVertexNormals(); return geo;
}
function rockGeo(seedOff) {
  const g = new T.IcosahedronGeometry(1, 3); const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const v = new T.Vector3().fromBufferAttribute(pa, i); const n = vnoise(v.x * 2.3 + 9 + seedOff, v.z * 2.1 + v.y * 1.7 + 4); const n2 = vnoise(v.y * 5 + seedOff, v.x * 5); v.multiplyScalar(0.78 + n * 0.45 + n2 * 0.12); v.y *= 0.8; pa.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
function buildingMesh(w, d, h, M, seed) {
  const g = new T.Group(); const wm = M.win[seed % M.win.length].clone(); wm.map = wm.map.clone(); wm.map.needsUpdate = true; wm.map.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8)));
  const body = new T.Mesh(new T.BoxGeometry(w, h, d), [wm, wm, M.roof, M.roof, wm, wm]); body.position.y = h / 2; g.add(body);
  if (seed % 3 === 0) { const top = new T.Mesh(new T.BoxGeometry(w * .6, h * .18, d * .6), wm); top.position.y = h + h * .09; g.add(top); }
  if (seed % 4 === 1) { const spire = new T.Mesh(new T.CylinderGeometry(.2, .6, h * .25, 8), M.metal); spire.position.y = h + h * .125; g.add(spire); }
  const base = new T.Mesh(new T.BoxGeometry(w + 1.2, 3.5, d + 1.2), M.concrete); base.position.y = 1.75; g.add(base);
  return g;
}

// ---- permanent scenery for the current level ----
let sceneryGroup = null;
export function buildScenery() {
  if (sceneryGroup) { scene.remove(sceneryGroup); sceneryGroup = null; }
  const M = materials(); const grp = new T.Group(); grp.name = 'scenery';
  if (level.id === 'canyon') {
    for (let i = 0; i < 84; i++) { const a = i / 84 * Math.PI * 2 + Math.sin(i * 2.7) * 0.02; const r = HALF + 8 + Math.random() * 36; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const w = 26 + Math.random() * 30, d = 18 + Math.random() * 14, h = 16 + Math.random() * 34;
      const m = new T.Mesh(displace(new T.CylinderGeometry(w * 0.36, w * 0.58, h, 16, 8), 0.5, 0.07, i * 13), M.cliff); m.scale.z = d / w; m.position.set(x, terrainH(x, z) - 5 + h / 2, z); m.rotation.y = a + Math.PI / 2 + (Math.random() - .5) * .4; m.castShadow = settings.Q.shadows; m.receiveShadow = true; grp.add(m);
      if (Math.random() < 0.5) { const cap = new T.Mesh(rockGeo(i * 7), M.boulder2); const cs = w * 0.25; cap.scale.set(cs, cs * 0.6, cs * 0.8); cap.position.set(x + (Math.random() - .5) * 8, terrainH(x, z) - 5 + h - cs * 0.2, z + (Math.random() - .5) * 8); grp.add(cap); } }
    for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2; const r = HALF - 14 + Math.random() * 26; const x = Math.cos(a) * r, z = Math.sin(a) * r; const s = 2 + Math.random() * 5;
      const m = new T.Mesh(rockGeo(i * 3 + 100), Math.random() < .5 ? M.boulder : M.boulder2); m.scale.set(s, s * (0.6 + Math.random() * .5), s); m.rotation.y = Math.random() * 6; m.position.set(x, terrainH(x, z) + s * 0.15, z); m.castShadow = settings.Q.shadows; m.receiveShadow = true; grp.add(m); }
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + 0.1; const r = HALF + 170 + Math.random() * 200; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = 45 + Math.random() * 80, w = 55 + Math.random() * 70;
      const body = new T.Mesh(displace(new T.CylinderGeometry(w * 0.7, w, h, 12, 4), 0.3, 0.03, i * 31), M.cliffFar); body.position.set(x, h / 2 - 10, z); body.rotation.y = i; grp.add(body); }
  } else if (level.id === 'ice') {
    // glacier walls and ice spire ring, distant white peaks
    for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; const r = HALF + 6 + Math.random() * 40; const x = Math.cos(a) * r, z = Math.sin(a) * r; const w = 24 + Math.random() * 30, h = 20 + Math.random() * 40;
      const m = new T.Mesh(displace(new T.CylinderGeometry(w * 0.3, w * 0.6, h, 14, 8), 0.45, 0.08, i * 17), Math.random() < .25 ? M.iceRock : M.snow); m.position.set(x, terrainH(x, z) - 6 + h / 2, z); m.rotation.y = a; m.castShadow = settings.Q.shadows; m.receiveShadow = true; grp.add(m);
      if (Math.random() < 0.6) { const sp = new T.Mesh(new T.ConeGeometry(2 + Math.random() * 4, 14 + Math.random() * 24, 7), M.iceSpire); sp.position.set(x + (Math.random() - .5) * 14, terrainH(x, z) - 6 + h * 0.8, z + (Math.random() - .5) * 14); sp.rotation.set((Math.random() - .5) * .3, 0, (Math.random() - .5) * .3); grp.add(sp); } }
    for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + 0.13; const r = HALF + 160 + Math.random() * 220; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = 70 + Math.random() * 120, w = 60 + Math.random() * 80;
      const peak = new T.Mesh(displace(new T.ConeGeometry(w, h, 9, 5), 0.25, 0.03, i * 29), M.snowFar); peak.position.set(x, h / 2 - 12, z); peak.rotation.y = i; grp.add(peak); }
  } else if (level.id === 'nyc') {
    // skyline beyond the boundary, and a bridge silhouette
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; const r = HALF + 20 + Math.random() * 120; const x = Math.cos(a) * r, z = Math.sin(a) * r; const w = 16 + Math.random() * 26, d = 16 + Math.random() * 26, h = 40 + Math.pow(Math.random(), 2) * 160;
      const b = buildingMesh(w, d, h, M, i); b.position.set(x, -2, z); b.rotation.y = Math.round(a / (Math.PI / 2)) * Math.PI / 2; grp.add(b); }
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + 0.05; const r = HALF + 200 + Math.random() * 150; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = 120 + Math.random() * 220;
      const b = buildingMesh(30 + Math.random() * 30, 30 + Math.random() * 30, h, M, i + 7); b.position.set(x, -2, z); grp.add(b); }
  }
  grp.traverse(o => { if (o.isMesh && o.receiveShadow === false) o.receiveShadow = true; }); scene.add(grp); sceneryGroup = grp; return grp;
}

// ---- per-match obstacles (seeded so all players agree) ----
export function buildObstacles() {
  obstacles = []; const M = materials();
  const rockModels = [A.models.rock1, A.models.rock2, A.models.rock3].map(firstGeometry).filter(Boolean);
  const place = (minR, extraOk) => { for (let k = 0; k < 60; k++) { const x = srange(-HALF + 15, HALF - 15), z = srange(-HALF + 15, HALF - 15); if (Math.hypot(x, z) < 28) continue; if (extraOk && !extraOk(x, z)) continue; if (obstacles.every(o => Math.hypot(o.x - x, o.z - z) > o.r + minR + 4)) return [x, z]; } return null; };
  // Every player must draw exactly the same seeded numbers here, whether or not the rock models finished
  // loading on their device. If the count differs, every obstacle after it lands somewhere else on that
  // player's map and the others see them drive through rocks.
  const pushRock = (p, r, matA, matB, seed) => { const useModel = srand() < 0.6, pick = srand(), matPick = srand() < .5, sy = srand(), rot = srange(0, 6.28); let m;
    if (useModel && rockModels.length) { const g = rockModels[Math.floor(pick * rockModels.length)]; m = new T.Mesh(g, matPick ? matA : matB); g.computeBoundingSphere(); const k = r / g.boundingSphere.radius; m.scale.set(k, k * (.8 + sy * .3), k); }
    else { m = new T.Mesh(rockGeo(seed), matPick ? matA : matB); m.scale.set(r, r * (.7 + sy * .4), r); }
    m.rotation.set(0, rot, 0); m.position.set(p[0], terrainH(p[0], p[1]) + r * 0.15, p[1]); shadowify(m); world.add(m); obstacles.push({ x: p[0], z: p[1], r: r * 0.95, h: Math.min(r * 1.3, 3.2) }); };
  const pylon = (p, stoneMat, baseMat, i) => { const h = srange(14, 24); const g = new T.Group();
    const stone = new T.Mesh(displace(new T.CylinderGeometry(1.4, 2.8, h, 8, 6), 0.25, 0.3, i * 23), stoneMat); stone.position.y = h / 2; g.add(stone);
    const ring = new T.Mesh(new T.TorusGeometry(2.2, .12, 8, 24), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.8; g.add(ring);
    const ring2 = ring.clone(); ring2.position.y = h * 0.55; ring2.scale.setScalar(.85); g.add(ring2);
    const beacon = new T.Mesh(new T.OctahedronGeometry(.8, 0), M.glowWhite); beacon.position.y = h + 0.9; g.add(beacon);
    const base = new T.Mesh(rockGeo(i * 9 + 50), baseMat); base.scale.set(3.6, 1.2, 3.6); base.position.y = 0.3; g.add(base);
    g.position.set(p[0], terrainH(p[0], p[1]), p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: 2.6, h: 99, mesh: g }); };

  if (level.id === 'canyon') {
    for (let i = 0; i < 110; i++) { const p = place(3); if (p) pushRock(p, srange(1.4, 3.6), M.boulder, M.boulder2, i * 11); }
    for (let i = 0; i < 45; i++) { const p = place(3); if (!p) continue; const g = new T.Group(); const n = 1 + Math.floor(srand() * 2); let maxH = 0;
      for (let j = 0; j < n; j++) { const h = srange(2.5, 5.5); const ox = srange(-.8, .8), oz = srange(-.8, .8); const c = new T.Mesh(displace(new T.CylinderGeometry(srange(.6, .9), srange(.9, 1.3), h, 10, 5), 0.35, 0.6, i * 17 + j), M.hoodoo); c.position.set(ox, h / 2, oz); g.add(c);
        const cap = new T.Mesh(rockGeo(i * 5 + j), M.boulder2); cap.scale.set(1.3, .7, 1.3); cap.position.set(ox, h + 0.2, oz); g.add(cap); maxH = Math.max(maxH, h); }
      g.position.set(p[0], terrainH(p[0], p[1]) - 0.2, p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: 2.0, h: Math.min(maxH, 3.4) }); }
    for (let i = 0; i < 14; i++) { const p = place(5); if (p) pylon(p, M.hoodoo, M.boulder2, i); }
  } else if (level.id === 'ice') {
    const notLake = (x, z) => level.lake(x, z) < 0.5;
    for (let i = 0; i < 80; i++) { const p = place(3, notLake); if (p) pushRock(p, srange(1.4, 3.4), M.snow, M.iceRock, i * 11); }
    for (let i = 0; i < 70; i++) { const p = place(2); if (!p) continue; const g = new T.Group(); const n = 2 + Math.floor(srand() * 3); let maxH = 0;
      for (let j = 0; j < n; j++) { const h = srange(2, 5.5), r = srange(.4, .9); const c = new T.Mesh(new T.ConeGeometry(r, h, 6), M.iceSpire); c.position.set(srange(-1, 1), h / 2 - .3, srange(-1, 1)); c.rotation.set(srange(-.3, .3), srange(0, 3), srange(-.3, .3)); g.add(c); maxH = Math.max(maxH, h); }
      g.position.set(p[0], terrainH(p[0], p[1]), p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: 1.8, h: Math.min(maxH, 3.4) }); }
    for (let i = 0; i < 12; i++) { const p = place(5, notLake); if (p) pylon(p, M.iceRock, M.snow, i); }
  } else if (level.id === 'nyc') {
    // buildings on block interiors (outside the park), parked taxis along curbs, hydrants, lamp posts
    const n = Math.floor(HALF * 2 / BLOCK);
    for (let bx = -n / 2; bx < n / 2; bx++) for (let bz = -n / 2; bz < n / 2; bz++) { const cx = bx * BLOCK, cz = bz * BLOCK; if (inPark(cx, cz) || Math.abs(cx) > HALF - 30 || Math.abs(cz) > HALF - 30) continue; if (Math.hypot(cx, cz) < 40) continue;
      const w = 18 + srand() * 10, d = 18 + srand() * 10, h = 20 + srand() * 60; const b = buildingMesh(w, d, h, M, Math.floor(srand() * 1000)); b.position.set(cx, terrainH(cx, cz) - 0.3, cz); shadowify(b); world.add(b);
      obstacles.push({ x: cx, z: cz, r: Math.max(w, d) * 0.62 + 0.6, h: 99, building: true, hw: w / 2, hd: d / 2 }); } // hw/hd: real box footprint for collision
    const car = (x, z, rot, i) => { const g = new T.Group(); const body = new T.Mesh(new T.BoxGeometry(2.0, .7, 4.4), M.taxi); body.position.y = .75; g.add(body); const cab = new T.Mesh(new T.BoxGeometry(1.8, .6, 2.2), M.carGlass); cab.position.set(0, 1.4, -.2); g.add(cab);
      const sign = new T.Mesh(new T.BoxGeometry(.9, .25, .4), M.lamp); sign.position.set(0, 1.82, -.2); g.add(sign); for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const t = new T.Mesh(new T.CylinderGeometry(.38, .38, .3, 12), M.tire); t.rotation.z = Math.PI / 2; t.position.set(sx * 1.0, .4, sz); g.add(t); }
      g.position.set(x, terrainH(x, z), z); g.rotation.y = rot; shadowify(g); world.add(g); obstacles.push({ x, z, r: 2.2, h: 2.0 }); };
    for (let i = 0; i < 70; i++) { const p = place(2, (x, z) => { const td = trailDist(x, z); return td > STREET / 2 - 2.2 && td < STREET / 2 + 0.5 && !inPark(x, z) || (td <= 0.01 && Math.abs(x) > 60 && Math.abs(z) > 60 && false); }); if (!p) continue; car(p[0], p[1], trailIndex(p[0], p[1]) === 0 ? 0 : Math.PI / 2, i); }
    for (let i = 0; i < 40; i++) { const p = place(1, (x, z) => { const td = trailDist(x, z); return td > STREET / 2 + 1 && td < STREET / 2 + 3; }); if (!p) continue; const g = new T.Group(); const post = new T.Mesh(new T.CylinderGeometry(.12, .16, 7, 8), M.metal); post.position.y = 3.5; g.add(post); const arm = new T.Mesh(new T.BoxGeometry(.12, .12, 2.2), M.metal); arm.position.set(0, 6.9, 1.0); g.add(arm); const lamp = new T.Mesh(new T.BoxGeometry(.5, .25, .8), M.lamp); lamp.position.set(0, 6.8, 2.0); g.add(lamp);
      g.position.set(p[0], terrainH(p[0], p[1]), p[1]); g.rotation.y = trailIndex(p[0], p[1]) === 0 ? Math.PI / 2 : 0; shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: .5, h: 99 }); }
    for (let i = 0; i < 30; i++) { const p = place(1, (x, z) => { const td = trailDist(x, z); return td > STREET / 2 + .8 && td < STREET / 2 + 2.5; }); if (!p) continue; const g = new T.Group(); const b = new T.Mesh(new T.CylinderGeometry(.22, .26, 1.0, 10), M.hydrant); b.position.y = .5; g.add(b); const cap = new T.Mesh(new T.SphereGeometry(.24, 10, 8), M.hydrant); cap.position.y = 1.0; g.add(cap); const side = new T.Mesh(new T.CylinderGeometry(.1, .1, .7, 8), M.hydrant); side.rotation.z = Math.PI / 2; side.position.y = .7; g.add(side);
      g.position.set(p[0], terrainH(p[0], p[1]), p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: .45, h: 1.3 }); }
  }
  buildEnvironment();
}

// ---- vegetation, props and weather (rebuilt when quality or level changes) ----
export const weather = { snow: null };
export function buildEnvironment() {
  while (env.children.length) env.remove(env.children[0]); weather.snow = null;
  const Q = settings.Q, o = new T.Object3D(), gc = new T.Color(); const M = materials();
  const clearOfObstacles = (x, z, pad) => obstacles.every(ob => Math.hypot(ob.x - x, ob.z - z) > ob.r + pad);
  function instanced(scene3, count, placeFn, { castShadow = false, tintFn = null, yOff = -0.08 } = {}) {
    if (!scene3 || count <= 0) return []; const meshes = []; scene3.traverse(m => { if (m.isMesh) meshes.push(m); }); const out = [];
    for (const src of meshes) { const mat = src.material.clone(); mat.side = T.DoubleSide; if (mat.map) { mat.map.colorSpace = T.SRGBColorSpace; mat.map.anisotropy = Q.aniso; } mat.alphaTest = mat.transparent ? 0.5 : mat.alphaTest; mat.transparent = false; mat.roughness = Math.max(mat.roughness, 0.85);
      const inst = new T.InstancedMesh(src.geometry, mat, count); inst.castShadow = castShadow && Q.shadows; inst.receiveShadow = true; inst.frustumCulled = false; out.push(inst); }
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 20) { const pl = placeFn(); if (!pl) continue; const [x, z, sc, rot] = pl; o.position.set(x, terrainH(x, z) + yOff, z); o.rotation.set(0, rot, 0); o.scale.setScalar(sc); o.updateMatrix(); for (const inst of out) { inst.setMatrixAt(n, o.matrix); if (tintFn) inst.setColorAt(n, tintFn(gc, x, z)); } n++; }
    for (const inst of out) { inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; env.add(inst); }
    return out;
  }
  if (level.id === 'canyon') {
    const offTrail = (x, z) => trailDist(x, z) > 7 && terrainH(x, z) < 7 && Math.hypot(x, z) > 26;
    const grassTint = (c, x, z) => c.setHSL(0.19 + (vnoise(x * 0.04, z * 0.04) - 0.5) * 0.08, 0.38, 0.36 + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.14);
    instanced(A.models.grass, Q.plants, () => { const x = rand(-HALF + 6, HALF - 6), z = rand(-HALF + 6, HALF - 6); if (!offTrail(x, z)) return null; if (trailDist(x, z) > 22 && Math.random() < 0.6) return null; return [x, z, rand(1.8, 3.4), rand(0, 6.28)]; }, { tintFn: grassTint });
    instanced(A.models.flowers, Math.floor(Q.plants / 10), () => { const x = rand(-HALF + 12, HALF - 12), z = rand(-HALF + 12, HALF - 12); if (!offTrail(x, z) || !clearOfObstacles(x, z, 2) || vnoise(x * 0.02 + 3, z * 0.02) < 0.55) return null; return [x, z, rand(0.9, 1.8), rand(0, 6.28)]; }, { castShadow: true });
    const treeSpot = () => { const x = rand(-HALF + 16, HALF - 16), z = rand(-HALF + 16, HALF - 16); const td = trailDist(x, z); if (td < 9 || td > 40 || terrainH(x, z) > 6 || Math.hypot(x, z) < 30 || !clearOfObstacles(x, z, 4)) return null; return [x, z, rand(1.3, 2.2), rand(0, 6.28)]; };
    instanced(A.models.tree, Math.ceil(Q.trees * 0.6), treeSpot, { castShadow: true }); instanced(A.models.pine, Math.floor(Q.trees * 0.4), treeSpot, { castShadow: true });
    const pebG = rockGeo(999); const np = Math.floor(Q.plants / 3); const pebs = new T.InstancedMesh(pebG, M.boulder, np); let k = 0, tries = 0;
    while (k < np && tries++ < np * 10) { const x = rand(-HALF + 8, HALF - 8), z = rand(-HALF + 8, HALF - 8); const td = trailDist(x, z); if (td < 3.5 || td > 13) continue; o.position.set(x, terrainH(x, z) + 0.02, z); o.rotation.set(0, rand(0, 6.28), 0); const sc = rand(.15, .55); o.scale.set(sc, sc * .6, sc); o.updateMatrix(); pebs.setMatrixAt(k, o.matrix); k++; }
    pebs.count = k; pebs.instanceMatrix.needsUpdate = true; pebs.receiveShadow = true; env.add(pebs);
    const tarpM = new T.MeshStandardMaterial({ color: 0xd9552a, roughness: .9, side: T.DoubleSide }); const poleM = new T.MeshStandardMaterial({ color: 0x403028, roughness: .9 });
    for (let i = 0; i < 7; i++) { let x, z, tr = 0; do { x = rand(-HALF + 20, HALF - 20); z = rand(-HALF + 20, HALF - 20); } while ((trailDist(x, z) < 8 || trailDist(x, z) > 18 || Math.hypot(x, z) < 30 || !clearOfObstacles(x, z, 4)) && tr++ < 60);
      const g = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(.08, .1, 4, 6), poleM); pole.position.y = 2; g.add(pole); const pole2 = pole.clone(); pole2.position.set(3, 1.6, 0.6); pole2.scale.y = .8; g.add(pole2);
      const tarp = new T.Mesh(new T.PlaneGeometry(3.4, 2.6, 6, 4), tarpM); const pa = tarp.geometry.attributes.position; for (let v = 0; v < pa.count; v++) pa.setZ(v, Math.sin(pa.getX(v) * 2 + pa.getY(v)) * 0.25); tarp.geometry.computeVertexNormals(); tarp.position.set(1.5, 2.8, 0.3); tarp.rotation.set(-0.4, 0.2, 0.15); tarp.castShadow = settings.Q.shadows; g.add(tarp);
      g.position.set(x, terrainH(x, z) - 0.2, z); g.rotation.y = rand(0, 6.28); env.add(g); }
  } else if (level.id === 'ice') {
    const frostTint = (c, x, z) => c.setHSL(0.55, 0.15, 0.78 + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.1);
    const snowSpot = () => { const x = rand(-HALF + 16, HALF - 16), z = rand(-HALF + 16, HALF - 16); if (level.lake(x, z) > 0.3 || trailDist(x, z) < 9 || terrainH(x, z) > 9 || Math.hypot(x, z) < 30 || !clearOfObstacles(x, z, 4)) return null; return [x, z, rand(1.2, 2.4), rand(0, 6.28)]; };
    instanced(A.models.pine, Q.trees, snowSpot, { castShadow: true, tintFn: frostTint });
    instanced(A.models.grass, Math.floor(Q.plants / 3), () => { const x = rand(-HALF + 6, HALF - 6), z = rand(-HALF + 6, HALF - 6); if (level.lake(x, z) > 0.3 || trailDist(x, z) < 8 || Math.hypot(x, z) < 26 || Math.random() < 0.5) return null; return [x, z, rand(1.2, 2.2), rand(0, 6.28)]; }, { tintFn: (c) => c.setHSL(0.12, 0.25, 0.55) });
    // snow drifts: soft white mounds
    const driftG = rockGeo(777); const nd = Math.floor(Q.plants / 6); const drifts = new T.InstancedMesh(driftG, M.snow, nd); let k = 0, tries = 0;
    while (k < nd && tries++ < nd * 10) { const x = rand(-HALF + 8, HALF - 8), z = rand(-HALF + 8, HALF - 8); if (level.lake(x, z) > 0.3 || Math.hypot(x, z) < 26) continue; o.position.set(x, terrainH(x, z) - 0.4, z); o.rotation.set(0, rand(0, 6.28), 0); const sc = rand(1.2, 3.5); o.scale.set(sc * rand(1, 1.6), sc * .35, sc); o.updateMatrix(); drifts.setMatrixAt(k, o.matrix); k++; }
    drifts.count = k; drifts.instanceMatrix.needsUpdate = true; drifts.receiveShadow = true; env.add(drifts);
    // falling snow
    const N = Q.particles * 25; const pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-80, 80); pos[i * 3 + 1] = rand(0, 40); pos[i * 3 + 2] = rand(-80, 80); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const flake = (() => { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); const g = x.createRadialGradient(8, 8, 1, 8, 8, 8); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 16, 16); return new T.CanvasTexture(c); })();
    weather.snow = new T.Points(sg, new T.PointsMaterial({ size: .35, map: flake, transparent: true, depthWrite: false, opacity: .85 })); weather.snow.frustumCulled = false; env.add(weather.snow);
  } else if (level.id === 'nyc') {
    const parkSpot = () => { const x = rand(-98, 98), z = rand(-68, 68); if (trailDist(x, z) < STREET / 2 + 3 || Math.hypot(x, z) < 24 || !clearOfObstacles(x, z, 3)) return null; return [x, z, rand(1.4, 2.4), rand(0, 6.28)]; };
    instanced(A.models.tree, Q.trees * 2, parkSpot, { castShadow: true });
    instanced(A.models.flowers, Math.floor(Q.plants / 12), parkSpot, { castShadow: true });
    instanced(A.models.grass, Math.floor(Q.plants / 2), () => { const x = rand(-98, 98), z = rand(-68, 68); if (trailDist(x, z) < STREET / 2 + 2 || Math.hypot(x, z) < 20) return null; return [x, z, rand(1.5, 2.6), rand(0, 6.28)]; }, { tintFn: (c, x, z) => c.setHSL(0.26, 0.45, 0.35 + (vnoise(x * .3, z * .3) - .5) * .1) });
    // street trees along sidewalks outside the park
    instanced(A.models.tree, Q.trees, () => { const x = rand(-HALF + 20, HALF - 20), z = rand(-HALF + 20, HALF - 20); const td = trailDist(x, z); if (inPark(x, z) || td < STREET / 2 + 2 || td > STREET / 2 + 3.5 || !clearOfObstacles(x, z, 2)) return null; return [x, z, rand(1.0, 1.5), rand(0, 6.28)]; }, { castShadow: true });
  }
  buildClouds();
}
export function updateWeather(dt, cx, cz) {
  if (!weather.snow) return; const p = weather.snow.geometry.attributes.position; const a = p.array;
  for (let i = 0; i < p.count; i++) { a[i * 3 + 1] -= dt * (4 + (i % 7)); a[i * 3] += dt * 1.5; if (a[i * 3 + 1] < -2) { a[i * 3 + 1] = 40; a[i * 3] = cx + rand(-80, 80); a[i * 3 + 2] = cz + rand(-80, 80); } }
  p.needsUpdate = true;
}
