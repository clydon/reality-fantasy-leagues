// A game over a span (docs/PLAN-sports-data.md step 6): the choices a season offers (src/lib/game/spans.ts: the rest of the
// season, just the next one, a sport's series from its linked games' teams, any later listed episode), and the engine's end
// (settings.endEpisode; state-logic.js endEpisode, inPlay, spanView, gameOver, currentEpisode): nothing after the last
// episode scores, in each kind of game (Outlast's boot order, Weekly Lineup's points, Survival Pool's streaks), and the game
// is over once that episode has results. On made-up seasons, so no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { spanChoices, spanEnds, spanName, seriesEnd, nextSpan } = jiti("../src/lib/game/spans.ts");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const S = require("../src/lib/game/state-logic.js");

const GAME = { singular: "game", plural: "games" };
const RAYS = { id: "30", name: "Tampa Bay Rays" };
const BREWERS = { id: "8", name: "Milwaukee Brewers" };
const CUBS = { id: "16", name: "Chicago Cubs" };
const ep = (number, teams, title = `Game ${number}`) => ({ number, title, teams });

test("the choices: the rest of the season first, just the next one, and a sport's series from its linked games", () => {
  // A season of games: 4-6 Rays and Brewers (either way round), then the Cubs.
  const eps = [ep(3, [BREWERS, RAYS]), ep(4, [BREWERS, RAYS], "Game 4: Milwaukee Brewers at Tampa Bay Rays"), ep(5, [RAYS, BREWERS]), ep(6, [BREWERS, RAYS]), ep(7, [CUBS, RAYS])];
  assert.deepEqual(spanChoices(eps, 4, GAME), [
    { to: null, kind: "rest", label: "The rest of the season", line: "Game 4 to the season's end" },
    { to: 4, kind: "one", label: "Just Game 4", line: "Game 4: Milwaukee Brewers at Tampa Bay Rays" },
    { to: 6, kind: "series", label: "This series", line: "Games 4–6 · Milwaukee Brewers and Tampa Bay Rays" },
  ]);
  assert.equal(seriesEnd(eps, 6), null, "Game 7 is another series: no run of two from 6");
  assert.deepEqual(spanEnds(eps, 4).map((e) => e.number), [5, 6, 7], "any later listed one can be the end");
});

test("run it back: the next series after a series, else the same length again, as far as the listing goes", () => {
  // Games 1-3 Rays and Brewers, 4-6 Rays and Cubs, 7 the Mets.
  const METS = { id: "21", name: "New York Mets" };
  const eps = [1, 2, 3].map((n) => ep(n, [RAYS, BREWERS])).concat([4, 5, 6].map((n) => ep(n, [CUBS, RAYS])), [ep(7, [METS, RAYS])]);
  assert.equal(nextSpan(eps, 4, { from: 1, to: 3 }), 6, "after the Brewers series, the Cubs series");
  assert.equal(nextSpan(eps, 4, { from: 2, to: 2 }), 4, "one game, then the next one game");
  assert.equal(nextSpan(eps, 7, { from: 4, to: 6 }), 7, "the next series has one game listed so far: as far as the listing goes");
  const show = [5, 6, 7, 8, 9].map((n) => ep(n, null));
  assert.equal(nextSpan(show, 7, { from: 5, to: 6 }), 8, "two episodes, then the next two");
  assert.equal(nextSpan(show, 9, { from: 7, to: 8 }), 9, "only one left listed");
  assert.equal(nextSpan(show, 10, { from: 8, to: 9 }), null, "nothing listed from where it would start");
});

