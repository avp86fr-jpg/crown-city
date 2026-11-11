/* Optional location-led stories. No rewards until the final, validated handoff. */
import {FRONTIER} from './expansion_world.js';
export const EXPANSION_JOBS=[
 {id:'canal',title:'UNDER THE BRIDGES',contact:'HUNTER',text:'Lift a sealed ledger at the north dock. Run three canal gates by boat. Deliver on foot at the south dock.',reward:1500,time:360,stages:4},
 {id:'casino',title:'HOUSE EDGE',contact:'GOLD MAGE',text:'Read two dealer ledgers at the outdoor MetaWin casino. Copy the cage receipt and escape to the canal.',reward:1900,time:420,stages:3},
 {id:'airlift',title:'DEAD CHANNEL',contact:'NEURAL',text:'Collect a relay at the airport. Land a helicopter at Pinewatch, then Sierra Rescue. Bring the signal home.',reward:2400,time:720,stages:3},
 {id:'ridge',title:'DUST TO DAWN',contact:'FIRE',text:'Collect Fire’s drive at Red Mesa. Pass two road checkpoints, then find Mask in Pinewatch on foot.',reward:1600,time:480,stages:3},
];
export const EXPANSION_STEPS={
 canal:['On foot: hold still at Hunter’s north dock for two seconds.','Boat: pass the north canal gate.','Boat: pass the MetaWin canal gate.','Boat: pass the Ironside canal gate.','Lose the heat. Deliver on foot at the south dock.'],
 casino:['On foot: read the first dealer’s ledger, without heat or gunfire.','On foot: read the second ledger. Keep your weapon down.','On foot: copy the cage receipt. Hold still for three seconds.','Leave MetaWin. Lose the tail and hand off at the canal dock.'],
 airlift:['On foot: collect Neural’s relay at the airport.','Land a helicopter at Pinewatch. Stop for three seconds.','Land the helicopter at Sierra Rescue for three seconds.','Return and land at the airport heliport.'],
 ridge:['On foot: collect Fire’s drive at Red Mesa fuel.','Drive a car or bike through the desert checkpoint.','Drive north through the mountain checkpoint.','Find Mask at Pinewatch on foot. No police at the handoff.'],
};
export function expansionJobTarget(G,c){
 const routes={canal:[[6810,1250],[6968,1900],[6968,3450],[6968,5500],[6818,6150]],casino:[[8060,3100],[8470,3280],[7760,3010],[7115,3450]],airlift:[[9840,7780],[11400,4920],[11200,9640],[7000,7780]],ridge:[[5680,9730],[7800,9800],[10880,9200],[11340,4920]]};
 const point=routes[c.id]?.[Math.min(c.stage||0,routes[c.id].length-1)];return point?{x:point[0],y:point[1]}:null;
}
export function tickExpansionJob(G,c,dt,notify){
 const target=expansionJobTarget(G,c);if(!target)return false;const P=G.player,stage=c.stage||0,speed=P.type==='veh'?Math.hypot(P.vx||0,P.vy||0):P.speed||0;
 const dist=Math.hypot(P.x-target.x,P.y-target.y),quiet=G.wanted===0&&!G.input.fire;
 let valid=false,hold=2;
 if(c.id==='canal'){valid=stage>0&&stage<4?P.type==='veh'&&P.def.boat&&dist<95:P.type==='foot'&&dist<60&&speed<8&&quiet;hold=stage>0&&stage<4?.05:2;}
 if(c.id==='casino'){valid=P.type==='foot'&&dist<54&&speed<8&&quiet;hold=stage===2?3:2;}
 if(c.id==='airlift'){valid=stage===0?P.type==='foot'&&dist<65&&speed<8&&quiet:P.kind==='heli'&&(P.altitude||0)<3&&speed<12&&dist<72&&quiet;hold=stage===0?2:3;}
 if(c.id==='ridge'){valid=stage===1||stage===2?P.type==='veh'&&!P.def.boat&&!P.def.aircraft&&dist<105:P.type==='foot'&&dist<65&&speed<8&&quiet;hold=stage===1||stage===2?.05:2;}
 c.progress=valid?(c.progress||0)+dt:0;if(c.progress<hold)return false;
 const def=EXPANSION_JOBS.find(j=>j.id===c.id);if(stage===def.stages)return true;
 c.stage++;c.progress=0;
 if(c.id==='canal'&&c.stage===3){G.wanted=Math.max(2,G.wanted);G.seenT=0;notify(G,'HUNTER','The ledger names a Palace dock. Metro heard the same name. Keep the bow straight; south dock is still clear.');}
 else if(c.id==='casino'&&c.stage===3){G.wanted=Math.max(2,G.wanted);G.seenT=0;notify(G,'NEURAL','Two dealer logs, one payment twice. Gold Mage wanted you to find the receipt. Get it out before he changes his mind.');}
 else if(c.id==='airlift'&&c.stage===2)notify(G,'MASK','Pinewatch is live. The mountain relay carries the broadcast beyond the Palace towers. Keep it above the trees.');
 else if(c.id==='airlift'&&c.stage===3)notify(G,'NEURAL','Sierra is transmitting. Every receiver in the valley has the names. Bring the aircraft home in one piece.');
 else notify(G,def.contact,EXPANSION_STEPS[c.id][c.stage]);
 G.waypoint=expansionJobTarget(G,c);G.gps=null;return false;
}
export const EXPANSION_DEBRIEFS={canal:'Three bridges, one ledger. Hunter has the dock records; the Palace cannot erase a river.',casino:'The house paid twice for the same silence. Vera has both receipts. Gold Mage knows you kept a copy.',airlift:'Pinewatch and Sierra are broadcasting. Crown City can finally hear itself above the Palace signal.',ridge:'Mask has Fire’s drive. No camera saw the handoff. The desert still keeps a few secrets.'};
