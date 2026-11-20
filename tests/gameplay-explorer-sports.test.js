// The gameplay explorer's generated sports world (tools/gameplay-bench/explorer/runtime-sports.cjs, core-runtime-30; the breadth
// program's sports statistics, first slice): a sport context's athletes, schedule and box scores, and a drafted team scored by a
// sport's stats with plain points, ranked by total, locking at each episode's start. Run with `npm test`.
//
// The oracle is worked out here, apart from the engine: each seat's total is its counted athletes' points for each released
// episode (the whole team, the starters it fielded, or its best n), a line's points each stat the table scores, its count times
// its points to the cent, over the sport's full line; a place's by its place (sports-oracle.cjs linePoints, the fourth slice: a
// field's line has its place from the standings). So a wrong stamp, team, episode, place or sum shows as a different table.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const root = path.join(__dirname, "..");
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));
const D = require(path.join(root, "tools/gameplay-bench/explorer/document.cjs"));
const P = require(path.join(root, "tools/gameplay-bench/explorer/runtime-profile.cjs"));
const Sports = require(path.join(root, "tools/gameplay-bench/explorer/runtime-sports.cjs"));
const Bench = require(path.join(root, "tools/gameplay-bench/sports.cjs"));
const S = require(path.join(root, "src/lib/game/state-logic.js"));
const G = require(path.join(root, "src/lib/game/game-spec/index.js"));

const PEOPLE = [{ id: "p1", name: "Ann" }, { id: "p2", name: "Bo" }, { id: "p3", name: "Cy" }];
/** A definition: one game of a league's (`game`: the bench's id, or a spec) on a generated world of it. */
function define(key, game, o = {}) {
  const spec = typeof game === "string" ? Bench.resolve(key, game).row.spec : game;
  const each = G.fullSpec(spec).get?.each || 1;
  return D.create({
    seed: o.seed ?? 7,
    world: { contexts: [Sports.contextFor(key, { couch: 3, pool: 3 * each + 4 })], people: PEOPLE },
    games: [{ id: "g", contextId: "sport", timing: o.timing || "live-only", spec }],
    situation: { clock: "2099-01-10T12:00:00.000Z", ...(o.marks ? { marks: o.marks } : {}) },
    content: { completedEvents: o.completed ?? 2, eventCount: o.events ?? 4 },
  });
}
const round = (n) => Math.round(n * 100) / 100;
const Oracle = require(path.join(root, "tools/gameplay-bench/campaign/sports-oracle.cjs"));
/** An athlete's line in an event as it's scored: a team game's with its derived stats worked out, a field's with its place from
 *  the standings (the oracle's own restatement), a card's as given. */
const lineOf = (c, data, id) => (data.standings ? Oracle.placed(data.lines[id], data.standings.find((x) => x.id === id), c.sport.id) : c.context.shape === "team" ? c.sport.full(data.lines[id]) : data.lines[id]);
const groupOf = (c, world, id) => c.sport.position(world.participants.find((x) => x.id === id).role)?.group ?? null;
/** On a card, the matches someone played, each its best of and its own line (the fact's own). */
const matchesOf = (data, id) => (data.card ? data.card.bouts.filter((b) => data.card.byBout[b.id]?.[id]).map((b) => ({ format: b.rounds, line: data.card.byBout[b.id][id] })) : null);
/** Each seat's total, worked out apart from the engine's walk (the header's oracle; a line's points: sports-oracle.cjs). */
function expected(snap) {
  const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st);
  const released = world.events.filter((e) => ["final", "corrected"].includes(e.resultStatus));
  const out = {};
  for (const p of st.players) {
    let total = 0;
    for (const e of released) {
      const data = world.facts.find((f) => f.eventId === e.id).data;
      const team = st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id);
      const ep = st.episodes.find((x) => x.id === e.id);
      const held = spec.count.start ? (ep.lineups?.[p.id] ?? []) : team;
      const pts = held.map((id) => Oracle.linePoints(spec.score, lineOf(c, data, id), groupOf(c, world, id), matchesOf(data, id)));
      const counted = spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts;
      total += counted.reduce((a, b) => a + b, 0);
    }
    out[p.id] = round(total);
  }
  return out;
}
const table = (st) => Object.fromEntries(S.computeScores(st).map((r) => [r.playerId, round(r.total)]));

test("a sport context is the league's own page context; its athletes have positions; a released event's fact is its box score", () => {
  const doc = define("football/nfl", "short");
  assert.deepEqual(P.inspect(doc).gaps, []);
  const s = R.open(doc);
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, st = snap.games.g.state;
    assert.equal(world.context.kind, "sport");
    assert.equal(world.context.key, "football/nfl");
    assert.ok(world.context.engine.stats.length > 20, "the league's stats, as the app's page context has them");
    assert.ok(world.participants.every((p) => typeof p.role === "string" && p.role), "every athlete a position");
    assert.ok(new Set(world.participants.map((p) => p.role)).size >= 4, "the default lineup's positions in turn (QB, WR, RB, TE...)");
    const facts = world.facts.filter((f) => world.events.find((e) => e.id === f.eventId).number <= 2);
    assert.equal(facts.length, 2);
    for (const f of facts) {
      assert.deepEqual([f.data.events, f.data.scoringEvents], [[], []], "nobody goes home, no moment is scored");
      assert.deepEqual(Object.keys(f.data.lines).sort(), world.participants.map((p) => p.id).sort(), "a line an athlete");
      assert.ok(!("noExit" in f.data));
    }
    // The state is a game as the server keeps one: no position on a castaway (it's the season's cast's), no exit on anyone.
    assert.ok(st.castaways.every((x) => !("role" in x) && x.status === "active"));
    assert.equal(st.settings.showFormat, "generic");
    assert.deepEqual(st.episodes.map((e) => S.episodeHasResults(e)), [true, true, false, false]);
    assert.ok(st.episodes[0].statLines && st.episodes[0].gameFinal === true, "stamped as the server stamps a final game");
    assert.ok(st.episodes.slice(0, 2).every((e) => !e.noExit && !e.events.length), "its results are its lines alone");
  } finally {
    s.dispose();
  }
});

// Every game of the first slice the app offers, on every league that has it: a drafted team, plain points, ranked by total, locking
// at the start (a whole team of three: short; the best n of a full roster: best ball; a lineup where a league's season is one).
const SLICE = Bench.catalog().flatMap((c) => c.games.filter((g) => g.implemented).map((g) => [c.id, g.id]));
let opened = 0;
for (const [key, game] of SLICE) {
  let doc;
  try { doc = define(key, game); } catch { continue; }
  if (P.inspect(doc).gaps.length) continue;
  // (A game of categories has no points: its own tests are the third slice's, below.)
  if (G.fullSpec(doc.games[0].spec).score.categories) continue;
  opened++;
  test(`${key} ${game}: the table is each seat's counted athletes' points, week by week`, () => {
    const s = R.open(doc);
    try {
      const snap = s.snapshot(), st = snap.games.g.state, spec = S.gameOf(st);
      assert.equal(spec.score.by, "stats");
      const want = expected(snap), got = table(st);
      assert.deepEqual(got, want);
      assert.ok(Object.values(got).some((v) => v !== 0), "somebody scored");
      // A lineup game: every seat fielded its starters before each released week (generated with the production setter).
      if (spec.count.start) for (const e of st.episodes.filter((x) => S.episodeHasResults(x))) for (const p of st.players) assert.equal(e.lineups[p.id].length, Math.min(spec.count.start, st.castaways.filter((x) => x.ownerIds.includes(p.id)).length));
    } finally {
      s.dispose();
    }
  });
}
test("the first slice covers the sports the matrix's specimens come from", () => {
  const sports = new Set(SLICE.filter(([key, game]) => { try { return !P.inspect(define(key, game)).gaps.length; } catch { return false; } }).map(([key]) => key.split("/")[0]));
  for (const id of ["football", "basketball", "baseball", "hockey", "mma", "racing"]) assert.ok(sports.has(id), id);
  assert.ok(opened >= 12, `${opened} games opened`);
});

test("results arrive as a box score: the table moves by the new week's lines; a show's facts and a week in progress are refused", () => {
  const s = R.open(define("basketball/nba", "short"));
  try {
    const before = table(s.snapshot().games.g.state), world = s.snapshot().contexts.sport, ev = world.events[2];
    const lines = Object.fromEntries(world.participants.map((p, i) => [p.id, { PTS: 10 + i, REB: 2, AST: 1, STL: 0, BLK: 0, TO: 1, FGM: 4, FGA: 9, FTM: 2, FTA: 2, "3PM": 0 }]));
    const send = (data, resultStatus = "final") => s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus, data });
    assert.equal(send({ events: [], scoringEvents: [], lines }).status, "rejected", "not before it has aired");
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }).status, "accepted");
    assert.match(send({ events: [], scoringEvents: [], noExit: true }).message, /unsupported/);
    assert.match(send({ events: [], scoringEvents: [] }).message, /need lines/);
    assert.match(send({ events: [], scoringEvents: [], lines }, "partial").message, /final at once/);
    assert.match(send({ events: [], scoringEvents: [], lines: { nobody: { PTS: 1 } } }).message, /need lines/);
    assert.equal(send({ events: [], scoringEvents: [], lines }).status, "accepted");
    const snap = s.snapshot(), after = table(snap.games.g.state);
    assert.deepEqual(after, expected(snap));
    assert.ok(Object.keys(after).every((id) => after[id] > before[id]), "everyone's week counted");
    assert.equal(S.episodeHasResults(snap.games.g.state.episodes[2]), true);
    // A correction replaces the week's lines.
    const fixed = Object.fromEntries(Object.entries(lines).map(([id, l]) => [id, { ...l, PTS: 0 }]));
    assert.equal(s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus: "corrected", data: { events: [], scoringEvents: [], lines: fixed } }).status, "accepted");
    const again = s.snapshot();
    assert.deepEqual(table(again.games.g.state), expected(again));
    assert.ok(Object.keys(after).every((id) => table(again.games.g.state)[id] < after[id]));
  } finally {
    s.dispose();
  }
});

test("a lineup locks at its episode's start, and a week nobody's set scores nothing for them", () => {
  const key = SLICE.find(([k, g]) => { try { const d = define(k, g); const f = G.fullSpec(d.games[0].spec); return !P.inspect(d).gaps.length && f.count.start && f.closes === "start"; } catch { return false; } });
  assert.ok(key, "a league whose season is a lineup locking at the start");
  const s = R.open(define(key[0], key[1]));
  try {
    const snap = s.snapshot(), st = snap.games.g.state, next = st.episodes.find((e) => !S.episodeHasResults(e));
    const mine = st.castaways.filter((x) => x.ownerIds.includes("p1")).map((x) => x.id), n = S.gameOf(st).count.start;
    const lineup = (ids) => s.apply({ type: "lineup", gameId: "g", personId: "p1", eventId: next.id, ids });
    assert.equal(lineup(mine.slice(0, n)).status, "accepted");
    assert.equal(lineup([st.castaways.find((x) => !x.ownerIds.includes("p1")).id]).status, "rejected", "someone else's athlete");
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(next.airsAt) + 60000).toISOString() }).status, "accepted");
    assert.equal(lineup(mine.slice(-n)).status, "rejected", "it has started");
  } finally {
    s.dispose();
  }
});

