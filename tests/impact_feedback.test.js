import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEffects,createContactPlayer,surfaceMotion} from '../src/sound_effects.js';
import {drawVehicleDamage} from '../src/vehicle_dynamics.js';
import {bodySize} from '../src/collision.js';

test('sustained contact does not retrigger every physics frame; a second hard impact remains audible',()=>{
 let time=0;const calls=[],body={},play=createContactPlayer(()=>time,(...args)=>calls.push(args));
 assert.equal(play({speed:80,source:body}),true);
 for(let i=1;i<=12;i++){time=i/60;assert.equal(play({speed:80,source:body}),false);}
 assert.equal(calls.length,1);time=.23;assert.equal(play({speed:80,source:body}),true);
 time=.32;assert.equal(play({speed:200,source:body}),true);assert.ok(calls[2][1]>calls[0][1]);assert.ok(calls[2][3]<calls[0][3]);
 time=.33;assert.equal(play({speed:200,source:{}}),false,'a pile-up still has a global event budget');
 time=.7;assert.equal(play({speed:5,source:body}),false,'resting contact is silent');
});
test('contact material and distance change the sound; hull impacts include a restrained water tail',()=>{
 let time=0;const calls=[],play=createContactPlayer(()=>time,(...args)=>calls.push(args));
 for(const material of ['concrete','body','hull']){time+=.4;play({speed:150,material,pan:-.4});}
 assert.deepEqual(calls.map(c=>c[0]),['bumper','crumple','hull','water']);assert.ok(calls.every(c=>c[2]===-.4));assert.ok(calls[3][1]<calls[2][1]);
 time+=.4;play({speed:150,material:'body',gain:.25,pan:20});assert.ok(calls.at(-1)[1]<calls[1][1]*.3);assert.equal(calls.at(-1)[2],1);
 time+=.4;assert.equal(play({speed:150,gain:0}),false);
});
test('wheel/propeller sound follows actual movement and surface, with no tire squeal on boats or airborne aircraft',()=>{
 const car={type:'veh',def:{},vx:180,vy:-100,rot:0},road=surfaceMotion(car,'road'),grass=surfaceMotion(car,'grass'),wet=surfaceMotion(car,'road',1);
 assert.ok(road.tyre>0);assert.equal(grass.tyre,0);assert.ok(grass.roll>road.roll);assert.ok(wet.roll>road.roll);
 const boat=surfaceMotion({...car,def:{boat:true}},'water');assert.ok(boat.wake>0);assert.equal(boat.tyre,0);assert.equal(boat.roll,0);
 const rest=surfaceMotion({...car,vx:0,vy:0},'road');assert.equal(rest.roll+rest.tyre+rest.wake,0);
 const air=surfaceMotion({...car,def:{aircraft:true},altitude:80},'road');assert.equal(air.roll+air.tyre+air.wake,0);
});
function fakeAudio(){
 const sources=[],buffers=[],nodes=[];const node=()=>{const n={connected:false,disconnected:false,connect(){this.connected=true;},disconnect(){this.disconnected=true;}};nodes.push(n);return n;};
 const ctx={state:'running',createBuffer(channels,n,rate){const data=new Float32Array(n),b={getChannelData:()=>data,length:n,sampleRate:rate};buffers.push(b);return b;},createBufferSource(){const s={...node(),playbackRate:{value:1},start(){}};sources.push(s);return s;},createGain(){return{...node(),gain:{value:1}};},createStereoPanner(){return{...node(),pan:{value:0}};}};
 return {ctx,sources,buffers,nodes};
}
test('impact samples are finite and varied, their cache is bounded, and finished voices disconnect',()=>{
 const {ctx,sources,buffers}=fakeAudio(),play=createEffects(ctx,{});
 for(let i=0;i<12;i++)assert.equal(play('crumple',.4,0,1),true);
 assert.equal(play('crumple'),false,'12 active voices is the hard ceiling');assert.equal(buffers.length,3);
 assert.notDeepEqual(buffers[0].getChannelData(0),buffers[1].getChannelData(0));
 for(const b of buffers)assert.ok(b.getChannelData(0).every(v=>Number.isFinite(v)&&Math.abs(v)<=1));
 for(const s of sources)s.onended();assert.ok(sources.every(s=>s.disconnected));
 for(let i=0;i<30;i++){assert.equal(play('crumple',.2),true);sources.at(-1).onended();}assert.equal(buffers.length,3,'repeated collisions reuse the same three small PCM buffers');
 ctx.state='suspended';assert.equal(play('crumple'),false);
});
test('damaged hulls and motorcycles keep their own silhouettes instead of drawing car panels and glass',()=>{
 for(const kind of ['wake','hog']){
  const points=[],rects=[],ctx=new Proxy({},{get:(o,k)=>k==='fillRect'?(...a)=>rects.push(a):['moveTo','lineTo'].includes(k)?(x,y)=>points.push([x,y]):()=>{}});
  const v={kind,def:{boat:kind==='wake',bike:kind==='hog'},health:20,damage:{front:.8,rear:.5,left:.7,right:.4}},b=bodySize(v);
  drawVehicleDamage(ctx,v);assert.ok(points.length>6);assert.equal(rects.length,0);
  assert.ok(points.every(([x,y])=>Math.abs(x)<=b.w&&Math.abs(y)<=b.l),kind+' damage paint extends outside its body');
 }
});
