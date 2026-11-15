import {get,put,list} from "@vercel/blob";
import {randomBytes,randomInt,scrypt as scryptCallback,timingSafeEqual,createHash} from "node:crypto";
import {promisify} from "node:util";

const scrypt=promisify(scryptCallback);
const ROOT="game-web/v1",ROOM_ROOT="game-rooms/v1";
const SESSION_DAYS=7, GUEST_HOURS=24, maxBody=3500;
const attempts=new Map();
const hash=s=>createHash("sha256").update(String(s)).digest("hex");
const safeEqual=(a,b)=>typeof a==="string"&&typeof b==="string"&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const path=(group,id)=>ROOT+"/"+group+"/"+id+".json";
const json=(res,code,value)=>res.status(code).setHeader("Cache-Control","no-store").setHeader("X-Content-Type-Options","nosniff").json(value);
const blobOptions=overwrite=>({access:"private",addRandomSuffix:false,allowOverwrite:overwrite,contentType:"application/json"});
async function read(key){
 try{const file=await get(key,{access:"private",useCache:false});return file?await new Response(file.stream).json():null;}
 catch(e){if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;throw e;}
}
async function write(key,value,overwrite=false){await put(key,JSON.stringify(value),blobOptions(overwrite));}
function parseCookie(req){const raw=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("md_session="));return raw?raw.slice("md_session=".length):"";}
function setCookie(res,token,maxAge){
 res.setHeader("Set-Cookie","md_session="+token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age="+maxAge);
}
function nameOK(s){return typeof s==="string"&&s.length>=3&&s.length<=24&&/^[\p{L}\p{N}_]+$/u.test(s);}
function normalizeName(s){return typeof s==="string"?s.normalize("NFKC").toLowerCase().trim():"";}
function nickname(s){return String(s||"").trim().replace(/[<>\\\r\n\t]/g,"").slice(0,18);}
function bodyOK(req){const ct=String(req.headers["content-type"]||"");return ct.includes("application/json")&&JSON.stringify(req.body||{}).length<=maxBody;}
function originOK(req){const origin=req.headers.origin;if(!origin)return true;try{return new URL(origin).host===req.headers.host;}catch(e){return false;}}
function throttle(req,type){
 const ip=String(req.headers["x-real-ip"]||req.headers["x-forwarded-for"]||"unknown").split(",")[0].trim();
 const key=type+":"+hash(ip),now=Date.now(),info=attempts.get(key)||{time:now,n:0};
 if(now-info.time>60_000){info.n=0;info.time=now;}
 info.n++;attempts.set(key,info);
 if(attempts.size>2000){for(const [k,v] of attempts){if(now-v.time>60_000)attempts.delete(k);}if(attempts.size>2000)attempts.clear();}
 return info.n<=(type==="auth"?15:90);
}
async function userFor(req){
 const token=parseCookie(req);
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const session=await read(path("sessions",hash(token)));
 if(!session||session.expires<Date.now())return null;
 return {id:session.id,name:session.name,username:session.username||null,guest:!!session.guest,isOwner:!session.guest&&session.username==="owner"&&session.id===hash("owner")};
}
async function loginSession(res,details,isGuest){
 const token=randomBytes(32).toString("hex"),hours=isGuest?GUEST_HOURS:SESSION_DAYS*24;
 await write(path("sessions",hash(token)),{...details,guest:isGuest,expires:Date.now()+hours*3_600_000});
 setCookie(res,token,hours*3600);
 return {id:details.id,name:details.name,username:details.username||null,guest:isGuest,isOwner:!isGuest&&details.username==="owner"&&details.id===hash("owner")};
}
async function passwordHash(password,salt){return (await scrypt(password,salt,64,{maxmem:64*1024*1024})).toString("hex");}
function validPassword(x){return typeof x==="string"&&x.length>=8&&x.length<=128;}
async function allRooms(query,forOwner=false){
 const entries=[];let cursor;
 for(let pg=0;pg<3;pg++){
  const found=await list({prefix:ROOT+"/rooms/",limit:100,cursor});
  entries.push(...(found.blobs||[]));
  if(!found.hasMore||entries.length>=200)break;
  cursor=found.cursor;
 }
 const now=Date.now(),filtered=[];
 for(const entry of entries.slice(0,200)){
  const doc=await read(entry.pathname);
  if(!doc||doc.expires<=now||doc.closed)continue;
  if(query&&!([doc.code,doc.title,doc.hostName].some(x=>String(x).toLowerCase().includes(query))))continue;
  filtered.push(doc);
 }
 filtered.sort((a,b)=>b.created-a.created);
 const result=[];
 for(const entry of filtered.slice(0,35)){
  const state=await read(ROOM_ROOT+"/"+entry.code+"/state.json");
  const s=state?.message?.s;
  const stale=!state?.updated||Date.now()-state.updated>90_000;
  if(stale&&Date.now()-entry.created>60_000)continue;
  if(!forOwner&&(s?.phase==="finished"||s?.phase==="paused"))continue;
  if(!forOwner&&!stale&&Array.isArray(s?.players)&&s.players.length>=entry.target)continue;
  result.push({code:entry.code,title:entry.title,host:entry.hostName,target:entry.target,
    players:Array.isArray(s?.players)?s.players.filter(p=>p.online).length:1,created:entry.created,
    expires:entry.expires,phase:s?.phase||"lobby",stale});
  if(result.length>=40)break;
 }
 return result;
}
export default async function handler(req,res){
 try{
  if(req.method==="OPTIONS")return json(res,405,{error:"Not allowed"});
  if(req.method==="GET"){
   const action=String(req.query.action||"");
   if(action==="health")return json(res,200,{ok:true,app:"Men Demaghak web",version:1,auth:"registered-and-guest",rooms:"owner-only-and-random-matchmaking"});
   if(action==="me")return json(res,200,{ok:true,user:await userFor(req)});
   if(action==="rooms"){
    const user=await userFor(req);
    if(!user)return json(res,401,{error:"سجّل الدخول أولًا"});
    if(!user.isOwner)return json(res,403,{error:"قائمة الغرف متاحة للمالك فقط"});
    if(!throttle(req,"list"))return json(res,429,{error:"طلبات كتير، حاول بعد دقيقة"});
    const search=String(req.query.search||"").trim().toLowerCase().slice(0,40);
    return json(res,200,{ok:true,rooms:await allRooms(search,true)});
   }
   return json(res,404,{error:"Not found"});
  }
  if(req.method!=="POST")return json(res,405,{error:"Method not allowed"});
  if(!bodyOK(req)||!originOK(req))return json(res,400,{error:"طلب غير صالح"});
  const action=String(req.body.action||"");
  if(["register","login","guest"].includes(action)){
   if(!throttle(req,"auth"))return json(res,429,{error:"محاولات كتير، جرب بعد دقيقة"});
   if(action==="guest"){
    const label=nickname(req.body.name);
    if(label.length<2)return json(res,400,{error:"اكتب اسمًا من حرفين على الأقل"});
    const user=await loginSession(res,{id:"guest_"+randomBytes(8).toString("hex"),name:label},true);
    return json(res,200,{ok:true,user});
   }
   const username=normalizeName(req.body.username),password=req.body.password;
   if(!nameOK(username)||!validPassword(password))return json(res,400,{error:"اسم المستخدم 3–24 حرفًا، وكلمة المرور 8 أحرف على الأقل"});
   const accountPath=path("accounts",hash(username));
   if(action==="register"){
    if(username==="owner")return json(res,403,{error:"اسم المستخدم ده مخصص لمالك اللعبة"});
    const salt=randomBytes(16).toString("hex");
    const digest=await passwordHash(password,salt);
    const record={id:hash(username),username,name:nickname(req.body.name)||username.slice(0,18),
      salt,digest,created:Date.now()};
    try{await write(accountPath,record,false);}
    catch(e){if(String(e).includes("already exists")||e?.status===409||String(e).includes("409"))return json(res,409,{error:"اسم المستخدم مستخدم بالفعل"});throw e;}
    const user=await loginSession(res,{id:record.id,username,name:record.name},false);
    return json(res,201,{ok:true,user});
   }
   const record=await read(accountPath);
   const salt=record?.salt||randomBytes(16).toString("hex"),expected=record?.digest||"0".repeat(128);
   const digest=await passwordHash(password,salt);
   if(!record||!safeEqual(digest,expected))return json(res,401,{error:"اسم المستخدم أو كلمة المرور غير صحيحة"});
   const user=await loginSession(res,{id:record.id,username:record.username,name:record.name},false);
   return json(res,200,{ok:true,user});
  }
  if(action==="logout"){setCookie(res,"",0);return json(res,200,{ok:true});}
  const user=await userFor(req);
  if(!user)return json(res,401,{error:"سجّل الدخول أو ادخل كضيف"});
  if(action==="match"){
   if(!throttle(req,"list"))return json(res,429,{error:"استنى دقيقة وجرب تاني"});
   const available=(await allRooms("",false)).filter(r=>r.phase==="lobby"&&r.players<r.target&&(!r.stale||Date.now()-r.created<12000));
   if(!available.length)return json(res,200,{ok:true,code:null,create:true});
   const selected=available[randomInt(available.length)];
   return json(res,200,{ok:true,code:selected.code,create:false});
  }
  if(action==="publish"||action==="close"){
   const code=String(req.body.code||""),token=String(req.body.token||"");
   if(!/^[1-9][0-9]{5}$/.test(code)||!/^[a-f0-9]{64}$/.test(token))return json(res,400,{error:"بيانات الغرفة غير صحيحة"});
   const meta=await read(ROOM_ROOT+"/"+code+"/meta.json");
   if(!meta||meta.expires<Date.now()||!safeEqual(meta.hostToken,token))return json(res,403,{error:"مالك الغرفة فقط يقدر يعدّلها"});
   const pathRoom=path("rooms",code);
   if(action==="close"){
    await write(pathRoom,{code,closed:true,created:Date.now(),expires:Date.now()},true);
    return json(res,200,{ok:true});
   }
   const title=String(req.body.title||"").trim().replace(/[<>]/g,"").slice(0,40)||"غرفة "+user.name;
   const record={code,title,hostName:user.name,target:meta.target,created:meta.created,expires:meta.expires,closed:false};
   await write(pathRoom,record,true);
   return json(res,200,{ok:true,room:record});
  }
  return json(res,400,{error:"Unknown action"});
 }catch(e){console.error("web API",e?.message||e);return json(res,500,{error:"حصل خطأ مؤقت. جرّب تاني"});}
}
