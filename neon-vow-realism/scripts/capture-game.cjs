const puppeteer=require("puppeteer-core");
const {spawn}=require("node:child_process");
const path=require("node:path");
const fs=require("node:fs");
async function run(){
 const assetDir=path.resolve("neon-vow-realism/app/src/main/assets");
 const server=spawn("python3",["-m","http.server","8777","--bind","127.0.0.1","--directory",assetDir],{stdio:"inherit"});
 await new Promise(r=>setTimeout(r,1300));
 const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_BIN||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
 try{
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
  const errs=[];
  page.on("pageerror",e=>errs.push(e.stack||e.message));
  page.on("console",m=>{if(m.type()==="error")errs.push(m.text());else if(m.text().includes("ERROR"))console.log("LOG",m.text());});
  await page.goto("http://127.0.0.1:8777/index.html",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction("window.__NV_TEST?.ready===true",{timeout:120000});
  const output=path.resolve("neon-vow-realism/previews");fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,"neon-vow-mission-menu.png")});
  await page.evaluate(()=>window.__NV_TEST.startSolo(1));
  await new Promise(r=>setTimeout(r,2200));
  const before=await page.evaluate(()=>({mode:window.__NV_TEST.mode,enemies:window.__NV_TEST.state?.enemies.length,players:window.__NV_TEST.state?.players.length}));
  if(before.mode!=="playing"||before.enemies<3||before.players!==2)throw Error("Gameplay failed to start: "+JSON.stringify(before));
  await page.screenshot({path:path.join(output,"neon-vow-gameplay.png")});
  await page.keyboard.down("KeyW");await page.keyboard.down("Space");
  await new Promise(r=>setTimeout(r,1500));
  await page.keyboard.up("KeyW");await page.keyboard.up("Space");
  await page.screenshot({path:path.join(output,"neon-vow-combat.png")});
  await page.evaluate(()=>{window.__NV_TEST.forceGate();window.__NV_TEST.tickFor(1.75);});
  const sector=await page.evaluate(()=>window.__NV_TEST.state?.sector);
  if(sector!==1)throw Error("Level transition failed: sector="+sector);
  if(errs.length)throw Error("Browser/runtime errors: "+errs.slice(0,4).join(" | "));
  console.log("PASS WebGL screenshots & browser gameplay",JSON.stringify(before),"sector advanced",sector);
 }finally{await browser.close();server.kill();}
}
run().catch(e=>{console.error(e.stack||e);process.exit(1);});