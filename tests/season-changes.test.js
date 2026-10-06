// Season rule changes (src/lib/game/formats/season-changes.js, docs/PLAN-season-rule-changes.md): a
// change layers onto a format without touching anything before its effective episode, what it adds that
// the base already has is skipped with a reason, and a league scores by its adopted changes only.
// Run with `npm test`.
//
// That formats with no changes behave exactly as before is proven separately, by diffing
// tests/harness/format-regression.js's output from before and after.
const test = require("node:test");
const assert = require("node:assert/strict");
const Formats = require("../src/lib/game/formats/index.js");
const Rules = require("../src/lib/game/formats/rules.js");
const StateLogic = require("../src/lib/game/state-logic.js");

const survivor = Formats.FORMATS.survivor;

// A Survivor twist from episode 8: a new question, a new event research awards from it, a new implied
// event from the exile record, in a new category.
const twist = (over = {}) => ({
  id: "chg-1",
  version: 1,
  effectiveEpisode: 8,
  delta: {
    addCategories: [{ id: "midSeason", label: "Mid-season twist" }],
    addEvents: [
      { id: "sentAway", label: "Sent away", defaultPoints: 1, category: "midSeason" },
      { id: "exiledAfterTwist", label: "Exiled (new rules)", defaultPoints: 2, implied: true, category: "midSeason" },
    ],
    addQuestions: [{ key: "sentAway", type: "answer", description: "Sent away this episode?", note: "sent away" }],
    addRules: {
      research: [{ when: { answer: "sentAway", is: "yes" }, award: "sentAway" }],
      implied: [{ whenExiled: true, award: "exiledAfterTwist" }],
    },
  },
  ...over,
});

const items = (format, entry, episode) => {
  const got = [];
  format.research.items(entry, (kind, type) => got.push(type), { episode });
  return got;
};

test("no changes means the base format itself", () => {
  assert.equal(Formats.withChanges(survivor, []), survivor);
  assert.equal(Formats.withChanges(survivor, null), survivor);
  const league = StateLogic.migrateLeagueState({ settings: { showFormat: "survivor", adoptedRuleChanges: [] } });
  assert.equal(StateLogic.formatOf(league), survivor);
});

test("a change adds to the catalog, the checklist and the categories", () => {
  const f = Formats.withChanges(survivor, [twist()]);
  assert.ok(f.events.some((e) => e.id === "sentAway"));
  assert.deepEqual(f.eventCategories.find((c) => c.id === "midSeason"), { id: "midSeason", label: "Mid-season twist", events: ["sentAway", "exiledAfterTwist"] });
  assert.ok(f.data.research.checklist.some((q) => q.key === "sentAway"));
  assert.equal(survivor.events.some((e) => e.id === "sentAway"), false, "the base is never mutated");
  assert.equal(Formats.withChanges(survivor, [twist()]) === f, false, "a different list builds anew");
  const changes = [twist()];
  assert.equal(Formats.withChanges(survivor, changes), Formats.withChanges(survivor, changes), "memoised per list");
});

test("research rules a change adds only run from its effective episode", () => {
  const f = Formats.withChanges(survivor, [twist()]);
  const entry = { name: "A", sentAway: "yes", wonIndividualImmunity: "yes" };
  assert.ok(!items(f, entry, 7).includes("sentAway"), "before the change");
  assert.ok(items(f, entry, 8).includes("sentAway"), "from the change");
  assert.ok(!items(f, entry, undefined).includes("sentAway"), "no episode: fails closed");
  assert.ok(items(f, entry, 7).includes("individualImmunity"), "the base's rules still run everywhere");
  assert.deepEqual(items(f, entry, undefined), items(survivor, entry, undefined), "base rules unaffected without an episode");
});

test("implied rules a change adds only fire from its effective episode", () => {
  const f = Formats.withChanges(survivor, [twist()]);
  const types = (n) => f.impliedEvents({ number: n, events: [], exiled: [{ castawayId: "a" }] }, {}).map((e) => e.type);
  assert.deepEqual(types(3), ["wentToExile"]);
  assert.deepEqual(types(8), ["wentToExile", "exiledAfterTwist"]);
});

test("retiring an event stops it being awarded from then on, by rules or by hand", () => {
  const retire = { id: "chg-2", effectiveEpisode: 5, delta: { retireEvents: ["wentToExile", "individualImmunity"] } };
  const f = Formats.withChanges(survivor, [retire]);
  const exile = (n) => f.impliedEvents({ number: n, events: [], exiled: [{ castawayId: "a" }] }, {}).map((e) => e.type);
  assert.deepEqual(exile(4), ["wentToExile"]);
  assert.deepEqual(exile(5), []);
  const entry = { name: "A", wonIndividualImmunity: "yes" };
  assert.ok(items(f, entry, 4).includes("individualImmunity"));
  assert.ok(!items(f, entry, 5).includes("individualImmunity"));

  const s = StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat: "survivor", adoptedRuleChanges: [retire] },
    castaways: [{ id: "a", name: "a", status: "active" }],
    episodes: [{ id: "e4", number: 4, events: [] }, { id: "e5", number: 5, events: [] }],
  });
  assert.ok(StateLogic.ActiveRosterLogic.addEvent(s, "e4", "individualImmunity", "a"));
  assert.equal(StateLogic.ActiveRosterLogic.addEvent(s, "e5", "individualImmunity", "a"), null);
  assert.equal(Formats.applyChanges(survivor.data, [retire, { ...retire, id: "chg-3", effectiveEpisode: 6 }]).skipped[0].why, "already retired from episode 5");
});

