// Sky dome, sun/moon cycle, stars, drifting clouds, image-based lighting from the Poly Haven HDRI.
import * as T from 'three';
import { scene, camera, sun, hemi, fill, renderer, env } from './engine.js';
import { settings, HALF, rand, clamp } from './config.js';
import { A } from './assets.js';
import { level } from './levels.js';

export const sky = {};
export const sunDir = new T.Vector3(0.5, 0.8, -0.5);

const domeM = new T.ShaderMaterial({
  side: T.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new T.Color(0x3f7fd0) }, horizon: { value: new T.Color(0xdfe6ee) }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: new T.Color(0xfff0c0) }, glare: { value: 1.0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir=normalize(position); vec4 p=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*p; gl_Position.z=gl_Position.w; }',
  fragmentShader: `uniform vec3 top, horizon, sunDir, sunCol; uniform float glare; varying vec3 vDir;
    void main(){ float h=clamp(vDir.y,0.0,1.0); vec3 c=mix(horizon, top, pow(h,0.5)); float s=max(dot(normalize(vDir),normalize(sunDir)),0.0);
      c += sunCol*pow(s,260.0)*3.0*glare + sunCol*pow(s,14.0)*0.4*glare + sunCol*pow(s,3.0)*0.1*glare; gl_FragColor=vec4(c,1.0); }`,
});
sky.dome = new T.Mesh(new T.SphereGeometry(1500, 32, 16), domeM); sky.dome.frustumCulled = false; scene.add(sky.dome);
sky.moon = new T.Mesh(new T.SphereGeometry(26, 24, 24), new T.MeshBasicMaterial({ color: 0xf2eee0, fog: false })); scene.add(sky.moon);
sky.moon2 = new T.Mesh(new T.SphereGeometry(12, 24, 24), new T.MeshBasicMaterial({ color: 0x9ef5ff, fog: false })); sky.moon2.position.set(260, 220, -480); scene.add(sky.moon2);
{
  const pts = []; for (let i = 0; i < 900; i++) { const r = 1200, th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45; pts.push(r * Math.cos(th) * Math.cos(ph), r * Math.sin(ph) + 40, r * Math.sin(th) * Math.cos(ph)); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
  sky.stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true })); scene.add(sky.stars);
}
const C = { day: new T.Color(), dusk: new T.Color(), night: new T.Color(), fogDay: new T.Color(), skyTop: new T.Color(), skyHor: new T.Color(), duskTop: new T.Color() };
let paletteFor = null;
function syncPalette(){ if (paletteFor === level.id) return; paletteFor = level.id; const P = level.sky; for (const k of Object.keys(C)) C[k].setHex(P[k]); }

export function setupEnvironment() {
  if (!A.hdri) return;
  const pm = new T.PMREMGenerator(renderer); const envMap = pm.fromEquirectangular(A.hdri).texture; pm.dispose();
  scene.environment = envMap; scene.environmentIntensity = 0.55;
}

export const clouds = [];
export function buildClouds() {
  for (const c of clouds) env.remove(c); clouds.length = 0;
  const ct = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); })();
  for (let i = 0; i < settings.Q.clouds; i++) {
    const g = new T.Group(); const n = 3 + Math.floor(Math.random() * 4);
    for (let j = 0; j < n; j++) { const sp = new T.Sprite(new T.SpriteMaterial({ map: ct, transparent: true, opacity: .55, depthWrite: false, fog: false })); const w = rand(50, 110); sp.scale.set(w, w * 0.5, 1); sp.position.set(rand(-60, 60), rand(-8, 8), rand(-20, 20)); g.add(sp); }
    g.position.set(rand(-HALF - 150, HALF + 150), rand(120, 200), rand(-HALF - 150, HALF + 150)); g.userData.v = rand(1.5, 4); env.add(g); clouds.push(g);
  }
}

// clock: 0 midnight, .25 sunrise, .5 noon, .75 sunset. Returns daylight 0..1.
export function updateSky(clock) {
  syncPalette(); const P = level.sky;
  const sunY = Math.sin((clock - 0.25) * Math.PI * 2), sunX = -Math.cos((clock - 0.25) * Math.PI * 2);
  sky.moon.position.set(-sunX * 600, -sunY * 380 + 20, -520); sky.moon.visible = sunY < 0.12;
  const daylight = clamp(sunY * 2.2, 0, 1), duskness = clamp(1 - Math.abs(sunY) * 3.5, 0, 1);
  const col = C.night.clone().lerp(C.day, daylight).lerp(C.dusk, duskness * 0.7);
  scene.fog.color.copy(col).lerp(C.fogDay, daylight * 0.45);
  scene.fog.near = 90 + daylight * 90; scene.fog.far = 420 + daylight * 380;
  sun.intensity = 0.6 + daylight * 2.8; hemi.intensity = 0.35 + daylight * 0.7; fill.intensity = 0.15 + daylight * 0.4;
  sun.color.setHex(daylight > 0.5 ? P.sunDay : 0xffa860); hemi.color.setHex(daylight > 0.5 ? P.hemiSky : 0x6b5a9a); hemi.groundColor.setHex(P.hemiGround);
  sunDir.set(sunX, Math.max(0.3, sunY), -0.5).normalize();
  sky.stars.material.opacity = 1 - daylight; sky.moon2.visible = daylight < 0.9;
  renderer.toneMappingExposure = (0.85 + daylight * 0.3) * P.exposure;
  if (scene.environment) scene.environmentIntensity = 0.12 + daylight * 0.5;
  domeM.uniforms.top.value.copy(C.night).lerp(C.skyTop, daylight).lerp(C.duskTop, duskness * 0.5);
  domeM.uniforms.horizon.value.copy(C.night).lerp(C.skyHor, daylight).lerp(C.dusk, duskness * 0.85);
  domeM.uniforms.sunDir.value.set(sunX, sunY, -0.55); domeM.uniforms.glare.value = sunY > -0.05 ? 1 : 0; domeM.uniforms.sunCol.value.setHex(daylight > 0.5 ? 0xfff3d2 : 0xffa050);
  sky.dome.position.copy(camera.position);
  for (const c of clouds) { c.position.x += c.userData.v * 0.016; if (c.position.x > HALF + 200) c.position.x = -HALF - 200; c.children.forEach(sp => sp.material.opacity = 0.25 + daylight * 0.4); }
  return daylight;
}
