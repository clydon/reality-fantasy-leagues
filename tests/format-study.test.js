// The format study (scripts/dev-test/format-study.js, F1 of docs/PLAN-start-a-game-gpt.md; docs/STUDY-format-changes.md):
// every season's ground truth is sound, how long groups lasted, the changes our code finds by comparing one state with the
// next (and how each was brought in), and what an episode's research said about a change. No tapes, no database: the
// research here is made up in the tapes' shape. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../scripts/dev-test/format-study.js");

// A small season: four people in pairs, re-paired at the end of Episode 1, locked from Episode 3 with a claim mid-Episode 4.
function season(extra = {}) {
  return {
    show: "test",
    season: 1,
    title: "Test",
    episodes: [
      { n: 1, phase: "Rotating", play: "pairs", out: [] },
      { n: 2, phase: "Rotating", play: "pairs", out: [] },
      { n: 3, phase: "Locked", play: "pairs", out: [] },
      { n: 4, phase: "Locked", play: "pairs", out: [] },
      { n: 5, phase: "Locked", play: "pairs", out: [{ name: "Dev", how: "eliminated" }] },
      { n: 6, phase: "Final", play: "individuals", out: [{ name: "Ann", how: "won" }] },
      { n: 7, phase: "Reunion", play: "none", out: [] },
    ],
    groupings: {
      pair: {
        spells: [
          { from: [1, "start"], shown: [1, "start"], groups: [{ members: ["Ann", "Bea"] }, { members: ["Cal", "Dev"] }] },
          { from: [2, "start"], shown: [1, "end"], groups: [{ members: ["Ann", "Cal"] }, { members: ["Bea", "Dev"] }] },
          { from: [3, "start"], shown: [2, "end"], groups: [{ members: ["Ann", "Dev"] }, { members: ["Bea", "Cal"] }] },
          { from: [4, "mid"], shown: [4, "mid"], groups: [{ members: ["Ann", "Bea"] }, { members: ["Cal", "Dev"] }] },
          { from: [6, "start"], shown: [5, "end"], groups: [] },
        ],
      },
    },
    twists: [],
    ...extra,
  };
}

test("every season's ground truth is sound: episodes in order, known ways of playing and leaving, spells in order", () => {
  const all = F.fixtures();
  assert.ok(all.length >= 5, "the five studied seasons");
  for (const { show, season: n } of all) {
    const t = F.loadTimeline(show, n);
    assert.deepEqual(F.timelineProblems(t), [], `${show} ${n}`);
    assert.ok(t.source && t.source.revision, `${show} ${n} names the page revision it was read from`);
  }
  assert.deepEqual(F.timelineProblems(season()), []);
});

test("a fixture with someone in two groups, a spell out of order or a made-up exit has problems", () => {
  const t = season();
  t.groupings.pair.spells[0].groups[1].members = ["Ann", "Dev"];
  t.groupings.pair.spells.reverse();
  t.episodes[4].out[0].how = "abducted";
  const p = F.timelineProblems(t).join("; ");
  assert.match(p, /Ann is in it twice/);
  assert.match(p, /out of order/);
  assert.match(p, /abducted/);
});

test("a spell plays from its start (one shown at an episode's end from the next) until the next takes over", () => {
  const t = season();
  assert.deepEqual(F.spellEpisodes(t, "pair", 0), [1]);
  assert.deepEqual(F.spellEpisodes(t, "pair", 2), [3, 4], "a mid-episode change shares its episode");
  assert.deepEqual(F.spellEpisodes(t, "pair", 3), [4, 5]);
  assert.deepEqual(F.spellEpisodes(t, "pair", 4), [6], "no reunion");
  const four = F.groupsIn(t, "pair", 4);
  assert.deepEqual(four.map((x) => x.at), ["start", "mid"]);
});

