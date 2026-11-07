// The top scorer's twist (docs/PLAN-start-a-game-gpt.md step A14 part 5; the tracker's s40, "Each week's top scorer picks a twist for
// next week."): after each episode's final results its top scorer (TwistLogic.chooserAt, from the walk's series) chooses one of the
// spec's twists for the next episode only, kept by the server until the choice closes (twists.ts, twist_choices) and then filed and
// stamped on the episode (`episode.twist`), which the scoring reads: every point that episode times the twist's (timesFor, step 3), or
// one moment's (pointsFor, step 2). Its shape, defaults, refusals, words and settings; who chooses (top, bottom, the standings, a
// tie, someone who left); what's filed; when it closes; the points by hand; the spoiler view. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" },
    { id: "cried", label: "Cried", defaultPoints: 0, answeredBy: "league" },
    { id: "rewardWin", label: "Won reward", defaultPoints: 1, answeredBy: "research" },
  ],
  results: true, winner: true, roles: [], grouped: true, jury: true, votes: true, phases: [{ id: "premerge" }, { id: "merged" }],
};
const TWISTS = [{ id: "double", name: "Double points", times: 2 }, { id: "immunity", name: "Immunity frenzy", moment: "individualImmunity", times: 3 }];
// Best ball over the whole team of three (no lineups to set), so every holding counts.
const BEST = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { best: 3 }, score: { by: "moments", points: null, twist: { of: TWISTS } } };
const LINEUP = { preset: "weekly-lineup", score: { by: "moments", points: null, twist: { of: TWISTS, who: "bottom", closes: 0, fallback: "double" } } };
const PICK = { preset: "survival-pool", get: { by: "pick", each: 1, repeat: "any" }, count: { pick: true }, score: { by: "moments", points: null, twist: { of: TWISTS, by: "total" } }, rank: { by: "total" } };
const S40 = { preset: "weekly-lineup", score: { by: "moments", points: null, twist: { of: [{ id: "double", name: "Double points", times: 2 }, { id: "half", name: "Half points", times: 0.5 }] } } };

