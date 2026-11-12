import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSoundtrack} from '../src/soundtrack.js';
import {engineMotion} from '../src/sound_effects.js';

async function music(run){
 const original={Audio:globalThis.Audio,document:globalThis.document},state={slow:false,reject:false,elements:[],events:{},plays:0};
 const ctx={currentTime:0,createGain(){return {gain:{value:0,cancelScheduledValues(){},setTargetAtTime(value){this.value=value;}},connect(){}};},createMediaElementSource(el){return{connect(gain){el.gain=gain.gain;}};}};
 globalThis.document={hidden:false,addEventListener(type,fn){state.events[type]=fn;}};
 globalThis.Audio=class{
  constructor(){this.paused=true;this.currentTime=0;this.events={};state.elements.push(this);}
  canPlayType(){return 'probably';}
  addEventListener(type,fn){this.events[type]=fn;}
  emit(type){this.events[type]?.();}
  play(){state.plays++;if(state.reject)return Promise.reject(Error('gesture needed'));this.paused=false;if(!state.slow)this.emit('playing');return Promise.resolve();}
  pause(){this.paused=true;}
 };
 const score=createSoundtrack(ctx,{}),G={scene:'play',wanted:0,player:{type:'foot'},settings:{mus:.6},action:{}};
 try{await run({score,G,ctx,state});}finally{Object.assign(globalThis,original);}
}

test('map and pause duck the active radio without retuning or resetting its transport',()=>music(({score,G,ctx,state})=>{
 score.start();G.player.type='veh';score.update(G,1);ctx.currentTime=1;score.update(G,1);
 const radio=state.elements.find(e=>e.src.includes('chip-sidewalk'));radio.currentTime=42;const count=state.elements.length;
 for(const scene of ['map','pause','settings','crew','garage','dossier','transit']){
  G.scene=scene;assert.equal(score.update(G,1),true);assert.match(score.title,/SIDEWALK STORIES/);assert.equal(radio.gain.value,.13);assert.equal(radio.currentTime,42);assert.equal(score.activeStreams,1);
 }
 G.scene='play';score.update(G,1);assert.equal(radio.gain.value,.66);assert.equal(state.elements.length,count);
 G.wanted=3;score.update(G,1);ctx.currentTime+=1;score.update(G,1);G.scene='pause';score.update(G,1);assert.match(score.title,/NO CLEAN EXIT/);
}));

test('cold radio requests keep one outgoing recording audible and suppress the fallback score',()=>music(({score,G,ctx,state})=>{
 score.start();assert.equal(score.update(G,0),true);const old=state.elements[0];state.slow=true;G.player.type='veh';
 assert.equal(score.update(G,0),true,'existing music bridges the new decoder');assert.equal(score.activeStreams,2);
 ctx.currentTime=1;assert.equal(score.update(G,1),true,'rapid retuning must retain the recording that is actually audible');assert.equal(score.activeStreams,2);
 const selected=state.elements.find(e=>e.src.includes('chip-sidewalk'));selected.emit('playing');assert.equal(score.update(G,1),true);
 ctx.currentTime=1.7;score.update(G,1);assert.equal(old.paused,true);assert.equal(score.activeStreams,1);assert.equal(selected.paused,false);
}));

test('a stalled decoder eventually yields to fallback instead of preserving an unrelated song forever',()=>music(({score,G,ctx,state})=>{
 score.start();score.update(G,0);const old=state.elements[0];state.slow=true;G.player.type='veh';assert.equal(score.update(G,0),true);
 ctx.currentTime=8.1;assert.equal(score.update(G,0),false);assert.equal(old.gain.value,0);
 ctx.currentTime=8.8;assert.equal(score.update(G,0),false);assert.equal(old.paused,true);
 const next=state.elements.find(e=>e.src.includes('night-dividend'));next.emit('playing');assert.equal(score.update(G,0),true,'a late successful decode replaces fallback');assert.equal(score.activeStreams,1);
}));

test('muted music stays stopped after tab visibility changes and additional unlock gestures',()=>music(({score,G,state})=>{
 score.start();score.update(G,0);G.settings.mus=0;score.update(G,0);const plays=state.plays;
 document.hidden=true;state.events.visibilitychange();document.hidden=false;state.events.visibilitychange();score.start();
 assert.equal(state.plays,plays);assert.equal(score.activeStreams,0);
 G.settings.mus=.6;assert.equal(score.update(G,0),true);assert.equal(score.activeStreams,1);
}));

test('rejected playback backs off while a fresh user gesture can retry immediately',()=>music(async({score,G,ctx,state})=>{
 state.reject=true;score.start();await Promise.resolve();
 for(let i=0;i<15;i++){ctx.currentTime=i/15;score.update(G,0);await Promise.resolve();}assert.equal(state.plays,1);
 ctx.currentTime=1.6;score.update(G,0);await Promise.resolve();assert.equal(state.plays,2);
 state.reject=false;ctx.currentTime=1.7;score.start();assert.equal(score.update(G,0),true);assert.equal(state.plays,3);
}));

test('the opening overture survives map overlays and starts from the beginning only for a new story',()=>music(({score,G,state})=>{
 score.start();Object.assign(G,{scene:'vn',storyEpoch:1,vn:{id:'intro_news',t:1}});assert.equal(score.update(G,0),true);
 const intro=state.elements.find(e=>e.src.includes('return-to-crown'));intro.currentTime=18;G.scene='map';score.update(G,0);G.scene='vn';score.update(G,0);assert.equal(intro.currentTime,18);assert.equal(intro.gain.value,.64);
 G.storyEpoch=2;score.update(G,0);assert.equal(intro.currentTime,0);
}));

test('reverse engine pitch rises continuously through forward-gear boundaries and held-brake reverse has load',()=>{
 const v={type:'veh',def:{max:300},rot:0,vx:0,vy:0,brakeReverse:true};let previous=0;
 for(let speed=0;speed<=110;speed+=2){v.vy=speed;const motion=engineMotion(v,{y:0,brake:true});assert.equal(motion.load,1);assert.equal(motion.reverse,true);assert.ok(motion.rpm>=previous,'reverse must not upshift at a forward-gear boundary');previous=motion.rpm;}
 v.vy=-100;v.brakeReverse=false;assert.equal(engineMotion(v,{brake:true}).load,0,'real forward braking removes engine load');
 v.vy=50;assert.equal(engineMotion(v,{y:-1}).load,1,'keyboard reverse also opens the throttle');
});

test('boat engine load remains continuous and forward car shifts retain their pitch drop',()=>{
 const v={def:{max:300},rot:0,vx:0,vy:-74};const before=engineMotion(v,{y:1}).rpm;v.vy=-76;assert.ok(engineMotion(v,{y:1}).rpm<before);
 v.def.boat=true;v.vy=-74;const boatBefore=engineMotion(v,{y:1}).rpm;v.vy=-76;assert.ok(engineMotion(v,{y:1}).rpm>boatBefore);
});
