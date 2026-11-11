import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {harness} from './harness.js';
import {STATIONS,stationExit,initTransit,nearStation,interactTransit,beginJourney,tickJourney,skipJourney,cancelTransit,regionalTrainAt,ridePhase} from '../src/transit.js';
import {initWildlife,tickWildlife,SPECIES} from '../src/wildlife.js';
import {ambientAt,nightMix,timeLabel,sunAt} from '../src/lighting.js';
import {EXTRA_CONTACTS} from '../src/expansion.js';
import {expansionJobTarget,tickExpansionJob} from '../src/expansion_jobs.js';
import {actionState} from '../src/action.js';
const {G,T}=await harness();
function reset(){T.startFreeRide(G);G.scene='play';G.wanted=0;G.chips=1000;G.action=actionState();initTransit(G);G.player=T.makeFoot(G,...Object.values(stationExit(STATIONS[1])),0);G.input.fire=false;}
test('nine station exits and additional authentic contacts are accessible',()=>{
 for(const s of STATIONS){const e=stationExit(s);assert.ok(T.footClear(G,e.x,e.y,10),s.id);assert.notEqual(G.surfaceAt(e.x,e.y),'water');}
 for(const p of EXTRA_CONTACTS)assert.ok(T.footClear(G,p.x,p.y,8),p.id);
 for(const id of ['nightline','coldsignal','clockwork'])for(let stage=0;stage<3;stage++){const p=expansionJobTarget(G,{id,stage});assert.ok(T.footClear(G,p.x,p.y,8),id+' '+stage);}
});
test('transit refuses vehicles and wanted players; charges one fare and reaches a safe exit',()=>{
 reset();const start=STATIONS[1],e=stationExit(start);G.player=T.makeVeh('riot',e.x,e.y,0);assert.equal(nearStation(G),null);
 G.player=T.makeFoot(G,e.x,e.y,0);G.wanted=1;assert.equal(interactTransit(G),true);assert.equal(G.scene,'play');G.wanted=0;
 assert.equal(interactTransit(G),true);assert.equal(G.scene,'transit');assert.equal(beginJourney(G,'airfield'),true);assert.equal(G.chips,975);assert.equal(beginJourney(G,'sierra'),false);
 const phases=new Set();while(G.transit.ride){phases.add(ridePhase(G.transit.ride).id);tickJourney(G,1/60,{makeFoot:T.makeFoot});}
 assert.equal(G.scene,'play');assert.equal(G.transit.completed,1);assert.equal(G.player.type,'foot');const dest=stationExit(STATIONS.find(s=>s.id==='airfield'));assert.ok(Math.hypot(G.player.x-dest.x,G.player.y-dest.y)<24);
 assert.deepEqual([...phases],['approach','boarding','departing','riding','arriving','alighting']);
});
test('skipping consumes the full trip time and cannot create a free mission-clock exploit',()=>{
 reset();interactTransit(G);beginJourney(G,'sierra');G.action.contract={id:'clockwork',t:100,stage:1,progress:0};const duration=G.transit.ride.duration;
 skipJourney(G,{makeFoot:T.makeFoot});assert.ok(G.transit.ride,'skip unavailable before boarding');tickJourney(G,7);skipJourney(G,{makeFoot:T.makeFoot});assert.equal(G.transit.ride,null);assert.ok(Math.abs(G.action.contract.t-(100-duration))<1e-8);
 reset();interactTransit(G);G.chips=24;assert.equal(beginJourney(G,'harbour'),false);assert.equal(G.chips,24);cancelTransit(G);assert.equal(G.scene,'play');
});
test('regional trains dwell with doors open, stay on rails and reverse without position discontinuities',()=>{
 let last=regionalTrainAt(0),open=0,moving=0;for(let t=.02;t<400;t+=.02){const v=regionalTrainAt(t);assert.equal(v.x,10302);assert.ok(v.y>=1400&&v.y<=9440);assert.ok(Math.abs(v.y-last.y)<5);assert.ok(v.doors>=0&&v.doors<=1);if(v.doors>0){assert.equal(v.speed,0);open++;}if(v.speed>0)moving++;last=v;}assert.ok(open>0&&moving>0);
});
test('rail story objectives require actual completed journeys and persist their start count',()=>{
 reset();G.transit.completed=4;const c={id:'nightline',stage:0,progress:0};Object.assign(G.player,expansionJobTarget(G,c));tickExpansionJob(G,c,3,()=>{});assert.equal(c.trainStart,4);assert.equal(c.stage,1);Object.assign(G.player,expansionJobTarget(G,c));tickExpansionJob(G,c,3,()=>{});assert.equal(c.stage,1);G.transit.completed++;tickExpansionJob(G,c,3,()=>{});assert.equal(c.stage,2);assert.equal(actionState({contract:c}).contract.trainStart,4);
});
test('wildlife remains locally bounded, avoids solids and reacts to gunfire',()=>{
 reset();G.settings.quality='low';initWildlife(G);assert.ok(G.wildlife.animals.length>90);assert.equal(new Set(G.wildlife.animals.map(a=>a.kind)).size,SPECIES.length);
 const a=G.wildlife.animals.find(a=>a.kind===0);G.player=T.makeFoot(G,a.x+120,a.y,0);tickWildlife(G,.4);const before=a.flee;G.shotsFired=(G.shotsFired||0)+1;tickWildlife(G,1/60);assert.ok(a.flee>before);
 for(let i=0;i<1200;i++)tickWildlife(G,1/60);assert.ok(G.wildlife.active.length<=18);for(const b of G.wildlife.active)if(!SPECIES[b.kind].bird)assert.ok(!['build','water','canal'].includes(G.surfaceAt(b.x,b.y)),b.id);
});
test('lighting is periodic, continuous through dusk and valid at negative/multiple-day times',()=>{
 for(let t=0;t<24;t+=.02){assert.ok(Math.abs(nightMix(t+.02)-nightMix(t))<.04);assert.deepEqual(ambientAt(t),ambientAt(t+24));const sun=sunAt(t);assert.ok(Number.isFinite(sun.x+sun.y+sun.alpha));}
 assert.equal(timeLabel(24).text,'00:00');assert.equal(timeLabel(-.5).text,'23:30');assert.equal(timeLabel(NaN).text,'12:00');assert.equal(nightMix(12),0);assert.equal(nightMix(0),1);
});
test('Gold Mage source is exactly the supplied file, including the new cache-safe filename',()=>{
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const expected='a21d3e414f5885c2ae84eeed318735c8ad15d8d3d63b5c158e82a5a7a7039a05';assert.equal(hash('assets/portraits/gold_mage.jpg'),expected);assert.equal(hash('assets/portraits/gold_mage_reference.jpg'),expected);
 const source=fs.readFileSync('src/expansion.js','utf8');assert.ok(source.includes("atlas&&p.id!=='gold_mage'"));
});

test('busted recovery cancels a transit session and preserves completed journey history',()=>{
 reset();G.transit.completed=3;interactTransit(G);beginJourney(G,'sierra');T.busted(G);assert.equal(G.scene,'play');assert.equal(G.transit.ride,null);assert.equal(G.transit.menu,null);assert.equal(G.transit.completed,3);assert.equal(G.wanted,0);assert.ok(T.footClear(G,G.player.x,G.player.y,8));
});
