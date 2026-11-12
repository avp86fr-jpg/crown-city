"""NEON DEBT: original 144 BPM E-minor electronic-rock anime opening.
36 bars / 60 seconds. FluidSynth/TimGM6mb instruments; authored synth and Foley.
Music source and rendered score: GPL-2.0, see assets/music/LICENSE-TimGM.txt.
"""
import importlib.util,json,wave
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt
spec=importlib.util.spec_from_file_location('inst',Path(__file__).with_name('compose-night-dividend.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
OUT=Path('.qa/anime-opening');OUT.mkdir(parents=True,exist_ok=True)
RATE=48000;BEAT=60/144;N=RATE*60;rng=np.random.default_rng(199711);events=[];subnotes=[];kicks=[]
def note(ch,b,key,dur,vel):
    t=max(0,b*BEAT+(rng.uniform(-.003,.003) if ch in [1,2,9] else 0));events.extend([(round(t*RATE),1,ch,key,vel),(round((t+dur*BEAT)*RATE),0,ch,key,0)])
roots=[40,36,43,38];chords=[[64,67,71,76],[64,67,72,76],[62,67,71,74],[62,66,69,74]]
for bar in range(36):
    b=bar*4;idx=(bar//2)%4;root=roots[idx];chord=chords[idx];intro=bar<4;villain=23<=bar<25;ending=bar>=34;full=not intro and not villain and not ending
    if ending:
        if bar==34:
            for n in [52,59,64,67,71,76]:note(3,b,n,7.8,65)
            for n in [40,52,59,64]:note(1,b,n,6,82);note(2,b,n,6,77)
            note(0,b,40,6.5,104);subnotes.append((b,40,6.7,.095));note(9,b,49,4,88)
        continue
    for n in chord:note(5,b,n-12,3.9,47 if intro or villain else 30)
    if intro or villain:
        for off,n in [(0,chord[0]),(.75,chord[2]),(1.5,chord[3]),(2.5,chord[1]),(3.25,chord[2])]:note(3,b+off,n,.75,56 if intro else 48)
        note(0,b,root,3.2,85);subnotes.append((b,root,3.2,.065))
        if villain:
            note(9,b,36,.2,103);kicks.append(b);note(9,b+2,38,.2,90)
            for n in [root+12,root+19]:note(1,b,n,3.7,58)
    else:
        # Double-tracked power chords: palm-muted verses, open chorus accents.
        for off,dur,vel in [(0,.38,99),(.5,.24,73),(.75,.2,69),(1.5,.35,91),(2,.38,96),(2.75,.22,76),(3,.3,82),(3.5,.3,97)]:
            for n in [root+12,root+19,root+24]:
                note(1,b+off,n,dur,vel);note(2,b+off+.018,n,dur*.96,vel-7)
        for off,n,dur in [(0,root,.42),(.5,root,.25),(.75,root+12,.22),(1.5,root,.42),(2,root,.45),(2.75,root+7,.2),(3,root+12,.23),(3.5,root,.3)]:
            note(0,b+off,n,dur,100 if off in [0,2] else 83);subnotes.append((b+off,n,dur,.065))
        for off in [0,.75,1.5,2,2.75,3.5]:note(9,b+off,36,.12,113 if off in [0,2] else 89);kicks.append(b+off)
        for off in [1,3]:note(9,b+off,38,.15,118);note(9,b+off+.012,39,.1,42)
        for off in np.arange(0,4,.5):note(9,b+float(off),42,.09,54 if off%1 else 75)
        note(9,b+3.5,46,.3,67)
        for off in [1.75,2.25]:note(9,b+off,38,.08,35)
        # A repeating four-bar melody, then a rising response for the final escape.
        if bar%2==0:
            hook=[(0,76,.6),(.75,79,.45),(1.5,78,.45),(2.25,74,.4),(3,71,.75)] if bar%4==0 else [(0,71,.55),(.75,74,.5),(1.5,76,.55),(2.5,79,.65),(3.25,78,.65)]
            if bar>=25:hook=[(o,k+(0 if o<2 else 2),d) for o,k,d in hook]
            for off,key,dur in hook:note(4,b+off,key,dur,76);note(6,b+off,key-12,dur,46)
        for off,n in zip([.25,1.25,2.25,3.25],[chord[0],chord[2],chord[1],chord[3]]):note(3,b+off,n,.3,39)
    if intro and bar>=2:
        for off in [0,2.5]:note(9,b+off,36,.15,87);kicks.append(b+off)
        note(9,b+3,37,.12,78)
        for off in [0,1,2,3]:note(9,b+off,42,.1,51)
    if bar in [3,7,9,13,15,18,22,24,27,29,32,33]:
        for i,key in enumerate([38,48,45,41]):note(9,b+3+i*.25,key,.18,65+i*9)
    if bar in [4,10,14,16,19,21,25,27,30,33]:note(9,b,49,1.6,92)

s=m.new(m.settings);m.sfload(s,b'/usr/share/sounds/sf2/TimGM6mb.sf2',1)
for ch,prog,pan,vol in [(0,34,64,107),(1,30,24,75),(2,29,104,70),(3,4,54,72),(4,81,70,67),(5,89,64,62),(6,48,41,61)]:
    m.program(s,ch,prog);m.cc(s,ch,10,pan);m.cc(s,ch,7,vol);m.cc(s,ch,91,17 if ch!=0 else 2)
m.cc(s,9,7,113);m.cc(s,9,91,11)
size=N+3*RATE;left=np.zeros(size,dtype=np.float32);right=np.zeros_like(left);pos=0
for frame,on,ch,key,vel in sorted(events):
    frame=min(frame,size)
    if frame>pos:m.write(s,frame-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1);pos=frame
    m.noteon(s,ch,key,vel) if on else m.noteoff(s,ch,key)
if size>pos:m.write(s,size-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1)
m.destroy(s);music=np.column_stack([left[:N],right[:N]]).astype(np.float64)
music=sosfilt(butter(2,35,fs=RATE,btype='highpass',output='sos'),music,axis=0)
fx=np.zeros((N,2))
def add(dest,start,sound,gain=1,pan=0):
    at=round(start*RATE);n=min(len(sound),len(dest)-at)
    if at<0 or n<=0:return
    dest[at:at+n,0]+=sound[:n]*gain*np.sqrt((1-pan)*.5);dest[at:at+n,1]+=sound[:n]*gain*np.sqrt((1+pan)*.5)
def noise(seconds,cut=2000):return sosfilt(butter(2,cut,fs=RATE,output='sos'),rng.normal(0,1,round(seconds*RATE)))
for b,key,dur,level in subnotes:
    t=np.arange(round((dur*BEAT+.06)*RATE))/RATE;f=440*2**((key-81)/12);env=np.minimum(1,t/.01)*np.minimum(1,(t[-1]-t)/.05)
    add(music,b*BEAT,np.sin(2*np.pi*f*t)*env,level)
for b in kicks:
    t=np.arange(round(.23*RATE))/RATE;phase=2*np.pi*(45*t+3.7*(1-np.exp(-t*28)));add(music,b*BEAT,np.sin(phase)*np.exp(-t*24),.12)
# Controlled stereo delay adds width to the keys and lead without a muddy low end.
delay=round(BEAT*.75*RATE);tail=sosfilt(butter(2,900,fs=RATE,btype='highpass',output='sos'),music,axis=0)
music[delay:,0]+=tail[:-delay,1]*.075;music[delay:,1]+=tail[:-delay,0]*.075;music=np.tanh(music*1.2)*.9
def engine(start,length,f0,f1,level):
    t=np.arange(round(length*RATE))/RATE;f=np.linspace(f0,f1,len(t))*(1+.025*np.sin(t*11));phase=np.cumsum(f)*2*np.pi/RATE;env=np.minimum(1,t*6)*np.minimum(1,(length-t)*4)
    add(fx,start,(np.sin(phase)+.35*np.sin(phase*2)+noise(length,650)*.25)*env,level,-.1)
engine(4.2,2.1,53,90,.09);engine(15,1.667,45,120,.13);engine(16.667,6.666,90,145,.11);engine(31.667,3.333,42,65,.09);engine(41.667,3.333,110,170,.11)
for start,length in [(16.667,5),(21.667,1.666)]:
    t=np.arange(round(length*RATE))/RATE;phase=np.cumsum(760+210*np.sin(t*5))*2*np.pi/RATE;add(fx,start,np.sin(phase)*np.minimum(1,t*5)*np.minimum(1,(length-t)*4),.024,.45)
for start in [6.667,8.333,13.333,15,16.667,23.333,26.667,28.333,31.667,35,38.333,41.667,45,48.333,50,55]:
    t=np.arange(round(.27*RATE))/RATE;add(fx,start-.23,noise(.27,4200)*np.sin(np.pi*t/.27)**2,.09,-.3)
for start in [29,29.667,30.333,31]:
    t=np.arange(round(.18*RATE))/RATE;add(fx,start,(noise(.18,7200)*np.exp(-t*45)+np.sin(2*np.pi*118*t)*.4*np.exp(-t*25)),.25,.55)
for start in np.arange(23.4,26.6,.27):
    t=np.arange(round(.08*RATE))/RATE;add(fx,float(start),noise(.08,700)*np.exp(-t*50),.10,-.1)
t=np.arange(round(3.333*RATE))/RATE;add(fx,31.667,noise(3.333,1700)*(.5+.5*np.sin(t*8)**2),.11,.1)
t=np.arange(round(3.333*RATE))/RATE;add(fx,35,(noise(3.333,450)+np.sin(2*np.pi*72*t)*.22)*(.25+.75*np.sin(t*2*np.pi*12)**8)*np.minimum(1,t*2)*np.minimum(1,(3.333-t)*3),.15,-.3)
t=np.arange(round(1.5*RATE))/RATE;boom=noise(1.5,1600)*1.7*np.exp(-t*5)+np.sin(2*np.pi*(49*t-6*t*t))*.8*np.exp(-t*4)+noise(1.5,350)*np.exp(-t*2)*.4;add(fx,48.38,boom,.46,.1)
a=round(48.38*RATE);n=round(.8*RATE);music[a:a+n]*=np.linspace(.48,1,n)[:,None]
mix=np.tanh((music+fx)*1.1);mix=sosfilt(butter(2,28,fs=RATE,btype='highpass',output='sos'),mix,axis=0);mix*=.94/max(.94,float(np.max(np.abs(mix))));mix[:960]*=np.linspace(0,1,960)[:,None];mix[-int(.8*RATE):]*=np.linspace(1,0,int(.8*RATE))[:,None]
for name,a in [('neon-debt-score',music),('film-mix',mix)]:
    a=a*min(1,.96/max(.001,np.max(np.abs(a))))
    with wave.open(str(OUT/(name+'.wav')),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((a*32767).astype('<i2').tobytes())
print(json.dumps({'seconds':60,'bpm':144,'events':len(events),'peak':float(np.max(np.abs(mix))),'rms':float(np.sqrt(np.mean(mix**2)))}))
