"""Pass 8 original stations: OPEN ROAD 89.3 (desert highway rock-pop) and
HARBOUR LIGHTS (slow night swell). Authored chord/melody patterns, the same
synthesized instruments as compose-score.py; no samples or external melodies.
Requires numpy, scipy and ffmpeg."""
import importlib.util,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
spec=importlib.util.spec_from_file_location('cs',Path(__file__).with_name('compose-score.py'));cs=importlib.util.module_from_spec(spec);spec.loader.exec_module(cs)
SR,inst,DR,OUT=cs.SR,cs.inst,cs.DR,cs.OUT
SONGS={
 'open-road':dict(bpm=112,root=38,chords=[0,5,-2,3,0,5,7,5],bars=40,lead='guitar',hook=[(0,7,.5),(.5,9,.5),(1,12,1),(2.5,9,.5),(3,7,1),(4,5,.5),(4.5,7,.5),(5,9,1.5),(7,12,.75),(8,14,1),(9.5,12,.5),(10,9,1),(11.5,7,.5),(12,9,1.5),(14,5,.5),(14.5,7,1.5)],kick=[0,1.5,2,3],shaker=True),
 'harbour-lights':dict(bpm=76,root=41,chords=[0,-4,-7,-2],bars=24,lead='keys',hook=[(0,12,1.5),(2,15,1),(3,14,1),(4,10,2),(6.5,12,1),(8,7,1.5),(10,10,1),(11,12,1),(12,15,2.5),(15,14,1)],kick=[0,2.5],shaker=False),
}
def compose(name,bpm,root,chords,bars,lead,hook,kick,shaker):
 beat=60/bpm;length=int(bars*4*beat*SR);mix=np.zeros((length,2),np.float32)
 def add(x,start,vol,pan=0):
  off=int(start*SR)%length;x=x*vol;g=np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)],np.float32)
  end=min(length-off,len(x));mix[off:off+end]+=x[:end,None]*g
  if end<len(x):mix[:len(x)-end]+=x[end:,None]*g
 rng=np.random.default_rng(8088)
 for bar in range(bars):
  sec=bar//8;base=root+chords[bar%len(chords)];start=bar*4*beat;third=4 if chords[bar%len(chords)] in (0,5,7) else 3
  for j,n in enumerate([0,third+3 if False else 7,12,third+12]):add(inst(base+24+n,beat*4.1,'pad'),start,.07 if name=='open-road' else .095,(j-1.5)*.3)
  # Driving eighth-note bass for the road, long roots for the harbour.
  if name=='open-road':
   for k in range(8):add(inst(base+(12 if k in (3,7) else 0),beat*.45,'bass'),start+k*.5*beat,.22)
  else:
   for pos in [0,2.5]:add(inst(base,beat*2.2,'bass'),start+pos*beat,.26)
  if sec>0 or bar>=2:
   for p in kick:add(DR['kick'],start+p*beat,.52)
   for p in [1,3]:add(DR['snare' if name=='open-road' else 'clap'],start+p*beat,.3 if name=='open-road' else .14)
  for k in range(8):
   swing=.06 if name=='harbour-lights' and k%2 else 0
   add(DR['hat'],start+(k/2+swing)*beat,(.26 if k%2 else .16)*(1+.1*np.sin(k+bar)),(-1 if k%2 else 1)*.4)
   if shaker:add(DR['hat'],start+(k/2+.25)*beat,.09,.6)
  # Strummed chord stabs (road) or broken arpeggio (harbour).
  if name=='open-road':
   for p in [0,.75,1.5,2.5,3,3.5]:
    for j,n in enumerate([0,7,12,third+12]):add(inst(base+24+n,beat*.5,'guitar'),start+(p+j*.012)*beat,.04,(j-1.5)*.2)
  else:
   for k,n in enumerate([0,7,12,third+12,19,third+12,12,7]):add(inst(base+24+n,beat*1.2,'keys'),start+k*.5*beat,.045,(k%4-1.5)*.3)
  if sec in ([1,3,4] if name=='open-road' else [1,2]):
   for pos,n,d in hook:
    if int(pos//4)!=bar%4:continue
    add(inst(root+24+n,beat*d,lead),start+(pos%4)*beat,.11 if lead=='guitar' else .1,.15)
  if bar%8==7:
   for j in range(4):add(DR['tom'],start+(3+j*.25)*beat,.2+j*.02,j*.25-.4)
 dry=mix.copy()
 for delay,gain in [(beat*.75,.16),(beat*1.5,.09),(.031,.08)]:mix+=np.roll(dry[:,::-1],int(SR*delay),axis=0)*gain
 mix=signal.sosfilt(signal.butter(2,32,fs=SR,btype='highpass',output='sos'),mix,axis=0)
 mix=np.tanh(mix*1.1);mix*=.75/max(.1,np.max(np.abs(mix)))
 ramp=np.linspace(0,1,240,dtype=np.float32);mix[:240]*=ramp[:,None];mix[-240:]*=ramp[::-1,None]
 with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
  wavfile.write(tmp.name,SR,(mix*32767).astype(np.int16))
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',tmp.name,'-c:a','libvorbis','-q:a','4',str(OUT/(name+'.ogg'))],check=True)
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(OUT/(name+'.ogg')),'-c:a','libmp3lame','-b:a','160k',str(OUT/(name+'.mp3'))],check=True)
 print(name,round(length/SR,1),'s')
if __name__=='__main__':
 for k,v in SONGS.items():compose(k,**v)