test("nobody's copy holds a week past their mark, and a saved state holds no lines at all", () => {
  const s = R.open(define("hockey/nhl", "short", { timing: "own-pace", marks: [{ personId: "p1", contextId: "sport", through: 2 }, { personId: "p2", contextId: "sport", through: 1 }, { personId: "p3", contextId: "sport", through: 0 }] }));
  try {
    const st = s.snapshot().games.g.state;
    for (const [pid, mark] of [["p1", 2], ["p2", 1], ["p3", 0]]) {
      const view = S.GhostLogic.viewFor(st, pid, mark);
      // (A copy at its own pace ends at the episode the person plays next: whatever it holds, nothing past their mark has lines.)
      assert.ok(view.episodes.length >= Math.min(mark + 1, 4), `${pid} through ${mark}: the episodes they've seen and the next`);
      for (const e of view.episodes) {
        assert.equal(!!e.statLines, e.number <= mark, `${pid} through ${mark}: episode ${e.number}'s lines`);
        assert.equal(S.episodeHasResults(e), e.number <= mark, `${pid} through ${mark}: episode ${e.number}'s results`);
      }
    }
    // What the server keeps: no stamped key (db.ts leaves them out); the same lines stamped again give the same table.
    const kept = Sports.saved(st), stamped = S.StatsLogic.stampedKeys();
    const has = (v) => v && typeof v === "object" && (Array.isArray(v) ? v.some(has) : Object.entries(v).some(([k, x]) => stamped.includes(k) || has(x)));
    assert.equal(has(kept), false);
    assert.deepEqual(table(kept), { p1: 0, p2: 0, p3: 0 });
    const world = s.snapshot().contexts.sport;
    Sports.applyFacts(world, kept, (e) => ["partial", "final", "corrected"].includes(e.resultStatus));
    assert.deepEqual(table(kept), table(st));
  } finally {
    s.dispose();
  }
});

test("what isn't connected says so: stats on a show, a show's game on a sport, points by place, categories, a daily lock", () => {
  const gapsOf = (doc) => P.inspect(doc).gaps.map((g) => g.path.replace(/^\/games\/0\/spec/, "") + " :: " + g.reason);
  const nfl = Bench.resolve("football/nfl", "short").row.spec;
  const onShow = D.create({ seed: 1, world: { contexts: [{ id: "show", kind: "show", format: { id: "survivor" }, engine: { couch: 3, pool: 12, results: true } }], people: PEOPLE }, games: [{ id: "g", contextId: "show", spec: nfl }], situation: { clock: "2099-01-10T12:00:00.000Z" }, content: {} });
  assert.ok(gapsOf(onShow).some((g) => /^\/score\/by :: .*needs a sport context/.test(g)));
  assert.ok(gapsOf(define("football/nfl", { preset: "outlast" })).some((g) => /^\/score\/by :: Only a game scored by the sport's stats/.test(g)));
  assert.deepEqual(gapsOf(define("football/nfl", "season")), [], "the NFL's season, head to head and locking by the week, runs since core-runtime-34");
  assert.ok(gapsOf(define("football/nfl", { ...nfl, closes: "game" })).some((g) => /^\/closes ::/.test(g)), "a lock at each game's own start is next");
  const cats = Bench.catalog().find((c) => c.games.some((g) => g.id === "categories"));
  assert.deepEqual(gapsOf(define(cats.id, "categories")), [], "a league's categories game runs since the third slice");
  assert.ok(gapsOf(define(cats.id, { ...Bench.resolve(cats.id, "categories").row.spec, rank: { by: "total" } })).some((g) => /^\/rank\/by :: /.test(g)), "categories have no points to total");
  const placed = Bench.catalog().find((c) => ["golf", "racing"].includes(c.sport));
  assert.ok(gapsOf(define(placed.id, "season")).some((g) => /^\/score\/byPlace :: /.test(g)) || gapsOf(define(placed.id, "season")).length === 0);
});

test("a generated cast's names are distinct at any pool size (a best ball's pool is past 40; the season's cast is a row a name)", () => {
  const Data = require(path.join(root, "tools/gameplay-bench/explorer/runtime-data.cjs"));
  for (const labels of [undefined, "shared", "long", "unbroken"]) {
    const names = Array.from({ length: 1000 }, (_, i) => Data.participantName({ content: { labels } }, i));
    assert.equal(new Set(names).size, 1000, String(labels));
  }
  // The names a show's pool has always had are the names they were.
  const plain = (i) => Data.participantName({ content: {} }, i);
  assert.deepEqual([plain(0), plain(1), plain(39)], ["Avery Alvarez", "Blake Brooks", "Oren Tanaka"]);
  assert.equal(Data.participantName({ content: { labels: "shared" } }, 1), "Avery Brooks", "a shared first name, a last name of their own");
  // A best ball's world, as the runtime makes it: nobody shares a name.
  const s = R.open(define("baseball/mlb", "bestBall"));
  try {
    const cast = s.snapshot().contexts.sport.participants.map((p) => p.name);
    assert.ok(cast.length > 40);
    assert.equal(new Set(cast).size, cast.length);
  } finally { s.dispose(); }
});

test("who is told what on a sport's season: results straight away, unless you hide sports scores too or play only at your own pace", () => {
  const proof = require(path.join(root, "tests/fixtures/gameplay-explorer/sports-proof.cjs"));
  const tables = (o) => {
    const s = R.open(proof({ league: "basketball/nba", game: "short", ...o }));
    try { return { snap: s.snapshot(), ann: s.project("g", "ann").game, bo: s.project("g", "bo").game }; } finally { s.dispose(); }
  };
  const totals = (v) => v.table.map((r) => [r.playerId, r.total]);
  // A live game, Ann a game behind and nobody hiding scores: she is told everything, as Bo is (sports are live).
  const live = tables({ timing: "live-only" });
  assert.deepEqual(totals(live.ann), totals(live.bo));
  assert.deepEqual(live.ann.plays.rows.ann.map((w) => w.episode), [1, 2], "both games on her grid");
  assert.equal(Sports.guard(live.snap, [{ id: "g", contextId: "sport" }], "sport", "ann"), Infinity);
  // The same game with "Sports scores too" on for Ann: her mark decides, and game 2 isn't hers to see yet.
  const hidden = tables({ timing: "live-only", hides: ["ann"] });
  assert.notDeepEqual(totals(hidden.ann), totals(hidden.bo));
  assert.deepEqual(hidden.ann.plays.rows.ann.map((w) => w.episode), [1]);
  assert.deepEqual(totals(hidden.bo), totals(live.bo), "Bo's is as it was");
  assert.equal(Sports.guard(hidden.snap, [{ id: "g", contextId: "sport" }], "sport", "ann"), 1);
  // At its own pace every seat goes by its own mark, whatever the setting.
  const paced = tables({ timing: "own-pace" });
  assert.deepEqual(totals(paced.ann), totals(hidden.ann));
  assert.equal(Sports.guard(paced.snap, [{ id: "g", contextId: "sport" }], "sport", "ann"), 1);
  // Her table at her mark is game 1's box score alone, worked out apart from the engine.
  const want = expected({ ...hidden.snap, contexts: { sport: { ...hidden.snap.contexts.sport, events: hidden.snap.contexts.sport.events.map((e) => (e.number > 1 ? { ...e, resultStatus: "none" } : e)) } } });
  assert.deepEqual(Object.fromEntries(totals(hidden.ann)), want);
});

test("an athlete's points on the lineup sheet are their stat lines' at the game's table, as far as the viewer is told (they read 0)", () => {
  const proof = require(path.join(root, "tests/fixtures/gameplay-explorer/sports-proof.cjs"));
  const nfl = Bench.resolve("football/nfl", "short").row.spec, spec = { ...nfl, get: { ...nfl.get, each: 4 }, count: { start: 2 } };
  const s = R.open(proof({ league: "football/nfl", game: spec, timing: "live-only", hides: ["ann"] }));
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, c = Sports.league(world.context), table = S.gameOf(snap.games.g.state).score.points;
    const points = (line) => round(Object.entries(table).reduce((n, [stat, each]) => n + round((c.sport.full(line)[stat] || 0) * each), 0));
    const through = (n) => Object.fromEntries(world.participants.map((p) => [p.id, round(world.events.filter((e) => e.number <= n && ["final", "corrected"].includes(e.resultStatus)).reduce((t, e) => t + points(world.facts.find((f) => f.eventId === e.id).data.lines[p.id]), 0))]));
    const cast = (who) => Object.fromEntries(s.project("g", who).game.cast.map((x) => [x.id, x.points]));
    assert.deepEqual(cast("bo"), through(2), "Bo, caught up: both games' lines, for everyone the league has, held or not");
    assert.ok(Object.values(through(2)).some((v) => v !== 0));
    assert.deepEqual(cast("ann"), through(1), "Ann, a game behind with Sports scores too on: game 1's alone");
    assert.notDeepEqual(through(1), through(2));
  } finally { s.dispose(); }
});

// ---- Second slice (core-runtime-34): locks by the day or the week, and head to head.
const proofOf = require(path.join(root, "tests/fixtures/gameplay-explorer/sports-proof.cjs"));
const lineupSpec = () => { const nfl = Bench.resolve("football/nfl", "short").row.spec; return { ...nfl, get: { ...nfl.get, each: 4 }, count: { start: 2 } }; };
// Games of one week and the next, Eastern time (January: UTC-5). Tuesday starts a week: Monday night's game is still last week's
// though it's Tuesday in UTC.
const WEEK = [
  "2099-01-08T01:00:00.000Z", // 1  Wed 8 PM
  "2099-01-10T01:00:00.000Z", // 2  Fri 8 PM
  "2099-01-11T18:00:00.000Z", // 3  Sun 1 PM
  "2099-01-13T01:00:00.000Z", // 4  Mon 8 PM (Tuesday in UTC)
  "2099-01-14T00:00:00.000Z", // 5  Tue 7 PM: the next week
  "2099-01-16T01:00:00.000Z", // 6  Thu 8 PM
];
const locksOfCase = (s) => { const snap = s.snapshot(), m = Sports.lockTimes(snap.contexts.sport, snap.games.g.state); return m && Object.fromEntries(m); };
const put = (s, n, ids) => s.apply({ type: "lineup", gameId: "g", personId: "bo", eventId: "sport-event-" + n, ids });

test("a weekly lock: every game of a week locks at the week's first start, Tuesday to Monday in Eastern time; a lock at the start doesn't", () => {
  const open = (closes) => R.open(proofOf({ league: "football/nfl", game: lineupSpec(), closes, schedule: WEEK, completed: 1, clock: "2099-01-08T17:00:00.000Z", timing: "live-only", ann: 1, bo: 1, cy: 1 }));
  const s = open("weekly");
  try {
    assert.deepEqual(P.inspect(s.export().input).gaps, []);
    assert.deepEqual(locksOfCase(s), { 1: WEEK[0], 2: WEEK[0], 3: WEEK[0], 4: WEEK[0], 5: WEEK[4], 6: WEEK[4] }, "Monday night's with its week; Tuesday's starts the next");
    // Thursday noon: Wednesday's game has started, so Friday's lineup is locked though Friday's game is a day and a half away.
    const l = s.project("g", "bo").game.lineup;
    assert.deepEqual([l.episode, l.locked, l.lockedBy], [2, true, "week"]);
    const hash = s.hash();
    assert.equal(put(s, 2, l.roster.slice(2, 4)).message, "This week's lineups are locked -- its first game has started", "not that the episode has started: it hasn't");
    assert.equal(s.hash(), hash, "a refused lineup changes nothing");
    assert.ok(s.snapshot().games.g.state.episodes.every((e) => !("locksAt" in e)), "the kept state holds no lock (the server stamps them on a read)");
    // The week is played with the lineups that stood; then Tuesday's is open until it starts, and Thursday's locks with it.
    const world = s.snapshot().contexts.sport;
    for (const n of [2, 3, 4]) {
      assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(WEEK[n - 1]) + 3600000).toISOString() }).status, "accepted");
      assert.equal(s.apply({ type: "results", contextId: "sport", eventId: "sport-event-" + n, source: "provider-fixture", resultStatus: "final", data: { events: [], scoringEvents: [], lines: Sports.linesFor(world.context, world.participants, (i) => i * 3 + n) } }).status, "accepted");
      for (const p of ["ann", "bo", "cy"]) assert.equal(s.apply({ type: "reveal", contextId: "sport", personId: p }).status, "accepted");
    }
    const next = s.project("g", "bo").game.lineup;
    assert.deepEqual([next.episode, next.locked, next.lockedBy], [5, false, null], "Monday 9 PM: Tuesday's lineup is open");
    assert.equal(put(s, 5, next.roster.slice(2, 4)).status, "accepted");
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(WEEK[4]) + 3600000).toISOString() }).status, "accepted");
    assert.equal(put(s, 5, next.roster.slice(0, 2)).message, "This episode has started -- lineups are locked", "its own game has begun");
    assert.equal(s.project("g", "bo").game.lineup.lockedBy, null);
  } finally { s.dispose(); }
  const plain = open("start");
  try {
    assert.equal(locksOfCase(plain), null);
    const l = plain.project("g", "bo").game.lineup;
    assert.deepEqual([l.episode, l.locked], [2, false], "at the start: Friday's lineup is open until Friday's game");
    assert.equal(put(plain, 2, l.roster.slice(2, 4)).status, "accepted");
  } finally { plain.dispose(); }
});