test("no linked games (any show), the next one not listed yet, and a title that only says its number", () => {
  const show = [ep(5, null, "Episode 5"), ep(6, null, "The Merge"), ep(7, null, null)];
  const word = { singular: "episode", plural: "episodes" };
  assert.deepEqual(spanChoices(show, 5, word).map((c) => [c.kind, c.label, c.line]), [
    ["rest", "The rest of the season", "Episode 5 to the season's end"],
    ["one", "Just Episode 5", "One episode"],
  ]);
  assert.deepEqual(spanChoices(show, 9, word).map((c) => c.kind), ["rest"], "the next isn't listed: only the rest of the season");
  assert.deepEqual(spanEnds(show, 5), [{ number: 6, title: "The Merge" }, { number: 7, title: null }]);
  assert.equal(spanName(4, 6, GAME), "Games 4–6");
  assert.equal(spanName(4, 4, GAME), "Game 4");
  assert.equal(spanName(4, null, GAME), "Game 4 on");
});

// A made-up season of 12 episodes, one person out each, through episode 8.
const EPISODES = 12;
const THROUGH = 8;
const data = {
  id: "span", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  groups: [{ key: "a", name: "A", color: "#123456" }],
  castaways: Array.from({ length: 16 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: 16 - i, groupKey: "a",
    exitEpisode: i < 11 ? i + 1 : EPISODES, exitMethod: i === 15 ? "Sole Survivor" : "Voted Out",
  })),
};
const league = (type, span) => {
  const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, type, THROUGH))));
  if (span) {
    S.updateSettings(s, "startEpisode", span[0]);
    S.updateSettings(s, "endEpisode", span[1]);
  }
  return s;
};
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.name, r.total]));

test("the engine's end: in play from start through end, a malformed end is none, and the setting is normalised", () => {
  const s = league("classic-draft", [3, 5]);
  assert.deepEqual([S.startEpisode(s), S.endEpisode(s)], [3, 5]);
  assert.deepEqual([2, 3, 5, 6].map((n) => S.inPlay(s, n)), [false, true, true, false]);
  S.updateSettings(s, "endEpisode", 2);
  assert.equal(S.endEpisode(s), null, "an end before the start is none");
  S.updateSettings(s, "endEpisode", "x");
  assert.equal(s.settings.endEpisode, null);
  S.updateSettings(s, "endEpisode", null);
  assert.equal(S.endEpisode(league("classic-draft")), null, "a league without one runs to the season's end");
});

test("Outlast over Episodes 1-5 scores as the boot order stood at 5, whatever came after", () => {
  const whole = league("classic-draft");
  const span = league("classic-draft", [1, 5]);
  const at5 = S.SpoilerLogic.viewThrough(league("classic-draft"), 5);
  assert.deepEqual(totals(span), totals(at5), "the span's table is the table at its end");
  assert.notDeepEqual(totals(span), totals(whole), "and not the season's so far");
  const plain = league("classic-draft");
  assert.equal(S.spanView(plain), plain, "no end: the state itself");
});

test("Weekly Lineup over Episodes 3-5 counts only those episodes' points (its lineups'; a side bet after it doesn't pay)", () => {
  const span = league("active-roster", [3, 5]);
  const rows = S.computeScores(span);
  // The same lineups, scored by hand from episodes 3-5 only.
  const want = Object.fromEntries(span.players.map((p) => [p.name, 0]));
  for (const e of span.episodes.filter((x) => x.number >= 3 && x.number <= 5)) {
    for (const ev of S.ActiveRosterLogic.episodeEvents(span, e)) {
      for (const p of span.players) if (S.ActiveRosterLogic.lineupFor(span, e.id, p.id).includes(ev.castawayId)) want[p.name] += S.ActiveRosterLogic.eventPoints(span, ev);
    }
  }
  for (const r of rows) assert.equal(r.locked, S.roundPoints(want[r.name]), r.name);
  const bets = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.name, r.bonus]));
  assert.deepEqual(bets(span), bets(S.SpoilerLogic.viewThrough(league("active-roster", [3, 12]), 5)), "side bets as they stood at its end");
});

