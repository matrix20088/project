import {get} from "@vercel/blob";
import {createHash} from "node:crypto";

const ROOT="game-web/v1/accounts/";
const hash=s=>createHash("sha256").update(String(s)).digest("hex");

// The verified existing owner account (login username, not public display name).
// A display name of "Owner" never grants privileges by itself.
const ADMIN_USERNAME="matrix20077";

async function readAccount(username){
 const path=ROOT+hash(username)+".json";
 try{
  const blob=await get(path,{access:"private",useCache:false});
  return blob?await new Response(blob.stream).json():null;
 }catch(e){
  if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;
  throw e;
 }
}
export async function isGameOwner(session){
 if(!session||session.guest||!session.username||!session.id)return false;
 // Legacy reserved account remains supported for backwards compatibility.
 if(session.username==="owner"&&session.id===hash("owner"))return true;
 if(session.username!==ADMIN_USERNAME||session.id!==hash(ADMIN_USERNAME))return false;
 try{
  const account=await readAccount(ADMIN_USERNAME);
  return !!account&&account.id===hash(ADMIN_USERNAME)&&account.username===ADMIN_USERNAME;
 }catch(e){
  console.error("owner account verification",e?.message||e);
  return false; // Never grant admin access when persistent account verification fails.
 }
}
