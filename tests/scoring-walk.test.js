// A draft's one walk (docs/PLAN-start-a-game-gpt.md track C, C2 part 2: state-logic.js ScoringLogic.walk): the table is the
// scoring sequence at now, the knockouts' series (what a race, the cuts, head to head and the teams read) the same sequence at each
// episode once its results are final; one walk where each had its own. Where they meet: every draft's table and its series' last
// episode agree wherever nothing is known now that wasn't then (no episode still early, no pickup since, nothing graded early); a
// plain lineup's table is its episodes' totals (C2 part 2: it rounded after each moment, a cent apart on a half cent); an
// Outlast's castaway out with no place recorded counts nothing in the series too, from the episode they went out (it counted as
// still in). Where they differ on purpose, the table counting what's known now: a newest episode's early results, a side bet
// marked right before its episode's results, a pickup made since the last results. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixtures/scoring-shapes.js");

const { S, G, T } = F.engine();
const shape = (name) => F.shapes(G).find(([n]) => n === name);
const leagueOf = (name, edit) => {
  const [, spec, own, o] = shape(name);
  const s = F.league(S, G, T, spec, own, o);
  if (edit) edit(s);
  return s;
};
// A draft's table before anything ranks or freezes it: its scorer's rows (an Outlast's, a lineup's).
const tableOf = (v) => (S.gameOf(v).score.by === "place" ? S.EliminationOrderScoringStrategy : S.ActiveRosterEventScoringStrategy).compute(v);
const lockedOf = (rows) => Object.fromEntries(rows.map((r) => [r.playerId, r.locked]));
const lastRow = (s) => {
  const series = S.KnockoutLogic.series(s);
  const last = series[series.length - 1];
  return Object.fromEntries([...last.rows].map(([id, r]) => [id, r.locked]));
};

test("the table is the walk at now and the series the walk at each episode: every draft, every mark", () => {
  for (const [name, spec, own, o] of F.shapes(G)) {
    if (S.gameOf(F.league(S, G, T, spec, own, o)).get.by !== "draft") continue;
    for (const mark of [0, 2, 4, 7, null]) {
      const v = S.GhostLogic.viewFor(F.league(S, G, T, spec, own, o), null, mark);
      const walk = S.ScoringLogic.walk(v);
      const now = S.ScoringLogic.walk(v, { now: true });
      const series = S.ScoringLogic.walk(v, { series: true });
      assert.deepEqual(series.series, walk.series, `${name}@${mark}: the series alone, as with now`);
      assert.deepEqual(now.now, walk.now, `${name}@${mark}: now alone, as with the series`);
      assert.deepEqual(now.series, [], "nothing walked that wasn't asked for");
      assert.equal(series.now.size, 0);
      assert.deepEqual(S.KnockoutLogic.series(v), walk.series, `${name}@${mark}: the knockouts' series is the walk's`);
      // The table's points are the walk's now (a game that knocks players out freezes them at their last episode in: KnockoutLogic.apply).
      const table = tableOf(v);
      table.forEach((r) => assert.equal(r.locked, walk.now.get(r.playerId).locked, `${name}@${mark} ${r.playerId}`));
    }
  }
});

test("where nothing is known now that wasn't then, a draft's table and its series' last episode agree", () => {
  // Every lineup at the end (no episode early, the moves all counted by then); an Outlast too, at Episode 7 (cy's pickup after 6
  // counts from 7), and on one where someone went out with no place recorded.
  for (const name of ["lineup", "lineup-shared", "captain", "times", "captain-times", "best-ball", "group-slots", "group-slots-sum", "race", "matchups", "outlast", "outlast-shared", "outlast-reverse"]) {
    const s = leagueOf(name);
    assert.deepEqual(lockedOf(tableOf(s)), lastRow(s), name);
  }
  // A plain lineup now adds up its episodes' totals, as its series always did: a cent apart before on the half cents (0.5 points x
  // 1.15 units), never on a show's halves.
  const plain = leagueOf("lineup");
  const byEpisode = new Map(plain.players.map((p) => [p.id, 0]));
  plain.episodes.forEach((ep) => plain.players.forEach((p) => byEpisode.set(p.id, S.roundPoints(byEpisode.get(p.id) + S.ActiveRosterLogic.episodeScore(plain, ep, p.id).total))));
  assert.deepEqual(lockedOf(tableOf(plain)), Object.fromEntries(byEpisode));
});

