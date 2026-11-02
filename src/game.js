// Gameplay: riders, items, physics, bots, host simulation, networking, HUD and menus.
// Rendering lives in engine.js / sky.js / terrain.js / props.js; this module drives them.
import * as T from 'three';
import { WORLD, HALF, MAX_PLAYERS, DAY_LEN, BIKE_COLORS, HATS, BOT_NAMES, QUALITY, settings, isTouch, $, rand, setSeed } from './config.js';
import { A } from './assets.js';
import { renderer, scene, camera, sun, world, env, renderFrame, applyQualityToEngine } from './engine.js';
import { updateSky, sunDir, setupEnvironment } from './sky.js';
import { terrainH, trailDist, buildTerrain, shadowify } from './terrain.js';
import { obstacles, buildScenery, buildObstacles, buildEnvironment } from './props.js';
import { SFX } from './audio.js';

const mqttLib = () => window.mqtt;
let matchLen = 300; // chosen on the start screen; 90 for quick play
function applyQuality(name){ settings.qualityName = name; try{ localStorage.setItem('speederQuality', name); }catch(e){} applyQualityToEngine(); buildEnvironment(); }

export function startGame(){
// ---------- helpers ----------
function labelSprite(text, color, w){
  const c = document.createElement('canvas'); c.width=256; c.height=64;
  const ctx = c.getContext('2d'); ctx.font = '700 30px Exo 2, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(18,10,31,.6)'; ctx.beginPath(); ctx.roundRect(8,10,240,44,22); ctx.fill();
  ctx.fillStyle=color; ctx.fillText(text,128,33);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthTest:false})); s.scale.set(w||5,(w||5)/4,1); return s;
}
const mat = (color, extra={}) => new T.MeshStandardMaterial(Object.assign({color, roughness:.55, metalness:.1}, extra));
const metal = (color, extra={}) => new T.MeshStandardMaterial(Object.assign({color, roughness:.28, metalness:.85}, extra));
const glowMat = (color, extra={}) => new T.MeshStandardMaterial(Object.assign({color, emissive:color, emissiveIntensity:0.9, roughness:.3, metalness:0}, extra));

// ---------- bikes and hats ----------
function addHat(g, hat){
  const y=1.87; g=(function(){ const hg=new T.Group(); hg.position.set(0,0,.6); g.add(hg); return hg; })();
  if(hat==='cap'){ const c=new T.Mesh(new T.SphereGeometry(.34,12,8,0,6.3,0,1.5), mat(0xff4d6d)); c.position.set(0,y-.2,-.05); g.add(c); const b=new T.Mesh(new T.BoxGeometry(.5,.05,.35), mat(0xff4d6d)); b.position.set(0,y-.12,.3); g.add(b); }
  else if(hat==='cone'){ const c=new T.Mesh(new T.ConeGeometry(.3,.9,12), mat(0xffb347)); c.position.set(0,y+.3,-.05); g.add(c); const s=new T.Mesh(new T.TorusGeometry(.2,.05,6,12), mat(0x4df0e0)); s.position.set(0,y+.3,-.05); s.rotation.x=Math.PI/2; g.add(s); const ball=new T.Mesh(new T.SphereGeometry(.09,8,8), mat(0xff6ad5)); ball.position.set(0,y+.78,-.05); g.add(ball); }
  else if(hat==='crown'){ const c=new T.Mesh(new T.CylinderGeometry(.34,.3,.3,8,1,true), new T.MeshPhongMaterial({color:0xffd24d, side:T.DoubleSide, shininess:120})); c.position.set(0,y,-.05); g.add(c); for(let i=0;i<6;i++){ const sp=new T.Mesh(new T.ConeGeometry(.08,.25,4), mat(0xffd24d)); const a=i/6*Math.PI*2; sp.position.set(Math.cos(a)*.32,y+.25,-.05+Math.sin(a)*.32); g.add(sp);} }
  else if(hat==='horns'){ for(const s of [-1,1]){ const h=new T.Mesh(new T.ConeGeometry(.1,.6,8), mat(0xf0e6d2)); h.position.set(s*.32,y+.05,-.05); h.rotation.z=-s*.6; g.add(h);} const band=new T.Mesh(new T.TorusGeometry(.33,.05,6,16), mat(0x8a5a2a)); band.position.set(0,y-.05,-.05); band.rotation.x=Math.PI/2; g.add(band); }
  else if(hat==='antenna'){ const st=new T.Mesh(new T.CylinderGeometry(.03,.03,.7,6), mat(0xcccccc)); st.position.set(0,y+.3,-.05); g.add(st); const b=new T.Mesh(new T.SphereGeometry(.12,10,10), new T.MeshBasicMaterial({color:0x4df0e0})); b.position.set(0,y+.68,-.05); g.add(b); }
  else if(hat==='tophat'){ const b=new T.Mesh(new T.CylinderGeometry(.42,.42,.06,16), mat(0x1a1a24)); b.position.set(0,y-.1,-.05); g.add(b); const c=new T.Mesh(new T.CylinderGeometry(.28,.3,.6,16), mat(0x1a1a24)); c.position.set(0,y+.2,-.05); g.add(c); const r=new T.Mesh(new T.CylinderGeometry(.31,.31,.1,16), mat(0xff6ad5)); r.position.set(0,y,-.05); g.add(r); }
}
function makeBike(color, hat, name, clone){
  const g = new T.Group(); const c = new T.Color(color);
  const paint = new T.MeshPhysicalMaterial({color:c, roughness:.25, metalness:.6, clearcoat:1, clearcoatRoughness:.1});
  const dark = metal(0x1c1c2a,{roughness:.4}); const chrome = metal(0xd8dce8,{roughness:.15});
  const glowC = clone?0x7cff8a:0x4df0e0;
  // hull: long tapered body
  const hull = new T.Mesh(new T.CylinderGeometry(.5,.5,2.8,14), paint); hull.rotation.x=Math.PI/2; hull.position.set(0,.55,.2); hull.scale.set(1,.75,1); g.add(hull);
  const tail = new T.Mesh(new T.SphereGeometry(.5,14,10), paint); tail.position.set(0,.55,-1.2); tail.scale.set(1,.75,1); g.add(tail);
  const nose = new T.Mesh(new T.ConeGeometry(.42,1.6,12), paint); nose.rotation.x=Math.PI/2; nose.position.set(0,.5,2.6); nose.scale.set(1,.8,1); g.add(nose);
  const noseTip = new T.Mesh(new T.SphereGeometry(.14,10,10), glowMat(glowC)); noseTip.position.set(0,.5,3.4); g.add(noseTip);
  // canopy / fuel cell
  const tank = new T.Mesh(new T.SphereGeometry(.48,14,10), paint); tank.scale.set(1,.7,1.3); tank.position.set(0,.85,.5); g.add(tank);
  // side pods with glowing vents
  for(const sx of [-1,1]){ const pod=new T.Mesh(new T.BoxGeometry(.5,.45,1.6), dark); pod.position.set(sx*.8,.5,-.2); g.add(pod);
    const vent=new T.Mesh(new T.BoxGeometry(.08,.22,1.0), glowMat(glowC)); vent.position.set(sx*1.07,.5,-.2); g.add(vent);
    const strut=new T.Mesh(new T.BoxGeometry(.5,.12,.5), chrome); strut.position.set(sx*.45,.55,-.2); g.add(strut); }
  // front steering vanes (canards)
  for(const sx of [-1,1]){ const v=new T.Mesh(new T.BoxGeometry(1.3,.08,.55), chrome); v.position.set(sx*.9,.5,1.7); v.rotation.z=sx*.18; g.add(v); }
  // rear engine: twin turbines with spinning rotors
  g.userData.rotors=[];
  for(const sx of [-1,1]){ const eng=new T.Mesh(new T.CylinderGeometry(.38,.45,1.5,14), dark); eng.rotation.x=Math.PI/2; eng.position.set(sx*.62,.55,-1.6); g.add(eng);
    const rim=new T.Mesh(new T.TorusGeometry(.4,.06,8,20), chrome); rim.position.set(sx*.62,.55,-2.36); g.add(rim);
    const rotor=new T.Mesh(new T.CylinderGeometry(.34,.34,.05,16), glowMat(glowC)); rotor.rotation.x=Math.PI/2; rotor.position.set(sx*.62,.55,-2.34); g.add(rotor); g.userData.rotors.push(rotor);
    const blades=new T.Group(); for(let i=0;i<5;i++){ const b=new T.Mesh(new T.BoxGeometry(.06,.6,.03), dark); b.rotation.z=i/5*Math.PI*2; blades.add(b); } blades.position.set(sx*.62,.55,-2.3); g.add(blades); g.userData.rotors.push(blades);
    const exhaust=new T.Mesh(new T.ConeGeometry(.32,1.4,12,1,true), new T.MeshBasicMaterial({color:glowC, transparent:true, opacity:.55, side:T.DoubleSide, depthWrite:false})); exhaust.rotation.x=Math.PI/2; exhaust.position.set(sx*.62,.55,-3.1); g.add(exhaust); (g.userData.exhaust=g.userData.exhaust||[]).push(exhaust); }
  const glow = new T.Mesh(new T.CircleGeometry(.01,4), new T.MeshBasicMaterial({color:glowC, transparent:true, opacity:0})); g.add(glow); // legacy handle
  // tail fin
  const fin=new T.Mesh(new T.BoxGeometry(.08,.9,1.1), paint); fin.position.set(0,1.05,-1.5); fin.rotation.x=-.5; g.add(fin);
  const finLight=new T.Mesh(new T.BoxGeometry(.1,.1,.6), glowMat(0xff4d6d)); finLight.position.set(0,1.4,-1.7); finLight.rotation.x=-.5; g.add(finLight);
  // seat, rider
  const seat = new T.Mesh(new T.BoxGeometry(.7,.22,1.2), new T.MeshStandardMaterial({color:0x2a2233, roughness:.9})); seat.position.set(0,.9,-.5); g.add(seat);
  const suitC = clone?0x2a7a3a:c.clone().offsetHSL(0.5,0,0);
  const torso = new T.Mesh(new T.BoxGeometry(.6,.85,.42), mat(suitC,{roughness:.7})); torso.position.set(0,1.3,-.1); torso.rotation.x=1.05; g.add(torso);
  const pack = new T.Mesh(new T.BoxGeometry(.42,.32,.3), mat(0x8a5a2a,{roughness:.9})); pack.position.set(0,1.55,-.35); pack.rotation.x=1.05; g.add(pack);
  for(const sx of [-1,1]){ const arm=new T.Mesh(new T.CylinderGeometry(.09,.09,.9,8), mat(suitC,{roughness:.7})); arm.position.set(sx*.42,1.15,.55); arm.rotation.x=1.35; g.add(arm);
    const glove=new T.Mesh(new T.SphereGeometry(.11,8,8), dark); glove.position.set(sx*.45,1.0,.98); g.add(glove);
    const leg=new T.Mesh(new T.CylinderGeometry(.11,.1,.9,8), dark); leg.position.set(sx*.3,.75,.1); leg.rotation.x=1.3; leg.rotation.z=sx*.25; g.add(leg); }
  const head = new T.Mesh(new T.SphereGeometry(.3,16,14), new T.MeshPhysicalMaterial({color:clone?0x9dffb0:0xf4f4ff, roughness:.2, metalness:.3, clearcoat:1})); head.position.set(0,1.62,.55); g.add(head);
  const visor = new T.Mesh(new T.SphereGeometry(.28,14,10,0,6.3,0,1.3), glowMat(glowC)); visor.position.set(0,1.62,.55); visor.rotation.x=Math.PI/2.2; visor.scale.set(1,1,.95); g.add(visor);
  const bars = new T.Mesh(new T.TorusGeometry(.5,.05,8,18,Math.PI), chrome); bars.position.set(0,1.0,1.0); bars.rotation.x=Math.PI/2; bars.rotation.z=Math.PI; g.add(bars);
  const shadow = new T.Mesh(new T.CircleGeometry(1.4,16), new T.MeshBasicMaterial({color:0x000000, transparent:true, opacity:.3, depthWrite:false})); shadow.rotation.x=-Math.PI/2; shadow.name='shadow'; g.add(shadow);
  // hover light under the bike
  const under = new T.Mesh(new T.CircleGeometry(1.1,20), new T.MeshBasicMaterial({color:glowC, transparent:true, opacity:.12, depthWrite:false})); under.rotation.x=-Math.PI/2; under.position.y=.02; under.name='under'; g.add(under);
  addHat(g, hat);
  if(name){ const l=labelSprite(name, clone?'#7cff8a':'#ffffff', 4); l.position.y=3.3; l.name='label'; g.add(l); }
  g.userData.glow = glow; shadowify(g, true, false); shadow.castShadow=false; under.castShadow=false; world.add(g); return g;
}

