export const RACE_PACES=Object.freeze([
 {id:'club',label:'CLUB',target:180,grace:.9,speed:.88},
 {id:'sport',label:'SPORT',target:150,grace:.55,speed:1},
 {id:'pro',label:'PRO',target:125,grace:.3,speed:1.12}
]);
export const racePace=G=>RACE_PACES.find(p=>p.id===G.action?.circuitClass)||RACE_PACES[0];
export function cycleRacePace(G){
 if(G.circuitSession?.running||G.action?.contract?.id==='circuit')return false;
 const pace=RACE_PACES[(RACE_PACES.indexOf(racePace(G))+1)%RACE_PACES.length];G.action.circuitClass=pace.id;G.action.circuitBest=G.action.circuitRecords?.[pace.id]||0;return true;
}
