// A game in stages on the REAL routes against the explorer runtime (the breadth program's direct server comparison for stages:
// docs/GAMEPLAY-EXPLORER.md, "Capability: stages"). Each case is a runtime case materialized as zt-gb- rows
// (tools/gameplay-bench/live-db.cjs: the game a league, each stage a league of its own tied to it by stage_of and stage_key), then
// read or written through the app as its zt users.
//
// Cases (--case, default all):
//   overall  two games in stages (two Weekly Lineups; two Outlasts in an exclusive snake) split at the merge, played through the
//            episode after it; Ann caught up, Bo one behind, Cy two behind. Every person's /games: the game's overall and each
//            stage's table equal the runtime's, each stage names the game it's a stage of, and the shared route checks
//            (api-checks.cjs: agreement and spoilers) are clean. Control: one stage untied behind the runtime (stage_of cleared):
//            the server's overall must then disagree, so the server is shown to read the stages.
//   draft    the second stage's draft made on the server by the people themselves. The case is materialized as the merge episode's
//            results come in, with the draft open and nobody on a team (the runtime's state before it makes its own draft). Before
//            that, the server refuses to start it and says why. Then whoever runs the game starts it, each seat locks in the team
//            the runtime generated for it (a sheet naming someone who has gone home is refused, and one a castaway short), and the
//            last lock reveals. The server's teams, how the draft is played (an exclusive snake that no longer fits among who's
//            still in: shared, private) and its waivers must equal the runtime's.
//   snake    an exclusive snake that still fits: started, then picked turn by turn in the runtime's order; the teams and the
//            draft's log must equal the runtime's.
//   lineup   a lineup saved in the second stage through the real lineup route is stored as the runtime stores the same action;
//            the game's own league takes none.
//   short    a private draft of six each with five still in: started, then every sheet is refused. NOTE (BACKLOG 60).
//   pace     when moves lock is the game's setting, and its stages follow (docs/PLAN-own-pace-games.md, "Pace is the game's
//            setting"; it was one person's switch, set stage by stage). Episode 4 has aired and Bo hasn't watched it. Strict (the
//            explorer's live-only): his Merged-stage lineup is refused. A stage refuses the setting; set to live on the game,
//            both stage leagues follow and his lineup is taken; strict again, they follow back.
// NOTE lines are recorded product findings, not disagreements (both sides do the same): what someone behind is shown of the
// next stage, and a draft nobody can lock in.
// --verbose prints server answers; --keep leaves the rows up (remove: node tools/gameplay-bench/live-db.cjs down-all).
//
// Needs: the app on :3000 (npm run dev; BASE to override) and the local dev database (.env.local AUTH_DATABASE_URL).
// Run:   node scripts/dev-test/check-stages-explorer.js [--case=overall|draft|snake|lineup|short|pace|all] [--verbose] [--keep]
const path = require('path');
const root = path.resolve(__dirname, '../..');
const L = require(path.join(root, 'tools/gameplay-bench/live-db.cjs')), R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs')), D = require(path.join(root, 'tools/gameplay-bench/explorer/document.cjs'));
const Data = require(path.join(root, 'tools/gameplay-bench/explorer/runtime-data.cjs')), { checkCase } = require(path.join(root, 'tools/gameplay-bench/api-checks.cjs'));
const Q = require(path.join(root, 'tests/fixtures/gameplay-explorer/questions-input.json')), S = require(path.join(root, 'src/lib/game/state-logic'));
const { signIn } = require(path.join(root, 'tools/ui-atlas/data.cjs'));
const app = process.env.BASE || 'http://localhost:3000';
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3), flag = k => process.argv.includes('--' + k);
const which = arg('case') || 'all', verbose = flag('verbose'), keep = flag('keep');
const c = n => 'show-participant-' + n, PEOPLE = [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }, { id: 'p3', name: 'Cy' }];
const lineup = each => ({ get: { by: 'draft', each, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } });
const outlast = each => ({ preset: 'outlast', get: { by: 'draft', each, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } });
const staged = game => ({ stages: [{ id: 'before', name: 'Before the merge', game: { ...game, span: { from: 1, to: { phase: 'merged' } } } }, { id: 'after', name: 'Merged', game: { ...game, span: { from: { phase: 'merged' } } } }], overall: { by: 'points' } });
const define = (games, { people = PEOPLE, pool = 12, events = 6 } = {}) => D.create({ seed: 9, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: people.length, pool }, phaseStarts: { merged: 3 } }], people },
  games: Object.entries(games).map(([id, spec]) => ({ id, contextId: 'show', timing: 'live-only', spec })), situation: { clock: '2099-01-10T12:00:00.000Z', marks: [] }, content: { completedEvents: 0, eventCount: events } });

