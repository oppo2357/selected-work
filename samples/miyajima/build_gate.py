"""Build the Itsukushima Great Torii. Run Blender in background with -P build_gate.py.

Meters, origin on the seabed, Blender +Y offshore, +X at the sun fitting.
Overall dimensions and carpentry references: Miyajima Tourism Association and
Prefectural University of Hiroshima, The Secrets of the Great Torii (2020).
The joinery, patina, procedural textures and relief are an original interpretation.
A local Japanese serif font is required for the incised lettering; set TORII_FONT
when the system has no Noto Serif CJK JP or Japanese Mincho font in the paths below.
"""
from math import atan2, cos, exp, pi, sin, sqrt, tau
from pathlib import Path
import os
import struct
import tempfile
import zlib

import bpy
import numpy as np
from mathutils import Vector


OUTPUT = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'METERS'
scene['reference'] = 'https://www.miyajima.or.jp/sightseeing/ss_ootorii.html'
scene['model_note'] = 'Interpretive model; overall span and height follow published dimensions.'


def group(name):
    collection = bpy.data.collections.new(name)
    scene.collection.children.link(collection)
    return collection


posts = group('01  /  Camphor and cedar pillars')
ties = group('02  /  Mortises, ties and wedges')
crown = group('03  /  Kasagi and hiwada roof')
boards = group('04  /  Dedication tablets')
metal = group('05  /  Sun and moon fittings')


def linear(value):
    value = value / 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def material(name, rgb, rough=.72, metallic=0):
    mat = bpy.data.materials.new(name)
    color = tuple(linear(c) for c in rgb) + (1,)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metallic
    return mat


def noise(x, y, cols, rows, seed):
    """Seamless value noise; the column skin closes at the back without a seam."""
    grid = np.random.default_rng(seed).uniform(-1, 1, (rows, cols))
    gx, gy = x * cols, y * rows
    ix, iy = np.floor(gx).astype(int), np.floor(gy).astype(int)
    tx, ty = gx - ix, gy - iy
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    lo = grid[iy % rows, ix % cols] * (1 - tx) + grid[iy % rows, (ix + 1) % cols] * tx
    hi = grid[(iy + 1) % rows, ix % cols] * (1 - tx) + grid[(iy + 1) % rows, (ix + 1) % cols] * tx
    return lo * (1 - ty) + hi * ty


def blend(base, overlay, factor):
    f = np.clip(factor, 0, 1)[..., None]
    return base * (1 - f) + overlay * f


def color_field(rgb, variation):
    return np.array(rgb)[None, None, :] + variation[..., None]


