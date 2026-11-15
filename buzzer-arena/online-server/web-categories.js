"use strict";
/* Web-only 7-category selector and fair round-robin per question. */
(function(){
 const groups=CAT_KEYS.slice();
 const storeKey="md_web_category_preferences_v1";
 function saved(){
  try{
   const value=JSON.parse(localStorage.getItem(storeKey)||"[]");
   return Array.isArray(value)?groups.filter(c=>value.includes(c)):[];
  }catch(e){return [];}
 }
 let selected=saved();
 cfg.category=CAT_ALL;
 function picker(){
  const all=selected.length===0;
  const current=all?groups:selected;
  let html='<div class="md-category-selector" role="group" aria-label="نوع الأسئلة">'
   +'<button type="button" class="md-category-all '+(all?'active':'')+'" aria-pressed="'+all+'" onclick="mdSelectAllCategories()">🌈 كل الفئات بالتناوب '+(all?'✓':'')+'</button>'
   +'<div class="md-category-grid">';
  groups.forEach(function(cat,i){
   const chosen=selected.includes(cat);
   html+='<button type="button" class="md-category-chip '+(chosen?'active':'')+'" aria-pressed="'+chosen+'" onclick="mdToggleCategory('+i+')">'+esc(cat)+(chosen?' ✓':'')+'</button>';
  });
  html+='</div><p class="md-category-note">'+(all
   ?'الافتراضي: كل سؤال من فئة مختلفة بالترتيب، وبعد آخر فئة نبدأ الدورة من أولها.'
   :'الفئات المختارة بالدور: '+current.map(esc).join(' ← '))+'</p></div>';
  return html;
 }
 const previousHub=mdHubScreen;
 mdHubScreen=function(){
  const content=previousHub();
  const select=/<label class="label" for="webCat">نوع الأسئلة<\/label><select class="field" id="webCat"[\s\S]*?<\/select>/;
  return content.replace(select,'<label class="label" id="mdCategoryLabel">نوع الأسئلة</label>'+picker());
 };
 function redraw(){
  const field=document.getElementById('webTitle');
  if(field)mdRoomTitle=String(field.value||"").slice(0,40);
  renderHome();
 }
 window.mdSelectAllCategories=function(){
  selected=[];cfg.category=CAT_ALL;
  try{localStorage.setItem(storeKey,'[]');}catch(e){}
  redraw();
 };
 window.mdToggleCategory=function(index){
  if(!Number.isInteger(index)||index<0||index>=groups.length)return;
  const item=groups[index];
  selected=selected.includes(item)?selected.filter(c=>c!==item):groups.filter(c=>c===item||selected.includes(c));
  cfg.category=CAT_ALL;
  try{localStorage.setItem(storeKey,JSON.stringify(selected));}catch(e){}
  redraw();
 };
 const baseLobby=mkLobby;
 mkLobby=function(n){
  const lobby=baseLobby(n);
  const choices=selected.length?selected.slice():groups.slice();
  lobby.webCategories=choices;
  lobby.category=selected.length===0?'🌈 كل الفئات بالتناوب':selected.length===1?choices[0]:'🎲 '+choices.length+' فئات بالتناوب';
  return lobby;
 };
 const baseQuestion=selectNewQuestion;
 selectNewQuestion=function(){
  if(!state||!Array.isArray(state.webCategories)||!state.webCategories.length)return baseQuestion();
  const choices=state.webCategories.filter(c=>groups.includes(c));
  if(!choices.length)return baseQuestion();
  const round=Math.max(1,Number(state.round)||1);
  const chosen=choices[(round-1)%choices.length];
  const display=state.category;
  try{
   state.category=chosen;
   return baseQuestion();
  }finally{
   state.category=display;
  }
 };
 window.mdGetSelectedCategories=function(){return selected.length?selected.slice():groups.slice();};
 renderHome();
})();
