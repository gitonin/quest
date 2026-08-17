import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const DIST='/home/user/quest/dist';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json'};
const server=createServer(async(req,res)=>{const p=normalize((req.url??'/').split('?')[0]);const f=join(DIST,p==='/'?'index.html':p);try{const b=await readFile(f);res.writeHead(200,{'content-type':MIME[extname(f)]??'text/plain'});res.end(b);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(4183,r));
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:960,height:540}});
page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto('http://localhost:4183/'); await page.waitForTimeout(1000);
const box=await (await page.$('#game-canvas')).boundingBox();
await page.mouse.click(box.x+box.width/2, box.y+118/270*box.height);
await page.waitForTimeout(2200);
for(let i=0;i<8;i++){await page.keyboard.press('Space');await page.waitForTimeout(150);}

// A) melee vs plant
console.log('teleport tree:', await page.evaluate(()=>window.__quest.debugGoToInteractive('quest.magicTree')));
await page.waitForTimeout(400);
console.log('state:', JSON.stringify(await page.evaluate(()=>{const s=window.__quest.debugState();return {x:s.player.x,y:s.player.y,d:s.dialogue};})));
await page.keyboard.press('KeyE');
await page.waitForTimeout(600);
console.log('after E:', JSON.stringify(await page.evaluate(()=>{const s=window.__quest.debugState();return {d:s.dialogue};})), await page.evaluate(()=>window.__quest.debugFlags()));

// B) combat: teleport to B and attack nearest plant repeatedly
await page.evaluate(()=>window.__quest.debugTeleport('B'));
await page.waitForTimeout(500);
for(let i=0;i<10;i++){await page.keyboard.press('Space');await page.waitForTimeout(200);}
console.log('enemies near:', JSON.stringify((await page.evaluate(()=>window.__quest.debugEnemies())).sort((a,b)=>a.dist-b.dist).slice(0,3)));
await b.close(); server.close();
