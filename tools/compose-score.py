"""Reproducible original Crown City score: authored patterns + synthesized instruments.
No external recordings, melodies, samples or model downloads. Outputs seamless Ogg loops.
Requires numpy, scipy and ffmpeg. Generation is offline; the game streams the files.
"""
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
import subprocess, tempfile
SR=24000
rng=np.random.default_rng(86420)
OUT=Path(__file__).resolve().parents[1]/'assets'/'music';OUT.mkdir(exist_ok=True)
def hz(m):return 440*2**((m-69)/12)
def inst(m,dur,kind):
 t=np.arange(int(SR*dur))/SR;f=hz(m)
 if kind=='bass':
  x=np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*2*t)+.09*np.sin(2*np.pi*f*3*t)
  env=(1-np.exp(-t*180))*np.exp(-t*4.5)
 elif kind=='keys':
  x=np.sin(2*np.pi*f*t+2*np.sin(2*np.pi*f*2*t)*np.exp(-t*3))+.25*np.sin(2*np.pi*f*3*t)*np.exp(-t*5)
  env=(1-np.exp(-t*220))*np.exp(-t*2.8)
 elif kind=='guitar':
  x=sum(np.sin(2*np.pi*f*k*t)*np.exp(-t*k*3.2)/k for k in range(1,9))
  env=(1-np.exp(-t*380))*np.exp(-t*2.2)
 elif kind=='pad':
  x=sum(np.sin(2*np.pi*(f*(1+k*.0017))*t)/3 for k in [-1,0,1])+.18*np.sin(2*np.pi*f*2*t)
  env=np.minimum(1,t/.15)*np.minimum(1,(dur-t)/.3)*(.8+.1*np.sin(t*3))
 elif kind=='brass':
  x=sum(np.sin(2*np.pi*f*k*t+.1*np.sin(t*5))/k**1.5 for k in range(1,7))
  env=(1-np.exp(-t*50))*np.exp(-t*4)
 else:
  x=np.sin(2*np.pi*f*t+.28*np.sin(2*np.pi*f*2*t));env=(1-np.exp(-t*100))*np.exp(-t*2)
 return (x*env).astype(np.float32)
def drum(kind):
 dur={'kick':.4,'snare':.24,'hat':.09,'open':.26,'clap':.2,'tom':.3}[kind];t=np.arange(int(SR*dur))/SR;n=rng.normal(0,1,len(t))
 if kind=='kick':x=np.sin(2*np.pi*(46*t+70*.025*(1-np.exp(-t/.025))))*np.exp(-t*13)+n*np.exp(-t*160)*.16
 elif kind=='snare':x=signal.sosfilt(signal.butter(2,1600,fs=SR,btype='high',output='sos'),n)*np.exp(-t*22)*.5+np.sin(2*np.pi*185*t)*np.exp(-t*34)*.4
 elif kind=='clap':x=signal.sosfilt(signal.butter(2,[700,4500],fs=SR,btype='band',output='sos'),n)*sum(np.exp(-np.maximum(0,t-v)*45)*(t>=v) for v in [0,.012,.026])*.25
 elif kind=='tom':x=np.sin(2*np.pi*(100*t+50*.04*(1-np.exp(-t/.04))))*np.exp(-t*13)
 else:x=signal.sosfilt(signal.butter(2,6500,fs=SR,btype='high',output='sos'),n)*np.exp(-t*(58 if kind=='hat' else 15))*.23
 return x.astype(np.float32)
DR={k:drum(k) for k in ['kick','snare','hat','open','clap','tom']}
MELODY=[(0,12,.75),(1.5,15,.5),(2.5,19,.5),(3.25,17,.5),(4,15,.75),(5.5,12,.5),(6.5,10,.5),(7.25,7,.5),
 (8,12,.5),(9.25,19,.5),(10,22,.8),(11.5,19,.5),(12.5,17,.5),(13.25,15,.5),(14.5,14,.5),(15.25,12,.65)]
