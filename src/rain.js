/* Screen-space rain and wet-ground dressing.
   Streaks, ripples, puddles and lamp glints use pre-rendered sprites.
   No per-frame gradients and no particle allocations. */
import {sceneWind} from './wind.js';
import {visibleStreetLights} from './lighting.js';

const TAU=Math.PI*2;
const WET=new Set(['road','walk','lot','pier']);
const RIPPLE=new Set(['road','walk','lot','pier','water','canal']);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=t=>t*t*(3-2*t);

// Wind-angled fall, slightly down-right. Gusts only nudge it so the field stays coherent.
export function rainDir(G){
  const w=sceneWind(G),dx=.36+(w.x-1)*.05,dy=1+(w.y||0)*.08,len=Math.hypot(dx,dy)||1;
  return {dx:dx/len,dy:dy/len,angle:Math.atan2(dx,dy)};
}

let _art=null;
function art(){
  if(_art||typeof document==='undefined')return _art;
  const make=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;fn(c.getContext('2d'),w,h);return c;};
  const streak=(ctx,x,y,len,width,alpha,angle)=>{
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const g=ctx.createLinearGradient(0,0,0,len);
    g.addColorStop(0,'rgba(210,226,240,0)');
    g.addColorStop(.18,`rgba(216,232,244,${alpha*.35})`);
    g.addColorStop(.55,`rgba(236,246,255,${alpha})`);
    g.addColorStop(1,'rgba(210,226,240,0)');
    ctx.strokeStyle=g;ctx.lineWidth=width;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,len);ctx.stroke();ctx.restore();
  };
  const sheet=(size,count,len0,len1,width,alpha,seed,angle)=>{
    return make(size,size,(ctx,s)=>{
      for(let i=0;i<count;i++){
        const u=hash(seed+i),v=hash(seed+i*19+3),len=len0+(len1-len0)*hash(seed+i*7);
        const x=u*s,y=v*s,a=alpha*(.45+hash(seed+i*13)*.55),w=width*(.7+hash(seed+i*17)*.6);
        // Wrap copies keep the tile seamless when it scrolls.
        for(const ox of [-s,0,s])for(const oy of [-s,0,s]){
          const xx=x+ox,yy=y+oy;
          if(xx<-len||xx>s+len||yy<-len||yy>s+len)continue;
          streak(ctx,xx,yy,len,w,a,angle);
        }
      }
    });
  };
  const angle=Math.atan2(.36,1);
  const far=sheet(384,78,16,32,1.0,.36,11,angle);
  const mid=sheet(384,52,28,54,1.25,.54,29,angle);
  const near=sheet(384,26,48,86,1.7,.68,47,angle);
  const ripple=make(64,40,(ctx,w,h)=>{
    const g=ctx.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);
    g.addColorStop(0,'rgba(200,224,236,0)');
    g.addColorStop(.55,'rgba(190,216,230,.0)');
    g.addColorStop(.78,'rgba(210,232,242,.85)');
    g.addColorStop(1,'rgba(210,232,242,0)');
    ctx.strokeStyle='rgba(198,224,236,.9)';ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(w/2,h/2,w*.42,h*.42,0,0,TAU);ctx.stroke();
    ctx.globalAlpha=.7;ctx.strokeStyle=g;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(w/2,h/2,w*.3,h*.3,0,0,TAU);ctx.stroke();
  });
  const puddle=make(72,40,(ctx,w,h)=>{
    const g=ctx.createRadialGradient(w*.42,h*.4,2,w/2,h/2,w*.5);
    g.addColorStop(0,'rgba(18,28,40,.55)');
    g.addColorStop(.55,'rgba(16,26,38,.38)');
    g.addColorStop(1,'rgba(16,26,38,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(w/2,h/2,w*.46,h*.4,0,0,TAU);ctx.fill();
    const hi=ctx.createLinearGradient(w*.2,h*.25,w*.8,h*.7);
    hi.addColorStop(0,'rgba(200,220,236,0)');
    hi.addColorStop(.45,'rgba(220,236,248,.35)');
    hi.addColorStop(1,'rgba(200,220,236,0)');
    ctx.fillStyle=hi;ctx.beginPath();ctx.ellipse(w*.48,h*.4,w*.28,h*.12, -.3,0,TAU);ctx.fill();
  });
  const glint=make(28,56,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(w/2,0,w/2,h);
    g.addColorStop(0,'rgba(255,230,180,0)');
    g.addColorStop(.2,'rgba(255,224,170,.85)');
    g.addColorStop(.55,'rgba(255,214,150,.35)');
    g.addColorStop(1,'rgba(255,214,150,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(w/2,h*.4,w*.28,h*.42,0,0,TAU);ctx.fill();
  });
  const cool=make(28,56,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(w/2,0,w/2,h);
    g.addColorStop(0,'rgba(190,220,255,0)');
    g.addColorStop(.2,'rgba(200,226,255,.7)');
    g.addColorStop(.55,'rgba(180,214,245,.28)');
    g.addColorStop(1,'rgba(180,214,245,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(w/2,h*.4,w*.28,h*.42,0,0,TAU);ctx.fill();
  });
  return _art={angle,far,mid,near,ripple,puddle,glint,cool,size:384};
}