test("a daily lock: two games on one Eastern day lock at the first; a game that starts later doesn't lock with one before it", () => {
  // Wed 1 PM, Wed 7 PM (Thursday in UTC), Thu 7 PM.
  const DAY = ["2099-01-07T18:00:00.000Z", "2099-01-08T00:00:00.000Z", "2099-01-09T00:00:00.000Z"];
  const nba = Bench.resolve("basketball/nba", "short").row.spec;
  const open = (o) => R.open(proofOf({ league: "basketball/nba", game: { ...nba, get: { ...nba.get, each: 4 }, count: { start: 2 } }, schedule: DAY, completed: 0, clock: "2099-01-07T20:00:00.000Z", timing: "live-only", ann: 0, bo: 0, cy: 0, ...o }));
  const daily = open({ closes: "daily" });
  try {
    assert.deepEqual(locksOfCase(daily), { 1: DAY[0], 2: DAY[0], 3: DAY[2] });
    const world = daily.snapshot().contexts.sport;
    assert.equal(daily.apply({ type: "results", contextId: "sport", eventId: "sport-event-1", source: "provider-fixture", resultStatus: "final", data: { events: [], scoringEvents: [], lines: Sports.linesFor(world.context, world.participants, (i) => i + 1) } }).status, "accepted");
    assert.equal(daily.apply({ type: "reveal", contextId: "sport", personId: "bo" }).status, "accepted");
    const l = daily.project("g", "bo").game.lineup;
    assert.deepEqual([l.episode, l.locked, l.lockedBy], [2, true, "day"], "3 PM: the evening game's lineup locked with the afternoon's");
    assert.equal(put(daily, 2, l.roster.slice(2, 4)).message, "This day's lineups are locked -- its first game has started");
  } finally { daily.dispose(); }
  // The same day for a game that starts with the evening game: its first lock is its own start.
  const later = open({ closes: "daily", from: 2 });
  try {
    assert.deepEqual(locksOfCase(later), { 2: DAY[1], 3: DAY[2] });
    const l = later.project("g", "bo").game.lineup;
    assert.deepEqual([l.episode, l.locked], [2, false]);
    assert.equal(put(later, 2, l.roster.slice(2, 4)).status, "accepted");
  } finally { later.dispose(); }
});

test("the calendar a real-route harness sets: the schedule's days and weeks are read where it's written, the kept state and its hash unchanged", () => {
  const s = R.open(proofOf({ league: "football/nfl", game: lineupSpec(), closes: "weekly", schedule: WEEK, completed: 1, clock: "2099-01-08T17:00:00.000Z", timing: "live-only", ann: 1, bo: 1, cy: 1 }));
  try {
    const hash = s.hash(), snap = s.snapshot(), at = (shift) => Object.fromEntries(Sports.lockTimes(snap.contexts.sport, snap.games.g.state, shift));
    // Written three days on, Wednesday's game is a Saturday's and Sunday's a Wednesday's: the week turns over between Friday's
    // and Sunday's games, so Friday's lineup is still the first week's (locked) and Sunday's starts a week of its own.
    s.calendar(3 * 86400000);
    assert.deepEqual(at(3 * 86400000), { 1: WEEK[0], 2: WEEK[0], 3: WEEK[2], 4: WEEK[2], 5: WEEK[2], 6: WEEK[2] });
    assert.equal(s.hash(), hash);
    assert.equal(s.project("g", "bo").game.lineup.locked, true, "Friday's game: still its week's lock");
    // Five days on, Wednesday's is a Monday's (the last day of a week) and Friday's a Wednesday's: Friday's lineup is open.
    s.calendar(5 * 86400000);
    assert.equal(s.project("g", "bo").game.lineup.locked, false);
    assert.equal(put(s, 2, s.project("g", "bo").game.lineup.roster.slice(2, 4)).status, "accepted");
    // The clocks changing (spring forward, Sunday 2099-03-08): the days are the moved instants' Eastern days. Written 59 days on,
    // Wednesday 8 PM EST is Saturday 2099-03-07 8 PM EST and Friday's is Monday 9 PM EDT: one week still, by the clock there.
    s.calendar(0);
    const moved = at(59 * 86400000);
    assert.equal(moved[2], WEEK[0], "Saturday and Monday night of one week");
    assert.equal(moved[3], WEEK[2], "Wednesday's (Sunday's game, moved) starts the next");
    assert.throws(() => s.calendar("soon"), /milliseconds/);
  } finally { s.dispose(); }
});

test("head to head on a sport: the league's own season opens; a week's result is who scored more from the box scores", () => {
  for (const league of ["football/nfl", "basketball/nba", "hockey/nhl"]) assert.deepEqual(P.inspect(proofOf({ league, game: "season" })).gaps, [], league);
  // Two seats, so every week is the two of them: the record is worked out here from each week's box score.
  const doc = proofOf({ league: "basketball/nba", game: "season", timing: "live-only", ann: 2, bo: 2, cy: 2 });
  const world0 = { ...doc.world, people: doc.world.people.slice(0, 2), contexts: [{ ...doc.world.contexts[0], engine: { ...doc.world.contexts[0].engine, couch: 2 } }] };
  const s = R.open(D.create({ seed: doc.seed, world: world0, games: doc.games.map(({ id, contextId, timing, spec }) => ({ id, contextId, timing, spec })), situation: { clock: doc.situation.clock, marks: doc.situation.marks.slice(0, 2) }, content: doc.content }));
  try {
    const snap = s.snapshot(), st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st);
    assert.equal(spec.rank.by, "matchups"); assert.equal(spec.closes, "daily");
    const pts = (line) => round(Object.entries(spec.score.points).reduce((n, [stat, each]) => n + round((c.sport.full(line)[stat] || 0) * each), 0));
    const week = (p, e) => round(S.ActiveRosterLogic.lineupFor(st, e.id, p).reduce((n, id) => n + pts(world.facts.find((f) => f.eventId === e.id).data.lines[id]), 0));
    const played = world.events.filter((e) => e.resultStatus === "final");
    const want = { ann: { wins: 0, losses: 0, ties: 0 }, bo: { wins: 0, losses: 0, ties: 0 } };
    for (const e of played) { const a = week("ann", e), b = week("bo", e); if (a > b) { want.ann.wins++; want.bo.losses++; } else if (b > a) { want.bo.wins++; want.ann.losses++; } else { want.ann.ties++; want.bo.ties++; } }
    const v = s.project("g", "ann").game;
    for (const p of ["ann", "bo"]) { const r = v.table.find((x) => x.playerId === p).record; assert.deepEqual({ wins: r.wins, losses: r.losses, ties: r.ties }, want[p], p); }
    assert.equal(want.ann.wins + want.ann.losses + want.ann.ties, 2);
    assert.equal(v.matchups.next.opponent, "bo");
  } finally { s.dispose(); }
});

// ---- Third slice (core-runtime-35): a sport's categories, head to head and roto.
/** Each seat's category totals over some of a case's games, from the box scores and the lineups the full state holds. */
function categoryTotals(snap, events) {
  const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), defs = c.sport.categoryDefs();
  const lines = (p) => events.flatMap((e) => { const box = world.facts.find((f) => f.eventId === e.id).data.lines; return (spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p) : st.castaways.filter((x) => x.ownerIds.includes(p)).map((x) => x.id)).map((id) => box[id]).filter(Boolean).map((l) => c.sport.full(l)); });
  return { defs, cats: spec.score.categories, bySeat: Object.fromEntries(st.players.map((p) => [p.id, Oracle.totals(lines(p.id), spec.score.categories, defs)])) };
}
const playedOf = (snap) => snap.contexts.sport.events.filter((e) => ["final", "corrected"].includes(e.resultStatus));

test("the categories oracle is the rule: a rate from the counts added up and only its group's lines, the better value, a week, roto with ties shared", () => {
  const defs = { PTS: { better: "higher", group: "a" }, TO: { better: "lower", group: "a" }, "FG%": { better: "higher", group: "a", parts: { top: { FGM: 1 }, bottom: { FGA: 1 } } }, GAA: { better: "lower", group: "g", parts: { top: { GA: 60 }, bottom: { MIN: 1 } } }, GA: { better: "lower", group: "g" }, MIN: { better: "higher", group: "g" }, FGM: { better: "higher", group: "a" }, FGA: { better: "higher", group: "a" } };
  // 1 of 10 and 9 of 10 is 10 of 20, not the average of 10% and 90% weighted otherwise; a goalie's line adds nothing to FG%.
  const lines = [{ PTS: 2, FGM: 1, FGA: 10, TO: 3 }, { PTS: 18, FGM: 9, FGA: 10, TO: 1 }, { GA: 2, MIN: 60 }];
  assert.deepEqual(Oracle.totals(lines, ["PTS", "TO", "FG%", "GAA"], defs), { PTS: 20, TO: 4, "FG%": 0.5, GAA: 2 });
  assert.equal(Oracle.total([{ PTS: 4 }], "FG%", defs), null, "nothing to divide by: no value");
  assert.deepEqual([Oracle.better(4, 3, defs, "TO"), Oracle.better(4, 3, defs, "PTS"), Oracle.better(null, 0, defs, "FG%"), Oracle.better(null, null, defs, "FG%"), Oracle.better(0.5, 0.5, defs, "FG%")], [-1, 1, -1, 0, 0]);
  assert.deepEqual(Oracle.week({ PTS: 20, TO: 4, "FG%": 0.5 }, { PTS: 20, TO: 6, "FG%": 0.6 }, ["PTS", "TO", "FG%"], defs), { won: 1, lost: 1, tied: 1, result: "tie" });
  // Three seats, two categories: PTS 30, 30, 10 (two share first: 2.5 each, the third 1); TO 2, 5, 5 (fewest is best: 3; the others share 1.5).
  assert.deepEqual(Oracle.roto({ a: { PTS: 30, TO: 5 }, b: { PTS: 30, TO: 2 }, c: { PTS: 10, TO: 5 } }, ["PTS", "TO"], defs), { a: 4, b: 5.5, c: 2.5 });
  assert.equal(Oracle.quiet([{ PTS: 0, "FG%": null }, { PTS: 0, "FG%": null }], ["PTS", "FG%"]), true);
});

test("roto: every league's own roto game is each category ranked across the seats, from the box scores (a rate from the counts added up)", () => {
  const leagues = Bench.catalog().filter((c) => c.games.some((g) => g.id === "roto" && g.implemented)).map((c) => c.id);
  assert.ok(leagues.length >= 5, "the leagues with a roto game: " + leagues.join(", "));
  for (const league of leagues) {
    const doc = proofOf({ league, game: "roto", timing: "live-only", ann: 2, hides: [] });
    assert.deepEqual(P.inspect(doc).gaps, [], league);
    const s = R.open(doc);
    try {
      const snap = s.snapshot(), t = categoryTotals(snap, playedOf(snap)), want = Oracle.roto(t.bySeat, t.cats, t.defs);
      const got = Object.fromEntries(s.project("g", "bo").game.table.map((r) => [r.playerId, r.total]));
      assert.deepEqual(got, want, league);
      assert.ok(t.cats.some((k) => t.defs[k] && t.defs[k].parts), league + ": a rate among its categories");
      assert.ok(new Set(Object.values(want)).size > 1, league + ": the seats differ");
    } finally { s.dispose(); }
  }
});