// ---------- items ----------
// food textures drawn once on canvases
function canvasTex(size, draw){ const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); draw(x,size); const t=new T.CanvasTexture(c); t.colorSpace=T.SRGBColorSpace; return t; }
const FOODTEX = {
  strawberry: canvasTex(128,(x,S)=>{ const g=x.createLinearGradient(0,0,0,S); g.addColorStop(0,'#ff4d5e'); g.addColorStop(1,'#b8122a'); x.fillStyle=g; x.fillRect(0,0,S,S); for(let i=0;i<90;i++){ const px=(i%10)*12.8+((Math.floor(i/10)%2)*6)+4, py=Math.floor(i/10)*13+4; x.fillStyle='#f6e27a'; x.beginPath(); x.ellipse(px,py,1.8,2.6,0,0,6.3); x.fill(); x.fillStyle='rgba(120,0,20,.5)'; x.beginPath(); x.ellipse(px,py+3,2.4,1.4,0,0,6.3); x.fill(); } }),
  bagel: canvasTex(128,(x,S)=>{ const g=x.createLinearGradient(0,0,S,S); g.addColorStop(0,'#e3b57a'); g.addColorStop(1,'#b97a3e'); x.fillStyle=g; x.fillRect(0,0,S,S); for(let i=0;i<120;i++){ x.fillStyle=Math.random()<.8?'#f7f0dc':'#3a2a1a'; x.save(); x.translate(Math.random()*S,Math.random()*S); x.rotate(Math.random()*3); x.beginPath(); x.ellipse(0,0,2.6,1.4,0,0,6.3); x.fill(); x.restore(); } }),
  toast: canvasTex(128,(x,S)=>{ const g=x.createRadialGradient(S/2,S/2,10,S/2,S/2,S*0.75); g.addColorStop(0,'#f1d7a3'); g.addColorStop(.7,'#d9a862'); g.addColorStop(1,'#8b4b1f'); x.fillStyle=g; x.fillRect(0,0,S,S); for(let i=0;i<300;i++){ x.fillStyle='rgba(90,40,10,'+(Math.random()*.25)+')'; x.fillRect(Math.random()*S,Math.random()*S,2,2); } }),
  milk: canvasTex(128,(x,S)=>{ x.fillStyle='#f8f8ff'; x.fillRect(0,0,S,S); x.fillStyle='#2f6fe0'; x.fillRect(0,S*0.62,S,S*0.14); x.fillRect(0,S*0.18,S,6); x.fillStyle='#2f6fe0'; x.font='bold 26px Exo 2, sans-serif'; x.textAlign='center'; x.fillText('MILK',S/2,S*0.5); x.fillStyle='#1b3f8a'; x.font='bold 10px Exo 2, sans-serif'; x.fillText('VEYRA DAIRY · 1L',S/2,S*0.88); }),
  rice: canvasTex(128,(x,S)=>{ x.fillStyle='#fbf6ea'; x.fillRect(0,0,S,S); for(let i=0;i<420;i++){ x.fillStyle='rgba(230,220,200,.9)'; x.save(); x.translate(Math.random()*S,Math.random()*S); x.rotate(Math.random()*3); x.beginPath(); x.ellipse(0,0,3,1.2,0,0,6.3); x.fill(); x.restore(); } }),
  bowl: canvasTex(128,(x,S)=>{ x.fillStyle='#2a4c7a'; x.fillRect(0,0,S,S); x.fillStyle='#e9eef5'; x.fillRect(0,S*0.28,S,5); x.fillRect(0,S*0.4,S,2); x.fillStyle='#d58a3a'; x.fillRect(0,S*0.72,S,10); }),
  leaf: canvasTex(64,(x,S)=>{ x.fillStyle='#2f8f3a'; x.fillRect(0,0,S,S); x.strokeStyle='#1d5f25'; x.lineWidth=2; for(let i=0;i<6;i++){ x.beginPath(); x.moveTo(S/2,S); x.lineTo(S/2+(i-2.5)*9,0); x.stroke(); } }),
};
const fmat = (o)=>new T.MeshStandardMaterial(Object.assign({roughness:.6, metalness:0}, o));
const FOODS = {
  rice:{name:'Rice & beans', energy:30, color:'#ffe9a8', build:()=>{ const g=new T.Group();
    const bowl=new T.Mesh(new T.CylinderGeometry(.95,.55,.75,24,1,true), fmat({map:FOODTEX.bowl, side:T.DoubleSide, roughness:.3})); bowl.position.y=.38; g.add(bowl);
    const bottom=new T.Mesh(new T.CircleGeometry(.55,24), fmat({color:0x2a4c7a, roughness:.3})); bottom.rotation.x=Math.PI/2; bottom.position.y=.01; g.add(bottom);
    const rim=new T.Mesh(new T.TorusGeometry(.95,.05,8,32), fmat({color:0xe9eef5, roughness:.25})); rim.rotation.x=Math.PI/2; rim.position.y=.75; g.add(rim);
    const rice=new T.Mesh(new T.SphereGeometry(.88,24,12,0,6.3,0,1.35), fmat({map:FOODTEX.rice, roughness:.8})); rice.position.y=.35; rice.scale.y=.6; g.add(rice);
    for(let i=0;i<9;i++){ const b=new T.Mesh(new T.SphereGeometry(.12,10,8), fmat({color:0x4a2317, roughness:.35})); b.scale.set(1,.7,1.4); const a=i/9*6.28, r=rand(.15,.6); b.position.set(Math.cos(a)*r,.86+rand(0,.05),Math.sin(a)*r); b.rotation.y=rand(0,3); g.add(b); }
    const spoon=new T.Mesh(new T.CylinderGeometry(.03,.03,1.3,6), fmat({color:0xcfd4dc, metalness:.9, roughness:.2})); spoon.position.set(.5,.95,-.2); spoon.rotation.z=-.9; spoon.rotation.x=.3; g.add(spoon); return g; }},
  veg:{name:'Vegetables', energy:22, color:'#9dff8a', build:()=>{ const g=new T.Group();
    const crate=new T.Mesh(new T.BoxGeometry(1.5,.45,1.1), fmat({color:0x9a7045, roughness:.9})); crate.position.y=.22; g.add(crate);
    for(let i=0;i<2;i++){ const car=new T.Mesh(new T.ConeGeometry(.17,1.1,10), fmat({color:0xff7f1f, roughness:.5})); car.position.set(-.45+i*.25,.55,.1*i); car.rotation.z=1.35; car.rotation.y=i*.5; g.add(car); const lf=new T.Mesh(new T.ConeGeometry(.12,.35,5), fmat({color:0x2f9f3a})); lf.position.set(car.position.x+.5,.62,car.position.z); lf.rotation.z=1.35; g.add(lf); }
    const broc=new T.Mesh(new T.CylinderGeometry(.09,.13,.5,8), fmat({color:0xa8d070})); broc.position.set(.35,.6,-.2); g.add(broc); for(let i=0;i<7;i++){ const f=new T.Mesh(new T.IcosahedronGeometry(.17,1), fmat({color:0x2d7a2a, roughness:.95, flatShading:true})); f.position.set(.35+rand(-.2,.2),.85+rand(0,.12),-.2+rand(-.2,.2)); g.add(f); }
    const pep=new T.Mesh(new T.SphereGeometry(.28,16,12), fmat({color:0xe0b020, roughness:.3})); pep.scale.y=1.15; pep.position.set(.45,.68,.3); g.add(pep); const stem=new T.Mesh(new T.CylinderGeometry(.04,.05,.18,6), fmat({color:0x2f9f3a})); stem.position.set(.45,1.0,.3); g.add(stem);
    const tom=new T.Mesh(new T.SphereGeometry(.24,16,12), fmat({color:0xe8321e, roughness:.3})); tom.position.set(-.15,.62,.35); g.add(tom); return g; }},
  strawberry:{name:'Strawberries', energy:15, color:'#ff7a9a', build:()=>{ const g=new T.Group(); const basket=new T.Mesh(new T.CylinderGeometry(.75,.55,.45,8,1,true), fmat({color:0x5a8a3a, side:T.DoubleSide, roughness:.9})); basket.position.y=.22; g.add(basket);
    for(let i=0;i<5;i++){ const s2=new T.Group(); const b=new T.Mesh(new T.SphereGeometry(.3,16,14), fmat({map:FOODTEX.strawberry, roughness:.35})); b.scale.set(1,1.25,1); b.position.y=.3; s2.add(b); const tip=new T.Mesh(new T.ConeGeometry(.3,.5,16), fmat({map:FOODTEX.strawberry, roughness:.35})); tip.rotation.x=Math.PI; tip.position.y=.05; s2.add(tip);
      for(let k=0;k<5;k++){ const l=new T.Mesh(new T.ConeGeometry(.07,.28,4), fmat({color:0x2f9f3a})); const a=k/5*6.28; l.position.set(Math.cos(a)*.14,.62,Math.sin(a)*.14); l.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); s2.add(l); }
      const a=i/5*6.28; s2.position.set(Math.cos(a)*.35,.35+rand(0,.1),Math.sin(a)*.35); s2.rotation.set(rand(-.6,.6),rand(0,6),rand(-.6,.6)); s2.scale.setScalar(.85); g.add(s2); } return g; }},
  raspberry:{name:'Raspberries', energy:15, color:'#ff5da8', build:()=>{ const g=new T.Group(); const basket=new T.Mesh(new T.CylinderGeometry(.7,.5,.4,8,1,true), fmat({color:0xd9c7a8, side:T.DoubleSide, roughness:.95})); basket.position.y=.2; g.add(basket);
    for(let i=0;i<5;i++){ const c=new T.Group(); for(let j=0;j<14;j++){ const b=new T.Mesh(new T.SphereGeometry(.09,10,8), fmat({color:j%3?0xc8185e:0xe0407f, roughness:.25})); const ph=j/14*6.28*2.3, r=.17*(1-j/20); b.position.set(Math.cos(ph)*r, .1+j*.028, Math.sin(ph)*r); c.add(b); }
      const a=i/5*6.28; c.position.set(Math.cos(a)*.3,.3+rand(0,.1),Math.sin(a)*.3); c.rotation.set(rand(-.5,.5),rand(0,6),rand(-.5,.5)); g.add(c); } return g; }},
  milk:{name:'Milk', energy:20, color:'#ffffff', build:()=>{ const g=new T.Group(); const body=new T.Mesh(new T.BoxGeometry(.8,1.25,.8), fmat({map:FOODTEX.milk, roughness:.55})); body.position.y=.62; g.add(body);
    const roofG=new T.BufferGeometry(); const v=new Float32Array([-.4,1.25,-.4, .4,1.25,-.4, 0,1.7,-.4,  .4,1.25,.4, -.4,1.25,.4, 0,1.7,.4,  -.4,1.25,-.4, 0,1.7,-.4, 0,1.7,.4,  -.4,1.25,-.4, 0,1.7,.4, -.4,1.25,.4,  .4,1.25,-.4, .4,1.25,.4, 0,1.7,.4,  .4,1.25,-.4, 0,1.7,.4, 0,1.7,-.4]);
    roofG.setAttribute('position', new T.BufferAttribute(v,3)); roofG.computeVertexNormals(); g.add(new T.Mesh(roofG, fmat({color:0xf8f8ff, roughness:.55, side:T.DoubleSide})));
    const cap=new T.Mesh(new T.CylinderGeometry(.09,.09,.08,12), fmat({color:0x2f6fe0, roughness:.3})); cap.position.set(0,1.42,.25); cap.rotation.x=-.5; g.add(cap); return g; }},
  bagel:{name:'Bagels', energy:25, color:'#f5c77a', build:()=>{ const g=new T.Group(); const paper=new T.Mesh(new T.CircleGeometry(1,24), fmat({color:0xe8dcc0, roughness:1, side:T.DoubleSide})); paper.rotation.x=-Math.PI/2; paper.position.y=.02; g.add(paper);
    for(let i=0;i<3;i++){ const t=new T.Mesh(new T.TorusGeometry(.5,.24,14,28), fmat({map:FOODTEX.bagel, roughness:.75})); t.rotation.x=Math.PI/2+(i===2?.35:0); t.position.set(i===2?.2:0, .25+i*.4, i===2?-.1:0); t.rotation.z=i*.7; g.add(t); } return g; }},
  toast:{name:'Toast', energy:18, color:'#f0c08a', build:()=>{ const g=new T.Group(); const plate=new T.Mesh(new T.CylinderGeometry(1,.85,.08,28), fmat({color:0xf2f2f6, roughness:.25})); plate.position.y=.04; g.add(plate);
    for(let i=0;i<2;i++){ const sl=new T.Group(); const body=new T.Mesh(new T.BoxGeometry(1.0,1.0,.16), fmat({map:FOODTEX.toast, roughness:.9})); sl.add(body); const top=new T.Mesh(new T.CylinderGeometry(.5,.5,.16,20,1,false,0,Math.PI), fmat({map:FOODTEX.toast, roughness:.9})); top.rotation.x=Math.PI/2; top.rotation.z=0; top.position.y=.5; top.scale.set(1.0,1,.7); sl.add(top);
      const butter=new T.Mesh(new T.BoxGeometry(.3,.22,.06), fmat({color:0xffe27a, roughness:.3})); butter.position.set(0,.15,.11); sl.add(butter);
      sl.position.set(-.15+i*.3,.6,-.2+i*.25); sl.rotation.set(-.25,i*.4,0); g.add(sl); } return g; }},
};
const FOOD_KEYS = Object.keys(FOODS);
function buildDrink(){ const g=new T.Group(); const c=new T.Mesh(new T.CylinderGeometry(.42,.42,1.4,14), new T.MeshPhongMaterial({color:0x4df0e0, emissive:0x1aa89a, shininess:100})); c.position.y=.7; g.add(c); const band=new T.Mesh(new T.CylinderGeometry(.44,.44,.3,14), mat(0xff6ad5)); band.position.y=.7; g.add(band); return g; }
function buildCherry(){ const g=new T.Group(); for(let i=0;i<2;i++){const c=new T.Mesh(new T.SphereGeometry(.42,12,12), new T.MeshPhongMaterial({color:0xb3003b, emissive:0x55001c, shininess:140})); c.position.set(i*.7-.35,.45,0); g.add(c); const st=new T.Mesh(new T.CylinderGeometry(.04,.04,1.3,6), mat(0x3a8f2f)); st.position.set(i*.35-.17,1.15,0); st.rotation.z=(i?-1:1)*.35; g.add(st);} return g; }
function buildTomato(){ const g=new T.Group(); const b=new T.Mesh(new T.SphereGeometry(.55,14,12), new T.MeshPhongMaterial({color:0xe8321e, shininess:80})); b.position.y=.55; b.scale.y=.85; g.add(b); const leaf=new T.Mesh(new T.ConeGeometry(.3,.2,5), mat(0x2f9f3a)); leaf.position.y=1.05; g.add(leaf); return g; }
function itemMesh(it){
  let mesh, label;
  if(it.kind==='food'){ mesh=FOODS[it.type].build(); label=labelSprite(FOODS[it.type].name, FOODS[it.type].color); }
  else if(it.kind==='drink'){ mesh=buildDrink(); label=labelSprite('Energy drink','#4df0e0'); }
  else if(it.kind==='tomato'){ mesh=buildTomato(); label=labelSprite('Tomato (throw it!)','#ff7a5c'); }
  else { mesh=buildCherry(); label=labelSprite('Clone cherries','#ff6ad5'); }
  label.position.y=2.6; mesh.add(label); mesh.scale.setScalar(1.35);
  const col = it.kind==='food'?FOODS[it.type].color : it.kind==='drink'?'#4df0e0' : it.kind==='tomato'?'#ff5a3a' : '#ff6ad5';
  const halo = new T.Mesh(new T.RingGeometry(1.0,1.5,28), new T.MeshBasicMaterial({color:col, transparent:true, opacity:.45, side:T.DoubleSide, depthWrite:false})); halo.rotation.x=-Math.PI/2; halo.name='halo'; mesh.add(halo);
  const beam = new T.Mesh(new T.CylinderGeometry(.9,1.3,6,16,1,true), new T.MeshBasicMaterial({color:col, transparent:true, opacity:.10, side:T.DoubleSide, depthWrite:false})); beam.position.y=3; beam.name='beam'; mesh.add(beam);
  mesh.traverse(o=>{ if(o.isMesh && o!==halo && o!==beam) o.castShadow=settings.Q.shadows; });
  world.add(mesh); return mesh;
}

