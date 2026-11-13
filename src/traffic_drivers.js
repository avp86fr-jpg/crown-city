/* Civilian road behaviour is deliberately below the player's performance
   envelope. Personality persists across junctions; road limits do not. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const ROAD_CRUISE=Object.freeze({highway:165,strip:120,boulevard:120,coast:110,arterial:105,street:72,frontier:95});
const SEDAN=Object.freeze({pace:1,accel:38,brake:145,corner:64,headway:.9});
const DRIVERS=Object.freeze({
 fare:SEDAN,taxi:{pace:1.02,accel:41,brake:145,corner:63,headway:.86},
 riot:{pace:1.07,accel:49,brake:143,corner:61,headway:.94},
 dart:{pace:1.1,accel:57,brake:162,corner:70,headway:.86},
 nyx:{pace:1.13,accel:65,brake:175,corner:73,headway:.84},
 metro:{pace:1.04,accel:47,brake:156,corner:67,headway:.94},
 ambulance:{pace:.95,accel:34,brake:138,corner:53,headway:1.12},
 bus:{pace:.72,accel:22,brake:120,corner:42,headway:1.35},
 van:{pace:.77,accel:25,brake:122,corner:46,headway:1.2},
 stitch:{pace:1.09,accel:60,brake:163,corner:68,headway:.88},
 hog:{pace:.96,accel:42,brake:135,corner:55,headway:1.05},
});
export function trafficDriver(v,edge){
 const tr=v.tr,spec=DRIVERS[v.kind]||SEDAN;
 if(!tr.driver){
  const base=(ROAD_CRUISE[edge.k]||100)*spec.pace;
  tr.driver={...spec,pace:spec.pace*clamp(v.driverPace??((v.cruise>0?v.cruise:base)/base),.75,1.2)};
 }
 return tr.driver;
}
export function trafficCruise(v,edge,G){
 if(v.cruise===0)return 0; // an ambulance treating a casualty still holds its stop
 const d=trafficDriver(v,edge),health=clamp((v.health??100)/100,.25,1);
 const road=(ROAD_CRUISE[edge.k]||100)*d.pace;
 const wet=clamp(G.wet||0,0,1),visibility=G.weather==='fog'?.88:1;
 return Math.min(road,(v.def.max||Infinity)*.86)*(1-wet*.12)*visibility*(.72+.28*health);
}
export function trafficTurnSpeed(v,turn,cruise){
 const d=trafficDriver(v,v.tr.e);
 const direction=turn.p0.dx*turn.p2.dx+turn.p0.dy*turn.p2.dy;
 return Math.min(cruise,turn.cubic?d.corner*.55:direction>.96?Math.max(90,cruise*.9):direction>.5?d.corner*1.2:d.corner);
}