test("roto as far as someone has watched: with Sports scores too on, a seat a game behind sees the table of the games they've seen", () => {
  const s = R.open(proofOf({ league: "basketball/nba", game: "roto", timing: "live-only", hides: ["ann"] }));
  try {
    const snap = s.snapshot(), all = playedOf(snap), upTo = (n) => { const t = categoryTotals(snap, all.filter((e) => e.number <= n)); return Oracle.roto(t.bySeat, t.cats, t.defs); };
    const table = (who) => Object.fromEntries(s.project("g", who).game.table.map((r) => [r.playerId, r.total]));
    assert.deepEqual(table("bo"), upTo(2));
    assert.deepEqual(table("ann"), upTo(1), "Ann, held to her mark: game 1 alone");
    assert.notDeepEqual(upTo(1), upTo(2));
  } finally { s.dispose(); }
});

test("categories head to head: with two seats the record is every category of every week, won, lost or tied, from the box scores", () => {
  for (const league of ["basketball/nba", "baseball/mlb", "hockey/nhl"]) {
    const doc = proofOf({ league, game: "categories", timing: "live-only", ann: 2, bo: 2, cy: 2 });
    assert.deepEqual(P.inspect(doc).gaps, [], league);
    const world0 = { ...doc.world, people: doc.world.people.slice(0, 2), contexts: [{ ...doc.world.contexts[0], engine: { ...doc.world.contexts[0].engine, couch: 2 } }] };
    const s = R.open(D.create({ seed: doc.seed, world: world0, games: doc.games.map(({ id, contextId, timing, spec }) => ({ id, contextId, timing, spec })), situation: { clock: doc.situation.clock, marks: doc.situation.marks.slice(0, 2) }, content: doc.content }));
    try {
      const snap = s.snapshot(), want = { ann: { wins: 0, losses: 0, ties: 0 }, bo: { wins: 0, losses: 0, ties: 0 } };
      let lastWeek = null;
      for (const e of playedOf(snap)) {
        const t = categoryTotals(snap, [e]), w = Oracle.week(t.bySeat.ann, t.bySeat.bo, t.cats, t.defs);
        if (Oracle.quiet(Object.values(t.bySeat), t.cats)) continue;
        want.ann.wins += w.won; want.ann.losses += w.lost; want.ann.ties += w.tied; want.bo.wins += w.lost; want.bo.losses += w.won; want.bo.ties += w.tied;
        lastWeek = { episode: e.number, ...w };
      }
      const v = s.project("g", "ann").game;
      for (const p of ["ann", "bo"]) { const r = v.table.find((x) => x.playerId === p).record; assert.deepEqual({ wins: r.wins, losses: r.losses, ties: r.ties }, want[p], league + " " + p); }
      assert.ok(want.ann.wins + want.ann.losses + want.ann.ties >= 9, league + ": two weeks of categories");
      // Her last week: the categories each side won, and who won more.
      assert.deepEqual([v.matchups.last.episode, v.matchups.last.points, v.matchups.last.against, v.matchups.last.result], [lastWeek.episode, lastWeek.won, lastWeek.lost, lastWeek.result], league);
    } finally { s.dispose(); }
  }
});

test("most categories ('matchups' on categories): the week goes to whoever won more of them", () => {
  const base = Bench.resolve("basketball/nba", "categories").row.spec, doc = proofOf({ league: "basketball/nba", game: { ...base, rank: { ...base.rank, by: "matchups" } }, timing: "live-only", ann: 2, bo: 2, cy: 2 });
  assert.deepEqual(P.inspect(doc).gaps, []);
  const world0 = { ...doc.world, people: doc.world.people.slice(0, 2), contexts: [{ ...doc.world.contexts[0], engine: { ...doc.world.contexts[0].engine, couch: 2 } }] };
  const s = R.open(D.create({ seed: doc.seed, world: world0, games: doc.games.map(({ id, contextId, timing, spec }) => ({ id, contextId, timing, spec })), situation: { clock: doc.situation.clock, marks: doc.situation.marks.slice(0, 2) }, content: doc.content }));
  try {
    const snap = s.snapshot(), want = { wins: 0, losses: 0, ties: 0 };
    for (const e of playedOf(snap)) { const t = categoryTotals(snap, [e]), w = Oracle.week(t.bySeat.ann, t.bySeat.bo, t.cats, t.defs); want[w.result === "win" ? "wins" : w.result === "loss" ? "losses" : "ties"]++; }
    const r = s.project("g", "ann").game.table.find((x) => x.playerId === "ann").record;
    assert.deepEqual({ wins: r.wins, losses: r.losses, ties: r.ties }, want);
    assert.equal(want.wins + want.losses + want.ties, 2, "a week a result");
  } finally { s.dispose(); }
});

test("head to head by categories on its page: each seat's record and each week won or lost by the categories, not a points game's zeros (BACKLOG 77)", () => {
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
  const M = jiti(path.join(root, "src/lib/game/game-page/model.ts"));
  const doc = proofOf({ league: "basketball/nba", game: "categories", timing: "live-only", ann: 2, bo: 2, cy: 2 });
  const world0 = { ...doc.world, people: doc.world.people.slice(0, 2), contexts: [{ ...doc.world.contexts[0], engine: { ...doc.world.contexts[0].engine, couch: 2 } }] };
  const s = R.open(D.create({ seed: doc.seed, world: world0, games: doc.games.map(({ id, contextId, timing, spec }) => ({ id, contextId, timing, spec })), situation: { clock: doc.situation.clock, marks: doc.situation.marks.slice(0, 2) }, content: doc.content }));
  try {
    const snap = s.snapshot(), v = s.project("g", "ann").game;
    // The season grid: a week is won, lost or tied, its numbers the categories each side won that week, from the box score.
    assert.equal(v.plays.kind, "result");
    for (const e of playedOf(snap)) {
      const t = categoryTotals(snap, [e]), w = Oracle.week(t.bySeat.ann, t.bySeat.bo, t.cats, t.defs), sq = v.plays.rows.ann.find((x) => x.episode === e.number).result;
      assert.deepEqual([sq.r, sq.us, sq.them, sq.against], [w.result === "win" ? "W" : w.result === "loss" ? "L" : "T", w.won, w.lost, "bo"], "game " + e.number);
    }
    // The page: each row's number is the record, under "W–L"; your own block says the last week and your record.
    const model = M.pageModel(v, v.page, { show: "ZT", words: { episode: "Game", episodes: "Games" }, next: { number: 3, airsAt: null }, when: (iso) => iso, move: null, seen: null });
    const rec = (p) => { const r = v.table.find((x) => x.playerId === p).record; return r.wins + "–" + r.losses + (r.ties ? "–" + r.ties : ""); };
    const drawn = JSON.stringify(model);
    for (const p of ["ann", "bo"]) assert.ok(drawn.includes('"' + rec(p) + '"') || drawn.includes(rec(p)), p + "'s record " + rec(p) + " is on the page's model");
    assert.ok(drawn.includes("W–L"), "the table's column is the record");
    assert.match(model.hero.sub || "", /Game 2 final: you (beat|lost to|tied with) Bo/);
    assert.ok((model.hero.sub || "").includes("you're " + rec("ann")));
    // Roto keeps its points: the table is the roto total.
    const r2 = R.open(proofOf({ league: "basketball/nba", game: "roto", timing: "live-only", ann: 2 }));
    try { assert.equal(r2.project("g", "ann").game.plays.kind, "points"); } finally { r2.dispose(); }
  } finally { s.dispose(); }
});

// ---- Fourth slice (core-runtime-36): points by place, a field's results (golf's, racing's). ----

test("the points-by-place oracle is the rule: a place's or its range's points, nothing out of the table or with no place, a placed stat never a count too", () => {
  const golf = { points: { BIR: 3.5, BOG: -1.3 }, byPlace: { POS: { 1: 25, 2: 12, 3: 10, "4-10": 8, "11-20": 3 } } };
  assert.deepEqual([1, 2, 3, 4, 9, 10, 11, 20, 21, 150, null, undefined].map((p) => Oracle.placePoints(golf.byPlace.POS, p)), [25, 12, 10, 8, 8, 8, 3, 3, 0, 0, 0, 0]);
  // T9 is 9th's points, whoever shares it: 4 birdies (14), a bogey (-1.3), 9th (8).
  assert.equal(Oracle.linePoints(golf, Oracle.placed({ BIR: 4, BOG: 1 }, { id: "a", place: 9, tied: true, status: "in", madeCut: true }, "golf")), 20.7);
  // Cut: no place, so nothing for it (its counts still score).
  assert.equal(Oracle.linePoints(golf, Oracle.placed({ BIR: 2 }, { id: "a", place: null, tied: false, status: "cut", madeCut: false }, "golf")), 7);
  // A stat the table places is scored by place alone, never as a count of its place too.
  assert.equal(Oracle.linePoints({ points: { POS: 5 }, byPlace: { POS: { 1: 1 } } }, { POS: 1 }), 1);
  // F1: three place stats in one line (the race's, the sprint's, qualifying's), each by its own table.
  const f1 = { points: { DNF: -20 }, byPlace: { POS: { 1: 25, 2: 18 }, SPR: { 1: 8, 2: 7 }, QUAL: { 1: 10, 2: 9 } } };
  assert.equal(Oracle.linePoints(f1, { POS: 2, SPR: 1, QUAL: 2, DNF: 0 }), 18 + 8 + 9);
  assert.equal(Oracle.linePoints(f1, { POS: 12, QUAL: 1, DNF: 1 }), -20 + 10, "no sprint this weekend: SPR scores nothing");
  // What a place puts in a line: golf's top-n and the cut made; racing's podium.
  assert.deepEqual(Oracle.placed({}, { id: "a", place: 4, tied: false, status: "in", madeCut: true }, "golf"), { POS: 4, TOP5: 1, TOP10: 1, TOP20: 1, TOP25: 1, CUT: 1 });
  assert.deepEqual(Oracle.placed({}, { id: "a", place: 1, tied: false, status: "in" }, "racing"), { POS: 1, W: 1, TOP5: 1, TOP10: 1, PODIUM: 1 });
});

test("a field's results are its lines and its standings: no place in a line, the kept line the app's own placeStats, as the oracle says", () => {
  for (const league of ["golf/pga", "golf/liv", "racing/f1", "racing/nascar-premier"]) {
    const s = R.open(proofOf({ league, game: "short", completed: 3, events: 5 }));
    try {
      const snap = s.snapshot(), world = snap.contexts.sport, c = Sports.league(world.context), st = snap.games.g.state;
      for (const f of world.facts) {
        const ids = Object.keys(f.data.lines);
        assert.deepEqual(f.data.standings.map((x) => x.id).sort(), [...ids].sort(), league + ": a standing an athlete");
        assert.ok(ids.every((id) => !c.sport.placeKeys.some((k) => k in f.data.lines[id])), league + ": a place is the standings'");
        const kept = Sports.keptLines(world.context, f.data);
        for (const id of ids) assert.deepEqual(kept[id], Oracle.placed(f.data.lines[id], f.data.standings.find((x) => x.id === id), c.sport.id), league + " " + id);
        // A place is from 1 for whoever is in, unique on a race (nobody ties), shared on a course; one winner.
        const placed = f.data.standings.filter((x) => x.place !== null);
        assert.ok(placed.every((x) => x.status === "in" && x.place >= 1));
        if (c.sport.id === "racing") assert.equal(new Set(placed.map((x) => x.place)).size, placed.length, league + ": a race has no ties");
        for (const x of placed) if (placed.filter((y) => y.place === x.place).length > 1) assert.ok(x.tied, league + ": a shared place is tied");
        assert.ok(placed.filter((x) => x.place === 1).length <= 1, league + ": one winner");
      }
      // The stamp carries each line's place.
      const ep = st.episodes.find((e) => e.number === 1), first = world.facts.find((f) => f.eventId === ep.id).data;
      const someone = first.standings.find((x) => x.place !== null);
      assert.equal(ep.statLines[someone.id].POS, someone.place);
    } finally { s.dispose(); }
  }
});

