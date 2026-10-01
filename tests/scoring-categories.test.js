// The newer Survivor scoring categories, ownership-aware default points, and decimal points.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { termsFor } = require("../db/wiki-sync.js");

const survivor = Formats.formatFor("survivor");
const CAST = ["Nicole Mazullo", "Alex Moore", "Annie Davis", "Jake Latimer"];
const ctx = { showName: "S", showSlug: "s", season: 49, episodeNumber: 1, castNames: CAST, terms: termsFor({}).terms, format: survivor, domains: [] };

// A Tribal where Nicole goes home 3-1: Alex and Jake voted Nicole (Jake by first name only), Annie
// voted Alex, Nicole voted Annie.
function tribal() {
  const s = R.pasteSkeleton(ctx, []);
  const set = (name, fields) => Object.assign(s.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high" }, fields);
  set("Nicole Mazullo", { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 3, votedFor: "Annie Davis" });
  set("Alex Moore", { attendedTribal: "yes", votesReceived: 1, votedFor: "Nicole Mazullo" });
  set("Annie Davis", { attendedTribal: "yes", votesReceived: 0, votedFor: "Alex Moore" });
  set("Jake Latimer", { attendedTribal: "yes", votesReceived: 0, votedFor: "Nicole" });
  return s;
}
const staged = (payload) => R.candidatesFor(R.parseJsonAnswer(JSON.stringify(payload), R.researchSchemaFor(survivor, false), "t"), survivor);
const eventsOf = (items, name) => items.filter((i) => i.castawayName === name && i.kind === "event").map((i) => i.eventType).sort();

test("voted with the majority: whoever voted for the person who went home, matched by name", () => {
  const items = staged(tribal());
  assert.ok(eventsOf(items, "Alex Moore").includes("votedWithMajority"));
  assert.ok(eventsOf(items, "Jake Latimer").includes("votedWithMajority"), "a first-name-only vote still counts");
  assert.ok(!eventsOf(items, "Annie Davis").includes("votedWithMajority"));
  assert.ok(!eventsOf(items, "Nicole Mazullo").includes("votedWithMajority"), "the person voted out gets nothing for their vote");
});

test("no majority credit when nobody was voted out (a quit or medevac isn't a vote)", () => {
  const s = tribal();
  Object.assign(s.castaways[0], { exitMethod: "Quit" });
  assert.ok(staged(s).every((i) => i.eventType !== "votedWithMajority"));
});

test("cancelled votes: only an advantage they played that actually cancelled votes", () => {
  const s = tribal();
  Object.assign(s.castaways[2], { playedAdvantage: "yes", advantagePlayedName: "Hidden immunity idol", votesNullified: 2 });
  assert.deepEqual(eventsOf(staged(s), "Annie Davis").filter((e) => e.startsWith("idol") || e === "votesNegated"), ["idolPlayed", "votesNegated"]);
  // Played, but it cancelled nothing: played only.
  Object.assign(s.castaways[2], { votesNullified: 0 });
  assert.ok(!eventsOf(staged(s), "Annie Davis").includes("votesNegated"));
  // Votes cancelled but not marked as played: flagged for the reviewer, not scored.
  Object.assign(s.castaways[2], { playedAdvantage: "no", votesNullified: 2 });
  assert.ok(!eventsOf(staged(s), "Annie Davis").includes("votesNegated"));
  assert.ok(survivor.research.entryProblems(s.castaways[2]).some((p) => p.includes("cancelled")));
});

test("individual challenge finish: 2nd and 3rd score; 1st is the win itself; lower or unknown scores nothing", () => {
  for (const [finish, expected] of [[2, "challengeRunnerUp"], [3, "challengeThird"]]) {
    const s = tribal();
    s.castaways[1].individualChallengeFinish = finish;
    assert.ok(eventsOf(staged(s), "Alex Moore").includes(expected), `finish ${finish}`);
  }
  for (const finish of [1, 4, null]) {
    const s = tribal();
    s.castaways[1].individualChallengeFinish = finish;
    assert.ok(!eventsOf(staged(s), "Alex Moore").some((e) => e === "challengeRunnerUp" || e === "challengeThird"), `finish ${finish}`);
  }
});

test("the prompt asks for the challenge finishing order", () => {
  const prompt = R.buildPastePrompt(ctx, [], { structured: true });
  assert.ok(prompt.includes("individualChallengeFinish"));
  assert.match(prompt, /finishing order of any individual challenge/);
});

const league = (mode, format = "survivor") =>
  StateLogic.migrateLeagueState({ settings: { leagueTypeId: "active-roster", showFormat: format, ownershipMode: mode } });

test("defaults follow ownership: winner-heavy categories count for less in exclusive leagues", () => {
  const ex = league("exclusive");
  const sh = league("shared");
  const pts = (s, id) => StateLogic.ActiveRosterLogic.pointsFor(s, id);
  assert.ok(pts(ex, "individualImmunity") < pts(sh, "individualImmunity"));
  assert.ok(pts(ex, "votedWithMajority") < pts(sh, "votedWithMajority"));
  assert.equal(pts(ex, "idolFound"), pts(sh, "idolFound"), "strategic one-offs are the same either way");
  for (const format of ["challenge", "traitors"]) {
    assert.ok(pts(league("exclusive", format), "seasonWinner") < pts(league("shared", format), "seasonWinner"), format);
  }
});

test("switching ownership moves untouched values and keeps hand-set ones", () => {
  const s = league("exclusive");
  StateLogic.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, idolFound: 7 });
  StateLogic.updateSettings(s, "ownershipMode", "shared");
  const shared = StateLogic.defaultEventPoints(s, "shared");
  assert.equal(s.settings.eventPoints.individualImmunity, shared.individualImmunity);
  assert.equal(s.settings.eventPoints.idolFound, 7);
});

