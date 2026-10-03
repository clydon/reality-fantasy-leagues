// The Traitors catalog from docs/RESEARCH-traitors-events.md: what research (recaps) stages, what the
// wiki read derives from votes, and the implied Traitor win. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { termsFor } = require("../db/wiki-sync.js");

const traitors = Formats.formatFor("traitors");
const CAST = ["Rob Rausch", "Candiace Dillard Bassett", "Maura Higgins", "Eric Nam", "Natalie Anderson"];
const ctx = { showName: "T", showSlug: "t", season: 4, episodeNumber: 8, castNames: CAST, terms: termsFor({}).terms, format: traitors, domains: [] };

const staged = (payload) => R.candidatesFor(R.parseJsonAnswer(JSON.stringify(payload), R.researchSchemaFor(traitors, false), "t"), traitors);
const eventsOf = (items, name) => items.filter((i) => i.castawayName === name && i.kind === "event").map((i) => i.eventType).sort();

// US4 episode 8, simplified: Candiace (a Traitor) is banished. Rob, also a Traitor, votes for her;
// Maura and Eric (Faithfuls) vote for her; Candiace votes for Rob; Natalie votes for Maura. Eric made
// the case against Candiace, and Natalie was accused by Candiace and lived.
function roundTable() {
  const s = R.pasteSkeleton(ctx, []);
  const set = (name, fields) => Object.assign(s.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high", attendedRoundTable: "yes" }, fields);
  set("Rob Rausch", { isTraitor: "yes", votesReceived: 1, votedFor: ["Candiace Dillard Bassett"] });
  set("Candiace Dillard Bassett", { isTraitor: "yes", leftTheGame: "yes", exitMethod: "Banished", votesReceived: 3, votedFor: ["Rob"], accusedBy: ["Eric Nam"] });
  set("Maura Higgins", { isTraitor: "no", votesReceived: 1, votedFor: ["Candiace"] });
  set("Eric Nam", { isTraitor: "no", votesReceived: 0, votedFor: ["Candiace Dillard Bassett"] });
  set("Natalie Anderson", { isTraitor: "no", votesReceived: 0, votedFor: ["Maura Higgins"], accusedBy: ["Candiace Dillard Bassett"] });
  return s;
}

test("research: a vote for a banished Traitor scores by who cast it", () => {
  const items = staged(roundTable());
  assert.ok(eventsOf(items, "Maura Higgins").includes("votedOutTraitor"), "a Faithful's catch");
  assert.ok(eventsOf(items, "Rob Rausch").includes("turnedOnTraitor"), "a Traitor turning on their own");
  assert.ok(!eventsOf(items, "Rob Rausch").includes("votedOutTraitor"));
  assert.ok(!eventsOf(items, "Natalie Anderson").some((e) => e.startsWith("votedOut")), "voted for someone who stayed");
});

test("research: a vote for a banished Faithful scores for a Traitor, not for a Faithful", () => {
  const s = roundTable();
  Object.assign(s.castaways[1], { isTraitor: "no" });
  const items = staged(s);
  assert.ok(eventsOf(items, "Rob Rausch").includes("traitorVotedOutFaithful"));
  for (const name of ["Maura Higgins", "Eric Nam"]) assert.ok(eventsOf(items, name).includes("votedOutFaithful"), name);
});

test("leading the case: every pairing of leader and banished role", () => {
  const cases = [
    ["yes", "yes", "ledCaseAgainstPartner"],
    ["no", "yes", "ledCaseAgainstTraitor"],
    ["yes", "no", "framedFaithful"],
    ["no", "no", "ledCaseAgainstFaithful"],
  ];
  for (const [leader, banished, expected] of cases) {
    const s = roundTable();
    Object.assign(s.castaways[3], { isTraitor: leader });
    Object.assign(s.castaways[1], { isTraitor: banished });
    const led = eventsOf(staged(s), "Eric Nam").filter((e) => /^ledCase|^framed/.test(e));
    assert.deepEqual(led, [expected], `leader Traitor=${leader}, banished Traitor=${banished}`);
  }
  // A leader whose role is unknown leads nothing.
  const s = roundTable();
  Object.assign(s.castaways[3], { isTraitor: "unknown" });
  assert.ok(!eventsOf(staged(s), "Eric Nam").some((e) => /^ledCase|^framed/.test(e)));
});

test("every vote and case outcome is a scoring event, in the Round Table category", () => {
  const roundTable = traitors.eventCategories.find((c) => c.id === "roundTable").events;
  for (const id of ["votedOutTraitor", "turnedOnTraitor", "traitorVotedOutFaithful", "votedOutFaithful",
    "ledCaseAgainstTraitor", "ledCaseAgainstPartner", "framedFaithful", "ledCaseAgainstFaithful"]) {
    assert.ok(roundTable.includes(id), id);
  }
  const league = StateLogic.migrateLeagueState({ settings: { leagueTypeId: "active-roster", showFormat: "traitors", ownershipMode: "shared" } });
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(league, "ledCaseAgainstFaithful"), -0.5, "misleading the table costs");
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(league, "votedOutFaithful"), 0, "a Faithful's wrong vote doesn't");
});

