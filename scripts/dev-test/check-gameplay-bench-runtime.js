// Bench runtime mode (Chunk 3 bridge): a v2 definition opened in the visible bench drives the actual application
// frames through the shared runtime. Bounded: one desktop + one phone pass. Records gaps; never a design/matrix pass.
//
// Needs: the app (npm run dev, :3000) and UI Atlas (npm run ui:atlas, :4400) with its recorded dataset.
// Run:   node scripts/dev-test/check-gameplay-bench-runtime.js [--file=<definition.json>] [--width=390]
//        Default definition: the three-game proof (lineup, three fresh picks, question sheet; Bo a week behind).
//        Known finding (2026-11-12): for a viewer who is behind, the quick editor offers the next aired episode, not
//        their open one, and squeezes its participant cards; the save check therefore runs as the caught-up viewer.
// Out:   .ui-atlas/bench-runtime/ (screenshots, browser-checks.json, live-comparisons.json, the exported run).
// Live mode (the bench default) materializes each case as local zt-gb- rows and removes them when the case is evicted;
// leftovers after a crash: node tools/gameplay-bench/live-db.cjs down-all. Never touches real accounts.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{open}=require('./browser');
const root=path.resolve(__dirname,'../..'),base='http://127.0.0.1:4400',out=path.join(root,'.ui-atlas/bench-runtime');fs.mkdirSync(out,{recursive:true});
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const width=Number(arg('width')||390);
const R=require(path.join(root,'tools/gameplay-bench/explorer/runtime.cjs')),D=require(path.join(root,'tools/gameplay-bench/explorer/document.cjs'));
const definition=arg('file')?path.resolve(arg('file')):path.join(out,'proof-definition.json');
if(!arg('file'))fs.writeFileSync(definition,JSON.stringify(require(path.join(root,'tests/fixtures/gameplay-explorer/runtime-proof.cjs'))({ann:2,bo:1})));
const blockedFile=path.join(out,'blocked-definition.json');fs.writeFileSync(blockedFile,JSON.stringify(D.read(require(path.join(root,'tests/fixtures/gameplay-explorer/legacy-lineup-v1.json')))));

