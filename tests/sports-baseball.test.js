// Baseball (src/lib/sports/baseball.ts, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, step L1): its
// vocabulary, ESPN's box score and plays read into its keys, and the proof: each recorded game's plays, reduced, come to ESPN's
// own box score (every player's counts, the team totals ESPN gives, the score), with total bases counted from the plays (ESPN's
// lines have none). The recorded games are the 2026 AL Wild Card Series, Red Sox at Yankees (tests/fixtures/espn/, recorded by
// scripts/dev-test/record-espn.js), which is also the user's first sports example (tests/fixtures/sports-examples.js). The same
// proof against many real games is scripts/dev-test/check-sport-reduce.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports } = jiti("../src/lib/sports/index.ts");
const { callNames, clausesOf, outcomeOf, outsOf, inningsOf, plain } = jiti("../src/lib/sports/baseball.ts");
const examples = require("./fixtures/sports-examples.js");

const baseball = sportOf("baseball/mlb");
const GAME1 = require("./fixtures/espn/mlb-401907924.json");
const GAME2 = require("./fixtures/espn/mlb-401907963.json");
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);

test("Baseball's vocabulary: unique stat keys in its groups, positions in its groups, nine innings, daily locks", () => {
  assert.equal(baseball.id, "baseball");
  assert.equal(sportOf("baseball/college-baseball"), baseball);
  assert.equal(sportById("baseball"), baseball);
  assert.equal(sportOf("basketball/nba"), null, "not built yet");
  assert.deepEqual(allSports().map((s) => s.id), ["baseball"]);
  const keys = baseball.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique: a spec names a stat by its key alone");
  const groups = new Set(baseball.statGroups.map((g) => g.key));
  for (const s of baseball.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    assert.ok(["higher", "lower"].includes(s.better), s.key);
    assert.equal(s.kind === "count", !s.of, `${s.key}: counts are counted, the rest worked out`);
  }
  // A hitter's and a pitcher's share a column's label, never a key.
  assert.equal(baseball.stat("K").short, "K");
  assert.equal(baseball.stat("PK").short, "K");
  assert.equal(baseball.stat("PK").group, "pitching");
  assert.deepEqual(["W", "L", "SV", "HLD", "BS"].map((k) => baseball.stat(k).known), ["final", "final", "final", "final", "final"]);
  const posGroups = new Set(baseball.groups.map((g) => g.key));
  for (const p of baseball.positions) assert.ok(posGroups.has(p.group), p.key);
  for (const g of baseball.groups) for (const s of g.stats) assert.ok(groups.has(s), g.key);
  assert.equal(baseball.lock, "daily");
  assert.equal(baseball.periods.regulation, 9);
  assert.equal(baseball.where({ period: 3, half: "top", clock: null }), "Top 3rd");
  assert.equal(baseball.where({ period: 11, half: "bottom", clock: null }), "Bottom 11th");
  // The context pack's stats: every key but the rates, with its noun ("5 a home run").
  const ctx = baseball.specStats();
  assert.deepEqual(ctx.find((s) => s.key === "HR"), { key: "HR", label: "home run" });
  assert.deepEqual(ctx.find((s) => s.key === "TB"), { key: "TB", label: "total base" });
  assert.ok(!ctx.some((s) => s.key === "AVG"));
});

test("derived and rate stats from counts: total bases, innings pitched, AVG, ERA; only for the groups someone plays in", () => {
  const hitter = baseball.full({ AB: 4, H: 3, "2B": 1, HR: 1, BB: 1, SF: 1 });
  assert.equal(hitter["1B"], 1);
  assert.equal(hitter.TB, 1 + 2 + 4);
  assert.equal(hitter.AVG, 0.75);
  assert.equal(hitter.OBP, 4 / 6);
  assert.equal(hitter.SLG, 7 / 4);
  assert.ok(!("IP" in hitter) && !("QS" in hitter), "a hitter has no innings");
  const starter = baseball.full({ GS: 1, OUTS: 19, ER: 2, PH: 5, PBB: 1 });
  assert.equal(inningsOf(starter.OUTS), "6.1");
  assert.equal(starter.IP, 19 / 3);
  assert.equal(starter.QS, 1);
  assert.equal(starter.ERA, (27 * 2) / 19);
  assert.equal(starter.WHIP, (3 * 6) / 19);
  assert.equal(baseball.full({ GS: 1, OUTS: 17, ER: 1 }).QS, 0, "5.2 innings isn't a quality start");
  assert.ok(!("AVG" in baseball.full({ R: 1 })), "no at-bats, no average");
  assert.deepEqual([outsOf("5.2"), outsOf("0.1"), outsOf("9.0"), outsOf("-")], [17, 1, 27, null]);
});

