function nav(){return `<div class="nav"><div class="navbrand"><span class="logo">🔔</span><span>جرس <span style="color:var(--yellow)">التحدي</span></span></div><div class="pill">٢–٤ لاعبين • الحكم الإلكتروني</div></div>`;}
function renderHome(){
 const cats=[CAT_ALL,...CAT_KEYS];
 root.innerHTML=nav()+`<section class="hero"><div class="badgeHero">🔔</div><div class="kicker">من الأسرع على الجرس؟</div><h1>اللي هيسبق <em>هيكسب!</em></h1><p class="desc">أسئلة ومنافسة وضحك ونقاط... وحكم إلكتروني يحسم كل جولة.<br>إنتوا المتسابقين، مفيش كمبيوتر بيلعب ضدكم!</p></section>
 <section class="card">
 <div class="kicker">جهزوا حلقة التحدي</div>
 <label class="label" for="nickname">اسمك في البرنامج</label><input id="nickname" class="field" maxlength="18" value="${esc(cfg.name)}" oninput="saveName(this.value)" placeholder="اسم المتسابق">
 <label class="label">عدد المتسابقين الحقيقيين</label><div class="counts">${[2,3,4].map(n=>`<button class="count ${cfg.target===n?"selected":""}" onclick="chooseTarget(${n})">${n}<span>لاعبين</span></button>`).join("")}</div>
 <label class="label" for="category">نوع الأسئلة</label><select class="field" id="category" onchange="chooseCategory(this.value)">${cats.map(v=>`<option value="${esc(v)}" ${cfg.category===v?"selected":""}>${esc(v)}</option>`).join("")}</select>
 <div class="voicecfg"><span>🎙️ <b>صوت الحكم</b><small>تعليق عربي حماسي حسب الأصوات الموجودة في موبايلك</small></span>
 <button class="voiceSwitch" onclick="toggleVoice()">${voiceOn?"🔊 شغّال":"🔇 صامت"}</button></div>
 <button class="btn ghost" onclick="previewVoice()">🔈 جرّب صوت الحكم</button>
 <button class="btn" onclick="openRoom()">🎙️ أنشئ غرفة وأنا أول لاعب</button>
 <button class="btn secondary" onclick="findRoom()">📱 انضم لغرفة لاعب تاني</button>
 <button class="btn ghost" onclick="renderHow()">🎮 طريقة اللعب</button>
 </section><p class="foot">🔒 اللعب محلي عبر البلوتوث • موبايل لكل لاعب • لحد ٤ أشخاص • من غير إنترنت أو حسابات</p>`;
}
function renderHow(){
 root.innerHTML=nav()+`<section class="card"><h2>🎤 نظام الحكم والجرس</h2><p class="desc">الحكم الإلكتروني يعلن الفئة والسؤال. بعد ما ينتهي العدّ التمهيدي، الجرس يفتح للكل.</p>
 <p class="desc">🔔 أول رسالة ضغط توصل لموبايل صاحب الغرفة هي اللي تكسب الجرس. الجرس بيتقفل على الباقيين.</p>
 <p class="desc">🧠 المتسابق الأسرع قدامه ٤ اختيارات و١٢ ثانية للإجابة. إجابة صح +١، غلط أو انتهاء وقت الإجابة −١.</p>
 <p class="desc">🏆 أول شخص يوصل ١٠ نقاط يفوز، والحكم يعلن اسمه تلقائيًا. صوت الحكم مش تقليد لشخص بعينه؛ هو صوت عربي آلي حسب محرك الكلام المثبت على جهازك.</p>
 <p class="desc">📱 اعملوا اقتران Bluetooth بين الموبايلات الأول. صاحب الغرفة يختار ٢ أو ٣ أو ٤، وكل واحد تاني ينضم من موبايله.</p>
 <p class="small">ملحوظة الإنصاف: ترتيب وصول الضغطات عبر البلوتوث هو معيار الحكم. ممكن يحصل فارق اتصال بسيط بين الأجهزة؛ ده نظام للعب المنزلي مش بطولة احترافية.</p>
 <button class="btn" onclick="renderHome()">جاهزين للمواجهة! ⚡</button></section>`;
}
function showWaiting(message){
 root.innerHTML=nav()+`<div class="card center"><div class="spin"></div><h2>بنجهز الغرفة</h2><p class="desc">${esc(message)}</p><button class="btn ghost" onclick="backToMenu()">رجوع</button></div>`;
}
function showError(message){
 root.innerHTML=nav()+`<div class="card center"><div class="resultIcon">⚠️</div><h2>في مشكلة في الاتصال</h2><p class="desc">${esc(message)}</p><button class="btn ghost" onclick="native('settings')">⚙️ إعدادات البلوتوث</button><button class="btn" onclick="backToMenu()">الصفحة الرئيسية</button></div>`;
}
function showDevices(){
 root.innerHTML=nav()+`<section class="card"><h2>📱 موبايل صاحب الغرفة</h2><p class="desc">اختار الجهاز اللي فتح الغرفة، بعد ما تعملوا Pair مرة واحدة من إعدادات البلوتوث.</p>
 ${devices.length?devices.map((d,i)=>`<button class="device" onclick="connectTo(${i})"><b>📲 ${esc(d.name)}</b><small>${esc(d.addr)}</small></button>`).join(""):`<p class="notice">مفيش موبايلات مقترنة. افتح إعدادات البلوتوث واقرن الأجهزة أولًا.</p>`}
 <button class="btn secondary" onclick="native('paired')">🔄 تحديث القائمة</button>
 <button class="btn ghost" onclick="native('settings')">⚙️ افتح إعدادات البلوتوث</button>
 <button class="btn ghost" onclick="backToMenu()">رجوع</button></section>`;
}
function renderPlayers(lobby=false){
 if(!state)return "";
 return `<div class="${lobby?"playerlist":"scores"}">`+
  Array.from({length:state.target},(_,i)=>{
   const p=state.players.find(p=>p.seat===i);
   if(!p)return lobby?`<div class="player"><div class="avatar">➕</div><span class="name">مكان فاضي</span><small>مستني لاعب ${i+1}</small></div>`:"";
   if(lobby)return `<div class="player ${p.online?"online":""}"><span class="avatar">${ICONS[i]}</span><span class="name">${esc(p.name)}</span><small>${p.online?"✅ متصل":"🔌 خارج الغرفة"} ${i===0?"• صاحب الغرفة":""}</small></div>`;
   return `<div class="scorecard"><span>${ICONS[i]} ${esc(p.name)}</span><b>${p.score}</b></div>`;
  }).join("")+"</div>";
}
function renderLobby(){
 const ready=allReady();
 root.innerHTML=nav()+`<div class="banner">🎤 استوديو جرس التحدي • ${state.target} متسابقين</div>
 <div class="judge"><div class="face">👨‍⚖️</div><div><strong>الحَكَم جاهز!</strong><p>الهدف ١٠ نقاط، الصح +١ والغلط −١</p></div></div>
 <section class="card"><h2>المتسابقين داخلين الاستوديو</h2><p class="desc">${playersConnected()} من ${state.target} متصلين • الفئة: ${esc(state.category)}</p>${renderPlayers(true)}
 ${host?`<button class="btn" ${ready?"":"disabled"} onclick="startMatch()">🚀 ابدأوا الحلقة!</button>`:`<div class="notice">${ready?"✅ الكل متصل، مستنيين صاحب الغرفة يبدأ":"⏳ مستنيين باقي اللاعبين..."}</div>`}
 <button class="btn ghost" onclick="backToMenu()">خروج من الغرفة</button></section>`;
}
function timeHeader(){
 const phase=state.phase;
 const max=phase==="announce"?ANNOUNCE_SEC:phase==="question"?QUIZ_SEC:phase==="answer"?ANSWER_SEC:RESULT_SEC;
 return `<div class="timerrow"><div><span class="kicker">الجولة ${state.round} • ${esc(state.question?.cat||"")}</span><div class="small">أول واحد يوصل ${WIN_AT} نقاط يكسب</div></div><div id="timer" class="timer ${state.remaining<=5?"danger":""}">${format(state.remaining)}ث</div></div>
 <div class="bar"><div id="timefill" style="width:${Math.round(state.remaining/max*100)}%"></div></div>`;
}
function updateTimerUI(){
 if(!state)return;
 const el=document.getElementById("timer"),fill=document.getElementById("timefill");
 if(el){el.textContent=format(state.remaining)+"ث";el.classList.toggle("danger",state.remaining<=5);}
 if(fill){
  const max=state.phase==="announce"?ANNOUNCE_SEC:state.phase==="question"?QUIZ_SEC:state.phase==="answer"?ANSWER_SEC:RESULT_SEC;
  fill.style.width=Math.round(state.remaining/max*100)+"%";
 }
}
function renderQuestion(){
 const phase=state.phase,locked=state.players.find(p=>p.seat===state.lockedSeat);
 let body=nav()+renderPlayers()+timeHeader()+
 `<div class="banner">${phase==="announce"?"🎙️ الحكم بيقرأ السؤال":phase==="question"?"🔔 الجرس مفتوح للجميع":"🧠 وقت إجابة أسرع متسابق"}</div>
 <section class="card"><div class="kicker">${esc(state.question?.cat)}</div><div class="question">${esc(state.question?.q)}</div></section>`;
 if(phase==="announce"){
   body+=`<div class="judge"><div class="face">🎙️</div><div><strong>استعدوا للجرس</strong><p>استنوا لما الحكم يقول الجرس مفتوح</p></div></div>`;
   if(host)body+=`<p class="small center">الحكم هيفتح الجرس بعد ما يخلص قراءة السؤال. 🔊</p>`;
 }else if(phase==="question"){
   body+=`<div class="buzzerWrap"><button id="thebuzzer" class="buzzer" onclick="pressBuzzer()" ${online&&seat!==null?"":"disabled"}>🔔<small>اضغط!</small></button><p class="desc">أول ضغط يوصل للحكم بياخد حق الإجابة</p></div>`;
 }else{
   body+=`<div class="judge"><div class="face">${ICONS[state.lockedSeat]||"🔔"}</div><div><strong>${esc(locked?.name||"المتسابق")}</strong><p>هو الأسرع على الجرس، والكل مستني إجابته</p></div></div>`;
   if(seat===state.lockedSeat){
    body+=`<section class="card"><div class="kicker">اختار إجابة واحدة</div><div class="options">${state.question.options.map((opt,i)=>`<button class="option" onclick="selectOption(${i})"><i>${["A","B","C","D"][i]}</i><span>${esc(opt)}</span></button>`).join("")}</div></section>`;
   }else body+=`<div class="notice">⏳ الجرس مع ${esc(locked?.name)}، استنوا قرار الحكم</div>`;
 }
 return body;
}
function renderResult(){
 const r=state.result,icon=r?.seat<0?"⏰":r?.ok?"✅":"❌";
 return nav()+renderPlayers()+timeHeader()+
 `<div class="card center"><div class="resultIcon">${icon}</div><h2>${r?.seat<0?"محدش ضغط الجرس":r?.ok?"إجابة صح!":"الإجابة غلط!"}</h2>
 <p class="desc">${esc(state.msg)}</p><div class="delta">${r?.delta>0?"+1":r?.delta<0?"−1":"0"}</div>
 <div class="notice ok"><b>الإجابة الصحيحة:</b> ${esc(r?.correct||"—")}</div>
 ${r?.chosen?`<p class="small">الإجابة المختارة: ${esc(r.chosen)}</p>`:""}
 ${host?`<button class="btn" onclick="advanceRound()">➡️ السؤال اللي بعده</button>`:`<p class="small">الحكم بينتقل للسؤال اللي بعده...</p>`}</div>`;
}
function renderFinished(){
 const winner=state.players.find(p=>p.seat===state.winner);
 return nav()+`<section class="hero"><div class="badgeHero">🏆</div><div class="kicker">انتهت الحلقة</div><h1>البطل هو <em>${esc(winner?.name||"المتسابق")}</em>!</h1><p class="desc">وصل لـ ${WIN_AT} نقاط قبل الجميع!</p></section>
 <section class="card"><h2>🏅 النتيجة النهائية</h2>${state.players.slice().sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="scorecard ${p.seat===state.winner?"leader":""}" style="margin:10px 0"><span>${["🥇","🥈","🥉","⭐"][i]} ${esc(p.name)}</span><b>${p.score}</b></div>`).join("")}
 ${host?`<button class="btn" onclick="resetToLobby()">🔄 حلقة جديدة بنفس المتسابقين</button>`:`<p class="desc">استنوا صاحب الغرفة يبدأ حلقة جديدة.</p>`}
 <button class="btn ghost" onclick="backToMenu()">الرئيسية</button></section>`;
}
function renderGame(){
 if(!state){renderHome();return;}
 const p=state.phase;
 if(p==="lobby"){renderLobby();return;}
 if(p==="paused"){
  root.innerHTML=nav()+`<section class="card center"><div class="resultIcon">🔌</div><h2>توقف الاتصال</h2><p class="desc">${esc(state.msg)}</p>${host?`<button class="btn" onclick="resetToLobby()">رجوع للغرفة</button>`:""}<button class="btn ghost" onclick="backToMenu()">الرئيسية</button></section>`;
  return;
 }
 if(p==="announce"||p==="question"||p==="answer"){root.innerHTML=renderQuestion();return;}
 if(p==="result"){root.innerHTML=renderResult();return;}
 if(p==="finished"){root.innerHTML=renderFinished();return;}
 renderHome();
}
renderHome();
