import {createEffects} from '../src/sound_effects.js';
const bufs=[];const node=()=>({connect(){},disconnect(){},start(){},stop(){},gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}},playbackRate:{value:1},pan:{value:0},frequency:{value:1},Q:{value:1},onended:null});
const ctx={state:'running',currentTime:0,sampleRate:24000,createBuffer(c,n,r){const d=new Float32Array(n);const b={length:n,duration:n/r,getChannelData:()=>d,numberOfChannels:1};bufs.push(b);return b;},createBufferSource:node,createGain:node,createStereoPanner:node,createBiquadFilter:node};
const play=createEffects(ctx,node());
const src=(await import('fs')).readFileSync(new URL('../src/sound_effects.js',import.meta.url),'utf8');const kinds=[...src.match(/const durations=\{([^}]*)\}/)[1].matchAll(/([a-zA-Z]+):/g)].map(m=>m[1]);
const rows=[];for(const k of kinds){const before=bufs.length;try{createEffects(ctx,node())(k,.5,0,1);}catch(e){rows.push([k,'ERR '+e.message]);continue;}const b=bufs[bufs.length-1];if(bufs.length===before){rows.push([k,'no-buffer']);continue;}const d=b.getChannelData();let pk=0,sq=0;for(const v of d){pk=Math.max(pk,Math.abs(v));sq+=v*v;}rows.push([k,+(20*Math.log10(pk||1e-9)).toFixed(1),+(10*Math.log10(sq/d.length||1e-12)).toFixed(1)]);}
console.log(JSON.stringify(rows));