test("how long groups lasted: a re-pairing ends them, a claim mid-episode ends them that episode, down to one is over, and re-forming is a new run", () => {
  const { groups, never } = F.lifetimes(season(), "pair");
  const by = Object.fromEntries(groups.map((g) => [g.key, g]));
  assert.deepEqual(groups.filter((g) => g.key === "Ann + Bea").map((g) => g.episodes), [[1], [4, 5]], "the same members again later are a new run");
  assert.deepEqual(by["Ann + Dev"].episodes, [3, 4]);
  assert.equal(by["Ann + Dev"].ended, "changed", "the claim mid-Episode 4");
  assert.equal(by["Ann + Cal"].ended, "changed");
  assert.equal(by["Cal + Dev"].ended, "left", "D went home and C alone isn't a pair");
  assert.deepEqual(never, []);
  const sum = F.lifetimeSummary(groups);
  assert.equal(sum.count, 8);
  assert.equal(sum.longest, 2);
});

test("a group shown but overtaken before it played is listed apart; a tribe that loses someone carries on unless exits end it", () => {
  const t = season();
  t.groupings.pair.spells.splice(2, 0, { from: [3, "start"], shown: [2, "end"], groups: [{ members: ["Ann", "Bea"] }, { members: ["Cal", "Dev"] }] });
  t.groupings.pair.spells[3].shown = [3, "start"];
  const { never } = F.lifetimes(t, "pair");
  assert.deepEqual(never, [], "A + B and C + D played elsewhere, so they aren't 'never'");
  t.groupings.pair.spells[2].groups = [{ members: ["Ann", "Cal", "Bea"] }, { members: ["Dev"] }];
  assert.deepEqual(F.lifetimes(t, "pair").never.map((x) => x.key), ["Ann + Bea + Cal"]);

  const tribes = {
    show: "test",
    season: 2,
    title: "Tribes",
    episodes: [1, 2, 3].map((n) => ({ n, phase: "Tribes", play: "tribes", out: n === 1 ? [{ name: "Ann", how: "voted out" }] : [] })),
    groupings: { tribe: { spells: [{ from: [1, "start"], shown: [1, "start"], groups: [{ name: "Red", members: ["Ann", "Bea", "Cal"] }, { name: "Blue", members: ["Dev", "Eve", "Fay"] }] }] } },
    twists: [],
  };
  const lenient = F.lifetimes(tribes, "tribe");
  assert.deepEqual(lenient.groups.find((g) => g.name === "Red").episodes, [1, 2, 3]);
  const strict = F.lifetimes(tribes, "tribe", { exitsEnd: true });
  assert.deepEqual(strict.groups.filter((g) => g.name === "Red").map((g) => g.episodes), [[1], [2, 3]]);
});

test("changes are found by comparing one state with the next: a re-pairing, a claim, a split, and when each came in", () => {
  const cs = F.changes(season());
  const at = (n) => cs.filter((c) => c.from[0] === n);
  assert.equal(at(2)[0].kind, "swap");
  assert.equal(at(2)[0].allNew, true);
  assert.equal(at(2)[0].brought, "at the end of the episode before");
  const claim = at(4)[0];
  assert.equal(claim.kind, "swap");
  assert.equal(claim.brought, "mid-episode");
  assert.deepEqual(claim.moved.sort(), ["Ann", "Bea", "Cal", "Dev"]);
  assert.equal(at(6)[0].kind, "split-into-individuals");
  assert.equal(F.broughtIn([3, "mid"], [5, "start"]), "announced ahead (Episode 3)");
  assert.equal(F.broughtIn([5, "start"], [5, "start"]), "at the start");
});