test("the twist: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  for (const s of [BEST, LINEUP, PICK]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(ats(G.specProblems(S40)), [], "the tracker's, on a show with no rulebook: the shape alone");
  assert.deepEqual(G.withSpec(S.defaultState().settings, BEST).twist, { of: TWISTS });
  assert.deepEqual(G.twistOf(BEST), { of: TWISTS, who: "top", by: "episode", tie: "total", closes: 12, fallback: "none" });
  assert.equal(G.twistOf(PICK).tie, "none", "by the standings, nothing breaks a tie");
  assert.equal(G.twistOf({ preset: "weekly-lineup" }), null);
  // Words (through impeccable's clarify): "chooses", who chooses said once, the deadline as the chooser's.
  const d = G.describeSpec(BEST, { castaway: "castaway", moments: CTX.moments });
  assert.ok(d.sentence.includes("After each episode, its top scorer chooses a twist for the next one: Double points (every point counts double) or Immunity frenzy (won immunity counts triple)."), d.sentence);
  assert.ok(d.rules.includes("The twist counts for everyone, for that episode only."));
  assert.ok(d.rules.includes("Top scorer means the most points in that episode, once its results are final. A tie goes to whoever's ahead overall; still tied, nobody chooses."));
  assert.ok(d.rules.includes("They have until 12 hours before the next episode airs to choose. The choice stays secret until then; then everyone sees it."));
  assert.ok(d.rules.includes("No choice in time? No twist that episode."));
  assert.ok(d.rules.includes("Episode 1 has no twist: nobody's scored yet."));
  const l = G.describeSpec(LINEUP, { castaway: "castaway", moments: CTX.moments });
  assert.ok(l.sentence.includes("After each episode, its lowest scorer chooses a twist"), l.sentence);
  assert.ok(l.rules.includes("Lowest scorer means the fewest points in that episode, once its results are final. A tie goes to whoever's behind overall; still tied, nobody chooses."));
  assert.ok(l.rules.includes("They have until the next episode airs to choose. The choice stays secret until then; then everyone sees it."));
  assert.ok(l.rules.includes("No choice in time? It's Double points."));
  const p = G.describeSpec({ ...PICK, span: { from: 3 } }, { castaway: "castaway", moments: CTX.moments });
  assert.ok(p.sentence.includes("After each episode, whoever leads the standings chooses a twist for the next one"), p.sentence);
  assert.ok(p.rules.includes("That's whoever's first in the standings once the episode's results are final. A tie: nobody chooses."));
  assert.ok(p.rules.includes("Episode 3 has no twist: nobody's scored yet."), "the game's own first episode");
  assert.ok(G.describeSpec(S40).sentence.includes("Half points (every point counts half)"));
  assert.ok(G.describeSpec({ ...BEST, span: { from: { phase: "merged" } } }).rules.includes("The game's first episode has no twist: nobody's scored yet."), "a game starting at a phase");
  // Refused, each with why.
  const t = (twist, more = {}) => at({ ...BEST, score: { by: "moments", points: null, twist }, ...more });
  assert.deepEqual(t(2), ["score.twist"]);
  assert.deepEqual(t({ of: [TWISTS[0]] }), ["score.twist.of"], "a choice of one is no choice");
  assert.deepEqual(t({ of: [...TWISTS, ...[3, 4, 5, 6].map((n) => ({ id: `t${n}`, name: `Times ${n}`, times: n }))] }), ["score.twist.of"], "six is too many");
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], id: "double" }] }), ["score.twist.of[1].id"]);
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], id: "none" }] }), ["score.twist.of[1].id"], "none is the fallback's word");
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], name: "" }] }), ["score.twist.of[1].name"]);
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], times: 1 }] }), ["score.twist.of[1].times"]);
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], times: 11 }] }), ["score.twist.of[1].times"]);
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[0], id: "again" }] }), ["score.twist.of[1]"], "two that do the same");
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], moment: "notAMoment" }] }), ["score.twist.of[1].moment"]);
  assert.deepEqual(t({ of: [TWISTS[0], { ...TWISTS[1], moment: "cried" }] }), ["score.twist.of[1].moment"], "the couch's word: data can't settle it");
  assert.deepEqual(at({ ...BEST, score: { ...BEST.score, only: ["rewardWin"] } }), ["score.twist.of[1].moment"], "a moment the game doesn't count");
  assert.deepEqual(t({ of: TWISTS, who: "middle" }), ["score.twist.who"]);
  assert.deepEqual(t({ of: TWISTS, by: "season" }), ["score.twist.by"]);
  assert.deepEqual(t({ of: TWISTS, tie: "coin" }), ["score.twist.tie"]);
  assert.deepEqual(t({ of: TWISTS, by: "total", tie: "total" }), ["score.twist.tie"]);
  assert.deepEqual(t({ of: TWISTS, closes: 49 }), ["score.twist.closes"]);
  assert.deepEqual(t({ of: TWISTS, closes: 1.5 }), ["score.twist.closes"]);
  assert.deepEqual(t({ of: TWISTS, fallback: "triple" }), ["score.twist.fallback"]);
  assert.deepEqual(at({ ...BEST, rank: { by: "standing", cut: [{ at: { every: 2 }, out: 1 }] } }), ["score.twist"], "not beside cuts: someone knocked out would still choose");
  assert.deepEqual(at({ ...BEST, rank: { by: "total", race: { to: 40 } } }), ["score.twist"], "not beside a race");
  assert.deepEqual(t({ of: TWISTS, secret: true }), ["score.twist.secret"], "an unknown key");
  assert.deepEqual(t({ of: [{ ...TWISTS[0], when: 3 }, TWISTS[1]] }), ["score.twist.of[0].when"], "an unknown key on a twist");
  assert.ok(at({ preset: "outlast", score: { by: "place", twist: { of: TWISTS } } }).includes("score.twist"), "an Outlast's place has no points to multiply");
  assert.ok(at({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1, twist: { of: TWISTS } } }).includes("score.twist"), "a pool's right pick is no moment");
  // Not in a stage: the choosing is the game's.
  const staged = { stages: [{ id: "a", name: "First", game: { ...BEST, span: { from: 1, to: 4 } } }, { id: "b", name: "Second", game: { preset: "weekly-lineup", span: { from: 5 } } }], overall: { by: "sum" } };
  assert.ok(at(staged).includes("stages[0].game.score.twist"), JSON.stringify(at(staged)));
});

// ---- the engine, on a league ----

/** Nine castaways C0 to C8, three players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8); its game `spec` through
 *  setGame; Episodes 1 to 5 made, none with results. */
function league(spec, players = ["ann", "bo", "cy"]) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 9; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [players[Math.floor(i / 3)]].filter(Boolean); });
  for (let n = 1; n <= 5; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const out = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
const won = (s, n, i) => S.addScoringEvent(s, ep(s, n).id, "individualImmunity", cid(s, i));
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));
const T = S.TwistLogic;

