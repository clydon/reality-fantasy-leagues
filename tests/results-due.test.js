// The commissioner's results to-do (action-items.js resultsDueEpisode / actionItems' "results"): an
// aired, in-play episode with nothing recorded is theirs to fill in. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");
const { actionItems, resultsDueEpisode, resultsHref } = require("../src/lib/game/action-items.js");

const NOW = Date.parse("2026-10-16T14:00:00Z");

function league({ season = true } = {}) {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: "pickem", showId: "survivor", wikiSeason: season ? 49 : null });
  s.players = [{ id: "p1", name: "A", color: "#f00", active: true, disabled: false }];
  s.castaways = ["a", "b", "c"].map((id) => ({ id, name: id, tribeId: null, ownerIds: [], status: "active", exitEpisodeId: null }));
  const ep = (n, airsAt, events = []) => ({ id: `e${n}`, number: n, airsAt, events, scoringEvents: [], bets: [], picks: [], lineups: {} });
  s.episodes = [
    ep(1, "2026-10-02T00:00:00Z", [{ castawayId: "a", method: "Voted Out" }]),
    ep(2, "2026-10-09T00:00:00Z"),
    ep(3, "2026-10-16T00:00:00Z"),
    ep(4, "2026-10-23T00:00:00Z"),
  ];
  return s;
}

test("the earliest aired episode with nothing recorded is due", () => {
  assert.equal(resultsDueEpisode(league(), NOW)?.number, 2);
  const s = league();
  s.episodes[1].events = [{ castawayId: "b", method: "Voted Out" }];
  assert.equal(resultsDueEpisode(s, NOW)?.number, 3);
});

test("nothing due before it airs, with no air time, or in a catching-up league", () => {
  const s = league();
  s.episodes.forEach((ep) => ep.number > 1 && (ep.events = [{ castawayId: "b", method: "Voted Out" }]));
  s.episodes[3].events = [];
  assert.equal(resultsDueEpisode(s, NOW), null);
  const unscheduled = league();
  unscheduled.episodes.forEach((ep) => delete ep.airsAt);
  assert.equal(resultsDueEpisode(unscheduled, NOW), null);
  const catchingUp = league();
  catchingUp.settings.revealedThroughEpisode = 1;
  assert.equal(resultsDueEpisode(catchingUp, NOW), null);
});

test("only a commissioner gets it, first, pointing at research or the episode by hand", () => {
  assert.ok(!actionItems(league(), "p1", null, { now: NOW }).some((it) => it.kind === "results"));
  const [first] = actionItems(league(), "p1", null, { commissioner: true, now: NOW });
  assert.deepEqual(first, { kind: "results", text: "Fill in episode 2's results", href: "/episodes/2/research", episode: 2 });
  const noSeason = league({ season: false });
  assert.equal(resultsHref(noSeason, noSeason.episodes[1]), "/episodes/2");
});
