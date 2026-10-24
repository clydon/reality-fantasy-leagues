// The rulebook research prompt and its review (src/lib/game/formats/rulebook-research.js): the prompt carries the
// whole schema, and the review keeps every row, puts each problem on it, tidies only what doesn't change meaning,
// and keeps results out (a rulebook is read before anyone has watched). The answers here are made up; real ones
// come from scripts/dev-test/check-rulebook-prompt.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../src/lib/game/formats/rulebook-research.js");
const { OPT } = require("../src/lib/game/formats/rulebook-schema.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");

const clone = (x) => JSON.parse(JSON.stringify(x));
const at = (list) => list.map((x) => `${x.at}: ${x.message}`);

test("the prompt carries every choice and its help, the rules, and only what was asked for", () => {
  const p = R.buildRulebookPrompt({ show: "Survivor", season: "Season 50" });
  for (const [key, opts] of Object.entries(OPT)) {
    for (const [value, label, help] of opts) {
      if (key === "groupType" && value === "none") continue; // the data says groups: null
      assert.ok(p.includes(`${value}: ${label}${help ? `. ${help}` : ""}`), `${key}.${value} with its help`);
    }
  }
  assert.match(p, /^Describe how Survivor, Season 50 works/);
  assert.match(p, /No names and no results, anywhere/);
  assert.match(p, /"phaseStarts"/);
  assert.doesNotMatch(p, /still airing/, "a past season");
  assert.match(R.buildRulebookPrompt({ show: "Survivor", season: "Season 51", airing: true }), /This season is still airing/);
  const withTemplate = R.buildRulebookPrompt({ show: "The Challenge", template: BUILT_IN_BLOCKS.survivor.blocks });
  assert.match(withTemplate, /Start from this rulebook of a similar show/);
  assert.ok(withTemplate.includes('"tribalCouncil"'), "the template's blocks");
});

