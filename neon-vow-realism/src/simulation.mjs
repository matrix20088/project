export const MAP_HALF_WIDTH=7.8;
export const SECTORS=[-27,-57,-87];
export const MAX_LEVEL=12;
const CLAMP=(x,a,b)=>Math.min(b,Math.max(a,x));
const sq=(x)=>x*x;
const DST=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const norm=(dx,dz)=>{const len=Math.hypot(dx,dz);return len>.001?{x:dx/len,z:dz/len}:{x:0,z:-1};};
const RAND=(s)=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
export function obstacles(level){
 const wiggle=level%3;
 return [
 {x:-6.1,z:-16,w:2.2,d:4.3},
 {x:5.8,z:-21,w:2.1,d:4.4},
 {x:wiggle===0?2.7:-3.4,z:-37,w:2.5,d:3.8},
 {x:-5.7,z:-45,w:2.6,d:4},
 {x:5.9,z:-53,w:2.3,d:4.3},
 {x:wiggle===1?3.6:-3.3,z:-67,w:2.2,d:3.6},
 {x:-5.6,z:-76,w:2.8,d:4},
 {x:5.8,z:-83,w:2.2,d:4.1},
 ];
}
function valid(s,x,z,r=.46){
 if(x < -MAP_HALF_WIDTH+r||x>MAP_HALF_WIDTH-r||z>8-r||z<-104+r)return false;
 for(let o of obstacles(s.level))if(x>o.x-o.w/2-r&&x<o.x+o.w/2+r&&z>o.z-o.d/2-r&&z<o.z+o.d/2+r)return false;
 return true;
}
function move(s,e,dx,dz,dt,r=.46){
 const nx=e.x+dx*dt,nz=e.z+dz*dt;
 if(valid(s,nx,e.z,r))e.x=nx;
 if(valid(s,e.x,nz,r))e.z=nz;
}
function hero(id,x,z){
 return {id,x,z,yaw:Math.PI,hp:100,maxHp:100,down:false,inv:0,cool:0,dashCooldown:0,dashTime:0,
  dashDx:0,dashDz:0,dashStamp:0,specialStamp:0,energy:75,attack:0,step:0,revive:0,knock:0};
}
export function createGame(level=1,coop=false){
 level=CLAMP(Math.floor(level)||1,1,MAX_LEVEL);
 const s={level,coop:!!coop,seed:level*619+7919,rng:(level*97193+2247)>>>0,
  phase:"fight",sector:0,wave:1,maxSectors:SECTORS.length,elapsed:0,score:0,combo:0,kills:0,
  players:[hero(0,-1.15,5),hero(1,1.15,5)],enemies:[],projectiles:[],pickups:[],
  gateZ:SECTORS[0]+8,gateOn:false,gateHold:0,lastEvent:"mission-start",boss:false,revision:0,nextId:1};
 spawnEnemies(s);
 return s;
}
function enemy(s,type,x,z){
 const level=s.level;
 const hp=type==="boss"?350+level*60:type==="tank"?120+level*18:type==="shooter"?52+level*8:60+level*9;
 return {id:s.nextId++,type,x,z,yaw:Math.PI,hp,maxHp:hp,cd:.5+RAND(s),phase:RAND(s)*4,knock:0,hit:0};
}
function spawnEnemies(s){
 const center=SECTORS[s.sector];
 const boss=s.sector===2;
 const count=boss?5:Math.min(11,3+Math.ceil(s.level/3)+s.sector);
 for(let i=0;i<count;i++){
  let x=-5.2+(i%4)*3.4+(RAND(s)-.5),z=(s.sector===0?-12:center+8)-Math.floor(i/4)*3.8+(RAND(s)-.5)*1.3;
  let type=(i%5===4)?"tank":(i%3===2)?"shooter":"runner";
  s.enemies.push(enemy(s,type,x,z));
 }
 if(boss)s.enemies.push(enemy(s,"boss",0,center-12));
 s.boss=boss;
 s.phase="fight";s.gateOn=false;s.gateHold=0;s.lastEvent=boss?"boss-incoming":"wave-start";
}
function targetEnemy(s,p,maxRange=100){
 let best=null,dist=maxRange;
 for(const e of s.enemies){if(e.hp<=0)continue;let d=DST(p,e);if(d<dist){best=e;dist=d;}}
 return best;
}
function hurtHero(s,h,dmg,events){
 if(h.down||h.inv>0)return;
 h.hp=Math.max(0,h.hp-dmg);
 h.inv=.65;h.knock=.22;
 events.push({kind:"hero-hit",id:h.id,x:h.x,z:h.z});
 if(h.hp===0){h.down=true;h.revive=0;events.push({kind:"hero-down",id:h.id,x:h.x,z:h.z});}
 if(s.players.every(p=>p.down)){s.phase="defeat";events.push({kind:"defeat"});}
}
function hurtEnemy(s,e,dmg,events){
 if(e.hp<=0)return;
 e.hp=Math.max(0,e.hp-dmg);e.hit=.18;
 events.push({kind:"enemy-hit",x:e.x,z:e.z,type:e.type});
 if(e.hp<=0){
  s.kills++;s.combo++;s.players.forEach(p=>p.energy=Math.min(100,(p.energy||0)+6));s.score+=e.type==="boss"?1000:e.type==="tank"?120:e.type==="shooter"?75:50;
  events.push({kind:"enemy-dead",x:e.x,z:e.z,type:e.type});
  if(e.type==="boss"||RAND(s)<.5)s.pickups.push({id:s.nextId++,type:"crystal",x:e.x,z:e.z,life:17});
  if(e.type==="boss"||RAND(s)<.17)s.pickups.push({id:s.nextId++,type:"medkit",x:e.x+.7,z:e.z,life:17});
 }
}
function shoot(s,p,kind,angle,events){
 const v=kind==="laser"?14:kind==="blast"?7.5:10;
 const a=angle??p.yaw;
 s.projectiles.push({id:s.nextId++,kind,from:p.id??-1,x:p.x+Math.sin(a)*.5,z:p.z+Math.cos(a)*.5,
  vx:Math.sin(a)*v,vz:Math.cos(a)*v,damage:kind==="laser"?24:kind==="blast"?18:13,life:kind==="laser"?1.7:2.4,r:kind==="blast"?.29:.16});
 events.push({kind:"shot",type:kind,x:p.x,z:p.z});
}
function heroAttack(s,p,events){
 const foe=targetEnemy(s,p,p.id===0?3.4:19);
 if(foe)p.yaw=Math.atan2(foe.x-p.x,foe.z-p.z);
 p.cool=p.id===0?.36:.31;p.attack=.2;
 if(p.id===0){
  let hits=0;
  for(const e of s.enemies){
   if(e.hp<=0)continue;
   let d=DST(p,e);
   const angle=Math.atan2(e.x-p.x,e.z-p.z);
   let diff=Math.atan2(Math.sin(angle-p.yaw),Math.cos(angle-p.yaw));
   if(d<2.7+(e.type==="boss"?.7:0)&&Math.abs(diff)<1.38){
    hurtEnemy(s,e,50+(s.level>6?12:0),events);hits++;
   }
  }
  events.push({kind:"slash",x:p.x,z:p.z,yaw:p.yaw,hits});
 }else{
  shoot(s,p,"laser",p.yaw,events);
 }
}
function decideBot(s,inputs){
 const bot=s.players[1],p=s.players[0],inp={x:0,z:0,fire:false,dash:inputs[1]?.dash||0};
 if(bot.down)return inp;
 const closest=targetEnemy(s,bot,23);
 let target=null;
 if(p.down)target=p;
 else if(s.phase==="gate")target={x:0.8,z:s.gateZ};
 else if(closest){
  const d=DST(bot,closest);
  if(d>8)target=closest;
  else if(d<4)target={x:bot.x+(bot.x-closest.x)*2,z:bot.z+(bot.z-closest.z)*2};
  else target={x:p.x+1.6,z:p.z+.8};
  inp.fire=d<18;
 }else target={x:p.x+1.7,z:p.z+.3};
 if(target){
  const dx=target.x-bot.x,dz=target.z-bot.z;
  const n=norm(dx,dz),distance=Math.hypot(dx,dz);
  if(distance>1.2){inp.x=n.x;inp.z=n.z;}
 }
 return inp;
}
function stepHeroes(s,inputs,dt,events){
 for(let index=0;index<2;index++){
  const p=s.players[index],i=inputs[index]||{},moveDir=norm(i.x||0,i.z||0);
  p.inv=Math.max(0,p.inv-dt);p.cool=Math.max(0,p.cool-dt);
  p.attack=Math.max(0,p.attack-dt);p.knock=Math.max(0,p.knock-dt);
  p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  p.step+=dt*((Math.abs(i.x||0)+Math.abs(i.z||0))>.1?11:1.4);
  if(p.down)continue;
  const rawLength=Math.hypot(i.x||0,i.z||0);
  if(i.dash&&i.dash!==p.dashStamp){
   p.dashStamp=i.dash;
   if(p.dashCooldown<=0){
    p.dashTime=.19;p.dashCooldown=2.5;p.inv=Math.max(.24,p.inv);
    p.dashDx=rawLength>.15?moveDir.x:Math.sin(p.yaw);
    p.dashDz=rawLength>.15?moveDir.z:Math.cos(p.yaw);
    events.push({kind:"dash",x:p.x,z:p.z,id:index});
   }
  }
  if(p.dashTime>0){
   move(s,p,p.dashDx*16,p.dashDz*16,dt,.42);
   p.dashTime-=dt;
  }else{
   if(rawLength>.12){
    const speed=index===0?4.65:4.4;
    move(s,p,moveDir.x*speed,moveDir.z*speed,dt,.43);
    p.yaw=Math.atan2(moveDir.x,moveDir.z);
   }
  }
  if(i.special&&i.special!==p.specialStamp){
   p.specialStamp=i.special;
   if(p.energy>=60&&s.phase==="fight"){
    p.energy-=60;
    const victims=s.enemies.filter(e=>e.hp>0&&DST(p,e)<5.5);
    for(const e of victims)hurtEnemy(s,e,65+(p.id===1?20:0),events);
    events.push({kind:"pulse",id:p.id,x:p.x,z:p.z,hits:victims.length});
   }
  }
  if(i.fire&&p.cool<=0&&s.phase==="fight")heroAttack(s,p,events);
 }
 // Rescue teammate by staying nearby for two seconds
 for(let id=0;id<2;id++){
  const d=s.players[id],alive=s.players[1-id];
  if(!d.down)continue;
  if(!alive.down&&DST(d,alive)<1.5){
   d.revive+=dt;
   if(d.revive>2.0){d.down=false;d.hp=50;d.inv=2.3;d.revive=0;s.score+=100;events.push({kind:"revive",id:d.id,x:d.x,z:d.z});}
  }else d.revive=Math.max(0,d.revive-dt*.4);
 }
}
function enemyAI(s,dt,events){
 const live=s.players.filter(p=>!p.down);
 if(!live.length)return;
 for(const e of s.enemies){
  if(e.hp<=0)continue;
  e.cd-=dt;e.hit=Math.max(0,e.hit-dt);e.phase+=dt;
  let target=live.reduce((best,p)=>DST(p,e)<DST(best,e)?p:best,live[0]);
  const dx=target.x-e.x,dz=target.z-e.z,d=Math.hypot(dx,dz);
  const n=norm(dx,dz);
  e.yaw=Math.atan2(dx,dz);
  if(e.type==="shooter"||e.type==="boss"){
   const limit=e.type==="boss"?7:5;
   if(d>limit)move(s,e,n.x*(e.type==="boss"?1.0:1.7),n.z*(e.type==="boss"?1.0:1.7),dt,e.type==="boss"?.95:.35);
   if(e.cd<=0&&d<17){
    if(e.type==="boss"){
     for(let a=-2;a<=2;a++){shoot(s,{x:e.x,z:e.z,id:-1,yaw:e.yaw},"blast",e.yaw+a*.18,events);}
     e.cd=2.3;
     events.push({kind:"boss-attack",x:e.x,z:e.z});
    }else{shoot(s,{x:e.x,z:e.z,id:-1,yaw:e.yaw},"plasma",e.yaw,events);e.cd=1.5;}
   }
  }else{
   const speed=e.type==="tank"?1.45:2.35;
   if(d>1.15)move(s,e,n.x*speed,n.z*speed,dt,e.type==="tank"?.6:.38);
   if(d<1.35&&e.cd<=0){
    hurtHero(s,target,e.type==="tank"?24:13,events);e.cd=e.type==="tank"?1.5:.95;
   }
  }
 }
 s.enemies=s.enemies.filter(e=>e.hp>0);
}
function bullets(s,dt,events){
 for(const b of s.projectiles){
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.life-=dt;
  if(Math.abs(b.x)>8.4||b.z>10||b.z<-113){b.life=0;continue;}
  if(b.from>=0){
   for(const e of s.enemies){
    if(e.hp<=0)continue;
    if(DST(b,e)<(e.type==="boss"?1.3:e.type==="tank"?.85:.6)+b.r){
     hurtEnemy(s,e,b.damage,events);b.life=0;break;
    }
   }
  }else{
   for(const p of s.players){
    if(p.down)continue;
    if(DST(b,p)<.5+b.r){hurtHero(s,p,b.damage,events);b.life=0;break;}
   }
  }
  if(obstacles(s.level).some(o=>Math.abs(b.x-o.x)<o.w/2&&Math.abs(b.z-o.z)<o.d/2)){b.life=0;}
 }
 s.projectiles=s.projectiles.filter(b=>b.life>0);
 if(s.projectiles.length>85)s.projectiles.splice(0,s.projectiles.length-85);
}
function collect(s,dt,events){
 for(const p of s.players){
  if(p.down)continue;
  for(const item of s.pickups){
   item.life-=dt;
   if(item.life<=0)continue;
   if(DST(p,item)<1.1){
    item.life=0;
    if(item.type==="medkit")p.hp=Math.min(100,p.hp+40);
    else s.score+=75;
    events.push({kind:"collect",type:item.type,x:item.x,z:item.z});
   }
  }
 }
 s.pickups=s.pickups.filter(item=>item.life>0);
}
function progress(s,dt,events){
 if(s.phase==="fight"&&s.enemies.length===0){
  s.phase="gate";s.gateOn=true;s.gateHold=0;
  events.push({kind:"gate-open",z:s.gateZ});
 }
 if(s.phase==="gate"){
  const allClose=s.players.every(p=>!p.down&&Math.abs(p.x)<3.3&&Math.abs(p.z-s.gateZ)<2.5);
  if(allClose)s.gateHold+=dt;
  else s.gateHold=Math.max(0,s.gateHold-dt);
  if(s.gateHold>1.25){
   s.score+=350;
   s.sector++;
   if(s.sector>=SECTORS.length){
    s.phase="victory";s.score+=Math.max(0,600-Math.floor(s.elapsed)*3);
    events.push({kind:"victory",level:s.level,score:s.score});
   }else{
    s.wave++;s.gateZ=SECTORS[s.sector]+8;
    events.push({kind:"sector-cleared",sector:s.sector});
    s.players.forEach(p=>{if(!p.down)p.hp=Math.min(100,p.hp+15);});
    spawnEnemies(s);
   }
  }
 }
}
export function tick(s,input,dt){
 if(s.phase!=="fight"&&s.phase!=="gate")return [];
 dt=CLAMP(Number(dt)||0,0,.05);
 s.elapsed+=dt;
 const events=[];
 const controls=[input[0]||{x:0,z:0,fire:false,dash:0},s.coop?input[1]||{}:decideBot(s,input)];
 stepHeroes(s,controls,dt,events);
 if(s.phase==="fight"){enemyAI(s,dt,events);bullets(s,dt,events);collect(s,dt,events);}
 progress(s,dt,events);
 s.revision++;
 return events;
}
export function keyframe(s){
 return {level:s.level,phase:s.phase,sector:s.sector,wave:s.wave,score:s.score,kills:s.kills,elapsed:s.elapsed,
 gateZ:s.gateZ,gateOn:s.gateOn,gateHold:s.gateHold,boss:s.boss,players:s.players,enemies:s.enemies,
 projectiles:s.projectiles,pickups:s.pickups,revision:s.revision};
}
