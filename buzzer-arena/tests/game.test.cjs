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
 for(const file of ['questions.js','extras1.js','extras2.js','core.js','ui.js'])vm.runInContext(fs.readFileSync(path.join(folder,file),'utf8'),context,{filename:file});
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
 const {run,window}=env();
 const stats=run('Object.fromEntries(Object.entries(QUESTIONS).map(([name,rows])=>[name,rows.length]))');
 const total=Object.values(stats).reduce((a,b)=>a+b,0);
 assert(total>=550,'Question bank must include at least 550 questions, got '+total);
 const invalid=run('Object.entries(QUESTIONS).flatMap(([k,rows])=>rows.map((r,i)=>({k,i,good:r.length===(k==="🔄 كلمة مقلوبة"?4:5)&&new Set(r.slice(k==="🔄 كلمة مقلوبة"?0:1)).size===(k==="🔄 كلمة مقلوبة"?4:4)})).filter(x=>!x.good))');
 assert.equal(invalid.length,0,'Invalid options '+JSON.stringify(invalid.slice(0,3)));
 console.log('PASS '+total+' questions, '+Object.keys(stats).length+' categories');
 console.log('CATEGORIES '+JSON.stringify(stats));
 window.onNative('hosting','2');window.onNative('join',JSON.stringify({seat:1}));
 run('startMatch()');assert.equal(run('state.phase'),'announce');
 window.onNative('speechDone','1');assert.equal(run('state.speechOver'),true);
 run('state.deadline=Date.now()-1;openBuzz()');assert.equal(run('state.phase'),'question');
 console.log('PASS judge waits for speech then opens buzzer');
}
