// The couch's standings across its games (src/lib/game/couch-standings.ts, docs/PLAN-new-design.md step 8): points by
// place normalised to the field, power rankings as Couch points (2026-10-31) with who moved, head to head, the trophy shelf
// once a season ends and its records, your numbers and the couch's accolades; and what results ask of someone
// (src/lib/game/results-due.ts) on real demo leagues. No database: made-up tables and demo seasons. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { placePoints, rankingsOf, headToHead, trophiesOf, yourNumbers, accoladesOf, COUCH_POINTS, joinNames, leadWorthNaming } = jiti("../src/lib/game/couch-standings.ts");
const { resultsDue } = jiti("../src/lib/game/results-due.ts");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const S = require("../src/lib/game/state-logic.js");

const people = ["ann", "bo", "cy", "di"].map((n) => ({ userId: n, name: n }));
/** A game's table from names best first ("bo=ann" ties them): places and ranks as tableOf gives them. */
const rows = (order, extra = {}) => {
  const out = [];
  let at = 0;
  order.forEach((slot, i) => {
    const names = slot.split("=");
    for (const who of names) out.push({ userId: who, name: who, place: at + 1, rank: `${names.length > 1 ? "T" : ""}${at + 1}`, total: 100 - i * 10, ...(extra[who] || {}) });
    at += names.length;
  });
  return out;
};
const game = (over) => ({
  leagueId: over.leagueId, name: "G", gameName: over.gameName ?? "Outlast", gameType: over.gameType ?? "classic-draft",
  seasonId: over.seasonId, showId: over.showId ?? "surv", showName: over.showName ?? "Survivor", label: over.label, span: over.span ?? null,
  artUrl: null, year: over.year ?? 2026, through: over.through ?? 5, ended: !!over.ended, rows: over.rows, before: over.before ?? null,
});

test("games over a span (step 6 of PLAN-sports-data): each plaque names its span, and winning the next span of the season runs it back", () => {
  const span = (from, to) => ({ from, to, name: from === to ? `Game ${from}` : `Games ${from}–${to}` });
  const games = [
    game({ leagueId: "a", seasonId: "ws", label: "World Series 2026", gameName: "Weekly Lineup", gameType: "active-roster", ended: true, span: span(1, 3), rows: rows(["bo", "ann"]) }),
    game({ leagueId: "b", seasonId: "ws", label: "World Series 2026", gameName: "Weekly Lineup", gameType: "active-roster", ended: true, span: span(4, 6), rows: rows(["bo", "ann"]) }),
    game({ leagueId: "c", seasonId: "ws", label: "World Series 2026", gameName: "Survival Pool", gameType: "pickem", pool: true, ended: true, span: span(7, 7), rows: rows(["ann", "bo"]) }),
  ];
  const t = trophiesOf(games, people, "ann");
  assert.deepEqual(t.plaques.map((p) => [p.leagueId, p.label, p.span, p.ranItBack]), [
    ["c", "World Series 2026", "Game 7", false],
    ["b", "World Series 2026", "Games 4–6", true],
    ["a", "World Series 2026", "Games 1–3", false],
  ], "the season's later spans first; bo won Games 1-3, then Games 4-6");
  assert.deepEqual(t.records.find((r) => r.key === "ranItBack")?.line, "World Series 2026 · Games 1–3 and Games 4–6");
  assert.equal(trophiesOf([game({ leagueId: "x", seasonId: "s50", label: "Survivor 50", ended: true, rows: rows(["bo", "ann"]) })], people, "ann").plaques[0].span, null, "a season game names no span");
});

test("a place is worth 10 for first down to 1 for last, whatever the field", () => {
  assert.deepEqual([1, 2, 3, 4].map((p) => placePoints(p, 4)), [10, 7, 4, 1]);
  assert.deepEqual([1, 2].map((p) => placePoints(p, 2)), [10, 1]);
  assert.equal(placePoints(1, 12), 10);
  assert.equal(placePoints(12, 12), 1);
  assert.equal(placePoints(1, 1), 0, "a game of one counts for nothing");
});

