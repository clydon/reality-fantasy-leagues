// A rulebook compiled to the engine's format data (src/lib/game/formats/rulebook-compile.js): every built-in, sample
// and stored-format rulebook compiles to a format the engine takes, the built-ins to their own event ids and exit
// methods, and a compiled format stages the results research answers imply through the app's own pipeline
// (db/episode-research.js candidatesFor). Then what the blocks alone build (docs/PLAN-rulebooks-implementation.md
// T-12...T-26): counts scored per unit, whole or not; secret roles; phase gating; every segment's answers; and every
// kind of show played through ten episodes, winner or none. The legacy freeze's golden tests are
// tests/rulebook-golden.test.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { z } = require("zod");
const Formats = require("../src/lib/game/formats/index.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");
const { compileRulebook, formatForRulebook, phaseRanges } = require("../src/lib/game/formats/rulebook-compile.js");
const { rulebookFor, BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { OPT, blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");
const ER = require("../db/episode-research.js");
const S = require("../src/lib/game/state-logic.js");
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

// One made-up Survivor-like episode, staged through the app's own pipeline: answered under the keys research has always
// stored them by (the question map), and whoever was voted out isn't scored for how they voted.
test("a compiled rulebook stages what research answers imply", () => {
  const { data } = compileRulebook(BUILT_IN_BLOCKS.survivor.blocks, { aliases: BUILT_IN_BLOCKS.survivor.aliases });
  const format = formatForRulebook(data);
  const person = (name, answers) => ({ name, leftTheGame: "no", exitMethod: null, sources: ["https://example.invalid"], confidence: "high", ...answers });
  const payload = {
    castaways: [
      person("Ann Example", { wonIndividualImmunity: "yes", attendedTribal: "yes", votesReceived: 0, votedFor: "Cy Example" }),
      person("Bo Example", { attendedTribal: "yes", votesReceived: 2, votedFor: "Ann Example" }),
      person("Cy Example", { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5, votedFor: "Bo Example" }),
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
  ]));
});

// ---------- what the blocks alone build ----------

const values = (key) => OPT[key].map((o) => o[0]);
const clone = (x) => JSON.parse(JSON.stringify(x));
const person = (name, answers) => ({ name, leftTheGame: "no", exitMethod: null, sources: ["https://example.invalid"], confidence: "high", ...answers });
const staged = (format, castaways, episode = 1) =>
  ER.candidatesFor({ castaways }, format, episode).map((i) => [
    i.castawayName,
    i.kind === "elimination" ? `out (${i.method})` : i.kind === "role" ? `role ${i.method}` : i.eventType,
    ...(i.units != null ? [i.units] : []),
  ]);
/** A league playing a compiled rulebook, its cast added. */
function league(data, names = ["Ann Example", "Bo Example", "Cy Example"], reader = "research") {
  const s = S.defaultState();
  s.settings.rulebook = { data, reader };
  S.applyCastImport(s, { castaways: names.map((name) => ({ name })) });
  return s;
}
const castaway = (s, name) => s.castaways.find((c) => c.name === name);

test("a count scores once per unit, whole or not (T-25)", () => {
  const { data, problems } = compileRulebook(LIBRARY["world-series"].blocks, { id: "world-series" });
  assert.deepEqual(problems, []);
  const field = (key) => data.research.checklist.find((f) => f.key === key);
  assert.deepEqual([field("homeRun").type, field("inningsPitched").type], ["integer", "number"], "each time is whole; an amount needn't be");
  assert.match(field("inningsPitched").description, /6⅔ is 6\.67, never a shorthand like 6\.2/);
  const format = formatForRulebook(data);
  const shape = format.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])).shape;
  assert.ok(shape.inningsPitched.safeParse(6.67).success && !shape.homeRun.safeParse(2.5).success, "the answer's own type");

  const counted = (rows) => rows.filter(([, e]) => e === "homeRun" || e === "inningsPitched");
  assert.deepEqual(counted(staged(format, [
    person("Ann Example", { homeRun: 3, inningsPitched: 6.67 }),
    person("Bo Example", { homeRun: 0, inningsPitched: null }),
    person("Cy Example", { homeRun: 2.5, inningsPitched: "six" }),
  ])), [["Ann Example", "homeRun", 3], ["Ann Example", "inningsPitched", 6.67]], "one result carrying the count; nothing for 0, unknown or a fraction of a whole count");

  const s = league(data);
  const ep = S.ensureEpisodeNumber(s, 1, false);
  const ann = castaway(s, "Ann Example");
  const homeRuns = S.ActiveRosterLogic.addEvent(s, ep.id, "homeRun", ann.id, 3);
  const innings = S.ActiveRosterLogic.addEvent(s, ep.id, "inningsPitched", ann.id, 6.67);
  assert.deepEqual([homeRuns.units, S.ActiveRosterLogic.eventPoints(s, homeRuns), S.ActiveRosterLogic.eventPoints(s, innings)], [3, 15, 6.67], "points times units");
  S.ActiveRosterLogic.setEventUnits(s, ep.id, homeRuns.id, 1);
  assert.deepEqual([homeRuns.units, S.ActiveRosterLogic.eventPoints(s, homeRuns)], [undefined, 5], "one unit is the event's own points");
  assert.equal(S.ActiveRosterLogic.addEvent(s, ep.id, "hit", ann.id, 1).units, undefined, "a single one carries nothing");
});

