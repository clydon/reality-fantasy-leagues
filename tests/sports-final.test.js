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

test("a field's and a card's final as it's kept (L3 part 3): Bermuda's and the Daytona 500's standings, UFC 324's and the US Open's bouts, read back as saved, score and grade as ESPN's own answer", () => {
  const { storedField, storedCard, finalState, shapeOf, gameFacts, boutsOf } = jiti("../src/lib/sports/index.ts");
  const fields = [["golf/pga", require("./fixtures/espn/pga-401850917.json")], ["racing/nascar-premier", require("./fixtures/espn/nascar-premier-202502160001.json")]];
  for (const [league, answer] of fields) {
    const sport = sportOf(league);
    const g = JSON.parse(JSON.stringify(storedField(sport, answer)));
    const state = sport.stateAt(answer);
    assert.equal(g.kind, "field");
    assert.equal(g.final, true, league);
    assert.deepEqual(g.lines, JSON.parse(JSON.stringify(state.lines)), `${league}: the timeline's end, places in the lines`);
    assert.deepEqual(g.standings, JSON.parse(JSON.stringify(state.standings)), `${league}: ESPN's final places`);
    assert.deepEqual(shapeOf(g), { kind: "field", event: g.event, standings: g.standings });
    const score = defaultsFor(sport.id, league).specs.season.spec.score;
    const moments = statMoments(Object.fromEntries(Object.entries(g.lines).map(([id, l]) => [id, sport.full(l)])), score);
    const phone = statePoints(sport, score, state);
    assert.deepEqual(moments, Object.entries(phone).filter(([, s]) => s.points).map(([id, s]) => ({ castawayId: id, points: s.points })), `${league}: the sequence's line on the kept final, the phone's`);
    assert.deepEqual(storedFacts(sport, g, "final"), JSON.parse(JSON.stringify(gameFacts(sport, state, { status: "final", people: g.people }))), `${league}: the grader's facts`);
  }
  // A card: by its bouts' formats (tennis's), each holding's bouts from the kept card (the server's LeagueGames.bouts).
  const cards = [["mma/ufc", require("./fixtures/espn/ufc-600057024.json")], ["tennis/atp", require("./fixtures/espn/atp-189-2026.json")]];
  for (const [league, answer] of cards) {
    const sport = sportOf(league);
    const g = JSON.parse(JSON.stringify(storedCard(sport, answer)));
    const state = sport.stateAt(answer);
    const card = sport.card(answer);
    assert.equal(g.kind, "card");
    assert.equal(g.final, true, league);
    assert.deepEqual(g.lines, JSON.parse(JSON.stringify(state.lines)), league);
    assert.deepEqual(g.byBout, JSON.parse(JSON.stringify(state.byBout)), league);
    assert.deepEqual(g.results, state.results.map((r) => ({ bout: r.bout, outcome: r.outcome, winner: r.winner, loser: r.loser })), `${league}: who won each, and how it ended`);
    assert.deepEqual(g.card.bouts.map((b) => b.id), card.bouts.map((b) => b.id));
    for (const b of g.card.bouts) for (const id of b.sides) assert.equal(g.people[id].position, g.card.bouts.find((x) => x.sides.includes(id)).class, `${league}: a fighter's class, their first bout's`);
    const score = defaultsFor(sport.id, league).specs.season.spec.score;
    const phone = statePoints(sport, score, state, { card });
    const moments = statMoments(g.lines, score, null, (id) => boutsOf(g.card, g.byBout, id));
    assert.deepEqual(moments, Object.entries(phone).filter(([, s]) => s.points).map(([id, s]) => ({ castawayId: id, points: s.points })), `${league}: the sequence's line on the kept card, by format where it scores so`);
    const read = finalState(g);
    assert.deepEqual(Object.keys(read.bouts).sort(), g.results.map((r) => r.bout).sort(), `${league}: every result's bout done`);
    assert.deepEqual(storedFacts(sport, g, "final"), JSON.parse(JSON.stringify(gameFacts(sport, state, { status: "final", people: g.people, card }))), `${league}: the grader's facts`);
  }
});