test("over a few seasons the generated fields reach every kind of place: a winner, a tie, the cut, a withdrawal or disqualification, a place past the table", () => {
  const seen = { tie: 0, cut: 0, out: 0, past20: 0, win: 0 };
  for (const [league, seed] of [["golf/pga", 1], ["golf/pga", 2], ["golf/lpga", 3], ["racing/nascar-premier", 4], ["racing/f1", 5], ["racing/f1", 6]]) {
    const s = R.open(proofOf({ league, game: "short", completed: 6, events: 7, seed }));
    try {
      for (const f of s.snapshot().contexts.sport.facts) for (const x of f.data.standings) {
        if (x.tied) seen.tie++;
        if (x.status === "cut") seen.cut++;
        if (["wd", "dq"].includes(x.status)) seen.out++;
        if (x.place > 20) seen.past20++;
        if (x.place === 1) seen.win++;
      }
    } finally { s.dispose(); }
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, k + ": " + JSON.stringify(seen));
});

test("a field's results are refused without standings, with a place in a line, a place out of step with its status, or an athlete twice", () => {
  const s = R.open(proofOf({ league: "golf/pga", game: "short", completed: 2, events: 4 }));
  try {
    const world = s.snapshot().contexts.sport, ev = world.events[2];
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }).status, "accepted");
    let k = 0;
    const good = Sports.resultsFor(world.context, world.participants, () => (k = (k * 7919 + 104729) % 1000003));
    const send = (data) => s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus: "final", data });
    const first = good.standings[0].id, placedOne = good.standings.find((x) => x.place !== null).id;
    const { standings, ...bare } = good;
    assert.match(send(bare).message, /standings/);
    assert.match(send({ ...good, lines: { ...good.lines, [first]: { ...good.lines[first], POS: 1 } } }).message, /places are its standings/);
    assert.match(send({ ...good, standings: standings.map((x) => (x.id === placedOne ? { ...x, status: "cut" } : x)) }).message, /standings/);
    assert.match(send({ ...good, standings: [...standings, standings[0]] }).message, /standings/);
    const before = table(s.snapshot().games.g.state);
    assert.equal(send(good).status, "accepted");
    assert.notDeepEqual(table(s.snapshot().games.g.state), before, "a third tournament's places and counts move the table");
  } finally { s.dispose(); }
});

test("a corrected field moves the table by the place alone: a placed golfer moved to 21st loses the place's points and nothing else moves", () => {
  const s = R.open(proofOf({ league: "golf/pga", game: "short", completed: 1, events: 3, ann: 1 }));
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, st = snap.games.g.state, f = world.facts[0].data, ev = world.events[0];
    const owner = (id) => st.castaways.find((x) => x.id === id)?.ownerIds[0];
    const table0 = S.gameOf(st).score.byPlace.POS;
    const mover = f.standings.filter((x) => owner(x.id) && x.place !== null).sort((a, b) => a.place - b.place)[0];
    const was = Oracle.placePoints(table0, mover.place);
    assert.ok(was > 0, "a held golfer placed in the table");
    const moved = { ...f, standings: f.standings.map((x) => (x.id === mover.id ? { ...x, place: 21, tied: false } : x)) };
    const before = table(snap.games.g.state);
    assert.equal(s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus: "corrected", data: moved }).status, "accepted");
    const after = table(s.snapshot().games.g.state), who = owner(mover.id);
    assert.equal(round(before[who] - after[who]), was, "the place's points come off");
    for (const p of Object.keys(before)) if (p !== who) assert.equal(after[p], before[p]);
  } finally { s.dispose(); }
});

// ---- Fifth slice (core-runtime-37): points by position, a stat's points by the holder's position group (FPL's, soccer's). ----

test("the points-by-position oracle is the rule: a group's points where the table has them for a stat, else the table's points; a group's 0 is 0", () => {
  const fpl = { points: { G: 5, CS: 1, GA2: 0, MIN60: 1 }, byPosition: { G: { GK: 10, DEF: 6, MID: 5, FWD: 4 }, CS: { GK: 4, DEF: 4, MID: 1, FWD: 0 }, GA2: { GK: -1, DEF: -1, MID: 0, FWD: 0 } } };
  const line = { G: 1, CS: 1, GA2: 1, MIN60: 1 };
  assert.deepEqual(["GK", "DEF", "MID", "FWD"].map((g) => Oracle.linePoints(fpl, line, g)), [10 + 4 - 1 + 1, 6 + 4 - 1 + 1, 5 + 1 + 0 + 1, 4 + 0 + 0 + 1]);
  // No group (or one the table leaves out): the table's points.
  assert.equal(Oracle.linePoints(fpl, line, null), 5 + 1 + 0 + 1);
  assert.equal(Oracle.linePoints(fpl, line, "COACH"), 5 + 1 + 0 + 1);
  // A stat only the groups score (no `points` for it) still scores for a group that has it.
  assert.equal(Oracle.linePoints({ points: {}, byPosition: { SV: { GK: 2 } } }, { SV: 3 }, "GK"), 6);
  assert.equal(Oracle.linePoints({ points: {}, byPosition: { SV: { GK: 2 } } }, { SV: 3 }, "DEF"), 0);
});

test("a soccer world: every group in the cast, a keeper's saves, goals conceded for everyone, so a clean sheet and every two conceded vary by group", () => {
  const s = R.open(proofOf({ league: "soccer/eng.1", game: "season", completed: 4, events: 5 }));
  try {
    const world = s.snapshot().contexts.sport, c = Sports.league(world.context);
    const group = (id) => groupOf(c, world, id);
    assert.deepEqual([...new Set(world.participants.map((p) => group(p.id)))].sort(), ["DEF", "FWD", "GK", "MID"]);
    const seen = {};
    for (const f of world.facts) for (const [id, raw] of Object.entries(f.data.lines)) {
      const l = c.sport.full(raw), g = group(id), k = (x) => (seen[g + " " + x] = (seen[g + " " + x] || 0) + 1);
      if (l.CS) k("CS"); else k("no CS");
      if (l.GA2) k("GA2");
      if (l.G) k("G");
      if (g === "GK") assert.ok("SV" in l, "a keeper's line has saves");
    }
    for (const want of ["GK CS", "GK no CS", "DEF CS", "DEF GA2", "MID CS", "MID no CS", "FWD G", "MID G"]) assert.ok(seen[want], want + ": " + JSON.stringify(seen));
  } finally { s.dispose(); }
});

test("by position on the table: a goal moved from a forward to a defender of the same seat is worth the groups' difference (6 less 4) and nothing else moves", () => {
  const s = R.open(proofOf({ league: "soccer/eng.1", game: "short", completed: 1, events: 3, ann: 1 }));
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, st = snap.games.g.state, c = Sports.league(world.context), f = world.facts[0].data;
    const seat = st.players.find((p) => { const mine = st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => groupOf(c, world, x.id)); return mine.includes("FWD") && mine.includes("DEF"); });
    assert.ok(seat, "a seat with a forward and a defender");
    const mine = st.castaways.filter((x) => x.ownerIds.includes(seat.id)).map((x) => x.id), fwd = mine.find((id) => groupOf(c, world, id) === "FWD"), def = mine.find((id) => groupOf(c, world, id) === "DEF");
    const lines = { ...f.lines, [fwd]: { ...f.lines[fwd], G: 1 }, [def]: { ...f.lines[def], G: 0 } }, moved = { ...f.lines, [fwd]: { ...f.lines[fwd], G: 0 }, [def]: { ...f.lines[def], G: 1 } };
    const send = (l) => assert.equal(s.apply({ type: "results", contextId: "sport", eventId: world.events[0].id, source: "provider-fixture", resultStatus: "corrected", data: { ...f, lines: l } }).status, "accepted");
    send(lines);
    const before = table(s.snapshot().games.g.state);
    send(moved);
    const after = table(s.snapshot().games.g.state);
    assert.equal(round(after[seat.id] - before[seat.id]), 6 - 4);
    for (const p of Object.keys(before)) if (p !== seat.id) assert.equal(after[p], before[p]);
  } finally { s.dispose(); }
});

// ---- Sixth slice (core-runtime-38): points by a match's format, a card's matches (tennis's best of five). ----

test("the points-by-format oracle is the rule: each match at its format's points, else the table's; the day's line beyond its matches at the table's", () => {
  const atp = { points: { MP: 30, SW: 6, SL: -3, W: 6 }, byFormat: { 5: { MP: 30, SW: 5, SL: -2.5, W: 5 } } };
  const five = { MP: 1, W: 1, SW: 3, SL: 1 }, three = { MP: 1, W: 1, SW: 2, SL: 1 };
  // A best of five at its own points: 30 + 5 + 15 - 2.5; a best of three at the table's: 30 + 6 + 12 - 3.
  assert.equal(Oracle.linePoints(atp, five, "MS", [{ format: 5, line: five }]), 47.5);
  assert.equal(Oracle.linePoints(atp, three, "MS", [{ format: 3, line: three }]), 45);
  // Without its matches, the day's line is at the table's points.
  assert.equal(Oracle.linePoints(atp, five, "MS", null), 30 + 6 + 18 - 3);
  // A day's line with more in it than its matches (the final's correction): the rest at the table's points.
  assert.equal(Oracle.linePoints(atp, { ...five, SW: 4 }, "MS", [{ format: 5, line: five }]), 47.5 + 6);
  // A table with no formats: every match at its own points.
  assert.equal(Oracle.linePoints({ points: atp.points }, five, "MS", [{ format: 5, line: five }]), 30 + 6 + 18 - 3);
});

test("a tennis day's results are its lines and its matches: a match each for whoever played, a best of five on a Grand Slam's men's day, a winner and a loser", () => {
  const seen = { five: 0, three: 0, outside: 0, rested: 0, retired: 0, straight: 0 };
  for (const [league, seed] of [["tennis/atp", 1], ["tennis/atp", 2], ["tennis/wta", 3]]) {
    const s = R.open(proofOf({ league, game: "short", completed: 4, events: 5, seed }));
    try {
      const snap = s.snapshot(), world = snap.contexts.sport, st = snap.games.g.state;
      for (const f of world.facts) {
        const { card, lines } = f.data;
        for (const b of card.bouts) {
          if (b.rounds === 5) seen.five++; else seen.three++;
          assert.ok(!(league.endsWith("/wta") && b.rounds === 5), "a women's match is best of three");
          const r = card.results.find((x) => x.bout === b.id);
          assert.ok(r && b.sides.includes(r.winner) && b.sides.includes(r.loser) && r.winner !== r.loser);
          if (b.sides.some((x) => x.startsWith("outside-"))) seen.outside++;
          const by = card.byBout[b.id];
          if (by[r.winner]) {
            assert.equal(by[r.winner].W, 1);
            if (by[r.winner].WRET) seen.retired++; else assert.equal(by[r.winner].SW, Math.ceil(b.rounds / 2), "a finished match's winner won the sets its format needs");
            if (by[r.winner].STR) { seen.straight++; assert.equal(by[r.winner].SL, 0); }
          }
          if (by[r.loser]) assert.equal(by[r.loser].L, 1);
        }
        // The day's line is its matches' added up; whoever played no match has none.
        for (const p of world.participants) {
          const mine = card.bouts.filter((b) => card.byBout[b.id]?.[p.id]);
          if (!mine.length) { assert.ok(!(p.id in lines)); seen.rested++; continue; }
          const sum = {}; for (const b of mine) for (const [k, v] of Object.entries(card.byBout[b.id][p.id])) sum[k] = (sum[k] || 0) + v;
          assert.deepEqual(lines[p.id], sum);
        }
      }
      // The stamp carries each one's matches at their format, as the server's boutsOf has them.
      const ep = st.episodes.find((e) => e.number === 1), f1 = world.facts.find((f) => f.eventId === ep.id).data;
      const someone = Object.keys(f1.lines)[0];
      assert.deepEqual(ep.statBouts[someone], Sports.boutsOf(f1, someone));
      assert.ok(ep.statBouts[someone].every((b) => [3, 5].includes(b.format)));
    } finally { s.dispose(); }
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, k + ": " + JSON.stringify(seen));
});

