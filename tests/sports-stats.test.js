// A sport's stats from its games (src/lib/game/sports-stats.ts, src/lib/server/sports/stats.ts; docs/PLAN-sports-data.md step 4),
// on real lines from the 2026 World Series' Games 1-3 (ESPN, 2026-10-27): which columns add is read from the values (whole
// numbers, "x-y" pairs; never AVG, ERA or IP), a pair's halves are left to it, so far is only the games up to the mark, coming in
// is the season line in the columns the games show, a race lists its places, and the box score and a race's scoreboard read
// into each player's lines. The same against the database and a stand-in ESPN is scripts/dev-test/check-sports-links.js.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { addsAs, addUp, seasonItems, statsView, comingInSeason, comingInLabel, ordinal } = jiti("../src/lib/game/sports-stats.ts");
const { linesOfBox, linesOfField } = jiti("../src/lib/server/sports/stats.ts");

const BAT = ["H-AB", "AB", "R", "H", "RBI", "HR", "BB", "K", "#P", "AVG", "OBP", "SLG"];
const PITCH = ["IP", "H", "R", "ER", "BB", "K", "HR", "PC-ST", "ERA", "PC"];
const bat = (values) => ({ name: "batting", labels: BAT, values });
const pitch = (values) => ({ name: "pitching", labels: PITCH, values });
// Yandy Díaz in Games 1-3, as ESPN's box scores have him.
const YANDY = [
  bat(["0-4", "4", "0", "0", "0", "0", "0", "0", "13", ".279", ".311", ".512"]),
  bat(["0-5", "5", "1", "0", "0", "0", "0", "3", "26", ".250", ".280", ".458"]),
  bat(["2-4", "4", "0", "2", "1", "0", "0", "0", "18", ".269", ".296", ".481"]),
];
const item = (label, value) => ({ label, value });

test("which columns add, read from the values: whole numbers, x-y pairs of them; never rates, thirds of innings, times or places", () => {
  assert.equal(addsAs(["0", "3", "12"]), "count");
  assert.equal(addsAs(["+7", "-3", "0"]), "count", "a plus-minus adds");
  assert.equal(addsAs(["0-4", "3-3", ""]), "pair");
  assert.equal(addsAs(["73-52", "--"]), "pair");
  for (const rate of [[".279", ".316"], ["3.21", "0.00"], ["5.0", "1.2"], ["18:32"], ["1st", "4th"], ["41.1"]]) assert.equal(addsAs(rate), null, rate.join());
  assert.equal(addsAs(["", "-", "--"]), null, "nothing but empties");
  assert.equal(addsAs(["3", "7-31"]), null, "a mix doesn't");
});

test("so far: a hitter's games added up in ESPN's own columns, H-AB carrying H and AB, zeros and rates left out", () => {
  assert.deepEqual(addUp(YANDY.map((t) => [t])), [item("H-AB", "2-13"), item("R", "1"), item("RBI", "1"), item("K", "3"), item("#P", "57")]);
  // One game is that game's counts.
  assert.deepEqual(addUp([[YANDY[0]]]), [item("H-AB", "0-4"), item("#P", "13")], "a hitless game still says 0-4");
});

test("so far: a pitcher's line (PC-ST carrying PC; IP is thirds, so it doesn't add), and a two-way player's both tables", () => {
  const martinez = pitch(["5.0", "5", "2", "2", "0", "5", "0", "73-52", "3.21", "73"]);
  const again = pitch(["1.2", "1", "0", "0", "1", "2", "0", "31-18", "2.45", "31"]);
  assert.deepEqual(addUp([[martinez], [again]]), [item("H", "6"), item("R", "2"), item("ER", "2"), item("BB", "1"), item("K", "7"), item("PC-ST", "104-70")]);
  const twoWay = addUp([[bat(["1-4", "4", "1", "1", "1", "1", "0", "1", "16", ".300", ".400", ".600"]), martinez]]);
  assert.deepEqual(twoWay.map((i) => i.label), ["H-AB", "R", "RBI", "HR", "K", "#P", "H", "R", "ER", "K", "PC-ST"], "batting, then pitching");
});

test("so far: a race's places listed race by race (a place never adds), the latest few", () => {
  const place = (p) => [{ name: null, labels: ["Place"], values: [ordinal(p)] }];
  assert.deepEqual(addUp([place(1), place(4), place(2)]), [item("", "1st"), item("", "4th"), item("", "2nd")]);
  assert.equal(addUp([1, 2, 3, 4, 5, 6, 7].map(place)).length, 5);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"]);
});

test("coming in: the season line's main category, in the columns the games show (else all of it), empties left out", () => {
  const season = [
    { name: "Career Batting", labels: ["GP", "AB", "R", "H", "2B", "HR", "RBI", "BB", "SO", "AVG", "OBP", "SLG", "WAR"], values: ["154", "614", "93", "180", "26", "22", "85", "56", "98", ".293", ".359", ".446", "2.4"] },
    { name: "Expanded Batting", labels: ["PA"], values: ["686"] },
  ];
  assert.deepEqual(seasonItems(season, new Set([...BAT, ...PITCH])).map((i) => `${i.value} ${i.label}`).join(" · "), "614 AB · 93 R · 180 H · 22 HR · 85 RBI · 56 BB · .293 AVG · .359 OBP · .446 SLG");
  assert.equal(seasonItems(season, null).length, 13, "before any game's been played: all of it");
  assert.equal(seasonItems(season, ["D", "G"]).length, 13, "none in common (another sport's games): all of it");
  assert.equal(seasonItems([{ name: "x", labels: ["GP"], values: ["--"] }], null), null);
  assert.equal(seasonItems([], null), null);
});