// GPS route line + target ring + dust + tomato projectiles
const routeGeo = new T.BufferGeometry(); routeGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(3*24),3));
const route = new T.Line(routeGeo, new T.LineDashedMaterial({color:0x4df0e0, dashSize:1.5, gapSize:1, transparent:true, opacity:.8})); scene.add(route);
const ring = new T.Mesh(new T.TorusGeometry(2.4,.15,8,32), new T.MeshBasicMaterial({color:0x4df0e0})); ring.rotation.x=Math.PI/2; scene.add(ring);
const dust = []; for(let i=0;i<40;i++){ const s=new T.Sprite(new T.SpriteMaterial({color:0xe0c39a, transparent:true, opacity:.5, depthWrite:false})); s.visible=false; scene.add(s); dust.push({s,life:0}); }
// particle pool: short-lived sprites for sparks, puffs, pickup bursts
const FX = { pool:[], shake:0, lines:null };
(function buildFX(){
  const tex=(()=>{ const c=document.createElement('canvas'); c.width=c.height=32; const x=c.getContext('2d'); const g=x.createRadialGradient(16,16,2,16,16,16); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.4,'rgba(255,255,255,.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,32,32); return new T.CanvasTexture(c); })();
  for(let i=0;i<settings.Q.particles;i++){ const sp=new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthWrite:false, blending:T.AdditiveBlending})); sp.visible=false; scene.add(sp); FX.pool.push({s:sp, life:0, max:1, vx:0, vy:0, vz:0, g:0, grow:0}); }
  // speed lines: a ring of long thin streaks around the camera, shown at high speed
  const lg=new T.BufferGeometry(); const n=60; const pos=new Float32Array(n*6); for(let i=0;i<n;i++){ const a=i/n*Math.PI*2, r=1.6+Math.random()*1.4; const x=Math.cos(a)*r, y=Math.sin(a)*r; pos.set([x,y,-2, x*1.6,y*1.6,-6], i*6); }
  lg.setAttribute('position', new T.BufferAttribute(pos,3)); FX.lines=new T.LineSegments(lg, new T.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0, depthTest:false})); FX.lines.frustumCulled=false; camera.add(FX.lines); scene.add(camera);
})();
function spawnFX(x,y,z, color, n, opts={}){ let k=0; for(const p of FX.pool){ if(k>=n) break; if(p.life>0) continue; k++;
  p.life=p.max=opts.life||0.6; p.s.visible=true; p.s.position.set(x+rand(-.3,.3),y,z+rand(-.3,.3)); p.s.material.color.set(color); p.s.material.opacity=1; const sz=opts.size||0.5; p.s.scale.set(sz,sz,1); p.grow=opts.grow||0;
  const sp=opts.speed||6; p.vx=rand(-sp,sp); p.vy=rand(opts.up||2, (opts.up||2)+sp); p.vz=rand(-sp,sp); p.g=opts.gravity===undefined?-14:opts.gravity; } }
function updateFX(dt){ for(const p of FX.pool){ if(p.life<=0) continue; p.life-=dt; if(p.life<=0){ p.s.visible=false; continue; } p.vy+=p.g*dt; p.s.position.x+=p.vx*dt; p.s.position.y+=p.vy*dt; p.s.position.z+=p.vz*dt; p.s.material.opacity=p.life/p.max; if(p.grow) p.s.scale.addScalar(p.grow*dt); } }
const tomatoPool = []; for(let i=0;i<12;i++){ const m=new T.Mesh(new T.SphereGeometry(.5,10,10), new T.MeshPhongMaterial({color:0xe8321e})); m.visible=false; scene.add(m); tomatoPool.push(m); }


// ---------- game state ----------
let G = null; // match state
let keys = {}, lastFrame = 0, paused=false;
let me = {name:'', color:BIKE_COLORS[0], hat:'none'};
try{ const s=JSON.parse(localStorage.getItem('speederRider')||'null'); if(s) me=Object.assign(me,s); }catch(e){}

function newMatch(seed, isHost){
  return { seed, isHost, len:matchLen, countdown:3.6, t:0, items:[], ents:{}, order:[], toms:[], msgs:[], over:false, standings:[], localId:null, spectate:null, sendAcc:0, running:true, elim:[] };
}
function makeEnt(spec){
  const e = Object.assign({ x:0,z:0,y:0,vy:0,heading:0,speed:0,lean:0,energy:100,alive:true,blind:0,boost:0,tomatoes:0,foodEaten:0,survived:0,hitCd:0,crashes:0,
    tx:0,tz:0,ty:0,th:0, input:{}, botTarget:null, wander:0, throwCd:3 }, spec);
  e.mesh = makeBike(e.color, e.hat, e.name, e.clone);
  G.ents[e.id]=e; G.order.push(e.id); return e;
}
function removeEnt(e){ world.remove(e.mesh); delete G.ents[e.id]; G.order = G.order.filter(i=>i!==e.id); }
function freeSpot(){
  const ents = Object.values(G.ents);
  for(let k=0;k<60;k++){ const x=rand(-HALF+20,HALF-20), z=rand(-HALF+20,HALF-20);
    if(obstacles.every(o=>Math.hypot(o.x-x,o.z-z)>o.r+3.5) && G.items.every(i=>!i.alive||Math.hypot(i.x-x,i.z-z)>12) && ents.every(e=>Math.hypot(e.x-x,e.z-z)>16)) return [x,z]; }
  return [rand(-HALF+20,HALF-20), rand(-HALF+20,HALF-20)];
}
function hostSpawnItem(kind, type){
  const [x,z]=freeSpot(); if(kind==='food') type = type || FOOD_KEYS[Math.floor(Math.random()*FOOD_KEYS.length)];
  const it={id:G.items.length, kind, type, x, z, alive:true, respawn:0, phase:Math.random()*6}; it.mesh=itemMesh(it); G.items.push(it); return it;
}
function killItem(it, delay){ it.alive=false; it.mesh.visible=false; it.respawn=delay; }
function reviveItem(it){ const [x,z]=freeSpot(); it.x=x; it.z=z; it.alive=true; it.mesh.visible=true; }
function msg(text, cls, to){ // to: entity id, 'all', or undefined (local only)
  if(to && to!=='all'){ if(to===G.localId) showMsg(text,cls); else if(G.isHost) G.msgs.push({to,text,cls}); return; }
  showMsg(text,cls); if(G.isHost && to==='all') G.msgs.push({to:'all',text,cls});
}
const ANN_RULES = [ [/^Splat!/,'TOMATO ATTACK!','bad','splat'], [/^Direct hit/,'DIRECT HIT!','good','tomato'], [/^Energy drink/,'MEGA BOOST!','boost','turbo'], [/^Cherries! A clone/,'CLONE ARMY!','good','cherry'], [/^Cherries \+15/,null,null,'cherry'],
  [/^Tomato picked up/,null,null,'tomato'], [/^COMBO x(\d+)/,'COMBO!','boost','combo'], [/^Tomato thrown/,null,null,'throwT'], [/\+\d+ energy$/,null,null,'pickup'], [/^One minute left/,'FINAL MINUTE!','bad','warn'], [/^10 seconds/,'10 SECONDS!','bad','warn'], [/lost connection|left the race/,null,null,null] ];
