"use strict";
const root=document.getElementById("root");
const CAT_ALL="🌟 منوعات",CAT_KEYS=Object.keys(QUESTIONS),ICONS=["🔵","🩷","🟡","🟣"];
const TOTAL_QUESTIONS=CAT_KEYS.reduce((n,k)=>n+QUESTIONS[k].length,0);
const QUIZ_SEC=15,ANSWER_SEC=12,FAST_ANSWER_SEC=6,FAST_BUZZ_MS=2000;
const SECRET_DELAY_MAX_MS=15000,ANNOUNCE_SEC=70,RESULT_SEC=8,WIN_AT=10;
const HARD_CATS=["🏛️ تاريخ للنخبة","🧬 علوم صعبة","🧭 جغرافيا متقدمة","🎨 فن وأدب","♟️ منطق صعب"];
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const clean=s=>String(s??"").trim().replace(/[\r\n\t]+/g," ").slice(0,18)||"لاعب";
const format=n=>Math.max(0,n|0);
const cfg={name:localStorage.getItem("buzzerName")||"لاعب 1",target:2,category:CAT_ALL};
let host=false,seat=null,online=false,pending="",devices=[],state=null,answerIndex=-1;
let usedQuestions=new Set(),lastVersion=-1,soundOn=true;
let hiddenOpenAt=0,speechWatchdogAt=0,buzzOpenedAt=0,privateReverseLetters=[];
const SPELL_NAMES={"ا":"ألف","أ":"ألف بهمزة فوق","إ":"ألف بهمزة تحت","آ":"ألف مد","ب":"باء","ت":"تاء","ث":"ثاء","ج":"جيم","ح":"حاء","خ":"خاء","د":"دال","ذ":"ذال","ر":"راء","ز":"زاي","س":"سين","ش":"شين","ص":"صاد","ض":"ضاد","ط":"طاء","ظ":"ظاء","ع":"عين","غ":"غين","ف":"فاء","ق":"قاف","ك":"كاف","ل":"لام","م":"ميم","ن":"نون","ه":"هاء","و":"واو","ي":"ياء","ى":"ألف مقصورة","ة":"تاء مربوطة","ء":"همزة","ئ":"ياء بهمزة","ؤ":"واو بهمزة"};
function spelledLetters(word){return [...String(word)].reverse().filter(ch=>ch.trim()).map(ch=>SPELL_NAMES[ch]||ch);}
let voiceOn=localStorage.getItem("buzzerVoice")!=="off",voiceAvailable=true;
const HOST_LINES={
 intro:["يلا بينا نولّع المنافسة!","ركزوا معايا يا أبطال!","السؤال ده محتاج تركيز!","جهزوا إيديكم يا جماعة!","السؤال الجاي ممكن يقلب النتيجة!"],
 correct:["يا سلام! إجابة مظبوطة!","برافو عليك! إجابة صح!","هي دي الشطارة! إجابة صحيحة!","بوم! جبتها صح!"],
 wrong:["يا خسارة! الإجابة غلط!","لأ لأ، مش هي دي!","معلش، المرة الجاية أحسن!","للأسف، الإجابة مش مظبوطة!"],
 start:["يلا الجرس اتفتح!","الجرس مفتوح! مين الأسرع؟","على الجرس يا أبطال!"],
 finish:["مبروك يا بطل!","إيه الجمال ده! عندنا فائز!"]
};
function hostLine(kind,n=0){const l=HOST_LINES[kind];return l[(n+Math.floor(Math.random()*l.length))%l.length];}
function toggleVoice(){voiceOn=!voiceOn;localStorage.setItem("buzzerVoice",voiceOn?"on":"off");renderHome();}
function previewVoice(){try{Native.speak("أهلا بيكم في جرس التحدي! معانا اتنين أو تلاتة أو أربعة متسابقين، والنهارده هنشوف مين أسرع واحد على الجرس!")}catch(e){showError("تعذر تشغيل صوت الحكم: "+e.message);}}
function speakQuestion(text,round){
 if(!host)return;
 if(state?.question?.audioOnly){
  if(!voiceOn||!voiceAvailable){unavailableSpelling();return;}
  try{Native.spellQuestion(String(text),JSON.stringify(privateReverseLetters),String(round));}
  catch(e){unavailableSpelling();}
  return;
 }
 if(!voiceOn){questionVoiceFinished(false,round);return;}
 try{Native.speakQuestion(String(text),String(round));}
 catch(e){questionVoiceFinished(false,round);}
}
function unavailableSpelling(){
 if(!host||!state||state.phase!=="announce")return;
 voiceAvailable=false;
 if(state.category===CAT_ALL){state.msg="محرك النطق العربي غير متاح؛ هنختار سؤالًا غير صوتي.";newRound();}
 else{state.phase="paused";state.msg="فئة الكلمات المقلوبة محتاجة محرك نطق عربي. فعّله من إعدادات الهاتف أو اختار فئة تانية.";bump();}
}
function questionVoiceFinished(spoken,round){
 if(!host||!state||state.phase!=="announce"||String(state.round)!==String(round)||state.speechOver)return;
 if(!spoken&&state.question?.audioOnly){unavailableSpelling();return;}
 state.speechOver=true;
 const secret=Math.floor(Math.random()*(SECRET_DELAY_MAX_MS+1));
 hiddenOpenAt=Date.now()+secret;
 state.remaining=0;state.deadline=0; // The exact reveal time is PRIVATE to the referee phone.
 state.msg="🎙️ السؤال خلص. الجرس ممكن يظهر في أي لحظة... خلي عينك على الشاشة!";
 bump();
}
function native(name,arg){try{if(!window.Native||typeof Native[name]!=="function")throw new Error("التطبيق لازم يتفتح من أندرويد");if(arg===undefined)Native[name]();else Native[name](arg);}catch(e){showError(e.message);}}
function send(p){native("send",JSON.stringify(p));}
function haptic(){try{Native.vibrate()}catch(e){}}
function sfx(type){
 if(!soundOn)return;
 try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),g=a.createGain();
 const f=type==="bad"?175:type==="win"?950:type==="buzz"?490:670;
 o.type=type==="bad"?"sawtooth":"sine";o.frequency.setValueAtTime(f,a.currentTime);
 o.frequency.exponentialRampToValueAtTime(Math.max(60,f*.65),a.currentTime+.14);
 g.gain.setValueAtTime(.065,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.19);
 o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.2);o.onended=()=>a.close();
 }catch(e){}
}
function speak(s){if(host&&voiceOn)try{Native.speak(String(s))}catch(e){}}
function saveName(s){cfg.name=clean(s);try{localStorage.setItem("buzzerName",cfg.name)}catch(e){}}
function chooseTarget(v){cfg.target=Math.min(4,Math.max(2,Number(v)||2));renderHome();}
function chooseCategory(v){cfg.category=CAT_KEYS.includes(v)?v:CAT_ALL;}
function backToMenu(){
 if(online){native("disconnect");online=false;}
 host=false;seat=null;state=null;answerIndex=-1;pending="";devices=[];lastVersion=-1;renderHome();
}
window.backToMenu=backToMenu;
function openRoom(){
 cfg.name=clean(document.getElementById("nickname")?.value||cfg.name);
 pending="host";showWaiting("شغّل البلوتوث واسمح بالتوصيل...");native("permission");
}
function findRoom(){
 cfg.name=clean(document.getElementById("nickname")?.value||cfg.name);
 pending="guest";showWaiting("بندور على الموبايلات المقترنة...");native("permission");
}
function connectTo(i){if(!devices[i])return;showWaiting("جاري الاتصال بـ "+devices[i].name+" ...");native("join",devices[i].addr);}
function mkLobby(n){
 return {phase:"lobby",target:n,category:cfg.category,round:0,remaining:0,players:[{seat:0,name:clean(cfg.name),score:0,online:true}],
 question:null,lockedSeat:null,result:null,winner:null,msg:"المتسابقين لسه بيتجمعوا",version:1,deadline:0};
}
function bump(){if(!host||!state)return;state.version++;sync(true);}
function sync(draw=false){if(!host||!state)return;send({t:"state",s:state});if(draw){lastVersion=state.version;renderGame();}}
function startHost(n){
 host=true;seat=0;online=true;state=mkLobby(n);answerIndex=-1;usedQuestions.clear();lastVersion=-1;
 renderGame();sync();
}
function playersConnected(){return state?state.players.filter(p=>p.online).length:0;}
function allReady(){
 return !!state && state.players.length===state.target && state.players.every(p=>p.online) &&
  new Set(state.players.map(p=>p.seat)).size===state.target;
}
function addRemote(info){
 if(!host||!state)return;
 const id=Number(info.seat);
 if(!Number.isInteger(id)||id<1||id>=state.target)return;
 let existing=state.players.find(p=>p.seat===id);
 if(existing){existing.online=true;existing.name="لاعب "+(id+1);}
 else state.players.push({seat:id,name:"لاعب "+(id+1),score:0,online:true});
 if(state.phase!=="lobby"){state.phase="paused";state.msg="اتغيّر الاتصال. ارجعوا للغرفة لإعادة اللعبة من البداية.";}
 state.players.sort((a,b)=>a.seat-b.seat);bump();
}
function removeRemote(id){
 if(!host||!state)return;
 const p=state.players.find(p=>p.seat===id);if(!p)return;p.online=false;
 if(state.phase!=="lobby"&&state.phase!=="finished"){
  state.phase="paused";state.msg="اتقطع الاتصال بأحد اللاعبين.";
 }
 bump();
}
function handleRemote(info){
 if(!host||!state)return;
 const seatNo=Number(info.seat),player=state.players.find(p=>p.seat===seatNo);
 if(!player||!player.online)return;
 let packet;try{packet=JSON.parse(info.msg);}catch(e){return;}
 if(packet.t==="hello"){
  player.name=clean(packet.name);bump();return;
 }
 if(packet.t==="buzz")claimBuzz(seatNo);
 if(packet.t==="choice")submitAnswer(seatNo,Number(packet.i));
}
window.onNative=(type,detail)=>{
 if(type==="ready"){
  if(pending==="host"){pending="";native("host",cfg.target);}
  else if(pending==="guest"){pending="";native("paired");}
  return;
 }
 if(type==="hosting"){startHost(Number(detail)||cfg.target);return;}
 if(type==="waiting"){showWaiting(detail);return;}
 if(type==="paired"){try{devices=JSON.parse(detail);}catch(e){devices=[];}showDevices();return;}
 if(type==="connected"){host=false;online=true;seat=null;state=null;showWaiting("تم الاتصال! مستنيين تأكيد الدخول...");return;}
 if(type==="join"){try{addRemote(JSON.parse(detail))}catch(e){}return;}
 if(type==="leave"){removeRemote(Number(detail));return;}
 if(type==="remote"){try{handleRemote(JSON.parse(detail))}catch(e){}return;}
 if(type==="message"){
  let m;try{m=JSON.parse(detail);}catch(e){return;}
  if(m.t==="welcome"){
   seat=Number(m.seat);send({t:"hello",name:cfg.name});return;
  }
  if(m.t==="full"){showError("الغرفة كاملة، صاحب الغرفة اختار عدد أقل من اللاعبين");return;}
  if(m.t==="state"){
   const changed=!state||m.s.version!==lastVersion;
   state=m.s;
   if(changed){lastVersion=state.version;renderGame();}else updateTimerUI();
   return;
  }
 }
 if(type==="ttsStatus"||type==="voiceStatus"){voiceAvailable=detail==="ready";if(!state)renderHome();return;}
 if(type==="speechDone"){questionVoiceFinished(true,detail);return;}
 if(type==="speechUnavailable"){voiceAvailable=false;questionVoiceFinished(false,detail);return;}
 if(type==="error"){showError(detail);return;}
 if(type==="disconnected"){online=false;host=false;seat=null;state=null;showError(detail||"انقطع اتصال البلوتوث");return;}
};
function selectNewQuestion(){
 const preferred=state.category===CAT_ALL?CAT_KEYS.filter(c=>c!=="🔄 كلمة مقلوبة"||voiceOn&&voiceAvailable):[state.category];
 if(!preferred.length)return null;
 let cats=preferred.filter(cat=>QUESTIONS[cat]?.length);
 if(!cats.length)return null;
 // Mixed mode: roughly two-thirds advanced general-knowledge questions, without maths dominating.
 if(state.category===CAT_ALL){
   const hard=cats.filter(c=>HARD_CATS.includes(c)),other=cats.filter(c=>!HARD_CATS.includes(c));
   if(hard.length&&other.length)cats=Math.random()<.65?hard:other;
 }
 const cat=cats[Math.floor(Math.random()*cats.length)];
 let pool=QUESTIONS[cat].map((row,i)=>({row,key:cat+"#"+i})).filter(x=>!usedQuestions.has(x.key));
 if(!pool.length){pool=QUESTIONS[cat].map((row,i)=>({row,key:cat+"#"+i}));for(const x of pool)usedQuestions.delete(x.key);}
 const item=pool[Math.floor(Math.random()*pool.length)];
 usedQuestions.add(item.key);
 const reversed=cat==="🔄 كلمة مقلوبة";
 privateReverseLetters=reversed?spelledLetters(item.row[0]):[];
 let row=reversed?["🎧 اسمع الحروف من الحكم، وركّب الكلمة بالمقلوب.",...item.row]:item.row.slice();
 const options=row.slice(1).map((value,i)=>({value,correct:i===0}));
 for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
 answerIndex=options.findIndex(x=>x.correct);
 return {cat,q:row[0],options:options.map(x=>x.value),audioOnly:reversed};
}
function startMatch(){
 if(!host||!state||!allReady()||state.phase!=="lobby")return;
 state.players.forEach(p=>p.score=0);state.round=0;usedQuestions.clear();
 newRound();
}
function newRound(){
 if(!host||!state)return;
 const winner=state.players.find(p=>p.score>=WIN_AT);
 if(winner){
  state.phase="finished";state.winner=winner.seat;state.msg="🏆 "+hostLine("finish",state.round)+" "+winner.name+" كسب الحلقة!";
  speak(state.msg);sfx("win");bump();return;
 }
 state.round++;
 state.phase="announce";state.question=selectNewQuestion();state.lockedSeat=null;state.result=null;
 state.fastBuzz=false;state.answerWindowSec=ANSWER_SEC;
 hiddenOpenAt=0;buzzOpenedAt=0;
 speechWatchdogAt=Date.now()+ANNOUNCE_SEC*1000;
 state.deadline=0;state.remaining=0;state.speechOver=false;
 state.msg="🎙️ الحكم بيقرأ السؤال، والجرس مخفي لحد ما يخلص.";
 bump();
 const intro=hostLine("intro",state.round)+" السؤال رقم "+state.round+". ";
 speakQuestion(intro+(state.question.audioOnly?"دلوقتي كلمة مقلوبة. ركزوا في الحروف بالترتيب.":state.question.q),state.round);
}
function openBuzz(){
 if(!host||!state||state.phase!=="announce"||!state.speechOver||!hiddenOpenAt||Date.now()<hiddenOpenAt)return;
 buzzOpenedAt=Date.now();
 state.phase="question";state.deadline=buzzOpenedAt+QUIZ_SEC*1000;
 state.remaining=QUIZ_SEC;state.msg="🔔 "+hostLine("start",state.round);
 haptic();sfx("ok");bump();
}
function claimBuzz(who){
 if(!host||!state||state.phase!=="question"||state.lockedSeat!==null||Date.now()>state.deadline)return;
 const p=state.players.find(x=>x.seat===who&&x.online);if(!p)return;
 const rush=(Date.now()-buzzOpenedAt)<=FAST_BUZZ_MS;
 state.fastBuzz=rush;state.answerWindowSec=rush?FAST_ANSWER_SEC:ANSWER_SEC;
 state.lockedSeat=who;state.phase="answer";
 state.deadline=Date.now()+state.answerWindowSec*1000;state.remaining=state.answerWindowSec;
 state.msg="🔔 "+p.name+(rush?" خطف الجرس! قدامه 6 ثواني؛ الغلط −2":" سبق الجميع! قدامه 12 ثانية؛ الغلط −1");
 haptic();sfx("buzz");speak("الجرس مع "+p.name);
 bump();
}
function pressBuzzer(){
 if(!state||state.phase!=="question"||!online||seat===null)return;
 haptic();sfx("buzz");
 if(host)claimBuzz(seat);else send({t:"buzz"});
}
function selectOption(i){
 if(!state||state.phase!=="answer"||seat!==state.lockedSeat)return;
 if(!Number.isInteger(i)||i<0||i>3)return;
 if(host)submitAnswer(seat,i);else send({t:"choice",i});
}
function submitAnswer(who,i){
 if(!host||!state||state.phase!=="answer"||state.lockedSeat!==who)return;
 if(!Number.isInteger(i)||i<0||i>=4||Date.now()>state.deadline)return;
 resolveAnswer(i===answerIndex,i,false);
}
function resolveAnswer(isCorrect,choice,timedout=false){
 if(!host||!state||!["answer","question"].includes(state.phase))return;
 const p=state.players.find(x=>x.seat===state.lockedSeat);
 const answer=state.question?.options[answerIndex]||"—";
 let msg,delta=0;
 if(!p){msg="الوقت خلص، محدش ضغط الجرس";}
 else{
  delta=isCorrect?1:(state.fastBuzz?-2:-1);p.score+=delta;
  const loss=Math.abs(delta);
  msg=isCorrect?hostLine("correct",state.round)+" نقطة لـ "+p.name:
   timedout?"الوقت خلص يا "+p.name+"، خسر "+loss+(loss===2?" نقطتين":" نقطة"):
   hostLine("wrong",state.round)+" "+p.name+" خسر "+loss+(loss===2?" نقطتين":" نقطة");
 }
 state.phase="result";state.remaining=RESULT_SEC;state.deadline=Date.now()+RESULT_SEC*1000;
 state.result={name:p?.name||"مفيش حد",seat:p?.seat??-1,delta,correct:answer,chosen:choice===null?null:state.question.options[choice],ok:!!p&&isCorrect,fast:!!p&&state.fastBuzz};
 state.msg=msg;
 speak(msg+". الإجابة الصحيحة: "+answer);sfx(isCorrect?"ok":"bad");bump();
}
function advanceRound(){
 if(!host||!state||state.phase!=="result")return;
 newRound();
}
function resetToLobby(){
 if(!host||!state)return;
 state.phase="lobby";state.round=0;state.winner=null;state.result=null;state.question=null;state.lockedSeat=null;state.players.forEach(p=>p.score=0);
 state.msg="هنبدأ حلقة جديدة";usedQuestions.clear();bump();
}
function tick(){
 if(!host||!state)return;
 const phase=state.phase,now=Date.now();
 if(phase==="announce"){
  if(!state.speechOver&&now>=speechWatchdogAt){questionVoiceFinished(false,state.round);return;}
  if(state.speechOver&&hiddenOpenAt&&now>=hiddenOpenAt)openBuzz();
  return;
 }
 if(!["question","answer","result"].includes(phase))return;
 const remaining=Math.max(0,Math.ceil((state.deadline-now)/1000));
 if(remaining!==state.remaining){state.remaining=remaining;sync();updateTimerUI();}
 if(now<state.deadline)return;
 if(phase==="question")resolveAnswer(false,null,true);
 else if(phase==="answer")resolveAnswer(false,null,true);
 else if(phase==="result")advanceRound();
}
setInterval(tick,200);
