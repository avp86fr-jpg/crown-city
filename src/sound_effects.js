/* Small, reusable PCM effects. Source nodes disconnect after use; no per-shot oscillator graph. */
const limit=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
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
 const loose=surface==='sand'||surface==='grass',side=Math.abs((v.vx||0)*Math.cos(v.rot||0)+(v.vy||0)*Math.sin(v.rot||0));
 out.roll=moving*(loose?.10:.025)+moving*limit(wet,0,1)*.045;out.frequency=loose?850:350+moving*450;
 out.tyre=loose?0:limit((side-45)/140,0,1)*.18;return out;
}
export function createEffects(ctx,bus){
 const bank=new Map(),variations=new Map();let voices=0;
 const rate=24000,TAU=Math.PI*2;
 const durations={pistol:.18,smg:.22,shotgun:.45,impact:.23,metal:.45,crumple:.48,bumper:.27,hull:.38,gravel:.3,reload:.32,water:.5,ui:.04,doors:1.2,depart:1.5,rail:.75,dog:.28,cat:.35,gull:.45,pigeon:.36,deer:.2,fox:.22};
 function sample(kind){
  const varying=['pistol','smg','shotgun','crumple','bumper','hull','gravel','water'].includes(kind),variant=varying?(variations.get(kind)||0)%3:0,key=kind+variant;
  if(varying)variations.set(kind,variant+1);if(bank.has(key))return bank.get(key);
  const dur=durations[kind],n=Math.ceil(rate*dur),buffer=ctx.createBuffer(1,n,rate),a=buffer.getChannelData(0);let low=0,seed=4147+variant*977;
  for(let i=0;i<n;i++){
   const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=.17*(noise-low);
   let x=0;
   if(kind==='pistol')x=(low*.65+Math.sin(t*2*Math.PI*(140-80*t))*.35)*Math.exp(-t*38)+noise*.12*Math.exp(-t*150);
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
   else if(kind==='dog'||kind==='fox')x=(Math.sin(TAU*(150*t+5*Math.sin(t*25)))+low*.7)*Math.exp(-t*18)*.35;
   else if(kind==='cat')x=Math.sin(TAU*(550*t+35*t*t)+2*Math.sin(TAU*110*t))*Math.sin(Math.PI*t/dur)*.22;
   else if(kind==='gull'||kind==='pigeon')x=Math.sin(TAU*((kind==='gull'?1500:430)*t+130*t*t)+.4*Math.sin(TAU*37*t))*Math.sin(Math.PI*t/dur)*.2;
   else if(kind==='deer')x=low*.5*Math.exp(-t*18);
   else if(kind==='water')x=low*1.7*Math.sin(Math.min(1,t/.08)*Math.PI/2)*Math.exp(-t*7);
   else x=(low*.6+Math.sin(t*2*Math.PI*340)*.3)*Math.exp(-t*120);
   a[i]=Math.tanh(x)*Math.min(1,i/12)*Math.min(1,(n-i)/120);
  }bank.set(key,buffer);return buffer;
 }
 return (kind,volume=.4,pan=0,pitch=1)=>{
  if(ctx.state!=='running'||voices>=12||!Number.isFinite(volume)||volume<=0)return false;voices++;
  if(!Object.hasOwn(durations,kind))kind='ui';
  const s=ctx.createBufferSource(),gain=ctx.createGain(),p=ctx.createStereoPanner?.();s.buffer=sample(kind);s.playbackRate.value=limit(pitch,.7,1.4)*(.97+Math.random()*.06);gain.gain.value=Math.min(.8,volume);
  s.connect(gain);if(p){p.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(p);p.connect(bus);}else gain.connect(bus);
  s.onended=()=>{s.disconnect();gain.disconnect();p?.disconnect();voices--;};s.start();return true;
 };
}
