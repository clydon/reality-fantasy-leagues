// The gameplay explorer's generated sports world (tools/gameplay-bench/explorer/runtime-sports.cjs, core-runtime-30; the breadth
// program's sports statistics, first slice): a sport context's athletes, schedule and box scores, and a drafted team scored by a
// sport's stats with plain points, ranked by total, locking at each episode's start. Run with `npm test`.
//
// The oracle is worked out here, apart from the engine: each seat's total is its counted athletes' points for each released
// episode (the whole team, the starters it fielded, or its best n), a line's points each stat the table scores, its count times
// its points to the cent, over the sport's full line. So a wrong stamp, team, episode or sum shows as a different table.
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
/** Each seat's total, worked out apart from the engine's walk (the header's oracle). */
function expected(snap) {
  const st = snap.games.g.state, world = snap.contexts.sport, c = Sports.league(world.context), spec = S.gameOf(st);
  const released = world.events.filter((e) => ["final", "corrected"].includes(e.resultStatus));
  const out = {};
  for (const p of st.players) {
    let total = 0;
    for (const e of released) {
      const lines = world.facts.find((f) => f.eventId === e.id).data.lines;
      const team = st.castaways.filter((x) => x.ownerIds.includes(p.id)).map((x) => x.id);
      const ep = st.episodes.find((x) => x.id === e.id);
      const held = spec.count.start ? (ep.lineups?.[p.id] ?? []) : team;
      const pts = held.map((id) => round(Object.entries(spec.score.points).reduce((n, [stat, each]) => n + round((c.sport.full(lines[id])[stat] || 0) * each), 0)));
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
    assert.match(send({ events: [], scoringEvents: [], lines }, "partial").message, /in progress/);
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
const Oracle = require(path.join(root, "tools/gameplay-bench/campaign/sports-oracle.cjs"));
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
