// The format's state over time (F3 of docs/PLAN-start-a-game-gpt.md, "Formats nobody announced"; src/lib/game/formats/
// format-timeline.js): built from made-up episode answers, the state at each episode's end and whether it's sure, how each
// episode was played, the changes (our comparison crossed with the answer's), whole groups going home from the exits, each
// group's lifetime and each grouping's spells, newcomers, a corrected report working out everything after it again, and the
// readers with their fallbacks (A6's choices, A10's group slots, A12's side stages and triggers). Then each person's group
// move worked out from the section (newGroup no longer asked beside it), through the review and staging. No bot, no
// database but the in-memory one. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
// Before the research module binds the embeddings (staging a paste stores none here).
const { fakeResearchDb, stubEmbeddings } = require("./harness/fake-research-db.js");
stubEmbeddings();
const TL = require("../src/lib/game/formats/format-timeline.js");
const FS = require("../src/lib/game/formats/format-state.js");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const { termsFor } = require("../db/wiki-sync.js");

const g = (name, ...members) => ({ name, members });
const p = (...members) => ({ name: null, members });
// One episode's report: its format section (groups null: not known) and who it has going home.
function report(episode, groups, { changes = [], left = [], playedAs = "tribes", wentHomeAs = null, newcomers = [], merged = null, alone = [] } = {}) {
  return {
    episode,
    left,
    merged,
    state: { playedAs, phase: null, groups, alone, newcomers, wentHomeAs: wentHomeAs || (left.length ? "individuals" : "nobody"), changes },
  };
}
const change = (kind, from, when, extra = {}) => ({ kind, from, when, what: `${kind} from ${from}`, sure: "high", ...extra });
const ids = (e) => e.end.groups.map((x) => x.id);

// Survivor-like: three tribes, a swap at episode 3's start into two, the merge at 5's start.
const S = { A: ["Ann", "Abe", "Amy", "Al"], B: ["Bea", "Bo", "Bix", "Ben"], C: ["Cal", "Cy", "Cat", "Col"] };
const swapped = { Hina: ["Ann", "Abe", "Bea", "Bo", "Cal"], Kele: ["Amy", "Bix", "Ben", "Cy", "Cat"] };
function survivor() {
  return [
    report(1, [g("A", ...S.A), g("B", ...S.B), g("C", ...S.C)], { left: ["Col"] }),
    report(2, [g("A", ...S.A), g("B", ...S.B), g("C", "Cal", "Cy", "Cat")], { left: ["Al"] }),
    report(3, [g("Hina", ...swapped.Hina), g("Kele", ...swapped.Kele)], { changes: [change("swap", 3, "start")] }),
    report(4, [g("Hina", "Ann", "Abe", "Bea", "Bo"), g("Kele", ...swapped.Kele)], { left: ["Cal"] }),
    report(5, [g("Lewatu", "Ann", "Abe", "Bea", "Bo", "Amy", "Bix", "Ben", "Cy", "Cat")], { changes: [change("merge", 5, "start")], merged: "yes", playedAs: "individuals" }),
    report(6, [], { left: ["Cat"], playedAs: "individuals", merged: "yes" }),
  ];
}

test("a swap at an episode's start and the merge: sure, played by the new groups, tribes that lose someone carry on", () => {
  const tl = TL.buildTimeline(survivor(), { cast: [...S.A, ...S.B, ...S.C] });
  assert.equal(tl.episodes.length, 6);
  assert.ok(tl.episodes.every((e) => e.sure), tl.episodes.map((e) => e.why).join(" | "));
  const e3 = TL.at(tl, 3);
  assert.deepEqual(e3.changes.map((c) => [c.kind, c.from, c.when, c.by, c.sure, c.allNew]), [["swap", 3, "start", "both", "high", true]]);
  assert.deepEqual(e3.played.groups.map((x) => x.name), ["Hina", "Kele"], "a change at the start: the new tribes played it");
  assert.equal(TL.at(tl, 2).end.groups[2].id, TL.at(tl, 1).end.groups[2].id, "C lost Col and is still C (Q1)");
  assert.equal(TL.at(tl, 4).end.groups[0].id, e3.end.groups[0].id, "Hina lost Cal and is still Hina");
  const e5 = TL.at(tl, 5);
  assert.deepEqual(e5.changes.map((c) => [c.kind, c.by]), [["merge", "both"]]);
  assert.equal(e5.played.apart, true, "one tribe of everyone isn't a division");
  // Lifetimes: the starting tribes played 1-2, ended by the swap at 3; the swap's tribes 3-4, ended by the merge.
  const life = Object.fromEntries(tl.groups.map((x) => [`${x.name}@${x.shown}`, [x.played.join(","), x.ended, x.endedAt]]));
  assert.deepEqual(life, {
    "A@1": ["1,2", "changed", 3],
    "B@1": ["1,2", "changed", 3],
    "C@1": ["1,2", "changed", 3],
    "Hina@3": ["3,4", "merge", 5],
    "Kele@3": ["3,4", "merge", 5],
  });
  assert.ok(!tl.groups.some((x) => x.name === "Lewatu"), "the merged tribe is no group to ride");
  assert.deepEqual(tl.spells.map((s) => [s.id, s.played.join(","), s.ended]), [["s1", "1,2", "swap"], ["s3", "3,4", "merge"]]);
  // A stage on a major change: the swap (every tribe new) and the merge, from the episode each took effect.
  assert.deepEqual(TL.stageTriggers(tl).act.map((t) => [t.kind, t.from]), [["swap", 3], ["merge", 5]]);
  assert.deepEqual(TL.stageTriggers(tl, ["swap"]).act.map((t) => t.kind), ["swap"]);
  assert.deepEqual(TL.stageTriggers(tl, ["merge", "twist"]).act.map((t) => t.kind), ["merge"], "a twist is never a trigger");
});

