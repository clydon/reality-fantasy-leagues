// The scoring sequence scores every draft as the scorers before it did, episode by episode (docs/PLAN-start-a-game-gpt.md track
// C, C2 part 1: "a test per shape that the old scorer and the sequence agree episode by episode"). Each shape (an Outlast, shared,
// in reverse, with early results at the finale, with a cut; a lineup, shared, with early results; a captain; points that multiply
// by when; both; best ball, shared; group slots, by the mean and by the sum; a handicap on a lineup and on an Outlast; a race;
// the guillotine; head to head; a stock market ranked by worth, and one by points) on one made-up season (tests/fixtures/
// scoring-shapes.js), read as nobody and as a seat at every mark (nothing seen, each episode, everything): the table's rows,
// the knockouts' series, each seat's episode scores, each castaway's place, the market, the finale's points, who's out and where
// the game ends. Each read must be the one the scorers before the sequence gave (tests/fixtures/scoring-shapes.json, recorded at
// d5222e68). Run with `npm test`.
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
    return JSON.parse(F.readOf(S, S.GhostLogic.viewFor(F.league(S, G, T, spec, own, o), seat, mark)));
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
        assert.deepEqual(shown, Object.fromEntries(F.SEATS.map((p) => [p, S.ActiveRosterLogic.episodeScore(s, ep, p).total])), `${name} episode ${ep.number}`);
      }
      for (const p of F.SEATS) {
        const paid = Seq.betLines(ep.bets).filter((l) => l.playerId === p).reduce((n, l) => n + l.points, 0);
        assert.equal(predictionsRight(s, ep, p).points, S.betsOn(s) ? paid : 0, `${name} episode ${ep.number} ${p}`);
      }
    }
  }
});
