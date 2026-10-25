// The couch's standings across its games (src/lib/game/couch-standings.ts, docs/PLAN-new-design.md step 8): points by
// place normalised to the field, power rankings this year and all-time with who moved, head to head, the trophy shelf
// once a season ends and its records, your numbers and the couch's accolades; and what results ask of someone
// (src/lib/game/results-due.ts) on real demo leagues. No database: made-up tables and demo seasons. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { placePoints, rankingsOf, trophiesOf, yourNumbers, accoladesOf } = jiti("../src/lib/game/couch-standings.ts");
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
  seasonId: over.seasonId, showId: over.showId ?? "surv", showName: over.showName ?? "Survivor", label: over.label,
  artUrl: null, year: over.year ?? 2026, through: over.through ?? 5, ended: !!over.ended, rows: over.rows, before: over.before ?? null,
});

test("a place is worth 10 for first down to 1 for last, whatever the field", () => {
  assert.deepEqual([1, 2, 3, 4].map((p) => placePoints(p, 4)), [10, 7, 4, 1]);
  assert.deepEqual([1, 2].map((p) => placePoints(p, 2)), [10, 1]);
  assert.equal(placePoints(1, 12), 10);
  assert.equal(placePoints(12, 12), 1);
  assert.equal(placePoints(1, 1), 0, "a game of one counts for nothing");
});

test("power rankings: one table across games, ties share a place, the bar by show, who moved", () => {
  const games = [
    game({ leagueId: "a", seasonId: "s51", label: "Survivor 51", rows: rows(["ann", "bo", "cy", "di"]), before: rows(["bo", "ann", "cy", "di"]) }),
    game({ leagueId: "b", seasonId: "t5", showId: "trt", showName: "Traitors", label: "Traitors 5", gameType: "pickem", gameName: "Survival Pool", rows: rows(["bo=cy", "ann", "di"]) }),
    game({ leagueId: "c", seasonId: "s50", label: "Survivor 50", year: 2025, ended: true, rows: rows(["di", "cy", "bo", "ann"]) }),
    game({ leagueId: "d", seasonId: "s52", label: "Survivor 52", through: 0, rows: rows(["ann", "bo"]) }),
  ];
  const r = rankingsOf(games, people, "ann", 2026);
  assert.deepEqual(r.counted, { year: 2, all: 3 }, "a game with nothing scored doesn't count; Survivor 50 was 2025");
  // This year: ann 10 + 4 = 14, bo 7 + 10 = 17, cy 4 + 10 = 14, di 1 + 1 = 2.
  assert.deepEqual(r.year.map((x) => [x.name, x.total, x.rank]), [["bo", 17, "1"], ["ann", 14, "T2"], ["cy", 14, "T2"], ["di", 2, "4"]]);
  const ann = r.year.find((x) => x.name === "ann");
  assert.deepEqual(ann.byShow, [{ showId: "surv", points: 10 }, { showId: "trt", points: 4 }]);
  // One episode back only Survivor 51 had a table (bo, ann, cy, di): cy was 3rd and is T2 now; ann 2nd then and now.
  assert.equal(r.year.find((x) => x.name === "cy").move, "up");
  assert.equal(ann.move, null);
  assert.equal(r.year.find((x) => x.name === "bo").move, null);
  assert.deepEqual(r.all.map((x) => [x.name, x.total]), [["bo", 21], ["cy", 21], ["ann", 15], ["di", 12]]);
  assert.ok(r.all.every((x) => x.move === null), "only This year says who moved");
  // Head to head for ann, over all three games.
  assert.deepEqual(r.h2h.find((h) => h.name === "di"), { userId: "di", name: "di", games: 3, won: 2, lost: 1, tied: 0 });
  assert.deepEqual(r.h2h.find((h) => h.name === "bo"), { userId: "bo", name: "bo", games: 3, won: 1, lost: 2, tied: 0 });
  assert.deepEqual(r.h2h.map((h) => h.name), ["di", "bo", "cy"], "best record first, then by name");
  assert.equal(rankingsOf([games[3]], people, "ann", 2026), null, "nothing scored yet: no rankings");
});

test("the trophy shelf waits for a season to end, then titles, plaques, ran it back and the records", () => {
  const running = game({ leagueId: "r", seasonId: "s51", label: "Survivor 51", rows: rows(["ann", "bo", "cy"]) });
  assert.equal(trophiesOf([running], people, "ann"), null);
  const games = [
    running,
    game({ leagueId: "a", seasonId: "s49", label: "Survivor 49", year: 2025, ended: true, rows: rows(["bo", "ann", "cy", "di"]) }),
    game({ leagueId: "b", seasonId: "s50", label: "Survivor 50", year: 2026, ended: true, rows: rows(["bo", "cy", "ann", "di"]) }),
    game({ leagueId: "c", seasonId: "s50", label: "Survivor 50", year: 2026, ended: true, gameType: "pickem", gameName: "Survival Pool", rows: rows(["ann=di", "bo", "cy"], { ann: { best: 6 }, di: { best: 6 }, bo: { best: 3 } }) }),
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

  const you = yourNumbers(games, rankingsOf(games, people, "ann", 2026), t, "ann");
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
  const games = [game({ leagueId: "a", seasonId: "s51", label: "Survivor 51", gameType: "pickem", gameName: "Survival Pool", rows: rows(["cy", "ann", "bo"], { cy: { called: 3, streak: 4 }, ann: { called: 1, streak: 1 } }) })];
  const a = Object.fromEntries(accoladesOf({ people, follows, messages: new Map([["di", 5], ["ann", 2]]), games }).map((x) => [x.key, `${x.who}: ${x.line}`]));
  assert.equal(a.shows, "bo: 3 shows · 2 nobody else watches");
  assert.equal(a.watched, "surv: 3 of 4 watch it");
  assert.equal(a.called, "cy: 3 predictions right");
  assert.equal(a.chat, "di: 5 messages this month");
  assert.equal(a.streak, "cy: 4 in a row · Survivor 51 Survival Pool");
  assert.deepEqual(accoladesOf({ people, follows: [], messages: new Map([["di", 2]]), games: [] }), [], "nothing worth naming yet");
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
  assert.deepEqual(resultsDue([lineup, pool], 3, null), { reveal: { episode: 4, stage: "final" }, final: null });
  assert.deepEqual(resultsDue([lineup, pool], Infinity, null), { reveal: null, final: null }, "seeing everything: nothing to reveal");
  lineup.episodes.find((e) => e.number === 5).resultsStage = "early";
  assert.deepEqual(resultsDue([lineup, pool], 4, null).reveal, { episode: 5, stage: "early" }, "early if any game is early");
  assert.equal(resultsDue([lineup, pool], 5, 5).final, null, "still early: no morning update");
  delete lineup.episodes.find((e) => e.number === 5).resultsStage;
  assert.deepEqual(resultsDue([lineup, pool], 5, 5).final, { episode: 5 });
  assert.equal(resultsDue([lineup, pool], 4, 5).final, null, "never ahead of your mark");
});
