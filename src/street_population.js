// Authored district rhythms, bounded by the selected simulation quality.
export function trafficDemand(G,base){
 if(base<=0)return 0;const {x,y}=G.player,h=((G.time??12)%24+24)%24;
 const core=x<4096&&y<4096,nightlife=core&&x>1300&&x<2900&&y<3300;
 let density=core?1.05:x>10400||y>9000?.38:y>7000?.58:.85;
 if(h>=2&&h<6)density*=.65;
 else if(nightlife&&(h>=18||h<2))density*=1.18;
 else if(h>=7&&h<10||h>=16&&h<19)density*=1.14;
 const budget=G.touch&&G.settings?.quality==='low'?Math.max(.8,Math.min(1,G.streetBudget??1)):1;
 return Math.min(Math.ceil(base*1.25*budget),Math.max(3,Math.round(base*density*budget)));
}
export const spawnWeight=e=>Math.max(1,e.len-340)*e.lanes*(e.k==='frontier'?.35:e.k==='strip'?1.25:1);

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
