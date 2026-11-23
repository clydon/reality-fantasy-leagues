// Dev-only: the stand-in world a league's page story and a team's page story share (docs/PLAN-sports-couch.md B1, B2): the ZT
// football league's teams, a season of finals behind Week 12 (weeks 1 to 11; the Eagles' bye in Week 10), this week's games by
// world (gameday: the Eagles on now at the Jets; midweek: all to come), the couch's follows, the stand-in's standings, and the real
// ESPN tables' couch. Times are relative to when this module loads. Required by story-league-page.js and story-team-page.js;
// nothing here writes anything.
const world = require("./check-sports-couch");
const { FB, BB, MB } = world;
const now = Date.now();
const HR = 3600_000;
const D = 24 * HR;
const at = (ms) => new Date(Math.round((now + ms) / 60_000) * 60_000).toISOString();
const endOfDay = new Date(new Date(now).setHours(22, 30, 0, 0)).getTime() - now;
const today = (ms) => at(Math.max(10 * 60_000, Math.min(ms, endOfDay)));
const TEAMS = [
  ...world.TEAMS,
  { id: "9305", name: "ZT Bears", short: "Bears", location: "ZT Chicago", abbreviation: "ZCHI", league: FB, color: "0b162a" },
  { id: "9306", name: "ZT Lions", short: "Lions", location: "ZT Detroit", abbreviation: "ZDET", league: FB, color: "0076b6" },
  // The rest of the league (Scores' busy test): nobody on the couch follows these.
  ...[
    ["9307", "Bills", "ZBUF", "00338d"],
    ["9308", "Chiefs", "ZKC", "e31837"],
    ["9309", "Ravens", "ZBAL", "241773"],
    ["9310", "49ers", "ZSF", "aa0000"],
    ["9311", "Packers", "ZGB", "203731"],
    ["9312", "Rams", "ZLAR", "003594"],
    ["9313", "Bengals", "ZCIN", "fb4f14"],
    ["9314", "Steelers", "ZPIT", "ffb612"],
  ].map(([id, short, abbreviation, color]) => ({ id, name: `ZT ${short}`, short, location: `ZT ${short}`, abbreviation, league: FB, color })),
];
const [BUF, KC, BAL, SF, GB, LAR, CIN, PIT] = ["9307", "9308", "9309", "9310", "9311", "9312", "9313", "9314"];
const [E, C, G, J, B, L] = ["9301", "9302", "9303", "9304", "9305", "9306"];

// Weeks 1 to 11, each [away, home, away's score, home's]: a tie in Week 4, the Eagles' bye in Week 10, the couch's rivalries
// along the way (Giants beat the Eagles in Week 8: alex vs Jordan; Cowboys over the Eagles in Week 7; Jets at Cowboys in Week 8).
const SEASON = [
  [[G, C, 28, 20], [E, B, 21, 17], [J, L, 10, 24]],
  [[C, E, 17, 24], [B, J, 13, 16], [L, G, 20, 23]],
  [[J, G, 19, 26], [E, L, 14, 31], [C, B, 27, 10]],
  [[G, E, 17, 24], [L, C, 21, 21], [B, J, 7, 20]],
  [[E, C, 20, 23], [J, B, 24, 17], [G, L, 10, 30]],
  [[C, J, 26, 19], [B, G, 14, 20], [L, E, 27, 24]],
  [[C, E, 38, 21], [G, J, 13, 16], [L, B, 30, 6]],
  [[G, E, 19, 11], [J, C, 20, 27], [B, L, 17, 24]],
  [[E, J, 23, 20], [C, L, 14, 28], [G, B, 21, 14]],
  [[J, C, 17, 31], [L, G, 20, 27]],
  [[C, G, 10, 17], [E, B, 31, 20], [L, J, 24, 13]],
];
// Week 12 holds today (calendarsAround: from three days back); week i's games a day before its week's end, here.
const weekAt = (i) => (i - 12) * 7 * D - 1 * D;

