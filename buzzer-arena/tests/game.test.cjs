const fs=require("fs"),vm=require("vm"),assert=require("assert"),path=require("path");
const folder=path.join(__dirname,"../app/src/main/assets");
function env(){
 const nodes={root:{innerHTML:""},nickname:{value:"أحمد"},timer:{textContent:"",classList:{toggle(){}}},timefill:{style:{}}};
 const calls=[],sent=[];
 const Native={send(msg){sent.push(JSON.parse(msg));},host(){},join(){},permission(){},paired(){},vibrate(){},speak(s){calls.push({kind:"comment",s});},speakQuestion(s,round){calls.push({kind:"question",s,round});},spellQuestion(s,letters,round){calls.push({kind:"spelling",s,letters:JSON.parse(letters),round});},disconnect(){},settings(){}};
 const window={Native},storage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}};
 const context={console,Date,Math,Set,JSON,Number,String,Object,Array,Intl,window,Native,document:{getElementById(id){return nodes[id]||null}},localStorage:storage,setInterval(){},clearInterval(){}};
 vm.createContext(context);
 for(const file of ["questions.js","extra_questions.js","hard_questions.js","core.js","ui.js"]){
  vm.runInContext(fs.readFileSync(path.join(folder,file),"utf8"),context,{filename:file});
 }
 return {nodes,calls,sent,window,run:s=>vm.runInContext(s,context)};
}
function addPlayers(env,n){
 env.window.onNative("hosting",String(n));
 for(let seat=1;seat<n;seat++){
  env.window.onNative("join",JSON.stringify({seat,device:"Phone-"+seat}));
  env.window.onNative("remote",JSON.stringify({seat,msg:JSON.stringify({t:"hello",name:"المتسابق "+seat})}));
 }
 assert.equal(env.run("allReady()"),true);
}
function openRound(env){
 assert.equal(env.run("state.phase"),"announce");
 assert(!env.nodes.root.innerHTML.includes('id="thebuzzer"'),"button must stay hidden while announcing");
 env.window.onNative("speechDone",String(env.run("state.round")));
 assert.equal(env.run("state.speechOver"),true);
 const delay=env.run("hiddenOpenAt-Date.now()");
 assert(delay>=-200&&delay<=15000,"secret delay must remain inside 0–15sec; got "+delay);
 assert.equal(env.run("state.deadline"),0,"secret time must never be sent over Bluetooth");
 assert(!env.nodes.root.innerHTML.includes('id="thebuzzer"'),"button still hidden before surprise");
 env.run("hiddenOpenAt=Date.now()+6000;openBuzz()");
 assert.equal(env.run("state.phase"),"announce","manual buzz open before secret time must be impossible");
 env.run("hiddenOpenAt=Date.now()-1;tick()");
 assert.equal(env.run("state.phase"),"question");
 assert(env.nodes.root.innerHTML.includes('id="thebuzzer"'),"buzzer must appear only when open");
}
for(const target of [2,3,4]){
 const e=env();addPlayers(e,target);e.run("startMatch()");
 openRound(e);
 // The last player wins a 3/4-player room and receives 10 correct points.
 const last=target-1;
 e.window.onNative("remote",JSON.stringify({seat:last,msg:'{"t":"buzz"}'}));
 assert.equal(e.run("state.phase"),"answer");
 assert.equal(e.run("state.lockedSeat"),last);
 assert.equal(e.run("state.fastBuzz"),true);
 assert.equal(e.run("state.answerWindowSec"),6);
 e.run("submitAnswer("+last+",answerIndex)");
 assert.equal(e.run("state.players.find(p=>p.seat==="+last+").score"),1);
 for(let i=2;i<=10;i++){
  e.run("advanceRound()");
  openRound(e);
  e.run("buzzOpenedAt=Date.now()-3200");
  e.run("claimBuzz("+last+");submitAnswer("+last+",answerIndex)");
  assert.equal(e.run("state.fastBuzz"),false);
  assert.equal(e.run("state.answerWindowSec"),12);
 }
 e.run("advanceRound()");
 assert.equal(e.run("state.phase"),"finished");
 assert.equal(e.run("state.winner"),last);
 assert(e.nodes.root.innerHTML.includes("البطل"));
 console.log("PASS "+target+" real human players, referee timing, scoring and victory");
}
{
 const e=env();addPlayers(e,2);e.run("startMatch()");openRound(e);
 e.run("buzzOpenedAt=Date.now()-100;claimBuzz(0)");
 assert.equal(e.run("state.answerWindowSec"),6);
 e.run("submitAnswer(0,(answerIndex+1)%4)");
 assert.equal(e.run("state.players[0].score"),-2);
 assert.equal(e.run("state.result.delta"),-2);
 assert(e.nodes.root.innerHTML.includes("−2"),"result screen must show minus two");
 e.run("advanceRound()");openRound(e);
 e.run("buzzOpenedAt=Date.now()-3000;claimBuzz(1)");
 assert.equal(e.run("state.answerWindowSec"),12);
 e.run("submitAnswer(1,(answerIndex+1)%4)");
 assert.equal(e.run("state.players.find(p=>p.seat===1).score"),-1);
 console.log("PASS early wrong=-2, later wrong=-1, fast window=6s, late window=12s");
}
{
 const e=env();addPlayers(e,2);e.run("startMatch()");openRound(e);
 e.run("claimBuzz(0);state.deadline=Date.now()-1;tick()");
 assert.equal(e.run("state.result.delta"),-2);
 e.run("advanceRound()");openRound(e);
 e.run("buzzOpenedAt=Date.now()-3000;claimBuzz(0);state.deadline=Date.now()-1;tick()");
 assert.equal(e.run("state.result.delta"),-1);
 e.run("advanceRound()");openRound(e);
 e.run("state.deadline=Date.now()-1;tick()");
 assert.equal(e.run("state.result.delta"),0);
 console.log("PASS unanswered early=-2, unanswered later=-1, nobody buzzed=0");
}
{
 const e=env();addPlayers(e,2);
 e.run('state.category="🔄 كلمة مقلوبة";startMatch()');
 const q=e.run("state.question");
 assert(q.audioOnly);
 assert(q.q.includes("اسمع")&&!q.q.includes("بالمقلوب:"));
 assert(e.calls.some(c=>c.kind==="spelling"),"must call native slow letter spelling");
 const call=e.calls.find(c=>c.kind==="spelling");
 assert.equal(call.letters.length,[...call.letters].length);
 assert(!e.nodes.root.innerHTML.includes(q.options[0]),"never expose answer choices before buzzer");
 const names=Array.from(e.run('spelledLetters("القصة")'));
 assert.deepEqual(names,["تاء مربوطة","صاد","قاف","لام","ألف"]);
 e.window.onNative("speechUnavailable",String(e.run("state.round")));
 assert.equal(e.run("state.phase"),"paused","audio-only mode without TTS must not become unsolvable silent question");
 console.log("PASS audio-only reverse questions, slow-spell labels, missing TTS handled");
}
{
 const e=env();addPlayers(e,2);
 const n=e.run("TOTAL_QUESTIONS"),cats=e.run("CAT_KEYS.length");
 assert(n>=1000,"expected 1000+ questions but had "+n);
 assert(cats>=20,"expected >=20 categories");
 assert.equal(e.run("CAT_KEYS.filter(k=>HARD_CATS.includes(k)).length"),5);
 const errors=e.run('CAT_KEYS.flatMap(cat=>QUESTIONS[cat].filter(row=>row.length!==(cat==="🔄 كلمة مقلوبة"?4:5)||new Set(cat==="🔄 كلمة مقلوبة"?row:row.slice(1)).size!==4).map(row=>cat))');
 assert.equal(errors.length,0);
 console.log("PASS question bank "+n+" verified structures across "+cats+" categories");
}
console.log("PASS all 3.0 quiz checks");
