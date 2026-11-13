const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'../app/src/main/assets');
function env(){
 const dom={root:{innerHTML:''},nickname:{value:'أحمد'},timer:{textContent:'',classList:{toggle(){}}},timefill:{style:{}}},calls=[],messages=[];
 const Native={send(v){messages.push(JSON.parse(v))},host(){},join(){},permission(){},paired(){},vibrate(){},speak(){},speakQuestion(){},spellQuestion(t,letters){calls.push({type:'spell',letters:JSON.parse(letters)})},playBell(){calls.push({type:'bell'})},disconnect(){},settings(){}};
 const window={Native},storage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}};
 const cx={console,Date,Math,Set,JSON,Number,String,Object,Array,Intl,window,Native,document:{getElementById(id){return dom[id]||null}},localStorage:storage,setInterval(){},clearInterval(){}};
 vm.createContext(cx);
 for(const file of ['questions.js','extra_questions.js','hard_questions.js','movie_music_levels.js','core.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),cx,{filename:file});
 return {dom,calls,messages,window,run:s=>vm.runInContext(s,cx)};
}
function join(e,n){
 e.window.onNative('hosting',String(n));
 for(let i=1;i<n;i++){e.window.onNative('join',JSON.stringify({seat:i,device:'phone'}));e.window.onNative('remote',JSON.stringify({seat:i,msg:JSON.stringify({t:'hello',name:'متسابق '+i})}));}
 assert(e.run('allReady()'));
}
function open(e){
 assert.equal(e.run('state.phase'),'announce');
 assert(!e.dom.root.innerHTML.includes('id="thebuzzer"'));
 e.window.onNative('speechDone',String(e.run('state.round')));
 assert.equal(e.run('state.speechOver'),true);
 const delay=e.run('hiddenOpenAt-Date.now()');
 assert(delay>=-300&&delay<=15000);
 assert.equal(e.run('state.deadline'),0);
 e.run('hiddenOpenAt=Date.now()+4000;openBuzz()');
 assert.equal(e.run('state.phase'),'announce');
 e.run('hiddenOpenAt=Date.now()-1;tick()');
 assert.equal(e.run('state.phase'),'question');
 assert(e.dom.root.innerHTML.includes('id="thebuzzer"'));
}
for(const n of [2,3,4]){
 const e=env();join(e,n);e.run('startMatch()');open(e);
 for(let i=0;i<10;i++){
  if(i){e.run('advanceRound()');open(e);}
  e.run('buzzOpenedAt=Date.now()-3000;claimBuzz('+(n-1)+');submitAnswer('+(n-1)+',answerIndex)');
  assert.equal(e.run('state.phase'),'result');
 }
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'finished');
 assert.equal(e.run('state.winner'),n-1);
 assert.equal(e.calls.filter(x=>x.type==='bell').length,10);
 console.log('PASS '+n+' human players and 10 accepted bell rings');
}
{
 const e=env();join(e,3);e.run('startMatch()');open(e);
 const q=e.run('state.question.q');
 assert.equal(e.run('state.optionsShown'),false);
 e.run('buzzOpenedAt=Date.now()-100;claimBuzz(1)');
 assert.equal(e.run('state.answerWindowSec'),6);
 assert.equal(e.run('state.optionsShown'),true);
 assert(e.dom.root.innerHTML.includes('👀 الإجابات ظاهرة للكل'));
 e.run('submitAnswer(1,(answerIndex+1)%4)');
 assert.equal(e.run('state.result.retry'),true);
 assert.equal(e.run('state.result.correct'),null);
 assert.equal(e.run('state.players.find(p=>p.seat===1).score'),-2);
 assert(!e.dom.root.innerHTML.includes('الإجابة الصحيحة:'));
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'question');
 assert.equal(e.run('state.question.q'),q);
 assert(e.dom.root.innerHTML.includes('❌ غلط'));
 e.run('buzzOpenedAt=Date.now()-3500;claimBuzz(1)');
 assert.equal(e.run('state.answerWindowSec'),12);
 const other=e.run('state.question.options.findIndex((_,i)=>i!==answerIndex&&!state.wrongChoices.includes(i))');
 e.run('submitAnswer(1,'+other+')');
 assert.equal(e.run('state.wrongChoices.length'),2);
 assert.equal(e.run('state.result.retry'),false);
 assert.equal(e.run('state.players.find(p=>p.seat===1).score'),-3);
 assert(e.dom.root.innerHTML.includes('الإجابة الصحيحة:'));
 e.run('advanceRound()');
 assert.equal(e.run('state.round'),2);
 console.log('PASS shared options, same-player retry, two wrong guesses mandatory next');
}
{
 const e=env();join(e,2);e.run('startMatch()');open(e);
 e.run('claimBuzz(0);state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),-2);
 assert.equal(e.run('state.result.retry'),true);
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'question');
 e.run('buzzOpenedAt=Date.now()-3200;claimBuzz(0);state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),-1);
 e.run('advanceRound()');
 e.run('state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),0);
 console.log('PASS first and second unanswered buzz reopen, no-buzz ends');
}
{
 const e=env();join(e,2);e.run('startMatch()');e.run('skipQuestion()');
 assert(e.run('state.result.skipped'));assert.equal(e.run('state.result.delta'),0);
 e.run('advanceRound()');open(e);
 e.window.onNative('remote',JSON.stringify({seat:1,msg:'{"t":"skipRequest"}'}));
 assert.equal(e.run('state.skipRequests.length'),1);
 e.run('skipQuestion()');assert(e.run('state.result.skipped'));
 console.log('PASS host skip and guest skip requests');
}
{
 const e=env();join(e,2);e.run('startMatch()');
 assert.equal(e.run('state.question.tier'),'easy');
 e.run('state.players[0].score=3;newRound()');
 assert.equal(e.run('state.question.tier'),'medium');
 e.run('state.players[0].score=6;newRound()');
 assert.equal(e.run('state.question.tier'),'hard');
 e.run('state.category="🎬 سينما وتلفزيون";newRound()');
 assert.equal(e.run('state.question.tier'),'hard');
 assert.equal(e.run('state.question.cat'),'🎬 سينما وتلفزيون');
 e.run('state.players[0].score=0;newRound()');
 assert.equal(e.run('state.question.tier'),'easy');
 console.log('PASS scoreboard-governed gradual difficulty');
}
{
 const e=env();join(e,2);e.run('state.category="🔄 كلمة مقلوبة";startMatch()');
 assert(e.run('state.question.audioOnly'));assert(e.calls.some(c=>c.type==='spell'));
 assert(!e.dom.root.innerHTML.includes(e.run('state.question.options[0]')));
 assert.deepEqual(Array.from(e.run('spelledLetters("القصة")')),['تاء مربوطة','صاد','قاف','لام','ألف']);
 e.window.onNative('speechUnavailable',String(e.run('state.round')));
 assert.equal(e.run('state.phase'),'paused');
 console.log('PASS audio-only reversed words');
}
{
 const e=env();join(e,2);const n=e.run('TOTAL_QUESTIONS'),cats=e.run('CAT_KEYS.length');
 assert(n>=1200,'Questions '+n);
 assert(cats>=23,'Categories '+cats);
 assert.equal(e.run('CAT_KEYS.flatMap(cat=>QUESTIONS[cat].filter(row=>row.length!==(cat==="🔄 كلمة مقلوبة"?4:5)||new Set(cat==="🔄 كلمة مقلوبة"?row:row.slice(1)).size!==4))').length,0);
 console.log('PASS valid '+n+' questions in '+cats+' categories');
}
{
 const h=env(),g=env();join(h,2);h.run('startMatch()');open(h);
 g.window.onNative('message',JSON.stringify(h.messages[h.messages.length-1]));
 h.run('claimBuzz(0)');
 const msg=JSON.stringify(h.messages[h.messages.length-1]);
 g.window.onNative('message',msg);g.window.onNative('message',msg);
 assert.equal(g.calls.filter(c=>c.type==='bell').length,1);
 console.log('PASS one bell per accepted buzz on guest');
}
console.log('ALL v4 TESTS PASS');