test("ESPN's box score in Baseball's keys: a hitter's and a pitcher's line, the starter, decisions, zeros kept, team totals", () => {
  const box = baseball.readBox(GAME1);
  assert.equal(box.event, "401907924");
  assert.equal(box.final, true);
  assert.deepEqual(
    box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]),
    [
      ["10", "NYY", true, 9, true],
      ["2", "BOS", false, 0, false],
    ]
  );
  const rice = nameOf(box, "Ben Rice");
  assert.equal(rice.team, "10");
  assert.equal(rice.position, "DH");
  assert.deepEqual(rice.stats, { AB: 5, R: 2, H: 4, RBI: 6, HR: 2, BB: 0, K: 1, NP: 21 });
  assert.ok(!("TB" in rice.stats) && !("2B" in rice.stats), "ESPN's per-player batting has no doubles or total bases");
  const schlittler = nameOf(box, "Cam Schlittler");
  assert.deepEqual(schlittler.stats, { GS: 1, W: 1, L: 0, SV: 0, HLD: 0, BS: 0, OUTS: 19, PH: 2, PR: 0, ER: 0, PBB: 1, PK: 10, PHR: 0, PC: 117, PST: 77 });
  assert.equal(nameOf(box, "Paul Blackburn").stats.HLD, 1);
  assert.equal(nameOf(box, "Paul Blackburn").stats.GS, 0, "a reliever");
  assert.equal(nameOf(box, "Payton Tolle").stats.L, 1);
  // The team's own totals: what its players' lines don't have.
  const nyy = box.teams[0].stats;
  assert.deepEqual([nyy.TB, nyy["2B"], nyy.HR, nyy.PA, nyy.SF, nyy.SH, nyy.GIDP, nyy.OUTS, nyy.PC, nyy.PST], [19, 1, 2, 39, 1, 1, 1, 27, 146, 95]);
  assert.ok(!("ER" in nyy), "a team's earned runs aren't its pitchers' added up");
  assert.equal(baseball.readBox({}), null);
});

for (const [name, game] of [
  ["Game 1 (9-0)", GAME1],
  ["Game 2 (9-2)", GAME2],
]) {
  test(`the proof, ${name}: the plays alone reduce to ESPN's own box score, total bases included`, () => {
    const box = baseball.readBox(game);
    const notes = [];
    const plays = baseball.readPlays(game, notes);
    assert.deepEqual(notes, [], "nothing the reader couldn't read");
    const state = baseball.reduce(plays);
    let compared = 0;
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        if (baseball.stat(k).known === "final") continue;
        assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
        compared++;
      }
    }
    assert.ok(compared > 250, `${compared} numbers compared`);
    // The team totals ESPN gives (doubles, triples, total bases, steals, sacrifices...) are its players' from the plays, added up.
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(baseball.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${t.abbreviation}'s score`);
    }
  });
}

