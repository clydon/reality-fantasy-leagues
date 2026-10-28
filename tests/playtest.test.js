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

test("the room's favourites for someone away: what the app knows first, then the room's own picks, then the list", () => {
  const listOrder = ["a", "b", "c", "d"];
  // Nothing known yet (before any results): the room's picks decide, the most picked first; then the list.
  const flat = { a: { value: 0 }, b: { value: 0 }, c: { value: 0 }, d: { value: 0 } };
  assert.deepEqual(P.favourites(listOrder, { ratings: flat, lists: [["c", "d"], ["c", "b"]], listOrder }), ["c", "b", "d", "a"]);
  assert.deepEqual(P.favourites(listOrder, { ratings: flat, listOrder }), listOrder);
  // Something known: it comes first, whatever the room picked; out of the game (no rating): never offered.
  assert.deepEqual(P.favourites([...listOrder, "gone"], { ratings: { ...flat, d: { value: 2 } }, lists: [["c"]], listOrder }), ["d", "c", "a", "b"]);
});

test("taps a week: a lineup is open, a tap per start or bench, Save; looking 2; a pick 3; a claim 1 + 3 a spot", () => {
  assert.equal(P.lineupTaps([], ["a", "b", "c"]), 5);
  assert.equal(P.lineupTaps(["a", "b", "c"], ["a", "b", "d"]), 4);
  // Someone went home (the app took them out): one start fills the slot.
  assert.equal(P.lineupTaps(["a", "b"], ["a", "b", "d"]), 3);
  assert.equal(P.lineupTaps(["a", "b"], ["b", "a"]), P.TAPS.looked);
  assert.equal(P.claimTaps([]), 0);
  // Backups for the same spot are one spot.
  assert.equal(P.claimTaps([{ addId: "x", dropId: "a" }, { addId: "y", dropId: "a" }, { addId: "x", dropId: "b" }]), 7);
});

test("variants: their names, what they change, and only the replays they change", () => {
  assert.equal(P.variantOf({}).name, "");
  assert.equal(P.variantOf({ away: "list" }).name, "");
  assert.equal(P.variantOf({ away: "favourites", window: "merge" }).name, "away-favourites-window-merge");
  assert.throws(() => P.variantOf({ away: "random" }));
  const away = P.variantOf({ away: "favourites" });
  assert.equal(P.changedBy(away, { group: 1 }, { from: 1, to: null }, 6), false);
  assert.equal(P.changedBy(away, { group: 2, game: "outlast" }, { from: 1, to: null }, 6), true);
  assert.equal(P.changedBy(away, { group: 4, game: "survivalPool" }, { from: 1, to: null }, 6), false, "nobody drafts a pool");
  const win = P.variantOf({ window: "merge" });
  const outlast = { game: "outlast", own: "exclusive", waivers: "on", group: 4 };
  assert.equal(P.changedBy(win, outlast, { from: 1, to: null }, 6), true);
  // Over by the window, or waivers off, or shared, or another game: unchanged.
  assert.equal(P.changedBy(win, outlast, { from: 1, to: 6 }, 6), false);
  assert.equal(P.changedBy(win, { ...outlast, waivers: "off" }, { from: 1, to: null }, 6), false);
  assert.equal(P.changedBy(win, { ...outlast, game: "weeklyLineup" }, { from: 1, to: null }, 6), false);
  assert.equal(P.changedBy(P.variantOf({}), outlast, { from: 1, to: 6 }, 6), true);
  // Two of them, the forgetter the late joiner (the group's last seat): nobody away from the draft.
  assert.equal(P.changedBy(away, { game: "weeklyLineup", group: 2, late: "yes" }, { from: 1, to: null }, 6), false);
  assert.equal(P.changedBy(away, { game: "weeklyLineup", group: 8, late: "yes" }, { from: 1, to: null }, 6), true, "Forgetter 2 is late; the first drafts");
  // Both flags: a replay either one changes.
  const both = P.variantOf({ away: "favourites", window: "merge" });
  assert.equal(P.changedBy(both, { game: "weeklyLineup", group: 4 }, { from: 1, to: null }, 6), true);
  assert.equal(P.changedBy(both, { ...outlast, group: 1 }, { from: 1, to: null }, 6), true);
  assert.equal(P.changedBy(both, { game: "survivalPool", group: 4 }, { from: 1, to: null }, 6), false);
});

test("how much each week asks: taps and cards by role, a season's taps, and praise for a lineup never set", () => {
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }];
  const x = {
    seats,
    config: { span: "season" },
    episodes: [
      { n: 1, asks: { Tinkerer: { taps: 5, card: true }, Forgetter: { taps: 0, card: true } }, moves: { Forgetter: "no lineup (forgot)" }, why: { Forgetter: { says: ["Good call benching Bo (voted out)"] } } },
      { n: 2, asks: { Tinkerer: { taps: 2, card: false }, Forgetter: { taps: 5, card: true } }, moves: { Forgetter: "set Ann" }, why: {} },
      // Before the asks were recorded: not counted.
      { n: 3, moves: { Forgetter: "no lineup (forgot)" }, why: {} },
    ],
  };
  const a = P.asksOf([x]);
  assert.equal(a.weeks, 4);
  assert.equal(a.taps, 3);
  assert.equal(a.card, 0.75);
  assert.deepEqual(a.byRole.tinkerer, { weeks: 2, taps: 3.5, card: 0.5, season: 7 });
  assert.equal(a.byRole.driveby.weeks, 0);
  assert.equal(a.most, 5);
  assert.equal(a.forgot, 2);
  assert.equal(a.idlePraise, 1);
  // A game over part of the season: its weeks count, but not toward a whole season's taps.
  assert.equal(P.asksOf([{ ...x, config: { span: "one" } }]).byRole.tinkerer.season, null);
});

