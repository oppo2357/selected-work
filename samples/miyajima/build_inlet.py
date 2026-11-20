"""Rebuild the local building/road layout and broad mountain relief from public map data."""
import json
import math
import struct
import sys
from pathlib import Path
from xml.etree import ElementTree
from urllib.request import urlopen, Request

import cv2
import numpy as np
import build_terrain as terrain

out = Path(__file__).resolve().parent
osm_url = 'https://api.openstreetmap.org/api/0.6/map?bbox=132.3144,34.2926,132.3238,34.3009'
if len(sys.argv) > 1:
    osm = ElementTree.parse(sys.argv[1]).getroot()
else:
    osm = ElementTree.fromstring(urlopen(Request(osm_url, headers={'User-Agent':'MiyajimaPortfolioStudy/1.0'}), timeout=30).read())
lat, lon = terrain.CENTER
east = 111320 * math.cos(math.radians(lat))
nodes = {n.get('id'): [round((float(n.get('lon'))-lon)*east,1),
                       round((lat-float(n.get('lat')))*110930,1)] for n in osm.findall('node')}
buildings, roads, special = [], [], {}
for way in osm.findall('way'):
    tags = {t.get('k'):t.get('v') for t in way.findall('tag')}
    pts = [nodes[n.get('ref')] for n in way.findall('nd') if n.get('ref') in nodes]
    if len(pts) < 2:
        continue
    if way.get('id')=='325942851':
        special[way.get('id')]=pts
    if tags.get('highway') in ('residential','pedestrian','service','tertiary','unclassified','living_street'):
        roads.append(pts)
    if not tags.get('building'):
        continue
    a = np.asarray(pts,np.float32)
    (x,z),(w,d),angle = cv2.minAreaRect(a)
    if not (-435<x<435 and -433<z<433) or min(w,d)<1.8:
        continue
    if d>w:
        w,d,angle = d,w,angle+90
    buildings.append([int(way.get('id')), round(x,1),round(z,1),round(w,1),round(d,1),round(-math.radians(angle),3),tags['building']])
    if way.get('id') in ('142668851','142668855') or tags.get('building') in ('shrine','pagoda'):
        special[way.get('id')] = pts
(out/'inlet.json').write_text(json.dumps({'source':'OpenStreetMap contributors, ODbL 1.0','buildings':buildings,'roads':roads,'outlines':special},separators=(',',':'))+'\n',encoding='utf-8')
# A coarse second mesh continues the actual island slopes behind the close 8-m DEM.
terrain.ZOOM = 12
grid = [terrain.sample(x*48,z*48) for z in range(-80,81) for x in range(-80,81)]
(out/'regional-elevation.bin').write_bytes(struct.pack('<'+str(len(grid))+'h',*grid))
print(len(buildings), 'buildings,',len(roads),'streets;', max(grid)/10,'m regional summit.')