(async()=>{const b=await open({width:1536,height:1080,motion:'reduce'}),p=b.page,checks=[],failures=[],gaps=[];
 const check=async(name,fn)=>{try{await fn();checks.push(name);console.log('PASS '+name);}catch(e){failures.push({name,error:e.message});await p.screenshot({path:path.join(out,'fail-'+failures.length+'.png')}).catch(()=>{});console.log('FAIL '+name+': '+e.message.slice(0,160));}};
 const state=()=>p.evaluate(()=>window.__GAMEPLAY_BENCH__?.state);
 const loadFile=async file=>{await p.locator('#load').setInputFiles(file);};
 const preview=()=>p.frameLocator('#preview');
 // Server truth, polled from Node (a page-side predicate returning a promise would resolve at once).
 const server=async()=>(await p.request.get(base+'/__atlas/bench/runtime/state?id='+(await state()).id)).json();
 const until=async(test,ms=15000)=>{const end=Date.now()+ms;let last;while(Date.now()<end){last=await server();if(test(last))return last;await p.waitForTimeout(400);}throw Error('timed out; runtime trace: '+JSON.stringify(last?.trace||[]).slice(0,400));};
 try{
  await p.goto(base+'/__atlas/bench');await p.waitForFunction(()=>window.__GAMEPLAY_BENCH__?.ready,{},{timeout:45000});
  await check('a v2 definition opens in runtime mode',async()=>{await loadFile(definition);await p.waitForFunction(()=>window.__GAMEPLAY_BENCH__?.mode==='runtime',{},{timeout:30000});assert.equal(await p.locator('#runtime-game-field').isVisible(),true);});
  const games=await p.locator('#runtime-game option').evaluateAll(o=>o.map(x=>({value:x.value,label:x.textContent})));
  await check('the game select lists every game in the context',async()=>assert(games.length>=1));
  for(const g of games)await check('full game page renders for '+g.value,async()=>{await p.locator('#runtime-game').selectOption(g.value);await p.waitForFunction(id=>window.__GAMEPLAY_BENCH__?.state?.gameId===id,g.value,{timeout:20000});
   try{await preview().locator('[data-game-page]').waitFor({timeout:25000});}catch(e){const st=await(await p.request.get(base+'/__atlas/status')).json(),missing=st.frames.filter(f=>f.caseId.startsWith('bench.')).flatMap(f=>f.missing);gaps.push({game:g.value,surface:'full',missing});throw Error('no [data-game-page]; missing reads: '+missing.join(', '));}
   await p.screenshot({path:path.join(out,'desktop-'+g.value+'.png')});});
  const lineupGame=games.find(g=>/lineup/i.test(g.value+g.label));
  if(lineupGame)await check('a lineup saved in the real quick editor becomes a runtime action',async()=>{await p.locator('#runtime-game').selectOption(lineupGame.value);await p.waitForFunction(id=>window.__GAMEPLAY_BENCH__?.state?.gameId===id,lineupGame.value);await p.locator('[data-surface="quick"]').click();const dialog=preview().getByRole('dialog');await dialog.waitFor({timeout:25000});const choices=dialog.locator('button[data-starter]:not([disabled])');const n=await choices.count();assert(n>=2,'no selectable lineup controls');
   const before=(await server()).trace.length;const was=await choices.evaluateAll(b=>b.map(x=>x.getAttribute('aria-pressed')));for(let i=0;i<n;i++)if(was[i]==='true')await choices.nth(i).click();for(const i of [n-1,n-2])await choices.nth(i).click();await p.locator('#preview').scrollIntoViewIfNeeded();await dialog.getByRole('button',{name:'Save',exact:true}).click();
   await p.screenshot({path:path.join(out,'desktop-lineup-before-save.png')});const st=await until(s=>s.trace.length>before);const last=st.trace.at(-1);assert.match(last.origin,/^bench-frame/);assert.equal(last.type,'lineup');assert.equal(last.status,'accepted',last.message||'');await p.screenshot({path:path.join(out,'desktop-lineup-saved.png')});});
  for (const host of ['tonight', 'episodes', 'hub', 'chat']) await check(host + ' host page renders on real routes with no failed read', async () => {
   const before = Date.now(); await p.locator('[data-surface="' + host + '"]').click(); await p.waitForTimeout(400);
   await preview().locator('main, [data-tab], body').first().waitFor({ timeout: 25000 }); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(1500);
   const st = await (await p.request.get(base + '/__atlas/status')).json(), f = st.frames.find(x => x.caseId.endsWith('.' + host));
   assert(f, 'no frame for ' + host); const failed = f.missing.filter(m => !/answers/.test(m) || true); assert.deepEqual(failed, [], host + ' failed reads');
   await p.setViewportSize({ width: 1536, height: 1080 }); await p.screenshot({ path: path.join(out, 'host-' + host + '.png') });
  });
  await check('switching viewer keeps each person’s mark',async()=>{const st=await state(),other=st.people.find(x=>x.id!==st.viewerId);await p.locator('#viewer').selectOption(other.id);await p.waitForFunction(id=>window.__GAMEPLAY_BENCH__?.state?.viewerId===id,other.id);const after=await state();assert.deepEqual(after.people.map(x=>x.seen),st.people.map(x=>x.seen));await p.locator('#viewer').selectOption(st.viewerId);await p.waitForFunction(id=>window.__GAMEPLAY_BENCH__?.state?.viewerId===id,st.viewerId);});
  await check('the reveal advances only this viewer across every game',async()=>{const all=await server(),behind=all.people.find(x=>x.seen<all.latest);if(behind){await p.locator('#viewer').selectOption(behind.id);await p.waitForFunction(id=>window.__GAMEPLAY_BENCH__?.state?.viewerId===id,behind.id);}const st=await server();if(st.seen>=st.latest){gaps.push({check:'reveal',note:'viewer already caught up'});return;}const others=st.people.filter(x=>x.id!==st.viewerId).map(x=>x.seen);await p.locator('#reveal').click();await preview().locator('[data-beat],[data-stage]').first().waitFor({timeout:30000});
   const now=await until(s=>s.seen===st.seen+1);assert.deepEqual(now.people.filter(x=>x.id!==st.viewerId).map(x=>x.seen),others);await p.screenshot({path:path.join(out,'desktop-reveal.png')});});
  await check('every real write agreed with the runtime replay',async()=>{const st=await server();if(!st.live){gaps.push({check:'live',note:'shaped (DB-free) mode: no server comparison'});return;}fs.writeFileSync(path.join(out,'live-comparisons.json'),JSON.stringify(st.live.comparisons,null,2));assert(st.live.comparisons.length>0,'no real writes were observed');assert.equal(st.live.mismatches,0,JSON.stringify(st.live.comparisons.filter(c=>!c.agree)).slice(0,600));});
  await check('the export replays headlessly to the same state',async()=>{const st=await(await p.request.get(base+'/__atlas/bench/runtime/state?id='+(await state()).id)).json();const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#export').click()]);const file=path.join(out,'exported-run.json');await download.saveAs(file);const result=R.execute(JSON.parse(fs.readFileSync(file,'utf8')));assert.equal(result.status,'executed',result.message);assert.equal(result.execution.stateHash,st.hash);});
  await check('phone layout has no page overflow at '+width+'px',async()=>{await p.setViewportSize({width,height:844});await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),width);await p.screenshot({path:path.join(out,'phone-'+width+'.png'),fullPage:true});await p.setViewportSize({width:1536,height:1080});});
  await check('a definition the runtime cannot run shows its gap and closes the preview',async()=>{await loadFile(blockedFile);await p.locator('#adapter-gap').waitFor({state:'visible',timeout:20000});assert.equal(await p.locator('#device').isVisible(),false);assert.match(await p.locator('#gap-title').innerText(),/runtime/i);assert.equal(await p.locator('#scenario-title').innerText(),'No game open');assert.equal(await p.locator('#reveal-controls').isVisible(),false);assert.doesNotMatch(await p.locator('#checks').innerText(),/accepted/);await p.screenshot({path:path.join(out,'desktop-blocked.png')});});
  const status=await(await p.request.get(base+'/__atlas/status')).json(),missing=status.frames.filter(f=>f.caseId.startsWith('bench.')).flatMap(f=>f.missing.map(url=>({frame:f.caseId,url})));
  const report={ok:!failures.length,checks,failures,gaps,missing,errors:b.errors,evidence:{rendering:'scoped to these checks',design:'unreviewed'}};fs.writeFileSync(path.join(out,'browser-checks.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,failures,gaps,missing:missing.slice(0,12),errors:b.errors.slice(0,10)}));if(failures.length)process.exitCode=1;
 }finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
