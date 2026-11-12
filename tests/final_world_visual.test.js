import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frontierFloorPatches} from '../src/world_details.js';

test('frontier floor shapes join across streamed chunk boundaries at identical world coordinates',()=>{
 const left={x0:10752,y0:2048,x1:11264,y1:2560},right={...left,x0:11264,x1:11776};
 const a=frontierFloorPatches(left,()=>5).filter(p=>p.x+p.rx>=left.x1&&p.x-p.rx<=left.x1);
 const b=frontierFloorPatches(right,()=>5).filter(p=>p.x+p.rx>=left.x1&&p.x-p.rx<=left.x1);
 assert.ok(a.length>0,'the fixture must exercise shapes crossing a tile boundary');assert.deepEqual(a,b);
});

test('surface decoration preserves a narrow road and a small destination court inside its bounds',()=>{
 const r={x0:10752,y0:2048,x1:11776,y1:3072},natural=frontierFloorPatches(r,()=>5),court={x:11008,y:2336,w:16,h:16};
 const at=(x,y)=>x>=11264&&x<11280?0:x>=court.x&&x<court.x+court.w&&y>=court.y&&y<court.y+court.h?9:5;
 const decorated=frontierFloorPatches(r,at);assert.ok(decorated.length<natural.length);
 for(const p of decorated){
  assert.ok(p.x+p.rx<11264||p.x-p.rx>=11280,'a floor wash must not obscure a one-cell road');
  assert.ok(p.x+p.rx<court.x||p.x-p.rx>=court.x+court.w||p.y+p.ry<court.y||p.y-p.ry>=court.y+court.h,'courts remain exposed');
 }
});
