import { get, put, list } from "@vercel/blob";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const ROOT="game-rooms/v1";
const TTL=60*60*1000;
const KEYS=400;
const json=(r,n,d)=>r.status(n).setHeader("Cache-Control","no-store").json(d);
const codeOK=x=>/^[1-9][0-9]{5}$/.test(String(x||""));
const idOK=x=>/^[a-f0-9]{24}$/.test(String(x||""));
const tokenOK=x=>/^[a-f0-9]{64}$/.test(String(x||""));
const secret=()=>randomBytes(32).toString("hex");
const safeEqual=(a,b)=>typeof a==="string"&&typeof b==="string"&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const key=(code,suffix)=>ROOT+"/"+code+"/"+suffix;
function blobOpts(overwrite=false){return {access:"private",addRandomSuffix:false,allowOverwrite:overwrite,contentType:"application/json"};}
async function save(path,data,overwrite=false){
 await put(path,JSON.stringify(data),blobOpts(overwrite));
}
async function load(path){
 try{const doc=await get(path,{access:"private",useCache:false});if(!doc)return null;return await new Response(doc.stream).json();}
 catch(e){if(e?.status===404||e?.statusCode===404||e?.code==="not_found"||String(e).includes("404"))return null;throw e;}
}
async function metaFor(code){
 if(!codeOK(code))return null;
 const meta=await load(key(code,"meta.json"));
 if(!meta||meta.expires<Date.now())return null;
 return meta;
}
async function guestFor(code,id,token){
 if(!idOK(id)||!tokenOK(token))return null;
 const data=await load(key(code,"players/"+id+".json"));
 return data&&safeEqual(token,data.token)?data:null;
}
const minuteOf=(d)=>Math.floor(Number(d)/60000);
function eventPath(code,when=Date.now()){return key(code,"inbox/"+minuteOf(when)+"/"+String(when).padStart(13,"0")+"-"+randomBytes(8).toString("hex")+".json");}
async function eventsSince(code,since){
 // Two minute buckets accommodate typical network reconnections without scanning the room's entire history.
 const now=Date.now(),minutes=[minuteOf(now-60000),minuteOf(now)];
 const all=[];
 for(const minute of minutes){
  const prefix=key(code,"inbox/"+minute+"/");
  let cursor=undefined;
  for(let page=0;page<3;page++){
   const results=await list({prefix,limit:100,cursor});
   for(const blob of results.blobs||[]){
    const filename=blob.pathname.split("/").pop(),timestamp=Number(filename.slice(0,13));
    if(timestamp>since && timestamp<=now+1000)all.push({pathname:blob.pathname,timestamp});
   }
   if(!results.hasMore)break;
   cursor=results.cursor;
  }
 }
 all.sort((a,b)=>a.timestamp-b.timestamp||a.pathname.localeCompare(b.pathname));
 const selected=all.slice(0,KEYS);
 const out=[];
 for(const item of selected){const record=await load(item.pathname);if(record)out.push({...record,eventId:item.pathname,time:item.timestamp});}
 return out;
}
export default async function handler(req,res){
 try{
  if(req.method==="OPTIONS")return json(res,200,{ok:true});
  if(req.method==="GET"&&req.query.health)return json(res,200,{ok:true,service:"Jars Al Tahaddi relay",version:1,backend:"vercel-private-blob"});
  if(req.method==="POST"){
   const body=(req.body&&typeof req.body==="object")?req.body:{};
   const action=String(body.action||"");
   if(action==="create"){
    const target=Number(body.target);
    if(!Number.isInteger(target)||target<2||target>4)return json(res,400,{error:"target must be 2-4"});
    for(let i=0;i<12;i++){
     const code=String(randomInt(100000,1000000));
     if(await load(key(code,"meta.json")))continue;
     const hostToken=secret(),meta={target,hostToken,created:Date.now(),expires:Date.now()+TTL};
     try{await save(key(code,"meta.json"),meta,false);}catch(e){if(String(e).includes("already exists"))continue;throw e;}
     return json(res,201,{ok:true,code,token:hostToken,target,expires:meta.expires});
    }
    return json(res,503,{error:"No available room numbers, please retry"});
   }
   const code=String(body.code||""),meta=await metaFor(code);
   if(!meta)return json(res,404,{error:"الغرفة مش موجودة أو انتهت صلاحيتها"});
   if(action==="join"){
    const id=randomBytes(12).toString("hex"),token=secret();
    const player={id,token,joined:Date.now()};
    await save(key(code,"players/"+id+".json"),player);
    await save(eventPath(code),{kind:"join",id});
    return json(res,201,{ok:true,code,id,token,expires:meta.expires});
   }
   const role=String(body.role||""),token=String(body.token||"");
   if(role==="host"){
    if(!safeEqual(token,meta.hostToken))return json(res,403,{error:"Host authentication failed"});
    if(action==="poll"){
     const since=Math.max(Date.now()-119999,Math.min(Date.now(),Number(body.since)||Date.now()-10000));
     const events=await eventsSince(code,since);
     return json(res,200,{ok:true,events,time:Date.now()});
    }
    if(action==="state"){
     const message=body.message;
     if(!message||message.t!=="state"||!message.s||JSON.stringify(message).length>85000)
      return json(res,400,{error:"State message invalid"});
     await save(key(code,"state.json"),{message,updated:Date.now()},true);
     return json(res,200,{ok:true});
    }
    if(action==="welcome"){
     const id=String(body.id||""),seat=Number(body.seat);
     if(!idOK(id)||!Number.isInteger(seat)||seat< -1||seat>=meta.target||!(await load(key(code,"players/"+id+".json"))))
      return json(res,400,{error:"Bad guest ID or seat"});
     await save(key(code,"welcome/"+id+".json"),{seat,updated:Date.now()},true);
     return json(res,200,{ok:true});
    }
   }
   if(role==="guest"&&action==="poll"){
    const id=String(body.id||"");
    if(!(await guestFor(code,id,token)))return json(res,403,{error:"Guest authentication failed"});
    const [welcome,state]=await Promise.all([load(key(code,"welcome/"+id+".json")),load(key(code,"state.json"))]);
    return json(res,200,{ok:true,welcome:welcome?.seat===undefined?null:{seat:welcome.seat},message:state?.message||null,updated:state?.updated||0});
   }
   if(role==="guest"&&action==="event"){
    const id=String(body.id||""),player=await guestFor(code,id,token);
    if(!player)return json(res,403,{error:"Guest authentication failed"});
    const message=body.message;
    if(!message||!["hello","buzz","choice","typed","skipRequest","leave"].includes(message.t)||JSON.stringify(message).length>400)
     return json(res,400,{error:"Guest action invalid"});
    await save(eventPath(code),{kind:"event",id,message});
    return json(res,200,{ok:true});
   }
   return json(res,400,{error:"Unknown action"});
  }
  return json(res,405,{error:"Method not allowed"});
 }catch(e){
  console.error("room API",e?.message||e);
  return json(res,500,{error:"حدث خطأ مؤقت في سيرفر الغرف، حاول تاني"});
 }
}
