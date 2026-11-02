// Terrain height field, the 4-way PBR splat material (trail / grass / rocky ground / cliff rock)
// and a triplanar PBR material used on every rock mesh so real Poly Haven stone wraps organic shapes.
import * as T from 'three';
import { WORLD, HALF, smooth, vnoise, settings } from './config.js';
import { A } from './assets.js';
import { scene } from './engine.js';
import { level } from './levels.js';

// Trails/roads and heights come from the active level (levels.js).
export function trailDist(x, z) { let d = 1e9; for (const f of level.trails) d = Math.min(d, f(x, z)); return d; }
export function trailIndex(x, z) { let d = 1e9, idx = 0; level.trails.forEach((f, i) => { const v = f(x, z); if (v < d) { d = v; idx = i; } }); return idx; }
export function terrainH(x, z) { return level.height(x, z, trailDist(x, z)); }
export function terrainSlope(x, z) { return Math.hypot(terrainH(x + 2, z) - terrainH(x - 2, z), terrainH(x, z + 2) - terrainH(x, z - 2)) / 4; }

// ---- splat material: MeshStandardMaterial with four texture sets blended by a per-vertex weight ----
function makeSplatMaterial(sets) {
  const m = new T.MeshStandardMaterial({ map: sets[0].diff, normalMap: sets[0].nor, roughnessMap: sets[0].arm, aoMap: sets[0].arm, roughness: 1, metalness: 0, vertexColors: true });
  m.normalScale.set(1.2, 1.2);
  const u = {};
  sets.forEach((s, i) => { u['tDiff' + i] = { value: s.diff }; u['tNor' + i] = { value: s.nor }; u['tArm' + i] = { value: s.arm }; });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aSplat; varying vec4 vSplat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = aSplat;');
    const decl = `varying vec4 vSplat; uniform sampler2D tDiff0,tDiff1,tDiff2,tDiff3,tNor0,tNor1,tNor2,tNor3,tArm0,tArm1,tArm2,tArm3;
      vec4 splat4(sampler2D a, sampler2D b, sampler2D c, sampler2D d, vec2 uv){ vec4 w=vSplat; float s=w.x+w.y+w.z+w.w+1e-4; w/=s;
        return texture2D(a,uv)*w.x + texture2D(b,uv)*w.y + texture2D(c,uv)*w.z + texture2D(d,uv)*w.w; }`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + decl)
      .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', 'vec4 sampledDiffuseColor = splat4(tDiff0,tDiff1,tDiff2,tDiff3, vMapUv); sampledDiffuseColor.rgb *= 1.05;')
      .replace('vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );', 'vec4 texelRoughness = splat4(tArm0,tArm1,tArm2,tArm3, vRoughnessMapUv);')
      .replace('float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;', 'float ambientOcclusion = ( splat4(tArm0,tArm1,tArm2,tArm3, vAoMapUv).r - 1.0 ) * aoMapIntensity + 1.0;')
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = splat4(tNor0,tNor1,tNor2,tNor3, vNormalMapUv).xyz * 2.0 - 1.0;');
  };
  m.customProgramCacheKey = () => 'splat' + level.id;
  return m;
}

