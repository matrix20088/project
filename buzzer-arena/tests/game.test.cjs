const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'../app/src/main/assets');
function env(){
 const dom={root:{innerHTML:''},nickname:{value:'أحمد'},timer:{textContent:'',classList:{toggle(){}}},timefill:{style:{}}},calls=[],messages=[];
 const Native={
  send(v){messages.push(JSON.parse(v))},host(){},join(){},permission(){},paired(){},vibrate(){},
  speak(text){calls.push({type:'speak',text})},
  speakMood(text,mood){calls.push({type:'mood',text,mood})},
  speakQuestion(text,round){calls.push({type:'question',text,round})},
  spellQuestion(text,letters,round){calls.push({type:'spell',letters:JSON.parse(letters),round})},
  speakChoice(text,token){calls.push({type:'choice',text,token})},
  stopSpeech(){calls.push({type:'stop'})},
  playBell(){calls.push({type:'bell'})},disconnect(){},settings(){},
  onlineCreate(target,bot){calls.push({type:'onlineCreate',target,bot})},
  onlineJoin(code){calls.push({type:'onlineJoin',code})}
 };
 const window={Native},storage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}};
 const cx={console,Date,Math,Set,JSON,Number,String,Object,Array,Intl,window,Native,
  document:{getElementById(id){return dom[id]||null}},localStorage:storage,setInterval(){},clearInterval(){}};
 vm.createContext(cx);
 for(const file of ['questions.js','extra_questions.js','hard_questions.js','movie_music_levels.js','flag_questions.js','guess_places.js','core.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,file),'utf8'),cx,{filename:file});
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
 assert.equal(winner.run('state.answerMode'),'hybrid','one visible choice enables both selection and text');
 assert(winner.dom.root.innerHTML.includes('onclick="selectOption(0)"'),'first spoken choice must be selectable');
 assert(!winner.dom.root.innerHTML.includes('onclick="selectOption(1)"'),'unheard second choice must NOT be selectable');
 assert(winner.dom.root.innerHTML.includes('id="typedAnswer"'),'early winner gets free text input too');
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
 g.window.onNative('message',JSON.stringify({t:'welcome',seat:1})); // Android Bluetooth assigns seat before game states.
 h.run('startMatch()');startQuestion(h);
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.question.options.filter(Boolean).length'),0,'host must hide unheard options from guest');
 h.run('nextRevealAt=Date.now()-1;tick()');
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.question.options.filter(Boolean).length'),1,'guest can see only spoken choice');
 h.run('claimBuzz(1)');
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.answerMode'),'hybrid');
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

{
 for(const shown of [0,1,2,3,4]){
  const h=env(),g=env();join(h,2);
  g.window.onNative('message',JSON.stringify({t:'welcome',seat:1}));
  h.run('startMatch()');startQuestion(h);
  for(let i=0;i<shown;i++){
    h.run('nextRevealAt=Date.now()-1;tick()');
    const recent=h.calls.filter(x=>x.type==='choice').at(-1);
    h.window.onNative('choiceDone',recent.token);
  }
  assert.equal(h.run('state.optionsShownCount'),shown);
  h.run('claimBuzz(1)');
  g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
  const mode=shown===0?'text':shown===4?'choice':'hybrid';
  assert.equal(h.run('state.answerMode'),mode);
  assert.equal(g.run('state.answerMode'),mode);
  assert.equal(g.run('state.question.options.filter(Boolean).length'),shown,'network must expose ONLY spoken options');
  const visible=Array.from(g.run('state.question.options'));
  for(let i=0;i<4;i++){
    const enabled=g.dom.root.innerHTML.includes('onclick="selectOption('+i+')"');
    assert.equal(enabled, i<shown,'selectable answer '+i+' while '+shown+' spoken');
    if(i>=shown)assert.equal(visible[i],'','unspoken options must stay empty');
  }
  assert.equal(g.dom.root.innerHTML.includes('id="typedAnswer"'),shown<4,
    'free text enabled until fourth choice has been spoken');
  if(shown<4){
    g.run('selectOption('+shown+')');
    assert.equal(g.messages.filter(m=>m.t==='choice').length,0,'client cannot send unspoken choice');
    h.run('submitAnswer(1,'+shown+')');
    assert.equal(h.run('state.phase'),'answer','host rejects forged unspoken choice');
  }
  if(shown>0){
    g.run('selectOption(0)');
    const sent=g.messages.at(-1);
    assert.equal(sent.t,'choice');
    assert.equal(sent.i,0);
    h.window.onNative('remote',JSON.stringify({seat:1,msg:JSON.stringify(sent)}));
    assert.equal(h.run('state.phase'),'result','selection of spoken choice must be scored');
  }else{
    g.dom.typedAnswer={value:'جواب خاطئ',disabled:false,blur(){}};
    g.run('submitTypedFromUI()');
    const sent=g.messages.at(-1);
    assert.equal(sent.t,'typed');
    h.window.onNative('remote',JSON.stringify({seat:1,msg:JSON.stringify(sent)}));
    assert.equal(h.run('state.phase'),'result','free-text answer works with zero spoken choices');
  }
  console.log('PASS '+shown+' spoken choices: click visible choices or type if unrevealed choices remain');
 }
}
{
 // With two spoken options, the written answer may represent the fourth (still hidden) option.
 const h=env(),g=env();join(h,2);g.window.onNative('message',JSON.stringify({t:'welcome',seat:1}));
 h.run('startMatch()');startQuestion(h);
 for(let i=0;i<2;i++){
  h.run('nextRevealAt=Date.now()-1;tick()');
  h.window.onNative('choiceDone',h.calls.filter(x=>x.type==='choice').at(-1).token);
 }
 h.run('claimBuzz(1)');
 g.window.onNative('message',JSON.stringify(h.messages.at(-1)));
 assert.equal(g.run('state.answerMode'),'hybrid');
 assert(!g.dom.root.innerHTML.includes('onclick="selectOption(3)"'));
 assert(g.dom.root.innerHTML.includes('onclick="selectOption(0)"'));
 assert(g.dom.root.innerHTML.includes('onclick="selectOption(1)"'));
 g.dom.typedAnswer={value:h.run('state.question.options[answerIndex]'),disabled:false,blur(){}};
 g.run('submitTypedFromUI()');
 const message=g.messages.at(-1);
 assert.equal(message.t,'typed');
 h.window.onNative('remote',JSON.stringify({seat:1,msg:JSON.stringify(message)}));
 assert.equal(h.run('state.result.ok'),true,'correct written answer is accepted before all four choices');
 assert.equal(h.run('state.result.delta'),1);
 console.log('PASS hybrid 2-choice free text can answer with a still unspoken option');
}


{
 // The host announces all player scores after three completed rounds, inside the spoken
 // question narration, so the recap cannot interrupt an option or cause a premature buzzer.
 const e=env();join(e,4);
 e.run("state.players[0].score=5;state.players[1].score=4;state.players[2].score=-2;state.players[3].score=1;state.round=3;newRound()");
 assert.equal(e.run('state.round'),4);
 assert.equal(e.run('state.phase'),'announce');
 const spoken=e.calls.filter(x=>x.type==='question').at(-1).text;
 assert(spoken.includes('نقطة'),'score reading must include points');
 for(const name of Array.from(e.run('state.players.map(p=>p.name)')))assert(spoken.includes(name));
 assert(spoken.includes('سالب 2'),'negative score must be read in natural Arabic');
 assert(e.run('state.recap')!==null,'every 3 rounds score recap is recorded');
 assert(!e.dom.root.innerHTML.includes('id="thebuzzer"'),'recap and question both finish before buzzer');
 e.window.onNative('speechDone','4');
 assert.equal(e.run('state.phase'),'question');
 e.run('state.round=4;newRound()');
 assert.equal(e.run('state.recap'),null,'score reading must not intrude on every round');
 console.log('PASS spoken standings every third round, including negatives and full question timing');
}
{
 const e=env();join(e,2);
 e.run('state.players[0].score=8;state.players[1].score=7;state.round=1;newRound()');
 assert(e.run('state.recap'),'clutch score near win must trigger an extra recap');
 assert.equal(e.run('state.clutchRecapRead'),true);
 e.run('state.round=2;newRound()');
 assert.equal(e.run('state.recap'),null,'extra clutch recap is announced only once');
 console.log('PASS extra score announcement when a contestant nears 10 points');
}
{
 const e=env();join(e,3);
 e.run('startMatch()');startQuestion(e);
 const currentName=e.run('state.players.find(p=>p.seat===1).name');
 e.run('claimBuzz(1)');
 const buzz=e.calls.filter(x=>x.type==='mood').at(-1);
 assert.equal(buzz.mood,'excited');
 assert(buzz.text.includes(currentName),'fast buzz banter must mention current connected player name');
 e.run('submitTypedAnswer(1,"إجابة خاطئة")');
 assert.equal(e.run('state.result.delta'),-2);
 const roast=e.calls.filter(x=>x.type==='mood').at(-1);
 assert.equal(roast.mood,'tease');
 assert(roast.text.includes(currentName),'playful wrong-answer quip is about current participant');
 e.run('advanceRound()');
 e.run('buzzOpenedAt=Date.now()-3100;claimBuzz(0)');
 const slow=e.calls.filter(x=>x.type==='mood').at(-1);
 assert.equal(slow.mood,'suspense');
 console.log('PASS fast, slow and wrong-answer commentary vary by situation with expressive TTS moods');
}
{
 const e=env();
 const kinds=['fastBuzz','slowBuzz','fastWrong','wrongRoast','timeoutRoast','praise','scoreOpen','tied','close','runaway','mysteryIntro'];
 for(const kind of kinds){
   const phrases=Array.from({length:40},()=>e.run('hostLine('+JSON.stringify(kind)+')'));
   assert(phrases.every((x,i)=>i===0||x!==phrases[i-1]),kind+' should not repeat the same line twice consecutively');
   assert(new Set(phrases).size>=3,'needs plenty of variety for '+kind);
 }
 console.log('PASS 11 referee contexts with anti-repeat and varied Egyptian one-liners');
}
{
 const e=env();join(e,2);
 const all=e.run('TOTAL_QUESTIONS'),n=e.run('CAT_KEYS.length');
 assert(all>=1420,'expect 1420+ offline questions, got '+all);
 assert(n>=26,'expect >=26 categories, got '+n);
 for(const cat of ['🌍 خمن الدولة من الوصف','🏙️ خمن المدينة أو المكان']){
  assert(e.run('QUESTIONS['+JSON.stringify(cat)+'].length')>=50);
  const rows=Array.from(e.run('QUESTIONS['+JSON.stringify(cat)+']'));
  assert(rows.every(row=>row.length===5));
  assert(rows.every(row=>!row[0].includes(row[1])),'a described place must not be named in the clue');
  e.run('state.category='+JSON.stringify(cat)+';state.players[0].score=0;startMatch()');
  assert.equal(e.run('state.question.tier'),'easy');
  assert.equal(e.run('state.question.cat'),cat);
  assert(e.calls.filter(x=>x.type==='question').at(-1).text.includes('أنا مكان غامض'));
  e.run('state.players[0].score=3;newRound()');
  assert.equal(e.run('state.question.tier'),'medium');
  e.run('state.players[0].score=6;newRound()');
  assert.equal(e.run('state.question.tier'),'hard');
  e.run('resetToLobby()');
 }
 console.log('PASS '+all+' questions across '+n+' categories including 122 place/country riddles and adaptive levels');
}


{
 const e=env();e.run('cfg.target=3;cfg.bot=true;openOnlineRoom()');
 const call=e.calls.find(v=>v.type==='onlineCreate');
 assert(call&&call.target===3&&call.bot===true,'online room uses requested seat count and bot option');
 e.window.onNative('hosting','3');
 e.window.onNative('roomCode','621843');
 assert.equal(e.run('state.roomCode'),'621843');
 assert(e.dom.root.innerHTML.includes('621843'),'host lobby displays the six-digit invite code');
 e.window.onNative('join',JSON.stringify({seat:1,device:'friend'}));
 e.window.onNative('remote',JSON.stringify({seat:1,msg:JSON.stringify({t:'hello',name:'عادل'})}));
 assert(e.run('allReady()'),'2 humans + 1 computer fill a 3-seat room');
 assert.equal(e.run('state.players.find(p=>p.bot).seat'),2);
 assert(e.dom.root.innerHTML.includes('كمبيوتر'));
 console.log('PASS online create with room number, one reserved bot seat, two human players');
}
{
 const e=env();e.run('cfg.bot=true;cfg.target=2;roomMode="online";startHost(2)');
 assert(e.run('allReady()'),'one human plus CPU satisfies 2-seat minimum');
 e.run('startMatch()');startQuestion(e);
 e.run('claimBuzz(1)');
 assert.equal(e.run('state.players.find(p=>p.seat===1).bot'),true);
 assert(e.run('botAnswerAt')>Date.now());
 e.run('botWillAnswerCorrect=true;botAnswerAt=Date.now()-1;tick()');
 assert.equal(e.run('state.phase'),'result','computer must be able to submit its own answer');
 assert.equal(e.run('state.result.ok'),true);
 assert.equal(e.run('state.players[1].score'),1);
 console.log('PASS optional CPU plays as a real seat with delayed and scoreable answers');
}
{
 const e=env();e.run('cfg.bot=false;cfg.target=4;roomMode="online";startHost(4)');
 assert.equal(e.run('state.players.filter(p=>p.bot).length'),0);
 e.window.onNative('join',JSON.stringify({seat:1,device:'remote'}));
 e.window.onNative('join',JSON.stringify({seat:2,device:'remote'}));
 e.window.onNative('join',JSON.stringify({seat:3,device:'remote'}));
 assert(e.run('allReady()'),'4 remote/host humans all fit without bot');
 console.log('PASS full online four-human mode without computer');
}

console.log('ALL v10 TESTS PASSED');