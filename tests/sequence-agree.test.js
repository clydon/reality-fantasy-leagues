// The scoring sequence scores every draft as the scorers before it did, episode by episode (docs/PLAN-start-a-game-gpt.md track
// C, C2 part 1: "a test per shape that the old scorer and the sequence agree episode by episode"). Each shape (an Outlast, shared,
// in reverse, with early results at the finale, with a cut; a lineup, shared, with early results; a captain; points that multiply
// by when; both; best ball, shared; group slots, by the mean and by the sum; a handicap on a lineup and on an Outlast; a race;
// the guillotine; head to head; a stock market ranked by worth, and one by points) on one made-up season (tests/fixtures/
// scoring-shapes.js), read as nobody and as a seat at every mark (nothing seen, each episode, everything): the table's rows,
// the knockouts' series, each seat's episode scores, each castaway's place, the market, the finale's points, who's out and where
// the game ends. C2 part 2: the week's results on the same season (knockouts on an Outlast and a lineup, head to head with playoffs
// and an odd seat, teams of players summed, by the mean and head to head, pools with lives, a buyback, mulligans, a second pick, a
// pick that never repeats, last one standing and the night everyone left goes out), each with its walk's own output. C2 part 3:
// what the server scores outside the state (a game of questions with every way its points combine, a pot split, only the only one
// right, a rollover, chips, a shrinking call, a wager, a parlay, trivia, an episode fact, the players' answers and the bot's calls,
// and every walk on it, lives, last one standing, everyone out each way, a race, cuts, co-op with each `saves`, head to head, teams,
// a handicap, a span; Weekly Calls and bingo; a game in stages by points, places and wins), each read as the server reads it. C2 part
// 4b: a pool by its points, head to head, in teams and with a handicap; teams knocked out and racing (new reads, part 4b's). C2 part
// 4c: a draft's own questions, an Outlast's and a lineup's, every way their points combine, the server's facts, and cuts, a race,
// head to head, teams and a handicap on them (new reads, part 4c's). Each
// read must be the one the scorers before the sequence gave (tests/fixtures/scoring-shapes.json, recorded at d5222e68, part 3's
// shapes from part 3's parent), but for a plain lineup's table rows, which C2 part 2 moved by a cent on the half-cent moments (the
// fixture's header). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixtures/scoring-shapes.js");

const RECORD = require(F.RECORD);
const { S, G, T } = F.engine();

test("the record has every shape, each read as nobody and as a seat at every mark", () => {
  const names = F.shapes(G).map(([n]) => n);
  assert.deepEqual(Object.keys(RECORD), names);
  for (const name of names) assert.equal(Object.keys(RECORD[name]).length, 18, name);
});

for (const [name] of F.shapes(G)) {
  test(`${name}: every read as before the sequence`, () => {
    const reads = F.readAll(S, G, T, name)[name];
    const apart = Object.entries(reads).filter(([at, r]) => F.hash(r) !== RECORD[name][at]).map(([at]) => at);
    // A difference names where: `node tests/fixtures/scoring-shapes.js --print <shape> <seat> <mark>` prints that read.
    assert.deepEqual(apart, [], `${name}: reads that differ (seat@mark)`);
  });
}