test("plays: in time order, each with its wallclock, inning and half, at-bat, people and deltas", () => {
  const plays = baseball.readPlays(GAME1);
  assert.ok(plays.length > 400);
  // ESPN's stamps step back (a change made in the break, filed after the inning's start): a play is known no earlier than the
  // one before it.
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  const change = plays.find((p) => p.text === "McMahon at third base.");
  assert.equal(change.at, "2026-09-30T01:32:20Z", "stamped 01:31:11, filed after the 5th's start at 01:32:20");
  for (const p of plays) {
    assert.match(p.at, /^2026-09-30T\d\d:\d\d:\d\dZ$/);
    assert.ok(p.period >= 1 && p.period <= 9 && ["top", "bottom"].includes(p.half), p.id);
    // The batting side's (the Red Sox are away, so they bat in the top), a pitching change the fielding side's.
    const batting = p.half === "top" ? "2" : "10";
    assert.equal(p.team, p.kind === "pitching-change" ? (batting === "2" ? "10" : "2") : batting, `${p.id} ${p.kind}`);
  }
  // Rice's grand slam: the play's people, its deltas (the batter, the three runners, and the runs charged to the pitchers who
  // put them on: Olds walked two of them, Bello the third and Rice), and the score after it.
  const slam = plays.find((p) => p.kind === "home-run" && /McMahon, Jones, and Goldschmidt scored/.test(p.text));
  const box = baseball.readBox(GAME1);
  const id = (n) => nameOf(box, n).id;
  assert.equal(baseball.where(slam), "Bottom 8th");
  assert.equal(slam.unit, "4019079241507");
  assert.deepEqual(slam.score, { 2: 0, 10: 9 });
  assert.deepEqual(slam.deltas[id("Ben Rice")], { PA: 1, AB: 1, H: 1, HR: 1, RBI: 4, R: 1 });
  for (const n of ["Ryan McMahon", "Spencer Jones", "Paul Goldschmidt"]) assert.deepEqual(slam.deltas[id(n)], { R: 1 }, n);
  const pitchers = Object.entries(slam.deltas).filter(([, d]) => d.PR).map(([w, d]) => [box.people[w].name, d.PR, d.ER]);
  assert.deepEqual(pitchers.sort(), [
    ["Brayan Bello", 2, 2],
    ["Wyatt Olds", 2, 2],
  ].sort());
  // A pitch adds to the pitcher's count and the batter's pitches seen; a ball isn't a strike.
  const ball = plays.find((p) => p.kind === "ball");
  assert.deepEqual(Object.values(ball.deltas).sort((a, b) => Object.keys(a).length - Object.keys(b).length), [{ NP: 1 }, { PC: 1 }]);
});

test("a game as of a moment: stateAt(t) is the plays up to t, so live and a later watch are one path", () => {
  const plays = baseball.timeline(GAME1);
  const before = baseball.reduce(plays, "2026-09-30T00:00:00Z");
  assert.deepEqual([before.plays, before.last, before.score, before.lines], [0, null, {}, {}]);
  const fifth = plays.find((p) => p.kind === "inning" && p.period === 5 && p.half === "top");
  const mid = baseball.reduce(plays, fifth.at);
  assert.deepEqual(mid.score, { 2: 0, 10: 1 });
  assert.equal(baseball.where(mid.last), "Top 5th");
  const rice = nameOf(baseball.readBox(GAME1), "Ben Rice").id;
  assert.equal(mid.lines[rice]?.HR ?? 0, 0, "his home runs come in the 5th and the 8th");
  const after5 = baseball.reduce(plays, "2026-09-30T01:52:00Z");
  assert.equal(after5.lines[rice].HR, 1);
  assert.deepEqual(after5.score, { 2: 0, 10: 2 });
  // Dates and numbers work as well as strings; the end is the final.
  assert.deepEqual(baseball.reduce(plays, new Date("2026-09-30T01:52:00Z")).score, after5.score);
  assert.deepEqual(baseball.reduce(plays, Date.parse("2026-09-30T01:52:00Z")).score, after5.score);
  assert.deepEqual(baseball.stateAt(GAME1).score, { 2: 0, 10: 9 });
});