test("research: no vote event when the banished person's role is unknown", () => {
  const s = roundTable();
  Object.assign(s.castaways[1], { isTraitor: "unknown" });
  assert.ok(staged(s).every((i) => !["votedOutTraitor", "turnedOnTraitor", "votedOutFaithful"].includes(i.eventType)));
});

test("research: accusations, leading the case, and zero votes", () => {
  const items = staged(roundTable());
  assert.ok(eventsOf(items, "Eric Nam").includes("ledCaseAgainstTraitor"));
  assert.ok(eventsOf(items, "Eric Nam").includes("zeroVotes"));
  assert.ok(eventsOf(items, "Natalie Anderson").includes("accusedAtRoundTable"));
  assert.ok(!eventsOf(items, "Candiace Dillard Bassett").includes("accusedAtRoundTable"), "banished that night: the banishment scores instead");
  assert.ok(eventsOf(items, "Rob Rausch").includes("survivedRoundTable"));
});

test("research: a single voted-for name from an older run still counts", () => {
  const s = roundTable();
  s.castaways[2].votedFor = "Candiace";
  assert.ok(eventsOf(staged(s), "Maura Higgins").includes("votedOutTraitor"));
});

test("research: murder danger only scores for a Faithful who lived through the night", () => {
  const s = R.pasteSkeleton(ctx, []);
  const set = (name, fields) => Object.assign(s.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high" }, fields);
  set("Rob Rausch", { isTraitor: "yes", onMurderShortlist: "yes" });
  set("Maura Higgins", { isTraitor: "no", onMurderShortlist: "yes", consideredForMurder: "yes" });
  set("Eric Nam", { isTraitor: "no", consideredForMurder: "yes", leftTheGame: "yes", exitMethod: "Murdered" });
  set("Natalie Anderson", { isTraitor: "no", wonShield: "yes", shieldSavedThem: "yes" });
  const items = staged(s);
  assert.deepEqual(eventsOf(items, "Rob Rausch"), []);
  assert.deepEqual(eventsOf(items, "Maura Higgins"), ["onMurderShortlist"], "a shortlist isn't also 'considered'");
  assert.deepEqual(eventsOf(items, "Eric Nam"), []);
  assert.deepEqual(eventsOf(items, "Natalie Anderson"), ["shieldSavedThem", "shieldWon"]);
});

test("research: original and recruited Traitors stage as roles", () => {
  const s = R.pasteSkeleton(ctx, []);
  Object.assign(s.castaways[0], { becameTraitor: "yes", sources: ["x"] });
  Object.assign(s.castaways[3], { recruitedAsTraitor: "yes", sources: ["x"] });
  const roles = staged(s).filter((i) => i.kind === "role").map((i) => [i.castawayName, i.method]);
  assert.deepEqual(roles, [["Rob Rausch", "Traitor"], ["Eric Nam", "Recruited Traitor"]]);
});

test("research: a Traitor marked as in murder danger is flagged for the reviewer", () => {
  assert.ok(traitors.research.entryProblems({ name: "Rob", isTraitor: "yes", onMurderShortlist: "yes" }).some((p) => p.includes("for a Traitor")));
});

test("wiki: vote outcomes split by role, and zero votes for voters nobody named", () => {
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const extracted = { originalTraitors: [{ name: "Rob" }, { name: "Candiace" }], episodes: [] };
  const ep = {
    number: 8,
    eliminations: [{ name: "Candiace", method: "Banished" }],
    roundTables: [{
      banished: "Candiace",
      votes: [
        { voter: "Rob", votedFor: "Candiace" },
        { voter: "Maura", votedFor: "Candiace" },
        { voter: "Candiace", votedFor: "Rob" },
        { voter: "Natalie", votedFor: "Maura" },
      ],
    }],
  };
  const got = traitors.wiki.derivedEvents(ep, extracted, same).map((e) => `${e.name}:${e.type}`).sort();
  assert.deepEqual(got, [
    "Maura:survivedRoundTable",
    "Maura:votedOutTraitor",
    "Natalie:zeroVotes",
    "Rob:survivedRoundTable",
    "Rob:turnedOnTraitor",
  ]);
  // Banishing a Faithful instead: the Traitor's vote is their job, the Faithful's is just a vote.
  const faithfulOut = { ...extracted, originalTraitors: [{ name: "Rob" }] };
  const types = traitors.wiki.derivedEvents(ep, faithfulOut, same).filter((e) => e.type.includes("Faithful")).map((e) => `${e.name}:${e.type}`).sort();
  assert.deepEqual(types, ["Maura:votedOutFaithful", "Rob:traitorVotedOutFaithful"]);
});

test("winning as a Traitor adds a bonus on top of the win", () => {
  const league = (roles) => StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat: "traitors", ownershipMode: "shared", activeSlots: 1, startEpisode: 1 },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: [{ id: "a", name: "A", ownerIds: ["p1"], status: "active" }],
    episodes: [{ id: "ep1", number: 1, events: [{ castawayId: "a", method: "Winner" }], roles, lineups: { p1: ["a"] }, scoringEvents: [] }],
  });
  const types = (s) => StateLogic.ActiveRosterLogic.episodeEvents(s, s.episodes[0]).map((e) => e.type).sort();
  assert.deepEqual(types(league([{ castawayId: "a", role: "Traitor" }])), ["seasonWinner", "wonAsTraitor"]);
  assert.deepEqual(types(league([])), ["seasonWinner"]);
});