test("power rankings are Couch points: what each thing is worth, everyone on the couch, ties share a place, the bar by kind, who moved since a week ago", () => {
  const c = (userId, kind, all, year = all, week = 0) => ({ userId, kind, all, year, week });
  const counts = [
    // ann: 10 + 6 moves × 2 + 10 messages = 32, 4 of it this week.
    c("ann", "couch", 1), c("ann", "move", 6, 6, 2), c("ann", "chat", 10),
    // bo: 10 + a game started 10 + 2 shows × 5 + a rating 2 = 32, 5 this week.
    c("bo", "couch", 1), c("bo", "started", 1), c("bo", "follow", 2, 2, 1), c("bo", "rating", 1),
    // cy: 10 + 5 reactions + 3 days = 18, 8 this week.
    c("cy", "couch", 1), c("cy", "reaction", 5, 5, 5), c("cy", "day", 3, 3, 3),
    c("stranger", "couch", 1), c("ann", "nonsense", 9),
  ];
  const r = rankingsOf([], people, "ann", counts, true);
  assert.equal(r.year, null, "nothing from before this year: no This year table");
  assert.deepEqual(r.all.map((x) => [x.name, x.total, x.rank, x.week]), [["ann", 32, "T1", 4], ["bo", 32, "T1", 5], ["cy", 18, "3", 8], ["di", 0, "4", 0]], "di has none and is still on the table; a stranger and an unknown kind count for nothing");
  assert.deepEqual(r.all[0].byKind, [{ kind: "move", points: 12 }, { kind: "couch", points: 10 }, { kind: "chat", points: 10 }]);
  // A week ago: ann 28, bo 27, cy 10, di 0. bo caught ann.
  assert.deepEqual(r.all.map((x) => [x.name, x.move]), [["ann", null], ["bo", "up"], ["cy", null], ["di", null]]);
  assert.equal(rankingsOf([], [], "ann", counts, true), null, "a couch of nobody");
  const newcomer = rankingsOf([], people, "ann", [...counts, c("di", "couch", 1, 1, 1)], true).all.find((x) => x.name === "di");
  assert.deepEqual([newcomer.total, newcomer.rank, newcomer.move], [10, "4", null], "joined this week: not on last week's table, so no arrow");

  // di joined last year and opened the app twice this year: This year is its own table now.
  const later = rankingsOf([], people, "ann", [...counts, c("di", "couch", 1, 0), c("di", "day", 2, 2, 0)], false);
  assert.deepEqual(later.year.map((x) => [x.name, x.total]), [["ann", 32], ["bo", 32], ["cy", 18], ["di", 2]]);
  assert.deepEqual(later.all.map((x) => [x.name, x.total]).at(-1), ["di", 12]);
  assert.ok(later.year.every((x) => x.move === null && x.week === 0), "a week that started last year says nothing of who moved this year");
  assert.equal(later.all.find((x) => x.name === "bo").move, "up", "all time still does");
  assert.equal(COUCH_POINTS.find((p) => p.kind === "chat").cap, "10 a day");
});

test("head to head stays the games: how often you finished above each of them", () => {
  const games = [
    game({ leagueId: "a", seasonId: "s51", label: "Survivor 51", rows: rows(["ann", "bo", "cy", "di"]), before: rows(["bo", "ann", "cy", "di"]) }),
    game({ leagueId: "b", seasonId: "t5", showId: "trt", showName: "Traitors", label: "Traitors 5", gameType: "pickem", pool: true, gameName: "Survival Pool", rows: rows(["bo=cy", "ann", "di"]) }),
    game({ leagueId: "c", seasonId: "s50", label: "Survivor 50", year: 2025, ended: true, rows: rows(["di", "cy", "bo", "ann"]) }),
    game({ leagueId: "d", seasonId: "s52", label: "Survivor 52", through: 0, rows: rows(["ann", "bo"]) }),
  ];
  const h2h = rankingsOf(games, people, "ann", [], true).h2h;
  assert.deepEqual(h2h, headToHead(games, people, "ann"));
  assert.deepEqual(h2h.find((h) => h.name === "di"), { userId: "di", name: "di", games: 3, won: 2, lost: 1, tied: 0 }, "a game with nothing scored doesn't count");
  assert.deepEqual(h2h.find((h) => h.name === "bo"), { userId: "bo", name: "bo", games: 3, won: 1, lost: 2, tied: 0 });
  assert.deepEqual(h2h.map((h) => h.name), ["di", "bo", "cy"], "best record first, then by name");
});