test("the final's correction: what only the final box score knows (a win, a loss, a hold) comes last; the plays' own need none", () => {
  for (const game of [GAME1, GAME2]) {
    const box = baseball.readBox(game);
    const correction = baseball.correction(baseball.reduce(baseball.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) {
      for (const k of Object.keys(d)) assert.equal(baseball.stat(k).known, "final", `${box.people[who].name} ${k}: only final-only stats need correcting`);
    }
    const timeline = baseball.timeline(game);
    const last = timeline[timeline.length - 1];
    assert.equal(last.final, true);
    assert.equal(last.kind, "final");
    assert.equal(last.at, timeline[timeline.length - 2].at);
    assert.deepEqual(last.deltas, correction);
    // With it, every number of ESPN's box score.
    const end = baseball.reduce(timeline);
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  }
  const box = baseball.readBox(GAME1);
  const correction = baseball.correction(baseball.reduce(baseball.readPlays(GAME1)), box);
  assert.deepEqual(
    Object.entries(correction).map(([w, d]) => [box.people[w].name, d]).sort(),
    [
      ["Cam Schlittler", { W: 1 }],
      ["Paul Blackburn", { HLD: 1 }],
      ["Payton Tolle", { L: 1 }],
    ].sort()
  );
  // A scoring change after the play (a hit made an error): the final's correction takes it back.
  const changed = JSON.parse(JSON.stringify(GAME1));
  const rows = changed.boxscore.players.find((t) => t.team.id === "10").statistics.find((t) => t.type === "batting");
  const riceRow = rows.athletes.find((a) => a.athlete.displayName === "Ben Rice");
  riceRow.stats[rows.labels.indexOf("H")] = "3";
  const fixed = baseball.timeline(changed).pop();
  assert.equal(fixed.deltas[riceRow.athlete.id].H, -1);
  // Live (not final): just the plays, provisional.
  const live = JSON.parse(JSON.stringify(GAME1));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!baseball.timeline(live).some((p) => p.final));
  // Someone the plays credited who isn't in ESPN's box score: taken back.
  const state = baseball.reduce(baseball.readPlays(GAME1));
  state.lines.zt9 = { R: 1, PA: 1 };
  assert.deepEqual(baseball.correction(state, box).zt9, { R: -1, PA: -1 });
  // A final with no timed plays: its correction has no time, so no moment sees it (a later watch isn't spoiled); the end does.
  const bare = JSON.parse(JSON.stringify(GAME1));
  bare.plays = [];
  const only = baseball.timeline(bare);
  assert.deepEqual([only.length, only[0].final, only[0].at], [1, true, null]);
  assert.deepEqual(baseball.reduce(only, "2026-09-30T02:00:00Z").lines, {});
  assert.deepEqual(baseball.reduce(only).score, { 2: 0, 10: 9 });
});

test("a thinner box score (no #P, no PC-ST: college's) says nothing about the columns it doesn't have", () => {
  const thin = JSON.parse(JSON.stringify(GAME1));
  for (const side of thin.boxscore.players) {
    for (const t of side.statistics) {
      for (const label of ["#P", "PC-ST", "PC"]) {
        const i = t.labels.indexOf(label);
        if (i < 0) continue;
        t.labels.splice(i, 1);
        for (const a of t.athletes) a.stats.splice(i, 1);
      }
    }
  }
  const box = baseball.readBox(thin);
  const rice = nameOf(box, "Ben Rice");
  assert.deepEqual(rice.stats, { AB: 5, R: 2, H: 4, RBI: 6, HR: 2, BB: 0, K: 1 });
  assert.ok(!("PC" in nameOf(box, "Cam Schlittler").stats));
  // So the final's correction leaves the plays' pitch counts alone.
  const fixed = baseball.timeline(thin).pop();
  assert.ok(!Object.values(fixed.deltas).some((d) => "NP" in d || "PC" in d || "PST" in d));
});

