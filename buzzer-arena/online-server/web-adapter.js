"use strict";
(function(){
 let epoch=0,active=false,owner=false,code="",token="",playerId="",target=2,botSeat=-1,assignedSeat=-2;
 let lastEvents=0,lastState=0,processed=new Set(),assigned=new Map(),queue=Promise.resolve(),pollTimer=0,errors=0;
 const notify=(kind,detail="")=>{if(typeof window.onNative==="function")window.onNative(kind,String(detail));};
 async function request(body){
  const r=await fetch("/api/room",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
  let j={};try{j=await r.json();}catch(e){}
  if(!r.ok)throw Error(j.error||"السيرفر مش متاح");
  return j;
 }
 async function webAction(body){
  const r=await fetch("/api/web",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});
  const j=await r.json();if(!r.ok)throw Error(j.error||"تعذر تحديث الغرفة");return j;
 }
 function stop(){
  active=false;epoch++;clearTimeout(pollTimer);pollTimer=0;processed.clear();assigned.clear();queue=Promise.resolve();
 }
 function enqueue(body){
  queue=queue.then(async()=>{
   await request(body);
   // The host is counted only after the live room state has been accepted by the server.
   if(body.action==="state"&&body.message?.s&&["announce","question","answer","result","finished"].includes(body.message.s.phase))
    void window.mdTrackPlayed?.({code,role:"host",token});
  }).catch(e=>{console.warn("room send",e.message);notify("onlineWarning","في تأخير بالشبكة، بنحاول نكمل...");});
 }
 async function create(n,computer){
  stop();const ticket=epoch;
  target=Math.max(2,Math.min(4,Number(n)||2));botSeat=computer?target-1:-1;owner=true;
  notify("waiting","بنجهز الغرفة الأونلاين...");
  try{
   const r=await request({action:"create",target});if(ticket!==epoch)return;
   code=r.code;token=r.token;active=true;lastEvents=Date.now()-1500;lastState=0;errors=0;
   try{await webAction({action:"publish",code,token,title:String(window.mdRoomTitle||"غرفة من دماغك").slice(0,40)});}catch(e){console.warn("room directory",e.message);}
   if(ticket!==epoch)return;
   notify("hosting",target);notify("roomCode",code);schedule(ticket,20);
  }catch(e){if(ticket===epoch){active=false;notify("error","تعذر إنشاء الغرفة: "+e.message);}}
 }
 async function join(room){
  stop();const ticket=epoch;
  code=String(room||"").trim();owner=false;lastState=0;assignedSeat=-2;
  if(!/^[1-9][0-9]{5}$/.test(code)){notify("error","رقم الغرفة لازم 6 أرقام");return;}
  notify("waiting","بندخل غرفة "+code+"...");
  try{
   const r=await request({action:"join",code});if(ticket!==epoch)return;
   token=r.token;playerId=r.id;active=true;errors=0;
   notify("connected","تم الاتصال بالسيرفر");notify("roomCode",code);schedule(ticket,40);
  }catch(e){if(ticket===epoch){active=false;notify("error","تعذر الانضمام: "+e.message);}}
 }
 function schedule(ticket,ms){if(!active||ticket!==epoch)return;pollTimer=setTimeout(()=>tick(ticket),ms);}
 async function tick(ticket){
  if(!active||ticket!==epoch)return;
  try{
   if(owner)await readHost();else await readGuest();
   errors=0;
  }catch(e){
   errors++;if(errors===3)notify("onlineWarning","الشبكة بطيئة، بنحاول نرجع...");
   if(errors>=12){stop();notify("disconnected","اتقطع الاتصال بسيرفر اللعبة. ارجع للقائمة وجرب تاني.");return;}
  }
  if(active&&ticket===epoch)schedule(ticket,owner?800:1100);
 }
 async function readHost(){
  const data=await request({action:"poll",role:"host",code,token,since:lastEvents?lastEvents-1000:Date.now()-15000});
  for(const item of data.events||[]){
   if(processed.has(item.eventId))continue;
   processed.add(item.eventId);if(processed.size>1800)processed.clear();
   lastEvents=Math.max(lastEvents,Number(item.time)||0);
   if(item.kind==="join"){
    if(assigned.has(item.id)){enqueue({action:"welcome",role:"host",code,token,id:item.id,seat:assigned.get(item.id)});continue;}
    let seat=-1;
    for(let i=1;i<target;i++)if(i!==botSeat&&![...assigned.values()].includes(i)){seat=i;break;}
    assigned.set(item.id,seat);
    enqueue({action:"welcome",role:"host",code,token,id:item.id,seat});
    if(seat>=0)notify("join",JSON.stringify({seat,device:"متسابق ويب"}));
   }else if(item.kind==="event"){
    const seat=assigned.get(item.id);
    if(seat===undefined||seat<0)continue;
    if(item.message?.t==="leave"){assigned.delete(item.id);notify("leave",seat);}
    else notify("remote",JSON.stringify({seat,msg:JSON.stringify(item.message)}));
   }
  }
 }
 async function readGuest(){
  const r=await request({action:"poll",role:"guest",code,id:playerId,token});
  if(r.welcome&&assignedSeat===-2){
   assignedSeat=r.welcome.seat;
   if(assignedSeat<0){notify("message",JSON.stringify({t:"full"}));stop();return;}
   notify("message",JSON.stringify({t:"welcome",seat:assignedSeat}));
  }
  if(assignedSeat<0)return;
  if(r.message&&r.updated>lastState){
   lastState=r.updated;notify("message",JSON.stringify(r.message));
   // A guest is counted only after an assigned seat receives a started game state.
   if(assignedSeat>=0&&r.message.t==="state"&&["announce","question","answer","result","finished"].includes(r.message.s?.phase))
    void window.mdTrackPlayed?.({code,role:"guest",token,id:playerId});
  }
 }
 window.Native={
  onlineCreate:(n,bot)=>{void create(n,bot);},
  onlineJoin:room=>{void join(room);},
  send:packet=>{
   if(!active)return;
   let message;try{message=JSON.parse(packet);}catch(e){return;}
   if(owner&&message.t==="state")enqueue({action:"state",role:"host",code,token,message});
   else if(!owner&&["hello","mode","choice","typed","skipRequest","leave"].includes(message.t))
    enqueue({action:"event",role:"guest",code,id:playerId,token,message});
  },
  disconnect:()=>{
   if(active){
    if(owner){void webAction({action:"close",code,token}).catch(()=>{});}
    else enqueue({action:"event",role:"guest",code,id:playerId,token,message:{t:"leave"}});
   }
   stop();
  },
  speak(){},speakMood(){},speakChoice(){},stopSpeech(){},vibrate(){},playBell(){},
  speakQuestion(text,round){setTimeout(()=>notify("speechDone",round),30);},
  spellQuestion(text,letters,round){setTimeout(()=>notify("speechDone",round),30);}
 };
 window.mdRelay={get code(){return code;},get active(){return active;},get owner(){return owner;}};
})();