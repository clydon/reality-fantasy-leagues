// Moment tags (src/lib/game/formats/moment-tags.js, docs/PLAN-start-a-game-gpt.md S2): what a moment says about someone's
// place in the game, as rulebook data, which the computer players (bot-logic.js) and research's Safety ranking
// (research-rows.tsx) read in place of lists of Survivor's, The Traitors' and The Challenge's event ids. Every league
// today must read exactly what those lists said, whatever its rules' data is from: the lists are kept here as the
// reference. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const { formatProblems } = require("../src/lib/game/formats/define.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const S = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");

// What bot-logic.js (SIGNALS) and research-rows.tsx (SAFETY_EVENTS) read by event id before tags.
const BEFORE = {
  danger: ["survivedVotes", "survivedRoundTable", "nominatedSurvived", "accusedAtRoundTable", "onMurderShortlist", "consideredForMurder"],
  safe: ["zeroVotesSafe", "votedWithMajority", "votedOutTraitor", "zeroVotes"],
  threat: ["individualImmunity", "dailyWin", "eliminationWin"],
  protectionGained: ["idolFound"],
  protectionUsed: ["idolPlayed", "votesNegated"],
  safety: ["individualImmunity", "zeroVotesSafe", "survivedVotes"],
};
const BUILT_INS = ["survivor", "traitors", "challenge"];
const clone = (x) => JSON.parse(JSON.stringify(x));
// Data from before events carried tags.
const untagged = (data) => ({ ...clone(data), events: data.events.map(({ tags, ...e }) => e) });
// Each tag's event ids, as a format reads them, over `ids`.
const tagged = (format, ids) => Object.fromEntries(Object.keys(BEFORE).map((t) => [t, ids.filter((id) => Formats.momentTags(format)(id).includes(t)).sort()]));
const before = (ids) => Object.fromEntries(Object.entries(BEFORE).map(([t, list]) => [t, ids.filter((id) => list.includes(id)).sort()]));

test("each built-in's tags are what the computer players and the Safety ranking read by id before", () => {
  for (const id of [...BUILT_INS, "generic"]) {
    const format = Formats.FORMATS[id];
    const ids = format.events.map((e) => e.id);
    assert.deepEqual(tagged(format, ids), before(ids), id);
  }
});

test("data from before tags (a legacy rulebook, a league's own copy, a stored format) reads the same by id", () => {
  for (const id of BUILT_INS) {
    const data = untagged(Formats.FORMATS[id].data);
    const ids = data.events.map((e) => e.id);
    for (const format of [Formats.formatForRulebook(data, id), Formats.formatForRuleset(data), Formats.formatForRulebook(data, "research")]) {
      assert.deepEqual(tagged(format, ids), before(ids), id);
    }
  }
  // An event recorded under an id the rules no longer build, and one no show tags.
  const survivor = Formats.FORMATS.survivor;
  assert.deepEqual([...Formats.momentTags(survivor)("zeroVotes")], ["safe"], "a Traitors id still reads as it did");
  assert.deepEqual([...Formats.momentTags(survivor)("somethingElse")], []);
});

test("a format's own tags win, and none ([]) is none, even under a built-in's id", () => {
  const data = clone(Formats.FORMATS.survivor.data);
  data.events.find((e) => e.id === "individualImmunity").tags = [];
  data.events.find((e) => e.id === "satOut").tags = ["danger"];
  const format = Formats.formatForRulebook(data, "research");
  assert.deepEqual([...Formats.momentTags(format)("individualImmunity")], []);
  assert.deepEqual([...Formats.momentTags(format)("satOut")], ["danger"]);
});

