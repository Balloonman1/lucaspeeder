// World dressing: canyon walls, mesas, rock obstacles, vegetation, trail pebbles, camp tarps.
// Obstacles double as gameplay collision circles ({x,z,r,h}).
import * as T from 'three';
import { HALF, settings, rand, srand, srange, vnoise, smooth } from './config.js';
import { A, firstGeometry } from './assets.js';
import { world, env } from './engine.js';
import { terrainH, trailDist, makeTriplanarMaterial, shadowify } from './terrain.js';
import { buildClouds } from './sky.js';

export let obstacles = [];
let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    cliff: makeTriplanarMaterial(A.tex.cliff, { scale: 0.045 }),
    cliffFar: makeTriplanarMaterial(A.tex.cliff, { scale: 0.02, color: 0xe8d8c8 }),
    boulder: makeTriplanarMaterial(A.tex.rocks, { scale: 0.22 }),
    boulder2: makeTriplanarMaterial(A.tex.boulder, { scale: 0.3 }),
    hoodoo: makeTriplanarMaterial(A.tex.cliff, { scale: 0.09 }),
    glow: new T.MeshStandardMaterial({ color: 0x4df0e0, emissive: 0x4df0e0, emissiveIntensity: 1.6, roughness: .3 }),
    glowWhite: new T.MeshStandardMaterial({ color: 0x9ff5ff, emissive: 0x9ff5ff, emissiveIntensity: 1.4, roughness: .3 }),
    tower: new T.MeshStandardMaterial({ color: 0x6b5a52, roughness: .8, metalness: .15 }),
  };
  return mats;
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

// ---- permanent scenery (built once) ----
export function buildScenery() {
  const M = materials(); const grp = new T.Group(); grp.name = 'scenery';
  // canyon walls: a ring of large displaced stone masses just beyond the play boundary
  for (let i = 0; i < 84; i++) {
    const a = i / 84 * Math.PI * 2 + Math.sin(i * 2.7) * 0.02; const r = HALF + 8 + Math.random() * 36; const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 26 + Math.random() * 30, d = 18 + Math.random() * 14, h = 16 + Math.random() * 34;
    const geo = displace(new T.CylinderGeometry(w * 0.36, w * 0.58, h, 16, 8), 0.5, 0.07, i * 13);
    const m = new T.Mesh(geo, M.cliff); m.scale.z = d / w; m.position.set(x, terrainH(x, z) - 5 + h / 2, z); m.rotation.y = a + Math.PI / 2 + (Math.random() - .5) * .4; m.rotation.z = (Math.random() - .5) * 0.1;
    m.castShadow = settings.Q.shadows; m.receiveShadow = true; grp.add(m);
    if (Math.random() < 0.5) { const cap = new T.Mesh(rockGeo(i * 7), M.boulder2); const cs = w * 0.25; cap.scale.set(cs, cs * 0.6, cs * 0.8); cap.position.set(x + (Math.random() - .5) * 8, terrainH(x, z) - 5 + h - cs * 0.2, z + (Math.random() - .5) * 8); cap.receiveShadow = true; grp.add(cap); }
  }
  // scattered foothill boulders between walls and play area
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2; const r = HALF - 14 + Math.random() * 26; const x = Math.cos(a) * r, z = Math.sin(a) * r; const s = 2 + Math.random() * 5;
    const m = new T.Mesh(rockGeo(i * 3 + 100), Math.random() < .5 ? M.boulder : M.boulder2); m.scale.set(s, s * (0.6 + Math.random() * .5), s); m.rotation.y = Math.random() * 6; m.position.set(x, terrainH(x, z) + s * 0.15, z); m.castShadow = settings.Q.shadows; m.receiveShadow = true; grp.add(m); }
  // mesas for depth
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + 0.1; const r = HALF + 170 + Math.random() * 200; const x = Math.cos(a) * r, z = Math.sin(a) * r; const h = 45 + Math.random() * 80, w = 55 + Math.random() * 70;
    const body = new T.Mesh(displace(new T.CylinderGeometry(w * 0.7, w, h, 12, 4), 0.3, 0.03, i * 31), M.cliffFar); body.position.set(x, h / 2 - 10, z); body.rotation.y = i; body.receiveShadow = true; grp.add(body); }
  world.parent.add(grp); return grp;
}

