// Road-network coherence checks on the shipped graph and surface mask (audit:map).
export function roadCoherence(G,limits,caps=[]){
 const g=G.graph,edges=g.edges,deg=new Map(),inc=new Map();
 for(const e of edges)for(const nd of [e.A,e.B]){deg.set(nd,(deg.get(nd)||0)+1);(inc.get(nd)||inc.set(nd,[]).get(nd)).push(e);}
 const out={deadEnds:[],joinMismatch:[],signals:[],crossings:[],offRoad:[],stats:{}};
 const W=limits?.W||12000,H=limits?.H||10000;
 for(const [nd,d] of deg){
  const es=inc.get(nd);
  if(d===1){const e=es[0],o=e.A===nd?e.B:e.A,ux=(nd.x-o.x)/e.len,uy=(nd.y-o.y)/e.len;
   // what lies just past the end of the road
   const beyond=[];for(const k of [1,1.6,2.4])beyond.push(G.surfaceAt(nd.x+ux*e.w*.5*k,nd.y+uy*e.w*.5*k));
   const edge=nd.x<150||nd.y<150||nd.x>W-150||nd.y>H-150;
   if(!edge&&beyond[0]!=='road')out.deadEnds.push({node:nd.id,x:nd.x,y:nd.y,w:e.w,beyond,capped:caps.some(q=>q.node===nd.id)});}
  if(d===2){const [a,b]=es;const dot=Math.abs(a.dx*b.dx+a.dy*b.dy);if(dot>.95&&(Math.abs(a.w-b.w)>8||a.lanes!==b.lanes||Math.abs((a.med||0)-(b.med||0))>8))out.joinMismatch.push({node:nd.id,x:nd.x,y:nd.y,a:[a.w,a.lanes,a.med],b:[b.w,b.lanes,b.med]});}
  if(d>=3&&!nd.sig&&es.every(e=>e.lanes>=2&&e.w>=150))out.signals.push({node:nd.id,x:nd.x,y:nd.y,deg:d,issue:'major junction without signals'});
  if(d<=2&&nd.sig)out.signals.push({node:nd.id,x:nd.x,y:nd.y,deg:d,issue:'signal on a non-junction'});
 }
 // edges that cross without a junction node
 const seg=e=>[e.A.x,e.A.y,e.B.x,e.B.y];
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){const a=edges[i],b=edges[j];if(a.A===b.A||a.A===b.B||a.B===b.A||a.B===b.B)continue;
  const [x1,y1,x2,y2]=seg(a),[x3,y3,x4,y4]=seg(b),den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-6)continue;
  const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;
  if(t>.02&&t<.98&&u>.02&&u<.98)out.crossings.push({a:a.id,b:b.id,x:Math.round(x1+t*(x2-x1)),y:Math.round(y1+t*(y2-y1)),bridge:[a.k,b.k]});}
 // centre line must be drivable surface between junction trims
 for(const e of edges){let bad=0,first=null;const off=e.med>0?e.med/2+(e.w-e.med)/4:0;for(let s=(e.A.hw||40)+16;s<e.len-(e.B.hw||40)-16;s+=32){const x=e.A.x+e.dx*s-e.dy*off,y=e.A.y+e.dy*s+e.dx*off,sf=G.surfaceAt(x,y);if(!['road','bridge','tunnel','track','pier'].includes(sf)){bad++;first||={x,y,sf};}}if(bad>1)out.offRoad.push({edge:e.id,k:e.k,bad,first});}
 out.stats={nodes:deg.size,edges:edges.length,deadEnds:out.deadEnds.length,uncapped:out.deadEnds.filter(d=>!d.capped).length,joinMismatch:out.joinMismatch.length,signals:out.signals.length,crossings:out.crossings.length,offRoad:out.offRoad.length};
 return out;
}
