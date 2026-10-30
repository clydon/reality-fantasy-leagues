// Group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1, "When a grouping lasts": the user's +1 or +2 roster slot that
// holds a pair or a team the show forms), and an exclusive draft only when the pool covers every pick (the 9:10 PM decision).
// Their shape, defaults and words; the settings both ways; the season's groups as a league reads them (format-timeline.js
// slotRecords, written onto episodes with results: GroupSlotLogic.settle); a slot opening after the episode that showed its
// groups and scoring from the next, riding with its group while it lasts and dropping when it changes (a re-pairing, each for
// themselves: every slot at once), a group shown that changed before it played void (F1's Q2), an unsure lock void or
// followed (the spec's fallback), swaps, exclusive slots and the count as the pool shrinks, a corrected report, the spoiler
// view, a late joiner's copy; a plain lineup scoring as before. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const T = require("../src/lib/game/formats/format-timeline.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
    { id: "satOut", label: "Sat out", defaultPoints: -0.5, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
};
const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 4, order: "snake", own: "exclusive" }, count: { start: 2 }, score: { by: "moments", points: null } };
const slotted = (groups = {}, base = LINEUP) => ({ ...base, get: { ...base.get, groups } });

test("group slots: their shape, defaults, words and settings; what they wait for", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  assert.deepEqual(at(slotted()), []);
  assert.deepEqual(at(slotted({ slots: 2, own: "exclusive", swap: true, fallback: "carry-on", points: "sum" })), []);
  assert.deepEqual(G.fullSpec(slotted()).get.groups, { slots: 1, own: "shared", swap: false, fallback: "void", points: "mean" }, "the defaults (the user's to set)");
  assert.deepEqual(G.specWaitsFor(slotted()), []);
  assert.equal(G.typeOf(slotted()), "active-roster");
  assert.equal(G.flagsOf(G.fullSpec(slotted())).hasGroupSlots, true);
  assert.equal(G.flagsOf(G.fullSpec(LINEUP)).hasGroupSlots, false);
  // Best ball takes them too: what counts is the moments its members earn.
  assert.deepEqual(at(slotted({}, { ...LINEUP, count: { best: 2 } })), []);
  // 1 or 2; shared or exclusive; swap a boolean; void or carry-on (next-stage A12's); mean or sum; a draft scored by moments.
  assert.deepEqual(at(slotted({ slots: 0 })), ["get.groups.slots"]);
  assert.deepEqual(at(slotted({ slots: 3 })), ["get.groups.slots"]);
  assert.deepEqual(at(slotted({ own: "mine" })), ["get.groups.own"]);
  assert.deepEqual(at(slotted({ swap: "yes" })), ["get.groups.swap"]);
  assert.deepEqual(at(slotted({ fallback: "later" })), ["get.groups.fallback"]);
  assert.deepEqual(at(slotted({ points: "max" })), ["get.groups.points"]);
  assert.deepEqual(at(slotted({ slots: 1, size: 2 })), ["get.groups.size"]);
  assert.deepEqual(at({ ...G.PRESETS.outlast, get: { ...G.PRESETS.outlast.get, groups: { slots: 1 } } }), ["get.groups"], "Outlast scores places, not what a group's people do");
  assert.deepEqual(at({ ...G.PRESETS["survival-pool"], get: { by: "pick", each: 1, repeat: "cycle", groups: { slots: 1 } } }), ["get.groups"], "only a draft");
  assert.deepEqual(G.specWaitsFor(slotted({ fallback: "next-stage" })).map((w) => [w.at, w.step]), [["get.groups.fallback", "later"]]);
  // The settings, both ways (and none written for a game without them).
  const fields = G.settingsOf(slotted({ slots: 2, own: "exclusive" }));
  assert.deepEqual(fields.groupSlots, { slots: 2, own: "exclusive", swap: false, fallback: "void", points: "mean" });
  assert.deepEqual(G.specOf({ ...S.defaultState().settings, ...fields }).get.groups, fields.groupSlots);
  assert.equal(G.settingsOf(LINEUP).groupSlots, undefined);
  assert.equal(G.specOf({ ...S.defaultState().settings, ...G.settingsOf(LINEUP) }).get.groups, undefined);
  assert.ok(G.OWNED.includes("groupSlots"));
  // In words: the sentence, and How it works for each setting.
  const d = G.describeSpec(slotted(), { show: "The Challenge 41" });
  assert.match(d.sentence, /plus a slot for a pair or team the show forms/);
  assert.ok(d.rules.some((r) => /pick one after the episode that showed them: it scores from the next episode/.test(r)));
  assert.ok(d.rules.some((r) => /their points averaged/.test(r)));
  assert.ok(d.rules.includes("Anyone can pick the same group."));
  assert.ok(d.rules.includes("Your slot rides with its group while it lasts: no changing it."));
  const two = G.describeSpec(slotted({ slots: 2, own: "exclusive", swap: true, fallback: "carry-on", points: "sum" })).rules;
  assert.ok(two.some((r) => /two slots/.test(r) && /pick one for each/.test(r)));
  assert.ok(two.some((r) => /their points added up/.test(r)));
  assert.ok(two.some((r) => /nobody else can pick it, while there are enough groups/.test(r)));
  assert.ok(two.includes("You can change each slot's group before any episode."));
  assert.ok(two.some((r) => /still counts, following the people you picked/.test(r)));
});

