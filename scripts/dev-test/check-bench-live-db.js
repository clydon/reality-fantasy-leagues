// The bench's live tier (tools/gameplay-bench/live-db.cjs): materialize a runtime case as zt-gb- rows, read it back
// through the REAL API routes as its zt users, and compare with the runtime's own production projection. No browser.
// Also the first spoiler oracle (plan §6A item 2): every route a person reads is scanned for tokens that exist only in
// facts past their own mark (recap sentences, the seeded after-air chat line, later scoring-moment IDs).
//
// Needs: the app on :3000 (npm run dev) and the local dev database (.env.local AUTH_DATABASE_URL; refuses anything else).
// Run:   node scripts/dev-test/check-bench-live-db.js [--file=<definition.json>] [--keep]
//        Default definition: the three-game proof with Ann a week behind. --keep leaves the rows up and prints the
//        logins (password zt-pass-12345); remove them later with node tools/gameplay-bench/live-db.cjs down-all.
const path = require('path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const L = require(path.join(root, 'tools/gameplay-bench/live-db.cjs')), R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs'));
const { signIn } = require(path.join(root, 'tools/ui-atlas/data.cjs'));
const app = process.env.BASE || 'http://localhost:3000';
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3);
const input = arg('file') ? require(path.resolve(arg('file'))) : require(path.join(root, 'tests/fixtures/gameplay-explorer/runtime-proof.cjs'))({ ann: 1, bo: 2 });

(async () => {
  const s = R.open(input), snap = s.snapshot(), doc = s.export().input, results = [];
  const check = async (name, fn) => { try { await fn(); results.push({ name, ok: true }); console.log('PASS ' + name); } catch (e) { results.push({ name, ok: false, error: e.message }); console.log('FAIL ' + name + ': ' + e.message.slice(0, 200)); } };
  let ids;
  try {
    ids = await L.up(snap, doc);
    const shift = Date.now() - Date.parse(snap.clock);
    await L.sync(ids, snap, doc, shift); await L.seedSocial(ids, snap, doc, shift);
    for (const person of snap.people) {
      const cookie = await signIn(app, ids.users[person.id].username, L.PASSWORD);
      const get = async url => { const r = await fetch(app + url, { headers: { cookie } }); return { status: r.status, body: await r.json().catch(() => null) }; };
      for (const [contextId, season] of Object.entries(ids.seasons)) {
        const q = '?couch=' + ids.couchId, games = await get('/api/seasons/' + season.id + '/games' + q);
        await check(person.name + ': real /games lists every game in ' + contextId, async () => { assert.equal(games.status, 200, JSON.stringify(games.body)); assert.equal(games.body.games.length, doc.games.filter(g => g.contextId === contextId).length); });
        for (const game of doc.games.filter(g => g.contextId === contextId)) {
          const real = games.body?.games?.find(g => g.leagueId === ids.leagues[game.id]), mine = s.project(game.id, person.id).game;
          await check(person.name + ': ' + game.id + ' standings and open move match the runtime', async () => {
            assert(real, 'missing from the real route');
            assert.deepEqual(real.table.map(r => [r.playerId, r.total]), mine.table.map(r => [r.playerId, r.total]));
            assert.equal(real.catchingUp, mine.catchingUp);
            assert.equal(real.lineup?.episode ?? null, mine.lineup?.episode ?? null);
            assert.equal(real.pick?.episode ?? null, mine.pick?.episode ?? null);
          });
        }
        const world = snap.contexts[contextId], mark = world.marks.find(m => m.personId === person.id).through, who = new Map(world.participants.map(x => [x.id, x.name]));
        const secrets = world.events.filter(e => e.number > mark && L.released(e)).flatMap(e => { const f = world.facts.find(x => x.eventId === e.id)?.data || { events: [], scoringEvents: [] }; return ['Synthetic recap of episode ' + e.number, ...f.events.map(x => 'believe ' + who.get(x.castawayId) + ' went home'), ...f.scoringEvents.map(x => x.id)]; });
        const reads = ['/api/me/home', '/api/seasons/' + season.id + '/space' + q, '/api/seasons/' + season.id + '/games' + q, '/api/seasons/' + season.id + '/episodes' + q, '/api/seasons/' + season.id + '/chat' + q, '/api/seasons/' + season.id + '/how-it-works' + q, ...doc.games.filter(g => (g.spec.ask || []).length).map(g => '/api/seasons/' + season.id + '/answers?league=' + ids.leagues[g.id])];
        for (const url of reads) {
          const r = await get(url), text = JSON.stringify(r.body);
          await check(person.name + ' (through ' + mark + '): no spoiler in ' + url.split('?')[0].replace(season.id, '{season}'), async () => { assert(r.status < 500, url + ' → ' + r.status); const leaked = secrets.filter(t => text.includes(t)); assert.deepEqual(leaked, [], 'leaked past episode ' + mark); });
        }
        // Positive control: the same kinds of tokens DO reach someone who has seen the episode, so a clean scan above means hidden, not absent.
        // (Recap sentences reach players only in the reveal response, so the seeded after-air chat line is the control.)
        const seenTokens = world.events.filter(e => e.number <= mark && L.released(e)).flatMap(e => (world.facts.find(x => x.eventId === e.id)?.data.events || []).map(x => 'believe ' + who.get(x.castawayId) + ' went home'));
        if (seenTokens.length && doc.games.some(g => g.contextId === contextId)) { const chat = JSON.stringify((await get('/api/seasons/' + season.id + '/chat' + q)).body); await check(person.name + ': after-air chat for seen episodes does reach them (oracle control)', async () => assert(seenTokens.some(t => chat.includes(t)), 'no seen after-air line in /chat: the spoiler scan may be blind')); }
        if (mark >= 1) { const g = await get('/api/seasons/' + season.id + '/gifs/' + mark + q); await check(person.name + ': the couch GIFs for a seen episode load', async () => assert.equal(g.status, 200, JSON.stringify(g.body).slice(0, 200))); }
        const space = await get('/api/seasons/' + season.id + '/space' + q);
        await check(person.name + ': real /space carries their own mark', async () => assert.equal(space.body?.you?.seenThrough, snap.contexts[contextId].marks.find(m => m.personId === person.id).through));
        for (const game of doc.games.filter(g => (g.spec.ask || []).length)) {
          const a = await get('/api/seasons/' + season.id + '/answers?league=' + ids.leagues[game.id]);
          await check(person.name + ': real /answers serves the question game ' + game.id, async () => assert.equal(a.status, 200, JSON.stringify(a.body)));
        }
      }
    }
    if (process.argv.includes('--keep')) console.log('[zt-gb] kept ' + ids.key + ': ' + Object.values(ids.users).map(u => u.username).join(', ') + ' / password ' + L.PASSWORD);
  } finally {
    if (ids && !process.argv.includes('--keep')) await L.down(ids.key);
    s.dispose(); await L.close();
  }
  console.log(JSON.stringify({ ok: results.every(r => r.ok), passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok) }));
  if (!results.every(r => r.ok)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
