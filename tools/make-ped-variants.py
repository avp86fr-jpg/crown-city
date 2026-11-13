"""Hand-tuned recolour + accessory pass over the painted crowd atlas.
Produces assets/premium/crowd-looks(.webp|-mobile.webp): LOOKS x 3 columns x 8 rows."""
import numpy as np, re, json, sys
from PIL import Image, ImageDraw, ImageFilter
SRC='assets/premium/crowd.webp'
im=np.asarray(Image.open(SRC).convert('RGBA')).astype(np.float32)/255
H,W=im.shape[:2];CW=W/9;CH=H/8
FR=json.loads(re.search(r'"crowd":(\[\[.*?\]\]\])',open('src/sprite_frames.js').read()).group(1))
def hx(h):return np.array([int(h[i:i+2],16)/255 for i in (1,3,5)],np.float32)
# sex, top, bottom, hair, skin multiplier (r,g,b), hat, hairstyle
LOOKS=[
 ('m','#2c3756','#22252c','#17120f',(1.0,1.0,1.0),None,'short'),     # suit
 ('m','#b5313b','#283063','#1a1410',(.62,.55,.5),None,'short'),     # tracksuit
 ('m','#2fa89f','#cdb68a','#5a3a22',(1.08,1.02,.95),'sun','short'), # beach shirt + shorts
 ('m','#e2772a','#3d5a86','#2a1f18',(.78,.7,.62),'hard','short'),   # hi-vis workwear
 ('m','#5e4a6e','#4a4d55','#cfcac2',(1.1,1.04,1.0),None,'bald'),    # elderly cardigan
 ('m','#4d7944','#3b5476','#3a2a1c',(.9,.85,.75),'cap','short'),    # casual
 ('f','#b02c3c','#3a1e24','#120d0b',(.95,.9,.86),None,'bun'),       # red dress
 ('f','#3d6db0','#2a2f3a','#d9b25e',(1.1,1.05,1.0),None,'pony'),    # blue skirt, blonde
 ('f','#2f6b60','#22302d','#3b2618',(.6,.52,.46),None,'bun'),       # grey suit
 ('f','#ea8c78','#f0e8d8','#5a341c',(1.06,1.0,.92),'sun','long'),   # beachwear
 ('f','#d6c13a','#3c4f6e','#8a3a1e',(.85,.78,.7),'hard','pony'),    # workwear
 ('f','#9b8ab0','#55505e','#d8d6d2',(1.12,1.06,1.02),None,'bun'),   # elderly
]
# look index -> (kind, colour, waist y, hem y, flare) as fractions of the frame height
GARMENT={6:('dress','#a8283a',.46,.74,1.32),7:('skirt','#2c3f6e',.47,.63,1.12),8:('skirt','#285a51',.47,.66,1.0),
 9:('dress','#e08672',.47,.68,1.24),11:('dress','#7b6c90',.46,.8,1.18)}
def hls(rgb):
 mx=rgb.max(-1);mn=rgb.min(-1);l=(mx+mn)/2;d=mx-mn
 s=np.where(d<1e-6,0,d/np.maximum(1e-6,1-np.abs(2*l-1)))
 r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
 h=np.where(mx==r,((g-b)/np.maximum(d,1e-6))%6,np.where(mx==g,(b-r)/np.maximum(d,1e-6)+2,(r-g)/np.maximum(d,1e-6)+4))*60
 return np.where(d<1e-6,0,h),l,s
