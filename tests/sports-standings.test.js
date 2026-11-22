// A league's standings (docs/PLAN-sports-couch.md B1, the Standings tab): ESPN's table read into ours (espn.ts readStandings) on
// trimmed real answers of 2026-11-22 (tests/fixtures/espn-standings/: the NFL, NBA, NHL, MLB at its season's end, the Premier
// League), and the tab's rules (src/lib/sports/standings.ts): a group in the league's own order (by seed: ESPN lists a division
// unordered), the two views and their words, the sport's columns, games behind by conference, clinch words, soccer's W-D-L and its
// places key, and the couch's groups first with nothing inside them moved. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src"), "@db": path.join(__dirname, "..", "db") } });
const { readStandings } = jiti("../src/lib/server/sports/espn.ts");
const L = jiti("../src/lib/sports/standings.ts");

const AT = "2026-11-22T20:00:00.000Z";
const read = (file, league) => readStandings(league, require(`./fixtures/espn-standings/${file}.json`), AT);
const abbrs = (g, n = 99) => g.rows.slice(0, n).map((r) => r.e.abbreviation);

test("the NFL: eight divisions under two conferences, Division first, W-L PCT DIFF", () => {
  const s = read("nfl", "football/nfl");
  assert.equal(s.season, "2026");
  assert.equal(s.asOf, AT);
  assert.deepEqual(s.parents.map((p) => p.short), ["AFC", "NFC"]);
  assert.equal(s.groups.length, 8);
  assert.deepEqual(L.viewWords(s), { group: "Division", parent: "Conference" });
  assert.equal(L.defaultView(s), "group");
  assert.deepEqual(L.columnsOf(s).map((c) => c.label), ["W-L", "PCT", "DIFF"]);
  const east = L.viewOf(s, "group")[0];
  assert.equal(east.name, "AFC East");
  assert.equal(east.placeWord, "Div");
  assert.deepEqual(abbrs(east), ["BUF", "NE", "NYJ", "MIA"]);
  assert.equal(east.rows[0].e.record, "8-1");
  assert.equal(east.rows[0].e.stats.diff, "+88");
});

test("by conference: the seeds in order, each division leader named, so a seed above a better record explains itself", () => {
  const afc = L.viewOf(read("nfl", "football/nfl"), "parent")[0];
  assert.equal(afc.name, "AFC");
  assert.equal(afc.placeWord, "Seed");
  assert.deepEqual(afc.rows.map((r) => r.place), [...Array(16)].map((_, i) => i + 1));
  assert.deepEqual(afc.rows.slice(0, 4).map((r) => [r.e.abbreviation, r.division]), [["BUF", "East"], ["KC", "West"], ["JAX", "South"], ["CIN", "North"]]);
  assert.equal(afc.rows[4].leader, false);
});

test("the NBA: ESPN's division comes unordered and is put in seed order; Conference first; games behind the conference's leader", () => {
  const s = read("nba", "basketball/nba");
  assert.equal(s.season, "2026-27");
  assert.equal(L.defaultView(s), "parent");
  assert.deepEqual(L.columnsOf(s).map((c) => c.label), ["W-L", "PCT", "GB"]);
  const raw = require("./fixtures/espn-standings/nba.json");
  assert.equal(raw.children[0].children[0].standings.entries[0].team.abbreviation, "BKN", "ESPN lists the Atlantic 14th seed first");
  const atlantic = L.viewOf(s, "group").find((g) => g.name === "Atlantic");
  assert.deepEqual(abbrs(atlantic), ["PHI", "BOS", "NY", "TOR", "BKN"]);
  // No total summary for the NBA: the record from its wins and losses.
  assert.equal(atlantic.rows[0].e.record, "14-3");
  const east = L.viewOf(s, "parent")[0];
  // Detroit (10-5) leads its division (ESPN's GB "-") but is 3 behind Philadelphia (14-3) in the East.
  const det = east.rows.find((r) => r.e.abbreviation === "DET");
  assert.equal(det.e.stats.gb, "-");
  assert.equal(det.gb, "3");
  assert.equal(east.rows[0].gb, "-");
});