test("decimal points are kept, and totals don't pick up float noise", () => {
  const s = StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat: "survivor", activeSlots: 1, startEpisode: 1 },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: [{ id: "a", name: "A", ownerIds: ["p1"], status: "active" }],
    episodes: [1, 2, 3].map((n) => ({
      id: `ep${n}`, number: n, events: [], lineups: n === 1 ? { p1: ["a"] } : {},
      scoringEvents: [{ id: `s${n}`, type: "zeroVotesSafe", castawayId: "a" }],
    })),
  });
  StateLogic.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, zeroVotesSafe: 0.1 + 0.2 });
  assert.equal(s.settings.eventPoints.zeroVotesSafe, 0.3);
  assert.equal(StateLogic.computeScores(s)[0].total, 0.9);
  // Garbage becomes 0, never NaN.
  StateLogic.updateSettings(s, "eventPoints", { ...s.settings.eventPoints, zeroVotesSafe: "lots" });
  assert.equal(s.settings.eventPoints.zeroVotesSafe, 0);
});

// ---- how someone leaves (implied from the elimination, scored only if they were fielded) ----
function exitLeague(showFormat, method, { roles = [] } = {}) {
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat, ownershipMode: "shared", activeSlots: 2, startEpisode: 1 },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: ["a", "b"].map((id) => ({ id, name: id, ownerIds: ["p1"], status: "active" })),
    episodes: [{ id: "ep1", number: 1, events: [{ castawayId: "a", method }], roles, lineups: { p1: ["a"] }, scoringEvents: [] }],
  });
}
const total = (s) => StateLogic.computeScores(s)[0].total;

test("Survivor scores how someone leaves: voted out and quitting cost, a medevac doesn't, the end pays", () => {
  assert.equal(total(exitLeague("survivor", "Voted Out")), -3);
  assert.equal(total(exitLeague("survivor", "Quit")), -5);
  assert.equal(total(exitLeague("survivor", "Medically Evacuated")), 0);
  assert.equal(total(exitLeague("survivor", "Lost Fire-Making")), 0);
  assert.equal(total(exitLeague("survivor", "Lost Final Tribal (Jury Vote)")), 5);
  assert.equal(total(exitLeague("survivor", "Sole Survivor")), 10);
});

test("benching someone the week they go home avoids the penalty", () => {
  const s = exitLeague("survivor", "Voted Out");
  s.episodes[0].lineups.p1 = ["b"];
  assert.equal(total(s), 0);
});

test("The Challenge and Traitors exits", () => {
  assert.equal(total(exitLeague("challenge", "Eliminated")), -3);
  assert.equal(total(exitLeague("challenge", "Disqualified")), -5);
  assert.equal(total(exitLeague("challenge", "Medically removed")), 0);
  assert.equal(total(exitLeague("traitors", "Banished")), -3, "a Faithful banished");
  assert.equal(total(exitLeague("traitors", "Banished", { roles: [{ castawayId: "a", role: "Traitor" }] })), -3, "a Traitor caught");
  assert.equal(total(exitLeague("traitors", "Left the game")), -5);
  assert.equal(total(exitLeague("traitors", "Murdered")), 0);
});

test("voting against the majority is tracked but worth 0; sitting out and being targeted cost 0.5", () => {
  const items = staged(tribal());
  assert.ok(eventsOf(items, "Annie Davis").includes("votedAgainstMajority"));
  const s = league("shared");
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(s, "votedAgainstMajority"), 0);
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(s, "satOut"), -0.5);
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(s, "advantageTargeted"), -0.5);
});

test("a finalist with no jury votes is a goat; one with votes isn't", () => {
  const s = R.pasteSkeleton(ctx, []);
  const set = (name, fields) => Object.assign(s.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high" }, fields);
  set("Alex Moore", { leftTheGame: "yes", exitMethod: "Lost Final Tribal (Jury Vote)", juryVotesReceived: 0 });
  set("Annie Davis", { leftTheGame: "yes", exitMethod: "Lost Final Tribal (Jury Vote)", juryVotesReceived: 2 });
  set("Jake Latimer", { leftTheGame: "yes", exitMethod: "Sole Survivor", juryVotesReceived: 6 });
  const items = staged(s);
  assert.ok(eventsOf(items, "Alex Moore").includes("zeroJuryVotes"));
  assert.ok(!eventsOf(items, "Annie Davis").includes("zeroJuryVotes"));
  assert.ok(!eventsOf(items, "Jake Latimer").includes("zeroJuryVotes"));
});