test("a merge, teams formed from no groups, a change of play with no spell behind it, and a newcomer in a leaver's place", () => {
  const t = {
    show: "test",
    season: 3,
    title: "Shapes",
    episodes: [
      { n: 1, phase: "Solo", play: "individuals", out: [{ name: "Bea", how: "quit" }] },
      { n: 2, phase: "Teams", play: "teams", out: [], in: [{ name: "Zed", how: "replacement" }] },
      { n: 3, phase: "Teams", play: "teams", out: [] },
      { n: 4, phase: "Merged", play: "individuals", out: [] },
    ],
    groupings: {
      team: {
        spells: [
          { from: [1, "start"], shown: [1, "start"], groups: [] },
          { from: [2, "start"], shown: [1, "end"], groups: [{ name: "Red", members: ["Ann", "Cal"] }, { name: "Blue", members: ["Dev", "Eve"] }] },
          { from: [2, "mid"], shown: [2, "mid"], groups: [{ name: "Red", members: ["Ann", "Cal", "Zed"] }, { name: "Blue", members: ["Dev", "Eve"] }] },
          { from: [4, "start"], shown: [4, "start"], groups: [{ name: "All", members: ["Ann", "Cal", "Dev", "Eve", "Zed"] }] },
        ],
      },
    },
    twists: [{ kind: "twist", from: [3, "start"], shown: [2, "end"], what: "Double points", words: ["double"] }],
  };
  const kinds = F.changes(t).map((c) => `${c.from[0]}:${c.kind}`);
  assert.deepEqual(kinds, ["2:teams-formed", "2:newcomer", "3:twist", "4:merge"]);

  const eras = {
    show: "test",
    season: 4,
    title: "Eras",
    episodes: [
      { n: 1, phase: "Solo", play: "individuals", out: [] },
      { n: 2, phase: "Teams", play: "teams", out: [], playShown: [1, "end"] },
      { n: 3, phase: "Solo", play: "individuals", out: [], playShown: [2, "end"] },
    ],
    groupings: { era: { spells: [{ from: [1, "start"], shown: [1, "start"], groups: [{ name: "Old", members: ["Ann", "Bea"] }, { name: "New", members: ["Cal", "Dev"] }] }] } },
    twists: [],
  };
  const cs = F.changes(eras);
  assert.deepEqual(cs.map((c) => `${c.from[0]}:${c.kind}:${c.brought}`), ["2:teams-formed:at the end of the episode before", "3:split-into-individuals:at the end of the episode before"]);
});

test("what research said: a pairing named only in notes is free text, newGroup is acted on, late is late, and nothing is nothing", () => {
  const t = season();
  const swap = F.changes(t).find((c) => c.from[0] === 2);
  const notes = { 1: { summary: "New partners were chosen.", castaways: [{ name: "Ann", notableTwist: "Re-paired with Cal at the end." }, { name: "Bea", notableTwist: null }] } };
  const free = F.researchSays(t, swap, notes);
  assert.equal(free.verdict, "free text only");
  const nt = free.found[0].text.find((x) => x.field === "notableTwist");
  assert.deepEqual([nt.groupsNamed, nt.of], [1, 2]);
  assert.ok(free.found[0].text.some((x) => x.field === "summary"));

  const structured = { 1: { summary: "", castaways: [{ name: "Ann", newGroup: "Pair 1" }, { name: "Cal", newGroup: "Pair 1" }] } };
  assert.equal(F.researchSays(t, swap, structured).verdict, "acted on");
  assert.equal(F.researchSays(t, swap, { 3: structured[1] }).verdict, "acted on late");
  assert.equal(F.researchSays(t, swap, { 1: { summary: "Ann won.", castaways: [] } }).verdict, "nothing");
  assert.equal(F.researchSays(t, swap, {}).verdict, "not on tape");
});

test("a twist is looked for by its own words, hyphens or not, and a recruit by research's role fields", () => {
  const t = season({
    twists: [
      { kind: "twist", from: [2, "mid"], shown: [2, "mid"], what: "A murder in plain sight", words: ["plain sight"] },
      { kind: "role", from: [3, "start"], shown: [2, "end"], what: "A recruit", words: ["recruit"] },
    ],
  });
  const cs = F.changes(t);
  const sight = cs.find((c) => c.what === "A murder in plain sight");
  assert.equal(F.researchSays(t, sight, { 2: { rulesNote: "It introduces a murder-in-plain-sight task.", castaways: [] } }).verdict, "free text only");
  const recruit = cs.find((c) => c.kind === "role");
  assert.equal(F.researchSays(t, recruit, { 3: { castaways: [{ name: "Bea", recruitedAsTraitor: "yes" }] } }).verdict, "acted on");
});

