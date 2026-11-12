import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {BAKED_WORLD} from '../src/baked_world_manifest.js';
import {prepareBakedWorld,drawBakedWorldTile,releaseBakedWorld} from '../src/baked_world.js';
const {signature}=createRequire(import.meta.url)('../tools/mobile-world-inputs.cjs');
const tiles=keys=>keys.map((key,d)=>{const [x,y]=key.split('_').map(Number);return {x:x*4,y:y*4,d};});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function images(){
 const pending=[],closed=[];
 globalThis.Image=class{constructor(){this.width=this.height=this.naturalWidth=1024;}set src(src){this.url=src;pending.push(this);}decode(){return Promise.resolve();}};
 globalThis.createImageBitmap=async im=>({width:1024,height:1024,url:im.url,close(){closed.push(im.url);}});
 return {pending,closed,async settle(fail=false){for(const im of pending.splice(0))fail?im.onerror():im.onload();await flush();}};
}
test('mobile scenery is complete, 1024px and matches the current static-world sources',()=>{
 assert.equal(BAKED_WORLD.version,signature(),'Run npm run bake:world after static-world changes');
 assert.equal(new Set(BAKED_WORLD.sheets).size,26);
 for(let y=0;y<5;y++)for(let x=0;x<6;x++)if(x>=2||y>=2)assert.ok(BAKED_WORLD.sheets.includes(`${x}_${y}`));
 for(const key of BAKED_WORLD.sheets){
  const b=fs.readFileSync(new URL(`../assets/world/mobile/${key}.webp`,import.meta.url));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  let size;for(let i=12;i<b.length;){const type=b.toString('ascii',i,i+4),n=b.readUInt32LE(i+4),p=i+8;
   if(type==='VP8 ')size=[b.readUInt16LE(p+6)&16383,b.readUInt16LE(p+8)&16383];
   if(type==='VP8X')size=[b.readUIntLE(p+4,3)+1,b.readUIntLE(p+7,3)+1];
   i+=8+n+(n%2);
  }
  assert.deepEqual(size,[1024,1024],key);
 }
});
test('wide views limit sheet requests and decoded pixels; current sheets survive narrowing',async()=>{
 const io=images(),G={ticks:100},wide=tiles(BAKED_WORLD.sheets);
 for(let i=0;i<10;i++){prepareBakedWorld(G,wide);assert.ok(io.pending.length<=2);assert.ok(G.bakedWorld.sheets.size<=16);await io.settle();}
 prepareBakedWorld(G,wide);assert.equal(G.bakedWorld.ready,16);assert.equal(G.bakedWorld.bytes,64*1024*1024);
 const key=BAKED_WORLD.sheets[0],warm=G.bakedWorld.sheets.get(key).image;
 prepareBakedWorld(G,tiles([key]));assert.equal(G.bakedWorld.sheets.size,2);assert.equal(G.bakedWorld.sheets.get(key).image,warm);assert.equal(io.closed.length,14);
 const calls=[];assert.equal(drawBakedWorldTile(G,{drawImage(...args){calls.push(args);}},9,2),true);assert.deepEqual(calls[0].slice(1),[256,512,256,256,4608,1024,512.5,512.5]);
 releaseBakedWorld(G);assert.equal(io.closed.length,16);assert.equal(G.bakedWorld,null);
});
test('late image decodes close after eviction or a quality change',async()=>{
 const io=images(),G={ticks:0};prepareBakedWorld(G,tiles(['2_0','3_0']));assert.equal(io.pending.length,2);
 prepareBakedWorld(G,tiles(['4_0','5_0']));assert.equal(G.bakedWorld.sheets.size,3);
 await io.settle();assert.equal(io.closed.length,1,'evicted pending image must close when decoded');
 prepareBakedWorld(G,tiles(['4_0','5_0']));assert.equal(io.pending.length,2);
 releaseBakedWorld(G);await io.settle();assert.equal(io.closed.length,4);assert.equal(G.bakedWorld,null);
});
test('unavailable sheets fall back immediately and retry with backoff',async()=>{
 const io=images(),G={ticks:0},view=tiles(['2_0']);prepareBakedWorld(G,view);await io.settle(true);
 assert.equal(drawBakedWorldTile(G,{},8,0),false);G.ticks=1799;prepareBakedWorld(G,view);assert.equal(io.pending.length,0);
 G.ticks=1800;prepareBakedWorld(G,view);assert.equal(io.pending.length,1);await io.settle();assert.equal(drawBakedWorldTile(G,{drawImage(){}},8,0),true);releaseBakedWorld(G);
});
