const assert=require("assert"),fs=require("fs"),vm=require("vm"),path=require("path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/assets/onboarding.js"),"utf8");
function fixture(){
 const stored={};const screen={innerHTML:""};const sheet={id:"md-first-tour",innerHTML:"",remove(){delete doc.elements[this.id]}};
 const target={classList:{add(c){this.last=c},remove(c){this.last=null}},scrollIntoView(){}};
 const doc={body:{appendChild(node){doc.elements[node.id]=node}},elements:{},querySelector(){return target},createElement(){return {...sheet}},getElementById(id){return id==="typedAnswer"?{value:"إجابة"}:doc.elements[id]||null}};
 let questionHTML='<section class="card md-decide">اختيار</section><section class="card choicesCard">قائمة</section><form class="answerTextCard"><div class="kicker">🧠 إجابة من دماغك • +2 / −1</div></form>';
 const ctx={document:doc,localStorage:{getItem(k){return stored[k]||null},setItem(k,v){stored[k]=v}},window:{},setTimeout(f){f()},root:screen,renderHome(){screen.innerHTML='<p class="foot">فوتر</p>'},renderQuestion(){return questionHTML},renderGame(){},chooseAnswerMode(){},selectOption(){},submitTypedFromUI(){return false},state:{phase:"question",answerMode:null,lockedSeat:0},seat:0,mdOnlyText(){return false},Number,String};
 vm.createContext(ctx);vm.runInContext(src,ctx,{filename:"onboarding.js"});return {ctx,stored,doc,screen,setQuestion(s){questionHTML=s}};
}
const f=fixture();assert(f.doc.elements["md-first-tour"],"first launch must show tutorial");assert(f.doc.elements["md-first-tour"].innerHTML.includes("أول حاجة"));
f.ctx.window.mdTutorialNext();assert(f.doc.elements["md-first-tour"].innerHTML.includes("علشان تبدأ مباراة"));
for(let i=0;i<3;i++)f.ctx.window.mdTutorialNext();
assert(!f.doc.elements["md-first-tour"],"complete removes tutorial");
assert.strictEqual(f.stored.md_v14_guide_home_done,"1");
f.ctx.renderHome();assert(!f.doc.elements["md-first-tour"],"should never autoplay again on same device");
assert(f.screen.innerHTML.includes("شوف الإرشادات تاني"),"manual replay available");
f.ctx.window.mdReplayTour();assert(f.doc.elements["md-first-tour"],"manual help can be reopened");
f.ctx.window.mdTutorialSkip();
assert(f.ctx.renderQuestion().includes("🎓 دورك أول مرة"),"own turn gets tap guidance");
f.ctx.chooseAnswerMode("text");assert(!f.ctx.renderQuestion().includes("🎓 دورك أول مرة"),"mode guidance stops after action");
f.ctx.state.phase="answer";f.ctx.state.answerMode="text";assert(f.ctx.renderQuestion().includes("اكتب وبعدين ثبّت"));
f.ctx.submitTypedFromUI();assert(!f.ctx.renderQuestion().includes("اكتب وبعدين ثبّت"),"typing help dismissed on submit");
f.ctx.state.answerMode="choice";assert(f.ctx.renderQuestion().includes("اضغط على إجابتك"));
f.ctx.selectOption(0);assert(!f.ctx.renderQuestion().includes("اضغط على إجابتك"));
f.ctx.seat=1;f.ctx.state.phase="question";assert(!f.ctx.renderQuestion().includes("دورك أول مرة"),"tips never instruct spectators");
console.log("PASS first-run tour, skip, replay, mode/text/choice tips, spectator safeguards");