test("the forgetter with a default lineup: open slots filled from the bench in draft order, from the replay alone", () => {
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }];
  const x = {
    config: { game: "weeklyLineup" },
    settings: { activeSlots: 2 },
    seats,
    draft: { Forgetter: ["Ann (picked for them)", "Bo (picked for them)", "Cy (picked for them)"] },
    episodes: [
      // No lineup: Ann and Bo start (Cy's 5 stays on the bench).
      { n: 1, out: [], moves: { Forgetter: "no lineup (forgot)" }, why: { Forgetter: { started: [], bench: ["Ann would have scored 2", "Bo would have scored -1", "Cy would have scored 5"] } }, table: [] },
      // A lineup set: nothing to fill. Ann goes home in it.
      { n: 2, out: ["Ann (Voted out)"], moves: { Forgetter: "set Ann, Cy" }, why: { Forgetter: { started: ["Ann -3 (Voted out -3)", "Cy 1 (Won 1)"], bench: ["Bo would have scored 4"] } }, table: [] },
      // Ann's slot is open: Bo fills it (the first still in and not starting).
      { n: 3, out: [], moves: { Forgetter: "kept last week's lineup (carried)" }, why: { Forgetter: { started: ["Cy 2 (Won 2)"], bench: ["Bo would have scored 3"] } }, table: [{ name: "Tinkerer", total: 5 }, { name: "Forgetter", total: 0 }] },
    ],
  };
  const d = P.defaultLineupOf(x);
  assert.deepEqual(d, { weeks: 2, extra: 4, place: 1, placeWith: 1 });
  x.episodes[2].table[1].total = 1;
  assert.equal(P.defaultLineupOf(x).placeWith, 0, "level with the leader counts as first");
  assert.equal(P.defaultLineupOf({ ...x, config: { game: "outlast" } }), null);
  // Nobody from the draft left to fill with: a waiver pickup on the bench fills it.
  const picked = { ...x, draft: { Forgetter: ["Ann (picked for them)"] }, episodes: [{ n: 1, out: [], moves: { Forgetter: "no lineup (forgot)" }, why: { Forgetter: { started: [], bench: ["Dee would have scored 4"] } }, table: x.episodes[2].table }] };
  assert.equal(P.defaultLineupOf(picked).extra, 4);
});

test("a pool's forgetter with picks made for them: the room's most picked they haven't used, streaks counted again", () => {
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }, { label: "Fan", role: "fan" }];
  const ep = (n, out, moves, picks, table = []) => ({ n, out, moves, why: Object.fromEntries(Object.entries(picks).map(([k, v]) => [k, { pick: v }])), table });
  const x = {
    config: { game: "survivalPool" },
    seats,
    episodes: [
      ep(1, [], { Tinkerer: "picked Ann", Forgetter: "picked Bo", Fan: "picked Ann" }, { Tinkerer: "Ann", Forgetter: "Bo", Fan: "Ann" }),
      // Missed: the room's pick is Cy (they haven't used him), who survives.
      ep(2, ["Dee (Voted out)"], { Tinkerer: "picked Cy", Forgetter: "no pick (forgot)", Fan: "picked Cy" }, { Tinkerer: "Cy", Forgetter: "none", Fan: "Cy" }),
      // Missed again: Cy's used (and goes home), so Eve, who survives.
      ep(3, ["Cy (Voted out)"], { Tinkerer: "picked Cy", Forgetter: "no pick (forgot)", Fan: "picked Eve" }, { Tinkerer: "Cy", Forgetter: "none", Fan: "Eve" }, [
        { name: "Tinkerer", streak: 2, total: 2 },
        { name: "Fan", streak: 3, total: 3 },
        { name: "Forgetter", streak: 1, total: 1 },
      ]),
    ],
  };
  const d = P.poolFallbackOf(x);
  assert.deepEqual(d.played, { streak: 1, total: 1 }, "the replay's own: matches its table");
  assert.deepEqual(d.covered, { streak: 3, total: 3 });
  // Frozen: the two missed weeks left out, so Bo's week stands alone.
  assert.deepEqual(d.frozen, { streak: 1, total: 1 });
  assert.equal(d.weeks, 2);
  assert.equal(d.place, 1);
  assert.equal(d.placeWith, 0, "level with the fan at the top");
  assert.equal(P.poolFallbackOf({ ...x, config: { game: "outlast" } }), null);
  // Nobody twice: a pick made for them earlier spends that castaway, so their own later pick of him becomes the room's.
  const again = {
    ...x,
    episodes: [
      ep(1, [], { Tinkerer: "picked Cy", Forgetter: "no pick (forgot)", Fan: "picked Cy" }, { Tinkerer: "Cy", Forgetter: "none", Fan: "Cy" }),
      ep(2, ["Eve (Voted out)"], { Tinkerer: "picked Eve", Forgetter: "picked Cy", Fan: "picked Eve" }, { Tinkerer: "Eve", Forgetter: "Cy", Fan: "Eve" }, x.episodes[2].table),
    ],
  };
  const g = P.poolFallbackOf(again);
  assert.deepEqual(g.played, { streak: 1, total: 1 });
  assert.deepEqual(g.covered, { streak: 1, total: 1 }, "Cy for them in 1, then the room's Eve in 2, who went home");
  assert.equal(g.weeks, 1);
});

