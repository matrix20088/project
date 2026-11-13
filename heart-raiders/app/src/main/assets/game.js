"use strict";
const canvas=document.getElementById("world"),ctx=canvas.getContext("2d",{alpha:false});
const screen=document.getElementById("screen"),toastBox=document.getElementById("toast");
const WIDTH=900,HEIGHT=1800,ARENA={left:65,right:835,top:260,bottom:1440};
const STAGE_COUNT=12;
const THEMES=[
 {name:"الميناء البنفسجي",floor:"#111b39",stripe:"#34406c",edge:"#835dff",enemy:"#ff627f",accent:"#48f1e8",em:"🌆"},
 {name:"غابة النيون",floor:"#102a33",stripe:"#23555a",edge:"#35d6a4",enemy:"#fd6f85",accent:"#75ffa7",em:"🌿"},
 {name:"معبد البلّور",floor:"#24203f",stripe:"#4a3e70",edge:"#b46bff",enemy:"#ffa06e",accent:"#74f6ff",em:"💎"},
 {name:"قلعة الظلال",floor:"#2a182f",stripe:"#5c355b",edge:"#ff72a9",enemy:"#ff7b81",accent:"#ffce7a",em:"🏰"}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),rng=(a,b)=>a+Math.random()*(b-a);
const PI=Math.PI,TAU=PI*2;
let mode="home",game=null,network=false,isHost=false,solo=false,paired=[],pending="",lastTime=0,lastDraw=0,sendAccum=0,netAccum=0,localStage=1,frameNo=0;
let muted=false,activeStick=null,stickX=0,stickY=0,firePointers=new Set(),pressedKeys=new Set(),hitShake=0,shakeOffset=0,showingResult="",toastTimeout=0,screenError=false;
let input=[{x:0,y:0,fire:false,dash:0},{x:0,y:0,fire:false,dash:0}];
let visibleEnemies={},visiblePlayers={},visualBullets={},currentBots=0;
let audioCtx=null,particles=[];
const safe=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function notify(s){toastBox.textContent=s;toastBox.classList.add("show");clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>toastBox.classList.remove("show"),2400);}
function sound(freq=440,dur=.09,type="sine",vol=.045){
 if(muted)return;
 try{audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume();
 const o=audioCtx.createOscillator(),g=audioCtx.createGain();
 o.type=type;o.frequency.setValueAtTime(freq,audioCtx.currentTime);
 o.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.68),audioCtx.currentTime+dur);
 g.gain.setValueAtTime(vol,audioCtx.currentTime);
 g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);
 o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}catch(e){}
}
function vibrate(){try{Native.vibrate();}catch(e){}}
function setOverlay(html){
 screen.classList.remove("hidden");screen.innerHTML=html;
}
function hideOverlay(){screen.classList.add("hidden");screen.innerHTML="";}
function nav(){return '<div class="brandbar"><div class="brand">HEART <strong>RAIDERS</strong> ⚔️</div><div class="tag">TWO HEROES / ONE MISSION</div></div>';}
function showHome(){
 mode="home";game=null;particles=[];showingResult="";
 localStage=clamp(Number(localStorage.getItem("heart_raiders_progress")||1),1,STAGE_COUNT);
 setOverlay(nav()+`<div class="hero"><div class="emblem">⚔️💖</div><div class="kicker">CO-OP ACTION ADVENTURE</div><h1 class="super">قلبين <span>في مهمة</span></h1><p class="sub">أكشن حقيقي! اتحرك، اضرب الوحوش، اعمل اندفاع، واجمع البلورات مع شريكك عشان توصلوا للبوابة وتواجهوا زعماء المراحل.</p><div class="badges"><span>🎮 تحكم مباشر</span><span>⚡ ضرب واندفاع</span><span>👾 زعماء وحوش</span><span>📱 موبايلين</span></div></div>
 <div class="heroes"><div class="heroCard"><div class="face">🗡️</div><b>آدم</b><small>محارب سريع • سيف طاقة</small></div><div class="heroCard"><div class="face">🪄</div><b>ليلى</b><small>ساحرة • طلقات كريستال</small></div></div>
 <div class="card"><div class="kicker">ابدأ المغامرة</div>
 <button class="btn" onclick="startSolo()">▶️ جرّب اللعبة بنفسك</button>
 <button class="btn second" onclick="createRoom()">💞 العبوا مع بعض بالبلوتوث</button>
 <button class="btn ghost" onclick="findPhones()">📲 انضم لغرفة شريكك</button>
 <button class="btn ghost" onclick="showHow()">❔ طريقة التحكم</button></div>
 <p class="bottomnote">١٢ ساحة مليانة وحوش وزعماء، ومراحل أصعب بالتدريج • من غير حسابات أو إنترنت • النسخة التجريبية</p>`);
}
function showHow(){
 mode="how";setOverlay(nav()+`<div class="card"><div class="kicker">تعليمات اللعب</div><h2 class="title">إنتوا فريق بطلين! 🔥</h2>
 <p class="sub">🕹️ <b>العصاية على الشمال:</b> حرّك شخصيتك في أي اتجاه.</p>
 <p class="sub">⚔️ <b>الزر الكبير يمين:</b> ضرب مستمر طول ما إيدك عليه. آدم سيف وليلى بتضرب من بعيد.</p>
 <p class="sub">💨 <b>الزر الصغير:</b> اندفاع سريع لتفادي الهجمات، وبيرجع بعد ثواني.</p>
 <p class="sub">❤️ <b>أنقذ شريكك:</b> لو وقع، قرّب منه عشان ترجّعه للحياة.</p>
 <p class="sub">🌀 <b>بعد القضاء على الوحوش:</b> روحوا سوا للبوابة المضيئة فوق.</p>
 <p class="sub">👑 <b>في المرحلة 4 و8 و12:</b> زعيم كبير بهجمات خاصة.</p>
 <p class="sub">📱 <b>لشخصين:</b> اقترنوا بالبلوتوث في إعدادات أندرويد، واحد يفتح غرفة والتاني يختار موبايله.</p>
 <p class="caption">في التجربة الفردية ليلى بتكون معاك وبتساعدك تلقائيًا. على الكمبيوتر: WASD أو الأسهم للحركة، Space للضرب، Shift للاندفاع.</p>
 <button class="btn" onclick="showHome()">تمام، يلا نلعب 🚀</button></div>`);
}
function showWait(msg){
 mode="waiting";setOverlay(nav()+`<div class="card center"><div class="spinner"></div><h2 class="title">بنجهّز المهمة...</h2><p class="sub">${safe(msg)}</p><button class="btn ghost" onclick="showHome()">رجوع</button></div>`);
}
function showError(msg){
 screenError=true;mode="error";setOverlay(nav()+`<div class="card center"><div class="emblem">⚠️</div><h2 class="title">في مشكلة بسيطة</h2><p class="sub">${safe(msg)}</p><button class="btn" onclick="showHome()">رجوع</button><button class="btn ghost" onclick="goSettings()">إعدادات البلوتوث</button></div>`);
}
function bridge(name,value){
 try{if(!window.Native||typeof Native[name]!=="function")throw Error("ميزة أندرويد مش متاحة في المعاينة");value===undefined?Native[name]():Native[name](value);}
 catch(e){showError("مش قادر أبدأ البلوتوث: "+e.message);}
}
function createRoom(){solo=false;pending="host";showWait("اسمح للتطبيق يستخدم البلوتوث ...");bridge("permission");}
function findPhones(){solo=false;pending="paired";showWait("بندور على الأجهزة اللي اتربطت قبل كده ...");bridge("permission");}
function goSettings(){bridge("settings");}
function listPhones(){
 mode="devices";
 setOverlay(nav()+`<div class="card"><div class="kicker">توصيل الموبايلين</div><h2 class="title">اختار موبايل شريكك 📲</h2>
 <p class="sub">اعملوا اقتران Pair في إعدادات بلوتوث الموبايلين أولًا.</p>
 <div class="list">${paired.length?paired.map((d,i)=>`<button class="device" onclick="connectPhone(${i})">📱 ${safe(d.name)}<small>${safe(d.addr)}</small></button>`).join(""):'<p class="sub center">لسه مفيش أجهزة مقترنة.</p>'}</div>
 <button class="btn second" onclick="bridge('paired')">🔄 تحديث الأجهزة</button>
 <button class="btn ghost" onclick="goSettings()">⚙️ إعدادات البلوتوث</button>
 <button class="btn ghost" onclick="showHome()">رجوع</button></div>`);
}
function connectPhone(i){if(!paired[i])return;showWait("بنتصل بـ "+paired[i].name+" ...");bridge("join",paired[i].addr);}
function send(p){try{Native.send(JSON.stringify(p));}catch(e){}}
function onConnection(role){
 network=true;isHost=role==="host";solo=false;mode="lobby";
 if(isHost){
   setOverlay(nav()+`<div class="card center"><div class="emblem">🛡️</div><h2 class="title">غرفة المهمّة اتفتحت!</h2><p class="sub">إنت آدم المحارب، وشريكتك ليلى الساحرة. إنت اللي تبدأ المرحلة.</p><div class="badges"><span>📱 متصلين</span><span>⚔️ المرحلة ${localStage}</span></div><button class="btn" onclick="startCoop()">🚀 ابدأ المهمة</button></div>`);
   send({t:"lobby",stage:localStage});
 }else{
   setOverlay(nav()+`<div class="card center"><div class="emblem">🪄</div><h2 class="title">إنتِ ليلى الساحرة!</h2><p class="sub">التحكم جاهز. مستنيين آدم يبدأ المهمة من موبايله.</p><div class="spinner"></div></div>`);
 }
}
window.onNative=function(type,detail){
 if(type==="ready"){if(pending==="host"){pending="";bridge("host");}else if(pending==="paired"){pending="";bridge("paired");}return;}
 if(type==="waiting"){showWait(detail);return;}
 if(type==="error"){showError(detail);return;}
 if(type==="paired"){try{paired=JSON.parse(detail);}catch(e){paired=[];}listPhones();return;}
 if(type==="connected"){onConnection(detail);return;}
 if(type==="disconnected"){network=false;isHost=false;solo=false;game=null;showError("اتقطع الاتصال بالموبايل التاني. اعملوا اتصال مرة تانية.");return;}
 if(type==="message"){
  let p;try{p=JSON.parse(detail);}catch(e){return;}
  if(p.t==="input"&&isHost){
    input[1].x=clamp(Number(p.x)||0,-1,1);input[1].y=clamp(Number(p.y)||0,-1,1);
    input[1].fire=!!p.f;input[1].dash=Number(p.d)||0;
  }
  if(p.t==="lobby"&&!isHost){localStage=Number(p.stage)||1;return;}
  if(p.t==="state"&&!isHost){
    const prior=game&&game.phase;
    game=p.g;
    if(game.phase==="play"){mode="playing";hideOverlay();}
    else if(prior!==game.phase||showingResult!==(game.phase+"-"+game.stage)){showResult();}
  }
  if(p.t==="restart"&&isHost){startCoop();}
 }
};
function startSolo(){
 solo=true;network=false;isHost=true;input[0]={x:0,y:0,fire:false,dash:0};
 input[1]={x:0,y:0,fire:false,dash:0};
 startRound(localStage,0);
 notify("🕹️ الشمال للحركة • يمين للضرب والاندفاع!");
}
function startCoop(){
 if(!network||!isHost)return;
 solo=false;input[0]={x:0,y:0,fire:false,dash:0};input[1]={x:0,y:0,fire:false,dash:0};
 startRound(localStage,0);
 broadcast(true);
}
function retryRound(){if(!game)return;const n=game.stage,s=game.score||0;startRound(n,s);}
function nextRound(){if(!game)return;localStage=clamp(game.stage+1,1,STAGE_COUNT);startRound(localStage,game.score||0);}
function returnHome(){showHome();}
function pauseRound(){if(!game||mode!=="playing")return;if(!solo&&!isHost){notify("إيقاف اللعبة من موبايل آدم");return;}game.phase="paused";showResult();broadcast(true);}
function resumeRound(){if(!game)return;game.phase="play";mode="playing";hideOverlay();broadcast(true);}
function showResult(){
 if(!game)return;
 const phase=game.phase;
 showingResult=phase+"-"+game.stage;
 let title="",copy="",icon="",buttons="";
 if(phase==="victory"){
  icon="🏆";title=game.stage===STAGE_COUNT?"كسبتوا المغامرة!":"المهمة نجحت!";
  copy=game.stage===STAGE_COUNT?"خلصتوا الـ١٢ مرحلة وهزمتوا زعيم القلعة!":"بوابة المرحلة الجديدة اتفتحت. استعدّوا لتحدي أقوى!";
  buttons=game.stage<STAGE_COUNT?`<button class="btn" onclick="nextRound()">🚀 المرحلة اللي بعدها</button>`:`<button class="btn" onclick="nextRound()">🔁 العبوا تاني</button>`;
 }else if(phase==="defeat"){
  icon="💥";title="الوحوش غلبتكم!";
  copy="ماتقلقوش، جرّبوا تاني وخدوا بالكم من زر الاندفاع والقلوب!";
  buttons=`<button class="btn" onclick="retryRound()">🔄 إعادة المرحلة</button>`;
 }else if(phase==="paused"){
  icon="⏸️";title="استراحة أبطال";
  copy="لما تكونوا جاهزين ارجعوا ساحة المعركة.";
  buttons=`<button class="btn" onclick="resumeRound()">▶️ كملوا اللعب</button>`;
 }else return;
 if(!solo&&!isHost){buttons='<p class="sub">مستنيين آدم يبدأ المرحلة من موبايله ...</p>';}
 mode="result";
 setOverlay(nav()+`<div class="card center"><div class="emblem">${icon}</div><div class="kicker">HEART RAIDERS</div><h2 class="title">${title}</h2><p class="sub">${copy}</p>
 <div class="badges"><span>🎯 مرحلة ${game.stage}</span><span>💎 نقاط ${game.score}</span><span>⏱️ ${Math.floor(game.elapsed)} ثانية</span></div>
 ${buttons}<button class="btn ghost" onclick="returnHome()">🏠 القائمة الرئيسية</button></div>`);
}
function idCounter(){return ++currentBots;}
function newPlayer(id,x,y){
 return {id,x,y,hp:100,maxHp:100,dir:-PI/2,down:false,revive:0,inv:0,cool:0,dashLeft:0,dashCooldown:0,dashDir:0,dashLast:0,swing:0,hit:0,score:0,trail:0};
}
function newEnemy(kind,x,y,stage){
 const stats={crawler:[55+stage*8,95+stage*3,13],ranger:[44+stage*6,80+stage*2,10],tank:[130+stage*13,60+stage,20],boss:[600+stage*95,66+stage,24]};
 const v=stats[kind];
 return {id:idCounter(),kind,x,y,hp:v[0],maxHp:v[0],speed:v[1],power:v[2],attackCool:rng(.2,1.1),hit:0,t:Math.random()*5,phase:0,charge:0,dir:PI/2};
}
function arenaObjects(stage){
 const variant=(stage-1)%4;
 const bases=[
  [{x:225,y:590,w:120,h:110},{x:590,y:590,w:120,h:110},{x:350,y:960,w:200,h:85}],
  [{x:125,y:785,w:160,h:115},{x:615,y:785,w:160,h:115},{x:388,y:515,w:125,h:105}],
  [{x:215,y:705,w:130,h:120},{x:560,y:705,w:130,h:120},{x:380,y:1060,w:140,h:95}],
  [{x:180,y:900,w:145,h:110},{x:600,y:900,w:145,h:110},{x:380,y:590,w:150,h:135}]
 ];
 return bases[variant];
}
function newTraps(stage){
 return [
  {x:240+stage%3*45,y:840,r:66,offset:0},
  {x:680-stage%3*45,y:1090,r:70,offset:2.3}
 ];
}
function startRound(stage,score){
 localStage=clamp(stage,1,STAGE_COUNT);
 currentBots=0;visibleEnemies={};visiblePlayers={};particles=[];showingResult="";
 game={
  phase:"play",stage:localStage,score:score||0,elapsed:0,
  players:[newPlayer(0,342,1270),newPlayer(1,554,1270)],
  enemies:[],bullets:[],pickups:[],obstacles:arenaObjects(localStage),traps:newTraps(localStage),
  wave:0,maxWaves:localStage%4===0?3:2+Math.floor((localStage-1)/6),
  waitingWave:.8,portal:false,portalGlow:0,message:"اقضوا على الوحوش وافتحوا بوابة الخروج!",kills:0,combo:0
 };
 mode="playing";hideOverlay();hitShake=0;
 input[0].x=input[0].y=input[1].x=input[1].y=0;
 input[0].fire=input[1].fire=false;
}
function spawnWave(){
 let g=game;g.wave++;g.waitingWave=-1;
 const isBoss=g.stage%4===0&&g.wave===g.maxWaves;
 const count=isBoss?2:Math.min(11,3+g.wave+Math.floor(g.stage*.42));
 for(let i=0;i<count;i++){
  const positions=[[180,360],[730,390],[140,550],[745,650],[445,445],[180,1130],[740,1150],[250,1000],[620,990],[450,830],[440,610]];
  const [x,y]=positions[(i+g.stage+g.wave)%positions.length];
  let kind=i%7===0?"tank":(i%3===0?"ranger":"crawler");
  if(g.stage<3&&kind==="tank")kind="crawler";
  g.enemies.push(newEnemy(kind,x+rng(-18,18),y+rng(-18,18),g.stage));
 }
 if(isBoss)g.enemies.push(newEnemy("boss",450,430,g.stage));
 g.message=isBoss?"👑 الزعيم ظهر! اضربوه وابتعدوا عن القذائف!":`⚔️ الموجة ${g.wave} من ${g.maxWaves}`;
 notify(g.message);
}