def paint(cell,frame,look):
 sex,top,bot,hair,skin,hat,style=look
 x0,y0,fw,fh=frame[0],frame[1],frame[2],frame[3]
 a=cell[...,3];rgb=cell[...,:3].copy();h,l,s=hls(rgb)
 yy=(np.arange(cell.shape[0])[:,None]-y0)/fh*np.ones((1,cell.shape[1]))
 op=a>.1
 warm=((h<50)|(h>340))
 skinm=op&warm&(s>.22)&(l>.32)&(l<.85)
 if sex=='m':
  topm=op&(h>170)&(h<265)&~skinm
  botm=op&~topm&~skinm&(l<.26)&(yy>.5)
  hairm=op&~skinm&(yy<.2)&(l<.3)&~topm
 else:
  coat=op&(h>12)&(h<58)&(s>.26)&(yy>.2)
  skinm=skinm&~coat
  topm=coat
  botm=op&~topm&~skinm&(l<.28)&(yy>.62)
  hairm=op&~skinm&~topm&(yy<.3)&(l<.4)
 def tint(mask,col,ref=None):
  if not mask.any():return
  L=l[mask];m=ref if ref else max(.08,float(np.median(L)))
  sh=np.clip(L/m,0.35,1.6)[:,None]
  c=hx(col)
  out=np.clip(c*sh,0,1)
  # keep a hint of painted texture
  rgb[mask]=out*.88+rgb[mask]*.12*sh/np.maximum(sh,1e-3)
 tint(topm,top);tint(botm,bot)
 if style=='bald':tint(hairm,'#c79a7c')
 else:tint(hairm,hair)
 rgb[skinm]=np.clip(rgb[skinm]*np.array(skin,np.float32),0,1)
 a=a.copy()
 g=GARMENT.get(LOOKS.index(look))
 if g:
  # Silhouette pass: paint the garment as a real shape over the legs. The
  # hem follows each frame's leg spread so dresses swing with the stride.
  kind,col,top_y,hem_y,flare=g
  Hh,Ww=op.shape;rows=np.arange(Hh)
  def ext(yf):
   r=int(y0+fh*yf);r=min(max(r,0),Hh-1);xs=np.nonzero(op[r,int(x0):int(x0+fw)])[0]
   return (x0+xs.min(),x0+xs.max()) if len(xs) else None
  wa=ext(top_y+.02);hm=ext(hem_y-.02)
  if wa and hm:
   cxw=(wa[0]+wa[1])/2;hw=max(3.0,(wa[1]-wa[0])*.5*.46)
   l0,l1=hm;mid=(l0+l1)/2;half=max(hw*1.05,(l1-l0)/2)*flare
   ty=y0+fh*top_y;hy=y0+fh*hem_y
   m=Image.new('L',(Ww,Hh),0);dd=ImageDraw.Draw(m)
   pts=[(cxw-hw,ty),(cxw+hw,ty)]+[(mid+half*np.cos(t),hy+fh*.018*np.sin(t)) for t in np.linspace(0,np.pi,9)]
   dd.polygon(pts,fill=255);m=m.filter(ImageFilter.GaussianBlur(.7))
   mk=np.asarray(m,np.float32)/255
   xs=(np.arange(Ww)[None,:]-(mid-half))/max(1,2*half);ys=(rows[:,None]-ty)/max(1,hy-ty)
   shade=np.clip(1.22-.5*xs-.1*ys+.18*np.exp(-((xs-.32)/.09)**2),.55,1.3)
   fold=1-.16*np.clip((np.abs(np.sin(xs*np.pi*3.2))-.8)*5,0,1)*np.clip(ys*1.4,0,1)
   hem=np.where(ys>.9,.72,1.0)
   c=hx(col)[None,None,:]*(shade*fold*hem)[...,None]
   k=mk[...,None]*.97
   rgb=rgb*(1-k)+np.clip(c,0,1)*k;a=np.maximum(a,mk*.98)
 out=np.concatenate([rgb,a[...,None]],-1)
 img=Image.fromarray((out*255).astype(np.uint8),'RGBA')
 # head position: centroid of opaque pixels in the top 14% of the frame
 ys,xs=np.nonzero(op[int(y0):int(y0+fh*.14),int(x0):int(x0+fw)])
 if len(xs):
  cx=x0+xs.mean();cy=y0+ys.mean()+2;r=fh*.075
  d=ImageDraw.Draw(img)
  if style=='bun' and not hat:d.ellipse([cx-r*.55,cy-r*1.25,cx+r*.55,cy-r*.2],fill=hx(hair).__mul__(255).astype(int).tolist().__iter__().__class__ and tuple(int(v*255*.85) for v in hx(hair))+(255,))
  if style=='pony' and not hat:d.ellipse([cx-r*.4,cy-r*1.5,cx+r*.4,cy-r*.3],fill=tuple(int(v*255*.85) for v in hx(hair))+(255,))
  if style=='long':d.ellipse([cx-r*1.15,cy-r*.6,cx+r*1.15,cy+r*1.35],fill=tuple(int(v*255*.8) for v in hx(hair))+(255,))
  if hat=='sun':d.ellipse([cx-r*1.75,cy-r*1.2,cx+r*1.75,cy+r*.75],fill=(214,190,128,255),outline=(150,120,70,255),width=2);d.ellipse([cx-r*.8,cy-r*.85,cx+r*.8,cy+r*.35],fill=(232,212,150,255));d.arc([cx-r*.85,cy-r*.9,cx+r*.85,cy+r*.4],10,170,fill=(170,60,50,255),width=3)
  if hat=='hard':d.ellipse([cx-r*1.1,cy-r*1.05,cx+r*1.1,cy+r*.55],fill=(232,196,40,255),outline=(150,110,20,255),width=2);d.line([cx,cy-r,cx,cy+r*.5],fill=(250,226,110,255),width=3)
  if hat=='cap':d.ellipse([cx-r*.95,cy-r*.95,cx+r*.95,cy+r*.45],fill=(40,56,92,255));d.ellipse([cx-r*.6,cy-r*.25,cx+r*.6,cy+r*.75],fill=(30,42,70,255))
  # draw head shape below accessories is preserved; mask accessories outside cell alpha is fine
 return img
outW=int(round(len(LOOKS)*3*CW));atlas=Image.new('RGBA',(outW,H),(0,0,0,0))
src=Image.open(SRC).convert('RGBA')
for li,look in enumerate(LOOKS):
 c0=0 if look[0]=='m' else 3
 for j in range(3):
  for row in range(8):
   f=FR[row][c0+j];cx0=int(round((c0+j)*CW));cy0=int(round(row*CH))
   cell=im[cy0:int(round((row+1)*CH)),cx0:int(round((c0+j+1)*CW))]
   fr=(f[0]-cx0,f[1]-cy0,f[2],f[3])
   out=paint(cell,fr,look)
   atlas.alpha_composite(out,(int(round((li*3+j)*CW)),cy0))
# Readability at street zoom: a soft dark rim around every silhouette so
# figures separate from pavement and from each other in crowds.
from PIL import ImageFilter
al=atlas.getchannel('A');dil=al.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
rim=np.clip(np.asarray(dil,np.float32)-np.asarray(al,np.float32),0,255)*.55
rl=Image.new('RGBA',atlas.size,(14,16,22,0));rl.putalpha(Image.fromarray(rim.astype(np.uint8)))
rl.alpha_composite(atlas);atlas=rl
k=128/CH
full=atlas.resize((int(outW*k),int(H*k)),Image.LANCZOS);full.save('assets/premium/crowd-looks.webp',quality=86,method=6)
mob=atlas.resize((int(outW*k*.5),int(H*k*.5)),Image.LANCZOS);mob.save('assets/premium/crowd-looks-mobile.webp',quality=84,method=6)
prev=Image.new('RGBA',full.size,(96,118,96,255));prev.alpha_composite(full);prev.convert('RGB').save('/tmp/looks_prev.png')
print(full.size,mob.size,json.dumps({'looks':len(LOOKS)}))
