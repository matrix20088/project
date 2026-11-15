/* Deduplicate questions from the original banks and bonus sets, preserving difficulty tags. */
(function(){
 let removed=0;
 for(const [cat,rows] of Object.entries(QUESTIONS)){
  const seen=new Set(),retained=[],levels={};
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   const fingerprint=String(row[0]).normalize("NFKC").toLowerCase().replace(/[«»"“”'؟!.,:؛]/g,"").replace(/\s+/g," ").trim();
   if(seen.has(fingerprint)){removed++;continue;}
   seen.add(fingerprint);
   const previousTier=typeof QUESTION_LEVELS==="undefined"?null:QUESTION_LEVELS[cat+"#"+i];
   if(previousTier)levels[cat+"#"+retained.length]=previousTier;
   retained.push(row);
  }
  QUESTIONS[cat]=retained;
  if(typeof QUESTION_LEVELS!=="undefined"){
   for(const k of Object.keys(QUESTION_LEVELS))if(k.startsWith(cat+"#"))delete QUESTION_LEVELS[k];
   Object.assign(QUESTION_LEVELS,levels);
  }
 }
 window.mdDeduplicatedQuestions=removed;
})();
