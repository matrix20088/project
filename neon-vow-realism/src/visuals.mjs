import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {obstacles} from "./simulation.mjs";
const R=Math.random;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function makeMat(col,metalness=.35,roughness=.42,emissive=0,emit=0){
 return new THREE.MeshStandardMaterial({color:col,metalness,roughness,emissive,emissiveIntensity:emit});
}
function box(g,w,h,d,mat,x=0,y=0,z=0){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
function sphere(g,r,mat,x=0,y=0,z=0,detail=18){
 const m=new THREE.Mesh(new THREE.SphereGeometry(r,detail,Math.max(10,Math.floor(detail*.7))),mat);
 m.position.set(x,y,z);g.add(m);return m;
}
function cyl(g,rad,high,mat,x=0,y=0,z=0){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,high,12),mat);
 m.position.set(x,y,z);g.add(m);return m;
}
function neonPanel(msg,main="#65e8fa",sub=""){
 const c=document.createElement("canvas");c.width=768;c.height=256;
 const k=c.getContext("2d");k.fillStyle="#071022";k.fillRect(0,0,768,256);
 k.strokeStyle=main;k.lineWidth=9;k.strokeRect(14,16,740,224);
 k.fillStyle=main;k.font="900 85px sans-serif";k.textAlign="center";k.textBaseline="middle";k.fillText(msg,384,111);
 k.fillStyle="#dbeafa";k.font="700 25px sans-serif";k.fillText(sub,384,191);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
 return new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide,toneMapped:false});
}
export function createVisuals(element){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));
 renderer.setSize(window.innerWidth,window.innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.82;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 element.appendChild(renderer.domElement);
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x162c50);
 scene.fog=new THREE.FogExp2(0x1c3150,.012);
 const camera=new THREE.PerspectiveCamera(63,innerWidth/innerHeight,.09,220);
 scene.add(new THREE.HemisphereLight(0xc8deff,0x304a7a,4.2));
 scene.add(new THREE.AmbientLight(0x99b9e4,.75));
 const amb=new THREE.DirectionalLight(0xffdfc8,1.8);
 amb.position.set(-8,22,6);amb.castShadow=true;
 amb.shadow.mapSize.set(1024,1024);amb.shadow.camera.left=-18;amb.shadow.camera.right=18;
 amb.shadow.camera.top=24;amb.shadow.camera.bottom=-24;amb.shadow.normalBias=.07;
 scene.add(amb);
 function light(color,power,x,y,z,dist=25){
  const p=new THREE.PointLight(color,power,dist,2);p.position.set(x,y,z);scene.add(p);return p;
 }
 light(0x38e9ff,100,-7,10,-10,38);light(0xff60b2,100,8,11,-18,36);
 light(0xfab7e7,68,-7,9,-57,34);light(0x74f1ff,75,7,11,-83,34);
 const steel=makeMat(0x253850,.7,.35),concrete=makeMat(0x34394d,.25,.68),
 neonBlue=makeMat(0x8becff,.1,.14,0x3be6f7,2.5),neonPink=makeMat(0xf5a2df,.1,.17,0xfa31a3,2.5),
 neonGold=makeMat(0xf4cb81,.2,.2,0xe6a342,2.5),black=makeMat(0x081123,.64,.48);
 // A wide 3D urban canyon, not a static poster backdrop.
 const city=new THREE.Group();scene.add(city);
 const road=new THREE.Mesh(new THREE.PlaneGeometry(17.8,260),makeMat(0x1b2a47,.58,.27));
 road.rotation.x=-Math.PI/2;road.position.set(0,-.06,-98);road.receiveShadow=true;city.add(road);
 for(let side of [-1,1]){
   box(city,4.1,.32,263,concrete,side*10.8,-.13,-97);
   box(city,.13,.07,263,side>0?neonPink:neonBlue,side*8.73,.055,-97);
   box(city,.38,.5,263,steel,side*13.25,.2,-97);
 }
 for(let z=6;z>-206;z-=7.3){
   box(city,.10,.012,2.1,makeMat(0x6a7896,.05,.75),0,-.02,z);
   for(let x of [-3.6,3.6])box(city,.05,.015,.65,neonBlue,x,0,z);
 }
 // Illuminated road markings and holographic arrows guide the player
 // from the entry street towards the sectors.
 for(let z=-8;z>-115;z-=12){
   for(let side of [-1,1]){
     const arrow=new THREE.Mesh(new THREE.ConeGeometry(.47,1.1,3),side<0?neonBlue:neonPink);
     arrow.rotation.x=-Math.PI/2;arrow.position.set(side*5.2,.026,z);
     arrow.scale.z=.02;city.add(arrow);
   }
   for(let x=-6;x<=6;x+=2){
     box(city,.82,.022,.18,neonGold,x,.018,z-5.5);
   }
 }
 let seed=77655;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 const windows=[neonBlue,neonPink,neonGold];
 const groups=windows.map(material=>{
   const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.84,.045),material,1100);
   mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);mesh.count=0;city.add(mesh);return mesh;
 });
 const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1);
 for(let side of [-1,1])for(let i=0;i<13;i++){
   const z=7-i*14.5,x=side*(19+random()*4),wide=10+random()*7,deep=9+random()*5,height=21+random()*35;
   const facade=makeMat(i%4===0?0x334864:0x273c5f,.58,.38,0x0c1635,.17);
   box(city,wide,height,deep,facade,x,height/2,z);
   box(city,wide+.4,.5,deep+.5,steel,x,height,z);
   if(i%3===0){
     box(city,wide+.3,.12,deep+.4,side>0?neonPink:neonBlue,x,height*.78,z);
   }
   const rows=Math.floor((height-3)/2.45),cols=Math.floor((wide-2)/2.15);
   for(let f=0;f<rows;f++)for(let col=0;col<cols;col++){
     if(random()<.34)continue;
     const mIndex=random()<.58?0:random()<.7?1:2;
     const mesh=groups[mIndex];
     if(mesh.count>=mesh.instanceMatrix.count)continue;
     const winX=x-wide/2+1.2+col*2.15,winY=2+f*2.45,winZ=z+deep/2+.038;
     matrix.compose(new THREE.Vector3(winX,winY,winZ),quat,scale);
     mesh.setMatrixAt(mesh.count++,matrix);
   }
 }
 for(const g of groups){g.instanceMatrix.needsUpdate=true;g.computeBoundingSphere();}
 for(let z=3;z>-150;z-=18)for(let side of [-1,1]){
   const x=side*8.9;
   box(city,.19,7.0,.18,steel,x,3.5,z);
   box(city,1.3,.12,.18,steel,x-side*.65,7,z);
   box(city,.75,.16,.56,side===1?neonPink:neonBlue,x-side*1.19,7,z);
 }
 const signs=[
  ["NOVA CITY",-12,-27,0x5ae8fa],["KAZE DYNE",12,-47,0xfa7bc1],
  ["SECTOR 07",-12,-88,0x5ae8fa],["NEON VOW",12,-129,0xfa7bc1]
 ];
 for(let [label,x,z,col] of signs){
   const m=new THREE.Mesh(new THREE.PlaneGeometry(7.0,2.5),neonPanel(label,col===0x5ae8fa?"#5ae8fa":"#fa7bc1","CITY CORE // KEEP MOVING"));
   m.position.set(x,5.3,z);m.rotation.y=x>0?-Math.PI/2:Math.PI/2;city.add(m);
 }
 for(let z=-10;z>-145;z-=29){
   box(city,17,.18,1.9,steel,0,12,z);
   box(city,15,.08,.12,neonPink,0,12.15,z);
   for(let x of [-8,8])box(city,.29,11,.3,steel,x,6.5,z);
 }
 // Cyber checkpoints with cooperative pressure pads.
 const gates=[];
 for(let gz of [-19,-49,-79]){
   const group=new THREE.Group();group.position.z=gz;city.add(group);
   box(group,14,.25,.5,steel,0,5,0);
   for(let x of [-7,7])box(group,.45,10,.5,steel,x,5,0);
   const beam=box(group,13.4,8.3,.04,neonBlue,0,4.1,.03);
   beam.material=neonBlue.clone();beam.material.transparent=true;beam.material.opacity=.17;
   for(let x of [-1.5,1.5]){
     const pad=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.0,.08,32),neonBlue);
     pad.position.set(x,.055,2.7);group.add(pad);
   }
   const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.10,12,55),neonPink);
   ring.position.set(0,4,0);group.add(ring);
   gates.push({group,ring,beam,z:gz});
 }
 const obstacleGroups=new THREE.Group();scene.add(obstacleGroups);
 let mapLevel=0;
 function buildObstacles(level){
  obstacleGroups.clear();mapLevel=level;
  for(const o of obstacles(level)){
   box(obstacleGroups,o.w,1.55,o.d,concrete,o.x,.78,o.z);
   box(obstacleGroups,o.w+.05,.13,o.d+.07,steel,o.x,1.59,o.z);
   box(obstacleGroups,o.w+.05,.075,.09,neonGold,o.x,1.52,o.z+o.d/2);
  }
 }
 // Hero model loading; real scanned meshes with skeletons and skinning.
 const heroGroups=[new THREE.Group(),new THREE.Group()],heroData=[];
 heroGroups.forEach(g=>scene.add(g));
 const loader=new GLTFLoader();
 const loadOne=(name,index)=>new Promise((resolve,reject)=>{
  loader.load(`models/${name}.glb`,gl=>{
   const object=gl.scene;object.rotation.x=Math.PI/2;
   object.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;
     if(n.material){n.material.side=THREE.DoubleSide;n.material.needsUpdate=true;}}});
   heroGroups[index].add(object);
   // Actual scanned human mesh and recoloured cloth are the costume.
   // Keep only subtle 3D equipment; oversized plates and glowing belt
   // silhouettes looked toy-like and were removed after screenshot review.
   const outfit=index===0?makeMat(0x253953,.43,.45):makeMat(0x3a314b,.39,.45);
   const trim=index===0?neonBlue:neonPink;
   const backPack=box(heroGroups[index],.26,.24,.075,outfit,0,1.32,.25);
   backPack.castShadow=false;
   box(heroGroups[index],.17,.025,.03,trim,0,1.41,.30);
   object.updateWorldMatrix(true,true);
   for(const armName of ["rigLeftArm","rigRightArm"]){
    let bone=object.getObjectByName(armName);
    if(!bone)continue;
    const fore=bone.children.find(n=>n.isBone&&n.name.includes("ForeArm"));
    if(!fore)continue;
    bone.updateWorldMatrix(true,true);fore.updateWorldMatrix(true,true);
    const shoulder=bone.getWorldPosition(new THREE.Vector3());
    const elbow=fore.getWorldPosition(new THREE.Vector3());
    const curr=elbow.sub(shoulder).normalize(),side=curr.x<0?-1:1;
    const desired=new THREE.Vector3(side*.23,-.96,.16).normalize();
    const change=new THREE.Quaternion().setFromUnitVectors(curr,desired);
    const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.premultiply(parentWorld.clone().invert().multiply(change).multiply(parentWorld));
    bone.updateWorldMatrix(true,true);
   }
   const boneAt=(key)=>object.getObjectByName(key)?.getWorldPosition(new THREE.Vector3())||null;
   let head=boneAt("rigHeadTop_End")||boneAt("rigHead");
   let feet=["rigLeftFoot","rigRightFoot","rigLeftToeBase","rigRightToeBase"].map(boneAt).filter(Boolean);
   let foot=Math.min(...feet.map(v=>v.y)),height=Math.abs(head?.y-foot);
   if(height>.1&&height<50)object.scale.multiplyScalar(1.75/height);
   object.updateWorldMatrix(true,true);
   feet=["rigLeftFoot","rigRightFoot"].map(boneAt).filter(Boolean);
   foot=Math.min(...feet.map(v=>v.y));
   object.position.y+=.045-foot;
   object.updateWorldMatrix(true,true);
   const rig={};
   for(const key of ["rigLeftArm","rigRightArm","rigLeftForeArm","rigRightForeArm","rigLeftUpLeg","rigRightUpLeg","rigLeftLeg","rigRightLeg","rigSpine2","rigHead","rigRightHand"]){
    const b=object.getObjectByName(key);
    if(b){rig[key]={bone:b,base:b.quaternion.clone()};}
   }
   heroData[index]={object,rig};
   // Lighting equipment: cyan energy sword and a hovering pink holographic companion.
   if(index===0){
    const sword=new THREE.Group();
    cyl(sword,.045,.24,steel,0,.10,0);
    cyl(sword,.075,.055,neonGold,0,.23,0);
    const bladeMat=makeMat(0x34bfde,.30,.14,0x21b9ff,1.25);
    const blade=new THREE.Mesh(new THREE.CylinderGeometry(.007,.052,.82,8),bladeMat);
    blade.position.y=.69;blade.castShadow=false;sword.add(blade);
    sphere(sword,.047,bladeMat,0,1.10,0,10);
    scene.add(sword);heroData[index].prop=sword;
   }else{
    const drone=new THREE.Group();
    sphere(drone,.22,steel,0,0,0);
    sphere(drone,.14,neonPink,0,0,.15);
    box(drone,.62,.06,.14,neonPink,0,.04,0);
    scene.add(drone);heroData[index].prop=drone;
   }
   resolve();
  },undefined,reject);
 });
 const ready=Promise.all([loadOne("nathan",0),loadOne("sophia",1)]);
 // Procedural enemies are real 3D meshes with glows, not 2D sprites.
 const foeMeshes=new Map(),shotMeshes=new Map(),itemMeshes=new Map();
 const robotM=makeMat(0x506078,.80,.25),robotDark=makeMat(0x182137,.65,.3);
 const enemyEye=makeMat(0xff728d,.2,.15,0xf7245f,2.3);
 function robot(type){
  const g=new THREE.Group(),boss=type==="boss",scale=boss?2.4:type==="tank"?1.4:1;
  const accent=boss?neonGold:type==="shooter"?neonBlue:neonPink;
  // Curved alloy plating, articulated legs and a helmeted optical sensor.
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.63,6,16),robotM);
  torso.position.set(0,1.26,0);torso.scale.z=.82;torso.castShadow=true;g.add(torso);
  const plating=new THREE.Mesh(new THREE.SphereGeometry(.38,20,14),robotDark);
  plating.scale.set(1,1.1,.65);plating.position.set(0,1.36,.11);g.add(plating);
  const head=sphere(g,.31,robotM,0,2.09,0,20);head.scale.z=.86;
  const face=sphere(g,.23,robotDark,0,2.08,.23,20);face.scale.set(1,.75,.45);
  const sensor=new THREE.Mesh(new THREE.TorusGeometry(.105,.045,8,30),accent);
  sensor.position.set(0,2.09,.36);g.add(sensor);
  sphere(g,.047,enemyEye,0,2.09,.374,12);
  for(const side of [-1,1]){
    const pa=sphere(g,.17,robotM,side*.49,1.72,0,16);pa.scale.z=.83;
    const arm=cyl(g,.12,.73,robotM,side*.54,1.22,0);
    arm.rotation.z=-side*.13;
    sphere(g,.12,steel,side*.55,.88,0,12);
    const leg=cyl(g,.14,.75,robotDark,side*.22,.43,0);
    sphere(g,.17,robotM,side*.22,.23,.10,12).scale.z=1.35;
  }
  const core=sphere(g,.17,accent,0,1.31,.33,12);
  if(boss){
   const crown=new THREE.Mesh(new THREE.TorusGeometry(.49,.075,8,40),neonGold);
   crown.position.set(0,2.15,.12);g.add(crown);
   for(const side of [-1,1]){
    const spike=new THREE.Mesh(new THREE.ConeGeometry(.18,.65,10),steel);
    spike.position.set(side*.5,2.25,0);spike.rotation.z=-side*.35;g.add(spike);
   }
  }
  g.scale.setScalar(scale);
  return g;
 }
 const projectileMat={laser:new THREE.MeshBasicMaterial({color:0xf880ed}),plasma:new THREE.MeshBasicMaterial({color:0xff6a5b}),blast:new THREE.MeshBasicMaterial({color:0xffb74d})};
 const jewelMat=makeMat(0x91f6ff,.12,.12,0x45eaff,2.0);
 const healthMat=makeMat(0xffa0ba,.08,.16,0xff497f,2);
 const effects=[];
 function burst(x,z,color=0xff80ae,num=12){
  for(let i=0;i<num;i++){
   const mesh=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
   mesh.position.set(x+(R()-.5)*.2,.7+R(),z+(R()-.5)*.2);
   scene.add(mesh);
   effects.push({mesh,life:.3+R()*.34,vx:(R()-.5)*5,vy:R()*3,vz:(R()-.5)*5});
  }
 }
 function fx(events){
  if(!events)return;
  for(const e of events){
   if(e.kind==="enemy-hit"||e.kind==="enemy-dead")burst(e.x,e.z,e.kind==="enemy-dead"?0xffe685:0xfd74ab,e.kind==="enemy-dead"?20:6);
   if(e.kind==="slash")burst(e.x+Math.sin(e.yaw),e.z+Math.cos(e.yaw),0x67f7ff,e.hits?13:5);
   if(e.kind==="dash")burst(e.x,e.z,0x64eaff,11);
   if(e.kind==="collect"||e.kind==="revive")burst(e.x,e.z,0x92fff1,20);
   if(e.kind==="hero-down")burst(e.x,e.z,0xff7ea2,26);
   if(e.kind==="gate-open")burst(0,e.z,0x73fff2,45);
   if(e.kind==="pulse"){
     burst(e.x,e.z,e.id===0?0x55e9ff:0xff7aca,35);
     const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.09,10,56),e.id===0?neonBlue:neonPink);
     ring.rotation.x=Math.PI/2;ring.position.set(e.x,.19,e.z);scene.add(ring);
     effects.push({mesh:ring,life:.55,vx:0,vy:0,vz:0,radial:true});
   }
  }
 }
 function updateHeroes(s,dt,focus){
  if(!s)return;
  for(let i=0;i<2;i++){
   const p=s.players[i],g=heroGroups[i];
   const rate=Math.min(1,dt*15);
   g.position.x+=(p.x-g.position.x)*rate;
   g.position.z+=(p.z-g.position.z)*rate;
   const desired=p.yaw;
   let delta=Math.atan2(Math.sin(desired-g.rotation.y),Math.cos(desired-g.rotation.y));
   g.rotation.y+=delta*Math.min(1,dt*8);
   g.visible=true;
   const rig=heroData[i]?.rig;
   if(rig){
    const motion=Math.sin(p.step)*.22*(p.down?0:1);
    for(const [key,amount,axis] of [
      ["rigLeftUpLeg", motion,"x"],["rigRightUpLeg",-motion,"x"],
      ["rigLeftLeg",Math.max(0,-motion)*.4,"x"],["rigRightLeg",Math.max(0,motion)*.4,"x"],
      ["rigLeftArm",motion*.34,"x"],["rigRightArm",-motion*.34,"x"],
      ["rigSpine2",Math.sin(p.step*.1)*.013,"z"],["rigHead",Math.sin(p.step*.08)*.025,"y"]
    ]){
      const b=rig[key];if(!b)continue;
      const q=b.base.clone();
      const v=new THREE.Vector3(axis==="x"?1:0,axis==="y"?1:0,axis==="z"?1:0);
      if(axis==="y")v.set(0,1,0);
      if(axis==="z")v.set(0,0,1);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(v,amount));
      b.bone.quaternion.slerp(q,Math.min(1,dt*15));
    }
   }
   if(p.down){g.rotation.z=-.65;g.position.y=-.2;}
   else{g.rotation.z=0;g.position.y=Math.sin(p.step)*.012;}
   const prop=heroData[i]?.prop;
   if(prop){
    if(i===0){
      prop.visible=p.attack>.012;
      const hand=heroData[i].object.getObjectByName("rigRightHand");
      if(hand){
       heroData[i].object.updateWorldMatrix(true,true);
       hand.getWorldPosition(prop.position);
       prop.position.y+=.05;
       prop.rotation.set(.22,g.rotation.y+.2,-.35+(p.attack>0?Math.sin(p.attack*22)*.65:0));
      }else{prop.position.set(g.position.x+.45,1.15,g.position.z);}
    }else{
      prop.position.set(g.position.x+1.05,2.12+Math.sin(performance.now()*.003)*.12,g.position.z-.2);
      prop.rotation.y+=dt*1.2;
    }
   }
  }
 }
 function updateEntities(s,dt){
  const present=new Set();
  for(const e of s.enemies){
   present.add(e.id);
   if(!foeMeshes.has(e.id)){
    const mesh=robot(e.type);scene.add(mesh);foeMeshes.set(e.id,{mesh,type:e.type});
   }
   const o=foeMeshes.get(e.id).mesh;
   const rate=Math.min(1,dt*15);
   o.position.x+=(e.x-o.position.x)*rate;
   o.position.z+=(e.z-o.position.z)*rate;
   o.rotation.y=e.yaw;
   o.position.y=.02+Math.sin(e.phase*3)*.04;
   if(e.hit>0)o.scale.setScalar((e.type==="boss"?2.4:e.type==="tank"?1.4:1)*1.08);
   else o.scale.setScalar(e.type==="boss"?2.4:e.type==="tank"?1.4:1);
  }
  for(const [id,rec] of foeMeshes)if(!present.has(id)){scene.remove(rec.mesh);foeMeshes.delete(id);}
  const shots=new Set();
  for(const b of s.projectiles){
   shots.add(b.id);
   if(!shotMeshes.has(b.id)){
    const mesh=sphere(scene,b.kind==="blast"?.3:.19,projectileMat[b.kind],0,0,0,10);
    shotMeshes.set(b.id,mesh);
   }
   const m=shotMeshes.get(b.id);
   m.position.set(b.x,.95,b.z);
  }
  for(const [id,m] of shotMeshes)if(!shots.has(id)){scene.remove(m);shotMeshes.delete(id);}
  const items=new Set();
  for(const item of s.pickups){
   items.add(item.id);
   if(!itemMeshes.has(item.id)){
    const m=new THREE.Mesh(new THREE.OctahedronGeometry(item.type==="medkit"?.5:.34),item.type==="medkit"?healthMat:jewelMat);
    scene.add(m);itemMeshes.set(item.id,m);
   }
   const m=itemMeshes.get(item.id);m.position.set(item.x,.85+Math.sin(performance.now()*.004+item.id)*.2,item.z);
   m.rotation.y+=dt*1.6;
  }
  for(const [id,m] of itemMeshes)if(!items.has(id)){scene.remove(m);itemMeshes.delete(id);}
 }
 let lastLevel=0;
 const heroPreview={players:[{x:-1.15,z:4,yaw:Math.PI,step:0},{x:1.15,z:4,yaw:Math.PI,step:1}]};
 function draw(state,dt,fxEvents=[],focus=0){
  const t=performance.now()*.001;
  if(state){
   if(state.level!==lastLevel){buildObstacles(state.level);lastLevel=state.level;}
   updateHeroes(state,dt,focus);
   updateEntities(state,dt);
   for(let i=0;i<gates.length;i++){
    const gated=i===state.sector&&state.phase==="gate";
    const inactive=i>state.sector||state.phase==="fight"&&i===state.sector;
    gates[i].beam.material.opacity=inactive?.32:.06;
    gates[i].ring.rotation.z+=dt*(gated?3:1);
    gates[i].ring.material=gated?neonBlue:neonPink;
   }
   const p=state.players[focus];
   const close=new THREE.Vector3(p.x+(focus===0?-1.25:1.25),3.2,p.z+6.3);
   camera.position.lerp(close,Math.min(1,dt*3.4));
   camera.lookAt(p.x,1.36,p.z-6.7);
  }else{
   updateHeroes(heroPreview,dt);
   camera.position.lerp(new THREE.Vector3(Math.sin(t*.3)*2,3.2,11),Math.min(1,dt));
   camera.lookAt(0,1.7,-8);
  }
  fx(fxEvents);
  for(let i=effects.length-1;i>=0;i--){
   const e=effects[i];e.life-=dt;
   e.mesh.position.x+=e.vx*dt;e.mesh.position.y+=e.vy*dt;e.mesh.position.z+=e.vz*dt;
   if(e.radial)e.mesh.scale.addScalar(dt*7);
   e.mesh.material.opacity=Math.max(0,e.life*2);
   if(e.life<=0){scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();effects.splice(i,1);}
  }
  renderer.render(scene,camera);
 }
 function resize(){
   renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));
   renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
 }
 return {ready,draw,resize,scene,camera,renderer};
}
