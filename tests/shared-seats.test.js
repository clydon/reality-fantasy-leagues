// A team two people share (docs/PLAN-start-a-game-gpt.md step A10 part 4b: the stretch row s18 "My partner and I share one
// team", the dial row who.sharedTeam). The spec's extras.seats ({ people }): its shape, default and words, both ways through the
// settings, what it's refused beside (a call, a bingo card: each person's own), a stored spec that doesn't share staying as it
// is, and the exclusive count by teams, not people (ctx.teams). The server's pieces that need no database: the next seat_slot,
// and the couch crediting each person on a shared team while counting it once in the field (couch-standings.ts fieldOf). The
// rest (joining by an invite, either acting, who made each move, leaving, the marks, Undo) is
// scripts/dev-test/check-shared-seats.js, through the app's API. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const G = require("../src/lib/game/game-spec/index.js");
const S = require("../src/lib/game/state-logic.js");
const { freeSlot, seatRoom } = jiti("../src/lib/server/shared-seats.ts");
const { fieldOf, placePoints, rankingsOf, trophiesOf, yourNumbers } = jiti("../src/lib/game/couch-standings.ts");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true };
const SEATS = (people) => ({ seats: people === undefined ? {} : { people } });
const lineup = (extras) => ({ preset: "weekly-lineup", extras });
const S18 = lineup({ seats: { people: 2 } });

test("a shared team: the spec's shape, its default, its words and the settings both ways", () => {
  assert.deepEqual(G.specProblems(S18, CTX), []);
  assert.deepEqual(G.specWaitsFor(S18), []);
  assert.equal(G.typeOf(S18), "active-roster", "it changes who holds a seat, not the game");
  // `seats: {}` is two a team; left out (or null) is one, said by leaving it out, so no stored spec changes.
  assert.deepEqual(G.fullSpec(lineup(SEATS())).extras.seats, { people: 2 });
  assert.equal(G.seatPeople(G.fullSpec(lineup(SEATS()))), 2);
  assert.equal("seats" in G.fullSpec(G.PRESETS["weekly-lineup"]).extras, false);
  assert.equal("seats" in G.fullSpec(lineup({ seats: null })).extras, false);
  assert.equal(G.seatPeople(G.fullSpec(G.PRESETS.outlast)), 1);
  for (const id of Object.keys(G.PRESETS)) assert.deepEqual(G.fullSpec(G.PRESETS[id]), G.PRESETS[id], `${id} is whole as it was`);
  // Both ways: seatPeople, and back to the same spec; a game that doesn't share writes nothing for it.
  const fields = G.settingsOf(lineup(SEATS(3)));
  assert.equal(fields.seatPeople, 3);
  const st = G.withSpec(S.defaultState().settings, lineup(SEATS(3)));
  assert.deepEqual(G.specOf(st).extras.seats, { people: 3 });
  assert.deepEqual(G.specOf(st), G.fullSpec(lineup(SEATS(3))));
  assert.equal(G.settingsOf(G.PRESETS["weekly-lineup"]).seatPeople, undefined);
  const off = G.withSpec(st, G.PRESETS["weekly-lineup"]);
  assert.equal("seatPeople" in off, false, "stopping sharing takes the field away");
  assert.equal("seats" in G.specOf(off).extras, false);
  // A league's stored settings that never shared read with no seats (game-specs-flag: nothing drifts).
  const plain = S.defaultState().settings;
  assert.equal("seats" in G.specOf(plain).extras, false);
  // Each kind of game that has a seat to share.
  for (const spec of [
    { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, extras: SEATS(2) },
    { preset: "survival-pool", extras: SEATS(2) },
    { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "w", ask: "Who goes?", answer: "person", points: 1, settle: { by: "results", take: "out" } }], extras: SEATS(2) },
  ]) {
    assert.deepEqual(G.specProblems(spec, CTX), [], JSON.stringify(spec));
    assert.equal(G.settingsOf(spec).seatPeople, 2);
  }
  // The words: the sentence, How it works, the detail.
  const d = G.describeSpec(S18, { show: "Survivor 51", castaway: "castaway" });
  assert.match(d.sentence, / Up to two of you can share a team\.$/);
  assert.ok(d.rules.some((r) => /^Sharing a team: up to two of you can hold one team, joining by an invite to it\. Any of you can make its moves, and the last one made counts\./.test(r)));
  assert.deepEqual(d.details.find((x) => x.id === "seats"), { id: "seats", label: "Sharing a team", recommended: false, value: "Up to two a team" });
  const pool = G.describeSpec({ preset: "survival-pool", extras: SEATS(2) }, { show: "Survivor 51", castaway: "castaway" });
  assert.ok(pool.rules.some((r) => r.startsWith("Sharing a team: up to two of you can hold one place")));
  assert.deepEqual(G.describeSpec(G.PRESETS.outlast, {}).details.find((x) => x.id === "seats"), { id: "seats", label: "Sharing a team", recommended: true, value: "One each" });
  assert.equal(G.describeSpec(G.PRESETS["weekly-bingo"], {}).details.find((x) => x.id === "seats"), undefined, "nothing to share on a bingo card");
  assert.equal(G.describeSpec(G.PRESETS.outlast, {}).sentence.includes("share"), false);
});