test("the NHL: W-L-OT and points; MLB: League for its top groups, clinch letters as In and Out", () => {
  const nhl = read("nhl", "hockey/nhl");
  assert.deepEqual(L.columnsOf(nhl).map((c) => c.label), ["W-L-OT", "PTS"]);
  const atl = L.viewOf(nhl, "group")[0];
  assert.equal(atl.name, "Atlantic Division");
  assert.deepEqual([atl.rows[0].e.record, atl.rows[0].e.stats.pts], ["15-6-3", "33"]);
  assert.equal(L.divisionWord("Atlantic Division", { name: "Eastern Conference", short: "East" }), "Atlantic");
  const mlb = read("mlb", "baseball/mlb");
  assert.equal(L.viewWords(mlb).parent, "League");
  const ale = L.viewOf(mlb, "group")[0];
  assert.deepEqual(abbrs(ale), ["TB", "NYY", "BOS", "BAL", "TOR"]);
  assert.deepEqual(ale.rows.map((r) => r.e.clinch), ["in", "in", "in", "out", "out"]);
  assert.equal(L.viewOf(mlb, "parent")[0].rows[2].division, "West");
});

test("soccer: one table by rank, W-D-L, P GD PTS, its places key once each with a clean colour", () => {
  const s = read("eng.1", "soccer/eng.1");
  assert.equal(s.season, "2026-27");
  assert.equal(s.parents.length, 0);
  assert.equal(L.viewWords(s), null);
  const [table] = L.viewOf(s, "group");
  assert.equal(table.name, "English Premier League");
  assert.equal(table.placeWord, "#");
  assert.deepEqual(table.rows.slice(0, 3).map((r) => [r.place, r.e.abbreviation, r.e.stats.pts]), [[1, "ARS", "28"], [2, "BHA", "22"], [3, "MNC", "22"]]);
  // Arsenal: 9 won, 1 drawn, 1 lost.
  assert.equal(table.rows[0].e.record, "9-1-1");
  assert.deepEqual(L.columnsOf(s).map((c) => c.label), ["P", "GD", "PTS"]);
  assert.deepEqual(L.splitsOf(table.rows[0].e, "soccer/eng.1").map((x) => x.label), ["W-D-L", "GF", "GA"]);
  assert.deepEqual(L.notesOf(s), [
    { text: "Champions League", color: "#81D6AC" },
    { text: "Europa League", color: "#B5E7CE" },
    { text: "Relegation", color: "#FF7F84" },
  ]);
});

test("the couch's groups first (yours, then by fans), the league's order inside every group kept", () => {
  const groups = L.viewOf(read("nfl", "football/nfl"), "group");
  const fans = { 19: { fans: 1, yours: true }, 21: { fans: 3, yours: false }, 6: { fans: 2, yours: false } }; // Giants, Eagles, Cowboys
  const out = L.couchFirst(groups, (id) => fans[id] ?? { fans: 0, yours: false });
  assert.deepEqual(out.map((g) => g.name).slice(0, 2), ["NFC East", "AFC East"]);
  assert.deepEqual(out[0].rows.map((r) => r.e.abbreviation), groups.find((g) => g.name === "NFC East").rows.map((r) => r.e.abbreviation));
  // A spectator: the league's own order.
  assert.deepEqual(L.couchFirst(groups, () => ({ fans: 0, yours: false })).map((g) => g.id), groups.map((g) => g.id));
});

test("no table: null; a split ESPN didn't give isn't drawn", () => {
  assert.equal(readStandings("football/nfl", null, AT), null);
  assert.equal(readStandings("racing/f1", { name: "F1", children: [] }, AT), null);
  assert.deepEqual(L.splitsOf({ stats: { home: "3-1", road: "-" }, record: null }, "football/nfl"), [{ label: "Home", value: "3-1" }]);
});
