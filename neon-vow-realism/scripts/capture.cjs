const puppeteer=require("puppeteer-core");
const {spawn}=require("child_process");
const path=require("path");
const fs=require("fs");
(async()=>{
  const dir=path.resolve("neon-vow-realism/app/src/main/assets");
  const server=spawn("python3",["-m","http.server","8777","--bind","127.0.0.1","--directory",dir],{stdio:"inherit"});
  await new Promise(r=>setTimeout(r,1400));
  const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_BIN||"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl","--ignore-gpu-blocklist","--enable-features=Vulkan"]});
  try{
    const page=await browser.newPage();
    await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
    page.on("console",m=>console.log("WEB",m.type(),m.text()));
    page.on("pageerror",m=>console.log("ERROR",m.message));
    await page.goto("http://127.0.0.1:8777/index.html",{waitUntil:"domcontentloaded",timeout:30000});
    await page.waitForFunction("window.sceneReady===true || Boolean(window.sceneError)",{timeout:75000});
    const error=await page.evaluate("window.sceneError");
    if(error)throw new Error("WebGL asset load failed: "+error);
    await new Promise(r=>setTimeout(r,5000));
    const output=path.resolve("neon-vow-realism/previews");
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,"neon-vow-real-3d-wide.png")});
    await page.keyboard.press("KeyV");
    await new Promise(r=>setTimeout(r,1800));
    await page.screenshot({path:path.join(output,"neon-vow-real-3d-characters.png")});
    console.log("DONE scene screenshots; true WebGL",await page.evaluate("Boolean(document.querySelector('canvas')?.getContext('webgl2'))"));
  } finally {await browser.close();server.kill();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
