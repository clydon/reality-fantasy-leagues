// The couch's teams in a league, ranked, and its rivalries (src/lib/sports/couch-table.ts; docs/PLAN-sports-couch.md B1, a
// league's This week): records from the finals (a tie counting half), the last five, meetings among the couch's teams, places
// with ties, no places while scores are hidden, rivalries only between different people's teams, and each fan's rivalry record.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { formOf, rankTeams, recordWords, rivalriesOf, rivalryRecords, winShare } = jiti("../src/lib/sports/couch-table.ts");

const opp = (id) => ({ id, name: `T${id}`, short: `T${id}`, abbreviation: null });
let n = 0;
/** One of `team`'s games: against `vs`, home or away, its score from the team's side, a result once final. */
const g = (vs, home, score, at, extra = {}) => {
  const final = !!score && !extra.live;
  const result = final ? (score[0] > score[1] ? "W" : score[0] < score[1] ? "L" : "T") : null;
  return { id: extra.id ?? `g${++n}`, name: "", at, state: final ? "post" : score ? "in" : "pre", final, stage: extra.stage ?? "regular", note: null, home, opponent: opp(vs), score, result, calledOff: false };
};

test("a record counts the finals, the preseason's left out; the last five oldest first", () => {
  const games = [
    g("9", true, [10, 3], "2026-08-10", { stage: "pre" }),
    g("2", true, [24, 17], "2026-09-10"),
    g("3", false, [10, 20], "2026-09-17"),
    g("4", true, [17, 17], "2026-09-24"),
    g("5", false, [30, 3], "2026-10-01"),
    g("6", true, [21, 14], "2026-10-08"),
    g("7", false, [7, 9], "2026-10-15"),
    g("8", true, null, "2026-10-22"),
  ];
  const f = formOf("1", games, new Set());
  assert.deepEqual([f.w, f.l, f.t], [3, 2, 1]);
  assert.equal(recordWords(f), "3–2–1");
  assert.equal(winShare(f), 3.5 / 6);
  assert.deepEqual(f.form.map((x) => x.result), ["L", "T", "W", "W", "L"]);
  assert.equal(recordWords({ w: 0, l: 0, t: 0 }), null);
});

test("meetings among the asked teams, away first, with the winner", () => {
  const games = [g("2", false, [19, 11], "2026-11-08", { id: "m1" }), g("3", true, null, "2026-12-01", { id: "m2" }), g("9", true, [3, 0], "2026-09-01")];
  const f = formOf("1", games, new Set(["2", "3"]));
  assert.equal(f.meetings.length, 2);
  assert.deepEqual(f.meetings[0], { id: "m1", at: "2026-11-08", state: "post", final: true, away: "1", home: "2", score: [19, 11], winner: "1", calledOff: false });
  // At home: the score turns to away first.
  const h = formOf("1", [g("2", true, [24, 27], "2026-10-01", { id: "m3" })], new Set(["2"]));
  assert.deepEqual([h.meetings[0].away, h.meetings[0].home, h.meetings[0].score, h.meetings[0].winner], ["2", "1", [27, 24], "2"]);
});

const fan = (id, myTeam) => ({ id, name: id, ...(myTeam ? { myTeam } : {}) });
const forms = (rows) => new Map(rows.map(([id, w, l, t, meetings = []]) => [id, { id, w, l, t, form: [], meetings }]));

test("places by record, a tie counting half and sharing a place; no final, no place", () => {
  const teams = [
    { id: "a", short: "Jets", followers: [fan("sam")] },
    { id: "b", short: "Giants", followers: [fan("andrew")] },
    { id: "c", short: "Eagles", followers: [fan("riley")] },
    { id: "d", short: "Cowboys", followers: [fan("joanna")] },
    { id: "e", short: "Bears", followers: [fan("me")] },
  ];
  const f = forms([["a", 2, 6, 0], ["b", 4, 2, 1], ["c", 4, 2, 1], ["d", 5, 3, 0], ["e", 0, 0, 0]]);
  const r = rankTeams(teams, f, "me", false);
  assert.deepEqual(r.map((x) => [x.team.short, x.place]), [["Eagles", 1], ["Giants", 1], ["Cowboys", 3], ["Jets", 4], ["Bears", null]]);
});

test("hiding scores: yours first, then the most followed, and no places", () => {
  const teams = [
    { id: "a", short: "Jets", followers: [fan("sam")] },
    { id: "b", short: "Giants", followers: [fan("andrew"), fan("jo")] },
    { id: "c", short: "Eagles", followers: [fan("me")] },
  ];
  const r = rankTeams(teams, forms([["a", 9, 0, 0], ["b", 0, 9, 0], ["c", 4, 4, 0]]), "me", true);
  assert.deepEqual(r.map((x) => [x.team.short, x.place]), [["Eagles", null], ["Giants", null], ["Jets", null]]);
});

test("a rivalry needs a different person on each side; a shared fan is a teammate, not a rival", () => {
  const m = (id, away, home, score, winner, at) => ({ id, at, state: score ? "post" : "pre", final: !!score, away, home, score, winner, calledOff: false });
  const teams = [
    { id: "giants", short: "Giants", followers: [fan("andrew", true)] },
    { id: "eagles", short: "Eagles", followers: [fan("riley", true), fan("me")] },
    { id: "cowboys", short: "Cowboys", followers: [fan("joanna", true)] },
    { id: "jets", short: "Jets", followers: [fan("me")] },
  ];
  const f = forms([
    ["giants", 0, 0, 0, [m("w9", "giants", "eagles", [19, 11], "giants", "2026-11-08"), m("w18", "eagles", "giants", null, null, "2027-01-03")]],
    ["eagles", 0, 0, 0, [m("w9", "giants", "eagles", [19, 11], "giants", "2026-11-08"), m("w7", "cowboys", "eagles", [38, 21], "cowboys", "2026-10-18")]],
    ["cowboys", 0, 0, 0, [m("w7", "cowboys", "eagles", [38, 21], "cowboys", "2026-10-18")]],
    // The Jets' only fan (me) follows the Eagles too: no rivalry, nobody's on the Jets' side alone.
    ["jets", 0, 0, 0, [m("w5", "jets", "eagles", [10, 3], "jets", "2026-10-04")]],
  ]);
  const r = rivalriesOf(teams, f, "me");
  assert.deepEqual(r.map((x) => x.id), ["w7", "w9", "w18"]);
  // The Eagles stand for Riley (whose team it is), not me.
  assert.deepEqual(r.find((x) => x.id === "w9").fans.map((x) => x.id), ["andrew", "riley"]);
  const rec = rivalryRecords(r);
  assert.deepEqual(rec.map((x) => [x.fan.id, x.w, x.l]), [["andrew", 1, 0], ["joanna", 1, 0], ["riley", 0, 2]]);
});
