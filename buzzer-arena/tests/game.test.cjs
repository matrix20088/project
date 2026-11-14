const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'../app/src/main/assets');
function env(){
 const dom={root:{innerHTML:''},nickname:{value:'أحمد'},timer:{textContent:'',classList:{toggle(){}}},timefill:{style:{}}},calls=[],messages=[];
 const Native={
  send(v){messages.push(JSON.parse(v))},host(){},join(){},permission(){},paired(){},vibrate(){},
  speak(text){calls.push({type:'speak',text})},
  speakQuestion(text,round){calls.push({type:'question',text,round})},
  spellQuestion(text,letters,round){calls.push({type:'spell',letters:JSON.parse(letters),round})},
  speakChoice(text,token){calls.push({type:'choice',text,token})},
  stopSpeech(){calls.push({type:'stop'})},
  playBell(){calls.push({type:'bell'})},disconnect(){},settings(){}
 };
 const window={Native},storage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}};
 const cx={console,Date,Math,Set,JSON,Number,String,Object,Array,Intl,window,Native,
  document:{getElementById(id){return dom[id]||null}},localStorage:storage,setInterval(){},clearInterval(){}};
 vm.createContext(cx);
 for(const file of ['questions.js','extra_questions.js','hard_questions.js','movie_music_levels.js','flag_questions.js','core.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),cx,{filename:file});
 return {dom,calls,messages,window,run:s=>vm.runInContext(s,cx)};
}
function join(e,n){
 e.window.onNative('hosting',String(n));
 for(let i=1;i<n;i++){
  e.window.onNative('join',JSON.stringify({seat:i,device:'phone-'+i}));
  e.window.onNative('remote',JSON.stringify({seat:i,msg:JSON.stringify({t:'hello',name:'لاعب '+i})}));
 }
 assert(e.run('allReady()'));
}
function startQuestion(e){
 assert.equal(e.run('state.phase'),'announce','referee must speak first');
 assert(!e.dom.root.innerHTML.includes('id="thebuzzer"'));
 e.window.onNative('speechDone',String(e.run('state.round')));
 assert.equal(e.run('state.phase'),'question','buzzer opens IMMEDIATELY after speaking');
 assert(e.dom.root.innerHTML.includes('id="thebuzzer"'),'button visible with no options');
 assert.equal(e.run('state.optionsShownCount'),0);
 assert.equal(e.run('state.optionsShown'),false);
 assert(e.run('state.deadline')>Date.now());
}
function reveal(e,n=4){
 for(let i=0;i<n;i++){
  e.run('nextRevealAt=Date.now()-1;tick()');
  assert.equal(e.run('state.optionsShownCount'),i+1);
  const call=e.calls.filter(c=>c.type==='choice').at(-1);
  assert(call,'each revealed choice must be spoken by the referee');
  assert(call.text.includes(e.run('state.question.options['+i+']')),'spoken choice must match current option');
  e.window.onNative('choiceDone',call.token);
 }
}
function correct(e,seat){
 e.run('buzzOpenedAt=Date.now()-3000;claimBuzz('+seat+')');
 assert.equal(e.run('state.phase'),'answer');
 e.run('submitTypedAnswer('+seat+',state.question.options[answerIndex])');
 assert.equal(e.run('state.phase'),'result');
}
for(const n of [2,3,4]){
 const e=env();join(e,n);e.run('startMatch()');startQuestion(e);
 for(let i=0;i<10;i++){
  if(i){e.run('advanceRound()');startQuestion(e);}
  correct(e,n-1);
 }
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'finished');
 assert.equal(e.run('state.winner'),n-1);
 assert.equal(e.calls.filter(c=>c.type==='bell').length,10);
 console.log('PASS '+n+' humans, immediate buzzer, scores, 10 accepted bell sounds');
}
{
 const e=env();join(e,3);e.run('startMatch()');startQuestion(e);
 e.run('nextRevealAt=Date.now()-1;tick()');
 assert.equal(e.run('state.optionsShownCount'),1);
 const oldToken=e.calls.filter(c=>c.type==='choice').at(-1).token;
 e.run('buzzOpenedAt=Date.now()-100;claimBuzz(1)');
 assert.equal(e.run('state.phase'),'answer');
 assert.equal(e.run('state.optionsShownCount'),1,'remaining publicly revealed answers must freeze');
 assert.equal(e.run('nextRevealAt'),0,'future reading must be canceled');
 assert(e.calls.some(c=>c.type==='stop'),'spoken options must be interrupted on buzz');
 const winner=env();
 winner.window.onNative('message','{"t":"welcome","seat":1}');
 winner.window.onNative('message',JSON.stringify(e.messages.at(-1)));
 assert(!winner.dom.root.innerHTML.includes('onclick="selectOption('),'early winner must not see unspoken answers');
 assert(winner.dom.root.innerHTML.includes('id="typedAnswer"'),'early winner gets free text input');
 assert(!e.dom.root.innerHTML.includes('onclick="selectOption('),'spectators cannot select');
 e.window.onNative('choiceDone',oldToken);
 assert.equal(e.run('state.optionsShownCount'),1,'stale voice callback cannot reveal a new option');
 assert.equal(e.run('state.fastBuzz'),true);
 e.run('submitTypedAnswer(1,state.question.options[(answerIndex+1)%4])');
 assert.equal(e.run('state.result.retry'),true);
 assert.equal(e.run('state.result.correct'),null);
 assert.equal(e.run('state.players.find(p=>p.seat===1).score'),-2);
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'question','question reopens after wrong answer');
 assert.equal(e.run('state.optionsShownCount'),0,'choices MUST restart from beginning');
 assert.equal(e.run('state.retry'),true);
 e.run('nextRevealAt=Date.now()-1;tick()');
 assert(e.calls.filter(c=>c.type==='choice').at(-1).text.includes(e.run('state.question.options[0]')));
 assert.equal(e.run('state.optionsShownCount'),1);
 e.run('buzzOpenedAt=Date.now()-3400;claimBuzz(1)');
 const wrong=e.run('state.question.options.findIndex((_,i)=>i!==answerIndex&&!state.wrongChoices.includes(i))');
 e.run('submitTypedAnswer(1,state.question.options['+wrong+'])');
 assert.equal(e.run('state.wrongAttempts'),2);
 assert.equal(e.run('state.result.retry'),false);
 assert.equal(e.run('state.players.find(p=>p.seat===1).score'),-3);
 e.run('advanceRound()');
 assert.equal(e.run('state.round'),2);
 console.log('PASS buzzer interrupts option reading, stale audio ignored, retry repeats from first choice, 2 wrong ends question');
}
{
 const e=env();join(e,2);e.run('startMatch()');startQuestion(e);
 reveal(e);
 assert.equal(e.run('state.optionsShownCount'),4);
 assert(e.dom.root.innerHTML.includes('id="thebuzzer"'));
 assert(!e.dom.root.innerHTML.includes('••••••••'));
 e.run('claimBuzz(0)');
 assert.equal(e.run('state.phase'),'answer');
 assert.equal(e.run('state.answerMode'),'choice');
 e.run('submitAnswer(0,answerIndex)');
 assert.equal(e.run('state.result.ok'),true);
 console.log('PASS choices clickable after all 4 are spoken');
}
{
 const e=env();join(e,2);e.run('startMatch()');startQuestion(e);
 e.run('claimBuzz(0);state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),-2);
 assert.equal(e.run('state.result.retry'),true);
 e.run('advanceRound()');
 assert.equal(e.run('state.phase'),'question');
 assert.equal(e.run('state.optionsShownCount'),0);
 e.run('buzzOpenedAt=Date.now()-3100;claimBuzz(0);state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),-1);
 assert.equal(e.run('state.result.retry'),true);
 e.run('advanceRound()');
 e.run('state.deadline=Date.now()-1;tick()');
 assert.equal(e.run('state.result.delta'),0);
 console.log('PASS missed answers reopen same question, fast/late penalties, no-buzz finishes');
}
{
 const e=env();join(e,2);e.run('startMatch()');startQuestion(e);
 e.run('skipQuestion()');assert(e.run('state.result.skipped'));
 e.run('advanceRound()');startQuestion(e);
 e.window.onNative('remote',JSON.stringify({seat:1,msg:'{"t":"skipRequest"}'}));
 assert.equal(e.run('state.skipRequests.length'),1);
 console.log('PASS skip and guest skip request');
}
{
 const e=env();join(e,2);e.run('startMatch()');
 assert.equal(e.run('state.question.tier'),'easy');
 e.run('state.players[0].score=3;newRound()');assert.equal(e.run('state.question.tier'),'medium');
 e.run('state.players[0].score=6;newRound()');assert.equal(e.run('state.question.tier'),'hard');
 const count=e.run('TOTAL_QUESTIONS'),cats=e.run('CAT_KEYS.length');
 assert(count>=1200&&cats>=23);
 console.log('PASS score-adaptive '+count+' questions in '+cats+' categories');
}
{
 const e=env();join(e,2);e.run('state.category="🔄 كلمة مقلوبة";startMatch()');
 assert(e.run('state.question.audioOnly'));
 assert(e.calls.some(x=>x.type==='spell'));
 assert.deepEqual(Array.from(e.run('spelledLetters("القصة")')),['تاء مربوطة','صاد','قاف','لام','ألف']);
 e.window.onNative('speechUnavailable',String(e.run('state.round')));
 assert.equal(e.run('state.phase'),'paused');
 console.log('PASS letter-by-letter audio-only reverse category');
}
{
 const e=env();const array=Array.from({length:30},()=>e.run('hostLine("intro")'));
 assert(array.every((x,i)=>i===0||x!==array[i-1]));
 console.log('PASS no identical consecutive referee intro lines');
}
{
 const host=env(),guest=env();join(host,2);host.run('startMatch()');
 guest.window.onNative('message',JSON.stringify(host.messages.at(-1)));
 startQuestion(host);
 guest.window.onNative('message',JSON.stringify(host.messages.at(-1)));
 assert(guest.dom.root.innerHTML.includes('id="thebuzzer"'));
 host.run('nextRevealAt=Date.now()-1;tick()');
 guest.window.onNative('message',JSON.stringify(host.messages.at(-1)));
 assert.equal(guest.run('state.optionsShownCount'),1);
 host.run('claimBuzz(0)');
 const m=JSON.stringify(host.messages.at(-1));
 guest.window.onNative('message',m);guest.window.onNative('message',m);
 assert.equal(guest.calls.filter(c=>c.type==='bell').length,1,'one ringtone per accepted buzz');
 assert.equal(guest.run('state.optionsShownCount'),1);
 assert(!guest.dom.root.innerHTML.includes('onclick="selectOption('),'spectators cannot click answers');
 console.log('PASS guest syncing, frozen choices after buzz, single bell only');
}
{
 const e=env();join(e,2);
 assert.equal(e.run('answerMatches("برازيل","البرازيل")'),true);
 assert.equal(e.run('answerMatches("السعوديه","السعودية")'),true);
 assert.equal(e.run('answerMatches("مُحَمَّد هُنَيْدِي","محمد هنيدي")'),true);
 assert.equal(e.run('answerMatches("عمرو","عمرو دياب")'),false);
 assert.equal(e.run('answerMatches("البرازيل","الأرجنتين")'),false);
 e.run('state.category="🚩 تحدي أعلام العالم";startMatch()');
 assert.equal(e.run('state.question.q'),"لأي دولة هذا العلم؟");
 assert(/^[a-z]{2}$/.test(e.run('state.question.visual')));
 assert(e.dom.root.innerHTML.includes('class="flagPhoto"'));
 assert(!e.dom.root.innerHTML.includes(e.run('state.question.options[answerIndex]')));
 const n=e.run('TOTAL_QUESTIONS');
 assert(n>=1300,'number of questions: '+n);
 console.log('PASS actual flag picture, no country leaked, strict Arabic matching and '+n+' questions');
}
{
 const h=env(),g=env();join(h,2);
 h.run('startMatch()');startQuestion(h);
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.question.options.filter(Boolean).length'),0,'host must hide unheard options from guest');
 h.run('nextRevealAt=Date.now()-1;tick()');
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.question.options.filter(Boolean).length'),1,'guest can see only spoken choice');
 h.run('claimBuzz(1)');
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.answerMode'),'text');
 assert.equal(g.run('state.question.options.filter(Boolean).length'),1);
 assert(g.dom.root.innerHTML.includes('id="typedAnswer"'));
 g.dom.typedAnswer={value:'اختبار غلط',disabled:false,blur(){}};
 g.run('submitTypedFromUI()');
 const packet=g.messages.at(-1);
 assert.equal(packet.t,'typed');
 assert.equal(packet.text,'اختبار غلط');
 h.window.onNative('remote',JSON.stringify({seat:1,msg:JSON.stringify(packet)}));
 assert.equal(h.run('state.result.retry'),true);
 assert.equal(h.run('state.result.delta'),-2);
 console.log('PASS hidden choices not leaked in Bluetooth messages, real guest typed answer is scored');
}
console.log('ALL v7 TESTS PASSED');