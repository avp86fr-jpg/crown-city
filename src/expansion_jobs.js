import {CASINO_EVIDENCE} from './casino_details.js';
import {racePace} from './circuit_rules.js';
/* Optional location-led stories. No rewards until the final, validated handoff. */
import {tickDropJob,DROP_TARGETS} from './airdrop.js';
import {CIRCUIT,TRACK_LENGTH,trackPoint} from './circuit_world.js';
import {nearCircuit,startCircuit} from './motorsport.js';
import {FRONTIER} from './expansion_world.js';
export const EXPANSION_JOBS=[
 {id:'airdrop',title:'PAPER WINGS',contact:'NEURAL',text:'Collect three evidence drives at the airport. Drop them by plane at Mesa, Pinewatch and Sierra. Land and return the aircraft.',reward:2800,time:720,stages:4},
 {id:'circuit',title:'THE EIGHTH SECTOR',contact:'FIRE',text:'Take Fire’s brief at Bugatti / Crown Circuit. Drive a clean lap within your chosen class target, then stop at the pits to upload the telemetry.',reward:2200,time:480,stages:2},
 {id:'canal',title:'UNDER THE BRIDGES',contact:'HUNTER',text:'Lift a sealed ledger at the north dock. Run three canal gates by boat. Deliver on foot at the south dock.',reward:1500,time:360,stages:4},
 {id:'casino',title:'HOUSE EDGE',contact:'GOLD MAGE',text:'Read two dealer ledgers at the outdoor MetaWin casino. Copy the cage receipt and escape to the canal.',reward:1900,time:420,stages:3},
 {id:'airlift',title:'DEAD CHANNEL',contact:'NEURAL',text:'Collect a relay at the airport. Land a helicopter at Pinewatch, then Sierra Rescue. Bring the signal home.',reward:2400,time:720,stages:3},
 {id:'ridge',title:'DUST TO DAWN',contact:'FIRE',text:'Collect Fire’s drive at Red Mesa. Pass two road checkpoints, then find Mask in Pinewatch on foot.',reward:1600,time:480,stages:3},
 {id:'nightline',title:'THE LAST WITNESS',contact:'CHIEF',text:'Collect the witness statement at Old Town station. Take a train, recover the airfield copy, then return to Chief at East Port.',reward:1650,time:540,stages:2},
 {id:'coldsignal',title:'BELOW THE STATIC',contact:'ICE',text:'Recover the mountain distress recording. Verify it at Pinewatch, then give Neural the uncut transmission.',reward:1800,time:540,stages:2},
 {id:'clockwork',title:'BORROWED MINUTES',contact:'STEAMPUNK',text:'Read the station clocks at Midtown and Canal South. Ride the railway and return the timestamps to Steampunk.',reward:1400,time:420,stages:2},
];
export const EXPANSION_STEPS={
 airdrop:['Collect Neural’s evidence drives on foot at the airport.','Plane: drop the drive into the Red Mesa receiver zone.','Plane: drop the drive into the Pinewatch receiver zone.','Plane: drop the drive into the Sierra receiver zone.','Land the plane and stop at the east end of the runway.'],
 circuit:['Reach the pit desk at Bugatti / Crown Circuit.','Finish eight sectors within the class target shown on the HUD.','Stop at the pit desk to upload the telemetry to Fire.'],
 canal:['On foot: hold still at Hunter’s north dock for two seconds.','Boat: pass the north canal gate.','Boat: pass the MetaWin canal gate.','Boat: pass the Ironside canal gate.','Lose the heat. Deliver on foot at the south dock.'],
 casino:['On foot: read the first dealer’s ledger, without heat or gunfire.','On foot: read the second ledger. Keep your weapon down.','On foot: copy the cage receipt. Hold still for three seconds.','Leave MetaWin. Lose the tail and hand off at the canal dock.'],
 airlift:['On foot: collect Neural’s relay at the airport.','Land a helicopter at Pinewatch. Stop for three seconds.','Land the helicopter at Sierra Rescue for three seconds.','Return and land at the airport heliport.'],
 ridge:['On foot: collect Fire’s drive at Red Mesa fuel.','Drive a car or bike through the desert checkpoint.','Drive north through the mountain checkpoint.','Find Mask at Pinewatch on foot. No police at the handoff.'],
 nightline:['On foot: collect the statement at Old Town station.','Take a train, then recover the copy at Airfield East.','Return the two statements to Chief at East Port.'],
 coldsignal:['On foot: recover the Sierra Rescue recording.','On foot: verify the repeater at Pinewatch camp.','Deliver the uncut recording to Neural at the airfield.'],
 clockwork:['On foot: read the Midtown station clock.','On foot: read the Canal South clock.','Take a train, then return the timestamps to Steampunk.'],
};
export function expansionJobTarget(G,c){
 if(c.id==='airdrop'){const p=c.stage===0?{x:9840,y:7780}:c.stage===4?{x:9600,y:7500}:DROP_TARGETS[c.stage-1];return p;}
 if(c.id==='circuit')return c.stage===1&&G.circuitSession?.running?trackPoint(G.circuitSession.gate*TRACK_LENGTH/8):CIRCUIT.pit;
 const routes={canal:[[6810,1250],[6968,1900],[6968,3450],[6968,5500],[6818,6150]],casino:[...CASINO_EVIDENCE.map(p=>[p.x,p.y]),[7115,3450]],airlift:[[9840,7780],[11400,4920],[11200,9640],[7000,7780]],ridge:[[5680,9730],[7800,9800],[10880,9200],[11340,4920]]};
 Object.assign(routes,{nightline:[[2600,6184],[10215,8104],[10150,1460]],coldsignal:[[11045,9560],[11340,4920],[9840,7780]],clockwork:[[6250,3564],[6320,6224],[6130,3555]]});
 const point=routes[c.id]?.[Math.min(c.stage||0,routes[c.id].length-1)];return point?{x:point[0],y:point[1]}:null;
}
export function tickExpansionJob(G,c,dt,notify){
 if(c.id==='airdrop')return tickDropJob(G,c,dt,notify);
 if(c.id==='circuit'){
  if(c.stage===0&&nearCircuit(G)&&startCircuit(G,G.circuitHooks)){c.stage=1;notify(G,'FIRE','Eight sectors. '+racePace(G).target+' seconds in '+racePace(G).label+' class. This telemetry proves the Palace courier could reach the vault before the alarm.');}
  else if(c.stage===1&&G.circuitSession&&!G.circuitSession.running){const s=G.circuitSession;if(s.valid&&s.time<(s.target||racePace(G).target)){c.stage=2;G.waypoint=CIRCUIT.pit;G.gps=null;notify(G,'FIRE','The timing fits. Bring that data back to the pit desk.');}else if(nearCircuit(G))startCircuit(G,G.circuitHooks);}
  else if(c.stage===1&&!G.circuitSession&&nearCircuit(G))startCircuit(G,G.circuitHooks);
  else if(c.stage===2&&nearCircuit(G))return true;
  return false;
 }
 const target=expansionJobTarget(G,c);if(!target)return false;const P=G.player,stage=c.stage||0,speed=P.type==='veh'?Math.hypot(P.vx||0,P.vy||0):P.speed||0;
 const dist=Math.hypot(P.x-target.x,P.y-target.y),quiet=G.wanted===0&&!G.input.fire;
 let valid=false,hold=2;
 if(c.id==='canal'){valid=stage>0&&stage<4?P.type==='veh'&&P.def.boat&&dist<95:P.type==='foot'&&dist<60&&speed<8&&quiet;hold=stage>0&&stage<4?.05:2;}
 if(c.id==='casino'){valid=P.type==='foot'&&dist<54&&speed<8&&quiet;hold=stage===2?3:2;}
 if(c.id==='airlift'){valid=stage===0?P.type==='foot'&&dist<65&&speed<8&&quiet:P.kind==='heli'&&(P.altitude||0)<3&&speed<12&&dist<72&&quiet;hold=stage===0?2:3;}
 if(c.id==='ridge'){valid=stage===1||stage===2?P.type==='veh'&&!P.def.boat&&!P.def.aircraft&&dist<105:P.type==='foot'&&dist<65&&speed<8&&quiet;hold=stage===1||stage===2?.05:2;}
 if(['nightline','coldsignal','clockwork'].includes(c.id)){
  valid=P.type==='foot'&&dist<55&&speed<8&&quiet;hold=2.5;
  if(c.id==='nightline'&&stage===1||c.id==='clockwork'&&stage===2)valid=valid&&(G.transit?.completed||0)>(c.trainStart||0);
 }
 c.progress=valid?(c.progress||0)+dt:0;if(c.progress<hold)return false;
 const def=EXPANSION_JOBS.find(j=>j.id===c.id);if(stage===def.stages)return true;
 c.stage++;c.progress=0;
 if((c.id==='nightline'||c.id==='clockwork')&&c.stage===1)c.trainStart=G.transit?.completed||0;
 if(c.id==='canal'&&c.stage===3){G.wanted=Math.max(2,G.wanted);G.seenT=0;notify(G,'HUNTER','The ledger names a Palace dock. Metro heard the same name. Keep the bow straight; south dock is still clear.');}
 else if(c.id==='casino'&&c.stage===3){G.wanted=Math.max(2,G.wanted);G.seenT=0;notify(G,'NEURAL','Two dealer logs, one payment twice. Gold Mage wanted you to find the receipt. Get it out before he changes his mind.');}
 else if(c.id==='airlift'&&c.stage===2)notify(G,'MASK','Pinewatch is live. The mountain relay carries the broadcast beyond the Palace towers. Keep it above the trees.');
 else if(c.id==='airlift'&&c.stage===3)notify(G,'NEURAL','Sierra is transmitting. Every receiver in the valley has the names. Bring the aircraft home in one piece.');
 else notify(G,def.contact,EXPANSION_STEPS[c.id][c.stage]);
 G.waypoint=expansionJobTarget(G,c);G.gps=null;return false;
}
export const EXPANSION_DEBRIEFS={airdrop:'Three drives, three receivers. The evidence is outside the Palace network. Neural has the receipt from every drop.',circuit:'Fire has the telemetry. The missing minutes were enough: the Palace courier could make the vault before the alarm.',canal:'Three bridges, one ledger. Hunter has the dock records; the Palace cannot erase a river.',casino:'The house paid twice for the same silence. Vera has both receipts. Gold Mage knows you kept a copy.',airlift:'Pinewatch and Sierra are broadcasting. Crown City can finally hear itself above the Palace signal.',nightline:'The witness and the duplicate are safe. Chief has a timetable the Palace cannot rewrite.',coldsignal:'Neural has the uncut recording. Ice’s mountain channel is back on the air.',clockwork:'Steampunk found the missing nine minutes. The station logs put a Palace courier at the vault before the alarm.',ridge:'Mask has Fire’s drive. No camera saw the handoff. The desert still keeps a few secrets.'};