export let ground = null;
export function buildTerrain() {
  if (ground) { scene.remove(ground); ground.geometry.dispose(); ground.material.dispose(); ground = null; }
  const seg = 180;
  const g = new T.PlaneGeometry(WORLD, WORLD, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv, cols = [], splat = [];
  const tint = new T.Color(), tA = new T.Color(level.tint[0]), tB = new T.Color(level.tint[1]);
  const TILE = 1 / level.tileM;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = terrainH(x, z); p.setY(i, h);
    if (level.roadUV && trailDist(x, z) <= 0.01) { // road: u spans the street width exactly (lane lines line up), v runs along it
      const B = level.block, Wd = level.street; const mx = ((x % B) + B) % B - B / 2, mz = ((z % B) + B) % B - B / 2;
      if (Math.abs(mx) <= Wd / 2 && Math.abs(mz) > Wd / 2) uv.setXY(i, mx / Wd + 0.5, z / Wd); else if (Math.abs(mz) <= Wd / 2) uv.setXY(i, mz / Wd + 0.5, x / Wd); else uv.setXY(i, x * TILE, z * TILE); }
    else uv.setXY(i, x * TILE, z * TILE);
    const slope = terrainSlope(x, z), td = trailDist(x, z);
    const w = level.weights(x, z, h, slope, td); splat.push(w[0], w[1], w[2], w[3]);
    const n2 = vnoise(x * 0.11 + 7, z * 0.11 + 3); tint.copy(n2 > 0.5 ? tA : tB).lerp(new T.Color(0xffffff), 0.55); cols.push(tint.r, tint.g, tint.b);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  g.setAttribute('aSplat', new T.Float32BufferAttribute(splat, 4));
  g.setAttribute('uv1', g.attributes.uv);
  g.computeVertexNormals();
  ground = new T.Mesh(g, makeSplatMaterial(level.layers())); ground.receiveShadow = true; ground.name = 'ground'; scene.add(ground);
  return ground;
}

// ---- triplanar PBR material (world-space projection, no UVs needed) ----
export function makeTriplanarMaterial(set, opts = {}) {
  const scale = opts.scale || 0.12;
  const m = new T.MeshStandardMaterial({ map: set.diff, normalMap: set.nor || null, roughnessMap: set.arm || set.rough || null, aoMap: set.arm || null, roughness: opts.roughness ?? 1, metalness: 0, color: opts.color || 0xffffff });
  m.normalScale.set(1.0, 1.0);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTriScale = { value: scale }; sh.uniforms.uTriDiff = { value: set.diff }; sh.uniforms.uTriNor = { value: set.nor || set.diff }; sh.uniforms.uTriArm = { value: set.arm || set.rough || set.diff };
    sh.uniforms.uHasNor = { value: set.nor ? 1 : 0 }; sh.uniforms.uHasArm = { value: set.arm ? 1 : 0 }; sh.uniforms.uNScale = { value: opts.normalScale || 1.0 };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNor;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;\n #ifdef USE_INSTANCING\n vWNor = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);\n #else\n vWNor = normalize(mat3(modelMatrix) * objectNormal);\n #endif');
    const decl = `varying vec3 vWPos; varying vec3 vWNor; uniform float uTriScale; uniform sampler2D uTriDiff, uTriNor, uTriArm; uniform float uHasNor, uHasArm, uNScale;
      vec3 triW(){ vec3 w=abs(vWNor); w=pow(w,vec3(4.0)); return w/(w.x+w.y+w.z); }
      vec4 tri(sampler2D t){ vec3 w=triW(); vec3 p=vWPos*uTriScale; return texture2D(t,p.yz)*w.x + texture2D(t,p.xz)*w.y + texture2D(t,p.xy)*w.z; }
      #ifdef USE_NORMALMAP
      vec3 triNormal(){ vec3 w=triW(); vec3 p=vWPos*uTriScale; vec3 n=normalize(vWNor);
        vec3 tx=texture2D(uTriNor,p.yz).xyz*2.0-1.0, ty=texture2D(uTriNor,p.xz).xyz*2.0-1.0, tz=texture2D(uTriNor,p.xy).xyz*2.0-1.0;
        // whiteout-style blend: perturb each projection's tangent plane, then weight
        vec3 nx=vec3(n.x, n.y+tx.y*uNScale, n.z+tx.x*uNScale); vec3 ny=vec3(n.x+ty.x*uNScale, n.y, n.z+ty.y*uNScale); vec3 nz=vec3(n.x+tz.x*uNScale, n.y+tz.y*uNScale, n.z);
        return normalize(nx*w.x + ny*w.y + nz*w.z); }
      #endif`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + decl)
      .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', 'vec4 sampledDiffuseColor = tri(uTriDiff);')
      .replace('vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );', 'vec4 texelRoughness = uHasArm>0.5 ? tri(uTriArm) : vec4(tri(uTriArm).r);')
      .replace('float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;', 'float ambientOcclusion = uHasArm>0.5 ? ( tri(uTriArm).r - 1.0 ) * aoMapIntensity + 1.0 : 1.0;')
      .replace('#include <normal_fragment_maps>', set.nor ? 'vec3 wn = triNormal(); normal = normalize( (viewMatrix * vec4(wn,0.0)).xyz );' : '');
  };
  m.customProgramCacheKey = () => 'tri' + scale + (set.nor ? 'n' : '') + (set.arm ? 'a' : '');
  return m;
}

export function shadowify(obj, cast = true, recv = true) { obj.traverse(o => { if (o.isMesh) { o.castShadow = cast && settings.Q.shadows; o.receiveShadow = recv; } }); return obj; }
