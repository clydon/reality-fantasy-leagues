// Rulebooks, phase 1 (docs/PLAN-rulebooks-implementation.md; R1 in docs/PLAN-new-design.md): the schema and
// its validator, what each answer builds (rulebook-moments.js), the built-ins as blocks with their aliases,
// stored formats read back as blocks, and the How it works view model, spoiler gating included. Every
// built-in and stored format is covered. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const Schema = require("../src/lib/game/formats/rulebook-schema.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const D = require("../src/lib/game/formats/rulebook-describe.js");
const { blocksFromFormat } = require("../src/lib/game/formats/rulebook-from-format.js");
const { BUILT_IN_BLOCKS, rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("./fixtures/rulebook-samples.js");
const STORED = require("./fixtures/stored-formats.json");

const clone = (x) => JSON.parse(JSON.stringify(x));
const ids = (ms) => ms.map((m) => m.id);
const survivor = () => clone(BUILT_IN_BLOCKS.survivor.blocks);
// A competition with just enough to be valid, and one segment to test.
const withSegment = (seg, over = {}) => ({
  schema: 1, kind: "competition",
  cast: { unit: "people", singular: "player", plural: "players", groups: null },
  season: { phases: [{ id: "one", name: "One", starts: { type: "episode", n: 1 } }] },
  segments: [{ id: "s", name: "Duel", often: "everyEpisode", ...seg }],
  waysOut: [{ id: "champ", name: "Champion", means: "winner" }],
  ...over,
});

// ---------- the schema ----------

test("every option list: unique values, each with a label", () => {
  for (const [key, opts] of Object.entries(Schema.OPT)) {
    const values = opts.map((o) => o[0]);
    assert.equal(new Set(values).size, values.length, `${key}: values are unique`);
    for (const o of opts) {
      assert.equal(o.length, 3, `${key}.${o[0]}: [value, label, help]`);
      assert.ok(o[1], `${key}.${o[0]} has a label`);
    }
  }
  assert.equal(Schema.labelOf("onTheLine", "goingHome"), "Sends someone home");
  assert.match(Schema.helpOf("startType", "announced"), /never guessed/);
});

test("four kinds: each names its six blocks, and hides the ones that don't apply", () => {
  assert.deepEqual(Object.keys(Schema.KINDS), ["competition", "series", "talk", "sport"]);
  for (const [k, K] of Object.entries(Schema.KINDS)) {
    assert.deepEqual(Object.keys(K.labels), Schema.BLOCKS, `${k}: six blocks`);
    assert.ok(K.name && K.blurb && K.results && K.games.length, `${k}: named, with results and games`);
  }
  assert.equal(Schema.KINDS.talk.labels.waysOut, null);
  assert.equal(Schema.KINDS.talk.labels.twists, null);
  assert.equal(Schema.KINDS.sport.labels.twists, null);
  assert.equal(Schema.KINDS.series.labels.waysOut, "Comings and goings");
  assert.deepEqual(Schema.KINDS.sport.part, ["event", "events"]);
  assert.deepEqual(Schema.partWord(SAMPLES.formula1), { singular: "race", plural: "races" }, "a sport's own word");
  assert.equal(Schema.blockLabel(SAMPLES.formula1, "segments"), "Each race weekend", "the rundown's own heading");
  assert.equal(Schema.blockLabel(SAMPLES.snl, "waysOut"), null);
});

test("the built-ins, the samples and every stored format are valid rulebooks", () => {
  for (const [id, r] of Object.entries(BUILT_IN_BLOCKS)) assert.deepEqual(Schema.blocksProblems(r.blocks), [], id);
  for (const [id, b] of Object.entries(SAMPLES)) assert.deepEqual(Schema.blocksProblems(b), [], id);
  for (const id of Object.keys(Formats.FORMATS)) assert.deepEqual(Schema.blocksProblems(rulebookFor(id).blocks), [], `${id} via rulebookFor`);
  for (const [id, data] of Object.entries(STORED)) assert.deepEqual(Schema.blocksProblems(blocksFromFormat(data).blocks), [], `stored ${id}`);
});

test("a problem is located on its row and said plainly", () => {
  const at = (blocks) => Schema.blocksProblems(blocks).map((p) => `${p.at}: ${p.message}`);
  let b = survivor();
  b.segments[2].voters = "theAudience";
  assert.deepEqual(at(b), ["segments[tribalCouncil].voters: Tribal Council: who votes isn't one of the choices"]);

  b = survivor();
  b.segments[1].voters = "cast";
  assert.deepEqual(at(b), ["segments[immunityChallenge].voters: Immunity challenge: who votes doesn't go with the result"]);

  b = survivor();
  b.segments[3].phase = "jury";
  assert.deepEqual(at(b), ["segments[fireMaking].phase: Fire-making: which phase isn't one of the season's"]);

  b = survivor();
  b.waysOut[1].id = "votedOut";
  assert.match(at(b).join("\n"), /waysOut\[votedOut\]\.id: Lost fire-making: another item already has the id "votedOut"/);

  b = survivor();
  b.segments[0].momentsOff = ["rewardChallengeSecond"];
  assert.deepEqual(at(b), ['segments[rewardChallenge].momentsOff: Reward challenge: "rewardChallengeSecond" isn\'t one of the moments it builds']);

  b = survivor();
  b.points = { votedOut: -4, noSuchMoment: 2 };
  assert.deepEqual(at(b), ['points.noSuchMoment: "noSuchMoment" isn\'t one of this rulebook\'s moments']);

  b = survivor();
  b.waysOut = b.waysOut.filter((w) => w.means !== "winner");
  assert.match(at(b).join("\n"), /waysOut: A competition needs a way out that means they won/);

  b = survivor();
  b.twists[0].gotBy = "wonAt";
  assert.deepEqual(at(b), ["twists[advantages].wonAt: Idols and advantages: which segment it's won in isn't one of the segments"]);

  b = survivor();
  b.customMoments[0].during = { segment: "nowhere" };
  assert.deepEqual(at(b), ["customMoments[chosenForReward].during: Chosen to join a reward: where it happens isn't one of the segments or twists"]);

  b = survivor();
  b.season.phases[1].starts = { type: "remaining" };
  assert.deepEqual(at(b), ["season.phases[merged].starts.n: Merged: how many are left should be a whole number from 1"]);

  const talk = clone(SAMPLES.snl);
  talk.waysOut = [{ id: "fired", name: "Fired", means: "out" }];
  assert.deepEqual(at(talk), ["waysOut: Talk, variety or awards has no ways out"]);

  const series = clone(SAMPLES.belowDeck);
  delete series.start;
  assert.deepEqual(at(series), ["start: The rulebook: where a series starts from isn't one of the choices"]);
  const comp = survivor();
  comp.start = "reality";
  assert.deepEqual(at(comp), ["start: Only a series has a starting point"]);
  assert.deepEqual(Schema.blocksProblems("nope"), [{ at: "rulebook", message: "It isn't a rulebook" }]);
});

test("choices that come from the rulebook itself", () => {
  const b = survivor();
  assert.deepEqual(Schema.optionsFor("phase", b).map((o) => o[0]), ["tribes", "merged", "finale"]);
  assert.deepEqual(Schema.optionsFor("cause", b).map((o) => o[0]), ["rewardChallenge", "immunityChallenge", "tribalCouncil", "fireMaking", "ownChoice", "medical", "removed", "story"]);
  assert.deepEqual(Schema.optionsFor("during", SAMPLES.belowDeck).map((o) => o[0]), ["anywhere", "newCharter", "service", "tipMeeting", "crewNightOut", "newHire"]);
});

// ---------- what the answers build ----------

test("a segment decided by the result, judges or head to head: one template per answer", () => {
  const built = (seg) => momentsFor(withSegment(seg)).filter((m) => m.from.segment === "s").map((m) => [m.id, m.label, m.defaultPoints]);
  assert.deepEqual(built({ decidedBy: "result", takesPart: "everyone", decides: "winner" }), [["sWon", "Won the Duel", 2]]);
  assert.deepEqual(built({ decidedBy: "result", takesPart: "everyone", decides: "topThree" }), [["sWon", "Won the Duel", 2], ["sSecond", "2nd in the Duel", 1], ["sThird", "3rd in the Duel", 0.5]]);
  assert.deepEqual(built({ decidedBy: "judges", takesPart: "everyone", decides: "bestAndWorst" }), [["sWon", "Won the Duel", 2], ["sBest", "Among the best at the Duel", 1], ["sWorst", "Among the worst at the Duel", -1]]);
  assert.deepEqual(built({ decidedBy: "result", takesPart: "everyone", decides: "fullOrder" }), [["sFirst", "First in the Duel", 2], ["sLast", "Last in the Duel", -1]]);
  assert.deepEqual(built({ decidedBy: "judges", takesPart: "everyone", decides: "score" }), [["sPerPoint", "Each point at the Duel", 0.1]]);
  assert.deepEqual(built({ decidedBy: "headToHead", takesPart: "atRisk", decides: "winner", onTheLine: "nothing" }), [["sWon", "Won the Duel", 2], ["sLost", "Lost the Duel", -1]]);
  assert.deepEqual(built({ decidedBy: "headToHead", takesPart: "atRisk", decides: "winner", onTheLine: "goingHome" }), [["sWon", "Won the Duel", 2]], "losing it is a way out");
  assert.deepEqual(built({ decidedBy: "nobody" }), [], "nobody decides it: nothing of its own");
  assert.equal(built({ decidedBy: "result", takesPart: "everyone", decides: "winner", name: "The race" })[0][1], "Won the race", "a name starting with The");
  const groups = momentsFor(withSegment({ decidedBy: "result", takesPart: "groupsThenEach", decides: "winner" }, { cast: { unit: "people", singular: "player", plural: "players", groups: { type: "sides", singular: "tribe", change: "never" } } }));
  assert.deepEqual(ids(groups.filter((m) => m.from.segment)), ["sWon", "sGroupWon"]);
  assert.equal(groups[1].label, "Tribe won the Duel");
});

test("votes, picks and what's on the line", () => {
  const built = (seg, name = "Duel") => momentsFor(withSegment({ name, ...seg })).filter((m) => m.from.segment === "s");
  const cast = built({ decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome" });
  assert.deepEqual(ids(cast), ["sZeroVotes", "sSurvivedVotes", "sVotedWithMajority", "sVotedAgainstMajority"]);
  assert.equal(cast[0].ask.key, cast[1].ask.key, "the vote counts are one question");
  assert.equal(cast[0].ask.type, "integer");
  assert.equal(cast[2].ask.type, "string");
  assert.deepEqual(ids(built({ decidedBy: "vote", voters: "secretGroup", takesPart: "everyone" })), ["sTargetedSurvived"]);
  assert.deepEqual(ids(built({ decidedBy: "vote", voters: "viewers", takesPart: "everyone" })), ["sBottom", "sSaved"]);
  assert.deepEqual(ids(built({ decidedBy: "pick", pickers: "onePerson", takesPart: "everyone" })), ["sPicked", "sPickedFirst", "sNotPicked"]);
  assert.deepEqual(ids(built({ decidedBy: "nobody", onTheLine: "advantage" })), [], "nobody decides it: no stakes moments either");
  assert.deepEqual(ids(built({ decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "advantage" })), ["sWon", "sEarnedAdvantage"]);
  assert.deepEqual(ids(built({ decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "reward" })), ["sWon", "sSharedReward"]);
  assert.deepEqual(ids(built({ decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "reward" }, "Reward challenge")), ["sWon"], "a reward challenge's reward is its win");
  assert.deepEqual(ids(built({ decidedBy: "result", takesPart: "everyone", decides: "winner", onTheLine: "atRisk" })), ["sWon", "sAtRisk"]);
});

test("twists, ways out and the finale build theirs", () => {
  const traitors = momentsFor(BUILT_IN_BLOCKS.traitors.blocks);
  const role = traitors.filter((m) => m.from.twist === "traitors");
  assert.deepEqual(ids(role), ["traitorsCaughtAtRoundTable", "traitorsFooledAtRoundTable", "traitorsRecruited", "traitorsTurnedDown"]);
  assert.equal(role[0].label, "As a Faithful, voted out a Traitor at Round Table");
  assert.ok(role[0].auto && role[2].auto && role[3].ask, "votes and the recruitment are known; turning it down is asked");

  const adv = (does, lasts = "oneUse") => ids(momentsFor({ ...withSegment({ decidedBy: "nobody" }), twists: [{ id: "t", type: "advantage", name: "Idols", oneIsCalled: "an idol", gotBy: "found", does, lasts }] }).filter((m) => m.from.twist));
  assert.deepEqual(adv([]), ["tGot", "tPlayed"]);
  assert.deepEqual(adv(["keepsSafe", "cancelsVotes", "savesSomeone", "hurtsSomeone", "extraVote", "skipsATask"], "untilPlayed"), [
    "tGot", "tPlayed", "tCancelledVotes", "tSavedBy", "tSavedSomeone", "tUsedAgainst", "tExtraVote", "tSkippedTask", "tWentHomeHolding",
  ]);
  const twist = (t) => ids(momentsFor({ ...withSegment({ decidedBy: "nobody" }), twists: [{ id: "t", name: "T", ...t }] }).filter((m) => m.from.twist));
  assert.deepEqual(twist({ type: "comeback", who: "peopleWhoLeft", how: "winHeadToHead" }), ["tCameBack", "tSentHomeAgain", "tWonWayBack"]);
  assert.deepEqual(twist({ type: "comeback", who: "newPeople", how: "theShow" }), ["tArrived"]);
  assert.deepEqual(twist({ type: "sideTrip", oneIsCalled: "a journey", who: "chosen", canGet: ["advantage", "disadvantage"] }), ["tWent", "tCameBackWithAdvantage", "tLostSomething"]);
  assert.deepEqual(twist({ type: "secretRole", roles: ["Mole", "Player"], revealed: "atFinale", canSwitch: "never" }), ["tMadeFinale"]);

  const s = momentsFor(BUILT_IN_BLOCKS.survivor.blocks);
  const way = (id) => s.find((m) => m.id === id);
  assert.deepEqual([way("votedOut").defaultPoints, way("finalist").defaultPoints, way("soleSurvivor").defaultPoints], [-3, 2, 5]);
  assert.ok(way("votedOut").auto, "a way out scores from how they left");
  assert.deepEqual(ids(s.filter((m) => m.from.finale)), ["finaleJuryVote", "finaleNoJuryVotes"]);
  const dnf = momentsFor(SAMPLES.formula1).find((m) => m.id === "didNotFinish");
  assert.equal(dnf.auto, undefined, "out for one race isn't a way out of the season: it's asked");
  assert.equal(dnf.ask.question, 'This race, who\'s down as "Did not finish"?');
});

test("switching a moment off, and suggested points", () => {
  const b = survivor();
  assert.ok(!ids(momentsFor(b)).includes("rewardChallengeGroupWon"));
  const all = momentsFor(b, { includeOff: true });
  assert.equal(all.find((m) => m.id === "rewardChallengeGroupWon").off, true, "kept, marked off");
  b.segments[0].momentsOff = [];
  assert.ok(ids(momentsFor(b)).includes("rewardChallengeGroupWon"), "switched back on");
  b.points = { votedOut: -4, chosenForReward: 1.5 };
  const pts = Object.fromEntries(momentsFor(b).map((m) => [m.id, m.defaultPoints]));
  assert.deepEqual([pts.votedOut, pts.chosenForReward, pts.quit], [-4, 1.5, 0 - 3], "overrides change only their own points");
});

test("each moment's question reads as a question", () => {
  const q = (blocks, id) => momentsFor(blocks).find((m) => m.id === id).ask.question;
  const s = BUILT_IN_BLOCKS.survivor.blocks;
  assert.equal(q(s, "immunityChallengeSecond"), "This episode, who came 2nd in the Immunity challenge?");
  assert.equal(q(s, "immunityChallengeGroupWon"), "This episode, who was in the tribe that won the Immunity challenge?");
  assert.equal(q(s, "tribalCouncilZeroVotes"), "This episode, how many votes did each person get at Tribal Council?");
  assert.equal(q(s, "learnedOfAdvantage"), "This episode, who learned of an idol or advantage privately?", "a twist isn't a place");
  assert.equal(q(s, "chosenForReward"), "This episode, who was chosen to join a reward without winning it?", "its own question");
  assert.equal(q(SAMPLES.formula1, "raceFirst"), "This race, who finished first in the race?", "a sport's own word");
  assert.equal(q(SAMPLES.snl, "breaksCharacter"), "Did it happen tonight: someone breaks character?", "a talk show asks about tonight");
  assert.equal(momentsFor(SAMPLES.snl).find((m) => m.id === "breaksCharacter").answeredBy, "league");
});

// ---------- the built-ins and stored formats as blocks ----------

const legacyIds = ({ blocks, aliases }) => momentsFor(blocks).map((m) => aliases.events[m.id] || m.id);
const sorted = (xs) => [...xs].sort();

test("each built-in's blocks build every one of its events exactly once, under its recorded id", () => {
  for (const id of ["survivor", "traitors", "challenge"]) {
    const built = legacyIds(BUILT_IN_BLOCKS[id]);
    assert.deepEqual(sorted(built), sorted(Formats.FORMATS[id].data.events.map((e) => e.id)), id);
    const moments = new Set(ids(momentsFor(BUILT_IN_BLOCKS[id].blocks, { includeOff: true })));
    for (const m of Object.keys(BUILT_IN_BLOCKS[id].aliases.events)) assert.ok(moments.has(m), `${id}: alias ${m} is one of its moments`);
  }
});

test("each built-in's ways out are its exit methods, as castaways carry them", () => {
  for (const id of ["survivor", "traitors", "challenge"]) {
    const { blocks, aliases } = BUILT_IN_BLOCKS[id];
    const exits = Formats.FORMATS[id].data.exitMethods.filter((x) => x !== "Other");
    assert.deepEqual(sorted(blocks.waysOut.map((w) => w.id)), sorted(Object.keys(aliases.exits)), `${id}: every way out maps to an exit`);
    assert.deepEqual(sorted([...new Set(Object.values(aliases.exits))]), sorted(exits), `${id}: every exit method is a way out`);
    const winner = blocks.waysOut.find((w) => w.means === "winner");
    assert.equal(aliases.exits[winner.id], Formats.FORMATS[id].data.winnerExitMethod, `${id}: the winner`);
  }
});

test("any other format reads back as blocks with all its events (generic and every stored format)", () => {
  const formats = { generic: Formats.FORMATS.generic.data, ...STORED };
  for (const [id, data] of Object.entries(formats)) {
    const r = id === "generic" ? rulebookFor("generic") : rulebookFor(id, data);
    assert.equal(r.builtIn, false, id);
    const built = legacyIds(r);
    assert.equal(new Set(built).size, built.length, `${id}: no event twice`);
    for (const e of data.events) assert.ok(built.includes(e.id), `${id}: ${e.id} is in the rulebook`);
    const pts = Object.fromEntries(momentsFor(r.blocks).map((m) => [r.aliases.events[m.id] || m.id, m.defaultPoints]));
    for (const e of data.events) assert.deepEqual(pts[e.id], e.defaultPoints, `${id}: ${e.id} keeps its points`);
    assert.equal(r.blocks.derivedFrom, data.id);
    assert.equal(rulebookFor(id, data).blocks, r.blocks, `${id}: read once per data object`);
  }
  assert.equal(rulebookFor("no-such-format").blocks, BUILT_IN_BLOCKS.survivor.blocks, "an unknown id is Survivor, as formatFor reads it");
});

// ---------- How it works ----------

test("How it works, for every built-in and stored format: its catalog, in its own groups and points", () => {
  const formats = { ...Object.fromEntries(Object.keys(Formats.FORMATS).map((id) => [id, Formats.FORMATS[id].data])), ...STORED };
  for (const [id, data] of Object.entries(formats)) {
    const r = rulebookFor(id, Formats.FORMATS[id] ? undefined : data);
    const v = D.howItWorks(r.blocks, { compiled: data, aliases: r.aliases, seen: Infinity, episodeCount: 12 });
    assert.equal(v.kind.line, "A competition", id);
    assert.deepEqual(v.points.groups.map((g) => g.label), data.eventCategories.filter((c) => c.events.length).map((c) => c.label), `${id}: the format's groups`);
    assert.deepEqual(v.points.groups.flatMap((g) => g.items.map((i) => i.id)), data.eventCategories.flatMap((c) => c.events), `${id}: every event, in order`);
    assert.equal(v.rundown.segments.length, r.blocks.segments.length, id);
    assert.ok(v.waysOut && v.waysOut.out.length, `${id}: ways out`);
    assert.equal(v.season.cells.length, 12, id);
    assert.equal(v.who.label, "Who's playing", id);
  }
});

test("How it works reads like the mock for Survivor", () => {
  const r = BUILT_IN_BLOCKS.survivor;
  const v = D.howItWorks(r.blocks, { compiled: Formats.FORMATS.survivor.data, aliases: r.aliases, seen: 5, episodeCount: 14, castCount: 18 });
  assert.equal(v.tagline, "Castaways voted out one by one");
  assert.deepEqual(v.rundown.segments.map((s) => [s.name, s.decided, s.often, s.stake && s.stake.label]), [
    ["Reward challenge", "Won in a challenge", "Some episodes", "Reward"],
    ["Immunity challenge", "Won in a challenge", null, "Safety"],
    ["Tribal Council", "Decided by a vote", null, "Going home"],
    ["Fire-making", "Head to head", "Finale only", "Going home"],
  ]);
  assert.equal(v.who.line, "18 castaways, in tribes.");
  assert.equal(v.who.groups, "Tribes change at set points. Tribes end when Merged begins.");
  assert.deepEqual(v.season.phases.map((p) => [p.name, p.when, p.started]), [["Tribes", "From Episode 1", true], ["Merged", "When about 12 remain", false], ["Finale", "Episode 14", false]]);
  assert.deepEqual(v.season.cells.slice(3, 7).map((c) => [c.n, c.seen, c.next]), [[4, true, false], [5, true, false], [6, false, true], [7, false, false]]);
  assert.equal(v.season.cells[13].finale, true);
  assert.deepEqual(v.waysOut.out.map((w) => w.name), ["Voted out", "Lost fire-making", "Quit", "Medically evacuated"]);
  assert.match(v.waysOut.end, /jury votes for a winner from the final three/);
  assert.deepEqual(v.twists.items.map((t) => t.name), ["Idols and advantages", "Journeys"]);
  const tribal = v.points.groups.find((g) => g.id === "tribal");
  assert.deepEqual(tribal.items.find((i) => i.id === "votedOut"), { id: "votedOut", label: "Voted out", points: -3, auto: true, league: false });
  assert.deepEqual(v.jump.map((j) => j.label), ["Each episode", "The season", "Who's playing", "What scores"]);
  assert.deepEqual(v.games.map((g) => g.name), ["Survival Pool", "Weekly Lineup", "Outlast"]);
});

test("spoiler-safe: a phase shows its episode only once you've seen it start", () => {
  const b = BUILT_IN_BLOCKS.survivor.blocks;
  const merged = (seen) => D.howItWorks(b, { seen, phaseStarts: { merged: 8 }, episodeCount: 14 }).season.phases[1];
  assert.deepEqual([merged(5).when, merged(5).started], ["When about 12 remain", false], "not reached yet: only the condition");
  assert.deepEqual([merged(8).when, merged(8).started], ["From Episode 8", true]);
  assert.deepEqual([merged(Infinity).when, merged(Infinity).started], ["From Episode 8", true], "sees everything");
  assert.equal(D.howItWorks(b, { seen: 20 }).season.phases[1].when, "When about 12 remain", "unconfirmed: never guessed");
  assert.deepEqual(D.howItWorks(b, { seen: 0 }).season.cells, [], "no length: no strip");
});

test("spoiler-safe: later updates are counted, not told", () => {
  const updates = [
    { episode: 1, kind: "start", detail: "Started from Survivor 50's rulebook." },
    { episode: 4, kind: "fix", detail: "Sat out counts only in individual challenges." },
    { episode: 8, kind: "showChanged", detail: "Block a Vote added." },
    { episode: 9, kind: "showChanged", detail: "Another." },
  ];
  const at = (seen) => D.updatesFor(BUILT_IN_BLOCKS.survivor.blocks, updates, seen);
  assert.deepEqual(at(5).shown.map((u) => [u.episode, u.title, u.tag]), [[1, "In force from the premiere", null], [4, "Fixed a mistake", "Fix"]]);
  assert.deepEqual(at(5).hidden, { count: 2, from: 8, title: "2 updates from Episode 8", detail: "It shows once you've seen it" });
  assert.equal(at(8).hidden.title, "1 update from Episode 9");
  assert.equal(at(Infinity).hidden, null);
  assert.equal(at(0).shown.length, 1, "where it started always shows");
  assert.equal(D.updatesFor(SAMPLES.formula1, [{ episode: 19, kind: "start" }], 3).shown[0].title, "In force from Race 19");
});

test("spoiler-safe: what a later rule change adds or retires waits for its episode", () => {
  const change = {
    id: "chg-1", version: 1, effectiveEpisode: 8,
    delta: {
      addCategories: [{ id: "midSeason", label: "Mid-season twist" }],
      addEvents: [{ id: "sentAway", label: "Sent away", defaultPoints: 1, category: "midSeason" }],
      addQuestions: [{ key: "sentAway", type: "answer", description: "Sent away this episode?", note: "sent away" }],
      addRules: { research: [{ when: { answer: "sentAway", is: "yes" }, award: "sentAway" }], implied: [] },
      retireEvents: ["satOut"],
    },
  };
  const { data } = Formats.applyChanges(Formats.FORMATS.survivor.data, [change]);
  const r = BUILT_IN_BLOCKS.survivor;
  const listed = (seen) => D.pointGroups(r.blocks, { compiled: data, aliases: r.aliases, seen }).flatMap((g) => g.items.map((i) => i.id));
  assert.ok(!listed(5).includes("sentAway"), "added from episode 8: not before");
  assert.ok(listed(5).includes("satOut"), "retired from episode 8: still scores for you");
  assert.ok(listed(8).includes("sentAway"));
  assert.ok(!listed(8).includes("satOut"));
});

test("a league's own points, and shared ownership's defaults", () => {
  const r = BUILT_IN_BLOCKS.survivor;
  const item = (opts, id) => D.pointGroups(r.blocks, { compiled: Formats.FORMATS.survivor.data, aliases: r.aliases, ...opts }).flatMap((g) => g.items).find((i) => i.id === id);
  assert.equal(item({}, "individualImmunity").points, 3);
  assert.equal(item({ ownership: "shared" }, "individualImmunity").points, 4);
  assert.equal(item({ points: { individualImmunity: 6 } }, "individualImmunity").points, 6);
  assert.equal(D.howItWorks(r.blocks, { points: { individualImmunity: 6 } }).points.aside, "This game's points");
});

test("every kind reads in its own words", () => {
  const talk = D.howItWorks(SAMPLES.snl, { seen: 3, episodeCount: 21 });
  assert.equal(talk.kind.line, "Talk, variety or awards");
  assert.equal(talk.rundown.label, "Each show");
  assert.equal(talk.waysOut, null);
  assert.equal(talk.twists, null);
  assert.deepEqual([talk.points.label, talk.points.aside, talk.points.noPoints], ["Moments", "For bingo and calls", true]);
  assert.ok(talk.points.groups.every((g) => g.items.every((i) => !("points" in i) && i.league)), "no points; the couch calls them");
  assert.deepEqual(talk.games.map((g) => g.name), ["Weekly Bingo", "Weekly Calls"]);
  assert.deepEqual(talk.season.phases.map((p) => p.when), ["From Episode 1", "When the show says so"], "no finale for a talk show");

  const f1 = D.howItWorks(SAMPLES.formula1, { seen: 18, episodeCount: 24 });
  assert.deepEqual([f1.kind.line, f1.rundown.label, f1.season.label, f1.season.unit], ["A sport or live event", "Each race weekend", "The schedule", "Race"]);
  assert.deepEqual(f1.season.phases.map((p) => [p.name, p.when]), [["The season", "From Race 1"], ["Finale", "Race 24"]]);
  assert.equal(f1.waysOut.label, "Withdrawals");
  assert.deepEqual(f1.waysOut.out.map((w) => w.means), ["outForOne", "outForOne", "outForOne"]);
  assert.equal(f1.waysOut.end, "Most points after Race 24 is the champion.");
  assert.equal(f1.twists, null);
  assert.deepEqual(f1.rundown.segments.map((s) => [s.decided, s.stake && s.stake.label]), [[null, null], ["First to last", null], ["First to last", "Points"], ["First to last", "Points"]]);
  assert.equal(f1.who.line, "22 drivers, in teams.");

  const reality = D.howItWorks(SAMPLES.belowDeck, { seen: 7 });
  assert.equal(reality.kind.line, "A series · Reality");
  assert.equal(reality.waysOut.label, "Comings and goings");
  assert.equal(reality.waysOut.end, "No winner: the season ends with the last charter.");
  assert.deepEqual(reality.season.phases.map((p) => p.name), ["Charter season"], "nobody wins: no finale phase");
  assert.equal(reality.who.groups, null, "departments that never change: nothing to say");
  assert.equal(D.howItWorks(SAMPLES.pluribus).kind.line, "A series · Scripted");

  const race = D.howItWorks(SAMPLES.amazingRace);
  assert.equal(race.rundown.label, "Each leg");
  assert.equal(race.rundown.segments[1].decided, "Each team chooses");
  assert.equal(race.who.line, "11 teams.");
});

test("the editor's one-liners, per block the kind shows", () => {
  assert.deepEqual(D.blockSummaries(BUILT_IN_BLOCKS.survivor.blocks).map((x) => [x.label, x.summary]), [
    ["Who's playing", "18 castaways, in tribes"],
    ["The season", "Tribes › Merged (when about 12 remain) › Finale"],
    ["Each episode", "Reward challenge, Immunity challenge, Tribal Council, Fire-making"],
    ["Ways out", "Voted out, Lost fire-making, Quit, Medically evacuated, Finalist, Sole Survivor"],
    ["Twists", "Idols and advantages, Journeys"],
    ["What scores", "27 moments, suggested points"],
  ]);
  assert.deepEqual(D.blockSummaries(SAMPLES.snl).map((x) => x.block), ["cast", "season", "segments", "points"], "a talk show has no ways out or twists");
  assert.equal(D.segmentLine(BUILT_IN_BLOCKS.survivor.blocks.segments[2], BUILT_IN_BLOCKS.survivor.blocks), "Every episode · the cast votes · sends someone home");
});