function showMsg(text, cls){ for(const [re,big,bc,snd] of ANN_RULES){ if(re.test(text)){ if(big) announce(big, bc, text); if(snd) SFX.play(snd); break; } }
  if(/is out of energy!$/.test(text)){ const who=text.replace(' is out of energy!',''); announce(who.toUpperCase()+' IS OUT', 'bad'); SFX.play('out'); }
  const d=document.createElement('div'); d.className='msg '+(cls||''); d.textContent=text; const box=$('msgs'); box.appendChild(d); while(box.children.length>3) box.removeChild(box.firstChild); setTimeout(()=>{ if(d.parentNode) d.remove(); }, 3200); }
function announce(text, cls, sub){ const box=$('announce'); const d=document.createElement('div'); d.className='ann '+(cls||''); d.textContent=text; if(sub){ const sm=document.createElement('small'); sm.textContent=sub; d.appendChild(sm); } box.appendChild(d); while(box.children.length>2) box.removeChild(box.firstChild); setTimeout(()=>{ if(d.parentNode) d.remove(); }, 2100); }
function flash(){ const f=$('flash'); f.style.opacity=.35; setTimeout(()=>f.style.opacity=0, 60); }
const aliveRiders = ()=> Object.values(G.ents).filter(e=>e.alive && !e.clone);
const humansAlive = ()=> aliveRiders().filter(e=>!e.bot);

// ---------- physics for a human-controlled rider ----------
function movePhysics(e, inp, dt){
  const boosting = e.boost>0, maxS = boosting ? 56 : 28;
  if(e.y>0.001){ /* airborne: hold speed */ } else if(inp.fwd) e.speed += (boosting?60:34)*dt; else if(inp.back) e.speed -= 40*dt; else e.speed *= Math.max(0, 1-1.6*dt);
  e.speed = T.MathUtils.clamp(e.speed, -10, e.y>0.001 ? Math.max(maxS, e.speed) : maxS);
  const turnIn = inp.turn !== undefined ? inp.turn : (inp.left?1:0)-(inp.right?1:0);
  e.heading += turnIn*2.3*dt*Math.min(1, 0.35+Math.abs(e.speed)/14)*(e.speed>=0?1:-1);
  e.lean += (turnIn*0.38*Math.min(1,Math.abs(e.speed)/10) - e.lean)*Math.min(1,8*dt);
  const grounded = e.y<=0.001 && e.vy<=0;
  if(inp.jump && grounded){ const flip = !!inp.flip; e.vy = flip ? 19 : 14; e.jumpedOver={}; e.flipping=flip; e.flipA=0; e.airT=0; e.flipStart=0;
    if(e.speed>4) e.speed = Math.min(e.boost>0?60:34, e.speed + (flip?7:4));                 // a jump launches you forward
    e.jumpCost = (e.jumpCost||0) + (flip?5:2);                                                // and burns energy
    if(e.id===G.localId){ SFX.play(flip?'flip':'jump'); if(flip) announce('BACKFLIP!','boost','-5 energy'); else showMsg('Jump -2 energy','boost'); } }
  else if(inp.jump && !grounded && !e.flipping && (e.airT||0)<0.45 && e.vy>0){ // second tap right after takeoff: upgrade into a backflip
    e.vy = Math.max(e.vy, 19 - 24*(e.airT||0)); e.flipping=true; e.flipA=0; e.flipStart=e.airT||0; e.speed=Math.min(e.boost>0?60:34, e.speed+3); e.jumpCost=(e.jumpCost||0)+3;
    if(e.id===G.localId){ SFX.play('flip'); announce('BACKFLIP!','boost','-5 energy'); } }
  if(!grounded){ e.airT=(e.airT||0)+dt; }
  if(e.flipping){ const st=e.flipStart||0; const total = Math.max(0.6, 2*19/24 - st); e.flipA = Math.min(1, ((e.airT||0)-st)/total); if(grounded && e.airT>0.2){ e.flipping=false; e.flipA=0; e.flipStart=0; } }
  e.vy -= 24*dt; e.y += e.vy*dt; if(e.y<0){ e.y=0; e.vy=0; }
  e.x += Math.sin(e.heading)*e.speed*dt; e.z += Math.cos(e.heading)*e.speed*dt;
  const lim=HALF-10;
  if(Math.abs(e.x)>lim||Math.abs(e.z)>lim){ e.x=T.MathUtils.clamp(e.x,-lim,lim); e.z=T.MathUtils.clamp(e.z,-lim,lim); e.speed*=-0.3; if(e.id===G.localId && e.hitCd<=0){ showMsg('Edge of the scan zone. Turn back.','bad'); e.hitCd=1; } }
  if(e.hitCd>0) e.hitCd-=dt;
  for(const o of obstacles){ const dx=e.x-o.x, dz=e.z-o.z, d=Math.hypot(dx,dz)||0.01; const rr=o.r+1.2;
    if(d<rr && e.y>=o.h && o.h<90 && e.jumpedOver && !e.jumpedOver[o.x]){ e.jumpedOver[o.x]=1; e.closeCalls=(e.closeCalls||0)+1; if(e.id===G.localId){ announce('CLOSE CALL!','good','+3 energy'); SFX.play('close'); spawnFX(e.x, terrainH(e.x,e.z)+o.h, e.z, 0x7cff8a, 10, {speed:4, up:2, size:.4, gravity:-4}); } }
    if(d<rr && e.y<o.h){ e.x=o.x+dx/d*rr; e.z=o.z+dz/d*rr; e.speed*=-0.45;
      if(e.hitCd<=0){ e.hitCd=.6; e.crashes++; spawnFX(e.x, terrainH(e.x,e.z)+1, e.z, 0xffc266, 18, {speed:9, up:3, size:.35}); if(e.id===G.localId){ flash(); FX.shake=1.2; SFX.play('crash'); showMsg('Crash! -8 energy','bad'); } } } }
}
// ---------- bot / clone AI ----------
function nearestItem(x,z,pred){ let b=null, bd=1e9; for(const it of G.items){ if(!it.alive||!pred(it)) continue; const d=Math.hypot(it.x-x,it.z-z); if(d<bd){bd=d;b=it;} } return [b,bd]; }
function steerAvoid(e){ const dx=Math.sin(e.heading), dz=Math.cos(e.heading); let push=0;
  for(const o of obstacles){ const ox=o.x-e.x, oz=o.z-e.z; const fwd=ox*dx+oz*dz; if(fwd<0||fwd>14) continue; const lat=ox*dz-oz*dx; if(Math.abs(lat)<o.r+2.4) push += (lat>0?-1:1)*(1-fwd/14); } return push; }
function botUpdate(e, dt){
  let target=null, desired=e.heading;
  if(e.blind>0){ e.wander += (Math.random()-.5)*dt*3; desired = e.heading + e.wander*0.2; }
  else {
    const wantFood = e.clone || e.energy<75 || e.tomatoes>=3;
    [target] = nearestItem(e.x,e.z, it=> it.kind==='food' ? wantFood : it.kind==='tomato' ? (!e.clone && e.tomatoes<3) : it.kind==='drink' ? !e.clone : false);
    if(!target) [target] = nearestItem(e.x,e.z, it=>it.kind==='food');
    if(target) desired = Math.atan2(target.x-e.x, target.z-e.z);
  }
  let diff = Math.atan2(Math.sin(desired-e.heading), Math.cos(desired-e.heading));
  const avoid = steerAvoid(e); if(Math.abs(avoid)>0.01) diff = avoid*2.2;
  const turn = T.MathUtils.clamp(diff, -2.6*dt, 2.6*dt); e.heading += turn;
  const maxS = (e.clone ? 23 : 19 + Math.min(7, G.t*0.05)) * (e.boost>0?1.8:1);
  e.speed += (maxS - e.speed)*Math.min(1, 1.5*dt); if(Math.abs(diff)>1.2) e.speed *= 0.97;
  e.x += Math.sin(e.heading)*e.speed*dt; e.z += Math.cos(e.heading)*e.speed*dt;
  e.x = T.MathUtils.clamp(e.x,-HALF+8,HALF-8); e.z = T.MathUtils.clamp(e.z,-HALF+8,HALF-8);
  for(const o of obstacles){ const dx=e.x-o.x, dz=e.z-o.z, d=Math.hypot(dx,dz)||0.01; if(d<o.r+1.1){ e.x=o.x+dx/d*(o.r+1.1); e.z=o.z+dz/d*(o.r+1.1); e.speed*=0.5; } }
  e.lean += (-turn/dt*0.12 - e.lean)*Math.min(1,6*dt);
  // bots throw tomatoes at whoever is close
  if(!e.clone && e.tomatoes>0){ e.throwCd-=dt; if(e.throwCd<=0){ e.throwCd=rand(2,5); if(Math.random()<0.5) hostThrow(e); } }
}

