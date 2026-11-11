"""Original 60-second story overture: Return to Crown, 96 BPM, D minor.
Uses the same credited FluidSynth/TimGM instrument pipeline as Night Dividend.
"""
import importlib.util
from pathlib import Path
import numpy as np
import wave,subprocess
spec=importlib.util.spec_from_file_location('instruments',Path(__file__).with_name('compose-night-dividend.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RATE=m.RATE;beat=60/96;events=[];rng=np.random.default_rng(77812)
def note(ch,b,key,dur,vel):
    t=max(0,b*beat+(rng.uniform(-.009,.009) if ch in [0,2,9] else 0))
    events.extend([(round(t*RATE),1,ch,key,vel),(round((t+dur*beat)*RATE),0,ch,key,0)])
roots=[38,34,43,45];chords=[[62,65,69,76],[62,65,69,72],[62,65,70,74],[61,64,67,73]]
for bar in range(24):
    root=roots[(bar//2)%4];chord=chords[(bar//2)%4];b=bar*4;full=3<=bar<19;breakdown=11<=bar<14
    for key in chord:note(1,b,key-12,3.9,40 if bar<3 else 51)
    for off,key in zip([0,1.5,2.5,3.5],[chord[0],chord[2],chord[3],chord[1]]):note(0,b+off,key,.95,58 if bar<3 else 46)
    note(3,b,root,2.2,76);note(3,b+2.5,root+12,.55,60)
    if full and not breakdown:
        for off in [0,1.75,2.5]:note(9,b+off,36,.15,87)
        for off in [1,3]:note(9,b+off,37,.1,70)
        for off in np.arange(0,4,.5):note(9,b+float(off),42,.1,43 if off%1 else 58)
        for off in [.5,1.5,2.5,3.5]:
            for key in chord[:3]:note(2,b+off,key,.3,40)
        if bar%4==2:
            for off,key,dur in [(0,74,1),(1.5,77,.65),(2.5,76,.5),(3.25,72,.6)]:note(4,b+off,key,dur,57)
    if bar in [3,7,14,18]:note(9,b,49,1.8,62)
    if bar in [2,6,13,17]:
        for i,key in enumerate([48,47,45,43]):note(9,b+3+i*.25,key,.18,40+i*9)
s=m.new(m.settings);m.sfload(s,b'/usr/share/sounds/sf2/TimGM6mb.sf2',1)
for ch,prog,pan,vol in [(0,0,49,84),(1,48,67,67),(2,24,88,67),(3,33,64,98),(4,59,75,74)]:
    m.program(s,ch,prog);m.cc(s,ch,10,pan);m.cc(s,ch,7,vol);m.cc(s,ch,91,38 if ch!=3 else 6)
m.cc(s,9,7,82);m.cc(s,9,91,26)
seconds=60;size=(seconds+3)*RATE;left=np.zeros(size,dtype=np.float32);right=np.zeros_like(left);pos=0
for frame,on,ch,key,vel in sorted(events):
    if frame>pos:m.write(s,frame-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1);pos=frame
    m.noteon(s,ch,key,vel) if on else m.noteoff(s,ch,key)
m.write(s,size-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1);m.destroy(s)
mix=np.column_stack([left,right]);mix[:3*RATE]+=mix[seconds*RATE:];mix=mix[:seconds*RATE]
mix=m.sosfilt(m.butter(2,32,fs=RATE,btype='highpass',output='sos'),mix,axis=0)
mix=np.tanh(mix*1.15);mix*=.91/max(.91,np.max(np.abs(mix)));mix[:480]*=np.linspace(0,1,480)[:,None]
out=Path('.qa/ai');out.mkdir(parents=True,exist_ok=True);wav=out/'return-to-crown.wav'
with wave.open(str(wav),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((mix*32767).astype('<i2').tobytes())
for ext,codec,opts in [('ogg','libvorbis',['-q:a','5']),('mp3','libmp3lame',['-b:a','160k'])]:
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-af','loudnorm=I=-18:TP=-2:LRA=9','-ar','48000','-c:a',codec,*opts,'assets/music/return-to-crown.'+ext],check=True)
print('Return to Crown: 60 seconds, stereo, 96 BPM; Ogg and MP3 exported.')