test("an exclusive draft only when the pool covers every pick: counted where it drafts, and as the pool shrinks", () => {
  const at = (spec, ctx) => ats(G.specProblems(spec, { ...CTX, ...ctx }));
  const outlast = G.PRESETS.outlast; // exclusive, 3 each
  assert.equal(G.covers({ pool: 18, people: 6, each: 3 }), true);
  assert.equal(G.covers({ pool: 18, people: 7, each: 3 }), false);
  assert.deepEqual(at(outlast, { pool: 18, couch: 6 }), []);
  const p = G.specProblems(outlast, { ...CTX, pool: 18, couch: 7 });
  assert.deepEqual(ats(p), ["get.own"]);
  assert.equal(p[0].problem, "7 of you × 3 picks is more than the 18 who can be drafted: make it shared, so two of you can have the same one");
  assert.deepEqual(at({ ...outlast, get: { by: "draft", each: 3, order: "blind", own: "shared" }, extras: { waivers: null } }, { pool: 18, couch: 12 }), [], "shared is fine");
  // Where the game drafts: a game that starts later counts the pool still in then (the caller's count).
  assert.deepEqual(at({ ...outlast, span: { from: 7, to: null } }, { pool: 12, couch: 5 }), ["get.own"]);
  assert.deepEqual(at({ ...outlast, span: { from: 7, to: null } }, { pool: 12, couch: 4 }), []);
  // Not counted without both numbers, nor for a league's own (its couch grows by people asking to join).
  assert.deepEqual(at(outlast, { pool: 18 }), []);
  assert.deepEqual(at(outlast, { couch: 12 }), []);
  assert.deepEqual(ats(G.specProblems(outlast, { ...CTX, pool: 18, couch: 12 }, { league: true })), []);
  // As the pool shrinks: group slots among a handful of pairs are counted at each opening (the engine's test below).
});

// ---- the engine, on a league ----

/** A Weekly Lineup (4 each, 2 starters) of eight castaways named C0 to C7, ann holding C0-C3 and bo C4-C7 (and cy, with
 *  nobody, when `three`), its game `spec` through setGame; Episodes 1 to 8 made, none with results. */