test("the answer's JSON, with chatter and fences around it", () => {
  assert.deepEqual(R.parseRulebookAnswer('Here you go:\n```json\n{ "kind": "talk" }\n```\nEnjoy!'), { kind: "talk" });
  assert.throws(() => R.parseRulebookAnswer("Sorry, I can't."), /no JSON object/);
  assert.throws(() => R.parseRulebookAnswer('{ "kind": "talk", }'), /doesn't parse/);
});

// An answer the way a chat writes one: names for ids, references by name, a few slips.
const answer = () => ({
  schema: 1, kind: "competition", show: "Island Game",
  cast: { unit: "people", singular: "islander", plural: "islanders", usualSize: 16, groups: { type: "sides", singular: "camp", change: "atPhases" } },
  season: {
    phases: [
      { name: "Camps", starts: { type: "episode", n: 1 }, changes: [] },
      { name: "The Swap", starts: { type: "episode", n: 4 }, changes: "groupsReshuffle" },
      { name: "Merged", starts: { type: "remaining", n: 10 }, changes: ["groupsEnd", "juryStarts"] },
    ],
    finale: { decidedBy: "juryVote", finalists: 2 },
  },
  segments: [
    { name: "Camp Life", decidedBy: "nobody", takesPart: "everyone", often: "everyEpisode" },
    { name: "Immunity Duel", decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "safety", often: "everyEpisode" },
    { name: "Council", decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome", often: "everyEpisode" },
    { name: "Final Council", decidedBy: "vote", voters: "jury", takesPart: "everyone", onTheLine: "nothing", often: "onePhase", phase: "finale" },
  ],
  waysOut: [
    { name: "Voted out", means: "out", cause: "Council" },
    { name: "Left", means: "out", cause: "ownChoice" },
    { name: "Champion", means: "winner" },
  ],
  twists: [{ name: "Totems", type: "advantage", oneIsCalled: "a totem", gotBy: "found", does: "keepsSafe", lasts: "untilPlayed" }],
  customMoments: [
    { label: "Won the Immunity Duel", counted: "yesNo", answeredBy: "research" },
    { label: "Received a jury vote", during: { segment: "Final Council" }, counted: "eachTime", answeredBy: "research" },
    { label: "Got in a fight", during: { segment: "Camp Life" }, counted: "yesNo", answeredBy: "league", reliability: "patchy" },
  ],
  points: { gotInAFight: 1 },
  leftOut: [],
  phaseStarts: { "The Swap": 4, merged: 9, nowhere: 3 },
});

test("the review tidies what doesn't change meaning, and says so", () => {
  const r = R.reviewRulebook(answer());
  assert.deepEqual(r.problems, [], "nothing left to fix");
  assert.equal(r.approvable, true);
  const b = r.blocks;
  assert.deepEqual(b.segments.map((s) => s.id), ["campLife", "immunityDuel", "council"], "ids made from names; the finale's jury vote left out");
  assert.deepEqual(b.waysOut[0].cause, { segment: "council" }, "a cause given by name");
  assert.equal(b.segments[0].takesPart, undefined, "who takes part doesn't go with nobody");
  assert.deepEqual(b.twists[0].does, ["keepsSafe"], "a list given as one value");
  assert.deepEqual(b.season.phases[1].changes, ["groupsReshuffle"]);
  assert.deepEqual(b.customMoments.map((m) => m.id), ["gotInAFight"], "repeats of built moments left out");
  assert.deepEqual(b.customMoments[0].during, { segment: "campLife" }, "where it happens, by name");
  assert.deepEqual(r.phaseStarts, { theSwap: 4, merged: 9 }, "season data, by phase id");
  assert.equal(b.phaseStarts, undefined, "not part of the blocks");
  assert.deepEqual(b.season.phases[1].starts, { type: "announced" }, "a swap the show decided: never its episode in the rulebook");
  assert.deepEqual(b.season.phases[0].starts, { type: "episode", n: 1 }, "the first episode stays");
  const w = at(r.warnings).join("\n");
  assert.match(w, /Final Council: left out, the finale's jury vote/);
  assert.match(w, /Won the Immunity Duel: left out, already built as "Won the Immunity Duel"/);
  assert.match(w, /Received a jury vote: left out, already built as "Each jury vote received"/);
  assert.match(w, /phaseStarts\.nowhere: Left out/);
  assert.match(w, /The Swap: when the show says so \(it started in episode 4: season data\)/);
});

test("a bad answer keeps its rows, each problem on its row", () => {
  const a = answer();
  a.segments[2].voters = "theStudioAudience";
  a.waysOut.push({ name: "Exploded", means: "kaboom" });
  const r = R.reviewRulebook(a);
  assert.equal(r.approvable, false);
  assert.deepEqual(at(r.problems), [
    "segments[council].voters: Council: who votes isn't one of the choices",
    "waysOut[exploded].means: Exploded: what it means isn't one of the choices",
  ]);
  assert.equal(r.blocks.waysOut.length, 4, "the bad row is kept");
});

test("no results: a cast member's name is a problem, a sentence about an episode a warning", () => {
  const a = answer();
  a.segments[1].summary = "In episode 3 the camps merged early.";
  a.twists[0].summary = "Pat Example found one on day two.";
  a.leftOut = ["The premiere ended with a quit."];
  const r = R.reviewRulebook(a, { castNames: ["Pat Example", "Jo Q"] });
  assert.deepEqual(at(r.problems), ["twists[totems].summary: Names Pat Example: a rulebook can't say what happened to anyone"]);
  const about = r.warnings.filter((x) => /happened in an episode/.test(x.message)).map((x) => x.at);
  assert.deepEqual(about, ["segments[immunityDuel].summary", "leftOut[0]"]);
  const surname = R.reviewRulebook({ ...answer(), premise: "Everyone fears Example." }, { castNames: ["Pat Example"] });
  assert.match(at(surname.problems).join(), /premise: Names Example/, "a surname alone");
  assert.equal(R.reviewRulebook(answer(), { castNames: ["Al"] }).problems.length, 0, "short names aren't matched inside words");
});

test("a segment that sends someone home with no way out it causes is flagged", () => {
  const a = answer();
  a.waysOut[0].cause = "ownChoice";
  assert.match(at(R.reviewRulebook(a).warnings).join("\n"), /segments\[council\]: Council sends someone home, but no way out says it's the cause/);
});