// ---------- host simulation ----------
function hostThrow(e){
  let best=null, bd=45;
  for(const o of Object.values(G.ents)){ if(o===e||!o.alive||o.clone) continue; const d=Math.hypot(o.x-e.x,o.z-e.z); if(d<bd){bd=d;best=o;} }
  if(!best){ msg('No rider in range for a tomato', 'bad', e.id); return; }
  e.tomatoes--; G.toms.push({x:e.x, y:terrainH(e.x,e.z)+2, z:e.z, target:best.id, from:e.id, life:4});
  msg('Tomato thrown at '+best.name+'!', 'good', e.id);
}
function hostPickup(e, it){
  if(!it.alive) return; const owner = e.clone ? G.ents[e.owner] : e; if(!owner) return;
  spawnFX(it.x, terrainH(it.x,it.z)+1.2, it.z, it.kind==='food'?FOODS[it.type].color:it.kind==='drink'?0x4df0e0:it.kind==='tomato'?0xff5a3a:0xff6ad5, 16, {speed:5, up:3, size:.5, gravity:-6});
  if(it.kind==='food'){ const f=FOODS[it.type]; let gain=f.energy; if(!e.clone){ owner.combo = (owner.comboT>0) ? (owner.combo||0)+1 : 1; owner.comboT=5; if(owner.combo>=2){ gain+=owner.combo*2; msg('COMBO x'+owner.combo+'! +'+(owner.combo*2)+' bonus','good',owner.id); if(owner.combo>=5 && owner.id===G.localId) unlock('combo5'); } }
    owner.energy=Math.min(100,owner.energy+gain); owner.foodEaten++;
    msg((e.clone?'Clone brought back ':'')+f.name+' +'+f.energy+' energy', 'good', owner.id); killItem(it, 3); }
  else if(e.clone) return;
  else if(it.kind==='drink'){ e.boost=8; msg('Energy drink! Double speed for 8s','boost',e.id); killItem(it, 30); }
  else if(it.kind==='tomato'){ if(e.tomatoes>=3) return; e.tomatoes++; msg('Tomato picked up. Throw it with F or the tomato button','good',e.id); killItem(it, 20); }
  else { const clones=Object.values(G.ents).filter(c=>c.clone&&c.owner===e.id).length;
    if(clones<2 && !e.bot){ makeEnt({id:'c'+Math.floor(Math.random()*1e6), name:e.name+"'s clone", color:'#7cff8a', hat:e.hat, bot:true, clone:true, owner:e.id, x:e.x-Math.sin(e.heading)*4, z:e.z-Math.cos(e.heading)*4, heading:e.heading}); msg('Cherries! A clone joins you and gathers food','good',e.id); }
    else { e.energy=Math.min(100,e.energy+15); msg('Cherries +15 energy','good',e.id); } killItem(it, 50); }
}
function hostSim(dt){
  G.t += dt;
  for(const id of G.order){ const e=G.ents[id]; if(!e||!e.alive) continue;
    if(e.bot) botUpdate(e, dt);
    else if(id===G.localId) movePhysics(e, keys2input(), dt);
    // crash damage reported by clients and local alike
    if(e.crashes>0){ e.energy -= 8*e.crashes; e.crashes=0; }
    if(e.closeCalls>0){ e.energy=Math.min(100,e.energy+3*e.closeCalls); e.closeCalls=0; }
    if(e.jumpCost>0){ e.energy -= e.jumpCost; e.jumpCost=0; }
    if(e.comboT>0){ e.comboT-=dt; if(e.comboT<=0) e.combo=0; }
    if(e.boost>0) e.boost-=dt; if(e.blind>0) e.blind-=dt;
    if(e.clone) e.y = 0;
    // pickups: bots, clones and the host's own rider are checked here; remote riders report their own pickups
    if(e.bot || e.id===G.localId) for(const it of G.items){ if(it.alive && e.y<2.5 && Math.hypot(it.x-e.x, it.z-e.z)<2.8) hostPickup(e, it); }
    if(e.clone) continue;
    const lenK = 300/G.len; e.energy -= (2.0 + G.t*0.014*lenK)*lenK*(e.boost>0?1.4:1)*(G.t>G.len-Math.min(60,G.len*0.2) ? 2.2 : 1)*dt; e.survived = G.t;
    if(e.energy<=0){ e.energy=0; e.alive=false; G.elim.unshift(e.id); msg(e.name+' is out of energy!', 'bad', 'all');
      for(const c of Object.values(G.ents)) if(c.clone&&c.owner===e.id) c.alive=false; }
  }
  // soft bumps bots vs others
  const list=Object.values(G.ents).filter(e=>e.alive);
  for(const a of list) for(const b of list){ if(a===b||!a.bot) continue; const dx=a.x-b.x, dz=a.z-b.z, d=Math.hypot(dx,dz); if(d<2.6&&d>0.01){ const p=(2.6-d)/2; a.x+=dx/d*p; a.z+=dz/d*p; if(b.bot){ b.x-=dx/d*p; b.z-=dz/d*p; } } }
  // items respawn & tomatoes
  for(const it of G.items){ if(!it.alive){ it.respawn-=dt; if(it.respawn<=0) reviveItem(it); } }
  for(const tm of G.toms){ const tg=G.ents[tm.target]; tm.life-=dt; if(!tg||!tg.alive||tm.life<=0){ tm.done=true; continue; }
    const ty=terrainH(tg.x,tg.z)+1.5+tg.y, dx=tg.x-tm.x, dy=ty-tm.y, dz=tg.z-tm.z, d=Math.hypot(dx,dy,dz);
    if(d<1.6){ tm.done=true; tg.blind=10; spawnFX(tm.x,tm.y,tm.z,0xe8321e,24,{speed:7,up:3,size:.7,gravity:-10}); if(tg.id===G.localId) FX.shake=1; msg('Splat! '+(G.ents[tm.from]||{name:'Someone'}).name+' hit you. GPS jammed 10s','bad',tg.id); msg('Direct hit on '+tg.name+'!','good',tm.from); if(tm.from===G.localId){ BEST.hits++; saveBest(); } continue; }
    const s=Math.min(d, 46*dt); tm.x+=dx/d*s; tm.y+=dy/d*s+Math.sin(tm.life*4)*dt*2; tm.z+=dz/d*s; }
  G.toms = G.toms.filter(t=>!t.done);
  // supply warnings as the 5-minute clock runs down
  const left = G.len - G.t;
  if(left<Math.min(60,G.len*0.2) && !G.warned60){ G.warned60=true; msg('One minute left! Food is running out','bad','all'); }
  if(left<10 && !G.warned10){ G.warned10=true; msg('10 seconds! Highest energy wins','bad','all'); }
  // win check: last rider alive, or time up (remaining riders ranked by energy)
  const alive = aliveRiders();
  if((alive.length<=1 || left<=0) && !G.over){ G.over=true; const rest=alive.slice().sort((a,b)=>a.energy-b.energy); for(const r of rest){ r.survived=G.t; G.elim.unshift(r.id); } G.standings=G.elim.map(id=>({id, name:G.ents[id].name, bot:!!G.ents[id].bot, t:Math.floor(G.ents[id].survived)}));
    if(net.host) net.broadcast({t:'over', standings:G.standings}); showOver(); }
}
function keys2input(){
  const j=jumpReq.jump, fl=jumpReq.flip; jumpReq.jump=false; jumpReq.flip=false;
  if(isTouch) return {fwd:!touch.brake, back:touch.brake, turn:touch.steer, jump:j, flip:fl};
  return {fwd:keys['w']||keys['arrowup'], back:keys['s']||keys['arrowdown'], left:keys['a']||keys['arrowleft'], right:keys['d']||keys['arrowright'], jump:j, flip:fl}; }

// ---------- snapshots ----------
function snapshot(){
  return { t:'snap', gt:G.t, ents:G.order.map(id=>{ const e=G.ents[id]; return {id, n:e.name, c:e.color, ht:e.hat, bot:e.bot?1:0, cl:e.clone?1:0, ow:e.owner, x:+e.x.toFixed(2), z:+e.z.toFixed(2), y:+e.y.toFixed(2), h:+e.heading.toFixed(3), s:+e.speed.toFixed(1), l:+e.lean.toFixed(2), e:Math.round(e.energy), a:e.alive?1:0, b:+e.blind.toFixed(1), bo:+e.boost.toFixed(1), tm:e.tomatoes, f:e.foodEaten, fa:+(e.flipping?e.flipA:(e.rflip||0)).toFixed(2)}; }),
    items:G.items.map(it=>[it.alive?1:0, +it.x.toFixed(1), +it.z.toFixed(1)]), toms:G.toms.map(tm=>[+tm.x.toFixed(1),+tm.y.toFixed(1),+tm.z.toFixed(1)]), msgs:G.msgs.splice(0) };
}
function applySnapshot(s, forId){
  G.t = s.gt; const seen = new Set();
  for(const d of s.ents){ seen.add(d.id); let e=G.ents[d.id];
    if(!e) e = makeEnt({id:d.id, name:d.n, color:d.c, hat:d.ht, bot:!!d.bot, clone:!!d.cl, owner:d.ow, x:d.x, z:d.z, heading:d.h});
    Object.assign(e, {energy:d.e, alive:!!d.a, blind:d.b, boost:d.bo, tomatoes:d.tm, foodEaten:d.f});
    if(d.id!==forId){ e.tx=d.x; e.tz=d.z; e.ty=d.y; e.th=d.h; e.speed=d.s; e.lean=d.l; e.rflip=d.fa||0; }
    if(!e.alive) e.mesh.visible=false;
  }
  for(const id of [...G.order]) if(!seen.has(id)) removeEnt(G.ents[id]);
  s.items.forEach((a,i)=>{ const it=G.items[i]; if(!it) return; const wasAlive=it.alive; it.alive=!!a[0]; it.x=a[1]; it.z=a[2]; it.mesh.visible=it.alive; });
  G.toms = s.toms.map(a=>({x:a[0],y:a[1],z:a[2]}));
  for(const m of s.msgs) if(m.to==='all'||m.to===forId) showMsg(m.text, m.cls);
}

