// What whoever runs a game does with its waivers, on the REAL routes, step by step against the explorer runtime (the breadth
// program's direct server comparison for the commissioner's waiver actions: docs/GAMEPLAY-EXPLORER.md). A case is materialized as
// zt-gb- rows (tools/gameplay-bench/live-db.cjs); each step is then sent to the app as that person and applied in the runtime, and
// after every step both sides must agree on whether it was taken and on the league's waiver weeks (window, swaps, hold, who has
// claims in, the run and its results), every team, the move log and each seat's private claim (waiver_claims against the
// runtime's store). The server is never re-synced between steps, so it carries on from its own writes.
//
// Cases (--case, default all; written for --seed=5's world, the default):
//   live   a live game with waivers after every loss: claims, Process now, a free-agency move, Undo (from Recent changes' line,
//          as the app's toast does it), the week held past its time, Process now again.
//   window a game with NO waivers of its own (most drafts): a window opened by hand, claims in it (one sent for someone), the
//          window cut to no swaps (claims trimmed), run, undone, turned off.
//   paced  a game at its own pace with exclusive teams, everyone on episode 1 of a season aired through 4: Process now, Undo,
//          Open a window. (Each acts on the copy at everyone's episode, never the season as it stands: BACKLOG 56, fixed 2026-11-14.)
//   paced-claim  the same game with a window opened by hand and Bo's swap claimed for someone who goes home in episode 2 (unseen):
//          Process now runs it at everyone's episode, where they're still in: the swap goes through.
//   paced-time   the same claim left to the week's own time: the same run, and Bo's swap goes through.
//   paced-window the same game with nobody past episode 0 and no week running: Open a window is refused (nobody has watched an
//          episode yet), and says so.
//   paced-undo   Ann's claim settles her week at once (everyone owed has a claim in); then Undo: the week stays open and held.
//   carried      a lineup game at its own pace on a season aired through 4 (shared teams, a loss replaced after any episode): Bo saves
//          one lineup for episode 1 and plays on with it (never saved again, so each later week fields it as carried), then replaces
//          a starter who went home. No commissioner action: it is here because the same machinery proves it (BACKLOG 57).
//   saved        a live lineup game (shared teams), episode 1 played: Bo saves his lineup for episode 2, then swaps one of its
//          starters away in a window opened by hand. The lineup that counts for episode 2 leaves them out (a gap, on the server's
//          own state and on Bo's real games route: a slot to fill), what he saved isn't rewritten, and Undo brings them back
//          (BACKLOG 69, 2026-11-14).
// BACKLOG 56 (fixed 2026-11-14) is a FAIL now, checked on the server's own state after each step of a paced case: a run that gives
// away what nobody has seen yet (a replacement counted for a seat nobody of whose has left as far as anyone has seen, or a claim
// passed over because its castaway is "gone" while they're still in at everyone's episode); a window the server said it opened
// that isn't there after the same write; an Undo after which the week has already run again.
// BACKLOG 57 (fixed 2026-11-14) is a FAIL now: a step after which the lineup that counted for an episode already played is a
// different one, though nobody saved a lineup for it, or after which a total moved on a waiver move alone (`carried`).
// Doors (--door, default both): backstage (the app's: POST /api/seasons/{S}/backstage/waivers, and Undo through
//   /changes/{batch}/undo when a run made a line) and classic (POST /api/leagues/{L}/waivers/window|process|undo).
// --control: also proves the comparison sees a difference (the runtime skips one claim: the run must then disagree).
// --verbose: prints each step's server answer and both shapes.  --keep: leaves the rows up (remove: node
//   tools/gameplay-bench/live-db.cjs down-all).  --seed=5.
//
// Needs: the app on :3000 (npm run dev; BASE to override) and the local dev database (.env.local AUTH_DATABASE_URL).
// Run:   node scripts/dev-test/check-waiver-commissioner.js [--case=live|window|paced|paced-claim|paced-time|paced-window|paced-undo|carried|saved|all] [--door=backstage|classic|both] [--control] [--verbose]
const path = require('path');
const root = path.resolve(__dirname, '../..');
const L = require(path.join(root, 'tools/gameplay-bench/live-db.cjs')), R = require(path.join(root, 'tools/gameplay-bench/explorer/runtime.cjs')), D = require(path.join(root, 'tools/gameplay-bench/explorer/document.cjs'));
const Q = require(path.join(root, 'tests/fixtures/gameplay-explorer/questions-input.json')), S = require(path.join(root, 'src/lib/game/state-logic'));
const { signIn } = require(path.join(root, 'tools/ui-atlas/data.cjs'));
const app = process.env.BASE || 'http://localhost:3000';
const arg = k => process.argv.find(a => a.startsWith('--' + k + '='))?.slice(k.length + 3), flag = k => process.argv.includes('--' + k);
const seed = Number(arg('seed') || 5), verbose = flag('verbose');
const c = n => 'show-participant-' + n;
const always = { feel: 'balanced', replace: 'always', short: null, windows: { schedule: 'manual', every: 3, swaps: 0 }, order: 'rolling', hours: 24, freeAgency: true, autoFill: true };
const draft = { get: { by: 'draft', each: 3, own: 'exclusive', order: 'snake' }, count: { all: true }, score: { by: 'place' }, rank: { by: 'total' } };
const define = (spec, timing, content, marks = []) => D.create({ seed, world: { contexts: [{ id: 'show', kind: 'show', format: { id: 'survivor' }, engine: { ...Q.context, couch: 2, pool: 10 } }], people: [{ id: 'p1', name: 'Ann' }, { id: 'p2', name: 'Bo' }] },
  games: [{ id: 'g', contextId: 'show', timing, spec }], situation: { clock: '2099-01-10T12:00:00.000Z', marks }, content });