function league(spec, { three = false } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 8; i++) S.addCastaway(s, `C${i}`);
  s.players = (three ? ["ann", "bo", "cy"] : ["ann", "bo"]).map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [i < 4 ? "ann" : "bo"]; });
  for (let n = 1; n <= 8; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const L = S.GroupSlotLogic;
/** Episode n's results: each [castaway index, moment] scored, and who went home (an index), if anyone. */
function results(s, n, events, gone) {
  for (const [i, type] of events) assert.ok(S.addScoringEvent(s, ep(s, n).id, type, cid(s, i)), type);
  if (gone !== undefined) S.addElimination(s, ep(s, n).id, cid(s, gone), "Voted Out");
}
/** The groups, pairs of castaway indexes, as a format section has them. */
const pairs = (...ps) => ps.map((m) => ({ name: null, members: m.map((i) => `C${i}`) }));
/** One episode's report (format-timeline.js reportFrom's shape). */
const rep = (n, groups, { left = [], changes = [], playedAs = "pairs" } = {}) => ({
  episode: n,
  state: { playedAs, phase: null, groups, alone: [], newcomers: [], wentHomeAs: left.length ? "individuals" : "nobody", changes },
  left: left.map((i) => `C${i}`),
  merged: null,
});
/** The season's groups as the sync writes them into the league (group-slots.ts): the timeline from these reports. */
function settle(s, reports) {
  const tl = T.buildTimeline(reports, { cast: s.castaways.map((c) => c.name) });
  L.settle(s, T.slotRecords(tl, { resolve: (name) => (s.castaways.find((c) => c.name === name) || {}).id || null }));
  return tl;
}
const P1 = [0, 4], P2 = [1, 5], P3 = [2, 6], P4 = [3, 7];
const RE = [[0, 5], [1, 4], [2, 7], [3, 6]];
const repair = { kind: "swap", when: "end", what: "Everyone re-paired", sure: "high" };
const idOf = (s, n, members) => {
  const want = members.map((i) => cid(s, i)).sort().join("|");
  const g = L.offered(s, n).groups.find((x) => [...x.members].sort().join("|") === want);
  assert.ok(g, `pair ${members} is on offer going into ${n}`);
  return g.id;
};
const slotPoints = (s, n, who, slot = 0) => L.episodeLines(s, ep(s, n), who)[slot].points;

test("slotRecords: the timeline's groups at each end and as played, as the league's castaway ids", () => {
  const tl = T.buildTimeline([rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(...RE), { changes: [{ ...repair, from: 3 }] })], { cast: [] });
  const ids = { C0: "a", C1: "b", C2: "c", C3: "d", C4: "e", C5: "f", C6: "g" }; // C7 isn't on this league's cast
  const r = T.slotRecords(tl, { resolve: (n) => ids[n] || null });
  assert.deepEqual([...r.keys()], [1, 2]);
  const one = r.get(1);
  assert.equal(one.end.divided, true);
  assert.equal(one.end.sure, true);
  assert.deepEqual(one.end.groups.map((g) => [g.name, g.members, g.size]), [["C0 & C4", ["a", "e"], 2], ["C1 & C5", ["b", "f"], 2], ["C2 & C6", ["c", "g"], 2], ["C3 & C7", ["d"], 2]], "someone not on the cast still counts in a group's size");
  assert.deepEqual(one.played.groups.map((g) => g.id), one.end.groups.map((g) => g.id), "the premiere's pairs played it");
  const two = r.get(2);
  assert.deepEqual(two.played.groups.map((g) => g.id), one.end.groups.map((g) => g.id), "re-paired at its end: the old pairs played it");
  assert.notDeepEqual(two.end.groups.map((g) => g.id), one.end.groups.map((g) => g.id));
  assert.equal(two.end.sure, true);
  assert.equal(T.slotRecords(null).size, 0);
});