def compose(name,bpm,root,style):
 beat=60/bpm;bars=32;length=int(bars*4*beat*SR);mix=np.zeros((length,2),np.float32)
 def add(x,start,vol,pan=0):
  off=int(start*SR)%length;x=x*vol;g=np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)],np.float32)
  end=min(length-off,len(x));mix[off:off+end]+=x[:end,None]*g
  if end<len(x):mix[:len(x)-end]+=x[end:,None]*g
 for bar in range(bars):
  section=bar//8;chord=[0,-3,5,-5][(bar//2)%4];base=root+chord;start=bar*4*beat
  # 7th/9th harmony, open voicings, chorus sections and small voicing changes.
  for j,n in enumerate([0,7,10,14] if style!='chase' else [0,7,12]):
   add(inst(base+24+n,beat*4.2,'pad'),start,.075 if style!='chase' else .06,(j-1.5)*.24)
  for pos in [0,.75,1.5,2,2.75,3.5]:
   note=base+(12 if pos in [1.5,3.5] else 0)+(7 if pos==2.75 else 0)
   add(inst(note,beat*.7,'bass'),start+pos*beat,.24 if style!='chase' else .3)
  for p in ([0,1.75,2.5] if style=='night' else [0,1.5,2,3.5] if style=='lofi' else [0,1,2,3]):add(DR['kick'],start+p*beat,.56)
  if section!=0 or bar>=2:
   for p in [1,3]:add(DR['snare'],start+p*beat,.33);add(DR['clap'],start+(p+.02)*beat,.17)
  for k in range(8 if style!='chase' else 16):
   pos=k/(2 if style!='chase' else 4);swing=.08 if style=='lofi' and k%2 else 0
   add(DR['open'] if k%8==7 else DR['hat'],start+(pos+swing)*beat,.36 if k%2 else .24,(-1 if k%2 else 1)*.35)
  # Syncopated Rhodes/guitar rhythm; the bridge removes the busier layer.
  if section!=2 or bar%2==0:
   for p in [.5,1.75,2.5,3.25]:
    for j,n in enumerate([0,3,7,10]):add(inst(base+24+n,beat*.9,'keys' if style=='lofi' else 'guitar'),start+p*beat,.035+(section==3)*.01,(j-1.5)*.25)
  # Authored call-and-response hook, introduced after the intro.
  if section in [1,3] or style=='chase':
   for pos,n,d in MELODY:
    if int(pos//4)!=bar%4:continue
    p=pos%4;note=root+24+n+(12 if style=='chase' else 0)
    add(inst(note,beat*d,'brass' if style=='night' else 'lead'),start+p*beat,.09 if style!='chase' else .07,-.15)
  if bar%8==7:
   for j in range(4):add(DR['tom'],start+(3+j*.25)*beat,.22+j*.025,j*.25-.4)
 # Stereo delays and a short room tail wrap across the loop boundary.
 dry=mix.copy()
 for delay,gain in [(beat*.75,.15),(beat*1.5,.08),(.037,.08)]:mix+=np.roll(dry[:,::-1],int(SR*delay),axis=0)*gain
 mix=np.tanh(mix*1.3);mix*=.82/max(.1,np.max(np.abs(mix)))
 # Tiny edge ramp prevents a click without obscuring the bar-line transition.
 ramp=np.linspace(0,1,240,dtype=np.float32);mix[:240]*=ramp[:,None];mix[-240:]*=ramp[::-1,None]
 with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
  wavfile.write(tmp.name,SR,(mix*32767).astype(np.int16))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',tmp.name,'-c:a','libvorbis','-q:a','4',str(OUT/(name+'.ogg'))],check=True)
 print(name,round(length/SR,2),'seconds')
for args in [('veil-afterhours',108,40,'night'),('chip-sidewalk',92,43,'lofi'),('nightshift-escape',132,38,'chase')]:compose(*args)
