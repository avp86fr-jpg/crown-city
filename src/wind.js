/* One weather field drives canopies, windsocks, sea ripples and vent plumes.
   Time is simulation time: pause/reduced motion never accumulates particles. */
export function windAt(t,storm=0,out={}){
 const gust=.72+.18*Math.sin(t*.43)+.1*Math.sin(t*.91+1.7),strength=gust*(1+Math.max(0,Math.min(1,storm))*.8);
 out.x=strength;out.y=(-.27+.14*Math.sin(t*.12))*strength;out.gust=gust;return out;
}
export function sceneWind(G){
 const state=G._sceneWind||(G._sceneWind={});
 const still=!!G.settings.reducedMotion,storm=Math.max(G.rainAmt||0,G.sand||0);
 if(state.tick!==G.ticks||state.still!==still||state.storm!==storm){windAt(still?0:G.ticks/60,storm,state);state.tick=G.ticks;state.still=still;state.storm=storm;}
 return state;
}
