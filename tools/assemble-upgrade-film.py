"""Assemble NO CLEAN EXIT without replacing the original Crown City trailer.

Run capture-upgrade-film.cjs and compose-upgrade-film.py first. Requires FFmpeg.
The output uses beat-aligned cuts, two-pass loudness normalization and faststart.
"""
import json
import re
import subprocess
from pathlib import Path

WORK = Path('.qa/upgrade-film')
DEST = Path('about/assets')
STEM = 'crown-city-no-clean-exit-60s-720p'


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-show_streams',
                          '-show_format', '-of', 'json', str(path)]).stdout)


edit = json.loads((WORK / 'edit.json').read_text())
assert sum(s['frames'] for s in edit) == 1800
assert edit[-1]['end'] == 1800
for shot in edit:
    stream = probe(WORK / (shot['id'] + '.mp4'))['streams'][0]
    assert int(stream['nb_frames']) == shot['frames'], shot['id']
    assert (stream['width'], stream['height'], stream['r_frame_rate']) == (1280, 720, '30/1')
(WORK / 'concat.txt').write_text(''.join(f"file '{s['id']}.mp4'\n" for s in edit))

measurement = run(['ffmpeg', '-hide_banner', '-i', str(WORK / 'film-mix.wav'),
                   '-af', 'loudnorm=I=-14:TP=-1.2:LRA=9:print_format=json',
                   '-f', 'null', '-']).stderr
levels = json.loads(re.findall(r'\{[^{}]+\}', measurement)[-1])
normalizer = (f"loudnorm=I=-14:TP=-1.2:LRA=9:linear=true:"
              f"measured_I={levels['input_i']}:measured_TP={levels['input_tp']}:"
              f"measured_LRA={levels['input_lra']}:measured_thresh={levels['input_thresh']}:"
              f"offset={levels['target_offset']}")
output = DEST / (STEM + '.mp4')
video_options = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '1420k',
                 '-maxrate', '2400k', '-bufsize', '4800k', '-pix_fmt', 'yuv420p',
                 '-r', '30', '-frames:v', '1800',
                 '-passlogfile', str(WORK / 'h264-pass')]
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat',
     '-safe', '0', '-i', str(WORK / 'concat.txt'), '-an', *video_options,
     '-pass', '1', '-f', 'null', '/dev/null'])
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat',
     '-safe', '0', '-i', str(WORK / 'concat.txt'), '-i', str(WORK / 'film-mix.wav'),
     '-map', '0:v:0', '-map', '1:a:0', *video_options, '-pass', '2',
     '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
     '-af', normalizer, '-t', '60', '-movflags', '+faststart',
     '-metadata', 'title=Crown City — No Clean Exit',
     '-metadata', 'comment=Captured in-game with staged starting situations and cinematic cameras. Original score: Heat Check, 128 BPM. Offline 30 fps; not a device performance benchmark.',
     str(output)])
result = probe(output)
video = next(s for s in result['streams'] if s['codec_type'] == 'video')
audio = next(s for s in result['streams'] if s['codec_type'] == 'audio')
assert int(video['nb_frames']) == 1800
assert abs(float(result['format']['duration']) - 60) < .05
assert audio['channels'] == 2 and audio['sample_rate'] == '48000'
assert output.stat().st_size < 12_400_000, 'Film exceeds the publication size budget'
run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '57.1',
     '-i', str(output), '-frames:v', '1', '-c:v', 'libwebp', '-quality', '92',
     str(DEST / (STEM + '-poster.webp'))])


def timestamp(frame):
    ms = round(frame * 1000 / 30)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'


captions = ['WEBVTT', '']
for shot in edit:
    title = shot['title'] or 'CROWN CITY — THE HOUSE OWES YOU.'
    if shot['id'] == 'end':
        subtitle = 'Play free: avp86fr-jpg.github.io/crown-city'
    else:
        subtitle = shot['sub'].replace(' / ', ' · ')
    captions += [f"{timestamp(shot['start'])} --> {timestamp(shot['end'])}",
                 title, subtitle, '']
(DEST / (STEM + '.en.vtt')).write_text('\n'.join(captions))
summary = {'file': str(output), 'seconds': result['format']['duration'],
           'frames': video['nb_frames'], 'bytes': output.stat().st_size,
           'audio_measurement_before_master': levels}
(WORK / 'master.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
