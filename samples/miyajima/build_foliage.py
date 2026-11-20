"""Draw original broadleaf crown silhouettes with forked branches and sunlit outer leaf clusters."""
import math
import random
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
out=Path(__file__).resolve().parent
for seed in (5,26,67):
    rng=random.Random(seed);im=Image.new('RGBA',(256,256));d=ImageDraw.Draw(im);tips=[]
    def branch(x,y,theta,length,width,depth):
        end=(x+math.sin(theta)*length,y-math.cos(theta)*length)
        mid=((x+end[0])/2+rng.uniform(-4,4),(y+end[1])/2)
        d.line([(x,y),mid,end],fill=(62+depth*2,62+depth,49,255),width=max(1,round(width)))
        if depth==0:
            tips.append(end);return
        for delta in [-rng.uniform(.28,.78),rng.uniform(.28,.78)]:
            branch(*end,theta*.72+delta,length*rng.uniform(.55,.82),width*.62,depth-1)
    for i,(x,angle,length) in enumerate([(128,-.60,56),(130,.56,54),(126,-.17,62),(130,.26,64)]):
        branch(x,247,angle,length,8,4)
    for x,y in sorted(tips,key=lambda p:-p[1]):
        radius=rng.uniform(11,20)
        for j in range(140):
            ang=rng.random()*math.tau;r=radius*math.sqrt(rng.random())
            dx=math.cos(ang)*r;dy=math.sin(ang)*r*.77
            shade=rng.uniform(-9,11)-dy*.81-dx*.36+(135-y)*.13
            col=tuple(int(max(0,min(255,v+shade))) for v in (62,83,58))+(255,)
            size=rng.uniform(1.2,4.7);d.ellipse((x+dx-size,y+dy-size*.68,x+dx+size,y+dy+size*.58),col)
    bounds=im.getbbox()
    im=im.crop((max(0,bounds[0]-2),max(0,bounds[1]-2),min(256,bounds[2]+2),256))
    im.save(out/f'canopy-{seed}.webp',lossless=True,method=6)
