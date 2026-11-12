// Authored district rhythms, bounded by the selected simulation quality.
export function trafficDemand(G,base){
 if(base<=0)return 0;const {x,y}=G.player,h=((G.time??12)%24+24)%24;
 const core=x<4096&&y<4096,nightlife=core&&x>1300&&x<2900&&y<3300;
 let density=core?1.05:x>10400||y>9000?.38:y>7000?.58:.85;
 if(h>=2&&h<6)density*=.65;
 else if(nightlife&&(h>=18||h<2))density*=1.18;
 else if(h>=7&&h<10||h>=16&&h<19)density*=1.14;
 return Math.min(Math.ceil(base*1.25),Math.max(3,Math.round(base*density)));
}
export const spawnWeight=e=>Math.max(1,e.len-340)*e.lanes*(e.k==='frontier'?.35:e.k==='strip'?1.25:1);
