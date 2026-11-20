"""Original seamless material studies for hinoki-bark roofs and wooden platforms."""
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from scipy.ndimage import gaussian_filter

out=Path(__file__).resolve().parent
rng=np.random.default_rng(1875)
h,w=384,768
y,x=np.mgrid[:h,:w]
def save(name,base,signal):
    px=np.array(base)[None,None,:]+signal[:,:,None]
    Image.fromarray(np.uint8(np.clip(px,0,255))).save(out/(name+'.webp'),quality=88,method=6)
grain=rng.normal(0,1,(h,w))
grain2=gaussian_filter(grain,(.8,5),mode='wrap')*16
rows=32; pitch=h//rows
courses=np.zeros((h,w))
for k in range(rows):
    cells=rng.normal(0,7,64); breaks=(x[k*pitch]//12+(k%3)*5)%64
    courses[k*pitch:(k+1)*pitch]=cells[breaks]
profile=y%pitch
save('bark-courses',(160,151,141),courses+grain2+rng.normal(0,4,(h,w))-13*(profile<1)+8*(profile==2)+4*np.sin(y*.65))
planks=np.tile(rng.normal(0,5,(24,1)).repeat(h//24,axis=0),(1,w))
grain3=gaussian_filter(grain,(.55,15),mode='wrap')*39
save('deck-boards',(177,166,148),planks+grain3+np.sin(y*2.4+1.5*np.sin(x*.016))*2-46*(y%16==0)+9*(y%16==1))
im=Image.new('RGB',(512,256),(111,108,98));d=ImageDraw.Draw(im)
for row in range(11):
    sx=-45*(row%2)
    while sx<512:
        width=int(rng.uniform(36,76));n=int(rng.normal(0,11));c=(154+n,151+n,137+n)
        d.rounded_rectangle((sx,row*24,sx+width-2,row*24+22),radius=3,fill=c,outline=(116+n,117+n,107+n));sx+=width
im.save(out/'granite.webp',quality=87,method=6)
