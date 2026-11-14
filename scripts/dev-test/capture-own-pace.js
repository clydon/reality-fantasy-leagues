// Local UI inventory: real screens at phone width, fixture users only. Reuses the own-pace
// checks, then captures watching without a game, spoiler/chat boundaries, multiplayer views,
// and live deadline boundaries. Never run alongside another new-fixture.js check.
// Needs the dev server, local Postgres and browser.js's Playwright/Chromium installation.
//   node scripts/dev-test/capture-own-pace.js captures/own-pace --season=<completed-season-id>
//   --reuse-checks: use the two checks' existing screenshots and retained finished-season fixture.
//   --reuse-live: keep the live check's existing screenshots; rebuild the finished-season fixture.
//   --width=390: supplementary screenshots' CSS width (the original completed-season check is 390).
//   --extended-only: append solo, equal-progress and active-draft captures to an existing inventory.
//   --gallery-only: rebuild the gallery from its existing manifest, without app/database changes.
// Writes index.html, manifest.json, per-screen text and viewport/full-page PNG pairs.
// Fixture up/down owns zt_nd users and zt-nd shows; normal completion removes them.
require('dotenv').config({ path: '.env.local', quiet: true });
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Pool } = require('pg');
const { open, api, BASE } = require('./browser');
const fixture = require('./new-fixture');