test("the review's cases: a stray newGroup, a group's whole name, a shrunken tribe kept mid-episode, an alone move, a late newcomer", () => {
  const t = season({ twists: [{ kind: "twist", from: [2, "mid"], shown: [2, "mid"], what: "Double points", words: ["double"] }] });
  const cs = F.changes(t);
  const twist = cs.find((c) => c.kind === "twist");
  const stray = { 2: { castaways: [{ name: "Ann", newGroup: "Red" }] } };
  assert.equal(F.researchSays(t, twist, stray).verdict, "nothing", "a newGroup isn't a twist's report");
  const swap = cs.find((c) => c.from[0] === 2);
  const someoneElse = { 1: { castaways: [{ name: "Zed", newGroup: "Red" }] } };
  assert.equal(F.researchSays(t, swap, someoneElse).verdict, "nothing", "only on someone the change moved");

  const tribes = {
    show: "test",
    season: 5,
    title: "Shrinking",
    episodes: [1, 2, 3].map((n) => ({ n, phase: "Tribes", play: "tribes", out: n === 1 ? [{ name: "Ann", how: "voted out" }] : [] })),
    groupings: {
      tribe: {
        spells: [
          { from: [1, "start"], shown: [1, "start"], groups: [{ name: "New Threats", members: ["Ann", "Bea", "Cal"] }, { name: "Blue", members: ["Dev", "Eve"] }] },
          { from: [3, "mid"], shown: [3, "mid"], groups: [{ name: "New Threats", members: ["Bea", "Cal"] }, { name: "Blue", members: ["Dev", "Eve", "Fay"] }], alone: [] },
        ],
      },
    },
    twists: [],
  };
  tribes.episodes[2].in = [{ name: "Fay", how: "replacement" }];
  const red = F.lifetimes(tribes, "tribe").groups.find((g) => g.name === "New Threats");
  assert.deepEqual([red.episodes, red.ended], [[1, 2, 3], "season"], "down a member and kept by the mid-episode spell: not changed");
  const fay = F.changes(tribes).find((c) => c.kind === "newcomer");
  assert.deepEqual(fay.newcomers, ["Fay"]);
  const named = F.researchSays(tribes, fay, { 3: { castaways: [{ name: "Dev", notableTwist: "A new face joined." }] } });
  assert.ok(!named.found.some((f) => f.text.some((x) => x.field === "notableTwist" && x.groupsNamed)), "'new' doesn't name New Threats");

  const late = season();
  late.episodes[1].in = [{ name: "Zed", how: "replacement" }];
  late.groupings.pair.spells[1].alone = ["Zed"];
  late.groupings.pair.spells[2].groups = [{ members: ["Ann", "Dev"] }, { members: ["Bea", "Zed"] }];
  late.groupings.pair.spells[2].alone = ["Cal"];
  const three = F.changes(late).find((c) => c.from[0] === 3);
  assert.equal(three.kind, "swap");
  assert.ok(three.moved.includes("Zed") && three.moved.includes("Cal"), "alone to a group, and a group to alone, are moves");
  assert.ok(!F.changes(late).some((c) => c.kind === "newcomer" && c.from[0] === 3), "Zed came in at 2: not new at 3");
});

