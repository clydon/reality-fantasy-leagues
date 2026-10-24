// A rulebook compiled to the engine's format data (src/lib/game/formats/rulebook-compile.js): every built-in, sample
// and stored-format rulebook compiles to a format the engine takes, the built-ins to their own event ids and exit
// methods, and a compiled format stages the results research answers imply through the app's own pipeline
// (db/episode-research.js candidatesFor). The legacy freeze's golden scoring tests are R2's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");
const { compileRulebook, formatForRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { rulebookFor, BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const ER = require("../db/episode-research.js");
const SAMPLES = require("./fixtures/rulebook-samples.js");
const STORED = require("./fixtures/stored-formats.json");

const sorted = (xs) => [...xs].sort();

test("every rulebook compiles to a format the engine takes", () => {
  const all = [
    ...Object.entries(BUILT_IN_BLOCKS).map(([id, r]) => [id, r.blocks, r.aliases]),
    ...Object.entries(SAMPLES).map(([id, b]) => [id, b, {}]),
    ...Object.entries(STORED).map(([id, d]) => [id, rulebookFor(id, d).blocks, rulebookFor(id, d).aliases]),
  ];
  for (const [id, blocks, aliases] of all) {
    const { data, problems } = compileRulebook(blocks, { aliases });
    assert.deepEqual(problems, [], id);
    assert.doesNotThrow(() => formatForRulebook(data), id);
    assert.equal(formatForRulebook(data), formatForRulebook(data), `${id}: built once`);
  }
});

test("a built-in compiles to its own event ids and exit methods", () => {
  for (const id of ["survivor", "traitors", "challenge"]) {
    const { blocks, aliases } = BUILT_IN_BLOCKS[id];
    const { data } = compileRulebook(blocks, { aliases });
    const legacy = Formats.FORMATS[id].data;
    assert.deepEqual(sorted(data.events.map((e) => e.id)), sorted(legacy.events.map((e) => e.id)), id);
    assert.deepEqual(sorted(data.exitMethods), sorted(legacy.exitMethods), id);
    assert.equal(data.winnerExitMethod, legacy.winnerExitMethod, id);
    assert.equal(data.hasGroups, legacy.hasGroups, id);
  }
});

test("a show nobody wins is a valid format; one that forgot its winner isn't", () => {
  const { data } = compileRulebook(SAMPLES.belowDeck);
  assert.equal(data.winnerExitMethod, null);
  assert.deepEqual(formatProblems(data), []);
  assert.match(formatProblems({ ...data, winnerExitMethod: undefined }).join(), /winnerExitMethod: not one of the exit methods/);
});

test("a talk show's moments are about the night: episode answers, nothing awarded to anyone", () => {
  const { data } = compileRulebook(SAMPLES.snl);
  assert.deepEqual(data.exitMethods, ["Other"]);
  assert.deepEqual(data.research.episodeFields.map((f) => f.key), ["hostSings", "breaksCharacter", "recurringCharacter", "surpriseCameo", "guestInSketch", "flubbedLine"]);
  assert.deepEqual(data.research.episodeFields[1], { key: "breaksCharacter", type: "answer", description: "Did it happen tonight: someone breaks character?", note: "someone breaks character" });
  assert.deepEqual(data.rules.research, []);
});

// One made-up Survivor-like episode, staged through the app's own pipeline.
test("a compiled rulebook stages what research answers imply", () => {
  const { data } = compileRulebook(BUILT_IN_BLOCKS.survivor.blocks, { aliases: BUILT_IN_BLOCKS.survivor.aliases });
  const format = formatForRulebook(data);
  const person = (name, answers) => ({ name, leftTheGame: "no", exitMethod: null, sources: ["https://example.invalid"], confidence: "high", ...answers });
  const payload = {
    castaways: [
      person("Ann Example", { immunityChallengeWon: "yes", tribalCouncilAttended: "yes", tribalCouncilVotesReceived: 0, tribalCouncilVotedFor: "Cy Example" }),
      person("Bo Example", { tribalCouncilAttended: "yes", tribalCouncilVotesReceived: 2, tribalCouncilVotedFor: "Ann Example" }),
      person("Cy Example", { leftTheGame: "yes", exitMethod: "Voted Out", tribalCouncilAttended: "yes", tribalCouncilVotesReceived: 5, tribalCouncilVotedFor: "Bo Example" }),
    ],
  };
  const staged = ER.candidatesFor(payload, format, 4).map((i) => `${i.castawayName}: ${i.kind === "elimination" ? `out (${i.method})` : i.eventType}`);
  assert.deepEqual(sorted(staged), sorted([
    "Ann Example: individualImmunity",
    "Ann Example: zeroVotesSafe",
    "Ann Example: votedWithMajority",
    "Bo Example: survivedVotes",
    "Bo Example: votedAgainstMajority",
    "Cy Example: out (Voted Out)",
    "Cy Example: votedAgainstMajority",
  ]));
});
