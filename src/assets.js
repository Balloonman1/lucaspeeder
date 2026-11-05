// Asset manifest and loaders. Every file here is CC0; see public/assets/CREDITS.md.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { settings } from './config.js';

const base = './';
const url = p => base + 'assets/' + p;

// Poly Haven PBR sets. Each has diffuse, normal (OpenGL), ARM (ao/roughness/metal) and displacement.
export const TEXSETS = {
  trail:  { diff:'rocky_trail_diff',  nor:'rocky_trail_nor_gl',  arm:'rocky_trail_arm'  },
  sand:   { diff:'sand_01_diff',      nor:'sand_01_nor_gl',      arm:'sand_01_arm'      },
  rocks:  { diff:'rocks_ground_02_col', nor:'rocks_ground_02_nor_gl', arm:'rocks_ground_02_arm' },
  cliff:  { diff:'rock_face_03_diff', nor:'rock_face_03_nor_gl', arm:'rock_face_03_arm' },
  grass:  { diff:'forrest_ground_01_diff', nor:'forrest_ground_01_nor_gl', arm:'forrest_ground_01_arm' },
};
// glTF JSON with embedded buffers (served as .json so any static host, including artifact hosting, accepts it)
export const MODELS = {
  rock1:'Rock_Medium_1.gltf.json', rock2:'Rock_Medium_2.gltf.json', rock3:'Rock_Medium_3.gltf.json',
  grass:'Grass_Common_Short.gltf.json', flowers:'Bush_Common_Flowers.gltf.json', tree:'CommonTree_1.gltf.json', pine:'Pine_1.gltf.json',
};
export const HDRI = 'kiara_1_dawn_1k';

export const A = { tex:{}, models:{}, hdri:null, ready:false };

const texLoader = new T.TextureLoader();
const gltfLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();

function loadTex(name, srgb) {
  const res = settings.Q.tex;
  return new Promise((resolve, reject) => {
    texLoader.load(url(`textures/${res}/${name}_${res}.jpg`), t => {
      t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = settings.Q.aniso; if (srgb) t.colorSpace = T.SRGBColorSpace; resolve(t);
    }, undefined, reject);
  });
}
function loadGltf(file) {
  return new Promise((resolve, reject) => gltfLoader.load(url('models/' + file), g => resolve(g.scene), undefined, reject));
}

// Every job settles within `ms` even if a loader never calls back (e.g. an HDR parse that silently fails).
function bounded(promise, ms, label) {
  return new Promise(resolve => { let done = false; const t = setTimeout(() => { if (!done) { done = true; console.warn('asset timed out:', label); resolve(false); } }, ms);
    promise.then(() => { if (!done) { done = true; clearTimeout(t); resolve(true); } }, err => { if (!done) { done = true; clearTimeout(t); console.warn('asset failed:', label, err && err.message || err); resolve(false); } }); });
}
export async function loadAll(onProgress) {
  const jobs = []; let done = 0;
  const add = (label, p, ms = 20000) => jobs.push(bounded(p, ms, label).then(() => { done++; onProgress && onProgress(done / jobs.length); }));
  for (const [k, set] of Object.entries(TEXSETS)) {
    A.tex[k] = {};
    add(set.diff, loadTex(set.diff, true).then(t => { A.tex[k].diff = t; }));
    add(set.nor, loadTex(set.nor, false).then(t => { A.tex[k].nor = t; }));
    add(set.arm, loadTex(set.arm, false).then(t => { A.tex[k].arm = t; }));
  }
  A.tex.boulder = {};
  add('boulder diff', loadTex('rock_boulder_dry_diff', true).then(t => { A.tex.boulder.diff = t; }));
  add('boulder rough', loadTex('rock_boulder_dry_rough', false).then(t => { A.tex.boulder.rough = t; }));
  for (const [k, file] of Object.entries(MODELS)) add(file, loadGltf(file).then(s => { A.models[k] = s; }));
  // true HDR when the host serves .hdr; otherwise a tone-mapped JPG equirect of the same sky
  add('hdri', new Promise((res, rej) => {
    const useJpg = () => texLoader.load(url('hdri/' + HDRI + '.jpg'), t => { t.mapping = T.EquirectangularReflectionMapping; t.colorSpace = T.SRGBColorSpace; A.hdri = t; res(); }, undefined, rej);
    try { rgbeLoader.load(url('hdri/' + HDRI + '.hdr'), t => { if (!t || !t.image || !t.image.data) { useJpg(); return; } t.mapping = T.EquirectangularReflectionMapping; A.hdri = t; res(); }, undefined, useJpg); } catch (e) { useJpg(); }
  }), 12000);
  await Promise.all(jobs);
  // any texture that failed gets a neutral stand-in so materials still build
  const white = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#b9a58c'; x.fillRect(0, 0, 4, 4); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  const flatN = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, 4, 4); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  const armN = (() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = 'rgb(255,230,0)'; x.fillRect(0, 0, 4, 4); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t; })();
  for (const k of Object.keys(TEXSETS)) { const t = A.tex[k]; t.diff = t.diff || white; t.nor = t.nor || flatN; t.arm = t.arm || armN; }
  A.tex.boulder.diff = A.tex.boulder.diff || white;
  A.ready = true;
  return A;
}

// Pull the first mesh geometry out of a loaded glTF scene (our models are single-mesh props).
// A model that failed or timed out on a slow connection is undefined. Returning null here lets the game fall
// back to procedural rocks; throwing used to abort the course build and leave that player with no obstacles.
export function firstGeometry(scene) {
  if (!scene) return null;
  let geo = null; scene.traverse(o => { if (!geo && o.isMesh) geo = o.geometry; });
  return geo;
}
export function allMeshes(scene) { const out = []; if (!scene) return out; scene.traverse(o => { if (o.isMesh) out.push(o); }); return out; }
