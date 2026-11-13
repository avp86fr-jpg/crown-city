import {test} from 'node:test';
import assert from 'node:assert/strict';
import {drawMinimapBackdrop} from '../src/minimap_backdrop.js';

test('the minimap scrolls continuously through one bounded backdrop and repaints at its edge',()=>{
 const calls=[],surfaces=[];
 const context=()=>new Proxy({drawImage:(...args)=>calls.push(args)},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.document={createElement:()=>{const canvas={width:0,height:0,getContext:()=>context()};surfaces.push(canvas);return canvas;}};
 const G={ctx:context(),player:{x:2000,y:2000},minimap:{c:{},S:8},ui:1};
 drawMinimapBackdrop(G,12,12,84,1300);
 const cache=G.minimapBackdrop;assert.equal(cache.builds,1);assert.equal(cache.canvas.width*cache.canvas.height,168*168);
 const before=calls.at(-1);G.player.x+=100;drawMinimapBackdrop(G,12,12,84,1300);
 assert.equal(cache.builds,1);assert.ok(Math.abs(calls.at(-1)[1]-before[1]-100*84/1300)<1e-9,'moving the camera scrolls the existing pixels without lag');
 for(let i=0;i<1000;i++){G.player.x+=3;drawMinimapBackdrop(G,12,12,84,1300);}
 assert.ok(cache.builds<8,'walking should not redraw the entire network every frame');assert.equal(surfaces.length,1);
 G.ui=.75;drawMinimapBackdrop(G,9,9,63,2000);assert.equal(cache.canvas.width,126);
 const builds=cache.builds;G.minimap.c={};drawMinimapBackdrop(G,9,9,63,2000);assert.equal(cache.builds,builds+1,'rebuilt terrain invalidates the map');
});
