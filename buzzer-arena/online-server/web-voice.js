"use strict";
/* من دماغك: browser Arabic spoken questions + sound effects; NO voice chat or microphone. */
(function(){
 const synth=window.speechSynthesis;
 let active=null,lastGuestRound="",lastGuestResult="",doneTimer=null;
 const complete=round=>{if(round!==undefined&&typeof window.onNative==="function")window.onNative("speechDone",String(round));};
 function stop(){
  if(doneTimer){clearTimeout(doneTimer);doneTimer=null;}
  if(synth)try{synth.cancel();}catch(e){}
  active=null;
 }
 function pickVoice(){
  if(!synth)return null;
  const voices=synth.getVoices()||[];
  return voices.find(v=>/^ar[-_](EG|SA)/i.test(v.lang))||voices.find(v=>/^ar/i.test(v.lang))||null;
 }
 function say(text,round=null){
  stop();
  if(!voiceOn||!synth||typeof window.SpeechSynthesisUtterance!=="function"){if(round!==null)complete(round);return;}
  const input=String(text||"").slice(0,430);
  if(!input.trim()){if(round!==null)complete(round);return;}
  const u=new SpeechSynthesisUtterance(input);
  u.lang="ar-EG";u.rate=0.97;u.pitch=1;u.volume=1;
  const v=pickVoice();if(v)u.voice=v;
  let finished=false;
  const done=()=>{if(finished)return;finished=true;if(doneTimer){clearTimeout(doneTimer);doneTimer=null;}if(round!==null)complete(round);};
  u.onend=done;u.onerror=done;
  active=u;
  doneTimer=setTimeout(()=>{try{synth.cancel();}catch(e){}done();},Math.max(5000,Math.min(22000,input.length*160+2500)));
  try{synth.resume?.();synth.speak(u);}catch(e){done();}
 }
 window.mdVoiceUnlock=function(){
  if(!synth)return;
  try{synth.getVoices();synth.resume?.();}catch(e){}
 };
 window.Native.speak=(text)=>say(text);
 window.Native.speakMood=(text)=>say(text);
 window.Native.speakQuestion=(text,round)=>say(text,String(round));
 window.Native.speakChoice=(text)=>say(text);
 window.Native.spellQuestion=(text,letters,round)=>{
  let chars=[];try{chars=JSON.parse(letters);}catch(e){}
  say(chars.length?chars.join("، "):text,String(round));
 };
 window.Native.replayReverse=function(cue){if(!String(cue||"").trim())return false;if(!voiceOn||!synth||typeof window.SpeechSynthesisUtterance!=="function")return false;say(String(cue));return true;};
 window.Native.stopSpeech=stop;
 const original=window.onNative;
 window.onNative=function(type,detail){
  original(type,detail);
  if(!voiceOn||host||type!=="message")return;
  let packet;try{packet=JSON.parse(detail);}catch(e){return;}
  if(packet?.t!=="state"||!packet.s)return;
  const s=packet.s;
  if(s.phase==="announce"&&s.question){
   const unique=String(s.roomCode||"")+"-"+s.round;
   if(lastGuestRound!==unique){lastGuestRound=unique;say(s.question.audioOnly?s.question.audioCue:s.question.q);}
  }else if(s.phase==="result"&&s.result){
   const unique=String(s.roomCode||"")+"-"+s.round+"-"+s.result.seat+"-"+s.result.retry;
   if(lastGuestResult!==unique){
    lastGuestResult=unique;
    if(soundOn)try{sfx(s.result.ok?"ok":"bad");}catch(e){}
    say(s.result.ok?"صح!":"غلط!");
   }
  }
 };
})();