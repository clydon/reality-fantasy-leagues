// A game at your own pace (docs/PLAN-own-pace-games.md): a game on a season that's already aired, every seat a late joiner from
// the start (StateLogic.GhostLogic.paceAll), computer players catching up as people do (bot-logic.js catchUpTo: each week's pick
// on the copy a late joiner at that mark sees, never reading ahead), and the words that say where the others are
// (src/new/couch/pace.ts). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const S = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { othersLine, aheadWords, allHere } = jiti("../src/new/couch/pace.ts");

const { GhostLogic, PickEmLogic, SpoilerLogic } = S;
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [] };

/** A Survival Pool on a season of `n` castaways, played out: one goes home in each of Episodes 1..`eps` (C0 in 1, C1 in 2, ...),
 *  so every episode has results and the season's over. Seats `people`, plus a computer player when `bot`. */
function finished({ n = 10, eps = 8, people = ["ann", "bo"], bot = true } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", active: true, disabled: false }));
  if (bot) s.players.push({ id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true });
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { preset: "survival-pool", span: { from: 3, to: null } }, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) {
    S.ensureEpisodeNumber(s, k, false);
    const ep = s.episodes.find((e) => e.number === k);
    S.addElimination(s, ep.id, s.castaways[k - 1].id, "Voted Out");
  }
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);

test("paceAll: every seat, the computer player too, starts catching up at the start, its mark the episode before", () => {
  const s = finished();
  assert.equal(GhostLogic.ownPace(s), false);
  assert.equal(GhostLogic.anyCatchingUp(s), false);
  GhostLogic.paceAll(s, 3);
  assert.equal(GhostLogic.ownPace(s), true);
  assert.equal(GhostLogic.anyCatchingUp(s), true);
  for (const id of ["ann", "bo", "bot"]) {
    assert.deepEqual(GhostLogic.lateJoinOf(s, id), { startEpisode: 3, catchingUp: true, seenThrough: 2 });
    assert.equal(S.getPlayer(s, id).ghost, undefined, "on the couch in the open");
  }
  // Ann's copy ends at her week: Episode 3, open, with no results past 2.
  const view = GhostLogic.viewFor(s, "ann", 2);
  assert.equal(view.episodes.length, 3);
  assert.equal(SpoilerLogic.latestWithResults(view), 2);
  assert.equal(S.gameOver(view), false, "not over for her");
});

test("a catching-up bot makes no live move; catchUpTo plays each week on its own copy, never reading ahead", () => {
  const s = finished();
  GhostLogic.paceAll(s, 3);
  assert.equal(Bots.run(s), 0, "nothing live to play");
  assert.equal(Bots.hasWork(s), false);
  // Ann reveals Episode 3: the bot picks for 3 first, from who was still in before it (C0, C1 went home in 1 and 2).
  assert.equal(Bots.catchUpTo(s, 3), 1);
  const pick3 = PickEmLogic.pickFor(s, ep(s, 3).id, "bot");
  assert.ok(pick3, "a pick for Episode 3");
  assert.ok(!["C0", "C1"].includes(S.getCastaway(s, pick3.castawayId).name), "from who was still in");
  assert.equal(GhostLogic.lateJoinOf(s, "bot").seenThrough, 3);
  assert.equal(Bots.catchUpTo(s, 3), 0, "a second call changes nothing");
  // Someone reveals 6: the bot plays 4, 5 and 6, each from who was still in before that week.
  assert.equal(Bots.catchUpTo(s, 6), 3);
  for (const k of [4, 5, 6]) {
    const p = PickEmLogic.pickFor(s, ep(s, k).id, "bot");
    assert.ok(p, `a pick for Episode ${k}`);
    const gone = s.castaways.slice(0, k - 1).map((c) => c.id);
    assert.ok(!gone.includes(p.castawayId), `Episode ${k}'s pick wasn't already out`);
  }
  assert.equal(GhostLogic.lateJoinOf(s, "bot").seenThrough, 6);
  assert.equal(GhostLogic.isCatchingUp(s, "bot"), true);
  // Someone behind reveals 4: the bot's already past it.
  assert.equal(Bots.catchUpTo(s, 4), 0);
  // The season's last episode: caught up, nothing more to play.
  Bots.catchUpTo(s, 8);
  assert.equal(GhostLogic.isCatchingUp(s, "bot"), false);
  assert.equal(GhostLogic.anyCatchingUp(s), true, "ann and bo still are");
});

test("the bot's pick stays out of a copy behind it until that week", () => {
  const s = finished();
  GhostLogic.paceAll(s, 3);
  Bots.catchUpTo(s, 5);
  // Bo, still on Episode 3: his copy holds the bot's pick for 3 (his week) and nothing of 4 or 5.
  const view = GhostLogic.viewFor(s, "bo", 2);
  assert.equal(view.episodes.length, 3);
  assert.ok(PickEmLogic.pickFor(view, ep(view, 3).id, "bot"));
});

test("the words: where the others are, all here, and the gap in the reveal button", () => {
  const others = [
    { name: "riley", week: 2 },
    { name: "casey", week: 4 },
    { name: "sam", week: null },
  ];
  assert.equal(othersLine(3, others), "casey · Ep 4 · riley · Ep 2 · sam finished");
  assert.equal(othersLine(3, []), null);
  assert.equal(allHere(3, [{ name: "riley", week: 3 }]), true);
  assert.equal(allHere(3, others), false);
  assert.equal(allHere(3, [{ name: "sam", week: null }]), false, "finished isn't here");
  // Revealing Episode 3 puts you on 3; riley's on 2 (her mark 1): two ahead. Casey's ahead of you, sam's done: no words for them.
  assert.equal(aheadWords(3, others), "you'll be 2 ahead of riley");
  // Riley's on 3 too (her mark 2): revealing 3 puts you one ahead, which says nothing; 4 is two ahead.
  assert.equal(aheadWords(3, [{ name: "riley", week: 3 }]), null);
  assert.equal(aheadWords(4, [{ name: "riley", week: 3 }]), "you'll be 2 ahead of riley");
  assert.equal(aheadWords(5, [{ name: "riley", week: 3 }]), "you'll be 3 ahead of riley");
  // Two at the same gap, named together; the furthest behind decides the number.
  assert.equal(aheadWords(6, [{ name: "riley", week: 3 }, { name: "casey", week: 3 }, { name: "jo", week: 5 }]), "you'll be 4 ahead of riley and casey");
});