export function resetRainArt(){_art=null;_patterns=null;}

let _patterns=null;
function sheetPatterns(ctx){
  if(_patterns||!_art||typeof ctx.createPattern!=='function')return _patterns;
  const pat=img=>ctx.createPattern(img,'repeat');
  _patterns={far:pat(_art.far),mid:pat(_art.mid),near:pat(_art.near)};
  return _patterns;
}

function intensity(G){return smooth(clamp(G.rainAmt||0));}

function tileSheet(ctx,img,ox,oy,x0,y0,x1,y1){
  const tw=img.width,th=img.height;
  let xs=((ox%tw)+tw)%tw-tw,ys=((oy%th)+th)%th-th;
  for(let y=y0+ys;y<y1;y+=th)for(let x=x0+xs;x<x1;x+=tw)ctx.drawImage(img,x,y);
}

// Ground dressing: ripples, puddles and lamp/headlight sheen. World space.
export function drawRainGround(G,r){
  const amt=G.rainAmt||0,wet=G.wet||0;
  if(amt<.06&&wet<.08)return;
  const ctx=G.ctx,sprites=art();if(!sprites)return;
  const low=G.settings?.quality==='low',reduced=!!G.settings?.reducedMotion;
  const t=reduced?0:(G.ticks||0)/60,night=clamp(G.night||0);
  const k=Math.max(intensity(G),smooth(clamp(wet)));
  const stats=G.rainStats||(G.rainStats={});
  stats.ripples=0;stats.puddles=0;stats.glints=0;stats.sheets=0;stats.gradients=0;
  // Splash ripples on roads, sidewalks and open water.
  if(amt>.1&&!reduced&&G.surfaceAt){
    const step=low?170:100;
    ctx.save();ctx.globalCompositeOperation='source-over';
    for(let x=Math.floor(r.x0/step)*step;x<r.x1;x+=step)for(let y=Math.floor(r.y0/step)*step;y<r.y1;y+=step){
      const seed=hash(x*13+y*29),xx=x+seed*step,yy=y+hash(x*7+y*17)*step;
      if(!RIPPLE.has(G.surfaceAt(xx,yy)))continue;
      const age=((t*1.15+seed*11)%1+1)%1,s=5+age*14;
      ctx.globalAlpha=(1-age)*amt*(.24+seed*.16);
      ctx.drawImage(sprites.ripple,xx-s,yy-s*.55,s*2,s*1.1);
      stats.ripples++;
    }
    ctx.restore();
  }
  // Dark puddles with a painted highlight; lamp and headlight glints at night.
  if(wet>.08&&G.surfaceAt){
    const step=low?210:140,max=low?10:G.settings?.quality==='med'?18:28;
    ctx.save();
    for(let x=Math.floor((r.x0-40)/step)*step;x<r.x1+40;x+=step)for(let y=Math.floor((r.y0-40)/step)*step;y<r.y1+40;y+=step){
      if(stats.puddles>=max)break;
      const seed=hash(x*3.1+y*9.7);if(seed>.55)continue;
      const xx=x+seed*step*.7,yy=y+hash(x*5+y)*step*.7;
      if(!WET.has(G.surfaceAt(xx,yy)))continue;
      const rw=22+hash(seed+2)*26,rh=rw*(.38+.16*hash(seed+5));
      ctx.globalAlpha=wet*(.55+.35*hash(seed+8));
      ctx.drawImage(sprites.puddle,xx-rw,yy-rh,rw*2,rh*2);
      stats.puddles++;
    }
    if(night>.12&&wet>.12){
      ctx.globalCompositeOperation='lighter';
      const lamps=(G.meta?.lights||G.world?.lamps)?visibleStreetLights(G,r,low?6:10):[];
      const phase=reduced?0:t;
      for(const L of lamps){
        const px=L.x,py=L.y+10;if(!G.surfaceAt||!WET.has(G.surfaceAt(px,py+8)))continue;
        const wave=Math.sin(phase*1.5+px*.02)*3,len=28+hash(px)*22;
        ctx.globalAlpha=night*wet*(.28+hash(py)*.2);
        ctx.drawImage(sprites.glint,px-8+wave,py,16,len);
        stats.glints++;
      }
      const vehicles=G.vehicles||[];
      const cap=low?4:8;let n=0;
      for(const v of vehicles){
        if(v.dead||v.def?.bike||v.def?.boat)continue;
        if(v.x<r.x0-40||v.x>r.x1+40||v.y<r.y0-40||v.y>r.y1+40)continue;
        const h=Math.cos(v.rot||0),s=Math.sin(v.rot||0),hx=v.x+s*26,hy=v.y-h*26;
        if(G.surfaceAt&&!WET.has(G.surfaceAt(hx,hy+6)))continue;
        ctx.globalAlpha=night*wet*.32;ctx.drawImage(sprites.cool,hx-7,hy,14,26);
        stats.glints++;if(++n>=cap)break;
      }
    }
    ctx.restore();
  }
}

