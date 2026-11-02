// Renderer, camera, lights and the post-processing chain (bloom, GTAO, SMAA, color grade).
import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { settings, $ } from './config.js';

export const canvas = $('game');
export const renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(settings.Q.px);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = settings.Q.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;

export const scene = new T.Scene();
scene.fog = new T.Fog(0xd9c2a5, 90, 700);
export const camera = new T.PerspectiveCamera(68, 1, 0.1, 2000);
scene.add(camera);

// Physically-based light intensities (three r155+ units).
export const hemi = new T.HemisphereLight(0xcfe3ff, 0x9a6a45, 0.9); scene.add(hemi);
export const sun = new T.DirectionalLight(0xfff1d8, 3.2); sun.position.set(-120, 180, -60); scene.add(sun); scene.add(sun.target);
sun.castShadow = settings.Q.shadows; sun.shadow.mapSize.set(settings.Q.shadowMap || 1024, settings.Q.shadowMap || 1024);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 420; sun.shadow.camera.left = -80; sun.shadow.camera.right = 80; sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5; sun.shadow.radius = 2;
export const fill = new T.DirectionalLight(0x9ac8ff, 0.5); fill.position.set(100, 60, 120); scene.add(fill);

export const world = new T.Group(); scene.add(world);   // rebuilt per match (obstacles, bikes, items)
export const env = new T.Group(); scene.add(env);       // vegetation, props (rebuilt on quality change)

// ---- post chain ----
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vig: { value: 0.38 }, warmth: { value: 0.035 }, sat: { value: 1.06 }, contrast: { value: 1.04 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vig, warmth, sat, contrast; varying vec2 vUv;
    void main(){ vec4 s=texture2D(tDiffuse,vUv); vec3 c=s.rgb; c=mix(vec3(dot(c,vec3(.299,.587,.114))),c,sat); c=(c-0.5)*contrast+0.5; c+=vec3(warmth,warmth*0.4,-warmth*0.7)*c;
      vec2 d=vUv-0.5; c*=clamp(1.0-dot(d,d)*vig*2.0,0.0,1.0); gl_FragColor=vec4(c,s.a); }`,
};
export const post = { composer: null, bloom: null, ao: null, smaa: null, grade: null, on: false };
function buildPost() {
  const w = innerWidth, h = innerHeight;
  post.composer = new EffectComposer(renderer);
  post.composer.addPass(new RenderPass(scene, camera));
  post.ao = new GTAOPass(scene, camera, w, h); post.ao.output = GTAOPass.OUTPUT.Default; post.ao.blendIntensity = 0.9;
  post.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 12, distanceFallOff: 1.0, screenSpaceRadius: false });
  post.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  post.composer.addPass(post.ao);
  post.bloom = new UnrealBloomPass(new T.Vector2(w, h), 0.28, 0.5, 0.9); post.composer.addPass(post.bloom);
  post.grade = new ShaderPass(GradeShader); post.composer.addPass(post.grade);
  post.composer.addPass(new OutputPass());
  post.smaa = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio()); post.composer.addPass(post.smaa);
}
buildPost();
export function applyQualityToEngine() {
  const Q = settings.Q;
  renderer.setPixelRatio(Q.px); renderer.shadowMap.enabled = Q.shadows; sun.castShadow = Q.shadows;
  if (Q.shadowMap) { sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  post.ao.enabled = Q.ao; resize();
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
export function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  post.composer.setSize(w, h); post.smaa.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
}
addEventListener('resize', resize); resize(); post.ao.enabled = settings.Q.ao;

export function renderFrame() {
  if (settings.Q.post) post.composer.render(); else renderer.render(scene, camera);
}