test("a shared team: what's refused, and why", () => {
  assert.deepEqual(ats(G.specProblems(lineup(SEATS(1)), CTX)), ["extras.seats"], "one a team is said by leaving it out");
  assert.deepEqual(ats(G.specProblems(lineup(SEATS(G.MAX_SEAT_PEOPLE + 1)), CTX)), ["extras.seats"]);
  assert.deepEqual(ats(G.specProblems(lineup(SEATS(2.5)), CTX)), ["extras.seats"]);
  assert.deepEqual(ats(G.specProblems(lineup({ seats: { people: 2, agree: true } }), CTX)), ["extras.seats.agree"]);
  assert.deepEqual(ats(G.specProblems(lineup({ seats: 2 }), CTX)), ["extras.seats"]);
  // A call and a bingo card are each person's own.
  const bingo = G.specProblems({ ...G.PRESETS["weekly-bingo"], extras: { ...G.PRESETS["weekly-bingo"].extras, ...SEATS(2) } }, CTX);
  assert.deepEqual(ats(bingo), ["extras.seats"]);
  assert.match(bingo[0].problem, /A bingo card is each person's own/);
  const calls = G.specProblems({ ...G.PRESETS["weekly-calls"], extras: { ...G.PRESETS["weekly-calls"].extras, ...SEATS(2) } }, CTX);
  assert.deepEqual(ats(calls), ["extras.seats"]);
  assert.match(calls[0].problem, /A call is each person's own/);
  const poolCalls = { ...G.PRESETS["survival-pool"], extras: { ...G.PRESETS["survival-pool"].extras, calls: true, ...SEATS(2) } };
  assert.deepEqual(ats(G.specProblems(poolCalls, CTX)), ["extras.seats"], "a pool's weekly call beside the pick is each person's too");
  assert.equal(G.settingsOf(poolCalls), null, "nothing invalid is written");
  // A league's own, too: a game that shares can't add a call it couldn't have started with.
  assert.deepEqual(ats(G.specProblems(poolCalls, CTX, { league: true })), ["extras.seats"]);
});

test("a shared team: the exclusive count is of teams, not people (ctx.teams)", () => {
  const snake = (each, extras) => ({ preset: "outlast", get: { by: "draft", each, order: "snake", own: "exclusive" }, ...(extras ? { extras } : {}) });
  const own = (spec, ctx) => G.specProblems(spec, { ...CTX, ...ctx }).filter((p) => p.at === "get.own").map((p) => p.problem);
  // Eight people as six teams (two pairs share) drafting 3 each from 18: 18 picks, covered. Without ctx.teams, eight teams.
  assert.deepEqual(own(snake(3, SEATS(2)), { pool: 18, couch: 8, teams: 6 }), []);
  assert.deepEqual(own(snake(3, SEATS(2)), { pool: 18, couch: 8 }), ["8 of you × 3 picks is more than the 18 who can be drafted: make it shared, so two of you can have the same one"], "fail closed: everyone their own team");
  assert.deepEqual(own(snake(3, SEATS(2)), { pool: 18, couch: 8, teams: 7 }), ["7 teams × 3 picks is more than the 18 who can be drafted: make it shared, so two of you can have the same one"]);
  assert.deepEqual(own(snake(3), { pool: 18, couch: 6, teams: 6 }), [], "teams as many as people say it as people");
  assert.deepEqual(own(snake(4), { pool: 18, couch: 5, teams: 5 }), ["5 of you × 4 picks is more than the 18 who can be drafted: make it shared, so two of you can have the same one"]);
  assert.deepEqual(G.teamsOf({ teams: 6, couch: 8 }), { n: 6, said: "6 teams" });
  assert.deepEqual(G.teamsOf({ couch: 8 }), { n: 8, said: "8 of you" });
  assert.equal(G.teamsOf({ pool: 18 }), null, "not counted without either");
  // A stock market and a spread draft count teams too.
  const market = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive", budget: { trade: {} } }, extras: SEATS(2) };
  assert.equal(own(market, { pool: 18, couch: 8, teams: 6 }).length, 1, "6 teams × 3 takes all 18: nobody's left to buy");
  assert.match(own(market, { pool: 18, couch: 8, teams: 6 })[0], /^6 teams × 3 picks takes all 18/);
  assert.deepEqual(own(market, { pool: 18, couch: 8, teams: 5 }), []);
  const spread = { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive", across: { of: "group" } }, extras: SEATS(2) };
  assert.deepEqual(own(spread, { pool: 18, poolGroups: [9, 3], couch: 6, teams: 3 }), []);
  assert.match(own(spread, { pool: 18, poolGroups: [9, 3], couch: 6, teams: 4 })[0] || "", /^4 teams each need 1 from every group, and one has only 3/);
});

test("a shared team: the room on a seat and the next seat_slot", () => {
  assert.equal(seatRoom({ settings: G.withSpec(S.defaultState().settings, S18) }), 2);
  assert.equal(seatRoom({ settings: S.defaultState().settings }), 1);
  assert.equal(freeSlot([]), 0);
  assert.equal(freeSlot([0]), 1);
  assert.equal(freeSlot([1]), 0, "the first left, the second stays: the next takes the first's");
  assert.equal(freeSlot([0, 2]), 1);
});

test("a shared team on the couch: each person credited with its place, one team in the field", () => {
  const people = ["ann", "bo", "cy", "di"].map((n) => ({ userId: n, name: n }));
  // ann and bo share seat p1, first; cy is second, di third: three teams.
  const shared = [
    { userId: "ann", name: "Pair", place: 1, rank: "1", total: 90, seat: "p1" },
    { userId: "bo", name: "Pair", place: 1, rank: "1", total: 90, seat: "p1" },
    { userId: "cy", name: "cy", place: 2, rank: "2", total: 80, seat: "p2" },
    { userId: "di", name: "di", place: 3, rank: "3", total: 70, seat: "p3" },
  ];
  assert.equal(fieldOf(shared), 3);
  assert.equal(fieldOf(shared.map(({ seat, ...r }) => r)), 4, "rows without a seat each count, as before");
  const game = { leagueId: "g", name: "G", gameName: "Outlast", gameType: "classic-draft", seasonId: "s", showId: "surv", showName: "Survivor", label: "Survivor 51", span: null, artUrl: null, year: 2026, through: 5, ended: true, rows: shared, before: null };
  // Power rankings are Couch points since 2026-10-31; a place's points (your best show) are of three teams, not four rows.
  const r = rankingsOf([game], people, "cy", [], true);
  assert.deepEqual(shared.map((x) => placePoints(x.place, fieldOf(shared))), [10, 10, 6, 1], "both of them credited first; second of three teams, not of four rows");
  // The trophy goes to both; each has the game in their numbers.
  const t = trophiesOf([game], people, "bo");
  assert.deepEqual(t.plaques[0].winners.map((w) => w.userId).sort(), ["ann", "bo"]);
  assert.deepEqual(t.plaques[0].you, { place: 1, rank: "1" });
  for (const me of ["ann", "bo"]) {
    const you = yourNumbers([game], rankingsOf([game], people, me, [], true), trophiesOf([game], people, me), me);
    assert.equal(you.bestFinish?.rank, "1", `${me}'s best finish`);
  }
  assert.equal(r.h2h.find((h) => h.userId === "ann").won, 0, "cy lost to the pair's team");
  assert.equal(r.h2h.find((h) => h.userId === "ann").lost, 1);
  // Partners didn't play each other: no head to head between ann and bo.
  assert.equal(rankingsOf([game], people, "ann", [], true).h2h.find((h) => h.userId === "bo"), undefined);
  // One winning team: its plaque has the margin (90 to 80), and running it back counts for whichever of them won before.
  assert.equal(t.plaques[0].by, 10);
  const last = { ...game, leagueId: "g0", seasonId: "s0", label: "Survivor 50", year: 2025, rows: [
    { userId: "bo", name: "bo", place: 1, rank: "1", total: 50, seat: "q1" },
    { userId: "cy", name: "cy", place: 2, rank: "2", total: 40, seat: "q2" },
  ] };
  const both = trophiesOf([game, last], people, "ann");
  assert.equal(both.plaques.find((p) => p.leagueId === "g").ranItBack, true, "bo won Survivor 50, and shares the team that won 51");
  assert.equal(both.records.find((x) => x.key === "ranItBack")?.who.userId, "bo");
});