test("Outlast's ties at the top broken by the most still in", () => {
  const last = (leaders, why) => ({ config: { game: "outlast" }, episodes: [{ n: 1, leaders, why }] });
  assert.deepEqual(P.stillInBreakOf(last(["A", "B"], { A: { team: ["x", "y (out)"] }, B: { team: ["z (out)", "w (out)"] } })), { tied: true, tiedStill: false });
  assert.deepEqual(P.stillInBreakOf(last(["A", "B"], { A: { team: ["x"] }, B: { team: ["z"] } })), { tied: true, tiedStill: true });
  assert.deepEqual(P.stillInBreakOf(last(["A"], { A: { team: ["x"] } })), { tied: false, tiedStill: false });
  assert.equal(P.stillInBreakOf({ config: { game: "survivalPool" }, episodes: [{ n: 1, leaders: ["A"] }] }), null);
});

test("a variant beside the whole set: the winner, the forgetter's place, wiped teams, a window's catch", () => {
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }];
  const rec = (winner, order, extra = {}) => ({
    replay: "r1",
    seats,
    final: { winner },
    episodes: [{ n: 1, table: order.map((name) => ({ name })), teamsWithNobodyLeft: [], ...extra }],
  });
  const [row] = P.compareOf([rec("Forgetter", ["Forgetter", "Tinkerer"])], [rec("Tinkerer", ["Tinkerer", "Forgetter"], { waivers: { window: true, byHand: true, episode: 6, wiped: ["Forgetter"], backIn: ["Forgetter"], ran: ["x"] } })]);
  assert.deepEqual(row.winner, { base: "Forgetter", variant: "Tinkerer" });
  assert.deepEqual(row.forgetter, { base: { at: 1, of: 2 }, variant: { at: 2, of: 2 } });
  assert.deepEqual(row.window, { at: 6, wiped: 1, backIn: 1, ran: 1 });
  assert.equal(P.compareOf([], [rec("Tinkerer", ["Tinkerer"])])[0].base, false);
  // A record from before `byHand`: the window the log says was opened, not an earlier scheduled one.
  const older = rec("Tinkerer", ["Tinkerer"]);
  older.log = ["Waivers: Tinkerer opened a window after episode 6 (Swap anyone)"];
  older.episodes = [
    { n: 3, table: [{ name: "Tinkerer" }], waivers: { window: true, episode: 3, wiped: [], backIn: [], ran: [] } },
    { n: 6, table: [{ name: "Tinkerer" }], waivers: { window: true, episode: 6, wiped: ["x"], backIn: [], ran: [] } },
  ];
  assert.deepEqual(P.compareOf([], [older])[0].window, { at: 6, wiped: 1, backIn: 0, ran: 0 });
  // A window the schedule opened isn't one someone opened.
  assert.equal(P.compareOf([], [rec("Tinkerer", ["Tinkerer"], { waivers: { window: true, byHand: false, episode: 3, wiped: [], backIn: [], ran: [] } })])[0].window, null);
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

test("the measures stop at the game's own end: when it says it's over, else its span's end or last exit, not the season's", () => {
  const row = (name, total) => ({ playerId: name, name, total });
  const ep = (n, total, more = {}) => ({ n, leaders: ["Tinkerer"], table: [row("Tinkerer", total), row("Forgetter", 1)], why: {}, teamsWithNobodyLeft: [], leadChange: false, ...more });
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }];
  // Over at the finale (episode 3), then two reunions nobody leaves in: the Forgetter's team is empty after the finale.
  const finale = { left: [{ id: "c1", name: "Ann", method: "Winner" }], teamsWithNobodyLeft: ["Forgetter"] };
  const after = { teamsWithNobodyLeft: ["Forgetter"] };
  const said = {
    seats,
    problems: [],
    final: { over: true, settledAt: 1, leadChanges: 0 },
    episodes: [ep(1, 2, { over: false }), ep(2, 4, { over: false }), ep(3, 6, { ...finale, over: true }), ep(4, 6, { ...after, over: true }), ep(5, 6, { ...after, over: true })],
  };
  assert.equal(P.endOf(said), 3);
  assert.deepEqual(P.gameEpisodes(said).map((e) => e.n), [1, 2, 3]);
  const j = P.judgeOf([said]);
  // Emptied at the finale is the end, not before it; the reunions aren't quiet weeks of the game.
  assert.equal(j.wiped, 0);
  assert.equal(j.quiet, 0);
  assert.equal(j.settled, 0);
  // A file from before `over`: over at the end, so at its last exit; never over, the replay's last episode.
  const before = { ...said, episodes: said.episodes.map(({ over, ...e }) => e) };
  assert.equal(P.endOf(before), 3);
  assert.equal(P.judgeOf([before]).wiped, 0);
  assert.equal(P.endOf({ ...before, final: { ...before.final, over: false } }), 5);
  assert.equal(P.judgeOf([{ ...before, final: { ...before.final, over: false } }]).wiped, 1);
  // One that says it never ends runs to its last episode, whatever left when.
  assert.equal(P.endOf({ ...said, episodes: said.episodes.map((e) => ({ ...e, over: false })) }), 5);
  // A span with an end it reached: that end, though nobody left in it.
  const span = { ...before, span: { from: 1, to: 4 }, episodes: before.episodes.slice(0, 4) };
  assert.equal(P.endOf(span), 4);
  assert.equal(P.endOf({ episodes: [] }), null);
  // Cut at its end, a record's lead changes, when it was settled and the rough count are its own episodes'; uncut, as recorded.
  const lead = { ...said, final: { ...said.final, settledAt: 5, leadChanges: 2 }, episodes: said.episodes.map((e) => ({ ...e, stillInIt: 2 })) };
  lead.episodes[4] = { ...lead.episodes[4], leadChange: true, leaders: ["Forgetter"] };
  lead.episodes[3] = { ...lead.episodes[3], leadChange: true };
  const cut = P.gameRecord(lead);
  assert.equal(cut.cut, true);
  assert.equal(P.judgeOf([lead]).leadChanges, 0);
  assert.equal(P.summaryLine({ ...lead, replay: "r" }).settledAt, 1);
  assert.equal(P.summaryLine({ ...lead, replay: "r" }).leadChanges, 0);
  // Nothing scores after the end: the rough count's weeks left are to episode 3, not 5. Halfway (episode 2): 1 left, best week 0.
  assert.equal(P.roughInItOf(cut, 1), 1);
  assert.equal(P.gameRecord(said).cut, true);
  assert.equal(P.gameRecord({ ...said, episodes: said.episodes.slice(0, 3) }).cut, false);
  assert.equal(P.roughInItOf(P.gameRecord({ ...lead, episodes: lead.episodes.slice(0, 3) }), 1), 2, "uncut: as recorded");
});

