#!/usr/bin/env python3
"""LUCKY ISLE / SUNSET DRIVE - original tropical funk loop for the resort island.
Pure numpy synthesis, no samples. 104 BPM, 32 bars, seamless loop."""
import numpy as np, subprocess, sys, os
SR=44100; BPM=104; BEAT=60/BPM; BAR=BEAT*4; BARS=32; N=int(SR*BAR*BARS)
L=np.zeros(N); R=np.zeros(N); rng=np.random.default_rng(7)
def note(m): return 440*2**((m-69)/12)
def add(sig,t0,pan=0.0,g=1.0):
    i=int(t0*SR)%N; n=len(sig); gl=g*np.sqrt(0.5*(1-pan)); gr=g*np.sqrt(0.5*(1+pan))
    e=min(N,i+n); L[i:e]+=sig[:e-i]*gl; R[i:e]+=sig[:e-i]*gr
    if i+n>N: k=i+n-N; L[:k]+=sig[e-i:]*gl; R[:k]+=sig[e-i:]*gr  # wrap for a seamless loop
def env(n,a=.005,d=.2,s=0.0,rel=.05):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*((1-s)*np.exp(-t/d)+s); r=int(rel*SR)
    if r>0 and r<n: e[-r:]*=np.linspace(1,0,r)
    return e
def steel(m,dur=.5):
    n=int(dur*SR); t=np.arange(n)/SR; f=note(m)
    mod=np.sin(2*np.pi*f*2.0*t)*2.2*np.exp(-t*6)
    return (np.sin(2*np.pi*f*t+mod)*.6+np.sin(2*np.pi*f*4.03*t)*.12*np.exp(-t*12))*env(n,.002,.28,0,.04)
def marimba(m,dur=.35):
    n=int(dur*SR); t=np.arange(n)/SR; f=note(m)
    return (np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*3.9*t)*np.exp(-t*30))*env(n,.001,.12,0,.03)
def bass(m,dur):
    n=int(dur*SR); t=np.arange(n)/SR; f=note(m)
    saw=2*((f*t)%1)-1; sig=np.sin(2*np.pi*f*t)*.8+saw*.25
    k=np.exp(-t*14); sig=np.tanh(sig*(1.4+k))
    return sig*env(n,.004,.35,.55,.04)
def pad(ms,dur):
    n=int(dur*SR); t=np.arange(n)/SR; s=np.zeros(n)
    for m in ms:
        for det in (-.07,.0,.07):
            f=note(m)*2**(det/12); s+=np.sin(2*np.pi*f*t+np.sin(2*np.pi*.3*t)*.4)
    a=np.minimum(1,t/.4)*np.minimum(1,(dur-t)/.4)
    return s/len(ms)/3*a
def kick():
    n=int(.35*SR); t=np.arange(n)/SR; f=48+90*np.exp(-t*30)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*9)*1.1
def snare():
    n=int(.25*SR); t=np.arange(n)/SR; nz=rng.standard_normal(n)
    return (nz*.5*np.exp(-t*18)+np.sin(2*np.pi*190*t)*.4*np.exp(-t*25))
def clap():
    n=int(.2*SR); t=np.arange(n)/SR; nz=rng.standard_normal(n); e=np.exp(-t*30)+.6*np.exp(-np.maximum(0,t-.012)*40)*(t>.012)
    return nz*e*.45
def shaker():
    n=int(.08*SR); t=np.arange(n)/SR; nz=rng.standard_normal(n); nz=np.diff(np.concatenate([[0],nz]))
    return nz*np.exp(-t*60)*.18
