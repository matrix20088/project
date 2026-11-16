import {get,put} from "@vercel/blob";
import {createHash,randomBytes} from "node:crypto";

const ROOT="game-web/v1/sessions/";
const LEDGER="game-stats/v2/plays/";
const hash=s=>createHash("sha256").update(String(s)).digest("hex");
const key=(code,seat)=>LEDGER+code+"/"+seat+".json";
const blobOpts=(overwrite=false)=>({access:"private",addRandomSuffix:false,allowOverwrite:overwrite,contentType:"application/json"});
export async function readPrivate(path){
 try{
  const f=await get(path,{access:"private",useCache:false});
  return f?await new Response(f.stream).json():null;
 }catch(e){
  if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;
  throw e;
 }
}
export function cookie(req,name){
 const match=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
 return match?match.slice(name.length+1):"";
}
export async function participant(req,res){
 let visitorId=cookie(req,"md_vid");
 if(!/^[a-f0-9]{32}$/.test(visitorId)){
  visitorId=randomBytes(16).toString("hex");
  res.setHeader("Set-Cookie","md_vid="+visitorId+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000");
 }
 const token=cookie(req,"md_session");
 let sess=null;
 if(/^[a-f0-9]{64}$/.test(token)){
  sess=await readPrivate(ROOT+hash(token)+".json");
  if(sess&&sess.expires<=Date.now())sess=null;
 }
 return {visitorId,username:!sess?.guest?String(sess?.username||"").slice(0,24):"",
  name:String(sess?.name||"").slice(0,18),
  type:sess?(sess.guest?"guest":"registered"):"anonymous"};
}
// Independent authoritative per-seat ledger. It can always be re-read and reconciled
// even if the browser loses a telemetry request or a visitor record update races.
export async function storePlayed(code,seat,person){
 if(!/^[1-9][0-9]{5}$/.test(String(code))||!Number.isInteger(seat)||seat<0||seat>3)return false;
 if(!person||!/^[a-f0-9]{32}$/.test(String(person.visitorId)))return false;
 const pathname=key(code,seat);
 const existing=await readPrivate(pathname);
 if(existing)return true; // Only one player per seat per room.
 const doc={code,seat,visitorId:person.visitorId,username:person.username||"",name:person.name||"",
  type:person.type||"anonymous",playedAt:Date.now()};
 try{
  await put(pathname,JSON.stringify(doc),blobOpts(false));
  return true;
 }catch(e){
  if(e?.status===409||String(e).includes("already exists")||String(e).includes("409"))return true;
  throw e;
 }
}
export async function recordActiveSeats(code,meta,gameState){
 if(!gameState||!["announce","question","answer","result","finished"].includes(gameState.phase))return 0;
 if(!Array.isArray(gameState.players))return 0;
 let saved=0;
 const host=meta.hostParticipant;
 if(gameState.players.some(p=>p.seat===0&&p.online!==false)&&host?.visitorId){
  if(await storePlayed(code,0,host))saved++;
 }
 // Welcome mapping is written by the authenticated host only. Read a maximum of 3
 // fixed-size seat records, not a growing list of room events on every state update.
 for(let seat=1;seat<meta.target;seat++){
  if(!gameState.players.some(p=>p.seat===seat&&!p.bot&&p.online!==false))continue;
  const guest=await readPrivate("game-rooms/v1/"+code+"/seat-players/"+seat+".json");
  if(!guest?.visitorId)continue;
  if(await storePlayed(code,seat,guest))saved++;
 }
 return saved;
}
