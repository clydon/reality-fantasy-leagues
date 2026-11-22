// Where a game stands (src/lib/sports/situation.ts; docs/PLAN-sports-couch.md A1, the hub's scores strip): the score, the period and
// clock, and football's possession and down and distance, read from ESPN's summary, on the recorded Patriots–Lions game of
// 2026-11-15 (NFL event 401873053). tests/fixtures/espn-situations/nfl-401873053.json is eight of its 266 recorded answers (the
// ignored .ui-atlas/fixtures/espn-live/football-nfl-401873053, by scripts/dev-test/record-espn-live.js), cut to the header and the
// current drive's last play: what the read reads. Also the live read (live.ts LiveGame) keeping it, and the stand-in ESPN's
// summary of a game on (fake-espn.js `clock`) reading the same. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { situationOf } = jiti("../src/lib/sports/situation.ts");
const { LiveGame, sportOf } = jiti("../src/lib/sports/index.ts");
const frames = require("./fixtures/espn-situations/nfl-401873053.json");

const DET = "8";
const NE = "17";
const at = (frame) => frames.find((f) => f._frame === frame);

test("the recorded game, answer by answer: score, clock, the ball and the down", () => {
  const want = [
    ["1794756293223", { period: 2, clock: "11:23", possession: DET, down: "1st & 10", scores: { [DET]: 14, [NE]: 3 } }],
    ["1794756897300", { period: 2, clock: "7:06", possession: DET, down: "2nd & 6" }],
    ["1794758107280", { period: 2, clock: "2:00", possession: NE, down: "2nd & 7", scores: { [DET]: 21, [NE]: 3 } }],
    // After a punt: the drive's last play ends on the Lions' 1st & 10, their ball.
    ["1794760222430", { period: 3, clock: "11:46", possession: DET, down: "1st & 10" }],
    ["1794761733713", { period: 3, clock: "2:21", possession: NE, down: "3rd & 3", scores: { [DET]: 28, [NE]: 3 } }],
    ["1794763548276", { period: 4, clock: "6:22", possession: DET, down: "3rd & 9", scores: { [DET]: 35, [NE]: 10 } }],
  ];
  for (const [frame, w] of want) {
    const s = situationOf(at(frame));
    assert.equal(s.status, "in", frame);
    assert.equal(s.final, false, frame);
    assert.equal(s.half, false, frame);
    for (const [k, v] of Object.entries(w)) assert.deepEqual(s[k], v, `${frame} ${k}`);
  }
});

test("at the half: nobody's ball, no down, the words ESPN gives", () => {
  const s = situationOf(at("1794759316140"));
  assert.equal(s.status, "in");
  assert.equal(s.half, true);
  assert.equal(s.possession, null);
  assert.equal(s.down, null);
  assert.equal(s.detail, "Halftime");
});

test("the final: over, no clock, no ball, no down", () => {
  const s = situationOf(at("1794764273627"));
  assert.equal(s.status, "post");
  assert.equal(s.final, true);
  assert.equal(s.clock, null);
  assert.equal(s.possession, null);
  assert.equal(s.down, null);
  assert.deepEqual(s.scores, { [DET]: 35, [NE]: 10 });
});

test("no game in the answer: nothing", () => {
  assert.equal(situationOf(null), null);
  assert.equal(situationOf({}), null);
});

test("the live read keeps the situation of its latest answer", () => {
  const g = new LiveGame({ sport: sportOf("football/nfl"), league: "football/nfl", event: "401873053", fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }) });
  g.take(at("1794756897300"));
  assert.equal(g.situation.down, "2nd & 6");
  assert.equal(g.situation.possession, DET);
  g.take(at("1794758107280"));
  assert.equal(g.situation.possession, NE);
});

test("the stand-in ESPN's game on reads the same (fake-espn.js clock)", async () => {
  const fake = require("../scripts/dev-test/fake-espn");
  const espn = await fake.start({
    teams: [
      { id: "1", name: "ZT Ones", short: "Ones", location: "ZT", abbreviation: "ZONE", league: "football/zt-x" },
      { id: "2", name: "ZT Twos", short: "Twos", location: "ZT", abbreviation: "ZTWO", league: "football/zt-x" },
    ],
    events: [{ league: "football/zt-x", id: "7", at: new Date().toISOString(), home: "1", away: "2", state: "in", score: [24, 10], clock: { period: 3, display: "6:41", detail: "6:41 - 3rd", possession: "1", down: "2nd & 7" } }],
  });
  try {
    const body = await (await fetch(`${espn.url}/apis/site/v2/sports/football/zt-x/summary?event=7`)).json();
    const s = situationOf(body);
    assert.deepEqual({ period: s.period, clock: s.clock, possession: s.possession, down: s.down, scores: s.scores }, { period: 3, clock: "6:41", possession: "1", down: "2nd & 7", scores: { 1: 24, 2: 10 } });
  } finally {
    await espn.close();
  }
});