test("a slot opens after the episode that showed its groups, rides with its group, drops when it's re-paired, and picks again", () => {
  const s = league(slotted());
  assert.equal(S.ActiveRosterLogic.combines(s), true);
  const reports = [rep(1, pairs(P1, P2, P3, P4))];
  // Nothing is offered going into the premiere: nothing is known yet.
  assert.deepEqual(L.offered(s, 1).groups, []);
  assert.match(L.validatePick(s, ep(s, 1).id, "ann", 0, "x"), /Nothing is known yet/);
  // Episode 1: the show plays in pairs; once its results are in, its pairs are on offer going into 2.
  results(s, 1, [[0, "individualImmunity"]]);
  settle(s, reports);
  assert.equal(L.offered(s, 2).groups.length, 4);
  assert.equal(L.offered(s, 2).sure, true);
  const p1 = idOf(s, 2, P1);
  assert.equal(L.validatePick(s, ep(s, 2).id, "ann", 1, p1), "A team has 1 group slot");
  assert.equal(L.validatePick(s, ep(s, 2).id, "ann", 0, "nope"), "That group isn't one going into this episode");
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, p1));
  assert.ok(L.setPick(s, ep(s, 2).id, "bo", 0, p1), "shared: two teams can hold the same pair");
  assert.equal(L.standing(s, "ann", 0, 2).status, "waiting");
  // Episode 2: C0 wins immunity (3) and C4 finds an idol (2): the pair's mean, 2.5, beside ann's starters.
  S.ActiveRosterLogic.setLineup(s, ep(s, 2).id, "ann", [cid(s, 1), cid(s, 2)]);
  results(s, 2, [[0, "individualImmunity"], [4, "idolFound"], [1, "idolFound"]]);
  reports.push(rep(2, pairs(P1, P2, P3, P4)));
  settle(s, reports);
  assert.equal(L.standing(s, "ann", 0, 2).status, "held");
  assert.equal(slotPoints(s, 2, "ann"), 2.5);
  const two = S.ActiveRosterLogic.episodeScore(s, ep(s, 2), "ann");
  assert.equal(two.total, 2 + 2.5, "her starter's idol and the slot");
  assert.equal(two.slots[0].status, "held");
  assert.equal(slotPoints(s, 2, "bo"), 2.5);
  assert.equal(S.computeScores(s).find((r) => r.playerId === "bo").total, 2.5, "bo's starters scored nothing");
  // The slot rides with its group while it lasts (swap is off): no changing it for 3.
  assert.equal(L.validatePick(s, ep(s, 3).id, "ann", 0, idOf(s, 3, P2)), "Your slot rides with its group while that group lasts");
  assert.equal(L.validatePick(s, ep(s, 3).id, "ann", 0, null), "Your slot rides with its group while that group lasts");
  // Episode 3: still the same pairs, re-paired at its end. It scores (the pair played it); then the slot drops for 4.
  results(s, 3, [[4, "individualImmunity"]]);
  reports.push(rep(3, pairs(...RE), { changes: [{ ...repair, from: 4 }] }));
  settle(s, reports);
  assert.equal(slotPoints(s, 3, "ann"), 1.5);
  const four = L.standing(s, "ann", 0, 4);
  assert.equal(four.status, "dropped");
  assert.equal(four.endedAt, 3);
  assert.deepEqual(L.offered(s, 4).groups.map((g) => g.members.length), [2, 2, 2, 2]);
  assert.equal(L.validatePick(s, ep(s, 4).id, "ann", 0, p1), "That group isn't one going into this episode", "the old pair is gone");
  const re1 = idOf(s, 4, RE[0]);
  assert.ok(L.setPick(s, ep(s, 4).id, "ann", 0, re1), "a dropped slot picks again from the new pairs");
  // Episode 4: the new pair plays it. bo picked nothing new: his slot is empty and scores nothing.
  results(s, 4, [[5, "idolFound"]]);
  reports.push(rep(4, pairs(...RE)));
  settle(s, reports);
  assert.equal(slotPoints(s, 4, "ann"), 1);
  assert.equal(L.standing(s, "bo", 0, 4).status, "dropped");
  assert.equal(slotPoints(s, 4, "bo"), 0);
  // The whole game: ann's slot 2.5 + 1.5 + 1 beside her starters (Episode 1's C0 wasn't a starter).
  assert.equal(S.computeScores(s).find((r) => r.playerId === "ann").total, 2 + 2.5 + 1.5 + 1);
});

