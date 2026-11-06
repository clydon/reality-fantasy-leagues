// L3 part 1 (docs/PLAN-start-a-game-gpt.md track L): a team game's final as the server keeps it (src/lib/sports/final.ts
// storedGame, saved with its game: sports_events.lines), scored through the scoring sequence's line for a stat
// (src/lib/game/sequence/stats.js statMoments, momentRaw's moments) and graded from the same kept final (storedFacts:
// facts.games' one). On the recorded fixtures (tests/fixtures/espn/) and the user's examples (tests/fixtures/sports-examples.js):
// what's kept, read back as saved (JSON), scores and grades exactly as the phone's scorer does on ESPN's own summary. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, statePoints, storedGame, storedState, storedFacts, groupOf } = jiti("../src/lib/sports/index.ts");
const { statLine, statMoments } = require("../src/lib/game/sequence/stats.js");
const Seq = require("../src/lib/game/sequence/index.js");
const { verdictOf, pointsFor } = require("../src/lib/game/game-spec/index.js");
const examples = require("./fixtures/sports-examples.js");

const SIXERS = require("./fixtures/espn/nba-401909093.json");
const nba = sportOf("basketball/nba");
// As saved and read back: the database's JSON.
const kept = (sport, summary) => JSON.parse(JSON.stringify(storedGame(sport, summary)));
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name).id;

test("a team game's final as it's kept: everyone's counts at the end (the final's correction in them), their teams and positions, the score", () => {
  const g = kept(nba, SIXERS);
  const box = nba.readBox(SIXERS);
  assert.equal(g.final, true);
  assert.deepEqual(g.sides, [{ id: "20", score: 114 }, { id: "5", score: 106 }], "the 76ers 114, the Cavaliers 106: the box score's, in the header's order");
  assert.deepEqual(g.lines, JSON.parse(JSON.stringify(nba.stateAt(SIXERS).lines)), "the timeline's end: the plays with the final's correction");
  const maxey = nameOf(box, "Tyrese Maxey");
  assert.equal(g.lines[maxey].PTS, 32);
  assert.deepEqual(g.people[maxey], { team: "20", position: box.people[maxey].position });
  // Every count ESPN's box score has is the kept line's (the correction makes them agree).
  for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(g.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
});

test("the sequence's line for a stat scores a kept final as the phone's scorer does: each holding's moments, then a lineup's sum and a captain", () => {
  const score = defaultsFor("basketball").specs.season.spec.score;
  const g = kept(nba, SIXERS);
  const phone = statePoints(nba, score, nba.stateAt(SIXERS));
  const lines = Object.fromEntries(Object.entries(g.lines).map(([id, l]) => [id, nba.full(l)]));
  const moments = statMoments(lines, score);
  for (const m of moments) assert.equal(m.points, phone[m.castawayId].points, m.castawayId);
  assert.equal(moments.length, Object.values(phone).filter((s) => s.points).length, "one moment for each holding that scored");
  // statePoints on the kept state is the same again (what the server's facts read).
  assert.deepEqual(statePoints(nba, score, storedState(g)), phone);
  // A lineup of two, one of them captain at 2x: the sequence's own steps from here.
  const box = nba.readBox(SIXERS);
  const [maxey, mitchell] = ["Tyrese Maxey", "Donovan Mitchell"].map((n) => nameOf(box, n));
  const raw = Seq.momentRaw([maxey, mitchell], moments);
  const total = Seq.episodeTotal([{ points: Seq.multiply(raw.get(maxey), [2, 1]), counted: true }, { points: Seq.multiply(raw.get(mitchell), [1, 1]), counted: true }], []);
  assert.equal(total, Seq.round(2 * phone[maxey].points + phone[mitchell].points));
});

test("baseball: a kept final's derived stats are worked out at the read (total bases from the plays' counts), so the series scores as typed", () => {
  const ex = examples.redSoxYankees;
  const baseball = sportById("baseball");
  const totals = new Map();
  for (const f of ex.recorded) {
    const game = require(`./fixtures/${f}`);
    const box = baseball.readBox(game);
    const g = kept(baseball, game);
    const lines = Object.fromEntries(Object.entries(g.lines).map(([id, l]) => [id, baseball.full(l)]));
    for (const m of statMoments(lines, ex.spec.score)) {
      const t = totals.get(m.castawayId) ?? { name: box.people[m.castawayId].name, points: 0 };
      t.points += m.points;
      totals.set(m.castawayId, t);
    }
  }
  const best = [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, ex.settles.best.length);
  assert.deepEqual(best.map((b) => [b.name, b.points]), ex.settles.best.map((b) => [b.name, b.points]));
});

test("a position group from the roster first (season_cast.role, ESPN's roster's name for it), the game's position after, else none", () => {
  const soccer = sportOf("soccer/eng.1");
  assert.equal(groupOf(soccer, "Goalkeeper", "SUB"), "GK", "a sub on the bench: his roster's");
  assert.equal(groupOf(soccer, "Forward", "AM-L"), "FWD", "the roster's over the formation's slot");
  assert.equal(groupOf(soccer, null, "AM-L"), "MID");
  assert.equal(groupOf(soccer, "", "SUB"), null, "SUB isn't a position");
  assert.equal(groupOf(soccer, "D", null), "DEF", "an abbreviation");
  // Tel's goal at a forward's points when his roster says Forward, a midfielder's when only the game's slot does.
  const game = require("./fixtures/espn/epl-401878767.json");
  const score = defaultsFor("soccer").specs.season.spec.score;
  const tel = nameOf(soccer.readBox(game), "Mathys Tel");
  const line = soccer.full(kept(soccer, game).lines[tel]);
  const as = (role) => statLine(score, line, { group: groupOf(soccer, role, "AM-L") }).parts.find((p) => p.stat === "G").points;
  assert.equal(as("Forward"), score.byPosition.G.FWD);
  assert.equal(as(null), score.byPosition.G.MID);
});

test("the sports settles graded from a kept final (facts.games' one): the user's 76ers sentence as the box score says", () => {
  const ex = examples.sixersOpener;
  const g = kept(nba, SIXERS);
  const facts = { from: 1, to: 1, over: true, episodes: new Map(), names: new Map(), games: new Map([[1, storedFacts(nba, g, "final")]]) };
  const box = nba.readBox(SIXERS);
  const [winner, top, total] = ex.spec.ask.map((q) => verdictOf(q, 1, facts));
  assert.deepEqual(winner.right, [ex.settles.winner]);
  assert.deepEqual(top.right.map((id) => box.people[id].name).sort(), ex.settles.top.people.slice().sort());
  assert.equal(top.value, ex.settles.top.PTS);
  assert.equal(total.value, ex.settles.total);
  // An over/under is graded by its value against the line: the under scores.
  const q = ex.spec.ask[2];
  const got = Object.fromEntries(pointsFor(q, total, [{ playerId: "a", answer: ex.settles.overUnder }, { playerId: "b", answer: ex.settles.overUnder === "under" ? "over" : "under" }], facts));
  assert.deepEqual(got, { a: q.points });
  // Still to play for someone who hasn't seen it: waiting.
  const before = { ...facts, games: new Map([[1, { status: "pre", sides: [], lines: {}, teams: {} }]]) };
  assert.equal(verdictOf(ex.spec.ask[0], 1, before).state, "waiting");
});