test("the merge said only by `merged`: our comparison's merge is the answer's too; once merged, not again", () => {
  const reports = survivor();
  reports[4].state.changes = [];
  const tl = TL.buildTimeline(reports);
  assert.deepEqual(TL.at(tl, 5).changes.map((c) => [c.kind, c.by, c.sure]), [["merge", "both", "high"]]);
  assert.ok(TL.at(tl, 5).sure);
  // Without merged either, our merge alone is unsure: it moves nothing.
  reports[4].merged = null;
  const tl2 = TL.buildTimeline(reports);
  assert.deepEqual(TL.at(tl2, 5).changes.map((c) => [c.kind, c.by, c.sure]), [["merge", "ours", "low"]]);
  assert.equal(TL.at(tl2, 5).sure, false);
  assert.deepEqual(TL.stageTriggers(tl2).held.map((t) => t.kind), ["merge"]);
});

// The Challenge-like: rotating pairs re-drawn at each episode's end, a newcomer, an individual episode, locked pairs that
// go home together, a claim partway through.
const P = ["Ann", "Bea", "Cal", "Dee", "Eve", "Fay", "Gus", "Hal"];
function challenge() {
  return [
    report(1, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay"), p("Gus", "Hal")], { playedAs: "pairs" }),
    report(2, [p("Ann", "Cal"), p("Bea", "Eve"), p("Dee", "Gus"), p("Fay", "Hal")], { playedAs: "pairs", changes: [change("swap", 3, "end")] }),
    // Fay quits; Joy comes in for her beside Hal (a newcomer, not a swap); the pairs are kept for 4.
    report(3, [p("Ann", "Cal"), p("Bea", "Eve"), p("Dee", "Gus"), p("Joy", "Hal")], { playedAs: "pairs", left: ["Fay"], newcomers: [{ name: "Joy", replaces: "Fay", group: "Hal" }], changes: [change("newcomer", 3, "mid")] }),
    // Played alone, then locked pairs at its end.
    report(4, [p("Ann", "Dee"), p("Bea", "Cal"), p("Eve", "Hal"), p("Gus", "Joy")], { playedAs: "individuals", changes: [change("pairs-formed", 5, "end")] }),
    // A whole pair goes home; the answer says individuals.
    report(5, [p("Ann", "Dee"), p("Bea", "Cal"), p("Eve", "Hal")], { playedAs: "pairs", left: ["Gus", "Joy"], wentHomeAs: "individuals" }),
    report(6, [p("Ann", "Dee"), p("Bea", "Cal"), p("Eve", "Hal")], { playedAs: "pairs" }),
    // A claim partway through: Bea takes Hal, Cal goes with Eve.
    report(7, [p("Ann", "Dee"), p("Bea", "Hal"), p("Cal", "Eve")], { playedAs: "pairs", changes: [change("swap", 7, "mid")] }),
  ];
}

test("re-drawn pairs, a newcomer in a leaver's place, an episode played apart, a pair home together, a claim partway", () => {
  const tl = TL.buildTimeline(challenge(), { cast: P });
  const kinds = (n) => TL.at(tl, n).changes.map((c) => `${c.kind}/${c.by}/${c.sure}${c.from ? `@${c.from}` : ""}`);
  assert.deepEqual(kinds(2), ["swap/both/high@3"], "every pair re-drawn at the end, for the next");
  assert.ok(TL.at(tl, 2).changes[0].allNew);
  assert.deepEqual(kinds(3), ["newcomer/both/high@3"], "Joy for Fay beside Hal: a newcomer, not a swap");
  assert.deepEqual(tl.newcomers, [{ name: "Joy", episode: 3, replaces: "Fay", group: "Hal" }]);
  assert.deepEqual(TL.castAt(tl, 4).sort(), ["Ann", "Bea", "Cal", "Dee", "Eve", "Gus", "Hal", "Joy"]);
  // Episode 4 played alone between paired states: a split at its start (the answer didn't list it: unsure, held) and the
  // locked pairs formed at its end (both: sure).
  assert.deepEqual(kinds(4), ["split-into-individuals/played/low@4", "pairs-formed/both/high@5"]);
  assert.equal(TL.at(tl, 4).played.apart, true);
  assert.equal(TL.at(tl, 4).sure, true, "the end is sure: the unsure split is about how it was played");
  // Whole pair home, from the exits: ours groups, the answer's individuals.
  assert.deepEqual(TL.at(tl, 5).wentHome.map((x) => x.members), [["Gus", "Joy"]]);
  assert.deepEqual(TL.at(tl, 5).wentHomeAs, { ours: "groups", theirs: "individuals", agree: false });
  // The claim: episode 7 played by the pairs at its start (Q3); the new pairs from 8.
  assert.deepEqual(kinds(7), ["swap/both/high@7"]);
  assert.deepEqual(TL.at(tl, 7).played.groups.map((x) => x.members.join("+")), ["Ann+Dee", "Bea+Cal", "Eve+Hal"]);
  assert.deepEqual(TL.at(tl, 7).played.mid.map((x) => x.members.join("+")), ["Ann+Dee", "Bea+Hal", "Cal+Eve"]);
  // Lifetimes: the rotating pairs one episode each, split by the episode played alone; Joy & Hal shown and never played;
  // the locked pairs from 5; Gus & Joy went home whole; two ended by the claim after playing 7.
  const life = (members) => tl.groups.find((x) => FS.keyOf(x.members) === FS.keyOf(members) && x.shown >= 0);
  assert.deepEqual(life(["Ann", "Bea"]).played, [1, 2], "the premiere's groups played it, and 2 (re-drawn at 2's end)");
  assert.deepEqual(life(["Ann", "Cal"]).played, [3], "re-drawn for 3, played 3, then 4 was played alone");
  assert.equal(life(["Ann", "Cal"]).ended, "split", "the episode after was played alone");
  assert.equal(life(["Fay", "Hal"]).ended, "left", "down to Hal when Fay quit: no pair");
  assert.deepEqual(life(["Joy", "Hal"]).played, [], "shown at 3's end, and 4 was played alone");
  assert.equal(life(["Joy", "Hal"]).never, true);
  assert.deepEqual([life(["Gus", "Joy"]).played, life(["Gus", "Joy"]).ended], [[5], "left"]);
  assert.deepEqual([life(["Bea", "Cal"]).played, life(["Bea", "Cal"]).ended, life(["Bea", "Cal"]).endedAt], [[5, 6, 7], "changed", 7]);
  assert.deepEqual([life(["Ann", "Dee"]).played, life(["Ann", "Dee"]).ended], [[5, 6, 7], null], "still on");
  // Spells: the locked pairs held 5-7 (Gus & Joy going home didn't end it); the claim started another.
  const locked = tl.spells.find((s) => s.id === "s4");
  assert.deepEqual([locked.played, locked.ended, locked.endedAt], [[5, 6, 7], "swap", 7]);
});

test("the readers: a group question's choices, group slots, side stages, with their fallbacks", () => {
  const tl = TL.buildTimeline(challenge(), { cast: P });
  // A6: at episode 6's lock, the locked pairs left (sure).
  const at6 = TL.groupChoices(tl, 6);
  assert.deepEqual([at6.void, at6.sure, at6.choices.map((x) => x.members.join("+"))], [false, true, ["Ann+Dee", "Bea+Cal", "Eve+Hal"]]);
  assert.equal(TL.heldThrough(tl, at6.choices[1].id, 6).held, true);
  assert.equal(TL.heldThrough(tl, TL.groupChoices(tl, 4).choices[0].id, 4).held, false, "picked for 4, and 4 was played alone");
  // Past the last report: nothing known since 7, so not sure: void by default, the last known groups with carry-on.
  const at9 = TL.groupChoices(tl, 9);
  assert.deepEqual([at9.void, at9.sure], [true, false]);
  assert.match(at9.why.join(" "), /nothing is known since episode 7/);
  assert.equal(TL.groupChoices(tl, 9, { fallback: "carry-on" }).choices.length, 3);
  // A12 part 2b: next-stage reads as void here (where its stage ends is groupsGone's, read by the game's plan).
  assert.deepEqual(TL.groupChoices(tl, 9, { fallback: "next-stage" }), at9);
  // A10: a slot on a re-drawn pair opens after the episode that showed it and scores the next one; one shown and never
  // played (Joy & Hal) is void for the episode after (Q2); a locked pair scores until it goes home or changes.
  const slots = Object.fromEntries(TL.groupSlots(tl).map((x) => [x.members.join("+"), x]));
  assert.deepEqual([slots["Ann+Cal"].opensAfter, slots["Ann+Cal"].scores, slots["Ann+Cal"].dropsAfter], [2, [3], 3]);
  assert.deepEqual([slots["Joy+Hal"].scores, slots["Joy+Hal"].void], [[], [4]]);
  assert.deepEqual([slots["Bea+Cal"].opensAfter, slots["Bea+Cal"].scores, slots["Bea+Cal"].dropsAfter], [4, [5, 6, 7], 7]);
  assert.deepEqual([slots["Bea+Hal"].opensAfter, slots["Bea+Hal"].scores, slots["Bea+Hal"].dropsAfter], [7, [], null], "formed partway through 7: picked from 8");
  // A12: a side stage once a grouping has held 2 episodes: only the locked pairs, after 6, scoring 7, closed by the claim.
  const side = TL.sideStages(tl).filter((x) => x.opens);
  assert.deepEqual(side.map((x) => [x.spell, x.opensAfter, x.scores, x.closesAfter]), [["s4", 6, [7], 7]]);
  assert.deepEqual(TL.sideStages(tl, { after: 3 }).filter((x) => x.opens), [], "held 3 by 7, but the claim in 7 already broke it");
});

test("an unsure change moves nothing, and a contradicted answer is unsure until the next one settles it", () => {
  // Episode 2 says teams formed, but its groups don't show any: unsure, held, and the groups going into 3 aren't sure.
  const reports = [report(1, [], { playedAs: "individuals" }), report(2, [], { playedAs: "individuals", changes: [change("teams-formed", 2, "start")] })];
  const tl = TL.buildTimeline(reports);
  assert.equal(TL.at(tl, 2).sure, false);
  assert.match(TL.at(tl, 2).why.join(), /the answer says teams-formed from episode 2, but its groups don't show it/);
  assert.deepEqual(TL.stageTriggers(tl, ["teams-formed"]), { act: [], held: [{ id: "2:teams-formed", kind: "teams-formed", allNew: false, from: 2, when: "start", episode: 2, what: "teams-formed from 2" }] });
  // The Challenge 40's Episode 9: everyone plays alone from 10, the eras still listed; Episode 10 settles it.
  const eras = [g("Era 1", "Ann", "Bea"), g("Era 2", "Cal", "Dee"), g("Era 3", "Eve", "Fay")];
  const r = [report(8, eras, { playedAs: "teams" }), report(9, eras, { playedAs: "teams", changes: [change("split-into-individuals", 10, "end")] }), report(10, [], { playedAs: "individuals", changes: [change("split-into-individuals", 10, "start")] })];
  const tl2 = TL.buildTimeline(r);
  assert.equal(TL.at(tl2, 9).sure, false);
  assert.equal(TL.goingInto(tl2, 10).sure, false, "the lock for 10: unsure, so a group slot or question there takes its fallback");
  assert.deepEqual(TL.at(tl2, 10).changes.map((c) => [c.kind, c.by, c.sure]), [["split-into-individuals", "both", "high"]]);
  assert.equal(TL.at(tl2, 10).played.apart, true);
  assert.deepEqual(tl2.groups.map((x) => [x.name, x.played.join(","), x.ended, x.endedAt]), [["Era 1", "9", "split", 10], ["Era 2", "9", "split", 10], ["Era 3", "9", "split", 10]].map(([n, , e, a]) => [n, "9", e, a]));
  assert.deepEqual(TL.stageTriggers(tl2).act.map((t) => [t.kind, t.from]), [["split-into-individuals", 10]]);
  // A first answer with nothing before it can't have its changes checked.
  const tl3 = TL.buildTimeline([report(4, [p("Ann", "Bea"), p("Cal", "Dee")], { playedAs: "pairs", changes: [change("swap", 5, "end")] })]);
  assert.match(TL.at(tl3, 4).why.join(), /nothing before it to check its changes against/);
});

test("a report that's missing carries the groups on, unsure; a change announced ahead waits for its episode", () => {
  const reports = [report(1, [g("A", "Ann", "Abe"), g("B", "Bea", "Bo")], { changes: [change("merge", 4, "end")] }), { episode: 2, state: null, left: ["Abe"] }, report(3, [g("A", "Ann", "Amy"), g("B", "Bea", "Bo")])];
  const tl = TL.buildTimeline(reports);
  assert.deepEqual(TL.at(tl, 1).changes.map((c) => [c.kind, c.ahead]), [["merge", true]]);
  assert.equal(TL.at(tl, 1).sure, true, "a change for later than the next episode doesn't contradict this end");
  const e2 = TL.at(tl, 2);
  assert.deepEqual([e2.known, e2.carried, e2.sure], [false, 1, false]);
  assert.deepEqual(e2.end.groups.map((x) => x.members), [["Bea", "Bo"]], "A down to Ann when Abe left: she's on her own");
  assert.deepEqual(e2.end.alone, ["Ann"]);
  assert.match(TL.goingInto(tl, 4).why.join(), /a merge was announced for episode 4/);
  // Amy came from nowhere at 3: A is a new group (exact members), B carries on.
  assert.equal(TL.at(tl, 3).end.groups[1].id, TL.at(tl, 1).end.groups[1].id);
  assert.notEqual(TL.at(tl, 3).end.groups[0].id, TL.at(tl, 1).end.groups[0].id);
});

test("someone an answer left out, placed by the next one, fills it in; the same people together again later are a new group", () => {
  const cast = ["Ann", "Bea", "Cal", "Dee", "Eve", "Fay"];
  const r = [report(1, [g("Reds", "Ann", "Bea"), g("Blues", "Cal", "Dee", "Eve")]), report(2, [g("Reds", "Ann", "Bea", "Fay"), g("Blues", "Cal", "Dee", "Eve")])];
  const tl = TL.buildTimeline(r, { cast });
  assert.deepEqual(TL.at(tl, 1).unplaced, ["Fay"]);
  assert.equal(TL.at(tl, 2).end.groups[0].id, TL.at(tl, 1).end.groups[0].id, "Fay was always a Red: the answer filled in");
  assert.deepEqual(TL.at(tl, 2).changes, [], "and no move either");
  // Rotating pairs that meet again (Q4): the same two, three episodes apart, are two groups.
  const again = [report(1, [p("Ann", "Bea"), p("Cal", "Dee")], { playedAs: "pairs" }), report(2, [p("Ann", "Cal"), p("Bea", "Dee")], { playedAs: "pairs" }), report(3, [p("Ann", "Bea"), p("Cal", "Dee")], { playedAs: "pairs" })];
  const tl2 = TL.buildTimeline(again);
  assert.equal(tl2.groups.filter((x) => FS.keyOf(x.members) === FS.keyOf(["Ann", "Bea"])).length, 2);
});

test("a corrected report works out everything after it again, and says what moved", () => {
  const before = TL.buildTimeline(challenge(), { cast: P });
  // Episode 2's answer corrected: the pairs weren't re-drawn after all.
  const fixed = challenge();
  fixed[1] = report(2, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay"), p("Gus", "Hal")], { playedAs: "pairs" });
  const after = TL.buildTimeline(fixed, { cast: P });
  const d = TL.timelineDiff(before, after);
  assert.equal(d.from, 2, "everything from episode 2 is told again");
  assert.deepEqual(d.changes.gone, ["2:swap"], "the re-draw at 2 is gone: a stage it started is undone");
  assert.ok(d.changes.added.includes("3:swap"), "found at 3 instead, by our comparison alone");
  assert.ok(d.groups.gone.some((id) => id.startsWith("2:")), "the re-drawn pairs are gone");
  // Episode 3 now compares with 2's own pairs: everyone moved (the re-draw is found there instead), unsure (the answer
  // didn't say it), so nothing is acted on until the reports agree.
  assert.deepEqual(TL.at(after, 3).changes.map((c) => [c.kind, c.by]).sort(), [["newcomer", "both"], ["swap", "ours"]]);
  assert.equal(TL.at(after, 3).sure, false);
  assert.deepEqual(TL.timelineDiff(before, before), { from: null, changes: { gone: [], added: [], moved: [] }, groups: { gone: [], added: [], moved: [] } });
});

test("a twist or a role never moves anything; reportFrom reads a stored answer", () => {
  const tl = TL.buildTimeline([report(1, [], { playedAs: "everyone", changes: [change("twist", 1, "start"), change("role", 1, "mid")] })]);
  assert.deepEqual(TL.at(tl, 1).changes.map((c) => [c.kind, c.by, c.sure]), [["twist", "said", "high"], ["role", "said", "high"]]);
  assert.ok(TL.at(tl, 1).sure);
  assert.deepEqual(TL.stageTriggers(tl, ["twist", "role"]), { act: [], held: [] });
  assert.deepEqual(TL.MAJOR, ["teams-formed", "pairs-formed", "split-into-individuals", "merge", "swap-all"]);
  const r = TL.reportFrom(4, { merged: "no", formatState: { groups: [] }, castaways: [{ name: "Ann", leftTheGame: "yes" }, { name: "Bea", leftTheGame: "no" }] });
  assert.deepEqual(r, { episode: 4, state: { groups: [] }, left: ["Ann"], merged: "no" });
  assert.deepEqual(TL.reportFrom(5, { castaways: [] }), { episode: 5, state: null, left: [], merged: null }, "an answer from before the section");
  assert.deepEqual(TL.buildTimeline([]).episodes, []);
  // What's assumed before the first episode built (a blind replay's start) is compared with, and says so.
  const tl2 = TL.buildTimeline([report(1, [g("A", "Ann", "Abe"), g("B", "Bea", "Bo")])], { start: { after: 0, state: { groups: [g("A", "Ann", "Bea"), g("B", "Abe", "Bo")] } } });
  assert.match(TL.at(tl2, 1).why.join(), /compared with what was assumed before the first episode/);
  assert.equal(TL.buildTimeline([report(1, [g("A", "Ann", "Abe"), g("B", "Bea", "Bo")])], { start: { after: 0, state: { groups: [g("A", "Ann", "Abe"), g("B", "Bea", "Bo")] }, sure: true } }).episodes[0].sure, true);
});

// ---------- each person's group move, worked out from the section ----------

const survivorFormat = Formats.formatFor("survivor");
const challengeFormat = Formats.formatFor("challenge");
const CAST = ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn"];
const MORE = ["Eve Eno", "Fay Fox"];
const ctxFor = (format, extra = {}) => ({ showName: "Test Show", showSlug: "test", season: 1, episodeNumber: 3, castNames: CAST, terms: termsFor({}).terms, format, domains: [], ...extra });
function answer(format, formatState, edits = {}) {
  const skel = R.pasteSkeleton(ctxFor(format), []);
  skel.summary = "An episode.";
  for (const c of skel.castaways) Object.assign(c, { leftTheGame: "no", confidence: "high", sources: ["https://example.com"] }, edits[c.name] || {});
  skel.formatState = formatState;
  return skel;
}
const section = (groups) => ({ playedAs: "tribes", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "nobody", changes: [] });

test("movesFromState: named tribes move who wasn't on them, said any way; pairs, unnamed groups and an unknown state move nobody", () => {
  const going = { "Ann Able": "Reds", "Bea Bell": "reds", "Cal Cole": "Blues", "Dev Dunn": "Blues" };
  const moves = (groups, was = going) => [...FS.movesFromState(section(groups), was)];
  assert.deepEqual(moves([g("Reds", "Ann Able", "Cal Cole", "Bea Bell"), g("Blues", "Dev Dunn", "Eve Eno")]), [
    ["Ann Able", null],
    ["Cal Cole", "Reds"],
    ["Bea Bell", null],
    ["Dev Dunn", null],
    ["Eve Eno", "Blues"],
  ], "case doesn't matter; someone with no group before moves; everyone placed is spoken for");
  // "Reds Tribe" is the Reds, kept as staged: nobody moves for a name said another way.
  assert.deepEqual(moves([g("Reds Tribe", "Ann Able", "Bea Bell", "Eve Eno"), g("The Blues", "Cal Cole", "Dev Dunn")]).filter(([, to]) => to), [["Eve Eno", "Reds"]]);
  assert.deepEqual(moves([p("Ann Able", "Cal Cole"), p("Bea Bell", "Dev Dunn")]), [], "pairs");
  assert.deepEqual(moves([{ name: "Pair 1", members: ["Ann Able", "Cal Cole"] }, { name: "Pair 2", members: ["Bea Bell", "Dev Dunn"] }]), [], "named pairs");
  assert.deepEqual(moves([{ name: "Ann & Cal", members: ["Ann Able", "Cal Cole"] }, { name: "Bea & Dev", members: ["Bea Bell", "Dev Dunn"] }, { name: "Trio", members: ["Eve Eno", "Fay Fox", "Gus Gray"] }]), [], "named pairs and a trio (The Challenge 39)");
  assert.deepEqual(moves([g("Reds", "Ann Able", "Bea Bell"), g("Blues", "Cal Cole", "Dev Dunn", "Eve Eno")]).filter(([, to]) => to), [["Eve Eno", "Blues"]], "small tribes already known aren't pairs");
  assert.deepEqual(moves([p("Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn")]), [], "a merged tribe without its name");
  assert.deepEqual(moves([g("Kalo", ...CAST)]).map(([n, to]) => `${n}->${to}`), CAST.map((n) => `${n}->Kalo`), "the merge, named: everyone");
  assert.deepEqual(moves(null), []);
  assert.deepEqual([...FS.movesFromState(null, going)], []);
  assert.equal(FS.tribeKey("The New Hina Tribe"), "hina");
});

test("newGroup beside the section asks only who moved and went home; a pass about some of the cast asks everyone; old answers parse", () => {
  const person = (format) => R.jsonSchemaFor(R.researchSchemaFor(format, false), "strict").properties.castaways.items.properties;
  assert.match(person(survivorFormat).newGroup.description, /^Only for someone who moved to another tribe in this episode AND went home in it/);
  assert.match(person(R.formatForAsking(ctxFor(survivorFormat), CAST.slice(0, 2))).newGroup.description, /^Only if their tribe CHANGED in this episode/);
  assert.ok(!("newGroup" in person(Formats.formatFor("generic"))), "a format without groups never");
  assert.ok(!("newGroup" in person(R.onlyFormat(survivorFormat, ["votesReceived"]))), "nor a cut-down ask");
  const prompt = R.buildPrompt({ ...ctxFor(survivorFormat), castGroups: { "Ann Able": "Reds" } }).user;
  assert.match(prompt, /say so in formatState below;\nsomeone who moved and then went home in this same episode: the tribe they went home from, in newGroup\./);
  // An answer to an older prompt keeps its newGroup; a paste of a skeleton without it reads null.
  const old = answer(survivorFormat, undefined, { "Cal Cole": { newGroup: "Reds" } });
  delete old.formatState;
  const parsed = R.parseJsonAnswer(JSON.stringify(old), R.researchSchemaFor(survivorFormat, false), "test");
  assert.equal(parsed.castaways.find((c) => c.name === "Cal Cole").newGroup, "Reds");
  const bare = answer(survivorFormat, section(null));
  for (const c of bare.castaways) delete c.newGroup;
  assert.ok(R.parseJsonAnswer(JSON.stringify(bare), R.researchSchemaFor(survivorFormat, false), "test").castaways.every((c) => c.newGroup === null));
});

test("the review works each move out from the section, which wins over a newGroup; a leaver keeps the answer's; pairs leave it", () => {
  const going = { "Ann Able": "Reds", "Bea Bell": "Reds", "Cal Cole": "Blues", "Dev Dunn": "Blues" };
  // Cal moved to the Reds (the section); the answer's own newGroup put Bea on the Blues (wrong); Dev left after moving to the
  // Reds, so the section's groups at the end don't have him: his newGroup stands.
  const a = answer(survivorFormat, section([g("Reds", "Ann", "Bea Bell", "Cal Cole"), g("Blues", "Eve Eno", "Fay Fox")]), {
    "Bea Bell": { newGroup: "Blues" },
    "Dev Dunn": { leftTheGame: "yes", exitMethod: "Voted Out", newGroup: "Reds" },
  });
  const parsed = R.parseJsonAnswer(JSON.stringify(a), R.researchSchemaFor(survivorFormat, false), "test");
  const v = R.validateResearch(parsed, CAST, termsFor({}).terms, survivorFormat, { groups: going, episode: 3 });
  const moves = Object.fromEntries(v.entries.map((e) => [e.name, e.newGroup ?? null]));
  assert.deepEqual(moves, { "Ann Able": null, "Bea Bell": null, "Cal Cole": "Reds", "Dev Dunn": "Reds" });
  assert.ok(v.problems.some((x) => /Bea Bell: newGroup says Blues, but formatState has them on Reds/.test(x)));
  assert.deepEqual(R.candidatesFor(parsed, survivorFormat, 3).filter((c) => c.kind === "group").map((c) => `${c.castawayName}->${c.method}`).sort(), ["Cal Cole->Reds", "Dev Dunn->Reds"]);
  // The Challenge's pairs: nobody's group is a pair; whatever the answer said stays as it said it (none, here).
  const pairsAnswer = answer(challengeFormat, { ...section([p("Ann Able", "Cal Cole"), p("Bea Bell", "Dev Dunn")]), playedAs: "pairs" });
  const pp = R.parseJsonAnswer(JSON.stringify(pairsAnswer), R.researchSchemaFor(challengeFormat, false), "test");
  const pv = R.validateResearch(pp, CAST, termsFor({}).terms, challengeFormat, { groups: { "Ann Able": "Vets", "Bea Bell": "Vets", "Cal Cole": "New Threats", "Dev Dunn": "New Threats" }, episode: 3 });
  assert.ok(pv.entries.every((e) => !e.newGroup), "no tribe named after a pair");
});

test("the Tribal check never moves someone the section placed, and reads the groups going in when the change came at the end", () => {
  // Six on the Reds and the Blues; four Reds at their Tribal, Ann voted out. Then Bea and Cal swapped.
  const six = ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn", "Eve Eno", "Fay Fox"];
  const going = { "Ann Able": "Reds", "Bea Bell": "Reds", "Dev Dunn": "Reds", "Fay Fox": "Reds", "Cal Cole": "Blues", "Eve Eno": "Blues" };
  const at = (votes) => ({ attendedTribal: "yes", votesReceived: votes, votedFor: "Ann Able" });
  const build = (when) => {
    const skel = R.pasteSkeleton(ctxFor(survivorFormat, { castNames: six }), []);
    skel.summary = "An episode.";
    const edits = { "Ann Able": { ...at(3), leftTheGame: "yes", exitMethod: "Voted Out", votedFor: "Bea Bell" }, "Bea Bell": at(1), "Dev Dunn": at(0), "Fay Fox": at(0) };
    for (const c of skel.castaways) Object.assign(c, { leftTheGame: "no", confidence: "high", sources: ["https://example.com"] }, edits[c.name] || {});
    skel.formatState = { ...section([g("Reds", "Cal Cole", "Dev Dunn", "Fay Fox"), g("Blues", "Bea Bell", "Eve Eno")]), changes: [{ kind: "swap", when, from: when === "end" ? 4 : 3, what: "Bea and Cal swapped", sure: "high" }] };
    return R.parseJsonAnswer(JSON.stringify(skel), R.researchSchemaFor(survivorFormat, false), "test");
  };
  // At the end, after the vote: Bea was a Red at it, so nothing's missed, and she's on the Blues at the end.
  const v = R.validateResearch(build("end"), six, termsFor({}).terms, survivorFormat, { groups: going, episode: 3 });
  assert.ok(!v.problems.some((x) => /added a move/.test(x)), v.problems.join(" | "));
  assert.equal(v.entries.find((e) => e.name === "Bea Bell").newGroup, "Blues");
  // At the start, Bea would have been a Blue at the Reds' vote: the section still has her, and the check never moves her back.
  const v2 = R.validateResearch(build("start"), six, termsFor({}).terms, survivorFormat, { groups: going, episode: 3 });
  assert.ok(!v2.problems.some((x) => /Bea Bell was at/.test(x)), v2.problems.join(" | "));
  assert.equal(v2.entries.find((e) => e.name === "Bea Bell").newGroup, "Blues");
});

test("staging stages the moves the review worked out (a section-only answer, as research answers now)", async () => {
  const { db, pool } = fakeResearchDb({
    shows: [{ id: "show-1", slug: "survivor", name: "Survivor", format: "survivor" }],
    seasons: [{ id: "season-50", show_id: "show-1", season_number: 50 }],
    seasonCast: [...CAST, ...MORE].map((name, i) => ({ season_id: "season-50", name, tribe_name: i % 2 ? "Blues" : "Reds" })),
  });
  // Reds: Ann, Cal, Eve; Blues: Bea, Dev, Fay. Bea and Cal swap.
  const skel = R.pasteSkeleton(ctxFor(survivorFormat, { castNames: [...CAST, ...MORE] }), []);
  skel.summary = "An episode.";
  for (const c of skel.castaways) Object.assign(c, { leftTheGame: "no", confidence: "high", sources: ["https://example.com"] });
  skel.formatState = section([g("Reds", "Ann Able", "Bea Bell", "Eve Eno"), g("Blues", "Cal Cole", "Dev Dunn", "Fay Fox")]);
  await R.researchFromPaste(pool, "survivor", 50, 3, JSON.stringify(skel), { structured: true });
  assert.deepEqual(db.decisions.filter((d) => d.kind === "group").map((d) => `${d.castaway_name}->${d.method}`).sort(), ["Bea Bell->Reds", "Cal Cole->Blues"]);
  // The stored answer carries the moves as newGroup, which staging (and re-staging) reads.
  assert.equal(db.research[0].payload.castaways.find((c) => c.name === "Cal Cole").newGroup, "Blues");
  assert.equal(db.research[0].payload.castaways.find((c) => c.name === "Ann Able").newGroup, null);
});

test("the review's cases: spells end where they ended, an unsure change unsettles the play, the start at the first lock, a low split", () => {
  // A tribe whose members end up on their own ends its spell there; the next spell doesn't share its episodes.
  const r = [
    report(1, [g("X", "a", "b"), g("Y", "c", "d"), g("Z", "e", "f")]),
    report(2, [g("X", "a", "b"), g("Y", "c", "d"), g("Z", "e", "f")]),
    report(3, [g("X", "a", "b"), g("Y", "c", "d")], { alone: ["e", "f"], changes: [change("split-into-individuals", 4, "end")] }),
    report(4, [g("X", "a", "b"), g("Y", "c", "d")], { alone: ["e", "f"] }),
    report(5, [g("X", "a", "b"), g("Y", "c", "d")], { alone: ["e", "f"] }),
  ];
  const tl = TL.buildTimeline(r);
  assert.deepEqual(Object.fromEntries(tl.spells.map((s) => [s.id, s.played])), { s1: [1, 2, 3], s3: [4, 5] });
  // A swap only our comparison sees (the answer said nothing), timing unknown: the groups going in may not have played it.
  const tl2 = TL.buildTimeline([report(1, [g("A", "a", "b", "c"), g("B", "d", "e", "f")]), report(2, [g("A", "a", "b", "d"), g("B", "c", "e", "f")])]);
  assert.deepEqual(TL.at(tl2, 2).changes.map((c) => [c.kind, c.by, c.when]), [["swap", "ours", null]]);
  assert.equal(TL.at(tl2, 2).played.sure, false);
  assert.deepEqual(TL.heldThrough(tl2, TL.at(tl2, 1).end.groups[0].id, 2), { held: true, sure: false, why: [] });
  assert.deepEqual(TL.groupSlots(tl2).filter((x) => x.opensAfter === 1).map((x) => [x.scores, x.void]), [[[], [2]], [[], [2]]], "the slots void 2 rather than score it");
  // The first lock after a sure start reads it.
  const tl3 = TL.buildTimeline([report(4, [p("a", "b"), p("c", "d")], { playedAs: "pairs" })], { start: { after: 3, state: { groups: [p("a", "c"), p("b", "d")] }, sure: true } });
  assert.deepEqual([TL.goingInto(tl3, 4).known, TL.goingInto(tl3, 4).sure, TL.goingInto(tl3, 4).asOf], [true, true, 3]);
  assert.equal(TL.groupChoices(tl3, 4).choices.length, 2);
  // An episode played alone, the split said with low sureness: the play isn't sure; said high, it is.
  const lowSplit = challenge().slice(0, 4);
  lowSplit[3].state.changes.push(change("split-into-individuals", 4, "start", { sure: "low" }));
  assert.equal(TL.at(TL.buildTimeline(lowSplit), 4).played.sure, false);
  lowSplit[3].state.changes[1].sure = "high";
  assert.equal(TL.at(TL.buildTimeline(lowSplit), 4).played.sure, true);
  // Pairs joined by newcomers into trios is teams formed, not only newcomers.
  assert.deepEqual(FS.changesBetween({ groups: [p("a", "b"), p("c", "d")] }, { groups: [p("a", "b", "x"), p("c", "d", "y")] }, { newcomers: ["x", "y"] }).map((c) => c.kind), ["teams-formed", "newcomer"]);
});
