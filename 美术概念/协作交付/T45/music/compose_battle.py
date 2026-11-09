"""Original T45 combat score. Reuse only our T38 synthesis instruments, no samples."""
from pathlib import Path
import importlib.util,json,shutil
HERE=Path(__file__).resolve().parent
source=HERE.parents[1]/'T38/t38_music/compose_music.py'
spec=importlib.util.spec_from_file_location('arcane_instruments',source)
music=importlib.util.module_from_spec(spec);spec.loader.exec_module(music);music.HERE=HERE
score={'id':'realm-battle','title':'裂境行锋','bpm':96,'bars':24,'meter':'4/4','duration_seconds':60,'tonal_center':'D minor, modal suspended cadences','seed':45091,'events':[],'chords':[]}
harmonies=[[50,57,62,65],[46,53,57,62],[43,50,58,62],[45,52,59,64],[50,57,60,65],[48,55,60,64],[46,53,57,65],[45,52,55,64]]
motifs=[[69,65,64,62],[65,69,72,69],[67,65,62,58],[64,67,64,61],[69,72,74,72],[67,64,60,64],[65,69,65,62],[64,61,62,64]]
for bar in range(24):
 chord=harmonies[bar%8];score['chords'].append({'bar':bar+1,'voicing':chord})
 for j,note in enumerate(chord):music.add_note(score,bar,0,note,3.45,'silk_strings',.04 if j else .05,(j-1.5)*.24)
 music.add_note(score,bar,0,chord[0]-12,1.7,'low_bow',.04,-.1)
 for i in range(8):music.add_note(score,bar,i*.5,chord[[0,1,2,1,0,2,3,2][i]]+(12 if i%4==3 else 0),.23,'pizzicato',.035 if i%2==0 else .024,(-1 if i%2 else 1)*.23)
 for beat in [0,2]:music.add_note(score,bar,beat,38,.12,'wood_pulse',.021,0)
 # The melody leaves alternate bars of space so attacks and warnings remain audible.
 if bar%2==0:
  phrase=motifs[bar%8]
  for j,note in enumerate(phrase[:3]):music.add_note(score,bar,.5+j,note, .7 if j<2 else 1.1,'dusky_reed',.052,-.06)
 if bar%4==3:music.add_note(score,bar,3,chord[-1]+12,.24,'harp',.045,.3)
(HERE/'score-v1.json').write_text(json.dumps(score,ensure_ascii=False,indent=2),encoding='utf-8')
audit=music.render(score)
(HERE/'music-manifest-v1.json').write_text(json.dumps({'track':audit,'intent':'96 BPM restrained combat ostinato; preparation keeps realm-journey; human listening approval pending'},ensure_ascii=False,indent=2),encoding='utf-8')
destination=HERE.parents[3]/'arcane-duel-lab/dist/assets/music/realm-battle.wav'
shutil.copy2(HERE/'realm-battle.wav',destination)
print('Original battle music copied:',destination)