test("a card's results are refused without a match for a line, with a result for nobody, or a match's line for someone who didn't play it", () => {
  const s = R.open(proofOf({ league: "tennis/atp", game: "short", completed: 2, events: 4 }));
  try {
    const world = s.snapshot().contexts.sport, ev = world.events[2];
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(ev.airAt) + 3600000).toISOString() }).status, "accepted");
    let k = 0;
    const good = Sports.resultsFor(world.context, world.participants, () => (k = (k * 7919 + 104729) % 1000003));
    const send = (data) => s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus: "final", data });
    const b0 = good.card.bouts[0], x = b0.sides[0], stranger = world.participants.find((p) => !b0.sides.includes(p.id) && p.id in good.lines).id;
    assert.match(send({ ...good, card: { ...good.card, results: good.card.results.slice(1) } }).message, /matches/);
    assert.match(send({ ...good, card: { ...good.card, results: good.card.results.map((r, i) => (i ? r : { ...r, winner: "nobody" })) } }).message, /matches/);
    assert.match(send({ ...good, card: { ...good.card, byBout: { ...good.card.byBout, [b0.id]: { ...good.card.byBout[b0.id], [stranger]: { MP: 1 } } } } }).message, /matches/);
    assert.match(send({ ...good, card: { ...good.card, bouts: good.card.bouts.map((b, i) => (i ? b : { ...b, rounds: 0 })) } }).message, /matches/);
    const before = table(s.snapshot().games.g.state);
    assert.equal(send(good).status, "accepted");
    assert.ok(x);
    assert.notDeepEqual(table(s.snapshot().games.g.state), before, "a third day's matches move the table");
  } finally { s.dispose(); }
});

test("by format on the table: the same match played as a best of five instead of three moves its winner's seat by the formats' difference, nothing else", () => {
  const s = R.open(proofOf({ league: "tennis/atp", game: "short", completed: 1, events: 3, ann: 1 }));
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, st = snap.games.g.state, f = world.facts[0].data, spec = S.gameOf(st);
    const owner = (id) => st.castaways.find((x) => x.id === id)?.ownerIds[0];
    const b = f.card.bouts.find((x) => x.sides.some((y) => owner(y)));
    const who = b.sides.find((y) => owner(y));
    const asFormat = (n) => ({ ...f, card: { ...f.card, bouts: f.card.bouts.map((x) => (x.id === b.id ? { ...x, rounds: n } : x)) } });
    const send = (data) => assert.equal(s.apply({ type: "results", contextId: "sport", eventId: world.events[0].id, source: "provider-fixture", resultStatus: "corrected", data }).status, "accepted");
    send(asFormat(3));
    const three = table(s.snapshot().games.g.state);
    send(asFormat(5));
    const five = table(s.snapshot().games.g.state), line = f.card.byBout[b.id][who];
    const want = round(Oracle.linePoints(spec.score, line, "MS", [{ format: 5, line }]) - Oracle.linePoints(spec.score, line, "MS", [{ format: 3, line }]));
    assert.notEqual(want, 0, "the formats differ for this line");
    assert.equal(round(five[owner(who)] - three[owner(who)]), want);
    for (const p of Object.keys(three)) if (p !== owner(who) && !b.sides.some((y) => owner(y) === p)) assert.equal(five[p], three[p]);
  } finally { s.dispose(); }
});

// ---- Seventh slice (core-runtime-39): a slate, a week of several games, and a lineup that locks at each game's start. ----

/** A slate week's points for a seat, worked out apart from the engine: each game's points for the holdings counted in it (`heldIn(game)`:
 *  the lineup in force at its start, else the whole team), each game's line with its derived stats worked out; best ball's best n
 *  of each holding's week (a holding's week its games' points). */
function slateWeek(snap, gameId, playerId, e, heldIn) {
  const st = snap.games[gameId].state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), data = world.facts.find((f) => f.eventId === e.id).data;
  const byHolding = {};
  for (const g of Sports.gamesOf(world.context, e)) for (const id of heldIn(g)) if (data.games[g.id][id]) byHolding[id] = round((byHolding[id] || 0) + Oracle.linePoints(spec.score, c.sport.full(data.games[g.id][id]), groupOf(c, world, id)));
  const pts = Object.values(byHolding);
  return round((spec.count.best ? [...pts].sort((a, b) => b - a).slice(0, spec.count.best) : pts).reduce((a, b) => a + b, 0));
}
const slateDoc = (o) => proofOf({ league: "basketball/nba", game: "short", slate: 3, timing: "live-only", ...o });

test("a slate: twice as many teams as a week's games, each athlete on one; every team plays once a week, round robin; a game's lines are its two teams' athletes'", () => {
  const s = R.open(slateDoc({ completed: 3, events: 5 }));
  try {
    const world = s.snapshot().contexts.sport, teams = Sports.teamsOf(world.context);
    assert.equal(teams.length, 6);
    assert.ok(world.participants.every((p) => teams.includes(p.team)));
    const met = new Set();
    for (const e of world.events) {
      const games = Sports.gamesOf(world.context, e);
      assert.equal(games.length, 3);
      assert.deepEqual(games.flatMap((g) => g.teams).sort(), [...teams].sort(), "everyone plays once a week");
      assert.equal(games[0].airAt, e.airAt, "the week's first game is its event's time");
      assert.ok(games.every((g, j) => !j || Date.parse(g.airAt) > Date.parse(games[j - 1].airAt)));
      for (const g of games) met.add([...g.teams].sort().join("/"));
    }
    assert.ok(met.size >= 5, "the round robin turns: " + met.size + " pairings over five weeks");
    for (const f of world.facts) {
      const e = world.events.find((x) => x.id === f.eventId);
      for (const g of Sports.gamesOf(world.context, e)) for (const id of Object.keys(f.data.games[g.id])) assert.ok(g.teams.includes(world.participants.find((p) => p.id === id).team));
    }
  } finally { s.dispose(); }
});

test("a slate week is read as the server reads it: each game's lines kept beside the week's, the week's added up, a rate on the counts' sum", () => {
  const s = R.open(slateDoc({ completed: 2, events: 4, game: "roto" }));
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, c = Sports.league(world.context), st = snap.games.g.state, defs = c.sport.categoryDefs();
    const ep = st.episodes[0], data = world.facts.find((f) => f.eventId === ep.id).data;
    assert.deepEqual(Object.keys(ep.statGames).sort(), Object.keys(data.games).sort());
    for (const id of Object.keys(ep.statLines)) {
      const mine = Object.values(data.games).map((g) => g[id]).filter(Boolean).map((l) => c.sport.full(l));
      assert.equal(ep.statLines[id].PTS, mine.reduce((n, l) => n + (l.PTS || 0), 0), "a count adds up");
      const fg = Oracle.total(mine, "FG%", defs);
      if (fg !== null) assert.ok(Math.abs(ep.statLines[id]["FG%"] - fg) < 1e-9, "FG% from the week's counts: " + id);
    }
  } finally { s.dispose(); }
});

// Every slate game the profile takes on the slate leagues (a lineup, a team of three, best ball; categories and roto): the table is
// each seat's games' points, game by game (a week's line is its games' added up).
for (const league of ["basketball/nba", "football/nfl", "hockey/nhl", "baseball/mlb"]) for (const game of ["season", "short", "bestBall"]) {
  let doc;
  try { doc = proofOf({ league, game, slate: 2, timing: "live-only" }); } catch { continue; }
  if (P.inspect(doc).gaps.length) continue;
  test(`${league} ${game} on a slate: the table is each seat's games' points, week by week`, () => {
    const s = R.open(doc);
    try {
      const snap = s.snapshot(), st = snap.games.g.state, spec = S.gameOf(st), world = snap.contexts.sport;
      const want = {};
      for (const p of st.players) {
        const team = st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id);
        want[p.id] = round(world.events.filter((e) => e.resultStatus === "final").reduce((n, e) => n + slateWeek(snap, "g", p.id, e, () => (spec.count.start ? S.ActiveRosterLogic.lineupFor(st, e.id, p.id) : team)), 0));
      }
      assert.deepEqual(table(st), want);
    } finally { s.dispose(); }
  });
}

test("a slate's week locks at its own first game whatever its cadence (a Thursday-to-Monday week isn't the calendar's Tuesday-to-Monday)", () => {
  for (const closes of ["daily", "weekly"]) {
    const s = R.open(slateDoc({ completed: 1, events: 3, closes, game: { ...Bench.resolve("basketball/nba", "short").row.spec, get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { start: 2 } } }));
    try {
      const snap = s.snapshot(), world = snap.contexts.sport, locks = Sports.lockTimes(world, snap.games.g.state);
      for (const e of world.events) assert.equal(locks.get(e.number), e.airAt, closes + " week " + e.number);
    } finally { s.dispose(); }
  }
});

test("a lock at each game's start: a holding locks with its own team's game for the rest of that day; a change the next day counts from the next game; the week from its last", () => {
  const spec = { ...Bench.resolve("basketball/nba", "short").row.spec, get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { start: 2 }, closes: "game" };
  const doc = slateDoc({ completed: 1, events: 3, game: spec, ann: 1, bo: 1, cy: 1 });
  assert.deepEqual(P.inspect(doc).gaps, []);
  const s = R.open(doc);
  try {
    let snap = s.snapshot();
    const world = snap.contexts.sport, st0 = snap.games.g.state, week = world.events[1], games = Sports.gamesOf(world.context, week);
    const teamOf = (id) => world.participants.find((p) => p.id === id).team, mine = st0.castaways.filter((x) => x.ownerIds.includes("ann")).map((x) => x.id);
    // The week's games: two on its first day (three hours apart), one the next.
    const [g1, , g3] = games, E = mine.find((id) => g1.teams.includes(teamOf(id))), L = mine.find((id) => g3.teams.includes(teamOf(id))), X = mine.find((id) => id !== E && id !== L);
    assert.ok(E && L && X, "Ann holds someone in the first game, someone in the next day's and another: " + JSON.stringify({ E, L, X }));
    const lineup = (ids) => s.apply({ type: "lineup", gameId: "g", personId: "ann", eventId: week.id, ids });
    const clock = (ms) => assert.equal(s.apply({ type: "clock", at: new Date(ms).toISOString() }).status, "accepted");
    const before = [E, X], after = [L, X];
    assert.equal(lineup(before).status, "accepted", "before the week: anything");
    // An hour into the first game: E (in it) is locked, in or out; so the change is refused.
    clock(Date.parse(g1.airAt) + 3600000);
    assert.equal(lineup(after).status, "rejected", "benching a holding whose game began today");
    // The next morning, before its game: E's day is over, L's game hasn't begun.
    clock(Date.parse(g3.airAt) - 3 * 3600000);
    assert.equal(lineup(after).status, "accepted", "the next day: E is free again, L's game is still to come");
    // Every game played: its box scores in. The first day's games count the lineup at their start, the last the change.
    clock(Date.parse(g3.airAt) + 3600000);
    assert.equal(lineup(before).status, "rejected", "the week locks at its last game");
    let k = 0;
    const data = Sports.resultsFor(world.context, world.participants, () => (k = (k * 7919 + 104729) % 1000003), week);
    assert.equal(s.apply({ type: "results", contextId: "sport", eventId: week.id, source: "provider-fixture", resultStatus: "final", data }).status, "accepted");
    snap = s.snapshot();
    const inForce = (g) => (g.id === g3.id ? after : before);
    const want = round(slateWeek(snap, "g", "ann", world.events[0], () => S.ActiveRosterLogic.lineupFor(snap.games.g.state, world.events[0].id, "ann")) + slateWeek(snap, "g", "ann", week, inForce));
    // (What Ann is shown: a read stamps the week's games as the server's does; the kept state alone plays as one lineup.)
    assert.equal(round(s.project("g", "ann").game.table.find((r) => r.playerId === "ann").total), want);
    // Played as one lineup (the week's last), E's first game wouldn't count: the game-by-game rule matters here.
    assert.notEqual(round(slateWeek(snap, "g", "ann", week, () => after) - slateWeek(snap, "g", "ann", week, inForce)), 0);
    // Nothing of the locks is kept: the state holds no game's start; its log of lineups does.
    const kept = s.snapshot().games.g.state.episodes[1];
    assert.ok(!("gameStarts" in kept) && !("holdingGames" in kept));
    assert.equal(kept.lineupsAt.ann.length, 2);
  } finally { s.dispose(); }
});

