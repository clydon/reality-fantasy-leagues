// Browser validation for the standalone overview design study. No DB or app mutations.
// node scripts/dev-test/check-show-overview-mock.js [http://127.0.0.1:4301] [outDir]
const fs=require('fs');
const path=require('path');
const {open}=require('./browser');
const base=process.argv[2]||'http://127.0.0.1:4301';
const out=path.resolve(process.argv[3]||'captures/show-overview-2026-11-10/proposal');
fs.mkdirSync(out,{recursive:true});
const metrics=[];
let failures=0;
const assert=(ok,msg)=>{if(!ok){failures++;console.error('FAIL '+msg);}else console.log('PASS '+msg);};
async function visible(p,selector){return p.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&hit&&(e===hit||e.contains(hit));});}
(async()=>{
 const b=await open({width:390,height:844});const p=b.page;
 try{
  for(const theme of ['dark','light'])for(const tab of ['home','tonight','episodes','games','players','chat']){
   await p.goto(`${base}/prototype.html?theme=${theme}#${tab}`);
   await p.evaluate(()=>document.fonts.ready);
   await p.waitForTimeout(120);
   const m=await p.evaluate(()=>({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),buttons:[...document.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent.trim(),act:e.dataset.act,y:Math.round(r.top),h:Math.round(r.height),w:Math.round(r.width)};})}));
   assert(m.pageWidth===390,`${theme}/${tab}: no horizontal overflow`);
   if(tab!=='chat')assert(m.scrollHeight<=844,`${theme}/${tab}: overview fits one screen`);
   assert(!m.images.length,`${theme}/${tab}: artwork loaded`);
   const targets={home:['[data-act=add-show]','[data-act=pick]','[data-act=waiver]'],tonight:['[data-act=pick]','[data-act=lineup]','[data-act=waiver]'],episodes:['[data-act=all-episodes]','[data-act=episode]'],games:['[data-act=start]','[data-act=pick]','[data-act=lineup]','[data-act=waiver]'],players:['#player-search','[data-act=compare]','[data-act=filters]','[data-act=player]'],chat:['#message-input','[type=submit]','[data-act=hidden-chat]']}[tab];
   for(const s of targets)assert(await visible(p,s),`${theme}/${tab}: ${s} in first view`);
   await p.screenshot({path:path.join(out,`${theme}-${tab}.png`)});
   metrics.push({theme,tab,...m});
  }
  for(const scenario of ['own','late','solo']){
   await p.goto(`${base}/prototype.html?scenario=${scenario}#tonight`);await p.evaluate(()=>document.fonts.ready);
   assert(await visible(p,'[data-act=pick]'),`${scenario}: next move in first view`);
   if(scenario==='own'||scenario==='solo')assert(!(await p.locator('#app').innerText()).includes('Replace Carter'),`${scenario}: no future elimination in overview`);
   await p.screenshot({path:path.join(out,`${scenario}-tonight.png`)});
  }
  await p.goto(`${base}/prototype.html?scenario=own#tonight`);
  await p.locator('[data-act=pick]').first().click();await p.locator('[data-act=pick-choice]').first().click();await p.locator('[data-act=save-pick]').click();
  assert((await p.locator('#app').innerText()).includes('to survive'),'pick saves and overview updates');
  await p.locator('[data-act=reveal]').click();await p.locator('[data-act=confirm-reveal]').click();assert((await p.locator('#sheet-title').textContent()).includes('Episode 4 revealed'),'reveal advances exactly one episode');await p.locator('[data-act=close]').last().click();
  await p.locator('[data-act=lineup]').click();await p.locator('[data-act=lineup-choice]').first().click();assert(await p.locator('[data-act=save-lineup]').isDisabled(),'lineup requires 3 starters');await p.locator('[data-act=lineup-choice]').first().click();await p.locator('[data-act=save-lineup]').click();assert(!(await p.locator('#overlay').innerHTML()),'lineup save returns to overview');
  await p.goto(`${base}/prototype.html#games`);await p.locator('[data-act=start]').click();await p.locator('#kind').selectOption('Outlast');assert((await p.locator('[role=dialog]').innerText()).includes('Draft together first'),'wizard states actual checkpoint');await p.keyboard.press('Escape');
  await p.goto(`${base}/prototype.html#players`);await p.locator('#player-search').fill('Eric');assert(await p.locator('.player-row').count()===1,'search narrows player rows');await p.locator('.player-row').click();assert((await p.locator('#sheet-title').textContent()).includes('Eric'),'player detail opens');await p.keyboard.press('Escape');
  await p.goto(`${base}/prototype.html#chat`);await p.locator('#message-input').fill('See you Friday');await p.locator('[type=submit]').click();assert((await p.locator('#app').innerText()).includes('See you Friday'),'chat composer sends locally');
  await p.goto(`${base}/index.html`);assert(await p.locator('#mock').count()===1,'comparison board loads');await p.locator('[data-tab=games]').click();assert((await p.locator('#current').getAttribute('src')).includes('02-games'),'comparison switches current capture');
  assert(!b.errors.length,'no browser runtime or resource errors');
 }finally{await b.close();fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify(metrics,null,2));}
 console.log(`${failures} failures`);process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