test("Survival Pool over Episodes 2-4: picks after it don't count, and none can be made", () => {
  const span = league("pickem", [2, 4]);
  for (const p of span.players) {
    const rows = S.PickEmLogic.history(span, p.id).rows;
    assert.ok(rows.every((r) => r.episode >= 2 && r.episode <= 4), `${p.name}'s picks are 2-4 only: ${rows.map((r) => r.episode)}`);
  }
  const later = span.episodes.find((e) => e.number === 9) ?? S.ensureEpisodeNumber(span, 9, false);
  const someone = span.castaways.find((c) => c.status === "active");
  S.PickEmLogic.setPick(span, later.id, span.players[0].id, someone.id);
  assert.equal((later.picks || []).length, 0, "a pick past its end isn't taken");
});

test("no waiver week opens after a span's last episode, while one inside it still can", () => {
  // The same league to the season's end opens a week after Episode 8 (replacements every week, a window after 8).
  const season = league("active-roster", [3, 12]);
  assert.equal(S.WaiverLogic.due(season, Date.now()), "open");
  assert.equal(S.WaiverLogic.isWindowEpisode(season, 8), true);
  const span = league("active-roster", [3, 8]);
  assert.equal(S.WaiverLogic.due(span, Date.now()), null, "ending at 8, with 8 in: nothing opens");
  assert.equal(S.WaiverLogic.isWindowEpisode(span, 8), false, "no window after its last episode");
  assert.equal(S.WaiverLogic.isWindowEpisode(league("active-roster", [3, 10]), 8), true, "inside the span, windows as before");
});

test("game over once the last episode has results; nothing to pick or field past it", () => {
  const running = league("active-roster", [7, 10]);
  assert.equal(S.gameOver(running), false, "episode 10 has no results yet");
  assert.equal(S.currentEpisode(running)?.number, 9, "this week is the next episode, inside the span");
  const done = league("active-roster", [3, 6]);
  assert.equal(S.gameOver(done), true, "episode 6 has results: over");
  assert.equal(S.currentEpisode(done), null, "nothing to field past its end");
  assert.equal(S.gameOver(league("active-roster")), false, "a season game runs on until its season ends");
  assert.equal(S.ActiveRosterLogic.validateLineup(done, done.episodes.find((e) => e.number === 9).id, done.players[0].id, []), "This game ended with episode 6");
});

// Step A3 of docs/PLAN-start-a-game-gpt.md: a game that starts later, and the rest of docs/BACKLOG.md item 10.
const { updatesFor } = require("../src/lib/game/formats/rulebook-describe.js");

test("a game that starts later: nothing before it scores, its moves and side bets are for its first episode, and the writer makes it", () => {
  // Results are in through Episode 8; this one starts with 11.
  const s = league("active-roster", [11, null]);
  assert.deepEqual([S.startEpisode(s), S.endEpisode(s)], [11, null]);
  assert.ok(s.episodes.some((e) => e.number === 11), "moving the start (through setGame) makes its first episode, so its moves have somewhere to go");
  assert.equal(S.currentEpisode(s)?.number, 11, "this week is its first episode, not the next to air");
  assert.ok(S.computeScores(s).every((r) => r.locked === 0), "nothing before its start scores");
  assert.equal(S.betTarget(s), 11, "a side bet proposed now goes on its first episode");
  const bet = S.addBetToUpcoming(s, "Who goes home?", 1, s.players[0].id);
  assert.ok(s.episodes.find((e) => e.number === 11).bets.some((b) => b.id === bet.id));
  const before = s.episodes.find((e) => e.number === 5);
  assert.equal(S.addBet(s, before.id, "Earlier?", 1, null), undefined, "never on an episode before it: it would pay");
});