test("which season is coming in: a postseason's own regular season, else the season before", () => {
  assert.deepEqual(comingInSeason(2026, "post"), { season: 2026, regular: true });
  assert.deepEqual(comingInSeason(2027, "regular"), { season: 2026, regular: true });
  assert.deepEqual(comingInSeason(2026, null), { season: 2025, regular: false }, "a soccer league's season has no stages");
  assert.equal(comingInLabel("2026", true), "2026 regular season");
  assert.equal(comingInLabel("2025-26", false), "2025-26 season");
});

test("the guard: so far only from games up to the mark, through the latest of those with lines; coming in always", () => {
  const lines = [
    { episode: 0, key: "espn:33481", label: "2026 regular season", tables: [{ name: "Career Batting", labels: ["HR", "AVG"], values: ["22", ".293"] }] },
    { episode: 0, key: "espn:9", label: null, tables: [] },
    ...YANDY.map((t, i) => ({ episode: i + 1, key: "espn:33481", tables: [t] })),
    { episode: 2, key: "espn:40810", tables: [bat(["1-4", "4", "0", "1", "0", "0", "0", "2", "20", ".310", ".383", ".405"])] },
  ];
  const at = (mark) => statsView(lines, mark, BAT);
  const none = at(0);
  assert.equal(none.through, null);
  assert.deepEqual(none.people.get("espn:33481"), { comingIn: [item("HR", "22"), item("AVG", ".293")], soFar: null });
  assert.equal(none.comingInLabel, "2026 regular season");
  assert.equal(none.people.has("espn:9"), false, "no season line: nothing");
  const one = at(1);
  assert.equal(one.through, 1);
  assert.deepEqual(one.people.get("espn:33481").soFar, [item("H-AB", "0-4"), item("#P", "13")]);
  assert.equal(one.people.has("espn:40810"), false, "Game 2's line isn't seen at 1");
  const two = at(2);
  assert.deepEqual(two.people.get("espn:33481").soFar, [item("H-AB", "0-9"), item("R", "1"), item("K", "3"), item("#P", "39")]);
  assert.deepEqual(two.people.get("espn:40810"), { comingIn: null, soFar: [item("H-AB", "1-4"), item("K", "2"), item("#P", "20")] });
  assert.equal(at(9).through, 3, "a mark past the games: through the latest with lines");
});

test("a box score into each player's lines (a two-way player's both tables), and a race's places once its part is over", () => {
  const person = (id, name) => ({ id, name, position: null, headshot: null });
  const box = {
    event: "1",
    state: "post",
    final: true,
    teams: [
      {
        team: { id: "30", name: "Tampa Bay Rays", also: [], abbreviation: "TB", logo: null },
        score: "2",
        winner: false,
        tables: [
          { name: "batting", labels: ["H-AB"], rows: [{ person: person("1", "Two Way"), values: ["1-3"], starter: true }, { person: person("2", "Hitter"), values: ["0-4"], starter: true }], totals: null },
          { name: "pitching", labels: ["IP"], rows: [{ person: person("1", "Two Way"), values: ["6.0"], starter: true }], totals: null },
        ],
      },
    ],
  };
  assert.deepEqual(linesOfBox(box), [
    { athlete: "1", name: "Two Way", team: "Tampa Bay Rays", tables: [{ name: "batting", labels: ["H-AB"], values: ["1-3"] }, { name: "pitching", labels: ["IP"], values: ["6.0"] }] },
    { athlete: "2", name: "Hitter", team: "Tampa Bay Rays", tables: [{ name: "batting", labels: ["H-AB"], values: ["0-4"] }] },
  ]);
  const driver = (id, name, place) => ({ team: null, person: person(id, name), home: null, score: null, winner: place === 1, place });
  const race = (state) => ({ id: "gp", league: "racing/f1", name: "GP", short: null, at: null, state, final: state === "post", season: 2026, stage: "regular", note: null, competitors: [], parts: [{ id: "q", name: "Qual", at: null, state: "post", competitors: [driver("a", "Ana", 1)] }, { id: "r", name: "Race", at: null, state, competitors: [driver("b", "Bo", 1), driver("a", "Ana", 2)] }] });
  assert.deepEqual(linesOfField(race("post"), "r"), { lines: [{ athlete: "b", name: "Bo", team: null, tables: [{ name: null, labels: ["Place"], values: ["1st"] }] }, { athlete: "a", name: "Ana", team: null, tables: [{ name: null, labels: ["Place"], values: ["2nd"] }] }], final: true });
  assert.deepEqual(linesOfField(race("in"), "r"), { lines: [], final: false }, "the race still on: no places yet");
  assert.equal(linesOfField(race("in"), "q").lines[0].tables[0].values[0], "1st", "the qualifying part is over");
});
