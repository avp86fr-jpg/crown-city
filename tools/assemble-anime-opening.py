"""Master the original 60-second anime opening, retaining all existing trailers."""
import json,re,subprocess
from pathlib import Path
WORK=Path('.qa/anime-opening');DEST=Path('about/assets');STEM='crown-city-neon-debt-anime-60s-720p'
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True)
def probe(path):return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]).stdout)
src=WORK/'picture-master.mp4';music=WORK/'film-mix.wav';output=DEST/(STEM+'.mp4')
v=probe(src)['streams'][0];assert int(v['nb_frames'])==1440 and v['r_frame_rate']=='24/1'
measurement=run(['ffmpeg','-hide_banner','-i',str(music),'-af','loudnorm=I=-14:TP=-2.7:LRA=9:print_format=json','-f','null','-']).stderr
levels=json.loads(re.findall(r'\{[^{}]+\}',measurement)[-1])
normalizer=(f"loudnorm=I=-14:TP=-2.7:LRA=9:linear=true:measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:offset={levels['target_offset']}")
opts=['-c:v','libx264','-preset','slow','-b:v','1380k','-maxrate','2400k','-bufsize','4800k','-pix_fmt','yuv420p','-r','24','-frames:v','1440','-passlogfile',str(WORK/'h264-pass')]
run(['ffmpeg','-v','error','-y','-i',str(src),'-an',*opts,'-pass','1','-f','null','/dev/null'])
run(['ffmpeg','-v','error','-y','-i',str(src),'-i',str(music),'-map','0:v:0','-map','1:a:0',*opts,'-pass','2','-c:a','aac','-b:a','192k','-ar','48000','-af',normalizer,'-t','60','-movflags','+faststart','-metadata','title=Crown City — Neon Debt','-metadata','comment=Original anime-style limited-animation cinematic. Illustrated key art, animated character frames, composited vehicles, city life and effects. Original score: Neon Debt, 144 BPM. Game visuals differ.',str(output)])
result=probe(output);v=next(s for s in result['streams'] if s['codec_type']=='video');a=next(s for s in result['streams'] if s['codec_type']=='audio')
assert int(v['nb_frames'])==1440 and v['width']==1280 and v['height']==720
assert abs(float(result['format']['duration'])-60)<.05 and a['channels']==2
assert output.stat().st_size<12_400_000,'Publication size budget exceeded'
run(['ffmpeg','-v','error','-y','-ss','57.2','-i',str(output),'-frames:v','1','-c:v','libwebp','-quality','94',str(DEST/(STEM+'-poster.webp'))])
captions=[
 (0,3.333,'[Electronic-rock music builds.]\nTHE CITY NEVER SLEEPS.'),
 (3.333,6.667,'[Rain, street traffic and passing cars.]'),
 (6.667,10,'CHAOS — THE WILDCARD.\nONE JOB. EVERY DEBT COMES DUE.'),
 (10,15,'STEAL THE KEY. BREAK THE HOUSE.\nHunter and Chaos plan the archive heist.'),
 (15,23.333,'[Engine revs. Police sirens.]\nLOSE THE HEAT.'),
 (23.333,28.333,'THE HOUSE OWNS EVERY ROAD.\nSO TAKE THE ROOFTOPS.'),
 (28.333,31.667,'[Gunfire and sparks.]'),
 (31.667,35,'[A speedboat cuts through the canal.]'),
 (35,38.333,'[Helicopter rotors. Searchlights over the city.]'),
 (38.333,41.667,'GOLD MAGE — THE HOUSE.\nEVERY DEBT COMES DUE.'),
 (41.667,45,'[Motorcycle engine rises. Police pursuit.]'),
 (45,50,'[Chaos runs. An explosion behind him.]'),
 (50,55,'MAKE YOUR OWN EXIT.\nTHE HOUSE DOESN’T OWN YOU.'),
 (55,60,'CROWN CITY — NEON DEBT.\nAn anime opening. avp86fr-jpg.github.io/crown-city'),
]
def timestamp(seconds):
    ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
(DEST/(STEM+'.en.vtt')).write_text('WEBVTT\n\n'+'\n\n'.join(f'{timestamp(start)} --> {timestamp(end)}\n{text}' for start,end,text in captions)+'\n')
summary={'file':str(output),'bytes':output.stat().st_size,'seconds':result['format']['duration'],'frames':v['nb_frames'],'fps':v['r_frame_rate'],'music_measurement':levels}
(WORK/'master.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
