/* Cinematic scene presentation. Portrait sources are shown intact, never redrawn. */
import {CHAR} from './story.js';
const LOCATIONS={news:'CROWN CITY / THE NIGHT SHIFT',garage:'SOUTHSIDE / HUNTER’S GARAGE',palace:'CROWN PALACE / PRIVATE FLOOR',marina:'EAST HARBOUR / LAST BERTH',loft:'MIDTOWN / NEURAL’S LOFT',rooftop:'THE STRIP / ABOVE THE CAMERAS',desert:'RED MESA / THE LONG WAY HOME',strip_night:'THE STRIP / AFTER HOURS'};
const ROLES={chaos:'THE DRIVER',hunter:'THE FIXER',fire:'THE INSIDE ROUTE',neural:'THE SIGNAL',mask:'THE INSIDE MAN',gold_mage:'THE HOUSE',vera:'THE VOICE OF THE CITY',chief:'THE NETWORK',ice:'THE COLD EXIT',steampunk:'THE ENGINEER'};
export function openingScene(G){return G.vn?.id==='intro_news'&&!G.settings.reducedMotion&&G.vn.t<7.5;}
function cover(c,im,W,H,t,reduced){const zoom=reduced?1:1.02+Math.min(1,t/35)*.035,k=Math.max(W/im.width,H/im.height)*zoom;c.drawImage(im,(W-im.width*k)/2,(H-im.height*k)/2,im.width*k,im.height*k);}
export function drawDialogue(G,{button,lines,font,open}){
 const c=G.ctx,W=G.canvas.width,H=G.canvas.height,u=G.ui,n=G.vn.node,t=G.vn.t||0,safe=G.safe||{l:0,r:0,b:0,t:0};
 const bg=G.assets.sprites['vn_'+n.bg]||G.assets.hero||G.assets.title;
 c.setTransform(1,0,0,1,0,0);cover(c,bg,W,H,t,G.settings.reducedMotion);
 const margin=Math.max(24*u,safe.l+16*u),right=Math.max(24*u,safe.r+16*u),width=W-margin-right;
 const text=(value,x,y,size,color='#f4efdf',weight=600)=>{c.textAlign='left';c.font=font(size*u,weight);c.fillStyle=color;c.fillText(value,x,y);};
 if(openingScene(G)){
  const fade=Math.min(1,t/1.1);c.fillStyle='rgba(3,11,16,.32)';c.fillRect(0,0,W,H);
  c.fillStyle='#081115';c.fillRect(0,0,W,26*u);c.fillRect(0,H-30*u,W,30*u);
  c.save();c.globalAlpha=fade;
  text('A CROWN CITY STORY',margin,H*.25,11,'#e1c180',800);
  const title=Math.min(76,width/u/7.1);text('EVERY DEBT',margin,H*.25+title*u*1.1,title,'#f5edda',900);
  text('HAS A NAME.',margin,H*.25+title*u*2.15,title,'#f5edda',900);
  c.fillStyle='#dcbc7b';c.fillRect(margin,H*.25+title*u*2.4,64*u,3*u);
  if(t>2.2)text('SOUTHSIDE. 11:47 P.M. / ONE LAST JOB.',margin,H*.25+title*u*2.4+29*u,10,'#e9dfc9',700);
  c.restore();button(G,W-right-126*u,H-safe.b-55*u,126*u,36*u,'SKIP OPENING',()=>{G.vn.t=7.5;G.vn.wipe=0;},{size:10*u});
  return;
 }
 // Gradients are retained per scene/viewport; no new full-screen gradient per frame.
 let shades=G._dialogueShade;
 if(!shades||shades.W!==W||shades.H!==H){
  const top=c.createLinearGradient(0,0,0,H*.6);top.addColorStop(0,'rgba(4,12,16,.88)');top.addColorStop(1,'rgba(4,12,16,0)');
  shades=G._dialogueShade={W,H,top};
 }
 c.fillStyle=shades.top;c.fillRect(0,0,W,H*.6);
 const header=safe.t+30*u;text(LOCATIONS[n.bg]||'CROWN CITY / AFTER HOURS',margin,header,10,'#e1c180',800);
 text('THE PALACE FILES',margin,header+20*u,9,'#c3cec6',600);
 const choices=n.choices||[],ready=G.vn.char>=(n.text||'').length,landscape=W>H;
 const textSize=16,lineHeight=23*u;c.font=font(textSize*u,500);
 const fullLines=lines(c,n.text||'',width-36*u,Infinity),columns=landscape?2:1,rows=Math.ceil(choices.length/columns);
 const choiceH=42*u,choiceGap=8*u,footer=choices.length?rows*(choiceH+choiceGap)+12*u:43*u;
 const boxH=(55+fullLines.length*23)*u+footer+safe.b,boxY=Math.max(header+70*u,H-boxH);
 const portraitTop=header+38*u,available=Math.max(42*u,boxY-portraitTop-21*u);
 const portraitSize=Math.min(available,W*(landscape?.24:.38),310*u);
 for(const [id,side] of [[n.left,0],[n.right,1]]){
  const im=G.assets.sprites['port_'+id],ch=CHAR[id];if(!im||!ch)continue;
  const x=side?W-right-portraitSize:margin,y=boxY-portraitSize-18*u,speaking=n.speaker===id;
  c.save();c.globalAlpha=speaking?1:.7;
  // Square framing preserves every detail of the original NFT, including Gold Mage.
  c.fillStyle='#071318';c.fillRect(x-3*u,y-3*u,portraitSize+6*u,portraitSize+6*u);
  const k=Math.min(portraitSize/im.width,portraitSize/im.height),iw=im.width*k,ih=im.height*k;
  c.drawImage(im,x+(portraitSize-iw)/2,y+(portraitSize-ih)/2,iw,ih);
  c.strokeStyle=speaking?'#dcbc7b':'#5f716b';c.lineWidth=(speaking?2:1)*u;c.strokeRect(x,y,portraitSize,portraitSize);
  text(ch.name.toUpperCase(),x+10*u,y+portraitSize+12*u,9,speaking?'#f2d697':'#d3d9d0',800);c.restore();
 }
 c.fillStyle='rgba(5,14,18,.96)';c.fillRect(0,boxY,W,H-boxY);c.fillStyle='#dbc18a';c.fillRect(margin,boxY,Math.min(width,86*u),2*u);
 const ch=CHAR[n.speaker];text(ch?.name||'CROWN CITY',margin+18*u,boxY+25*u,12,ch?.color||'#e1c180',900);
 const nameWidth=c.measureText(ch?.name||'CROWN CITY').width;
 text(ROLES[n.speaker]||'',margin+nameWidth+35*u,boxY+25*u,9,'#a8bab4',600);
 c.font=font(textSize*u,500);c.fillStyle='#f0eee5';c.textAlign='left';
 const shown=(n.text||'').slice(0,Math.max(0,G.vn.char|0)),shownLines=lines(c,shown,width-36*u,Infinity);
 shownLines.forEach((line,i)=>c.fillText(line,margin+18*u,boxY+53*u+i*lineHeight));
 const cy=boxY+(63+fullLines.length*23)*u;
 if(choices.length&&ready){const bw=(width-36*u-choiceGap*(columns-1))/columns;
  choices.forEach((ch,i)=>button(G,margin+18*u+(i%columns)*(bw+choiceGap),cy+Math.floor(i/columns)*(choiceH+choiceGap),bw,choiceH,ch.label,()=>{if(ch.set)Object.assign(G.flags,ch.set);G.audio.ui();open(G,ch.next);},{size:12*u}));G.menuSel=G.vn.sel;
 }else if(!choices.length){
  const y=H-safe.b-37*u;button(G,W-right-135*u,y,135*u,30*u,ready?'CONTINUE  →':'REVEAL TEXT',()=>{G.input.vnTap=true;},{size:10*u});
  if(width>420*u)text(G.touch?'TAP TO CONTINUE':'SPACE / E TO CONTINUE',margin+18*u,y+19*u,9,'#97aaa5',600);
 }
 if(G.vn.wipe>0){c.fillStyle=`rgba(4,12,16,${Math.min(1,G.vn.wipe/.32)})`;c.fillRect(0,0,W,H);}
}
