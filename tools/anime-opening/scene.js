// Original limited-animation opening. Deterministic 24 fps; no game runtime edits.
const canvas=document.querySelector('canvas'),c=canvas.getContext('2d',{alpha:false});
const W=1280,H=720,FPS=24,BAR=5/3,ASSET='../../about/assets/anime/';
const shotSpec=[['city',2],['street',2],['visor',1],['hero',1],['garage',2],['key',1],['ignition',1],['chase',3],['driver',1],['run',2],['jump',1],['shoot',2],['boat',2],['heli',2],['mage',2],['bike',2],['escape',2],['blast',1],['dawn',2],['montage',1],['title',3]];
let bar=0;const shots=shotSpec.map(([id,bars])=>{const start=bar*40;bar+=bars;return{id,start,end:bar*40,frames:bars*40,duration:bars*BAR};});
if(bar!==36)throw Error('Opening must be 36 bars / 60 seconds');
const images={},sprites={};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,p)=>a+(b-a)*p,ease=p=>p*p*(3-2*p),fract=x=>x-Math.floor(x),rnd=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
function trim(im,rect){
 const a=document.createElement('canvas');a.width=rect[2];a.height=rect[3];const q=a.getContext('2d');q.drawImage(im,...rect,0,0,a.width,a.height);
 const d=q.getImageData(0,0,a.width,a.height).data;let l=a.width,t=a.height,r=0,b=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)if(d[(y*a.width+x)*4+3]>40){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 return{im,rect:[rect[0]+l,rect[1]+t,r-l+1,b-t+1]};
}
function panel(name,index){const im=images[name],h=Math.floor(im.height/2);return{im,rect:[index%2*im.width/2,index>1?h+1:0,im.width/2,h]};}
function drawPanel(name,index,p=0,zoom=1.05,dx=0,dy=0,tilt=0){
 dx=clamp(dx,-W*(zoom-1)/2,W*(zoom-1)/2);dy=clamp(dy,-H*(zoom-1)/2,H*(zoom-1)/2);
 const s=panel(name,index);c.save();c.translate(W/2+dx,H/2+dy);c.rotate(tilt);c.scale(zoom,zoom);c.drawImage(s.im,...s.rect,-W/2,-H/2,W,H);c.restore();
}
function sprite(name,x,y,height,angle=0,flip=false,alpha=1){
 const s=typeof name==='string'?sprites[name]:name,w=height*s.rect[2]/s.rect[3];
 c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(angle);if(flip)c.scale(-1,1);c.drawImage(s.im,...s.rect,-w/2,-height,w,height);c.restore();return{w,h:height};
}
function glow(x,y,r,color,alpha=1){c.save();c.globalAlpha=alpha;c.globalCompositeOperation='screen';const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
function line(x,y,x2,y2,color,width=1,alpha=1){c.save();c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();c.restore();}
function rain(t,weight=.6){
 c.save();c.strokeStyle='#b9def4';c.lineWidth=1.1;c.globalAlpha=.15*weight;c.beginPath();
 for(let i=0;i<115;i++){const z=.3+rnd(i+20)*.9,x=(rnd(i+6)*1500-t*80*z)%1500,y=(rnd(i+200)*900+t*620*z)%900;c.moveTo(x,y);c.lineTo(x-7*z,y+24*z);}c.stroke();
 c.globalAlpha=.10*weight;c.strokeStyle='#c5eee9';for(let i=0;i<18;i++){const p=fract(t*1.2+rnd(i+80));c.beginPath();c.ellipse(rnd(i+50)*W,510+rnd(i+500)*195,1+p*13,1+p*2,0,0,Math.PI*2);c.stroke();}c.restore();
}
function steam(x,y,t,amount=.6){for(let i=0;i<7;i++){const p=fract(t*.24+i*.147);glow(x+Math.sin(p*5+i)*19,y-p*130,18+p*48,'#afbbb8',(1-p)*.075*amount);}}
function speed(t,intensity=.4){c.save();c.globalAlpha=.15*intensity;c.strokeStyle='#c2eff1';c.lineWidth=1.2;c.beginPath();for(let i=0;i<24;i++){const x=fract(rnd(i+67)-t*(.8+rnd(i)))*1600-150,y=rnd(i+700)*720,len=30+rnd(i+42)*160;c.moveTo(x,y);c.lineTo(x+len,y);}c.stroke();c.restore();}
function sparks(x,y,t,n=20,spread=1,color='#ffd29a'){c.save();c.globalCompositeOperation='screen';for(let i=0;i<n;i++){const age=fract(t*1.8+rnd(i)),a=rnd(i+31)*Math.PI*2,v=40+rnd(i+62)*160,px=x+Math.cos(a)*v*age*spread,py=y+Math.sin(a)*v*age*spread+age*age*40;line(px,py,px-Math.cos(a)*12,py-Math.sin(a)*12,color,1.5,(1-age)*.8);}c.restore();}
function smoke(x,y,t,alpha=.35,spread=1){for(let i=0;i<10;i++){const p=fract(t*.65+i*.093),r=12+p*74*spread;c.save();c.globalAlpha=(1-p)*alpha;c.fillStyle=i%2?'#41515f':'#182532';c.beginPath();c.ellipse(x-p*200*spread+Math.sin(i*4)*12,y-p*90,r,r*.65,0,0,Math.PI*2);c.fill();c.restore();}}
function searchlights(t,alpha=.13){c.save();c.globalCompositeOperation='screen';c.globalAlpha=alpha;for(let i=0;i<3;i++){const x=870+i*43,y=350,a=-Math.PI/2+Math.sin(t*.4+i)*.45;c.fillStyle=i===1?'#c2dff0':'#f5d8a0';c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a-.035)*900,y+Math.sin(a-.035)*900);c.lineTo(x+Math.cos(a+.035)*900,y+Math.sin(a+.035)*900);c.closePath();c.fill();}c.restore();}
function embers(t,n=40,alpha=.6){c.save();c.globalCompositeOperation='screen';for(let i=0;i<n;i++){const x=fract(rnd(i+150)+t*(.015+rnd(i)*.02))*1400-60,y=720-fract(rnd(i+51)+t*.11)*840;c.fillStyle=i%2?'#ffc06a':'#e77c53';c.globalAlpha=alpha*(.3+rnd(i+9)*.7);c.fillRect(x,y,1.5+rnd(i)*2,2+rnd(i+1)*3);}c.restore();}
function wheel(x,y,r,t){c.save();c.translate(x,y);c.scale(.75,1);c.rotate(t*30);c.strokeStyle='rgba(199,213,219,.28)';c.lineWidth=2;for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.moveTo(0,0);c.lineTo(r,0);c.stroke();}c.restore();}
function vehicle(name,x,y,h,t,{flip=false,angle=0,police=false,reflected=true}={}){
 const s=sprites[name],w=h*s.rect[2]/s.rect[3];
 if(reflected){c.save();c.translate(x,y+6);c.scale(1,-.27);sprite(name,0,0,h,angle,flip,.11);c.restore();}
 c.save();c.globalAlpha=.35;c.fillStyle='#030814';c.beginPath();c.ellipse(x,y+2,w*.46,h*.08,0,0,Math.PI*2);c.fill();c.restore();sprite(name,x,y+Math.sin(t*18)*1.2,h,angle,flip);
 if(name==='car'){wheel(x-w*.355,y-h*.30,h*.13,t);wheel(x+w*.085,y-h*.23,h*.16,t);glow(x+w*.40,y-h*.38,h*.48,'#ffe2a7',.16);}
 if(police){const phase=Math.sin(t*6);glow(x-w*.04,y-h*.87,h*.9,phase>0?'#387cf9':'#ee4662',.25);}
}
function pedestrian(x,y,scale,t,index){c.save();c.translate(x,y);c.scale(scale,scale);const ph=t*6+index,skin=['#a48e7b','#ba9880','#876c5d'][index%3];c.fillStyle='#0c1724';c.strokeStyle='#111a28';c.lineCap='round';c.lineWidth=6;for(const side of [-1,1]){c.beginPath();c.moveTo(side*3,-20);c.lineTo(side*3+Math.sin(ph+side)*10,-2);c.stroke();}c.fillStyle=['#42405b','#243e46','#674e51','#253147'][index%4];c.beginPath();c.roundRect(-8,-48,16,30,5);c.fill();c.fillStyle=skin;c.beginPath();c.ellipse(0,-56,6,8,0,0,7);c.fill();c.strokeStyle='#1e2836';c.lineWidth=4;line(-8,-41,-12-Math.sin(ph)*6,-23,'#283543',4);line(7,-41,12+Math.sin(ph)*6,-23,'#283543',4);c.restore();}
function cityTrain(t){const x=-270+fract(t*.13)*1500,y=415;c.save();c.translate(x,y);c.rotate(-.15);for(let i=0;i<4;i++){const bx=-i*58;c.fillStyle='#182936';c.fillRect(bx,-15,55,17);c.fillStyle='#e1bb76';c.fillRect(bx,-14,54,3);for(let j=0;j<5;j++){c.fillStyle=j%2?'#9fcac4':'#f2d5a1';c.fillRect(bx+5+j*9,-9,6,5);}}c.restore();}
function title(text,x,y,size=48,color='#fff1cf',align='left',alpha=1){c.save();c.globalAlpha=alpha;c.textAlign=align;c.font=`${size}px AnimeAnton`;c.fillStyle=color;c.shadowColor='#050817';c.shadowBlur=15;c.fillText(text,x,y);c.restore();}
function small(text,x,y,size=14,color='#8ee1d5',align='left',alpha=1){c.save();c.globalAlpha=alpha;c.textAlign=align;c.font=`600 ${size}px AnimeBarlow`;c.fillStyle=color;c.fillText(text,x,y);c.restore();}
function label(main,sub,t,x=54,y=595,size=64){const a=clamp(t*3);c.save();c.globalAlpha=a;const g=c.createLinearGradient(0,y-100,0,H);g.addColorStop(0,'transparent');g.addColorStop(1,'rgba(3,6,18,.84)');c.fillStyle=g;c.fillRect(0,y-100,W,H-y+100);title(main,x+(1-a)*22,y,size);small(sub,x,y+34,16);c.restore();}
function helicopter(x,y,h,t,alpha=1){sprite('heli',x,y,h,Math.sin(t*2)*.025,false,alpha);const w=h*sprites.heli.rect[2]/sprites.heli.rect[3],rx=x+w*.06,ry=y-h*.94;c.save();c.globalAlpha=.4*alpha;c.translate(rx,ry);c.scale(1,.12);c.rotate(t*45);c.fillStyle='#b1c0c6';c.fillRect(-h*1.05,-4,h*2.1,8);c.rotate(Math.PI/2);c.fillRect(-h*1.05,-3,h*2.1,6);c.restore();glow(x+w*.42,y-h*.26,18,'#ef4d61',alpha*.35);}
function boat(x,y,h,t){for(let i=0;i<16;i++){const p=fract(t*.9+i/16);c.save();c.globalAlpha=(1-p)*.35;c.strokeStyle='#9de0d6';c.lineWidth=2+p*5;c.beginPath();c.ellipse(x-h*.8-p*450,y-4+p*15,15+p*80,2+p*12,0,.2,Math.PI*1.8);c.stroke();c.restore();}sprite('boat',x,y+Math.sin(t*4)*4,h,-.015+Math.sin(t*3)*.008);glow(x+h*.9,y-h*.3,70,'#7ce2d4',.1);}
function runner(x,y,h,t){const frame=Math.floor(t*12)%8,s=sprites['run'+frame],scale=h/360,row=Math.floor(frame/4)*Math.floor(images.run.height/2),bottom=s.rect[1]-row+s.rect[3];sprite(s,x,y-(416-bottom)*scale,s.rect[3]*scale);}
function blast(x,y,t){const age=clamp(t/1.35),s=35+age*245;c.save();for(let i=0;i<11;i++){const a=i*2.399,r=s*(.25+rnd(i)*.55),xx=x+Math.cos(a)*s*.65,yy=y+Math.sin(a)*s*.43;c.globalAlpha=Math.max(0,1-age*.8)*.82;c.fillStyle=['#a73b27','#ea7b32','#ffd27a'][i%3];c.beginPath();for(let k=0;k<10;k++){const theta=k*Math.PI*.2,rr=r*(.75+rnd(i*10+k)*.25);const px=xx+Math.cos(theta)*rr,py=yy+Math.sin(theta)*rr*.8;if(k)c.lineTo(px,py);else c.moveTo(px,py);}c.closePath();c.fill();glow(xx,yy,r*1.2,i%2?'#ee6131':'#ffba56',Math.max(0,1-age)*.35);}c.restore();smoke(x,y,age*.9,.34,1.7);sparks(x,y,t,55,2.2);}
function common(t,id,p){
 c.save();const g=c.createRadialGradient(640,330,240,640,350,780);g.addColorStop(0,'transparent');g.addColorStop(1,'rgba(3,6,17,.50)');c.fillStyle=g;c.fillRect(0,0,W,H);c.restore();
 c.fillStyle='#030610';c.fillRect(0,0,W,24);c.fillRect(0,H-24,W,24);
 if(id!=='title'){small('CROWN CITY',W-35,H-39,11,'#d7d1c4','right',.6);}
 const startAlpha=p<.045?(1-p/.045)*.65:0;if(startAlpha){c.fillStyle=`rgba(2,4,12,${startAlpha})`;c.fillRect(0,0,W,H);}
}
function drawFrame(frame){
 const index=shots.findIndex(s=>frame<s.end),s=shots[index<0?shots.length-1:index],t=(frame-s.start)/FPS,p=clamp((frame-s.start)/(s.frames-1)),global=frame/FPS;
 c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillStyle='#070b16';c.fillRect(0,0,W,H);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 switch(s.id){
 case'city':drawPanel('city',0,p,1.06+p*.045,-p*20,p*8);searchlights(global,.09);cityTrain(t);for(let i=0;i<7;i++)glow(730+i*32,348,10,'#f6cf88',.13+.06*Math.sin(t*2+i));label('THE CITY NEVER SLEEPS.','A METAWINNERS STORY',t,54,606,50);break;
 case'street':drawPanel('city',1,p,1.08,-35+p*65,-4);steam(230,425,t,1);for(let i=0;i<9;i++)pedestrian(730+i*49+Math.sin(i)*25-t*(i%2?-10:12),479+i*4,.62+(i%3)*.11,t,i);vehicle('car',-250+t*410,660,160,t,{reflected:true});rain(global,.7);break;
 case'visor':drawPanel('story',0,p,1.04+p*.09,10-p*24,0);rain(global,.4);glow(690,310,220,'#f14c6c',.055+.025*Math.sin(t*4));label('CHAOS','THE WILDCARD',t,55,600,76);break;
 case'hero':drawPanel('city',0,p,1.12,-70,0);searchlights(global,.12);sprite('stand',920,760,690,Math.sin(t*2)*.009);rain(global,.4);label('ONE JOB.','EVERY DEBT COMES DUE.',t,55,495,83);break;
 case'garage':drawPanel('story',1,p,1.02+p*.065,10-p*18,5);glow(715,610,120,'#53e7da',.08+.05*Math.sin(t*4));steam(1070,660,t,.6);label('STEAL THE KEY.','HUNTER / THE FIRST JOB',t,52,598,54);break;
 case'key':{drawPanel('story',1,p,1.85,-60,-180);c.fillStyle='rgba(3,8,15,.35)';c.fillRect(0,0,W,H);c.save();c.translate(640,350);c.rotate(-.1+Math.sin(t)*.04);glow(0,0,230,'#51d9da',.38);c.fillStyle='#0f303c';c.strokeStyle='#88eadb';c.lineWidth=3;c.beginPath();c.roundRect(-133,-43,266,86,10);c.fill();c.stroke();for(let i=0;i<12;i++)line(-112+i*19,-24,-112+i*19,22,i%3?'#4aaeb0':'#c3ffe9',3,.8);small('PALACE / ARCHIVE',0,7,20,'#c4fff0','center');c.restore();label('BREAK THE HOUSE.','THE ARCHIVE IS THE LEVERAGE.',t,52,600,55);break;}
 case'ignition':drawPanel('city',2,p,1.05,-15,0);smoke(430,640,t,.25);vehicle('car',610+t*90,655,300,t);speed(t,.3);rain(global,.65);break;
 case'chase':drawPanel('city',2,p,1.16,-80+Math.sin(t*.8)*40,-18);vehicle('police',170+Math.sin(t*1.1)*35,565,170,t,{police:true});vehicle('car',760+Math.sin(t*1.4)*90,665,245,t,{angle:Math.sin(t)*.016});smoke(510,649,t,.14);speed(t,1.4);rain(global,.9);if(t>2.6)label('LOSE THE HEAT.','THERE IS NO CLEAN EXIT.',t-2.6,55,265,60);break;
 case'driver':drawPanel('story',2,p,1.06+p*.065,Math.sin(t*13)*2,Math.sin(t*18)*1.5);speed(t,1.1);glow(180,360,550,Math.sin(t*6)>0?'#2b5fda':'#e5575f',.12);break;
 case'run':drawPanel('action',0,p,1.10,-80+p*130,-4);searchlights(global,.17);runner(650+p*35,656,370,t);speed(t,.5);rain(global,.65);label('THE HOUSE OWNS EVERY ROAD.','SO TAKE THE ROOFTOPS.',t,54,175,42);break;
 case'jump':drawPanel('action',0,p,1.13,-p*70,10);sprite('leap',lerp(-80,1510,ease(p)),670-Math.sin(p*Math.PI)*180,350,-.13+p*.19);speed(t,1.3);rain(global,.5);break;
 case'shoot':{drawPanel('story',3,p,1.05+p*.035,-10,8);const f=fract(t*1.5),flash=f<.12&&t>.3;rain(global,.5);sparks(1150,230,t,23,.7);if(flash){glow(1140,248,85,'#ffd297',.7);line(1150,245,1280,225,'#ffd598',2,.8);}glow(300,460,350,Math.sin(t*5)>0?'#324ed7':'#a9345e',.08);break;}
 case'boat':drawPanel('city',3,p,1.08,-p*40,-12);boat(lerp(420,890,p),654,210,t);for(let i=0;i<35;i++){const x=rnd(i+270)*W,y=500+rnd(i+300)*190;line(x+Math.sin(t*2+i)*4,y,x+12+Math.sin(t*2+i)*4,y,'#91d7cb',1,.09);}rain(global,.35);break;
 case'heli':drawPanel('city',0,p,1.16-p*.07,-25,15);searchlights(global,.2);helicopter(420+p*420,420-p*95,185+p*65,t);c.save();c.globalAlpha=.10;c.fillStyle='#c7e8d9';c.beginPath();c.moveTo(470+p*420,390-p*95);c.lineTo(500+p*420,720);c.lineTo(850+p*420,720);c.closePath();c.fill();c.restore();speed(t,.3);break;
 case'mage':{drawPanel('action',1,p,1.04,0,0);c.fillStyle='rgba(4,8,16,.7)';c.fillRect(0,24,W,H-48);const im=images.gold,sz=540+p*18,x=713-p*8,y=79-p*9;c.strokeStyle='#bd934a';c.lineWidth=3;c.strokeRect(x-8,y-8,sz+16,sz+16);c.drawImage(im,x,y,sz,sz);glow(994,380,330,'#e6ad57',.055);title('GOLD MAGE',55,310,75);small('THE HOUSE',58,351,22,'#e3b65e');title('EVERY DEBT',57,462,47);title('COMES DUE.',57,521,47);embers(t,17,.25);break;}
 case'bike':c.save();c.translate(0,30);drawPanel('action',2,p,1.02,Math.sin(t*9)*2,Math.sin(t*12)*2);c.restore();speed(t,1.2);rain(global,.8);sparks(400,590,t,30,.7);break;
 case'escape':drawPanel('action',3,p,1.08,-p*100,5);runner(530+p*230,675,350,t);helicopter(890-p*100,250,80,t,.65);speed(t,.6);embers(t,24,.35);break;
 case'blast':drawPanel('action',0,p,1.1,Math.sin(t*32)*Math.max(0,7-t*5),Math.cos(t*27)*Math.max(0,5-t*4));blast(440,470,t);sprite('leap',700+p*700,650-Math.sin(p*Math.PI)*150,440,-.12);speed(t,1);embers(t,75,.8);break;
 case'dawn':drawPanel('action',3,p,1.08-p*.035,-10,0);sprite('stand',960,767,650,Math.sin(t*1.4)*.007);embers(t,20,.3);label('MAKE YOUR OWN EXIT.','THE HOUSE DOESN’T OWN YOU.',t,54,507,57);break;
 case'montage':{const q=Math.min(3,Math.floor(t/(BAR/4)));const plates=[['story',0],['story',1],['action',2],['city',0]],a=plates[q];c.save();if(q===2)c.translate(0,30);drawPanel(a[0],a[1],p,q===2?1.02:1.12,0,0);c.restore();c.save();c.fillStyle='rgba(8,13,30,.3)';c.beginPath();c.moveTo(850,0);c.lineTo(1280,0);c.lineTo(1280,720);c.lineTo(400,720);c.fill();c.restore();speed(t,1.1);break;}
 case'title':{drawPanel('action',3,p,1.04+p*.03,0,0);c.fillStyle='rgba(3,7,19,.72)';c.fillRect(0,0,W,H);embers(t,30,.4);const a=ease(clamp(t*2));c.save();c.translate(640,330);c.scale(1.08-a*.08,1.08-a*.08);title('CROWN CITY',0,0,140,'#ffe2a1','center',a);c.restore();small('A METAWINNERS STORY',640,196,20,'#85ded5','center',a);title('NEON DEBT',640,411,54,'#e6e9e2','center',a);line(460,442,820,442,'#6dbfb9',2,a);small('ANIME OPENING',640,483,19,'#88dcd1','center',a);small('avp86fr-jpg.github.io/crown-city',640,582,21,'#e6decf','center',clamp((t-1.1)*2));small('Animated cinematic · Game visuals differ · Independent fan-made game',640,660,12,'#a6afba','center',clamp((t-1.5)*2));if(t>4.55){c.fillStyle=`rgba(2,4,10,${clamp((t-4.55)/.4)})`;c.fillRect(0,0,W,H);}break;}
 }
 common(global,s.id,p);return{id:s.id,frame,time:global};
}
window.ready=(async()=>{
 for(const [key,file] of Object.entries({city:'city.webp',story:'story.webp',actors:'actors.webp',fleet:'fleet.webp',action:'action.webp',run:'run.webp'}))images[key]=await load(ASSET+file);
 images.gold=await load('../../assets/portraits/gold_mage_reference.jpg');
 const font=new FontFace('AnimeAnton','url(../../about/assets/fonts/anton-latin.woff)'),body=new FontFace('AnimeBarlow','url(../../about/assets/fonts/barlow-bold.woff2)');await Promise.all([font.load(),body.load()]);document.fonts.add(font);document.fonts.add(body);
 const a=images.actors;Object.assign(sprites,{leap:trim(a,[0,0,600,570]),land:trim(a,[600,0,599,575]),stand:trim(a,[0,575,500,737])});
 Object.assign(sprites,{car:trim(images.fleet,[0,0,860,465]),police:trim(images.fleet,[862,0,810,465]),boat:trim(images.fleet,[0,470,850,471]),heli:trim(images.fleet,[860,465,812,476])});
 for(let i=0;i<8;i++){const cw=Math.floor(images.run.width/4),ch=Math.floor(images.run.height/2);sprites['run'+i]=trim(images.run,[i%4*cw,Math.floor(i/4)*ch,cw,ch]);}
 window.film={canvas,shots,drawFrame,FPS,duration:60,sprites:Object.fromEntries(Object.entries(sprites).map(([k,s])=>[k,s.rect]))};drawFrame(1);return true;
})();