test("the trophy shelf waits for a season to end, then titles, plaques, ran it back and the records", () => {
  const running = game({ leagueId: "r", seasonId: "s51", label: "Survivor 51", rows: rows(["ann", "bo", "cy"]) });
  assert.equal(trophiesOf([running], people, "ann"), null);
  const games = [
    running,
    game({ leagueId: "a", seasonId: "s49", label: "Survivor 49", year: 2025, ended: true, rows: rows(["bo", "ann", "cy", "di"]) }),
    game({ leagueId: "b", seasonId: "s50", label: "Survivor 50", year: 2026, ended: true, rows: rows(["bo", "cy", "ann", "di"]) }),
    game({ leagueId: "c", seasonId: "s50", label: "Survivor 50", year: 2026, ended: true, gameType: "pickem", pool: true, gameName: "Survival Pool", rows: rows(["ann=di", "bo", "cy"], { ann: { best: 6 }, di: { best: 6 }, bo: { best: 3 } }) }),
  ];
  const t = trophiesOf(games, people, "ann");
  assert.equal(t.titles, 1, "a shared first is a title");
  assert.equal(t.seasons, 3, "three seasons played on the couch, finished or not");
  assert.equal(t.average, 2, "finishes 2, 3, 1");
  assert.deepEqual(t.leader, { who: { userId: "bo", name: "bo" }, titles: 2 });
  assert.deepEqual(t.plaques.map((p) => [p.label, p.gameName, p.you.rank, p.winners.map((w) => w.name).join("+"), p.ranItBack]), [
    ["Survivor 50", "Outlast", "3", "bo", true],
    ["Survivor 50", "Survival Pool", "T1", "ann+di", false],
    ["Survivor 49", "Outlast", "2", "bo", false],
  ]);
  assert.equal(t.plaques[0].by, 10, "won on points by the gap to second");
  assert.equal(t.plaques[1].by, null, "a pool is won on streaks, and this one was shared");
  const rec = Object.fromEntries(t.records.map((r) => [r.key, [r.who.name, r.line]]));
  assert.deepEqual(rec.titles, ["bo", "2 titles"]);
  assert.deepEqual(rec.ranItBack, ["bo", "Survivor 49 and 50"]);
  assert.deepEqual(rec.streak, ["ann", "6 episodes · Survivor 50"]);
  assert.equal(rec.average[0], "bo");

  const you = yourNumbers(games, rankingsOf(games, people, "ann", [{ userId: "ann", kind: "couch", all: 1, year: 1, week: 0 }], true), t, "ann");
  assert.deepEqual([you.points, you.place, you.thisYear], [10, "1", false], "your Couch points and place, all time while there's no year before this one");
  assert.equal(you.titles, 1);
  assert.equal(you.seasons, 3);
  assert.deepEqual(you.bestFinish, { rank: "1", label: "Survivor 50", gameName: "Survival Pool" });
  assert.equal(you.bestShow.name, "Survivor");
});

test("couch accolades: only shared follows, only when they say something", () => {
  const follows = [
    ...["surv", "trt", "chl"].map((s) => ({ userId: "bo", showId: s, showName: s })),
    { userId: "ann", showId: "surv", showName: "surv" },
    { userId: "cy", showId: "surv", showName: "surv" },
  ];
  const games = [game({ leagueId: "a", seasonId: "s51", label: "Survivor 51", gameType: "pickem", pool: true, gameName: "Survival Pool", rows: rows(["cy", "ann", "bo"], { cy: { called: 3, streak: 4 }, ann: { called: 1, streak: 1 } }) })];
  const a = Object.fromEntries(accoladesOf({ people, follows, messages: new Map([["di", 5], ["ann", 2]]), games }).map((x) => [x.key, `${x.who}: ${x.line}`]));
  assert.equal(a.shows, "bo: 3 shows · 2 nobody else watches");
  assert.equal(a.watched, "surv: 3 of 4 watch it");
  assert.equal(a.called, "cy: 3 predictions right");
  assert.equal(a.chat, "di: 5 messages this month");
  assert.equal(a.streak, "cy: 4 in a row · Survivor 51 Survival Pool");
  assert.deepEqual(accoladesOf({ people, follows: [], messages: new Map([["di", 2]]), games: [] }), [], "nothing worth naming yet");

  // A tie at the top is named only when it's worth it: two of a field of eight or more, on more than one. Never one of them alone.
  const eight = [...people, ...["ed", "fi", "gus", "hal"].map((n) => ({ userId: n, name: n }))];
  const tie = accoladesOf({ people: eight, follows: [...follows, { userId: "ann", showId: "trt", showName: "trt" }, { userId: "ann", showId: "chl", showName: "chl" }], messages: new Map([["di", 5], ["ann", 5], ["bo", 4]]), games: [] });
  const t = Object.fromEntries(tie.map((x) => [x.key, x]));
  assert.deepEqual([t.chat.who, t.chat.line, t.chat.tied.map((p) => p.userId)], ["ann and di", "5 messages this month", ["ann", "di"]]);
  assert.deepEqual([t.shows.who, t.shows.line], ["ann and bo", "3 shows"], "nobody else watching is one person's to say");
  const small = accoladesOf({ people, follows: [], messages: new Map([["di", 5], ["ann", 5]]), games: [] });
  assert.equal(small.find((x) => x.key === "chat"), undefined, "two of a couch of four is half of it: no accolade");
  assert.equal(accoladesOf({ people: eight, follows: [], messages: new Map([["di", 5], ["ann", 5], ["bo", 5]]), games: [] }).find((x) => x.key === "chat"), undefined, "three sharing it: never");
  assert.equal(accoladesOf({ people, follows, messages: new Map([["di", 5], ["ann", 2]]), games }).find((x) => x.key === "chat").tied, undefined, "one leader: no tie");
  assert.deepEqual([joinNames(["ann"]), joinNames(["ann", "bo"]), joinNames(["ann", "bo", "cy"])], ["ann", "ann and bo", "ann, bo and cy"]);
});

