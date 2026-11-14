// Capture the current hub/show overview and entry points with known local artwork.
// Requires local Postgres, localhost dev server and browser.js's Playwright installation.
//   node scripts/dev-test/capture-show-overview.js captures/show-overview-2026-11-10/current [--width=390] [--keep]
//   --reuse --only="Lineup action": retry one named capture using retained fixture.json.
// Owns new-fixture's zt_nd users/zt-nd shows; never run alongside another check using that fixture.
// Uses existing public showcase artwork/photos; never restores production users or changes real leagues.
require('dotenv').config({path:'.env.local',quiet:true});
const fs = require('fs');
const path = require('path');
const {Pool} = require('pg');
const fixture = require('./new-fixture');
const {open} = require('./browser');
const args = process.argv.slice(2);
const out = path.resolve(args.find(a=>!a.startsWith('--')) || 'captures/show-overview-2026-11-10/current');
const width = Number(args.find(a=>a.startsWith('--width='))?.slice(8) || 390);
if (!['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.AUTH_DATABASE_URL).hostname)) throw Error('Local database only');
const pool = new Pool({connectionString:process.env.AUTH_DATABASE_URL});
const only=args.find(a=>a.startsWith('--only='))?.slice(7);
const manifest = only&&fs.existsSync(path.join(out,'manifest.json'))?JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8')).filter(m=>m.title!==only):[];
let b;
let failures = 0;
async function shot(slug,title,selector) {
  const p = b.page;
  if (selector) await p.locator(selector).first().waitFor({timeout:30000});
  await p.evaluate(()=>document.fonts.ready);
  await p.waitForTimeout(900);
  await p.screenshot({path:path.join(out,slug+'.png')});
  await p.screenshot({path:path.join(out,slug+'.full.png'),fullPage:true});
  fs.writeFileSync(path.join(out,slug+'.txt'),await p.locator('body').innerText());
  const metrics = await p.evaluate(()=>({
    viewport:{width:innerWidth,height:innerHeight},scrollHeight:document.documentElement.scrollHeight,
    images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0})),
    controls:[...document.querySelectorAll('button,a,input,textarea,select')].map(e=>{
      const r=e.getBoundingClientRect();
      const x=r.left+r.width/2,y=r.top+r.height/2;
      const hit=x>=0&&x<innerWidth&&y>=0&&y<innerHeight?document.elementFromPoint(x,y):null;
      return {label:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim().slice(0,130),tag:e.tagName,x:Math.round(r.left),y:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height),inFirstView:!!r.width&&!!r.height&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&!!hit&&(e===hit||e.contains(hit))};
    }).filter(e=>e.width&&e.height)
  }));
  manifest.push({slug,title,url:p.url(),...metrics});
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(`CAPTURE ${slug}; ${metrics.controls.filter(c=>c.inFirstView).length} controls in first view; ${metrics.images.filter(i=>!i.loaded).length} unloaded images`);
}
async function attempt(title,fn){if(only&&only!==title)return;try{await fn();}catch(e){failures++;manifest.push({title,error:e.message});console.error('FAILED '+title+': '+e.message);}}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  try {
    const fx=args.includes('--reuse')?JSON.parse(fs.readFileSync(path.join(out,'fixture.json'),'utf8')):await fixture.up(pool);
    await pool.query("UPDATE shows SET name=CASE slug WHEN 'zt-nd-survivor' THEN 'Survivor' ELSE 'The Traitors' END,art_url=CASE slug WHEN 'zt-nd-survivor' THEN '/mock/showcase/art/survivor.jpg' ELSE '/mock/showcase/art/traitors.jpg' END,backdrop_url=CASE slug WHEN 'zt-nd-survivor' THEN '/mock/showcase/art/survivor.jpg' ELSE '/mock/showcase/art/traitors.jpg' END WHERE slug IN ('zt-nd-survivor','zt-nd-traitors')");
    await pool.query("UPDATE show_seasons SET name='Survivor 51',art_url='/mock/showcase/art/survivor.jpg' WHERE id=$1",[fx.seasonId]);
    await pool.query("UPDATE couches SET name='Friday Crew' WHERE id=$1",[fx.couchId]);
    // Typical returning member: turn off first-week variant; two moves due for the coming episode.
    await pool.query("UPDATE couch_members SET joined_at=now()-interval '30 days' WHERE couch_id=$1",[fx.couchId]).catch(()=>{});
    const pid=(await pool.query('SELECT player_id FROM league_memberships WHERE league_id=$1 AND user_id=$2',[fx.leagues.lineup,fx.users.alex])).rows[0].player_id;
    for(const L of [fx.leagues.lineup,fx.leagues.pool]) {
      const s=(await pool.query('SELECT state FROM leagues WHERE id=$1',[L])).rows[0].state;
      const ep=s.episodes.find(e=>e.number===6);
      if(ep){if(ep.lineups)delete ep.lineups[pid];ep.picks=(ep.picks||[]).filter(p=>p.playerId!==pid);}
      await pool.query('UPDATE leagues SET state=$1 WHERE id=$2',[JSON.stringify(s),L]);
    }
    fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(fx,null,2));
    b=await open({user:fixture.username('alex'),pass:fixture.PASSWORD,width,height:844});
    b.page.setDefaultTimeout(18000);
    await attempt('Hub',async()=>{await b.page.goto(b.BASE+'/home?hub=focus');await shot('01-hub','Main hub','[data-hub]');});
    const base=b.BASE+'/show/'+fx.seasonId;
    for(const [tab,title] of [['tonight','Tonight'],['episodes','Episodes'],['games','Games'],['cast','Players / stats'],['chat','Chat']]) {
      await attempt(title,async()=>{await b.page.goto(base+'/'+tab);await shot('02-'+tab,title,`[data-tab='${tab}']`);});
    }
    await attempt('Show menu',async()=>{await b.page.goto(base+'/tonight');await b.page.getByRole('button',{name:/^Show menu/}).first().click();await shot('03-show-menu','Show menu and commissioner entry','[data-menu-main]');});
    await attempt('Lineup action',async()=>{await b.page.goto(base+'/tonight');await b.page.locator('[data-move^="lineup-"], [data-done^="lineup-done-"]').first().getByRole('button').click();await shot('04-lineup-editor','Lineup editor','[role=dialog]:visible');});
    await attempt('Episode detail',async()=>{await b.page.goto(base+'/episodes');await b.page.locator('[data-ep="4"]').click();await shot('05-episode-detail','Episode detail','[data-episode-page]');});
    await attempt('Game detail',async()=>{await b.page.goto(base+'/game/'+fx.leagues.lineup);await shot('06-game-detail','Game detail','[data-game-page]');});
    await attempt('Player detail',async()=>{await b.page.goto(base+'/cast');await b.page.locator('[data-cast]').first().click();await shot('07-player-detail','Contestant detail','[data-story]');});
    await attempt('Start game',async()=>{await b.page.goto(base+'/games');await b.page.locator('[data-start-row]').first().click();await shot('08-start-game','Start game wizard','[data-start-card]');});
    await attempt('Behind viewer',async()=>{await b.close();b=await open({user:fixture.username('sam'),pass:fixture.PASSWORD,width,height:844});await b.page.goto(base+'/tonight');await shot('09-behind-tonight','Behind viewer on Tonight','[data-tab=tonight]');await b.page.goto(base+'/chat');await shot('10-behind-chat','Folded future chat','[data-chat]');});
  } finally {
    if(b)await b.close();
    if(!args.includes('--keep'))await fixture.down(pool);
    await pool.end();
    fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
  }
  console.log(`${manifest.filter(m=>m.slug).length} captures, ${failures} failures`);
  process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
