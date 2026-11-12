import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutMapLabels} from '../src/map_labels.js';
import {harness} from './harness.js';
test('dense atlas labels remain inside the map and outside each other and location badges',()=>{
 const bounds={x:30,y:30,w:300,h:260},badge={x:150,y:140,w:40,h:24},items=Array.from({length:24},(_,i)=>({name:'DISTRICT '+i,x:110+i*4,y:150+i*3}));
 const labels=layoutMapLabels(items,bounds,t=>t.length*6,[badge],10);assert.ok(labels.length>=4);assert.ok(labels.length<items.length);
 for(const a of labels){assert.ok(a.x>=bounds.x&&a.y>=bounds.y&&a.x+a.w<=330&&a.y+a.h<=290);for(const b of [...labels,badge])if(a!==b)assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y));}
});
test('mobile ground jobs yield bounded stages and return a half-resolution tile without populating the desktop cache',async()=>{
 const {G}=await harness(),job=G.ground.composeTile(19,14,.5);let step=job.next(),count=0;const canvas=step.value.canvas;assert.equal(step.done,false);assert.equal(canvas.width,256);
 while(!step.done&&count++<1000)step=job.next();assert.equal(step.done,true);assert.equal(step.value,canvas);assert.ok(count>40,'complex ground must yield between raster passes');assert.equal(G.ground.cache.size,0);
});
