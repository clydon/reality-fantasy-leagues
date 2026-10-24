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
