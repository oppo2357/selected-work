"""Build an editable, stylised six-post Miyajima torii. Run with Blender -b -P."""
from pathlib import Path

import bpy


def paint(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = 0.83
    return mat


def post(name, x, y, height, lower_radius, upper_radius, material):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=lower_radius,
                                    radius2=upper_radius, depth=height,
                                    location=(x, y, height / 2))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4


def beam(name, x, y, z, width, depth, height, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def swept_beam(name, sections, material):
    vertices = []
    for x, z, depth, height in sections:
        vertices.extend([(x, -depth / 2, z), (x, depth / 2, z),
                         (x, depth / 2, z + height), (x, -depth / 2, z + height)])
    faces = [(3, 2, 1, 0)]
    for i in range(len(sections) - 1):
        for j in range(4):
            a = 4 * i + j
            b = 4 * i + (j + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append(tuple(range(len(vertices) - 4, len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)


bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
red = paint('Iron oxide lacquer', (0.66, 0.072, 0.026))
bright = paint('Sunlit vermilion', (0.90, 0.14, 0.046))
dark = paint('Dark roof', (0.04, 0.065, 0.064))
gold = paint('Plaque border', (0.74, 0.45, 0.12))

for x in (-5.4, 5.4):
    post('Main pillar', x, 0, 14.7, 1.05, 0.79, red)
    for y in (-3.2, 3.2):
        post('Secondary pillar', x, y, 9.0, 0.48, 0.36, red)
        beam('Auxiliary post cap', x, y, 9.05, 1.08, 1.06, 0.42, dark)
    beam('Fore and aft tie', x, 0, 8.4, 0.64, 8.5, 0.72, bright)
    beam('Lower tie', x, 0, 5.65, 0.40, 7.8, 0.43, red)
beam('Through beam', 0, 0, 10.45, 17.7, 0.87, 1.12, bright)
for y in (-0.48, 0.48):
    beam('Plaque surround', 0, y, 12.45, 1.64, 0.21, 2.6, gold)
    beam('Inscription panel', 0, y * 1.24, 12.45, 1.35, 0.13, 2.32, dark)

profile = [(-1.0, 1.28), (-0.87, 0.68), (-0.66, 0.28), (-0.35, 0.05),
           (0, 0), (0.35, 0.05), (0.66, 0.28), (0.87, 0.68), (1.0, 1.28)]
for name, half_length, base, depth, height, material in [
    ('Curved supporting lintel', 10.65, 13.75, 1.27, 0.86, red),
    ('Eave fascia', 11.45, 14.51, 1.72, 0.53, bright),
    ('Dark coping', 11.95, 14.97, 2.22, 0.55, dark),
]:
    swept_beam(name, [(t * half_length, base + rise, depth, height)
                      for t, rise in profile], material)

output = Path(__file__).resolve().parent
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_distance = 39
        area.spaces.active.region_3d.view_location = (0, 0, 7.5)
        area.spaces.active.shading.color_type = 'MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output / 'gate.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(output / 'gate.glb'), export_format='GLB',
                          export_yup=True, export_cameras=False, export_lights=False)
