// A game scored by a sport's stats on the REAL routes against the explorer runtime (the breadth program's sports statistics,
// first slice: docs/GAMEPLAY-EXPLORER.md, "Capability: sports statistics"). Each case is a runtime case on a generated sports
// world (tools/gameplay-bench/explorer/runtime-sports.cjs; tests/fixtures/gameplay-explorer/sports-proof.cjs: three people,
// Ann a game behind) materialized as zt-gb- rows (tools/gameplay-bench/live-db.cjs: a show of kind 'sport', its cast with
// positions and provider ids, a linked game an episode in season_events, each game's kept box score in sports_events under the
// provider 'zt-gb', which no real provider answers to), then read or written through the app as its zt users. The server never
// reads a stat line from the saved league: it rebuilds every table from those rows on each read (sports/score.ts), so agreement
// here is the server's own scoring against the runtime's.
//
// Cases (--case, default all):
//   tables      every league and game the slice takes (a team of three, best ball, a lineup where the league has one; --league
//               and --game narrow it): the shared route checks (api-checks.cjs) are clean for every person: tables, the season
//               grid week by week, nothing of a game past Ann's mark in her tables, grids or any answer, the after-air chat line
//               hidden from her and shown to the others. Ann's table differs from Bo's (her mark matters) and nobody's is empty.
//               The box-score probe's control is the classic state route, which still returns the whole league (known:
//               classic-state-spoiler: the probe must see Ann's unseen box score there).
//   locks       a lock by the week and by the day (the NFL's and the NBA's rule; a lineup of two from four). A week and a day
//               are the real calendar's (Eastern time, a week Tuesday to Monday), and where a written game falls in it is how
//               far it is from now: so the games are placed from where now is in the week (day). A game begun earlier this
//               week with the next later in it (its lineup is locked before its own game starts); the next game in the week
//               after (open); the game that began being last week's (open). Each time the server, the runtime and the rule
//               worked out here agree, and the real lineup route takes or refuses a lineup accordingly (a refusal
//               says the week's or the day's lock, not that the episode has started: BACKLOG 76, fixed 2026-11-14).
//   matchups    head to head, live (the NFL's own season): each person's record, last result and next opponent; Ann a game
//               behind has both weeks on hers by default, and only the one she has watched with "Sports scores too" on.
//   categories  a sport's categories. Roto, live (the NHL's, with a goalie's rates, and the NBA's), Ann a game behind with and
//               without "Sports scores too": the server's table, the runtime's and the rule restated apart from the engine
//               (campaign/sports-oracle.cjs) are the same for Ann and for Bo. Head to head by each category (the NHL's, MLB's):
//               each person's last week on the server is the categories each side won, worked out here. A wrong box score
//               behind the runtime moves the server's roto table off it.
//   live        who is told what on a live game (the server's guard, guard.ts: a sport's results show straight away, Account
//               settings' "Sports scores too" being off by default). Ann a game behind and nobody hiding scores: the server tells
//               her everything, as the runtime does. With "Sports scores too" on for her (a person's hidesScores, written as
//               user_settings.hide_sports_scores): the server stops at her mark, and the privacy checks hold for her.
//               (`tables` plays at everyone's own pace, where a seat always goes by its own mark.)
//   sweep       every GET route under a season and a league (found from the route files), as Ann told everything and as Bo with
//               "Sports scores too" on: none answers with a server error. (It found the Players tab's roster answering 500 for
//               anyone told everything, the default on a sport's season: BACKLOG 72, fixed 2026-11-14.)
//   control     a wrong box score written behind the runtime. A game everyone has watched: every person's table and grid must
//               disagree. A game only Ann hasn't watched: Bo's and Cy's must disagree and Ann's must not (the server stops at her
//               mark). The right rows written back: clean again (the server's cached stamp follows a rewritten final).
//   correction  a corrected box score for the first game (the runtime's `results` action, 'corrected'): the runtime's tables
//               move, and the server's follow for everyone.
//   lineup      an NFL lineup (two starters of four): Bo's lineup for the next game saved through the real lineup route is
//               stored as the runtime stores the same action; one naming someone else's player, and one of three, are refused
//               by both; once the game has started a change is refused by both; its box score in, everyone caught up: Bo's week
//               is his two starters' points, worked out here from the box score, and the route checks are clean.
//   places      points by place (golf's, racing's: a field's results are its lines and its standings; the materializer writes
//               each line's place and the standings in sports_events.shape). Live, Ann a game behind with and without "Sports
//               scores too": golf with ties and a cut (the PGA Tour's season), LIV's best ball (no cut), F1 (two sprint weekends: a race's, a sprint's
//               and qualifying's places), NASCAR (forty places): the server's table, the runtime's and the rule restated apart
//               from the engine (campaign/sports-oracle.cjs) are the same for Ann and Bo. A control: one of Bo's placed golfers
//               written 21st behind the runtime takes exactly that place's points off Bo on the server; the right rows back, clean.
//   positions   points by position (a stat's points by the holder's position group: FPL's goal, clean sheet and goals
//               conceded; soccer's three games). Live, Ann a game behind with and without "Sports scores too", the Premier
//               League's short game, MLS's best ball and the Champions League's season: the server's table (a holder's group from
//               the season's cast), the runtime's and the rule restated apart from the engine are the same for Ann and Bo. A
//               control: a goal moved from a forward of a seat's to a defender of theirs behind the runtime moves that seat by 2
//               on the server (a defender's 6, a forward's 4); the right rows back, clean.
//   formats     points by a match's format (tennis's: a day's results are its lines and its matches; the materializer writes the
//               card in sports_events.shape: each match's sides and best of, each one's line in it, the results). Live, Ann a
//               game behind with and without "Sports scores too", the ATP's short and season games (Grand Slam days best of five)
//               and the WTA's: the server's table, the runtime's and the rule restated apart from the engine are the same for Ann
//               and Bo. A control: a best of five a player of Bo's played, written as a best of three behind the runtime, moves
//               Bo by the formats' difference on the server; the right rows back, clean.
//   slates      a slate, a week of several games (context.slate; the materializer writes sports_slates, each athlete's team as
//               the cast's tribe_name, each game a linked game with its teams and its own kept final). The NBA's season and short
//               game and the NFL's best ball on three games a week, live, Ann a game behind with and without "Sports scores too":
//               the routes agree with the runtime, and a points table is each seat's games' points (the oracle). A lock at each
//               game's start (closes 'game') through a week on the real lineup route: taken before; refused an hour into the first
//               game for a holding in it; taken the next morning; refused after the last game began; the week's total counts each
//               game's lineup at its start (not the last lineup's), on the server and the runtime. A control: one game's box
//               score wrong behind the runtime moves the server's tables off.
//   calledoff   a week in progress and a game called off (the last sports slice: the materializer writes each game final so far
//               with its box score, a game called off as its row over without a final, state 'post' with its `called`). A slate (the
//               NBA's team of three), live, Ann a game behind with and without "Sports scores too": a week with one game final, then
//               two, counts nothing; its last game postponed puts it in, its two games played counted; the server's table, the
//               runtime's and the rule (campaign/sports-oracle.cjs counted) the same each time; a control: the postponed game written
//               as still to play behind the runtime, the server leaves the week out. An episode of one game cancelled (the NFL's team
//               of three and its head-to-head season): its results are in with nothing in them, the next game's lineup offered. A
//               day's lock opened by a call-off (the NBA's rule): today's first game postponed after it began, the next game's
//               lineup is open for the server, the runtime and the rule, and the route takes what it refused. A lock at each game's
//               start on a slate: a holding whose game is postponed is free to move past its start, one whose game began that day
//               isn't; the week played without it, the server's tables the runtime's.
// NOTE lines are recorded product findings, not disagreements (both sides do the same).
// --verbose prints server answers; --keep leaves the rows up (remove: node tools/gameplay-bench/live-db.cjs down-all).
// The page itself (the game page and its lineup sheet at a phone's width) is the explorer page check's sports step:
//   node scripts/dev-test/check-explorer-page.js --only="sports:"
//
// Needs: the app on :3000 (npm run dev; BASE to override) and the local dev database (.env.local AUTH_DATABASE_URL).
//        (A long-running dev server can keep serving an old server module after a fix: if a case still fails, `touch
//        next.config.ts` and run it again before doubting the fix. BACKLOG 72's note.)
// Run:   node scripts/dev-test/check-sports-explorer.js [--case=tables|locks|matchups|categories|places|positions|formats|slates|calledoff|live|sweep|control|correction|lineup|all] [--league=football/nfl] [--game=short] [--verbose] [--keep]
const path = require('path');
const root = path.resolve(__dirname, '../..');
const L = require(path.join(root, 'tools/gameplay-bench/live-db.cjs')), R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs'));
const P = require(path.join(root, 'tools/gameplay-bench/explorer/runtime-profile.cjs')), Sports = require(path.join(root, 'tools/gameplay-bench/explorer/runtime-sports.cjs'));
const Bench = require(path.join(root, 'tools/gameplay-bench/sports.cjs')), { checkCase } = require(path.join(root, 'tools/gameplay-bench/api-checks.cjs'));
const proof = require(path.join(root, 'tests/fixtures/gameplay-explorer/sports-proof.cjs')), S = require(path.join(root, 'src/lib/game/state-logic'));
const { signIn } = require(path.join(root, 'tools/ui-atlas/data.cjs'));
const app = process.env.BASE || 'http://localhost:3000';
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3), flag = k => process.argv.includes('--' + k);
const which = arg('case') || 'all', verbose = flag('verbose'), keep = flag('keep');