// Each case: its definition, a prelude applied in the runtime before anything is materialized, and its steps. A step is a runtime
// action, or { clock: session => ISO time } (the scenario's clock moved there: the runtime's state is written to the server again with that
// moment as now, a read lets the server's waiver clock run, and the runtime's clock action follows). `via: 'batch'` sends an Undo
// through Recent changes. A step may also be a function of the session, giving the action when its turn comes.
const night = (s, n, gone) => { const ev = s.snapshot().contexts.show.events[n - 1]; s.apply({ type: 'clock', at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }); return s.apply({ type: 'results', contextId: 'show', eventId: ev.id, source: 'provider-fixture', resultStatus: 'final', data: { events: [{ castawayId: gone, method: 'Voted Out' }], scoringEvents: [] } }); };
const CASES = {
  live: {
    define: () => define({ ...draft, extras: { waivers: always } }, 'live-only', { completedEvents: 0, eventCount: 4 }),
    prelude: s => { night(s, 1, c(1)); for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'waiverRun', gameId: 'g', personId: 'p2' }, // not whoever runs it
      { type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: c(7), dropId: c(1) }, { addId: c(8), dropId: c(1) }], control: true },
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 }, // processed: too late
      { type: 'waiverUndo', gameId: 'g', personId: 'p2' },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1', via: 'batch' },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1' }, // nothing left to undo
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1, replace: true }, // the held week becomes a window
      { type: 'claim', gameId: 'g', personId: 'p2', spot: { dropId: c(4), addIds: [c(9), c(7)] } },
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
      { type: 'freeAgency', gameId: 'g', personId: 'p1', addId: c(10), dropId: c(2) },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1' }, // the run and the free-agency move, both back
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
    ],
  },
  window: {
    define: () => define(draft, 'live-only', { completedEvents: 0, eventCount: 4 }),
    prelude: s => { night(s, 1, c(1)); for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'waiverRun', gameId: 'g', personId: 'p1' }, // no waivers here
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: null }, // nothing to turn off
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 0, replace: false }, // nothing to claim
      { type: 'waiverWindow', gameId: 'g', personId: 'p2', swaps: 1 }, // not whoever runs it
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1, replace: true },
      { type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: c(7), dropId: c(1) }, { addId: c(8), dropId: c(2) }] },
      { type: 'claim', gameId: 'g', personId: 'p1', forId: 'p2', spot: { dropId: c(4), addIds: [c(9), c(7)] } },
      { type: 'claim', gameId: 'g', personId: 'p2', forId: 'p1', spot: { dropId: c(2), addIds: [c(9)] } }, // Bo doesn't run it
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 0, replace: true }, // swaps go: Ann keeps her replacement, Bo's claim is gone
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 2, replace: true },
      { type: 'claim', gameId: 'g', personId: 'p2', spot: { dropId: c(5), addIds: [c(10)] } },
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1', via: 'batch' },
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: null }, // off: with no waivers of its own, the week is over
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 }, // and can't open again for this episode
    ],
  },
  paced: {
    define: () => define({ ...draft, extras: { waivers: always } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 0 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: s => { for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1' },
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 },
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
    ],
  },
  'paced-claim': {
    define: () => define({ ...draft, extras: { waivers: always } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 0 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: s => { for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 },
      { type: 'claim', gameId: 'g', personId: 'p2', pairs: [{ addId: c(7), dropId: c(4) }] },
      { type: 'waiverRun', gameId: 'g', personId: 'p1' },
    ],
  },
  'paced-time': {
    define: () => define({ ...draft, extras: { waivers: always } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 0 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: s => { for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 },
      { type: 'claim', gameId: 'g', personId: 'p2', pairs: [{ addId: c(7), dropId: c(4) }] },
      { clock: s => new Date(Date.parse(s.snapshot().games.g.state.midSeason.waivers.periods.at(-1).processAt) + 1000).toISOString() },
    ],
  },
  'paced-window': {
    define: () => define({ ...draft, extras: { waivers: always } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 0 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: () => {},
    steps: [{ type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 }],
  },
  carried: {
    steady: true,
    define: () => define({ get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' }, extras: { waivers: { ...always, autoFill: false } } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 4 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: () => {},
    steps: (() => {
      // Bo's lineup for episode 1: someone of his who goes home in episode 2 to 4, and one more. Then he reveals through 4 and
      // replaces them in free agency (the week ran as it opened: its time had come).
      const st = s => s.snapshot().games.g.state, mine = s => st(s).castaways.filter(x => x.ownerIds.includes('p2'));
      const goner = s => mine(s).find(x => { const n = st(s).episodes.find(e => e.id === x.exitEpisodeId)?.number; return n >= 2 && n <= 4; }) || (() => { throw Error('carried: nobody of Bo\'s goes home in episodes 2 to 4 with --seed=' + seed + '; try another'); })();
      let lost = null;
      return [
        s => { lost = goner(s).id; return { type: 'lineup', gameId: 'g', personId: 'p2', eventId: st(s).episodes[0].id, ids: [lost, mine(s).find(x => x.id !== lost).id] }; },
        ...[1, 2, 3, 4].map(n => ({ type: 'reveal', contextId: 'show', personId: 'p2', episode: n })),
        s => ({ type: 'freeAgency', gameId: 'g', personId: 'p2', addId: S.MidSeasonLogic.availableFor(st(s), 'p2', 'replace')[0].id, dropId: lost }),
      ];
    })(),
  },
  saved: {
    gap: true,
    define: () => define({ get: { by: 'draft', each: 3, own: 'shared', order: 'blind' }, count: { start: 2 }, score: { by: 'moments' }, rank: { by: 'total' } }, 'live-only', { completedEvents: 0, eventCount: 4 }),
    prelude: s => { const st = s.snapshot().games.g.state, held = new Set(st.castaways.filter(x => x.ownerIds.length).map(x => x.id)); night(s, 1, st.castaways.find(x => !held.has(x.id)).id); for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: (() => {
      const st = s => s.snapshot().games.g.state, mine = s => st(s).castaways.filter(x => x.ownerIds.includes('p2') && x.status === 'active');
      let out = null;
      return [
        s => { out = mine(s)[0].id; return { type: 'lineup', gameId: 'g', personId: 'p2', eventId: st(s).episodes.find(e => e.number === 2).id, ids: [out, mine(s)[1].id] }; },
        { type: 'waiverWindow', gameId: 'g', personId: 'p1', swaps: 1 },
        s => ({ type: 'claim', gameId: 'g', personId: 'p2', pairs: [{ addId: S.MidSeasonLogic.availableFor(st(s), 'p2', 'swap')[0].id, dropId: out }] }),
        { type: 'waiverRun', gameId: 'g', personId: 'p1' },
        { type: 'waiverUndo', gameId: 'g', personId: 'p1' },
        { type: 'waiverRun', gameId: 'g', personId: 'p1' },
      ];
    })(),
  },
  'paced-undo': {
    define: () => define({ ...draft, extras: { waivers: always } }, 'own-pace', { completedEvents: 4, eventCount: 6 }, [{ personId: 'p1', contextId: 'show', through: 0 }, { personId: 'p2', contextId: 'show', through: 0 }]),
    prelude: s => { for (const p of ['p1', 'p2']) s.apply({ type: 'reveal', contextId: 'show', personId: p }); },
    steps: [
      { type: 'claim', gameId: 'g', personId: 'p1', pairs: [{ addId: c(8), dropId: c(1) }] },
      { type: 'waiverUndo', gameId: 'g', personId: 'p1' },
    ],
  },
};

// The league's waivers, teams and claims in one comparable shape. A week the server opened by hand has its own (random) id, so
// weeks are compared in order and each week's claims sit with it.
function shape(st, claimsOf) {
  return {
    weeks: (st.midSeason?.waivers?.periods || []).map(p => ({ episode: p.episode, phase: p.phase, window: !!p.window, swaps: p.swaps ?? 0, replace: p.replace ?? null, openedBy: p.openedBy ?? null, hold: !!p.hold, turnedOff: !!p.turnedOff, hidden: !!p.hidden, claimsIn: p.claimsIn || [],
      run: p.run ? { by: p.run.by, orderBefore: p.run.orderBefore, orderAfter: p.run.orderAfter, results: p.run.results.map(x => [x.playerId, x.kind, x.outcome, x.castawayId ?? null, x.droppedCastawayId ?? null, x.choice ?? null, (x.passed || []).map(w => [w.castawayId, w.reason, w.byPlayerId ?? null])]) } : null,
      autoFills: (p.autoFills || []).length, claims: claimsOf(p.id) })),
    teams: Object.fromEntries(st.castaways.filter(x => x.ownerIds.length || x.formerOwnerId || x.replenishClaimed || x.acquiredVia).map(x => [x.id, [x.ownerIds, x.acquiredVia ?? null, x.replenishClaimed ?? null, x.formerOwnerId ?? null, x.departedVia ?? null]])),
    log: (st.midSeason?.log || []).map(t => [t.type, t.playerId, t.via ?? null, t.episode ?? null]),
    lineups: Object.fromEntries(st.episodes.filter(e => e.lineups && Object.keys(e.lineups).length).map(e => [e.number, e.lineups])),
    order: S.MidSeasonLogic.order(st, S.WaiverLogic.rotation(st)),
  };
}
const diff = (a, b, at = '') => { if (JSON.stringify(a) === JSON.stringify(b)) return []; if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) { const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]; const out = keys.flatMap(k => diff(a[k], b[k], at + '/' + k)); if (out.length) return out; } return [at + ': server ' + JSON.stringify(a) + ' · runtime ' + JSON.stringify(b)]; };

// What a run gives away in a game at its own pace with exclusive teams (BACKLOG 56), against everyone's episode (the lowest mark).
function giveaways(st, lowest) {
  const epOf = x => st.episodes.find(e => e.id === x.exitEpisodeId)?.number ?? null, out = [];
  for (const p of st.midSeason?.waivers?.periods || []) for (const x of p.run?.results || []) {
    if (x.kind === 'pickup' && !st.castaways.some(y => (y.ownerIds.includes(x.playerId) || y.formerOwnerId === x.playerId) && epOf(y) !== null && epOf(y) <= lowest)) out.push('a replacement counted for ' + x.playerId + ' (' + x.outcome + '), nobody of whose has left through episode ' + lowest);
    for (const w of x.passed || []) { const y = st.castaways.find(z => z.id === w.castawayId); if (w.reason === 'gone' && y && epOf(y) !== null && epOf(y) > lowest) out.push(x.playerId + "'s claim for " + y.name + ' passed over as "gone": they go home in episode ' + epOf(y) + ', and everyone is on ' + lowest); }
  }
  return [...new Set(out)];
}

async function runCase(name, door, control) {
  const def = CASES[name], s = R.open(def.define()), results = [];
  const note = (ok, text) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + text); };
  let ids;
  try {
    def.prelude(s);
    const snap0 = s.snapshot(), doc = s.export().input;
    ids = await L.up(snap0, doc);
    await L.sync(ids, snap0, doc, Date.now() - Date.parse(snap0.clock));
    const league = ids.leagues.g, season = ids.seasons.show.id, cookies = {};
    for (const p of snap0.people) cookies[p.id] = await signIn(app, ids.users[p.id].username, L.PASSWORD);
    const send = async (as, method, url, body) => { const r = await fetch(app + url, { method, headers: { cookie: cookies[as], 'content-type': 'application/json', origin: app }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: r.status, body: await r.json().catch(() => null) }; };
    const backstage = (as, body) => send(as, 'POST', '/api/seasons/' + season + '/backstage/waivers?couch=' + ids.couchId, { leagueId: league, ...body });
    let batch = null;
    const real = async a => {
      if (a.type === 'lineup') return send(a.personId, 'PUT', '/api/leagues/' + league + '/episodes/' + encodeURIComponent(a.eventId) + '/lineups/' + encodeURIComponent(a.personId), { castawayIds: a.ids });
      if (a.type === 'reveal') return send(a.personId, 'POST', '/api/seasons/' + season + '/reveal?couch=' + ids.couchId, { episode: a.episode });
      if (a.type === 'claim' && a.forId !== undefined) return backstage(a.personId, { action: 'claimFor', playerId: a.forId, dropId: a.spot.dropId, addIds: a.spot.addIds });
      if (a.type === 'claim') return send(a.personId, 'PUT', '/api/leagues/' + league + '/waivers/claims', a.spot ? { spot: a.spot } : { pairs: a.pairs });
      if (a.type === 'freeAgency') return send(a.personId, 'POST', '/api/leagues/' + league + '/waivers/free-agency', { addId: a.addId, dropId: a.dropId });
      if (door === 'classic') return send(a.personId, 'POST', '/api/leagues/' + league + '/waivers/' + { waiverWindow: 'window', waiverRun: 'process', waiverUndo: 'undo' }[a.type], a.type === 'waiverWindow' ? { swaps: a.swaps, ...(a.replace === undefined ? {} : { replace: a.replace }) } : undefined);
      if (a.type === 'waiverWindow') return backstage(a.personId, { action: 'window', swaps: a.swaps, ...(a.replace === undefined ? {} : { replace: a.replace }) });
      if (a.type === 'waiverRun') { const r = await backstage(a.personId, { action: 'run' }); if (r.status < 400) batch = r.body?.batch ?? null; return r; }
      if (a.via === 'batch' && batch) return send(a.personId, 'POST', '/api/seasons/' + season + '/changes/' + encodeURIComponent(batch) + '/undo?couch=' + ids.couchId);
      return backstage(a.personId, { action: 'undo' });
    };
    const both = async () => {
      const db = await L.read(ids), server = db.states.get(league), mine = s.snapshot(), store = mine.stores.waivers?.g;
      const serverClaims = pid => Object.fromEntries(db.claims.filter(r => r.league_id === league && r.period_id === pid).map(r => [r.player_id, (r.pairs || []).map(x => x.addId + '>' + x.dropId)]));
      const myClaims = pid => Object.fromEntries(Object.entries(store?.weeks?.[pid] || {}).sort(([a, x], [b, y]) => x.seq - y.seq || (a < b ? -1 : 1)).map(([p, x]) => [p, x.claim.pairs.map(y => y.addId + '>' + y.dropId)]));
      return [shape(server, serverClaims), shape(mine.games.g.state, myClaims)];
    };
    { const [a, b] = await both(), d = diff(a, b); note(!d.length, name + '/' + door + ': materialized as the runtime has it' + (d.length ? '\n     ' + d.slice(0, 6).join('\n     ') : '')); }
    // (BACKLOG 57) The lineup that counts for each episode with results, as the engine resolves it on the server's own state, and what
    // the real games route gives each seat in all.
    const markOf = pid => s.snapshot().contexts.show.marks.find(m => m.personId === pid)?.through ?? 0;
    const counted = st => Object.fromEntries(st.episodes.filter(e => S.EpisodeLogic.hasResults(e)).flatMap(e => st.players.filter(p => e.number <= markOf(p.id)).map(p => [e.number + '|' + p.id, JSON.stringify(S.ActiveRosterLogic.lineupFor(st, e.id, p.id))])));
    const totals = async as => { const r = await send(as, 'GET', '/api/seasons/' + season + '/games?couch=' + ids.couchId); return Object.fromEntries((r.body?.games?.find(x => x.leagueId === league)?.table || []).map(x => [x.playerId, x.total])); };
    let skipped = false, sawControl = false;
    const noted = new Set(), paced = S.GhostLogic.draftsTogether(snap0.games.g.state);
    for (let [i, step] of def.steps.entries()) {
      const was = counted((await L.read(ids)).states.get(league)), wasTotals = await totals('p1');
      const played = async (label, saved) => {
        const now = counted((await L.read(ids)).states.get(league)), changed = Object.keys(was).filter(k => k in now && now[k] !== was[k] && k !== saved);
        if (changed.length) note(false, name + '/' + door + ' BACKLOG 57 (' + label + "): the lineup that counted for an episode already played changed, with no lineup saved for it: " + changed.map(k => 'episode ' + k.split('|')[0] + ' ' + k.split('|')[1] + ' ' + was[k] + ' to ' + now[k]).join('; ') + '. Totals on the real games route (a viewer who has seen it all): ' + JSON.stringify(wasTotals) + ' to ' + JSON.stringify(await totals('p1')));
        // A waiver move alone moves no total (new results do: a reveal isn't one of these).
        if (def.steady && ['freeAgency', 'claim', 'waiverRun', 'waiverUndo', 'waiverWindow'].includes(label)) { const t = await totals('p1'); note(JSON.stringify(t) === JSON.stringify(wasTotals), name + '/' + door + ' a ' + label + ' moved no total on the real games route: ' + JSON.stringify(wasTotals) + (JSON.stringify(t) === JSON.stringify(wasTotals) ? '' : ' became ' + JSON.stringify(t))); }
      };
      if (typeof step === 'function') step = step(s);
      if (step.clock) {
        const at = step.clock(s), snap = s.snapshot();
        await L.sync(ids, snap, doc, Date.now() - Date.parse(at));
        await send('p1', 'GET', '/api/seasons/' + season + '/waivers?couch=' + ids.couchId); await send('p1', 'GET', '/api/seasons/' + season + '/games?couch=' + ids.couchId);
        const mine = s.apply({ type: 'clock', at }, 'server-comparison'), [a, b] = await both(), d = diff(a, b);
        if (verbose) console.log('     server ' + JSON.stringify(a) + '\n     runtime ' + JSON.stringify(b));
        note(mine.status === 'accepted' && !d.length, name + '/' + door + ' ' + (i + 1) + '. the clock moves to ' + at + ": the server's waiver clock and the runtime's" + (d.length ? '\n     ' + d.slice(0, 8).join('\n     ') : ' agree (' + a.weeks.map(w => 'episode ' + w.episode + ' ' + w.phase + (w.run ? ': ' + w.run.results.map(x => x.slice(0, 5).filter(Boolean).join(' ')).join('; ') : '')).join(' · ') + ')'));
        await played('the week ran at its time');
        continue;
      }
      const { via, control: isControl, ...action } = step;
      const r = await real(step), serverOk = r.status < 400;
      // The control: the runtime never gets one claim, so everything that depends on it must disagree from the next run on.
      const mine = control && isControl ? (skipped = true, { status: 'skipped' }) : s.apply(action, 'server-comparison');
      const [a, b] = await both(), d = diff(a, b), agree = mine.status === 'skipped' ? true : serverOk === (mine.status === 'accepted');
      const label = name + '/' + door + ' ' + (i + 1) + '. ' + action.type + (action.forId ? ' for ' + action.forId : '') + (via ? ' (' + via + ')' : '') + ' by ' + action.personId + ': server ' + r.status + (serverOk ? '' : ' "' + (r.body?.error || '') + '"') + ' · runtime ' + mine.status + (mine.message ? ' "' + mine.message + '"' : '');
      if (verbose) console.log('     server answered ' + JSON.stringify(r.body).slice(0, 300) + '\n     server ' + JSON.stringify(a) + '\n     runtime ' + JSON.stringify(b));
      if (control && skipped) { if (d.length) sawControl = true; console.log('  ·  ' + label + (d.length ? ' (control: differs, ' + d.length + ')' : '')); continue; }
      note(agree && !d.length, label + (d.length ? '\n     ' + d.slice(0, 8).join('\n     ') : ''));
      await played(action.type, action.type === 'lineup' ? s.snapshot().games.g.state.episodes.find(e => e.id === action.eventId)?.number + '|' + action.personId : null);
      // (BACKLOG 69) The lineup a seat saved for the next episode, as it counts on the server's own state: everyone saved who's still
      // theirs, nobody they've let go, the saved lineup itself as it was; and the same on that seat's real games route.
      if (def.gap && serverOk && ['waiverRun', 'waiverUndo'].includes(action.type)) {
        const now = (await L.read(ids)).states.get(league), next = now.episodes.filter(e => !S.EpisodeLogic.hasResults(e)).sort((x, y) => x.number - y.number)[0];
        for (const p of now.players) {
          const saved = next?.lineups?.[p.id]; if (!saved) continue;
          const theirs = saved.filter(id => now.castaways.find(x => x.id === id)?.ownerIds.includes(p.id)), fielded = S.ActiveRosterLogic.lineupFor(now, next.id, p.id);
          const route = (await send(p.id, 'GET', '/api/seasons/' + season + '/games?couch=' + ids.couchId)).body?.games?.find(x => x.leagueId === league)?.lineup;
          const gapped = theirs.length < saved.length;
          note(JSON.stringify(fielded) === JSON.stringify(theirs) && JSON.stringify(route?.starters) === JSON.stringify(theirs) && route?.set === !gapped && (action.type !== 'waiverUndo' || !gapped),
            name + '/' + door + '   BACKLOG 69: ' + p.id + "'s lineup for episode " + next.number + ' counts ' + JSON.stringify(fielded) + ' of the ' + JSON.stringify(saved) + ' saved' + (gapped ? ' (let go: a slot to fill)' : ' (all theirs)') + '; the games route: ' + JSON.stringify(route && { starters: route.starters, set: route.set }));
        }
      }
      if (paced) {
        const db = await L.read(ids), now = db.states.get(league), lowest = Math.min(...s.snapshot().contexts.show.marks.map(m => m.through)), week = S.WaiverLogic.current(now);
        const gave = giveaways(now, lowest).filter(g => !noted.has(g));
        gave.forEach(g => noted.add(g));
        if (serverOk && ['waiverRun', 'claim'].includes(action.type) || gave.length) note(!gave.length, name + '/' + door + '   BACKLOG 56: nothing run gives away what nobody has seen (everyone is on episode ' + lowest + ')' + (gave.length ? ': ' + gave.join('; ') : ''));
        if (serverOk && action.type === 'waiverWindow' && action.swaps !== null) note(!!(week && week.window && week.episode === lowest), name + '/' + door + '   BACKLOG 56: the window the server said it opened is open after the write, on everyone\'s episode (weeks: ' + JSON.stringify(a.weeks.map(w => [w.episode, w.phase, w.window])) + ')');
        if (serverOk && action.type === 'waiverUndo') note(!!week && week.phase === 'open' && week.hold === true, name + '/' + door + '   BACKLOG 56: the run taken back stays taken back, the week open and held' + (week && week.phase === 'processed' ? ' (it ran again in the same write, by ' + week.run.by + ')' : ''));
      }
    }
    if (control) note(sawControl, name + '/' + door + ': control (the runtime skipped a claim) made the comparison disagree');
    if (flag('keep')) { console.log('Kept zt-gb-' + ids.key + ': ' + Object.values(ids.users).map(u => u.username).join(', ') + ' (password ' + L.PASSWORD + ')'); ids = null; }
  } catch (e) { note(false, name + '/' + door + ': ' + e.message); }
  finally { s.dispose(); if (ids) await L.down(ids.key).catch(e => console.error('Could not remove zt-gb-' + ids.key + ': ' + e.message)); }
  return results;
}

(async () => {
  const cases = (arg('case') || 'all') === 'all' ? Object.keys(CASES) : [arg('case')], doors = (arg('door') || 'both') === 'both' ? ['backstage', 'classic'] : [arg('door')];
  const all = [];
  for (const name of cases) { if (!CASES[name]) throw Error('Unknown case ' + name); for (const door of doors) { all.push(...await runCase(name, door, false)); if (flag('control') && CASES[name].steps.some(x => x.control)) all.push(...await runCase(name, door, true)); } }
  await L.close().catch(() => {});
  const failed = all.filter(ok => !ok).length;
  console.log('\n' + (all.length - failed) + ' of ' + all.length + ' agree');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
