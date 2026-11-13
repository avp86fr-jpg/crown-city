import {districtAt} from './world.js';
// Authored district rhythms, bounded by the selected simulation quality.
const BUSY=new Set(['DOWNTOWN','THE STRIP','MIDTOWN','PALACE ROW','CROWN LOOP','CROWN CITY','METAWIN TERRACE']);
const QUIET=new Set(['SOUTHSIDE','HARBOUR','CROWN AIRFIELD','DESERT EDGE','EASTSIDE','OLD TOWN','CROWN CANAL','SUNSET HILLS','OUTSKIRTS']);
const WILD=new Set(['PINEWATCH FOREST','RED MESA','SIERRA CROWN']);
// District character, then the clock: rush hours swell the main grid, the
// small hours empty it, and the Strip keeps its evening crowd.
export function streetDensity(G,x,y){
 const h=((G.time??12)%24+24)%24,core=x<4096&&y<4096,nightlife=core&&x>1300&&x<2900&&y<3300;
 if(G.densityLegacy){let d=core?1.05:x>10400||y>9000?.38:y>7000?.58:.85;if(h>=2&&h<6)d*=.65;else if(nightlife&&(h>=18||h<2))d*=1.18;else if(h>=7&&h<10||h>=16&&h<19)d*=1.14;return d;}
 const name=districtAt(x,y);
 let d=y<760?.45:WILD.has(name)?.36:BUSY.has(name)?1.15:QUIET.has(name)?.72:x>10400||y>9000?.38:y>7000?.58:.85;
 if(h>=2&&h<6)d*=.55;
 else if(nightlife&&(h>=18||h<2))d*=1.18;
 else if(h>=22||h<2)d*=.8;
 else if(h>=7&&h<10||h>=16&&h<19)d*=BUSY.has(name)?1.2:1.08;
 return d;
}
export function trafficDemand(G,base){
 if(base<=0)return 0;const {x,y}=G.player,density=streetDensity(G,x,y);
 const budget=G.touch&&G.settings?.quality==='low'?Math.max(.8,Math.min(1,G.streetBudget??1)):1;
 return Math.min(Math.ceil(base*1.25*budget),Math.max(3,Math.round(base*density*budget)));
}
// Pedestrians follow the same character, flatter: plazas stay social at night.
export function pedDemand(G,base){
 if(G.densityLegacy)return base;const d=streetDensity(G,G.player.x,G.player.y);
 return Math.round(base*Math.min(1.2,Math.max(.4,.35+d*.65)));
}
// Vehicle mix by district and hour: taxis downtown and late, buses by day on
// wide roads, vans in the industrial south and east, bikes everywhere.
export function trafficKind(G,x,y){
 if(G.densityLegacy)return null;
 const h=((G.time??12)%24+24)%24,name=districtAt(x,y),r=Math.random(),day=h>=6&&h<22;
 if(BUSY.has(name)){if(r<(day?.2:.32))return 'taxi';if(day&&r<.3)return 'bus';if(r<.4)return 'hog';if(r<.47)return 'van';}
 else if(QUIET.has(name)){if(r<.24)return 'van';if(r<.32)return 'stitch';if(r<.4)return 'hog';if(r<.45)return 'taxi';}
 else{if(r<.12)return 'hog';if(r<.2)return 'van';}
 return null;
}
export const spawnWeight=e=>Math.max(1,e.len-340)*e.lanes*(e.lanes>=2?1.2:.6)*(e.k==='frontier'?.35:e.k==='strip'?1.25:1);

// Respond to sustained queues across the district, not a single red light.
// The traffic owner retires only offscreen ambient cars when this budget falls.
export function trafficFlowBudget(state,queued,total,dt){
 const ratio=total>12?queued/total:0;
 state.flowBudget??=1;state.flowHeat=ratio>.28?(state.flowHeat||0)+dt:0;
 state.flowCalm=ratio<.15?(state.flowCalm||0)+dt:0;
 if(state.flowHeat>=7){state.flowBudget=Math.max(.8,state.flowBudget-.1);state.flowHeat=0;}
 if(state.flowCalm>=12){state.flowBudget=Math.min(1,state.flowBudget+.05);state.flowCalm=0;}
 return state.flowBudget;
}