function circleRect(x,y,r,o){
 const nearX=clamp(x,o.x,o.x+o.w),nearY=clamp(y,o.y,o.y+o.h);
 return (x-nearX)**2+(y-nearY)**2<(r*r);
}
function canMove(x,y,r=33){
 if(x<ARENA.left+r||x>ARENA.right-r||y<ARENA.top+r||y>ARENA.bottom-r)return false;
 for(const o of game.obstacles||[])if(circleRect(x,y,r,o))return false;
 return true;
}
function moveEntity(e,vx,vy,dt,r=30){
 let nx=e.x+vx*dt,ny=e.y+vy*dt;
 if(canMove(nx,e.y,r))e.x=nx;
 if(canMove(e.x,ny,r))e.y=ny;
}
function aimAt(a,b){return Math.atan2(b.y-a.y,b.x-a.x);}
function targetNear(p,maxDist=1e9){
 let nearest=null,d=maxDist;
 for(const e of game.enemies){if(e.hp<=0)continue;const nd=dist(p,e);if(nd<d){d=nd;nearest=e;}}
 return nearest;
}
function spark(x,y,color,num=11,force=1){
 for(let i=0;i<num;i++)particles.push({x,y,vx:rng(-290,290)*force,vy:rng(-290,290)*force,life:rng(.23,.61),ttl:.65,color,r:rng(3,8)});
 if(particles.length>250)particles.splice(0,particles.length-250);
}
function damagePlayer(p,amount,from){
 if(p.down||p.inv>0||game.phase!=="play")return;
 p.hp=Math.max(0,p.hp-amount);p.inv=.62;p.hit=.32;hitShake=11;spark(p.x,p.y,"#ff658d",9);
 if(p.hp===0){p.down=true;p.revive=0;spark(p.x,p.y,"#fff1a0",30,1.4);notify((p.id===0?"آدم":"ليلى")+" وقع! لازم شريكه ينقذه ❤️");}
 if(game.players.every(q=>q.down)){
   game.phase="defeat";sound(140,.7,"sawtooth",.06);showResult();broadcast(true);
 }else sound(180,.18,"sawtooth",.035);
}
function damageEnemy(e,amount,from){
 if(e.hp<=0)return;
 e.hp=Math.max(0,e.hp-amount);e.hit=.2;
 spark(e.x,e.y,e.kind==="boss"?"#ffae6d":"#ff5a9b",e.kind==="boss"?8:4,.6);
 if(e.hp===0){
  game.kills++;game.score+=e.kind==="boss"?600:e.kind==="tank"?80:e.kind==="ranger"?55:35;
  spark(e.x,e.y,"#ffe58c",e.kind==="boss"?40:17,1.1);
  if(e.kind==="boss"||Math.random()<.58)game.pickups.push({id:idCounter(),x:e.x,y:e.y,kind:"gem",phase:rng(0,TAU)});
  if(Math.random()<(e.kind==="boss"?.99:.12))game.pickups.push({id:idCounter(),x:e.x+rng(-20,20),y:e.y,kind:"heart",phase:rng(0,TAU)});
  sound(e.kind==="boss"?880:550,.11,"triangle",.03);
 }
}
function firePlayer(p,idx){
 if(p.cool>0||p.down)return;
 const near=targetNear(p,idx===0?230:650);
 if(near)p.dir=aimAt(p,near);
 if(idx===0){
  p.cool=.41;p.swing=.22;
  const damage=54+(game.stage>=8?8:0);
  let hits=0;
  for(const e of game.enemies){
   if(e.hp<=0)continue;
   const d=dist(p,e),angle=Math.atan2(e.y-p.y,e.x-p.x);
   const diff=Math.atan2(Math.sin(angle-p.dir),Math.cos(angle-p.dir));
   if(d<148+(e.kind==="boss"?30:0)&&Math.abs(diff)<1.48){damageEnemy(e,damage,idx);hits++;}
  }
  spark(p.x+Math.cos(p.dir)*80,p.y+Math.sin(p.dir)*80,"#9fefff",6,.5);
  sound(hits?490:350,.09,"sawtooth",.03);
 }else{
  p.cool=.34;p.swing=.17;
  const d=p.dir;
  game.bullets.push({id:idCounter(),kind:"spell",x:p.x+Math.cos(d)*42,y:p.y+Math.sin(d)*42,vx:Math.cos(d)*690,vy:Math.sin(d)*690,r:17,life:1.1,damage:41,trail:0});
  spark(p.x+Math.cos(d)*40,p.y+Math.sin(d)*40,"#ff87ed",4,.5);
  sound(690,.09,"sine",.025);
 }
}
function dashPlayer(p,inx){
 if(p.down||p.dashCooldown>0)return;
 let a=inx.x,b=inx.y;
 const m=Math.hypot(a,b);
 if(m<.2){a=Math.cos(p.dir);b=Math.sin(p.dir);}
 else{a/=m;b/=m;}
 p.dashDir=Math.atan2(b,a);p.dashLeft=.22;p.dashCooldown=3.6;p.inv=Math.max(p.inv,.36);
 spark(p.x,p.y,p.id===0?"#4cf8ff":"#ff85e3",13);
 sound(780,.15,"triangle",.045);
}
function revivePlayers(dt){
 const [p0,p1]=game.players;
 for(const [dead,alive] of [[p0,p1],[p1,p0]]){
  if(!dead.down)continue;
  if(!alive.down&&dist(dead,alive)<100){
   dead.revive+=dt;
   if(dead.revive>=1.35){
    dead.down=false;dead.hp=60;dead.inv=2.0;dead.revive=0;
    game.score+=150;spark(dead.x,dead.y,"#4efedf",28,1.3);notify("❤️ إنقاذ ناجح! كملوا سوا");
    sound(910,.4,"sine",.045);
   }
  }else dead.revive=Math.max(0,dead.revive-dt*.45);
 }
}
function updateBot(dt){
 const ally=game.players[1],lead=game.players[0];
 let target=null,aim=null;
 const foe=targetNear(ally,1000);
 if(lead.down){target=lead;aim=foe;}
 else if(game.portal){target={x:450,y:355};aim=null;}
 else if(ally.hp<40){target={x:lead.x+95,y:lead.y+70};aim=foe;}
 else if(foe){
  aim=foe;
  const d=dist(ally,foe);
  if(d>320)target=foe;
  else if(d<170)target={x:ally.x+(ally.x-foe.x),y:ally.y+(ally.y-foe.y)};
  else target={x:lead.x+85,y:lead.y+60};
 }else target={x:lead.x+80,y:lead.y+70};
 const i=input[1];
 if(target){const dx=target.x-ally.x,dy=target.y-ally.y,m=Math.hypot(dx,dy);i.x=m>80?dx/m:0;i.y=m>80?dy/m:0;}
 else{i.x=0;i.y=0;}
 i.fire=!!aim&&dist(ally,aim)<610&&!ally.down;
}
function updatePlayers(dt){
 if(solo)updateBot(dt);
 for(let k=0;k<2;k++){
  const p=game.players[k],inp=input[k];
  p.cool=Math.max(0,p.cool-dt);
  p.swing=Math.max(0,p.swing-dt);
  p.hit=Math.max(0,p.hit-dt);
  p.inv=Math.max(0,p.inv-dt);
  p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  if(p.down)continue;
  let ix=clamp(inp.x,-1,1),iy=clamp(inp.y,-1,1),len=Math.hypot(ix,iy);
  if(len>1){ix/=len;iy/=len;}
  if(len>.15)p.dir=Math.atan2(iy,ix);
  if(inp.dash!==p.dashLast){p.dashLast=inp.dash;dashPlayer(p,inp);}
  let speed=k===0?300:280;
  if(p.dashLeft>0){
   p.dashLeft=Math.max(0,p.dashLeft-dt);
   moveEntity(p,Math.cos(p.dashDir)*1080,Math.sin(p.dashDir)*1080,dt,32);
   p.trail+=dt;
   if(p.trail>.035){p.trail=0;spark(p.x,p.y,k===0?"#40edff":"#ff7ddd",2,.3);}
  }else moveEntity(p,ix*speed,iy*speed,dt,32);
  if(inp.fire)firePlayer(p,k);
 }
 revivePlayers(dt);
}
function enemyRadius(e){return e.kind==="boss"?71:e.kind==="tank"?43:34;}
function enemyShot(e,at,burst=false){
 if(!at)return;
 const angle=aimAt(e,at);
 const count=burst?8:1;
 for(let j=0;j<count;j++){
  let a=burst?angle+j*TAU/count:angle;
  const speed=burst?260:340;
  game.bullets.push({id:idCounter(),kind:"enemy",x:e.x+Math.cos(a)*45,y:e.y+Math.sin(a)*45,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,r:burst?22:15,life:3,damage:burst?21:14});
 }
 spark(e.x,e.y,"#ff9f70",8,.6);
}
function updateEnemies(dt){
 for(const e of game.enemies){
  if(e.hp<=0)continue;
  e.t+=dt;e.hit=Math.max(0,e.hit-dt);e.attackCool-=dt;
  const alive=game.players.filter(p=>!p.down);
  if(!alive.length)continue;
  let target=alive.reduce((best,p)=>dist(p,e)<dist(best,e)?p:best,alive[0]);
  const angle=aimAt(e,target),d=dist(e,target);
  e.dir=angle;
  if(e.kind==="ranger"){
    if(d>330)moveEntity(e,Math.cos(angle)*e.speed,Math.sin(angle)*e.speed,dt,enemyRadius(e));
    else if(d<185)moveEntity(e,-Math.cos(angle)*e.speed*.9,-Math.sin(angle)*e.speed*.9,dt,enemyRadius(e));
    if(e.attackCool<=0&&d<840){enemyShot(e,target);e.attackCool=1.5+Math.random()*.45;}
  }else if(e.kind==="boss"){
    if(d>185)moveEntity(e,Math.cos(angle)*e.speed,Math.sin(angle)*e.speed,dt,enemyRadius(e));
    if(e.attackCool<=0&&d<900){enemyShot(e,target,true);e.attackCool=2.4;}
    if(d<115&&e.attackCool<1.55)damagePlayer(target,20,e);
  }else{
    if(d>60+enemyRadius(e)*.35)moveEntity(e,Math.cos(angle)*e.speed,Math.sin(angle)*e.speed,dt,enemyRadius(e));
    if(d<78+enemyRadius(e)*.25&&e.attackCool<=0){damagePlayer(target,e.power,e);e.attackCool=e.kind==="tank"?1.2:1.0;}
  }
 }
 game.enemies=game.enemies.filter(e=>e.hp>0);
}
function updateBullets(dt){
 for(const b of game.bullets){
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(b.x<48||b.x>852||b.y<245||b.y>1485){b.life=0;continue;}
  if(game.obstacles.some(o=>circleRect(b.x,b.y,b.r,o))){spark(b.x,b.y,b.kind==="spell"?"#8ceeff":"#ff8d80",5,.5);b.life=0;continue;}
  if(b.kind==="spell"){
   for(const e of game.enemies){
    if(e.hp>0&&dist(e,b)<enemyRadius(e)+b.r){
     damageEnemy(e,b.damage,1);b.life=0;break;
    }
   }
  }else{
   for(const p of game.players){
    if(!p.down&&dist(p,b)<40+b.r){
     damagePlayer(p,b.damage,null);b.life=0;break;
    }
   }
  }
 }
 game.bullets=game.bullets.filter(b=>b.life>0);
 if(game.bullets.length>80)game.bullets.splice(0,game.bullets.length-80);
}
function updatePickups(dt){
 for(const q of game.pickups){
  q.phase+=dt*4;
  for(const p of game.players){
   if(!p.down&&dist(p,q)<66){
    if(q.kind==="heart"){p.hp=Math.min(100,p.hp+33);game.score+=20;notify("❤️ قلب حياة!");}
    else {game.score+=45;notify("💎 بلورة طاقة!");}
    sound(q.kind==="heart"?950:770,.16,"sine",.04);
    spark(q.x,q.y,q.kind==="heart"?"#ff6798":"#8bfcec",17,.8);
    q.taken=true;break;
   }
  }
 }
 game.pickups=game.pickups.filter(q=>!q.taken);
}
function updateTraps(dt){
 for(const t of game.traps){
  const hot=Math.sin(game.elapsed*2.8+t.offset)>.35;
  if(!hot)continue;
  for(const p of game.players){
   if(!p.down&&dist(t,p)<t.r+24)damagePlayer(p,8,null);
  }
 }
}
function updateParticles(dt){
 for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;}
 particles=particles.filter(p=>p.life>0);
}
function finishStage(){
 if(!game||game.phase!=="play")return;
 game.phase="victory";game.score+=350+Math.round(Math.max(0,200-game.elapsed));
 game.players.forEach(p=>{p.hp=Math.min(100,p.hp+20);});
 const next=clamp(game.stage+1,1,STAGE_COUNT);
 localStorage.setItem("heart_raiders_progress",String(Math.max(Number(localStorage.getItem("heart_raiders_progress")||1),next)));
 sound(1020,.55,"triangle",.065);spark(450,360,"#ffdf8d",60,1.5);
 showResult();broadcast(true);
}
function updateGame(dt){
 if(!game||game.phase!=="play")return;
 game.elapsed+=dt;
 updatePlayers(dt);
 updateEnemies(dt);
 updateBullets(dt);
 updateTraps(dt);
 updatePickups(dt);
 updateParticles(dt);
 if(game.enemies.length===0&&!game.portal){
  if(game.wave===0){game.waitingWave-=dt;if(game.waitingWave<=0)spawnWave();}
  else if(game.wave<game.maxWaves){
   if(game.waitingWave<0){game.waitingWave=2.6;game.players.forEach(p=>{if(!p.down)p.hp=Math.min(100,p.hp+9);});}
   else {game.waitingWave-=dt;if(game.waitingWave<=0)spawnWave();}
  }else if(game.waitingWave<0){
   game.portal=true;game.message="🌀 البوابة اتفتحت! روحوا عندها فوق سوا!";
   spark(450,360,"#5bffe8",38,1.2);notify(game.message);
  }
 }
 if(game.portal){
   const inGate=game.players.every(p=>!p.down&&Math.hypot(p.x-450,p.y-355)<119);
   if(inGate)finishStage();
 }
}
function broadcast(force=false){
 if(!network||!isHost||!game)return;
 send({t:"state",g:game});
}

