"""Assemble the 44-second Night Dividend film, stereo score and light sound design."""
from pathlib import Path
import subprocess
import wave
import numpy as np
from scipy.signal import butter,sosfilt
ROOT=Path('.qa/final-media');RATE=48000
SHOTS=['pursuit','street','canal','casino','gold','heli','plane','forest','train','combat','night','end']
def run(*args):subprocess.run(['ffmpeg','-v','error','-y',*map(str,args)],check=True)
with wave.open(str(ROOT/'night-dividend-trailer.wav'),'rb') as f:music=np.frombuffer(f.readframes(f.getnframes()),dtype='<i2').reshape(-1,2).astype(float)/32768
rng=np.random.default_rng(902);fx=np.zeros_like(music)
def add(start,sound,gain=.1,pan=0):
    offset=round(start*RATE);n=min(len(sound),len(fx)-offset)
    fx[offset:offset+n,0]+=sound[:n]*gain*np.sqrt((1-pan)*.5)
    fx[offset:offset+n,1]+=sound[:n]*gain*np.sqrt((1+pan)*.5)
def motor(start,length,frequency,end,power):
    t=np.arange(round(length*RATE))/RATE;hz=np.linspace(frequency,end,len(t));phase=2*np.pi*np.cumsum(hz)/RATE
    sound=(np.sin(phase)+.35*np.sin(phase*2.01)+.15*np.sin(phase*4))*.35
    sound+=sosfilt(butter(2,700,fs=RATE,output='sos'),rng.normal(0,.12,len(t)))
    sound*=np.minimum(1,t*5)*np.minimum(1,(length-t)*3);add(start,sound,power,-.15)
motor(0,4,46,95,.23);motor(6,4,38,61,.15);motor(14,4,24,35,.18);motor(18,4,80,145,.14);motor(34,6,55,110,.2)
for start,length in [(0,4),(30,4),(34,5.5)]:
    t=np.arange(round(length*RATE))/RATE;hz=720+150*np.sin(2*np.pi*t*1.2);sir=np.sin(2*np.pi*np.cumsum(hz)/RATE)
    env=np.minimum(1,t*2)*np.minimum(1,(length-t)*2);add(start,sir*env,.018,.35)
for start in [6,14,22,30,34]:
    t=np.arange(int(.32*RATE))/RATE;noise=rng.normal(0,1,len(t));whoosh=sosfilt(butter(2,[500,4000],btype='bandpass',fs=RATE,output='sos'),noise)
    add(start-.24,whoosh*np.sin(np.pi*t/.32)**2,.025,-.25)
for start in np.arange(30.4,32.6,.14):
    t=np.arange(int(.15*RATE))/RATE;crack=rng.normal(0,.5,len(t))*np.exp(-t*65)+np.sin(2*np.pi*110*t)*np.exp(-t*30)*.4;add(start,crack,.07,.1)
mixed=music+fx;mixed*=min(1,.93/max(.01,np.abs(mixed).max()))
with wave.open(str(ROOT/'film-mix.wav'),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((mixed*32767).astype('<i2').tobytes())
(ROOT/'edit.txt').write_text('\n'.join("file '"+name+".mp4'" for name in SHOTS)+'\n')
run('-f','concat','-safe','0','-i',ROOT/'edit.txt','-i',ROOT/'film-mix.wav','-map','0:v:0','-map','1:a:0','-t','44','-c:v','libx264','-preset','slow','-crf','25','-maxrate','1700k','-bufsize','3400k','-pix_fmt','yuv420p','-r','30','-af','loudnorm=I=-16:TP=-1.5:LRA=8','-c:a','aac','-b:a','160k','-ar','48000','-movflags','+faststart','about/assets/crown-city-trailer-720p.mp4')
for source,target in [('street-raw-30','afterhours-street'),('night-raw-90','afterhours-drive'),('casino-raw-30','frontier-casino'),('canal-raw-60','frontier-canal'),('plane-raw-60','frontier-airport'),('train-raw-60','metro-station'),('forest-raw-60','pinewatch-wildlife'),('gold-raw-30','afterhours-story')]:
    run('-i',ROOT/(source+'.png'),'-c:v','libwebp','-quality','88','about/assets/shots/'+target+'.webp')
run('-i',ROOT/'pursuit-0.png','-c:v','libwebp','-quality','88','about/assets/trailer-poster.webp')
print('Built 44-second film, poster and eight current game captures.',flush=True)
