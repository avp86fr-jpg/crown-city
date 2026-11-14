import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './harness.js';
let G,T;
before(async()=>{({G,T}=await harness());T.startFreeRide(G);});
// Every road deck that a boat can pass beneath must be a drawn overpass (boat clipped under it) or the
// resort bridge deck; road stubs that end over the river must block boats instead.
test('boats only pass under road decks that hide them',()=>{
 const W=G.world,E=W.expansion,R=W.resort,ov=E.overpasses,RB=R?.bridgeDeck;const bad=[];
 const inR=(b,x,y)=>b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
 for(let y=-3000;y<10240;y+=12)for(let x=0;x<12288;x+=12){const bs=W.boatSurfaceAt?.(x,y);if(bs!=='water'&&bs!=='canal')continue;
  if(G.surfaceAt(x,y)!=='road')continue;if(ov.some(b=>inR(b,x,y))||inR(RB,x,y))continue;bad.push([x,y]);}
 assert.deepEqual(bad.slice(0,5),[]);
 // the stub's sidewalks/kerbs are solid too: no painted land cell next to a stub is boat water
 for(const st of E.riverStubs)for(let x=st.x-40;x<st.x+st.w+40;x+=4)if(G.surfaceAt(x,6700)!=='water')assert.notEqual(W.boatSurfaceAt(x,6700),'water',`stub edge ${x}`);
 assert.ok(E.riverStubs.length>=3);for(const s of E.riverStubs)assert.equal(W.boatSurfaceAt(s.x+s.w/2,6700),null);
});