test("a kept final in a league's people (renamed): its lines and people, a field's standings, a card's sides, bouts and winners; a team game's sides left as they are", () => {
  const { storedField, storedCard, renamed } = jiti("../src/lib/sports/index.ts");
  const idOf = (id) => `c-${id}`;
  const g = renamed(kept(nba, SIXERS), idOf);
  assert.deepEqual(g.sides.map((s) => s.id), ["20", "5"]);
  assert.ok(Object.keys(g.lines).every((id) => id.startsWith("c-")) && Object.keys(g.people).every((id) => id.startsWith("c-")));
  const golf = sportOf("golf/pga");
  const f = renamed(storedField(golf, require("./fixtures/espn/pga-401850917.json")), idOf);
  assert.ok(f.standings.every((s) => s.id.startsWith("c-")) && f.event.field.every((id) => id.startsWith("c-")));
  const tennis = sportOf("tennis/atp");
  const c = renamed(storedCard(tennis, require("./fixtures/espn/atp-189-2026.json")), idOf);
  assert.ok(c.card.bouts.every((b) => b.sides.every((id) => id.startsWith("c-"))));
  assert.ok(Object.values(c.byBout).every((lines) => Object.keys(lines).every((id) => id.startsWith("c-"))));
  assert.ok(c.results.every((r) => (r.winner == null || r.winner.startsWith("c-")) && (r.loser == null || r.loser.startsWith("c-"))));
});

test("the provider keeps a field's and a card's final from the calls the phone's poller makes, asked once (Bermuda, Miami, the Daytona 500, UFC 324, the US Open): what's kept is ESPN's whole answer's; ESPN failing a call keeps nothing", async () => {
  const { espn: provider } = jiti("../src/lib/server/sports/espn.ts");
  const { SportsUnavailable } = jiti("../src/lib/server/sports/types.ts");
  const { storedField, storedCard } = jiti("../src/lib/sports/index.ts");
  const { espn: standin } = require("./harness/espn-standin");
  const real = globalThis.fetch;
  const p = provider("http://zt.test");
  const cases = [
    ["golf/pga", "401850917", require("./fixtures/espn/pga-401850917.json"), storedField],
    ["racing/f1", "600057432", require("./fixtures/espn/f1-600057432.json"), storedField],
    ["racing/nascar-premier", "202502160001", require("./fixtures/espn/nascar-premier-202502160001.json"), storedField],
    ["mma/ufc", "600057024", require("./fixtures/espn/ufc-600057024.json"), storedCard],
    ["tennis/atp", "189-2026", require("./fixtures/espn/atp-189-2026.json"), storedCard],
  ];
  try {
    for (const [league, event, answer, kept] of cases) {
      const api = standin(() => answer);
      globalThis.fetch = api.fetch;
      const g = await p.game(league, event);
      const want = kept(sportOf(league), answer);
      assert.equal(g.final, true, `${league}: final`);
      assert.deepEqual(g.lines, want.lines, `${league}: every line ESPN's whole answer has`);
      if (g.kind === "field") assert.deepEqual(g.standings, want.standings, league);
      else assert.deepEqual([g.results, g.byBout], [want.results, want.byBout], league);
      assert.ok(api.calls.length >= 1, league);
    }
    // ESPN failing one of the core's calls: not final this time (asked again on the next run; kept as far as it is once old);
    // failing the board (ESPN down): SportsUnavailable; an answer that isn't JSON is ESPN failing too.
    const ufc = cases[3][2];
    globalThis.fetch = standin(() => ufc, (kind) => (kind === "statistics" ? 503 : undefined)).fetch;
    assert.equal((await p.game("mma/ufc", "600057024")).final, false);
    globalThis.fetch = standin(() => ufc, (kind) => (kind === "board" ? 503 : undefined)).fetch;
    await assert.rejects(p.game("mma/ufc", "600057024"), SportsUnavailable);
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse("<html>") });
    await assert.rejects(p.game("golf/pga", "401850917"), SportsUnavailable);
    // A card whose FightCenter 404s (optional) is still read.
    globalThis.fetch = standin(() => ufc, (kind) => (kind === "fightcenter" ? null : undefined)).fetch;
    assert.ok((await p.game("mma/ufc", "600057024")) != null);
    // No such event (its board 404s): none; an event not over yet: not final.
    globalThis.fetch = standin(() => ({ board: null })).fetch;
    assert.equal(await p.game("tennis/atp", "zt-none"), null);
    const on = JSON.parse(JSON.stringify(cases[0][2]));
    on.leaderboard.events[0].status.type = { state: "in", completed: false };
    globalThis.fetch = standin(() => on).fetch;
    assert.equal((await p.game("golf/pga", "401850917")).final, false);
    // A league the app doesn't read: none, nothing asked.
    let asked = 0;
    globalThis.fetch = async () => (asked++, { ok: false, status: 404, json: async () => ({}) });
    assert.equal(await p.game("zt/unread", "1"), null);
    assert.equal(asked, 0);
  } finally {
    globalThis.fetch = real;
  }
});