test("what the base already has is skipped with a reason, and so is a rule left without its event", () => {
  const clash = twist({
    delta: {
      addEvents: [
        { id: "individualImmunity", label: "Dup", defaultPoints: 9, category: "challenges" },
        { id: "orphan", label: "No group", defaultPoints: 1, category: "nope" },
      ],
      addQuestions: [{ key: "wonIndividualImmunity", type: "answer" }],
      addExitMethods: [{ name: "Voted Out" }, { name: "Banished", endgame: false }],
      addRules: { research: [{ when: { answer: "wonIndividualImmunity", is: "yes" }, award: "orphan" }] },
    },
  });
  const { data, skipped } = Formats.applyChanges(survivor.data, [clash]);
  assert.deepEqual(skipped.map((s) => s.what), ["event individualImmunity", "event orphan", "question wonIndividualImmunity", "exit method Voted Out", "a research rule"]);
  assert.match(skipped.at(-1).why, /no event "orphan"/);
  assert.deepEqual(data.events.find((e) => e.id === "individualImmunity").defaultPoints, survivor.data.events.find((e) => e.id === "individualImmunity").defaultPoints, "never overwritten");
  assert.ok(data.exitMethods.includes("Banished"));
  assert.deepEqual(Formats.formatProblems(data), []);
});

test("a malformed change is refused with its reasons", () => {
  assert.deepEqual(Formats.changeProblems(twist()), []);
  assert.match(Formats.changeProblems(twist({ effectiveEpisode: 0 })).join(), /effectiveEpisode/);
  assert.match(Formats.changeProblems(twist({ delta: { addRules: { research: [{ when: { answer: "x", is: "yes" }, award: "y", fromEpisode: 2 }] } } })).join(), /set from the change's effective episode/);
  assert.match(Formats.changeProblems(twist({ delta: { editEvents: [] } })).join(), /unknown key "editEvents"/, "only additions");
  assert.match(Formats.changeProblems(twist({ delta: { addEvents: [{ id: "x", label: "X", defaultPoints: 1 }] } })).join(), /category missing/);
  assert.throws(() => Formats.withChanges(survivor, [twist({ effectiveEpisode: "8" })]), /effectiveEpisode/);
});

test("a rule's sentence says when it starts", () => {
  const f = Formats.withChanges(survivor, [twist()]);
  const rule = f.data.rules.research.at(-1);
  assert.equal(rule.fromEpisode, 8);
  assert.match(Rules.describeRule(rule, f.data), / → Sent away \(from episode 8\)$/);
});

test("a built-in keeps its own code, and a reviewer sees the added questions after its notes", () => {
  const f = Formats.withChanges(survivor, [twist()]);
  const entry = { name: "A", wonIndividualImmunity: "yes", sentAway: "yes" };
  assert.deepEqual(f.research.notes(entry), [...survivor.research.notes(entry), "sent away"]);
  assert.equal(f.wiki.episodesSchema, survivor.wiki.episodesSchema);
  assert.equal(f.research.entryProblems, survivor.research.entryProblems);
});

test("a data-only base (a league's own copy) rebuilds from its data, and gets the change too", () => {
  const copy = Formats.formatForRuleset(JSON.parse(JSON.stringify(survivor.data)));
  const f = Formats.withChanges(copy, [twist()]);
  assert.ok(f.research.notes({ name: "A", sentAway: "yes" }).includes("sent away"));
  assert.ok(items(f, { name: "A", sentAway: "yes" }, 8).includes("sentAway"));
});

// ---- a league already scoring mid-season ----

function league(adopted) {
  const s = StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat: "survivor", ownershipMode: "shared", activeSlots: 1, startEpisode: 1, adoptedRuleChanges: adopted },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: [{ id: "a", name: "a", ownerIds: ["p1"], status: "active" }],
    episodes: [7, 8].map((n) => ({ id: `e${n}`, number: n, events: [], exiled: [{ castawayId: "a" }], lineups: { p1: ["a"] }, scoringEvents: [] })),
  });
  StateLogic.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, wentToExile: 1 });
  return s;
}
const byEpisode = (s) => s.episodes.map((ep) => StateLogic.ActiveRosterLogic.episodeEvents(s, ep).map((e) => e.type));