// Screen-space veil + parallax streak sheets. Identity transform.
export function drawRainOverlay(G){
  const amt=G.rainAmt||0;if(amt<.04)return;
  const ctx=G.ctx,sprites=art();if(!sprites)return;
  const w=G.canvas.width,h=G.canvas.height,k=intensity(G);
  const low=G.settings?.quality==='low',reduced=!!G.settings?.reducedMotion;
  const night=clamp(G.night||0),t=reduced?0:(G.ticks||0)/60;
  const dir=rainDir(G),stats=G.rainStats||(G.rainStats={});
  stats.sheets=0;stats.veil=1;stats.angle=dir.angle;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  // Uniform cool multiply — no radial or diagonal bands.
  const cut=14+10*night;
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha=1;
  ctx.fillStyle=`rgb(${(255-cut*k)|0},${(255-(cut*.72)*k)|0},${(255-(cut*.28)*k)|0})`;
  ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation='source-over';
  if(reduced){ctx.restore();return;}
  // Sheets are baked at a fixed angle; a single rotate keeps them aligned with the wind.
  const spin=dir.angle-sprites.angle;
  const layers=low
    ?[{key:'far',img:sprites.far,speed:210,alpha:.48+(1-night)*.26},{key:'mid',img:sprites.mid,speed:340,alpha:.62+(1-night)*.24}]
    :[{key:'far',img:sprites.far,speed:190,alpha:.44+(1-night)*.24},{key:'mid',img:sprites.mid,speed:320,alpha:.60+(1-night)*.22},{key:'near',img:sprites.near,speed:490,alpha:.68+(1-night)*.18}];
  ctx.translate(w*.5,h*.5);ctx.rotate(spin);ctx.translate(-w*.5,-h*.5);
  const pad=sprites.size,pats=sheetPatterns(ctx);
  for(const layer of layers){
    const ox=t*layer.speed*dir.dx,oy=t*layer.speed*dir.dy;
    ctx.globalAlpha=layer.alpha*k;
    if(pats&&pats[layer.key]){
      ctx.save();ctx.translate(-ox,-oy);ctx.fillStyle=pats[layer.key];
      ctx.fillRect(ox-pad,oy-pad,w+pad*2,h+pad*2);ctx.restore();
    }else tileSheet(ctx,layer.img,ox,oy,-pad,-pad,w+pad,h+pad);
    stats.sheets++;
  }
  ctx.restore();
  if(G.rainStats)G.rainStats.layers=layers.length;
}

export const RAIN_WET_SURFACES=WET;
