"use strict";
// «من دماغك» — turn-based rules layered over the existing Bluetooth/online transport.
// The host remains authoritative for selecting questions, judging responses and scoring.
const MD_PICK_SEC=25,MD_FREE_SEC=26,MD_CHOICE_SEC=18,MD_DAILY_SEC=42,MD_RESULT_SEC=5;
let mdBotChooseAt=0,mdBotRespondAt=0;
function mdNextSeat(after){
 const seats=state.players.filter(p=>p.online).map(p=>p.seat).sort((a,b)=>a-b);
 if(seats.length<2)return null;
 return seats[(seats.indexOf(after)+1)%seats.length];
}
function mdCurrentPlayer(){return state?.players.find(p=>p.seat===state.lockedSeat);}
function mdOnlyText(){return !!state?.question?.daily || (state?.question?.options?.length||0)<2;}
startMatch=function(){
 if(!host||!state||!allReady()||state.phase!=="lobby")return;
 state.players.forEach(p=>p.score=0);
 state.round=0;state.turnCursor=0;state.clutchRecapRead=false;state.matchRecorded=false;
 if(typeof refreshRivalry==="function")refreshRivalry();
 usedQuestions.clear();newRound();
};
newRound=function(){
 if(!host||!state)return;
 const winner=state.players.find(p=>p.score>=WIN_AT);
 if(winner){
  state.phase="finished";state.winner=winner.seat;state.msg="🏆 "+winner.name+" وصل لـ10 نقاط وكسب!";
  if(typeof saveDuelResult==="function")saveDuelResult();
  speak("مبروك يا "+winner.name,"winner");sfx("win");bump();return;
 }
 state.round++;state.turnCursor=Number.isInteger(state.turnCursor)?state.turnCursor:0;
 const ordered=state.players.filter(p=>p.online).sort((a,b)=>a.seat-b.seat);
 const owner=ordered[state.turnCursor%ordered.length];state.turnCursor++;
 state.turnSeat=owner.seat;state.lockedSeat=owner.seat;
 state.phase="announce";state.question=selectNewQuestion();state.result=null;
 state.stealStage=false;state.pendingStealSeat=null;state.answerMode=null;
 state.wrongChoices=[];state.wrongAttempts=0;state.wrongTexts=[];state.skipRequests=[];
 state.optionsShown=false;state.optionsShownCount=0;state.fastBuzz=false;state.retry=false;
 state.choiceCycle=0;state.answerWindowSec=MD_PICK_SEC;
 state.remaining=0;state.deadline=0;state.speechOver=false;
 speechWatchdogAt=Date.now()+ANNOUNCE_SEC*1000;
 nextRevealAt=0;choiceSpeaking=false;mdBotChooseAt=0;mdBotRespondAt=0;
 state.msg="🧠 دور "+owner.name+". اختار تجاوب من دماغك أو تظهر الاختيارات.";
 bump();speakQuestion((state.question.audioOnly?"اسمع الحروف وركّب الكلمة. ":"")+state.question.q,state.round);
};
function mdOpenTurn(){
 if(!host||!state||state.phase!=="announce")return;
 state.phase="question";state.answerMode=null;state.optionsShownCount=0;
 state.answerWindowSec=MD_PICK_SEC;state.remaining=MD_PICK_SEC;
 state.deadline=Date.now()+MD_PICK_SEC*1000;
 state.msg="🎯 دور "+mdCurrentPlayer()?.name+" — اختار طريقة إجابتك.";
 mdScheduleBot();bump();
}
openBuzz=mdOpenTurn; // Android TTS completion continues to call openBuzz() in the legacy core.
function chooseAnswerMode(mode){
 if(!state||state.phase!=="question"||seat!==state.lockedSeat||!online)return;
 if(host)mdApplyMode(seat,mode);else send({t:"mode",mode});
}
function mdApplyMode(who,mode){
 if(!host||!state||state.phase!=="question"||state.lockedSeat!==who||Date.now()>state.deadline)return;
 if(mode!=="text"&&mode!=="choice")return;
 if(mode==="choice"&&mdOnlyText())return;
 state.phase="answer";state.answerMode=mode;
 state.optionsShownCount=mode==="choice"?state.question.options.length:0;
 state.optionsShown=mode==="choice";
 state.answerWindowSec=mode==="choice"?MD_CHOICE_SEC:(mdOnlyText()?MD_DAILY_SEC:MD_FREE_SEC);
 state.remaining=state.answerWindowSec;state.deadline=Date.now()+state.answerWindowSec*1000;
 state.msg=(mode==="choice"?"🃏 "+mdCurrentPlayer().name+" طلب الاختيارات (+1 / −2)":"🧠 "+mdCurrentPlayer().name+" بيجاوب من دماغه (+2 / −1)");
 if(mdCurrentPlayer().bot)mdBotRespondAt=Date.now()+1200+Math.floor(Math.random()*1300);
 bump();
}
// Replace only the new mode packet; unchanged hello/typed/choice/skipPackets still use the original relay.
const mdOriginalHandleRemote=handleRemote;
handleRemote=function(info){
 if(!host||!state)return;
 let packet;try{packet=JSON.parse(info.msg);}catch(e){return;}
 if(packet.t==="mode"){
  const player=state.players.find(p=>p.seat===Number(info.seat)&&p.online);
  if(player)mdApplyMode(player.seat,packet.mode);
  return;
 }
 if(packet.t==="buzz")return; // Ignore old-client buzzer requests; no race to tap.
 mdOriginalHandleRemote(info);
};
pressBuzzer=function(){}; // Removed entirely from UI and logic.
selectOption=function(i){
 if(!state||state.phase!=="answer"||state.answerMode!=="choice"||seat!==state.lockedSeat)return;
 if(!Number.isInteger(i)||i<0||i>=state.optionsShownCount||state.wrongChoices.includes(i))return;
 if(host)submitAnswer(seat,i);else send({t:"choice",i});
};
submitAnswer=function(who,i){
 if(!host||!state||state.phase!=="answer"||state.answerMode!=="choice"||state.lockedSeat!==who||Date.now()>state.deadline)return;
 if(!Number.isInteger(i)||i<0||i>=state.question.options.length||state.wrongChoices.includes(i))return;
 resolveAnswer(i===answerIndex,i,false);
};
submitTypedFromUI=function(){
 if(!state||state.phase!=="answer"||state.answerMode!=="text"||state.lockedSeat!==seat)return false;
 const field=document.getElementById("typedAnswer"),text=String(field?.value||"").trim();
 if(!text||text.length>85){if(field){field.placeholder="اكتب إجابة قصيرة الأول";field.focus();}return false;}
 if(host)submitTypedAnswer(seat,text);else send({t:"typed",text});
 if(field){field.disabled=true;field.blur();}return false;
};
submitTypedAnswer=function(who,text){
 if(!host||!state||state.phase!=="answer"||state.answerMode!=="text"||state.lockedSeat!==who||Date.now()>state.deadline)return;
 if(typeof text!=="string"||!text.trim()||text.length>85)return;
 const expected=state.question.options[answerIndex];
 resolveAnswer(answerMatches(text.trim(),expected),null,false,text.trim());
};
resolveAnswer=function(isCorrect,choice,timedout=false,typedAnswer=null){
 if(!host||!state||!["question","answer"].includes(state.phase))return;
 const p=mdCurrentPlayer(),mode=state.answerMode||"text";
 if(!p)return;
 const validPick=Number.isInteger(choice)&&choice>=0&&choice<state.question.options.length;
 const answer=state.question.options[answerIndex]||"—";
 const delta=isCorrect?(mode==="choice"?1:2):(mode==="choice"?-2:-1);
 p.score+=delta;
 if(!isCorrect){state.wrongAttempts=(state.wrongAttempts||0)+1;
  if(validPick&&!state.wrongChoices.includes(choice))state.wrongChoices.push(choice);
 }
 const next=!isCorrect&&!state.stealStage?mdNextSeat(p.seat):null;
 const retry=next!==null;
 state.pendingStealSeat=retry?next:null;
 const name=state.players.find(x=>x.seat===next)?.name||"المنافس";
 const correctVisible=!retry;
 state.phase="result";state.remaining=MD_RESULT_SEC;state.deadline=Date.now()+MD_RESULT_SEC*1000;
 state.result={name:p.name,seat:p.seat,delta,correct:correctVisible?answer:null,
  chosen:typedAnswer!==null?String(typedAnswer):validPick?state.question.options[choice]:null,
  chosenIndex:validPick?choice:null,typed:typedAnswer!==null,ok:!!isCorrect,
  retry,ended:!retry,skipped:false,mode,steal:!!state.stealStage,timedout:!!timedout};
 state.msg=isCorrect?"✅ صح يا "+p.name+"! "+(delta===2?"نقطتين":"نقطة")+" ليك.":
  (timedout?"⏰ وقت "+p.name+" خلص":"❌ إجابة "+p.name+" غلط")+
  ". "+(delta===-2?"اتخصم نقطتين":"اتخصمت نقطة")+
  (retry?". 🔄 فرصة خطف واحدة لـ"+name:". السؤال انتهى.");
 speak(isCorrect?"صح":timedout?"الوقت خلص":"غلط",isCorrect?"praise":"normal");
 sfx(isCorrect?"ok":"bad");bump();
};
function mdOpenSteal(){
 if(!host||!state||state.phase!=="result"||!state.result?.retry||state.pendingStealSeat===null)return;
 state.lockedSeat=state.pendingStealSeat;state.pendingStealSeat=null;
 state.stealStage=true;state.phase="question";state.answerMode=null;state.optionsShownCount=0;
 state.optionsShown=false;state.result=null;state.retry=true;
 state.remaining=MD_PICK_SEC;state.answerWindowSec=MD_PICK_SEC;
 state.deadline=Date.now()+MD_PICK_SEC*1000;
 state.msg="🔥 فرصة خطف واحدة لـ"+mdCurrentPlayer().name+"!";
 mdScheduleBot();bump();
}
advanceRound=function(){
 if(!host||!state||state.phase!=="result")return;
 if(state.result?.retry)mdOpenSteal();else newRound();
};
skipQuestion=function(){
 if(!host||!state||!["announce","question","answer","result"].includes(state.phase))return;
 const correct=state.question?.options[answerIndex]||"—";
 nextRevealAt=0;choiceSpeaking=false;mdBotChooseAt=0;mdBotRespondAt=0;
 try{Native.stopSpeech();}catch(e){}
 state.phase="result";state.remaining=3;state.deadline=Date.now()+3000;
 state.result={skipped:true,seat:-1,ok:false,delta:0,correct,chosen:null,retry:false,ended:true};
 state.msg="⏭️ اتخطينا السؤال. ننتقل للدور اللي بعده.";bump();
};
const mdOriginalReset=resetToLobby;
resetToLobby=function(){mdOriginalReset();if(!state)return;state.turnCursor=0;state.stealStage=false;state.pendingStealSeat=null;};
// Guests never receive unrevealed choice text while an opponent is using free response.
sync=function(draw=false){
 if(!host||!state)return;
 const publicState=JSON.parse(JSON.stringify(state));
 if(publicState.question?.options){
  const show=(publicState.phase==="answer"&&publicState.answerMode==="choice")||
   (publicState.phase==="result"&&publicState.result?.ended);
  publicState.question.options=publicState.question.options.map(v=>show?v:"");
 }
 send({t:"state",s:publicState});
 if(draw){lastVersion=state.version;renderGame();}
};
function mdScheduleBot(){
 mdBotChooseAt=0;mdBotRespondAt=0;
 const bot=mdCurrentPlayer();
 if(host&&state&&bot?.bot&&bot.online&&roomMode==="online")mdBotChooseAt=Date.now()+1700;
}
botTick=function(){
 if(!host||!state||roomMode!=="online")return;
 const bot=mdCurrentPlayer();if(!bot?.bot)return;
 const now=Date.now();
 if(state.phase==="question"&&mdBotChooseAt&&now>=mdBotChooseAt){
  mdBotChooseAt=0;mdApplyMode(bot.seat,mdOnlyText()||Math.random()<.63?"text":"choice");return;
 }
 if(state.phase==="answer"&&mdBotRespondAt&&now>=mdBotRespondAt){
  mdBotRespondAt=0;
  const chance=({easy:.67,medium:.49,hard:.33}[state.question?.tier]??.44);
  const correct=Math.random()<chance;
  const wrong=state.question.options.findIndex((_,i)=>i!==answerIndex&&!state.wrongChoices.includes(i));
  if(state.answerMode==="choice")submitAnswer(bot.seat,correct?answerIndex:wrong);
  else submitTypedAnswer(bot.seat,correct?state.question.options[answerIndex]:"مش متأكد");
 }
};
tick=function(){
 if(!host||!state)return;
 botTick();
 const now=Date.now(),phase=state.phase;
 if(phase==="announce"){
  if(!state.speechOver&&now>=speechWatchdogAt)questionVoiceFinished(false,state.round);
  return;
 }
 if(!["question","answer","result"].includes(phase))return;
 const remaining=Math.max(0,Math.ceil((state.deadline-now)/1000));
 if(remaining!==state.remaining){state.remaining=remaining;sync();updateTimerUI();}
 if(now<state.deadline)return;
 if(phase==="result")advanceRound();else resolveAnswer(false,null,true);
};
previewVoice=function(){try{Native.speak("أهلاً بيكم في من دماغك! دور لكل لاعب، وإنت تختار تجاوب من دماغك أو بالاختيارات.")}catch(e){showError("تعذر تشغيل الصوت: "+e.message);}};
