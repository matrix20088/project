import {createGame,tick,keyframe,MAX_LEVEL} from "./simulation.mjs";
import {createVisuals} from "./visuals.mjs";
const $=id=>document.getElementById(id);
const panel=$("panel"),overlay=$("overlay"),hud=$("hud"),loading=$("loading"),toast=$("toast");
const view=createVisuals($("game"));
let ready=false,mode="boot",state=null,isHost=true,connected=false,solo=true,paused=false,role=0,muted=false;
let pending="",devices=[],scoreMemory=0,clockTime=performance.now(),sendTimer=0,netTimer=0,toastUntil=0,previousPhase="";
let input=[{x:0,z:0,fire:false,dash:0,special:0},{x:0,z:0,fire:false,dash:0,special:0}];
let pointerId=null,pressedFire=new Set(),keys=new Set();
let audioCtx=null;
const savedLevel=()=>Math.max(1,Math.min(MAX_LEVEL,Number(localStorage.getItem("neonVowLevel")||1)));
const friendly=(n)=>new Intl.NumberFormat("ar-EG").format(n);
const safe=(s)=>String(s).replace(/[&<>"']/g,k=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]));
function playSound(type){
 if(muted)return;
 try{
  audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==="suspended")audioCtx.resume();
  const o=audioCtx.createOscillator(),v=audioCtx.createGain();
  const k={hit:[180,.085,"square"],kill:[460,.19,"triangle"],gate:[700,.4,"sine"],win:[1000,.7,"triangle"],dash:[540,.12,"sawtooth"],boss:[110,.5,"sawtooth"]}[type]||[400,.09,"sine"];
  o.type=k[2];o.frequency.setValueAtTime(k[0],audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(60,k[0]*1.5),audioCtx.currentTime+k[1]);
  v.gain.setValueAtTime(.02,audioCtx.currentTime);
  v.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+k[1]);
  o.connect(v);v.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+k[1]);
  o.onended=()=>audioCtx?.state==="running"&&null;
 }catch(e){}
}
function vibrate(){try{window.Native?.vibrate?.();}catch(e){}}
function bubble(s,duration=2700){
 toast.textContent=s;toast.classList.add("show");
 toastUntil=performance.now()+duration;
}
function saveLevel(n){
 const old=savedLevel();
 localStorage.setItem("neonVowLevel",String(Math.max(old,Math.min(MAX_LEVEL,n))));
}
function pauseRender(){overlay.classList.remove("hidden");hud.classList.remove("active");}
function gameplayRender(){mode="playing";overlay.classList.add("hidden");hud.classList.add("active");loading.style.display="none";}
function screen(body){overlay.classList.remove("hidden");hud.classList.remove("active");panel.innerHTML=body;}
function brand(){return `<div class="kicker">CO-OP ACTION RPG · MOBILE REAL-TIME 3D</div><div class="headline">NEON <em>VOW</em></div>`;}
function menu(){
 mode="home";state=null;connected=connected&&false;solo=true;paused=false;
 resetInput();
 const saved=savedLevel();
 screen(`${brand()}<div class="lead">اتنين وسط مدينة سيطر عليها جيش روبوتات. تحكّموا في شخصياتكم، احموا بعض، وحاربوا زعماء القطاعات وافتحوا بوابات الخروج.</div>
 <div class="characters">
  <div class="person"><b>⚔️ آدم — المحارب</b><small>سيف طاقة • قتال قريب • اندفاع سريع</small></div>
  <div class="person"><b>✨ ليلى — الساحرة التقنية</b><small>طاقة بعيدة • سرعة ومساندة • مراوغة</small></div>
 </div><div class="buttons">
 <button class="mainbtn" id="solo">▶️ ابدأ المغامرة الفردية (مرحلة ${saved})</button>
 <button class="mainbtn blue" id="host">💞 أنشئ غرفة لشخصين</button>
 <button class="mainbtn ghost" id="join">📲 انضم من موبايل تاني</button>
 <button class="mainbtn ghost" id="how">طريقة اللعب والتحكم</button>
 </div><div class="foot">12 مهمة متصاعدة • 3 قطاعات في كل مهمة • أعداء وزعماء وإنقاذ شريك • طور تجريبي للرسوم والأكشن، مش لعبة AAA مكتملة</div>`);
 $("solo").onclick=()=>startSolo(saved);
 $("host").onclick=()=>requestHost();
 $("join").onclick=()=>requestPaired();
 $("how").onclick=how;
}
function how(){
 mode="how";screen(`${brand()}<div class="lead" style="text-align:right">
 <p>🕹️ <b>العصاية أسفل الشمال</b> لتحريك الشخصية بحرية داخل المدينة.</p>
 <p>⚔️ <b>زر الهجوم</b> استمر ضاغطًا عليه؛ آدم يضرب بالسيف وليلى تطلق طاقة تلقائيًا ناحية أقرب عدو.</p>
 <p>💨 <b>الاندفاع</b> للمراوغة، و✦ لموجة الطاقة الخاصة بعد شحنها.</p>
 <p>💗 <b>إنقاذ شريكك:</b> قف بالقرب منه ثانيتين عندما يسقط.</p>
 <p>🚪 <b>البوابات:</b> بعد هزيمة موجة الوحوش، قفوا أنتما الاثنان عند بوابة القطاع.</p>
 <p>📱 <b>اللعب الثنائي:</b> اعملوا اقتران Bluetooth من إعدادات أندرويد، واحد ينشئ الغرفة والتاني ينضم لها.</p>
 <p>⌨️ على الكمبيوتر: WASD أو الأسهم للحركة، Space للهجوم، Shift للاندفاع، E للطاقة الخاصة.</p></div>
 <button class="mainbtn" id="back">↩️ رجوع للقائمة</button>`);
 $("back").onclick=menu;
}
function waitScreen(text){mode="waiting";screen(`${brand()}<div class="lead">${safe(text)}</div><div style="text-align:center;font-size:53px;padding:20px">📡</div><button class="mainbtn ghost" id="cancel">↩️ رجوع</button>`);$("cancel").onclick=menu;}
function bridge(name,arg){
 try{
  if(typeof window.Native?.[name]!=="function")throw Error("البلوتوث يعمل على تطبيق أندرويد فقط");
  if(arg!==undefined)window.Native[name](arg);else window.Native[name]();
 }catch(e){error(e.message);}
}
function requestHost(){solo=false;pending="host";waitScreen("بنجهّز صلاحيات البلوتوث علشان تفتح غرفة لمراتك...");bridge("permission");}
function requestPaired(){solo=false;pending="paired";waitScreen("جارٍ البحث في الأجهزة المقترنة...");bridge("permission");}
function devicesScreen(){
 mode="devices";screen(`${brand()}<div class="lead">اختار موبايل شريكك من الأجهزة المقترنة. لازم تعملوا Pairing من إعدادات Android أول مرة.</div>
 <div id="devices">${devices.length?devices.map((d,i)=>`<button class="mainbtn ghost" data-i="${i}">📱 ${safe(d.name)} — ${safe(d.addr)}</button>`).join(""):"<p class='lead'>مفيش موبايلات مقترنة لسه.</p>"}</div>
 <div class="buttons"><button class="mainbtn blue" id="settings">⚙️ إعدادات البلوتوث</button><button class="mainbtn ghost" id="refresh">تحديث الأجهزة</button><button class="mainbtn ghost" id="back">رجوع</button></div>`);
 document.querySelectorAll("#devices [data-i]").forEach(b=>b.onclick=()=>{
  const dev=devices[Number(b.dataset.i)];waitScreen("بنحاول نوصل لـ "+dev.name+"...");
  bridge("join",dev.addr);
 });
 $("settings").onclick=()=>bridge("settings");$("refresh").onclick=()=>bridge("paired");$("back").onclick=menu;
}
function error(s){mode="error";screen(`${brand()}<div class="lead">⚠️ ${safe(s)}</div><button class="mainbtn" id="back">رجوع للقائمة</button>`);$("back").onclick=menu;}
function connectedRoom(kind){
 connected=true;isHost=kind==="host";role=isHost?0:1;solo=false;mode="lobby";
 if(isHost){
  screen(`${brand()}<div class="lead">🔗 اتصال ناجح! إنت آدم المحارب. شريكتك ليلى اتصلت من الموبايل التاني.</div><div class="characters"><div class="person">⚔️ إنت آدم</div><div class="person">✨ هي ليلى</div></div>
  <div class="buttons"><button class="mainbtn" id="start">🚀 ابدأ المرحلة ${savedLevel()}</button><button class="mainbtn ghost" id="back">رجوع</button></div>`);
  $("start").onclick=()=>startHost(savedLevel());$("back").onclick=menu;
 }else{
  waitScreen("💗 إنتِ ليلى الساحرة. اتصلنا بنجاح؛ مستنيين آدم يبدأ الجولة من الموبايل الأول.");
 }
}
function startSolo(level){
 solo=true;isHost=true;connected=false;role=0;scoreMemory=0;
 state=createGame(level,false);resetInput();gameplayRender();bubble("⚔️ اهزموا الوحوش واتحركوا ناحية البوابة!");
}
function startHost(level){
 solo=false;isHost=true;connected=true;role=0;scoreMemory=0;
 state=createGame(level,true);resetInput();gameplayRender();broadcast();
}
function resetInput(){for(let i of input){i.x=0;i.z=0;i.fire=false;i.dash=0;i.special=0;}releaseJoystick();}
function startNext(){
 if(!isHost)return;
 const next=state?.phase==="victory"?Math.min(MAX_LEVEL,(state?.level||1)+1):(state?.level||1);
 const preserved=state?.score||0;
 state=createGame(next,!solo);state.score=preserved;resetInput();
 gameplayRender();if(connected)broadcast();
}
function showResult(){
 if(!state||mode==="result")return;
 mode="result";hud.classList.remove("active");
 let win=state.phase==="victory";
 const text=win?(state.level===MAX_LEVEL?"هزمتوا الزعيم الأخير!":"نجحتوا في تحرير القطاع!"):
  state.phase==="paused"?"المغامرة اتوقفت مؤقتًا":"الروبوتات غلبتكم المرة دي!";
 screen(`${brand()}<div class="lead" style="font-size:20px;font-weight:900">${win?"🏆":state.phase==="paused"?"⏸️":"💥"} ${text}</div>
 <div class="characters"><div class="person"><b>✦ ${friendly(state.score)}</b><small>نقاط الفريق</small></div>
 <div class="person"><b>مرحلة ${state.level} / ${MAX_LEVEL}</b><small>${Math.round(state.elapsed)} ثانية</small></div></div>
 <div class="buttons">${state.phase==="paused"?`<button class="mainbtn" id="resume">▶️ كمّلوا المهمة</button>`:
 `<button class="mainbtn" id="next">${win?"🚀 المهمة التالية":"🔄 إعادة المحاولة"}</button>`}
 <button class="mainbtn ghost" id="back">القائمة الرئيسية</button></div>`);
 if($("next")){$("next").onclick=()=>isHost?startNext():bubble("المضيف يبدأ المهمة من موبايله");if(!isHost)$("next").disabled=true;}
 if($("resume")){$("resume").onclick=()=>{if(!isHost)return;state.phase=state.lastPhase||"fight";gameplayRender();broadcast();};if(!isHost)$("resume").disabled=true;}
 $("back").onclick=menu;
}
function doPause(){
 if(!state||!isHost||mode!=="playing")return;
 state.lastPhase=state.phase;state.phase="paused";showResult();if(connected)broadcast();
}
function updateHUD(){
 if(!state)return;
 $("wave").textContent="مهمة "+state.level+" | قطاع "+(state.sector+1)+"/3";
 $("score").textContent="✦ "+friendly(state.score);
 const hp=[0,1].map(i=>Math.max(0,Math.round(state.players[i].hp)));
 for(let i=0;i<2;i++){$("hp"+i).style.width=hp[i]+"%";$("hp"+i+"t").textContent=hp[i];}
 const boss=state.enemies.find(e=>e.type==="boss");
 $("bossHealth").style.display=boss?"block":"none";
 if(boss){$("boss").style.width=Math.max(0,boss.hp/boss.maxHp*100)+"%";$("bosst").textContent=Math.round(boss.hp/boss.maxHp*100)+"%";}
 const description=state.phase==="gate"?"🚪 بوابة مفتوحة! اتجمعوا عليها":
   state.boss?"👑 واجهوا الزعيم واحموا بعض!":"⚔️ اقضوا على الروبوتات وافتحوا البوابة";
 $("objective").textContent=description;
 $("statusline").textContent=state.phase==="gate"?"قفوا مع بعض عند البوابة المتوهجة":`عدد الروبوتات: ${state.enemies.length} | موجة الطاقة ✦`;
 $("interact").textContent="✦ "+Math.round(state.players[role]?.energy||0)+"%";
}
function eventsUI(events){
 for(const e of events){
  if(e.kind==="enemy-dead")playSound("kill");
  if(e.kind==="hero-hit"){playSound("hit");vibrate();}
  if(e.kind==="dash")playSound("dash");
  if(e.kind==="gate-open"){bubble("🔓 البوابة اتفتحت! اتجمعوا عليها");playSound("gate");}
  if(e.kind==="sector-cleared"){bubble("✨ قطاع اتحرر! التحدي اللي بعده أصعب");playSound("gate");}
  if(e.kind==="revive"){bubble("❤️ شريكك رجع للمعركة");playSound("gate");}
  if(e.kind==="victory"){
    bubble("🏆 كسبتوا المهمة!",4000);playSound("win");
    saveLevel(Math.min(MAX_LEVEL,state.level+1));
  }
  if(e.kind==="boss-attack")playSound("boss");
  if(e.kind==="pulse"){bubble("✦ موجة طاقة! "+e.hits+" هدف");playSound("gate");vibrate();}
  if(e.kind==="defeat")playSound("hit");
 }
}
function broadcast(){
 if(!connected||!isHost||!state)return;
 try{window.Native?.send?.(JSON.stringify({t:"state",s:keyframe(state)}));}catch(e){}
}
function sendInput(){
 if(!connected||isHost||mode!=="playing")return;
 const i=input[1];try{window.Native?.send?.(JSON.stringify({t:"input",x:i.x,z:i.z,fire:i.fire,dash:i.dash,special:i.special}));}catch(e){}
}
window.onNative=(type,detail)=>{
 if(type==="ready"){
  if(pending==="host"){pending="";bridge("host");}
  if(pending==="paired"){pending="";bridge("paired");}
 }else if(type==="waiting"){waitScreen(detail);}
 else if(type==="error")error(detail);
 else if(type==="paired"){try{devices=JSON.parse(detail);}catch(e){devices=[];}devicesScreen();}
 else if(type==="connected")connectedRoom(detail);
 else if(type==="disconnected"){connected=false;error(detail);}
 else if(type==="message"){
  let m;try{m=JSON.parse(detail);}catch(e){return;}
  if(m.t==="input"&&isHost&&connected){
   const i=input[1];
   i.x=Math.min(1,Math.max(-1,Number(m.x)||0));
   i.z=Math.min(1,Math.max(-1,Number(m.z)||0));
   i.fire=!!m.fire;i.dash=Number(m.dash)||0;i.special=Number(m.special)||0;
  }
  if(m.t==="state"&&!isHost&&connected){
   const old=state?.phase;
   state=m.s;
   if(state.phase==="victory"||state.phase==="defeat"||state.phase==="paused")showResult();
   else if(mode!=="playing")gameplayRender();
   if(old!==state.phase&&state.phase==="gate")bubble("🔓 افتحوا البوابة مع بعض!");
  }
 }
};
function releaseJoystick(){
 pointerId=null;$("knob").style.transform="translate(0px,0px)";
 if(input[role]){input[role].x=0;input[role].z=0;}
}
const stick=$("joystick");
function moveStick(e){
 const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,len=Math.hypot(dx,dy);
 const scale=len>max?max/len:1;
 const xx=dx*scale,yy=dy*scale;
 $("knob").style.transform=`translate(${xx}px,${yy}px)`;
 const control=input[role];control.x=xx/max;control.z=yy/max;
}
stick.addEventListener("pointerdown",e=>{
 e.preventDefault();
 if(mode!=="playing")return;
 pointerId=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);
});
stick.addEventListener("pointermove",e=>{if(e.pointerId===pointerId)moveStick(e);});
stick.addEventListener("pointerup",e=>{if(e.pointerId===pointerId)releaseJoystick();});
stick.addEventListener("pointercancel",releaseJoystick);
$("attack").addEventListener("pointerdown",e=>{
 e.preventDefault();if(mode!=="playing")return;
 $("attack").setPointerCapture(e.pointerId);pressedFire.add(e.pointerId);input[role].fire=true;
});
for(let t of ["pointerup","pointercancel"])$("attack").addEventListener(t,e=>{
 pressedFire.delete(e.pointerId);input[role].fire=pressedFire.size>0;
});
$("dash").addEventListener("pointerdown",e=>{e.preventDefault();if(mode==="playing")input[role].dash++;});
$("interact").addEventListener("pointerdown",e=>{e.preventDefault();if(mode==="playing")input[role].special++;});
$("pauseBtn").onclick=doPause;
document.addEventListener("keydown",e=>{
 if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(mode!=="playing")return;
 if(["ShiftLeft","ShiftRight"].includes(e.code)&&!e.repeat)input[role].dash++;
 if(e.code==="KeyE"&&!e.repeat)input[role].special++;
 if(e.code==="Escape"&&!e.repeat)doPause();
});
document.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>{
 keys.clear();pressedFire.clear();releaseJoystick();input[role].fire=false;
});
window.addEventListener("resize",()=>view.resize());
function keyboard(dt){
 if(mode!=="playing"||pointerId!==null)return;
 const up=keys.has("KeyW")||keys.has("ArrowUp"),down=keys.has("KeyS")||keys.has("ArrowDown");
 const left=keys.has("KeyA")||keys.has("ArrowLeft"),right=keys.has("KeyD")||keys.has("ArrowRight");
 const x=Number(right)-Number(left),z=Number(down)-Number(up);
 const len=Math.hypot(x,z);
 input[role].x=len?x/len:0;input[role].z=len?z/len:0;
 input[role].fire=pressedFire.size>0||keys.has("Space");
}
function loop(now){
 let dt=Math.max(.001,Math.min((now-clockTime)/1000,.045));
 clockTime=now;
 keyboard(dt);
 let events=[];
 if(mode==="playing"&&state){
  if(isHost){
   events=tick(state,input,dt);eventsUI(events);
   if(state.phase==="victory"||state.phase==="defeat")showResult();
   netTimer+=dt;
   if(connected&&netTimer>.12){netTimer=0;broadcast();}
  }else{
   sendTimer+=dt;if(sendTimer>.075){sendTimer=0;sendInput();}
  }
  updateHUD();
 }
 view.draw(state,dt,events,role);
 if(toastUntil&&now>toastUntil){toast.classList.remove("show");toastUntil=0;}
 requestAnimationFrame(loop);
}
window.__NV_TEST={
 get ready(){return ready;},get mode(){return mode;},
 get state(){return state;},
 startSolo(level=1){startSolo(level);},
 tickFor(seconds=1){const n=Math.floor(seconds*30);for(let i=0;i<n;i++)if(state)tick(state,input,1/30);},
 setInput(x,z,fire=false){input[role].x=x;input[role].z=z;input[role].fire=fire;},
 forceGate(){if(!state)return;state.enemies.length=0;state.phase="gate";state.players[0].x=0;state.players[1].x=0;state.players.forEach(p=>p.z=state.gateZ);},
};
view.ready.then(()=>{
 ready=true;loading.style.display="none";menu();
}).catch(err=>{
 loading.textContent="تعذر تحميل نماذج الشخصيات";
 console.error(err);error("فشل تحميل شخصيات 3D: "+err.message);
});
requestAnimationFrame(loop);
