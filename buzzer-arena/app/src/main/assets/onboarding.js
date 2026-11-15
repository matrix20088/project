"use strict";
/* من دماغك v14: a short, optional first-run walkthrough and contextual button hints.
   Each flag is saved on the current device only; room states and countdowns are untouched. */
(function(){
 const KEY_HOME="md_v14_guide_home_done",KEY_MODE="md_v14_guide_mode_done",
       KEY_TEXT="md_v14_guide_text_done",KEY_CHOICE="md_v14_guide_choice_done";
 const STEPS=[
  {target:"#nickname",icon:"👤",title:"أول حاجة: اكتب اسمك",body:"اضغط على خانة «اسمك في اللعبة» واكتب الاسم اللي تحب يظهر لأصحابك."},
  {target:".onlineSection button.btn:not(.secondary)",icon:"🎮",title:"علشان تبدأ مباراة",body:"اضغط «أنشئ غرفة أونلاين»، وبعدها ابعت رقم الغرفة لأصحابك."},
  {target:".onlineSection button.btn.secondary",icon:"🔑",title:"علشان تدخل مع صاحبك",body:"اكتب رقم الغرفة المكوّن من 6 أرقام واضغط «انضم لغرفة موجودة»."},
  {target:".bluetoothSection button.btn",icon:"🔵",title:"من غير إنترنت؟",body:"لو قريبين من بعض استخدم أزرار البلوتوث. أثناء السؤال هيظهر زر «من دماغي» وزر «ورّيني الاختيارات»؛ اختار واحد بس."}
 ];
 let active=false,step=0,highlight=null,pending=false;
 function seen(key){try{return localStorage.getItem(key)==="1";}catch(e){return false;}}
 function mark(key){try{localStorage.setItem(key,"1");}catch(e){}}
 function clearHighlight(){if(highlight?.classList)highlight.classList.remove("md-tour-highlight");highlight=null;}
 function closeTour(){
  active=false;pending=false;clearHighlight();mark(KEY_HOME);
  const node=document.getElementById("md-first-tour");if(node)node.remove();
 }
 function paintTour(){
  if(!active)return;
  let node=document.getElementById("md-first-tour");
  if(!node){
   node=document.createElement("div");node.id="md-first-tour";document.body.appendChild(node);
  }
  clearHighlight();
  const s=STEPS[step];
  const target=document.querySelector(s.target);
  if(target){
   highlight=target;target.classList.add("md-tour-highlight");
   try{target.scrollIntoView({block:"start",behavior:"smooth"});}catch(e){}
  }
  node.innerHTML='<div class="md-tour-shade"></div><section class="md-tour-panel" role="dialog" aria-modal="true" aria-label="إرشادات أول مرة">'
   +'<div class="md-tour-top"><span>🎓 دليل أول مرة</span><small>'+(step+1)+' من '+STEPS.length+'</small></div>'
   +'<div class="md-tour-emoji">'+s.icon+'</div><h2>'+s.title+'</h2><p>'+s.body+'</p>'
   +'<div class="md-tour-actions"><button type="button" class="md-tour-skip" onclick="mdTutorialSkip()">تخطي</button>'
   +'<button type="button" class="md-tour-next" onclick="mdTutorialNext()">'+(step===STEPS.length-1?"تمام، يلا نلعب ✓":"التالي ←")+'</button></div></section>';
 }
 function openTour(manual){
  if(active||(!manual&&seen(KEY_HOME)))return;
  if(!document?.body?.appendChild||!document.querySelector)return;
  active=true;step=0;paintTour();
 }
 window.mdTutorialNext=function(){if(!active)return;if(step<STEPS.length-1){step++;paintTour();}else closeTour();};
 window.mdTutorialSkip=function(){if(active)closeTour();};
 window.mdReplayTour=function(){openTour(true);};
 window.mdDismissHint=function(which){
  const key={mode:KEY_MODE,text:KEY_TEXT,choice:KEY_CHOICE}[which];
  if(key)mark(key);
  if(typeof renderGame==="function"&&typeof state!=="undefined"&&state)renderGame();
 };
 const home=renderHome;
 renderHome=function(){
  home();
  if(typeof root!=="undefined"&&root?.innerHTML){
   root.innerHTML=root.innerHTML.replace('<p class="foot">','<button type="button" class="btn ghost md-replay" onclick="mdReplayTour()">🎓 شوف الإرشادات تاني</button><p class="foot">');
  }
  if(!pending&&(!seen(KEY_HOME)||active)){
   pending=true;
   setTimeout(function(){pending=false;if(active)paintTour();else if(!seen(KEY_HOME))openTour(false);},80);
  }
 };
 const question=renderQuestion;
 renderQuestion=function(){
  let html=question();
  if(!state||seat!==state.lockedSeat)return html;
  if(state.phase==="question"&&!seen(KEY_MODE)){
   const onlyText=typeof mdOnlyText==="function"&&mdOnlyText();
   const tip=onlyText?"👆 السؤال ده كتابي فقط؛ اضغط «من دماغي» علشان تكتب إجابتك.":"👆 اختار الزر اللي هتلعب بيه: «من دماغي» لنقطتين أو «ورّيني الاختيارات» لنقطة واحدة. شوف خصم الغلط المكتوب تحت كل زر.";
   html=html.replace('<section class="card md-decide">','<section class="card md-decide md-coach-active"><aside class="md-inline-coach" role="note"><b>🎓 دورك أول مرة!</b><p>'+tip+'</p><button type="button" onclick="mdDismissHint(\'mode\')">فهمت ✓</button></aside>');
  }
  if(state.phase==="answer"&&state.answerMode==="text"&&!seen(KEY_TEXT)){
   html=html.replace('<form class="answerTextCard"','<form class="answerTextCard md-coach-active"');
   html=html.replace('<div class="kicker">🧠 إجابة من دماغك • +2 / −1</div>','<div class="kicker">🧠 إجابة من دماغك • +2 / −1</div><aside class="md-inline-coach" role="note"><b>✍️ اكتب وبعدين ثبّت</b><p>اضغط في مربع الإجابة، اكتب كلمتك، وبعدها اضغط الزر المرجاني «ثبّت الإجابة» قبل انتهاء الوقت.</p><button type="button" onclick="mdDismissHint(\'text\')">فهمت ✓</button></aside>');
  }
  if(state.phase==="answer"&&state.answerMode==="choice"&&!seen(KEY_CHOICE)){
   html=html.replace('<section class="card choicesCard">','<section class="card choicesCard md-coach-active"><aside class="md-inline-coach" role="note"><b>🃏 اضغط على إجابتك</b><p>الاختيارات قدامك تحت: اضغط مرة واحدة على الإجابة اللي شايفها صح. الصح +1 والغلط −2.</p><button type="button" onclick="mdDismissHint(\'choice\')">فهمت ✓</button></aside>');
  }
  return html;
 };
 const mode=chooseAnswerMode;
 chooseAnswerMode=function(which){
  if(state&&state.phase==="question"&&seat===state.lockedSeat&&(which==="text"||which==="choice"))mark(KEY_MODE);
  return mode(which);
 };
 const typed=submitTypedFromUI;
 submitTypedFromUI=function(){
  const value=document.getElementById("typedAnswer")?.value||"";
  if(state?.phase==="answer"&&state.answerMode==="text"&&seat===state.lockedSeat&&String(value).trim()&&String(value).length<=85)mark(KEY_TEXT);
  return typed();
 };
 const option=selectOption;
 selectOption=function(i){
  if(state?.phase==="answer"&&state.answerMode==="choice"&&seat===state.lockedSeat&&Number.isInteger(i))mark(KEY_CHOICE);
  return option(i);
 };
 renderHome();
})();