function nav(){return `<div class="nav"><div class="navbrand"><span class="logo">🔔</span><span>جرس <span style="color:var(--yellow)">التحدي</span></span></div><div class="pill">٢–٤ لاعبين • الحكم الإلكتروني</div></div>`;}
function renderHome(){
 const cats=[CAT_ALL,...CAT_KEYS];
 root.innerHTML=nav()+`<section class="hero"><div class="badgeHero">🔔</div><div class="kicker">من الأسرع على الجرس؟</div><h1>اللي هيسبق <em>هيكسب!</em></h1><p class="desc">أسئلة ومنافسة وضحك ونقاط... وحكم إلكتروني <b>بيتكلم بصوت عربي</b> وبيحسم كل جولة.<br>إنتوا المتسابقين، مفيش كمبيوتر بيلعب ضدكم!</p><div class="questionCount">🎲 ${TOTAL_QUESTIONS} سؤال في ${CAT_KEYS.length} فئة متنوعة</div></section>
 <section class="card">
 <div class="kicker">جهزوا حلقة التحدي</div>
 <label class="label" for="nickname">اسمك في البرنامج</label><input id="nickname" class="field" maxlength="18" value="${esc(cfg.name)}" oninput="saveName(this.value)" placeholder="اسم المتسابق">
 <label class="label">عدد المتسابقين الحقيقيين</label><div class="counts">${[2,3,4].map(n=>`<button class="count ${cfg.target===n?"selected":""}" onclick="chooseTarget(${n})">${n}<span>لاعبين</span></button>`).join("")}</div>
 <label class="label" for="category">نوع الأسئلة</label><select class="field" id="category" onchange="chooseCategory(this.value)">${cats.map(v=>`<option value="${esc(v)}" ${cfg.category===v?"selected":""}>${esc(v)}</option>`).join("")}</select>
 <button class="btn" onclick="openRoom()">🎙️ أنشئ غرفة وأنا أول لاعب</button>
 <button class="btn secondary" onclick="findRoom()">📱 انضم لغرفة لاعب تاني</button>
 <div class="voiceSettings"><div><strong>🎙️ صوت الحكم</strong><small>بيتكلم من موبايل صاحب الغرفة</small></div><button class="voiceToggle" onclick="toggleVoice()">${voiceOn?"🔊 شغّال":"🔇 مقفول"}</button></div>
 <button class="btn ghost" onclick="previewVoice()">🔊 جرّب صوت الحكم على الموبايل</button>
 ${!voiceAvailable?'<p class="notice bad">الصوت العربي مش متاح على موبايلك حاليًا. فعّل محرك تحويل النص العربي لكلام من إعدادات الهاتف، وهتفضل اللعبة شغالة بدونه.</p>':""}
 <button class="btn ghost" onclick="renderHow()">🎮 طريقة اللعب</button>
 </section><p class="foot">🔒 اللعب محلي عبر البلوتوث • موبايل لكل لاعب • لحد ٤ أشخاص • من غير إنترنت أو حسابات</p>`;
}
function renderHow(){
 root.innerHTML=nav()+`<section class="card"><h2>🎤 نظام الحكم والجرس</h2><p class="desc">الحكم الإلكتروني يعلن الفئة والسؤال بصوت مصري مُركّب من محرك النطق بالعربي (حسب الأصوات المثبتة)، وبعد ما يخلص الكلام الجرس يفتح للكل.</p>
 <p class="desc">🎙️ الحكم يخلص قراءة السؤال، وبعدها الأربع اختيارات تظهر واحد واحد قدام <b>كل اللاعبين</b>. بعد ظهور الاختيار الرابع، الجرس يظهر فجأة خلال 10 ثواني من غير عدّ تنازلي.</p>
 <p class="desc">🔄 الكلمات المقلوبة صوت فقط: الحكم يتهجّاها حرف حرف ببطء؛ الكلمة وحروفها مش هتظهر قبل الإجابة. الفئة دي بتحتاج نطق عربي شغّال.</p>
 <p class="desc">🔔 أول رسالة ضغط توصل لموبايل صاحب الغرفة هي اللي تكسب الجرس. الجرس بيتقفل على الباقيين.</p>
 <p class="desc">⚡ اللي يضغط في أول ثانيتين من ظهور الجرس قدامه 6 ثواني للإجابة؛ الصح +1 والغلط أو السكوت −2. اللي يدوس بعد كده قدامه 12 ثانية؛ الصح +1 والغلط أو السكوت −1.</p>
 <p class="desc">🔄 لو الإجابة غلط أو الوقت خلص، الجرس يفتح تاني لنفس السؤال، وحتى نفس اللاعب يقدر يجرب تاني. بعد اختيارين مختلفين غلط، السؤال يتقفل.</p>
 <p class="desc">🎯 الصعوبة حسب أعلى سكور: من 0 إلى 2 سهل، من 3 إلى 5 متوسط، ومن 6 نقاط صعب.</p>
 <p class="desc">👀 الاختيارات بتظهر عند كل اللاعبين بمجرد ما حد يكسب الجرس؛ الإجابة لصاحب الجرس فقط.</p>
 <p class="desc">⏭️ صاحب الغرفة يقدر يتخطى السؤال، والضيوف يقدروا يطلبوا التخطي.</p>
 <p class="desc">🔔 عند قبول الضغط على الجرس بتتسمع رنّة جرس على أجهزة المتسابقين.</p>
 <p class="desc">🏆 أول شخص يوصل ١٠ نقاط يفوز، والحكم يعلن اسمه تلقائيًا.</p>
 <p class="desc">📱 اعملوا اقتران Bluetooth بين الموبايلات الأول. صاحب الغرفة يختار ٢ أو ٣ أو ٤، وكل واحد تاني ينضم من موبايله.</p>
 <p class="small">ملحوظة الإنصاف: ترتيب وصول الضغطات عبر البلوتوث هو معيار الحكم. ممكن يحصل فارق اتصال بسيط بين الأجهزة؛ ده نظام للعب المنزلي مش بطولة احترافية.</p>
 <p class="small">الصوت صوت اصطناعي للمذيع الخاص باللعبة، مش استنساخ لصوت شخص حقيقي. علشان تسمعه، اتأكد إن تحويل النص إلى كلام بالعربي شغّال على جهاز صاحب الغرفة.</p>
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
 <div class="judge"><div class="face">🎙️</div><div><strong>الحَكَم جاهز ويتكلم!</strong><p>الصح +١ والغلط −١ أو −٢ حسب سرعة الخطف</p></div></div>
 <section class="card"><h2>المتسابقين داخلين الاستوديو</h2><p class="desc">${playersConnected()} من ${state.target} متصلين • الفئة: ${esc(state.category)}</p>${renderPlayers(true)}
 ${host?`<button class="btn" ${ready?"":"disabled"} onclick="startMatch()">🚀 ابدأوا الحلقة!</button>`:`<div class="notice">${ready?"✅ الكل متصل، مستنيين صاحب الغرفة يبدأ":"⏳ مستنيين باقي اللاعبين..."}</div>`}
 <button class="btn ghost" onclick="backToMenu()">خروج من الغرفة</button></section>`;
}
function timeHeader(){
 const phase=state.phase;
 const max=phase==="question"?QUIZ_SEC:phase==="answer"?(state.answerWindowSec||ANSWER_SEC):RESULT_SEC;
 const common=`<div><span class="kicker">الجولة ${state.round} • ${esc(state.question?.cat||"")}</span><div class="small">أول واحد يوصل ${WIN_AT} نقاط يكسب</div></div>`;
 if(phase==="announce")return `<div class="timerrow">${common}<div class="timer secretTimer">❔</div></div>`;
 return `<div class="timerrow">${common}<div id="timer" class="timer ${state.remaining<=5?"danger":""}">${format(state.remaining)}ث</div></div>
 <div class="bar"><div id="timefill" style="width:${Math.round(state.remaining/max*100)}%"></div></div>`;
}
function updateTimerUI(){
 if(!state)return;
 const el=document.getElementById("timer"),fill=document.getElementById("timefill");
 if(el){el.textContent=format(state.remaining)+"ث";el.classList.toggle("danger",state.remaining<=5);}
 if(fill){
  const max=state.phase==="question"?QUIZ_SEC:state.phase==="answer"?(state.answerWindowSec||ANSWER_SEC):RESULT_SEC;
  fill.style.width=Math.round(state.remaining/max*100)+"%";
 }
}
function optionGrid(clickable=false){
 if(!state?.question?.options)return "";
 const count=state.optionsShownCount??(state.optionsShown?4:0);
 if(count<=0)return "";
 const wrong=state.wrongChoices||[],canClick=clickable&&seat===state.lockedSeat&&state.phase==="answer";
 return '<section class="card choicesCard"><div class="kicker">'+(canClick?"اختار إجابتك":count<4?"👀 الخيارات بتظهر واحد واحد عند الكل":"👀 الإجابات ظاهرة للكل، لكن صاحب الجرس وحده يختار")+'</div><div class="options">'+state.question.options.map((opt,i)=>{
   if(i>=count)return '<div class="option optionPending" aria-label="الاختيار لم يظهر بعد"><i>'+["A","B","C","D"][i]+'</i><span>••••••••</span></div>';
   const mistaken=wrong.includes(i),cls=mistaken?"option wrong":canClick?"option selectChoice":"option spectator";
   return '<button class="'+cls+'" '+(canClick&&!mistaken?'onclick="selectOption('+i+')"':"disabled")+'><i>'+["A","B","C","D"][i]+'</i><span>'+esc(opt)+'</span>'+(mistaken?'<b class="wrongmark">❌ غلط</b>':"")+'</button>';
 }).join("")+'</div></section>';
}
function skipControls(){
 if(!["announce","question","answer","result"].includes(state?.phase))return "";
 const requests=state.skipRequests?.length||0;
 return '<div class="skipline">'+(host?
 '<button class="skipButton" onclick="skipQuestion()">⏭️ تخطي السؤال</button>':
 '<button class="skipButton" onclick="requestSkip()">✋ طلب تخطي السؤال</button>')+
 (host&&requests?'<span class="skipCount">📬 طلبات التخطي: '+requests+'</span>':"")+'</div>';
}
function renderQuestion(){
 const phase=state.phase,locked=state.players.find(p=>p.seat===state.lockedSeat);
 const level=TIER_LABELS[state.question?.tier]||"متدرج";
 let body=nav()+renderPlayers()+timeHeader()+
 '<div class="banner">'+(phase==="announce"?(state.speechOver?"👀 الاختيارات بتظهر... الجرس لسه مخفي":"🎙️ الحكم بيقرأ السؤال"):phase==="question"?(state.retry?"🔔 الجرس اتفتح تاني!":"🔔 الجرس مفتوح للجميع"):"🧠 وقت إجابة أسرع متسابق")+'</div>'+
 '<section class="card"><div class="kicker">'+esc(state.question?.cat)+' • '+esc(level)+'</div><div class="question">'+
 (state.question?.audioOnly?"🎧 اسمع الكلمة المقلوبة من الحكم، من غير ما تتكتب على الشاشة.":esc(state.question?.q))+'</div></section>';
 // Show choices directly under the question, including all four before the FIRST buzzer reveal.
 body+=optionGrid(phase==="answer");
 if(phase==="announce"){
  body+='<div class="judge"><div class="face">👀</div><div><strong>'+(state.speechOver?"راقب الاختيارات!":"اسمع الحكم الأول")+'</strong><p>'+(state.optionsShownCount===4?"كل الاختيارات ظهرت؛ الجرس هيفاجئكم!":state.speechOver?"الاختيارات بتظهر بالتتابع قدام الكل.":"بعد السؤال هتبدأ الاختيارات تظهر واحدة واحدة.")+'</p></div></div>';
  body+='<div class="notice">🎲 بعد ظهور الاختيار الرابع، الجرس هيظهر فجأة خلال 10 ثواني. مش هتعرف إمتى.</div>';
 }else if(phase==="question"){
  body+='<div class="buzzerWrap"><button id="thebuzzer" class="buzzer" onclick="pressBuzzer()" '+(online&&seat!==null?"":"disabled")+'>🔔<small>اضغط!</small></button>'+
   '<p class="desc">⚡ أول ثانيتين: 6 ثواني للإجابة والغلط −2. بعد كده: 12 ثانية والغلط −1.</p></div>';
  if(state.retry)body+='<div class="notice">🔄 فرصة تانية لنفس السؤال! أي حد يقدر يضغط، حتى اللي جاوب قبل كده.</div>';
 }else{
  body+='<div class="judge"><div class="face">'+(ICONS[state.lockedSeat]||"🔔")+'</div><div><strong>'+esc(locked?.name||"المتسابق")+'</strong><p>'+
  (state.fastBuzz?"⚡ خطف خاطف! 6 ثواني والخطأ −2":"🎯 ضغط متأني: 12 ثانية والخطأ −1")+'</p></div></div>';
  if(seat!==state.lockedSeat)body+='<div class="notice">⏳ '+esc(locked?.name||"المتسابق")+' بيجاوب، بصوا على الاختيارات واستنوا الجرس يرجع.</div>';
 }
 body+='<div class="attemptbar">❌ اختيارات غلط: '+(state.wrongChoices?.length||0)+' / 2</div>';
 body+=skipControls();
 return body;
}
function renderResult(){
 const r=state.result||{},icon=r.skipped?"⏭️":r.seat<0?"⏰":r.ok?"✅":"❌";
 let body=nav()+renderPlayers()+timeHeader()+
 '<div class="card center"><div class="resultIcon">'+icon+'</div><h2>'+
 (r.skipped?"السؤال اتخطى":r.seat<0?"محدش ضغط الجرس":r.ok?"إجابة صح!":r.retry?"إجابة غلط... فرصة تانية!":"السؤال انتهى!")+'</h2>'+
 '<p class="desc">'+esc(state.msg)+'</p><div class="delta">'+(r.delta>0?"+"+r.delta:r.delta<0?"−"+Math.abs(r.delta):"0")+'</div>'+
 (r.ended?'<div class="notice ok"><b>الإجابة الصحيحة:</b> '+esc(r.correct||"—")+'</div>':
 '<div class="notice">🔒 الإجابة الصحيحة لسه سرية؛ الجرس هيفتح تاني!</div>')+
 (r.chosen?'<p class="small">الإجابة اللي اتجرّبت: '+esc(r.chosen)+'</p>':"")+
 optionGrid(false);
 if(r.retry)body+='<div class="notice">🔔 استعدوا: نفس السؤال هيفضل مفتوح لأي متسابق.</div>';
 body+=(host?'<button class="btn" onclick="advanceRound()">'+(r.retry?"🔔 افتح الجرس تاني":"➡️ السؤال اللي بعده")+'</button>':
 '<p class="small">'+(r.retry?"الجرس هيفتح تاني...":"الحكم بينتقل للسؤال اللي بعده...")+'</p>');
 return body+skipControls()+'</div>';
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
