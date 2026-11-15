import {get,list} from "@vercel/blob";
import {createHash} from "node:crypto";

const ROOT="game-web/v1/accounts/";
const LEGACY_OWNER_CUTOFF=Date.parse("2026-11-15T12:00:00Z");
const hash=s=>createHash("sha256").update(String(s)).digest("hex");
let cache={checked:0,legacyId:null};

/* Migrate exactly one original pre-existing Owner display account.
   Never trust display name alone: account must be registered before the cutoff,
   the session must match its persisted account record, and it must be unique. */
async function readPrivate(path){
 try{
  const blob=await get(path,{access:"private",useCache:false});
  return blob?await new Response(blob.stream).json():null;
 }catch(e){
  if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;
  throw e;
 }
}
async function legacyId(){
 if(Date.now()-cache.checked<120000)return cache.legacyId;
 let cursor=undefined,blobs=[],complete=false;
 for(let page=0;page<10;page++){
  const result=await list({prefix:ROOT,limit:100,cursor});
  blobs.push(...(result.blobs||[]));
  if(!result.hasMore){complete=true;break;}
  cursor=result.cursor;
 }
 if(!complete)return null; // fail closed when candidate discovery is incomplete
 let found=[];
 for(let i=0;i<blobs.length;i+=20){
  const chunk=await Promise.all(blobs.slice(i,i+20).map(x=>readPrivate(x.pathname)));
  for(const rec of chunk){
   if(!rec||!rec.username||rec.username==="owner"||String(rec.name||"").normalize("NFKC").trim().toLowerCase()!=="owner")continue;
   if(!Number.isFinite(Number(rec.created))||Number(rec.created)>=LEGACY_OWNER_CUTOFF)continue;
   if(rec.id!==hash(rec.username))continue;
   found.push(rec.id);
  }
 }
 cache={checked:Date.now(),legacyId:found.length===1?found[0]:null};
 return cache.legacyId;
}
export async function isGameOwner(session){
 if(!session||session.guest||!session.username||!session.id)return false;
 if(session.username==="owner"&&session.id===hash("owner"))return true;
 if(String(session.name||"").normalize("NFKC").trim().toLowerCase()!=="owner")return false;
 try{
  const record=await readPrivate(ROOT+hash(session.username)+".json");
  if(!record||record.id!==session.id||record.username!==session.username)return false;
  if(Number(record.created)>=LEGACY_OWNER_CUTOFF||String(record.name||"").normalize("NFKC").trim().toLowerCase()!=="owner")return false;
  return (await legacyId())===record.id;
 }catch(e){console.error("owner verification",e?.message||e);return false;}
}
