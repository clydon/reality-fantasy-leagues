// Local, simulated UX study only; no accounts or database access.
// Start: node scripts/dev-test/serve-captures.js captures/show-soul-2026-11-10 --port=4302
// Capture and inspect: node scripts/dev-test/check-show-soul-mock.js --capture
// Check interactions: node scripts/dev-test/check-show-soul-mock.js
// Optional: --port=4302 --width=390 (viewport height 844)
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {open}=require('./browser');
const args=process.argv.slice(2),capture=args.includes('--capture');
const width=Number(args.find(x=>x.startsWith('--width='))?.split('=')[1]||390);
const port=Number(args.find(x=>x.startsWith('--port='))?.split('=')[1]||4302);
const base=`http://127.0.0.1:${port}`,root=path.resolve('captures/show-soul-2026-11-10');
const contexts={watcher:'audience=watcher&scenario=own',gamer:'audience=gamer&scenario=live',solo:'audience=solo&scenario=solo',sport:'audience=watcher&content=sport&scenario=own'};
(async()=>{const b=await open({width,height:844,motion:'reduce'}),{page}=b;const metrics=[];
async function visit(context,tab='tonight'){await page.goto(`${base}/prototype.html?${contexts[context]}#${tab}`);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.images].every(i=>i.complete));}
async function act(action,value){await page.locator(`[data-act="${action}"]${value===undefined?'':`[data-value="${value}"]`}`).first().click();}
async function visibleFirst(action){const rect=await page.locator(`[data-act="${action}"]`).first().boundingBox();assert(rect,action+' exists');assert(rect.y>=0&&rect.y+rect.height<=777,action+' within first view '+JSON.stringify(rect));const hit=await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('button'),{x:rect.x+rect.width/2,y:rect.y+rect.height/2});assert(hit,action+' unobscured');}
try{
 if(capture){
  fs.mkdirSync(path.join(root,'screens'),{recursive:true});
  for(const context of Object.keys(contexts))for(const tab of ['home','tonight','episodes','games','players','chat']){
   await visit(context,tab);
   const m=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,failedImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),actions:[...document.querySelectorAll('main button')].map(e=>({action:e.dataset.act,text:e.textContent.trim().slice(0,75),y:Math.round(e.getBoundingClientRect().y),bottom:Math.round(e.getBoundingClientRect().bottom)}))}));
   metrics.push({context,tab,...m});assert(m.scrollWidth<=width,`${context} ${tab} overflow`);assert.equal(m.failedImages.length,0);
   await page.screenshot({path:path.join(root,'screens',`${context}-${tab}.png`)});
  }
  await visit('watcher','watch');await page.screenshot({path:path.join(root,'screens','watcher-watch.png')});
  await visit('gamer');await act('pick');await act('soul-pick-choice','jelly');await page.screenshot({path:path.join(root,'screens','pick-selected.png')});await act('pick-stats','jelly');await page.screenshot({path:path.join(root,'screens','pick-stats.png')});await act('compare');await page.screenshot({path:path.join(root,'screens','pick-compare.png')});
  await visit('watcher');await act('watched');await page.screenshot({path:path.join(root,'screens','watcher-mark-watched.png')});await act('watcher-confirm');await page.screenshot({path:path.join(root,'screens','episode-gif-picker.png')});
  await visit('sport');await act('score-toggle');await page.screenshot({path:path.join(root,'screens','sport-revealed.png')});
  await page.setViewportSize({width:1240,height:1000});await page.goto(base);await page.waitForTimeout(300);await page.screenshot({path:path.join(root,'screens','review-board.png'),fullPage:true});
  fs.writeFileSync(path.join(root,'screens','metrics.json'),JSON.stringify(metrics,null,2));
 }else{
  await visit('watcher');await visibleFirst('watch');await visibleFirst('watched');await visibleFirst('where');
  assert(!(await page.locator('[data-act="waiver"]').count()),'watcher has no game due claim');await act('where');await act('friend-chat','2');assert((await page.locator('.chat-safety').textContent()).includes('Episode 2'),'shared episode thread');await act('nav','tonight');
  await act('watch');const start=await page.locator('#watch-clock').textContent();await act('clock-toggle');await page.waitForFunction(t=>document.querySelector('#watch-clock').textContent!==t,start,{timeout:3500});await act('clock-toggle');const paused=await page.locator('#watch-clock').textContent();assert.notEqual(start,paused,'clock runs');await page.waitForTimeout(1100);assert.equal(await page.locator('#watch-clock').textContent(),paused,'clock stays paused');await act('nav','tonight');await act('watch');assert.equal(await page.locator('#watch-clock').textContent(),paused,'clock retained after return');await act('nav','tonight');await act('watched');await act('watcher-confirm');await act('gif-choice','2');assert.equal(await page.evaluate(()=>window.__demo.seen),4);assert(await page.locator('.reaction-tile img').first().getAttribute('src')==='assets/reaction-2.gif');
  await visit('gamer');await visibleFirst('waiver');await visibleFirst('pick');await visibleFirst('lineup');await act('pick');await act('soul-pick-choice','jelly');await act('pick-stats','jelly');assert(await page.locator('.evidence-grid').isVisible());await act('compare');await act('back-to-stats');await act('by-episode');await act('back-to-stats');await act('back-to-pick');assert(await page.locator('[data-act="soul-pick-choice"][data-value="jelly"]').locator('..').evaluate(e=>e.classList.contains('selected')),'choice survives stats');await act('soul-save-pick');await act('pick');assert(await page.locator('[data-act="soul-pick-choice"][data-value="jelly"]').locator('..').evaluate(e=>e.classList.contains('selected')),'saved choice restored');await act('close');await act('nav','players');assert(await page.locator('.face-grid').isVisible());await act('face-view','rank');assert(await page.locator('.rank-list').isVisible());
  await visit('solo');await act('pick');await act('soul-pick-choice','eric');await act('soul-save-pick');await act('watched');await act('confirm-reveal');assert.equal(await page.evaluate(()=>window.__demo.seen),4);await act('close');await act('pick');await act('soul-pick-choice','jelly');await act('soul-save-pick');await act('watched');await act('confirm-reveal');await act('close');assert((await page.locator('main').textContent()).includes('You’re caught up'));assert(!(await page.locator('main').innerText()).includes('season finished'));
  await visit('sport');assert(!(await page.locator('main').innerText()).match(/Driver A|25 pts|Final|On now|Lap /),'no hidden result cues');await act('watch');const sportClock=await page.locator('#watch-clock').textContent();await act('score-toggle');assert.equal(await page.locator('#watch-clock').textContent(),sportClock,'reveal does not jump clock');await act('nav','tonight');assert((await page.locator('main').innerText()).includes('Driver A'));await act('score-toggle');assert(!(await page.locator('main').innerText()).includes('Driver A'));for(const tab of ['episodes','games','players','chat']){await act('nav',tab);assert(!(await page.locator('#app').innerText()).includes('castaway'),'sports terms');}
 }
 assert.equal(b.errors.length,0,b.errors.join('\n'));console.log(JSON.stringify({result:'PASS',mode:capture?'capture':'interactions',screens:metrics.length,width,consoleErrors:b.errors.length}));
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
