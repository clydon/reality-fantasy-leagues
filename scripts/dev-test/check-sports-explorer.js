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
// NOTE lines are recorded product findings, not disagreements (both sides do the same).
// --verbose prints server answers; --keep leaves the rows up (remove: node tools/gameplay-bench/live-db.cjs down-all).
// The page itself (the game page and its lineup sheet at a phone's width) is the explorer page check's sports step:
//   node scripts/dev-test/check-explorer-page.js --only="sports:"
//
// Needs: the app on :3000 (npm run dev; BASE to override) and the local dev database (.env.local AUTH_DATABASE_URL).
//        (A long-running dev server can keep serving an old server module after a fix: if a case still fails, `touch
//        next.config.ts` and run it again before doubting the fix. BACKLOG 72's note.)
// Run:   node scripts/dev-test/check-sports-explorer.js [--case=tables|locks|matchups|categories|live|sweep|control|correction|lineup|all] [--league=football/nfl] [--game=short] [--verbose] [--keep]
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