test("a malformed fixture is reported, not thrown on; other files in the folder are skipped", () => {
  const t = season();
  t.groupings.pair.spells[1].from = 3;
  t.groupings.pair.spells[2].shown = [2, "later"];
  t.twists = [{ kind: "twist", what: "No from" }];
  const p = F.timelineProblems(t).join("; ");
  assert.match(p, /spell 1: from must be/);
  assert.match(p, /spell 2: shown must be/);
  assert.match(p, /twist No from: from and shown/);
  assert.deepEqual(F.timelineProblems({ show: "x", season: 1 }), ["no episodes"]);

  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "format-study-"));
  try {
    fs.writeFileSync(path.join(dir, "test-1.json"), JSON.stringify(season()));
    fs.writeFileSync(path.join(dir, "notes.json"), "{}");
    assert.deepEqual(F.fixtures(dir), [{ show: "test", season: 1 }]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the state at an episode's end (what F2's answers are scored against): known by then, those still in", () => {
  const c41 = F.loadTimeline("the-challenge", 41);
  const pairsAt = (n) => F.stateAtEnd(c41, "pair", n).groups.map((g) => g.members.join(" + "));
  assert.ok(pairsAt(4).includes("Cara Maria Sorbello + Leonardo Dionicio"), "shown at Episode 4's end, overtaken at 5's start");
  assert.ok(!pairsAt(5).includes("Jonna Mannion + Leonardo Dionicio"), "Episode 6's pairs, not 5's");
  assert.ok(pairsAt(7).includes("Dee Valladares + Theo Campbell"));
  assert.deepEqual(F.stateAtEnd(c41, "pair", 7).alone, ["Will Gagnon"]);
  assert.equal(pairsAt(8).length, 11, "nothing said at Episode 8's end: its pairs, less Derek's (the individual Episode 9 is shown at its start)");
  assert.deepEqual(F.stateAtEnd(c41, "pair", 8).alone, ["Aviv Melmed", "Theo Campbell"]);
  assert.deepEqual(F.groupsIn(c41, "pair", 9)[0].groups, []);
  assert.equal(pairsAt(9).length, 12, "the Lock In at Episode 9's end");
  assert.ok(pairsAt(16).includes("Olivia Kaiser + Yeremi Hykel") && !pairsAt(16).some((p) => p.includes("Aviv")), "the claim, and Aviv & Will went home");
  assert.equal(pairsAt(10).length, 11, "CT & Tay went home in Episode 10");

  const s49 = F.loadTimeline("survivor", 49);
  const tribes = (n) => F.stateAtEnd(s49, "tribe", n).groups.map((g) => `${g.name} ${g.members.length}`);
  assert.deepEqual(tribes(3), ["Hina 6", "Kele 2", "Uli 6"], "the swap is shown at Episode 4's start, not 3's end");
  assert.deepEqual(tribes(4), ["Hina 6", "Kele 7"]);
  assert.deepEqual(tribes(7), ["Lewatu 10"]);
});

test("the studied seasons: how long their groups lasted (what the builder can tell a maker up front)", () => {
  const c41 = F.lifetimes(F.loadTimeline("the-challenge", 41), "pair");
  const s41 = F.lifetimeSummary(c41.groups);
  assert.equal(s41.count, 126);
  assert.equal(s41.by[1], 114, "every rotating pair lasted one episode");
  assert.equal(s41.longest, 10, "three locked pairs lasted to the end");
  assert.deepEqual(c41.never.map((x) => x.key), ["Cara Maria Sorbello + Leonardo Dionicio", "Dee Valladares + Theo Campbell"]);

  const c39 = F.lifetimeSummary(F.lifetimes(F.loadTimeline("the-challenge", 39), "team").groups);
  assert.equal(c39.longest, 1, "Battle for a New Champion drew new pairs or teams every episode");

  const s49 = F.lifetimes(F.loadTimeline("survivor", 49), "tribe").groups;
  assert.equal(Math.max(...s49.filter((g) => g.name !== "Lewatu").map((g) => g.episodes.length)), 3);

  const c40 = F.lifetimes(F.loadTimeline("the-challenge", 40), "era").groups;
  assert.equal(c40.length, 4, "the eras never changed members");

  const kinds = F.changes(F.loadTimeline("the-challenge", 41)).map((c) => c.kind);
  assert.equal(kinds.filter((k) => k === "swap").length, 9, "seven re-pairings, Theo's MRI and the claim");
  assert.ok(kinds.includes("split-into-individuals") && kinds.includes("pairs-formed") && kinds.includes("newcomer"));
});
