"""Night Dividend: original 120 BPM D-minor funk score, authored for Crown City.
Renders sample-based instruments through libfluidsynth and TimGM6mb (see docs).
No MIDI player, sound device or network is needed. Produces trailer and radio mixes.
"""
import ctypes as C
import ctypes.util
from pathlib import Path
import subprocess
import wave
import numpy as np
from scipy.signal import butter, sosfilt

RATE=48000
OUT=Path('.qa/final-media'); OUT.mkdir(parents=True,exist_ok=True)
LIB=C.CDLL(ctypes.util.find_library('fluidsynth'))
def api(name,restype,*args):
    f=getattr(LIB,name);f.restype=restype;f.argtypes=list(args);return f
ptr=C.c_void_p;integer=C.c_int
settings=api('new_fluid_settings',ptr)()
setnum=api('fluid_settings_setnum',integer,ptr,C.c_char_p,C.c_double)
setint=api('fluid_settings_setint',integer,ptr,C.c_char_p,integer)
setnum(settings,b'synth.sample-rate',RATE);setnum(settings,b'synth.gain',.52)
setnum(settings,b'synth.reverb.room-size',.58);setnum(settings,b'synth.reverb.damp',.52)
setnum(settings,b'synth.reverb.level',.22);setnum(settings,b'synth.reverb.width',.8)
setint(settings,b'synth.chorus.active',0);setint(settings,b'synth.polyphony',192)
new=api('new_fluid_synth',ptr,ptr)
sfload=api('fluid_synth_sfload',integer,ptr,C.c_char_p,integer)
program=api('fluid_synth_program_change',integer,ptr,integer,integer)
cc=api('fluid_synth_cc',integer,ptr,integer,integer,integer)
noteon=api('fluid_synth_noteon',integer,ptr,integer,integer,integer)
noteoff=api('fluid_synth_noteoff',integer,ptr,integer,integer)
write=api('fluid_synth_write_float',integer,ptr,integer,ptr,integer,integer,ptr,integer,integer)
destroy=api('delete_fluid_synth',None,ptr)