test("who chooses: the episode's top scorer by the walk, bottom, the standings, a tie, someone who left", () => {
  const s = league(BEST);
  assert.deepEqual(T.chooserAt(s, 1), { playerId: null, why: "first" }, "the game's first episode has none");
  assert.deepEqual(T.chooserAt(s, 2), { playerId: null, why: "waiting" }, "Episode 1 has no results yet");
  // Episode 1: ann's C0 wins immunity (+3), cy's C8 voted out (-3): ann 3, bo 0, cy -3.
  won(s, 1, 0); out(s, 1, 8);
  assert.deepEqual(totals(s), { ann: 3, bo: 0, cy: -3 });
  assert.deepEqual(T.chooserAt(s, 2), { playerId: "ann" });
  // Early results don't choose: only final ones move a week's result.
  ep(s, 1).resultsStage = "early";
  assert.deepEqual(T.chooserAt(s, 2), { playerId: null, why: "waiting" });
  delete ep(s, 1).resultsStage;
  // Bottom: cy. By the standings: the same after one episode.
  const low = league({ ...BEST, score: { ...BEST.score, twist: { of: TWISTS, who: "bottom" } } });
  won(low, 1, 0); out(low, 1, 8);
  assert.deepEqual(T.chooserAt(low, 2), { playerId: "cy" });
  // Episode 2: ann's C1 and bo's C3 both win immunity (+3 each), cy's C7 voted out: the week ann 3, bo 3, cy -3; overall ann 6, bo 3.
  won(s, 2, 1); won(s, 2, 3); out(s, 2, 7);
  assert.deepEqual(T.chooserAt(s, 3), { playerId: "ann" }, "a tie on the week goes to whoever's ahead overall");
  const none = league({ ...BEST, score: { ...BEST.score, twist: { of: TWISTS, tie: "none" } } });
  won(none, 1, 0); out(none, 1, 8); won(none, 2, 1); won(none, 2, 3); out(none, 2, 7);
  assert.deepEqual(T.chooserAt(none, 3), { playerId: null, why: "tie" });
  // Still tied overall: nobody. (Episode 1 both 3, Episode 2 both 3.)
  const level = league(BEST);
  won(level, 1, 0); won(level, 1, 3); out(level, 1, 8); won(level, 2, 1); won(level, 2, 4); out(level, 2, 7);
  assert.deepEqual(T.chooserAt(level, 3), { playerId: null, why: "tie" });
  // By the standings: the leader after it, whatever the week.
  const total = league({ ...BEST, score: { ...BEST.score, twist: { of: TWISTS, by: "total" } } });
  won(total, 1, 0); won(total, 1, 1); out(total, 1, 8); won(total, 2, 3); out(total, 2, 7);
  assert.deepEqual(T.chooserAt(total, 3), { playerId: "ann" }, "ann 6 overall beats bo's 3, though bo won the week");
  // Someone who left (disabled) doesn't choose: the next one does.
  s.players[0].disabled = true;
  assert.deepEqual(T.chooserAt(s, 3), { playerId: "bo" });
});

