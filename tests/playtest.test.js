// Replays (scripts/dev-test/playtest.js, docs/PLAN-playtests.md step P3): the pairwise matrix (every pair of settings that
// can go together is played, the same set every time), the seats and their habits (by role only; a forgetter forgets the
// same share of weeks, spread evenly), the spans, the merge read from a tape, a recorded answer moved with the season's copy
// and an older stored answer brought to today's shape, and the summary's line. No database, no bot. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");
const P = require("../scripts/dev-test/playtest.js");

test("the pairwise set covers every pair of settings that can go together, and is the same every time", () => {
  for (const season of [{ merge: 6 }, {}]) {
    const { picked } = P.pairwise(P.DIMENSIONS, season);
    const covered = new Set(picked.flatMap(P.pairsOf));
    for (const c of P.allConfigs(P.DIMENSIONS, season)) for (const pair of P.pairsOf(c)) assert.ok(covered.has(pair), `${pair} isn't played`);
    assert.deepEqual(P.pairwise(P.DIMENSIONS, season).picked, picked);
    assert.ok(picked.length < 40, `${picked.length} replays: the point is fewer than the whole matrix`);
  }
});

test("settings that don't apply are left out of the matrix: a pool has no teams, a season with no merge no merge span", () => {
  const configs = P.allConfigs(P.DIMENSIONS, {});
  assert.ok(!configs.some((c) => c.span === "merge"));
  for (const c of configs.filter((x) => x.game === "survivalPool")) {
    assert.equal(c.own, P.NA);
    assert.equal(c.size, P.NA);
    assert.equal(c.waivers, P.NA);
  }
  for (const c of configs.filter((x) => x.group === 1 || x.span === "one")) assert.equal(c.late, P.NA);
  // Shared Outlast has no waivers at all, so no replay is named for waivers there.
  for (const c of configs.filter((x) => x.game === "outlast" && x.own === "shared")) assert.equal(c.waivers, P.NA);
  assert.ok(P.allConfigs(P.DIMENSIONS, { merge: 7 }).some((c) => c.span === "merge"));
});

test("a replay's name says the show, the season, the game, its settings and the group", () => {
  assert.equal(P.replayName("survivor", 49, { game: "outlast", own: "shared", size: "big", span: "season", late: "yes", waivers: "off", group: 8 }), "survivor-49-outlast-shared-big-season-late-nowaivers-g8");
  assert.equal(P.replayName("survivor", 49, { game: "survivalPool", own: P.NA, size: P.NA, span: "one", late: P.NA, waivers: P.NA, group: 1 }), "survivor-49-survivalPool-one-solo");
});

test("seats: the tinkerer runs it, repeated roles are numbered, nobody's real name", () => {
  const seats = P.seatsFor(16);
  assert.equal(seats.length, 16);
  assert.equal(seats[0].role, "tinkerer");
  assert.equal(new Set(seats.map((s) => s.label)).size, 16);
  assert.equal(new Set(seats.map((s) => s.username)).size, 16);
  assert.ok(seats.every((s) => s.username.startsWith("zt_pt_")));
  assert.deepEqual(P.seatsFor(4).map((s) => s.label), ["Tinkerer", "Forgetter", "Drive-by", "Fan"]);
  assert.ok(seats.some((s) => s.label === "Forgetter 3"));
});

test("a habit's weeks: exactly its share, spread evenly, and two forgetters don't forget the same weeks", () => {
  const weeks = (seat) => Array.from({ length: 12 }, (_, i) => P.movesThisWeek(seat, i + 1));
  const f1 = weeks({ username: "zt_pt_forgetter", role: "forgetter" });
  const f2 = weeks({ username: "zt_pt_forgetter2", role: "forgetter" });
  assert.equal(f1.filter(Boolean).length, 4);
  assert.equal(weeks({ username: "zt_pt_fan", role: "fan" }).filter(Boolean).length, 6);
  assert.equal(weeks({ username: "zt_pt_tinkerer", role: "tinkerer" }).filter(Boolean).length, 12);
  assert.notDeepEqual(f1, f2);
  // Never two remembered weeks in a row for someone who remembers one in three.
  assert.ok(f1.every((on, i) => !(on && f1[i + 1])));
});