test("the shapes read what they're meant to: every game played, each kind of line in it", () => {
  const read = (name, seat = null, mark = null) => {
    const [, spec, own, o] = F.shapes(G).find(([n]) => n === name);
    return JSON.parse(F.readOf(S, S.GhostLogic.viewFor(F.league(S, G, T, spec, own, o), seat, mark), o));
  };
  // Every shape plays the game its spec says, and carries it whole.
  for (const [name, spec, own, o] of F.shapes(G)) {
    const s = F.league(S, G, T, spec, own, o);
    assert.deepEqual(G.specProblems(spec, F.CTX), [], name);
    // As stored, a game scored by moments carries the rulebook's points (the league's points map): the rest is the spec's.
    const full = G.fullSpec(spec);
    const unpointed = (score) => { const out = { ...score }; delete out.points; return out; };
    const score = unpointed(S.gameOf(s).score);
    const want = unpointed(full.score);
    for (const k of ["span", "get", "count", "rank", "ask", "extras"]) assert.deepEqual(S.gameOf(s)[k], full[k], `${name}: ${k}`);
    assert.deepEqual(score, want, `${name}: score`);
  }
  // An Outlast: a pickup's whole place to whoever holds them now; someone dropped for nobody; places whole.
  const outlast = read("outlast");
  const bo = outlast.rows.find((r) => r.playerId === "bo");
  assert.deepEqual(bo.roster, ["c4", "c5", "c12"]);
  assert.deepEqual(bo.formerRoster, ["c3"]);
  assert.ok(outlast.rows.every((r) => Number.isInteger(r.locked) && Number.isInteger(r.total)));
  // A mark at 6 sees cy's move after Episode 6 (c14 for c8), the series at 6 doesn't (it counts from 7).
  const six = read("outlast", null, 6);
  assert.deepEqual(six.rows.find((r) => r.playerId === "cy").roster, ["c6", "c7", "c14"]);
  // Side bets: ann's 2 and 3, bo's 3 (cy's alone pays nothing); finale predictions at the end.
  assert.deepEqual(outlast.rows.map((r) => [r.playerId, r.bonus]).sort(), [["ann", 5], ["bo", 3], ["cy", 0], ["di", 0]]);
  assert.deepEqual(outlast.finale.sort(), [["ann", 6], ["bo", 1], ["cy", 1]]);
  // A lineup's points carry float noise into the units (3 × 1.1), rounded to the cent where the scorers round.
  const lineup = read("lineup");
  assert.ok(lineup.rows.every((r) => S.roundPoints(r.total) === r.total), JSON.stringify(lineup.rows.map((r) => r.total)));
  // Best ball counts two of three; group slots score their pair; the handicap names the newcomers (bo and di).
  assert.ok(read("best-ball").episodes.every((seats) => seats.every((e) => e.lines.filter((l) => l.counted).length <= 2)));
  assert.ok(read("group-slots").episodes.some((seats) => seats.some((e) => e.slots.some((sl) => sl.status === "held" && sl.points !== 0))));
  assert.deepEqual(read("handicap").rows.filter((r) => r.handicap > 0).map((r) => r.playerId).sort(), ["bo", "di"]);
  // The knockouts: someone out each episode of the guillotine; the race over before the season is.
  assert.ok(read("guillotine").outs.length >= 2);
  assert.ok(read("race").last < 7);
  // A market's worth beside its points.
  assert.ok(read("market").rows.every((r) => typeof r.worth === "number" && typeof r.cash === "number"));
  // C2 part 4b: a pool by its points (its second picks counting); head to head on it, over at its final (Episode 6: cy beats di), its
  // Episode 7 picks counting nothing; the handicap's 2 an episode for bo and di; the series a pool's head to head, teams and
  // handicap read, its last entry each row's total.
  assert.deepEqual(read("pool-total").rows.map((r) => [r.playerId, r.total]), [["ann", 8], ["cy", 6], ["di", 5], ["bo", 2]]);
  const h2h = read("pool-matchups");
  assert.deepEqual([h2h.last, h2h.rows[0].playerId, h2h.rows[0].matchups.champion, h2h.rows.find((r) => r.playerId === "ann").total], [6, "cy", true, 5]);
  assert.deepEqual(read("pool-handicap").rows.map((r) => [r.playerId, r.handicap, r.total]), [["di", 14, 18], ["bo", 14, 16], ["ann", 0, 6], ["cy", 0, 6]]);
  for (const name of ["pool-matchups", "pool-teams", "pool-handicap"]) {
    const r = read(name, null, null);
    // As the table stands: at the game's last episode (head to head's final), else the newest.
    const at = r.week.series.filter((x) => r.last === null || x.number <= r.last).pop();
    for (const row of r.rows) assert.equal(new Map(at.totals).get(row.playerId), row.total, `${name}: ${row.playerId}`);
  }
  // Teams knocked out: the guillotine cuts t3 (cy) after 2 and t2 (bo) after 4, one team left; an Outlast's teams cut after 3 play on
  // with one left; a race between teams over after 2.
  const g = read("teams-guillotine");
  assert.deepEqual([g.week.knockouts.teams.out, g.outs, g.last], [[["t3", 2], ["t2", 4]], [["bo", 4], ["cy", 2]], 4]);
  assert.deepEqual(g.rows.map((r) => [r.playerId, r.team.out, r.team.place]), [["ann", null, 1], ["di", null, 1], ["bo", 4, 2], ["cy", 2, 3]]);
  const o = read("teams-cut-outlast");
  assert.deepEqual([o.week.knockouts.teams.out, o.week.knockouts.ends, o.over], [[["t1", 3]], null, true]);
  assert.deepEqual([read("teams-race").last, read("teams-race").week.knockouts.teams.out], [2, []]);
  // C2 part 4c: a draft's own questions, a line of its table. Who goes home from your own team (ann's c1 and di's c10 in Episode 5,
  // cy's c8 in 6: a point each) and the season's winner (ann's and di's c0: 5); who goes home (ann 2, bo 6, cy 0, di 3) and the
  // answer most of you give (Episode 1 ann's and bo's c13, Episode 5 ann's and cy's c4: 2 each; Episodes 2 and 4 tied, void) beside
  // teams of players; a pot and a rollover on who goes home (bo's 35 of the pots, 6 calls and 14 of the rollover, Episode 3's 2
  // rolling into Episode 4's 4; ann's 10, 2 and 6; di's 15, 3 and 6).
  assert.deepEqual(read("dq-shared").rows.map((r) => [r.playerId, r.questions]), [["ann", 6], ["bo", 0], ["cy", 1], ["di", 6]]);
  assert.deepEqual(read("dq-teams").rows.map((r) => [r.playerId, r.questions]).sort(), [["ann", 6], ["bo", 8], ["cy", 2], ["di", 3]]);
  assert.deepEqual(read("dq-rollover").rows.map((r) => [r.playerId, r.questions]), [["bo", 55], ["ann", 18], ["di", 24], ["cy", 0]]);
  // Each one's row its parts, and (where nothing's knocked out or early) its lines through the newest episode the table's.
  for (const [name] of F.shapes(G).filter(([n]) => n.startsWith("dq-"))) {
    const r = read(name);
    for (const row of r.rows) assert.equal(row.total, S.roundPoints(row.locked + row.bonus + row.finale + row.questions + (row.handicap || 0)), `${name}: ${row.playerId}`);
    if (r.last === null) for (const row of r.rows) assert.equal(r.lines.through[7][row.playerId] || 0, row.questions, `${name}: ${row.playerId} through 7`);
  }
  // Seen at a mark, the lines are that copy's: through Episode 3, ann's who goes home in 1 and the majority's there (1 + 2), bo's two
  // and the majority's (1 + 1 + 2); Episode 4's and later aren't in.
  assert.deepEqual(read("dq-teams", "bo", 3).rows.map((r) => [r.playerId, r.questions]).sort(), [["ann", 3], ["bo", 4], ["cy", 0], ["di", 0]]);
});