test("what's filed, the points it changes, and when it closes", () => {
  const s = league(BEST);
  won(s, 1, 0); out(s, 1, 8);
  // The choice stands when its maker still chooses; anyone else's, or a twist the game doesn't offer, plays the fallback (none).
  assert.deepEqual(T.file(s, 2, { playerId: "ann", twist: "double" }), { id: "double", by: "ann", how: "chosen" });
  assert.deepEqual(T.file(s, 2, { playerId: "bo", twist: "double" }), { id: null, by: null, how: "fallback" });
  assert.deepEqual(T.file(s, 2, { playerId: "ann", twist: "triple" }), { id: null, by: null, how: "fallback" });
  assert.deepEqual(T.file(s, 2, null), { id: null, by: null, how: "fallback" });
  const fb = league({ ...BEST, score: { ...BEST.score, twist: { of: TWISTS, fallback: "immunity" } } });
  assert.deepEqual(T.file(fb, 2, null), { id: "immunity", by: null, how: "fallback" }, "results not in: nobody chose");
  // Double points in Episode 2: bo's C3 wins immunity (3 x 2), cy's C7 voted out (-3 x 2): ann 3, bo 6, cy -9.
  won(s, 2, 3); out(s, 2, 7);
  assert.deepEqual(totals(s), { ann: 3, bo: 3, cy: -6 }, "before the stamp");
  ep(s, 2).twist = { id: "double", by: "ann", how: "chosen" };
  assert.equal(T.timesAt(s, 2), 2);
  assert.equal(S.ActiveRosterLogic.timesFor(s, 2), 2);
  assert.equal(S.ActiveRosterLogic.timesFor(s, 1), 1);
  assert.deepEqual(totals(s), { ann: 3, bo: 6, cy: -9 });
  assert.deepEqual(S.ScoringLogic.walk(s, { series: true }).series.map((e) => e.totals.get("bo")), [0, 6]);
  // Immunity frenzy instead: only won immunity triples (bo 9); the vote stays -3 (cy -6).
  ep(s, 2).twist = { id: "immunity", by: "ann", how: "chosen" };
  assert.equal(T.timesAt(s, 2), 1);
  assert.equal(T.momentTimes(s, "individualImmunity", 2), 3);
  // On the sequence's lines (step 2), never the moment's own points: a castaway's stats read those, and a choice mustn't move them.
  const ev2 = S.ActiveRosterLogic.episodeEvents(s, ep(s, 2));
  assert.deepEqual(S.ActiveRosterLogic.scoredEvents(s, ev2, 2).map((e) => e.points).sort((a, b) => a - b), [-3, 9]);
  assert.equal(S.ActiveRosterLogic.eventPoints(s, { type: "individualImmunity" }, 2), 3, "the castaway's own points stay the rules'");
  assert.equal(S.ActiveRosterLogic.pointsFor(s, "individualImmunity", 2), 3);
  assert.deepEqual(totals(s), { ann: 3, bo: 9, cy: -6 });
  // A stamp naming a twist the spec doesn't have plays nothing; a game without a twist reads none.
  ep(s, 2).twist = { id: "gone", by: "ann", how: "chosen" };
  assert.deepEqual(totals(s), { ann: 3, bo: 3, cy: -6 });
  const plain = league({ preset: "weekly-lineup", get: BEST.get, count: BEST.count, score: { by: "moments", points: null } });
  won(plain, 1, 0); ep(plain, 1).twist = { id: "double", by: "ann", how: "chosen" };
  assert.equal(S.ActiveRosterLogic.timesFor(plain, 1), 1);
  const lineup = (twist) => league({ preset: "weekly-lineup", get: BEST.get, count: { start: 2 }, score: { by: "moments", points: null, ...(twist ? { twist: { of: TWISTS } } : {}) } });
  assert.equal(S.ActiveRosterLogic.combines(lineup(false)), false, "a plain lineup adds up as it always did");
  assert.equal(S.ActiveRosterLogic.combines(lineup(true)), true, "one with a twist combines");
  // A lineup: only starters, the twist on their lines. ann starts C0 in Episode 2 under double points; C0 wins immunity: 6.
  const lu = league({ preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { start: 1 }, score: { by: "moments", points: null, twist: { of: TWISTS } } });
  S.ActiveRosterLogic.setLineup(lu, ep(lu, 2).id, "ann", [cid(lu, 0)]);
  won(lu, 2, 0); out(lu, 2, 8);
  ep(lu, 2).twist = { id: "double", by: "ann", how: "chosen" };
  assert.equal(totals(lu).ann, 6);
  // A pick scored by what they do: bo picks C3 in Episode 2 under immunity frenzy, C3 wins it: 9.
  const pk = league(PICK);
  S.PickEmLogic.setPick(pk, ep(pk, 2).id, "bo", cid(pk, 3));
  won(pk, 2, 3); out(pk, 2, 8);
  ep(pk, 2).twist = { id: "immunity", by: "bo", how: "chosen" };
  assert.equal(totals(pk).bo, 9);
  // When it closes: 12 hours before it airs, once it locks or has results, and at once at your own pace.
  const c = league(BEST);
  const air = Date.parse("2026-11-11T01:00:00Z");
  ep(c, 2).airsAt = new Date(air).toISOString();
  assert.equal(T.closesAt(c, 2), air - 12 * 3600e3);
  assert.equal(T.closed(c, 2, air - 13 * 3600e3), false);
  assert.equal(T.closed(c, 2, air - 12 * 3600e3), true);
  assert.equal(T.closesAt(c, 3), null, "no air time");
  assert.equal(T.closed(c, 3, air), false);
  ep(c, 3).lineupsLocked = true;
  assert.equal(T.closed(c, 3, air), true, "locked by hand");
  out(c, 4, 8);
  assert.equal(T.closed(c, 4, air), true, "it has results");
  assert.deepEqual(T.episodes(c), [2, 3, 4, 5], "every episode but the game's first");
  // (A league at your own pace files nothing: the server stamps its fallback, twists.ts.)
});

test("the spoiler view: a twist chosen after an episode the viewer hasn't seen is off their copy", () => {
  const s = league(BEST);
  won(s, 1, 0); out(s, 1, 8); won(s, 2, 3); out(s, 2, 7);
  ep(s, 2).twist = { id: "double", by: "ann", how: "chosen" };
  ep(s, 3).twist = { id: "immunity", by: "bo", how: "chosen" };
  const v1 = S.SpoilerLogic.viewThrough(s, 1);
  assert.deepEqual(ep(v1, 2).twist, { id: "double", by: "ann", how: "chosen" }, "chosen from Episode 1, which they've seen");
  assert.equal(ep(v1, 3).twist, undefined, "chosen from Episode 2's results");
  assert.ok(ep(s, 3).twist, "the state itself unchanged");
  assert.deepEqual(ep(S.SpoilerLogic.viewThrough(s, 2), 3).twist, { id: "immunity", by: "bo", how: "chosen" });
});