test("the reader's words: names as ESPN's text writes them, clauses with their subjects, the batter's outcome", () => {
  assert.deepEqual(callNames("Victor Mesa Jr."), ["victor mesa jr.", "mesa jr.", "v. mesa jr.", "vi. mesa jr.", "vic. mesa jr.", "victor mesa", "mesa", "v. mesa", "vi. mesa", "vic. mesa"]);
  assert.ok(callNames("Weston Wilson").includes("we. wilson"), "ESPN's way of telling two Wilsons apart");
  assert.ok(callNames("Ji Hwan Bae").includes("bae") && callNames("Ji Hwan Bae").includes("hwan bae"));
  assert.equal(plain("Yandy Díaz"), "yandy diaz");
  const people = { r: "Ben Rice", m: "Ryan McMahon", j: "Spencer Jones", g: "Paul Goldschmidt", w: "Weston Wilson", k: "Steven Kwan" };
  const who = (clause) => {
    const words = plain(clause).split(" ");
    let best = null;
    for (const [id, name] of Object.entries(people)) {
      for (const n of callNames(name)) {
        const k = n.split(" ").length;
        if (words.slice(0, k).join(" ") === n && (!best || k > best.words)) best = { id, words: k };
      }
    }
    return best;
  };
  assert.deepEqual(clausesOf("Rice homered to center (408 feet), McMahon, Jones, and Goldschmidt scored.", who), [
    { id: "r", rest: "homered to center (408 feet)" },
    { id: "m", rest: "scored" },
    { id: "j", rest: "scored" },
    { id: "g", rest: "scored" },
  ]);
  assert.deepEqual(clausesOf("Kwan singled to center, Rice scored and Jones scored.", who).map((c) => [c.id, c.rest]), [
    ["k", "singled to center"],
    ["r", "scored"],
    ["j", "scored"],
  ]);
  assert.deepEqual(clausesOf("Kwan picked off and caught stealing second, catcher to shortstop.", who), [
    { id: "k", rest: "picked off and caught stealing second" },
    { id: null, rest: "catcher to shortstop" },
  ]);
  assert.deepEqual(clausesOf("Jones grounded out to first, Rice scored. New York Yankees challenged: call on the field was upheld.", who).map((c) => c.rest), ["grounded out to first", "scored"]);
  assert.deepEqual(clausesOf("We. Wilson singled to left.", who), [{ id: "w", rest: "singled to left" }]);
  // 2026's ABS challenge: the result after the colon, in MLB's own sentences.
  assert.deepEqual(clausesOf("Ryan McMahon challenged (pitch result), call on the field was overturned: Steven Kwan walks. Ben Rice scores. Spencer Jones to 3rd.", who), [
    { id: "k", rest: "walks" },
    { id: "r", rest: "scores" },
    { id: "j", rest: "to 3rd" },
  ]);
  const outcomes = {
    "singled to right": "single",
    "reached on infield single to shortstop": "single",
    "hit a ground rule double": "double",
    "doubled to center": "double",
    "tripled to right": "triple",
    "homered to center (423 feet)": "home-run",
    walked: "walk",
    walks: "walk",
    "intentionally walked": "intentional-walk",
    "hit by pitch": "hit-by-pitch",
    "struck out swinging": "strikeout",
    "called out on strikes": "strikeout",
    "hit sacrifice fly to left": "sac-fly",
    "sacrificed into double play, left to catcher to third": "sac-fly",
    "sacrificed to pitcher": "sac-bunt",
    "hit sacrifice bunt to third": "sac-bunt",
    "lined into double play, third to second": "double-play",
    "grounded into double play, shortstop to first": "double-play",
    "grounded into fielder's choice to second": "fielders-choice",
    "safe at first on throwing error by shortstop Pratt": "error",
    "grounded out to second": "out",
    "flied out to right": "out",
  };
  for (const [rest, want] of Object.entries(outcomes)) assert.equal(outcomeOf(rest), want, rest);
});

