function webFlagEmoji(code){return String(code||"").toUpperCase().replace(/[A-Z]/g,ch=>String.fromCodePoint(127397+ch.charCodeAt(0)));}
"use strict";
// Coral visual identity, fully replacing buzzer-specific screens.
nav=function(){return `<div class="nav"><div class="navbrand"><span class="logo md-logo">🧠</span><span>من <span style="color:var(--yellow)">دماغك</span></span></div><div class="pill">🎯 السباق إلى 10</div></div>`;};
renderHome=function(){
 const cats=[CAT_ALL,...CAT_KEYS];
 root.innerHTML=nav()+`<section class="hero"><div class="badgeHero md-heroIcon">🧠</div><div class="kicker">الدور عليك... والقرار قرارك</div><h1>من <em>دماغك</em></h1><p class="desc">جاوب من غير مساعدة واكسب نقطتين، أو اطلب الاختيارات واكسب نقطة. لكن الغلطة لها تمن! <b>أول واحد يوصل 10 نقاط يكسب</b>، من غير عدد أسئلة ثابت.</p><div class="questionCount">🎲 ${TOTAL_QUESTIONS} سؤال • ${CAT_KEYS.length} فئة</div></section>
 <section class="card"><div class="kicker">جهّز المواجهة</div>
 <label class="label" for="nickname">اسمك في اللعبة</label><input id="nickname" class="field" maxlength="18" value="${esc(cfg.name)}" oninput="saveName(this.value)" placeholder="اسم المتسابق">
 <label class="label">عدد المتسابقين</label><div class="counts">${[2,3,4].map(n=>`<button class="count ${cfg.target===n?"selected":""}" onclick="chooseTarget(${n})">${n}<span>لاعبين</span></button>`).join("")}</div>
 <label class="label">نوع الأسئلة</label><select class="field" onchange="chooseCategory(this.value)">${cats.map(v=>`<option value="${esc(v)}" ${cfg.category===v?"selected":""}>${esc(v)}</option>`).join("")}</select>
 <div class="md-rulesmini"><div>🧠 <b>من دماغك</b> <span class="md-pos">+2</span><span class="md-neg">−1</span></div><div>🃏 <b>بالاختيارات</b> <span class="md-pos">+1</span><span class="md-neg">−2</span></div></div>
 <div class="onlineSection"><div class="kicker">🌐 العب أونلاين مع أصحابك</div>
 <label class="botToggle"><input type="checkbox" onchange="chooseBot(this.checked)" ${cfg.bot?"checked":""}><span><b>🤖 أضف منافس كمبيوتر</b><small>الكمبيوتر بياخد مقعد من العدد اللي اخترته</small></span></label>
 <button class="btn" onclick="openOnlineRoom()">🎮 أنشئ غرفة أونلاين</button>
 <label class="label">رقم الغرفة</label><input id="roomNumber" class="field roomInput" type="text" inputmode="numeric" maxlength="6" placeholder="6 أرقام" aria-label="رقم الغرفة">
 <button class="btn secondary" onclick="joinOnlineRoom()">🔑 انضم لغرفة موجودة</button></div>
 <div class="bluetoothSection"><div class="kicker">🔵 اللعب القريب من غير إنترنت</div><button class="btn ghost" onclick="openRoom()">📱 أنشئ غرفة بلوتوث</button><button class="btn ghost" onclick="findRoom()">🔗 انضم لغرفة بلوتوث</button></div>
 <div class="voiceSettings"><div><strong>🎙️ صوت قراءة الأسئلة</strong><small>من موبايل صاحب الغرفة</small></div><button class="voiceToggle" onclick="toggleVoice()">${voiceOn?"🔊 شغّال":"🔇 مقفول"}</button></div>
 <button class="btn ghost" onclick="previewVoice()">🔊 جرّب الصوت</button><button class="btn ghost" onclick="renderHow()">📖 طريقة اللعب</button></section>
 <p class="foot">من دماغك • دور لكل متسابق • خطف واحد بعد الغلط • أول 10 نقاط يفوز</p>`;
};
renderHow=function(){
 root.innerHTML=nav()+`<section class="card"><h2>🧠 قوانين من دماغك</h2>
 <div class="md-rulesmini"><div>🧠 <b>إجابة من دماغك:</b> صح <span class="md-pos">+2</span> غلط <span class="md-neg">−1</span></div><div>🃏 <b>إظهار الاختيارات:</b> صح <span class="md-pos">+1</span> غلط <span class="md-neg">−2</span></div></div>
 <p class="desc">🎯 كل لاعب ييجي له سؤال بالتناوب. يختار طريقة الإجابة قبل ما يعرف الاختيارات. الاختيارات لما تتفتح ما ينفعش يرجع يلعب من دماغه.</p>
 <p class="desc">🔥 لو إجابة اللاعب غلط أو الوقت خلص، المنافس التالي بياخد <b>فرصة خطف واحدة</b> لنفس السؤال. لو فشل كمان، السؤال ينتهي والدور يكمل طبيعي.</p>
 <p class="desc">⏱️ 25 ثانية لاختيار الطريقة، 26 ثانية للإجابة المكتوبة، 18 ثانية للاختيارات. أسئلة الأوصاف اليومية المكتوبة ليها وقت أطول ومفيهاش اختيارات.</p>
 <p class="desc">🏆 مفيش عدد أسئلة محدد. المباراة بتنتهي لما لاعب يوصل إلى <b>10 نقاط أو أكثر</b>.</p>
 <p class="desc">🎙️ صاحب الغرفة هو مرجع التصحيح والسكور. لازم يفضل فاتح التطبيق في اللعب الأونلاين أو البلوتوث.</p>
 <button class="btn" onclick="renderHome()">يلا نلعب 🚀</button></section>`;
};
renderPlayers=function(lobby=false){
 if(!state)return "";
 return `<div class="${lobby?"playerlist":"scores"}">`+Array.from({length:state.target},(_,i)=>{
  const p=state.players.find(x=>x.seat===i);
  if(!p)return lobby?`<div class="player"><span class="avatar">➕</span><span class="name">مكان فاضي</span><small>مستني متسابق</small></div>`:"";
  if(lobby)return `<div class="player ${p.online?"online":""}"><span class="avatar">${ICONS[i]}</span><span class="name">${esc(p.name)}</span><small>${p.bot?"🤖 كمبيوتر":p.online?"✅ متصل":"🔌 غير متصل"}${i===0?" • صاحب الغرفة":""}</small></div>`;
  return `<div class="scorecard ${p.seat===state.lockedSeat&&["question","answer"].includes(state.phase)?"md-activeScore":""}"><span>${ICONS[i]} ${esc(p.name)}</span><b>${p.score}<small class="md-outof"> /10</small></b></div>`;
 }).join("")+"</div>";
};
renderLobby=function(){
 const ready=allReady();
 root.innerHTML=nav()+`<div class="banner">🧠 من دماغك • ${state.target} لاعبين</div>
 <div class="judge"><div class="face">🎯</div><div><strong>مين هيوصل 10 الأول؟</strong><p>بدون جرس: دور بالتناوب وقرار بين المخاطرة والاختيارات</p></div></div>
 ${(state.roomCode||onlineRoomCode)?'<div class="roomCodeCard"><small>🌐 رقم الغرفة — ابعته لأصحابك</small><strong>'+esc(state.roomCode||onlineRoomCode)+'</strong><small>صاحب الغرفة يفضل متصل</small></div>':""}
 <section class="card"><h2>اللاعبين</h2><p class="desc">${playersConnected()} من ${state.target} • ${esc(state.category)}</p>${renderPlayers(true)}
 ${typeof duelHistoryCard==="function"?duelHistoryCard():""}
 ${host?`<button class="btn" ${ready?"":"disabled"} onclick="startMatch()">🚀 ابدأ التحدي</button>`:`<div class="notice">${ready?"الكل جاهز! مستنيين صاحب الغرفة":"مستنيين باقي المتسابقين..."}</div>`}
 <button class="btn ghost" onclick="backToMenu()">خروج من الغرفة</button></section>`;
};
timeHeader=function(){
 const max=state.phase==="question"?MD_PICK_SEC:state.phase==="answer"?(state.answerWindowSec||MD_FREE_SEC):MD_RESULT_SEC;
 const who=state.players.find(p=>p.seat===state.lockedSeat);
 const common=`<div><span class="kicker">السؤال ${state.round} • ${esc(state.question?.cat||"")}</span><div class="small">🎯 الهدف: 10 نقاط • ${state.stealStage?"🔥 فرصة خطف":"🧠 دور "+esc(who?.name||"")}</div></div>`;
 if(state.phase==="announce")return `<div class="timerrow">${common}<div class="timer secretTimer">🎙️</div></div>`;
 return `<div class="timerrow">${common}<div id="timer" class="timer ${state.remaining<=5?"danger":""}">${format(state.remaining)}ث</div></div><div class="bar"><div id="timefill" style="width:${Math.round((state.remaining||0)/max*100)}%"></div></div>`;
};
updateTimerUI=function(){
 if(!state)return;const el=document.getElementById("timer"),fill=document.getElementById("timefill");
 if(el){el.textContent=format(state.remaining)+"ث";el.classList.toggle("danger",state.remaining<=5);}
 if(fill){const max=state.phase==="question"?MD_PICK_SEC:state.phase==="answer"?state.answerWindowSec:MD_RESULT_SEC;fill.style.width=Math.round(state.remaining/max*100)+"%";}
};
optionGrid=function(clickable=false){
 if(state?.answerMode!=="choice"||!state.question?.options||state.phase!=="answer")return "";
 const can=!!clickable&&seat===state.lockedSeat;
 return `<section class="card choicesCard"><div class="kicker">🃏 اختار إجابتك • الصح +1 / الغلط −2</div><div class="options">${state.question.options.map((opt,i)=>{
 const wrong=state.wrongChoices?.includes(i),enabled=can&&!wrong;
 return `<button class="option ${enabled?"selectChoice":"spectator"} ${wrong?"wrong":""}" ${enabled?`onclick="selectOption(${i})"`:"disabled"}><i>${["A","B","C","D"][i]||i+1}</i><span>${esc(opt||"—")}</span>${wrong?'<b class="wrongmark">✕</b>':""}</button>`;
 }).join("")}</div></section>`;
};
renderQuestion=function(){
 const phase=state.phase,who=state.players.find(p=>p.seat===state.lockedSeat),mine=seat===state.lockedSeat;
 const level=TIER_LABELS[state.question?.tier]||"منوع";
 let html=nav()+renderPlayers()+timeHeader()+`<div class="banner md-turnBanner">${phase==="announce"?"🎙️ بنقرأ السؤال...":state.stealStage?"🔥 فرصة خطف!":"🎯 السؤال لدور "+esc(who?.name||"المتسابق")}</div>`+
 `<section class="card md-questionCard"><div class="kicker">${esc(state.question?.cat||"")} • ${esc(level)}</div><div class="question">${state.question?.audioOnly?"🎧 اسمع الحروف بصوت الحكم":esc(state.question?.q||"")}${state.question?.visual?'<div class="flagPhoto" style="font-size:95px"><span role="img" aria-label="علم دولة">'+webFlagEmoji(state.question.visual)+'</span></div>':""}</div></section>`;
 if(phase==="announce")html+=`<div class="notice">🎙️ السؤال هيتقرأ وبعده يبدأ دور المتسابق.</div>`;
 if(phase==="question"){
  if(mine){html+=`<section class="card md-decide"><h3>🧠 هتجاوب إزاي؟</h3><p class="small">اختار دلوقتي؛ بمجرد طلب الاختيارات مش هتقدر ترجع.</p>
   <button class="btn md-free" onclick="chooseAnswerMode('text')">🧠 من دماغي <span>صح +2 | غلط −1</span></button>
   ${mdOnlyText()?'<div class="notice">✍️ السؤال ده كتابي فقط، من غير اختيارات.</div>':`<button class="btn md-choices" onclick="chooseAnswerMode('choice')">🃏 ورّيني الاختيارات <span>صح +1 | غلط −2</span></button>`}</section>`;}
  else html+=`<div class="notice">⏳ الدور عند <b>${esc(who?.name||"")}</b> — مستنيين يختار طريقة الإجابة.</div>`;
 }
 if(phase==="answer"){
  html+=optionGrid(true);
  if(state.answerMode==="text"){
   if(mine)html+=`<form class="answerTextCard" onsubmit="return submitTypedFromUI()"><div class="kicker">🧠 إجابة من دماغك • +2 / −1</div><h3>اكتب إجابتك</h3><p class="small">الإجابة بتتراجع مع مراعاة الهمزات والتشكيل.</p><input id="typedAnswer" name="typedAnswer" type="text" maxlength="85" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="إجابتك هنا" required><button class="btn answerSubmit" type="submit">✅ ثبّت الإجابة</button></form>`;
   else html+=`<div class="notice">📝 ${esc(who?.name||"")} بيجاوب من دماغه... الإجابة لسه مخفية.</div>`;
  }else if(!mine)html+=`<div class="notice">🃏 ${esc(who?.name||"")} اختار إظهار الاختيارات. مستنيين إجابته.</div>`;
 }
 html+=skipControls();return html;
};
renderResult=function(){
 const r=state.result||{};
 const icon=r.skipped?"⏭️":r.ok?"✅":"❌";
 let html=nav()+renderPlayers()+timeHeader()+`<section class="card center"><div class="resultIcon">${icon}</div><h2>${r.skipped?"السؤال اتخطى":r.ok?"إجابة صح!":r.retry?"فرصة خطف للمنافس!":"الإجابة غلط"}</h2><p class="desc">${esc(state.msg)}</p>
 <div class="delta">${r.delta>0?"+"+r.delta:r.delta<0?"−"+Math.abs(r.delta):"0"}</div>
 ${r.ended?`<div class="notice ok"><b>الإجابة الصحيحة:</b> ${esc(r.correct||"—")}</div>`:`<div class="notice">🔒 الإجابة لسه سرية علشان فرصة الخطف</div>`}
 ${r.chosen?`<p class="small">${r.typed?"الإجابة المكتوبة":"الإجابة المختارة"}: ${esc(r.chosen)}</p>`:""}
 ${r.retry?'<div class="notice">🔥 السؤال هيبقى للمتسابق التالي مرة واحدة بس.</div>':""}
 ${host?`<button class="btn" onclick="advanceRound()">${r.retry?"🔥 ابدأ فرصة الخطف":"➡️ السؤال اللي بعده"}</button>`:`<p class="small">لحظات ونكمل...</p>`}</section>`;
 return html+skipControls();
};
renderFinished=function(){
 const winner=state.players.find(p=>p.seat===state.winner);
 return nav()+`<section class="hero"><div class="badgeHero md-heroIcon">🏆</div><div class="kicker">خلصت المواجهة</div><h1>برافو <em>${esc(winner?.name||"")}</em>!</h1><p class="desc">أول لاعب وصل لـ10 نقاط وفاز بالتحدي 🧠</p></section>
 <section class="card"><h2>🏅 النتيجة النهائية</h2>${state.players.slice().sort((a,b)=>b.score-a.score).map((p,i)=>`<div class="scorecard ${p.seat===state.winner?"leader":""}" style="margin:10px 0"><span>${["🥇","🥈","🥉","⭐"][i]} ${esc(p.name)}</span><b>${p.score}</b></div>`).join("")}
 ${typeof duelHistoryCard==="function"?duelHistoryCard():""}
 ${host?'<button class="btn" onclick="resetToLobby()">🔄 العبوا تاني</button>':'<p class="desc">صاحب الغرفة يقدر يبدأ مواجهة جديدة.</p>'}
 <button class="btn ghost" onclick="backToMenu()">الرئيسية</button></section>`;
};
renderHome();
