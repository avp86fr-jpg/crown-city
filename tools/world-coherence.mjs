// Whole-world coherence checks (audit:map): scenery vs roads/water, pickups and
// spawns on reachable ground, vehicles on the right medium, labels in their district.
import {districtAt} from '../src/world.js';
export function worldCoherence(G){
 const W=G.world,S=(x,y)=>G.surfaceAt(x,y),out={treesOnRoad:[],treesInWater:[],buildingsOnRoad:[],decorOnRoad:[],pickups:[],spawn:null,boatsOnLand:[],carsInWater:[],labels:[],stats:{}};
 const roadish=s=>s==='road'||s==='track';
 for(const t of W.trees||[]){const s=S(t.x,t.y);if(roadish(s))out.treesOnRoad.push({x:t.x|0,y:t.y|0});else if(s==='water'||s==='canal')out.treesInWater.push({x:t.x|0,y:t.y|0});}
 const rectRoad=(x,y,w,h)=>{let n=0;for(let i=1;i<4;i++)for(let j=1;j<4;j++)if(roadish(S(x+w*i/4,y+h*j/4)))n++;return n;};
 for(const b of W.buildings||[]){if(b.w&&b.h&&rectRoad(b.x,b.y,b.w,b.h)>=2)out.buildingsOnRoad.push({x:b.x|0,y:b.y|0,w:b.w|0,h:b.h|0});}
 // camp and rescue compounds are paved yards built around their own access road
 for(const d of W.expansion?.decor||[]){if(!d.w||!d.h||d.kind==='camp'||d.kind==='rescue')continue;if(rectRoad(d.x-d.w/2,d.y-d.h/2,d.w,d.h)>=2)out.decorOnRoad.push({kind:d.kind,x:d.x|0,y:d.y|0});}
 const N=G.nav,reach=(x,y)=>{if(!N)return true;const cx=Math.floor(x/N.C),cy=Math.floor((y+N.OY)/N.C);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(N.raw?.[(cy+dy)*N.NW+cx+dx])return true;return false;};
 for(const p of G.pickups||[]){const s=S(p.x,p.y);if(s==='build'||s==='water'||s==='canal'||!reach(p.x,p.y))out.pickups.push({id:p.id,x:p.x|0,y:p.y|0,s});}
 const sp=G.meta?.spawns?.player;if(sp){const s=S(sp[0],sp[1]);if(s==='build'||s==='water')out.spawn={x:sp[0],y:sp[1],s};}
 for(const v of G.vehicles||[]){if(v.def?.aircraft)continue;const s=S(v.x,v.y);if(v.def?.boat&&s!=='water'&&s!=='canal'&&!v.loose)out.boatsOnLand.push({kind:v.kind,x:v.x|0,y:v.y|0,s});if(!v.def?.boat&&(s==='water'||s==='canal'))out.carsInWater.push({kind:v.kind,x:v.x|0,y:v.y|0});}
 for(const l of W.expansion?.landmarks||[]){const s=S(l.x,l.y);if(s==='water'&&!/LAKE|BAY|SOUND|HARBOUR|CANAL/.test(l.name))out.labels.push({name:l.name,x:l.x,y:l.y,s,district:districtAt(l.x,l.y)});}
 for(const k of Object.keys(out))if(Array.isArray(out[k]))out.stats[k]=out[k].length;out.stats.spawn=out.spawn?1:0;
 return out;
}
