// G3 part 2, a team's page (docs/PLAN-start-a-game-gpt.md step G3): the games someone's words mean, from a team's schedule. The
// schedule as the pack carries it (src/lib/sports/team-page.ts teamSchedulePack: trimmed, never a score), the bot's matchup ask
// read (readMatchupAsk) and held against the schedule (holdMatchup: the games, or our check's question with what each option
// picks), pickMatchup's day (matchup.ts: "tonight"), and the GPT's side (game-words: the pack's team and schedule, the manual's
// team section, the answer's matchup, read and carried). On ESPN's real schedules: the 76ers' 2026-27 (recorded 2026-10-28) and the
// Yankees' 2026 postseason, each as of a moment (`asOf`: what ESPN would have said then). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readScoreboard } = jiti("../src/lib/server/sports/espn.ts");
const { pickMatchup, MAX_GAMES } = jiti("../src/lib/sports/matchup.ts");
const T = jiti("../src/lib/sports/team-page.ts");
const W = require("../src/lib/game/game-words/index.js");
const examples = require("./fixtures/sports-examples");

const PHI = "20";
const NYY = "10";
const BOS = "2";
const sixers = readScoreboard("basketball/nba", require("./fixtures/espn/nba-schedule-20.json"));
const yankees = readScoreboard("baseball/mlb", require("./fixtures/espn/mlb-schedule-10-2026-3.json"));

/** A recorded schedule as ESPN would have listed it at `at`: a game after it still to play (no score, no winner). */
function asOf(games, at) {
  const now = Date.parse(at);
  return games.map((g) => (Date.parse(g.at) > now ? { ...g, state: "pre", final: false, competitors: g.competitors.map((c) => ({ ...c, score: null, winner: null })) } : g));
}
const ms = (at) => Date.parse(at);

test("pickMatchup's day: a team's games that day in the East (a 7 PM tip in New York is the day before in UTC's terms)", () => {
  assert.deepEqual(pickMatchup(PHI, sixers, { kind: "day", day: "2026-10-22" }).map((g) => g.id), ["401909093"]);
  // 2026-11-03T00:30Z is 8:30 PM on Nov 2 in the East.
  assert.deepEqual(pickMatchup(PHI, sixers, { kind: "day", day: "2026-11-02" }).map((g) => g.id), ["401909912"]);
  assert.deepEqual(pickMatchup(PHI, sixers, { kind: "day", day: "2026-11-03" }), []);
});

test("the schedule as the pack carries it: the last 3 played and the next 20, each by id, its day, home or away, against whom; never a score", () => {
  const p = T.teamSchedulePack(PHI, sixers, ms("2026-10-28T12:00:00Z"));
  assert.equal(p.schedule.length, 23);
  assert.deepEqual(p.schedule.slice(0, 3).map((g) => g.id), ["401909093", "401909855", "401909866"]);
  assert.ok(p.schedule.slice(0, 3).every((g) => g.played) && p.schedule.slice(3).every((g) => !g.played));
  assert.deepEqual(p.schedule[3], { id: "401909884", day: "2026-10-28", at: "2026-10-28T23:00Z", home: false, opponent: { id: "11", name: "Indiana Pacers" }, played: false, stage: "regular" });
  assert.equal(p.more, 80 - 23);
  assert.ok(!JSON.stringify(p.schedule).includes("114"), "no score");
  assert.ok(p.teams.some((t) => t.id === "5" && t.name === "Cleveland Cavaliers") && p.teams.some((t) => t.id === PHI));
  // A game listed "pre" past its start is under way.
  assert.ok(T.started({ state: "pre", at: "2026-10-28T23:00Z" }, ms("2026-10-28T23:05:00Z")));
});

test("the bot's matchup ask, read: the five kinds, a team by id or by its name, tonight from the clock; anything else none", () => {
  const teams = [{ id: "2", name: "Boston Red Sox", short: "Red Sox" }, { id: "10", name: "New York Yankees", short: "Yankees" }];
  const now = ms("2026-11-07T23:30:00Z"); // 6:30 PM on Nov 7 in the East
  assert.deepEqual(T.readMatchupAsk({ kind: "opener", home: true }, teams, now), { kind: "opener", home: true });
  assert.deepEqual(T.readMatchupAsk({ kind: "opener", home: "yes" }, teams, now), { kind: "opener" });
  assert.deepEqual(T.readMatchupAsk({ kind: "series", against: "2" }, teams, now), { kind: "series", against: "2" });
  assert.deepEqual(T.readMatchupAsk({ kind: "series", against: "Red Sox" }, teams, now), { kind: "series", against: "2" });
  assert.deepEqual(T.readMatchupAsk({ kind: "series", against: "the Yankees" }, teams, now), null, "words that aren't one of its names name nobody");
  assert.equal(T.readMatchupAsk({ kind: "series" }, teams, now), null);
  assert.deepEqual(T.readMatchupAsk({ kind: "next", count: "5" }, teams, now), { kind: "next", count: 5 });
  assert.equal(T.readMatchupAsk({ kind: "next", count: 0 }, teams, now), null);
  assert.deepEqual(T.readMatchupAsk({ kind: "day", day: "tonight" }, teams, now), { kind: "day", day: "2026-11-07" });
  assert.deepEqual(T.readMatchupAsk({ kind: "day", day: "tomorrow" }, teams, now), { kind: "day", day: "2026-11-08" });
  assert.equal(T.readMatchupAsk({ kind: "day", day: "Sunday" }, teams, now), null);
  assert.deepEqual(T.readMatchupAsk({ kind: "games", events: ["a", "a", " b ", 3] }, teams, now), { kind: "games", events: ["a", "b"] });
  assert.equal(T.readMatchupAsk({ kind: "games", events: [], from: "2026-01-01" }, teams, now), null);
  assert.equal(T.readMatchupAsk({ kind: "whenever" }, teams, now), null);
  assert.equal(T.readMatchupAsk(null, teams, now), null);
  assert.equal(T.readMatchupAsk({ kind: "next", count: 3, from: "2020-01-01T00:00:00Z" }, teams, now).from, undefined, "never the bot's from");
});

