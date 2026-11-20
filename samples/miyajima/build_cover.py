"""Georeference GSI's ort layer to the local DEM for the close inlet and distant ridges."""
import io
import math
from concurrent.futures import ThreadPoolExecutor
from itertools import product
from pathlib import Path

from PIL import Image
import requests

out=Path(__file__).resolve().parent
lat,lon=34.29672,132.31906
def ortho(name,half_x,half_z,zoom,size):
    def merc(x,z):
        phi=math.radians(lat-z/110930)
        lam=lon+x/(111320*math.cos(math.radians(lat)))
        n=256*2**zoom
        return n*(lam+180)/360,n*(1-math.asinh(math.tan(phi))/math.pi)/2
    left,top=merc(-half_x,-half_z);right,bottom=merc(half_x,half_z)
    x0,y0=int(left//256),int(top//256);x1,y1=int(right//256),int(bottom//256)
    image=Image.new('RGB',((1+x1-x0)*256,(1+y1-y0)*256),(55,76,69))
    def get(key):
        x,y=key
        url=f'https://cyberjapandata.gsi.go.jp/xyz/ort/{zoom}/{x}/{y}.jpg'
        r=requests.get(url,timeout=25)
        if r.status_code==404:return
        r.raise_for_status()
        return x,y,Image.open(io.BytesIO(r.content)).convert('RGB')
    with ThreadPoolExecutor(5) as pool:
        for row in pool.map(get,product(range(x0,x1+1),range(y0,y1+1))):
            if row:
                x,y,tile=row;image.paste(tile,((x-x0)*256,(y-y0)*256))
    image.resize(size,Image.Resampling.BICUBIC,(left-x0*256,top-y0*256,right-x0*256,bottom-y0*256)).save(out/name,quality=88,method=6)
ortho('inlet-ortho.webp',448,440,17,(1024,1008))
ortho('mountain-ortho.webp',3840,3840,14,(1536,1536))
