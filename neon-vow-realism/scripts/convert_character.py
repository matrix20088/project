import bpy
import os
import sys
from mathutils import Vector

# Blender runs once per character. Every rendered model is exported as a real GLB asset.
args=sys.argv[sys.argv.index("--")+1:]
label,fbx_path,texture_path,out_path=args

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx_path, use_image_search=False, automatic_bone_orientation=False)
objects=[ob for ob in bpy.context.scene.objects if ob.type=="MESH"]
if not objects: raise RuntimeError("FBX has no meshes: "+label)
img=bpy.data.images.load(texture_path,check_existing=True)
img.colorspace_settings.name="sRGB"
all_points=[]
for obj in objects:
    for corner in obj.bound_box:
        all_points.append(obj.matrix_world @ Vector(corner))
mins=Vector(tuple(min(p[i] for p in all_points) for i in range(3)))
maxs=Vector(tuple(max(p[i] for p in all_points) for i in range(3)))
print("BOUNDING_BOX",label,tuple(round(v,4) for v in mins),tuple(round(v,4) for v in maxs))
height=max(0.1,maxs.z-mins.z)
scale=1.82/height
root=bpy.data.objects.new("GameCharacter_"+label,None)
bpy.context.collection.objects.link(root)
# Uniform transform through parent preserving hierarchy
top=[o for o in bpy.context.scene.objects if o!=root and o.parent is None]
for o in top:o.parent=root
root.scale=(scale,scale,scale)
root.location=(-((mins.x+maxs.x)*.5)*scale,-((mins.y+maxs.y)*.5)*scale,-mins.z*scale)
for obj in objects:
    for i,slot in enumerate(obj.material_slots):
        mat=slot.material
        if not mat:
            mat=bpy.data.materials.new(label+"_"+str(i))
            obj.data.materials.append(mat)
        mat.use_nodes=True
        nodes=mat.node_tree.nodes
        bsdf=next((n for n in nodes if n.type=="BSDF_PRINCIPLED"),None)
        if not bsdf:
            bsdf=nodes.new("ShaderNodeBsdfPrincipled")
            out=next((n for n in nodes if n.type=="OUTPUT_MATERIAL"),nodes.new("ShaderNodeOutputMaterial"))
            mat.node_tree.links.new(bsdf.outputs["BSDF"],out.inputs["Surface"])
        tex=nodes.get("PHOTOREAL_ATLAS") or nodes.new("ShaderNodeTexImage")
        tex.name="PHOTOREAL_ATLAS";tex.image=img;tex.interpolation="Linear"
        mat.node_tree.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
        bsdf.inputs["Metallic"].default_value=0.0
        bsdf.inputs["Roughness"].default_value=0.72
        try:mat.surface_render_method="DITHERED"
        except Exception:pass
print("MESHES",label,len(objects),"verts",sum(len(o.data.vertices) for o in objects),"materials",sum(len(o.material_slots) for o in objects))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=out_path,export_format="GLB",export_apply=True,export_yup=True,export_animations=True,export_skins=True,export_image_format="AUTO",export_materials="EXPORT")
print("EXPORTED",out_path,os.path.getsize(out_path))
