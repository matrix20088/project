import {get,put,list} from "@vercel/blob";
import {randomBytes,createHash,timingSafeEqual} from "node:crypto";
import {isGameOwner} from "./owner-auth.js";

const ROOT="game-web/v1", ROOMS="game-rooms/v1",STATS="game-stats/v1/visitors/";
const hash=x=>createHash("sha256").update(String(x)).digest("hex");
const safeEqual=(a,b)=>typeof a==="string"&&typeof b==="string"&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const json=(res,status,data)=>res.status(status).setHeader("Cache-Control","no-store").setHeader("X-Content-Type-Options","nosniff").json(data);
const opts=overwrite=>({access:"private",addRandomSuffix:false,allowOverwrite:overwrite,contentType:"application/json"});
async function read(path){
 try{const blob=await get(path,{access:"private",useCache:false});return blob?await new Response(blob.stream).json():null;}
 catch(e){if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;throw e;}
}
const save=(p,d)=>put(p,JSON.stringify(d),opts(true));
function cookie(req,name){const a=String(req.headers.cookie||"").split(";").map(s=>s.trim()).find(s=>s.startsWith(name+"="));return a?a.slice(name.length+1):"";}
function visitor(req){const id=cookie(req,"md_vid");return /^[a-f0-9]{32}$/.test(id)?id:null;}
async function sessionFor(req){
 const t=cookie(req,"md_session");if(!/^[a-f0-9]{64}$/.test(t))return null;
 const s=await read(ROOT+"/sessions/"+hash(t)+".json");
 return s&&s.expires>Date.now()?s:null;
}
function recordPath(id){return STATS+id+".json";}
function normalize(doc,id){
 return {id,firstSeen:Number(doc?.firstSeen)||Date.now(),lastSeen:Number(doc?.lastSeen)||Date.now(),
  lastName:String(doc?.lastName||"").slice(0,18),username:String(doc?.username||"").slice(0,24),
  type:["registered","guest","anonymous"].includes(doc?.type)?doc.type:"anonymous",
  firstPlayed:Number(doc?.firstPlayed)||0,lastPlayed:Number(doc?.lastPlayed)||0,
  games:Math.max(0,Number(doc?.games)||0),rooms:Array.isArray(doc?.rooms)?doc.rooms.filter(x=>/^[1-9][0-9]{5}$/.test(String(x))).slice(-100):[]};
}
async function markVisit(req,res){
 const id=visitor(req)||randomBytes(16).toString("hex");
 const now=Date.now(),old=await read(recordPath(id)),row=normalize(old,id),s=await sessionFor(req);
 if(!old)row.firstSeen=now;
 row.lastSeen=now;
 if(s){
  row.type=s.guest?"guest":"registered";
  if(s.name)row.lastName=String(s.name).slice(0,18);
  if(!s.guest&&s.username)row.username=String(s.username).slice(0,24);
 }
 await save(recordPath(id),row);
 if(!visitor(req))res.setHeader("Set-Cookie","md_vid="+id+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000");
 return json(res,200,{ok:true,tracking:"browser"});
}
async function markPlayed(req,res,body){
 const id=visitor(req);if(!id)return json(res,409,{error:"سجّل زيارة الموقع أولًا"});
 const code=String(body.code||""),role=String(body.role||""),token=String(body.token||"");
 if(!/^[1-9][0-9]{5}$/.test(code)||!/^[a-f0-9]{64}$/.test(token))return json(res,400,{error:"بيانات المباراة غير صحيحة"});
 const [meta,record]=await Promise.all([read(ROOMS+"/"+code+"/meta.json"),read(recordPath(id))]);
 if(!meta||meta.expires<Date.now())return json(res,404,{error:"المباراة انتهت"});
 let seat=0;
 if(role==="host"){
  if(!safeEqual(token,meta.hostToken))return json(res,403,{error:"غير مصرح"});
 }else if(role==="guest"){
  const playerId=String(body.id||"");if(!/^[a-f0-9]{24}$/.test(playerId))return json(res,400,{error:"مقعد غير صحيح"});
  const [player,welcome]=await Promise.all([read(ROOMS+"/"+code+"/players/"+playerId+".json"),read(ROOMS+"/"+code+"/welcome/"+playerId+".json")]);
  if(!player||!safeEqual(token,player.token)||!Number.isInteger(welcome?.seat)||welcome.seat<1||welcome.seat>=meta.target)return json(res,403,{error:"اللاعب غير مؤكد"});
  seat=welcome.seat;
 }else return json(res,400,{error:"دور غير صحيح"});
 const current=await read(ROOMS+"/"+code+"/state.json");
 const state=current?.message?.s;
 if(!state||!["announce","question","answer","result","finished"].includes(state.phase)||
     !Array.isArray(state.players)||!state.players.some(p=>p.seat===seat&&p.online!==false))
  return json(res,409,{error:"المباراة لم تبدأ أو اللاعب لم ينضم فعليًا"});
 const now=Date.now(),row=normalize(record,id),s=await sessionFor(req);
 if(!record)row.firstSeen=now;
 row.lastSeen=now;
 if(s){
  row.type=s.guest?"guest":"registered";if(s.name)row.lastName=String(s.name).slice(0,18);
  if(!s.guest&&s.username)row.username=String(s.username).slice(0,24);
 }
 if(!row.firstPlayed)row.firstPlayed=now;
 row.lastPlayed=now;
 if(!row.rooms.includes(code)){row.games++;row.rooms=[...row.rooms,code].slice(-100);}
 await save(recordPath(id),row);
 return json(res,200,{ok:true,played:true,games:row.games});
}
async function dashboard(req,res){
 const owner=await sessionFor(req);
 if(!await isGameOwner(owner))return json(res,403,{error:"الإحصائيات متاحة لحساب المالك فقط"});
 const entries=[];let cursor,complete=true;
 for(let page=0;page<30;page++){
  const batch=await list({prefix:STATS,limit:100,cursor});
  entries.push(...(batch.blobs||[]));
  if(!batch.hasMore){cursor=null;break;}
  cursor=batch.cursor;
  if(page===29)complete=false;
 }
 const rows=[];
 // Cap concurrent private Blob reads to avoid function resource spikes.
 for(let i=0;i<entries.length;i+=20){
  const chunk=await Promise.all(entries.slice(i,i+20).map(async item=>{
   const doc=await read(item.pathname);
   if(!doc)return null;
   const id=String(item.pathname).split("/").pop().replace(/\.json$/,"");
   if(!/^[a-f0-9]{32}$/.test(id))return null;
   return normalize(doc,id);
  }));
  rows.push(...chunk.filter(Boolean));
 }
 rows.sort((a,b)=>b.lastSeen-a.lastSeen);
 const now=Date.now(),startDay=new Date().setUTCHours(0,0,0,0);
 const played=rows.filter(x=>x.firstPlayed);
 const visitors=rows.length;
 const day=rows.filter(x=>x.firstSeen>=startDay).length;
 const last7=rows.filter(x=>x.firstSeen>=now-7*86400000).length;
 const format=r=>({id:r.id.slice(0,8),name:r.lastName||"زائر بدون تسجيل",username:r.username||null,
  type:r.type,firstSeen:r.firstSeen,lastSeen:r.lastSeen,played:!!r.firstPlayed,
  firstPlayed:r.firstPlayed||null,lastPlayed:r.lastPlayed||null,games:r.games});
 return json(res,200,{ok:true,trackingStarted:true,complete,summary:{
  visitors,played:played.length,notPlayed:visitors-played.length,
  newTodayUTC:day,newLast7Days:last7,registered:rows.filter(x=>x.type==="registered").length,
  guests:rows.filter(x=>x.type==="guest").length,anonymous:rows.filter(x=>x.type==="anonymous").length,
  gamesRecorded:rows.reduce((n,x)=>n+x.games,0)},
  visitors:rows.map(format),note:"زائر فريد = متصفح يحتفظ بملف تعريف ارتباط؛ ليس ضمانًا أن كل متصفح يمثل شخصًا مختلفًا."});
}
export default async function handler(req,res){
 try{
  if(req.method==="GET"&&req.query.action==="dashboard")return await dashboard(req,res);
  if(req.method!=="POST")return json(res,405,{error:"طريقة غير مسموحة"});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return json(res,403,{error:"مصدر غير مسموح"});}catch(e){return json(res,403,{error:"مصدر غير مسموح"});}}
  if(!String(req.headers["content-type"]||"").includes("application/json")||JSON.stringify(req.body||{}).length>1200)return json(res,400,{error:"طلب غير صالح"});
  const action=String(req.body.action||"");
  if(action==="visit")return await markVisit(req,res);
  if(action==="played")return await markPlayed(req,res,req.body);
  return json(res,404,{error:"إجراء غير معروف"});
 }catch(e){console.error("stats API",e?.message||e);return json(res,500,{error:"تعذر تحديث الإحصائيات مؤقتًا"});}
}