test("a slate's results are refused without each of its week's games, with a line for someone not in that game, or as one week's line", () => {
  const s = R.open(slateDoc({ completed: 1, events: 3 }));
  try {
    const world = s.snapshot().contexts.sport, ev = world.events[1], games = Sports.gamesOf(world.context, ev);
    assert.equal(s.apply({ type: "clock", at: new Date(Date.parse(games[games.length - 1].airAt) + 3600000).toISOString() }).status, "accepted");
    let k = 0;
    const good = Sports.resultsFor(world.context, world.participants, () => (k = (k * 7919 + 104729) % 1000003), ev);
    const send = (data) => s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus: "final", data });
    const { [games[0].id]: _drop, ...two } = good.games;
    assert.match(send({ ...good, games: two }).message, /each of its week's games/);
    const stranger = world.participants.find((p) => !games[0].teams.includes(p.team)).id;
    assert.match(send({ ...good, games: { ...good.games, [games[0].id]: { ...good.games[games[0].id], [stranger]: { PTS: 3 } } } }).message, /two teams/);
    assert.match(send({ events: [], scoringEvents: [], lines: { [stranger]: { PTS: 3 } } }).message, /games' lines/);
    assert.match(send({ ...good, games: Object.fromEntries(Object.entries(good.games).map(([id, l], i) => [i ? id : "nope", l])) }).message, /its week's games/);
    assert.equal(send(good).status, "accepted");
  } finally { s.dispose(); }
});

test("a lock at each game's start needs a slate: on a world of one game an episode it's a gap", () => {
  const spec = { ...Bench.resolve("basketball/nba", "short").row.spec, get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { start: 2 }, closes: "game" };
  assert.ok(P.inspect(proofOf({ league: "basketball/nba", game: spec })).gaps.some((g) => /slate/.test(g.message || g.reason || JSON.stringify(g))));
});

test("roto on a slate: each category ranked across the seats from every game's line of the week (a rate from the week's counts added up)", () => {
  for (const league of ["basketball/nba", "hockey/nhl"]) {
    const s = R.open(proofOf({ league, game: "roto", slate: 2, timing: "live-only", ann: 2 }));
    try {
      const snap = s.snapshot(), st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st), defs = c.sport.categoryDefs();
      const played = world.events.filter((e) => e.resultStatus === "final");
      const linesOf = (p) => played.flatMap((e) => { const data = world.facts.find((f) => f.eventId === e.id).data; return S.ActiveRosterLogic.lineupFor(st, e.id, p).flatMap((id) => Object.values(data.games).map((g) => g[id]).filter(Boolean).map((l) => c.sport.full(l))); });
      const want = Oracle.roto(Object.fromEntries(st.players.map((p) => [p.id, Oracle.totals(linesOf(p.id), spec.score.categories, defs)])), spec.score.categories, defs);
      const got = Object.fromEntries(s.project("g", "ann").game.table.map((r) => [r.playerId, round(r.total)]));
      assert.deepEqual(got, want, league);
    } finally { s.dispose(); }
  }
});

// ---- A game called off, and a week in progress (core-runtime-40; the server's L3 part 3b and part 2f) ----
const send = (s, ev, resultStatus, data) => s.apply({ type: "results", contextId: "sport", eventId: ev.id, source: "provider-fixture", resultStatus, data });
const callOff = (s, ev, o = {}) => s.apply({ type: "calledOff", contextId: "sport", eventId: ev.id, called: "postponed", ...o });
const seeded = (s, ev) => { let k = 0; const w = s.snapshot().contexts.sport; return Sports.resultsFor(w.context, w.participants, () => (k = (k * 7919 + 104729) % 1000003), ev); };
const at = (s, ms) => assert.equal(s.apply({ type: "clock", at: new Date(ms).toISOString() }).status, "accepted");

test("the called-off and week-in-progress oracle is the rule: a week in once every game is final or off, its games final counted as they end; a game called off locks nothing", () => {
  assert.equal(Oracle.weekIn(["a", "b", "c"], ["a", "b"], []), false, "a game still to play");
  assert.equal(Oracle.weekIn(["a", "b", "c"], ["a", "b"], ["c"]), true, "the last one postponed");
  assert.deepEqual(Oracle.counted(["a", "b", "c"], ["a"], []), ["a"], "a week in progress counts its games final so far (docs/PLAN-sports-ready.md step 1.1, part 2)");
  assert.deepEqual(Oracle.counted(["a", "b", "c"], ["a", "c"], ["b"]), ["a", "c"]);
  assert.deepEqual(Oracle.counted(["a", "b"], [], ["a", "b"]), [], "a week whose every game is off is in, with nothing in it");
  const games = [{ id: "a", at: "2099-01-07T18:00:00.000Z" }, { id: "b", at: "2099-01-07T23:00:00.000Z" }];
  assert.equal(Oracle.firstPlayed(games, []), Date.parse(games[0].at));
  assert.equal(Oracle.firstPlayed(games, ["a"]), Date.parse(games[1].at), "the day's first game postponed: the next one played");
  assert.equal(Oracle.firstPlayed(games, ["a", "b"]), null);
  const now = Date.parse("2099-01-07T20:00:00.000Z");
  assert.equal(Oracle.holdingLocked([games[0]], [], now), true, "its game began earlier today");
  assert.equal(Oracle.holdingLocked([games[0]], ["a"], now), false, "its game called off");
  assert.equal(Oracle.holdingLocked([games[1]], [], now), false, "its game is later today");
  assert.equal(Oracle.holdingLocked([games[0]], [], Date.parse("2099-01-08T06:00:00.000Z")), false, "the next Eastern day");
});

test("a slate week in progress counts its games final as they end, early (no head to head yet); then a postponed game puts it in, its games played counted", () => {
  const s = R.open(slateDoc({ completed: 1, events: 3, ann: 1, bo: 1, cy: 1 }));
  try {
    const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2, g3] = Sports.gamesOf(world.context, week), full = seeded(s, week);
    const t0 = table(s.snapshot().games.g.state), only = (...gs) => ({ ...full, games: Object.fromEntries(gs.map((g) => [g.id, full.games[g.id]])) });
    at(s, Date.parse(g1.airAt) - 3600000);
    assert.match(send(s, week, "partial", only(g1)).message, /only once it has started|aired/, "a game final before it starts");
    at(s, Date.parse(g1.airAt) + 3600000);
    assert.match(send(s, week, "partial", only()).message, /has a game final/);
    assert.equal(send(s, week, "partial", only(g1)).status, "accepted");
    let snap = s.snapshot();
    assert.equal(snap.contexts.sport.events[1].resultStatus, "unavailable", "the week isn't in until every game is in or off");
    // Step 1.1, part 2 (core-runtime-46): its first game's lines stamped, early: the table moves by them, the week has no results yet.
    const ep1 = snap.games.g.state.episodes[1];
    assert.ok(ep1.statEarly === true && "statLines" in ep1 && !ep1.gameFinal, "its games so far stamped, early");
    assert.equal(S.resultsStage(ep1), "early");
    assert.equal(S.episodeHasResults(ep1), false, "its results aren't in: lineups, this week's choice and waivers go on as before");
    const soFar = (snap_, gs) => { const st_ = snap_.games.g.state, out = {}; for (const p of st_.players) { const team = st_.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id); out[p.id] = round(slateWeek(snap_, "g", p.id, world.events[0], () => team) + slateWeek(snap_, "g", p.id, snap_.contexts.sport.events[1], (g) => (gs.includes(g.id) ? team : []))); } return out; };
    assert.deepEqual(table(snap.games.g.state), soFar(snap, [g1.id]), "everyone's total moves by the first game's lines");
    const seen = S.SpoilerLogic.viewThrough(snap.games.g.state, 1).episodes[1];
    assert.ok(!("statLines" in seen) && !("statEarly" in seen), "someone a week behind is told nothing of the week in progress");
    assert.match(s.apply({ type: "reveal", contextId: "sport", personId: "ann", episode: 2 }).message, /Reveal only/, "a week in progress isn't there to reveal");
    at(s, Date.parse(g2.airAt) + 3600000);
    assert.match(send(s, week, "partial", only(g2)).message, /stays in the week/, "a game final stays final");
    assert.match(send(s, week, "final", only(g1, g2)).message, /each of its week's games played/, "a game still to play");
    assert.equal(send(s, week, "partial", only(g1, g2)).status, "accepted");
    const two = soFar(s.snapshot(), [g1.id, g2.id]);
    assert.deepEqual(table(s.snapshot().games.g.state), two, "and by the second's");
    // The last game postponed before it starts: the week is in with the two played.
    assert.match(callOff(s, week, { game: "nope" }).message, /Name one of the week's games/);
    assert.match(callOff(s, week, { game: g1.id }).message, /final can't be called off/);
    assert.match(callOff(s, week, { game: g3.id, called: "rained out" }).message, /postponed' or 'cancelled/);
    assert.equal(callOff(s, week, { game: g3.id }).status, "accepted");
    snap = s.snapshot();
    assert.equal(snap.contexts.sport.events[1].resultStatus, "final");
    assert.deepEqual(snap.contexts.sport.events[1].calledOff, { [g3.id]: "postponed" });
    const st = snap.games.g.state, want = {};
    for (const p of st.players) {
      const team = st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id);
      const counted = Oracle.counted([g1.id, g2.id, g3.id], [g1.id, g2.id], [g3.id]);
      want[p.id] = round(slateWeek(snap, "g", p.id, world.events[0], () => team) + slateWeek(snap, "g", p.id, snap.contexts.sport.events[1], (g) => (counted.includes(g.id) ? team : [])));
    }
    assert.deepEqual(table(st), want, "the week is its two games played");
    assert.deepEqual(want, two, "as the week in progress had them: in, nothing moves");
    assert.notDeepEqual(table(st), t0);
    assert.deepEqual(Object.keys(st.episodes[1].statGames).sort(), [g1.id, g2.id].sort(), "each game played kept beside the week's; none for the postponed one");
    assert.match(callOff(s, week, { game: g2.id }).message, /results are in/, "a week in can't be called off");
  } finally { s.dispose(); }
});

test("at its own pace, a caught-up seat's copy leaves a week in progress out, even told everything (the game waits for them; step 1.1, part 2)", () => {
  const s = R.open(slateDoc({ completed: 1, events: 3, ann: 1, bo: 1, cy: 1, timing: "own-pace" }));
  try {
    const world = s.snapshot().contexts.sport, week = world.events[1], [g1] = Sports.gamesOf(world.context, week), full = seeded(s, week);
    at(s, Date.parse(g1.airAt) + 3600000);
    assert.equal(send(s, week, "partial", { ...full, games: { [g1.id]: full.games[g1.id] } }).status, "accepted");
    const st = s.snapshot().games.g.state, seat = st.players.find((p) => p.lateJoin && !p.lateJoin.catchingUp && p.lateJoin.seenThrough === 1);
    assert.ok(seat, "a seat caught up through week 1");
    assert.equal(S.EpisodeLogic.inProgress(st.episodes[1]), true, "the full state has the week in progress");
    for (const mark of [null, 1, 5]) {
      const ep = S.GhostLogic.viewFor(st, seat.id, mark).episodes[1];
      assert.ok(!("statLines" in ep) && !("statEarly" in ep), "their copy, told through " + mark + ", leaves it out");
    }
    assert.ok("statLines" in S.GhostLogic.viewFor(st, null, null).episodes[1], "someone told everything without a seat here still sees it");
  } finally { s.dispose(); }
});

