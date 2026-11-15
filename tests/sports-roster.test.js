// The bench's real-athlete reader (tools/gameplay-bench/explorer/sports-roster.cjs) on a tiny made-up recording in
// espn-snapshot.js's shape, so it runs without a real one: shares, ranking by box scores, practice squads left out, team
// defenses as the app builds them, shared names told apart.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const Roster = require(path.join(__dirname, "..", "tools/gameplay-bench/explorer/sports-roster.cjs"));

const person = (id, name, abbr, status = "active") => ({ id, name, position: abbr, abbr, headshot: `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`, status });
const table = (name, labels, rows) => ({ name, labels, rows: rows.map(([id, stats]) => ({ id, name: id, position: null, stats })) });
const snap = {
  schemaVersion: 1,
  league: "football/zt",
  recordedAt: "2026-11-15T00:00:00Z",
  calendars: { "football/zt": { season: 2026 } },
  teams: [
    { id: "1", name: "Alpha Ants", abbreviation: "ANT", logo: "a.png", roster: [person("q1", "Quinn One", "QB"), person("q9", "Quiet Squad", "QB", "practice-squad"), person("w1", "Sam Smith", "WR"), person("k1", "Kai Kick", "PK"), person("l1", "Lou Line", "OT")] },
    { id: "2", name: "Beta Bees", abbreviation: "BEE", logo: "b.png", roster: [person("q2", "Quinn Two", "QB"), person("w2", "Sam Smith", "WR"), person("k2", "Kim Kick", "K")] },
  ],
  events: [
    {
      id: "e1", state: "post",
      box: {
        1: { tables: [table("passing", ["C/ATT", "YDS", "TD", "INT"], [["q1", ["20/30", "300", "3", "0"]]]), table("receiving", ["REC", "YDS", "TD"], [["w1", ["5", "80", "1"]]]), table("kicking", ["FG", "XP"], [["k1", ["2/2", "3/3"]]]), table("defensive", ["TOT", "SACKS"], [["l1", ["4", "2"]]])] },
        2: { tables: [table("passing", ["C/ATT", "YDS", "TD", "INT"], [["q2", ["10/30", "100", "0", "2"]]]), table("receiving", ["REC", "YDS", "TD"], [["w2", ["9", "120", "2"]]]), table("kicking", ["FG", "XP"], [["k2", ["0/1", "0/0"]]])] },
      },
    },
  ],
};

test("a pool takes its shares from the real rosters, best first by the box scores", () => {
  const p = Roster.pool(snap, { shares: { QB: 2, WR: 2, PK: 2, DEF: 2 } });
  assert.equal(p.size, 8);
  assert.equal(p.season, 2026);
  const qbs = p.athletes.filter((a) => a.role === "QB");
  assert.deepEqual(qbs.map((a) => a.id), ["q1", "q2"], "the practice squad's quarterback is left out; the better line ranks first");
  assert.ok(qbs[0].value > qbs[1].value);
  assert.equal(p.athletes.find((a) => a.id === "k2").role, "PK", "ESPN's K is the app's PK");
  assert.ok(p.athletes.every((a) => a.photoUrl && a.photoUrl === a.headshot), "each carries photoUrl, the name the bench reads a photo by");
});

test("a team's defense is the app's: def:<team>, its name and D/ST", () => {
  const d = Roster.pool(snap, { shares: { DEF: 2 } }).athletes;
  assert.deepEqual(d.map((a) => a.id).sort(), ["def:1", "def:2"]);
  assert.ok(d.some((a) => a.name === "Alpha Ants D/ST" && a.value === 2), "its sacks count toward its rank");
});

test("a name two athletes share takes each one's team, so the server can tell them apart", () => {
  const names = Roster.pool(snap, { shares: { WR: 2 } }).athletes.map((a) => a.name).sort();
  assert.deepEqual(names, ["Sam Smith (ANT)", "Sam Smith (BEE)"]);
});

test("it refuses what it can't deal: a share bigger than the rosters, a league it hasn't mapped", () => {
  assert.throws(() => Roster.pool(snap, { shares: { QB: 3 } }), /has 2 QB for a share of 3/);
  assert.throws(() => Roster.pool({ ...snap, league: "basketball/zt" }, { shares: { PG: 1 } }), /Only football/);
  assert.throws(() => Roster.pool(snap), /No shares for football\/zt/);
});