const results = [];
const note = text => console.log('NOTE ' + text);
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || detail === undefined ? '' : ': ' + JSON.stringify(detail).slice(0, 700))); };
const must = (s, a) => { const r = s.apply(a); if (r.status !== 'accepted') throw Error('The case could not be built: ' + JSON.stringify(a).slice(0, 200) + ' ' + r.message); return r; };
const clone = v => JSON.parse(JSON.stringify(v));
/** Materialize the session's case, run `fn` with its ids, a signed-in fetch for each person and a way to write the runtime's state again; remove it. */
async function withRows(s, fn) {
  const doc = s.export().input, first = s.snapshot(), ids = await L.up(first, doc);
  try {
    // (The scenario's clock is the server's now: written again after the runtime's clock moves. The schedule is written moved by
    // that much, and a day's or a week's lock is the moved days': the runtime reads its locks on the same calendar.)
    const write = async (snap = s.snapshot()) => { const shift = Date.now() - Date.parse(snap.clock); s.calendar(shift); return L.sync(ids, snap, doc, shift); };
    await write(first); await L.seedSocial(ids, first, doc, Date.now() - Date.parse(first.clock));
    const cookies = {};
    const as = async (person, method, url, body) => {
      cookies[person] ||= await signIn(app, ids.users[person].username, L.PASSWORD);
      const r = await fetch(app + url, { method, headers: { cookie: cookies[person], ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      if (verbose) console.log('   ', person, method, url.replace(/[0-9a-f-]{36}/g, 'ID'), r.status, text.slice(0, 160));
      return { status: r.status, json, text };
    };
    // The shared route checks against a runtime view: the session's own now, or another's (a control's).
    const routes = (snap = s.snapshot(), project = (g, p) => s.project(g, p)) => checkCase({ app, ids, snap, document: doc, project });
    return await fn({ ids, as, write, routes, doc });
  } finally { if (keep) console.log('  kept: ' + JSON.stringify({ key: ids.key, users: Object.values(ids.users).map(u => u.username), password: L.PASSWORD })); else await L.down(ids.key).catch(() => {}); }
}
const real = list => list.filter(x => !x.signature.startsWith('known:'));
const table = (s, who) => s.project('g', who).game.table.map(x => [x.playerId, x.total, ...(x.record ? [x.record.wins + '-' + x.record.losses + '-' + x.record.ties] : [])]);
/** The slice's leagues and games: every implemented game of the app's defaults the runtime opens without a gap. */
function slice() {
  const out = [];
  for (const c of Bench.catalog()) for (const g of c.games.filter(x => x.implemented)) {
    try { if (!P.inspect(proof({ league: c.id, game: g.id })).gaps.length) out.push([c.id, g.id]); } catch { /* not this league's */ }
  }
  return out.filter(([l, g]) => (!arg('league') || l === arg('league')) && (!arg('game') || g === arg('game')));
}
const round = n => Math.round(n * 100) / 100;
/** An athlete's points for one box score at the game's table, worked out here (the sport's derived stats, each stat's count times its points to the cent). */
function linePoints(context, spec, line) {
  const full = Sports.league(context).sport.full(line);
  return round(Object.entries(spec.score.points).reduce((n, [stat, each]) => n + round((full[stat] || 0) * each), 0));
}

const CASES = {
  async tables() {
    const all = slice();
    check('the slice has leagues to run' + (arg('league') || arg('game') ? ' (narrowed)' : ''), all.length > 0, all.length);
    for (const [league, game] of all) {
      const s = R.open(proof({ league, game }));
      try {
        await withRows(s, async ({ routes }) => {
          const found = await routes(), bad = real(found), ann = table(s, 'ann'), bo = table(s, 'bo');
          const probe = found.some(x => x.signature === 'known:classic-state-spoiler' && x.person === 'ann' && x.detail.results > 0);
          check(league + ' ' + game + ': tables, grids and privacy agree for Ann (a game behind), Bo and Cy', !bad.length && JSON.stringify(ann) !== JSON.stringify(bo) && (bo.every(([, t]) => t !== 0) || bo.some(([, , rec]) => rec && rec !== '0-0-0')) && probe,
            bad.length ? bad.slice(0, 3) : { ann, bo, probe: probe || 'the box-score probe saw nothing on the classic state route (its control; if that route is fixed, drop this)' });
        });
      } finally { s.dispose(); }
    }
  },
  async locks() {
    // A lock by the week and by the day, on the real routes. A week and a day are the real calendar's (Eastern time, a week
    // Tuesday to Monday), and a case is written with its schedule moved so the scenario's now is the server's. So where its
    // games fall in the real week is decided by how far they are from now, and the case places them from where now is:
    //   same     a game that began earlier this week (day), the next game later in it: its lineup is locked before its own start;
    //   next     the next game in the week (day) after: its lineup is open;
    //   before   the game that began was last week's (yesterday's): it locks nothing this week, and the lineup is open.
    // Each time three things must agree on whether the next game's lineup is locked: the server, the runtime (reading its locks
    // on the moved calendar: the session's calendar), and the rule worked out here from the written starts. A lineup sent to the
    // real route is then taken or refused as that says.
    const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
    const etDay = ms => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(new Date(ms)));
    const weekOf = ms => { const [y, m, d] = etDate(ms).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - ((etDay(ms) - 2 + 7) % 7))).toISOString().slice(0, 10); };
    const HOUR = 3600000, MIN = 60000, when = ms => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
    // How long since this week (day) began and until it ends, to the minute, by walking the key (no time-zone arithmetic here).
    const edges = (key, now) => { let lo = now, hi = now; const k = key(now); while (key(lo - HOUR) === k) lo -= HOUR; while (key(lo - MIN) === k) lo -= MIN; while (key(hi + HOUR) === k) hi += HOUR; while (key(hi + MIN) === k) hi += MIN; return { since: now - lo, until: hi + MIN - now }; };
    const nfl = Bench.resolve('football/nfl', 'short').row.spec, nba = Bench.resolve('basketball/nba', 'short').row.spec, two = x => ({ ...x, get: { ...x.get, each: 4 }, count: { start: 2 } });
    const CLOCK = '2099-01-10T12:00:00.000Z', at = ms => new Date(Date.parse(CLOCK) + ms).toISOString();
    for (const plan of [{ closes: 'weekly', league: 'football/nfl', spec: two(nfl), key: weekOf, far: 16 * HOUR, word: 'week' }, { closes: 'daily', league: 'basketball/nba', spec: two(nba), key: etDate, far: 3 * HOUR, word: 'day' }]) {
      const { since, until } = edges(plan.key, Date.now());
      if (since < 10 * MIN || until < 10 * MIN) { note(plan.closes + ': now is within ten minutes of the ' + plan.word + ' turning over; run this case again in a quarter of an hour'); continue; }
      // (began: how long ago the played game started; ahead: how far off the next game is.)
      const inside = Math.min(since / 2, plan.far), ahead = Math.min(until / 2, plan.far);
      const variants = [['same', inside, ahead, true], ['next', inside, until + 6 * HOUR, false], ['before', since + 6 * HOUR, ahead, false]];
      for (const [name, began, off, locked] of variants) {
        const schedule = [at(-began), at(off), at(off + 2 * 24 * HOUR)];
        const s = R.open(proof({ league: plan.league, game: plan.spec, closes: plan.closes, schedule, completed: 1, clock: CLOCK, timing: 'live-only', ann: 1, bo: 1, cy: 1 }));
        try {
          await withRows(s, async ({ ids, as, routes }) => {
            const shift = Date.now() - Date.parse(CLOCK), starts = schedule.map(t => Date.parse(t) + shift);
            // The rule, here: the next game's lineup (game 2) locks at the first start among the games of its week (or day).
            const want = Math.min(...starts.filter(t => plan.key(t) === plan.key(starts[1]))) <= Date.now();
            const bad = real(await routes());
            const games = (await as('bo', 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || [], server = games.find(g => g.leagueId === ids.leagues.g)?.lineup, mine = s.project('g', 'bo').game.lineup;
            const picked = mine.roster.slice(2, 4), sent = await as('bo', 'PUT', '/api/leagues/' + ids.leagues.g + '/episodes/' + encodeURIComponent(mine.epId) + '/lineups/bo', { castawayIds: picked }), applied = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: mine.epId, ids: picked });
            check(plan.closes + ', ' + name + ' (a game begun ' + when(starts[0]) + ', the next ' + when(starts[1]) + '): its lineup is ' + (locked ? 'locked before its own game' : 'open') + ' for the server, the runtime and the rule; the route ' + (locked ? 'refuses' : 'takes') + ' one',
              !bad.length && want === locked && server && server.episode === 2 && mine.episode === 2 && !!server.locked === want && !!mine.locked === want && (want ? sent.status >= 400 && sent.status < 500 && applied.status === 'rejected' && sent.json?.error === 'This ' + plan.word + "'s lineups are locked -- its first game has started" && server.lockedBy === plan.word : sent.status === 200 && applied.status === 'accepted'),
              bad.length ? bad.slice(0, 2) : { rule: want, server: server && [server.episode, server.locked], runtime: [mine.episode, mine.locked], route: sent.status, said: sent.json?.error, applied: applied.status });
          });
        } finally { s.dispose(); }
      }
    }
  },
  async matchups() {
    // Head to head, live (the NFL's own season: a lineup of nine, locking by the week), Ann a game behind: told everything by
    // default, held to her mark with "Sports scores too" on. The shared route checks compare each person's record, last result
    // and next opponent, and that nobody is shown a matchup they haven't watched.
    for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league: 'football/nfl', game: 'season', timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), mine = who => s.project('g', who).game.matchups;
          const games = (await as('ann', 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || [], server = games.find(g => g.leagueId === ids.leagues.g)?.matchups;
          const played = h => h && h.record.wins + h.record.losses + h.record.ties;
          check('head to head, live, ' + (hides.length ? 'Ann with "Sports scores too" on: her record stops at the game she has watched' : 'nobody hiding scores: Ann, a game behind, has both weeks on her record') + ', the server and the runtime the same',
            !bad.length && played(server) === (hides.length ? 1 : 2) && played(mine('ann')) === played(server) && played(mine('bo')) === 2 && JSON.stringify(server?.record) === JSON.stringify(mine('ann')?.record),
            bad.length ? bad.slice(0, 3) : { server: server?.record, ann: mine('ann')?.record, bo: mine('bo')?.record });
        });
      } finally { s.dispose(); }
    }
  },
  async categories() {
    // A sport's categories on the real routes, three ways: the server, the runtime, and the rule restated apart from the engine
    // (tools/gameplay-bench/campaign/sports-oracle.cjs: a count adds up, a rate is worked out from the counts added up and its
    // own group's lines, each category ranked across the seats with ties shared, or won, lost and tied head to head).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const totalsOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), defs = c.sport.categoryDefs(), cats = spec.score.categories;
      const games = world.events.filter(e => ['final', 'corrected'].includes(e.resultStatus) && upTo(e.number));
      const lines = p => games.flatMap(e => { const box = world.facts.find(f => f.eventId === e.id).data.lines; return S.ActiveRosterLogic.lineupFor(st, e.id, p).map(id => box[id]).filter(Boolean).map(l => c.sport.full(l)); });
      return { defs, cats, bySeat: Object.fromEntries(st.players.map(p => [p.id, Oracle.totals(lines(p.id), cats, defs)])) };
    };
    const serverGame = async (as, ids, who) => ((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g);
    // Roto, live: the NHL's (a goalie's rates beside the skaters' counts) and the NBA's; Ann a game behind, told everything by
    // default and held to her mark with "Sports scores too" on.
    for (const league of ['hockey/nhl', 'basketball/nba']) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league, game: 'roto', timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(), rule = n => { const t = totalsOf(snap, k => k <= n); return Oracle.roto(t.bySeat, t.cats, t.defs); };
          const of = g => Object.fromEntries((g?.table || []).map(r => [r.playerId, r.total])), ann = of(await serverGame(as, ids, 'ann')), bo = of(await serverGame(as, ids, 'bo'));
          const want = { ann: rule(hides.length ? 1 : 2), bo: rule(2) };
          const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
          check(league + ' roto, live, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ": the server's table is each category ranked across the seats from the box scores each has been told, for Ann and for Bo; the runtime the same",
            !bad.length && same(ann, want.ann) && same(bo, want.bo) && same(of(s.project('g', 'ann').game), want.ann) && (hides.length ? !same(want.ann, want.bo) : true),
            bad.length ? bad.slice(0, 2) : { server: { ann, bo }, rule: want });
        });
      } finally { s.dispose(); }
    }
    // Head to head by each category, live (the NHL's and MLB's), everyone caught up: each person's last week against the seat
    // they played is the categories each side won, and the result whoever won more, worked out here.
    for (const league of ['hockey/nhl', 'baseball/mlb']) {
      const s = R.open(proof({ league, game: 'categories', timing: 'live-only', ann: 2 }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(); let compared = 0, wrong = [];
          for (const who of ['ann', 'bo', 'cy']) {
            const last = (await serverGame(as, ids, who))?.matchups?.last;
            if (!last || !last.opponent) continue;
            const t = totalsOf(snap, k => k === last.episode), w = Oracle.week(t.bySeat[who], t.bySeat[last.opponent], t.cats, t.defs); compared++;
            if (last.points !== w.won || last.against !== w.lost || last.result !== w.result) wrong.push({ who, server: [last.points, last.against, last.result], rule: [w.won, w.lost, w.result] });
          }
          check(league + " categories, live: each person's last week on the server is the categories each side won from the box score, and the week whoever won more (" + compared + ' compared here)', !bad.length && compared >= 2 && !wrong.length, bad.length ? bad.slice(0, 2) : wrong);
        });
      } finally { s.dispose(); }
    }
    // Control: a wrong box score behind the runtime moves the server's roto table off the runtime's.
    {
      const s = R.open(proof({ league: 'basketball/nba', game: 'roto', timing: 'live-only', ann: 2 }));
      try {
        await withRows(s, async ({ write, routes }) => {
          const right = s.snapshot(), wrong = clone(right), st = right.games.g.state, f = wrong.contexts.sport.facts.find(x => x.eventId === right.contexts.sport.events[0].id);
          for (const id of S.ActiveRosterLogic.lineupFor(st, right.contexts.sport.events[0].id, 'bo')) f.data.lines[id] = Object.fromEntries(Object.entries(f.data.lines[id]).map(([k, v]) => [k, v * 4 + 3]));
          await write(wrong);
          const found = await routes(right);
          check("roto, a wrong box score for Bo's starters behind the runtime: the server's table disagrees with the runtime's", found.some(x => x.signature === 'standings-disagree'), found.slice(0, 2));
          await write(right);
          check('the right box score written back: clean again', !real(await routes()).length);
        });
      } finally { s.dispose(); }
    }
  },
  async places() {
    // Points by place on the real routes (the fourth slice: a field's results are its lines and its standings, golf's and
    // racing's), three ways: the server, the runtime, and the rule restated apart from the engine (campaign/sports-oracle.cjs: a
    // place's points by place or range, nothing out of the table or for no place, a field's place from its standings). The
    // server scores the place in each kept line (sports_events.lines; the materializer writes the standings in its shape too).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const ruleOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), out = {}, seen = { tied: 0, out: 0, past: 0, sprint: 0 };
      for (const p of st.players) {
        let total = 0;
        for (const e of world.events.filter(x => ['final', 'corrected'].includes(x.resultStatus) && upTo(x.number))) {
          const f = world.facts.find(x => x.eventId === e.id).data;
          const held = spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p.id) : st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => x.id);
          const pts = held.map(id => {
            const sd = f.standings.find(x => x.id === id), line = Oracle.placed(f.lines[id], sd, c.sport.id);
            if (sd.tied) seen.tied++;
            if (sd.place === null) seen.out++;
            if (Object.entries(spec.score.byPlace || {}).some(([k, t]) => line[k] != null && !Oracle.placePoints(t, line[k]))) seen.past++;
            if (line.SPR) seen.sprint++;
            return Oracle.linePoints(spec.score, line, null);
          });
          total += (spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts).reduce((a, b) => a + b, 0);
        }
        out[p.id] = Oracle.cents(total);
      }
      return { table: out, seen };
    };
    const serverTable = async (as, ids, who) => Object.fromEntries((((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g)?.table || []).map(r => [r.playerId, r.total]));
    const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
    const mine = (s, who) => Object.fromEntries(s.project('g', who).game.table.map(r => [r.playerId, r.total]));
    for (const [league, game, seed] of [['golf/pga', 'season', 42], ['golf/liv', 'bestBall', 42], ['racing/f1', 'short', 11], ['racing/nascar-premier', 'season', 42]]) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league, game, seed, timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(), all = ruleOf(snap, () => true), ann = ruleOf(snap, n => n <= (hides.length ? 1 : 2));
          const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') };
          check(league + ' ' + game + ', live, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ": the server's table is each seat's places and counts from the standings each has been told, for Ann and Bo; the runtime the same",
            !bad.length && same(server.ann, ann.table) && same(server.bo, all.table) && same(mine(s, 'ann'), ann.table) && same(mine(s, 'bo'), all.table) && (hides.length ? !same(ann.table, all.table) : true),
            bad.length ? bad.slice(0, 2) : { server, rule: { ann: ann.table, bo: all.table } });
          if (!hides.length) note(league + ' ' + game + ': held places counted ' + JSON.stringify(all.seen) + ' (tied, out of the places, past the table, a sprint place)');
        });
      } finally { s.dispose(); }
    }
    // Control: one of Bo's placed golfers moved to 21st behind the runtime (the line's places and the standing): the server's
    // table for Bo falls by exactly that place's points and the routes say it disagrees; the right rows back, clean again.
    {
      const s = R.open(proof({ league: 'golf/pga', game: 'short', timing: 'live-only', ann: 2 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const right = s.snapshot(), world = right.contexts.sport, st = right.games.g.state, spec = S.gameOf(st), ev = world.events[0];
          const f0 = world.facts.find(x => x.eventId === ev.id).data, held = st.castaways.filter(x => x.ownerIds.includes('bo')).map(x => x.id);
          const mover = f0.standings.filter(x => held.includes(x.id) && Oracle.placePoints(spec.score.byPlace.POS, x.place) > 0).sort((a, b) => a.place - b.place)[0];
          if (!mover) { check("the control has a placed golfer of Bo's to move", false, f0.standings.filter(x => held.includes(x.id))); return; }
          const worth = Oracle.placePoints(spec.score.byPlace.POS, mover.place), wrong = clone(right), f = wrong.contexts.sport.facts.find(x => x.eventId === ev.id).data;
          f.standings = f.standings.map(x => (x.id === mover.id ? { ...x, place: 21, tied: false } : x));
          const before = await serverTable(as, ids, 'bo');
          await write(wrong);
          const after = await serverTable(as, ids, 'bo'), found = await routes(right);
          check("a placed golfer of Bo's (" + mover.place + (mover.tied ? ', tied' : '') + ', worth ' + worth + ") written 21st behind the runtime: the server takes exactly the place's points off Bo and the routes disagree", Math.round((before.bo - after.bo) * 100) / 100 === worth && found.some(x => x.signature === 'standings-disagree'), { before: before.bo, after: after.bo, worth, found: found.slice(0, 2) });
          await write(right);
          check('the right standings written back: clean again', !real(await routes()).length && same(await serverTable(as, ids, 'bo'), before));
        });
      } finally { s.dispose(); }
    }
  },
  async positions() {
    // Points by position on the real routes (the fifth slice: a stat's points by the holder's position group, FPL's goal and
    // clean sheet; soccer's three games), three ways: the server (a holder's group from the season's cast, its position role),
    // the runtime (the cast's position stamped as the server stamps it) and the rule restated apart from the engine
    // (campaign/sports-oracle.cjs linePoints with the holder's group).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const ruleOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), out = {}, seen = {};
      const group = id => c.sport.position(world.participants.find(x => x.id === id).role)?.group ?? null;
      for (const p of st.players) {
        let total = 0;
        for (const e of world.events.filter(x => ['final', 'corrected'].includes(x.resultStatus) && upTo(x.number))) {
          const f = world.facts.find(x => x.eventId === e.id).data;
          const held = spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p.id) : st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => x.id);
          const pts = held.map(id => { const line = c.sport.full(f.lines[id]), g = group(id); for (const k of ['G', 'CS', 'GA2']) if (line[k]) seen[g + ' ' + k] = (seen[g + ' ' + k] || 0) + 1; return Oracle.linePoints(spec.score, line, g); });
          total += (spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts).reduce((a, b) => a + b, 0);
        }
        out[p.id] = Oracle.cents(total);
      }
      return { table: out, seen };
    };
    const serverTable = async (as, ids, who) => Object.fromEntries((((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g)?.table || []).map(r => [r.playerId, r.total]));
    const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
    const mine = (s, who) => Object.fromEntries(s.project('g', who).game.table.map(r => [r.playerId, r.total]));
    for (const [league, game] of [['soccer/eng.1', 'short'], ['soccer/usa.1', 'bestBall'], ['soccer/uefa.champions', 'season']]) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league, game, timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(), all = ruleOf(snap, () => true), ann = ruleOf(snap, n => n <= (hides.length ? 1 : 2));
          const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') };
          check(league + ' ' + game + ', live, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ": the server's table is each seat's points by its players' position groups, for Ann and Bo; the runtime the same",
            !bad.length && same(server.ann, ann.table) && same(server.bo, all.table) && same(mine(s, 'ann'), ann.table) && same(mine(s, 'bo'), all.table),
            bad.length ? bad.slice(0, 2) : { server, rule: { ann: ann.table, bo: all.table } });
          if (!hides.length) note(league + ' ' + game + ': held lines by group ' + JSON.stringify(all.seen));
        });
      } finally { s.dispose(); }
    }
    // Control: in game 1 a goal moved from one of Bo's forwards to one of his defenders behind the runtime: on the server Bo's
    // total moves by the groups' difference (6 a defender's goal, 4 a forward's) and the routes disagree; the right rows back, clean.
    {
      const s = R.open(proof({ league: 'soccer/eng.1', game: 'short', timing: 'live-only', ann: 2 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const right = s.snapshot(), world = right.contexts.sport, st = right.games.g.state, c = Sports.league(world.context), ev = world.events[0];
          const group = id => c.sport.position(world.participants.find(x => x.id === id).role)?.group;
          const seat = st.players.find(p => { const g = st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => group(x.id)); return g.includes('FWD') && g.includes('DEF'); });
          if (!seat) { check('the control has a seat with a forward and a defender', false); return; }
          const held = st.castaways.filter(x => x.ownerIds.includes(seat.id)).map(x => x.id), fwd = held.find(id => group(id) === 'FWD'), def = held.find(id => group(id) === 'DEF');
          const withGoal = (snap, who, other) => { const f = snap.contexts.sport.facts.find(x => x.eventId === ev.id).data; f.lines[who] = { ...f.lines[who], G: (f.lines[who].G || 0) + 1 }; f.lines[other] = { ...f.lines[other], G: f.lines[other].G || 0 }; return snap; };
          // (Written as a correction the runtime knows, so the two agree before the control: the forward with one more goal.)
          must(s, { type: 'results', contextId: 'sport', eventId: ev.id, source: 'provider-fixture', resultStatus: 'corrected', data: withGoal(clone(right), fwd, def).contexts.sport.facts.find(x => x.eventId === ev.id).data });
          const base = s.snapshot(); await write(base);
          const before = await serverTable(as, ids, seat.id);
          check('as corrected (a goal more for a forward of ' + seat.id + "'s), the routes are clean", !real(await routes()).length);
          const moved = clone(base), f = moved.contexts.sport.facts.find(x => x.eventId === ev.id).data;
          f.lines[fwd] = { ...f.lines[fwd], G: f.lines[fwd].G - 1 }; f.lines[def] = { ...f.lines[def], G: (f.lines[def].G || 0) + 1 };
          await write(moved);
          const after = await serverTable(as, ids, seat.id), found = await routes(base);
          check("the goal written as a defender's behind the runtime: the server moves " + seat.id + "'s total by 2 (a defender's 6, a forward's 4) and the routes disagree", Math.round((after[seat.id] - before[seat.id]) * 100) / 100 === 2 && found.some(x => x.signature === 'standings-disagree'), { before: before[seat.id], after: after[seat.id], found: found.slice(0, 2) });
          await write(base);
          check('the right rows written back: clean again', !real(await routes()).length);
        });
      } finally { s.dispose(); }
    }
  },
  async formats() {
    // Points by a match's format on the real routes (the sixth slice: a tennis day's results are its lines and its matches, the
    // materializer's sports_events.shape a card: each match's sides and best of, each one's line in it, the results), three ways:
    // the server (each match a player played scored at its format: score.ts boutsOf), the runtime and the rule restated apart
    // from the engine (campaign/sports-oracle.cjs linePoints with the matches).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const matchesOf = (data, id) => data.card.bouts.filter(b => data.card.byBout[b.id]?.[id]).map(b => ({ format: b.rounds, line: data.card.byBout[b.id][id] }));
    const ruleOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, spec = S.gameOf(st), out = {}, seen = { five: 0, three: 0, rested: 0 };
      for (const p of st.players) {
        let total = 0;
        for (const e of world.events.filter(x => ['final', 'corrected'].includes(x.resultStatus) && upTo(x.number))) {
          const f = world.facts.find(x => x.eventId === e.id).data;
          const held = spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p.id) : st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => x.id);
          const pts = held.map(id => { const m = matchesOf(f, id); if (!m.length) seen.rested++; for (const x of m) seen[x.format === 5 ? 'five' : 'three']++; return Oracle.linePoints(spec.score, f.lines[id], null, m); });
          total += (spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts).reduce((a, b) => a + b, 0);
        }
        out[p.id] = Oracle.cents(total);
      }
      return { table: out, seen };
    };
    const serverTable = async (as, ids, who) => Object.fromEntries((((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g)?.table || []).map(r => [r.playerId, r.total]));
    const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
    const mine = (s, who) => Object.fromEntries(s.project('g', who).game.table.map(r => [r.playerId, r.total]));
    for (const [league, game, seed] of [['tennis/atp', 'short', 2], ['tennis/atp', 'season', 2], ['tennis/wta', 'short', 42]]) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league, game, seed, timing: 'live-only', hides, closes: 'start' }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(), all = ruleOf(snap, () => true), ann = ruleOf(snap, n => n <= (hides.length ? 1 : 2));
          const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') };
          check(league + ' ' + game + ', live, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ": the server's table is each seat's matches, each at its format, for Ann and Bo; the runtime the same",
            !bad.length && same(server.ann, ann.table) && same(server.bo, all.table) && same(mine(s, 'ann'), ann.table) && same(mine(s, 'bo'), all.table),
            bad.length ? bad.slice(0, 2) : { server, rule: { ann: ann.table, bo: all.table } });
          if (!hides.length) note(league + ' ' + game + ': held matches ' + JSON.stringify(all.seen) + ' (best of five, best of three, a player who rested)');
        });
      } finally { s.dispose(); }
    }
    // Control: a best of five a player of Bo's played, written behind the runtime as a best of three: the server moves Bo by
    // exactly the formats' difference for that line, and the routes disagree; the right rows back, clean.
    {
      const s = R.open(proof({ league: 'tennis/atp', game: 'short', seed: 2, timing: 'live-only', ann: 2, closes: 'start' }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const right = s.snapshot(), world = right.contexts.sport, st = right.games.g.state, spec = S.gameOf(st), held = st.castaways.filter(x => x.ownerIds.includes('bo')).map(x => x.id);
          const ev = world.events.find(e => { const f = world.facts.find(x => x.eventId === e.id)?.data; return f && f.card.bouts.some(b => b.rounds === 5 && held.some(id => f.card.byBout[b.id]?.[id])); });
          if (!ev) { check("the control has a best of five a player of Bo's played", false); return; }
          const f0 = world.facts.find(x => x.eventId === ev.id).data, b = f0.card.bouts.find(x => x.rounds === 5 && held.some(id => f0.card.byBout[x.id]?.[id])), who = held.find(id => f0.card.byBout[b.id]?.[id]);
          const atFive = Oracle.linePoints(spec.score, f0.lines[who], null, matchesOf(f0, who)), atThree = Oracle.linePoints(spec.score, f0.lines[who], null, matchesOf(f0, who).map(x => (x.line === f0.card.byBout[b.id][who] ? { ...x, format: 3 } : x)));
          const wrong = clone(right), f = wrong.contexts.sport.facts.find(x => x.eventId === ev.id).data;
          f.card.bouts = f.card.bouts.map(x => (x.id === b.id ? { ...x, rounds: 3 } : x));
          const before = await serverTable(as, ids, 'bo');
          await write(wrong);
          const after = await serverTable(as, ids, 'bo'), found = await routes(right), moved = Math.round((after.bo - before.bo) * 100) / 100, want = Math.round((atThree - atFive) * 100) / 100;
          check("a best of five of Bo's player written as a best of three behind the runtime: the server moves Bo by the formats' difference (" + want + ') and the routes disagree', want !== 0 && moved === want && found.some(x => x.signature === 'standings-disagree'), { before: before.bo, after: after.bo, want, found: found.slice(0, 2) });
          await write(right);
          check('the right rows written back: clean again', !real(await routes()).length);
        });
      } finally { s.dispose(); }
    }
  },
  async slates() {
    // A slate, a week of several games, on the real routes (the seventh slice: context.slate; the materializer writes the season's
    // sports_slates row, each athlete's team as the cast's tribe_name, and each week's games, each a linked game at its own start
    // with its two teams and its own kept final). Three ways: the server, the runtime and the rule restated apart from the engine
    // (a week's points are its games' points, each game's line with its derived stats worked out: campaign/sports-oracle.cjs).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const weekOf = (snap, playerId, e, heldIn) => {
      const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), data = world.facts.find(f => f.eventId === e.id).data, by = {};
      const group = id => c.sport.position(world.participants.find(x => x.id === id).role)?.group ?? null;
      for (const g of Sports.gamesOf(world.context, e)) for (const id of heldIn(g)) if (data.games[g.id][id]) by[id] = Oracle.cents((by[id] || 0) + Oracle.linePoints(spec.score, c.sport.full(data.games[g.id][id]), group(id)));
      const pts = Object.values(by);
      return Oracle.cents((spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts).reduce((a, b) => a + b, 0));
    };
    const ruleOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, spec = S.gameOf(st);
      return Object.fromEntries(st.players.map(p => { const team = st.castaways.filter(x => x.ownerIds.includes(p.id)).map(x => x.id); return [p.id, Oracle.cents(world.events.filter(e => ['final', 'corrected'].includes(e.resultStatus) && upTo(e.number)).reduce((n, e) => n + weekOf(snap, p.id, e, () => (spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p.id) : team)), 0))]; }));
    };
    const serverTable = async (as, ids, who) => Object.fromEntries((((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g)?.table || []).map(r => [r.playerId, r.total]));
    const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
    const mine = (s, who) => Object.fromEntries(s.project('g', who).game.table.map(r => [r.playerId, r.total]));
    // Every slate game with points (a lineup, a team of three, best ball), the NBA's and the NFL's; Ann a game behind, with and
    // without "Sports scores too" (the routes' own checks: tables, grids, privacy).
    for (const [league, game] of [['basketball/nba', 'season'], ['basketball/nba', 'short'], ['football/nfl', 'bestBall']]) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league, game, slate: 3, timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), snap = s.snapshot(), all = ruleOf(snap, () => true), ann = ruleOf(snap, n => n <= (hides.length ? 1 : 2));
          const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') };
          const rec = r => (r && r.length ? r : null);
          // (Head to head's table is records; its points are the weeks', which the routes' own checks compare.)
          const pointsGame = !S.gameOf(snap.games.g.state).rank || S.gameOf(snap.games.g.state).rank.by === 'total';
          check(league + ' ' + game + ' on a slate of three games a week, live, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ": the routes agree with the runtime" + (pointsGame ? "; the server's table is each seat's games' points, for Ann and Bo" : ''),
            !bad.length && (!pointsGame || (same(server.ann, ann) && same(server.bo, all) && same(mine(s, 'ann'), ann) && same(mine(s, 'bo'), all))),
            bad.length ? bad.slice(0, 2) : { server, rule: { ann, bo: all }, rec: rec() });
        });
      } finally { s.dispose(); }
    }
    // A lock at each game's start (closes 'game'), on the real lineup route, through a week: two games on its first day, one the
    // next. Ann holds E (in the first game), L (in the next day's) and X. Each step the runtime's clock moves and the case is
    // written again (the server's now is the scenario's).
    {
      const spec = { ...Bench.resolve('basketball/nba', 'short').row.spec, get: { by: 'draft', each: 4, order: 'snake', own: 'exclusive' }, count: { start: 2 }, closes: 'game' };
      const s = R.open(proof({ league: 'basketball/nba', game: spec, slate: 3, completed: 1, events: 3, timing: 'live-only', ann: 1, bo: 1, cy: 1 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const snap0 = s.snapshot(), world = snap0.contexts.sport, week = world.events[1], [g1, , g3] = Sports.gamesOf(world.context, week);
          const teamOf = id => world.participants.find(p => p.id === id).team, held = snap0.games.g.state.castaways.filter(x => x.ownerIds.includes('ann')).map(x => x.id);
          const E = held.find(id => g1.teams.includes(teamOf(id))), L = held.find(id => g3.teams.includes(teamOf(id))), X = held.find(id => id !== E && id !== L);
          if (!(E && L && X)) { check("Ann holds someone in the week's first game, someone in the next day's and another", false, { E, L, X }); return; }
          const route = ids_ => as('ann', 'PUT', '/api/leagues/' + ids.leagues.g + '/episodes/' + encodeURIComponent(week.id) + '/lineups/ann', { castawayIds: ids_ });
          const both = async (ids_, want) => { const sent = await route(ids_), applied = s.apply({ type: 'lineup', gameId: 'g', personId: 'ann', eventId: week.id, ids: ids_ }); return { ok: want ? sent.status === 200 && applied.status === 'accepted' : sent.status >= 400 && sent.status < 500 && applied.status === 'rejected', sent: sent.status, said: sent.json?.error, applied: applied.status, why: applied.message }; };
          const at = async ms => { must(s, { type: 'clock', at: new Date(ms).toISOString() }); await write(); };
          const before = [E, X], after = [L, X];
          let r = await both(before, true);
          check('before the week, a lineup is taken by both', r.ok, r);
          await at(Date.parse(g1.airAt) + 3600000);
          r = await both(after, false);
          check("an hour into the first game, benching a holding whose game began today is refused by both", r.ok, r);
          await at(Date.parse(g3.airAt) - 3 * 3600000);
          r = await both(after, true);
          check("the next morning (that day over, the next game to come) the change is taken by both", r.ok, r);
          await at(Date.parse(g3.airAt) + 3600000);
          r = await both(before, false);
          check('after the week\'s last game began, a change is refused by both', r.ok, r);
          let k = 0;
          must(s, { type: 'results', contextId: 'sport', eventId: week.id, source: 'provider-fixture', resultStatus: 'final', data: Sports.resultsFor(world.context, world.participants, () => (k = (k * 7919 + 104729) % 1000003), week) });
          await write();
          const snap = s.snapshot(), inForce = g => (g.id === g3.id ? after : before);
          const want = Oracle.cents(weekOf(snap, 'ann', world.events[0], () => S.ActiveRosterLogic.lineupFor(snap.games.g.state, world.events[0].id, 'ann')) + weekOf(snap, 'ann', week, inForce));
          const oneLineup = Oracle.cents(weekOf(snap, 'ann', world.events[0], () => S.ActiveRosterLogic.lineupFor(snap.games.g.state, world.events[0].id, 'ann')) + weekOf(snap, 'ann', week, () => after));
          const server = await serverTable(as, ids, 'ann'), bad = real(await routes());
          check("the week played: the server's total for Ann counts each game's lineup at its start (" + want + ', not the last lineup\'s ' + oneLineup + '), as the runtime does; the routes agree', !bad.length && server.ann === want && mine(s, 'ann').ann === want && want !== oneLineup, bad.length ? bad.slice(0, 2) : { server: server.ann, runtime: mine(s, 'ann').ann, want, oneLineup });
        });
      } finally { s.dispose(); }
    }
    // Control: one game's box score wrong behind the runtime: the server's table moves off for whoever held a player in it.
    {
      const s = R.open(proof({ league: 'basketball/nba', game: 'short', slate: 3, timing: 'live-only', ann: 2 }));
      try {
        await withRows(s, async ({ write, routes }) => {
          const right = s.snapshot(), wrong = clone(right), f = wrong.contexts.sport.facts.find(x => x.eventId === right.contexts.sport.events[0].id).data, gid = Object.keys(f.games)[1];
          for (const id of Object.keys(f.games[gid])) f.games[gid][id] = Object.fromEntries(Object.entries(f.games[gid][id]).map(([k, v]) => [k, v * 3 + 1]));
          await write(wrong);
          check("a slate's second game with a wrong box score behind the runtime: the server's tables disagree", (await routes(right)).some(x => x.signature === 'standings-disagree'));
          await write(right);
          check('the right box scores written back: clean again', !real(await routes()).length);
        });
      } finally { s.dispose(); }
    }
  },
  async calledoff() {
    // A week in progress and a game called off (the last sports slice, core-runtime-40: the materializer writes each game final so far
    // with its box score, and a game called off as its row over without a final, state 'post' with its `called`). Three ways each
    // time: the server, the runtime and the rule restated apart from the engine (campaign/sports-oracle.cjs: a week counts once every
    // game in it is final or called off, and then only its games final; a game called off scores nothing and locks nothing).
    const Oracle = require(path.join(root, 'tools/gameplay-bench/campaign/sports-oracle.cjs'));
    const serverGames = async (as, ids, who) => (((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || []).find(g => g.leagueId === ids.leagues.g)) || null;
    const serverTable = async (as, ids, who) => Object.fromEntries(((await serverGames(as, ids, who))?.table || []).map(r => [r.playerId, r.total]));
    const same = (x, y) => JSON.stringify(Object.entries(x).sort()) === JSON.stringify(Object.entries(y).sort());
    const mine = (s, who) => Object.fromEntries(s.project('g', who).game.table.map(r => [r.playerId, r.total]));
    /** Each seat's points told through `upTo`, from the box scores: a week only once every game is final or called off, its games final. */
    const ruleOf = (snap, upTo) => {
      const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st);
      const group = id => c.sport.position(world.participants.find(x => x.id === id).role)?.group ?? null;
      const weekOf = (playerId, e) => {
        if (Sports.isOff(e)) return 0;
        const data = world.facts.find(f => f.eventId === e.id)?.data, held = spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, playerId) : st.castaways.filter(x => x.ownerIds.includes(playerId)).map(x => x.id);
        if (!data) return 0;
        if (!data.games) return Oracle.cents(held.reduce((n, id) => n + Oracle.linePoints(spec.score, c.sport.full(data.lines[id] || {}), group(id)), 0));
        const ids = Sports.gamesOf(world.context, e).map(g => g.id), counted = Oracle.counted(ids, Object.keys(data.games), Object.keys(Sports.offOf(e)));
        return Oracle.cents(counted.reduce((n, gid) => n + held.reduce((m, id) => m + (data.games[gid][id] ? Oracle.linePoints(spec.score, c.sport.full(data.games[gid][id]), group(id)) : 0), 0), 0));
      };
      return Object.fromEntries(st.players.map(p => [p.id, Oracle.cents(world.events.filter(e => e.number <= upTo).reduce((n, e) => n + weekOf(p.id, e), 0))]));
    };
    const data = (s, e) => { let k = 0; const w = s.snapshot().contexts.sport; return Sports.resultsFor(w.context, w.participants, () => (k = (k * 7919 + 104729) % 1000003), e); };
    const at = async (s, write, ms) => { must(s, { type: 'clock', at: new Date(ms).toISOString() }); await write(); };
    const said = async (as, ids, who) => /postpon|cancel|called off/i.test(JSON.stringify((await as(who, 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json || {}));
    // 1. A slate (the NBA's team of three, three games a week), live, Ann a game behind with and without "Sports scores too": week 3
    // in progress (its first game final, then its second), then its third postponed, which puts the week in.
    for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league: 'basketball/nba', game: 'short', slate: 3, completed: 2, events: 4, timing: 'live-only', hides, ann: 1, bo: 2, cy: 2 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const told = hides.length ? 1 : Infinity, world = s.snapshot().contexts.sport, week = world.events[2], [g1, g2, g3] = Sports.gamesOf(world.context, week), full = data(s, week);
          const compare = async (label, extra = true) => {
            const snap = s.snapshot(), bad = real(await routes()), want = { ann: ruleOf(snap, told), bo: ruleOf(snap, Infinity) };
            const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') };
            check((hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ', ' + label + ': the routes agree with the runtime, and the server\'s table is the rule\'s for Ann and Bo', !bad.length && extra && same(server.ann, want.ann) && same(server.bo, want.bo) && same(mine(s, 'ann'), want.ann) && same(mine(s, 'bo'), want.bo), bad.length ? bad.slice(0, 2) : { server, rule: want });
            return want;
          };
          const before = await compare('weeks 1 and 2 in');
          await at(s, write, Date.parse(g1.airAt) + 3600000);
          must(s, { type: 'results', contextId: 'sport', eventId: week.id, source: 'provider-fixture', resultStatus: 'partial', data: { ...full, games: { [g1.id]: full.games[g1.id] } } });
          await write();
          let now = await compare("week 3 in progress (its first game final): nothing of it counts yet", true);
          check('week 3 in progress changes nobody\'s total (the rule)', same(now.bo, before.bo));
          await at(s, write, Date.parse(g2.airAt) + 3600000);
          must(s, { type: 'results', contextId: 'sport', eventId: week.id, source: 'provider-fixture', resultStatus: 'partial', data: { ...full, games: { [g1.id]: full.games[g1.id], [g2.id]: full.games[g2.id] } } });
          await write();
          await compare('week 3 with two games final and one to play: still nothing of it');
          must(s, { type: 'calledOff', contextId: 'sport', eventId: week.id, game: g3.id, called: 'postponed' });
          await write();
          now = await compare("week 3's last game postponed: the week is in, its two games played counted");
          check("the postponement put week 3 in for whoever is told it (Bo's table moved by its two games)", !same(now.bo, before.bo) && (hides.length ? same(now.ann, before.ann) : true), { before, now });
          if (!hides.length && !(await said(as, ids, 'bo'))) note('nothing the season\'s games route answers says a game was postponed (Designs needed)');
          // Control: the postponed game written as still to play behind the runtime: the server leaves the week out, so its tables
          // disagree with the runtime's (which has the week in); written back, clean.
          const right = s.snapshot(), wrong = clone(right);
          delete wrong.contexts.sport.events[2].calledOff;
          await write(wrong);
          check("control: the postponed game written as still to play behind the runtime, the server leaves week 3 out and its tables disagree", (await routes(right)).some(x => x.signature === 'standings-disagree'));
          await write(right);
          check('control: the right rows written back, clean again', !real(await routes()).length);
        });
      } finally { s.dispose(); }
    }
    // 2. An episode of one game cancelled (the NFL's team of three, and its head-to-head season), live, Ann a game behind with and
    // without "Sports scores too": its results are in with nothing in them; the next game is the one to play.
    for (const game of ['short', 'season']) for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league: 'football/nfl', game, completed: 2, events: 5, timing: 'live-only', hides, ann: 1, bo: 2, cy: 2 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const told = hides.length ? 1 : Infinity, before = ruleOf(s.snapshot(), Infinity), ev = s.snapshot().contexts.sport.events[2];
          must(s, { type: 'calledOff', contextId: 'sport', eventId: ev.id, called: 'cancelled' });
          await write();
          const snap = s.snapshot(), bad = real(await routes()), points = !S.gameOf(snap.games.g.state).rank || S.gameOf(snap.games.g.state).rank.by === 'total';
          const server = { ann: await serverTable(as, ids, 'ann'), bo: await serverTable(as, ids, 'bo') }, want = { ann: ruleOf(snap, told), bo: ruleOf(snap, Infinity) };
          const view = await serverGames(as, ids, 'bo'), lineup = s.project('g', 'bo').game.lineup;
          check('football/nfl ' + game + ', game 3 cancelled, ' + (hides.length ? 'Ann with "Sports scores too" on' : 'nobody hiding scores') + ': the routes agree with the runtime; nobody scores for it' + (points ? " (the server's table is the rule's, unchanged)" : ' (each record, last result and next opponent the same on both)') + '; the lineup offered is game 4\'s on both',
            !bad.length && (!points || (same(server.ann, want.ann) && same(server.bo, want.bo) && same(want.bo, before))) && (!lineup || (lineup.episode === 4 && view?.lineup?.episode === 4)),
            bad.length ? bad.slice(0, 2) : { server, rule: want, lineup: lineup && lineup.episode, serverLineup: view?.lineup?.episode });
          if (game === 'season' && !hides.length) {
            const last = s.project('g', 'bo').game.matchups?.last;
            check("head to head: Bo's last matchup on the runtime is game 3, a night nobody scored that counts for nobody (the routes compare the server's)", last && last.episode === 3 && last.result === null, last);
          }
          if (game === 'short' && !hides.length && !(await said(as, ids, 'bo'))) note('nothing the season\'s games route answers says game 3 was cancelled (Designs needed)');
        });
      } finally { s.dispose(); }
    }
    // 3. A day's lock opened by a call-off (the NBA's rule, a lineup of two from four), live. Game 2 began earlier today (Eastern) and
    // game 3 starts later today: game 3's lineup is locked by its day's first game. Game 2 postponed, it locks nothing: game 3's
    // lineup is open for the server, the runtime and the rule (Oracle.firstPlayed over the day's games played), and the real
    // lineup route takes one it refused before.
    {
      const etDate = ms => Oracle.easternDay(ms), HOUR = 3600000, MIN = 60000;
      const edges = now => { let lo = now, hi = now; const k = etDate(now); while (etDate(lo - HOUR) === k) lo -= HOUR; while (etDate(lo - MIN) === k) lo -= MIN; while (etDate(hi + HOUR) === k) hi += HOUR; while (etDate(hi + MIN) === k) hi += MIN; return { since: now - lo, until: hi + MIN - now }; };
      const { since, until } = edges(Date.now());
      if (since < 20 * MIN || until < 20 * MIN) note('a day\'s lock: now is within twenty minutes of the Eastern day turning over; run --case=calledoff again in half an hour');
      else {
        const nba = Bench.resolve('basketball/nba', 'short').row.spec, spec = { ...nba, get: { ...nba.get, each: 4 }, count: { start: 2 } };
        const CLOCK = '2099-01-10T12:00:00.000Z', t = ms => new Date(Date.parse(CLOCK) + ms).toISOString(), began = Math.min(since / 2, 3 * HOUR), ahead = Math.min(until / 2, 3 * HOUR);
        const schedule = [t(-3 * 24 * HOUR), t(-began), t(ahead), t(ahead + 2 * 24 * HOUR)];
        const s = R.open(proof({ league: 'basketball/nba', game: spec, closes: 'daily', schedule, completed: 1, clock: CLOCK, timing: 'live-only', ann: 1, bo: 1, cy: 1 }));
        try {
          await withRows(s, async ({ ids, as, write, routes }) => {
            const ev3 = s.snapshot().contexts.sport.events[2], shift = Date.now() - Date.parse(CLOCK);
            const ruleLocked = off => { const today = schedule.map((x, i) => ({ id: 'e' + (i + 1), at: new Date(Date.parse(x) + shift).toISOString() })).filter(g => etDate(Date.parse(g.at)) === etDate(Date.parse(schedule[2]) + shift)); const first = Oracle.firstPlayed(today, off); return first !== null && first <= Date.now(); };
            const both = async () => { const roster = s.project('g', 'bo').game.lineup?.roster || S.ActiveRosterLogic.lineupFor(s.snapshot().games.g.state, ev3.id, 'bo'); const ids_ = s.snapshot().games.g.state.castaways.filter(x => x.ownerIds.includes('bo')).map(x => x.id).slice(1, 3); const sent = await as('bo', 'PUT', '/api/leagues/' + ids.leagues.g + '/episodes/' + encodeURIComponent(ev3.id) + '/lineups/bo', { castawayIds: ids_ }), applied = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: ev3.id, ids: ids_ }); return { route: sent.status, said: sent.json?.error, applied: applied.status, roster: !!roster }; };
            let r = await both();
            check("daily: game 2 began earlier today, so game 3's lineup is locked by its day for the rule, and refused by the route and the runtime", ruleLocked([]) && r.route >= 400 && r.route < 500 && r.applied === 'rejected' && /day's lineups are locked/.test(r.said || ''), r);
            must(s, { type: 'calledOff', contextId: 'sport', eventId: s.snapshot().contexts.sport.events[1].id, called: 'postponed' });
            await write();
            const view = await serverGames(as, ids, 'bo'), mine3 = s.project('g', 'bo').game.lineup;
            r = await both();
            check("daily: game 2 postponed locks nothing, so game 3's lineup is open for the rule, the server's view and the runtime's, and the route takes one", !ruleLocked(['e2']) && view?.lineup?.episode === 3 && !view.lineup.locked && mine3?.episode === 3 && !mine3.locked && r.route === 200 && r.applied === 'accepted' && !real(await routes()).length, { rule: ruleLocked(['e2']), server: view?.lineup && [view.lineup.episode, view.lineup.locked], runtime: mine3 && [mine3.episode, mine3.locked], ...r });
          });
        } finally { s.dispose(); }
      }
    }
    // 4. A lock at each game's start on a slate (the NBA, two of four, three games a week), live: the week's second game postponed
    // before it starts. An hour past its start, Ann's holding in it is free to move (its game locks nothing) while her holding in the
    // first game, which began that day, stays locked; the week locks at its last game played.
    {
      const nba = Bench.resolve('basketball/nba', 'short').row.spec, spec = { ...nba, get: { by: 'draft', each: 4, order: 'snake', own: 'exclusive' }, count: { start: 2 }, closes: 'game' };
      const s = R.open(proof({ league: 'basketball/nba', game: spec, slate: 3, completed: 1, events: 3, timing: 'live-only', ann: 1, bo: 1, cy: 1 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2, g3] = Sports.gamesOf(world.context, week);
          // The Eastern day's edge (part 3's guard, BACKLOG's "calledoff part 4"): E stays locked only while an hour past the second
          // game's start is still the first game's Eastern day (a holding's lock lasts to the end of its game's day, by design).
          if (Oracle.easternDay(Date.parse(g1.airAt)) !== Oracle.easternDay(Date.parse(g2.airAt) + 3600000)) {
            note("a lock at each game: the week's first game and an hour past its second fall on different Eastern days now; run --case=calledoff again in a few hours");
            return;
          }
          const teamOf = id => world.participants.find(p => p.id === id).team, held = s.snapshot().games.g.state.castaways.filter(x => x.ownerIds.includes('ann')).map(x => x.id);
          const E = held.find(id => g1.teams.includes(teamOf(id))), M = held.find(id => g2.teams.includes(teamOf(id))), X = held.find(id => id !== E && id !== M && !g1.teams.includes(teamOf(id)));
          if (!(E && M && X)) { check("Ann holds someone in the week's first game, someone in its second and another outside the first", false, { E, M, X }); return; }
          const both = async (ids_, want) => { const sent = await as('ann', 'PUT', '/api/leagues/' + ids.leagues.g + '/episodes/' + encodeURIComponent(week.id) + '/lineups/ann', { castawayIds: ids_ }), applied = s.apply({ type: 'lineup', gameId: 'g', personId: 'ann', eventId: week.id, ids: ids_ }); return { ok: want ? sent.status === 200 && applied.status === 'accepted' : sent.status >= 400 && sent.status < 500 && applied.status === 'rejected', route: sent.status, said: sent.json?.error, applied: applied.status, message: applied.message }; };
          let r = await both([E, M], true);
          check('before the week, a lineup is taken by both', r.ok, r);
          must(s, { type: 'calledOff', contextId: 'sport', eventId: week.id, game: g2.id, called: 'postponed' });
          await write();
          await at(s, write, Date.parse(g2.airAt) + 3600000);
          const off = [g2.id], now = Date.parse(g2.airAt) + 3600000, gamesOf = id => Sports.gamesOf(world.context, week).filter(g => g.teams.includes(teamOf(id))).map(g => ({ id: g.id, at: g.airAt }));
          check('the rule: an hour past the postponed game\'s start, E (first game) is locked and M (postponed game) is free', Oracle.holdingLocked(gamesOf(E), off, now) && !Oracle.holdingLocked(gamesOf(M), off, now));
          r = await both([E, X], true);
          check("an hour past the postponed second game's start, benching M (its game called off) is taken by both", r.ok, r);
          r = await both([X, M], false);
          check('benching E (the first game began today) is still refused by both', r.ok, r);
          await at(s, write, Date.parse(g3.airAt) + 3600000);
          r = await both([E, M], false);
          check("after the week's last game played began, a change is refused by both", r.ok, r);
          const full = data(s, week);
          must(s, { type: 'results', contextId: 'sport', eventId: week.id, source: 'provider-fixture', resultStatus: 'final', data: { ...full, games: { [g1.id]: full.games[g1.id], [g3.id]: full.games[g3.id] } } });
          await write();
          const server = await serverTable(as, ids, 'ann'), bad = real(await routes());
          check("the week played without its postponed game: the server's tables are the runtime's; the routes agree", !bad.length && same(server, mine(s, 'ann')), bad.length ? bad.slice(0, 2) : { server, runtime: mine(s, 'ann') });
        });
      } finally { s.dispose(); }
    }
    // 5. A slate's week whose first game is postponed, locking by the day (the NBA's rule). The server stamps the week's lock at its
    // first game played (air-times.ts sportLocks, PLAYED), while the week's own air time is its first game's start, postponed or not
    // (slate.ts sets season_episodes.air_at to the min of its linked games' starts; the materializer writes the same). BACKLOG 81
    // (fixed 2026-11-14): the stamped lock is the lock (closedForPlay), so an hour past the postponed game's start, before any game
    // has begun, the week's lineup is open (the rule, Oracle.firstPlayed), and it locks when its second game starts.
    {
      const nba = Bench.resolve('basketball/nba', 'short').row.spec, two = { ...nba, get: { by: 'draft', each: 4, order: 'snake', own: 'exclusive' }, count: { start: 2 } };
      const s = R.open(proof({ league: 'basketball/nba', game: two, closes: 'daily', slate: 3, completed: 1, events: 3, timing: 'live-only', ann: 1, bo: 1, cy: 1 }));
      try {
        await withRows(s, async ({ ids, as, write, routes }) => {
          const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2] = Sports.gamesOf(world.context, week);
          must(s, { type: 'calledOff', contextId: 'sport', eventId: week.id, game: g1.id, called: 'postponed' });
          await at(s, write, Date.parse(g1.airAt) + 3600000);
          const view = await serverGames(as, ids, 'bo'), runtime = s.project('g', 'bo').game.lineup, rule = Oracle.firstPlayed(Sports.gamesOf(world.context, week).map(g => ({ id: g.id, at: g.airAt })), [g1.id]) <= Date.parse(g1.airAt) + 3600000;
          check("a slate week's first game postponed: an hour past it, before its second game, the week's lineup is open for the rule, the server and the runtime (BACKLOG 81); the routes agree",
            !rule && view?.lineup?.episode === 2 && !view.lineup.locked && runtime?.episode === 2 && !runtime.locked && !real(await routes()).length, { server: view?.lineup && [view.lineup.episode, view.lineup.locked], runtime: runtime && [runtime.episode, runtime.locked], rule: rule ? 'locked' : 'open' });
          // A lineup for the week, sent to the real route and applied in the runtime: taken while it's open, refused once it locks.
          const send = async () => { const mine = s.snapshot().games.g.state.castaways.filter(x => x.ownerIds.includes('bo')).map(x => x.id).slice(0, 2), sent = await as('bo', 'PUT', '/api/leagues/' + ids.leagues.g + '/episodes/' + encodeURIComponent(week.id) + '/lineups/bo', { castawayIds: mine }), applied = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: week.id, ids: mine }); return { route: sent.status, said: sent.json?.error, applied: applied.status, message: applied.message }; };
          let r = await send();
          check("while it's open, a lineup for the week is taken by the route and the runtime", r.route === 200 && r.applied === 'accepted', r);
          await write();
          await at(s, write, Date.parse(g2.airAt) + 60000);
          r = await send();
          const view2 = await serverGames(as, ids, 'bo'), runtime2 = s.project('g', 'bo').game.lineup;
          check("a minute past its second game's start (its first played), the week is locked: a lineup for it is refused by both, and the lineup each offers is the same; the routes agree",
            r.route >= 400 && r.route < 500 && r.applied === 'rejected' && (view2?.lineup?.episode ?? null) === (runtime2?.episode ?? null) && !real(await routes()).length, { ...r, server: view2?.lineup && [view2.lineup.episode, view2.lineup.locked], runtime: runtime2 && [runtime2.episode, runtime2.locked] });
        });
      } finally { s.dispose(); }
    }
  },
  async live() {
    for (const hides of [[], ['ann']]) {
      const s = R.open(proof({ league: 'basketball/nba', game: 'short', timing: 'live-only', hides }));
      try {
        await withRows(s, async ({ ids, as, routes }) => {
          const bad = real(await routes()), ann = table(s, 'ann'), bo = table(s, 'bo');
          const games = (await as('ann', 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json || {}, server = (games.games?.[0]?.table || []).map(x => [x.playerId, x.total]);
          if (hides.length) check('a live game, Ann a game behind with "Sports scores too" on: the server stops at her mark, as the runtime does, and nothing of game 2 reaches her', !bad.length && games.seenThrough === 1 && JSON.stringify(server) === JSON.stringify(ann) && JSON.stringify(ann) !== JSON.stringify(bo), bad.length ? bad.slice(0, 3) : { seenThrough: games.seenThrough, server, ann, bo });
          else check('a live game, Ann a game behind, nobody hiding scores: the server tells her everything straight away (sports are live), as the runtime does', !bad.length && games.seenThrough === null && JSON.stringify(server) === JSON.stringify(bo) && JSON.stringify(ann) === JSON.stringify(bo), bad.length ? bad.slice(0, 3) : { seenThrough: games.seenThrough, server, ann, bo });
        });
      } finally { s.dispose(); }
    }
  },
  async sweep() {
    // Every GET route under a season and a league (found from the route files), as each person on a live game: Ann told
    // everything (the default on a sport's season: the server's "everything" is an infinity, which a query can't take as an
    // episode number), Bo with "Sports scores too" on. Parameters are filled with this case's ids; a refusal (4xx) is an answer.
    const fs = require('fs'), dirs = [['src/app/api/seasons/[seasonId]', '/api/seasons/[seasonId]'], ['src/app/api/leagues/[leagueId]', '/api/leagues/[leagueId]']];
    const walk = (dir, base) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name), base + '/' + d.name) : d.name === 'route.ts' && /export const GET/.test(fs.readFileSync(path.join(dir, d.name), 'utf8')) ? [base] : []);
    const routes = [...dirs.flatMap(([dir, base]) => walk(path.join(root, dir), base)), '/api/me/home'];
    // Known (BACKLOG 73): a classic route nothing links to, failing for every league, a show's too.
    const KNOWN = new Set(['/api/leagues/[leagueId]/ruleset/shared']);
    const s = R.open(proof({ league: 'football/nfl', game: 'short', timing: 'live-only', hides: ['bo'] }));
    try {
      await withRows(s, async ({ ids, as }) => {
        const season = ids.seasons.sport.id, league = ids.leagues.g;
        const fill = r => r.replace('[seasonId]', season).replace('[leagueId]', league).replace(/\[\[?\.\.\.[a-zA-Z]+\]\]?/, '').replace(/\[[a-zA-Z]+\]/g, '1');
        for (const who of ['ann', 'bo']) {
          const broken = [], known = [];
          for (const r of routes) { const x = await as(who, 'GET', fill(r) + '?couch=' + ids.couchId + '&league=' + league + '&name=Avery%20Alvarez'); if (x.status >= 500) (KNOWN.has(r) ? known : broken).push(r + ' ' + x.status); }
          check((who === 'ann' ? 'Ann, told everything' : 'Bo, with "Sports scores too" on') + ': none of the ' + routes.length + ' season and league read routes answers with a server error', !broken.length, broken);
          if (known.length && who === 'ann') note('still failing, known (BACKLOG 73): ' + known.join(', '));
        }
      });
    } finally { s.dispose(); }
  },
  async control() {
    const s = R.open(proof({ league: 'football/nfl', game: 'short' }));
    try {
      await withRows(s, async ({ write, routes }) => {
        const right = s.snapshot(), world = right.contexts.sport, st = right.games.g.state;
        const owned = st.castaways.find(x => x.ownerIds.includes('bo')).id;
        /** The same case with one of Bo's players' box score for game `n` tripled. */
        const wrong = n => { const snap = clone(right), f = snap.contexts.sport.facts.find(x => x.eventId === world.events[n - 1].id); f.data.lines[owned] = Object.fromEntries(Object.entries(f.data.lines[owned]).map(([k, v]) => [k, v * 3 + 1])); return snap; };
        const who = (list, sig) => [...new Set(list.filter(x => x.signature === sig).map(x => x.person))].sort();
        check('as written, the routes are clean', !real(await routes()).length);
        await write(wrong(1));
        const one = await routes(right);
        check('game 1 (everyone has watched it) with a wrong box score: every person\'s table and grid disagree', ['standings-disagree', 'grid-disagree'].every(sig => who(one, sig).join() === 'ann,bo,cy'), { tables: who(one, 'standings-disagree'), grids: who(one, 'grid-disagree') });
        await write(wrong(2));
        const two = await routes(right);
        check('game 2 (Ann hasn\'t watched it) with a wrong box score: Bo\'s and Cy\'s disagree, Ann\'s doesn\'t', who(two, 'standings-disagree').join() === 'bo,cy' && who(two, 'grid-disagree').join() === 'bo,cy', { tables: who(two, 'standings-disagree'), grids: who(two, 'grid-disagree') });
        await write(right);
        check('the right box scores written back: clean again', !real(await routes()).length);
      });
    } finally { s.dispose(); }
  },
  async correction() {
    const s = R.open(proof({ league: 'basketball/nba', game: 'short' }));
    try {
      await withRows(s, async ({ write, routes }) => {
        const world = s.snapshot().contexts.sport, before = { ann: table(s, 'ann'), bo: table(s, 'bo') };
        check('before the correction, the routes are clean', !real(await routes()).length);
        must(s, { type: 'results', contextId: 'sport', eventId: world.events[0].id, source: 'provider-fixture', resultStatus: 'corrected', data: { events: [], scoringEvents: [], lines: Sports.linesFor(world.context, world.participants, i => i * 7 + 3) } });
        const after = { ann: table(s, 'ann'), bo: table(s, 'bo') };
        check('game 1\'s corrected box score moves the runtime\'s tables (Ann has watched it too)', JSON.stringify(after.ann) !== JSON.stringify(before.ann) && JSON.stringify(after.bo) !== JSON.stringify(before.bo), { before, after });
        const stale = real(await routes());
        check('until the correction is written the server still has the old box score (the routes disagree)', stale.some(x => x.signature === 'standings-disagree'), stale.slice(0, 2));
        await write();
        const found = real(await routes());
        check('written: the server\'s tables and grids follow the correction for everyone', !found.length, found.slice(0, 3));
      });
    } finally { s.dispose(); }
  },
  async lineup() {
    const base = Bench.resolve('football/nfl', 'short').row.spec, spec = { ...base, get: { ...base.get, each: 4 }, count: { start: 2 } };
    const s = R.open(proof({ league: 'football/nfl', game: spec, timing: 'live-only', ann: 2 }));
    try {
      await withRows(s, async ({ ids, as, write, routes }) => {
        const league = ids.leagues.g, l = s.project('g', 'bo').game.lineup, world = s.snapshot().contexts.sport, next = world.events.find(e => e.id === l.epId);
        const put = castawayIds => as('bo', 'PUT', '/api/leagues/' + league + '/episodes/' + encodeURIComponent(l.epId) + '/lineups/bo', { castawayIds });
        const stored = async () => (await L.read(ids)).states.get(league).episodes.find(e => e.id === l.epId)?.lineups?.bo ?? null;
        const mine = () => s.snapshot().games.g.state.episodes.find(e => e.id === l.epId)?.lineups?.bo ?? null;
        check('Bo has a lineup to set for game ' + l.episode + ': two starters of four', l.slots === 2 && l.roster.length === 4 && !l.locked, l);
        const picked = l.roster.slice(2, 4), other = world.participants.map(p => p.id).find(id => !l.roster.includes(id));
        const r = await put(picked), a = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: l.epId, ids: picked });
        check('his lineup saved through the real route is stored as the runtime stores it', r.status === 200 && a.status === 'accepted' && JSON.stringify(await stored()) === JSON.stringify(mine()) && JSON.stringify(mine()) === JSON.stringify(picked), { status: r.status, server: await stored(), runtime: mine() });
        const foreign = await put([other, l.roster[0]]), foreignMine = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: l.epId, ids: [other, l.roster[0]] });
        check('a lineup naming someone else\'s player is refused by both', foreign.status >= 400 && foreign.status < 500 && foreignMine.status === 'rejected' && JSON.stringify(await stored()) === JSON.stringify(picked), [foreign.status, foreign.text.slice(0, 120), foreignMine.status]);
        const three = await put(l.roster.slice(0, 3)), threeMine = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: l.epId, ids: l.roster.slice(0, 3) });
        check('three starters where two start is refused by both', three.status >= 400 && three.status < 500 && threeMine.status === 'rejected' && JSON.stringify(await stored()) === JSON.stringify(picked), [three.status, three.text.slice(0, 120), threeMine.status]);
        // The game starts.
        must(s, { type: 'clock', at: new Date(Date.parse(next.airAt) + 3600000).toISOString() });
        await write();
        const late = await put(l.roster.slice(0, 2)), lateMine = s.apply({ type: 'lineup', gameId: 'g', personId: 'bo', eventId: l.epId, ids: l.roster.slice(0, 2) });
        check('once the game has started a change is refused by both, and the lineup stands', late.status >= 400 && late.status < 500 && lateMine.status === 'rejected' && JSON.stringify(await stored()) === JSON.stringify(picked), [late.status, late.text.slice(0, 120), lateMine.status]);
        // Recorded, not a disagreement: what the server says when it refuses, in a show's words on a sport's game.
        for (const [when, x] of [['three starters', three], ['a change after the start', late]]) if (/castaway|episode/i.test(x.json?.error || '')) note("a refusal on a sport's game is in a show's words (" + when + '): "' + x.json.error + '"');
        // Its box score comes in; everyone watches it.
        const lines = Sports.linesFor(world.context, world.participants, i => i * 5 + 2);
        must(s, { type: 'results', contextId: 'sport', eventId: next.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [], scoringEvents: [], lines } });
        for (const p of ['ann', 'bo', 'cy']) must(s, { type: 'reveal', contextId: 'sport', personId: p });
        await write();
        const found = real(await routes());
        check('the game\'s box score in and everyone caught up: the routes are clean', !found.length, found.slice(0, 3));
        const games = (await as('bo', 'GET', '/api/seasons/' + ids.seasons.sport.id + '/games?couch=' + ids.couchId)).json?.games || [];
        const week = games.find(g => g.leagueId === league)?.plays?.rows?.bo?.find(w => w.episode === next.number)?.points, want = round(picked.reduce((n, id) => n + linePoints(world.context, S.gameOf(s.snapshot().games.g.state), lines[id]), 0));
        const bench = round(l.roster.slice(0, 2).reduce((n, id) => n + linePoints(world.context, S.gameOf(s.snapshot().games.g.state), lines[id]), 0));
        check('on the server Bo\'s week is his two starters\' points, worked out here from the box score (' + want + '; his bench would have made ' + bench + ')', week === want && want !== bench, { server: week, starters: want, bench });
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
