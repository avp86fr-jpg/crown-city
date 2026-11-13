/* Shared, allocation-free handling presets. Speeds are world units/second;
   velocity remains independent of body heading, so tires must recover a slide. */
const profile=(overrides)=>Object.freeze({
  response:8,traction:10,driftTraction:1.7,turnFalloff:.37,lowSpeed:52,
  rolling:.055,aero:.00064,engineBrake:8,curve:1.65,reverse:60,
  cornerScrub:.025,lean:.16,...overrides,
});
export const HANDLING_PROFILES=Object.freeze({
  nyx:profile({response:10,traction:15,driftTraction:2.3,turnFalloff:.43,rolling:.036,aero:.00042,engineBrake:12,curve:1.55,reverse:70,lean:.11}),
  dart:profile({response:11,traction:13.2,driftTraction:2,turnFalloff:.34,rolling:.05,aero:.00053,engineBrake:11,curve:1.7,reverse:65,lean:.13}),
  riot:profile({response:6.5,traction:8.2,driftTraction:1.45,turnFalloff:.4,rolling:.043,aero:.00072,engineBrake:6,curve:2.05,reverse:62,lean:.2}),
  fare:profile({response:7.3,traction:10.5,reverse:55}),
  taxi:profile({response:6.8,traction:9.7,rolling:.06,aero:.00075,engineBrake:7,reverse:52,lean:.19}),
  metro:profile({response:8.2,traction:11.8,rolling:.05,aero:.00062,engineBrake:9,curve:1.85,reverse:64}),
  ambulance:profile({response:5.3,traction:10.4,turnFalloff:.49,lowSpeed:64,rolling:.038,aero:.00082,engineBrake:5,reverse:48,lean:.23}),
  van:profile({response:4.6,traction:9.5,turnFalloff:.5,lowSpeed:65,rolling:.038,aero:.0009,engineBrake:4,curve:1.8,reverse:42,lean:.22}),
  bus:profile({response:3.7,traction:10,turnFalloff:.56,lowSpeed:74,rolling:.028,aero:.00088,engineBrake:3,curve:1.75,reverse:35,lean:.23}),
  stitch:profile({response:13,traction:16,driftTraction:3.2,turnFalloff:.29,lowSpeed:28,rolling:.068,aero:.00065,engineBrake:15,curve:1.5,reverse:42,lean:.55}),
  hog:profile({response:8.5,traction:12,driftTraction:2.6,turnFalloff:.38,lowSpeed:34,rolling:.06,aero:.0009,engineBrake:13,curve:1.9,reverse:36,lean:.48}),
  wake:profile({response:5,traction:9,turnFalloff:.3,lowSpeed:40,rolling:.1,aero:.00085,engineBrake:0,curve:1.65,reverse:62,lean:.3}),
  gulf:profile({response:3.1,traction:6.6,turnFalloff:.43,lowSpeed:57,rolling:.13,aero:.0011,engineBrake:0,curve:1.75,reverse:40,lean:.2}),
});
export function vehicleHandling(def){return HANDLING_PROFILES[def.van?'van':def.sprite]||HANDLING_PROFILES.fare;}
export function rollingResistance(speed,profile){
  return speed*profile.rolling+speed*speed*profile.aero;
}
