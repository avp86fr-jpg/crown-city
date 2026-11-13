import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
import {makeBuildings} from '../src/render_world.js';
import {visibleOuterTiles,drawMobileWorld} from '../src/mobile_renderer.js';
import {drawRoofDetail} from '../src/citylife.js';
import {drawArchitectureLights,drawVehicleFinish} from '../src/visuals.js';
const {G}=await harness();
const building=(x,y,extra={})=>({x,y,w:100,h:100,hgt:80,roof:'gravel',wall:'grey',kind:'office',...extra});
const renderer=buildings=>makeBuildings({buildings,coreBuildings:[],trees:[],WALLS:G.world.WALLS},G.assets.tex,null);

test('building queries cull invisible neighbours in the same bin and reuse static candidates while moving',()=>{
 const near=building(4700,2100),far=building(5000,2360),b=renderer([near,far]),r={x0:4680,y0:2080,x1:4820,y1:2220};
 assert.deepEqual([...b.inView(r)],[near]);assert.equal(b.queryStats.buildingCandidates,2);
 const builds=b.queryStats.builds;
 for(let i=0;i<90;i++)assert.deepEqual([...b.inView({...r,x0:r.x0+i*.1,x1:r.x1+i*.1})],[near]);
 assert.equal(b.queryStats.builds,builds,'camera motion inside a bin should not rebuild a Set for each render pass');
});

test('offscreen buildings still cast the complete six-corner shadow into the visible area',()=>{
 const b=building(5200,2100,{hgt:300}),B=renderer([b]),r={x0:4800,y0:2000,x1:5100,y1:2300},paths=[];let points=[];
 const ctx={beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},closePath(){},fill(){paths.push(points);}};
 B.shadows(ctx,{x:4950,y:2150},r,{x:1,y:0,len:1});assert.equal(paths.length,1,'shadow source in an adjacent bin must remain visible');
 assert.ok(paths[0].some(([x])=>x<r.x1));
 const area=ps=>Math.abs(ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
 for(const [dx,dy] of [[90,40],[-90,40],[90,-40],[-90,-40],[0,40],[0,-40],[90,0],[-90,0]]){
  paths.length=0;B.shadows(ctx,{x:5250,y:2150},{x0:4700,y0:1600,x1:5700,y1:2600},{x:-dx/300,y:-dy/300,len:1});
  assert.equal(paths.length,1);assert.equal(area(paths[0]),b.w*b.h+b.w*Math.abs(dy)+b.h*Math.abs(dx));
 }
});

test('roof art preserves its resolution while long exploration releases canvases at the byte budget',()=>{
 const buildings=Array.from({length:80},(_,i)=>building(5000+i%8*600,500+Math.floor(i/8)*600,{w:512,h:512})),B=renderer(buildings),art=[];
 const ctx={fillRect(){},drawImage(image){art.push(image);}};
 for(const b of buildings){B.staticDraw(ctx,{x0:b.x,y0:b.y,x1:b.x+b.w,y1:b.y+b.h});assert.ok(B.queryStats.roofBytes<=B.queryStats.roofBudget);}
 assert.equal(B.queryStats.roofBudget,12*1024*1024);assert.ok(art.some(c=>c.width===1),'retired canvases must release backing pixels');
 assert.ok(art.some(c=>c.width===256),'retained art keeps its original texture resolution');
});

test('mobile tile descriptors survive warm frames and rotating views retain every intersecting world tile',()=>{
 const state={cam:{x:7200,y:3600,rot:0},canvas:{width:844,height:390},ground:{revision:1},street:{revision:1},mobileOuter:new Map()},S=.55,hw=state.canvas.width/(2*S),hh=state.canvas.height/(2*S),e=Math.hypot(hw,hh);
 const r={x0:state.cam.x-e-40,y0:state.cam.y-e-40,x1:state.cam.x+e+40,y1:state.cam.y+e+40,S};
 const first=visibleOuterTiles(state,r).slice(),refs=new Map(first.map(p=>[p.key,p]));for(const p of first)state.mobileOuter.set(p.key,{revision:101});
 const warm=visibleOuterTiles(state,r);for(const p of warm)assert.equal(p,refs.get(p.key));
 for(const a of [0,.35,.8,Math.PI/2,2.7]){
  state.cam.rot=a;const keys=new Set(visibleOuterTiles(state,r).map(p=>p.key)),c=Math.cos(a),s=Math.sin(a);
  // Sample the complete visible screen, including edges and all four corners.
  // Every covered terrain tile must be retained by rotated-view culling.
  for(let sy=-hh;sy<=hh;sy+=hh/12)for(let sx=-hw;sx<=hw;sx+=hw/16){
   const x=state.cam.x+sx*c-sy*s,y=state.cam.y+sx*s+sy*c,key=Math.floor(x/512)+':'+Math.floor(y/512);
   assert.ok(keys.has(key),`visible screen sample missing at angle ${a}: ${key}`);
  }
 }
});