test("going each for themselves drops every slot at once; a group shown that changed before it played is void (F1's Q2)", () => {
  const s = league(slotted());
  const reports = [rep(1, pairs(P1, P2, P3, P4))];
  results(s, 1, [[0, "idolFound"]]);
  settle(s, reports);
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, idOf(s, 2, P1)));
  assert.ok(L.setPick(s, ep(s, 2).id, "bo", 0, idOf(s, 2, P2)));
  // Episode 2 is re-drawn at its START: the pairs shown at 1's end never played. Void for both (no points either way).
  results(s, 2, [[0, "individualImmunity"], [4, "idolFound"]]);
  reports.push(rep(2, pairs(...RE), { changes: [{ kind: "swap", when: "start", from: 2, what: "Re-drawn", sure: "high" }] }));
  settle(s, reports);
  const two = L.standing(s, "ann", 0, 2);
  assert.equal(two.status, "void");
  assert.deepEqual(two.why, ["The group didn't play it as it was picked"]);
  assert.equal(slotPoints(s, 2, "ann"), 0);
  assert.equal(L.standing(s, "ann", 0, 3).status, "dropped", "it reopens for the next");
  assert.ok(L.setPick(s, ep(s, 3).id, "ann", 0, idOf(s, 3, RE[0])));
  assert.ok(L.setPick(s, ep(s, 3).id, "bo", 0, idOf(s, 3, RE[1])));
  // Episode 3 ends with everyone for themselves: every slot drops, and nothing is on offer.
  results(s, 3, [[1, "idolFound"]]);
  reports.push(rep(3, [], { playedAs: "pairs", changes: [{ kind: "split-into-individuals", when: "end", from: 4, what: "Each for themselves", sure: "high" }] }));
  settle(s, reports);
  assert.equal(slotPoints(s, 3, "ann"), 0, "C0 & C5 scored nothing");
  assert.equal(slotPoints(s, 3, "bo"), 1, "C1 & C4: C1's idol, halved");
  assert.equal(L.standing(s, "ann", 0, 4).status, "dropped");
  assert.equal(L.standing(s, "bo", 0, 4).status, "dropped");
  assert.deepEqual(L.offered(s, 4).groups, []);
  assert.deepEqual(L.offered(s, 4).why, ["The show isn't divided into groups going into it"]);
});

test("an unsure lock: void by default, nothing offered and a held slot's episode off; carry-on offers and follows the people", () => {
  for (const fallback of ["void", "carry-on"]) {
    const s = league(slotted({ fallback }));
    const reports = [rep(1, pairs(P1, P2, P3, P4))];
    results(s, 1, [[0, "idolFound"]]);
    settle(s, reports);
    assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, idOf(s, 2, P1)));
    // Episode 2's answer says a re-pairing for 3 that its own groups don't show: going into 3 isn't sure.
    results(s, 2, [[0, "idolFound"]]);
    reports.push(rep(2, pairs(P1, P2, P3, P4), { changes: [{ ...repair, from: 3 }] }));
    settle(s, reports);
    assert.equal(slotPoints(s, 2, "ann"), 1, "Episode 2 itself was sure");
    const offer = L.offered(s, 3);
    if (fallback === "void") {
      assert.deepEqual(offer.groups, []);
      assert.match(offer.why[0], /the answer says swap/);
    } else {
      assert.equal(offer.groups.length, 4);
      assert.equal(offer.sure, false);
    }
    results(s, 3, [[0, "individualImmunity"], [4, "individualImmunity"]]);
    reports.push(rep(3, pairs(P1, P2, P3, P4)));
    settle(s, reports);
    const three = L.standing(s, "ann", 0, 3);
    assert.equal(three.status, fallback === "void" ? "void" : "held");
    assert.equal(slotPoints(s, 3, "ann"), fallback === "void" ? 0 : 3);
    if (fallback === "carry-on") assert.equal(three.unsure, true);
  }
  // Carry-on follows the people when the group didn't play as picked: the pick's members score (C0 and C4, re-drawn apart).
  const s = league(slotted({ fallback: "carry-on" }));
  const reports = [rep(1, pairs(P1, P2, P3, P4))];
  results(s, 1, [[0, "idolFound"]]);
  settle(s, reports);
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, idOf(s, 2, P1)));
  results(s, 2, [[0, "individualImmunity"], [4, "idolFound"]]);
  reports.push(rep(2, pairs(...RE), { changes: [{ kind: "swap", when: "start", from: 2, what: "Re-drawn", sure: "high" }] }));
  settle(s, reports);
  const two = L.standing(s, "ann", 0, 2);
  assert.equal(two.status, "held");
  assert.equal(two.unsure, true);
  assert.equal(slotPoints(s, 2, "ann"), 2.5);
  assert.equal(L.standing(s, "ann", 0, 3).status, "dropped");
});

