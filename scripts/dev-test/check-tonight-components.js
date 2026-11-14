// Bounded comparison evidence: layout + connected actions, not design approval.
const fs=require('fs'),assert=require('node:assert/strict'),{open}=require('./browser');
const atlas='http://127.0.0.1:4400',out='.ui-atlas/tonight-components';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await open({width:1440,height:1000,motion:'reduce'}),p=browser.page,writes=[],metrics=[];
  p.on('request',r=>{if(r.method()!=='GET'&&r.url().includes('/api/'))writes.push(r.url());});
  async function go(caseId){
    const r=await p.request.post(atlas+'/__atlas/activate',{data:{caseId,theme:'night'}});assert(r.ok());const frame=await r.json();
    await p.goto(frame.origin+'/__atlas/mock/tonight-components-r1.html');await p.waitForFunction(()=>window.__TONIGHT_COMPONENTS__?.ready);
    return frame;
  }
  async function layout(label,width,height){
    await p.setViewportSize({width,height});await p.locator('[data-lab-filter=all]').click();
    for(const frame of p.frames().filter(f=>f.url().includes('tonight-component-original.html')))await frame.waitForFunction(()=>window.__TONIGHT_PILOT__?.ready);
    await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(150);
    const m=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.querySelectorAll('img')].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),options:[...document.querySelectorAll('.cs-option')].map(e=>({kind:e.dataset.section,variant:e.dataset.variant,overflow:e.scrollWidth-e.clientWidth,previewOverflow:e.querySelector('.cs-preview').scrollWidth-e.querySelector('.cs-preview').clientWidth}))}));
    assert.equal(m.scroll,width,label+' page overflow');assert(!m.broken.length,label+' broken imagery '+m.broken);assert(m.options.every(o=>o.overflow<=1&&o.previewOverflow<=1),label+' component overflow '+JSON.stringify(m.options));metrics.push({label,...m});
    if(!process.argv.includes('--no-captures')){
      await p.evaluate(()=>scrollTo(0,0));
      await p.screenshot({path:out+'/'+label+'-first.png'});
      const screenshotStyle=await p.addStyleTag({content:'.cs-toolbar{position:static!important}'});
      for(const kind of ['season','pace','games'])await p.locator('.cs-section').filter({has:p.locator('#cs-'+kind)}).screenshot({path:out+'/'+label+'-'+kind+'.png'});
      await screenshotStyle.evaluate(e=>e.remove());
    }
  }
  try{
    await go('tonight.catchup');await p.evaluate(()=>{localStorage.removeItem('tonight-component-choices-v1');localStorage.removeItem('tonight-component-width');for(const k of Object.keys(localStorage))if(k.startsWith('tonight-pilot-v4:'))localStorage.removeItem(k);});await p.reload();await p.waitForFunction(()=>window.__TONIGHT_COMPONENTS__?.ready);
    assert.equal(await p.locator('.cs-option').count(),12);assert.equal(await p.locator('.cs-original').count(),3);
    for(const [label,width,height]of [['desktop',1440,1000],['phone',390,844],['small-phone',360,700]])await layout(label,width,height);
    await p.setViewportSize({width:1440,height:1000});
    // Original buttons route to the shared, full-viewport detail rather than an iframe modal.
    await p.frameLocator('[data-original=season]').locator('.progress-control').click();await p.locator('#detail').waitFor({state:'visible'});assert((await p.locator('#detail-title').innerText()).includes('Your place'));await p.locator('#close-detail').click();
    // Different component decisions persist and export as a reusable review artifact.
    for(const [kind,index]of [['season',1],['pace',2],['games',3]])await p.locator(`[data-lab-pick=${kind}][data-index="${index}"]`).click();
    await p.locator('[data-lab-filter=mix]').click();assert.equal(await p.locator('.cs-option').count(),3);assert.deepEqual(await p.evaluate(()=>window.__TONIGHT_COMPONENTS__.preferences),{season:1,pace:2,games:3});
    const [download]=await Promise.all([p.waitForEvent('download'),p.locator('[data-lab-export]').click()]);assert.equal(download.suggestedFilename(),'tonight-component-choices.json');const saved=out+'/selected.json';await download.saveAs(saved);assert.equal(JSON.parse(fs.readFileSync(saved)).choices.games.option,'C');
    await p.reload();await p.waitForFunction(()=>window.__TONIGHT_COMPONENTS__?.ready);assert.deepEqual(await p.evaluate(()=>window.__TONIGHT_COMPONENTS__.preferences),{season:1,pace:2,games:3});
    await p.locator('[data-lab-filter=pace]').click();const conversation=p.locator('[data-section=pace][data-variant="3"]');await conversation.locator('select').selectOption('2');assert.equal(await conversation.locator('.has-seen').count(),3);await conversation.locator('select').selectOption('6');assert.equal(await conversation.locator('.has-seen').count(),2);assert.equal(await conversation.locator('.not-there').count(),1);await conversation.locator('.cs-person').first().click();assert((await p.locator('#detail-title').innerText()).includes('Sam'));await p.locator('#close-detail').click();
    await p.locator('[data-lab-filter=games]').click();const spotlight=p.locator('[data-section=games][data-variant="2"]'),match=p.locator('[data-section=games][data-variant="3"]');
    assert.equal(await spotlight.locator('.spotlight-cast button').count(),3);await spotlight.locator('.spotlight-score').click();assert(await p.locator('.score-total').isVisible());await p.locator('.cast-contribution').first().click();await p.locator('#back-detail').click();assert(await p.locator('.score-total').isVisible());await p.locator('#close-detail').click();
    const pool=await spotlight.locator('option').first().getAttribute('value');await spotlight.locator('select').selectOption(pool);assert.equal(await spotlight.locator('.spotlight-cast button').count(),1);
    const sam=await match.locator('option').filter({hasText:'Sam'}).getAttribute('value');await match.locator('select').selectOption(sam);assert.equal(await match.locator('.match-scores>div:nth-child(2) .is-private').count(),3);assert(!(await match.locator('.match-scores>div:nth-child(2)').allInnerTexts()).some(t=>t.includes('1.5')||t.includes('0.5')));
    await p.locator('[data-lab-control=width]').selectOption('360');assert((await p.locator('.cs-preview').first().evaluate(e=>e.getBoundingClientRect().width))<=360);
    await go('tonight.reveal-ready');await p.locator('[data-lab-filter=games]').click();await p.locator('[data-section=games][data-variant="1"] [data-action=result-gate]').first().click();assert((await p.locator('#detail-body').innerText()).includes('all 3'));assert.equal(await p.locator('[data-scope]').count(),0);await p.locator('#close-detail').click();
    await go('tonight.watcher');assert.equal(await p.locator('[data-section=games] .cs-empty').count(),3);assert.equal(await p.locator('.cs-metric').count(),0);
    await go('tonight.locked');assert.equal(await p.locator('[data-section=season][data-variant="1"] [data-action=watched]').count(),0);assert.equal(await p.locator('[data-section=season][data-variant="1"] [data-action=watch]').count(),1);
    await p.setViewportSize({width:1440,height:1000});await p.goto(atlas+'/?case=tonight.catchup&mock=tonight-components-r1');await p.frameLocator('#mock').locator('.cs-workbench').waitFor();assert.equal(await p.locator('#mock-select').inputValue(),'tonight-components-r1');
    assert.equal(writes.length,0);assert.equal(browser.errors.length,0,browser.errors.join('\n'));const status=await p.request.get(atlas+'/__atlas/status');assert((await status.json()).frames.every(f=>!f.missing.length));
    fs.writeFileSync(out+'/checks.json',JSON.stringify({ok:true,metrics,writes,errors:browser.errors,checks:['3 originals + 9 alternatives','3 viewport layouts','original actions bridged to parent','persistent independent choices','choice JSON export','episode-based social filtering','score and cast drill-down return','spotlight game switching','hidden opponent results','all-game reveal gate','watcher state','live-only watch action','Atlas registration']},null,2));console.log(JSON.stringify({ok:true,options:12,viewports:metrics.length,writes:writes.length,errors:browser.errors.length}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