test("side bets after a span's end: none proposed, none added to an episode past it; inside it, as before", () => {
  const done = league("active-roster", [3, 6]);
  assert.equal(S.betTarget(done), null);
  assert.equal(S.addBetToUpcoming(done, "Too late", 1, null), undefined);
  const past = done.episodes.find((e) => e.number === 7);
  assert.equal(S.addBet(done, past.id, "Too late", 1, null), undefined);
  assert.ok(!done.episodes.some((e) => (e.bets || []).some((b) => b.label === "Too late")), "nothing was written");
  // Its last episode is the league's latest, with results in, before the next one is made: over, so nothing either.
  const last = league("active-roster", [3, 8]);
  last.episodes = last.episodes.filter((e) => e.number <= 8);
  assert.equal(S.BetLogic.upcomingEpisodeNumber(last), 8);
  assert.equal(S.betTarget(last), null, "not on its last episode once that's in");
  const running = league("active-roster", [7, 10]);
  assert.equal(S.betTarget(running), 9, "still running: the episode about to be played");
  assert.ok(S.addBetToUpcoming(running, "Who wins immunity?", 1, null));
});

test("classic's catch-up reveal stops at a span's last episode", () => {
  const s = league("active-roster", [3, 10]);
  s.settings.revealedThroughEpisode = 9;
  assert.equal(S.RevealLogic.isComplete(s), false);
  assert.equal(S.RevealLogic.revealNext(s), 10, "its last episode is still to reveal");
  assert.equal(S.RevealLogic.isComplete(s), true, "revealed through its end: nothing left");
  assert.equal(S.RevealLogic.revealNext(s), null, "never past it");
  const season = league("active-roster");
  season.settings.revealedThroughEpisode = 10;
  assert.equal(S.RevealLogic.revealNext(season), 11, "a season game reveals on, as before");
});

test("How it works' updates say where a game ends as well as where it starts, whatever you've seen", () => {
  const u = updatesFor({}, [
    { episode: 3, kind: "start", detail: "Plays by the Survivor rulebook." },
    { episode: 5, kind: "showChanged", detail: "A new twist" },
    { episode: 6, kind: "end", detail: "Nothing after it scores." },
  ], 2);
  assert.deepEqual(u.shown.map((x) => [x.episode, x.title]), [[3, "In force from Episode 3"], [6, "Ends with Episode 6"]]);
  assert.deepEqual([u.hidden.count, u.hidden.from], [1, 5], "the show's change waits until you've seen it; the end doesn't");
});

test("a start moved later and back: this week is its start again, not the episodes made for the later one", () => {
  const s = league("pickem", [10, null]);
  S.updateSettings(s, "startEpisode", 12);
  assert.ok(s.episodes.some((e) => e.number === 12), "Episodes up to 12 are made");
  S.updateSettings(s, "startEpisode", 10);
  assert.deepEqual([S.startEpisode(s), S.currentEpisode(s)?.number, S.betTarget(s)], [10, 10, 10], "picks and bets for Episode 10, its first");
  const season = league("pickem");
  assert.equal(S.currentEpisode(season)?.number, 9, "a season game: the one after the latest results, as before");
});

test("a side bet on an episode the start has moved past neither pays nor takes guesses", () => {
  const s = league("classic-draft", [9, null]);
  S.updateSettings(s, "bonusEnabled", true);
  const bet = S.addBetToUpcoming(s, "Who goes home?", 3, null);
  const nine = s.episodes.find((e) => e.number === 9);
  const [a, b] = s.players;
  for (const p of [a, b]) S.addBetPrediction(s, nine.id, bet.id, p.id, "Castaway 9");
  S.setBetPredictionCorrect(s, nine.id, bet.id, bet.predictions[0].id, true);
  const bonus = (st) => S.computeScores(st).find((r) => r.playerId === a.id).bonus;
  assert.equal(bonus(s), 3, "in its span: it pays");
  S.updateSettings(s, "startEpisode", 11);
  assert.equal(bonus(s), 0, "the start moved past it: it doesn't");
  S.addBetPrediction(s, nine.id, bet.id, s.players[2].id, "Castaway 9");
  assert.equal(bet.predictions.length, 2, "and nobody else guesses on it");
});