// ---------- networking (public MQTT relay over WebSocket, host-authoritative) ----------
const net = { host:false, online:false, client:null, code:'', myId:null, lobby:[], nextId:1, seen:{}, lastSnap:0 };
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081'];
const topic = (code, sub) => 'speeder-forager/veyra9/'+code+'/'+sub;
function randomCode(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ'; let s=''; for(let i=0;i<4;i++) s+=A[Math.floor(Math.random()*A.length)]; return s; }
function peerFail(err){ $('startErr').textContent = 'Online play failed: '+(err&&err.type||'connection blocked')+'. Solo mode still works.'; $('hostBtn').disabled=$('joinBtn').disabled=false; closeNet(); }
function closeNet(){ if(net.client){ try{ net.client.end(true); }catch(e){} } net.client=null; net.online=false; net.host=false; net.lobby=[]; net.seen={}; }
function connectBroker(onReady){
  let i=0;
  function tryNext(){
    if(i>=BROKERS.length){ peerFail({type:'could not reach any relay server'}); return; }
    const url=BROKERS[i++]; $('startErr').textContent='Connecting to relay '+i+' of '+BROKERS.length+'...';
    let c; try{ c=mqttLib().connect(url, {connectTimeout:7000, reconnectPeriod:2000, keepalive:20, clean:true}); }catch(e){ tryNext(); return; }
    let ok=false;
    c.on('connect', ()=>{ if(ok) return; ok=true; net.client=c; $('startErr').textContent=''; onReady(c); });
    c.on('error', ()=>{ if(!ok){ try{ c.end(true); }catch(e){} tryNext(); } });
    c.on('close', ()=>{ if(!ok){ /* handled by error/timeout */ } else if(G && !G.over) showMsg('Relay connection dropped, reconnecting...','bad'); });
    setTimeout(()=>{ if(!ok){ try{ c.end(true); }catch(e){} tryNext(); } }, 8000);
  }
  tryNext();
}
function publish(sub, m){ if(!net.client) return; try{ net.client.publish(topic(net.code, sub), JSON.stringify(m), {qos:0}); }catch(e){} }
net.broadcast = m => publish('all', m);
net.sendTo = (id, m) => publish('c/'+id, m);
net.sendHost = m => publish('h', Object.assign({from:net.myId}, m));
function hostRoom(){
  const code=randomCode(); $('hostBtn').disabled=$('joinBtn').disabled=true;
  if(!mqttLib()){ peerFail({type:'relay library blocked on this page'}); return; }
  net.code=code; net.host=true; net.online=true; net.myId='p0'; net.lobby=[{id:'p0', name:me.name, color:me.color, hat:me.hat}];
  connectBroker(c=>{
    c.subscribe(topic(code,'h'), {qos:0});
    c.on('message', (tp, payload)=>{ let d; try{ d=JSON.parse(payload.toString()); }catch(e){ return; } if(d && d.from) hostOnMsg(d); });
    showRoom(code);
    net.pingTimer = setInterval(()=>{ // drop riders who went quiet
      const now=performance.now(); for(const id in net.seen){ if(now-net.seen[id]>9000){ delete net.seen[id]; net.lobby=net.lobby.filter(p=>p.id!==id);
        if(G && G.ents[id] && G.ents[id].alive){ G.ents[id].alive=false; msg(G.ents[id].name+' lost connection','bad','all'); } else renderLobby(); net.broadcast({t:'lobby', players:net.lobby, code:net.code}); } }
      if(!G) net.broadcast({t:'lobby', players:net.lobby, code:net.code});
    }, 2000);
  });
}
function joinRoom(code){
  $('hostBtn').disabled=$('joinBtn').disabled=true;
  if(!mqttLib()){ peerFail({type:'relay library blocked on this page'}); return; }
  net.code=code; net.host=false; net.online=true; net.myId='p'+Math.random().toString(36).slice(2,8);
  connectBroker(c=>{
    c.subscribe([topic(code,'all'), topic(code,'c/'+net.myId)], {qos:0});
    c.on('message', (tp, payload)=>{ let d; try{ d=JSON.parse(payload.toString()); }catch(e){ return; } clientOnMsg(d); });
    $('startErr').textContent='Relay connected. Looking for room '+code+'...';
    let tries=0; net.joinTimer=setInterval(()=>{ if(net.welcomed){ clearInterval(net.joinTimer); return; } if(++tries>8){ clearInterval(net.joinTimer); peerFail({type:'no open room with code '+code+'. Check the code and make sure the host is still on the lobby screen'}); return; }
      net.sendHost({t:'join', name:me.name, color:me.color, hat:me.hat}); }, 1000);
    net.sendHost({t:'join', name:me.name, color:me.color, hat:me.hat});
    net.hbTimer=setInterval(()=>{ if(net.welcomed && net.online){ net.sendHost({t:'hb'});
      if(G && !G.over && performance.now()-net.lastSnap>4000){ showMsg('Reconnecting to the host...','bad'); net.lastSnap=performance.now();
        try{ c.subscribe([topic(code,'all'), topic(code,'c/'+net.myId)], {qos:0}); if(!c.connected) c.reconnect(); }catch(e){} } } }, 2000);
  });
}
function hostOnMsg(d){
  const id=d.from; net.seen[id]=performance.now();
  if(d.t==='join'){ if(net.lobby.some(p=>p.id===id)){ net.sendTo(id,{t:'welcome', id, code:net.code}); return; }
    if(net.lobby.length>=MAX_PLAYERS || G){ net.sendTo(id,{t:'full'}); return; }
    net.lobby.push({id, name:(d.name||'Rider').slice(0,14), color:d.color, hat:d.hat}); net.sendTo(id,{t:'welcome', id, code:net.code}); net.broadcast({t:'lobby', players:net.lobby, code:net.code}); renderLobby(); return; }
  if(!G) return; const e=G.ents[id]; if(!e) return;
  if(d.t==='in'){ if(e.alive){ e.x=e.tx=d.x; e.z=e.tz=d.z; e.y=e.ty=d.y; e.heading=e.th=d.h; e.speed=d.s; e.lean=d.l; e.crashes+=d.cr||0; e.closeCalls=(e.closeCalls||0)+(d.cc||0); e.jumpCost=(e.jumpCost||0)+(d.jc||0); e.rflip=d.fa||0; } }
  else if(d.t==='throw'){ if(e.alive && e.tomatoes>0) hostThrow(e); }
  else if(d.t==='take'){ const it=G.items[d.i]; if(e.alive && it && it.alive && Math.hypot(it.x-e.x,it.z-e.z)<14) hostPickup(e, it); }
}
function clientOnMsg(d){
  if(d.t==='welcome'){ net.welcomed=true; $('startErr').textContent=''; showRoom(d.code||net.code); }
  else if(d.t==='full'){ if(!net.welcomed) peerFail({type:'room is full or already racing'}); }
  else if(d.t==='lobby'){ if(!net.welcomed) return; net.lobby=d.players; if(!G) showRoom(d.code||net.code); renderLobby(); }
  else if(d.t==='start'){ if(net.welcomed){ net.lastSnap=performance.now(); startMatch(d.seed, false, d.players, d.items, d.len); } }
  else if(d.t==='snap'){ if(G){ net.lastSnap=performance.now(); applySnapshot(d, G.localId); } }
  else if(d.t==='over'){ if(G){ G.over=true; G.standings=d.standings; showOver(); } }
}

// ---------- lobby UI ----------
function showRoom(code){ $('start').style.display='none'; $('room').style.display='flex'; $('roomCode').textContent=code; net.code=code; $('roomLink').textContent = net.host ? 'Invite link: '+roomLinkFor(code) : ''; $('copyLink').style.display = net.host?'inline-block':'none';
  $('startBtn').style.display = net.host?'inline-block':'none'; $('roomNote').textContent = net.host?'':'Waiting for the host to start...'; renderLobby(); }
function renderLobby(){ const box=$('plist'); box.innerHTML='';
  const list=[...net.lobby]; while(list.length<MAX_PLAYERS) list.push({bot:true, name:'Bot seat', color:'#555'});
  for(const p of list){ const d=document.createElement('div'); d.className='pl'; d.innerHTML='<i style="background:'+p.color+'"></i>'+(p.bot?'<small>Bot seat</small>':'<span></span>'); if(!p.bot){ d.querySelector('span').textContent=p.name+(p.id==='p0'?' (host)':''); } box.appendChild(d); }
}
function leaveRoom(){ clearInterval(net.pingTimer); clearInterval(net.joinTimer); clearInterval(net.hbTimer); net.welcomed=false; closeNet();
  $('room').style.display='none'; $('start').style.display='flex'; $('hostBtn').disabled=$('joinBtn').disabled=false; }

// ---------- match start / end ----------
function clearWorld(){ while(world.children.length) world.remove(world.children[0]); }
function startMatch(seed, isHost, players, itemList, len){
  if(len) matchLen=len;
  clearWorld(); setSeed(seed); buildObstacles(); G=newMatch(seed,isHost); paused=false; $('msgs').innerHTML='';
  $('room').style.display='none'; $('start').style.display='none'; $('over').style.display='none';
  const spots=[]; for(let i=0;i<MAX_PLAYERS;i++){ const a=i/MAX_PLAYERS*Math.PI*2; spots.push([Math.cos(a)*18, Math.sin(a)*18, a+Math.PI]); }
  players.forEach((p,i)=>{ const s=spots[i]; makeEnt({id:p.id, name:p.name, color:p.color, hat:p.hat, bot:!!p.bot, x:s[0], z:s[1], heading:Math.atan2(-s[0],-s[1])+Math.PI}); });
  G.localId = isHost ? 'p0' : net.myId;
  if(isHost){ for(let i=0;i<18;i++) hostSpawnItem('food', FOOD_KEYS[i%FOOD_KEYS.length]); hostSpawnItem('drink'); hostSpawnItem('drink'); hostSpawnItem('cherry'); for(let i=0;i<4;i++) hostSpawnItem('tomato');
    if(net.online) net.broadcast({t:'start', seed, players, len:matchLen, items:G.items.map(it=>({kind:it.kind,type:it.type,x:it.x,z:it.z}))}); }
  else { itemList.forEach((it,i)=>{ const o={id:i, kind:it.kind, type:it.type, x:it.x, z:it.z, alive:true, phase:Math.random()*6}; o.mesh=itemMesh(o); G.items.push(o); }); }
  lastFrame=performance.now(); document.body.classList.add('playing'); unlockAudio(); SFX.engineState(0,false,false); $('countdown').innerHTML='';
}
function buildPlayerList(){
  const used=new Set(net.lobby.map(p=>p.name)); const list=net.lobby.map(p=>Object.assign({},p));
  const names=BOT_NAMES.filter(n=>!used.has(n)); const hats=Object.keys(HATS);
  for(let i=list.length;i<MAX_PLAYERS;i++) list.push({id:'b'+i, name:names[i%names.length], color:BIKE_COLORS[(i*3+1)%BIKE_COLORS.length], hat:hats[Math.floor(Math.random()*hats.length)], bot:true});
  return list;
}
function fireworks(){ const box=$('confetti'); box.style.display='block'; box.innerHTML=''; const cols=['#ff6ad5','#4df0e0','#ffe066','#7cff8a','#ffffff'];
  for(let i=0;i<120;i++){ const d=document.createElement('i'); d.style.left=Math.random()*100+'vw'; d.style.background=cols[i%cols.length]; d.style.animationDuration=(2+Math.random()*2.5)+'s'; d.style.animationDelay=(Math.random()*1.5)+'s'; d.style.transform='rotate('+Math.random()*360+'deg)'; box.appendChild(d); }
  let n=0; const iv=setInterval(()=>{ const meE=G&&G.ents[G.localId]; const x=(meE?meE.x:0)+rand(-15,15), z=(meE?meE.z:0)+rand(-15,15); spawnFX(x, terrainH(x,z)+8+rand(0,8), z, ['#ff6ad5','#4df0e0','#ffe066','#7cff8a'][n%4], 26, {speed:9, up:0, size:.8, gravity:-5, life:1.3}); SFX.play('firework'); if(++n>8){ clearInterval(iv); } }, 450);
  setTimeout(()=>{ box.style.display='none'; }, 6000); }
function showOver(){
  const meE=G.ents[G.localId]; const place=G.standings.findIndex(s=>s.id===G.localId)+1; const winner=G.standings[0];
  $('overTitle').textContent = place===1 ? 'YOU WIN!' : (winner? winner.name+' wins' : 'Race over'); $('overTitle').className = place===1?'win':'';
  $('overSub').textContent = place===1 ? 'Last rider standing on Veyra-9!' : 'You placed #'+place+' of '+G.standings.length+'.';
  SFX.setMood(0); SFX.engineState(0,false,false); $('lowE').classList.remove('show'); $('splat').style.display='none';
  if(place===1){ SFX.play('win'); fireworks(); } else SFX.play('lose');
  BEST.races++; if(meE){ BEST.time=Math.max(BEST.time, Math.floor(meE.survived)); if(place===1) BEST.wins++; } saveBest(); renderBests();
  unlock('first'); if(place===1) unlock('win'); if(meE && meE.survived>=299) unlock('five'); if(BEST.hits>=10) unlock('sniper');
  $('achs').innerHTML = Object.keys(BEST.ach).map(k=>'<span class="ach">🏆 '+ACH[k]+'</span>').join('');
  $('oTime').textContent=Math.floor(meE?meE.survived:0)+'s'; $('oFood').textContent=meE?meE.foodEaten:0; $('oPlace').textContent='#'+place;
  const ol=$('standings'); ol.innerHTML=''; G.standings.forEach((s,i)=>{ const li=document.createElement('li'); li.innerHTML=(i===0?'<b></b>':'<span></span>')+' <small style="color:var(--dim)"></small>'; li.firstChild.textContent=s.name+(s.id===G.localId?' (you)':''); li.lastChild.textContent=(s.bot?'bot · ':'')+s.t+'s'; ol.appendChild(li); });
  $('over').style.display='flex'; G.running=false; document.body.classList.remove('playing');
}

// ---------- rendering ----------
function renderEnts(dt){
  for(const id of G.order){ const e=G.ents[id]; if(!e) continue; e.mesh.visible=e.alive;
    if(!e.alive) continue;
    if(id!==G.localId && !(G.isHost && e.bot)){ // remote rider: ease toward last known state
      const k=Math.min(1,12*dt); e.x+=(e.tx-e.x)*k; e.z+=(e.tz-e.z)*k; e.y+=(e.ty-e.y)*k; e.heading+=Math.atan2(Math.sin(e.th-e.heading),Math.cos(e.th-e.heading))*k; }
    const ground=terrainH(e.x,e.z), hover=0.9+Math.sin(G.t*7+e.x)*0.06;
    e.mesh.position.set(e.x, ground+hover+e.y, e.z);
    const fa = e.flipping ? e.flipA : (e.rflip||0); const flipX = fa>0 && fa<1 ? -fa*Math.PI*2 : 0;
    e.mesh.rotation.set(flipX || (e.y>0? -e.vy*0.03 : e.speed*-0.004), e.heading, -e.lean);
    e.mesh.getObjectByName('shadow').position.y = -(hover+e.y)+0.06;
    const spd=Math.min(1,Math.abs(e.speed)/28), ud=e.mesh.userData;
    if(ud.rotors) for(const r of ud.rotors) r.rotation.z += dt*(6+spd*40+(e.boost>0?30:0));
    if(ud.exhaust) for(const x of ud.exhaust){ const L=0.4+spd*1.6+(e.boost>0?1.6:0); x.scale.set(1+ (e.boost>0?.4:0), L, 1); x.position.z=-2.4-L*0.7; x.material.color.setHex(e.boost>0?0xff6ad5:(e.clone?0x7cff8a:0x4df0e0)); x.material.opacity=.35+spd*.4; }
    const under=e.mesh.getObjectByName('under'); if(under){ under.material.opacity=.10+Math.sin(G.t*9+e.x)*.04; under.position.y=-(hover+e.y)+0.12; under.scale.setScalar(1+e.y*0.25); }
    const lab=e.mesh.getObjectByName('label'); if(lab) lab.visible = id!==G.localId;
    if(e.blind>0 && Math.floor(G.t*6)%2===0) e.mesh.rotation.z += 0.08; // wobble while blinded
  }
  for(const it of G.items){ if(!it.alive) continue; const bob=Math.sin(G.t*2.5+it.phase); it.mesh.position.set(it.x, terrainH(it.x,it.z)+0.7+bob*0.25, it.z); it.mesh.rotation.y += dt*1.2;
    const halo=it.mesh.getObjectByName('halo'); if(halo){ halo.position.y=-(0.1+bob*0.18); halo.scale.setScalar(1+Math.sin(G.t*4+it.phase)*0.12); halo.rotation.z += dt; } }
  for(const o of obstacles) if(o.mesh){ o.mesh.children[1].rotation.z += dt*0.8; o.mesh.children[2].rotation.z -= dt*0.5; }
  tomatoPool.forEach((m,i)=>{ const tm=G.toms[i]; m.visible=!!tm; if(tm) m.position.set(tm.x,tm.y,tm.z); });
}
function updateCamera(dt, e){
  const ground=terrainH(e.x,e.z);
  sun.target.position.set(e.x, 0, e.z); sun.position.set(e.x+sunDir.x*160, Math.max(60,sunDir.y*180), e.z+sunDir.z*160);
  const camBack = 9.5 + Math.abs(e.speed)*0.14, up = 3.6 + e.y*0.5;
  const cx = e.x - Math.sin(e.heading)*camBack, cz = e.z - Math.cos(e.heading)*camBack;
  const cy = Math.max(terrainH(cx,cz)+2.2, ground+up);
  camera.position.lerp(new T.Vector3(cx,cy,cz), Math.min(1, 5*dt));
  const spdN=Math.min(1,Math.abs(e.speed)/28);
  if(FX.shake>0){ FX.shake=Math.max(0,FX.shake-dt*2.5); camera.position.x+=rand(-1,1)*FX.shake*0.35; camera.position.y+=rand(-1,1)*FX.shake*0.3; }
  if(e.boost>0) { camera.position.x+=rand(-1,1)*0.04; camera.position.y+=rand(-1,1)*0.04; }
  camera.lookAt(e.x+Math.sin(e.heading)*4, ground+1.4+e.y*0.6, e.z+Math.cos(e.heading)*4);
  const tf = (e.boost>0? 86 : 68) + spdN*8; camera.fov += (tf-camera.fov)*Math.min(1,4*dt); camera.updateProjectionMatrix();
  FX.lines.material.opacity += (((e.boost>0?0.5:0)+Math.max(0,spdN-0.7)*1.2) - FX.lines.material.opacity)*Math.min(1,6*dt); FX.lines.rotation.z += dt*(2+spdN*6);
  // landing puff + airborne tracking
  if(e.id===G.localId){ if(e.wasAir && e.y<=0.001){ spawnFX(e.x, ground+0.3, e.z, 0xe8d2b0, 14, {speed:5, up:1, size:.9, grow:2.5, life:.5}); FX.shake=Math.max(FX.shake,.5); SFX.play('land'); } e.wasAir = e.y>0.05; }
  updateFX(dt);
  if(Math.abs(e.speed)>6 && e.y<0.1 && e.id===G.localId){ const onTrail=trailDist(e.x,e.z)<10; for(let k=0;k<(onTrail?2:1);k++){ const d=dust.find(d=>d.life<=0); if(d){ d.life=onTrail?1.1:0.6; d.s.visible=true; d.s.material.color.setHex(onTrail?0xd9b58a:0xb9c48a); d.s.position.set(e.x-Math.sin(e.heading)*2.2+rand(-.8,.8), ground+0.3, e.z-Math.cos(e.heading)*2.2+rand(-.8,.8)); d.s.scale.setScalar(onTrail?1.4:0.8); } } }
  for(const d of dust){ if(d.life>0){ d.life-=dt; d.s.material.opacity=Math.min(.55,d.life*0.5); d.s.scale.addScalar(dt*3.5); d.s.position.y+=dt*1.2; if(d.life<=0) d.s.visible=false; } }
}
function updateHUD(e){
  const ef=$('energyFill'); ef.style.width=Math.max(0,e.energy)+'%'; ef.classList.toggle('low', e.energy<30);
  $('time').textContent=Math.floor(G.t)+'s'; const lf=Math.max(0,G.len-G.t); $('left').textContent=Math.floor(lf/60)+':'+String(Math.floor(lf%60)).padStart(2,'0'); $('left').style.color=lf<60?'var(--bad)':''; $('food').textContent=e.foodEaten; $('toms').textContent=e.tomatoes; $('alive').textContent=aliveRiders().length+'/'+MAX_PLAYERS;
  $('speed').firstChild.nodeValue = Math.round(Math.abs(e.speed)*3.6)+' ';
  const b=$('boost'); b.style.display=e.boost>0?'block':'none'; if(e.boost>0) b.textContent='⚡ TURBO '+e.boost.toFixed(1)+'s';
  const clock=(0.36+G.t/DAY_LEN)%1; updateSky(clock);
  const phase = clock<0.2?'🌙 Night':clock<0.3?'🌅 Sunrise':clock<0.45?'☀ Morning':clock<0.55?'☀ Noon':clock<0.7?'☀ Afternoon':clock<0.8?'🌇 Sunset':'🌙 Night';
  $('clock').textContent = phase+' · day '+(Math.floor(G.t/DAY_LEN+0.36)+1);
  if(isTouch){ const tb=$('tomBtn'); tb.disabled = !(e.id===G.localId && e.alive && e.tomatoes>0); const h=$('thint'); h.style.opacity = G.t<8 ? 1 : 0; }
  const lowE = e.id===G.localId && e.alive && e.energy<22; $('lowE').classList.toggle('show', lowE); if(lowE && !G.lowWarned){ G.lowWarned=true; announce('LOW ENERGY!','bad','find food fast'); SFX.play('warn'); } if(e.energy>35) G.lowWarned=false;
  SFX.engineState(Math.min(1,Math.abs(e.speed)/28), e.boost>0, G.running && !paused);
  SFX.setMood(G.t>G.len-60 || aliveRiders().length<=3 ? 2 : 1);
  const jammed = e.blind>0 && e.id===G.localId;
  $('splat').style.display=jammed?'block':'none'; if(jammed) $('splatT').textContent=Math.ceil(e.blind); $('gps').classList.toggle('jammed', jammed);
  $('tr').style.visibility = jammed?'hidden':'visible';
  const [target, dist] = jammed ? [null,0] : nearestItem(e.x,e.z, it=>it.kind==='food');
  if(target){ const ang = Math.atan2(target.x-e.x, target.z-e.z) - e.heading; $('arrow').style.transform='rotate('+(-ang*180/Math.PI)+'deg)'; $('gpsName').textContent=FOODS[target.type].name+' · '+Math.round(dist)+' m';
    const pos=routeGeo.attributes.position; for(let i=0;i<24;i++){ const s=i/23, x=e.x+(target.x-e.x)*s, z=e.z+(target.z-e.z)*s; pos.setXYZ(i,x,terrainH(x,z)+0.5,z); } pos.needsUpdate=true; route.computeLineDistances(); route.visible=true;
    ring.visible=true; ring.position.set(target.x, terrainH(target.x,target.z)+0.3, target.z); ring.scale.setScalar(1+Math.sin(G.t*4)*0.12); }
  else { route.visible=false; ring.visible=false; $('gpsName').textContent=jammed?'JAMMED '+Math.ceil(e.blind)+'s':'scanning'; }
  if(!jammed) drawMap(e);
}
const mapC = $('map').getContext('2d');
function drawMap(me){
  const S=300, k=S/WORLD; mapC.clearRect(0,0,S,S); mapC.fillStyle='rgba(120,90,55,.6)'; mapC.fillRect(0,0,S,S);
  mapC.fillStyle='rgba(255,255,255,.22)'; for(const o of obstacles){ mapC.beginPath(); mapC.arc((o.x+HALF)*k,(o.z+HALF)*k,Math.max(1.5,o.r*k),0,6.28); mapC.fill(); }
  for(const it of G.items){ if(!it.alive) continue; mapC.fillStyle = it.kind==='food'?FOODS[it.type].color : it.kind==='drink'?'#4df0e0': it.kind==='tomato'?'#ff4d2a':'#ff6ad5'; mapC.beginPath(); mapC.arc((it.x+HALF)*k,(it.z+HALF)*k,3.5,0,6.28); mapC.fill(); }
  for(const id of G.order){ const e=G.ents[id]; if(!e.alive||e===me) continue; mapC.fillStyle=e.clone?'#7cff8a':e.bot?'#ff4d6d':e.color; mapC.beginPath(); mapC.arc((e.x+HALF)*k,(e.z+HALF)*k,4,0,6.28); mapC.fill(); }
  mapC.save(); mapC.translate((me.x+HALF)*k,(me.z+HALF)*k); mapC.rotate(-me.heading); mapC.fillStyle='#ffffff'; mapC.beginPath(); mapC.moveTo(0,-8); mapC.lineTo(5,6); mapC.lineTo(-5,6); mapC.closePath(); mapC.fill(); mapC.restore();
}

// ---------- main loop ----------
const perf = { acc:0, n:0, t:0, stepped:false };
function perfSample(dt){ if(!G || G.countdown>0 || perf.stepped) return; perf.acc+=dt; perf.n++; perf.t+=dt;
  if(perf.t>6){ const fps=perf.n/perf.acc; perf.acc=perf.n=perf.t=0; const order=['low','medium','high','ultra']; const i=order.indexOf(settings.qualityName);
    if(fps<38 && i>0){ perf.stepped=true; applyQuality(order[i-1]); $('qualitySel').value=order[i-1]; showMsg('Graphics set to '+order[i-1]+' to keep the race smooth','boost'); } } }
function frame(now){
  requestAnimationFrame(frame);
  const rawDt=(now-lastFrame)/1000 || 0; const dt = Math.min(0.05, rawDt); lastFrame=now; perfSample(rawDt);
  if(G && G.running && !paused && G.countdown>0){ const before=Math.ceil(G.countdown); G.countdown-=dt; const now2=Math.ceil(G.countdown);
    const cd=$('countdown'); cd.classList.add('show'); if(now2!==before || !cd.firstChild){ cd.innerHTML=''; const sp=document.createElement('span'); sp.textContent = G.countdown>0.6 ? Math.max(1,Math.ceil(G.countdown-0.6)) : 'GO!'; cd.appendChild(sp); SFX.play(G.countdown>0.6?'beep':'go'); }
    if(G.countdown<=0){ cd.classList.remove('show'); cd.innerHTML=''; SFX.startEngine(); SFX.setMood(1); net.lastSnap=performance.now(); lastFrame=now; }
    renderEnts(dt); const v=G.ents[G.localId]; if(v){ updateCamera(dt, v); updateHUD(v); } renderFrame(); return; }
  if(G && G.running && !paused){
    if(G.isHost){ const steps = humansAlive().length===0 && !G.over ? 6 : 1; for(let i=0;i<steps;i++) hostSim(dt); if(net.online){ G.sendAcc+=dt; if(G.sendAcc>=0.1){ G.sendAcc=0; net.broadcast(snapshot()); } } }
    else { const e=G.ents[G.localId]; if(e&&e.alive){ movePhysics(e, keys2input(), dt);
        for(const it of G.items){ if(it.alive && e.y<2.5 && Math.hypot(it.x-e.x,it.z-e.z)<2.8){ it.alive=false; it.mesh.visible=false; net.sendHost({t:'take', i:it.id}); } } G.sendAcc+=dt; if(G.sendAcc>=0.067 && net.online){ G.sendAcc=0; try{ net.sendHost({t:'in', x:+e.x.toFixed(2), z:+e.z.toFixed(2), y:+e.y.toFixed(2), h:+e.heading.toFixed(3), s:+e.speed.toFixed(1), l:+e.lean.toFixed(2), cr:e.crashes, cc:e.closeCalls||0, jc:e.jumpCost||0, fa:+(e.flipA||0).toFixed(2)}); e.crashes=0; e.closeCalls=0; e.jumpCost=0; }catch(err){} } } }
    renderEnts(dt);
    let view = G.ents[G.localId];
    if(!view || !view.alive){ if(!G.spectate || !G.ents[G.spectate] || !G.ents[G.spectate].alive){ const a=aliveRiders(); G.spectate = a.length? a[0].id : null; } view = G.spectate? G.ents[G.spectate] : view;
      $('spect').style.display = view && view.alive ? 'block':'none'; if(view) $('spectName').textContent=view.name; } else $('spect').style.display='none';
    if(view){ updateCamera(dt, view); updateHUD(view); }
  } else if(!G){ const a=now*0.00015; camera.position.set(Math.sin(a)*22, 9, Math.cos(a)*22); camera.lookAt(0,1,0); updateSky((0.42 + now/1000/DAY_LEN/4) % 1);
    if(preview){ preview.position.y=terrainH(0,0)+0.9+Math.sin(now*0.004)*0.08; preview.rotation.y=now*0.0006; } }
  renderFrame();
}

// ---------- touch controls: left half = steering pad, right half = tap to jump / hold to brake ----------
const touch = { steer:0, brake:false, jump:false, hintT:0 };
if(isTouch){ document.body.classList.add('touch'); $('touchTip').style.display='block';
  const tz=$('touch'), stick=$('stick'), knob=$('knob'), fx=$('tapfx'), zl=$('zl');
  let lt=null; // left touch {id,x0}
  let rt=null; // right touch {id,t0,x,y,braking}
  const place=(el,x,y)=>{ el.style.left=x+'px'; el.style.top=y+'px'; };
  function onStart(e){ e.preventDefault();
    for(const t of e.changedTouches){ const left = t.clientX < innerWidth/2;
      if(left && !lt){ lt={id:t.identifier, x0:t.clientX, y0:t.clientY}; place(stick,t.clientX,t.clientY); stick.style.display='block'; knob.style.transform='translate(0,0)'; touch.steer=0; }
      else if(!left && !rt){ rt={id:t.identifier, t0:performance.now(), x:t.clientX, y:t.clientY, braking:false}; place(fx,t.clientX,t.clientY); fx.className=''; fx.style.display='block';
        rt.timer=setTimeout(()=>{ if(rt && rt.id===t.identifier){ rt.braking=true; touch.brake=true; fx.className='brake'; } }, 180); } } }
  function onMove(e){ e.preventDefault();
    for(const t of e.changedTouches){ if(lt && t.identifier===lt.id){ const dx=T.MathUtils.clamp(t.clientX-lt.x0,-40,40); touch.steer = -dx/40; knob.style.transform='translate('+dx+'px,0)'; } } }
  function onEnd(e){ e.preventDefault();
    for(const t of e.changedTouches){
      if(lt && t.identifier===lt.id){ lt=null; touch.steer=0; stick.style.display='none'; }
      if(rt && t.identifier===rt.id){ clearTimeout(rt.timer); if(!rt.braking){ requestJump(); } touch.brake=false; rt=null; fx.style.display='none'; } } }
  tz.addEventListener('touchstart', onStart, {passive:false}); tz.addEventListener('touchmove', onMove, {passive:false});
  tz.addEventListener('touchend', onEnd, {passive:false}); tz.addEventListener('touchcancel', onEnd, {passive:false});
  const tb=$('tomBtn'); tb.addEventListener('touchstart', e=>{ e.preventDefault(); e.stopPropagation(); pressKey('f'); }, {passive:false});
  const orient=()=>document.body.classList.toggle('portrait', innerHeight>innerWidth); orient(); addEventListener('resize', orient);
  $('spect').style.pointerEvents='auto'; $('spect').addEventListener('touchstart', e=>{ e.preventDefault(); pressKey('tab'); }, {passive:false});
}
function pressKey(k){ if(!G || !G.running) return;
  if(k==='f'){ const me2=G.ents[G.localId]; if(me2&&me2.alive&&me2.tomatoes>0){ if(G.isHost) hostThrow(me2); else if(net.online) net.sendHost({t:'throw'}); } }
  if(k==='tab'){ const a=aliveRiders(); if(a.length){ const i=a.findIndex(x=>x.id===G.spectate); G.spectate=a[(i+1)%a.length].id; } } }
// ---------- input ----------
let lastJumpTap=0; const jumpReq={jump:false, flip:false};
function requestJump(){ const now=performance.now(); if(now-lastJumpTap<420) jumpReq.flip=true; jumpReq.jump=true; lastJumpTap=now; }
addEventListener('keydown', e=>{ const k=e.key.toLowerCase(); keys[k]=true; if(k===' ' && !e.repeat && G && G.running) requestJump();
  if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k) && G) e.preventDefault();
  if(!G || !G.running) return;
  if(k==='p' && !net.online){ paused=!paused; $('pause').style.display=paused?'flex':'none'; if(!paused) lastFrame=performance.now(); }
  if(k==='f'||k==='tab') pressKey(k); });
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
$('resumeBtn').onclick=()=>{ paused=false; $('pause').style.display='none'; lastFrame=performance.now(); };

