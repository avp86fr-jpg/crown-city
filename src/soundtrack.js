/* Original arranged radio tracks. Streamed rather than keeping decoded songs in RAM. */
export const TRACKS=[
 {file:'veil-afterhours.ogg',title:'AFTERHOURS / CROWN CITY HOUSE BAND',station:'VEIL FM 98.6'},
 {file:'chip-sidewalk.ogg',title:'SIDEWALK STORIES / SOUTHBOUND',station:'CHIP RADIO 104.2'},
 {file:'nightshift-escape.ogg',title:'NO CLEAN EXIT / THE NIGHT SHIFT',station:'NIGHT SHIFT 107.7'},
];
export function createSoundtrack(ctx,bus){
 const channels=[];let started=false,selected=0;
 for(const track of TRACKS){
  const el=new Audio();el.preload='none';el.loop=true;el.src=new URL('../assets/music/'+track.file,import.meta.url).href;
  const gain=ctx.createGain();gain.gain.value=0;const source=ctx.createMediaElementSource(el);source.connect(gain);gain.connect(bus);
  const channel={el,gain,ready:false,error:false,level:-1};
  el.addEventListener('playing',()=>{channel.ready=true;channel.error=false;});
  el.addEventListener('error',()=>{channel.error=true;channel.ready=false;});channels.push(channel);
 }
 function start(){
  started=true;
  for(const c of channels)if(c.el.paused&&!c.error)c.el.play().catch(()=>{c.ready=false;});
 }
 function update(G,station){
  if(!started)return false;
  selected=G.scene==='play'&&G.wanted>=3?2:station%channels.length;
  const ready=channels[selected].ready&&!channels[selected].error;
  const level=document.hidden?0:['pause','map','settings','crew','garage'].includes(G.scene)?.16:G.scene==='vn'?.28:G.scene==='brief'?.4:.8;
  channels.forEach((c,i)=>{
   const target=ready&&i===selected?level:0;
   if(c.level!==target){c.level=target;c.gain.gain.cancelScheduledValues(ctx.currentTime);c.gain.gain.setTargetAtTime(target,ctx.currentTime,.65);}
  });
  return ready;
 }
 function silence(){channels.forEach(c=>{c.gain.gain.cancelScheduledValues(ctx.currentTime);c.gain.gain.setTargetAtTime(0,ctx.currentTime,.1);c.level=-1;});}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();});
 return {start,update,get title(){return TRACKS[selected].title;},get playing(){return channels[selected].ready;}};
}
