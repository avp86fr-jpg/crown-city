/* Engine voices per model. Pure data + an RPM/gear model, shared by the live
   WebAudio graph (audio.js) and the offline demo renderer. All synthesis is
   original: detuned oscillators, a firing-pulse AM, waveshaper growl. */
// base/top Hz at idle/redline, filter cut, growl, firing ratio (pulses per
// fundamental: V8 burble .5, V12 1.5 scream), gears, turbo, diesel clatter,
// o2 interval (harmonic stack), horn pair Hz.
export const VOICES=Object.freeze({
 nyx:   {base:58,top:262,cut:4300,growl:.55,fire:1.5,gears:7,turbo:.8,diesel:0,stack:1.5,horn:[466,587]},   // high-rev V12-ish scream
 riot:  {base:30,top:146,cut:1800,growl:1,fire:.5,gears:5,turbo:0,diesel:0,stack:1.007,horn:[311,392]},     // V8 muscle rumble
 dart:  {base:50,top:228,cut:3400,growl:.6,fire:1,gears:6,turbo:1,diesel:0,stack:2,horn:[440,554]},         // turbo four sports car
 fare:  {base:40,top:138,cut:1500,growl:.45,fire:.75,gears:5,turbo:0,diesel:0,stack:1.005,horn:[392,494]},  // sedan
 taxi:  {base:42,top:132,cut:1450,growl:.45,fire:.75,gears:5,turbo:0,diesel:0,stack:1.006,horn:[370,466]},
 metro: {base:36,top:160,cut:2000,growl:.7,fire:.5,gears:6,turbo:.4,diesel:0,stack:1.004,horn:[330,415]},   // police SUV V8
 ambulance:{base:30,top:104,cut:1150,growl:.9,fire:1,gears:5,turbo:.3,diesel:1,stack:1.01,horn:[294,370]},
 van:   {base:27,top:98,cut:1100,growl:.95,fire:1,gears:5,turbo:.3,diesel:1,stack:1.01,horn:[294,349]},     // diesel clatter
 bus:   {base:22,top:82,cut:900,growl:1,fire:1,gears:6,turbo:.5,diesel:1.2,stack:1.012,horn:[220,277]},
 stitch:{base:70,top:300,cut:4200,growl:.35,fire:1,gears:6,turbo:0,diesel:0,stack:2,horn:[587,740]},       // superbike whine
 hog:   {base:24,top:120,cut:1700,growl:1,fire:.5,gears:5,turbo:0,diesel:0,stack:1.003,horn:[349,440]},     // big twin potato-potato
 scooter:{base:90,top:280,cut:3000,growl:.3,fire:1,gears:1,turbo:0,diesel:0,stack:2,horn:[740,880]},
 wake:  {base:44,top:168,cut:1600,growl:.6,fire:1,gears:1,turbo:0,diesel:0,stack:1.5,horn:[262,330]},      // speedboat
 gulf:  {base:28,top:100,cut:900,growl:.8,fire:1,gears:1,turbo:0,diesel:.8,stack:1.01,horn:[147,185]},     // outboard / launch
 snowmobile:{base:66,top:250,cut:2800,growl:.4,fire:1,gears:1,turbo:0,diesel:0,stack:2,horn:[523,659]},  // two-stroke buzz
});
const BY_KIND={hyper:'nyx',muscle:'riot',sports:'dart',sedan:'fare',police:'metro',bike:'stitch',boat:'wake'};
export function voiceFor(v){return VOICES[v?.kind]||VOICES[BY_KIND[v?.def?.kind]]||VOICES.fare;}
// RPM 0..1 from road speed with n gears: each gear sweeps from a drop point
// back to redline; load (throttle) lifts revs, coasting sags them.
export function gearRpm(k,load,gears){
 k=Math.max(0,Math.min(1,k));if(gears<=1)return Math.min(1,.2+.72*k+.08*load);
 const g=Math.min(gears-1,Math.floor(Math.pow(k,.8)*gears)),lo=Math.pow(g/gears,1/.8),hi=Math.pow((g+1)/gears,1/.8),t=(k-lo)/Math.max(1e-6,hi-lo);
 const drop=g===0?.18:.52+.04*Math.min(4,g);return {rpm:Math.min(1,(drop+(1-drop)*t)*(.86+.14*load)),gear:g};
}
export function engineState(v,load,out={}){
 const V=voiceFor(v),k=Math.min(1,Math.hypot(v.vx||0,v.vy||0)/(v.def?.max||300));
 const r=gearRpm(k,load,V.gears);out.rpm=typeof r==='number'?r:r.rpm;out.gear=typeof r==='number'?0:r.gear;out.freq=V.base+(V.top-V.base)*out.rpm;out.voice=V;return out;
}
// Tyre/skid character by surface: [bandpass Hz, Q, extra crunch gain]
export const TYRE=Object.freeze({road:[1900,6,0],track:[2100,7,0],walk:[1800,5,0],lot:[1800,5,0],dirt:[700,1.2,.6],sand:[520,.9,.7],grass:[900,1.4,.4],snow:[420,.8,.9],ice:[3200,9,.1],pier:[1300,3,.2]});
export function tyreFor(surface,alpineMix=0,onIce=false){if(onIce)return TYRE.ice;if(alpineMix>.5&&surface!=='road'&&surface!=='track')return TYRE.snow;return TYRE[surface]||TYRE.road;}