// ---- per-match obstacles (seeded so all players agree) ----
export function buildObstacles() {
  obstacles = []; const M = materials();
  const rockModels = [A.models.rock1, A.models.rock2, A.models.rock3].map(firstGeometry).filter(Boolean);
  function place(minR) { for (let k = 0; k < 40; k++) { const x = srange(-HALF + 15, HALF - 15), z = srange(-HALF + 15, HALF - 15); if (Math.hypot(x, z) < 28) continue; if (obstacles.every(o => Math.hypot(o.x - x, o.z - z) > o.r + minR + 4)) return [x, z]; } return null; }
  // boulders: Quaternius rock meshes with real stone wrapped on (triplanar), plus procedural ones
  for (let i = 0; i < 110; i++) { const p = place(3); if (!p) continue; const r = srange(1.4, 3.6);
    let m; if (rockModels.length && srand() < 0.6) { const g = rockModels[Math.floor(srand() * rockModels.length)]; m = new T.Mesh(g, srand() < .5 ? M.boulder : M.boulder2); g.computeBoundingSphere(); const k = r / g.boundingSphere.radius; m.scale.set(k, k * srange(.8, 1.1), k); }
    else { m = new T.Mesh(rockGeo(i * 11), srand() < .5 ? M.boulder : M.boulder2); m.scale.set(r, r * srange(.7, 1.1), r); }
    m.rotation.set(0, srange(0, 6.28), 0); m.position.set(p[0], terrainH(p[0], p[1]) + r * 0.15, p[1]); shadowify(m); world.add(m); obstacles.push({ x: p[0], z: p[1], r: r * 0.95, h: Math.min(r * 1.3, 3.2) }); }
  // hoodoo stacks
  for (let i = 0; i < 45; i++) { const p = place(3); if (!p) continue; const g = new T.Group(); const n = 1 + Math.floor(srand() * 2); let maxH = 0;
    for (let j = 0; j < n; j++) { const h = srange(2.5, 5.5); const ox = srange(-.8, .8), oz = srange(-.8, .8);
      const geo = displace(new T.CylinderGeometry(srange(.6, .9), srange(.9, 1.3), h, 10, 5), 0.35, 0.6, i * 17 + j); const c = new T.Mesh(geo, M.hoodoo); c.position.set(ox, h / 2, oz); g.add(c);
      const cap = new T.Mesh(rockGeo(i * 5 + j), M.boulder2); cap.scale.set(1.3, .7, 1.3); cap.position.set(ox, h + 0.2, oz); g.add(cap); maxH = Math.max(maxH, h); }
    g.position.set(p[0], terrainH(p[0], p[1]) - 0.2, p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: 2.0, h: Math.min(maxH, 3.4) }); }
  // stone pylons (not jumpable) with a glowing ring — the one sci-fi note in the landscape
  for (let i = 0; i < 14; i++) { const p = place(5); if (!p) continue; const h = srange(14, 24); const g = new T.Group();
    const stone = new T.Mesh(displace(new T.CylinderGeometry(1.4, 2.8, h, 8, 6), 0.25, 0.3, i * 23), M.hoodoo); stone.position.y = h / 2; g.add(stone);
    const ring = new T.Mesh(new T.TorusGeometry(2.2, .12, 8, 24), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.8; g.add(ring);
    const ring2 = ring.clone(); ring2.position.y = h * 0.55; ring2.scale.setScalar(.85); g.add(ring2);
    const beacon = new T.Mesh(new T.OctahedronGeometry(.8, 0), M.glowWhite); beacon.position.y = h + 0.9; g.add(beacon);
    const base = new T.Mesh(rockGeo(i * 9 + 50), M.boulder2); base.scale.set(3.6, 1.2, 3.6); base.position.y = 0.3; g.add(base);
    g.position.set(p[0], terrainH(p[0], p[1]), p[1]); shadowify(g); world.add(g); obstacles.push({ x: p[0], z: p[1], r: 2.6, h: 99, mesh: g }); }
  buildEnvironment();
}

