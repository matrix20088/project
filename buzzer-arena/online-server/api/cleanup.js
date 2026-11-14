import { get, list, del } from "@vercel/blob";
const BASE="game-rooms/v1/";
async function read(path){
 const blob=await get(path,{access:"private",useCache:false});
 return blob?await new Response(blob.stream).json():null;
}
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({error:"Method"});
 if(!process.env.CRON_SECRET||req.headers.authorization!=="Bearer "+process.env.CRON_SECRET)
  return res.status(401).json({error:"Unauthorized"});
 try{
  let cursor,all=[],expired=new Set(),inspected=0,removed=0;
  for(let i=0;i<30;i++){
   const items=await list({prefix:BASE,limit:1000,cursor});
   all.push(...items.blobs);
   if(!items.hasMore)break;
   cursor=items.cursor;
  }
  const metas=all.filter(b=>b.pathname.endsWith("/meta.json"));
  for(const blob of metas){
   const meta=await read(blob.pathname);inspected++;
   if(meta?.expires<Date.now()-60*60*1000){
    const room=blob.pathname.slice(0,-10);
    expired.add(room);
   }
  }
  for(const room of expired){
   const items=all.filter(b=>b.pathname.startsWith(room+"/"));
   for(let p=0;p<items.length;p+=100){
    await del(items.slice(p,p+100).map(b=>b.pathname));
    removed+=Math.min(100,items.length-p);
   }
  }
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({ok:true,inspected,roomsDeleted:expired.size,objectsDeleted:removed});
 }catch(e){console.error("cleanup",e);return res.status(500).json({error:"Cleanup error"});}
}