test("the measures read a replay's data (ids, points, flags) where it has it, and give what its words give", () => {
  const seats = [{ label: "Tinkerer", role: "tinkerer" }, { label: "Forgetter", role: "forgetter" }, { label: "Fan", role: "fan" }];
  // A name with a number in it, which the words' "Name 3.5 (moments)" would read wrongly, and ids that aren't names.
  const c = { ann: { id: "c1", name: "Ann" }, bo: { id: "c2", name: "Bo 2" }, cy: { id: "c3", name: "Cy" }, dee: { id: "c4", name: "Dee" }, eve: { id: "c5", name: "Eve" } };
  const start = (k, points, items = []) => ({ ...c[k], points, items });
  const bench = (k, points) => ({ ...c[k], points });
  const did = (kind, act, ...ks) => ({ kind, act, ids: ks.map((k) => c[k].id) });
  const lineup = {
    config: { game: "weeklyLineup", span: "season" },
    settings: { activeSlots: 2 },
    seats,
    drafted: { Forgetter: ["ann", "bo", "cy"].map((k) => ({ ...c[k], forThem: true })) },
    episodes: [
      // No lineup (and the app still says "Perfect lineup"): Ann and Bo 2 start by default (Cy's 5 stays on the bench).
      { n: 1, left: [], did: { Forgetter: did("lineup", "forgot") }, asks: { Forgetter: { taps: 0, card: true } }, why: { Forgetter: { starters: [], benched: [bench("ann", 2), bench("bo", -1), bench("cy", 5)], saysKinds: ["perfect"] } }, table: [] },
      { n: 2, left: [{ ...c.ann, method: "Voted out" }], did: { Forgetter: did("lineup", "set", "ann", "cy") }, why: { Forgetter: { starters: [start("ann", -3, [{ label: "Voted out", points: -3 }]), start("cy", 1, [{ label: "Won", points: 1 }])], benched: [bench("bo", 4)] } }, table: [] },
      // Ann's slot is open: Bo 2 fills it.
      { n: 3, left: [], did: { Forgetter: did("lineup", "carried", "cy") }, why: { Forgetter: { starters: [start("cy", 2, [])], benched: [bench("bo", 3)] } }, table: [{ name: "Tinkerer", total: 5 }, { name: "Forgetter", total: 0 }] },
    ],
  };
  assert.deepEqual(P.defaultLineupOf(lineup), { weeks: 2, extra: 4, place: 1, placeWith: 1 });
  const a = P.asksOf([lineup]);
  assert.equal(a.forgot, 1);
  assert.equal(a.idlePraise, 1);
  // Cy's 2 came with no moments: one of the three starters who scored is silent.
  assert.equal(P.judgeOf([{ ...lineup, problems: [], final: null, episodes: lineup.episodes.map((e) => ({ ...e, leaders: [], teamsWithNobodyLeft: [] })) }]).silent, 1 / 3);

  // A pool, as the words test above has it, in data.
  const pick = (k, correct = null) => ({ picked: k ? { id: c[k].id, name: c[k].name, correct } : null });
  const ep = (n, left, moves, picks, table = []) => ({ n, left: left.map((k) => ({ ...c[k], method: "Voted out" })), did: moves, why: Object.fromEntries(Object.entries(picks).map(([s, k]) => [s, pick(k)])), table });
  const pool = {
    config: { game: "survivalPool" },
    seats,
    episodes: [
      ep(1, [], { Tinkerer: did("pick", "picked", "ann"), Forgetter: did("pick", "picked", "bo"), Fan: did("pick", "picked", "ann") }, { Tinkerer: "ann", Forgetter: "bo", Fan: "ann" }),
      ep(2, ["dee"], { Tinkerer: did("pick", "picked", "cy"), Forgetter: did("pick", "forgot"), Fan: did("pick", "picked", "cy") }, { Tinkerer: "cy", Forgetter: null, Fan: "cy" }),
      ep(3, ["cy"], { Tinkerer: did("pick", "picked", "cy"), Forgetter: did("pick", "forgot"), Fan: did("pick", "picked", "eve") }, { Tinkerer: "cy", Forgetter: null, Fan: "eve" }, [
        { name: "Tinkerer", streak: 2, total: 2 },
        { name: "Fan", streak: 3, total: 3 },
        { name: "Forgetter", streak: 1, total: 1 },
      ]),
    ],
  };
  const d = P.poolFallbackOf(pool);
  assert.deepEqual([d.played, d.covered, d.frozen, d.weeks, d.place, d.placeWith], [{ streak: 1, total: 1 }, { streak: 3, total: 3 }, { streak: 1, total: 1 }, 2, 1, 0]);
  // A new pick refused leaves the old one standing, and that's the pick (Bo, who survives episode 1).
  const refused = { ...pool, episodes: [{ ...pool.episodes[0], did: { ...pool.episodes[0].did, Forgetter: did("pick", "refused", "bo") } }, ...pool.episodes.slice(1)] };
  assert.deepEqual(P.poolFallbackOf(refused).played, { streak: 1, total: 1 });
  // An episode with data is read only from it: a seat missing there isn't looked up in the words (names, not ids).
  const missing = { ...pool, episodes: pool.episodes.map((e) => ({ ...e, did: { Tinkerer: e.did.Tinkerer, Fan: e.did.Fan }, moves: { Forgetter: "picked Bo 2" } })) };
  assert.deepEqual(P.poolFallbackOf(missing).played, { streak: 0, total: 0 });

  // Outlast: members' flags, not "(out)" in a name.
  const outlast = (why) => ({ config: { game: "outlast" }, episodes: [{ n: 1, leaders: ["A", "B"], why }] });
  const team = (...outs) => ({ members: outs.map((out, i) => ({ id: `m${i}`, name: `Ann (out) ${i}`, out })) });
  assert.deepEqual(P.stillInBreakOf(outlast({ A: team(false, true), B: team(true, true) })), { tied: true, tiedStill: false });
  assert.deepEqual(P.stillInBreakOf(outlast({ A: team(false), B: team(false) })), { tied: true, tiedStill: true });
});