// ---- vegetation and props (rebuilt when quality changes) ----
export function buildEnvironment() {
  while (env.children.length) env.remove(env.children[0]);
  const Q = settings.Q, o = new T.Object3D(), gc = new T.Color();
  const offTrail = (x, z) => trailDist(x, z) > 7 && terrainH(x, z) < 7 && Math.hypot(x, z) > 26;
  const clearOfObstacles = (x, z, pad) => obstacles.every(ob => Math.hypot(ob.x - x, ob.z - z) > ob.r + pad);
  function instanced(scene3, count, placeFn, { castShadow = false, tintFn = null } = {}) {
    const meshes = []; scene3.traverse(m => { if (m.isMesh) meshes.push(m); });
    const out = [];
    for (const src of meshes) {
      const mat = src.material.clone(); mat.side = T.DoubleSide; if (mat.map) { mat.map.colorSpace = T.SRGBColorSpace; mat.map.anisotropy = Q.aniso; } mat.alphaTest = mat.transparent ? 0.5 : mat.alphaTest; mat.transparent = false; mat.roughness = Math.max(mat.roughness, 0.85);
      const inst = new T.InstancedMesh(src.geometry, mat, count); inst.castShadow = castShadow && Q.shadows; inst.receiveShadow = true; inst.frustumCulled = false; out.push(inst);
    }
    let n = 0, tries = 0;
    while (n < count && tries++ < count * 20) { const pl = placeFn(); if (!pl) continue; const [x, z, sc, rot] = pl; o.position.set(x, terrainH(x, z) - 0.08, z); o.rotation.set(0, rot, 0); o.scale.setScalar(sc); o.updateMatrix(); for (const inst of out) { inst.setMatrixAt(n, o.matrix); if (tintFn) inst.setColorAt(n, tintFn(gc, x, z)); } n++; }
    for (const inst of out) { inst.count = n; inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; env.add(inst); }
    return out;
  }
  const grassTint = (c, x, z) => c.setHSL(0.19 + (vnoise(x * 0.04, z * 0.04) - 0.5) * 0.08, 0.38, 0.36 + (vnoise(x * 0.3, z * 0.3) - 0.5) * 0.14);
  if (A.models.grass) instanced(A.models.grass, Q.plants, () => { const x = rand(-HALF + 6, HALF - 6), z = rand(-HALF + 6, HALF - 6); if (!offTrail(x, z)) return null; const near = trailDist(x, z) < 22; if (!near && Math.random() < 0.6) return null; return [x, z, rand(1.8, 3.4), rand(0, 6.28)]; }, { tintFn: grassTint });
  if (A.models.flowers) instanced(A.models.flowers, Math.floor(Q.plants / 10), () => { const x = rand(-HALF + 12, HALF - 12), z = rand(-HALF + 12, HALF - 12); if (!offTrail(x, z) || !clearOfObstacles(x, z, 2) || vnoise(x * 0.02 + 3, z * 0.02) < 0.55) return null; return [x, z, rand(0.9, 1.8), rand(0, 6.28)]; }, { castShadow: true });
  const treeSpot = () => { const x = rand(-HALF + 16, HALF - 16), z = rand(-HALF + 16, HALF - 16); const td = trailDist(x, z); if (td < 9 || td > 40 || terrainH(x, z) > 6 || Math.hypot(x, z) < 30 || !clearOfObstacles(x, z, 4)) return null; return [x, z, rand(1.3, 2.2), rand(0, 6.28)]; };
  if (A.models.tree) instanced(A.models.tree, Math.ceil(Q.trees * 0.6), treeSpot, { castShadow: true });
  if (A.models.pine) instanced(A.models.pine, Math.floor(Q.trees * 0.4), treeSpot, { castShadow: true });
  // trail-side pebbles and small stones (procedural geometry, real stone texture)
  { const M = materials(); const pebG = rockGeo(999); const np = Math.floor(Q.plants / 3); const pebs = new T.InstancedMesh(pebG, M.boulder, np); let k = 0, tries = 0;
    while (k < np && tries++ < np * 10) { const x = rand(-HALF + 8, HALF - 8), z = rand(-HALF + 8, HALF - 8); const td = trailDist(x, z); if (td < 3.5 || td > 13) continue; o.position.set(x, terrainH(x, z) + 0.02, z); o.rotation.set(0, rand(0, 6.28), 0); const sc = rand(.15, .55); o.scale.set(sc, sc * .6, sc); o.updateMatrix(); pebs.setMatrixAt(k, o.matrix); k++; }
    pebs.count = k; pebs.instanceMatrix.needsUpdate = true; pebs.receiveShadow = true; env.add(pebs); }
  // a few orange camp tarps for color accents near the trails
  { const tarpM = new T.MeshStandardMaterial({ color: 0xd9552a, roughness: .9, side: T.DoubleSide }); const poleM = new T.MeshStandardMaterial({ color: 0x403028, roughness: .9 });
    for (let i = 0; i < 7; i++) { let x, z, tr = 0; do { x = rand(-HALF + 20, HALF - 20); z = rand(-HALF + 20, HALF - 20); } while ((trailDist(x, z) < 8 || trailDist(x, z) > 18 || Math.hypot(x, z) < 30 || !clearOfObstacles(x, z, 4)) && tr++ < 60);
      const g = new T.Group(); const pole = new T.Mesh(new T.CylinderGeometry(.08, .1, 4, 6), poleM); pole.position.y = 2; g.add(pole); const pole2 = pole.clone(); pole2.position.set(3, 1.6, 0.6); pole2.scale.y = .8; g.add(pole2);
      const tarp = new T.Mesh(new T.PlaneGeometry(3.4, 2.6, 6, 4), tarpM); const pa = tarp.geometry.attributes.position; for (let v = 0; v < pa.count; v++) pa.setZ(v, Math.sin(pa.getX(v) * 2 + pa.getY(v)) * 0.25); tarp.geometry.computeVertexNormals(); tarp.position.set(1.5, 2.8, 0.3); tarp.rotation.set(-0.4, 0.2, 0.15); tarp.castShadow = settings.Q.shadows; g.add(tarp);
      g.position.set(x, terrainH(x, z) - 0.2, z); g.rotation.y = rand(0, 6.28); env.add(g); } }
  buildClouds();
}