test("preferences: the list as the app lists it, the contrarian away from the room's favourites, taste fixed by name", () => {
  const seat = { username: "zt_pt_reader", role: "reader" };
  const ratings = { a: { value: 3 }, b: { value: 2 }, c: { value: 1 }, d: { value: 0 }, e: { value: -1 }, f: { value: -2 } };
  const ids = ["f", "e", "d", "c", "b", "a"];
  assert.deepEqual(P.prefer({ username: "zt_pt_driveby", role: "driveby" }, ids, { ratings, listOrder: ["c", "a", "b", "d", "e", "f"] }), ["c", "a", "b", "d", "e", "f"]);
  assert.equal(P.prefer(seat, ids, { ratings })[0], "a");
  const contrary = P.prefer({ username: "zt_pt_contrarian", role: "contrarian" }, ids, { ratings });
  assert.ok(!["a", "b"].includes(contrary[0]), `the contrarian took ${contrary[0]}`);
  // Out of the game (no rating): never offered.
  assert.ok(!P.prefer(seat, [...ids, "gone"], { ratings }).includes("gone"));
  // The same people by name in two games whose ids differ: the same order.
  const fan = { username: "zt_pt_fan", role: "fan" };
  const one = P.prefer(fan, ["x1", "x2", "x3"], { names: { x1: "Ann", x2: "Bo", x3: "Cy" }, how: "taste" }).map((id) => ({ x1: "Ann", x2: "Bo", x3: "Cy" })[id]);
  const two = P.prefer(fan, ["y1", "y2", "y3"], { names: { y1: "Ann", y2: "Bo", y3: "Cy" }, how: "taste" }).map((id) => ({ y1: "Ann", y2: "Bo", y3: "Cy" })[id]);
  assert.deepEqual(one, two);
});

test("the merge is the first episode anyone won immunity on their own; none, none", () => {
  const tape = (episode, won) => ({ episode, parsed: { castaways: [{ wonIndividualImmunity: won ? "yes" : "no" }] } });
  assert.equal(P.mergeOf([tape(8, true), tape(5, false), tape(7, true)]), 7);
  assert.equal(P.mergeOf([tape(1, false)]), null);
});

test("spans for a 13-episode season: from a third in, one in the middle, from the merge, through half, and a late joiner", () => {
  assert.deepEqual(P.spanOf({ span: "season", late: "no" }, 13, 6), { from: 1, to: null, late: null });
  assert.deepEqual(P.spanOf({ span: "from", late: "yes" }, 13, 6), { from: 4, to: null, late: 7 });
  assert.deepEqual(P.spanOf({ span: "one", late: P.NA }, 13, 6), { from: 7, to: 7, late: null });
  assert.deepEqual(P.spanOf({ span: "merge", late: "no" }, 13, 6), { from: 6, to: null, late: null });
  assert.deepEqual(P.spanOf({ span: "through", late: "yes" }, 13, 6), { from: 1, to: 6, late: 3 });
});

test("a recorded answer moves with the season's copy: its printed air date and its next episode's start, nothing else", () => {
  const answer = JSON.stringify({ airDate: "January 8, 2026", nextEpisode: { airsAt: "2026-01-15T21:00:00-05:00", minutes: 60 }, summary: "x" });
  const moved = JSON.parse(P.shiftAnswer("```json\n" + answer + "\n```", 294));
  assert.equal(moved.airDate, "October 29, 2026");
  assert.equal(moved.nextEpisode.airsAt, "2026-11-06T02:00:00.000Z");
  assert.equal(moved.nextEpisode.minutes, 60);
  assert.equal(moved.summary, "x");
  assert.equal(P.shiftAnswer("not json", 7), "not json");
});

