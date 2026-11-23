// How Add's search ranks sports (src/lib/sports/search-rank.ts; docs/PLAN-sports-couch.md B3, docs/design-round/search-spec.md): the
// one card for a clear meaning (a matchup; the couch's team; the one pro team in season; the one pro team; a league named exactly),
// the rows after it, college teams folded, tours apart. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { rankSports, inSeason, IN_SEASON } = jiti("../src/lib/sports/search-rank.ts");

const now = Date.parse("2026-11-22T17:00:00Z");
const soon = new Date(now + 4 * 86_400_000).toISOString();
const march = "2027-03-25T04:00:00Z";
const team = (league, id, short, o = {}) => ({ league, id, short, college: false, score: 96, next: null, ...o });
const nyg = team("football/nfl", "19", "Giants", { next: { at: soon, state: "pre" } });
const sfg = team("baseball/mlb", "26", "Giants", { next: { at: march, state: "pre" } });
const colleges = Array.from({ length: 6 }, (_, i) => team("baseball/college-baseball", `c${i}`, "Eagles", { college: true }));
const none = new Set();

test("a matchup is the card", () => {
  const r = rankSports({ teams: [nyg], matchup: { league: "football/nfl" }, leagues: [] }, none, now);
  assert.equal(r.card.kind, "matchup");
  assert.deepEqual(r.teams, [nyg]);
});

test("among two pro teams at the top, the one in season is the card; the other a row", () => {
  const r = rankSports({ teams: [sfg, nyg], matchup: null, leagues: [] }, none, now);
  assert.equal(r.card.kind, "team");
  assert.equal(r.card.team, nyg);
  assert.deepEqual(r.teams, [sfg]);
});

test("the couch's team wins a tie, in season or not", () => {
  const r = rankSports({ teams: [sfg, nyg], matchup: null, leagues: [] }, new Set(["baseball/mlb/26"]), now);
  assert.equal(r.card.team, sfg);
});

test("two pro teams both in season and nobody's: no card", () => {
  const other = team("football/nfl", "99", "Giants", { next: { at: soon, state: "pre" } });
  const r = rankSports({ teams: [nyg, other], matchup: null, leagues: [] }, none, now);
  assert.equal(r.card, null);
  assert.equal(r.teams.length, 2);
});

test("the one pro team among colleges is the card; the colleges after the first two fold", () => {
  const phi = team("football/nfl", "21", "Eagles", { next: { at: soon, state: "pre" } });
  const r = rankSports({ teams: [phi, ...colleges], matchup: null, leagues: [] }, none, now);
  assert.equal(r.card.team, phi);
  assert.equal(r.teams.length, 2);
  assert.equal(r.folded.length, 4);
});

test("a weaker hit (below 96) is never a card", () => {
  const r = rankSports({ teams: [team("football/nfl", "21", "Eagles", { score: 70 })], matchup: null, leagues: [] }, none, now);
  assert.equal(r.card, null);
});

test("a league named exactly is the card when no team is; tours are apart", () => {
  const nfl = { league: "football/nfl", score: 100, slate: true };
  const pga = { league: "golf/pga", score: 70, slate: false };
  const r = rankSports({ teams: [], matchup: null, leagues: [nfl, pga] }, none, now);
  assert.equal(r.card.kind, "league");
  assert.deepEqual(r.leagues, []);
  assert.deepEqual(r.tours, [pga]);
});

test("tours alone (golf) lead the TV listings; a team found never makes them lead", () => {
  const pga = { league: "golf/pga", score: 70, slate: false };
  assert.equal(rankSports({ teams: [], matchup: null, leagues: [pga] }, none, now).lead, true);
  assert.equal(rankSports({ teams: [team("football/nfl", "21", "Eagles", { score: 70 })], matchup: null, leagues: [pga] }, none, now).lead, false);
});

test("one college team alone isn't folded", () => {
  const r = rankSports({ teams: [nyg, ...colleges.slice(0, 3)], matchup: null, leagues: [] }, none, now);
  assert.equal(r.folded.length, 0);
  assert.equal(r.teams.length, 3);
});

test("in season: on now, or a next game within three weeks", () => {
  assert.equal(inSeason(team("x/y", "1", "A", { next: { at: null, state: "in" } }), now), true);
  assert.equal(inSeason(team("x/y", "1", "A", { next: { at: new Date(now + IN_SEASON + 60_000).toISOString(), state: "pre" } }), now), false);
  assert.equal(inSeason(team("x/y", "1", "A"), now), false);
});

test("nothing found, nothing ranked", () => {
  assert.deepEqual(rankSports(undefined, none, now), { card: null, teams: [], folded: [], leagues: [], tours: [], lead: false });
});
