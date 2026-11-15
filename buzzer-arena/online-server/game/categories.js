/* من دماغك ويب: 7 فئات محددة. تصنيف فقط؛ نسخة Android لا تتغير. */
const WEB_CATEGORY_SOURCES={
 "🎬 سينما ومسلسلات":["🎬 سينما وتلفزيون","📺 مسلسلات ومسرح","🎥 سينما عالمية"],
 "🎭 إفيهات أفلام":["🎭 إفيهات السينما"],
 "🔄 كلمات معكوسة":["🔄 كلمة مقلوبة"],
 "🧩 وصف":["🧩 خمن الحاجة اليومية","🌍 خمن الدولة من الوصف","🏙️ خمن المدينة أو المكان"],
 "🌍 معلومات عامة":["🧠 فوازير وثقافة","⚽ كورة ورياضة","🌍 بلاد وأعلام","🪐 علوم وفضاء","🍕 أكل ومطبخ","📱 تكنولوجيا","📚 تاريخ وأدب","🗺️ جغرافيا ومعالم","🔤 لغات وكلمات","🏛️ تاريخ للنخبة","🧬 علوم صعبة","🧭 جغرافيا متقدمة","🎨 فن وأدب","🎮 ألعاب وكرتون"],
 "🐾 حيوانات":["🐾 حيوانات وطبيعة"],
 "🎵 أغاني":["🎼 أغاني وفنانين"]
};
const webOriginalQuestions=Object.fromEntries(Object.entries(QUESTIONS).map(([k,v])=>[k,v.slice()]));
const webOriginalTiers=typeof QUESTION_LEVELS==="undefined"?{}:{...QUESTION_LEVELS};
for(const key of Object.keys(QUESTIONS))delete QUESTIONS[key];
const webIsMathQuestion=q=>/(?:\d+\s*[+\-×÷*/]\s*\d+|[+=×÷]\s*\d+|جمع الأعداد|اطرح|الطرح|الجمع والطرح|ناتج|احسب|مسألة حساب|كم يساوي|يساوي كام|حاصل ضرب|الضرب|قسمة|مجموع الزوايا|ناتج جمع|حساب في ثواني|عملية حسابية)/i.test(String(q));
for(const [group,sources] of Object.entries(WEB_CATEGORY_SOURCES)){
 const rows=[];
 for(const source of sources){
  for(let i=0;i<(webOriginalQuestions[source]||[]).length;i++){
   const question=webOriginalQuestions[source][i];
   if(webIsMathQuestion(question[0]))continue;
   if(typeof QUESTION_LEVELS!=="undefined")QUESTION_LEVELS[group+"#"+rows.length]=webOriginalTiers[source+"#"+i]||"easy";
   rows.push(question);
  }
 }
 QUESTIONS[group]=rows;
}