test("swaps while a group lasts, two slots, and exclusive slots counted at each opening as the pool shrinks", () => {
  const s = league(slotted({ slots: 2, swap: true, own: "exclusive" }));
  const reports = [rep(1, pairs(P1, P2, P3, P4))];
  results(s, 1, [[0, "idolFound"]]);
  settle(s, reports);
  const [p1, p2, p3] = [P1, P2, P3].map((p) => idOf(s, 2, p));
  // Two teams × two slots = four pairs: exclusive, first come.
  assert.equal(L.offered(s, 2).shared, false);
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, p1));
  assert.equal(L.validatePick(s, ep(s, 2).id, "ann", 1, p1), "That group is already in your other slot");
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 1, p2));
  assert.equal(L.validatePick(s, ep(s, 2).id, "bo", 0, p1), "ann has that group");
  assert.ok(L.setPick(s, ep(s, 2).id, "bo", 0, p3));
  results(s, 2, [[1, "idolFound"]]);
  reports.push(rep(2, pairs(P1, P2, P3, P4)));
  settle(s, reports);
  assert.deepEqual(L.episodeLines(s, ep(s, 2), "ann").map((l) => [l.status, l.points]), [["held", 0], ["held", 1]]);
  // With swaps on, ann moves her second slot to the pair bo doesn't have; bo can't take hers, which she still holds.
  assert.equal(L.validatePick(s, ep(s, 3).id, "bo", 1, p1), "ann has that group");
  assert.ok(L.setPick(s, ep(s, 3).id, "ann", 1, idOf(s, 3, P4)));
  assert.ok(L.setPick(s, ep(s, 3).id, "bo", 1, p2), "the pair she let go is free");
  // The pool shrinks: C7 goes home in Episode 3, so C3 is on their own going into 4 and three pairs are left for four slots.
  results(s, 3, [[2, "idolFound"]], 7);
  reports.push(rep(3, pairs(P1, P2, P3, [3]), { left: [7] }));
  settle(s, reports);
  assert.equal(L.offered(s, 4).groups.length, 3);
  assert.equal(L.offered(s, 4).shared, true, "2 teams × 2 slots is more than 3 pairs: this opening is shared");
  assert.equal(L.standing(s, "ann", 1, 4).status, "dropped", "C3 & C7 is no pair now");
  assert.ok(L.setPick(s, ep(s, 4).id, "ann", 1, p3), "shared this time: bo's pair too");
  // A three-seat game with four pairs and one slot each covers it; with two slots it doesn't.
  const three = league(slotted({ own: "exclusive" }), { three: true });
  results(three, 1, [[0, "idolFound"]]);
  settle(three, [rep(1, pairs(P1, P2, P3, P4))]);
  assert.equal(L.offered(three, 2).shared, false);
  const crowd = league(slotted({ slots: 2, own: "exclusive" }), { three: true });
  results(crowd, 1, [[0, "idolFound"]]);
  settle(crowd, [rep(1, pairs(P1, P2, P3, P4))]);
  assert.equal(L.offered(crowd, 2).shared, true);
});