function footballFor(n, mid) {
  const id = (k) => `96${n}${String(k).padStart(2, "0")}`;
  let k = 0;
  const past = SEASON.flatMap((games, w) => games.map(([away, home, a, h]) => ({ league: FB, id: id(++k), at: at(weekAt(w + 1)), home, away, state: "post", score: [h, a] })));
  const thisWeek = mid
    ? [
        { league: FB, id: id(50), at: at(2 * D + 2 * HR), home: J, away: E, state: "pre", network: "FOX", odds: { details: "ZPHI -2.5", spread: -2.5 } },
        { league: FB, id: id(51), at: at(3 * D), home: G, away: C, state: "pre", network: "CBS" },
        { league: FB, id: id(52), at: at(3 * D + 3 * HR), home: L, away: B, state: "pre", network: "NBC" },
      ]
    : [
        { league: FB, id: id(50), at: at(-1.6 * HR), home: J, away: E, state: "in", score: [10, 14], network: "FOX", clock: { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: E, down: "2nd & 7" } },
        { league: FB, id: id(51), at: today(1.5 * HR), home: G, away: C, state: "pre", network: "CBS", odds: { details: "ZNYG -3", spread: -3 } },
        { league: FB, id: id(52), at: today(4.5 * HR), home: L, away: B, state: "pre", network: "NBC" },
      ];
  // The rest of the league's Week 12: a Thursday final, a 1 PM game on, a late game and Monday's; Week 11's finals of theirs.
  const others = [
    { league: FB, id: id(70), at: at(Math.max(-2.6 * D, -3 * D + 14 * HR)), home: KC, away: BUF, state: "post", score: [27, 24], network: "Prime Video" },
    { league: FB, id: id(71), at: at(-1.5 * HR), home: BAL, away: CIN, state: "in", score: [17, 13], network: "CBS", clock: { period: 3, display: "2:15", detail: "2:15 - 3rd", possession: CIN, down: "3rd & 4" } },
    { league: FB, id: id(72), at: today(2.5 * HR), home: SF, away: LAR, state: "pre", network: "FOX", odds: { details: "ZSF -6.5", spread: -6.5 } },
    { league: FB, id: id(73), at: at(1 * D + 3 * HR), home: GB, away: PIT, state: "pre", network: "ESPN", odds: { details: "ZGB -2", spread: -2 } },
    { league: FB, id: id(74), at: at(weekAt(11) + 1 * HR), home: SF, away: BUF, state: "post", score: [20, 23] },
    { league: FB, id: id(75), at: at(weekAt(11) + 4 * HR), home: CIN, away: GB, state: "post", score: [31, 30] },
  ];
  const later = [
    { league: FB, id: id(60), at: at(7 * D), home: E, away: G, state: "pre" },
    { league: FB, id: id(61), at: at(7 * D + 3 * HR), home: C, away: J, state: "pre" },
    { league: FB, id: id(62), at: at(14 * D), home: C, away: E, state: "pre" },
    { league: FB, id: id(63), at: at(14 * D + 3 * HR), home: J, away: G, state: "pre" },
  ];
  return [...past, ...thisWeek, ...(mid ? [] : others), ...later];
}

const WORLD_N = { gameday: 1, midweek: 2, hidden: 3, lone: 4, none: 5, solo: 6, daily: 7, off: 8, studio: 9 };
function eventsFor(name) {
  const n = WORLD_N[name];
  if (name === "daily")
    return [
      { league: BB, id: `97${n}01`, at: at(-5 * D), home: "9401", away: "9402", state: "post", score: [112, 104] },
      { league: BB, id: `97${n}02`, at: at(-3 * D), home: "9402", away: "9401", state: "post", score: [99, 101] },
      { league: BB, id: `97${n}03`, at: today(1 * HR), home: "9401", away: "9402", state: "pre", network: "ESPN" },
      { league: BB, id: `97${n}04`, at: at(1 * D + 2 * HR), home: "9402", away: "9401", state: "pre", network: "TNT" },
    ];
  if (name === "off") return [];
  return footballFor(n, name === "midweek");
}
const pickemGame = (name) => eventsFor(name).find((e) => e.id.endsWith("51"))?.id;

const COUCH = [["alex", FB, E], ["riley", FB, J], ["sam", FB, C], ["jordan", FB, G]];

// The stand-in's standings (B1 session 4): two conferences of two divisions, each team's line counted from its finals above.
const ZTN = { id: "zt-ztn", name: "ZTN Conference", abbreviation: "ZTN" };
const ZTA = { id: "zt-zta", name: "ZTA Conference", abbreviation: "ZTA" };
const STANDINGS = {
  [FB]: {
    season: "2026",
    groups: [
      { id: "zt-ztn-e", name: "ZTN East", abbreviation: "EAST", parent: ZTN, teams: [E, C, G, J] },
      { id: "zt-ztn-n", name: "ZTN North", abbreviation: "NORTH", parent: ZTN, teams: [B, L, GB, PIT] },
      { id: "zt-zta-w", name: "ZTA West", abbreviation: "WEST", parent: ZTA, teams: [SF, LAR, KC] },
      { id: "zt-zta-s", name: "ZTA South", abbreviation: "SOUTH", parent: ZTA, teams: [BUF, BAL, CIN] },
    ],
  },
  [BB]: { season: "2026-27", groups: [{ id: "zt-atl", name: "ZT Atlantic", abbreviation: "ATL", parent: { id: "zt-east", name: "ZT Eastern Conference", abbreviation: "ZT East" }, teams: ["9401", "9402"] }] },
};
// The real tables' couch: each person's team, by the abbreviation ESPN gives it (ids read from the recorded answers).
const REAL = [
  ["football/nfl", "nfl", [["alex", "PHI"], ["riley", "NYJ"], ["sam", "DAL"], ["jordan", "NYG"]]],
  ["basketball/nba", "nba", [["alex", "PHI"], ["riley", "NY"]]],
  ["hockey/nhl", "nhl", [["alex", "PHI"]]],
  ["baseball/mlb", "mlb", [["alex", "NYY"], ["riley", "TOR"]]],
  ["soccer/eng.1", "eng.1", [["alex", "ARS"], ["sam", "CHE"]]],
];
const realId = (file, abbr) => {
  const walk = (n) => [...(n.standings?.entries ?? []).map((e) => e.team), ...(n.children ?? []).flatMap(walk)];
  return walk(require(`../../tests/fixtures/espn-standings/${file}.json`)).find((t) => t.abbreviation === abbr)?.id;
};


module.exports = { now, at, today, HR, D, endOfDay, TEAMS, SEASON, weekAt, footballFor, WORLD_N, eventsFor, pickemGame, COUCH, STANDINGS, REAL, realId, E, C, G, J, B, L, BUF, KC, BAL, SF, GB, LAR, CIN, PIT, FB, BB, MB };
