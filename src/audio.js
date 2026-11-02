// Procedural audio: every sound is synthesized with Web Audio, no files.
const rand=(a,b)=>a+Math.random()*(b-a);
// ---------- audio: all sounds synthesized with Web Audio (no files) ----------
export const SFX = (function(){
  let ctx=null, master, musicBus, sfxBus, engine=null, music=null;
  const vol = { music:0.5, sfx:0.8, muted:false }; try{ Object.assign(vol, JSON.parse(localStorage.getItem('speederAudio')||'{}')); }catch(e){}
  function save(){ try{ localStorage.setItem('speederAudio', JSON.stringify(vol)); }catch(e){} }
  function ensure(){ if(ctx) { if(ctx.state==='suspended') ctx.resume(); return true; } try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return false; }
    master=ctx.createGain(); master.connect(ctx.destination); musicBus=ctx.createGain(); sfxBus=ctx.createGain(); musicBus.connect(master); sfxBus.connect(master); applyVol(); return true; }
  function applyVol(){ if(!ctx) return; master.gain.value = vol.muted?0:1; musicBus.gain.value=vol.music*0.5; sfxBus.gain.value=vol.sfx; }
  function tone(freq, dur, type, gain, dest, opts={}){ const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type||'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if(opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,opts.slide), ctx.currentTime+dur); g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime+(opts.attack||0.01)); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    o.connect(g); g.connect(dest||sfxBus); o.start(); o.stop(ctx.currentTime+dur+0.05); return o; }
  function noise(dur, gain, opts={}){ const n=ctx.sampleRate*dur, buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n); const src=ctx.createBufferSource(); src.buffer=buf;
    const f=ctx.createBiquadFilter(); f.type=opts.type||'lowpass'; f.frequency.value=opts.freq||1200; const g=ctx.createGain(); g.gain.value=gain; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); }
  const sounds = {
    pickup(){ [660,880,1320].forEach((f,i)=>setTimeout(()=>tone(f,.18,'triangle',.25),i*55)); },
    drink(){ tone(200,.5,'sawtooth',.3,null,{slide:1400}); noise(.4,.25,{type:'highpass',freq:2000}); setTimeout(()=>tone(1200,.3,'square',.15),200); },
    cherry(){ [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>tone(f,.35,'sine',.22),i*70)); setTimeout(()=>noise(.5,.2,{type:'bandpass',freq:3000}),150); },
    tomato(){ tone(300,.25,'sine',.3,null,{slide:120}); noise(.15,.2,{freq:800}); },
    throwT(){ noise(.35,.35,{type:'bandpass',freq:1500}); tone(500,.3,'sine',.2,null,{slide:900}); },
    splat(){ noise(.3,.6,{freq:500}); tone(180,.35,'sawtooth',.35,null,{slide:50}); setTimeout(()=>tone(90,.3,'square',.25,null,{slide:40}),80); },
    jam(){ for(let i=0;i<4;i++) setTimeout(()=>tone(1500-i*300,.08,'square',.18),i*90); noise(.4,.15,{type:'highpass',freq:3000}); },
    crash(){ noise(.45,.7,{freq:900}); tone(120,.4,'sawtooth',.4,null,{slide:40}); },
    land(){ noise(.15,.3,{freq:600}); tone(90,.15,'sine',.3,null,{slide:50}); },
    jump(){ tone(220,.3,'triangle',.3,null,{slide:660}); noise(.2,.15,{type:'highpass',freq:1500}); },
    flip(){ tone(300,.5,'triangle',.3,null,{slide:1200}); setTimeout(()=>tone(900,.3,'sine',.25,null,{slide:1500}),180); noise(.4,.2,{type:'bandpass',freq:2200}); },
    turbo(){ tone(120,1.2,'sawtooth',.35,null,{slide:900, attack:.2}); noise(1,.3,{type:'bandpass',freq:1200}); },
    beep(){ tone(880,.15,'square',.3); }, go(){ tone(1320,.5,'square',.35); tone(1760,.5,'square',.25); noise(.4,.3,{type:'highpass',freq:2500}); },
    out(){ tone(400,.5,'sawtooth',.3,null,{slide:80}); setTimeout(()=>tone(300,.5,'sawtooth',.3,null,{slide:60}),250); },
    win(){ [523,659,784,1047,784,1047,1319].forEach((f,i)=>setTimeout(()=>{ tone(f,.4,'square',.2); tone(f/2,.4,'triangle',.2); },i*130)); },
    lose(){ [392,370,349,330].forEach((f,i)=>setTimeout(()=>tone(f,.5,'sawtooth',.25),i*300)); },
    warn(){ for(let i=0;i<3;i++) setTimeout(()=>tone(660,.12,'square',.25),i*160); },
    combo(n){ tone(880+n*110,.25,'triangle',.3); setTimeout(()=>tone(1100+n*110,.3,'triangle',.3),90); },
    close(){ tone(1500,.1,'sine',.25); setTimeout(()=>tone(2000,.15,'sine',.25),70); },
    click(){ tone(900,.06,'square',.12); },
    firework(){ noise(.5,.35,{freq:1500}); tone(rand(400,900),.5,'sine',.2,null,{slide:100}); },
  };
  function play(name,arg){ if(!ctx || vol.muted && false) { if(!ctx) return; } try{ sounds[name] && sounds[name](arg); }catch(e){} }
  // engine hum: two detuned saws through a lowpass, pitch tied to speed
  function startEngine(){ if(!ctx || engine) return; const o1=ctx.createOscillator(), o2=ctx.createOscillator(), f=ctx.createBiquadFilter(), g=ctx.createGain(), wind=ctx.createGain();
    o1.type='sine'; o2.type='triangle'; o1.frequency.value=55; o2.frequency.value=110.5; f.type='lowpass'; f.frequency.value=260; f.Q.value=0.4; g.gain.value=0.0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
    const n=ctx.sampleRate*2, buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; const ws=ctx.createBufferSource(); ws.buffer=buf; ws.loop=true; const wf=ctx.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=900; wf.Q.value=.6; ws.connect(wf); wf.connect(wind); wind.gain.value=0; wind.connect(sfxBus);
    o1.start(); o2.start(); ws.start(); engine={o1,o2,f,g,wind}; }
  function engineState(speedN, boosting, on){ if(!engine) return; const t=ctx.currentTime; const target = on ? 0.025+speedN*0.045 : 0; engine.g.gain.setTargetAtTime(target, t, .15);
    const base = 48 + speedN*70 + (boosting?30:0); engine.o1.frequency.setTargetAtTime(base, t, .2); engine.o2.frequency.setTargetAtTime(base*1.5, t, .2); engine.f.frequency.setTargetAtTime(200+speedN*500+(boosting?400:0), t, .2);
    engine.wind.gain.setTargetAtTime(on ? Math.max(0,speedN-0.35)*0.22 : 0, t, .25); }
  // music: a procedural sequencer. mood 0 = menu, 1 = race, 2 = final minute
  const SCALE=[0,3,5,7,10,12,15,17]; let mood=0;
  function startMusic(){ if(!ctx || music) return; music={step:0, next:ctx.currentTime+0.1, root:110}; schedule(); }
  function schedule(){ if(!music) return; const bpm = mood===2?150:mood===1?126:96; const stepLen=60/bpm/2;
    while(music.next < ctx.currentTime+0.25){ const st=music.step, t=music.next; const bar=Math.floor(st/16);
      // bass on beats
      if(st%4===0){ const n=SCALE[[0,0,5,3][bar%4]]; const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sawtooth'; o.frequency.value=music.root*Math.pow(2,n/12); const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=mood===2?900:500; g.gain.setValueAtTime(.25,t); g.gain.exponentialRampToValueAtTime(.001,t+stepLen*1.8); o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t+stepLen*2); }
      // kick
      if(mood>0 && st%4===0){ const o=ctx.createOscillator(), g=ctx.createGain(); o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(40,t+.12); g.gain.setValueAtTime(.6,t); g.gain.exponentialRampToValueAtTime(.001,t+.2); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+.25); }
      // hat
      if(mood>0 && st%2===1){ const n=ctx.sampleRate*0.05, b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n); const src=ctx.createBufferSource(); src.buffer=b; const hf=ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=7000; const g=ctx.createGain(); g.gain.value=mood===2?.25:.15; src.connect(hf); hf.connect(g); g.connect(musicBus); src.start(t); }
      // arpeggio
      if(mood>0 && (st%2===0 || mood===2)){ const idx=[0,2,4,7,4,2,5,3][st%8]+(bar%2)*1; const n=SCALE[idx%SCALE.length]+12; const o=ctx.createOscillator(), g=ctx.createGain(); o.type=mood===2?'square':'triangle'; o.frequency.value=music.root*2*Math.pow(2,n/12); g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.001,t+stepLen*.9); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+stepLen); }
      // pad on menu
      if(mood===0 && st%16===0){ [0,7,12,15].forEach(n=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=music.root*2*Math.pow(2,(n+[0,5,3,0][bar%4])/12); g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(.08,t+1); g.gain.exponentialRampToValueAtTime(.0001,t+stepLen*16); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t+stepLen*16+.1); }); }
      music.step++; music.next += stepLen; }
    music.timer=setTimeout(schedule, 100); }
  function setMood(m){ mood=m; }
  return { ensure, play, startEngine, engineState, startMusic, setMood, vol, applyVol, save, get ctx(){ return ctx; } };
})();

