/* Small, reusable PCM effects. Source nodes disconnect after use; no per-shot oscillator graph. */
export function createEffects(ctx,bus){
 const bank=new Map();let voices=0;
 const rate=24000;
 function sample(kind){
  if(bank.has(kind))return bank.get(kind);
  const durations={pistol:.18,smg:.22,shotgun:.45,impact:.23,metal:.45,reload:.32,water:.5,ui:.04};
  const dur=durations[kind]||.2,n=Math.ceil(rate*dur),buffer=ctx.createBuffer(1,n,rate),a=buffer.getChannelData(0);let low=0,seed=4147;
  for(let i=0;i<n;i++){
   const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;low+=.17*(noise-low);
   let x=0;
   if(kind==='pistol')x=(low*.65+Math.sin(t*2*Math.PI*(140-80*t))*.35)*Math.exp(-t*38)+noise*.12*Math.exp(-t*150);
   else if(kind==='smg')x=(noise*.55+low*.2+Math.sin(t*2*Math.PI*95)*.25)*Math.exp(-t*31);
   else if(kind==='shotgun')x=(noise*.35+low*.45+Math.sin(t*2*Math.PI*65)*.3)*Math.exp(-t*13);
   else if(kind==='impact')x=(low*.4+Math.sin(2*Math.PI*(72*t-40*t*t))*.6)*Math.exp(-t*20);
   else if(kind==='metal')x=(noise*.45+Math.sin(t*2*Math.PI*890)*.08+Math.sin(t*2*Math.PI*1371)*.07+Math.sin(t*2*Math.PI*65)*.4)*Math.exp(-t*14);
   else if(kind==='reload'){const e=Math.exp(-t*70)+.7*Math.exp(-Math.max(0,t-.13)*100)*(t>.13)+.5*Math.exp(-Math.max(0,t-.24)*90)*(t>.24);x=(noise*.5+Math.sin(t*2*Math.PI*620)*.15)*e;}
   else if(kind==='water')x=low*1.7*Math.sin(Math.min(1,t/.08)*Math.PI/2)*Math.exp(-t*7);
   else x=(low*.6+Math.sin(t*2*Math.PI*340)*.3)*Math.exp(-t*120);
   a[i]=Math.tanh(x)*Math.min(1,i/12)*Math.min(1,(n-i)/120);
  }bank.set(kind,buffer);return buffer;
 }
 return (kind,volume=.4,pan=0)=>{
  if(ctx.state!=='running'||voices>=12)return;voices++;
  const s=ctx.createBufferSource(),gain=ctx.createGain(),p=ctx.createStereoPanner?.();s.buffer=sample(kind);s.playbackRate.value=.96+Math.random()*.08;gain.gain.value=volume;
  s.connect(gain);if(p){p.pan.value=Math.max(-1,Math.min(1,pan));gain.connect(p);p.connect(bus);}else gain.connect(bus);
  s.onended=()=>{s.disconnect();gain.disconnect();p?.disconnect();voices--;};s.start();
 };
}
