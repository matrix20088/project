"use strict";
/* Anonymous browser-level unique visitor tracking. Personal stats visible only to owner. */
(function(){
 let visitPromise=null,stats=null,loading=false,statsError="",selectedView="all",search="",lastTry=0;
 const playedRooms=new Set(),inFlight=new Set();
 const started=phase=>["announce","question","answer","result","finished"].includes(phase);
 function api(data){
  return fetch("/api/stats",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(data)})
   .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"تعذر تحديث الإحصائيات");return j;});
 }
 function visit(){
  if(visitPromise)return visitPromise;
  visitPromise=api({action:"visit"}).catch(e=>{visitPromise=null;console.warn("visitor stats",e.message);return null;});
  return visitPromise;
 }
 window.mdTrackPlayed=async function(identity){
  const code=String(identity?.code||"");
  const role=identity?.role;
  const key=role+"|"+code;
  if(!/^[1-9][0-9]{5}$/.test(code)||!["host","guest"].includes(role)||playedRooms.has(key)||inFlight.has(key))return;
  inFlight.add(key);
  try{
   await visit();
   await api({action:"played",code,role,token:identity.token,id:identity.id});
   playedRooms.add(key);
  }catch(e){console.warn("match stats",e.message);}
  finally{inFlight.delete(key);}
 };
 const originalAuth=mdAuthScreen;
 mdAuthScreen=function(){
  return originalAuth()+'<p class="md-privacy">📊 بنحسب المتصفحات المختلفة ومين بدأ مباراة. مش بنخزن عنوان الإنترنت في سجل الزوار.</p>';
 };
 const priorAuth=window.mdSubmitAuth;
 window.mdSubmitAuth=async function(e){
  const result=await priorAuth(e);
  if(mdUser){visitPromise=null;void visit();}
  return result;
 };
 const fmt=ts=>ts?new Date(ts).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"—";
 function formatType(x){return x.type==="registered"?"حساب":x.type==="guest"?"ضيف":"بدون تسجيل";}
 function counts(){
  if(!stats)return '<p class="md-stats-loading">'+(loading?"⏳ بنحمل إحصائيات الزوار...":statsError?esc(statsError):"الإحصائيات بتتحمل أول ما تفتح لوحة المالك")+'</p>';
  const n=stats.summary;
  return '<div class="md-stats-kpis">'
    +'<div><strong>'+n.visitors+'</strong><span>زوار مختلفون</span></div>'
    +'<div><strong>'+n.played+'</strong><span>لعبوا فعليًا</span></div>'
    +'<div><strong>'+n.notPlayed+'</strong><span>دخلوا ولم يلعبوا</span></div>'
    +'<div><strong>'+n.gamesRecorded+'</strong><span>مشاركات في مباريات</span></div>'
    +'</div><div class="md-stats-extra">🆕 آخر 7 أيام: <b>'+n.newLast7Days+'</b> · حسابات: <b>'+n.registered+'</b> · ضيوف: <b>'+n.guests+'</b> · بدون تسجيل: <b>'+n.anonymous+'</b></div>'
    +(stats.complete?'':'<p class="md-stats-warning">الأعداد دي جزئية لأن عدد سجلات الزوار تخطى حد عرض لوحة الإحصائيات.</p>');
 }
 function filteredRows(){
  if(!stats)return [];
  let arr=stats.visitors||[];
  if(selectedView==="played")arr=arr.filter(x=>x.played);
  if(selectedView==="not")arr=arr.filter(x=>!x.played);
  const q=search.toLowerCase().trim();
  if(q)arr=arr.filter(x=>[x.name,x.username,x.id,x.type].some(v=>String(v||"").toLowerCase().includes(q)));
  return arr;
 }
 function rowHtml(){
  const all=filteredRows(),shown=all.slice(0,80);
  return '<p class="md-stats-extra">المعروض: '+shown.length+' من '+all.length+' متصفح '+(search?'مطابق للبحث':'')+'</p>'
   +(shown.length?'<div class="md-stats-list">'+shown.map(r=>'<div class="md-stats-person"><div class="md-stats-name"><b>'+esc(r.name)+'</b> <small>#'+esc(r.id)+' · '+formatType(r)+'</small>'
     +(r.username?'<small>@'+esc(r.username)+'</small>':'')+'</div>'
     +'<div class="md-stats-state '+(r.played?'yes':'no')+'">'+(r.played?'🎮 لعب · '+r.games+' مباراة':'👀 لم يلعب')+'</div>'
     +'<small>آخر ظهور: '+fmt(r.lastSeen)+(r.played?' · أول لعب: '+fmt(r.firstPlayed):'')+'</small></div>').join('')+'</div>'
    :'<p class="md-stats-loading">لا يوجد زوار مطابقون للفلتر.</p>');
 }
 function panel(){
  const filters=[["all","الكل"],["played","🎮 لعبوا"],["not","👀 لم يلعبوا"]];
  return '<section class="card md-owner-stats" aria-label="إحصائيات المالك">'
   +'<div class="md-stats-head"><div><div class="kicker">📊 لوحة المالك</div><h2>الزوار واللاعبين</h2></div><button type="button" class="md-stats-refresh" onclick="mdRefreshStats()" '+(loading?'disabled':'')+'>🔄 تحديث</button></div>'
   +'<p class="md-stats-explain">كل متصفح يتحسب مرة واحدة؛ «لعب» تعني دخوله مباراة بدأت فعلًا، مش مجرد إنشاء غرفة أو فتح الصفحة.</p>'
   +counts()
   +(stats?'<div class="md-stats-filters">'+filters.map(([key,title])=>'<button type="button" class="'+(selectedView===key?'active':'')+'" onclick="mdStatsView(\''+key+'\')">'+title+'</button>').join('')+'</div>'
      +'<input class="field md-stats-search" placeholder="ابحث باسم الزائر أو الحساب أو الرقم" value="'+esc(search)+'" oninput="mdStatsSearch(this.value)" aria-label="البحث في الزوار"/>'
      +'<div id="mdStatsRows">'+rowHtml()+'</div>'
      +'<button type="button" class="md-stats-csv" onclick="mdDownloadStats()">⬇️ تنزيل كل الزوار CSV</button>':'')
   +'</section>';
 }
 const previousHub=mdHubScreen;
 mdHubScreen=function(){
  const h=previousHub();
  if(!mdUser?.isOwner)return h;
  return h.replace(/<p class="web-foot">/,panel()+'<p class="web-foot">');
 };
 function redraw(){
  const f=document.getElementById("webTitle");if(f)mdRoomTitle=String(f.value||"").slice(0,40);
  renderHome();
 }
 window.mdStatsView=function(view){
  if(!["all","played","not"].includes(view))return;
  selectedView=view;redraw();
 };
 window.mdStatsSearch=function(value){
  search=String(value||"").slice(0,80);
  const out=document.getElementById("mdStatsRows");if(out)out.innerHTML=rowHtml();
 };
 window.mdRefreshStats=async function(){
  if(!mdUser?.isOwner||loading)return;
  loading=true;statsError="";lastTry=Date.now();
  try{
   const r=await fetch("/api/stats?action=dashboard",{credentials:"same-origin",cache:"no-store"});
   const data=await r.json();if(!r.ok)throw Error(data.error||"تعذر عرض الإحصائيات");
   stats=data;
  }catch(e){statsError=String(e.message||"تعذر عرض الإحصائيات");}
  finally{loading=false;redraw();}
 };
 window.mdDownloadStats=function(){
  if(!mdUser?.isOwner||!stats)return;
  const columns=["id","name","username","type","played","games","firstSeen","lastSeen","firstPlayed","lastPlayed"];
  const clean=x=>{let s=String(x??"");if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const csv="\uFEFF"+columns.join(",")+"\r\n"+stats.visitors.map(r=>columns.map(k=>clean(k.endsWith("Seen")||k.endsWith("Played")?fmt(r[k]):r[k])).join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="men-demaghak-visitors-"+new Date().toISOString().slice(0,10)+".csv";
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
 const oldRender=renderHome;
 renderHome=function(){
  oldRender();
  if(mdUser?.isOwner&&!stats&&!loading&&Date.now()-lastTry>5000)void mdRefreshStats();
 };
 void visit();
 renderHome();
})();