test("a corrected report reaches every episode after it; records only on episodes with results; the spoiler view; a late joiner", () => {
  const s = league(slotted());
  results(s, 1, [[0, "idolFound"]]);
  settle(s, [rep(1, pairs(P1, P2, P3, P4))]);
  const p1 = idOf(s, 2, P1);
  assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, p1));
  results(s, 2, [[0, "individualImmunity"], [4, "idolFound"]]);
  settle(s, [rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(P1, P2, P3, P4))]);
  assert.equal(slotPoints(s, 2, "ann"), 2.5);
  // Episode 1's report corrected: it had no format section, so nothing was known going into 2 (the pick void, no points).
  settle(s, [{ episode: 1, state: null, left: [], merged: null }, rep(2, pairs(P1, P2, P3, P4))]);
  assert.equal(L.standing(s, "ann", 0, 2).status, "void");
  assert.equal(slotPoints(s, 2, "ann"), 0);
  // ...and put back: the pick is found again (by its id, else by its members).
  settle(s, [rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(P1, P2, P3, P4))]);
  assert.equal(slotPoints(s, 2, "ann"), 2.5);
  // A correction that moves its id (the pairs first shown at 2 instead): found by its members.
  const moved = JSON.parse(JSON.stringify(s));
  moved.episodes.forEach((e) => (e.formatGroups ? [e.formatGroups.end, e.formatGroups.played].forEach((x) => x && x.groups.forEach((g) => { g.id = `x${g.id}`; })) : null));
  assert.equal(L.standing(moved, "ann", 0, 2).status, "held");
  // Only episodes with results carry a record: results taken back take it off.
  assert.equal(ep(s, 3).formatGroups, undefined);
  assert.ok(ep(s, 2).formatGroups);
  S.removeScoringEvent(s, ep(s, 2).id, ep(s, 2).scoringEvents[1].id);
  S.removeScoringEvent(s, ep(s, 2).id, ep(s, 2).scoringEvents[0].id);
  settle(s, [rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(P1, P2, P3, P4))]);
  assert.equal(ep(s, 2).formatGroups, undefined);
  results(s, 2, [[0, "individualImmunity"], [4, "idolFound"]]);
  settle(s, [rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(P1, P2, P3, P4))]);
  // The spoiler view: someone who's seen only Episode 1 sees no record of 2, so nothing of 2's end is offered going into 3.
  const view = S.SpoilerLogic.viewThrough(s, 1);
  assert.equal(ep(view, 2).formatGroups, undefined);
  assert.deepEqual(L.offered(view, 3).groups, []);
  assert.equal(L.offered(view, 2).groups.length, 4);
  // A late joiner catching up picks in their own copy, and it's copied back like their lineup.
  s.players.push({ id: "dee", name: "dee", color: "#000", ghost: true, lateJoin: { startEpisode: 2, catchingUp: true } });
  const problem = S.GhostLogic.applyAs(s, "dee", 1, ep(s, 2).id, (v) => (L.setPick(v, ep(v, 2).id, "dee", 0, p1) ? null : "refused"));
  assert.equal(problem, null);
  assert.deepEqual(ep(s, 2).groupSlots.dee, { 0: { id: p1, members: [cid(s, 0), cid(s, 4)], size: 2 } });
});

test("a group's mean is over its people as research has them: one not on the league's cast scores nothing and still counts", () => {
  for (const [points, want] of [["mean", 1.5], ["sum", 3]]) {
    const s = league(slotted({ points }));
    const resolve = (name) => (name === "C4" ? null : (s.castaways.find((c) => c.name === name) || {}).id || null);
    const settleAs = (reports) => L.settle(s, T.slotRecords(T.buildTimeline(reports, { cast: [] }), { resolve }));
    results(s, 1, [[0, "idolFound"]]);
    settleAs([rep(1, pairs(P1, P2, P3, P4))]);
    const p1 = L.offered(s, 2).groups.find((g) => g.members.length === 1 && g.members[0] === cid(s, 0));
    assert.equal(p1.size, 2);
    assert.ok(L.setPick(s, ep(s, 2).id, "ann", 0, p1.id));
    assert.equal(ep(s, 2).groupSlots.ann[0].size, 2, "the pick keeps the group's size");
    results(s, 2, [[0, "individualImmunity"]]);
    settleAs([rep(1, pairs(P1, P2, P3, P4)), rep(2, pairs(P1, P2, P3, P4))]);
    assert.equal(slotPoints(s, 2, "ann"), want, points);
  }
});

test("a plain lineup scores as before: no slots, no records, the same arithmetic", () => {
  const s = league(LINEUP);
  assert.equal(L.config(s), null);
  assert.equal(S.ActiveRosterLogic.combines(s), false);
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "ann", [cid(s, 0), cid(s, 1)]);
  results(s, 1, [[0, "individualImmunity"], [1, "satOut"]]);
  settle(s, [rep(1, pairs(P1, P2, P3, P4))]);
  assert.equal(ep(s, 1).formatGroups, undefined, "settle writes nothing for a game without slots");
  assert.equal(S.computeScores(s).find((r) => r.playerId === "ann").total, 2.5);
  assert.equal(L.validatePick(s, ep(s, 2).id, "ann", 0, "x"), "This game has no group slots");
  assert.deepEqual(L.episodeLines(s, ep(s, 1), "ann"), []);
  assert.deepEqual(S.ActiveRosterLogic.episodeScore(s, ep(s, 1), "ann").slots, []);
});
