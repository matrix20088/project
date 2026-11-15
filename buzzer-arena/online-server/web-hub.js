"use strict";
let mdUser=null,mdAuthTab="login",mdRooms=[],mdSearch="",mdStatus="",mdLoading=false,mdRoomTitle="";
window.mdRoomTitle="";
localStorage.setItem("buzzerVoice","off");voiceOn=false;soundOn=false;
const wEscape=s=>esc(s);
async function mdAPI(body){
 const r=await fetch("/api/web",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok)throw Error(j.error||"حصل خطأ، حاول مرة تانية");
 return j;
}
function mdAuthScreen(){
 return `<header class="web-header"><div class="web-brand">🧠 <span>من <b>دماغك</b></span></div><span class="web-chip">🌐 العب من أي مكان</span></header>
 <section class="web-welcome"><div class="web-graphic">🧠<span>؟</span></div><div class="web-eyebrow">أهلاً في التحدي</div>
 <h1>من <em>دماغك</em></h1><p>مفيش جرس. اختار إجابة من دماغك أو اطلب الاختيارات، وأول واحد يوصل ١٠ نقاط يكسب.</p></section>
 <section class="card web-auth">
 <div class="web-tabs" role="tablist">
 <button class="${mdAuthTab==="login"?"selected":""}" onclick="mdSetAuth('login')">دخول</button>
 <button class="${mdAuthTab==="register"?"selected":""}" onclick="mdSetAuth('register')">حساب جديد</button>
 <button class="${mdAuthTab==="guest"?"selected":""}" onclick="mdSetAuth('guest')">ضيف</button></div>
 ${mdAuthTab==="guest"?`<form onsubmit="mdSubmitAuth(event);return false"><label class="label" for="guestName">اسمك في اللعبة</label>
  <input class="field" id="guestName" name="guestName" maxlength="18" placeholder="مثلاً: بطل التحدي" required autocomplete="nickname"/>
  <p class="small web-note">الضيف يقدر يلعب من غير يوزر وباسورد.</p>
  <button class="btn" type="submit" ${mdLoading?"disabled":""}>🚀 ادخل كضيف</button></form>`:
 `<form onsubmit="mdSubmitAuth(event);return false">
 ${mdAuthTab==="register"?`<label class="label" for="newNick">اسمك الظاهر</label><input class="field" id="newNick" name="newNick" maxlength="18" placeholder="اسم المتسابق" required autocomplete="nickname"/>`:""}
 <label class="label" for="username">اسم المستخدم</label><input class="field" id="username" name="username" minlength="3" maxlength="24" required autocomplete="username" placeholder="عربي أو إنجليزي بدون مسافات"/>
 <label class="label" for="password">كلمة المرور</label><input class="field" id="password" name="password" type="password" minlength="8" maxlength="128" required autocomplete="${mdAuthTab==="register"?"new-password":"current-password"}" placeholder="8 أحرف على الأقل"/>
 <button class="btn" type="submit" ${mdLoading?"disabled":""}>${mdAuthTab==="login"?"🔐 تسجيل دخول":"✨ أنشئ حساب وابدأ"}</button></form>`}
 ${mdStatus?`<div class="web-error" role="status">${wEscape(mdStatus)}</div>`:""}</section>
 <p class="web-foot">بدون محادثات أو مكالمات صوتية • لعب مباشر بين ٢–٤ متسابقين</p>`;
}
function mdRoomCard(r){
 const filled=r.players>=r.target;
 return `<article class="web-room"><div><b>🎯 ${wEscape(r.title)}</b><small>👤 ${wEscape(r.host)} · ${r.players} من ${r.target} · ${r.phase==="lobby"?"في انتظار اللاعبين":"بدأت المواجهة"}</small></div>
 <button type="button" class="web-room-join" onclick="mdJoinRoom('${r.code}')" ${filled?"disabled":""}>انضم ↗</button></article>`;
}
function mdHubScreen(){
 const cats=[CAT_ALL,...CAT_KEYS.filter(c=>c!=="🔄 كلمة مقلوبة")];
 return `<header class="web-header"><div class="web-brand">🧠 <span>من <b>دماغك</b></span></div><div class="web-account"><span>${mdUser.guest?"👻 ضيف "+wEscape(mdUser.name):"👤 "+wEscape(mdUser.name)}</span><button onclick="mdLogout()">خروج</button></div></header>
 <div class="web-hero"><span class="web-eyebrow">جاهز للمنافسة؟</span><h1>الدور عليك... <em>والقرار قرارك!</em></h1><p>من دماغك: صح +٢، غلط −١ | الاختيارات: صح +١، غلط −٢. أوّل لاعب يوصل ١٠ يكسب.</p></div>
 <div class="web-sections">
 <section class="card web-create"><div class="kicker">🎮 جهّز التحدي</div><h2>أنشئ غرفة</h2>
 <label class="label" for="webTitle">اسم الغرفة</label><input id="webTitle" class="field" maxlength="40" placeholder="مثلاً: تحدي أبطال الجمعة" value="${wEscape(mdRoomTitle)}"/>
 <label class="label">عدد المتسابقين</label><div class="counts">${[2,3,4].map(n=>`<button type="button" class="count ${cfg.target===n?"selected":""}" onclick="mdTarget(${n})">${n}<span>لاعبين</span></button>`).join("")}</div>
 <label class="label" for="webCat">نوع الأسئلة</label><select class="field" id="webCat" onchange="chooseCategory(this.value)">${cats.map(v=>`<option ${cfg.category===v?"selected":""} value="${wEscape(v)}">${wEscape(v)}</option>`).join("")}</select>
 <label class="botToggle web-bot"><input id="webBot" type="checkbox" ${cfg.bot?"checked":""} onchange="mdSetBot(this.checked)"/><span><b>🤖 منافس كمبيوتر (اختياري)</b><small>بيشغل مقعد من عدد المتسابقين</small></span></label>
 <button class="btn" onclick="mdCreateRoom()">✨ أنشئ غرفة وابدأ</button></section>
 <section class="card web-discover"><div class="kicker">🌐 لوبي الغرف</div><h2>العب مع ناس تانية</h2>
 <p class="small">شوف الغرف المفتوحة، ابحث باسم الغرفة أو رقمها، وانضم للعب.</p>
 <div class="web-searchbar"><input class="field" id="roomSearch" placeholder="رقم الغرفة أو اسمها" value="${wEscape(mdSearch)}" oninput="mdSearch=this.value"/><button onclick="mdRefreshRooms()">بحث</button></div>
 <div class="web-rooms" id="webRooms">${mdRooms.length?mdRooms.map(mdRoomCard).join(""):'<div class="web-empty">مفيش غرف متاحة حاليًا. أنشئ أول غرفة وادعُ اللاعبين!</div>'}</div>
 <button class="btn ghost web-refresh" onclick="mdRefreshRooms()">🔄 تحديث الغرف</button>
 <div class="web-code"><label class="label" for="roomNumber">معاك رقم غرفة؟</label><div><input id="roomNumber" class="field" inputmode="numeric" maxlength="6" placeholder="123456"/><button onclick="mdJoinCode()">انضم</button></div></div>
 </section></div>
 ${mdStatus?`<div class="web-error" role="status">${wEscape(mdStatus)}</div>`:""}
 <p class="web-foot">👥 ٢–٤ لاعبين · 🔇 بدون دردشة أو صوت · 🏆 أول ١٠ نقاط يفوز</p>`;
}
function renderHome(){
 root.innerHTML=mdUser?mdHubScreen():mdAuthScreen();
 if(mdUser)void mdRefreshRooms(true);
}
window.mdSetAuth=function(tab){mdAuthTab=tab;mdStatus="";renderHome();};
window.mdSubmitAuth=async function(e){
 e?.preventDefault?.();if(mdLoading)return false;
 const data=new FormData(e.target),action=mdAuthTab==="register"?"register":mdAuthTab==="guest"?"guest":"login";
 mdLoading=true;mdStatus="";
 try{
  const payload=action==="guest"?{action,name:String(data.get("guestName")||"")}:
   {action,username:String(data.get("username")||""),password:String(data.get("password")||""),name:String(data.get("newNick")||"")};
  const r=await mdAPI(payload);mdUser=r.user;cfg.name=mdUser.name;saveName(cfg.name);mdStatus="";renderHome();
 }catch(err){mdStatus=err.message;renderHome();}finally{mdLoading=false;}
 return false;
};
window.mdLogout=async function(){
 try{if(online)backToMenu();await mdAPI({action:"logout"});}catch(e){}
 mdUser=null;mdRooms=[];mdStatus="";renderHome();
};
window.mdTarget=function(n){cfg.target=n;mdRoomTitle=document.getElementById("webTitle")?.value||mdRoomTitle;renderHome();};
window.mdSetBot=function(v){cfg.bot=!!v;mdRoomTitle=document.getElementById("webTitle")?.value||mdRoomTitle;renderHome();};
window.mdCreateRoom=function(){
 if(!mdUser)return;
 mdRoomTitle=(document.getElementById("webTitle")?.value||"").trim().slice(0,40)||"غرفة "+mdUser.name;
 window.mdRoomTitle=mdRoomTitle;cfg.name=mdUser.name;roomMode="online";onlineRoomCode="";
 Native.onlineCreate(cfg.target,cfg.bot);
};
window.mdJoinRoom=function(code){
 if(!mdUser)return;
 if(!/^[1-9][0-9]{5}$/.test(String(code)))return;
 cfg.name=mdUser.name;roomMode="online";onlineRoomCode=String(code);Native.onlineJoin(code);
};
window.mdJoinCode=function(){
 const code=String(document.getElementById("roomNumber")?.value||"").trim();
 if(!/^[1-9][0-9]{5}$/.test(code)){mdStatus="رقم الغرفة لازم يكون 6 أرقام";renderHome();return;}
 mdJoinRoom(code);
};
window.mdRefreshRooms=async function(silent=false){
 if(!mdUser||online||state)return;
 const val=document.getElementById("roomSearch")?.value;
 if(typeof val==="string")mdSearch=val.trim().slice(0,40);
 try{
  const r=await fetch("/api/web?action=rooms&search="+encodeURIComponent(mdSearch),{cache:"no-store",credentials:"same-origin"});
  const data=await r.json();if(!r.ok)throw Error(data.error||"تعذر عرض الغرف");
  mdRooms=data.rooms||[];
  const node=document.getElementById("webRooms");
  if(node)node.innerHTML=mdRooms.length?mdRooms.map(mdRoomCard).join(""):'<div class="web-empty">مفيش غرف متاحة حاليًا. تقدر تنشئ غرفة جديدة.</div>';
 }catch(e){if(!silent){mdStatus=e.message;const node=document.getElementById("webRooms");if(node)node.textContent="تعذر تحديث الغرف، حاول مرة أخرى";}}
};
nav=function(){
 return `<div class="nav web-game-nav"><div class="navbrand"><span class="logo">🧠</span><span>من <span style="color:var(--yellow)">دماغك</span></span></div>
 <button class="web-exit" onclick="backToMenu()">اللوبي ⌂</button></div>`;
};
const oldShowError=showError;
showError=function(message){mdStatus=String(message||"حصل خطأ");oldShowError(message);};
async function boot(){
 try{const r=await fetch("/api/web?action=me",{cache:"no-store",credentials:"same-origin"});const d=await r.json();
  if(d.user){mdUser=d.user;cfg.name=mdUser.name;saveName(cfg.name);}
 }catch(e){console.warn("session",e.message);}
 renderHome();
}
renderHome();void boot();
setInterval(()=>{if(mdUser&&!online&&!state&&document.visibilityState==="visible")void mdRefreshRooms(true);},15000);