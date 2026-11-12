import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'.'),from=p=>import(pathToFileURL(path.join(root,p)));
const {harness}=await from('tests/harness.js'),{circuitPilot,startCircuit,tickCircuit}=await from('src/motorsport.js'),{CIRCUIT,nearestTrack}=await from('src/circuit_world.js');
const {G,T}=await harness();
for(const kind of ['riot','nyx']){
 T.startFreeRide(G);G.vehicles=[];G.peds=[];G.cops=[];G.wanted=0;G.wet=0;G.player=T.makeFoot(G,CIRCUIT.pit.x,CIRCUIT.pit.y,0);G.action.circuitClass='sport';
 startCircuit(G,G.circuitHooks);const car=G.player;Object.assign(car,{kind,def:T.makeVeh(kind,0,0,0).def,racerIndex:0});let max=0,sum=0,distance=0,frames=0;
 while(G.circuitSession.running&&frames++<60*240){const before={valid:G.circuitSession.valid,s:G.circuitSession.lastS,x:car.x,y:car.y};if(!G.circuitSession.countdown)T.tickDrive(G,car,circuitPilot(G,car,1/60),1/60,true);tickCircuit(G,1/60,G.circuitHooks);if(before.valid&&!G.circuitSession.valid)console.log('invalid',JSON.stringify({before,after:{s:G.circuitSession.lastS,x:car.x,y:car.y,distance:G.circuitSession.distance,off:G.circuitSession.off,health:car.health,player:G.player===car}}));T.tickCollisions(G);G.cam.x=car.x;G.cam.y=car.y;G.ticks++;const speed=Math.hypot(car.vx,car.vy);max=Math.max(max,speed);sum+=speed;distance=Math.max(distance,nearestTrack(car.x,car.y).d);}
 console.log(JSON.stringify({kind,time:G.circuitSession.time,valid:G.circuitSession.valid,maxKmh:max*.36,meanKmh:sum/frames*.36,maxTrackDistance:distance,health:car.health}));
}