const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || detail === undefined ? '' : ': ' + JSON.stringify(detail).slice(0, 700))); };
const note = text => console.log('NOTE ' + text);
const must = (s, a) => { const r = s.apply(a); if (r.status !== 'accepted') throw Error('The case could not be built: ' + JSON.stringify(a) + ' ' + r.message); return r; };
/** Episode n airs and its results come in: castaway n goes home, castaways 5 and 9 (7 in a cast of eight) each win a reward. Lineups first, where one is open. */
function night(s, n) {
  const snap = s.snapshot(), ev = snap.contexts.show.events[n - 1];
  for (const g of s.export().input.games.filter(g => g.stageOf !== undefined)) for (const p of snap.people) { const v = s.project(g.id, p.id).game, l = v.lineup; if (l && l.episode === n && !v.revealFirst) must(s, { type: 'lineup', gameId: g.id, personId: p.id, eventId: l.epId, ids: l.roster.slice(0, l.slots) }); }
  must(s, { type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() });
  must(s, { type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: c(n), method: 'Voted Out' }], scoringEvents: [5, snap.contexts.show.participants.length >= 9 ? 9 : 7].map(k => ({ id: 'r' + k + '-' + n, type: 'rewardWin', castawayId: c(k) })) } });
}
const reveal = (s, who, times = 1) => { for (let i = 0; i < times; i++) must(s, { type: 'reveal', contextId: 'show', personId: who }); };
/** Materialize `snap` (the session's, or a state made from it), run `fn` with its ids and a signed-in fetch for each person, remove it. */
async function withRows(snap, doc, fn) {
  const ids = await L.up(snap, doc), shift = Date.now() - Date.parse(snap.clock);
  try {
    await L.sync(ids, snap, doc, shift); await L.seedSocial(ids, snap, doc, shift);
    const cookies = {};
    const as = async (person, method, url, body) => {
      cookies[person] ||= await signIn(app, ids.users[person].username, L.PASSWORD);
      const r = await fetch(app + url, { method, headers: { cookie: cookies[person], ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      if (verbose) console.log('   ', person, method, url.replace(/[0-9a-f-]{36}/g, m => Object.entries(ids.leagues).find(([, v]) => v === m)?.[0] || 'S'), r.status, text.slice(0, 160));
      return { status: r.status, json, text };
    };
    return await fn(ids, as, shift);
  } finally { if (keep) console.log('  kept: ' + JSON.stringify({ key: ids.key, users: Object.values(ids.users).map(u => u.username), password: L.PASSWORD })); else await L.down(ids.key).catch(() => {}); }
}
const teamsOf = st => Object.fromEntries(st.players.map(p => [p.id, st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => x.id).sort()]));
const draftOf = st => ({ own: S.gameOf(st).get.own, order: S.gameOf(st).get.order, each: S.gameOf(st).get.each, waivers: S.gameOf(st).extras.waivers ?? null, picksMade: st.draftPicksMade || 0, revealed: !!st.blindDraft?.revealedAt, locked: st.blindDraft?.lockedPlayerIds || [], via: st.castaways.filter(x => x.ownerIds.length).every(x => x.acquiredVia === 'draft') });
/** The runtime's state as the results that open a stage's draft come in, the draft open and nobody on a team yet: the stage's state from
 *  before those results, with them applied and its span settled as the runtime settles any write, less the draft it then makes. */
function draftOpen(before, after, doc, childId) {
  const st = JSON.parse(JSON.stringify(before.games[childId].state)), world = after.contexts.show, game = doc.games.find(g => g.id === childId);
  Data.applyFacts(world, st); Data.syncMarks(world, game, st); Data.settleWrite(world, st, { phases: true, clock: after.clock });
  if (S.DraftLogic.waits(st) || st.castaways.some(x => x.ownerIds.length)) throw Error('The draft should be open and not made');
  return { ...after, games: { ...after.games, [childId]: { ...after.games[childId], state: st } } };
}

const CASES = {
  async overall() {
    const s = R.open(define({ two: staged(lineup(3)), out: staged(outlast(4)) }));
    try {
      const doc = s.export().input;
      night(s, 1); night(s, 2); for (const p of ['p1', 'p2', 'p3']) reveal(s, p, 2);
      night(s, 3); reveal(s, 'p1'); reveal(s, 'p2'); night(s, 4); reveal(s, 'p1');
      const snap = s.snapshot();
      await withRows(snap, doc, async (ids, as) => {
        const season = ids.seasons.show.id, url = '/api/seasons/' + season + '/games?couch=' + ids.couchId, table = v => v.table.map(r => [r.playerId, r.total]);
        const stillIn = new Set(snap.contexts.show.participants.map(p => p.id).filter(id => ![c(1), c(2), c(3), c(4)].includes(id)));
        for (const person of snap.people) {
          const got = await as(person.id, 'GET', url), list = got.json?.games || [];
          check(person.name + ': /games lists the two games and their four stages', got.status === 200 && doc.games.every(g => list.some(x => x.leagueId === ids.leagues[g.id])), { status: got.status, n: list.length });
          for (const g of doc.games) {
            const real = list.find(x => x.leagueId === ids.leagues[g.id]), mine = s.project(g.id, person.id).game;
            if (!real) continue;
            check(person.name + ': ' + g.id + (g.stageOf ? ' (a stage)' : ' (the overall)') + ' table, lineup episode and end equal the runtime', JSON.stringify([table(real), real.lineup?.episode ?? null, real.over, real.from, real.to]) === JSON.stringify([table(mine), mine.lineup?.episode ?? null, mine.over, mine.from, mine.to]), { server: [table(real), real.lineup?.episode ?? null, real.over, real.from, real.to], runtime: [table(mine), mine.lineup?.episode ?? null, mine.over, mine.from, mine.to] });
            check(person.name + ': ' + g.id + ' says ' + (g.stageOf ? 'which game it is a stage of' : "it is nobody's stage"), (real.stageOf ?? null) === (g.stageOf ? ids.leagues[g.stageOf] : null), real.stageOf);
          }
          // What someone behind is shown of the stage after the one they're in (recorded, not a disagreement).
          const mark = snap.contexts.show.marks.find(m => m.personId === person.id).through, next = list.find(x => x.leagueId === ids.leagues['two~after']);
          if (next && mark < 3) note(person.name + ' has seen through Episode ' + mark + ' (the merge came in Episode 3). The Merged stage shows them: starts with Episode ' + next.from + '; their team ' + JSON.stringify((next.you?.team || []).map(id => id.replace('show-participant-', '#'))) + ' (everyone on it still in after Episode 3: ' + (next.you?.team || []).every(id => stillIn.has(id) || id === c(4)) + '); a lineup asked for Episode ' + (next.lineup?.episode ?? 'none') + '; reveal first: ' + (next.revealFirst ?? 'no') + '.');
        }
        // An Outlast stage that starts mid-season (recorded, a question: BACKLOG 62): its own table before its first episode, against
        // what the game's overall counts of it then, as Bo (through Episode 3, the stage starting with 4) is shown them.
        { const bo = (await as('p2', 'GET', url)).json?.games || [], own = bo.find(x => x.leagueId === ids.leagues['out~after']), all = bo.find(x => x.leagueId === ids.leagues.out), first = bo.find(x => x.leagueId === ids.leagues['out~before']);
          if (own && all && first) note('Bo has seen through Episode 3; the Outlast Merged stage starts with Episode 4. Its own table already shows ' + JSON.stringify(table(own)) + ' (each holding 1 + the three boots before it started), while the overall is still the first stage alone, ' + JSON.stringify(table(all)) + '. Ann, a week on, sees the overall ' + JSON.stringify(table(s.project('out', 'p1').game)) + '.'); }
        const problems = await checkCase({ app, ids, snap, document: doc, project: (g, p) => s.project(g, p) });
        check('the shared route checks (agreement and spoilers) are clean for all three', !problems.filter(p => !p.signature.startsWith('known:')).length, problems.filter(p => !p.signature.startsWith('known:')).slice(0, 3));
        // Control: the Merged stage untied behind the runtime. The server's overall must then be the first stage's alone.
        const db = new (require('pg').Pool)({ connectionString: process.env.AUTH_DATABASE_URL });
        try {
          await db.query('UPDATE leagues SET stage_of = NULL, stage_key = NULL WHERE id = $1', [ids.leagues['two~after']]);
          const got = await as('p1', 'GET', url), real = got.json?.games?.find(x => x.leagueId === ids.leagues.two), mine = s.project('two', 'p1').game, first = s.project('two~before', 'p1').game;
          check('control: with the Merged stage untied, the server\'s overall is the first stage\'s alone (and no longer the runtime\'s)', real && JSON.stringify(table(real)) !== JSON.stringify(table(mine)) && JSON.stringify(table(real).sort()) === JSON.stringify(table(first).sort()), { server: real && table(real), runtime: table(mine), first: table(first) });
          await db.query('UPDATE leagues SET stage_of = $2, stage_key = $3 WHERE id = $1', [ids.leagues['two~after'], ids.leagues.two, 'after']);
        } finally { await db.end(); }
      });
    } finally { s.dispose(); }
  },
  async draft() {
    const s = R.open(define({ out: staged(outlast(4)) }));
    try {
      const doc = s.export().input, child = 'out~after';
      night(s, 1); night(s, 2); for (const p of ['p1', 'p2', 'p3']) reveal(s, p, 2);
      // Before the merge is known: the server refuses to start the draft, and says why.
      await withRows(s.snapshot(), doc, async (ids, as) => {
        const r = await as('p1', 'POST', '/api/leagues/' + ids.leagues[child] + '/draft/force-start', {});
        check('before the merge, the Merged stage\'s draft can\'t be started (409, and why)', r.status === 409 && /opens once it.s known where the game starts/.test(r.text), [r.status, r.text.slice(0, 120)]);
      });
      const before = s.snapshot(); night(s, 3); for (const p of ['p1', 'p2', 'p3']) reveal(s, p);
      const after = s.snapshot(), want = after.games[child].state;
      await withRows(draftOpen(before, after, doc, child), doc, async (ids, as) => {
        const league = ids.leagues[child], lock = (who, idsOf) => as(who, 'POST', '/api/leagues/' + league + '/draft/blind/lock', { playerId: who, castawayIds: idsOf });
        const start = await as('p2', 'POST', '/api/leagues/' + league + '/draft/force-start', {});
        check('only whoever runs the game starts the draft', start.status === 403, start.status);
        const started = await as('p1', 'POST', '/api/leagues/' + league + '/draft/force-start', {});
        const st1 = (await L.read(ids)).states.get(league);
        check('Episode 3\'s results opened the draft: started (200), and three seats of four no longer fit the nine still in, so it is played shared, in private', started.status === 200 && S.gameOf(st1).get.own === 'shared' && S.gameOf(st1).get.order === 'blind', [started.status, S.gameOf(st1).get]);
        const teams = teamsOf(want);
        const gone = await lock('p2', [c(1), ...teams.p2.slice(1)]);
        check('a sheet naming someone who has gone home is refused', gone.status === 400 && /already eliminated/.test(gone.text), [gone.status, gone.text.slice(0, 120)]);
        const few = await lock('p2', teams.p2.slice(1));
        check('a sheet a castaway short is refused', few.status === 400 && /Pick exactly 4/.test(few.text), [few.status, few.text.slice(0, 120)]);
        for (const p of ['p1', 'p2', 'p3']) { const r = await lock(p, teams[p]); if (r.status !== 200) check(p + ' locks in their team', false, [r.status, r.text.slice(0, 200)]); }
        const st = (await L.read(ids)).states.get(league);
        check('the server\'s teams after the reveal are the runtime\'s', JSON.stringify(teamsOf(st)) === JSON.stringify(teams), { server: teamsOf(st), runtime: teams });
        check('how the draft is played, its waivers and its record equal the runtime\'s', JSON.stringify(draftOf(st)) === JSON.stringify(draftOf(want)), { server: draftOf(st), runtime: draftOf(want) });
        const got = await as('p1', 'GET', '/api/seasons/' + ids.seasons.show.id + '/games?couch=' + ids.couchId), real = got.json?.games?.find(x => x.leagueId === league), mine = s.project(child, 'p1').game;
        check('Ann\'s Merged stage on /games equals the runtime\'s after its own draft', real && JSON.stringify(real.table.map(r => [r.playerId, r.total, [...(r.team || [])].sort()])) === JSON.stringify(mine.table.map(r => [r.playerId, r.total, [...(r.team || [])].sort()])), { server: real?.table.map(r => [r.playerId, r.total]), runtime: mine.table.map(r => [r.playerId, r.total]) });
      });
    } finally { s.dispose(); }
  },
  async snake() {
    const people = PEOPLE.slice(0, 2), s = R.open(define({ out: staged(outlast(2)) }, { people }));
    try {
      const doc = s.export().input, child = 'out~after';
      night(s, 1); night(s, 2); for (const p of ['p1', 'p2']) reveal(s, p, 2);
      const before = s.snapshot(); night(s, 3); for (const p of ['p1', 'p2']) reveal(s, p);
      const after = s.snapshot(), want = after.games[child].state, log = st => (st.draftLog || []).map(x => [x.n, x.playerId, x.castawayId]);
      await withRows(draftOpen(before, after, doc, child), doc, async (ids, as) => {
        const league = ids.leagues[child];
        const started = await as('p1', 'POST', '/api/leagues/' + league + '/draft/force-start', {});
        check('the draft starts (two seats of two fit the nine still in: it stays an exclusive snake)', started.status === 200 && S.gameOf((await L.read(ids)).states.get(league)).get.own === 'exclusive', started.status);
        const wrong = await as(want.draftLog[0].playerId === 'p1' ? 'p2' : 'p1', 'POST', '/api/leagues/' + league + '/draft/pick', { castawayId: want.draftLog[0].castawayId });
        const st0 = (await L.read(ids)).states.get(league);
        check('a pick out of turn takes nobody', !st0.castaways.some(x => x.ownerIds.length), [wrong.status, wrong.text.slice(0, 120)]);
        for (const x of want.draftLog) { const r = await as(x.playerId, 'POST', '/api/leagues/' + league + '/draft/pick', { castawayId: x.castawayId }); if (r.status !== 200) check(x.playerId + ' picks ' + x.castawayId, false, [r.status, r.text.slice(0, 200)]); }
        const st = (await L.read(ids)).states.get(league);
        check('the server\'s teams and the draft\'s log are the runtime\'s', JSON.stringify([teamsOf(st), log(st)]) === JSON.stringify([teamsOf(want), log(want)]), { server: [teamsOf(st), log(st)], runtime: [teamsOf(want), log(want)] });
        check('how the draft is played equals the runtime\'s', JSON.stringify(draftOf(st)) === JSON.stringify(draftOf(want)), { server: draftOf(st), runtime: draftOf(want) });
      });
    } finally { s.dispose(); }
  },
  async lineup() {
    const s = R.open(define({ two: staged(lineup(3)) }));
    try {
      const doc = s.export().input, child = 'two~after';
      night(s, 1); night(s, 2); night(s, 3); for (const p of ['p1', 'p2', 'p3']) reveal(s, p, 3);
      await withRows(s.snapshot(), doc, async (ids, as) => {
        const l = s.project(child, 'p1').game.lineup, picked = l.roster.slice(1, 1 + l.slots), put = league => as('p1', 'PUT', '/api/leagues/' + league + '/episodes/' + encodeURIComponent(l.epId) + '/lineups/p1', { castawayIds: picked });
        const onGame = await put(ids.leagues.two), mineOnGame = s.apply({ type: 'lineup', gameId: 'two', personId: 'p1', eventId: l.epId, ids: picked });
        const stored = async league => (await L.read(ids)).states.get(league).episodes.find(e => e.id === l.epId)?.lineups?.p1 ?? null;
        check('the game itself takes no lineup (the server stores none, the runtime refuses)', mineOnGame.status === 'rejected' && (await stored(ids.leagues.two)) === null, [onGame.status, onGame.text.slice(0, 120), mineOnGame.status]);
        const r = await put(ids.leagues[child]), mine = s.apply({ type: 'lineup', gameId: child, personId: 'p1', eventId: l.epId, ids: picked });
        const want = s.snapshot().games[child].state.episodes.find(e => e.id === l.epId).lineups.p1;
        check('Ann\'s Episode 4 lineup in the Merged stage is stored as the runtime stores it', r.status === 200 && mine.status === 'accepted' && JSON.stringify(await stored(ids.leagues[child])) === JSON.stringify(want), { status: r.status, server: await stored(ids.leagues[child]), runtime: want });
      });
    } finally { s.dispose(); }
  },
  async short() {
    const s = R.open(define({ six: staged(lineup(6)) }, { pool: 8 }));
    try {
      const doc = s.export().input, child = 'six~after';
      night(s, 1); night(s, 2); night(s, 3); for (const p of ['p1', 'p2', 'p3']) reveal(s, p, 3);
      const snap = s.snapshot(), st = snap.games[child].state, still = st.castaways.filter(x => x.status === 'active').map(x => x.id);
      check('the runtime leaves the draft open and unmade (five still in, a team is six)', still.length === 5 && !st.castaways.some(x => x.ownerIds.length) && S.DraftLogic.waits(st) === null, still.length);
      await withRows(snap, doc, async (ids, as) => {
        const league = ids.leagues[child], lock = idsOf => as('p1', 'POST', '/api/leagues/' + league + '/draft/blind/lock', { playerId: 'p1', castawayIds: idsOf });
        const started = await as('p1', 'POST', '/api/leagues/' + league + '/draft/force-start', {});
        const all = await lock(still), padded = await lock([...still, c(1)]);
        const refused = started.status === 200 && all.status === 400 && padded.status === 400;
        check('the server starts the draft and refuses every sheet (all five still in; five and someone gone)', refused, [started.status, all.status, all.text.slice(0, 100), padded.status, padded.text.slice(0, 100)]);
        const after = (await L.read(ids)).states.get(league);
        if (refused) note('BACKLOG 60: a later stage\'s private draft of 6 each with 5 still in can\'t be locked in by anyone ("' + (all.json?.error || all.text).slice(0, 80) + '"; "' + (padded.json?.error || padded.text).slice(0, 80) + '"). Nobody ever has a team in that stage (on teams now: ' + after.castaways.filter(x => x.ownerIds.length).length + ').');
      });
    } finally { s.dispose(); }
  },
  async pace() {
    const people = PEOPLE.slice(0, 2), s = R.open(define({ two: staged(lineup(3)) }, { people }));
    try {
      const doc = s.export().input, child = 'two~after';
      night(s, 1); night(s, 2); night(s, 3); for (const p of ['p1', 'p2']) reveal(s, p, 3);
      // Episode 4 airs (no results yet); Bo hasn't set his Merged lineup, and hasn't watched it.
      const ev4 = s.snapshot().contexts.show.events[3]; must(s, { type: 'clock', at: new Date(Date.parse(ev4.airAt) + 3600000).toISOString() });
      const snap = s.snapshot();
      await withRows(snap, doc, async (ids, as) => {
        const season = ids.seasons.show.id, q = '?couch=' + ids.couchId, game = ids.leagues.two, stage = ids.leagues[child], first = ids.leagues['two~before'];
        const team = snap.games[child].state.castaways.filter(x => x.ownerIds.includes('p2') && x.status === 'active').map(x => x.id).slice(0, 2);
        const put = () => as('p2', 'PUT', '/api/leagues/' + stage + '/episodes/' + encodeURIComponent(ev4.id) + '/lineups/p2', { castawayIds: team });
        const set = (leagueId, mode) => as('p1', 'PATCH', '/api/seasons/' + season + '/backstage/settings' + q, { leagueId, pace: mode });
        const strictIn = async id => !!(await L.read(ids)).states.get(id).settings.lockAtAir, stored = async () => (await L.read(ids)).states.get(stage).episodes.find(e => e.id === ev4.id).lineups?.p2 ?? null;
        const read = async () => Object.fromEntries(((await as('p1', 'GET', '/api/seasons/' + season + '/backstage/settings' + q)).json?.games || []).map(g => [g.leagueId, g.pace]));
        const before = await read();
        check('Game settings: the game is strict, and each stage says it follows the game', before[game]?.mode === 'strict' && before[game]?.of === null && before[stage]?.mode === 'strict' && !!before[stage]?.of && !!before[first]?.of, before);
        const refused = await put();
        check('strict: Bo\'s Episode 4 lineup in the Merged stage is refused after it aired', refused.status === 400 && (await stored()) === null, [refused.status, refused.text.slice(0, 100)]);
        const onStage = await set(stage, 'live');
        check('a stage refuses the setting (it follows its game)', onStage.status === 409 && /follows its game/.test(onStage.text), [onStage.status, onStage.text.slice(0, 100)]);
        const live = await set(game, 'live');
        check('set to live on the game: both stages follow', live.status === 200 && !(await strictIn(game)) && !(await strictIn(stage)) && !(await strictIn(first)), [live.status, await strictIn(game), await strictIn(stage), await strictIn(first)]);
        const taken = await put();
        check('live: the same lineup is taken, for a seat that hasn\'t watched it', taken.status === 200 && JSON.stringify(await stored()) === JSON.stringify(team), [taken.status, await stored()]);
        const back = await set(game, 'strict');
        check('strict again on the game: both stages follow back', back.status === 200 && (await strictIn(game)) && (await strictIn(stage)) && (await strictIn(first)), [back.status, await strictIn(stage), await strictIn(first)]);
      });
    } finally { s.dispose(); }
  },
};

(async () => {
  const names = which === 'all' ? Object.keys(CASES) : [which];
  try {
    for (const name of names) { if (!CASES[name]) throw Error('Unknown case ' + name); console.log('== ' + name); await CASES[name](); }
  } catch (e) { check('ran to the end', false, e.stack || e.message); }
  finally { await L.close().catch(() => {}); }
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? failed + ' FAILED of ' + results.length : 'ALL PASS (' + results.length + ')');
  process.exitCode = failed ? 1 : 0;
})();