def conga(m):
    n=int(.3*SR); t=np.arange(n)/SR; f=note(m)*(1+.4*np.exp(-t*40))
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*13)*.5
# chords: Fmaj7 Am7 Dm7 Bbmaj7 | Gm7 C7 Fmaj7 C/E (one per bar)
prog=[(41,[53,57,60,64]),(45,[52,57,60,64]),(38,[53,57,60,62]),(46,[50,53,57,62]),(43,[50,53,55,58]),(36,[52,55,58,60]),(41,[53,57,60,64]),(40,[52,55,60,64])]
lead=[[(0,72,1),(1,74,.5),(1.5,76,1),(2.5,72,.5),(3,69,1)],[(0,72,.5),(.5,69,.5),(1,67,1),(2,69,.5),(2.5,72,1.5)],
      [(0,74,1),(1,77,.5),(1.5,76,.5),(2,74,1),(3,72,1)],[(0,70,1.5),(1.5,69,.5),(2,67,1),(3,65,1)],
      [(0,67,.5),(.5,70,.5),(1,74,1),(2,72,.5),(2.5,70,1.5)],[(0,72,1),(1,76,1),(2,79,.5),(2.5,76,.5),(3,72,1)],
      [(0,77,1.5),(1.5,76,.5),(2,72,1),(3,69,1)],[(0,72,2),(2,67,1),(3,64,1)]]
for bar in range(BARS):
    t0=bar*BAR; root,ch=prog[bar%8]; sec=bar//8   # 0 intro,1 groove,2 lead,3 lead+break-out
    add(pad(ch,BAR),t0,0,.16 if sec!=2 else .12)
    # marimba arpeggio, pushed sixteenths
    for k in range(8):
        m=ch[(k*3)%4]+12; add(marimba(m),t0+k*BEAT/2+(BEAT/4 if k%2 else 0)*.15,-.35+.1*(k%3),.16)
    if sec>=1:
        for b in range(4): add(kick(),t0+b*BEAT,0,.55)
        add(clap(),t0+BEAT,0.1,.35); add(clap(),t0+3*BEAT,-.1,.35)
        pat=[0,1.5,2,2.75,3.5]
        for p in pat: add(bass(root+(12 if p in (1.5,3.5) else 0),BEAT*.45),t0+p*BEAT,0,.32)
    else:
        add(kick(),t0,0,.4); add(bass(root,BEAT*1.8),t0,0,.25)
    for k in range(16): add(shaker(),t0+k*BEAT/4,.45 if k%2 else .3,.5 if k%4==2 else .3)
    if sec>=1:
        for k,(p,m) in enumerate([(0.5,60),(1.25,64),(2.5,60),(3.25,67),(3.75,64)]): add(conga(m),t0+p*BEAT,.5,.35)
    if sec>=2:
        for p,m,d in lead[bar%8]: add(steel(m,d*BEAT+.15),t0+p*BEAT,.15,.3); add(steel(m+12,d*BEAT),t0+p*BEAT+BEAT*.75,-.4,.07)
    if sec==3 and bar%8==7: add(snare(),t0+3.5*BEAT,0,.3); add(snare(),t0+3.75*BEAT,0,.35)
# echo bus
d=int(BEAT*.75*SR)
for _ in range(2):
    L+=np.roll(R,d)*.18; R+=np.roll(L,d)*.18
# master: subsonic HPF, gentle glue, peak headroom
def hpf(x,fc=30):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); prev=0; px=0
    out=np.empty_like(x); yv=0.0; xv=0.0
    b=(1+a)/2
    y=np.empty_like(x)
    for i in range(len(x)): yv=b*(x[i]-xv)+a*yv; xv=x[i]; y[i]=yv
    return y
st=np.stack([L,R]); st=np.tanh(st*1.15)/1.15; st/=np.max(np.abs(st))/0.89
out='/tmp/lucky-isle.wav'
import wave
with wave.open(out,'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st.T*32767).astype(np.int16).tobytes())
dst=sys.argv[1] if len(sys.argv)>1 else 'assets/music'
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',out,'-af','highpass=f=30,volume=-2.7dB','-c:a','libvorbis','-q:a','4',os.path.join(dst,'lucky-isle.ogg')],check=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-i',out,'-af','highpass=f=30,volume=-2.7dB','-c:a','libmp3lame','-b:a','128k',os.path.join(dst,'lucky-isle.mp3')],check=True)
print('wrote', N/SR, 'seconds')