test("a slate game postponed before the week: its results are the other games', each game played's box score; a line for the postponed one is refused", () => {
  const s = R.open(slateDoc({ completed: 1, events: 3, ann: 1, bo: 1, cy: 1 }));
  try {
    const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2, g3] = Sports.gamesOf(world.context, week), full = seeded(s, week);
    assert.equal(callOff(s, week, { game: g2.id, called: "cancelled" }).status, "accepted");
    assert.match(callOff(s, week, { game: g2.id }).message, /called off already/);
    assert.equal(s.snapshot().contexts.sport.events[1].resultStatus, "unavailable", "two games still to play");
    at(s, Date.parse(g3.airAt) + 3600000);
    assert.match(send(s, week, "final", full).message, /called off has no box score/);
    const played = { ...full, games: { [g1.id]: full.games[g1.id], [g3.id]: full.games[g3.id] } };
    assert.equal(send(s, week, "final", played).status, "accepted");
    assert.deepEqual(Object.keys(s.snapshot().games.g.state.episodes[1].statGames).sort(), [g1.id, g3.id].sort());
    assert.equal(send(s, week, "corrected", played).status, "accepted", "a correction has the games played");
  } finally { s.dispose(); }
});

test("an episode of one game called off: its results are in with nothing in them, nobody scores, the next game is the one to play; refusals", () => {
  const s = R.open(proofOf({ league: "football/nfl", game: "short", completed: 2, events: 5, timing: "live-only", ann: 1, bo: 2, cy: 2 }));
  try {
    const world = s.snapshot().contexts.sport, t0 = table(s.snapshot().games.g.state), [, , e3, e4] = world.events;
    assert.match(callOff(s, e4).message, /event order/, "an earlier game has no results yet");
    assert.match(callOff(s, e3, { game: "x" }).message, /called off whole/);
    at(s, Date.parse(e3.airAt) + 3600000);
    assert.match(send(s, e3, "partial", seeded(s, e3)).message, /final at once/, "one game has no partial result");
    assert.equal(callOff(s, e3, { called: "cancelled" }).status, "accepted");
    const snap = s.snapshot(), ep = snap.games.g.state.episodes[2];
    assert.equal(snap.contexts.sport.events[2].resultStatus, "cancelled");
    assert.ok(S.EpisodeLogic.hasResults(ep) && ep.gameFinal === true && !("statLines" in ep), "its results are in, with no line");
    assert.deepEqual(table(snap.games.g.state), t0, "nobody scores for it");
    assert.match(callOff(s, e3).message, /results are in/);
    assert.match(send(s, e3, "corrected", seeded(s, e3)).message, /called off has no results/);
    at(s, Date.parse(e4.airAt) + 3600000);
    assert.equal(send(s, e4, "final", seeded(s, e4)).status, "accepted");
    assert.notDeepEqual(table(s.snapshot().games.g.state), t0);
    for (const p of ["bo", "cy"]) assert.equal(s.apply({ type: "reveal", contextId: "sport", personId: p }).status, "accepted", p + " reveals the cancelled game");
  } finally { s.dispose(); }
});

test("a game called off locks nothing: a day's and a week's lock is its first game played; a holding of its team is free past its start", () => {
  // Wed 1 PM, Wed 7 PM (Thursday in UTC), Thu 7 PM: the afternoon game postponed, the evening's lock is its own start.
  const DAY = ["2099-01-07T18:00:00.000Z", "2099-01-08T00:00:00.000Z", "2099-01-09T00:00:00.000Z"];
  const nba = Bench.resolve("basketball/nba", "short").row.spec, two = { ...nba, get: { ...nba.get, each: 4 }, count: { start: 2 } };
  for (const closes of ["daily", "weekly"]) {
    const s = R.open(proofOf({ league: "basketball/nba", game: two, closes, schedule: DAY, completed: 0, clock: "2099-01-07T20:00:00.000Z", timing: "live-only", ann: 0, bo: 0, cy: 0 }));
    try {
      assert.equal(locksOfCase(s)[2], DAY[0], closes + ": the evening game locks with the afternoon's");
      assert.equal(put(s, 2, s.project("g", "bo").game.lineup.roster.slice(2, 4)).status, "rejected");
      const hash = s.hash();
      assert.equal(callOff(s, s.snapshot().contexts.sport.events[0]).status, "accepted", "postponed after it began");
      assert.notEqual(s.hash(), hash);
      assert.equal(locksOfCase(s)[2], DAY[1], closes + ": the afternoon game postponed locks nothing");
      assert.ok(!(1 in locksOfCase(s)));
      const l = s.project("g", "bo").game.lineup;
      assert.deepEqual([l.episode, l.locked], [2, false], closes + ": the evening's lineup is open again");
      assert.equal(put(s, 2, l.roster.slice(2, 4)).status, "accepted");
      assert.ok(s.snapshot().games.g.state.episodes.every((e) => !("locksAt" in e)), "the kept state holds no lock");
    } finally { s.dispose(); }
  }
  // A slate: its week's first game postponed, the week locks at its first game played.
  {
    const s = R.open(slateDoc({ completed: 1, events: 3, closes: "daily", game: { ...two, get: { by: "draft", each: 4, order: "snake", own: "exclusive" } } }));
    try {
      const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2] = Sports.gamesOf(world.context, week);
      assert.equal(locksOfCase(s)[2], g1.airAt);
      assert.equal(callOff(s, week, { game: g1.id }).status, "accepted");
      assert.equal(locksOfCase(s)[2], g2.airAt, "a slate's week locks at its first game played");
    } finally { s.dispose(); }
  }
  // With a lock at each game's start the postponed game is no game's start, and its holdings are free past it.
  {
    const spec = { ...two, get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, closes: "game" };
    const s = R.open(slateDoc({ completed: 1, events: 3, game: spec, ann: 1, bo: 1, cy: 1 }));
    try {
      const world = s.snapshot().contexts.sport, week = world.events[1], [g1, g2, g3] = Sports.gamesOf(world.context, week);
      assert.equal(callOff(s, week, { game: g1.id }).status, "accepted");
      const snap = s.snapshot(), locks = Sports.gameLocks(snap.contexts.sport, snap.games.g.state).get(2);
      assert.deepEqual(Object.keys(locks.gameStarts).sort(), [g2.id, g3.id].sort(), "a game called off is no game's start");
      const teamOf = (id) => world.participants.find((p) => p.id === id).team, held = snap.games.g.state.castaways.filter((x) => x.ownerIds.includes("ann")).map((x) => x.id);
      const E = held.find((id) => g1.teams.includes(teamOf(id))), others = held.filter((id) => id !== E && !g2.teams.includes(teamOf(id)));
      assert.ok(E && others.length >= 2, "Ann holds someone in the postponed game and two outside the next one");
      const lineup = (ids) => s.apply({ type: "lineup", gameId: "g", personId: "ann", eventId: week.id, ids });
      assert.equal(lineup([E, others[0]]).status, "accepted");
      at(s, Date.parse(g1.airAt) + 3600000);
      assert.equal(lineup([others[1], others[0]]).status, "accepted", "an hour past its postponed game's start, E is free to move");
    } finally { s.dispose(); }
  }
});

test("a real-size pool (athletes 'real'): the league's own size and positions in its shares, each drafted team about its share of each, scored and replayed; every other world as it was", () => {
  // The league's own size, every position its count, and the table only for a team sport.
  const nfl = Sports.realPool("football/nfl");
  assert.equal(nfl.size, 344);
  assert.deepEqual(nfl.shares, { QB: 40, RB: 80, WR: 110, TE: 50, PK: 32, DEF: 32 });
  for (const key of ["basketball/nba", "baseball/mlb", "hockey/nhl", "soccer/eng.1", "football/college-football", "basketball/wnba"]) assert.ok(Sports.realPool(key).size >= 300, key);
  assert.throws(() => Sports.realPool("golf/pga"), /team sport/);
  // The deal: each position exactly its count, and every run of fifteen within one of its share (the interleave).
  const deal = Sports.realDeal(nfl.shares);
  assert.equal(deal.length, 344);
  for (const [k, n] of Object.entries(nfl.shares)) {
    assert.equal(deal.filter((x) => x === k).length, n, k);
    for (let i = 0; i + 15 <= deal.length; i += 15) assert.ok(Math.abs(deal.slice(i, i + 15).filter((x) => x === k).length - (15 * n) / 344) < 1.5, k + " at " + i);
  }
  // A world of it: 344 athletes, positions in the league's shares; three exclusive teams of fifteen, each with two or so of
  // everyone a lineup needs; a week's box score for every athlete, the table as the oracle says; an exact replay.
  const doc = D.create({ seed: 7, world: { contexts: [Sports.contextFor("football/nfl", { couch: 3, pool: "real" })], people: PEOPLE }, games: [{ id: "g", contextId: "sport", timing: "live-only", spec: Bench.resolve("football/nfl", "season").row.spec }], situation: { clock: "2099-01-10T12:00:00.000Z" }, content: { completedEvents: 2, eventCount: 6 } });
  assert.equal(doc.world.contexts[0].athletes, "real");
  assert.deepEqual(P.inspect(doc).gaps, []);
  const s = R.open(doc);
  try {
    const snap = s.snapshot(), world = snap.contexts.sport, roleOf = (id) => world.participants.find((p) => p.id === id).role;
    assert.equal(world.participants.length, 344);
    assert.deepEqual(Object.fromEntries(Object.keys(nfl.shares).map((k) => [k, world.participants.filter((p) => p.role === k).length])), nfl.shares);
    assert.equal(new Set(world.participants.map((p) => p.name)).size, 344, "every name distinct");
    for (const p of PEOPLE) {
      const team = snap.games.g.state.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => roleOf(x.id));
      assert.equal(team.length, 15);
      for (const [k, least] of Object.entries({ QB: 1, RB: 2, WR: 3, TE: 1, PK: 1, DEF: 1 })) assert.ok(team.filter((x) => x === k).length >= least, p.name + " has " + least + "+ " + k + ": " + team.join(","));
    }
    assert.equal(Object.keys(world.facts.find((f) => f.eventId === world.events[0].id).data.lines).length, 344, "a box score line for every athlete");
    assert.deepEqual(table(snap.games.g.state), expected(snap));
    // (A day apart, the next game shares a locked week: a lineup for it is refused, as the weekly lock says.)
    const l = s.project("g", "p1").game.lineup;
    assert.equal(l.roster.length, 15);
    assert.equal(s.apply({ type: "lineup", gameId: "g", personId: "p1", eventId: l.epId, ids: l.roster.slice(6, 6 + l.need) }).status, l.locked ? "rejected" : "accepted");
    const exported = s.export(), again = R.resume(exported);
    try { assert.equal(again.hash(), exported.stateHash, "exact replay"); } finally { again.dispose(); }
  } finally { s.dispose(); }
  // Opt-in: without it the same world deals the default lineup's slots in turn, as before; any other value is refused.
  assert.equal(Sports.contextFor("football/nfl", { couch: 3, pool: 49 }).athletes, undefined);
  const plain = R.open(define("football/nfl", "season"));
  try { assert.deepEqual(plain.snapshot().contexts.sport.participants.slice(0, 10).map((p) => p.role), ["QB", "WR", "WR", "RB", "RB", "TE", "RB", "PK", "DEF", "QB"]); } finally { plain.dispose(); }
  assert.throws(() => R.open(D.create({ ...doc, world: { ...doc.world, contexts: [{ ...doc.world.contexts[0], athletes: "most" }] } })), /athletes is 'real'/);
});