test("a lead is worth naming: one leader alone, or two on more than once in a field of eight or more", () => {
  assert.equal(leadWorthNaming(1, 1, 18), true, "one did it: a fact worth naming");
  assert.equal(leadWorthNaming(2, 1, 18), false, "two did it once: not a lead");
  assert.equal(leadWorthNaming(2, 2, 18), true);
  assert.equal(leadWorthNaming(2, 3, 8), true, "two is a quarter of eight");
  assert.equal(leadWorthNaming(2, 3, 7), false, "and more than a quarter of seven");
  assert.equal(leadWorthNaming(3, 4, 24), false, "three or more: never");
  assert.equal(leadWorthNaming(5, 1, 18), false);
});

test("first to finish: the newest first finish on the couch, in days from the drop", () => {
  const DAY = 24 * 3600 * 1000;
  const drop = Date.parse("2026-10-01T07:00:00Z");
  const first = (finishes) => accoladesOf({ people, follows: [], messages: new Map(), games: [], firstFinishes: finishes }).find((x) => x.key === "first-finish");
  const a = first([
    { userId: "bo", showName: "Severance", at: drop + 4 * DAY + 3600_000, dropAt: drop },
    { userId: "ann", showName: "Older Show", at: drop - 30 * DAY, dropAt: drop - 33 * DAY },
  ]);
  assert.deepEqual(a && { stat: a.stat, who: a.who, userId: a.userId, line: a.line }, { stat: "First to finish", who: "bo", userId: "bo", line: "Severance, in 4 days" });
  assert.equal(first([{ userId: "cy", showName: "Fast", at: drop + 5 * 3600_000, dropAt: drop }]).line, "Fast, in a day", "within the day");
  assert.equal(first([{ userId: "cy", showName: "Undated", at: drop, dropAt: null }]).line, "Undated", "no drop time: just the show");
  assert.equal(first([{ userId: "stranger", showName: "X", at: drop, dropAt: drop }]), undefined, "someone not on the couch");
  assert.equal(first([]), undefined);
});

test("results due: the next episode to reveal by stage, and the morning update once its final scores land", () => {
  const data = {
    id: "t", showId: "survivor", showName: "T", seasonName: "T", episodeCount: 12,
    players: ["ann", "bo"].map((key) => ({ key, name: key, color: "#000" })),
    castaways: Array.from({ length: 18 }, (_, i) => ({ key: `k${i}`, name: `C ${i}`, placement: i + 1, exitEpisode: Math.min(i + 1, 12), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out" })),
  };
  const lineup = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "active-roster", 5))));
  const pool = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, "pickem", 5))));
  assert.deepEqual(resultsDue([lineup, pool], 5, null), { reveal: null, final: null });
  assert.deepEqual(resultsDue([lineup, pool], 3, null), { reveal: { episode: 4, stage: "final", finalAt: null }, final: null });
  assert.deepEqual(resultsDue([lineup, pool], Infinity, null), { reveal: null, final: null }, "seeing everything: nothing to reveal");
  lineup.episodes.find((e) => e.number === 5).resultsStage = "early";
  assert.deepEqual(resultsDue([lineup, pool], 4, null).reveal, { episode: 5, stage: "early", finalAt: null }, "early if any game is early");
  assert.equal(resultsDue([lineup, pool], 5, 5).final, null, "still early: no morning update");
  delete lineup.episodes.find((e) => e.number === 5).resultsStage;
  assert.deepEqual(resultsDue([lineup, pool], 5, 5).final, { episode: 5, finalAt: null });
  assert.deepEqual(resultsDue([lineup, pool], 5, 5, (n) => `final-${n}`).final, { episode: 5, finalAt: "final-5" }, "with its final time");
  assert.equal(resultsDue([lineup, pool], 4, 5).final, null, "never ahead of your mark");
});
