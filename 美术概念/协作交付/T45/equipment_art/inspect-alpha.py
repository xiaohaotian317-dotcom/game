from pathlib import Path
import json, hashlib
from PIL import Image
import numpy as np

BASE=Path(__file__).resolve().parent
def runs(indices):
    out=[]
    for v in indices:
        v=int(v)
        if out and v==out[-1][1]+1: out[-1][1]=v
        else: out.append([v,v])
    return out
def inspect(name):
    path=BASE/name
    im=Image.open(path)
    a=np.asarray(im.getchannel('A'))
    m=a>0
    print(json.dumps({'file':name,'size':list(im.size),'mode':im.mode,'alphaExtrema':[int(a.min()),int(a.max())],'transparentFraction':float(np.mean(a==0)),'opaqueFraction':float(np.mean(a==255)),'contentBBox':list(im.getchannel('A').getbbox()),'xRunsOver20':runs(np.flatnonzero(np.sum(m,axis=0)>20)),'yRunsOver20':runs(np.flatnonzero(np.sum(m,axis=1)>20)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()},ensure_ascii=False))
if __name__=='__main__':
    import sys
    for f in sys.argv[1:]: inspect(f)
