/* Original score, with a two-stream crossfade budget and paused inactive stations. */
export const TRACKS=[
 {file:'veil-afterhours.ogg',title:'AFTERHOURS / CROWN CITY HOUSE BAND',station:'VEIL FM 98.6'},
 {file:'chip-sidewalk.ogg',title:'SIDEWALK STORIES / SOUTHBOUND',station:'CHIP RADIO 104.2'},
 {file:'nightshift-escape.ogg',title:'NO CLEAN EXIT / THE NIGHT SHIFT',station:'NIGHT SHIFT 107.7'},
 {file:'crown-midnight.ogg',title:'MIDNIGHT RECEIPTS / THE CROWN SESSIONS',station:'CITY SCORE'},
];
export function createSoundtrack(ctx,bus){
 const channels=[];let started=false,selected=3,previous=-1,lastScene='title';
 function channel(index){
  if(channels[index])return channels[index];
  const track=TRACKS[index],el=new Audio();el.preload='none';el.loop=true;
  const supported=typeof el.canPlayType!=='function'||el.canPlayType('audio/ogg; codecs="vorbis"');
  el.src=new URL('../assets/music/'+track.file.replace(/\.ogg$/,supported?'.ogg':'.mp3'),import.meta.url).href;
  const gain=ctx.createGain();gain.gain.value=0;const source=ctx.createMediaElementSource(el);source.connect(gain);gain.connect(bus);
  const c={el,gain,ready:false,error:false,level:-1,stopAt:Infinity,pending:false};
  el.addEventListener('playing',()=>{c.ready=true;c.pending=false;c.error=false;});
  el.addEventListener('error',()=>{c.error=true;c.ready=false;c.pending=false;});channels[index]=c;return c;
 }
 function play(c){if(c.pending||!c.el.paused||c.error)return;c.pending=true;c.el.play().catch(()=>{c.pending=false;c.ready=false;});}
 function start(){started=true;if(!document.hidden)play(channel(selected));}
 function fade(c,value,seconds=.45){if(c.level===value)return;c.level=value;c.gain.gain.cancelScheduledValues(ctx.currentTime);c.gain.gain.setTargetAtTime(value,ctx.currentTime,seconds/3);}
 function update(G,station){
  if(!started)return false;lastScene=G.scene;
  const wanted=G.scene==='play'&&G.wanted>=2?2:G.scene==='play'&&G.player?.type==='veh'?station%3:3;
  if(wanted!==selected){previous=selected;selected=wanted;for(let i=0;i<channels.length;i++)if(channels[i]&&i!==selected&&i!==previous){fade(channels[i],0,.06);channels[i].el.pause();}}
  if(document.hidden)return false;
  const current=channel(selected);play(current);
  const ready=current.ready&&!current.el.paused&&!current.error;
  const level=['pause','map','settings','crew','garage','dossier'].includes(G.scene)?.13:G.scene==='vn'?.22:G.scene==='brief'?.3:G.player?.type==='foot'?.45:.72;
  if(ready){fade(current,level);current.stopAt=Infinity;
   channels.forEach((c,i)=>{if(i===selected)return;fade(c,0);if(c.stopAt===Infinity)c.stopAt=ctx.currentTime+.65;if(ctx.currentTime>=c.stopAt&&!c.el.paused){c.el.pause();c.ready=false;}});
  }
  return ready;
 }
 function silence(){channels.forEach(c=>{fade(c,0,.08);c.el.pause();c.ready=false;c.pending=false;});}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silence();else if(started&&lastScene)play(channel(selected));});
 return {start,update,silence,get title(){return TRACKS[selected].title;},get playing(){return !!channels[selected]?.ready;},get activeStreams(){return channels.filter(c=>!c.el.paused).length;}};
}