test("an older stored answer gets today's fields it lacks, empty, and keeps what it said", () => {
  const schema = z.object({
    airDate: z.string().nullable(),
    rulesNote: z.string().nullable(),
    sourcesRead: z.array(z.object({ url: z.string() })),
    castaways: z.array(z.object({ name: z.string(), newGroup: z.string().nullable(), leftTheGame: z.string() })),
  });
  const old = JSON.stringify({ airDate: "May 1, 2025", castaways: [{ name: "Ann", leftTheGame: "yes" }] });
  const up = JSON.parse(P.upgradeStored(old, schema));
  assert.deepEqual(up, { airDate: "May 1, 2025", rulesNote: null, sourcesRead: [], castaways: [{ name: "Ann", leftTheGame: "yes", newGroup: null }] });
  assert.ok(schema.safeParse(up).success);
  assert.equal(P.upgradeStored("nope", schema), null);
});

test("the summary's line: the winner, when it was settled, the forgetter's place", () => {
  const ep = (n, leaders, table) => ({ n, leaders, table: table.map(([name, total]) => ({ name, total })), stillInIt: 2, leadChange: false, why: {} });
  const episodes = [ep(1, ["Forgetter"], [["Forgetter", 2], ["Tinkerer", 1]]), ep(2, ["Tinkerer"], [["Tinkerer", 5], ["Forgetter", 2]]), ep(3, ["Tinkerer"], [["Tinkerer", 6], ["Forgetter", 2]])];
  assert.equal(P.settledAt(episodes), 2);
  const line = P.summaryLine({
    replay: "r",
    seats: [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }],
    episodes,
    final: { winner: "Tinkerer", over: true, settledAt: 2, leadChanges: 1 },
    problems: [],
  });
  assert.equal(line.winner, "Tinkerer");
  assert.equal(line.forgetter, "2 of 2");
  assert.equal(line.inItAtHalf, "2 of 2");
  assert.equal(line.tiedTop, false);
});

test("a season plays only the games Start a game offers for its rulebook: a series Weekly Lineup, a competition all three", () => {
  const events = { events: [1, 2, 3, 4, 5] };
  const competition = {
    kind: "competition",
    cast: { unit: "people" },
    waysOut: [{ means: "out" }, { means: "winner" }],
    segments: [{ id: "vote", often: "everyEpisode", onTheLine: "goingHome" }],
  };
  assert.deepEqual(P.gamesOf({ blocks: competition, compiled: events }), ["outlast", "weeklyLineup", "survivalPool"]);
  // Nobody going home every episode (Dancing with the Stars' rulebook): no Survival Pool.
  assert.deepEqual(P.gamesOf({ blocks: { ...competition, segments: [] }, compiled: events }), ["outlast", "weeklyLineup"]);
  // A series (Below Deck): draft the crew, nothing knocks anyone out.
  assert.deepEqual(P.gamesOf({ blocks: { kind: "series", cast: { unit: "people" } }, compiled: events }), ["weeklyLineup"]);
  assert.deepEqual(P.gamesOf(null), P.DIMENSIONS.game);
  // The matrix over a series' games still covers every pair, and names only Weekly Lineup.
  const dims = P.dimsFor({ blocks: { kind: "series", cast: { unit: "people" } }, compiled: events });
  const { picked } = P.pairwise(dims, {});
  assert.ok(picked.length && picked.every((c) => c.game === "weeklyLineup"));
  const covered = new Set(picked.flatMap(P.pairsOf));
  for (const c of P.allConfigs(dims, {})) for (const pair of P.pairsOf(c)) assert.ok(covered.has(pair), `${pair} isn't played`);
});