test("the results variants: accepted plays every replay, autopilot is the whole set again, and the review's taps", () => {
  const accepted = P.variantOf({ results: "accepted" });
  assert.equal(accepted.name, "results-accepted");
  assert.equal(P.variantOf({ results: "autopilot" }).name, "results-autopilot");
  assert.equal(P.variantOf({}).results, "autopilot");
  assert.throws(() => P.variantOf({ results: "reviewed" }));
  for (const c of [{ game: "survivalPool", group: 1 }, { game: "outlast", own: "shared", group: 16 }]) assert.equal(P.changedBy(accepted, c, { from: 1, to: null }, 6), true);
  // With another flag, the results still change every replay; autopilot leaves the other's choice alone.
  assert.equal(P.changedBy(P.variantOf({ away: "favourites", results: "accepted" }), { game: "survivalPool", group: 4 }, { from: 1, to: null }, 6), true);
  assert.equal(P.changedBy(P.variantOf({ away: "favourites", results: "autopilot" }), { game: "survivalPool", group: 4 }, { from: 1, to: null }, 6), false);
  // Backstage and Show me, It's right and Apply; a tick each, Apply and the sheet's Apply.
  assert.equal(P.reviewTaps({ quick: null, full: [] }), 0);
  assert.equal(P.reviewTaps({ quick: ["Ann (Voted Out)"], full: [] }), 4);
  assert.equal(P.reviewTaps({ quick: null, full: ["a", "b", "c"] }), 7);
  assert.equal(P.reviewTaps({ quick: ["nobody"], full: ["a"] }), 7);
});