test("per in the rule language: a count question, and how it reads", () => {
  const Rules = require("../src/lib/game/formats/rules.js");
  const { data } = compileRulebook(LIBRARY["world-series"].blocks, { id: "world-series" });
  const rule = (r) => Rules.rulesProblems({ research: [r], implied: [] }, data).join("; ");
  assert.equal(rule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", per: "homeRun" }), "");
  assert.match(rule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", per: "completeGame" }), /per: completeGame is answer; a count is integer or number/);
  assert.match(rule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", per: "nope" }), /per: no checklist question "nope"/);
  assert.equal(Rules.describeRule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", per: "homeRun" }, data), "When home run is more than 0 → Hit a home run, once per home run");
  assert.equal(Rules.describeRule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", fromEpisode: 3, untilEpisode: 7 }, data), "When home run is more than 0 → Hit a home run (episodes 3 to 7)");
  assert.match(rule({ when: { answer: "homeRun", greaterThan: 0 }, award: "homeRun", fromEpisode: 5, untilEpisode: 4 }), /untilEpisode: before its fromEpisode/);
});

test("secret roles in a rulebook nobody hand-wrote score votes by role like The Traitors' own (T-26)", () => {
  const { blocks } = BUILT_IN_BLOCKS.traitors;
  const { data, problems } = compileRulebook(blocks);
  assert.deepEqual(problems, []);
  assert.deepEqual(data.roles, { default: "Faithful", values: ["Traitor", "Recruited Traitor"], becomes: { "Recruited Traitor": "Traitor" } });
  const format = formatForRulebook(data);
  assert.equal(format.roles.roleFor("Recruited Traitor"), "Traitor");
  const at = (votes, votedFor) => ({ roundTableAttended: "yes", roundTableVotesReceived: votes, roundTableVotedFor: votedFor });
  const ours = staged(format, [
    person("Ann Example", { isTraitor: "no", ...at(0, "Cy Example") }),
    person("Bo Example", { isTraitor: "yes", ...at(1, "Cy Example") }),
    person("Cy Example", { isTraitor: "yes", leftTheGame: "yes", exitMethod: "Banished as a Traitor", ...at(2, "Ann Example") }),
    person("Di Example", { isTraitor: "yes", recruitedAsTraitor: "yes", ...at(0, "Ed Example") }),
    person("Ed Example", { isTraitor: "no", leftTheGame: "yes", exitMethod: "Banished as a Faithful", ...at(1, "Di Example") }),
    person("Fa Example", { becameTraitor: "yes" }),
  ]);
  assert.deepEqual(sorted(ours.map((r) => r.join(": "))), sorted([
    "Ann Example: traitorsCaughtAtRoundTable", "Ann Example: roundTableZeroVotes",
    "Bo Example: roundTableSurvivedVotes",
    "Cy Example: out (Banished as a Traitor)",
    "Di Example: role Recruited Traitor", "Di Example: traitorsFooledAtRoundTable", "Di Example: roundTableZeroVotes",
    "Ed Example: out (Banished as a Faithful)",
    "Fa Example: role Traitor",
  ]));
  // The same Round Table through traitors.js: the same people caught a Traitor and fooled the table.
  const legacy = staged(Formats.FORMATS.traitors, [
    person("Ann Example", { isTraitor: "no", attendedRoundTable: "yes", votesReceived: 0, votedFor: ["Cy Example"] }),
    person("Bo Example", { isTraitor: "yes", attendedRoundTable: "yes", votesReceived: 1, votedFor: ["Cy Example"] }),
    person("Cy Example", { isTraitor: "yes", leftTheGame: "yes", exitMethod: "Banished", votedFor: ["Ann Example"] }),
    person("Di Example", { isTraitor: "yes", recruitedAsTraitor: "yes", votedFor: ["Ed Example"] }),
    person("Ed Example", { isTraitor: "no", leftTheGame: "yes", exitMethod: "Banished", votedFor: ["Di Example"] }),
  ]);
  const who = (rows, ev) => rows.filter(([, e]) => e === ev).map(([n]) => n);
  assert.deepEqual(who(ours, "traitorsCaughtAtRoundTable"), who(legacy, "votedOutTraitor"));
  assert.deepEqual(who(ours, "traitorsFooledAtRoundTable"), who(legacy, "traitorVotedOutFaithful"));

  // Recruitment scores from the role recorded; a league reads the recruit as a Traitor.
  assert.deepEqual(format.impliedEvents({ number: 3, events: [], exiled: [], roles: [{ castawayId: "d", role: "Recruited Traitor" }] }, {}), [{ type: "traitorsRecruited", castawayId: "d" }]);
  const s = league(data, ["Di Example"]);
  const ep = S.ensureEpisodeNumber(s, 3, false);
  S.addRole(s, ep.id, castaway(s, "Di Example").id, "Recruited Traitor");
  assert.deepEqual([S.roleOf(s, castaway(s, "Di Example").id, 2), S.roleOf(s, castaway(s, "Di Example").id, 3)], ["Faithful", "Traitor"]);

  // Revealed at the finale: reaching it as the secret role scores, by the role as of then.
  const mole = compileRulebook({ ...clone(SAMPLES.amazingRace), twists: [{ id: "mole", type: "secretRole", name: "The Mole", roles: ["Mole", "Player"], revealed: "atFinale", canSwitch: "never" }] });
  assert.deepEqual(mole.problems, []);
  const finale = { number: 12, events: [{ castawayId: "m", method: "Won the race" }], exiled: [], roles: [] };
  const moleFormat = formatForRulebook(mole.data);
  assert.ok(moleFormat.impliedEvents(finale, { roleOf: () => "Mole" }).some((e) => e.type === "moleMadeFinale"));
  assert.ok(!moleFormat.impliedEvents(finale, { roleOf: () => "Player" }).some((e) => e.type === "moleMadeFinale"));
});

// Teams, then solo when 8 are left (a start research reports), then a final stretch from episode 12.
function gated(segment) {
  return {
    schema: 1, kind: "competition", show: "Gated",
    cast: { unit: "people", singular: "player", plural: "players", groups: { type: "sides", singular: "team", change: "atPhases" } },
    season: {
      phases: [
        { id: "teams", name: "Teams", starts: { type: "episode", n: 1 }, changes: [] },
        { id: "solo", name: "Solo", starts: { type: "remaining", n: 8 }, changes: ["groupsEnd"] },
        { id: "final", name: "Final stretch", starts: { type: "episode", n: 12 }, changes: [] },
      ],
      finale: { decidedBy: "lastStanding" },
    },
    segments: [
      ...(segment ? [segment] : [
        { id: "teamChallenge", name: "Team challenge", decidedBy: "result", takesPart: "groups", decides: "winner", onTheLine: "safety", often: "onePhase", phase: "teams" },
        { id: "soloChallenge", name: "Solo challenge", decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "safety", often: "onePhase", phase: "solo" },
      ]),
      { id: "vote", name: "The vote", decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome", often: "everyEpisode" },
    ],
    waysOut: [{ id: "votedOut", name: "Voted out", means: "out", cause: { segment: "vote" } }, { id: "won", name: "Won", means: "winner" }],
    twists: [], customMoments: [], leftOut: [],
  };
}

test("a segment held in one phase scores only while it runs, and not at all before its start is known (T-24)", () => {
  assert.deepEqual(blocksProblems(gated()), []);
  assert.deepEqual(phaseRanges(gated()), { teams: { from: 1, until: 11 }, solo: null, final: { from: 12, until: null } });
  assert.deepEqual(phaseRanges(gated(), { solo: 7 }), { teams: { from: 1, until: 6 }, solo: { from: 7, until: 11 }, final: { from: 12, until: null } });

  const unknown = compileRulebook(gated());
  assert.deepEqual(unknown.problems, []);
  const rulesFor = (data, award) => data.rules.research.filter((r) => r.award === award);
  assert.deepEqual(rulesFor(unknown.data, "teamChallengeWon"), [{ when: { answer: "teamChallengeWon", is: "yes" }, award: "teamChallengeWon", untilEpisode: 11 }]);
  assert.deepEqual(rulesFor(unknown.data, "soloChallengeWon"), [], "waits for its start");
  assert.deepEqual(unknown.warnings, ["Solo challenge: nothing in it scores until when Solo starts is confirmed"]);
  const flag = unknown.data.research.episodeFields.find((f) => f.key === "phaseStarted");
  assert.deepEqual([flag.type, flag.values, flag.nullable], ["enum", ["solo"], true], "research is asked whether it began");

  const known = compileRulebook(gated(), { phaseStarts: { solo: 7 } });
  assert.deepEqual([known.problems, known.warnings], [[], []]);
  assert.equal(known.data.research.episodeFields.length, 0);
  const format = formatForRulebook(known.data);
  const both = person("Ann Example", { teamChallengeWon: "yes", teamChallengeGroupWon: "yes", soloChallengeWon: "yes" });
  const won = (episode) => staged(format, [both], episode).map(([, e]) => e);
  assert.deepEqual(won(6), ["teamChallengeWon", "teamChallengeGroupWon"]);
  assert.deepEqual(won(7), ["soloChallengeWon"]);
  assert.deepEqual(won(12), [], "the final stretch has neither");
});

test("every combination of a segment's answers compiles to a format the engine takes (T-20)", () => {
  let compiled = 0;
  const often = [{ often: "everyEpisode" }, { often: "someEpisodes" }, { often: "onePhase", phase: "teams" }, { often: "onePhase", phase: "solo" }, { often: "onePhase", phase: "finale" }];
  for (const decidedBy of values("decidedBy")) {
    for (const voters of decidedBy === "vote" ? values("voters") : [undefined]) {
      for (const pickers of decidedBy === "pick" ? values("pickers") : [undefined]) {
        for (const decides of ["result", "judges", "headToHead"].includes(decidedBy) ? values("decides") : [undefined]) {
          for (const takesPart of decidedBy === "nobody" ? [undefined] : values("takesPart")) {
            for (const onTheLine of [undefined, ...values("onTheLine")]) {
              for (const when of often) {
                const segment = { id: "seg", name: "The thing", decidedBy, voters, pickers, decides, takesPart, onTheLine, ...when };
                for (const k of Object.keys(segment)) if (segment[k] === undefined) delete segment[k];
                const blocks = gated(segment);
                blocks.twists = [{ id: "moles", type: "secretRole", name: "Moles", roles: ["Mole", "Player"], revealed: "atFinale", canSwitch: "recruited" }];
                blocks.waysOut.push({ id: "lostIt", name: "Lost the thing", means: "out", cause: { segment: "seg" } });
                if (blocksProblems(blocks).length) continue;
                const { problems } = compileRulebook(blocks, { phaseStarts: compiled % 2 ? { solo: 6 } : {} });
                assert.deepEqual(problems, [], JSON.stringify(segment));
                compiled++;
              }
            }
          }
        }
      }
    }
  }
  assert.ok(compiled > 1500, `${compiled} combinations`);
});

// Ten episodes: an event each (an episode with results), and whoever leaves when.
function play(s, exitsAt = {}) {
  for (let n = 1; n <= 10; n++) {
    S.ensureNextEpisode(s);
    const ep = s.episodes.find((e) => e.number === n);
    if (!ep) break;
    const scored = S.formatOf(s).events.find((e) => !e.implied);
    const c = s.castaways.find((x) => x.status === "active") || s.castaways[0];
    if (scored) S.ActiveRosterLogic.addEvent(s, ep.id, scored.id, c.id);
    for (const [name, method] of exitsAt[n] || []) S.addElimination(s, ep.id, castaway(s, name).id, method);
  }
  S.ensureNextEpisode(s);
  return s;
}
const lastEpisode = (s) => Math.max(...s.episodes.map((e) => e.number));

test("every kind of show plays ten episodes: a winner ends it, nobody left ends one nobody wins, a talk show runs on (T-21)", () => {
  const compiledOf = (blocks) => compileRulebook(blocks).data;
  // A talk show: nobody leaves, nobody wins, there's always a next episode.
  const talk = play(league(compiledOf(SAMPLES.snl)));
  assert.deepEqual([S.seasonEnded(talk), S.seasonWinner(talk), S.isWinnerExit(talk, null), lastEpisode(talk)], [false, null, false, 11]);
  assert.doesNotThrow(() => S.computeScores(talk));
  // A sport's standings: out for one race isn't out of the season.
  for (const blocks of [SAMPLES.formula1, LIBRARY["world-series"].blocks]) {
    const sport = play(league(compiledOf(blocks)));
    assert.deepEqual([S.seasonEnded(sport), lastEpisode(sport)], [false, 11], blocks.show);
  }
  // A series nobody wins: over when nobody's left, by an ending or by leaving; the finale is the last exit.
  const series = clone(SAMPLES.belowDeck);
  const fired = play(league(compiledOf(series)), { 2: [["Ann Example", "Fired by the captain"]] });
  assert.deepEqual([S.seasonEnded(fired), lastEpisode(fired), S.RevealLogic.isComplete(fired)], [false, 11, false], "still a crew");
  series.waysOut.push({ id: "charterSeasonOver", name: "Charter season over", means: "ending" });
  const ending = play(league(compiledOf(series)), {
    4: [["Ann Example", "Fired by the captain"]],
    7: [["Bo Example", "Charter season over"], ["Cy Example", "Charter season over"]],
  });
  assert.deepEqual([S.seasonEnded(ending), S.seasonWinner(ending), lastEpisode(ending), S.RevealLogic.isComplete(ending)], [true, null, 7, true], "nothing after the last charter");
  assert.doesNotThrow(() => S.computeScores(ending));
  // A competition with a winner ends with them, as it always has.
  const race = play(league(compiledOf(SAMPLES.amazingRace)), { 3: [["Ann Example", "Eliminated at the Pit Stop"], ["Bo Example", "Finalist"], ["Cy Example", "Won the race"]] });
  assert.deepEqual([S.seasonEnded(race), S.seasonWinner(race).name, lastEpisode(race)], [true, "Cy Example", 3]);
});

test("a built-in's reader: its code half, its roles only with roles, and what its wiki can't see", () => {
  const { blocks, aliases } = BUILT_IN_BLOCKS.traitors;
  const { data } = compileRulebook(blocks, { aliases, reader: "traitors" });
  const f = formatForRulebook(data, "traitors");
  assert.equal(f.research.notes, Formats.FORMATS.traitors.research.notes, "the family's own reviewer notes");
  assert.equal(f.wiki.episodesSchema, Formats.FORMATS.traitors.wiki.episodesSchema, "and its wiki read");
  assert.equal(formatForRulebook(data, "traitors"), f, "built once per data and reader");
  assert.notEqual(formatForRulebook(data), f, "with no reader, a data-only format");
  assert.equal(f.roles.roleFor("Recruited Traitor"), "Traitor");

  const noRoles = compileRulebook({ ...blocks, twists: blocks.twists.filter((t) => t.type !== "secretRole") }, { aliases, reader: "traitors" });
  assert.deepEqual(noRoles.problems, []);
  assert.equal(noRoles.data.roles, undefined);
  assert.equal(formatForRulebook(noRoles.data, "traitors").roles, undefined, "the family's roleFor goes with its roles");
  assert.ok(noRoles.warnings.some((w) => /^Won the season as a Traitor \(bonus\): its rule also needed/.test(w)), noRoles.warnings.join("; "));

  const survivor = BUILT_IN_BLOCKS.survivor;
  const moles = { id: "moles", type: "secretRole", name: "Moles", roles: ["Mole", "Player"], revealed: "atFinale", canSwitch: "never" };
  const withRole = compileRulebook({ ...survivor.blocks, twists: [...survivor.blocks.twists, moles] }, { aliases: survivor.aliases, reader: "survivor" });
  assert.deepEqual(withRole.problems, []);
  assert.deepEqual(withRole.data.roles, { default: "Player", values: ["Mole"] });
  assert.equal(formatForRulebook(withRole.data, "survivor").roles.roleFor("Mole"), "Mole", "the generic roleFor");
  assert.ok(withRole.data.rules.research.some((r) => r.stage === "role" && r.role === "Mole"));

  const removed = { id: "removed", name: "Removed for conduct", means: "out", cause: "removed" };
  const extra = compileRulebook({ ...survivor.blocks, waysOut: [...survivor.blocks.waysOut, removed] }, { aliases: survivor.aliases, reader: "survivor" });
  assert.deepEqual(extra.warnings, ["The Survivor wiki connector won't report \"Removed for conduct\"; research will"]);
  assert.deepEqual(extra.data.exitMethods.slice(-2), ["Removed for conduct", "Other"]);
  assert.deepEqual(extra.data.rules.implied.slice(-1), [{ whenExit: "Removed for conduct", award: "removed" }], "a new way out brings its own rule");
});

test("on top of its base: a moment switched off takes its rules with it, a new one brings its own, ids can't collide", () => {
  const { blocks, aliases } = BUILT_IN_BLOCKS.survivor;
  const b = clone(blocks);
  b.segments.find((s) => s.id === "immunityChallenge").momentsOff = ["immunityChallengeSecond", "immunityChallengeThird"];
  b.customMoments.push({ id: "hadTantrum", label: "Had a tantrum", counted: "eachTime", answeredBy: "research" });
  const { data, problems } = compileRulebook(b, { aliases, reader: "survivor" });
  assert.deepEqual(problems, []);
  const ids = data.events.map((e) => e.id);
  assert.ok(!ids.includes("challengeRunnerUp") && !ids.includes("challengeThird") && ids.includes("hadTantrum"));
  assert.ok(!JSON.stringify(data.rules).includes("challengeRunnerUp"), "no rule awards what's off");
  assert.ok(data.research.checklist.some((f) => f.key === "individualChallengeFinish"), "the base's questions stay asked");
  assert.deepEqual(data.rules.research.slice(-1), [{ when: { answer: "hadTantrum", greaterThan: 0 }, award: "hadTantrum", per: "hadTantrum" }]);
  assert.deepEqual(data.eventCategories.slice(-1), [{ id: "other", label: "Other moments", events: ["hadTantrum"] }]);

  const collide = compileRulebook(blocks, { aliases: { ...aliases, events: { ...aliases.events, immunityChallengeSecond: "individualImmunity" } } });
  assert.deepEqual(collide.problems, ["events: immunityChallengeSecond and immunityChallengeWon are both individualImmunity"], "T-14");
});

test("a moment scored from a question the rulebook already asks (customMoments[].uses, docs/PLAN-maker-scoring.md)", () => {
  const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
  const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
  const traitors = require("../scripts/dev-test/researched-traitors.json");
  const perVote = { id: "eachVoteReceived", label: "Each vote received at the Round Table", uses: "roundTableVotesReceived", counted: "eachTime", answeredBy: "research" };
  const blocks = { ...traitors, customMoments: [...(traitors.customMoments || []), perVote], points: { ...traitors.points, eachVoteReceived: -0.5 } };
  assert.deepEqual(blocksProblems(blocks), []);
  const { data, problems } = compileRulebook(blocks, { id: "made-test", reader: "research" });
  assert.deepEqual(problems, []);
  const keys = data.research.checklist.map((f) => f.key);
  assert.equal(keys.filter((k) => k === "roundTableVotesReceived").length, 1, "the votes question is asked once");
  assert.ok(!keys.includes("eachVoteReceived"), "no question of its own");
  const rule = data.rules.research.find((r) => r.award === "eachVoteReceived");
  assert.deepEqual({ when: rule.when, per: rule.per }, { when: { answer: "roundTableVotesReceived", greaterThan: 0 }, per: "roundTableVotesReceived" });
  assert.equal(data.events.find((e) => e.id === "eachVoteReceived").defaultPoints, -0.5);

  // A question it doesn't ask, or one of the wrong kind, is refused; so is the league answering it.
  const bad = (m) => compileRulebook({ ...traitors, customMoments: [...(traitors.customMoments || []), { ...perVote, ...m }] }, { id: "made-test", reader: "research" }).problems.join(" ");
  assert.match(bad({ uses: "cryingCount" }), /doesn't ask/);
  assert.match(bad({ counted: "yesNo" }), /isn't a yes-or-no question/);
  assert.ok(blocksProblems({ ...traitors, customMoments: [{ ...perVote, answeredBy: "league" }] }).some((p) => /answered by research/.test(p.message)));
  assert.ok(blocksProblems({ ...traitors, customMoments: [{ ...perVote, uses: "no spaces please" }] }).some((p) => /scored from/.test(p.message)));
});

// ---------- a show's own conditions, the question map and how research asks (docs/PLAN-start-a-game-gpt.md S1) ----------

/** A made-up competition with every refinement: none of it is Survivor's blocks. */
function island() {
  return {
    schema: 1, kind: "competition", show: "Island Test",
    cast: { unit: "people", singular: "player", plural: "players", groups: { type: "sides", singular: "team", change: "atPhases" } },
    season: { phases: [{ id: "teams", name: "Teams", starts: { type: "episode", n: 1 }, changes: [] }], finale: { decidedBy: "juryVote", finalists: 2 } },
    segments: [
      { id: "prize", name: "Prize", decidedBy: "result", takesPart: "groupsThenEach", decides: "winner", onTheLine: "reward", often: "everyEpisode", groupWin: "won" },
      { id: "shield", name: "Shield", decidedBy: "result", takesPart: "groupsThenEach", decides: "topThree", onTheLine: "safety", often: "everyEpisode", places: "place" },
      { id: "council", name: "Council", decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome", often: "everyEpisode", skippedBy: "shield" },
    ],
    waysOut: [
      { id: "out", name: "Voted out", means: "out", cause: { segment: "council" } },
      { id: "runnerUp", name: "Runner-up", means: "finalist", winnerToo: true },
      { id: "champion", name: "Champion", means: "winner" },
    ],
    twists: [
      { id: "tokens", type: "advantage", name: "Tokens", oneIsCalled: "a token", gotBy: "found", does: ["cancelsVotes"], lasts: "oneUse", cancelled: "count" },
      { id: "island", type: "sideTrip", name: "The island", oneIsCalled: "the island", who: "chosen", canGet: ["nothing"], away: "yes" },
    ],
    customMoments: [{ id: "invited", label: "Invited along", during: { segment: "prize" }, counted: "yesNo", answeredBy: "research", exceptWinners: true }],
  };
}

test("a show's own conditions as block fields: each compiles to its rule, and stages and implies through the pipeline", () => {
  const blocks = island();
  assert.deepEqual(blocksProblems(blocks), []);
  const { data, problems, warnings } = compileRulebook(blocks, { id: "island-test" });
  assert.deepEqual([problems, warnings], [[], []]);
  const rule = (award) => data.rules.research.find((r) => r.award === award);
  const yes = (answer) => ({ answer, is: "yes" });
  const no = (answer) => ({ answer, isNot: "yes" });
  // A team's win counts as winning the prize: one moment, either answer, both asked.
  assert.ok(!data.events.some((e) => e.id === "prizeGroupWon"), "no moment of its own");
  assert.deepEqual(rule("prizeWon"), { when: { any: [yes("prizeWon"), yes("prizeGroupWon")] }, award: "prizeWon" });
  assert.deepEqual(data.recap.find((r) => r.label === "Prize"), { label: "Prize", events: ["prizeWon"], tribeEvents: ["prizeWon"] });
  // 2nd and 3rd from one finishing place, each scored once.
  assert.deepEqual([rule("shieldSecond"), rule("shieldThird")], [{ when: { answer: "shieldPlace", equals: 2 }, award: "shieldSecond" }, { when: { answer: "shieldPlace", equals: 3 }, award: "shieldThird" }]);
  // The team that wins the shield skips the council; whoever left scores none of its moments.
  assert.deepEqual(rule("councilZeroVotes").when, { all: [yes("councilAttended"), { answer: "councilVotesReceived", equals: 0 }, no("shieldGroupWon"), no("leftTheGame")] });
  assert.deepEqual(data.rules.research.find((r) => r.builtIn === "votedForLeaver").when, no("leftTheGame"));
  // Votes a token cancelled: a count, of someone who played one, scored once.
  assert.deepEqual(rule("tokensCancelledVotes"), { when: { all: [yes("tokensPlayed"), { answer: "tokensVotesCancelled", greaterThan: 0 }] }, award: "tokensCancelledVotes" });
  // Invited along to a prize they didn't win, alone or as a team.
  assert.deepEqual(rule("invited").when, { all: [yes("invited"), no("prizeWon"), no("prizeGroupWon")] });
  // The island: the episode's exile record, and scored from it.
  assert.deepEqual(data.rules.research.find((r) => r.stage === "exiled"), { when: yes("islandWent"), stage: "exiled" });
  assert.deepEqual(data.events.find((e) => e.id === "islandWent"), { id: "islandWent", label: "Sent to the island", defaultPoints: 1, implied: true });
  // The champion reached the end too.
  assert.deepEqual(data.rules.implied.find((r) => r.award === "runnerUp"), { whenExit: ["Runner-up", "Champion"], award: "runnerUp" });
  const asked = new Map(data.research.checklist.map((f) => [f.key, f]));
  assert.deepEqual(["prizeGroupWon", "shieldPlace", "shieldGroupWon", "tokensVotesCancelled"].map((k) => asked.get(k) && asked.get(k).type), ["answer", "integer", "answer", "integer"]);
  assert.match(asked.get("prizeWon").description, /^Won the Prize on their own, not as part of a team, this episode/);

  const format = formatForRulebook(data);
  const stagedAs = (castaways) => ER.candidatesFor({ castaways }, format, 1).map((i) => `${i.castawayName} ${i.kind === "exiled" ? "exiled" : i.eventType}`);
  assert.deepEqual(sorted(stagedAs([
    person("Ann Example", { prizeGroupWon: "yes", shieldPlace: 2, councilAttended: "yes", councilVotesReceived: 0, shieldGroupWon: "yes", islandWent: "yes" }),
    person("Bo Example", { invited: "yes", prizeWon: "no", tokensPlayed: "yes", tokensVotesCancelled: 3, councilAttended: "yes", councilVotesReceived: 0 }),
    person("Cy Example", { invited: "yes", prizeWon: "yes", tokensPlayed: "no", tokensVotesCancelled: 2, shieldPlace: 3 }),
  ])), sorted([
    "Ann Example prizeWon", "Ann Example shieldSecond", "Ann Example shieldGroupWon", "Ann Example exiled",
    "Bo Example invited", "Bo Example tokensPlayed", "Bo Example tokensCancelledVotes", "Bo Example councilZeroVotes",
    "Cy Example prizeWon", "Cy Example shieldThird",
  ]));
  const ep = { number: 5, events: [{ castawayId: "c1", method: "Champion", juryVotes: 3 }, { castawayId: "c2", method: "Runner-up", juryVotes: 0 }], exiled: [{ castawayId: "c3" }], roles: [] };
  assert.deepEqual(sorted(format.impliedEvents(ep, {}).map((e) => `${e.castawayId} ${e.type}`)), sorted([
    "c3 islandWent", "c1 champion", "c1 runnerUp", "c2 runnerUp", "c2 finaleNoJuryVotes", "c1 finaleJuryVote", "c1 finaleJuryVote", "c1 finaleJuryVote",
  ]));
});

test("the refinements are checked where they apply, and leaving each out is what it always was", () => {
  const at = (b) => blocksProblems(b).map((p) => p.at);
  const b = island();
  b.segments[2].groupWin = "won";
  b.segments[0].places = "place";
  b.segments[2].skippedBy = "council";
  b.waysOut[0].winnerToo = true;
  b.twists[1].cancelled = "count";
  b.twists[0].away = "yes";
  b.customMoments[0].during = { segment: "council" };
  assert.deepEqual(at(b).sort(), [
    "customMoments[invited].exceptWinners", "segments[council].groupWin", "segments[council].skippedBy", "segments[prize].places",
    "twists[island].cancelled", "twists[tokens].away", "waysOut[out].winnerToo",
  ]);
  // Without them, the moments are the templates' own: a team's win of its own, 2nd and 3rd asked yes or no, a side trip that's a trip.
  const plain = island();
  for (const s of plain.segments) for (const k of ["groupWin", "places", "skippedBy"]) delete s[k];
  delete plain.waysOut[1].winnerToo;
  delete plain.twists[0].cancelled;
  delete plain.twists[1].away;
  delete plain.customMoments[0].exceptWinners;
  const { data } = compileRulebook(plain, { id: "island-test" });
  const rule = (award) => data.rules.research.find((r) => r.award === award);
  assert.deepEqual([rule("prizeGroupWon").when, rule("shieldSecond").when, rule("tokensCancelledVotes").when, rule("invited").when, rule("islandWent").when], [
    { answer: "prizeGroupWon", is: "yes" }, { answer: "shieldSecond", is: "yes" }, { answer: "tokensCancelledVotes", is: "yes" }, { answer: "invited", is: "yes" }, { answer: "islandWent", is: "yes" },
  ]);
  assert.deepEqual(data.rules.implied.find((r) => r.award === "runnerUp"), { whenExit: "Runner-up", award: "runnerUp" });
  assert.equal(data.events.find((e) => e.id === "islandWent").label, "Went on the island");
});

test("the question map and the rulebook's research block: stored keys, research's own words, which yeses need a source, questions asked besides", () => {
  const blocks = island();
  blocks.research = {
    searchHint: ["Look it up."],
    questions: {
      councilAttended: { words: "Were they at Council?", needsSource: false },
      whatTheyFound: { type: "string", words: "What token they found, in the show's words." },
      councilHeld: { type: "answer", of: "episode", words: "Was there a Council?" },
      notAsked: { words: "Words for a question nobody asks." },
      prizeWon: { type: "integer" },
    },
  };
  assert.deepEqual(blocksProblems(blocks).map((p) => p.at), ["research.questions.prizeWon.words"], "a question asked besides says what it asks");
  blocks.research.questions.prizeWon.words = "Already asked.";
  const aliases = { events: {}, exits: {}, questions: { councilAttended: "atCouncil", shieldPlace: "finish", councilVotedFor: "vote" } };
  const { data, problems, warnings } = compileRulebook(blocks, { id: "island-test", aliases });
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, [
    "How research asks \"prizeWon\": this rulebook already asks it, so its type isn't used",
    "How research asks \"notAsked\": this rulebook doesn't ask it, so its words aren't used",
  ]);
  const asked = new Map(data.research.checklist.map((f) => [f.key, f]));
  assert.ok(!asked.has("councilAttended") && asked.get("atCouncil").description === "Were they at Council?", "asked under its stored key, in its own words");
  assert.ok(asked.has("finish") && asked.has("vote"));
  assert.deepEqual(asked.get("whatTheyFound"), { key: "whatTheyFound", type: "string", nullable: true, description: "What token they found, in the show's words." });
  assert.deepEqual(data.research.episodeFields, [{ key: "councilHeld", type: "answer", description: "Was there a Council?" }]);
  assert.deepEqual([asked.get("prizeWon").type, asked.get("prizeWon").description], ["answer", "Already asked."], "its own words, its own type");
  assert.ok(!data.research.claims.includes("atCouncil") && data.research.claims.includes("prizeWon"), "a yes for being at Council needs no source");
  assert.deepEqual(data.research.searchHint, ["Look it up."]);
  const rules = JSON.stringify(data.rules);
  assert.ok(rules.includes('"atCouncil"') && rules.includes('"finish"') && rules.includes('"vote":"vote"') && !rules.includes("councilAttended"), "the rules read the stored keys");
  // A research block that isn't one is located.
  const bad = island();
  bad.research = { questions: { "no spaces": {}, odd: { type: "date", of: "season", colour: 1 } }, extra: true };
  assert.deepEqual(blocksProblems(bad).map((p) => p.at).sort(), ["research.extra", "research.questions.no spaces", "research.questions.odd.colour", "research.questions.odd.of", "research.questions.odd.type", "research.questions.odd.words"]);
});

test("a chat's rulebook: a refinement that doesn't fit is left out, never its item, and how research asks is never the chat's", () => {
  const R = require("../src/lib/game/formats/rulebook-research.js");
  const answer = island();
  answer.segments[0].places = "place"; // the prize doesn't decide a top three
  answer.segments[2].skippedBy = "Shield"; // by name
  answer.research = { questions: { councilAttended: { words: "Anything." } } };
  const r = R.reviewRulebook(answer);
  assert.deepEqual(r.problems, []);
  assert.ok(r.blocks.segments.some((s) => s.id === "prize") && !("places" in r.blocks.segments[0]), "the prize stays, its place goes");
  assert.equal(r.blocks.segments[2].skippedBy, "shield");
  assert.equal(r.blocks.research, undefined);
  assert.deepEqual(r.warnings.filter((w) => w.at === "research" || w.at === "segments[prize].places").map((w) => w.at), ["research", "segments[prize].places"]);
  // The template a prompt starts from leaves research's words out; the prompt says what the refinements are.
  const p = R.buildRulebookPrompt({ show: "Australian Survivor", template: BUILT_IN_BLOCKS.survivor.blocks });
  assert.ok(p.includes('"skippedBy": "immunityChallenge"') && !p.includes('"searchHint"') && !p.includes("Were they AT Tribal Council"));
  for (const f of ["groupWin", "places", "skippedBy", "winnerToo", "cancelled", "away", "exceptWinners"]) assert.ok(p.includes(`"${f}"`), f);
});

test("a refinement that stops fitting goes, never its item; and the edges: one exile, a vote by the cast, the old way of switching off a group's win", () => {
  const { dropMisfitRefinements } = require("../src/lib/game/formats/rulebook-schema.js");
  // The shield taken out: the council stays, without what it skipped by; the prize played by everyone loses its group's win.
  const b = island();
  b.segments = b.segments.filter((s) => s.id !== "shield");
  b.segments[0].takesPart = "everyone";
  const { dropped, problems } = dropMisfitRefinements(b);
  assert.deepEqual(problems, []);
  assert.deepEqual(dropped.map((p) => p.at).sort(), ["segments[council].skippedBy", "segments[prize].groupWin"]);
  assert.deepEqual(b.segments.map((s) => s.id), ["prize", "council"]);
  // Two trips away from the group: an episode's exile record doesn't say which, so only the first can be.
  const two = island();
  two.twists.push({ id: "cave", type: "sideTrip", name: "The cave", oneIsCalled: "the cave", who: "chosen", canGet: ["nothing"], away: "yes" });
  assert.deepEqual(blocksProblems(two).map((p) => p.at), ["twists[cave].away"]);
  // On a base that already scores the exile record (blocks from before Exile was a trip: its moment added by hand), a new
  // trip away from the group scores nothing, so an exile counts once, not twice.
  const { blocks, aliases } = BUILT_IN_BLOCKS.survivor;
  const onBase = clone(blocks);
  onBase.twists = onBase.twists.filter((t) => t.id !== "exile");
  onBase.customMoments.push({ id: "wentToExile", label: "Sent to Exile", during: { twist: "journeys" }, counted: "yesNo", answeredBy: "research" });
  onBase.twists.push({ id: "idols", type: "sideTrip", name: "Island of the Idols", oneIsCalled: "the Island of the Idols", who: "chosen", canGet: ["advantage"], away: "yes" });
  const c = compileRulebook(onBase, { aliases, reader: "survivor" });
  assert.deepEqual(c.problems, []);
  assert.ok(c.warnings.includes("Sent to the Island of the Idols: the base already scores being sent away, so nothing awards it"), c.warnings.join("; "));
  assert.equal(c.data.rules.implied.filter((r) => "whenExiled" in r).length, 1);
  // A vote that isn't the cast's can't be skipped: nothing there reads it.
  const jury = island();
  jury.segments[2].voters = "jury";
  assert.deepEqual(blocksProblems(jury).map((p) => p.at), ["segments[council].skippedBy"]);
  // The template's old way of one reward win, a group's win switched off: the plain question still covers winning as a group.
  const old = island();
  delete old.segments[0].groupWin;
  old.segments[0].momentsOff = ["prizeGroupWon"];
  const prize = compileRulebook(old, { id: "island-test" }).data.research.checklist.find((f) => f.key === "prizeWon");
  assert.equal(prize.description, "Won the Prize, this episode: yes, no, or unknown.");
});

test("a moment scored from a question the rulebook already asks leaves out the winners too", () => {
  const b = island();
  b.customMoments.push({ id: "tagAlong", label: "Tagged along", during: { segment: "prize" }, uses: "invited", counted: "yesNo", answeredBy: "research", exceptWinners: true });
  assert.deepEqual(blocksProblems(b), []);
  const { data, problems } = compileRulebook(b, { id: "island-test" });
  assert.deepEqual(problems, []);
  assert.deepEqual(data.rules.research.find((r) => r.award === "tagAlong").when, {
    all: [{ answer: "invited", is: "yes" }, { answer: "prizeWon", isNot: "yes" }, { answer: "prizeGroupWon", isNot: "yes" }],
  });
});