test('rooftop equipment and night neon stay attached to capped roof edges from every camera side',()=>{
 const b=building(5000,2000,{w:280,h:200,hgt:240,kind:'shop'}),B=renderer([b]),r={x0:4600,y0:1600,x1:5600,y1:2600};
 for(const core of [false,true])for(const cam of [{x:6200,y:3200,scale:1.2},{x:4200,y:1000,scale:1.8},{x:5140,y:2100,scale:1}]){
  b.core=core;const images=[],translations=[],scales=[],points=[],rects=[];
  const overrides={drawImage:(...v)=>images.push(v),translate:(...v)=>translations.push(v),scale:(...v)=>scales.push(v),moveTo:(...v)=>points.push(v),fillRect:(...v)=>rects.push(v)};
  const ctx=new Proxy(G.ctx,{get:(o,k)=>overrides[k]||o[k]}),state={...G,bld:B,ctx,cam,settings:{quality:'high',reducedMotion:false},scene:'play',player:{type:'foot',x:0,y:0}};
  B.draw(ctx,cam,r,1,{x:0,y:-1},{low:false});const [,x,y,w,h]=images.at(-1);
  drawRoofDetail(state,r);
  if(core)assert.equal(translations.length,0,'painted core rooftops must not receive duplicate equipment');
  else{assert.deepEqual(translations[0],[x,y]);assert.deepEqual(scales[0],[w/b.w,h/b.h]);}
  translations.length=0;state.settings.reducedMotion=true;drawRoofDetail(state,r);assert.equal(translations.length,0,'static roof equipment is already baked; reduced motion needs no extra pass');
  points.length=0;rects.length=0;drawArchitectureLights(state,r,1);
  assert.deepEqual(points[0],[x+5,y+Math.min(38,h*.25)]);
  assert.deepEqual(rects[0],[x+(w-Math.min(w-16,140))/2,y+h-36,Math.min(w-16,140),24]);
  if(core)assert.deepEqual([x,y,w,h],[b.x,b.y,b.w,b.h]);
 }
});

test('mobile reverse lamps remain readable with the brake held and never light wrecks',()=>{
 const rectangles=[],ctx={save(){},restore(){},fillRect(...bounds){rectangles.push({color:this.fillStyle,bounds});}},state={ctx,settings:{quality:'low'}},vehicle={fwd:-6,braking:true,def:{}};
 drawVehicleFinish(state,vehicle,40,80,{});
 assert.equal(rectangles.length,4,'low quality needs only the four brake/reverse rectangles');
 assert.deepEqual(rectangles.slice(2).map(r=>r.color),['#d3f4ff','#d3f4ff'],'white reverse lamps paint above the held brake lamps');
 for(const changes of [{dead:true},{def:{boat:true}},{def:{bike:true}}]){rectangles.length=0;drawVehicleFinish(state,{...vehicle,...changes},40,80,{});assert.equal(rectangles.length,0);}
 rectangles.length=0;drawVehicleFinish(state,{...vehicle,fwd:0,braking:false},40,80,{});assert.equal(rectangles.length,0);
});

test('zooming into a warm mobile view trims the old wider tile cache without needing a new tile build',()=>{
 let closed=0;G.cam={x:5000,y:5000,rot:0,scale:1};G.canvas.width=G.canvas.height=400;G.time=12;G.settings.reducedMotion=true;G.ticks=100;
 G.mobileOuter=new Map();const revision=G.ground.revision*100+(G.street?.revision||0);
 const entry=()=>({revision,t:0,bitmap:{close(){closed++;}},canvas:{width:256,height:256}});
 for(let i=0;i<95;i++)G.mobileOuter.set('offscreen:'+i,entry());G.mobileOuter.set('9:9',entry());
 const noop=()=>{},H=new Proxy({viewRect:()=>({x0:4890,y0:4890,x1:5110,y1:5110,S:1})},{get:(o,k)=>o[k]||noop});
 drawMobileWorld(G,H);assert.equal(G._outerBuilt,0);assert.equal(G.mobileOuter.size,40);assert.equal(closed,56);assert.ok(G.mobileOuter.has('9:9'));
});

test('returning from a wide day/night view closes cold core bitmaps and retains the current tile',()=>{
 let closed=0;G.cam={x:1500,y:1500,rot:0,scale:1};G.canvas.width=G.canvas.height=400;G.time=12;G.settings.reducedMotion=true;G.ticks=200;
 G.mobileTiles=new Map();for(let y=0;y<4;y++)for(let x=0;x<4;x++)for(const night of [false,true])G.mobileTiles.set(`${x}:${y}:${night}`,{t:200,image:{width:768,height:768,close(){closed++;}}});
 const warm=G.mobileTiles.get('1:1:false'),noop=()=>{},H=new Proxy({viewRect:()=>({x0:1350,y0:1350,x1:1650,y1:1650,S:1})},{get:(o,k)=>o[k]||noop});
 drawMobileWorld(G,H);assert.equal(G.mobileTiles.get('1:1:false'),warm);assert.equal(G.mobileTiles.size,6);assert.equal(closed,26);
});
