// Place map names in free screen space without covering route badges or names.
export function layoutMapLabels(items,bounds,measure,reserved=[],size=10){
 const used=reserved.slice(),out=[];
 for(const item of items){
  const w=measure(item.name)+8,h=size+6;
  for(const [dx,dy] of [[0,0],[0,-h],[0,h],[-w*.45,0],[w*.45,0]]){
   const box={x:item.x+dx-w/2,y:item.y+dy-h/2,w,h};
   if(box.x<bounds.x||box.y<bounds.y||box.x+w>bounds.x+bounds.w||box.y+h>bounds.y+bounds.h)continue;
   if(used.some(b=>box.x<b.x+b.w+3&&box.x+w+3>b.x&&box.y<b.y+b.h+3&&box.y+h+3>b.y))continue;
   used.push(box);out.push({...item,...box});break;
  }
 }
 return out;
}
export function drawAtlasLabels(G,to,items,reserved){
 const c=G.ctx,size=Math.max(9,10*G.ui);c.font=`800 ${size}px system-ui`;c.textAlign='center';
 const labels=layoutMapLabels(items.map(([name,x,y])=>{const p=to(x,y);return {name,x:p[0],y:p[1]};}),G.mapView,t=>c.measureText(t).width,reserved,size);
 for(const l of labels){c.fillStyle='rgba(10,24,29,.82)';c.fillRect(l.x,l.y,l.w,l.h);c.fillStyle='#e4dfc5';c.fillText(l.name,l.x+l.w/2,l.y+l.h/2+size*.34);}
 return labels;
}
