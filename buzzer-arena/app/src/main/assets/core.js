"use strict";
const root=document.getElementById("root");
const CAT_ALL="🌟 منوعات",CAT_KEYS=Object.keys(QUESTIONS),ICONS=["🔵","🩷","🟡","🟣"];
const TOTAL_QUESTIONS=CAT_KEYS.reduce((n,k)=>n+QUESTIONS[k].length,0);
const QUIZ_SEC=22,ANSWER_SEC=12,FAST_ANSWER_SEC=6,FAST_BUZZ_MS=2000;
const CHOICE_REVEAL_STEP_MS=350,ANNOUNCE_SEC=70,RESULT_SEC=8,RETRY_SEC=3,WIN_AT=10;
const HARD_CATS=["🏛️ تاريخ للنخبة","🧬 علوم صعبة","🧭 جغرافيا متقدمة","🎨 فن وأدب","♟️ منطق صعب"];
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const clean=s=>String(s??"").trim().replace(/[\r\n\t]+/g," ").slice(0,18)||"لاعب";
const format=n=>Math.max(0,n|0);
const cfg={name:localStorage.getItem("buzzerName")||"لاعب 1",target:2,category:CAT_ALL};
let host=false,seat=null,online=false,pending="",devices=[],state=null,answerIndex=-1;
let usedQuestions=new Set(),lastVersion=-1,soundOn=true;
let lastTapAt=0;
const ENTERTAINMENT_CATS=["🎬 سينما وتلفزيون","🎭 إفيهات السينما","📺 مسلسلات ومسرح","🎼 أغاني وفنانين","🎥 سينما عالمية","🎶 موسيقى وأغاني صعبة"];
const TIER_LABELS={easy:"سهل 🟢",medium:"متوسط 🟡",hard:"صعب 🔴"};
function difficultyByScore(scores){
 const high=Math.max(0,...scores.map(Number).filter(Number.isFinite));
 return high<=2?"easy":high<=5?"medium":"hard";
}
function tagTier(cat,idx){
 const x=QUESTION_LEVELS?.[cat+"#"+idx];
 if(x)return x;
 if(HARD_CATS.includes(cat))return "hard";
 if(cat.includes("حساب في ثواني"))return "medium";
 return "easy";
}
function ringBell(){
 try{if(window.Native&&typeof Native.playBell==="function"){Native.playBell();return;}}catch(e){}
 sfx("buzz");
}
let nextRevealAt=0,choiceSpeaking=false,choiceSpeechDeadline=0,speechWatchdogAt=0,buzzOpenedAt=0,privateReverseLetters=[];
const SPELL_NAMES={"ا":"ألف","أ":"ألف بهمزة فوق","إ":"ألف بهمزة تحت","آ":"ألف مد","ب":"باء","ت":"تاء","ث":"ثاء","ج":"جيم","ح":"حاء","خ":"خاء","د":"دال","ذ":"ذال","ر":"راء","ز":"زاي","س":"سين","ش":"شين","ص":"صاد","ض":"ضاد","ط":"طاء","ظ":"ظاء","ع":"عين","غ":"غين","ف":"فاء","ق":"قاف","ك":"كاف","ل":"لام","م":"ميم","ن":"نون","ه":"هاء","و":"واو","ي":"ياء","ى":"ألف مقصورة","ة":"تاء مربوطة","ء":"همزة","ئ":"ياء بهمزة","ؤ":"واو بهمزة"};
function spelledLetters(word){return [...String(word)].reverse().filter(ch=>ch.trim()).map(ch=>SPELL_NAMES[ch]||ch);}
let voiceOn=localStorage.getItem("buzzerVoice")!=="off",voiceAvailable=true;
const HOST_LINES={
 intro:["يلا نبدأ جولة جديدة، ركزوا معايا!","السؤال ده محتاج عين صقر!","النتيجة ممكن تتقلب من السؤال ده!","مين معانا جاهز للخطفة؟","العين على الجرس يا أبطال!","هنا في معلومة مش أي حد يعرفها!","ورّونا مين فاكر ومين هيخمّن!","خدوا بالكم، سؤال يستاهل التركيز!","مش عاوز أشوف حد سرحان!","نبدأ تحدي جديد، جاهزين؟","ممكن حد يقلب النتيجة دلوقتي!","سؤال جديد، وخليكم أسرع من بعض!","يلا ورّونا الشطارة!","التركيز بقى يا نجوم، اللعب سخن!"],
 correct:["يا سلام! إجابة مظبوطة!","برافو يا نجم، النقطة دي مستحقة!","إيه الدقة دي! إجابة صح!","جبتها في الجون!","أيوه كده، شغل عالي!","كنت واثق إنك هتعرفها!","برافو عليك، النقطة في جيبك!","إجابة قوية، تستاهل!","ياااه، هو ده الكلام!","صحيح، مبروك النقطة!","أنت صاحي معانا أهو!","قلبت السؤال لصالحك!"],
 wrong:["يا خسارة! دي مش الإجابة!","لأ لأ، ركز المرة الجاية!","أوف، مش دي يا بطل!","المعلومة دي لسه مش مظبوطة!","ولا يهمك، خد بالك في اللي جاي!","كانت محاولة جريئة، بس غلط!","يا ساتر، الإجابة دي وقعتنا!","مش هي دي، نكمل المنافسة!","المرادي الحظ ما ساعدكش!","إجابة مش موفقة، لكن لسه في فرص!"],
 timeout:["الوقت جري منك يا نجم!","مفيش إجابة؟ الثواني خلصت!","الحكم مش هيستنى أكتر من كده!","كنت محتاج ترد أسرع شوية!","خلص الوقت، يلا نرجع للمنافسة!","الساعة سبقتك المرة دي!","يا خسارة، الفرصة راحت!"],
 buzz:["مين خطف الجرس مننا؟","ياااه، دي سرعة إيه دي!","الجرس اتخطف يا جماعة!","يا سلام، عندنا متسابق جريء!","إيد سريعة على الجرس!","صاحبنا هنا سبق الباقيين!","رن الجرس، كله يركز!","أهو حد قال أنا لها!"],
 start:["الجرس مفتوح، ورّونا شطارتكم!","الجرس جاهز، مين الأسرع؟","يلا، اسبقوا الاختيارات!","أول واحد يضغط يجاوب!","الجرس معاكم من دلوقتي!"],
 retry:["هنسمع الاختيارات من أولها!","فرصة تانية، نفس السؤال!","نرجع نسمع الاختيارات تاني!","لسه في فرصة لحد ما السؤال يخلص!","الجرس رجع، مين هيخطفها؟","المنافسة لسه مفتوحة!"],
 nobuzz:["فين الناس؟ محدش ضغط!","الوقت خلص والجرس مستني!","واضح إن السؤال حيّر الكل!","محدش دخل السباق المرة دي!"],
 skip:["ماشي، نسيب السؤال ده!","الحكم قرر يعدي السؤال!","نروح لسؤال جديد، يلا!"],
 finish:["ألف مبروك، عندنا فائز!","النهارده في نجم كسب الحلقة!","دي كانت منافسة نار!","الجرس حسمها، مبروك!"]
};
const hostHistory=Object.create(null);
function hostLine(kind){
 const lines=HOST_LINES[kind]||HOST_LINES.intro;
 const prev=hostHistory[kind]??-1;
 const jump=lines.length>1?1+Math.floor(Math.random()*(lines.length-1)):1;
 const i=(prev+jump)%lines.length;
 hostHistory[kind]=i;
 return lines[i];
}
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
 openBuzz(); // The buzzer is available immediately after the question ends.
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
 if(packet.t==="skipRequest"){
   if(["announce","question","answer","result"].includes(state.phase)){
     state.skipRequests=state.skipRequests||[];
     if(!state.skipRequests.includes(seatNo)){
       state.skipRequests.push(seatNo);
       state.msg="⏭️ "+player.name+" طلب تخطي السؤال. صاحب الغرفة يقدر يوافق.";
       bump();
     }
   }
 }
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
   const was=state?.buzzId||0,hadState=!!state;
   const changed=!state||m.s.version!==lastVersion;
   state=m.s;
   if(hadState && state.phase==="answer" && state.buzzId>was)ringBell();
   if(changed){lastVersion=state.version;renderGame();}else updateTimerUI();
   return;
  }
 }
 if(type==="ttsStatus"||type==="voiceStatus"){voiceAvailable=detail==="ready";if(!state)renderHome();return;}
 if(type==="speechDone"){questionVoiceFinished(true,detail);return;}
 if(type==="choiceDone"){choiceVoiceDone(detail);return;}
 if(type==="choiceUnavailable"){voiceAvailable=false;choiceVoiceDone(detail);return;}
 if(type==="speechUnavailable"){voiceAvailable=false;questionVoiceFinished(false,detail);return;}
 if(type==="error"){showError(detail);return;}
 if(type==="disconnected"){online=false;host=false;seat=null;state=null;showError(detail||"انقطع اتصال البلوتوث");return;}
};
function selectNewQuestion(){
 const requested=difficultyByScore(state.players.map(p=>p.score));
 const eligible=state.category===CAT_ALL?CAT_KEYS.filter(cat=>cat!=="🔄 كلمة مقلوبة"||voiceOn&&voiceAvailable):[state.category];
 const pool=[];
 for(const cat of eligible){
  const rows=QUESTIONS[cat]||[];
  for(let i=0;i<rows.length;i++){
   const tier=tagTier(cat,i);
   pool.push({cat,row:rows[i],tier,key:cat+"#"+i});
  }
 }
 if(!pool.length)return null;
 const order=requested==="hard"?["hard","medium","easy"]:requested==="medium"?["medium","easy","hard"]:["easy","medium","hard"];
 let candidates=[];
 for(const tier of order){candidates=pool.filter(x=>x.tier===tier&&!usedQuestions.has(x.key));if(candidates.length)break;}
 if(!candidates.length){
  for(const tier of order){candidates=pool.filter(x=>x.tier===tier);if(candidates.length)break;}
  for(const item of candidates)usedQuestions.delete(item.key);
 }
 if(!candidates.length)return null;
 if(state.category===CAT_ALL){
  const entertainment=candidates.filter(x=>ENTERTAINMENT_CATS.includes(x.cat));
  const everythingElse=candidates.filter(x=>!ENTERTAINMENT_CATS.includes(x.cat));
  if(entertainment.length&&everythingElse.length)
    candidates=Math.random()<.62?entertainment:everythingElse;
 }
 const item=candidates[Math.floor(Math.random()*candidates.length)];
 usedQuestions.add(item.key);
 const reversed=item.cat==="🔄 كلمة مقلوبة";
 privateReverseLetters=reversed?spelledLetters(item.row[0]):[];
 const row=reversed?["🎧 اسمع الحروف من الحكم، وركّب الكلمة بالمقلوب.",...item.row]:item.row.slice();
 const options=row.slice(1).map((value,i)=>({value,correct:i===0}));
 for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
 answerIndex=options.findIndex(x=>x.correct);
 return {cat:item.cat,q:row[0],options:options.map(x=>x.value),audioOnly:reversed,tier:item.tier};
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
 state.wrongChoices=[];state.answerTimeouts=0;state.optionsShown=false;state.optionsShownCount=0;
 state.choiceCycle=0;state.retry=false;state.skipRequests=[];
 state.buzzId=state.buzzId||0;
 nextRevealAt=0;choiceSpeaking=false;buzzOpenedAt=0;
 speechWatchdogAt=Date.now()+ANNOUNCE_SEC*1000;
 state.deadline=0;state.remaining=0;state.speechOver=false;
 state.msg="🎙️ الحكم بيقرأ السؤال، والجرس مخفي لحد ما يخلص.";
 bump();
 const intro=hostLine("intro",state.round)+" السؤال رقم "+state.round+". ";
 speakQuestion(intro+(state.question.audioOnly?"دلوقتي كلمة مقلوبة. ركزوا في الحروف بالترتيب.":state.question.q),state.round);
}
function revealNextChoice(){
 if(!host||!state||state.phase!=="question"||!nextRevealAt||Date.now()<nextRevealAt)return;
 if(choiceSpeaking&&Date.now()<choiceSpeechDeadline)return;
 if(choiceSpeaking){try{Native.stopSpeech();}catch(e){} choiceSpeaking=false;}
 const shown=state.optionsShownCount||0;
 if(shown>=4){nextRevealAt=0;return;}
 const step=shown+1;
 state.optionsShownCount=step;state.optionsShown=step===4;
 state.msg=step===4?"👀 الاختيارات الأربعة ظهرت. مين أسرع واحد؟":"🎧 الحكم بيقول الاختيار "+step+" من 4. الجرس مفتوح!";
 if(voiceOn&&voiceAvailable){
  const token=state.round+"."+state.choiceCycle+"."+step;
  choiceSpeaking=true;
  choiceSpeechDeadline=Date.now()+Math.max(2300,Math.min(8000,1600+String(state.question.options[step-1]).length*130));
  nextRevealAt=choiceSpeechDeadline;
  try{Native.speakChoice(["الاختيار ألف: ","الاختيار باء: ","الاختيار جيم: ","الاختيار دال: "][step-1]+state.question.options[step-1],token);}
  catch(e){choiceSpeaking=false;nextRevealAt=Date.now()+1300;}
 }else{choiceSpeaking=false;nextRevealAt=step<4?Date.now()+1450:0;}
 bump();
}
function choiceVoiceDone(token){
 if(!host||!state||state.phase!=="question"||!choiceSpeaking)return;
 if(String(token)!==state.round+"."+state.choiceCycle+"."+state.optionsShownCount)return;
 choiceSpeaking=false;
 nextRevealAt=state.optionsShownCount<4?Date.now()+CHOICE_REVEAL_STEP_MS:0;
}
function openBuzz(){
 if(!host||!state||state.phase!=="announce"||!state.speechOver)return;
 buzzOpenedAt=Date.now();
 state.phase="question";state.deadline=buzzOpenedAt+QUIZ_SEC*1000;state.remaining=QUIZ_SEC;
 state.msg="🔔 "+hostLine("start")+" الاختيارات هتتقال واحدة واحدة.";
 startChoiceCycle();bump();
}
function startChoiceCycle(){
 state.choiceCycle=(state.choiceCycle||0)+1;
 state.optionsShown=false;state.optionsShownCount=0;
 choiceSpeaking=false;choiceSpeechDeadline=0;nextRevealAt=Date.now()+200;
 try{Native.stopSpeech();}catch(e){}
}
function claimBuzz(who){
 if(!host||!state||state.phase!=="question"||state.lockedSeat!==null||Date.now()>state.deadline)return;
 const p=state.players.find(x=>x.seat===who&&x.online);if(!p)return;
 const rush=(Date.now()-buzzOpenedAt)<=FAST_BUZZ_MS;
 state.fastBuzz=rush;state.answerWindowSec=rush?FAST_ANSWER_SEC:ANSWER_SEC;
 state.lockedSeat=who;state.phase="answer";
 nextRevealAt=0;choiceSpeaking=false;state.choiceCycle++; // invalidate old TTS callbacks
 try{Native.stopSpeech();}catch(e){}
 state.buzzId=(state.buzzId||0)+1;
 state.deadline=Date.now()+state.answerWindowSec*1000;state.remaining=state.answerWindowSec;
 state.msg="🔔 "+p.name+(rush?" خطف الجرس! قدامه 6 ثواني؛ الغلط −2":" سبق الجميع! قدامه 12 ثانية؛ الغلط −1");
 haptic();ringBell();speak(hostLine("buzz")+" "+p.name+"، اتفضل جاوب!");
 bump();
}
function pressBuzzer(){
 if(!state||state.phase!=="question"||!online||seat===null)return;
 if(Date.now()-lastTapAt<350)return;
 lastTapAt=Date.now();
 haptic();
 if(host)claimBuzz(seat);else send({t:"buzz"});
}
function selectOption(i){
 if(!state||state.phase!=="answer"||seat!==state.lockedSeat)return;
 if(!Number.isInteger(i)||i<0||i>3||state.wrongChoices?.includes(i))return;
 if(host)submitAnswer(seat,i);else send({t:"choice",i});
}
function submitAnswer(who,i){
 if(!host||!state||state.phase!=="answer"||state.lockedSeat!==who)return;
 if(!Number.isInteger(i)||i<0||i>=4||state.wrongChoices?.includes(i)||Date.now()>state.deadline)return;
 resolveAnswer(i===answerIndex,i,false);
}
function resolveAnswer(isCorrect,choice,timedout=false){
 if(!host||!state||!["answer","question"].includes(state.phase))return;
 const currentPhase=state.phase;
 const p=state.players.find(x=>x.seat===state.lockedSeat);
 const answer=state.question?.options[answerIndex]||"—";
 let msg,delta=0;
 const validPick=!!p&&Number.isInteger(choice)&&choice>=0&&choice<4;
 if(validPick && !isCorrect && !state.wrongChoices.includes(choice)){
   state.wrongChoices.push(choice);
 }
 if(p && timedout)state.answerTimeouts=(state.answerTimeouts||0)+1;
 if(!p){msg="⏰ "+hostLine("nobuzz")+" نبدأ سؤال جديد."; }
 else{
  delta=isCorrect?1:(state.fastBuzz?-2:-1);p.score+=delta;
  const loss=Math.abs(delta);
  msg=isCorrect?hostLine("correct",state.round)+" نقطة لـ "+p.name:
   timedout?hostLine("timeout")+" "+p.name+" خسر "+loss+(loss===2?" نقطتين":" نقطة"):
   hostLine("wrong",state.round)+" "+p.name+" خسر "+loss+(loss===2?" نقطتين":" نقطة");
 }
 const wrongCount=state.wrongChoices.length;
 const endQuestion=!p||isCorrect||wrongCount>=2||state.answerTimeouts>=3;
 const again=!!p&&!endQuestion;
 if(wrongCount>=2&&!isCorrect)msg+=". ❌ اختيارين غلط، السؤال انتهى إجباريًا.";
 else if(again)msg+=". 🔄 "+hostLine("retry")+" أي حد يقدر يحاول!";
 if(p&&timedout&&again)msg+=" حتى نفس المتسابق.";
 state.phase="result";state.remaining=again?RETRY_SEC:RESULT_SEC;
 state.deadline=Date.now()+state.remaining*1000;
 state.result={
  name:p?.name||"مفيش حد",seat:p?.seat??-1,delta,correct:endQuestion?answer:null,
  chosen:validPick?state.question.options[choice]:null,chosenIndex:validPick?choice:null,
  ok:!!p&&isCorrect,fast:!!p&&state.fastBuzz,retry:again,ended:endQuestion,
  wrongCount,skipped:false
 };
 state.msg=msg;
 speak(msg+(endQuestion?". الإجابة الصحيحة: "+answer:""));
 sfx(isCorrect?"ok":"bad");bump();
}
function reopenBuzz(){
 if(!host||!state||state.phase!=="result"||!state.result?.retry)return;
 state.phase="question";state.lockedSeat=null;
 state.fastBuzz=false;state.answerWindowSec=ANSWER_SEC;state.retry=true;
 buzzOpenedAt=Date.now();state.deadline=buzzOpenedAt+QUIZ_SEC*1000;state.remaining=QUIZ_SEC;
 state.result=null;state.skipRequests=[];
 state.msg="🔔 "+hostLine("retry")+" الجرس فتح تاني والاختيارات هتتقال من الأول.";
 startChoiceCycle();bump();
}
function advanceRound(){
 if(!host||!state||state.phase!=="result")return;
 if(state.result?.retry)reopenBuzz();
 else newRound();
}
function skipQuestion(){
 if(!host||!state||!["announce","question","answer","result"].includes(state.phase))return;
 const correct=state.question?.options[answerIndex]||"—";
 nextRevealAt=0;choiceSpeaking=false;
 try{Native.stopSpeech();}catch(e){}
 state.phase="result";state.remaining=3;state.deadline=Date.now()+3000;
 state.result={skipped:true,seat:-1,ok:false,delta:0,correct,chosen:null,retry:false,ended:true};
 state.msg="⏭️ "+hostLine("skip")+" هنروح للي بعده.";
 speak(state.msg);bump();
}
function requestSkip(){
 if(!state||!["announce","question","answer","result"].includes(state.phase))return;
 if(host){skipQuestion();return;}
 if(!online||seat===null)return;
 send({t:"skipRequest"});
 try{haptic();}catch(e){}
}
function resetToLobby(){
 if(!host||!state)return;
 state.phase="lobby";state.round=0;state.winner=null;state.result=null;state.question=null;state.lockedSeat=null;state.players.forEach(p=>p.score=0);
 state.msg="هنبدأ حلقة جديدة";usedQuestions.clear();
 state.wrongChoices=[];state.skipRequests=[];state.optionsShown=false;state.optionsShownCount=0;state.choiceCycle=0;state.buzzId=0;
 bump();
}
function tick(){
 if(!host||!state)return;
 const phase=state.phase,now=Date.now();
 if(phase==="announce"){
  if(!state.speechOver&&now>=speechWatchdogAt)questionVoiceFinished(false,state.round);
  return;
 }
 if(phase==="question"&&nextRevealAt&&now>=nextRevealAt)revealNextChoice();
 if(!["question","answer","result"].includes(phase))return;
 const remaining=Math.max(0,Math.ceil((state.deadline-now)/1000));
 if(remaining!==state.remaining){state.remaining=remaining;sync();updateTimerUI();}
 if(now<state.deadline)return;
 if(phase==="question")resolveAnswer(false,null,true);
 else if(phase==="answer")resolveAnswer(false,null,true);
 else if(phase==="result")advanceRound();
}
setInterval(tick,200);
