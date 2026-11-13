"use strict";
const root=document.getElementById("root");
const CAT_ALL="🌟 منوعات",CAT_KEYS=Object.keys(QUESTIONS),ICONS=["🔵","🩷","🟡","🟣"];
const QUIZ_SEC=15,ANSWER_SEC=12,ANNOUNCE_SEC=6,RESULT_SEC=4,WIN_AT=10;
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const clean=s=>String(s??"").trim().replace(/[\r\n\t]+/g," ").slice(0,18)||"لاعب";
const format=n=>Math.max(0,n|0);
const cfg={name:localStorage.getItem("buzzerName")||"لاعب 1",target:2,category:CAT_ALL};
let host=false,seat=null,online=false,pending="",devices=[],state=null,answerIndex=-1;
let usedQuestions=new Set(),lastVersion=-1,soundOn=true;
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
function speak(s){if(host)try{Native.speak(String(s))}catch(e){}}
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
 if(type==="error"){showError(detail);return;}
 if(type==="disconnected"){online=false;host=false;seat=null;state=null;showError(detail||"انقطع اتصال البلوتوث");return;}
};
function selectNewQuestion(){
 let possible=[];
 const cats=state.category===CAT_ALL?CAT_KEYS:[state.category];
 for(const cat of cats){
  QUESTIONS[cat].forEach((row,i)=>{const key=cat+"#"+i;if(!usedQuestions.has(key))possible.push({cat,row,key});});
 }
 if(!possible.length){
  usedQuestions.clear();
  for(const cat of cats)QUESTIONS[cat].forEach((row,i)=>possible.push({cat,row,key:cat+"#"+i}));
 }
 const item=possible[Math.floor(Math.random()*possible.length)];
 usedQuestions.add(item.key);
 let row=item.row.slice();
 if(item.cat==="🔄 كلمة مقلوبة"){
  const word=[...row[0]].reverse().join("");
  row=["اقرأ الكلمة دي بالمقلوب: "+word,...row];
 }
 const options=row.slice(1).map((value,i)=>({value,correct:i===0}));
 for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
 answerIndex=options.findIndex(x=>x.correct);
 return {cat:item.cat,q:row[0],options:options.map(x=>x.value)};
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
  state.phase="finished";state.winner=winner.seat;state.msg="مبروك "+winner.name+"! كسب الحلقة";
  speak(state.msg);sfx("win");bump();return;
 }
 state.round++;
 state.phase="announce";state.question=selectNewQuestion();state.lockedSeat=null;state.result=null;
 state.deadline=Date.now()+ANNOUNCE_SEC*1000;state.remaining=ANNOUNCE_SEC;
 state.msg="الحكم بيقرأ السؤال، جهّزوا إيديكم على الجرس";
 speak("السؤال رقم "+state.round+". "+state.question.q);
 bump();
}
function openBuzz(){
 if(!host||!state||state.phase!=="announce")return;
 state.phase="question";state.deadline=Date.now()+QUIZ_SEC*1000;state.remaining=QUIZ_SEC;state.msg="الجرس مفتوح! أسرع واحد يضغط";
 sfx("ok");bump();
}
function claimBuzz(who){
 if(!host||!state||state.phase!=="question"||state.lockedSeat!==null||Date.now()>state.deadline)return;
 const p=state.players.find(x=>x.seat===who&&x.online);if(!p)return;
 state.lockedSeat=who;state.phase="answer";state.deadline=Date.now()+ANSWER_SEC*1000;state.remaining=ANSWER_SEC;
 state.msg=p.name+" سبق الجميع! اختار إجابتك";
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
 else{delta=isCorrect?1:-1;p.score+=delta;
   msg=isCorrect?"إجابة صح! نقطة لـ "+p.name:timedout?"الوقت خلص يا "+p.name+"، خسر نقطة":"إجابة غلط يا "+p.name+"، خسر نقطة";
 }
 state.phase="result";state.remaining=RESULT_SEC;state.deadline=Date.now()+RESULT_SEC*1000;
 state.result={name:p?.name||"مفيش حد",seat:p?.seat??-1,delta,correct:answer,chosen:choice===null?null:state.question.options[choice],ok:!!p&&isCorrect};
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
 const phase=state.phase;
 if(!["announce","question","answer","result"].includes(phase))return;
 const now=Date.now(),remaining=Math.max(0,Math.ceil((state.deadline-now)/1000));
 if(remaining!==state.remaining){state.remaining=remaining;sync();updateTimerUI();}
 if(now<state.deadline)return;
 if(phase==="announce")openBuzz();
 else if(phase==="question"){resolveAnswer(false,null,true);}
 else if(phase==="answer"){resolveAnswer(false,null,true);}
 else if(phase==="result")advanceRound();
}
setInterval(tick,260);
