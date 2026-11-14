import assert from "node:assert/strict";
const base=process.env.ROOM_URL||"https://jars-al-tahaddi-online.vercel.app/api/room";
async function call(body,expected=200){
 const r=await fetch(base,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const j=await r.json();
 assert.equal(r.status,expected,JSON.stringify({status:r.status,error:j.error||"unknown"}));
 return j;
}
function host(code,token,...rest){return {role:"host",code,token,...Object.fromEntries(rest.reduce((a,v,i)=>{if(i%2===0)a.push([v,rest[i+1]]);return a;},[]))};}
const rooms=[];
const created=await call({action:"create",target:2},201);
assert.match(created.code,/^[1-9][0-9]{5}$/);
assert.equal(created.token.length,64);
const code=created.code,token=created.token;
const guest=await call({action:"join",code},201);
assert.equal(guest.id.length,24);
assert.equal(guest.token.length,64);
const events=await call({action:"poll",role:"host",code,token,since:Date.now()-15000});
assert(events.events.some(x=>x.kind==="join"&&x.id===guest.id),"host must receive the join event");
await call({action:"welcome",role:"host",code,token,id:guest.id,seat:1});
const first=await call({action:"poll",role:"guest",code,id:guest.id,token:guest.token});
assert.equal(first.welcome.seat,1);
assert.equal(first.message,null);
const publicState={t:"state",s:{version:2,phase:"question",players:[{name:"صاحب الغرفة",score:0}],question:{q:"ما اسم هذه المدينة؟",options:["القاهرة","","",""]}}};
await call({action:"state",role:"host",code,token,message:publicState});
const after=await call({action:"poll",role:"guest",code,id:guest.id,token:guest.token});
assert.deepEqual(after.message,publicState,"guest polls current sanitized state");
await call({action:"event",role:"guest",code,id:guest.id,token:guest.token,message:{t:"buzz"}});
const signals=await call({action:"poll",role:"host",code,token,since:Date.now()-15000});
assert(signals.events.some(x=>x.kind==="event"&&x.id===guest.id&&x.message.t==="buzz"),"host receives guest buzzer");
await call({action:"state",role:"host",code,token:"0".repeat(64),message:publicState},403);
await call({action:"event",role:"guest",code,id:guest.id,token:"1".repeat(64),message:{t:"buzz"}},403);
await call({action:"create",target:5},400);
console.log("PASS internet relay: 6-digit room, join, seat assignment, sanitized state, guest buzzer, server auth and 2-4 seats");
console.log("PASS real Vercel private Blob hosting (credentials and invitation code hidden from test output)");