const args = process.argv.slice(2);
const flag = (key) => args.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = path.resolve(args.find(a => !a.startsWith('--')) || 'captures/own-pace');
const season = flag('season');
const width = Number(flag('width') || 390);
const db = new URL(process.env.AUTH_DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(db.hostname)) throw new Error('Local database required');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname)) throw new Error('Local app required');
if (!season) throw new Error('--season=<completed-season-id> required');
const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
const manifest = (args.includes('--extended-only') || args.includes('--gallery-only')) && fs.existsSync(path.join(out, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8')) : [];
const browsers = new Map();
let failed = 0;
fs.mkdirSync(out, { recursive: true });
const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function browser(who) {
  if (!browsers.has(who)) {
    const b = await open({ user: fixture.username(who), pass: fixture.PASSWORD, width, height: 844 });
    b.page.setDefaultTimeout(20000);
    browsers.set(who, b);
  }
  return browsers.get(who);
}
async function closeBrowsers() {
  for (const b of browsers.values()) await b.close();
  browsers.clear();
}
async function visit(who, sid, tab, selector = '[data-tab]') {
  const b = await browser(who);
  await b.page.goto(`${BASE}/show/${sid}/${tab}`);
  await b.page.locator(selector).first().waitFor();
  return b.page;
}
async function shot(page, group, slug, title, context, focus) {
  if (focus) await page.locator(focus).first().scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(850);
  const dir = path.join(out, group);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${slug}.png`) });
  await page.screenshot({ path: path.join(dir, `${slug}.full.png`), fullPage: true });
  const body = await page.locator('body').innerText();
  fs.writeFileSync(path.join(dir, `${slug}.txt`), body);
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  manifest.push({ group, file: `${group}/${slug}.png`, full: `${group}/${slug}.full.png`, title, context, url: page.url(), width, height: 844, dimensions, status: 'captured' });
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`CAPTURE ${group}/${slug}: ${title}`);
}
async function attempt(title, fn) {
  try { await fn(); }
  catch (e) {
    failed++;
    manifest.push({ title, status: 'failed', error: e.message });
    console.error(`CAPTURE FAILED ${title}: ${e.message}`);
  }
}
async function run(script, dir) {
  await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [path.join(__dirname, script), path.join(out, dir), '--keep', `--season=${season}`], { stdio: 'inherit' });
    proc.on('error', reject);
    proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
  });
}
async function finished() {
  const leagues = (await pool.query(`SELECT l.id,l.state,l.created_by FROM leagues l JOIN "user" u ON u.id=l.created_by WHERE u.username LIKE 'zt\\_nd\\_%' AND (l.state->'settings'->>'ownPace')::boolean = true`)).rows;
  const game = leagues.find(l => l.state.players.some(p => /alex$/.test(p.name)) && l.state.players.some(p => /riley$/.test(p.name)));
  if (!game) throw new Error('Retained completed-season fixture missing; run without --reuse-checks');
  const context = 'Completed season; alex has finished, riley is on Episode 4. Both are in the same game, with two computer players.';
  await attempt('Completed season: multiplayer page', async () => {
    const p = await visit('riley', season, `game/${game.id}`, '[data-game-page]');
    await shot(p, 'finished-extra', '01-game-behind', 'Your game while a friend is ahead', context);
    const name = p.locator('[data-door-person]').first();
    if (await name.count()) {
      await name.click();
      await p.locator('[role=dialog]').last().waitFor();
      await shot(p, 'finished-extra', '02-person-sheet', 'Another player’s history from your episode', context);
    }
  });
  for (const [tab, title] of [['episodes', 'Seen and unseen episodes'], ['chat', 'Chat while a friend is ahead'], ['tonight', 'Your next episode while a friend has finished']]) {
    await attempt(title, async () => {
      const p = await visit('riley', season, tab);
      await shot(p, 'finished-extra', `03-${tab}`, title, context);
      if (tab === 'tonight' && await p.locator('[data-where-line]').count()) {
        await p.locator('[data-where-line]').click();
        await p.locator('[role=dialog]').last().waitFor();
        await shot(p, 'finished-extra', '04-where-everyone-is', 'Where everyone is on an older season', context);
      }
    });
  }
  await attempt('Bingo at your next episode', async () => {
    const p = await visit('riley', season, 'games');
    await p.locator('[data-bingo-row]').first().click();
    await p.locator('[data-bingo-sheet]').waitFor();
    await shot(p, 'finished-extra', '05-bingo', 'Bingo before revealing your episode', context);
  });
  await attempt('Calls at your next episode', async () => {
    const p = await visit('riley', season, 'games');
    await p.locator('[data-call-row]').first().click();
    await p.locator('[role=dialog]').last().waitFor();
    await shot(p, 'finished-extra', '06-calls', 'Predictions before revealing your episode', context);
  });
  await attempt('Own-pace pick editor', async () => {
    const p = await visit('riley', season, 'tonight');
    await p.locator(`[data-pace-plate='${game.id}'] [data-pace-move]`).click();
    await p.locator('[role=dialog]').last().waitFor();
    await shot(p, 'finished-extra', '07-pick-editor', 'Choose a survivor for an episode that aired long ago', context);
  });
}
async function watchingAndBoundaries() {
  await closeBrowsers();
  const fx = await fixture.up(pool);
  const sid = fx.traitorsSeasonId;
  const alex = await api({ user: fixture.username('alex'), pass: fixture.PASSWORD });
  await alex.call('PUT', `/api/me/follows/${sid}`, { following: true, seenThrough: 0 });
  await pool.query("UPDATE show_seasons SET status='completed', premiere_date=current_date-150, episode_count=8 WHERE id=$1", [sid]);
  const mark = async (n) => {
    await pool.query('UPDATE show_follows SET seen_through=$3,not_yet=NULL WHERE user_id=$1 AND season_id=$2', [fx.users.alex, sid, n]);
  };
  // Keep the same couch throughout: riley has seen 2; jordan's place is private.
  for (const [n, slug, title] of [[0,'01-not-started','Old season: not started'],[2,'02-mid-season','Old season: watching without a game'],[8,'08-finished','Old season: finished watching']]) {
    await attempt(title, async () => {
      await mark(n);
      const p = await visit('alex', sid, 'tonight');
      await shot(p, 'watching', slug, title, `No game; you have seen ${n} of 8. Other couch members watch this show.`);
      if (n !== 2) return;
      for (const [selector, name, label] of [
        ['[data-up-next-watched]','03-watched-confirm','Confirm that you watched the whole episode'],
        ['[data-up-next-ask]','04-ask-couch','Ask friends to watch your next episode'],
        ['[data-where-line]','05-where','Friends at different episodes; private progress stays private'],
        ['[data-following]','06-spoiler-controls','Change your spoiler-safe progress'],
        ['[data-up-next-watch]','07-watch-along','Watch along at your own episode']
      ]) {
        await attempt(label, async () => {
          await visit('alex', sid, 'tonight');
          await p.locator(selector).first().click();
          await p.locator('[role=dialog]').last().waitFor();
          await shot(p, 'watching', name, label, 'Old season, no game; your next episode is 3.');
        });
      }
    });
  }
  await attempt('Old season episode list', async () => {
    await mark(2);
    const p = await visit('alex', sid, 'episodes');
    await shot(p, 'watching', '09-episodes', 'Watched and hidden episodes without a game', 'Seen through 2 of 8.');
  });
  await attempt('Old season chat', async () => {
    const p = await visit('alex', sid, 'chat');
    await shot(p, 'watching', '10-chat', 'Couch chat at your episode', 'Seen through 2; the fixture contains messages from episodes 2 and 3.');
  });
  // Same watcher and couch, but the season is still airing: latest aired episode is 3.
  await pool.query("UPDATE show_seasons SET status='airing', premiere_date=current_date-20, episode_count=8 WHERE id=$1", [sid]);
  for (const [n, slug, title] of [[0,'11-airing-behind','Airing season: several episodes behind'],[2,'12-airing-one-behind','Airing season: one episode behind'],[3,'14-airing-caught-up','Airing season: caught up']]) {
    await attempt(title, async () => {
      await mark(n);
      const p = await visit('alex', sid, 'tonight');
      await shot(p, 'watching', slug, title, `No game; seen through ${n}; season is still airing.`);
      if (n === 2 && await p.locator('[data-seen-it-not-yet]').count()) {
        await p.locator('[data-seen-it-not-yet]').click();
        await p.locator('[data-up-next]').waitFor();
        await shot(p, 'watching', '13-airing-not-yet', 'Not yet: keep the aired episode hidden', 'The watcher explicitly says they have not watched it.');
      }
    });
  }
  // Only fixture season dates, state and memberships are changed below.
  const live = fx.seasonId;
  const L = fx.leagues.lineup;
  const admin = await api({ user: fixture.username('alex'), pass: fixture.PASSWORD });
  // The game's pace is live by default (a move stays open until you've watched: docs/PLAN-own-pace-games.md, "Pace is the game's
  // setting"); it was one person's switch here. Said again through the real route, so a strict fixture would be made live.
  const pace = await admin.call('PATCH', `/api/seasons/${live}/backstage/settings?couch=${fx.couchId}`, { leagueId: L, pace: 'live' });
  if (pace.status !== 200) throw new Error(`Make the game live: ${JSON.stringify(pace.body)}`);
  for (const [shift, seen, slug, title] of [[0,5,'01-before-airtime','Live game: before airtime'],[-4,5,'02-aired-waiting-results','Live game: episode aired, results not in'],[-4,3,'03-multiple-behind','Live game: more than one episode behind'],[-11,5,'04-next-airtime-passed','Live game: the next airtime has passed']]) {
    await attempt(title, async () => {
      await pool.query('UPDATE show_seasons SET premiere_date=current_date+3-35+$2::int WHERE id=$1', [live, shift]);
      await pool.query('UPDATE show_follows SET seen_through=$3 WHERE user_id=$1 AND season_id=$2', [fx.users.jordan, live, seen]);
      await pool.query('UPDATE league_memberships SET results_seen_through=$2 WHERE user_id=$1', [fx.users.jordan, seen]);
      const p = await visit('jordan', live, 'tonight');
      await shot(p, 'live-boundaries', slug, title, `Own-pace member; seen through ${seen}. Drafts, waivers and trades still follow league deadlines.`);
      const user = await api({ user: fixture.username('jordan'), pass: fixture.PASSWORD });
      const g = await user.call('GET', `/api/seasons/${live}/games?couch=${fx.couchId}`);
      fs.writeFileSync(path.join(out, 'live-boundaries', `${slug}.json`), JSON.stringify(g.body, null, 2));
    });
  }
}
async function extended() {
  await closeBrowsers();
  const fx = await fixture.up(pool);
  const clients = {};
  for (const who of ['sam', 'riley', 'jordan', 'alex']) clients[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
  const start = async (who, kind) => {
    await clients[who].call('PUT', `/api/me/follows/${season}`, { following: true, seenThrough: 0 });
    const r = await clients[who].call('POST', `/api/seasons/${season}/start?couch=${fx.couchId}`, { game: kind, tell: false, bots: 0, from: 1 });
    if (r.status !== 200 || !r.body.leagueId) throw new Error(JSON.stringify(r.body));
    return r.body.leagueId;
  };
  const join = async (who, leagueId) => {
    const r = await clients[who].call('POST', `/api/couches/${fx.couchId}/games/${leagueId}`, { action: 'join' });
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
  };
  const stateOf = async (L) => (await one('SELECT state FROM leagues WHERE id=$1', [L])).state;
  let solo;
  await attempt('Playing alone', async () => {
    solo = await start('sam', 'survivalPool');
    const context = 'Completed season, only one human in this game; zero computer players.';
    let p = await visit('sam', season, 'tonight');
    await shot(p, 'solo-and-sync', '01-solo-tonight', 'Playing alone: your first episode', context);
    p = await visit('sam', season, `game/${solo}`, '[data-game-page]');
    await shot(p, 'solo-and-sync', '02-solo-game', 'Playing alone: game page and personal score', context);
  });
  if (solo) await attempt('Friends at the same episode', async () => {
    await join('riley', solo);
    const context = 'Two humans, no bots; both start at Episode 1, neither has watched it.';
    let p = await visit('sam', season, 'tonight');
    await shot(p, 'solo-and-sync', '03-same-episode', 'Friends at the same episode', context);
    p = await visit('sam', season, `game/${solo}`, '[data-game-page]');
    await shot(p, 'solo-and-sync', '04-two-person-game', 'The game page after a friend joins', context);
  });
  await attempt('Active exclusive draft', async () => {
    const L = await start('jordan', 'outlast');
    await join('riley', L);
    let p = await visit('riley', season, 'tonight');
    await shot(p, 'solo-and-sync', '05-wait-for-draft', 'Member waiting for the commissioner to start the draft', 'Exclusive teams on an older season; both humans start together at Episode 1.');
    const r = await clients.jordan.call('POST', `/api/seasons/${season}/draft`, { leagueId: L, action: 'start' });
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
    p = await visit('jordan', season, 'tonight');
    await p.locator(`[data-pace-draft-plate='${L}']`).waitFor();
    await shot(p, 'solo-and-sync', '06-draft-running', 'Draft in progress: enter the room', 'The commissioner has started the shared draft.');
    await p.locator(`[data-pace-draft-plate='${L}'] [data-pace-draft-go]`).click();
    await p.locator('[data-draft]').waitFor();
    await shot(p, 'solo-and-sync', '07-draft-room', 'Own-pace game: the live draft room', 'The cast is the cast before Episode 1, even though the season finished airing.');
    const draftUrl = p.url();
    const other = await browser('riley');
    await other.page.goto(draftUrl);
    await other.page.locator('[data-draft]').waitFor();
    await shot(other.page, 'solo-and-sync', '08-draft-other-player', 'Draft room from the other player’s seat', 'Two humans drafting an older season together.');
  });
  await attempt('Shared team lineup editor', async () => {
    const L = await start('alex', 'weeklyLineup');
    let games = await clients.alex.call('GET', `/api/seasons/${season}/games?couch=${fx.couchId}`);
    let g = games.body.games.find(x => x.leagueId === L);
    const r = await clients.alex.call('POST', `/api/leagues/${L}/team`, { castawayIds: g.pace.team.pool.slice(0, g.pace.team.need) });
    if (r.status !== 200) throw new Error(JSON.stringify(r.body));
    let p = await visit('alex', season, 'tonight');
    await p.locator(`[data-pace-plate='${L}'] [data-pace-move]`).click();
    await p.locator('[role=dialog]').last().waitFor();
    await shot(p, 'solo-and-sync', '09-lineup-editor', 'Set your lineup before watching the old episode', 'Shared team; no synchronous draft or other players required.');
    games = await clients.alex.call('GET', `/api/seasons/${season}/games?couch=${fx.couchId}`);
    g = games.body.games.find(x => x.leagueId === L);
    const saved = await clients.alex.call('PUT', `/api/leagues/${L}/episodes/${g.lineup.epId}/lineups/${g.playerId}`, { castawayIds: g.lineup.roster.slice(0, g.lineup.slots) });
    if (saved.status !== 200) throw new Error(JSON.stringify(saved.body));
    p = await visit('alex', season, 'tonight');
    await p.locator(`[data-pace-plate='${L}'] [data-pace-reveal]`).waitFor();
    await shot(p, 'solo-and-sync', '10-lineup-saved', 'Lineup saved: watch, then reveal', 'The lineup can change until you reveal the episode.');
  });
  await attempt('Airing season played from an earlier episode', async () => {
    const r = await clients.alex.call('POST', `/api/seasons/${fx.seasonId}/start?couch=${fx.couchId}`, { game: 'survivalPool', tell: false, bots: 0, from: 4 });
    if (r.status !== 200) {
      manifest.push({ status: 'unavailable', group: 'solo-and-sync', title: 'Start an own-pace game on a still-airing season', reason: r.body });
      return;
    }
    const L = r.body.leagueId;
    const st = await stateOf(L);
    const p = await visit('alex', fx.seasonId, 'tonight');
    await shot(p, 'solo-and-sync', '11-airing-season-own-pace', 'A still-airing season: playing from an earlier episode', `Game starts at Episode 4; ownPace=${st.settings.ownPace === true}.`);
  });
}
function gallery() {
  const known = new Set(manifest.map(m => m.file));
  for (const group of ['live', 'finished-season']) {
    const dir = path.join(out, group);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png') && !f.endsWith('.full.png')).sort()) {
      if (known.has(`${group}/${file}`)) continue;
      manifest.push({ group, file: `${group}/${file}`, title: file.replace(/\.png$/, '').replace(/-/g, ' '), context: group === 'live' ? 'Airing season, own-pace member in a multiplayer head-to-head game.' : 'Completed season, players progressing independently; captured by check-own-pace.js.', status: 'captured', width: 390, height: 844 });
    }
  }
  const labels = {
    '01-games-your-episode': 'Games available at your own episode',
    '02-start-sheet': 'Start a game on a completed season: the shared wizard',
    '03-tonight-plate-pick': 'Pick first, then watch and reveal',
    '04-tonight-plate-ask': 'Already watched: confirm revealing without a pick',
    '05-tonight-plate-watch': 'Pick saved; revealing would put you two episodes ahead',
    '06-revealed-sheet': 'Episode revealed: results and the next episode',
    '07-riley-plate': 'Your next episode while your friend is further ahead',
    '08-join-sheet': 'Join a game whose players are at different episodes',
    '09-finish-plate': 'Finished your game while a friend is still watching',
    '21-lineup-team-plate': 'Choose a shared team before the first episode',
    '22-lineup-team-sheet': 'Team selection on a completed season',
    '23-lineup-plate': 'Team selected; now set your episode lineup',
    '24-outlast-draft-plate': 'Exclusive teams: draft together before watching',
    '25-outlast-gather-wait': 'Waiver checkpoint: a friend has not reached this episode',
    '26-outlast-waivers-on': 'Everyone reached the checkpoint: waivers open',
    '01-members-sheet-switch': 'Commissioner allows one member to play at their own pace',
    '02-jordan-tonight-late': 'Live game: set a lineup after airtime, before watching',
    '03-jordan-games-late': 'Late player’s Games tab: the move is still due',
    '04-sam-game-waiting': 'Opponent’s game page: matchup waits for the late lineup',
    '05-sam-sheet-waiting': 'Opponent’s episode detail: waiting instead of a result',
    '06-sam-grid-marker': 'Late lineup saved: clock marker on the season grid',
    '07-sam-jordan-sheet': 'Player detail explains when the late lineup was set',
    'start-wizard': 'Completed-season wizard: full available choices'
  };
  const order = ['watching', 'solo-and-sync', 'finished-season', 'finished-extra', 'live', 'live-boundaries'];
  for (const m of manifest) if (m.file && labels[path.basename(m.file, '.png')]) m.title = labels[path.basename(m.file, '.png')];
  manifest.sort((a,b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.file || '').localeCompare(b.file || ''));
  const captured = manifest.filter(m => m.status === 'captured');
  const groups = [...new Set(captured.map(m => m.group))];
  const cards = captured.map((m,i) => `<article data-group="${esc(m.group)}"><h2>${i+1}. ${esc(m.title)}</h2><p>${esc(m.context)}</p><a href="${esc(m.file)}"><img src="${esc(m.file)}" loading="lazy" alt="${esc(m.title)}"></a><p><a href="${esc(m.file)}">Screenshot</a>${m.full ? ` · <a href="${esc(m.full)}">Full page</a>` : ''}</p></article>`).join('');
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Own-pace UI inventory</title><style>body{font:16px system-ui;background:#f4f2ed;color:#20202b;margin:24px}h1{margin-bottom:8px}nav{position:sticky;top:0;background:#f4f2ed;padding:12px 0;z-index:1}button{font:inherit;margin:4px;padding:8px;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:24px}article{background:white;padding:16px;border:1px solid #ddd;border-radius:8px}h2{font-size:18px}img{width:100%;height:auto;border:1px solid #ddd}article p{line-height:1.4}a{color:#353bb2}[hidden]{display:none}</style><h1>Watching at your own pace</h1><p>${captured.length} captured states · 390 × 844 CSS px baseline · fixture users · current local implementation. Click an image for original resolution.</p><p>Coverage includes watching only, completed-season games, players at different episodes, draft/waiver checkpoints, a late member in a live game, and deadline boundaries. This records the current UI, including inconsistencies. Capture failures: ${failed}.</p><nav><button data-filter="all">All</button>${groups.map(g=>`<button data-filter="${esc(g)}">${esc(g)}</button>`).join('')}</nav><main class="grid">${cards}</main><script>document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>document.querySelectorAll('article').forEach(a=>a.hidden=b.dataset.filter!=='all'&&a.dataset.group!==b.dataset.filter));</script></html>`);
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n${captured.length} screenshots; ${failed} capture failures. Open ${path.join(out, 'index.html')}`);
}
(async () => {
  if (args.includes('--gallery-only')) {
    gallery();
    await pool.end();
    return;
  }
  try {
    if (args.includes('--extended-only')) {
      await extended();
    } else {
      if (!args.includes('--reuse-checks')) {
        if (!args.includes('--reuse-live')) await run('check-own-pace-live.js', 'live');
        await run('check-own-pace.js', 'finished-season');
      }
      await finished();
      await watchingAndBoundaries();
      await extended();
    }
  } catch (e) {
    failed++;
    manifest.push({ status: 'failed', error: e.message });
    console.error(e);
  } finally {
    await closeBrowsers();
    await fixture.down(pool);
    await pool.end();
    gallery();
  }
  process.exitCode = failed ? 1 : 0;
})();
