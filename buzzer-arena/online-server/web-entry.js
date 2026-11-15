"use strict";
/* First-time web flow: two clear main actions, direct private room, random match and easy friend invitations. */
(function(){
 const launch=new URLSearchParams(window.location.search);
 let invited=/^[1-9][0-9]{5}$/.test(launch.get("room")||"")?launch.get("room"):null;
 let showJoin=!!invited,showOptions=false,actionPending=false;
 const originalHub=mdHubScreen,originalAuth=mdAuthScreen,originalLobby=renderLobby;
 const safeCode=x=>/^[1-9][0-9]{5}$/.test(String(x||""))?String(x):"";
 function saveTitle(){
  const el=document.getElementById("webTitle");
  if(el)mdRoomTitle=String(el.value||"").slice(0,40);
 }
 function actions(){
  const invitedMessage=invited?'<div class="md-invite-arrived" role="status">🎟️ وصلتك دعوة لغرفة <b>'+esc(invited)+'</b> — اضغط دخول برقم غرفة.</div>':'';
  return '<section class="md-entry-home" id="mdEntryHome" aria-label="ابدأ اللعب">'
   +'<div class="md-entry-kicker">✨ اختار طريقة اللعب</div>'
   +'<div class="md-entry-actions">'
   +'<button type="button" class="md-play-primary md-play-random" onclick="mdStartRandom()" '+(actionPending?'disabled':'')+'><span class="md-play-emoji">🎲</span><span><strong>العب عشوائي</strong><small>هنلاقي لك منافس، أو نستناك في غرفة تلقائيًا</small></span><span class="md-play-arrow">❮</span></button>'
   +'<button type="button" class="md-play-primary md-play-friend" onclick="mdStartFriend()" '+(actionPending?'disabled':'')+'><span class="md-play-emoji">👥</span><span><strong>العب مع صديق أونلاين</strong><small>غرفة خاصة ورقم من 6 أرقام تبعته لصاحبك</small></span><span class="md-play-arrow">❮</span></button></div>'
   +'<div class="md-entry-other">'
   +'<button type="button" onclick="mdOpenFriendCode()" aria-expanded="'+showJoin+'">🔑 معاك رقم غرفة؟ ادخل هنا</button>'
   +'<button type="button" onclick="mdToggleFriendOptions()" aria-expanded="'+showOptions+'">⚙️ تخصيص غرفة الأصحاب</button>'
   +'</div>'+invitedMessage
   +(showJoin?'<div class="md-join-panel" id="mdJoinPanel"><label for="mdFriendRoomCode">رقم غرفة صاحبك</label>'
      +'<form onsubmit="mdJoinByInvite(event);return false"><input id="mdFriendRoomCode" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="مثلاً 483921" value="'+esc(invited||"")+'" required pattern="[1-9][0-9]{5}"/>'
      +'<button type="submit">🚀 ادخل الغرفة</button></form><p id="mdJoinError">لو صاحبك بعتلك رابط مباشر، افتحه بعد تسجيل الدخول.</p></div>':'')
   +'</section>';
 }
 mdHubScreen=function(){
  let html=originalHub();
  // The legacy creation form should only appear when someone explicitly requests custom settings.
  const create=/<section class="card web-create">[\s\S]*?<\/section>/;
  const match=html.match(create);
  let custom="";
  if(match){
   custom=match[0].replace('<section class="card web-create">','<section class="card web-create md-friend-custom" id="mdFriendCustom">')
    .replace('<h2>أنشئ غرفة</h2>','<h2>⚙️ إعدادات غرفة الأصحاب</h2>')
    .replace('✨ أنشئ غرفة وابدأ','👥 أنشئ الغرفة واظهر رقم الدعوة');
   html=html.replace(create,'');
  }
  // No duplicate random matchup card: the large button at the top is the sole public entry.
  if(!mdUser?.isOwner)html=html.replace(/<section class="card web-discover web-random">[\s\S]*?<\/section>/,'');
  const hero=/<div class="web-hero">[\s\S]*?<\/div>/;
  if(hero.test(html))html=html.replace(hero,m=>m+actions()+(showOptions?custom:''));
  else html=actions()+(showOptions?custom:'')+html;
  return html;
 };
 mdAuthScreen=function(){
  const html=originalAuth();
  return invited?html.replace('<section class="card web-auth">','<section class="md-invite-auth">🎟️ صاحبك عازمك على غرفة رقم <b>'+esc(invited)+'</b>. ادخل كضيف أو بحسابك عشان تنضم.</section><section class="card web-auth">'):html;
 };
 window.mdStartRandom=function(){
  if(!mdUser||online||state||actionPending)return;
  actionPending=true;
  window.mdRoomMatchMode="random";
  window.mdVoiceUnlock?.();
  void Promise.resolve(window.mdQuickMatch()).finally(()=>{setTimeout(()=>{actionPending=false;},1800);});
 };
 window.mdStartFriend=function(){
  if(!mdUser||online||state||actionPending)return;
  actionPending=true;
  window.mdRoomMatchMode="friend";
  cfg.bot=false;
  // Direct two-player room by default. Custom settings remain available below the main buttons.
  window.mdVoiceUnlock?.();
  window.mdCreateRoom();
  setTimeout(()=>{actionPending=false;},1800);
 };
 window.mdToggleFriendOptions=function(){
  if(!mdUser)return;
  saveTitle();showOptions=!showOptions;
  if(showOptions)showJoin=false;
  renderHome();
  if(showOptions)document.getElementById("mdFriendCustom")?.scrollIntoView?.({behavior:"smooth",block:"nearest"});
 };
 window.mdOpenFriendCode=function(){
  if(!mdUser)return;
  saveTitle();showJoin=!showJoin;
  if(showJoin)showOptions=false;
  renderHome();
  if(showJoin)document.getElementById("mdFriendRoomCode")?.focus?.();
 };
 window.mdJoinByInvite=function(event){
  event?.preventDefault?.();
  if(!mdUser||online||state)return false;
  const input=document.getElementById("mdFriendRoomCode"),code=safeCode(input?.value?.trim());
  if(!code){const notice=document.getElementById("mdJoinError");if(notice)notice.textContent="اكتب رقم الغرفة المكوّن من 6 أرقام";return false;}
  invited=null;
  window.mdVoiceUnlock?.();
  window.mdJoinRoom(code);
  return false;
 };
 function roomCode(){return safeCode(state?.roomCode||onlineRoomCode||window.mdRelay?.code);}
 function inviteLink(code){return "https://jars-al-tahaddi-online.vercel.app/?room="+code;}
 function inviteText(code){return "🧠 تحدّي من دماغك!\n👥 مستنيك تلعب معايا أونلاين.\n🔑 رقم الغرفة: "+code+"\n"+inviteLink(code);}
 function feedback(text){
  const area=document.getElementById("mdInviteStatus");
  if(area)area.textContent=text;
 }
 async function copy(text){
  if(window.navigator?.clipboard?.writeText){await window.navigator.clipboard.writeText(text);return true;}
  const field=document.createElement("textarea");
  field.value=text;field.style.position="fixed";field.style.opacity="0";
  document.body.appendChild(field);field.select();
  const result=document.execCommand?.("copy")===true;
  field.remove();if(!result)throw Error("Clipboard unavailable");
  return true;
 }
 window.mdCopyRoomCode=async function(){
  const code=roomCode();if(!code)return;
  try{await copy(code);feedback("✅ تم نسخ رقم الغرفة. ابعته لصاحبك.");}
  catch(e){feedback("تعذر النسخ التلقائي؛ اضغط مطولًا على الرقم وحدده.");}
 };
 window.mdShareFriendRoom=async function(){
  const code=roomCode();if(!code)return;
  const url=inviteLink(code),text=inviteText(code);
  if(window.navigator?.share){
   try{await window.navigator.share({title:"من دماغك — دعوة لعب",text,url});return;}
   catch(e){if(e?.name==="AbortError")return;}
  }
  try{await copy(text);feedback("✅ تم نسخ الدعوة والرابط — ابعته لصاحبك.");}
  catch(e){feedback("الرابط: "+url);}
 };
 renderLobby=function(){
  originalLobby();
  const code=roomCode();if(!code||!host||state?.phase!=="lobby")return;
  const markup='<div class="md-lobby-share"><p>🎮 غرفتك جاهزة! ابعت الرقم أو الرابط لصاحبك، وبعد ما يدخل تبدأوا اللعب.</p>'
    +'<div class="md-lobby-share-actions"><button type="button" onclick="mdCopyRoomCode()">📋 انسخ الرقم</button><button type="button" onclick="mdShareFriendRoom()">📲 شارك الدعوة</button></div>'
    +'<small id="mdInviteStatus" aria-live="polite">الرقم ده خاص بغرفتك. خليك فاتح الصفحة لحد ما صاحبك يدخل.</small></div>';
  const boxStart=root.innerHTML.indexOf('<div class="roomCodeCard">');
  if(boxStart<0)return;
  const close=root.innerHTML.indexOf('</div>',boxStart);
  if(close>boxStart)root.innerHTML=root.innerHTML.slice(0,close)+markup+root.innerHTML.slice(close);
 };
 renderHome();
})();
