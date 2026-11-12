/* Small, reusable PCM effects. Source nodes disconnect after use; no per-shot oscillator graph. */
const limit=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const WATER=new Set(['water','canal','pier']);
const WATER_PROBES=[[0,0],[-180,0],[180,0],[0,-180],[0,180],[-360,0],[360,0],[0,-360],[0,360]];
export function soundPosition(G,x,y,range=950,out={}){
 const P=G.player||{x:0,y:0},dx=x-P.x,dy=y-P.y,rot=G.cam?.rot||0;
 out.distance=Math.hypot(dx,dy);out.gain=Math.max(0,1-out.distance/range)**1.5;
 out.pan=limit((dx*Math.cos(rot)-dy*Math.sin(rot))/Math.max(160,range*.45),-.9,.9);return out;
}
// This query runs at a slower control rate than pitch/movement. It looks east
// and west too: the original north/south-only probe missed vertical canals.
export function sceneAcoustics(G,out={}){
 out.water=out.canal=out.traffic=out.crowd=out.trafficPan=0;out.siren=null;out.sirenDistance=1400;
 const P=G.player;if(!P||!['play','casino'].includes(G.scene))return out;
 if(G.surfaceAt)for(let i=0;i<WATER_PROBES.length;i++){
  const [dx,dy]=WATER_PROBES[i],surface=G.surfaceAt(P.x+dx,P.y+dy),weight=i===0?1:i<5?.8:.4;
  if(WATER.has(surface))out.water=Math.max(out.water,weight);
  if(surface==='canal')out.canal=Math.max(out.canal,weight);
 }
 let trafficWeight=0;const rot=G.cam?.rot||0,co=Math.cos(rot),sn=Math.sin(rot);
 for(const v of G.vehicles||[]){
  if(v===P||v.dead)continue;const dx=v.x-P.x,dy=v.y-P.y;
  if(Math.abs(dx)>1400||Math.abs(dy)>1400)continue;
  const distance=Math.hypot(dx,dy);
  if(v.siren&&distance<out.sirenDistance){out.siren=v;out.sirenDistance=distance;}
  if(v.traffic&&distance<700){const w=1-distance/700;trafficWeight+=w;out.trafficPan+=limit((dx*co-dy*sn)/500,-.8,.8)*w;}
 }
 out.traffic=limit(trafficWeight/5,0,1);out.trafficPan=trafficWeight?out.trafficPan/trafficWeight:0;
 let people=0;for(const p of G.peds||[])if(!p.dead&&!p.cityBoarded&&Math.abs(p.x-P.x)<480&&Math.abs(p.y-P.y)<480)people++;
 out.crowd=limit(people/20,0,1);return out;
}
export function railMotion(phase,p=0){
 const t=limit(p,0,1),smooth=t*t*(3-2*t);
 return phase==='riding'?1:phase==='departing'?smooth:phase==='approach'||phase==='arriving'?1-smooth:0;
}
export function impactProfile(speed,material='body'){
 if(!Number.isFinite(speed)||speed<18)return null;
 const strength=limit((speed-18)/240,0,1),kind={body:'crumple',concrete:'bumper',hull:'hull',gravel:'gravel',water:'water'}[material]||'bumper';
 return {kind,volume:.10+Math.sqrt(strength)*.42,rate:1.12-strength*.28,water:material==='hull'&&strength>.22?.07+strength*.13:0};
}
// Contact manifolds can fire every physics tick. A resting scrape must not turn
// into a machine gun of crash sounds, or consume the whole effect voice budget.
export function createContactPlayer(clock,play){
 const bodies=new WeakMap();let last=-Infinity;
 return (event={})=>{
  const profile=impactProfile(event.speed,event.material);if(!profile)return false;
  const t=clock(),source=event.source&&typeof event.source==='object'?event.source:null,previous=source&&bodies.get(source);
  if(t-last<.055||previous&&t-previous.time<.22&&event.speed<previous.speed*1.6)return false;
  const gain=limit(Number.isFinite(event.gain)?event.gain:1,0,1),pan=limit(Number.isFinite(event.pan)?event.pan:0,-1,1);
  if(gain<.01||play(profile.kind,profile.volume*gain,pan,profile.rate)===false)return false;
  if(profile.water)play('water',profile.water*gain,pan,.91);
  last=t;if(source)bodies.set(source,{time:t,speed:event.speed});return true;
 };
}
export function surfaceMotion(v,surface='road',wet=0,out={}){
 out.roll=out.tyre=out.wake=0;out.frequency=600;
 if(v.type!=='veh'||v.def?.aircraft&&v.altitude>4)return out;
 const speed=Math.hypot(v.vx||0,v.vy||0),moving=limit((speed-12)/230,0,1);
 if(v.def?.boat){out.wake=moving*.14;out.frequency=650+moving*1500;return out;}
 if(surface==='water'||surface==='canal')return out;
 const loose=surface==='sand'||surface==='grass'||surface==='dirt',side=Math.abs((v.vx||0)*Math.cos(v.rot||0)+(v.vy||0)*Math.sin(v.rot||0));
 out.roll=moving*(loose?.10:.025)+moving*limit(wet,0,1)*.045;out.frequency=loose?850:350+moving*450;
 out.tyre=loose?0:limit((side-45)/140,0,1)*.18;return out;
}
// Reverse is one continuous gear, including the mobile brake-to-reverse input.
// Its engine should gain load as it accelerates, not sound like a held brake.
export function engineMotion(v,input={},out={}){
 const speed=Math.hypot(v.vx||0,v.vy||0),top=v.def?.max||300,k=Math.min(1,speed/top);
 const forward=(v.vx||0)*Math.sin(v.rot||0)-(v.vy||0)*Math.cos(v.rot||0);
 out.reverse=forward < -3||!!v.brakeReverse&&speed<15;
 out.load=input.brake&&!v.brakeReverse?0:Math.abs(input.y||0)>.1||input.touchJoy?.active||v.brakeReverse?1:.55;
 const gear=Math.min(3,(k*4)|0),inGear=k*4-gear;
 out.rpm=v.def?.boat?.22+.68*k+.10*out.load:out.reverse?(.25+.70*Math.min(1,speed/(top*.32)))*(.7+.3*out.load):.25+.75*(gear===0?k*4:.35+.65*inGear)*(.7+.3*out.load);
 return out;
}
export function createEffects(ctx,bus){
 const bank=new Map(),variations=new Map();let voices=0;
 const rate=24000,TAU=Math.PI*2;
 const durations={rocket:.65,explosion:1.8,raceCount:.16,raceGo:.46,raceGate:.18,raceFinish:.9,raceInvalid:.3,pitService:.65,reelStop:.12,pistol:.18,smg:.22,shotgun:.45,impact:.23,metal:.45,crumple:.48,bumper:.27,hull:.38,gravel:.3,reload:.32,water:.5,ui:.04,doors:1.2,depart:1.5,rail:.75,arrive:.9,platform:.85,card:.16,chips:.28,casinoWin:.75,casinoLose:.38,casinoPush:.42,casinoOpen:.55,stepHard:.09,stepLoose:.1,stepWood:.11,horn:.34,dog:.28,cat:.35,gull:.45,pigeon:.36,deer:.2,fox:.22};
 const varied=new Set(['pistol','smg','shotgun','crumple','bumper','hull','gravel','water','card','chips','stepHard','stepLoose','stepWood']);
 function sample(kind){
  const varying=varied.has(kind),variant=varying?(variations.get(kind)||0)%3:0,key=kind+variant;
  if(varying)variations.set(kind,variant+1);if(bank.has(key))return bank.get(key);
  const dur=durations[kind],n=Math.ceil(rate*dur),buffer=ctx.createBuffer(1,n,rate),a=buffer.getChannelData(0);let low=0,seed=4147+variant*977;
  for(let i=0;i<n;i++){
   const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=.17*(noise-low);
   let x=0;
   if(kind==='rocket')x=(low*.6+Math.sin(TAU*(95*t-35*t*t))*.4)*Math.exp(-t*13)+noise*.16*Math.sin(Math.PI*t/dur)**2;
   else if(kind==='explosion')x=(low*.85+Math.sin(TAU*(52*t-8*t*t))*.65)*Math.exp(-t*4.3)+noise*.25*Math.exp(-t*26)+low*.16*Math.sin(t*37)**8*Math.exp(-t*2.8);
   else if(kind==='pistol')x=(low*.65+Math.sin(t*2*Math.PI*(140-80*t))*.35)*Math.exp(-t*38)+noise*.12*Math.exp(-t*150);
   else if(kind==='smg')x=(noise*.55+low*.2+Math.sin(t*2*Math.PI*95)*.25)*Math.exp(-t*31);
   else if(kind==='shotgun')x=(noise*.35+low*.45+Math.sin(t*2*Math.PI*65)*.3)*Math.exp(-t*13);
   else if(kind==='impact')x=(low*.4+Math.sin(2*Math.PI*(72*t-40*t*t))*.6)*Math.exp(-t*20);
   else if(kind==='metal')x=(noise*.45+Math.sin(t*2*Math.PI*890)*.08+Math.sin(t*2*Math.PI*1371)*.07+Math.sin(t*2*Math.PI*65)*.4)*Math.exp(-t*14);
   else if(kind==='crumple')x=(low*.65+Math.sin(TAU*(62*t-19*t*t))*.5)*Math.exp(-t*14)+noise*.12*Math.exp(-t*32)*(1+.4*Math.sin(t*173));
   else if(kind==='bumper')x=(low*.5+Math.sin(TAU*(85*t-45*t*t))*.55)*Math.exp(-t*25)+noise*.06*Math.exp(-t*85);
   else if(kind==='hull')x=(Math.sin(TAU*104*t)*.4+Math.sin(TAU*211*t)*.12+low*.4)*Math.exp(-t*17);
   else if(kind==='gravel')x=(low*.6+noise*.2)*Math.exp(-t*12)*(1+.3*Math.sin(t*270));
   else if(kind==='reload'){const e=Math.exp(-t*70)+.7*Math.exp(-Math.max(0,t-.13)*100)*(t>.13)+.5*Math.exp(-Math.max(0,t-.24)*90)*(t>.24);x=(noise*.5+Math.sin(t*2*Math.PI*620)*.15)*e;}
   else if(kind==='doors'){const chime=t<.55?(Math.sin(TAU*659*t)+.5*Math.sin(TAU*988*t))*Math.exp(-(t%.27)*14)*.25:0;x=chime+(t>.55?low*.4*Math.sin(Math.PI*(t-.55)/.65):0);}
   else if(kind==='depart')x=(Math.sin(TAU*(90*t+60*t*t))*.13+low*.2)*Math.sin(Math.PI*t/dur);
   else if(kind==='rail')x=(low*.35+Math.sin(TAU*62*t)*.14)*Math.exp(-t*2)*(.45+.55*Math.pow(Math.max(0,Math.cos(t*TAU*7)),8));
   else if(kind==='arrive')x=(Math.sin(TAU*(850*t-320*t*t))*.13+low*.2)*Math.sin(Math.PI*t/dur)**2;
   else if(kind==='platform'){const note=t<.38?659:880,tt=t<.38?t:t-.38;x=(Math.sin(TAU*note*tt)+.18*Math.sin(TAU*note*2*tt))*.21*Math.exp(-tt*8);}
   else if(kind==='raceCount'||kind==='raceGo'||kind==='raceGate'){const f=kind==='raceGo'?880:kind==='raceGate'?1175:440;x=(Math.sin(TAU*f*t)+.12*Math.sin(TAU*f*2*t))*.22*Math.sin(Math.PI*t/dur)**2;}
   else if(kind==='raceFinish'){const notes=[523,659,784,1047],k=Math.min(3,Math.floor(t/.18)),tt=t-k*.18;x=(Math.sin(TAU*notes[k]*tt)+.12*Math.sin(TAU*notes[k]*2*tt))*.22*Math.exp(-tt*9)*Math.min(1,tt*120);}
   else if(kind==='raceInvalid')x=Math.sin(TAU*(330*t-140*t*t))*.14*Math.sin(Math.PI*t/dur)**2;
   else if(kind==='pitService')x=(low*.18+Math.sin(TAU*(130*t+90*t*t))*.12)*Math.sin(Math.PI*t/dur)**2;
   else if(kind==='reelStop')x=(low*.3+Math.sin(TAU*730*t)*.18+Math.sin(TAU*1300*t)*.08)*Math.exp(-t*42)*Math.min(1,t*250);
   else if(kind==='card')x=(noise-low)*.26*Math.sin(Math.PI*t/dur)**2+low*.3*Math.exp(-Math.max(0,t-.105)*60)*(t>.105);
   else if(kind==='chips'){const hit=Math.exp(-t*65)+(t>.065?.6*Math.exp(-(t-.065)*80):0)+(t>.13?.4*Math.exp(-(t-.13)*80):0);x=(Math.sin(TAU*1630*t)*.17+Math.sin(TAU*2480*t)*.08+noise*.2)*hit;}
   else if(kind==='casinoWin'||kind==='casinoOpen'){const notes=kind==='casinoWin'?[659,824,988]:[392,494,587],k=Math.min(2,Math.floor(t/.14)),tt=t-k*.14;x=(Math.sin(TAU*notes[k]*tt)+.18*Math.sin(TAU*notes[k]*2*tt))*.24*Math.exp(-tt*7);}
   else if(kind==='casinoLose')x=(Math.sin(TAU*(220*t-55*t*t))*.18+low*.05)*Math.sin(Math.PI*t/dur)*Math.exp(-t*5);
   else if(kind==='casinoPush')x=(Math.sin(TAU*440*t)+.2*Math.sin(TAU*660*t))*.19*Math.exp(-t*10);
   else if(kind==='stepHard')x=(low*.65+Math.sin(TAU*130*t)*.35)*Math.exp(-t*45)+noise*.07*Math.exp(-t*85);
   else if(kind==='stepLoose')x=(noise*.27+low*.5)*Math.exp(-t*32);
   else if(kind==='stepWood')x=(Math.sin(TAU*188*t)*.45+Math.sin(TAU*301*t)*.12+low*.3)*Math.exp(-t*40);
   else if(kind==='horn')x=(Math.sin(TAU*392*t)+Math.sin(TAU*494*t)+.18*Math.sin(TAU*784*t))*.25*Math.min(1,t*40)*Math.min(1,(dur-t)*20);
   else if(kind==='dog'||kind==='fox')x=(Math.sin(TAU*(150*t+5*Math.sin(t*25)))+low*.7)*Math.exp(-t*18)*.35;
   else if(kind==='cat')x=Math.sin(TAU*(550*t+35*t*t)+2*Math.sin(TAU*110*t))*Math.sin(Math.PI*t/dur)*.22;
   else if(kind==='gull'||kind==='pigeon')x=Math.sin(TAU*((kind==='gull'?1500:430)*t+130*t*t)+.4*Math.sin(TAU*37*t))*Math.sin(Math.PI*t/dur)*.2;
   else if(kind==='deer')x=low*.5*Math.exp(-t*18);
   else if(kind==='water')x=low*1.7*Math.sin(Math.min(1,t/.08)*Math.PI/2)*Math.exp(-t*7);
   else x=(low*.6+Math.sin(t*2*Math.PI*340)*.3)*Math.exp(-t*120);
   a[i]=Math.tanh(x)*Math.min(1,i/12)*Math.min(1,(n-i)/120);
  }bank.set(key,buffer);return buffer;
 }
 const play=(kind,volume=.4,pan=0,pitch=1)=>{
  if(ctx.state!=='running'||voices>=12||!Number.isFinite(volume)||volume<=0)return false;voices++;
  if(!Object.hasOwn(durations,kind))kind='ui';
  const s=ctx.createBufferSource(),gain=ctx.createGain(),p=ctx.createStereoPanner?.();s.buffer=sample(kind);s.playbackRate.value=limit(Number.isFinite(pitch)?pitch:1,.7,1.4)*(.97+Math.random()*.06);gain.gain.value=Math.min(.8,volume);
  s.connect(gain);if(p){p.pan.value=Number.isFinite(pan)?Math.max(-1,Math.min(1,pan)):0;gain.connect(p);p.connect(bus);}else gain.connect(bus);
  s.onended=()=>{s.disconnect();gain.disconnect();p?.disconnect();voices--;};s.start();return true;
 };
 play.stats=()=>({voices,buffers:bank.size,bytes:[...bank.values()].reduce((n,b)=>n+b.length*4,0)});return play;
}