test("the user's 76ers sentence on their page: the home opener before it's played; after, our check asks, each option a pick of its games", () => {
  const ask = examples.sixersOpener.matchup.ask;
  const before = T.holdMatchup(PHI, asOf(sixers, "2026-10-21T12:00:00Z"), ask, { now: ms("2026-10-21T12:00:00Z"), short: "76ers" });
  assert.equal(before.question, null);
  assert.deepEqual(before.games.map((g) => g.id), examples.sixersOpener.games);
  // The tracker's w003: the home opener (Oct 22) is past by the time it was recorded.
  const after = T.holdMatchup(PHI, sixers, ask, { now: ms("2026-10-28T12:00:00Z"), short: "76ers" });
  assert.deepEqual(after.games, []);
  assert.equal(after.question.question, "The 76ers home opener has already been played. Their next home game?");
  assert.equal(after.question.part, "matchup");
  assert.equal(after.question.options[0], "Knicks at 76ers, Oct 30", "their next home game first");
  assert.deepEqual(after.question.picks[0], { kind: "games", events: ["401909280"] });
  assert.equal(after.question.options[1], "76ers at Pacers, Oct 28", "then their next game");
  assert.equal(after.question.options.length, after.question.picks.length);
  // A pick sent back holds as it is.
  const picked = T.holdMatchup(PHI, sixers, after.question.picks[0], { now: ms("2026-10-28T12:00:00Z"), short: "76ers" });
  assert.deepEqual(picked.games.map((g) => g.id), ["401909280"]);
});

test("the user's Red Sox–Yankees sentence: the series as of the day before it, both its games", () => {
  const ask = { kind: "series", against: BOS };
  const at = examples.redSoxYankees.matchup.ask.from;
  const h = T.holdMatchup(NYY, asOf(yankees, at), ask, { now: ms(at), short: "Yankees" });
  assert.equal(h.question, null);
  assert.deepEqual(h.games.map((g) => g.id), examples.redSoxYankees.games);
  // Asked mid-series, it's still the whole series (the game starts at its next one).
  const mid = "2026-09-30T12:00:00Z";
  assert.deepEqual(T.holdMatchup(NYY, asOf(yankees, mid), ask, { now: ms(mid), short: "Yankees" }).games.map((g) => g.id), examples.redSoxYankees.games);
  // Once it's over, there's no series against them left: which games?
  const done = T.holdMatchup(NYY, asOf(yankees, "2026-10-02T12:00:00Z"), ask, { now: ms("2026-10-02T12:00:00Z"), short: "Yankees" });
  assert.equal(done.question.question, "No Yankees series is left against the Red Sox. Which of their games?");
});

test("the next games, a day with no game, no games named, too many games, and a season with nothing left", () => {
  const now = ms("2026-10-28T12:00:00Z");
  const o = { now, short: "76ers" };
  assert.deepEqual(T.holdMatchup(PHI, sixers, { kind: "next", count: 5 }, o).games.map((g) => g.id), ["401909884", "401909280", "401909897", "401909912", sixers.filter((g) => g.state === "pre").sort((a, b) => a.at.localeCompare(b.at))[4].id]);
  assert.equal(T.holdMatchup(PHI, sixers, { kind: "next", count: 2, against: "18" }, o).games.length, 2, "their next two against the Knicks");
  assert.deepEqual(T.holdMatchup(PHI, sixers, { kind: "day", day: "2026-10-28" }, o).games.map((g) => g.id), ["401909884"], "tonight's");
  const none = T.holdMatchup(PHI, sixers, { kind: "day", day: "2026-10-29" }, o);
  assert.equal(none.question.question, "No 76ers game on Oct 29. Their next game?");
  assert.equal(T.holdMatchup(PHI, sixers, { kind: "day", day: "2026-10-27" }, { now: ms("2026-10-27T15:00:00Z"), short: "76ers" }).question.question, "No 76ers game tonight. Their next game?");
  const which = T.holdMatchup(PHI, sixers, null, o);
  assert.equal(which.question.question, "Which of their games?");
  assert.deepEqual(which.question.options.slice(0, 1), ["76ers at Pacers, Oct 28"]);
  assert.ok(which.question.options.length >= 3 && which.question.options.length <= 4, "the next game, the next five, the next home game");
  const many = T.holdMatchup(PHI, sixers, { kind: "next", count: 40 }, o);
  assert.equal(many.question.question, `A game can cover up to ${MAX_GAMES} of their games. The next ${MAX_GAMES}?`);
  assert.equal(many.question.picks[0].events.length, MAX_GAMES);
  const played = T.holdMatchup(PHI, sixers, { kind: "games", events: ["401909093"] }, o);
  assert.equal(played.question.question, "That game has already been played. Their next game?");
  assert.equal(T.holdMatchup(PHI, sixers, { kind: "games", events: ["401909280", "nope"] }, o).question.question, "Some of those games aren't on the 76ers schedule. Which of their games?");
  const over = T.holdMatchup(PHI, sixers, { kind: "next", count: 3 }, { now: ms("2027-06-01T00:00:00Z"), short: "76ers" });
  assert.equal(over.question.question, "No 76ers games are left to play this season.");
  assert.deepEqual(over.question.options, []);
});