test("the screens read the sequence: an episode's points (episode lines, the reveal) and the side bets that paid", () => {
  const path = require("path");
  const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
  const { episodePlayerPoints } = jiti("../src/lib/game/active-roster-rows.ts");
  const { predictionsRight } = jiti("../src/lib/game/classic-view.ts");
  const Seq = require("../src/lib/game/sequence/index.js");
  for (const [name, spec, own, o] of F.shapes(G)) {
    const s = F.league(S, G, T, spec, own, o);
    for (const ep of s.episodes) {
      if (S.gameOf(s).score.by === "moments") {
        const shown = Object.fromEntries(episodePlayerPoints(s, ep.id).map((r) => [r.player.id, r.points]));
        assert.deepEqual(shown, Object.fromEntries(s.players.map((p) => [p.id, S.ActiveRosterLogic.episodeScore(s, ep, p.id).total])), `${name} episode ${ep.number}`);
      }
      for (const p of s.players.map((x) => x.id)) {
        const paid = Seq.betLines(ep.bets).filter((l) => l.playerId === p).reduce((n, l) => n + l.points, 0);
        assert.equal(predictionsRight(s, ep, p).points, S.betsOn(s) ? paid : 0, `${name} episode ${ep.number} ${p}`);
      }
    }
  }
});