test("formatProblems takes only known tags, each once", () => {
  const data = clone(Formats.FORMATS.survivor.data);
  data.events[0].tags = ["danger", "brave"];
  assert.ok(formatProblems(data).some((p) => /events\[individualImmunity\]: tags: "brave" isn't one of/.test(p)));
  data.events[0].tags = ["danger", "danger"];
  assert.ok(formatProblems(data).some((p) => /tags: a tag is listed twice/.test(p)));
  data.events[0].tags = "danger";
  assert.ok(formatProblems(data).some((p) => /tags: a list of/.test(p)));
});

// A show that isn't any of the built-ins: every structure that tags something, and some that don't.
function island() {
  return {
    schema: 1, kind: "competition", show: "Island Test",
    cast: { unit: "people", singular: "player", plural: "players", groups: { type: "sides", singular: "team", change: "atPhases" } },
    season: { phases: [{ id: "teams", name: "Teams", starts: { type: "episode", n: 1 }, changes: [] }], finale: null },
    segments: [
      { id: "prize", name: "Prize", decidedBy: "result", takesPart: "groupsThenEach", decides: "winner", onTheLine: "reward", often: "everyEpisode" },
      { id: "shield", name: "Shield", decidedBy: "result", takesPart: "groupsThenEach", decides: "winner", onTheLine: "safety", often: "everyEpisode" },
      { id: "council", name: "Council", decidedBy: "vote", voters: "cast", takesPart: "atRisk", onTheLine: "goingHome", often: "everyEpisode", skippedBy: "shield" },
      { id: "night", name: "Night", decidedBy: "vote", voters: "secretGroup", takesPart: "everyone", onTheLine: "goingHome", often: "everyEpisode" },
      { id: "panel", name: "Panel", decidedBy: "vote", voters: "judges", takesPart: "everyone", onTheLine: "goingHome", often: "everyEpisode" },
      { id: "nominations", name: "Nominations", decidedBy: "pick", pickers: "onePerson", takesPart: "everyone", onTheLine: "atRisk", often: "everyEpisode" },
    ],
    waysOut: [
      { id: "out", name: "Voted out", means: "out", cause: { segment: "council" } },
      { id: "champion", name: "Champion", means: "winner" },
    ],
    twists: [
      { id: "tokens", type: "advantage", name: "Tokens", oneIsCalled: "a token", gotBy: "found", does: ["cancelsVotes"], lasts: "oneUse", cancelled: "count" },
      { id: "capes", type: "advantage", name: "Capes", oneIsCalled: "a cape", gotBy: "wonAt", wonAt: "prize", does: ["keepsSafe"], lasts: "oneEpisode" },
      { id: "boosts", type: "advantage", name: "Boosts", oneIsCalled: "a boost", gotBy: "found", does: ["extraVote"], lasts: "untilPlayed" },
    ],
    customMoments: [{ id: "cried", label: "Cried on camera", counted: "yesNo", answeredBy: "research", reliability: "usually" }],
  };
}

test("the compiler tags a rulebook's moments from its structure, for any show", () => {
  const blocks = island();
  assert.deepEqual(blocksProblems(blocks), []);
  const { data, problems } = compileRulebook(blocks, { id: "island-test" });
  assert.deepEqual(problems, []);
  const tags = Object.fromEntries(data.events.filter((e) => e.tags.length).map((e) => [e.id, e.tags]));
  assert.deepEqual(tags, {
    shieldWon: ["threat", "safety"],
    councilZeroVotes: ["safe", "safety"],
    councilSurvivedVotes: ["danger", "safety"],
    councilVotedWithMajority: ["safe"],
    nightTargetedSurvived: ["danger"],
    panelBottom: ["danger"],
    nominationsAtRisk: ["danger"],
    tokensGot: ["protectionGained"],
    tokensPlayed: ["protectionUsed"],
    tokensCancelledVotes: ["protectionUsed"],
  });
  // Not tagged, and saying so ([]): a reward, a team's win, voting against the majority, a cape gone by the next vote, a boost
  // that protects nobody, a moment added by hand.
  for (const id of ["prizeWon", "shieldGroupWon", "councilVotedAgainstMajority", "capesGot", "capesSavedBy", "boostsGot", "cried"]) {
    assert.deepEqual(data.events.find((e) => e.id === id)?.tags, [], id);
  }
  // So a moment added by hand under a built-in's id ("Idol found") reads nothing from it.
  const named = island();
  named.customMoments.push({ id: "idolFound", label: "Idol found", counted: "yesNo", answeredBy: "research" });
  const idol = compileRulebook(named, { id: "island-test" }).data;
  assert.deepEqual([...Formats.momentTags(Formats.formatForRulebook(idol, "research"))("idolFound")], []);
  // A vote one team goes to at a time: the computer players read team numbers there.
  assert.deepEqual(Formats.groupVotesOf(Formats.formatForRulebook(data, "research")).map((v) => v.attended), ["councilAttended"]);
});

test("a rulebook says a moment's own tags (momentNotes), [] for none, and only known ones", () => {
  const blocks = island();
  blocks.momentNotes = { cried: { tags: ["danger"] }, shieldWon: { tags: [] }, councilZeroVotes: { reliability: "usually" } };
  assert.deepEqual(blocksProblems(blocks), []);
  const moments = new Map(momentsFor(blocks).map((m) => [m.id, m]));
  assert.deepEqual(moments.get("cried").tags, ["danger"]);
  assert.deepEqual(moments.get("shieldWon").tags, []);
  assert.deepEqual(moments.get("councilZeroVotes").tags, ["safe", "safety"], "a note without tags leaves the structure's");
  const { data } = compileRulebook(blocks, { id: "island-test" });
  assert.deepEqual(data.events.find((e) => e.id === "shieldWon").tags, [], "none, written down, so nothing reads a built-in's by id");
  blocks.momentNotes = { cried: { tags: ["brave"] } };
  assert.deepEqual(blocksProblems(blocks).map((p) => p.at), ["momentNotes.cried.tags"]);
});

test("Survivor's, The Traitors' and The Challenge's blocks with the generic reader read like their built-ins", () => {
  for (const id of BUILT_INS) {
    const { blocks, aliases } = rulebookFor(id);
    const { data } = compileRulebook(blocks, { aliases, reader: "research" });
    const format = Formats.formatForRulebook(data, "research");
    const ids = Formats.FORMATS[id].events.map((e) => e.id);
    assert.deepEqual(tagged(format, ids), before(ids), id);
    assert.equal(Formats.groupVotesOf(format).length > 0, id === "survivor", `${id}: groups vote their own out only on Survivor`);
  }
});

test("groups voting their own out: Survivor's own, a copy of its rules from before it said so, and nobody else's", () => {
  assert.deepEqual(Formats.groupVotesOf(Formats.FORMATS.survivor).map((v) => v.attended), ["attendedTribal"]);
  for (const id of ["traitors", "challenge", "generic"]) assert.deepEqual(Formats.groupVotesOf(Formats.FORMATS[id]), [], id);
  const old = clone(Formats.FORMATS.survivor.data);
  delete old.research.groupVotes;
  assert.deepEqual(Formats.groupVotesOf(Formats.formatForRuleset(old)).map((v) => v.attended), ["attendedTribal"], "a league's own copy");
  assert.deepEqual(Formats.groupVotesOf(Formats.formatForRulebook(old, "survivor")).map((v) => v.attended), ["attendedTribal"], "a legacy rulebook");
  // A copy that no longer asks who was at Tribal has nothing to read.
  old.research.checklist = old.research.checklist.filter((f) => f.key !== "attendedTribal");
  old.rules.research = old.rules.research.filter((r) => !JSON.stringify(r).includes("attendedTribal"));
  assert.deepEqual(formatProblems(old), []);
  assert.deepEqual(Formats.groupVotesOf(Formats.formatForRuleset(old)), []);
});

// A pre-merge Survivor league with a bot: two tribes, uneven, and a few episodes of everything the bots read.
function survivorLeague() {
  const s = S.defaultState();
  Object.assign(s.settings, { leagueTypeId: "active-roster", teamSize: 3, activeSlots: 2, benchSlots: 1, setupComplete: true, showFormat: "survivor" });
  s.tribes = [{ id: "A", name: "A", color: "#f00" }, { id: "B", name: "B", color: "#00f" }];
  const c = (id, tribeId) => ({ id, name: id, tribeId, ownerIds: [], status: "active", exitEpisodeId: null });
  s.castaways = ["a1", "a2", "a3", "a4", "a5"].map((id) => c(id, "A")).concat(["b1", "b2", "b3"].map((id) => c(id, "B")));
  s.players = [
    { id: "p1", name: "Person", color: "#f00", active: true, disabled: false },
    { id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true, botLevel: "sharp" },
  ];
  s.episodes = [];
  const moments = [
    ["survivedVotes", "b1"], ["zeroVotesSafe", "b2"], ["votedWithMajority", "b2"], ["idolFound", "a1"], ["individualImmunity", "a2"],
    ["survivedVotes", "a3"], ["idolPlayed", "a1"], ["votesNegated", "a1"], ["zeroVotes", "b3"], ["dailyWin", "a4"], ["onMurderShortlist", "a5"],
  ];
  for (let n = 1; n <= 3; n++) {
    S.ensureNextEpisode(s);
    const ep = s.episodes.find((e) => e.number === n);
    moments.slice((n - 1) * 4, n * 4).forEach(([type, who]) => S.ActiveRosterLogic.addEvent(s, ep.id, type, who));
  }
  return s;
}

test("the computer players rate everyone exactly as before, whatever the rules' data is from", () => {
  const base = survivorLeague();
  const reference = Bots.ratings(base, Bots.LEVELS.sharp);
  assert.ok(Object.values(reference).some((r) => r.safety !== reference.a1.safety), "the league says something");
  const plays = {
    "a legacy rulebook frozen before tags and groupVotes": (s) => (s.settings.rulebook = { data: (() => { const d = untagged(Formats.FORMATS.survivor.data); delete d.research.groupVotes; return d; })(), reader: "survivor" }),
    "a league's own copy of Survivor's rules from before": (s) => (s.settings.leagueRulesetData = (() => { const d = untagged(Formats.FORMATS.survivor.data); delete d.research.groupVotes; return d; })()),
    "Survivor's blocks with the generic reader": (s) => {
      const { blocks, aliases } = rulebookFor("survivor");
      s.settings.rulebook = { data: compileRulebook(blocks, { aliases, reader: "research" }).data, reader: "research" };
    },
  };
  for (const [label, set] of Object.entries(plays)) {
    const s = clone(base);
    set(s);
    assert.notEqual(S.formatOf(s), Formats.FORMATS.survivor, label);
    assert.deepEqual(Bots.ratings(s, Bots.LEVELS.sharp), reference, label);
  }
  // And on The Traitors' rules nobody's tribe counts, as before.
  const traitors = clone(base);
  traitors.settings.showFormat = "traitors";
  const t = Bots.ratings(traitors, Bots.LEVELS.sharp);
  const edgeless = clone(base);
  edgeless.tribes = [];
  edgeless.castaways.forEach((c) => (c.tribeId = null));
  edgeless.settings.showFormat = "traitors";
  assert.deepEqual(t, Bots.ratings(edgeless, Bots.LEVELS.sharp));
});