test("adopting a change leaves earlier episodes exactly as they scored", () => {
  const before = league(undefined);
  const after = league([twist()]);
  assert.deepEqual(byEpisode(before), [["wentToExile"], ["wentToExile"]]);
  assert.deepEqual(byEpisode(after), [["wentToExile"], ["wentToExile", "exiledAfterTwist"]]);
  assert.equal(StateLogic.computeScores(before)[0].total, 2);
  assert.equal(StateLogic.computeScores(after)[0].total, 4, "only episode 8 gains the new event's 2");
});

test("a change that no longer fits leaves the league on its base rather than breaking it", () => {
  const broken = { id: "bad", effectiveEpisode: 8, delta: { addEvents: "not a list" } };
  const s = league([broken]);
  const errors = console.error;
  console.error = () => {};
  try {
    assert.equal(StateLogic.formatOf(s), survivor);
  } finally {
    console.error = errors;
  }
});

// ---- a commissioner's say (StateLogic.RuleChangeLogic) ----

const Logic = StateLogic.RuleChangeLogic;
function offeredLeague(offered, extra = {}) {
  const s = league(undefined);
  s.settings.seasonRuleChanges = offered;
  Object.assign(s.settings, extra);
  return s;
}

test("an offered change waits on the commissioner, and adopting it sets this league's points", () => {
  const s = offeredLeague([twist()]);
  assert.deepEqual(Logic.pending(s).map((c) => c.id), ["chg-1"]);
  assert.ok(!StateLogic.formatOf(s).events.some((e) => e.id === "sentAway"), "offered isn't scored");
  const r = Logic.adopt(s, "chg-1", { sentAway: 3 });
  assert.deepEqual(r.skipped, []);
  assert.deepEqual(Logic.pending(s), []);
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(s, "sentAway"), 3);
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(s, "exiledAfterTwist"), 2, "an event left out keeps the suggestion");
  assert.equal(StateLogic.computeScores(s)[0].total, 4, "episode 8 gains the adopted implied event");
  assert.equal(Logic.adopt(s, "nope"), null);
});

test("declining is per version: an admin's edit is offered again, and adopting it replaces the old one", () => {
  const s = offeredLeague([twist()]);
  Logic.decline(s, "chg-1");
  assert.deepEqual(Logic.pending(s), []);
  s.settings.seasonRuleChanges = [twist({ version: 2 })];
  assert.deepEqual(Logic.pending(s).map((c) => c.version), [2]);
  Logic.adopt(s, "chg-1");
  assert.deepEqual(Logic.adopted(s).map((c) => c.version), [2]);
  assert.equal(s.settings.declinedRuleChanges, undefined);
  s.settings.seasonRuleChanges = [twist({ version: 3 })];
  assert.deepEqual(Logic.adoptedStatus(s).map((a) => a.status), ["updated"]);
  s.settings.seasonRuleChanges = [];
  assert.deepEqual(Logic.adoptedStatus(s).map((a) => a.status), ["withdrawn"]);
});

test("stopping a change takes back its events' results and points, and nothing else", () => {
  const s = offeredLeague([twist()]);
  Logic.adopt(s, "chg-1", { sentAway: 3 });
  StateLogic.ActiveRosterLogic.addEvent(s, "e8", "sentAway", "a");
  StateLogic.ActiveRosterLogic.addEvent(s, "e8", "individualImmunity", "a");
  assert.deepEqual(Logic.remove(s, "chg-1"), ["sentAway", "exiledAfterTwist"]);
  assert.deepEqual(s.episodes[1].scoringEvents.map((e) => e.type), ["individualImmunity"]);
  assert.equal(s.settings.eventPoints.sentAway, undefined);
  assert.equal(s.settings.eventPoints.wentToExile, 1, "the league's own values stay");
  assert.equal(s.settings.adoptedRuleChanges, undefined);
  assert.equal(Logic.remove(s, "chg-1"), null);
});

test("a change that clashes with a league's own copy says what it leaves out", () => {
  const copy = JSON.parse(JSON.stringify(survivor.data));
  copy.events.push({ id: "sentAway", label: "Our own", defaultPoints: 5 });
  copy.eventCategories[0].events.push("sentAway");
  const s = offeredLeague([twist()], { leagueRulesetData: copy });
  assert.deepEqual(Logic.fit(s, twist()).map((x) => x.what), ["event sentAway"]);
});

test("a viewer who hasn't seen the change's episode doesn't see the change -- offered or adopted", () => {
  const s = offeredLeague([twist()]);
  Logic.adopt(s, "chg-1");
  const before = StateLogic.SpoilerLogic.viewThrough(s, 7);
  assert.equal(before.settings.seasonRuleChanges, undefined);
  assert.equal(before.settings.adoptedRuleChanges, undefined);
  assert.equal(s.settings.adoptedRuleChanges.length, 1, "the real state is untouched");
  const after = StateLogic.SpoilerLogic.viewThrough(s, 8);
  assert.equal(after.settings.adoptedRuleChanges.length, 1);
  assert.equal(StateLogic.SpoilerLogic.viewThrough(s, null), s, "opted out of spoiler protection: everything");
});
