"use strict";
/* Owner-only room directory and random matchmaking UI. The API enforces permissions. */
(function(){
 if(!CAT_KEYS.includes(cfg.category))cfg.category=CAT_KEYS[0];
 const originalHub=mdHubScreen;
 const originalAuth=mdAuthScreen;
 const originalRefresh=window.mdRefreshRooms;
 const originalRender=renderHome;
 let matching=false;
 const safeError=e=>esc(String(e?.message||"تعذر البحث عن منافس"));
 function voicePanel(){
  return '<section class="card web-audio" aria-label="إعدادات الصوت"><div><b>🎙️ صوت الحكم والأسئلة</b><small>قراءة عربية للأسئلة ومؤثرات الإجابة، من غير مايكروفون أو محادثات</small></div>'
   +'<div class="web-audio-actions"><button type="button" class="voiceToggle" onclick="mdToggleVoice()">'+(voiceOn?"🔊 شغّال":"🔇 مقفول")+'</button>'
   +'<button type="button" class="voiceToggle" onclick="mdTryVoice()">▶️ جرّب الصوت</button></div></section>';
 }
 mdAuthScreen=function(){
  return originalAuth().replace("بدون محادثات أو مكالمات صوتية","بدون شات أو مايكروفون، وصوت الحكم متاح");
 };
 mdHubScreen=function(){
  let html=originalHub();
  const isOwner=mdUser?.isOwner===true;
  // Seven categories only, no hidden arithmetic or all-topics selector in the dropdown.
  html=html.replace(/<option\b[^>]*value="🌟 منوعات"[^>]*>[^<]*<\/option>/g,"");
  if(isOwner){
   html=html.replace('<section class="card web-discover">','<section class="card web-discover"><button class="btn md-match" type="button" onclick="mdQuickMatch()">🎲 دور عشوائي ليا</button>');
   html=html.replace("العب مع ناس تانية","📂 الغرف المفتوحة");
   html=html.replace("شوف الغرف المفتوحة، ابحث باسم الغرفة أو رقمها، وانضم للعب.","الغرف التي لم تُغلق بعد، مع توضيح إذا كان صاحب الغرفة متصلًا أو انقطع. اضغط تحديث لمراجعة آخر حالة.");
  }else{
   const matchCard='<section class="card web-discover web-random"><div class="kicker">🎲 البحث العشوائي</div>'
    +'<h2>دور على منافس</h2><p class="desc">هندخّلك غرفة متاحة بشكل عشوائي من غير ترتيب ولا عرض أسماء الغرف. لو مفيش غرفة جاهزة، هنعملك غرفة انتظار تلقائيًا.</p>'
    +'<button type="button" class="btn md-match" onclick="mdQuickMatch()" '+(matching?"disabled":"")+'>'+(matching?"⏳ بندور على منافس...":"🎲 ابحث عن مباراة عشوائية")+'</button>'
    +'<div class="web-empty">🔀 البحث والتوزيع عشوائي، من غير قائمة غرف عامة.</div></section>';
   html=html.replace(/<section class="card web-discover">[\s\S]*?<\/section>/,matchCard);
  }
  html=html.replace(/<p class="web-foot">👥 ٢–٤ لاعبين[^<]*<\/p>/,voicePanel()+'<p class="web-foot">👥 ٢–٤ لاعبين · 🏆 أول ١٠ نقاط يفوز · 🔇 بدون محادثات</p>');
  return html;
 };
 window.mdRefreshRooms=function(silent=false){
  if(!mdUser?.isOwner)return Promise.resolve();
  return originalRefresh(silent);
 };
 window.mdToggleVoice=function(){
  voiceOn=!voiceOn;soundOn=voiceOn;
  localStorage.setItem("mdVoice",voiceOn?"on":"off");
  localStorage.setItem("buzzerVoice",voiceOn?"on":"off");
  window.mdVoiceUnlock?.();
  if(voiceOn)Native.speak("صوت الحكم اشتغل. يلا نلعب من دماغك!");
  originalRender();
 };
 window.mdTryVoice=function(){
  voiceOn=true;soundOn=true;
  localStorage.setItem("mdVoice","on");localStorage.setItem("buzzerVoice","on");
  window.mdVoiceUnlock?.();
  Native.speak("أهلاً بيكم في من دماغك! مين أول واحد يوصل عشر نقاط؟");
  originalRender();
 };
 window.mdQuickMatch=async function(){
  if(!mdUser||matching||online)return;
  matching=true;mdStatus="";window.mdRoomMatchMode="random";
  try{
   window.mdVoiceUnlock?.();
   const result=await mdAPI({action:"match"});
   if(result.code){mdJoinRoom(result.code);}
   else{
    cfg.target=2;cfg.bot=false;cfg.name=mdUser.name;roomMode="online";onlineRoomCode="";
    window.mdRoomTitle="🎲 مباراة عشوائية";
    Native.onlineCreate(2,false);
   }
  }catch(e){mdStatus=String(e?.message||"تعذر البحث، جرّب تاني");originalRender();}
  finally{matching=false;}
 };
 // The old hub forced sound off. Persist the player's browser setting instead.
 voiceOn=localStorage.getItem("mdVoice")!=="off";
 soundOn=voiceOn;
 localStorage.setItem("buzzerVoice",voiceOn?"on":"off");
 const oldCreate=window.mdCreateRoom;
 window.mdCreateRoom=function(){window.mdRoomMatchMode="friend";window.mdVoiceUnlock?.();return oldCreate();};
 const oldJoin=window.mdJoinRoom;
 window.mdJoinRoom=function(code){window.mdVoiceUnlock?.();return oldJoin(code);};
 // Owner alone can make a request for the directory. Everyone else never even tries.
 renderHome();
})();