import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.6;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0a1024);
scene.fog=new THREE.FogExp2(0x0c1833,0.018);
const camera=new THREE.PerspectiveCamera(59,window.innerWidth/window.innerHeight,0.12,250);
const clock=new THREE.Clock();
scene.add(new THREE.HemisphereLight(0xb9d7ff,0x27304d,3.1));
scene.add(new THREE.AmbientLight(0x5679ba,0.33));
const light=(color,intensity,pos,dist=50)=>{const p=new THREE.PointLight(color,intensity,dist,2);p.position.set(...pos);scene.add(p);return p;};
light(0x35dafa,95,[-6,7,-5],40);light(0xfe5c9e,115,[7,8,-6],38);
light(0xfcd2a7,26,[1,12,7],40);
const sun=new THREE.DirectionalLight(0xf4e7f0,2.3);sun.position.set(2,18,12);scene.add(sun);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-40;sun.shadow.camera.right=40;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;
const mat=(color,metalness=.35,roughness=.43,emissive=0x000000,emissiveIntensity=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
const asphalt=mat(0x101827,0.25,0.72),stone=mat(0x343b4e,.14,.74),glass=mat(0x12304c,.48,.16),steel=mat(0x273a4a,.79,.30);
const blue=mat(0x31cbed,.35,.22,0x27dcff,1.8),pink=mat(0xeb62d7,.4,.21,0xf238b7,1.6),warm=mat(0xffcf93,.2,.35,0xffad56,2),dark=mat(0x091020,.5,.3);
function cube(w,h,d,material,x,y,z,group=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function plane(w,h,material,x,y,z){let m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);return m;}
const road=plane(21,270,asphalt,0,-.07,-95);
for(let i=0;i<32;i++){cube(.13,.014,2.3,mat(0x8cb0cb,.1,.65),0,0,-i*7+2);}
for(let side of [-1,1]){
 cube(4.5,.35,255,stone,side*13,-.14,-100);
 cube(.22,.08,260,blue,side*10.4,.02,-100);
 cube(.14,.15,260,steel,side*16,.01,-100);
}
let seed=31;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function banner(msg,fg,side,z,w=6,h=1.8){
 const c=document.createElement('canvas');c.width=512;c.height=192;
 const g=c.getContext('2d');g.fillStyle='#070d20';g.fillRect(0,0,c.width,c.height);
 g.strokeStyle=fg;g.lineWidth=6;g.strokeRect(5,5,502,182);
 g.fillStyle=fg;g.font='bold 80px Arial';g.textAlign='center';g.fillText(msg,256,119);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);
 mesh.position.set(side*13,7,z);mesh.rotation.y=side===1?-Math.PI/2:Math.PI/2;scene.add(mesh);
}
for(let side of [-1,1])for(let i=0;i<15;i++){
 const z=8-i*13;
 const x=side*(20+random()*7),bw=10+random()*7,bh=22+random()*34,bd=9+random()*4;
 cube(bw,bh,bd,glass,x,bh/2,z);
 cube(bw+.3,.5,bd+.3,steel,x,bh,z);
 for(let f=1;f<Math.floor(bh/2.4);f++){
  const y=f*2.4;
  for(let w=-2;w<=2;w++){
   if(random()<.28)continue;
   cube(bw/7,1.1,.045,random()<.19?pink:random()<.72?warm:blue,x+w*bw/6,y,z+bd/2+.03);
  }
 }
 if(i%3===0){cube(bw+.4,.12,bd+.4,side===1?pink:blue,x,bh*.78,z);}
}
banner('NOVA CITY','#52e9ff',1,-32,7,2.2);
banner('KAZE DYNAMICS','#ff6ac5',-1,-53,8.5,2);
banner('NEON VOW','#8dffed',1,-108,7.5,2);
for(let z=4;z>-125;z-=18)for(let side of [-1,1]){
 const x=side*9.4;
 cube(.23,7.2,.24,steel,x,3.6,z);
 cube(1.6,.13,.13,steel,x-side*.6,7.1,z);
 let lamp=light(side===-1?0x78d6ff:0xff8ac7,20,[x-side*1.3,7,z],14);
 cube(.7,.16,.5,side===-1?blue:pink,x-side*1.2,7.1,z);
}
for(let z=-17;z>-135;z-=29){
 cube(18,.22,2.4,steel,0,12.5,z);
 for(let side of [-1,1])cube(.3,11,.3,steel,side*8.7,6.8,z);
 cube(15,.08,.16,pink,0,12.63,z);
}
for(let z=-12;z>-180;z-=36){
 let car=cube(2.2,.75,4.2,mat(0x0f2041,.83,.18),7.4,.57,z);
 cube(1.9,.45,2.1,glass,7.4,1.2,z-.1);
 cube(1.7,.09,.15,pink,7.4,.78,z+2.13);
 for(let side of [-1,1])for(let dz of [-1.2,1.2]){
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.22,16),dark);t.rotation.z=Math.PI/2;t.position.set(7.4+side*1.1,.45,z+dz);scene.add(t);
 }
}
for(let z=-4;z>-120;z-=32){
 for(let i=0;i<7;i++){
  cube(1.3,.02,.13,mat(0xa4c0d5,0,.8),-4+i*1.35,.012,z);
 }
}
const heroRoot=new THREE.Group();scene.add(heroRoot);
const avatarGroup=[new THREE.Group(),new THREE.Group()];
avatarGroup[0].position.set(-1.15,0,-3.3);avatarGroup[1].position.set(1.15,0,-3.6);
heroRoot.add(...avatarGroup);
const player={x:0,z:0,moveX:0,moveZ:0,dash:0,attack:0,health:100};
const loader=new GLTFLoader();
let loaded=0;
function loadAvatar(name,index){
 loader.load(`models/${name}.glb`,gl=>{
  const object=gl.scene;
  object.traverse(node=>{
   if(node.isMesh){node.castShadow=true;node.receiveShadow=true;
     if(node.material){node.material.side=THREE.DoubleSide;node.material.needsUpdate=true;}
   }
  });
  avatarGroup[index].add(object);
  // The original scan is Z-up in its FBX bind pose; glTF conversion
  // leaves the human lying on the horizontal road plane. Stand it upright.
  object.rotation.x=Math.PI/2;
  object.updateWorldMatrix(true,true);
  // Pose the original scanner T-pose rigs into a relaxed action-idle stance.
  // Rotating the arm joints affects the actual skinned 3D mesh, not a 2D overlay.
  for(const armName of ['rigLeftArm','rigRightArm']){
    let bone=null;
    object.traverse(n=>{if(n.isBone && n.name===armName)bone=n;});
    if(!bone)continue;
    const fore=bone.children.find(n=>n.isBone && n.name.includes('ForeArm'));
    if(!fore)continue;
    bone.updateWorldMatrix(true,true);
    fore.updateWorldMatrix(true,true);
    const shoulder=bone.getWorldPosition(new THREE.Vector3());
    const elbow=fore.getWorldPosition(new THREE.Vector3());
    const current=elbow.sub(shoulder).normalize();
    const side=current.x<0?-1:1;
    const desired=new THREE.Vector3(side*.22,-.96,.16).normalize();
    const worldChange=new THREE.Quaternion().setFromUnitVectors(current,desired);
    const parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const localChange=parentWorld.clone().invert().multiply(worldChange).multiply(parentWorld);
    bone.quaternion.premultiply(localChange);
    bone.updateWorldMatrix(true,true);
  }
  // SkinnedMesh geometry bounds can disagree with bone world positions,
  // especially for the original FBX scan's rest/bind transform.
  // Align using actual skeletal head/feet and normalize in real metres.
  const boneAt=(nm)=>{
    const b=object.getObjectByName(nm);
    return b?b.getWorldPosition(new THREE.Vector3()):null;
  };
  object.updateWorldMatrix(true,true);
  let head=boneAt('rigHeadTop_End')||boneAt('rigHead');
  let feet=['rigLeftFoot','rigRightFoot','rigLeftToeBase','rigRightToeBase'].map(boneAt).filter(Boolean);
  let footY=feet.length?Math.min(...feet.map(p=>p.y)):0;
  let measured=head?Math.abs(head.y-footY):0;
  console.log("SKELETON FIRST",name,"head",head?.y,"foot",footY,"measured",measured);
  if(measured>.1 && measured<50){
    const factor=1.72/measured;
    object.scale.multiplyScalar(factor);
    object.updateWorldMatrix(true,true);
  }
  head=boneAt('rigHeadTop_End')||boneAt('rigHead');
  feet=['rigLeftFoot','rigRightFoot','rigLeftToeBase','rigRightToeBase'].map(boneAt).filter(Boolean);
  footY=feet.length?Math.min(...feet.map(p=>p.y)):0;
  object.position.y+=.05-footY;
  object.updateWorldMatrix(true,true);
  console.log("SKELETON ALIGNED",name,"headY",boneAt('rigHeadTop_End')?.y,"footY",boneAt('rigLeftFoot')?.y,"scale",object.scale.x);
  loaded++;
  document.getElementById("loading").innerText=`3D CHARACTERS: ${loaded}/2`;
  if(loaded===2){document.getElementById("loading").style.display="none";window.sceneReady=true;}
 },undefined,e=>{
  console.error("Could not load model",name,e);
  document.getElementById("loading").innerText=`فشل تحميل النموذج ${name}`;
  window.sceneError=String(e);
 });
}
loadAvatar('nathan',0);loadAvatar('sophia',1);
const enemies=[];
for(let i=0;i<5;i++){
 let z=-16-i*16,x=(i%2===0?-1:1)*rng(i);
 const bot=new THREE.Group();bot.position.set(x,0,z);scene.add(bot);
 let c=mat(0x455568,.82,.26);
 cube(1.15,1.25,.65,c,0,1.15,0,bot);
 cube(.7,.65,.55,c,0,2.1,0,bot);
 cube(.5,.1,.06,pink,0,2.17,.30,bot);
 cube(.3,1,.3,c,-.68,1.24,0,bot);cube(.3,1,.3,c,.68,1.24,0,bot);
 for(let side of [-1,1])cube(.25,.8,.27,c,side*.3,.25,0,bot);
 let e={object:bot,phase:i,health:100};enemies.push(e);
}
function rng(i){return Math.sin(i*238.234)*2.3;}
const bullets=[];
function pulse(x,y,z,col){
 const s=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.8}));
 s.position.set(x,y,z);scene.add(s);bullets.push({obj:s,life:.7});
}
function attack(){
 player.attack=1;
 pulse(player.x,1.2,-4+player.z,0x59f8fa);
 for(const e of enemies){if(e.health>0&&Math.hypot(player.x-e.object.position.x,player.z-3.3-e.object.position.z)<3){e.health-=15;}}
}
document.addEventListener("keydown",e=>{
 if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(e.code==="Space"&&!e.repeat)attack();
 if(e.code==="ShiftLeft"&&!e.repeat)player.dash=0.25;
 if(e.code==="KeyV"&&!e.repeat)cameraMode=(cameraMode+1)%2;
});
document.addEventListener("keyup",e=>keys.delete(e.code));
const keys=new Set();
const control=document.getElementById('control');let dragging=false;
control.addEventListener('pointerdown',e=>{dragging=true;control.setPointerCapture(e.pointerId);pointer(e);});
control.addEventListener('pointermove',e=>{if(dragging)pointer(e);});
control.addEventListener('pointerup',()=>{dragging=false;player.moveX=0;player.moveZ=0;});
function pointer(e){const r=control.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;player.moveX=THREE.MathUtils.clamp((e.clientX-cx)/(r.width*.35),-1,1);player.moveZ=THREE.MathUtils.clamp((cy-e.clientY)/(r.height*.35),-1,1);}
document.getElementById('attack').addEventListener('pointerdown',e=>{e.preventDefault();attack();});
document.getElementById('dash').addEventListener('pointerdown',e=>{e.preventDefault();player.dash=.25;});
let cameraMode=0;
function update(){
 const dt=Math.min(.03,clock.getDelta());const t=clock.elapsedTime;
 const dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+player.moveX;
 const dz=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))+player.moveZ;
 const speed=player.dash>0?15:4.5;
 player.dash=Math.max(0,player.dash-dt);player.attack=Math.max(0,player.attack-dt*3.5);
 player.x=THREE.MathUtils.clamp(player.x+dx*speed*dt,-8,8);
 player.z=THREE.MathUtils.clamp(player.z-dz*speed*dt,-145,3);
 heroRoot.position.set(player.x,0,player.z);
 avatarGroup[0].position.y=Math.sin(t*(dx||dz?10:1.5))*((dx||dz)?0.04:0.006);
 avatarGroup[1].position.y=Math.sin(t*(dx||dz?10:1.5)+.5)*((dx||dz)?0.04:0.006);
 if(Math.abs(dx)>0.05||Math.abs(dz)>0.05){
   const rot=Math.atan2(dx,-dz);
   avatarGroup[0].rotation.y=THREE.MathUtils.lerp(avatarGroup[0].rotation.y,rot,dt*6);
   avatarGroup[1].rotation.y=THREE.MathUtils.lerp(avatarGroup[1].rotation.y,rot,dt*6);
 }
 for(const [i,e] of enemies.entries()){
  if(e.health>0){e.object.position.x=Math.sin(t*.7+e.phase)*3.2;e.object.rotation.y=t*.27;}
  else e.object.visible=false;
 }
 for(let i=bullets.length-1;i>=0;i--){bullets[i].life-=dt;bullets[i].obj.scale.multiplyScalar(1+dt*5);bullets[i].obj.material.opacity=Math.max(0,bullets[i].life);if(bullets[i].life<=0){scene.remove(bullets[i].obj);bullets.splice(i,1);}}
 const goal=cameraMode===0?new THREE.Vector3(player.x,3.1,player.z+8.7):new THREE.Vector3(player.x-1.2,2.8,player.z+4.2);
 camera.position.lerp(goal,Math.min(1,dt*3.0));
 camera.lookAt(player.x,1.6,player.z-5.5);
 renderer.render(scene,camera);
 requestAnimationFrame(update);
}
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
window.sceneReady=false;window.sceneError="";
camera.position.set(0,3.2,8);
update();
