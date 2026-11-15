const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const dir=path.join(__dirname,'..','app','src','main','assets');
function env(n=2){
 const calls=[],input={value:'',disabled:false,blur(){},focus(){}};
 const root={innerHTML:''};const store={buzzerVoice:'off'};
 const Native={send(s){calls.push(JSON.parse(s));},stopSpeech(){},vibrate(){},speak(){},speakQuestion(){},speakChoice(){},onlineCreate(){},onlineJoin(){},disconnect(){}};
 const ctx={console,Math,Date,JSON,Array,Number,String,Boolean,Set,Map,RegExp,Intl,
    window:{Native},Native,localStorage:{getItem(k){return store[k]||null;},setItem(k,v){store[k]=v;}},
    document:{getElementById(id){return id==='root'?root:id==='typedAnswer'?input:null;}},
    setInterval(){},setTimeout(){},clearTimeout(){}};
 ctx.window.window=ctx.window;
 vm.createContext(ctx);
 for(const f of ['questions.js','extra_questions.js','extras1.js','extras2.js','hard_questions.js','movie_music_levels.js','flag_questions.js','guess_places.js','guess_everyday.js','core.js','ui.js','turn_mode.js','turn_ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
 ctx.__root=root;ctx.__calls=calls;ctx.__input=input;
 ctx.eval=(code)=>vm.runInContext(code,ctx);
 ctx.eval(`host=true;online=true;seat=0;roomMode='online';state=mkLobby(${n});state.players=${JSON.stringify(Array.from({length:n},(_,i)=>({seat:i,name:'لاعب'+i,score:0,online:true})))};state.category='🎬 سينما وتلفزيون';`);
 return ctx;
}
let ntests=0;
function test(name,fun){try{fun();console.log('PASS',name);ntests++;}catch(e){console.error('FAIL',name,e.message);throw e;}}
function open(e){e.eval('startMatch()');assert.equal(e.eval('state.phase'),'question');}
function pickWrong(e){return e.eval('state.question.options.findIndex((x,i)=>i!==answerIndex)')}
function typedCorrect(e){return e.eval('state.question.options[answerIndex]')}
test('new turn opens without buzzer and 10 point target',()=>{
 const e=env();open(e);assert.equal(e.eval('state.turnSeat'),0);assert.equal(e.eval('state.lockedSeat'),0);
 assert(!e.__root.innerHTML.includes('id="thebuzzer"'));assert(e.__root.innerHTML.includes('دماغك'));
 assert.equal(e.eval('WIN_AT'),10);
});
test('free text +2 and not expose secret answer in relay',()=>{
 const e=env();open(e);e.eval('chooseAnswerMode("text")');assert.equal(e.eval('state.answerMode'),'text');
 assert(e.__calls.at(-1).s.question.options.every(x=>x===''));
 e.eval(`submitTypedAnswer(0,${JSON.stringify(typedCorrect(e))})`);
 assert.equal(e.eval('state.players[0].score'),2);assert.equal(e.eval('state.result.delta'),2);
 e.eval('advanceRound()');assert.equal(e.eval('state.turnSeat'),1);
});
test('choice +1 and penalty −2, free penalty −1 and one steal only',()=>{
 const e=env();open(e);e.eval('chooseAnswerMode("choice")');assert.equal(e.eval('state.optionsShownCount'),4);
 assert(e.__calls.at(-1).s.question.options.every(Boolean));
 e.eval(`submitAnswer(0,${pickWrong(e)})`);assert.equal(e.eval('state.players[0].score'),-2);assert(e.eval('state.result.retry'));
 e.eval('advanceRound()');assert.equal(e.eval('state.lockedSeat'),1);assert.equal(e.eval('state.stealStage'),true);
 e.eval('mdApplyMode(1,"text")');e.eval('submitTypedAnswer(1,"مش عارف")');
 assert.equal(e.eval('state.players[1].score'),-1);assert(!e.eval('state.result.retry'));
 e.eval('advanceRound()');assert.equal(e.eval('state.turnSeat'),1);
});
test('old buzz packets are ignored, mode packet from wrong seat ignored',()=>{
 const e=env();open(e);
 e.eval(`handleRemote({seat:1,msg:JSON.stringify({t:'mode',mode:'choice'})})`);
 assert.equal(e.eval('state.phase'),'question');
 e.eval(`handleRemote({seat:1,msg:JSON.stringify({t:'buzz'})})`);
 assert.equal(e.eval('state.lockedSeat'),0);
 e.eval('chooseAnswerMode("text")');e.eval('submitTypedAnswer(1,"نص")');assert.equal(e.eval('state.phase'),'answer');
});
test('3/4 player owner turns cycle with no round limit',()=>{
 for(const n of [3,4]){
  const e=env(n);open(e);
  for(let i=0;i<n*3;i++){
   assert.equal(e.eval('state.turnSeat'),i%n);
   e.eval('skipQuestion()');e.eval('advanceRound()');
  }
 }
});
test('time limit charged to turn owner and one steal only',()=>{
 const e=env();open(e);e.eval('state.deadline=Date.now()-1;tick()');
 assert.equal(e.eval('state.players[0].score'),-1);assert(e.eval('state.result.retry'));
 e.eval('advanceRound()');e.eval('state.deadline=Date.now()-1;tick()');
 assert.equal(e.eval('state.players[1].score'),-1);assert(!e.eval('state.result.retry'));
});
test('first to 10 wins; no fixed question count',()=>{
 const e=env();open(e);e.eval('state.players[0].score=8');e.eval('chooseAnswerMode("text")');
 e.eval(`submitTypedAnswer(0,${JSON.stringify(typedCorrect(e))})`);e.eval('advanceRound()');
 assert.equal(e.eval('state.phase'),'finished');assert.equal(e.eval('state.winner'),0);
});
console.log(ntests,'tests passed');