function pathRound(x,y,w,h,r){
 r=Math.min(r,w/2,h/2);
 ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function rect(x,y,w,h,r,color,stroke="",sw=2){
 ctx.fillStyle=color;pathRound(x,y,w,h,r);ctx.fill();
 if(stroke){ctx.lineWidth=sw;ctx.strokeStyle=stroke;ctx.stroke();}
}
function circle(x,y,r,color,stroke="",lw=2){
 ctx.beginPath();ctx.arc(x,y,r,0,TAU);
 if(color){ctx.fillStyle=color;ctx.fill();}
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
}
function line(x,y,x2,y2,color,width=2){
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function polygon(points,color,stroke="",width=2){
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
 ctx.closePath();ctx.fillStyle=color;ctx.fill();
 if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function text(content,x,y,size=22,color="#fff",align="center",weight=800){
 ctx.font=`${weight} ${size}px system-ui, sans-serif`;
 ctx.textAlign=align;ctx.textBaseline="middle";ctx.fillStyle=color;ctx.fillText(content,x,y);
}
function drawAmbient(time){
 const bg=ctx.createLinearGradient(0,0,0,HEIGHT);bg.addColorStop(0,"#151535");bg.addColorStop(.56,"#081527");bg.addColorStop(1,"#140a2b");
 ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
 for(let j=0;j<25;j++){
  const x=58+j*37+(j%4)*12,y=140+(j%9)*175;
  circle(x,y,2+(j%3),j%2?"#77d6ff66":"#ff6fa354");
 }
 for(let i=0;i<9;i++){
  const y=(i*250+(time*13)%250)-50;
  line(0,y,WIDTH,y,"#6276c012",2);
 }
 for(let i=0;i<4;i++){
  const x=175+(i%2)*550,y=310+i*360;
  const r=130+35*Math.sin(time*.6+i);
  const grad=ctx.createRadialGradient(x,y,10,x,y,r*2.5);
  grad.addColorStop(0,i%2?"#ef4f8533":"#24f1e522");grad.addColorStop(1,"#00000000");
  circle(x,y,r*2.5,grad);
 }
 ctx.save();ctx.translate(450,1010);ctx.rotate(time*.12);
 for(let k=0;k<4;k++){circle(0,0,230+k*60,null,k%2?"#6c51b424":"#33dbe022",4);}
 for(let k=0;k<12;k++){let a=k*TAU/12;line(Math.cos(a)*230,Math.sin(a)*230,Math.cos(a)*400,Math.sin(a)*400,"#36e6d81d",3);}
 ctx.restore();
}
function theme(){return THEMES[Math.floor((game.stage-1)/3)%THEMES.length];}
function paintArena(g,time){
 const t=theme();
 ctx.fillStyle="#080f20";ctx.fillRect(0,0,WIDTH,HEIGHT);
 const glow=ctx.createRadialGradient(450,780,200,450,780,1100);
 glow.addColorStop(0,t.floor);glow.addColorStop(1,"#050713");ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,HEIGHT);
 rect(32,226,836,1260,42,"#0a1023",t.edge+"aa",8);
 const ground=ctx.createLinearGradient(90,240,850,1470);
 ground.addColorStop(0,t.floor);ground.addColorStop(.5,"#101a31");ground.addColorStop(1,"#13182c");
 rect(53,246,794,1220,29,ground,t.stripe,3);
 ctx.save();pathRound(54,249,791,1214,28);ctx.clip();
 for(let x=70;x<870;x+=94)line(x,246,x,1470,t.stripe+"65",2);
 for(let y=257;y<1475;y+=94)line(53,y,848,y,t.stripe+"65",2);
 for(let iy=0;iy<13;iy++)for(let ix=0;ix<9;ix++){
  if((ix+iy)%3===0){circle(70+ix*95,262+iy*94,3,t.accent+"43");}
 }
 for(let i=0;i<6;i++){
  const x=130+(i%3)*285,y=390+Math.floor(i/3)*800;
  const rad=120+Math.sin(time*1.6+i)*11;
  const fog=ctx.createRadialGradient(x,y,5,x,y,rad);
  fog.addColorStop(0,t.accent+"15");fog.addColorStop(1,t.accent+"00");circle(x,y,rad,fog);
 }
 ctx.restore();
 line(63,275,63,1450,t.accent+"30",5);line(836,275,836,1450,t.accent+"30",5);
 for(let i=0;i<8;i++){circle(64,307+i*150,6,t.edge);circle(837,307+i*150,6,t.edge);}
 // Outer decorative pillars
 for(const x of [35,862])for(const y of [250,700,1425]){
  circle(x,y,26,"#1c2843",t.edge,4);
  circle(x,y,11,t.accent);
 }
}
function drawObstacle(o,t){
 ctx.save();
 ctx.shadowColor="#030816";ctx.shadowBlur=22;ctx.shadowOffsetY=24;
 rect(o.x-3,o.y+10,o.w+6,o.h+26,13,"#090e21");
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 polygon([[o.x,o.y+14],[o.x+25,o.y-15],[o.x+o.w+12,o.y-15],[o.x+o.w,o.y+14]],"#405071","#7ea8c5",3);
 const block=ctx.createLinearGradient(o.x,o.y,o.x,o.y+o.h);
 block.addColorStop(0,"#4b5878");block.addColorStop(.25,"#25334d");block.addColorStop(1,"#182038");
 rect(o.x,o.y+14,o.w,o.h,11,block,"#5b6e90",4);
 rect(o.x+10,o.y+27,o.w-20,12,3,t.edge+"aa");
 rect(o.x+14,o.y+51,o.w-28,10,3,"#0c1630");
 for(let a=0;a<3;a++)circle(o.x+24+a*(o.w-48)/2,o.y+o.h-1,5,t.accent);
 ctx.restore();
}
function drawTrap(h,time){
 const active=Math.sin((game.elapsed||time)*2.8+h.offset)>.35;
 ctx.save();ctx.globalAlpha=active?.87:.28;
 const g=ctx.createRadialGradient(h.x,h.y,4,h.x,h.y,h.r*1.5);
 g.addColorStop(0,active?"#ff345a7c":"#ff7f6a44");g.addColorStop(1,"#00000000");
 circle(h.x,h.y,h.r*1.6,g);
 circle(h.x,h.y,h.r,"#451f3a33",active?"#ff577a":"#ff7f945e",active?7:3);
 ctx.translate(h.x,h.y);ctx.rotate(time*.7);
 for(let i=0;i<4;i++){
  const a=i*TAU/4;
  polygon([[Math.cos(a)*18,Math.sin(a)*18],[Math.cos(a+.33)*(h.r*.85),Math.sin(a+.33)*(h.r*.85)],[Math.cos(a-.32)*(h.r*.85),Math.sin(a-.32)*(h.r*.85)]],active?"#ff658ba0":"#b85b6a44");
 }
 ctx.restore();
}
function drawPortal(g,time){
 const x=450,y=355;
 ctx.save();
 const r=85+Math.sin(time*4)*7;
 const aura=ctx.createRadialGradient(x,y,15,x,y,210);
 aura.addColorStop(0,"#83ffdf6e");aura.addColorStop(.4,"#50dafa23");aura.addColorStop(1,"#4ceecb00");
 circle(x,y,210,aura);
 ctx.translate(x,y);ctx.rotate(time*1.3);
 circle(0,0,r,"#1c365277","#61ffe8",9);
 for(let i=0;i<10;i++){const a=i*TAU/10;circle(Math.cos(a)*r,Math.sin(a)*r,8,"#a3fff0");}
 ctx.rotate(-time*2.5);
 circle(0,0,61,"#4de2e729","#94f4ff",5);
 for(let k=0;k<6;k++){
  let a=k*TAU/6+time*.9;
  line(Math.cos(a)*28,Math.sin(a)*28,Math.cos(a)*58,Math.sin(a)*58,"#8dffdd",5);
 }
 text("↟",0,3,60,"#e7fffa");ctx.restore();
 text("البوابة",450,244,26,"#a9ffdc");
}
function drawGroundItems(g,time){
 for(const h of g.traps)drawTrap(h,time);
 for(const o of g.obstacles)drawObstacle(o,theme());
 if(g.portal)drawPortal(g,time);
 for(const q of g.pickups){
  const bob=Math.sin(time*4+q.phase)*9,y=q.y+bob;
  if(q.kind==="heart"){
   ctx.save();ctx.shadowColor="#ff5d91";ctx.shadowBlur=24;
   text("♥",q.x,y,49,"#ff6d9f");ctx.restore();
  }else{
   ctx.save();ctx.translate(q.x,y);ctx.rotate(time*1.3+q.phase);
   ctx.shadowColor="#67fff1";ctx.shadowBlur=17;
   polygon([[0,-27],[20,0],[0,27],[-20,0]],"#6afbe4","#ecffff",3);ctx.restore();
  }
 }
}
function smoothed(key,x,y){
 const source=key.startsWith("p")?visiblePlayers:visibleEnemies;
 if(!source[key])source[key]={x,y};
 const s=source[key],rate=!solo&&!isHost?.29:1;
 s.x=mix(s.x,x,rate);s.y=mix(s.y,y,rate);
 return s;
}
function hpBar(x,y,w,h,pct,color,outline){
 rect(x-2,y-2,w+4,h+4,7,"#081224d9",outline||"#9cacc45a",2);
 if(pct>0)rect(x,y,Math.max(3,w*clamp(pct,0,1)),h,5,color);
}
function drawHero(p,time){
 const smooth=smoothed("p"+p.id,p.x,p.y);
 const x=smooth.x,y=smooth.y;
 const palette=p.id===0?{armor:"#39b6ff",rim:"#86fff9",cape:"#2556a9",hair:"#25324f",skin:"#ffe1bd"}:{armor:"#ff63be",rim:"#ffe3ff",cape:"#7f3fac",hair:"#5a226e",skin:"#ffe0c5"};
 ctx.save();ctx.translate(x,y);
 circle(1,25,43,"#00000057");
 if(p.dashLeft>0){
  ctx.globalAlpha=.4;circle(-Math.cos(p.dir)*43,-Math.sin(p.dir)*43,40,palette.rim);
  ctx.globalAlpha=1;
 }
 ctx.rotate(p.dir+PI/2);
 const bob=p.down?0:Math.sin(time*8+p.id)*3;
 ctx.translate(0,bob);
 if(p.down){ctx.globalAlpha=.4;ctx.rotate(-.8);}
 polygon([[-30,3],[30,3],[41,55],[-42,55]],palette.cape,palette.rim,2);
 // legs
 rect(-23,29,17,26,7,"#172440");rect(7,29,17,26,7,"#172440");
 // arms + body
 circle(-34,6,14,palette.skin);circle(34,6,14,palette.skin);
 rect(-28,-6,56,58,19,palette.armor,palette.rim,3);
 polygon([[-14,4],[0,18],[14,4],[8,39],[-8,39]],"#edfafa");
 // ears / head / hair
 circle(-31,-33,11,palette.skin);circle(31,-33,11,palette.skin);
 circle(0,-36,34,palette.skin);
 if(p.id===0){
  polygon([[-32,-40],[-30,-68],[-16,-57],[-5,-73],[9,-61],[25,-66],[32,-37],[15,-51],[-8,-50]],palette.hair);
 }else{
  polygon([[-37,-44],[-34,-82],[-12,-66],[5,-83],[23,-64],[35,-61],[34,-9],[22,-25],[18,-59],[-18,-61],[-26,-14]],palette.hair);
  polygon([[-15,-77],[0,-88],[15,-77]],"#ffe188","#f8b8fb",3);
 }
 circle(-12,-33,3.5,"#1b2852");circle(12,-33,3.5,"#1b2852");
 line(-6,-17,7,-17,"#cf7e86",2);
 if(p.id===0){
  line(34,-2,52,-43,"#d7edf9",10);line(52,-43,47,-95,"#d4ffff",13);
  line(31,-33,70,-20,"#ffd98d",8);
 }else{
  circle(44,-13,16,"#d2a0ff","#fff7ff",3);
  circle(44,-15,7,"#ff61de");
  line(34,2,41,-63,"#ded6fa",8);
 }
 if(p.swing>0){
  ctx.save();ctx.globalAlpha=p.swing/.22;
  ctx.strokeStyle=p.id===0?"#8afffe":"#ffa1f2";
  ctx.lineWidth=p.id===0?30:13;
  ctx.shadowColor=p.id===0?"#6bf9ff":"#ff93dc";ctx.shadowBlur=29;
  ctx.beginPath();ctx.arc(0,-1,p.id===0?98:58,-2.4,-.6);ctx.stroke();
  ctx.restore();
 }
 ctx.restore();
 if(p.hit>0){circle(x,y,48,null,"#ff678a",6);}
 if(p.down){text("❤",x,y-89,34,"#ff8299");text("أنقذني!",x,y-122,20,"#ffffff");}
 else hpBar(x-46,y-89,92,9,p.hp/p.maxHp,p.id===0?"#4ff3e9":"#ff71b5");
 if(p.revive>0){circle(x,y,62,null,"#49ffd1",7);}
}
function drawEnemy(e,time){
 const pos=smoothed("e"+e.id,e.x,e.y),x=pos.x,y=pos.y;
 const boss=e.kind==="boss",tank=e.kind==="tank",r=enemyRadius(e),pulse=Math.sin(time*5+e.t)*3;
 ctx.save();ctx.translate(x,y);
 circle(0,22,r+6,"#00000066");
 ctx.rotate(Math.sin(e.t*2)*.08);
 if(boss){
  ctx.shadowColor="#ff487c";ctx.shadowBlur=30;
  polygon([[-80,-22],[-53,-95],[-20,-54],[21,-54],[55,-95],[82,-25],[68,63],[-68,63]],"#5b275b","#ff7d9e",7);
  circle(0,-16,67,"#522347","#ff7696",6);
  rect(-43,-38,86,42,14,"#2a0e30","#ffac9f",4);
  circle(-24,-18,10,"#ff333e");circle(24,-18,10,"#ff333e");
  polygon([[-25,25],[0,41],[25,25],[13,55],[-13,55]],"#ff7c60");
 }else{
  const color=e.kind==="ranger"?"#6bc96f":tank?"#ff974e":"#ff5579";
  ctx.shadowColor=color;ctx.shadowBlur=13;
  polygon([[-r,-20],[-r*.76,-r-16],[-r*.2,-r*.77],[r*.18,-r*.77],[r*.75,-r-15],[r,-14],[r*.75,r],[0,r+15],[-r*.75,r]],"#362444",color,4);
  circle(0,0,r+pulse,"#462339",color,4);
  polygon([[-r*.6,-9],[0,-22],[r*.6,-9],[r*.45,11],[-r*.45,11]],"#1d142b");
  circle(-r*.34,-3,r*.18,color);
  circle(r*.34,-3,r*.18,color);
  line(-12,r*.47,12,r*.47,color,4);
  if(e.kind==="ranger"){
   polygon([[0,r+20],[18,r+43],[-18,r+43]],"#8effa1");
  }
 }
 ctx.restore();
 if(e.hit>0){circle(x,y,r+6,null,"#ffffff",5);}
 if(boss||tank||e.hp<e.maxHp)hpBar(x-(boss?91:43),y-r-35,boss?182:86,9,e.hp/e.maxHp,boss?"#ff8580":"#ff6e92");
}
function drawBullet(b,time){
 ctx.save();
 const x=b.x,y=b.y;
 ctx.shadowBlur=22;ctx.shadowColor=b.kind==="spell"?"#ff9df9":"#ff664c";
 const col=b.kind==="spell"?"#f3a5ff":"#ff6a69",light=b.kind==="spell"?"#ffffff":"#fff2ae";
 line(x-b.vx*.065,y-b.vy*.065,x,y,col,b.kind==="spell"?17:13);
 circle(x,y,b.r,col);circle(x,y,b.r*.5,light);
 ctx.restore();
}
function drawParticles(){
 for(const p of particles){
  ctx.globalAlpha=clamp(p.life/p.ttl,0,1);
  circle(p.x,p.y,p.r*p.life/p.ttl,p.color);
 }
 ctx.globalAlpha=1;
}
function drawGameplay(time){
 const g=game;if(!g)return;
 ctx.save();
 if(hitShake>0){ctx.translate(Math.sin(time*53)*hitShake,Math.cos(time*78)*hitShake);hitShake=Math.max(0,hitShake-.5);}
 paintArena(g,time);
 drawGroundItems(g,time);
 const entities=[...g.enemies.filter(e=>e.hp>0).map(e=>({entity:e,y:e.y,type:"enemy"})),
 ...g.players.map(p=>({entity:p,y:p.y,type:"hero"}))].sort((a,b)=>a.y-b.y);
 for(const ent of entities)ent.type==="hero"?drawHero(ent.entity,time):drawEnemy(ent.entity,time);
 for(const b of g.bullets)drawBullet(b,time);
 drawParticles();
 ctx.restore();
 drawHud(g,time);
 if(mode==="playing")drawControls(g,time);
}
function drawHud(g,time){
 const t=theme(),team=g.players||[];
 rect(19,12,862,203,25,"#0a1025ef","#56688a",3);
 rect(35,27,830,47,15,"#1a2745","#2b4666",2);
 text(`${t.em} المرحلة ${g.stage}/12  •  الموجة ${g.wave}/${g.maxWaves}`,450,50,25,"#e4efff");
 text(`💎 ${g.score}`,835,111,22,"#ffdf95","right");
 text(`⏱ ${Math.floor(g.elapsed)}ث`,835,165,22,"#a8cce5","right");
 text("آدم ⚔️",55,107,25,"#82f4ff","left");hpBar(56,132,285,19,team[0].hp/100,"#44dfea","#698c9a");
 text("ليلى 🪄",445,107,25,"#ff9ce1","left");hpBar(445,132,285,19,team[1].hp/100,"#fd72c1","#9673a9");
 circle(823,173,28,"#253453","#8ba3c3",3);text("Ⅱ",823,173,25);
 rect(155,229,590,46,18,"#0b1932bb","#406478",2);
 let message=g.portal?"🌀 البوابة اتفتحت! اتحركوا لفوق":g.phase==="play"?g.message:"المهمة انتهت";
 text(message,450,252,22,g.portal?"#7cffdf":"#e9eefa");
}
function drawControls(g,time){
 const own=(solo||isHost)?0:1,p=g.players[own];
 const jx=150,jy=1586,ax=744,ay=1615,dx=740,dy=1428;
 ctx.save();
 circle(jx,jy,122,"#091b38ae","#7d92ae76",5);
 circle(jx,jy,80,null,"#528cbb5c",2);
 for(let i=0;i<4;i++){let a=i*PI/2;line(jx+Math.cos(a)*92,jy+Math.sin(a)*92,jx+Math.cos(a)*108,jy+Math.sin(a)*108,"#86e1fa66",6);}
 circle(jx+stickX*80,jy+stickY*80,51,"#35bbdecc","#e5ffff",5);
 circle(jx+stickX*80,jy+stickY*80,21,"#d6fcff5d");
 let charge=1-clamp(p.dashCooldown/3.6,0,1);
 circle(dx,dy,74,"#18364cbb","#48ddea",5);
 ctx.beginPath();ctx.arc(dx,dy,79,-PI/2,-PI/2+TAU*charge);ctx.strokeStyle="#9affef";ctx.lineWidth=9;ctx.stroke();
 text("💨",dx,dy-8,38);text("اندفاع",dx,dy+45,17,"#d7f9f8");
 ctx.shadowColor=own===0?"#58aaff":"#ff70b2";ctx.shadowBlur=firePointers.size?38:16;
 circle(ax,ay,112,own===0?"#2352bcbf":"#a43175df",own===0?"#78eeff":"#ff9edd",8);
 circle(ax,ay,91,own===0?"#477bdb9a":"#da5298a1");
 ctx.shadowBlur=0;
 text(own===0?"⚔️":"✨",ax,ay-12,56);
 text("اضرب!",ax,ay+50,23);
 text(own===0?"🛡️ آدم المحارب":"🪄 ليلى الساحرة",450,1740,23,own===0?"#7bfcff":"#ff9de3");
 ctx.restore();
}
function resizeCanvas(){
 const ratio=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.max(1,Math.round(window.innerWidth*ratio));
 canvas.height=Math.max(1,Math.round(window.innerHeight*ratio));
 ctx.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);
 ctx.lineCap="round";ctx.lineJoin="round";
}
function mainLoop(now){
 if(!lastTime)lastTime=now;
 const dt=clamp((now-lastTime)/1000,0,.036);lastTime=now;frameNo++;
 if(mode==="playing"&&game){
  if(solo||isHost){
   updateGame(dt);
   if(network){
    sendAccum+=dt;
    if(sendAccum>.085){sendAccum=0;broadcast();}
   }
  }else if(network){
   netAccum+=dt;
   if(netAccum>.06){netAccum=0;const s=input[1];send({t:"input",x:Math.round(s.x*100)/100,y:Math.round(s.y*100)/100,f:s.fire,d:s.dash});}
  }
 }
 if(mode==="playing"||mode==="result"){drawGameplay(now*.001);}
 else drawAmbient(now*.001);
 requestAnimationFrame(renderLoop);
}

const touchToWorld=e=>({x:e.clientX/window.innerWidth*WIDTH,y:e.clientY/window.innerHeight*HEIGHT});
function myInput(){return input[(solo||isHost)?0:1];}
function joystickFrom(p){
 const dx=p.x-150,dy=p.y-1586,r=Math.hypot(dx,dy);
 stickX=r>8?clamp(dx/103,-1,1):0;
 stickY=r>8?clamp(dy/103,-1,1):0;
 if(r>103){stickX=dx/r;stickY=dy/r;}
 const a=myInput();a.x=stickX;a.y=stickY;
}
canvas.addEventListener("pointerdown",e=>{
 if(mode!=="playing"||!game||game.phase!=="play")return;
 e.preventDefault();const p=touchToWorld(e);
 try{canvas.setPointerCapture(e.pointerId);}catch(err){}
 if(Math.hypot(p.x-150,p.y-1586)<175&&activeStick===null){
  activeStick=e.pointerId;joystickFrom(p);return;
 }
 if(Math.hypot(p.x-744,p.y-1615)<131){
  firePointers.add(e.pointerId);myInput().fire=true;
  return;
 }
 if(Math.hypot(p.x-740,p.y-1428)<88){
  myInput().dash=(myInput().dash+1)%1000000;vibrate();return;
 }
 if(Math.hypot(p.x-823,p.y-173)<47){pauseRound();}
});
canvas.addEventListener("pointermove",e=>{
 if(mode!=="playing"||activeStick!==e.pointerId)return;
 e.preventDefault();joystickFrom(touchToWorld(e));
});
function releasePointer(e){
 if(activeStick===e.pointerId){
  activeStick=null;stickX=0;stickY=0;myInput().x=myInput().y=0;
 }
 if(firePointers.has(e.pointerId)){
  firePointers.delete(e.pointerId);
  myInput().fire=firePointers.size>0;
 }
}
canvas.addEventListener("pointerup",releasePointer);
canvas.addEventListener("pointercancel",releasePointer);
window.addEventListener("blur",()=>{
 activeStick=null;stickX=stickY=0;firePointers.clear();
 if(mode==="playing"){myInput().x=0;myInput().y=0;myInput().fire=false;}
});
document.addEventListener("keydown",e=>{
 if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();
 pressedKeys.add(e.code);
 if(mode!=="playing")return;
 if(["ShiftLeft","ShiftRight"].includes(e.code)&&!e.repeat){myInput().dash=(myInput().dash+1)%1000000;}
 if(e.code==="Escape"&&!e.repeat)pauseRound();
});
document.addEventListener("keyup",e=>pressedKeys.delete(e.code));
function keyboardControls(){
 if(mode!=="playing"||!game)return;
 const up=pressedKeys.has("KeyW")||pressedKeys.has("ArrowUp");
 const down=pressedKeys.has("KeyS")||pressedKeys.has("ArrowDown");
 const left=pressedKeys.has("KeyA")||pressedKeys.has("ArrowLeft");
 const right=pressedKeys.has("KeyD")||pressedKeys.has("ArrowRight");
 const keyboardUsed=up||down||left||right;
 const a=myInput();
 if(activeStick===null){
  if(keyboardUsed){
   let x=Number(right)-Number(left),y=Number(down)-Number(up),mag=Math.hypot(x,y)||1;
   a.x=x/mag;a.y=y/mag;stickX=a.x;stickY=a.y;
  }else{a.x=0;a.y=0;stickX=0;stickY=0;}
 }
 a.fire=firePointers.size>0||pressedKeys.has("Space");
}
const originalMainLoop=mainLoop;
function renderLoop(now){
 keyboardControls();
 originalMainLoop(now);
}
window.addEventListener("resize",resizeCanvas);
window.addEventListener("orientationchange",resizeCanvas);
window.addEventListener("error",e=>{
 console.error("HeartRaiders:",e.message,e.filename,e.lineno);
 if(mode==="home"&&screen.textContent.trim()===""){
  showError("خطأ في تشغيل واجهة اللعبة: "+e.message);
 }
});
resizeCanvas();
showHome();
requestAnimationFrame(renderLoop);
