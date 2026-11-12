"""HEAT CHECK: original 128 BPM D-minor action-funk trailer score, exactly 60s.
Sample-based Rhodes, muted guitar, bass, brass and kit via the credited
FluidSynth/TimGM6mb pipeline, with authored sub, transitions and vehicle Foley.
No game music or existing trailer assets are overwritten.
"""
import importlib.util,json,wave
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt
spec=importlib.util.spec_from_file_location('instruments',Path(__file__).with_name('compose-night-dividend.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OUT=Path('.qa/upgrade-film');OUT.mkdir(parents=True,exist_ok=True);RATE=48000;BEAT=60/128;N=60*RATE;rng=np.random.default_rng(112612);events=[];bass=[];kicks=[]
def note(ch,b,key,dur,vel):
    t=max(0,b*BEAT+(rng.uniform(-.004,.004) if ch in [1,2,9] else 0));events.extend([(round(t*RATE),1,ch,int(key),int(vel)),(round((t+dur*BEAT)*RATE),0,ch,int(key),0)])
roots=[38,34,43,45];chords=[[62,65,69,72,76],[62,65,69,72],[62,65,70,74],[61,64,67,73]]
for bar in range(32):
    b=bar*4;section=(bar//2)%4;root=roots[section];chord=chords[section];intro=bar<4;breakdown=bar in [17,18,28,29];full=not intro and not breakdown and bar<31
    if bar==31:
        for n in [50,57,62,65,69,76]:note(1,b,n,3.5,65)
        note(0,b,38,3,95);note(3,b,62,2.7,72);note(9,b,49,2.5,80);continue
    for n in chord:note(5,b,n-12,3.8,34 if full else 52)
    if intro or breakdown:
        for off,n in [(0,chord[0]),(.75,chord[2]),(1.5,chord[3]),(2.75,chord[1])]:note(1,b+off,n,.8,72 if off==0 else 55)
        for off in [0,2.5]:note(0,b+off,root,1.2,88);bass.append((b+off,root,1.2,.075))
    else:
        for off,n,length,vel in [(0,0,.7,110),(.75,0,.2,80),(1.25,12,.25,92),(1.75,10,.25,85),(2.5,0,.45,105),(3.25,7,.25,93),(3.75,12,.18,97)]:
            note(0,b+off,root+n,length,vel);bass.append((b+off,root+n,length,.065))
        for off in [.5,1.75,2.5,3.5]:
            for n in chord:note(1,b+off,n,.38,62)
        for off in [.25,.75,1.25,1.75,2.25,2.75,3.25,3.75]:
            for n in chord[1:3]:note(2,b+off,n+12,.13,57 if off%1>.5 else 42)
    if not intro or bar>=2:
        for off in ([0,2.5] if intro or breakdown else [0,.75,1.75,2.5,3.5]):note(9,b+off,36,.15,101 if off in [0,2.5] else 74);kicks.append(b+off)
        for off in [1,3]:note(9,b+off,37 if intro or breakdown else 38,.15,76 if intro or breakdown else 111)
        for off in np.arange(0,4,.5):note(9,b+float(off)+(.035 if off%1 else 0),42,.09,46 if off%1 else 68)
        if full:
            for off in [1.75,2.25]:note(9,b+off,38,.09,36)
            for off in [.25,1.5,2.75,3.75]:note(9,b+off,70,.08,46)
            note(9,b+3.5,46,.3,58)
    # Two complementary melodic hooks, with gaps for the action captions.
    if full and bar%2==0:
        phrase=[(0,74,.45),(.75,77,.3),(1.5,81,.55),(2.5,79,.3),(3.25,77,.55)] if bar%4==0 else [(0,81,.6),(1.25,79,.4),(2,77,.4),(2.75,74,.65)]
        for off,key,dur in phrase:note(3,b+off,key,dur,84);note(4,b+off,key-12,dur,63)
    if full and bar in [9,11,13,15,20,24,26,30]:
        for off,n in zip([.5,1.5,2.25,3.25],[74,72,69,77]):note(6,b+off,n,.45,57)
    if bar in [3,7,10,13,16,18,20,24,27,29]:
        for i,key in enumerate([38,48,45,41]):note(9,b+3+i*.25,key,.14,60+i*10)
    if bar in [4,8,12,14,19,23,26,30]:note(9,b,49,1.4,77)
# Short silence before the RPG downbeat and before the final title makes impacts land.
s=m.new(m.settings);m.sfload(s,b'/usr/share/sounds/sf2/TimGM6mb.sf2',1)
for ch,prog,pan,vol in [(0,33,64,105),(1,4,48,89),(2,28,92,73),(3,61,78,72),(4,65,35,61),(5,89,64,58),(6,81,70,48)]:
    m.program(s,ch,prog);m.cc(s,ch,10,pan);m.cc(s,ch,7,vol);m.cc(s,ch,91,25 if ch!=0 else 3)
m.cc(s,9,7,104);m.cc(s,9,91,12)
size=N+3*RATE;left=np.zeros(size,dtype=np.float32);right=np.zeros_like(left);pos=0
for frame,on,ch,key,vel in sorted(events):
    frame=min(frame,size)
    if frame>pos:m.write(s,frame-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1);pos=frame
    m.noteon(s,ch,key,vel) if on else m.noteoff(s,ch,key)
if size>pos:m.write(s,size-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1)
m.destroy(s);music=np.column_stack([left[:N],right[:N]]).astype(np.float64);music=sosfilt(butter(2,35,fs=RATE,btype='highpass',output='sos'),music,axis=0)
fx=np.zeros((N,2),dtype=np.float64)
def add(dst,start,sound,gain=1,pan=0):
    at=round(start*RATE);n=min(len(sound),len(dst)-at)
    if at<0 or n<=0:return
    dst[at:at+n,0]+=sound[:n]*gain*np.sqrt((1-pan)*.5);dst[at:at+n,1]+=sound[:n]*gain*np.sqrt((1+pan)*.5)
for b,key,dur,gain in bass:
    t=np.arange(round((dur*BEAT+.06)*RATE))/RATE;freq=440*2**((key-69)/12);env=np.minimum(1,t/.009)*np.minimum(1,(t[-1]-t)/.05)
    add(music,b*BEAT,np.sin(2*np.pi*freq*t)*env,gain)
for b in kicks:
    t=np.arange(round(.22*RATE))/RATE;phase=2*np.pi*(48*t+3.2*(1-np.exp(-t*32)));add(music,b*BEAT,np.sin(phase)*np.exp(-t*23),.10)
# Stereo tape delay on the opening/closing keys, restrained during the full band.
delay=round(BEAT*.75*RATE);music[delay:,1]+=music[:-delay,0]*.055
music=np.tanh(music*1.25)*.88

def noise(seconds,cut=1600):
    return sosfilt(butter(2,cut,fs=RATE,output='sos'),rng.normal(0,1,round(seconds*RATE)))
def engine(start,length,f0,f1,level,pan=-.15):
    t=np.arange(round(length*RATE))/RATE;freq=np.linspace(f0,f1,len(t))*(1+.025*np.sin(t*6));phase=np.cumsum(freq)*2*np.pi/RATE
    body=np.sin(phase)+.3*np.sin(phase*2)+.14*np.sin(phase*4.03);env=np.minimum(1,t*7)*np.minimum(1,(length-t)*5)
    add(fx,start,(body*.4+noise(length,700)*.25)*env,level,pan)
for args in [(0,1.875,55,100,.14),(7.5,3.75,60,105,.16),(11.25,3.75,78,126,.17),(15,5.625,105,145,.18),(20.625,1.875,135,175,.16),(31.875,3.75,44,65,.12),(35.625,3.75,93,105,.11),(48.75,3.75,105,145,.13)]:engine(*args)
for start,length in [(0,1.8),(11.25,3.7)]:
    t=np.arange(round(length*RATE))/RATE;phase=np.cumsum(760+180*np.sin(t*7))*2*np.pi/RATE;env=np.minimum(1,t*4)*np.minimum(1,(length-t)*4);add(fx,start,np.sin(phase)*env,.026,.4)
t=np.arange(round(.65*RATE))/RATE;add(fx,12.05,np.sin(2*np.pi*(1250*t-280*t*t))*np.sin(np.pi*t/.65)**2,.034,.2)
for start in [7.5,15,22.5,26.25,31.875,35.625,43.125,52.5,56.25]:
    t=np.arange(round(.28*RATE))/RATE;add(fx,start-.24,noise(.28,4800)*np.sin(np.pi*t/.28)**2,.10,-.3)
for start in np.arange(23.15,24.7,.12):
    t=np.arange(round(.15*RATE))/RATE;hit=noise(.15,7000)*np.exp(-t*45)+.3*np.sin(2*np.pi*108*t)*np.exp(-t*28);add(fx,float(start),hit,.13,.08)
def boom(start,level):
    t=np.arange(round(1.35*RATE))/RATE;sound=noise(1.35,1800)*1.5*np.exp(-t*5)+np.sin(2*np.pi*(52*t-9*t*t))*.7*np.exp(-t*4)+noise(1.35,350)*np.exp(-t*2)*.4;add(fx,start,sound,level,.12)
boom(27.87,.35);boom(30.22,.42)
t=np.arange(round(.55*RATE))/RATE;add(fx,27.45,noise(.55,4000)*np.sin(np.pi*t/.55)**2,.18,-.2)
t=np.arange(round(3.75*RATE))/RATE;add(fx,31.875,noise(3.75,1600)*(.5+.5*np.sin(t*13)**2)*np.minimum(1,t*3)*np.minimum(1,(3.75-t)*3),.14,.1)
t=np.arange(round(1.875*RATE))/RATE;add(fx,39.375,(noise(1.875,400)+np.sin(2*np.pi*75*t)*.3)*(.25+.75*np.sin(t*2*np.pi*13)**8),.15,-.2)
for start,freq in [(41.88,720),(42.28,900),(42.68,1200)]:
    t=np.arange(round(.19*RATE))/RATE;add(fx,start,(np.sin(2*np.pi*freq*t)+.3*np.sin(2*np.pi*freq*2.17*t))*np.exp(-t*25),.11,.2)
t=np.arange(round(3.75*RATE))/RATE;add(fx,43.125,(noise(3.75,650)+np.sin(2*np.pi*62*t)*.16)*(.4+.6*np.maximum(0,np.cos(t*2*np.pi*6))**8)*np.minimum(1,t*2),.13,-.15)
# Gain automation gives the explosions room without flattening the music bed.
for start in [27.87,30.22]:
    a=round(start*RATE);n=round(.7*RATE);music[a:a+n]*=np.linspace(.48,1,n)[:,None]
mix=music+fx;mix=sosfilt(butter(2,28,fs=RATE,btype='highpass',output='sos'),mix,axis=0);mix=np.tanh(mix*1.05);mix*=.93/max(.93,np.max(np.abs(mix)));mix[:480]*=np.linspace(0,1,480)[:,None];mix[-int(.8*RATE):]*=np.linspace(1,0,int(.8*RATE))[:,None]
for name,a in [('heat-check-score',music),('film-mix',mix)]:
    a=a*min(1,.96/max(.001,np.max(np.abs(a))))
    with wave.open(str(OUT/(name+'.wav')),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((a*32767).astype('<i2').tobytes())
print(json.dumps({'seconds':60,'bpm':128,'peak':float(np.max(np.abs(mix))),'rms':float(np.sqrt(np.mean(mix**2))),'midi_events':len(events)}))
