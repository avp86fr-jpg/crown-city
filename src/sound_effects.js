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
 return {kind,volume:.10+Math.sqrt(strength)*.42,rate:1.12-strength*.28,water:material==='hull'&&strength>.22?.07+strength*.13:0,heavy:strength>.6?(strength-.6)*.75:0};
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
  // Small pitch jitter so repeated hits never sound cloned.
  const jitter=1+(((t*7919)%1)-.5)*.09;
  // Mass: heavier bodies hit lower and fuller (bus ~1.8 drops ~14%, a bike ~0.6 rises ~13%).
  const mass=limit(Number.isFinite(event.mass)?event.mass:1,.4,4),weight=Math.pow(mass,-.25),body=Math.min(1.35,.8+.2*mass);
  if(gain<.01||play(profile.kind,Math.min(1,profile.volume*gain*body),pan,profile.rate*jitter*weight)===false)return false;
  if(profile.water)play('water',profile.water*gain,pan,.91);
  // Heavy road crashes get weight: a low second crumple and a glass tail.
  if(profile.heavy>0&&(event.material==='body'||event.material==='concrete')){play('crumple',Math.min(1,profile.heavy*gain*body),pan,.62*jitter*weight);if(profile.heavy>.12)play('glass',profile.heavy*.55*gain,pan,.9+(((t*104729)%1)*.2));}
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
// Gunfire and impacts, layered per weapon: transient crack, body, low punch,
// mechanism. Each returns one sample value; null means "not a weapon sound".
const TWO_PI=Math.PI*2;
export function weaponSample(kind,t,noise,low,dur,variant=0){
 const e=(k,d=0)=>t<d?0:Math.exp(-(t-d)*k),sw=(f0,f1,k)=>Math.sin(TWO_PI*(f0*t+(f1-f0)*(1-Math.exp(-t*k))/k));
 const v=1+variant*.04;
 switch(kind){
  // Suppressed .45: slide clack + soft "thup", no supersonic crack.
  case 'pistol':return (low*1.1*e(55)+sw(150*v,70,30)*.55*e(42)+noise*.22*e(260)+Math.sin(TWO_PI*3100*t)*.16*e(380,.012)+noise*.12*e(300,.012))*.95;
  // SMG: sharp crack, chesty body, quick mechanical rattle.
  case 'smg':return noise*.75*e(210)+low*.95*e(30)+sw(140*v,62,40)*.55*e(36)+Math.sin(TWO_PI*2350*t)*.12*e(260,.028)+noise*.18*e(160,.028);
  // Shotgun: huge transient, low boom, long body, pump shuck late.
  case 'shotgun':return noise*.95*e(95)+sw(95*v,42,9)*.95*e(8.5)+low*1.25*e(6.5)+noise*.12*e(40)*Math.sin(TWO_PI*7*t)**2+(noise*.3+Math.sin(TWO_PI*1700*t)*.1)*e(70,.42)+(noise*.25)*e(80,.5);
  // Street slapback: three filtered reflections off buildings.
  case 'echo':return low*(.55*e(28,.075)+.38*e(24,.19)+.22*e(18,.36)+.1*e(9,.55))*1.4;
  // A shot several blocks away: no crack, just a rolling low thump.
  case 'distant':return (low*1.2+sw(80*v,40,6)*.35)*e(9)*Math.min(1,t*90)+low*.35*e(5,.18);
  case 'dryfire':return (Math.sin(TWO_PI*2900*t)*.5+noise*.4)*e(650)+(Math.sin(TWO_PI*2100*t)*.3+noise*.2)*e(700,.04);
  case 'ricochet':return noise*.5*e(140)+Math.sin(TWO_PI*(3300*v*t-2300*t*t))*.26*e(8)*Math.min(1,t*60);
  case 'metalHit':return (Math.sin(TWO_PI*1830*v*t)*.32+Math.sin(TWO_PI*2710*v*t)*.2+Math.sin(TWO_PI*930*t)*.25)*e(26)+noise*.55*e(170);
  case 'flesh':return (low*1.3+Math.sin(TWO_PI*95*t)*.5)*e(34)+noise*.16*e(90);
  case 'hitmark':return Math.sin(TWO_PI*2350*t)*.45*e(85);
  case 'killmark':return Math.sin(TWO_PI*1560*t)*.38*e(26)+Math.sin(TWO_PI*2340*t)*.22*e(22,.05)+low*.5*e(30);
  case 'casing':return (Math.sin(TWO_PI*5200*v*t)*.2+Math.sin(TWO_PI*7350*t)*.12)*(e(55)+.6*e(70,.085)+.35*e(80,.15));
  case 'glass':return noise*.45*e(30)*(.5+.5*Math.sin(TWO_PI*37*t)**2)+Math.sin(TWO_PI*4200*t)*.12*e(14);
  case 'backfire':return (noise*.8*e(120)+low*1.2*e(40)+sw(120*v,60,30)*.4*e(50))*(1+.5*e(200,.05)*(noise>0?1:-1));
  case 'clank':return (Math.sin(TWO_PI*420*v*t)*.3+Math.sin(TWO_PI*1130*v*t)*.18+Math.sin(TWO_PI*1710*t)*.1)*e(9)+noise*.3*e(80)+(Math.sin(TWO_PI*560*t)*.18)*e(12,.18);
  case 'foghorn':return (Math.sin(TWO_PI*92*t)*.5+Math.sin(TWO_PI*184*t)*.25+Math.sin(TWO_PI*276*t)*.1+low*.2)*Math.min(1,t*6)*Math.min(1,(dur-t)*2.5);
  case 'jetFar':return (low*1.1+noise*.08)*Math.sin(Math.PI*t/dur)**2;
  case 'skidChirp':return (Math.sin(TWO_PI*(1150*t+40*Math.sin(TWO_PI*31*t)))*.3+noise*.2)*Math.sin(Math.PI*t/dur);
 }
 return null;
}
export function createEffects(ctx,bus){
 const bank=new Map(),variations=new Map();let voices=0;
 const rate=24000,TAU=Math.PI*2;
 const durations={calliopeA:2.4,calliopeB:2.4,coaster:2.2,screams:1.4,surf:2.8,marinaBell:1.6,rocket:.65,explosion:1.8,raceCount:.16,raceGo:.46,raceGate:.18,raceFinish:.9,raceInvalid:.3,pitService:.65,reelStop:.12,pistol:.2,smg:.24,shotgun:.62,echo:.9,distant:.7,dryfire:.09,ricochet:.36,metalHit:.22,flesh:.16,hitmark:.07,killmark:.16,casing:.26,glass:.4,skidChirp:.25,backfire:.2,clank:.5,foghorn:2.2,jetFar:2.6,impact:.23,metal:.45,crumple:.48,bumper:.27,hull:.38,gravel:.3,reload:.32,water:.5,ui:.04,doors:1.2,depart:1.5,rail:.75,arrive:.9,platform:.85,card:.16,chips:.28,casinoWin:.75,casinoLose:.38,casinoPush:.42,casinoOpen:.55,stepHard:.09,stepLoose:.1,stepWood:.11,stepSnow:.16,stepWater:.2,blowoff:.32,door:.22,doorShut:.18,horn:.34,dog:.28,cat:.35,gull:.45,pigeon:.36,deer:.2,fox:.22};
 const varied=new Set(['pistol','smg','shotgun','ricochet','metalHit','flesh','casing','echo','crumple','bumper','hull','gravel','water','card','chips','stepHard','stepLoose','stepWood','stepSnow','stepWater','door']);
 // Loudness trims from an offline RMS sweep (tools/sfx-loudness.mjs): footsteps on soft ground and the
 // casino loss sting sat 4-7 dB under their siblings.
 const TRIM={stepSnow:1.6,stepWater:1.5,casinoLose:1.8,casinoPush:1.3,blowoff:1.3};
 function sample(kind){const trim=TRIM[kind]||1;
  const varying=varied.has(kind),variant=varying?(variations.get(kind)||0)%3:0,key=kind+variant;
  if(varying)variations.set(kind,variant+1);if(bank.has(key))return bank.get(key);
  const dur=durations[kind],n=Math.ceil(rate*dur),buffer=ctx.createBuffer(1,n,rate),a=buffer.getChannelData(0);let low=0,seed=4147+variant*977;
  for(let i=0;i<n;i++){
   const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=.17*(noise-low);
   let x=0;
   const wx=weaponSample(kind,t,noise,low,dur,variant);
   if(wx!==null)x=wx;
   else if(kind==='rocket')x=(low*.6+Math.sin(TAU*(95*t-35*t*t))*.4)*Math.exp(-t*13)+noise*.16*Math.sin(Math.PI*t/dur)**2;
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
   // snow: compressed crunch, granular bursts with a soft low body
   else if(kind==='stepSnow'){const g=(Math.sin(t*900)>.2?1:.35)*(Math.sin(t*2300+1)>0?1:.6);x=(noise*.32*g+low*.22)*Math.min(1,t*90)*Math.exp(-t*14);}
   else if(kind==='stepWater')x=(noise*.2*Math.sin(Math.PI*Math.min(1,t/.06))+Math.sin(TAU*(420-900*t)*t)*.12+low*.25)*Math.exp(-t*12);
   // turbo blow-off: bright breathy hiss with a falling whistle
   else if(kind==='blowoff')x=(noise*.32+Math.sin(TAU*(3400*t-2600*t*t))*.06)*Math.min(1,t*70)*Math.exp(-t*9);
   else if(kind==='door')x=(Math.sin(TAU*95*t)*.5+low*.45+noise*.12*Math.exp(-t*60))*Math.min(1,t*300)*Math.exp(-t*22)+(t>.11?(noise*.1+low*.3)*Math.exp(-(t-.11)*40):0);
   else if(kind==='doorShut')x=(Math.sin(TAU*72*t)*.6+low*.55+noise*.08)*Math.min(1,t*400)*Math.exp(-t*26);
   else if(kind==='stepWood')x=(Math.sin(TAU*188*t)*.45+Math.sin(TAU*301*t)*.12+low*.3)*Math.exp(-t*40);
   else if(kind==='horn')x=(Math.sin(TAU*392*t)+Math.sin(TAU*494*t)+.18*Math.sin(TAU*784*t))*.25*Math.min(1,t*40)*Math.min(1,(dur-t)*20);
   else if(kind==='dog'||kind==='fox')x=(Math.sin(TAU*(150*t+5*Math.sin(t*25)))+low*.7)*Math.exp(-t*18)*.35;
   else if(kind==='cat')x=Math.sin(TAU*(550*t+35*t*t)+2*Math.sin(TAU*110*t))*Math.sin(Math.PI*t/dur)*.22;
   else if(kind==='calliopeA'||kind==='calliopeB'){const mel=kind==='calliopeA'?[523,659,784,659,880,784,659,587,523,587,659,523]:[587,698,880,698,988,880,784,698,659,587,659,784],k=Math.min(11,Math.floor(t/.2)),tt=t-k*.2,f=mel[k],bass=[131,196,165,196][Math.floor(t/.6)%4],bt=t%.6;
    x=(Math.sin(TAU*f*tt)*.5+Math.sin(TAU*f*2*tt)*.22+Math.sin(TAU*f*3*tt)*.1)*Math.exp(-tt*5)*Math.min(1,tt*300)*.42+(Math.sin(TAU*bass*bt)*.3+Math.sin(TAU*bass*2*bt)*.1)*Math.exp(-bt*6)*(bt<.3?1:.35)*.5+(t%.6>.3?Math.sin(TAU*bass*1.5*(t%.3))*.08*Math.exp(-(t%.3)*12):0);}
   else if(kind==='coaster'){const clack=Math.pow(Math.max(0,Math.cos(TAU*t*9)),24);x=(low*.75+Math.sin(TAU*(48+12*Math.sin(t*3))*t)*.25)*Math.sin(Math.PI*t/dur)+noise*.25*clack*Math.sin(Math.PI*t/dur);}
   else if(kind==='screams'){let v=0;for(let j=0;j<4;j++){const f0=900+j*230+180*Math.sin(t*(7+j)+j);v+=Math.sin(TAU*f0*t+3*Math.sin(TAU*(6+j)*t))*Math.max(0,Math.sin(Math.PI*(t-j*.08)/(dur-.2)));}x=(v*.09+noise*.06*Math.sin(Math.PI*t/dur))*Math.sin(Math.PI*t/dur);}
   else if(kind==='surf'){const swell=Math.sin(Math.PI*Math.min(1,t/1.1)/2)*Math.exp(-Math.max(0,t-1.1)*1.6);x=(low*1.25+noise*.22*Math.exp(-Math.abs(t-1.15)*4))*swell;}
   else if(kind==='marinaBell'){x=(Math.sin(TAU*1046*t)*.3+Math.sin(TAU*2093*t)*.12+Math.sin(TAU*1568*t)*.08)*Math.exp(-t*3)*(.6+.4*Math.cos(TAU*3*t));}
   else if(kind==='gull'||kind==='pigeon')x=Math.sin(TAU*((kind==='gull'?1500:430)*t+130*t*t)+.4*Math.sin(TAU*37*t))*Math.sin(Math.PI*t/dur)*.2;
   else if(kind==='deer')x=low*.5*Math.exp(-t*18);
   else if(kind==='water')x=low*1.7*Math.sin(Math.min(1,t/.08)*Math.PI/2)*Math.exp(-t*7);
   else x=(low*.6+Math.sin(t*2*Math.PI*340)*.3)*Math.exp(-t*120);
   a[i]=Math.tanh(x*trim)*Math.min(1,i/12)*Math.min(1,(n-i)/120);
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
