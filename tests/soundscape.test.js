import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../src/audio.js';
import {createEffects,sceneAcoustics,soundPosition,railMotion,surfaceMotion} from '../src/sound_effects.js';

function withAudio(run){
 const original={window:globalThis.window,document:globalThis.document,Audio:globalThis.Audio,setInterval:globalThis.setInterval};let context;
 const param=(value=0)=>({value,events:[],cancelScheduledValues(){},setValueAtTime(v){this.value=v;this.events.push(v);},setTargetAtTime(v){this.value=v;this.events.push(v);},linearRampToValueAtTime(v){this.value=v;this.events.push(v);},exponentialRampToValueAtTime(v){this.value=v;this.events.push(v);}});
 class Context{
  constructor(){context=this;this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination={};this.nodes=[];this.sources=[];this.buffers=[];this.convolvers=0;}
  node(){const n={connections:[],disconnect(){this.disconnected=true;this.connections=[];},connect(to){this.connections.push(to);return to;}};this.nodes.push(n);return n;}
  createGain(){return {...this.node(),gain:param(1)};}
  createBiquadFilter(){return {...this.node(),frequency:param(350),Q:param(1)};}
  createDynamicsCompressor(){return {...this.node(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
  createConvolver(){this.convolvers++;return this.node();}
  createWaveShaper(){return this.node();}
  createDelay(){return {...this.node(),delayTime:param()};}
  createStereoPanner(){return {...this.node(),pan:param()};}
  createBuffer(channels,n,rate){const data=Array.from({length:channels},()=>new Float32Array(n)),b={length:n,sampleRate:rate,getChannelData:i=>data[i]};this.buffers.push(b);return b;}
  source(){const s={...this.node(),start(){this.started=true;},stop(t){this.stopAt=t;},end(){if(this.ended)return;this.ended=true;this.onended?.();}};this.sources.push(s);return s;}
  createBufferSource(){return Object.assign(this.source(),{playbackRate:param(1)});}
  createOscillator(){return Object.assign(this.source(),{frequency:param(440),detune:param()});}
  resume(){this.state='running';return Promise.resolve();}
 }
 globalThis.window={AudioContext:Context};globalThis.document={hidden:false};globalThis.Audio=undefined;globalThis.setInterval=()=>1;
 try{return run(()=>context);}finally{Object.assign(globalThis,original);}
}
const game=()=>({scene:'play',player:{type:'foot',x:6000,y:2400,rot:0,speed:0},cam:{rot:0},input:{y:0,brake:false,touchJoy:{active:false}},settings:{mus:.6},vehicles:[],peds:[],wanted:0,time:15,wet:0,district:'MIDTOWN',surfaceAt:()=> 'walk'});

test('water ambience detects canals beside either bank and follows actual nearby crowds and traffic',()=>{
 const G=game();G.surfaceAt=(x,y)=>x<5900?'canal':'walk';G.vehicles=[{x:6200,y:2400,traffic:true},{x:6060,y:2400,traffic:true,dead:true}];G.peds=[{x:6030,y:2400},{x:6040,y:2400,dead:true}];
 const mix=sceneAcoustics(G);assert.equal(mix.canal,.8);assert.equal(mix.water,.8);assert.ok(mix.traffic>0);assert.ok(mix.trafficPan>0);assert.equal(mix.crowd,.05);
 G.cam.rot=Math.PI;assert.ok(sceneAcoustics(G).trafficPan<0);G.scene='pause';assert.deepEqual(sceneAcoustics(G),{water:0,canal:0,traffic:0,crowd:0,trafficPan:0,siren:null,sirenDistance:1400});
});

test('world sound positions use camera rotation and bounded distance falloff',()=>{
 const G=game(),near=soundPosition(G,6100,2400),far=soundPosition(G,7100,2400);assert.ok(near.pan>0);assert.ok(near.gain>0);assert.equal(far.gain,0);
 G.cam.rot=Math.PI/2;assert.ok(soundPosition(G,6000,2500).pan<0);assert.ok(Math.abs(soundPosition(G,6000,2500).pan)<=.9);
});

test('train rolling sound follows acceleration and station stops; dirt has no asphalt tire squeal',()=>{
 assert.equal(railMotion('boarding',.5),0);assert.equal(railMotion('alighting',.4),0);assert.equal(railMotion('departing',0),0);assert.equal(railMotion('departing',1),1);assert.equal(railMotion('riding'),1);assert.equal(railMotion('arriving',1),0);
 assert.ok(railMotion('departing',.7)>railMotion('departing',.3));
 const mix=surfaceMotion({type:'veh',def:{},vx:100,vy:100,rot:0},'dirt');assert.equal(mix.tyre,0);assert.ok(mix.roll>0);
});

test('casino, station and material footsteps create finite reusable PCM with bounded voices',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);assert.equal(A.unlock(),true);const ctx=get(),play=createEffects(ctx,{});
 for(const kind of ['card','chips','casinoWin','casinoLose','casinoPush','casinoOpen','stepHard','stepLoose','stepWood','arrive','platform','horn','raceCount','raceGo','raceGate','raceFinish','raceInvalid','pitService','reelStop']){
  for(let i=0;i<8;i++){assert.equal(play(kind,.2,NaN,NaN),true);const s=ctx.sources.at(-1);assert.ok(Number.isFinite(s.playbackRate.value));assert.ok(s.buffer.getChannelData(0).some(x=>Math.abs(x)>.01));assert.ok(s.buffer.getChannelData(0).every(x=>Number.isFinite(x)&&Math.abs(x)<=1));s.onended();}
 }
 assert.equal(play.stats().voices,0);assert.equal(play.stats().buffers,29);assert.ok(play.stats().bytes<1_000_000);
 for(let i=0;i<12;i++)assert.equal(play('card'),true);assert.equal(play('card'),false);
}));

