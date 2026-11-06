// Getting it ready (src/lib/season-fill.ts, docs/PLAN-getting-it-ready.md): which step does what for which season (skipped when
// it's there or isn't ours, quick with no bot, or an ask of our bot), which steps a season shows, each episode's tile, and the
// call sheet's line. Made-up facts, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { stepAction, stepsShown, tileState, fillLine } = jiti("../src/lib/season-fill.ts");

const facts = (o = {}) => ({ kind: "competition", setUp: true, hasRulebook: false, cast: 0, games: 0, episodes: true, recapsMissing: 0, resultsMissing: 0, ...o });

test("a show that's a game: its rulebook made at once, its cast asked, then what happened", () => {
  // The Challenge 42 as the user added it: a game already, no rulebook row yet, nobody in its cast, 14 aired with no recap.
  const f = facts({ recapsMissing: 14 });
  assert.equal(stepAction("rules", f), "now");
  assert.equal(stepAction("rules", { ...f, hasRulebook: true }), "skip");
  // What scores: once there's a rulebook and it hasn't been priced on the ladder; never for a sport.
  assert.equal(stepAction("scores", f), "skip", "no rulebook yet");
  assert.equal(stepAction("scores", { ...f, hasRulebook: true }), "bot");
  assert.equal(stepAction("scores", { ...f, hasRulebook: true, scored: true }), "skip");
  assert.equal(stepAction("scores", { ...f, kind: "sport", hasRulebook: true }), "skip");
  assert.equal(stepAction("cast", f), "bot");
  assert.equal(stepAction("episodes", f), "bot");
});

test("a brand-new show is made a game by our bot, and its cast comes with that", () => {
  const f = facts({ setUp: false });
  assert.equal(stepAction("rules", f), "bot");
  // Make it a game brings the cast; nothing's asked for it on its own until the show's a game.
  assert.equal(stepAction("cast", f), "skip");
});

test("a cast that's there, a game on the season, or a talk show: no cast step", () => {
  assert.equal(stepAction("cast", facts({ cast: 34 })), "skip");
  assert.equal(stepAction("cast", facts({ games: 1 })), "skip");
  assert.equal(stepAction("cast", facts({ kind: "talk" })), "skip");
});

test("a sport: only its episodes", () => {
  const f = facts({ kind: "sport", setUp: false, recapsMissing: 3 });
  assert.equal(stepAction("rules", f), "skip");
  assert.equal(stepAction("cast", f), "skip");
  assert.equal(stepAction("episodes", f), "bot");
  assert.deepEqual(stepsShown(f, 3), ["episodes"]);
});

test("the episodes: switched off, nothing; recaps first (the bot), results only queued (no bot)", () => {
  assert.equal(stepAction("episodes", facts({ episodes: false, recapsMissing: 5 })), "skip");
  assert.equal(stepAction("episodes", facts({ recapsMissing: 0, resultsMissing: 4 })), "now");
  assert.equal(stepAction("episodes", facts()), "skip");
});

test("steps shown: a talk show has no cast's; the episodes once any have aired and they're wanted", () => {
  assert.deepEqual(stepsShown({ kind: "competition", episodes: true }, 14), ["rules", "scores", "cast", "episodes"]);
  assert.deepEqual(stepsShown({ kind: "talk", episodes: true }, 2), ["rules", "scores", "episodes"]);
  assert.deepEqual(stepsShown({ kind: "competition", episodes: true }, 0), ["rules", "scores", "cast"]);
  assert.deepEqual(stepsShown({ kind: "competition", episodes: false }, 14), ["rules", "scores", "cast"]);
});

test("tiles: what happened is everything when results aren't ours; else half lit until its results are in", () => {
  const base = { summary: false, recapAsking: false, results: false, ask: null, settled: false };
  assert.equal(tileState(base), "waiting");
  assert.equal(tileState({ ...base, recapAsking: true }), "asking");
  assert.equal(tileState({ ...base, summary: true }), "done");
  assert.equal(tileState({ ...base, settled: true }), "none");
  const game = { ...base, results: true };
  assert.equal(tileState({ ...game, summary: true }), "half");
  assert.equal(tileState({ ...game, summary: true, ask: "asking" }), "asking");
  assert.equal(tileState({ ...game, summary: true, ask: "done" }), "done");
  assert.equal(tileState({ ...game, ask: "failed" }), "none");
  assert.equal(tileState({ ...game, summary: true, ask: "failed" }), "half");
  // The job's done and nothing was asked about it: nothing more is coming.
  assert.equal(tileState({ ...game, settled: true }), "none");
});

test("the call sheet's line says what's happening, in the show's words", () => {
  const w = { people: "Challengers", episode: "Episode", episodes: "Episodes" };
  const line = (o) => fillLine({ step: null, status: "going", tiles: [], away: false, ...o }, w);
  assert.equal(line({ step: "rules" }), "Reading how it's played");
  assert.equal(line({ step: "cast" }), "Finding the challengers");
  assert.equal(line({ step: "episodes", tiles: ["done", "done", "asking", "waiting"] }), "Catching up on Episode 3 of 4");
  assert.equal(line({ step: "episodes", tiles: ["asking", "asking", "asking"] }), "Looking up what happened in 3 episodes");
  assert.equal(line({ step: "episodes", tiles: ["done", "half", "half"] }), "Results: 1 of 3 episodes in");
  assert.equal(line({ step: "episodes", tiles: ["done", "none", "waiting"] }), "2 of 3 episodes in");
  assert.equal(line({ step: "cast", away: true }), "Waiting for our bot to come back");
  assert.equal(line({ status: "stuck" }), "Stopped partway. Try again.");
  assert.equal(line({ status: "done" }), "All set");
});

test("the estimate: steady to 85% by the usual time, then slower, never done; its words honest when it runs long", () => {
  const { stepShare, etaWords, restWords } = jiti("../src/lib/season-fill.ts");
  assert.equal(stepShare(0, 60_000), 0);
  assert.equal(Math.round(stepShare(30_000, 60_000) * 100), 43);
  assert.equal(Math.round(stepShare(60_000, 60_000) * 100), 85);
  assert.ok(stepShare(600_000, 60_000) < 0.97 && stepShare(600_000, 60_000) > 0.96);
  assert.equal(etaWords(0, 70_000), "About a minute");
  assert.equal(etaWords(0, 180_000), "About 3 min");
  assert.equal(etaWords(50_000, 70_000), "About 20 seconds");
  assert.equal(etaWords(75_000, 70_000), "Any moment now");
  assert.equal(etaWords(150_000, 70_000), "Taking longer than usual");
  const w = { episode: "Episode", episodes: "Episodes" };
  assert.equal(restWords(13, w), "about 39 min for the other 13 episodes");
  assert.equal(restWords(1, w), "about 3 min for the other episode");
  assert.equal(restWords(30, w), "about 1.5 hours for the other 30 episodes");
  assert.equal(restWords(3, w, 3), "about 9 min for all 3 episodes");
  assert.equal(restWords(2, w, 3), "about 6 min for the other 2 episodes");
});