test("who left, by the quick check and the full research: where they agree, where they don't, and only what's on tape", () => {
  const quick = (episode, left) => ({ kind: "quick", episode, ok: true, parsed: { episodeTitle: `E${episode}`, left: left.map((name) => ({ name, how: "Eliminated" })) } });
  const full = (episode, gone, stored = false) => {
    const answer = { episodeTitle: `E${episode}`, castaways: ["Ann", "Bo", "Cy", "Di"].map((name) => ({ name, leftTheGame: gone.includes(name) ? "yes" : "no", exitMethod: gone.includes(name) ? "Eliminated" : null })) };
    return { kind: "full", episode, ok: true, parsed: stored ? answer : { parsed: answer } };
  };
  const x = P.exitsOf([quick(1, ["Ann"]), full(1, ["Ann"]), quick(2, ["Bo"]), full(2, [], true), quick(3, []), full(3, ["Bo", "Cy"]), quick(4, ["Di"])]);
  assert.deepEqual(x.episodes.map((e) => e.agree), [true, false, false, null]);
  assert.deepEqual(x.episodes[2].full.left, ["Bo (Eliminated)", "Cy (Eliminated)"]);
  // Bo: the quick says 2, the full 3; Cy only the full; Di's episode has no full answer yet, so says nothing.
  assert.deepEqual(x.differ.map((p) => [p.name, p.quick, p.full]), [["Bo", 2, 3], ["Cy", null, 3]]);
  // Curly quotes and accents don't make two people of one.
  const y = P.exitsOf([quick(1, ["Johnny “Bananas” Devenanzio", "Nany González"]), { ...full(1, []), parsed: { parsed: { castaways: [{ name: 'Johnny "Bananas" Devenanzio', leftTheGame: "yes" }, { name: "Nany Gonzalez", leftTheGame: "yes" }] } } }]);
  assert.equal(y.episodes[0].agree, true);
  // Matched to the cast as the app matches a name: a first name, a trailing period, a hyphen.
  const cast = ["Bruce Perreault", "Jean-Luc Picard", "Kim K."];
  const z = P.exitsOf([quick(2, ["Bruce", "Jean Luc Picard", "Kim K"]), { ...full(2, []), parsed: { parsed: { castaways: cast.map((name) => ({ name, leftTheGame: "yes" })) } } }], cast);
  assert.equal(z.episodes[0].agree, true);
  assert.deepEqual(z.differ, []);
});

test("P4's measures over replays: over, lead changes, when it was settled, ties, quiet weeks, finishes, reasons shown", () => {
  const row = (name, total, extra = {}) => ({ playerId: name, name, total, ...extra });
  const ep = (n, leaders, table, why = {}, more = {}) => ({ n, leaders, table, why, teamsWithNobodyLeft: [], leadChange: false, ...more });
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }];
  const lineup = {
    seats,
    problems: [],
    final: { over: true, settledAt: 2, leadChanges: 1 },
    episodes: [
      ep(1, ["Forgetter"], [row("Forgetter", 2), row("Tinkerer", 1)], { Tinkerer: { started: ["Ann 1 (Won 1)", "Bo 0"] } }),
      ep(2, ["Tinkerer"], [row("Tinkerer", 5), row("Forgetter", 2)], { Tinkerer: { started: ["Ann 4 (Won 4)"] } }, { teamsWithNobodyLeft: ["Forgetter"] }),
      ep(3, ["Tinkerer"], [row("Tinkerer", 5), row("Forgetter", 2)], { Tinkerer: { started: ["Cy -1"] } }),
    ],
  };
  const j = P.judgeOf([lineup, { seats, problems: ["x"], final: null, episodes: [] }]);
  assert.equal(j.replays, 2);
  assert.equal(j.over, 1);
  assert.equal(j.leadChanges, 1);
  assert.equal(j.settled, 0.5);
  assert.equal(j.tiedTop, 0);
  // Episode 3: nobody moved.
  assert.equal(j.quiet, 1 / 3);
  assert.equal(j.wiped, 1);
  assert.equal(j.tinkerer, 0);
  assert.equal(j.forgetter, 1);
  assert.equal(j.problems, 0.5);
  // Ann 1 and Ann 4 came with their moments, Cy's -1 with none; Bo's 0 doesn't count.
  assert.equal(j.silent, 1 / 3);
});
