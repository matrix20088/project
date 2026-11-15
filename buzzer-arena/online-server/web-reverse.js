"use strict";
/* Reversed words are an audio-only round. One replay on each device per question. */
(function(){
 const replayed=new Set();
 function key(){
  if(!state?.question?.audioOnly||!state.question.audioCue)return "";
  return String(state.roomCode||onlineRoomCode||"room")+"|"+String(state.round)+"|"+String(state.question.audioCue);
 }
 window.mdReplayReverse=function(){
  const k=key();
  if(!k||replayed.has(k)||!["question","answer"].includes(state.phase))return false;
  if(!voiceOn){if(typeof showError==="function")showError("فعّل صوت الحكم من الرئيسية علشان تسمع الحروف");return false;}
  const played=window.Native&&typeof Native.replayReverse==="function"&&Native.replayReverse(state.question.audioCue)===true;
  if(!played){if(typeof showError==="function")showError("المتصفح مش مفعّل فيه قراءة عربية. جرّب تشغيل الصوت من الرئيسية");return false;}
  replayed.add(k);
  const btn=document.getElementById("mdReplayReverse");
  if(btn){btn.disabled=true;btn.textContent="✅ استخدمت الإعادة الوحيدة";}
  return true;
 };
 const oldQuestion=renderQuestion;
 renderQuestion=function(){
  const html=oldQuestion();
  const k=key();
  if(!k||!["question","answer"].includes(state.phase))return html;
  const spent=replayed.has(k);
  const control='<div class="md-audio-replay">'
   +'<p>🎧 اسمع الحروف المعكوسة وحاول تعرف الكلمة. الحروف مش هتظهر على الشاشة.</p>'
   +'<button id="mdReplayReverse" type="button" class="btn secondary" onclick="mdReplayReverse()" '+(spent?'disabled':'')+'>'
   +(spent?'✅ استخدمت الإعادة الوحيدة':'🔁 اسمع الحروف تاني (مرة واحدة)')
   +'</button></div>';
  return html+control;
 };
})();