test('Performance audio creates no reverb impulse until requested and does not rebuild continuous sources',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);A.unlock();const ctx=get(),sources=ctx.sources.length;assert.equal(ctx.convolvers,0);assert.equal(sources,17);
 const G=game();for(let i=0;i<60;i++){ctx.currentTime=i/15;A.update(G,1/15);}assert.equal(ctx.sources.length,sources);assert.ok(A.soundStats().spatialQueries<15,'proximity queries should run at a slow control rate');
 A.setLite(false);assert.equal(ctx.convolvers,1);A.setLite(true);A.setLite(false);assert.equal(ctx.convolvers,1);
 const reverb=ctx.nodes.find(n=>n.buffer&&n.connections[0]?.gain);assert.equal(reverb.connections[0].gain.value,A.sfxVol);A.setSfx(0);assert.equal(reverb.connections[0].gain.value,0,'wet effects must obey the SFX slider');
}));

test('rotor pulses use persistent audio-rate modulation and pause silences weather and motion beds',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);A.unlock();const ctx=get(),G=game();G.player={...G.player,type:'veh',kind:'heli',def:{aircraft:true,helicopter:true,max:310},vx:0,vy:-180,altitude:120,rotor:1};A.setRain(1);A.update(G,1/15);
 assert.ok(A.soundStats().rotorDepth>.2);assert.ok(A.soundStats().windLevel>.05);assert.equal(A.soundStats().rainLevel,.2);
 const count=ctx.sources.length;for(let i=1;i<30;i++){ctx.currentTime=i/15;A.update(G,1/15);}assert.equal(ctx.sources.length,count,'flight must not recreate blade oscillators');
 G.scene='pause';A.update(G,1/15);for(const key of ['rotorDepth','reverseLevel','railLevel','rainLevel','windLevel'])assert.equal(A.soundStats()[key],0,key);
}));

test('car reverse adds mechanical whine without applying it to boats or aircraft',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);A.unlock();const G=game();G.player={...G.player,type:'veh',def:{kind:'sedan',max:200},vx:0,vy:50,rot:0};A.update(G,.1);assert.ok(A.soundStats().reverseLevel>0);
 G.player.def={boat:true,max:200};A.update(G,.1);assert.equal(A.soundStats().reverseLevel,0);
 G.player.def={aircraft:true,airplane:true,max:500};G.player.altitude=100;A.update(G,.1);assert.equal(A.soundStats().reverseLevel,0);
}));

test('mute suppresses new one-shots, repeated casino input is throttled and volume values remain valid',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);A.unlock();const ctx=get();assert.equal(A.casino('card'),true);const n=ctx.sources.length;for(let i=0;i<25;i++)assert.equal(A.casino('card'),false);assert.equal(ctx.sources.length,n);
 ctx.currentTime=.08;assert.equal(A.casino('deal'),true);A.setSfx(0);const muted=ctx.sources.length;A.ui();A.step('pier');A.casino('win');A.horn();assert.equal(ctx.sources.length,muted);
 A.setSfx(4);assert.equal(A.sfxVol,1);A.setMaster(NaN);assert.equal(A.masterVol,0);A.shot();assert.equal(ctx.sources.length,muted);
}));

test('a siren leaving its cached audible radius never sends NaN to Web Audio',()=>withAudio(get=>{
 const A=createAudio();assert.equal(A.soundStats().continuousSources,0);assert.equal(A.soundStats().oneShots,0);A.setLite(true);A.unlock();const ctx=get(),G=game(),police={x:G.player.x+1390,y:G.player.y,siren:true};G.vehicles=[police];A.update(G,1/15);
 police.x+=100;ctx.currentTime=1/15;A.update(G,1/15);
 for(const source of ctx.sources)if(source.frequency)assert.ok(Number.isFinite(source.frequency.value),'siren pitch must stay finite');
 const outgoing=ctx.sources.find(s=>s.type==='square'&&s.frequency.value>500);assert.ok(outgoing,'siren oscillator is active');const gain=outgoing.connections[0].connections[0];assert.equal(gain.gain.value,0,'cached siren outside range fades to silence');
}));

test('casino tables stop vehicle loops while cards and chips remain audible',()=>withAudio(get=>{
 const A=createAudio();A.setLite(true);A.unlock();const ctx=get(),G=game();G.player={...G.player,type:'veh',kind:'heli',def:{aircraft:true,helicopter:true,max:310},vx:0,vy:-180,altitude:120,rotor:1};A.setRain(1);A.update(G,.1);
 G.scene='casino';A.update(G,.1);for(const key of ['rotorDepth','reverseLevel','railLevel','rainLevel','windLevel'])assert.equal(A.soundStats()[key],0,key);
 const sources=ctx.sources.length;assert.equal(A.casino('card'),true);assert.equal(A.casino('chips'),true);assert.equal(ctx.sources.length,sources+2);
}));