def column_texture(seed, h, w, meters, offset):
    y, u = np.mgrid[:h, :w].astype(float)
    u /= w
    v = 1 - y / (h - 1)
    vertical = v * meters
    macro = noise(u, v, 11, 7, seed)
    swirl = u + .009 * noise(u, v, 8, 4, seed+1) + .003 * noise(u, v, 16, 8, seed+2)
    for ku, kv, radius in [(.18, .51, .035), (.61, .71, .027), (.83, .36, .025)]:
        du = (u - ku - offset + .5) % 1 - .5
        dv = v - kv
        swirl += du * np.exp(-(du / radius) ** 2 - (dv / .065) ** 2) * .7
    fine = noise(swirl, v, 165, 5, seed+3)
    fiber = noise(swirl, v, 89, 16, seed+4)
    brush = noise(swirl, v, 46, 8, seed+5)
    # Thin discontinuous fissures follow a wandering timber grain below the paint.
    checks = np.exp(-(np.sin(tau * (swirl * 24 + .45 * brush)) / .13) ** 2)
    checks *= np.clip((noise(u, v, 40, 23, seed+6) - .04) * 2, 0, 1)
    mottling = macro*5.2 + brush*3.8 + fiber*4.2 + fine*2.3 - checks*24
    surface = color_field((205+offset*12, 68+offset*4, 35), mottling)
    tide = (1.52 + noise(u, v, 13, 8, seed+7)*.24 + noise(u, v, 32, 20, seed+8)*.16
            + noise(u, v, 121, 90, seed+9)*.16)
    # The web water sits at 1.75 m. Keep a broken splash band visible above it.
    splash = 2.39 + .24 * noise(u, v, 18, 7, seed+14) + .11 * brush
    damp = np.clip((splash - vertical)/.64, 0, 1)
    damp = damp * damp * (3 - 2 * damp)
    surface = blend(surface, color_field((127, 52, 34), mottling*1.45), damp*.76)
    tide += .22
    intertidal = np.clip((tide - vertical)*4+.39, 0, 1)
    flecks = (noise(u, v, 24, 46, seed+10) * 13 + noise(u, v, 54, 112, seed+11) * 17
              + noise(u, v, 128, 251, seed+12) * 24)
    rock = color_field((92, 87, 65), flecks + macro*9+fine*6)
    # Little pale shell rims, with warm umbers still showing through the colony.
    rng = np.random.default_rng(seed+13)
    ny, nx = 138, 84
    cell = rng.uniform(.19, .81, (ny, nx, 2))
    active = rng.uniform(0, 1, (ny, nx))
    gx, gy = u * nx, v * ny
    ix, iy = gx.astype(int), gy.astype(int)
    sx, sy = cell[iy % ny, ix % nx, 0], cell[iy % ny, ix % nx, 1]
    d = np.sqrt(((gx % 1) - sx)**2 + (((gy % 1) - sy)*1.17)**2)
    shells = np.exp(-((d-.18)/.09)**2) * (active[iy % ny, ix % nx] > .49)
    rock = blend(rock, color_field((172, 160, 128), flecks*.5), shells*.84)
    return blend(surface, rock, intertidal)


def timber_texture(h, w):
    y, x = np.mgrid[:h, :w].astype(float)
    u, v = x/w, y/h
    warp = v + .022*noise(u, v, 5, 8, 171)
    grain = noise(u, warp, 4, 66, 172)*7 + noise(u, warp, 10, 163, 173)*3.3
    brush = noise(u, v, 8, 12, 174)*5.2
    return color_field((206, 68, 34), grain + brush)


def roof_texture(h, w):
    y, x = np.mgrid[:h, :w].astype(float)
    u, v = x/w, y/h
    grit = noise(u,v,200,72,261)*4.8 + noise(u,v,48,19,262)*4
    courses = v*9 + .15*noise(u,v,14,6,263)
    lip = np.exp(-((courses % 1)/.18)**2)
    return color_field((79, 61, 47), grit - lip*12 + noise(u,v,16,5,265)*4.8)


def patina_texture(h, w):
    y, x = np.mgrid[:h, :w].astype(float)
    u, v = x/w, y/h
    verdigris = noise(u,v,7,6,310)*.30 + noise(u,v,24,15,311)*.17 + noise(u,v,79,34,312)*.11
    c = color_field((71, 97, 84), noise(u,v,170,90,313)*4)
    return blend(c, np.array([123, 155, 132]), .52+verdigris)


def png_bytes(array):
    im = np.clip(np.round(array), 0, 255).astype(np.uint8)
    h, w, _ = im.shape
    def chunk(tag, payload):
        return struct.pack('>I', len(payload)) + tag + payload + struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff)
    rows = b''.join(b'\0' + row.tobytes() for row in im)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w,h,8,2,0,0,0)) + chunk(b'IDAT', zlib.compress(rows,6)) + chunk(b'IEND', b'')