// A made-up game for ESPN's quirks, one at-bat at a time: the plays of a top half, the away team (1) batting.
function quirk(plays) {
  const athlete = (id, name, pos) => ({ athlete: { id, displayName: name }, position: { abbreviation: pos }, stats: [] });
  return {
    header: { id: "zt1", competitions: [{ status: { type: { state: "in", completed: false } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", displayName: "ZT Away", abbreviation: "ZTA" } }, { homeAway: "home", score: "0", team: { id: "2", displayName: "ZT Home", abbreviation: "ZTH" } }] }] },
    boxscore: {
      players: [
        { team: { id: "1" }, statistics: [{ type: "batting", labels: [], athletes: [athlete("b1", "Al Able", "SS"), athlete("b2", "Bo Baker", "CF"), athlete("b3", "Cy Cole", "PR"), athlete("b4", "Di Dunn", "1B")] }] },
        { team: { id: "2" }, statistics: [{ type: "pitching", labels: [], athletes: [athlete("p1", "Ed Ewing", "P")] }] },
      ],
    },
    plays: [{ id: "s", type: { type: "start-inning" }, period: { type: "Top", number: 1 }, wallclock: "2026-10-01T00:00:00Z" }, ...plays],
  };
}
const at = (n) => `2026-10-01T00:0${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}Z`;
const role = (...pairs) => pairs.map(([type, id]) => ({ type, athlete: { id } }));
const start = (ab, t, batter, on = []) => ({ id: `${ab}a`, type: { type: "start-batterpitcher" }, summaryType: "A", atBatId: ab, wallclock: at(t), participants: role(["pitcher", "p1"], ["batter", batter], ...on) });
const pitch = (ab, t, n, type, batter) => ({ id: `${ab}p${n}-${type}`, type: { type }, summaryType: "P", atBatId: ab, atBatPitchNumber: n, wallclock: at(t), participants: role(["pitcher", "p1"], ["batter", batter]) });
const result = (ab, t, n, text, batter, on = [], extra = {}) => ({ id: `${ab}r`, type: { type: "play-result" }, summaryType: extra.scoreValue ? "S" : "N", atBatId: ab, atBatPitchNumber: n, text, wallclock: at(t), participants: role(["pitcher", "p1"], ...(batter ? [["batter", batter]] : []), ...on), ...extra });

test("ESPN's quirks: a pitch filed twice, pitches past an at-bat's end, a pinch runner its at-bat starts don't show, an out never recorded", () => {
  const game = quirk([
    // Pitch 2 filed again when the scorer changed a single to an error; then pitches 3-4 filed under the at-bat after its end.
    start("1", 1, "b1"),
    pitch("1", 2, 1, "ball", "b1"),
    pitch("1", 3, 2, "single", "b1"),
    pitch("1", 4, 2, "batter-reached-on-error---batter-to-first", "b1"),
    pitch("1", 5, 3, "strike-looking", "b1"),
    pitch("1", 6, 4, "ball", "b1"),
    result("1", 7, 2, "Able safe at first on throwing error by shortstop Ewing.", "b1", [["onFirst", "b1"]], { outs: 0 }),
    // Cole runs for Able; the next at-bat's start still shows Able on first.
    { id: "sub", type: { type: "play-result" }, summaryType: "N", text: "Cole ran for Able", wallclock: at(8) },
    start("2", 9, "b2", [["onFirst", "b1"]]),
    pitch("2", 10, 1, "triple", "b2"),
    result("2", 11, 1, "Baker tripled to center, Cole scored.", "b2", [["onThird", "b2"]], { outs: 0, scoreValue: 1 }),
    start("3", 12, "b4", [["onThird", "b2"]]),
    pitch("3", 13, 1, "fly-out", "b4"),
    result("3", 14, 1, "Dunn flied out to center.", "b4", [["onThird", "b2"]], { outs: 1 }),
    // The inning ends with one out on record: two weren't recorded.
    { id: "end", type: { type: "end-inning" }, text: "Middle of the 1st inning", wallclock: at(20) },
    { id: "s2", type: { type: "start-inning" }, period: { type: "Bottom", number: 1 }, wallclock: at(30) },
  ]);
  const notes = [];
  const plays = baseball.readPlays(game, notes);
  const lines = baseball.reduce(plays).lines;
  assert.deepEqual(lines.b1, { NP: 2, PA: 1, AB: 1 }, "two pitches seen, reached on an error: an at-bat, no hit");
  assert.deepEqual(lines.b3, { R: 1 }, "the pinch runner scored, not the one he ran for");
  assert.deepEqual(lines.b2, { NP: 1, PA: 1, AB: 1, H: 1, "3B": 1, RBI: 1 });
  // Four pitches (a ball, then the single that became an error, the triple and the fly-out: three strikes), the unearned run
  // (the runner reached on an error) and the outs never recorded.
  assert.deepEqual(lines.p1, { GS: 1, PC: 4, PST: 3, PH: 1, PR: 1, OUTS: 3 });
  assert.ok(notes.some((n) => /2 out\(s\) not recorded/.test(n)));
  assert.equal(plays.find((p) => p.kind === "outs").text, "Middle of the 1st inning");
  // A steal ESPN records twice, the play-result with a review note its typed twin doesn't have: one steal.
  const steal = quirk([
    start("1", 1, "b1"),
    result("1", 2, 1, "Able walked.", "b1", [["onFirst", "b1"]], { outs: 0 }),
    start("2", 3, "b2", [["onFirst", "b1"]]),
    { id: "sb", type: { type: "stolen-base" }, text: "Able stole second.", wallclock: at(4), participants: role(["pitcher", "p1"], ["onSecond", "b1"]) },
    { id: "sbr", type: { type: "play-result" }, summaryType: "N", atBatId: "2", text: "Able stole second. ZT Home challenged: call on the field was upheld.", wallclock: at(4), participants: role(["pitcher", "p1"], ["onSecond", "b1"]), outs: 0 },
  ]);
  assert.equal(baseball.reduce(baseball.readPlays(steal)).lines.b1.SB, 1);
});

test("the Red Sox–Yankees series as the user typed it: 5 a home run and 1 a total base, over the two recorded games", () => {
  const ex = examples.redSoxYankees;
  const keys = new Set(baseball.specStats().map((s) => s.key));
  for (const k of Object.keys(ex.spec.score.points)) assert.ok(keys.has(k), `${k} is one of Baseball's keys`);
  assert.deepEqual(ex.recorded.map((f) => require(`./fixtures/${f}`).header.id), ex.games);
  const totals = new Map();
  for (const f of ex.recorded) {
    const game = require(`./fixtures/${f}`);
    const box = baseball.readBox(game);
    assert.deepEqual(new Set(box.teams.map((t) => t.id)), new Set(ex.spec.pool.where.teams));
    for (const [id, counts] of Object.entries(baseball.reduce(baseball.timeline(game)).lines)) {
      const full = baseball.full(counts);
      const t = totals.get(id) ?? { name: box.people[id].name, HR: 0, TB: 0, points: 0 };
      t.HR += full.HR ?? 0;
      t.TB += full.TB ?? 0;
      for (const [k, p] of Object.entries(ex.spec.score.points)) t.points += p * (full[k] ?? 0);
      totals.set(id, t);
    }
  }
  const best = [...totals.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)).slice(0, ex.settles.best.length);
  assert.deepEqual(best, ex.settles.best);
});

test("Baseball's defaults are data the spec reads: stat keys, slots of its positions, daily locks, the specs a game starts from", () => {
  const d = defaultsFor("baseball");
  assert.equal(d.sport, "baseball");
  assert.equal(defaultsFor("curling"), null);
  for (const k of Object.keys(d.scoring.points)) assert.ok(baseball.stat(k) && baseball.stat(k).kind !== "rate", `${k} scores`);
  for (const k of d.categories.stats) assert.ok(baseball.stat(k), `${k} is a category`);
  const fill = new Set([...baseball.positions.map((p) => p.key), ...baseball.groups.map((g) => g.key)]);
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(fill.has(t), `${s.slot} takes ${t}`);
  assert.equal(d.closes, baseball.lock);
  const starters = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  const season = d.specs.season.spec;
  assert.equal(season.count.start, starters, "the season's lineup is its slots");
  assert.equal(season.get.each, starters + d.slots.bench, "and its draft the slots and the bench");
  assert.equal(season.closes, d.closes);
  for (const { spec } of Object.values(d.specs)) {
    assert.equal(spec.spec, 1);
    assert.equal(spec.score.by, "stats");
    assert.deepEqual(spec.score.points, d.scoring.points);
  }
});