def score(bars,trailer=False):
    events=[];rng=np.random.default_rng(8021)
    def note(ch,beat,key,length,vel):
        # Tiny deterministic human timing on accompaniment, stable downbeats.
        t=max(0,beat*.5+(rng.uniform(-.006,.006) if ch in [1,2,9] else 0))
        events.extend([(round(t*RATE),1,ch,int(key),int(vel)),(round((t+length*.5)*RATE),0,ch,int(key),0)])
    # Dm9 / Bbmaj9 / Gm9 / A7sus -> A7. Voicings leave the bass room.
    roots=[38,34,43,45]
    chords=[[62,65,69,72,76],[62,65,69,72],[58,62,65,69],[61,64,67,70]]
    for bar in range(bars):
        ending=trailer and bar>=20
        if ending:
            if bar==20:
                for n in [50,57,62,65,69,76]:note(1,bar*4,n,7,66)
                note(0,bar*4,38,5,88);note(9,bar*4,49,3,82)
            continue
        c=(bar//2)%4;root=roots[c];chord=chords[c]
        breakdown=trailer and bar in [5,6,11,12,13,14] or not trailer and 16<=bar<20
        full=not breakdown
        # Syncopated finger bass, muted guitar sixteenths, Rhodes offbeats.
        for off,step,dur,vel in [(0,0,.6,100),(.75,12,.22,78),(1.5,0,.36,96),(2.25,7,.35,83),(3,10,.25,86),(3.5,12,.35,91)]:
            if breakdown and off not in [0,2.25]:continue
            note(0,bar*4+off,root+step,dur,vel)
        for off in ([.5,2.5] if breakdown else [.5,1.75,2.5,3.5]):
            for n in chord:note(1,bar*4+off,n,1.1 if breakdown else .45,55 if breakdown else 62)
        if full:
            for off in [.25,.75,1.25,1.75,2.25,2.75,3.25,3.75]:
                for n in chord[1:3]:note(2,bar*4+off,n+12,.14,45+(int(off*4)%3)*7)
        # A live-kit backbeat, ghost snares, swung hats and turnarounds.
        for off in ([0,2.5] if breakdown else [0,1.5,2,2.75]):note(9,bar*4+off,36,.12,101 if off in [0,2] else 79)
        for off in [1,3]:note(9,bar*4+off,37 if breakdown else 38,.12,76 if breakdown else 101)
        for off in np.arange(0,4,.5):note(9,bar*4+off+(0.025 if off%1 else 0),42,.1,49 if off%1 else 67)
        if full:
            note(9,bar*4+2.75,38,.07,36);note(9,bar*4+3.5,46,.25,58)
            for off in [.75,2.25,3.75]:note(9,bar*4+off,70,.08,47)
        if bar%4==3 and full:
            for i,key in enumerate([38,48,45,41]):note(9,bar*4+3+i*.25,key,.12,70+i*6)
        if bar in [0,7,15,19] and trailer or bar%8==0 and not trailer:note(9,bar*4,49,1.6,70)
        # Memorable call / response horn line, with gaps for the cuts.
        if full and bar%2==1:
            phrase=[(0,0,.5),(1,3,.3),(1.75,7,.55),(3,5,.25),(3.5,3,.35)] if bar%4==1 else [(0,7,.6),(1.5,10,.3),(2.25,7,.35),(3,3,.65)]
            for off,step,dur in phrase:
                note(3,bar*4+off,62+step,dur,78)
                note(4,bar*4+off,50+step,dur,53)
        if breakdown:
            for off,n in zip([0,1.5,2.5,3.5],[chord[2]+12,chord[1]+12,chord[0]+12,chord[1]+12]):note(5,bar*4+off,n,.8,52)
    return sorted(events),bars*2

def render(bars,trailer):
    synth=new(settings);sfload(synth,b'/usr/share/sounds/sf2/TimGM6mb.sf2',1)
    # Bass, Rhodes, muted guitar, trumpet, trombone, vibraphone; kit on ch10.
    for ch,prog,pan,vol in [(0,33,64,101),(1,4,52,86),(2,28,93,74),(3,56,74,79),(4,57,38,63),(5,11,81,73)]:
        program(synth,ch,prog);cc(synth,ch,10,pan);cc(synth,ch,7,vol);cc(synth,ch,91,29 if ch!=0 else 5)
    cc(synth,9,7,94);cc(synth,9,91,14)
    events,seconds=score(bars,trailer);size=(seconds+3)*RATE
    left=np.zeros(size,dtype=np.float32);right=np.zeros_like(left);pos=0
    def advance(end):
        nonlocal pos
        if end>pos:
            write(synth,end-pos,left.ctypes.data,pos,1,right.ctypes.data,pos,1);pos=end
    for frame,on,ch,key,vel in events:
        advance(min(frame,size));(noteon(synth,ch,key,vel) if on else noteoff(synth,ch,key))
    advance(size);destroy(synth)
    mix=np.column_stack([left,right]);mix=sosfilt(butter(2,32,fs=RATE,btype='highpass',output='sos'),mix,axis=0)
    if not trailer:
        # Carry the natural reverb tail over the loop boundary.
        mix[:3*RATE]+=mix[seconds*RATE:(seconds+3)*RATE];mix=mix[:seconds*RATE]
    else:
        mix=mix[:seconds*RATE];mix[-int(1.3*RATE):]*=np.linspace(1,0,int(1.3*RATE))[:,None]
    mix=np.tanh(mix*1.2);mix*=.91/max(.91,np.max(np.abs(mix)))
    mix[:240]*=np.linspace(0,1,240)[:,None]
    path=OUT/('night-dividend-trailer.wav' if trailer else 'night-dividend-radio.wav')
    with wave.open(str(path),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((mix*32767).astype('<i2').tobytes())
    print(path,seconds,'seconds',flush=True)
    return path

if __name__=='__main__':
    render(22,True)
    radio=render(32,False)
    for ext,codec,opts in [('ogg','libvorbis',['-q:a','5']),('mp3','libmp3lame',['-b:a','192k'])]:
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(radio),'-af','loudnorm=I=-17:TP=-1.5:LRA=8','-ar','48000','-c:a',codec,*opts,'assets/music/night-dividend.'+ext],check=True)