def mapped(name, rgb, array, rough, metallic=0):
    mat = material(name, rgb, rough, metallic)
    with tempfile.TemporaryDirectory() as cache:
        source = Path(cache) / 'source.png'
        source.write_bytes(png_bytes(array))
        im = bpy.data.images.load(str(source))
        _ = im.pixels[0]  # Decode the source before changing to the JPEG path.
        im.name = name
        im.filepath_raw = str(Path(cache) / (name + '.jpg'))
        im.file_format = 'JPEG'
        im.save()
        im.pack()
        im.filepath = '//' + name + '.jpg'
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
    tex.image = im
    mat.node_tree.links.new(tex.outputs['Color'], mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    return mat


west = mapped('Camphor - west', (207,70,35), column_texture(21,1024,512,13.22,.03), .77)
east = mapped('Camphor - east', (207,70,35), column_texture(49,1024,512,13.22,.18), .77)
sugi = mapped('Cedar - sleeve', (203,66,33), column_texture(87,768,384,8.65,.1), .76)
shu = mapped('Brushed vermilion', (206,68,34), timber_texture(256,640), .71)
bark = mapped('Hiwada - bark courses', (80,62,47), roof_texture(256,512), .94)
copper = mapped('Copper - weathered ridge', (91,125,107), patina_texture(192,384), .70,.22)
red = material('Vermilion - carved arrises', (184,52,25),.68)
light_red = material('Vermilion - top arrises', (211,73,35),.7)
brown = material('Exposed bark edges', (71,48,37),.87)
hinoki = material('Ochre end grain', (194,134,62),.81)
bronze = material('Aged bronze casting', (57,50,42),.54,.46)
gilt = material('Gilt relief', (217,172,78),.42,.5)
old_gold = material('Antique brass', (159,118,51),.52,.43)
black = material('Blue-black lacquer', (38,45,43),.48)


def mesh(name, verts, faces, materials, collection, indices=None, uvs=None, smooth=()):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    for m in materials:
        data.materials.append(m)
    if uvs:
        layer = data.uv_layers.new(name='Craft UV')
    for n, poly in enumerate(data.polygons):
        if indices:
            poly.material_index = indices[n]
        if n in smooth:
            poly.use_smooth = True
        if uvs:
            for loop, uv in zip(poly.loop_indices,uvs[n]):
                layer.data[loop].uv = uv
    return obj


def soften(obj, width, segments=2):
    mod = obj.modifiers.new('Tool-rounded arris','BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.harden_normals = True
    norm = obj.modifiers.new('Face-weighted normals','WEIGHTED_NORMAL')
    norm.keep_sharp = True
    return obj


def post(name, base_x, base_y, top, base_radius, upper_r, seed, skin, sleeve=False):
    n, levels = (48,33) if not sleeve else (32,23)
    verts, faces, uvs = [], [], []
    def axis(t):
        side = 1 if base_x > 0 else -1
        inward = .34 if not sleeve else .17
        sway=.055 if sleeve else .16
        return (base_x - side*inward*t + sway*sin(t*pi*2 + seed)*sin(t*pi),
                base_y*(1-.025*t) + sway*sin(t*4.7+seed*.8)*sin(pi*t))
    for level in range(levels):
        t = level/(levels-1)
        cx, cy = axis(t)
        for j in range(n):
            ang = tau*j/n
            a = ang+.10*sin(t*5.0+seed)
            flute = (.051*cos(3*a+seed)+.036*cos(5*a+seed*.7)+.019*sin(8*a+seed))
            buttress = (.5+.5*sin(4*a+seed))**2.5*.17
            r = (upper_r+(base_radius-upper_r)*((1-t)**(1.35 if sleeve else 1.69)))
            r += (buttress*exp(-t*9.5)+flute*(.4+.6*(1-t)))*(0.52 if sleeve else 1)
            r += (.018 if sleeve else .063)*sin(t*10.3+cos(a*2+seed))*sin(pi*t)
            verts.append((cx+r*cos(ang), cy+r*sin(ang)*(.99 if sleeve else .963),top*t))
    for k in range(levels-1):
        for j in range(n):
            j2 = (j+1)%n
            faces.append((k*n+j,k*n+j2,(k+1)*n+j2,(k+1)*n+j))
            u0, u1 = j/n + seed*.071, (j+1)/n+seed*.071
            uvs.append([(u0,k/(levels-1)),(u1,k/(levels-1)),(u1,(k+1)/(levels-1)),(u0,(k+1)/(levels-1))])
    smooth = range(len(faces))
    ring = range(n)
    faces.extend([tuple(reversed(ring)),tuple((levels-1)*n+j for j in ring)])
    uvs.extend([[(.5+.48*cos(tau*j/n),.5+.48*sin(tau*j/n)) for j in reversed(ring)],
                [(.5+.48*cos(tau*j/n),.5+.48*sin(tau*j/n)) for j in ring]])
    return mesh(name,verts,faces,[skin],posts,uvs=uvs,smooth=smooth)


def swept(name, stations, section, materials, collection, edge_mats=None, cap_index=0, transform=None):
    """A closed longitudinal solid; each profile point returns its end shift, y and z."""
    verts, faces, inds, uvs = [], [], [], []
    n = len(section(stations[0]))
    for x in stations:
        for dx,y,z in section(x):
            pt = (x+dx,y,z)
            verts.append(transform(*pt) if transform else pt)
    # Each material receives continuous UVs following the length of the timber.
    for i,(left,right) in enumerate(zip(stations,stations[1:])):
        for j in range(n):
            next_j=(j+1)%n
            faces.append((i*n+j,i*n+next_j,(i+1)*n+next_j,(i+1)*n+j))
            inds.append(edge_mats[j] if edge_mats else 0)
            uvs.append([(left/6,0),(left/6,1),(right/6,1),(right/6,0)])
    faces += [tuple(reversed(range(n))),tuple((len(stations)-1)*n+j for j in range(n))]
    inds += [cap_index,cap_index]
    for idx in (0,-1):
        poly = section(stations[idx])
        uvs.append([(y*.5,z*.5) for _,y,z in (reversed(poly) if idx==0 else poly)])
    return mesh(name,verts,faces,materials,collection,inds,uvs)


def rect(depth, bottom, height):
    return [(0,-depth/2,bottom),(0,depth/2,bottom),(0,depth/2,bottom+height),(0,-depth/2,bottom+height)]


def plank(name, cx, cy, z, length, width, height, mat, collection, along_y=False, tips=None, bow=0):
    def shape(x):
        return rect(width,z-height/2+bow*(2*x/length)**2,height)
    def position(x,y,z):
        return (cx-y,cy+x,z) if along_y else (cx+x,cy+y,z)
    mats = [mat,tips] if tips else [mat]
    xs = [(-.5+i/8)*length for i in range(9)] if bow else [-length/2,length/2]
    return soften(swept(name,xs,shape,mats,collection,cap_index=len(mats)-1,transform=position),.018)


def collar(name, x, y, rings, mat, collection, count=56):
    vs, fs, uvs = [], [], []
    for z,r in rings:
        vs += [(x+r*cos(tau*j/count),y+r*sin(tau*j/count),z) for j in range(count)]
    for k in range(len(rings)-1):
        for j in range(count):
            j2=(j+1)%count
            fs += [(k*count+j,k*count+j2,(k+1)*count+j2,(k+1)*count+j)]
            uvs += [[(j/count,0),((j+1)/count,0),((j+1)/count,1),(j/count,1)]]
    smooth=range(len(fs))
    fs += [tuple(reversed(range(count))),tuple((len(rings)-1)*count+j for j in range(count))]
    uvs += [[(0,0)]*count,[(0,0)]*count]
    return mesh(name,vs,fs,[mat],collection,uvs=uvs,smooth=smooth)


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    parts[0].name=name
    return parts[0]


def hipcap(name, x, y):
    rings = [(8.52,.66),(8.61,.70),(8.76,.78),(9.01,.80),(9.05,.91),
             (9.12,1.03),(9.16,1.06),(9.19,1.02),(9.43,.09)]
    verts=[]
    for z,r in rings:
        verts += [(x+r*a,y+r*b,z) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    faces=[(3,2,1,0)]; idx=[0]
    for k in range(len(rings)-1):
        for j in range(4):
            j2=(j+1)%4
            faces.append((4*k+j,4*k+j2,4*k+4+j2,4*k+4+j))
            idx.append([0,0,0,1,2,2,3,3][k])
    faces.append(tuple(range(len(verts)-4,len(verts))));idx.append(3)
    return soften(mesh(name,verts,faces,[light_red,red,brown,material_cap],posts,idx),.015)


def wedge(name, x, y, z, length, width, along_y, outer_sign):
    # The driven wedges drop from their thick end toward the pillar mortise.
    def shape(s):
        inner = .5-s*outer_sign/length
        return rect(width,z+.025+(.31 if length>.70 else .16)*inner,.112+.022*inner)
    def tr(a,b,c):
        return (x-b,y+a,c) if along_y else (x+a,y+b,c)
    return soften(swept(name,[-length/2,length/2],shape,[light_red,hinoki],ties,cap_index=1,transform=tr),.012)


material_cap = material('Oxidized porch caps',(80,88,72),.79,.18)
for side, base_x, radius, top_r, seed, skin in [('W',-5.26,1.45,.72,2,west),('E',5.26,1.23,.69,5,east)]:
    s = 1 if base_x>0 else -1
    post(side+' / camphor main pillar',base_x,0,13.22,radius,top_r,seed,skin)
    collar(side+' / maruza seat',base_x-s*.34,0,[(12.92,.78),(12.95,.91),(13.02,.97),(13.33,.97),(13.37,.91)],red,posts)
    for fore in (-1,1):
        y=4.40*fore
        cx=base_x-s*.12
        post(side+f' / cedar sleeve {fore:+}',cx,y,8.65,.73,.52,seed+fore*.57,sugi,True)
        hipcap(side+f' / sleeve capital {fore:+}',cx-s*.17,y*.975)
    for z in (3.12,6.79):
        cx = base_x - s*(.10+.14*z/7)
        plank(side+f' / transverse nuki {z}',cx,0,z,10.45,.46,.78,shu,ties,True,hinoki)
        plank(side+f' / drip arris {z}',cx,0,z+.425,10.53,.53,.08,light_red,ties,True,hinoki)
        for y in (-4.33,0,4.33):
            half = (.72 if y else (1.22-.025*z))
            for sign in (-1,1):
                wedge(side+f' / keyed sleeve joint {z} {y} {sign}',cx,y+sign*half,z+.47,.52,.34,True,sign)
    for sign in (-1,1):
        wedge(side+f' / main tie key {sign}',base_x-s*.27+sign*1.08,0,11.44,.99,.43,False,sign)

plank('Onuki / through beam',0,0,10.93,18.86,.85,.86,shu,ties,tips=hinoki,bow=.095)
plank('Onuki / projecting top arris',0,0,11.40,19.01,.95,.12,light_red,ties,tips=hinoki,bow=.095)
plank('Gakuzuka / plaque post',0,0,12.24,1.24,.74,2.11,shu,ties)


def stations(half, count=48):
    return np.linspace(-half,half,count+1)


def lift(x):
    return .69*(abs(x)/12.1)**2.65+.16*(abs(x)/12.1)**7


def box_course(name, half, bottom_z, top_z, bottom_w, top_w, end_splay, material):
    def shape(x):
        f=x/half
        z=lift(x)
        return [(-end_splay*f,-bottom_w/2,z+bottom_z),(-end_splay*f,bottom_w/2,z+bottom_z),
                (0,top_w/2,z+top_z),(0,-top_w/2,z+top_z)]
    return soften(swept(name,stations(half),shape,[material,hinoki],crown,cap_index=1),.022)


box_course('Shimagi / lower box lintel',9.65,13.20,14.12,1.24,1.58,.23,shu)
box_course('Kasagi / flared upper box lintel',10.93,13.98,14.71,1.55,1.91,.24,shu)
box_course('Kasagi / fascia arris',11.04,14.60,14.76,1.92,2.02,.05,red)
# Gabled bark roof. Gable peaks overhang the flared fascia; thin dark strata read at grazing angles.

def roof_profile(x):
    u=x/12.1
    z=lift(x); kick=.27*abs(u)**7
    return [(0,-1.29,14.61+z),(0,1.29,14.61+z),(0,1.32,14.69+z),
            (0,1.30,14.74+z),(0,1.32,14.79+z),(.14*u,.69,15.10+z+kick*.35),
            (.18*u,.24,15.37+z+kick*.78),(.18*u,0,15.44+z+kick),
            (.18*u,-.24,15.37+z+kick*.78),(.14*u,-.69,15.10+z+kick*.35),
            (0,-1.32,14.79+z),(0,-1.30,14.74+z),(0,-1.32,14.69+z)]

swept('Hiwada / layered cypress-bark gable',stations(11.88),roof_profile,[brown,bark],crown,
      edge_mats=[0,0,1,0,1,1,1,1,1,1,0,1,0])


def ridge_profile(x, scale=1, up=0):
    t=abs(x)/12.1
    # The final ridge is 16.6 m at both ends.
    z=15.52+.76*t**2.8+.32*t**7+up
    scale*=1.38
    return [(0,-.26*scale,z-.212),(0,.26*scale,z-.212),(0,.27*scale,z-.148),
            (0,.19*scale,z-.092),(0,.072*scale,z-.006),(0,0,z),
            (0,-.072*scale,z-.006),(0,-.19*scale,z-.092),(0,-.27*scale,z-.148)]

swept('Munekazari / folded copper ridge',stations(12.1,64),ridge_profile,[copper],crown)
parts=[]
for x in np.linspace(-11.65,11.65,33):
    parts.append(swept('Standing seam', [x-.023,x+.023],lambda p: ridge_profile(p,1.033,.012),[copper],crown))
join(parts,'Copper ridge / folded transverse seams')


def poly_relief(name, contour, transform, depth, thickness, mat, collection):
    n=len(contour)
    verts=[transform(x,z,d) for d in (depth,depth+thickness) for x,z in contour]
    faces=[tuple(reversed(range(n))),tuple(n+j for j in range(n))]
    for j in range(n):
        k=(j+1)%n
        faces.append((j,k,n+k,n+j))
    return mesh(name,verts,faces,[mat],collection)


def rectangle(w,h,corner=0):
    if not corner:
        return [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]
    return [(-w/2+corner,-h/2),(w/2-corner,-h/2),(w/2,-h/2+corner),(w/2,h/2-corner),
            (w/2-corner,h/2),(-w/2+corner,h/2),(-w/2,h/2-corner),(-w/2,-h/2+corner)]


def bead(name, x,z,rx,rz, transform, depth, height, mat, collection, n=14):
    profile=[(x+rx*cos(tau*j/n),z+rz*sin(tau*j/n)) for j in range(n)]
    return poly_relief(name,profile,transform,depth,height,mat,collection)


def raised_line(name, points, thickness, transform, depth, mat, collection):
    vs, faces = [], []
    for i,(x,z) in enumerate(points):
        x1,z1=points[max(0,i-1)]; x2,z2=points[min(len(points)-1,i+1)]
        dx,dz=x2-x1,z2-z1
        d=max(.0001,sqrt(dx*dx+dz*dz))
        ox,oz=dz/d,-dx/d
        for j in range(6):
            c=cos(tau*j/6)*thickness
            vs.append(transform(x+ox*c,z+oz*c,depth+sin(tau*j/6)*thickness))
    for i in range(len(points)-1):
        for j in range(6):
            k=(j+1)%6
            faces.append((i*6+j,i*6+k,(i+1)*6+k,(i+1)*6+j))
    faces += [tuple(reversed(range(6))),tuple(6*(len(points)-1)+j for j in range(6))]
    return mesh(name,vs,faces,[mat],collection,smooth=range(len(faces)-2))


font_candidates = [os.environ.get('TORII_FONT'),
    'C:/Windows/Fonts/NotoSerifJP-VF.ttf','C:/Windows/Fonts/yumindb.ttf',
    '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc',
    '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc']
font_path = next((p for p in font_candidates if p and Path(p).is_file()),None)
if not font_path:
    raise RuntimeError('Set TORII_FONT to a Japanese serif font file, then rebuild.')
font = bpy.data.fonts.load(font_path)


def lettering(chars, sign, center, name):
    glyphs=[]
    step = min(.495,1.83/len(chars))
    for i,ch in enumerate(chars):
        data=bpy.data.curves.new(ch,'FONT')
        data.font=font; data.body=ch; data.resolution_u=5
        ob=bpy.data.objects.new(ch,data); boards.objects.link(ob)
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
        bpy.context.view_layer.objects.active=ob
        bpy.ops.object.convert(target='MESH')
        if not ob.data.vertices:
            raise ValueError('Missing glyph '+ch)
        pts=[v.co.copy() for v in ob.data.vertices]
        x0,x1=min(p.x for p in pts),max(p.x for p in pts)
        y0,y1=min(p.y for p in pts),max(p.y for p in pts)
        scale=min(.72/(x1-x0),step*.88/(y1-y0))
        z=center+((len(chars)-1)/2-i)*step
        for vertex,p in zip(ob.data.vertices,pts):
            vertex.co=(-sign*(p.x-(x0+x1)/2)*scale,sign*.816,z+(p.y-(y0+y1)/2)*scale)
        ob.data.materials.append(gilt)
        glyphs.append(ob)
    return join(glyphs,name+' / gold letters - '+chars)


def plaque(sign, name, chars):
    center=12.19
    def plane(x,z,d):
        return (-sign*x,sign*d,center+z)
    body=[]
    body.append(poly_relief('Tablet backing',rectangle(1.52,2.32,.09),plane,.50,.19,black,boards))
    body.append(poly_relief('Stepped bronze frame',rectangle(1.34,2.20,.055),plane,.685,.045,bronze,boards))
    body.append(poly_relief('Gilded slip',rectangle(1.18,2.045,.037),plane,.73,.03,gilt,boards))
    body.append(poly_relief('Beveled blue-black field',rectangle(1.115,1.98,.028),plane,.755,.049,black,boards))
    # Traditional cloud-shaped side stiles; the top and lower terminals turn outward.
    outline=[(.61,-1.09),(.65,-1.22),(.72,-1.31),(.84,-1.33),(.93,-1.29),(.97,-1.19),
             (.91,-1.10),(.88,-.98),(.87,-.77),(.90,-.64),(.86,-.44),(.91,-.25),
             (.88,-.05),(.92,.12),(.88,.32),(.91,.57),(.86,.77),(.87,.97),
             (.91,1.10),(1.05,1.10),(1.13,1.16),(1.13,1.24),(1.08,1.28),
             (1.01,1.20),(.87,1.22),(.78,1.25),(.66,1.20),(.62,1.06)]
    fittings=[]
    for s in (-1,1):
        line=[(s*x,z) for x,z in outline]
        if s<0:line.reverse()
        body.append(poly_relief('Cloud and dragon stile',line,plane,.65,.14,bronze,boards))
        top=[(s*x,z) for x,z in [(.89,1.11),(1.04,1.10),(1.13,1.16),(1.13,1.24),
                                 (1.08,1.28),(1.01,1.20),(.91,1.22)]]
        bottom=[(s*x,z) for x,z in [(.66,-1.21),(.72,-1.31),(.84,-1.33),(.93,-1.29),(.97,-1.19),(.91,-1.10),(.84,-1.17)]]
        fittings.append(poly_relief('Gilt upper terminal',top if s>0 else top[::-1],plane,.787,.024,old_gold,boards))
        fittings.append(poly_relief('Gilt lower terminal',bottom if s>0 else bottom[::-1],plane,.787,.024,old_gold,boards))
        # Linked, paired scrolls follow a sinuous raised spine down each stile.
        spine = [(s*(.795+.028*sin(t*16.4)),t) for t in np.linspace(-1.085,1.025,67)]
        fittings.append(raised_line('Coiled stem',spine,.022,plane,.794,black,boards))
        for idx in range(5):
            z=-.78+idx*.38
            curve=[(s*(.765+.054*cos(t)*t/tau),z+.095*sin(t)*t/tau) for t in np.linspace(.18,tau*1.25,21)]
            fittings.append(raised_line('Raised cloud scroll',curve,.025,plane,.802,black,boards))
            small=[(s*(.797-.037*cos(t)*t/tau),z+.158-.057*sin(t)*t/tau) for t in np.linspace(.3,tau*1.14,16)]
            fittings.append(raised_line('Cloud return',small,.018,plane,.801,black,boards))
        for z in np.linspace(-.92,.92,9):
            fittings.append(bead('Bronze pin',s*.63,z,.028,.029,plane,.748,.03,gilt,boards))
    for x in (-.41,-.20,0,.20,.41):
        for z in (-1.065,1.065):
            fittings.append(bead('Bronze pin',x,z,.031,.031,plane,.734,.039,gilt,boards))
    # Flattened hoju jewel above the rail, with a small six-petalled emblem beneath it.
    fittings.append(poly_relief('Hoju',[(0,1.32),(-.047,1.25),(-.096,1.20),(-.099,1.145),
                         (-.067,1.111),(0,1.093),(.067,1.112),(.099,1.146),(.091,1.20),(.04,1.24)],
                         plane,.735,.054,old_gold,boards))
    for f in range(6):
        t=f*tau/6
        fittings.append(bead('Cast rosette',.042*cos(t),1.026+.042*sin(t),.029,.029,plane,.766,.032,gilt,boards))
    join(body,name+' / lacquer and carved stiles')
    join(fittings,name+' / cast hardware')
    lettering(chars,sign,center,name)


plaque(1,'Offshore tablet','嚴嶋神社')
plaque(-1,'Sanctuary tablet','伊都岐嶋神社')

for s,name in ((1,'Eastern sun'),(-1,'Western crescent')):
    mid=14.39+lift(10.9)
    def gable(y,z,d):
        x=10.93-.24*(1-(z+.41)/.73)
        return (s*(x+d),s*y,mid+z)
    base=bead(name+' / bronze disc',0,0,.25,.25,gable,.035,.023,bronze,metal,48)
    if s==1:
        bead(name+' / gilded disc',0,0,.196,.196,gable,.056,.015,gilt,metal,48)
    else:
        # Build the crescent from strips with an offset circular inner boundary.
        vs=[]; fs=[]
        for i in range(39):
            t=i/38
            z=-.177+.354*t
            a=sqrt(max(0,.196**2-z*z)); b=sqrt(max(0,.19**2-z*z))
            outer=-a; inner=outer + .13*(sin(pi*t)**.82)
            for y in (outer,inner):vs.append(gable(y,z,.085))
        for i in range(38):fs.append((i*2,i*2+1,i*2+3,i*2+2))
        mesh(name+' / gilded crescent',vs,fs,[gilt],metal)

# The viewport opens on a three-quarter view of the offshore inscription.
view_at = Vector((0,0,7.7))
view_eye = Vector((-17.5,35,12.5))
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            sp=area.spaces.active
            sp.region_3d.view_rotation=(view_at-view_eye).to_track_quat('-Z','Y')
            sp.region_3d.view_distance=33.5
            sp.region_3d.view_location=view_at
            sp.shading.type='MATERIAL'
            sp.shading.color_type='MATERIAL'
            sp.shading.studio_light='studio.exr'
            sp.overlay.show_floor=False
            sp.overlay.show_axis_x=False;sp.overlay.show_axis_y=False
            sp.clip_start=.02
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=None
# Drop unreferenced authoring data, including the local font after outlining.
bpy.data.orphans_purge(do_recursive=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'gate.blend'),compress=True)
# Bake and batch repeated pieces only in the web copy, after saving the editable master.
for ob in list(scene.objects):
    if ob.modifiers:
        bpy.context.view_layer.objects.active=ob
        for mod in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
join(list(ties.objects),'Through ties and their keyed joints')
join([o for o in posts.objects if 'capital' in o.name or 'seat' in o.name],'Four sleeve capitals and two main pillar seats')
join([o for o in crown.objects if 'ridge' in o.name],'Copper ridge and its standing seams')
join(list(metal.objects),'Sun and moon end fittings')
for leading in ('Offshore','Sanctuary'):
    join([o for o in boards.objects if o.name.startswith(leading)],leading+' dedication tablet')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT/'gate.glb'),export_format='GLB',
                          export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