test("a holding counts once an episode, however a stored lineup lists it: the table, the series and the episode's points", () => {
  // ann's Episode 4 lineup with c2 twice (validateLineup refuses it; a stored one is read as it is).
  const twice = leagueOf("lineup", (st) => { st.episodes.find((e) => e.number === 4).lineups.ann = ["c2", "c2"]; });
  const once = leagueOf("lineup", (st) => { st.episodes.find((e) => e.number === 4).lineups.ann = ["c2"]; });
  const ep = (st) => st.episodes.find((e) => e.number === 4);
  assert.equal(S.ActiveRosterLogic.episodeScore(twice, ep(twice), "ann").lines.length, 1);
  assert.equal(S.ActiveRosterLogic.episodeScore(twice, ep(twice), "ann").total, S.ActiveRosterLogic.episodeScore(once, ep(once), "ann").total);
  assert.deepEqual(lockedOf(tableOf(twice)), lockedOf(tableOf(once)));
  assert.deepEqual(lastRow(twice), lastRow(once));
});

test("an Outlast's castaway out with no place counts nothing, in the table and in the series from the episode they went out", () => {
  // cy's c6 went out in Episode 4; its place taken away (a data error): no boot outlasted, no place, nothing.
  const s = leagueOf("outlast", (st) => { st.castaways.find((c) => c.id === "c6").placementOrder = null; });
  const series = S.KnockoutLogic.series(s);
  const at = (n) => series.find((x) => x.number === n).rows.get("cy");
  const ok = leagueOf("outlast");
  const okAt = (n) => S.KnockoutLogic.series(ok).find((x) => x.number === n).rows.get("cy");
  // Before Episode 4 it's still in, as it was; from 4 on it counts nothing (it counted as still in), and the boots are one fewer.
  assert.equal(at(3).locked, okAt(3).locked);
  const stillInAt = (n) => 1 + s.castaways.filter((c) => c.status === "eliminated" && typeof c.placementOrder === "number" && Number(c.exitEpisodeId.slice(1)) <= n).length;
  const heldAt4 = ["c6", "c7", "c8"];
  assert.equal(at(4).locked, heldAt4.filter((id) => id !== "c6").length * stillInAt(4), "c7 and c8 still in; c6 nothing");
  assert.deepEqual(lockedOf(tableOf(s)), lastRow(s), "the table and the series agree on it");
});

test("the table counts what's known now; the series waits for final results and counts a pickup from the next episode", () => {
  // A lineup's newest episode with early results: in the table, not yet in the series.
  const early = leagueOf("lineup", (st) => { st.episodes.find((e) => e.number === 7).resultsStage = "early"; });
  const series = S.KnockoutLogic.series(early);
  assert.deepEqual(series.map((x) => x.number), [1, 2, 3, 4, 5, 6]);
  const table = lockedOf(tableOf(early));
  assert.ok(Object.keys(table).some((id) => table[id] !== lastRow(early)[id]), "Episode 7's moments are in the table only");
  assert.deepEqual(table, lockedOf(tableOf(leagueOf("lineup"))), "as its final results will have them");
  // A side bet marked right before its episode has results: the table's, not the series'.
  const bet = leagueOf("outlast", (st) => {
    const ep = st.episodes.find((e) => e.number === 7);
    ep.events = [];
    ep.scoringEvents = [];
    st.castaways.forEach((c) => { if (c.exitEpisodeId === "e7") Object.assign(c, { status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null }); });
    ep.bets = [{ id: "b7", label: "A tie?", points: 4, predictions: [{ id: "p7", playerId: "di", guess: "yes", correct: true }, { id: "p8", playerId: "bo", guess: "no", correct: false }] }];
  });
  const rows = S.computeScores(bet);
  const last = S.KnockoutLogic.series(bet).pop();
  assert.equal(last.number, 6);
  assert.equal(rows.find((r) => r.playerId === "di").bonus - last.rows.get("di").bonus, 4);
  // A pickup made after the latest results: the table credits it now, the series from the next episode.
  const six = S.GhostLogic.viewFor(leagueOf("outlast"), null, 6);
  const cy = S.computeScores(six).find((r) => r.playerId === "cy");
  assert.deepEqual(cy.roster.map((c) => c.id), ["c6", "c7", "c14"]);
  assert.notEqual(cy.locked, lastRow(six).cy, "c14 for c8: in the table at once");
});