// ---------- menus ----------
function goFull(){ if(!isTouch) return; try{ const el=document.documentElement; const p=(el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
function saveMe(){ me.name=$('nameIn').value.trim()||'Rider'; try{ localStorage.setItem('speederRider', JSON.stringify(me)); }catch(e){} }
let preview=null;
function refreshPreview(){ if(preview) world.remove(preview); preview = makeBike(me.color, me.hat, null, false); preview.position.set(0, terrainH(0,0)+0.9, 0); }
const BEST = { time:0, wins:0, races:0, hits:0, combos:0, ach:{} }; try{ Object.assign(BEST, JSON.parse(localStorage.getItem('speederBest2')||'{}')); }catch(e){}
function saveBest(){ try{ localStorage.setItem('speederBest2', JSON.stringify(BEST)); }catch(e){} }
function renderBests(){ $('bests').innerHTML = BEST.races ? '<span>Best run <b>'+BEST.time+'s</b></span><span>Wins <b>'+BEST.wins+'</b></span><span>Races <b>'+BEST.races+'</b></span><span>Tomato hits <b>'+BEST.hits+'</b></span>' : '<span>No races yet. Your records will show here.</span>'; }
const ACH = { first:'First race finished', win:'Winner! Last rider standing', five:'Survived a full 5-minute race', sniper:'Tomato sniper: 10 direct hits', combo5:'Combo master: a x5 food combo', close10:'Daredevil: 10 close calls' };
function unlock(k){ if(BEST.ach[k]) return; BEST.ach[k]=1; saveBest(); announce('ACHIEVEMENT!','boost',ACH[k]); SFX.play('win'); }
function roomLinkFor(code){ try{ const u=new URL(location.href); u.search='?room='+code; u.hash=''; return u.toString(); }catch(e){ return location.href.split('?')[0]+'?room='+code; } }
function unlockAudio(){ if(SFX.ensure()){ SFX.startMusic(); SFX.setMood(0); } }
(function initIntro(){ const intro=$('intro'); let done=false;
  const go=()=>{ if(done) return; done=true; unlockAudio(); SFX.play('go'); intro.style.transition='opacity .6s'; intro.style.opacity='0'; setTimeout(()=>{ intro.style.display='none'; }, 620); };
  intro.addEventListener('click', go); intro.addEventListener('touchend', e=>{ e.preventDefault(); go(); }, {passive:false}); addEventListener('keydown', go, {once:true}); })();
(function initSettings(){ const vm=$('volMusic'), vs=$('volSfx'), mb=$('muteBtn'), qs=$('qualitySel');
  vm.value=SFX.vol.music; vs.value=SFX.vol.sfx; qs.value=settings.qualityName; const mute=()=>{ mb.textContent=SFX.vol.muted?'Unmute':'Mute'; };
  mute(); vm.oninput=()=>{ SFX.vol.music=+vm.value; SFX.applyVol(); SFX.save(); }; vs.oninput=()=>{ SFX.vol.sfx=+vs.value; SFX.applyVol(); SFX.save(); SFX.play('click'); };
  mb.onclick=()=>{ SFX.vol.muted=!SFX.vol.muted; SFX.applyVol(); SFX.save(); mute(); }; qs.onchange=()=>{ applyQuality(qs.value); if(!G) refreshPreview(); };
  document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>{ matchLen=+b.dataset.len; document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('on',x===b)); SFX.play('click'); });
  document.addEventListener('click', e=>{ if(e.target.tagName==='BUTTON' && !e.target.classList.contains('mode')) SFX.play('click'); });
  $('copyLink').onclick=()=>{ const link=roomLinkFor(net.code); const done=()=>{ $('copyLink').textContent='Link copied!'; setTimeout(()=>$('copyLink').textContent='Copy invite link',1800); };
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done).catch(()=>{ $('roomLink').textContent=link; }); } else $('roomLink').textContent=link; };
  const params=new URLSearchParams(location.search); const rc=(params.get('room')||'').toUpperCase().slice(0,4); if(rc.length===4){ $('codeIn').value=rc; $('startErr').textContent='Invite link found for room '+rc+'. Pick your rider and press Join room.'; $('startErr').style.color='var(--accent2)'; }
  renderBests(); })();