test("quick-exits: who left from the quick check, everything else from the full research, the answer fitted to its prompt", () => {
  const v = P.variantOf({ results: "quick-exits" });
  assert.equal(v.name, "results-quick-exits");
  assert.equal(P.changedBy(v, { game: "outlast", own: "shared", group: 16 }, { from: 1, to: null }, 6), true);
  // Who the prompt asks about, as pasteSkeleton gives them: every answer at its most non-committal.
  const skel = (name) => ({ name, leftTheGame: "unknown", exitMethod: null, wonDailyChallenge: "unknown", sources: [], confidence: "low" });
  const asked = ["Ann Lee", "Bob Ray", "Cy Fox", "Di Moe"].map(skel);
  const full = {
    episodeTitle: "Three",
    summary: "kept as it was",
    castaways: [
      { name: "Ann Lee", leftTheGame: "yes", exitMethod: "Eliminated", wonDailyChallenge: "yes", sources: ["a1"], confidence: "high" },
      { name: "Bob Ray", leftTheGame: "no", exitMethod: null, wonDailyChallenge: "yes", sources: ["b1"], confidence: "medium" },
      { name: "Cy Fox", leftTheGame: "yes", exitMethod: "Other", wonDailyChallenge: "no", sources: ["c1"], confidence: "medium" },
      { name: "Ed Ray", leftTheGame: "no", exitMethod: null, wonDailyChallenge: "yes", sources: ["e1"], confidence: "high" },
    ],
  };
  const exitMethods = ["Eliminated", "Disqualified", "Quit", "Winner", "Finalist", "Other"];
  const quick = { found: true, left: [{ name: "Bob Ray", how: "Disqualified", matched: true }, { name: "Cy Fox", how: "Quit", matched: true }], sources: ["q1", "q2"] };
  const got = P.quickExits(JSON.stringify(full), { asked, quick, exitMethods, winnerExit: "Winner" });
  assert.deepEqual(got.changes, {
    quick: "found",
    left: ["Bob Ray (Disqualified)"],
    stayed: ["Ann Lee (Eliminated)"],
    added: ["Di Moe"],
    dropped: ["Ed Ray"],
    unasked: [],
    raised: ["Bob Ray: wonDailyChallenge"],
    winners: [],
  });
  const out = JSON.parse(got.text);
  assert.equal(out.summary, "kept as it was");
  assert.deepEqual(out.castaways.map((c) => c.name), ["Ann Lee", "Bob Ray", "Cy Fox", "Di Moe"]);
  const [ann, bob, cy, di] = out.castaways;
  // The full research's leaver the quick check doesn't name stays, and keeps everything else it said.
  assert.deepEqual(ann, { ...full.castaways[0], leftTheGame: "no", exitMethod: null });
  // The quick check's leaver leaves as the app files a quick check: its method, high (the entry's other answers with it), its
  // sources beside the entry's.
  assert.deepEqual(bob, { ...full.castaways[1], leftTheGame: "yes", exitMethod: "Disqualified", confidence: "high", sources: ["b1", "q1", "q2"] });
  // Both say they left: the full research's method and confidence stand (finding 2 stays as it was).
  assert.deepEqual(cy, full.castaways[2]);
  // Still in here, gone by the recording: the prompt's own non-committal entry, staying in.
  assert.deepEqual(di, { ...skel("Di Moe"), leftTheGame: "no" });
  assert.match(P.reshapeLine(got.changes), /^left Bob Ray \(Disqualified\); stayed Ann Lee \(Eliminated\); raised to high with the exit: Bob Ray: wonDailyChallenge; added/);

  // A name it can't match (a nickname, someone gone): not a whole account, so its matched names leave and nobody's turned back.
  const partial = P.quickExits(JSON.stringify(full), { asked, quick: { ...quick, left: [...quick.left, { name: "Annie", how: "Eliminated", matched: false }] }, exitMethods });
  assert.equal(partial.changes.quick, "unknown-name");
  assert.deepEqual([partial.changes.left, partial.changes.stayed, partial.changes.unasked], [["Bob Ray (Disqualified)"], [], ["Annie"]]);
  assert.equal(JSON.parse(partial.text).castaways[0].leftTheGame, "yes");
  assert.match(P.reshapeLine(partial.changes), /the quick check's Annie not asked about, so nobody was turned back$/);

  // A finale: the quick check's winner and finalists kept (finding 1's belt); a how not in the show's words is "Other".
  const finale = { castaways: [{ name: "Rob Ray", leftTheGame: "no", exitMethod: null, sources: [], confidence: "high" }, { name: "Mo Dee", leftTheGame: "unknown", exitMethod: null, sources: [], confidence: "low" }, { name: "Al Bo", leftTheGame: "no", exitMethod: null, sources: [], confidence: "high" }] };
  const finalists = ["Rob Ray", "Mo Dee", "Al Bo"].map(skel);
  const won = P.quickExits(JSON.stringify(finale), {
    asked: finalists,
    quick: { found: true, left: [{ name: "Rob Ray", how: "Winner", matched: true }, { name: "Mo Dee", how: "Finalist", matched: true }, { name: "Al Bo", how: "walked off in the night", matched: true }], sources: ["q"] },
    exitMethods,
    winnerExit: "Winner",
  });
  assert.deepEqual(won.changes.left, ["Rob Ray (Winner)", "Mo Dee (Finalist)", "Al Bo (Other)"]);
  assert.deepEqual(won.changes.winners, ["Rob Ray"]);
  assert.match(P.reshapeLine(won.changes), /^left Rob Ray \(Winner\), Mo Dee \(Finalist\), Al Bo \(Other\) \(the winner kept: Rob Ray\)$/);
  // Both crown the winner: nothing to change, but the answer as filed has its winner.
  const both = P.quickExits(JSON.stringify({ castaways: [{ ...finale.castaways[0], leftTheGame: "yes", exitMethod: "Winner" }, finale.castaways[1], finale.castaways[2]] }), {
    asked: finalists,
    quick: { found: true, left: [{ name: "Rob Ray", how: "Winner", matched: true }], sources: ["q"] },
    exitMethods,
    winnerExit: "Winner",
  });
  assert.deepEqual([both.changes.left, both.changes.winners, P.reshapeLine(both.changes)], [[], ["Rob Ray"], "nothing changed"]);

  // The quick check said nobody: taken at its word (the app holds it as a doubt), so the full research's leavers stay.
  const nobody = P.quickExits(JSON.stringify(full), { asked, quick: { found: true, left: [], sources: [] }, exitMethods });
  assert.equal(nobody.changes.quick, "nobody");
  assert.deepEqual([nobody.changes.stayed, nobody.changes.left], [["Ann Lee (Eliminated)", "Cy Fox (Other)"], []]);
  assert.match(P.reshapeLine(nobody.changes), /^the quick check says nobody left \(taken at its word\); stayed Ann Lee/);
  // It found nothing, or none was asked: who left is the full research's, but the answer still fits its prompt.
  for (const [q, says] of [[{ found: false, left: [], sources: [] }, "nothing"], [null, "none"]]) {
    const x = P.quickExits(JSON.stringify(full), { asked, quick: q, exitMethods });
    assert.equal(x.changes.quick, says);
    assert.deepEqual([x.changes.left, x.changes.stayed, x.changes.added, x.changes.dropped], [[], [], ["Di Moe"], ["Ed Ray"]]);
    assert.equal(JSON.parse(x.text).castaways[0].leftTheGame, "yes");
    assert.match(P.reshapeLine(x.changes), says === "none" ? /^no quick check asked: who left is the full research's; added/ : /^the quick check found nothing: who left/);
  }

  // A name as asked wins its place before a forgiving match: a gone "Bob" can't take "Bobby Smith"'s entry.
  const bobby = P.quickExits(JSON.stringify({ castaways: [{ name: "Bob", leftTheGame: "no", sources: [], confidence: "high" }, 0, { name: "Bobby Smith", leftTheGame: "no", wonDailyChallenge: "yes", sources: "https://ab", confidence: "low" }] }), {
    asked: [skel("Bobby Smith")],
    quick: { found: true, left: [{ name: "Bobby Smith", how: "Quit", matched: true }], sources: ["q1"] },
    exitMethods,
  });
  assert.deepEqual(bobby.changes.dropped, ["(no entry)", "Bob"]);
  // A source given as a string is one source, not its letters.
  assert.deepEqual(JSON.parse(bobby.text).castaways, [{ name: "Bobby Smith", leftTheGame: "yes", exitMethod: "Quit", wonDailyChallenge: "yes", sources: ["https://ab", "q1"], confidence: "high" }]);

  // Not an answer with castaways: left alone.
  assert.deepEqual(P.quickExits("no idea", { asked, quick, exitMethods }), { text: "no idea", changes: null });
  assert.equal(P.quickExits(JSON.stringify({ castaways: asked }), { asked, quick: { found: true, left: [], sources: [] } }).changes.left.length, 0);
});

test("who could still win, from the game's own best possible week: Outlast's people still in, a lineup's team at its best", () => {
  const row = (name, total, extra = {}) => ({ playerId: name, name, total, ...extra });
  const member = (id, out = false) => ({ id, name: id, out });
  // Outlast with 3 episodes left and at most 2 going home an episode, 4 still in: at most 3 eliminations to outlast.
  const outlast = {
    config: { game: "outlast" },
    span: { from: 1, to: null },
    tape: { episodes: 5 },
    episodes: [
      { n: 1, left: [{ id: "x1" }, { id: "x2" }], table: [], why: {} },
      {
        n: 2,
        left: [{ id: "x3" }],
        stillIn: 4,
        table: [row("A", 10), row("B", 8), row("C", 5), row("D", 9)],
        why: { A: { members: [member("a1"), member("a2", true)] }, B: { members: [member("b1")] }, C: { members: [member("c1")] }, D: { members: [member("d1", true)] } },
      },
    ],
  };
  // A (the leader) is in; B 8 + 3 = 11 reaches 10; C 5 + 3 = 8 doesn't; D has nobody left.
  assert.equal(P.inItOf(outlast, 1), 2);
  // Without the cast still in (an older file): 2 a week for 3 weeks, so C's 5 + 6 = 11 reaches it too.
  assert.equal(P.inItOf({ ...outlast, episodes: outlast.episodes.map((e) => ({ ...e, stillIn: undefined })) }, 1), 3);
  // To the season's end everyone still in but one goes, however few have gone an episode so far: 9 still in, C 5 + 8 reaches 10.
  assert.equal(P.inItOf({ ...outlast, episodes: [outlast.episodes[0], { ...outlast.episodes[1], stillIn: 9 }] }, 1), 3);
  // A game that ends at episode 3 (Start a game's end, over the span's): one episode left, at most 2 go, B's 8 + 2 reaches 10.
  assert.equal(P.inItOf({ ...outlast, settings: { endEpisode: 3 }, episodes: [outlast.episodes[0], { ...outlast.episodes[1], stillIn: 9 }] }, 1), 2);

  // Weekly Lineup, 2 start, 2 episodes left: each team as it stands, its people at their best episode so far.
  const s = (id, points) => ({ id, name: id, points, items: [] });
  const lineup = {
    config: { game: "weeklyLineup" },
    settings: { activeSlots: 2 },
    span: { from: 1, to: 4 },
    episodes: [
      { n: 1, left: [], table: [], why: { A: { starters: [s("a1", 6), s("a2", 1)], benched: [s("a3", 2)] }, B: { starters: [s("b1", 1)], benched: [s("b2", 3)] } } },
      {
        n: 2,
        left: [{ id: "a1" }],
        table: [row("A", 30), row("B", 22), row("C", 29)],
        why: { A: { starters: [s("a1", 0), s("a2", 1)], benched: [s("a3", 2)] }, B: { starters: [s("b1", 1)], benched: [s("b2", 4)] }, C: { starters: [], benched: [] } },
      },
    ],
  };
  // B: b2 at 4 and b1 at 1, 5 a week, 22 + 10 = 32 reaches 30; C has nobody, 29 doesn't. A leads.
  assert.equal(P.inItOf(lineup, 1), 2);
  // A pool: a streak that could still reach the leader's.
  const pool = { config: { game: "survivalPool" }, span: { from: 1, to: null }, tape: { episodes: 4 }, episodes: [{ n: 2, table: [row("A", 2, { streak: 2, current: 2 }), row("B", 0, { streak: 0, current: 0 }), row("C", 1, { streak: 1, current: 0 })], why: {} }] };
  assert.equal(P.inItOf(pool, 0), 3);
  assert.equal(P.inItOf({ ...pool, tape: { episodes: 3 } }, 0), 1);
  assert.equal(P.inItOf({ config: { game: "outlast" }, episodes: [{ n: 1, table: [] }] }, 0), null);

  // judgeOf: the rough count beside it, as a share of the table at the middle episode and three quarters in (the mean).
  const third = { n: 3, left: [], table: [row("A", 33), row("B", 22), row("C", 29)], why: { A: lineup.episodes[1].why.A, B: { starters: [], benched: [] }, C: { starters: [], benched: [] } } };
  const eps = [...lineup.episodes, third].map((e, i) => ({ ...e, leaders: ["A"], stillInIt: 3, teamsWithNobodyLeft: [], table: i ? e.table : [row("A", 0), row("B", 0), row("C", 0)] }));
  const j = P.judgeOf([{ ...lineup, seats: [], problems: [], final: null, episodes: eps }]);
  // Middle (episode 2): 2 of 3 by its own week, all by the rough count; three quarters in (episode 2 again, of 3): the same.
  assert.deepEqual(j.inIt.half, { rough: 1, own: 2 / 3, replays: 1 });
  assert.deepEqual(j.inIt.late, { rough: 1, own: 2 / 3, replays: 1 });
  assert.equal(P.judgeOf([{ ...lineup, seats: [], problems: [], final: null, episodes: eps.slice(0, 2) }]).inIt.half, null, "two episodes are too few");
});

test("a results variant beside the whole set: over, points in the table, who went home in only one, what was accepted", () => {
  const rec = (over, totals, out, accepted) => ({
    replay: "r1",
    config: { game: "weeklyLineup" },
    seats: [],
    final: { winner: totals[0][0], over },
    episodes: [
      { n: 2, left: out.map((name) => ({ id: `id-${name}-${accepted}`, name })), table: [] },
      { n: 3, left: [], table: totals.map(([name, total]) => ({ name, total })) },
    ],
    tape: { results: [{ episode: 1, accepted: { quick: ["x"], full: ["y"] } }, { episode: 2, ...(accepted ? { accepted: { quick: [], full: ["a", "b"] } } : {}) }] },
  });
  const [row] = P.compareOf([rec(false, [["A", 10], ["B", 8]], ["Ann"], 0)], [rec(true, [["B", 15], ["A", 12]], ["Ann", "Rob"], 1)]);
  assert.deepEqual(row.over, { base: false, variant: true });
  assert.deepEqual(row.points, { base: 18, variant: 27 });
  // By name: a castaway's id is new in every game.
  assert.deepEqual(row.out, { base: 1, variant: 2, onlyVariant: ["Rob (2)"], onlyBase: [] });
  // Only the episodes it played (episode 1 was before it started).
  assert.equal(row.accepted, 2);
  assert.equal(row.reshaped, 0);
  // quick-exits: who left changed by the reshape, in the episodes it played.
  const reshaped = rec(true, [["B", 15]], ["Ann"], 0);
  reshaped.tape.results = [{ episode: 1, reshaped: { left: ["x (Quit)"], stayed: [] } }, { episode: 2, reshaped: { left: ["Ann (Winner)"], stayed: ["Rob (Eliminated)", "Cy (Other)"] } }];
  assert.equal(P.compareOf([rec(false, [["A", 10]], [], 0)], [reshaped])[0].reshaped, 3);
  assert.deepEqual(P.compareByGame([row]), [{ game: "weeklyLineup", replays: 1, winnerChanged: 1, points: 0.5, out: 1, over: { base: 0, variant: 1 }, ghosted: { base: 0, variant: 0 } }]);
});

test("someone gone by one set's answers and never by the other's, still played in the other: drafted after, kept, started, picked", () => {
  const seats = [{ label: "A", role: "tinkerer" }, { label: "B", role: "forgetter" }, { label: "C", role: "fan", late: true }];
  const left = (n, ...names) => ({ n, left: names.map((name) => ({ id: name, name })), table: [], why: {} });
  // Rob goes home at 3 in the variant's season (any of its replays); the whole set's never has him go.
  const variant = [{ show: "t", season: 4, episodes: [left(2, "Ann"), left(3, "Rob")] }, { show: "t", season: 4, episodes: [left(3, "Rob", "Bo")] }];
  assert.deepEqual([...P.seasonExits(variant).get("t 4")], [["Ann", 2], ["Rob", 3], ["Bo", 3]]);
  const gone = [{ name: "Rob", at: 3 }];
  const member = (name, out = false) => ({ id: name, name, out });
  // A game from episode 4: drafting Rob is drafting someone gone (a computer player too); the late joiner took him from
  // Join's pool at 6. Kept to the end; started; picked.
  const game = {
    seats,
    span: { from: 4, to: null, late: 6 },
    drafted: { A: [{ id: "c1", name: "Rob" }], B: [{ id: "c2", name: "Ann" }], "Ivy (computer)": [{ id: "c1", name: "Rob" }] },
    joinedWith: { C: [{ id: "c1", name: "Rob" }] },
    episodes: [
      { n: 4, why: { A: { starters: [{ name: "Rob", points: 0 }] }, B: { picked: { name: "Rob", correct: true } } } },
      { n: 5, why: { A: { members: [member("Rob")] }, B: { members: [member("Ann", true)] } } },
    ],
  };
  assert.deepEqual(P.ghostsOf(game, gone), { drafted: ["A: Rob", "Ivy (computer): Rob", "C: Rob"], kept: ["A: Rob"], started: 1, picked: 1 });
  // A file from before the data: the draft's words.
  assert.deepEqual(P.ghostsOf({ ...game, drafted: null, joinedWith: null, draft: { B: ["Rob (locked in for them)"] }, episodes: [] }, gone).drafted, ["B: Rob"]);
  // A game drafted at episode 1, before Rob went: the draft was fair; only what came after counts.
  assert.deepEqual(P.ghostsOf({ ...game, joinedWith: null, span: { from: 1, to: null, late: null }, episodes: [{ n: 3, why: { A: { starters: [{ name: "Rob", points: 2 }] } } }] }, gone), { drafted: [], kept: [], started: 0, picked: 0 });
  // compareOf: the whole set's replay holds Rob in; the variant's doesn't.
  const rec = (out, kept) => ({ replay: "r", show: "t", season: 4, config: { game: "outlast" }, seats, span: { from: 1 }, final: null, episodes: [{ n: 3, left: out, table: [], why: {} }, { n: 4, left: [], table: [], why: { A: { members: [member("Rob", !kept)] } } }] });
  const [row] = P.compareOf([rec([], true)], [rec([{ id: "x", name: "Rob" }], false)]);
  assert.deepEqual(row.ghosts.base.kept, ["A: Rob"]);
  assert.deepEqual(row.ghosts.variant.kept, []);
  assert.deepEqual(P.compareByGame([row])[0].ghosted, { base: 1, variant: 0 });
});
