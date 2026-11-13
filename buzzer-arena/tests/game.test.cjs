const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');
const folder=path.join(__dirname,'../app/src/main/assets');
function env(){
 const nodes={root:{innerHTML:''},nickname:{value:'أحمد'},timer:{textContent:'',classList:{toggle(){}}},timefill:{style:{}}};
 const sent=[];const native={send(msg){sent.push(JSON.parse(msg));},host(){},join(){},permission(){},paired(){},vibrate(){},speak(){},speakQuestion(){},disconnect(){},settings(){}};
 const window={Native:native};
 const storage={data:{},getItem(k){return this.data[k]||null},setItem(k,v){this.data[k]=String(v)}};
 const context={console,Date,Math,Set,JSON,Number,String,Object,Array,Intl,window,Native:native,document:{getElementById(id){return nodes[id]||null}},localStorage:storage,setInterval(){},clearInterval(){}};
 vm.createContext(context);
 for(const file of ['questions.js','extra_questions.js','core.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(folder,file),'utf8'),context,{filename:file});
 return {context,nodes,sent,window,run:s=>vm.runInContext(s,context)};
}
for(const target of [2,3,4]){
 const {window,run,nodes}=env();
 window.onNative('hosting',String(target));
 assert.equal(run('state.target'),target);
 for(let i=1;i<target;i++){
  window.onNative('join',JSON.stringify({seat:i,device:'Phone'+i}));
  window.onNative('remote',JSON.stringify({seat:i,msg:JSON.stringify({t:'hello',name:'لاعب '+i})}));
 }
 assert.equal(run('allReady()'),true);
 run('startMatch()');
 assert.equal(run('state.phase'),'announce');
 run('state.deadline=Date.now()-1;openBuzz()');
 assert.equal(run('state.phase'),'question');
 window.onNative('remote',JSON.stringify({seat:target-1,msg:JSON.stringify({t:'buzz'})}));
 assert.equal(run('state.phase'),'answer');
 assert.equal(run('state.lockedSeat'),target-1);
 run('submitAnswer('+String(target-1)+',answerIndex)');
 assert.equal(run('state.phase'),'result');
 assert.equal(run('state.players.find(p=>p.seat==='+String(target-1)+').score'),1);
 for(let n=2;n<=10;n++){
  run('advanceRound();state.deadline=Date.now()-1;openBuzz()');
  run('claimBuzz('+String(target-1)+');submitAnswer('+String(target-1)+',answerIndex)');
  assert.equal(run('state.players.find(p=>p.seat==='+String(target-1)+').score'),n);
 }
 run('advanceRound()');
 assert.equal(run('state.phase'),'finished');
 assert.equal(run('state.winner'),target-1);
 assert(nodes.root.innerHTML.includes('البطل'));
 console.log('PASS '+target+' human players, buzzer locking, scoring, victory');
}
{
 const {window,run}=env();window.onNative('hosting','2');
 window.onNative('join',JSON.stringify({seat:1}));run('startMatch();state.deadline=Date.now()-1;openBuzz()');
 run('claimBuzz(0);claimBuzz(1)');
 assert.equal(run('state.lockedSeat'),0);
 run('submitAnswer(0,(answerIndex+1)%4)');
 assert.equal(run('state.players[0].score'),-1);
 console.log('PASS first buzzer only; wrong answer loses one point');
}
{
 const {window,run}=env();window.onNative('hosting','2');
 window.onNative('join',JSON.stringify({seat:1}));
 run('state.category="🔄 كلمة مقلوبة";startMatch()');
 assert.equal(run('state.question.options.length'),4);
 assert(run('state.question.q.includes("بالمقلوب")'));
 console.log('PASS reversed words category');
}
console.log('PASS all quick checks');

{
 const {window,run}=env();window.onNative('hosting','2');window.onNative('join',JSON.stringify({seat:1}));
 run('startMatch()');
 assert.equal(run('state.phase'),'announce');
 run('openBuzz()');
 assert.equal(run('state.phase'),'announce','buzzer must not open before referee finishes speaking');
 window.onNative('speechDone','1');
 assert.equal(run('state.speechOver'),true);
 run('state.deadline=Date.now()-1;openBuzz()');
 assert.equal(run('state.phase'),'question');
 console.log('PASS spoken referee unlocks buzzer only after narration / grace period');
}
{
 const {window,run}=env();window.onNative('hosting','3');
 assert(run('TOTAL_QUESTIONS')>=800);
 assert(run('CAT_KEYS.length')>=14);
 const bad=run('CAT_KEYS.flatMap(cat=>QUESTIONS[cat].filter(row=>row.length!==4 && row.length!==5).map(row=>cat))');
 assert.equal(bad.length,0);
 console.log('PASS quiz bank: '+run('TOTAL_QUESTIONS')+' questions, '+run('CAT_KEYS.length')+' categories');
}