(function initMenu(){
  $('nameIn').value = me.name || '';
  const sw=$('swatches'); BIKE_COLORS.forEach(c=>{ const b=document.createElement('button'); b.className='sw'+(c===me.color?' on':''); b.style.background=c; b.setAttribute('aria-label','Bike color '+c); b.onclick=()=>{ me.color=c; [...sw.children].forEach(x=>x.classList.toggle('on', x===b)); refreshPreview(); }; sw.appendChild(b); });
  const hb=$('hats'); Object.entries(HATS).forEach(([k,v])=>{ const b=document.createElement('button'); b.className='hat'+(k===me.hat?' on':''); b.textContent=v; b.onclick=()=>{ me.hat=k; [...hb.children].forEach(x=>x.classList.toggle('on', x===b)); refreshPreview(); }; hb.appendChild(b); });
  refreshPreview();
  $('soloBtn').onclick=()=>{ saveMe(); goFull(); net.online=false; net.host=false; net.lobby=[{id:'p0', name:me.name, color:me.color, hat:me.hat}]; startMatch(Math.floor(Math.random()*1e9), true, buildPlayerList()); };
  $('hostBtn').onclick=()=>{ saveMe(); hostRoom(); };
  $('joinBtn').onclick=()=>{ saveMe(); const code=$('codeIn').value.trim().toUpperCase(); if(code.length!==4){ $('startErr').textContent='Enter the 4-letter room code.'; return; } joinRoom(code); };
  $('startBtn').onclick=()=>{ if(!net.host) return; goFull(); startMatch(Math.floor(Math.random()*1e9), true, buildPlayerList()); };
  $('leaveBtn').onclick=leaveRoom;
  const toLobby=()=>{ $('over').style.display='none'; clearWorld(); G=null; refreshPreview(); SFX.setMood(0); if(net.online && net.host){ showRoom(net.code); net.broadcast({t:'lobby', players:net.lobby, code:net.code}); } else if(net.online){ showRoom(net.code); } else { $('start').style.display='flex'; } };
  $('againBtn').onclick=()=>{ if(net.online && !net.host){ toLobby(); $('roomNote').textContent='Waiting for the host to start the rematch...'; return; }
    $('over').style.display='none'; clearWorld(); goFull(); startMatch(Math.floor(Math.random()*1e9), true, buildPlayerList()); };
  $('lobbyBtn').onclick=toLobby;
})();
camera.position.set(0,6,-12); camera.lookAt(0,1,0);
requestAnimationFrame(frame);
window.__sf = { FOODS, world, camera, terrainH, buildDrink, buildCherry, buildTomato, get G(){ return G; } };

}

// ---------- boot ----------
import { loadAll } from './assets.js';
(async function boot(){
  const bar=$('loadBar'), txt=$('loadTxt');
  try{ await loadAll(p=>{ bar.style.width=Math.round(p*100)+'%'; txt.textContent='Loading canyon assets… '+Math.round(p*100)+'%'; }); }
  catch(err){ console.error(err); txt.textContent='Some assets failed to load; starting anyway.'; }
  setupEnvironment(); buildTerrain(); buildScenery();
  $('loading').style.display='none';
  startGame();
})();