test("a quote around an ellipsis is said when each piece is in their words, in order", () => {
  const draft = { game: { get: { by: "draft", each: 2 } }, said: [{ part: "get.each", quote: "draft ... 2 players each" }, { part: "score", quote: "assists ... draft" }] };
  const r = W.checkDraft(draft, { words: "Lakers next 5 games, draft 2 players each, points rebounds assists all count 1", kind: "sport", pack: W.packOf({ label: "x", kind: "sport" }) });
  assert.deepEqual(r.said.map((s) => s.quote), ["draft ... 2 players each"]);
  assert.ok(r.dropped.some((x) => x.value === "assists ... draft"), "out of order: not said");
});

test("the GPT on a team's page: the pack's team and schedule, the manual's team section, the answer's matchup read and carried", () => {
  const p = T.teamSchedulePack(PHI, sixers, ms("2026-10-28T12:00:00Z"));
  const pack = W.packOf({ label: "Philadelphia 76ers", kind: "sport", sport: { id: "basketball", league: "basketball/nba" }, teams: p.teams, games: [], team: { id: PHI, name: "Philadelphia 76ers", short: "76ers" }, schedule: p.schedule, scheduleMore: p.more });
  assert.deepEqual(pack.team, { id: PHI, name: "Philadelphia 76ers", short: "76ers" });
  assert.equal(pack.schedule.length, 23);
  assert.deepEqual(pack.schedule[3].against, { id: "11", name: "Indiana Pacers" });
  assert.equal(pack.scheduleMore, 57);
  assert.ok(W.idsOf(pack).teams.has("5"));
  // A season's sport page has no team or schedule.
  assert.equal(W.packOf({ label: "x", kind: "sport", sport: { league: "basketball/nba" } }).schedule, undefined);
  const manual = W.manualFor(null, { kind: "sport", team: true });
  assert.match(manual, /THIS PAGE IS A TEAM'S SCHEDULE/);
  assert.match(manual, /"kind": "opener", "home": true/);
  assert.doesNotMatch(W.manualFor(null, { kind: "sport" }), /TEAM.S SCHEDULE/);
  assert.doesNotMatch(manual, /PRESETS \(/, "a team page is a sport's: no show presets");
  assert.match(W.gamePrompt({ pack, manual, words: "x" }), /add "matchup" to the answer.s top level/);
  assert.doesNotMatch(W.gamePrompt({ pack: W.packOf({ label: "x", kind: "sport" }), manual, words: "x" }), /add "matchup" to/);
  assert.match(W.changePrompt({ pack, manual, words: "x", spec: {}, change: "y", matchup: { kind: "opener", home: true } }), /ITS GAMES SO FAR \(the matchup\):\n\{"kind":"opener","home":true\}/);
  const answer = JSON.stringify({ draft: 1, game: { get: { by: "none" }, score: { by: "answers" }, ask: [{ id: "w", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } }] }, matchup: { kind: "opener", home: true }, said: [], summary: "" });
  assert.deepEqual(W.readDraft(answer).draft.matchup, { kind: "opener", home: true });
  assert.deepEqual(W.checkAnswer(answer, { pack, kind: "sport" }).matchup, { kind: "opener", home: true });
  assert.equal(W.checkAnswer(JSON.stringify({ game: null }), { pack, kind: "sport" }).matchup, undefined);
  // The local bot put it inside the game (2026-11-07): read beside it, and the game keeps only its own parts.
  const inside = JSON.stringify({ draft: 1, game: { matchup: { kind: "next", count: 5 }, get: { by: "draft", each: 2 }, count: { all: true }, score: { by: "stats" } } });
  const r = W.readDraft(inside);
  assert.deepEqual(r.draft.matchup, { kind: "next", count: 5 });
  assert.equal("matchup" in r.draft.game, false);
  const c = W.checkAnswer(inside, { pack, kind: "sport" });
  assert.deepEqual(c.matchup, { kind: "next", count: 5 });
  assert.ok(!c.dropped.some((x) => x.part === "matchup"));
});
