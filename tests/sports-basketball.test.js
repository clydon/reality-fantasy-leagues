// Basketball (src/lib/sports/basketball.ts, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, step L1 part 2):
// its vocabulary, ESPN's box score and plays read into its keys, and the proof: the recorded game's plays, reduced, come to
// ESPN's own box score (every player's counts, the team totals ESPN gives, the score), minutes and plus/minus coming from the
// final's correction. The recorded game is the 76ers' 2026-27 home opener, Cavaliers at 76ers (tests/fixtures/espn/, recorded
// by scripts/dev-test/record-espn.js), which is also the user's second sports example (tests/fixtures/sports-examples.js).
// The same proof against many real games is scripts/dev-test/check-sport-reduce.js --league=basketball/nba. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports } = jiti("../src/lib/sports/index.ts");
const examples = require("./fixtures/sports-examples.js");

const basketball = sportOf("basketball/nba");
const OPENER = require("./fixtures/espn/nba-401909093.json");
const WNBA_FINALS = require("./fixtures/espn/wnba-401918306.json");
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);

test("Basketball's vocabulary: unique stat keys, positions in their groups, four quarters, daily locks; the NBA and the WNBA", () => {
  assert.equal(basketball.id, "basketball");
  assert.equal(sportOf("basketball/wnba"), basketball);
  assert.equal(sportById("basketball"), basketball);
  assert.notEqual(sportOf("basketball/mens-college-basketball"), basketball, "college is its own feed: tests/sports-college-basketball.test.js");
  assert.ok(allSports().includes(basketball));
  const keys = basketball.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique: a spec names a stat by its key alone");
  const groups = new Set(basketball.statGroups.map((g) => g.key));
  for (const s of basketball.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    assert.ok(["higher", "lower"].includes(s.better), s.key);
    assert.equal(s.kind === "count", !s.of, `${s.key}: counts are counted, the rest worked out`);
  }
  // What the plays can't say (who's on the floor) is the final's.
  assert.deepEqual(basketball.stats.filter((s) => s.known === "final").map((s) => s.key), ["MIN", "PM"]);
  // The statistician's calls, which ESPN's box score can credit to someone else after the play.
  assert.deepEqual(basketball.stats.filter((s) => s.judged).map((s) => s.key), ["OREB", "DREB", "REB", "AST", "STL", "BLK", "TO"]);
  assert.equal(basketball.stat("TO").better, "lower");
  const posGroups = new Set(basketball.groups.map((g) => g.key));
  for (const p of basketball.positions) assert.ok(posGroups.has(p.group), p.key);
  for (const g of basketball.groups) for (const s of g.stats) assert.ok(groups.has(s), g.key);
  assert.equal(basketball.lock, "daily");
  assert.equal(basketball.where({ period: 2, half: null, clock: "5:32" }), "2nd quarter, 5:32");
  assert.equal(basketball.where({ period: 5, half: null, clock: "3:10" }), "overtime, 3:10");
  assert.equal(basketball.where({ period: 6, half: null, clock: null }), "2nd overtime");
  const ctx = basketball.specStats();
  assert.deepEqual(ctx.find((s) => s.key === "PTS"), { key: "PTS", label: "point" });
  assert.deepEqual(ctx.find((s) => s.key === "3PM"), { key: "3PM", label: "three-pointer made" });
  assert.ok(!ctx.some((s) => s.key === "FG%"));
});

test("derived and rate stats: shooting percentages, a double-double and a triple-double, game by game", () => {
  const line = basketball.full({ PTS: 24, REB: 11, AST: 4, FGM: 9, FGA: 18, "3PM": 2, "3PA": 5, FTM: 4, FTA: 4 });
  assert.equal(line["FG%"], 0.5);
  assert.equal(line["3P%"], 0.4);
  assert.equal(line["FT%"], 1);
  assert.deepEqual([line.DD, line.TD], [1, 0]);
  const triple = basketball.full({ PTS: 18, REB: 12, AST: 10, STL: 1 });
  assert.deepEqual([triple.DD, triple.TD], [1, 1]);
  assert.ok(!("FG%" in triple), "no attempts, no percentage");
});

test("ESPN's box score in Basketball's keys: made and attempted pairs, minutes and plus/minus, who didn't play, the team's totals", () => {
  const box = basketball.readBox(OPENER);
  assert.equal(box.event, "401909093");
  assert.equal(box.final, true);
  assert.deepEqual(
    box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]),
    [
      ["20", "PHI", true, 114, true],
      ["5", "CLE", false, 106, false],
    ]
  );
  const maxey = nameOf(box, "Tyrese Maxey");
  assert.equal(maxey.team, "20");
  assert.equal(maxey.position, "G");
  assert.deepEqual(maxey.stats, { MIN: 42, PTS: 32, FGM: 12, FGA: 23, "3PM": 2, "3PA": 7, FTM: 6, FTA: 8, REB: 3, AST: 6, TO: 2, STL: 2, BLK: 0, OREB: 1, DREB: 2, PF: 4, PM: 19 });
  assert.equal(nameOf(box, "Joel Embiid").position, "C");
  // Someone who didn't play is in it, with no numbers at all.
  assert.deepEqual(nameOf(box, "Dean Wade").stats, {});
  assert.deepEqual(box.teams[0].stats, { FGM: 42, FGA: 92, "3PM": 7, "3PA": 28, FTM: 23, FTA: 30, REB: 44, OREB: 9, DREB: 35, AST: 24, STL: 10, BLK: 2, TO: 16, PF: 23 });
  assert.equal(basketball.readBox({}), null);
});

test("the proof, the 76ers opener: the plays alone reduce to ESPN's own box score, every team total and the score", () => {
  const box = basketball.readBox(OPENER);
  const notes = [];
  const plays = basketball.readPlays(OPENER, notes);
  assert.deepEqual(notes, [], "nothing the reader couldn't read");
  const state = basketball.reduce(plays);
  let compared = 0;
  for (const p of Object.values(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) {
      if (basketball.stat(k).known === "final") continue;
      assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
      compared++;
    }
  }
  assert.ok(compared > 280, `${compared} numbers compared`);
  // Nobody the plays credit is missing from the box score or someone who didn't play.
  for (const id of Object.keys(state.lines)) assert.ok(Object.keys(box.people[id]?.stats ?? {}).length, `${id} played`);
  for (const t of box.teams) {
    const sum = {};
    for (const p of Object.values(box.people)) {
      if (p.team !== t.id) continue;
      for (const [k, v] of Object.entries(basketball.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
    }
    for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${t.abbreviation} ${k}`);
    assert.equal(state.score[t.id], t.score, `${t.abbreviation}'s score`);
  }
});

test("the WNBA: the 2026 Finals' Game 2 reduces to ESPN's box score, and a long miss at the buzzer is an attempt (no heave rule)", () => {
  assert.equal(sportOf("basketball/wnba"), basketball);
  const box = basketball.readBox(WNBA_FINALS);
  assert.deepEqual(box.teams.map((t) => [t.abbreviation, t.home, t.score, t.winner]), [["GS", true, 65, false], ["ATL", false, 79, true]]);
  const notes = [];
  const plays = basketball.readPlays(WNBA_FINALS, notes);
  assert.deepEqual(notes, []);
  const state = basketball.reduce(plays);
  let compared = 0;
  for (const p of Object.values(box.people))
    for (const [k, v] of Object.entries(p.stats)) {
      if (basketball.stat(k).known === "final") continue;
      assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
      compared++;
    }
  assert.equal(compared, 300);
  for (const t of box.teams) assert.equal(state.score[t.id], t.score);
  // The WNBA's feed types no shot a heave (none in its 2026 season's 120 games checked): its long misses in a quarter's last
  // seconds are typed as any shot, and ESPN's box counts each as the shooter's attempt (39 in 35 of those games, all exact).
  assert.ok(!WNBA_FINALS.plays.some((p) => /heave/i.test(p.type.text + p.text)));
  const buzzer = plays.filter((p) => p.kind === "miss" && Number(/(\d+)-foot/.exec(p.text)?.[1]) >= 36 && Number(p.clock) <= 3);
  assert.ok(buzzer.length >= 1, "a long miss at the buzzer");
  for (const p of buzzer) assert.equal(Object.values(p.deltas)[0].FGA, 1, p.text);
  const end = basketball.reduce(basketball.timeline(WNBA_FINALS));
  for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k} with the final`);
});

test("plays: in time order, each with its quarter, clock, possession, people and deltas", () => {
  const plays = basketball.readPlays(OPENER);
  assert.equal(plays.length, 513);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  for (const p of plays) {
    assert.ok(p.period >= 1 && p.period <= 4 && p.half === null, p.id);
    assert.match(p.clock, /^\d+(?::\d\d|\.\d)$/, p.id);
  }
  // The tip: the Cavaliers' (Harden gains possession), their first possession; Allen's basket ends it.
  assert.deepEqual([plays[0].kind, plays[0].team, plays[0].unit, plays[0].clock], ["jump-ball", "5", "401909093:1", "12:00"]);
  assert.deepEqual(plays[1].deltas, { 4066328: { FGA: 1, FGM: 1, PTS: 2 } });
  assert.deepEqual(plays[1].score, { 5: 2, 20: 0 });
  // Embiid's turnover, Mitchell's steal: the 76ers' possession, then the Cavaliers'.
  const steal = plays.find((p) => p.kind === "turnover" && /Mitchell steals/.test(p.text));
  assert.deepEqual(steal.deltas, { 3059318: { TO: 1 }, 3908809: { STL: 1 } });
  assert.equal(steal.unit, "401909093:2");
  // A block: the shooter's miss is an attempt, the blocker's a block.
  const block = plays.find((p) => p.kind === "blocked");
  assert.match(block.text, /^LeBron James blocks Evan Mobley/);
  assert.deepEqual(block.deltas, { 1966: { BLK: 1 }, 4432158: { FGA: 1 } });
  // An assisted three: the shooter's three and the passer's assist.
  const three = plays.find((p) => p.kind === "three" && /LeBron James makes 27-foot/.test(p.text));
  assert.deepEqual(three.deltas, { 1966: { FGA: 1, FGM: 1, "3PA": 1, "3PM": 1, PTS: 3 }, 5124612: { AST: 1 } });
  // An and-one's free throw is the same possession as its basket.
  const andOne = plays.findIndex((p) => p.kind === "free-throw" && p.text === "VJ Edgecombe makes free throw 1 of 1");
  const basket = plays.slice(0, andOne).reverse().find((p) => p.kind === "field-goal");
  assert.equal(basket.text, "VJ Edgecombe makes 1-foot layup (LeBron James assists)");
  assert.equal(plays[andOne].unit, basket.unit);
  // Possessions go back and forth: a couple of hundred in a game.
  const units = new Set(plays.map((p) => p.unit).filter(Boolean));
  assert.ok(units.size > 190 && units.size < 240, `${units.size} possessions`);
});

test("a game as of a moment: the score and Maxey's points at the half, then the final", () => {
  const plays = basketball.timeline(OPENER);
  const half = plays.find((p) => p.kind === "period-end" && p.period === 2);
  const at = basketball.reduce(plays, half.at);
  assert.deepEqual(at.score, { 5: 69, 20: 45 });
  const maxey = nameOf(basketball.readBox(OPENER), "Tyrese Maxey").id;
  assert.equal(at.lines[maxey].PTS, 15);
  assert.ok(!("MIN" in at.lines[maxey]), "minutes come with the final");
  assert.equal(basketball.where(at.last), "2nd quarter, 0.0");
  const end = basketball.reduce(plays);
  assert.deepEqual(end.score, { 5: 106, 20: 114 });
  assert.equal(end.lines[maxey].PTS, 32);
  assert.equal(end.lines[maxey].MIN, 42);
  assert.equal(end.lines[maxey].PM, 19);
});

test("the final's correction: only minutes and plus/minus, and with it every number of ESPN's box score", () => {
  const box = basketball.readBox(OPENER);
  const correction = basketball.correction(basketball.reduce(basketball.readPlays(OPENER)), box);
  for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.equal(basketball.stat(k).known, "final", `${box.people[who].name} ${k}`);
  const end = basketball.reduce(basketball.timeline(OPENER));
  for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  const live = JSON.parse(JSON.stringify(OPENER));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!basketball.timeline(live).some((p) => p.final));
  // A rebound the plays credit to someone who didn't play (Dean Wade): the final takes it back.
  const moved = JSON.parse(JSON.stringify(OPENER));
  const wade = nameOf(box, "Dean Wade").id;
  const rebound = moved.plays.find((q) => q.type.text === "Defensive Rebound" && q.participants?.[0]?.athlete?.id === "3908809");
  rebound.participants[0].athlete.id = wade;
  const fixed = basketball.reduce(basketball.timeline(moved));
  assert.equal(fixed.lines[wade], undefined);
  assert.equal(fixed.lines["3908809"].REB, 10);
});

test("the 76ers opener as the user typed it: the winner, the total against ESPN's line, and the top scorers tied at 32", () => {
  const ex = examples.sixersOpener;
  assert.deepEqual(ex.recorded.map((f) => require(`./fixtures/${f}`).header.id), ex.games);
  const keys = new Set(basketball.specStats().map((s) => s.key));
  for (const q of ex.spec.ask) if (q.settle.by === "stat") assert.ok(keys.has(q.settle.stat), `${q.settle.stat} is one of Basketball's keys`);
  const game = require(`./fixtures/${ex.recorded[0]}`);
  const box = basketball.readBox(game);
  assert.deepEqual(new Set(box.teams.map((t) => t.id)), new Set(ex.spec.pool.where.teams));
  // ESPN's line before it (the summary's pickcenter): the over/under's default.
  const line = game.pickcenter[0];
  assert.deepEqual({ provider: line.provider.name, details: line.details, overUnder: line.overUnder }, ex.line);
  assert.equal(ex.spec.ask.find((q) => q.id === "total").line, line.overUnder);
  // What it settles to, from the game as its plays and the final's correction.
  const end = basketball.reduce(basketball.timeline(game));
  const winner = box.teams.find((t) => t.winner).id;
  const total = Object.values(end.score).reduce((a, b) => a + b, 0);
  const most = Math.max(...Object.values(end.lines).map((l) => l.PTS ?? 0));
  const top = Object.entries(end.lines).filter(([, l]) => l.PTS === most).map(([id]) => box.people[id].name).sort();
  assert.deepEqual(
    { winner, score: end.score, total, overUnder: total > line.overUnder ? "over" : "under", top: { PTS: most, people: top } },
    { ...ex.settles, top: { ...ex.settles.top, people: [...ex.settles.top.people].sort() } }
  );
});

// A made-up game for the rules the opener doesn't show, the away team (1) against the home team (2).
function made(plays) {
  const athlete = (id, name) => ({ athlete: { id, displayName: name }, stats: [] });
  return {
    header: { id: "zt1", competitions: [{ status: { type: { state: "in", completed: false } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", abbreviation: "ZTA" } }, { homeAway: "home", score: "0", team: { id: "2", abbreviation: "ZTH" } }] }] },
    boxscore: { players: [{ team: { id: "1" }, statistics: [{ labels: [], athletes: [athlete("a1", "Al Able"), athlete("a2", "Bo Baker")] }] }, { team: { id: "2" }, statistics: [{ labels: [], athletes: [athlete("h1", "Cy Cole"), athlete("h2", "Di Dunn")] }] }] },
    plays: plays.map((p, i) => ({ id: `z${i}`, period: { number: 2 }, clock: { displayValue: "0.0" }, wallclock: `2026-10-22T23:00:${String(i).padStart(2, "0")}Z`, scoringPlay: false, scoreValue: 0, ...p, type: { text: p.type }, participants: (p.who ?? []).map((id) => ({ athlete: { id } })) })),
  };
}

test("the rules the opener doesn't show: a missed heave isn't an attempt, a double foul is two, a technical is no personal foul", () => {
  const game = made([
    { type: "Heave Jump Shot", text: "Al Able misses heave jump shot", team: { id: "1" }, shootingPlay: true, pointsAttempted: 3, who: ["a1"] },
    { type: "Heave Jump Shot", text: "Bo Baker makes heave jump shot", team: { id: "1" }, shootingPlay: true, pointsAttempted: 3, scoringPlay: true, scoreValue: 3, who: ["a2"] },
    // A double personal foul comes as two plays, each with its fouler first.
    { type: "Double Personal Foul", text: "Double personal foul: Al Able and Cy Cole", team: { id: "1" }, who: ["a1", "h1"] },
    { type: "Double Personal Foul", text: "Double personal foul: Cy Cole and Al Able", team: { id: "2" }, who: ["h1", "a1"] },
    { type: "Double Technical Foul", text: "Double technical foul: Bo Baker and Di Dunn", who: ["a2", "h2"] },
    { type: "Technical Foul", text: "Di Dunn technical foul", team: { id: "2" }, who: ["h2"] },
    { type: "Free Throw - Technical", text: "Al Able makes technical free throw", team: { id: "1" }, shootingPlay: true, scoringPlay: true, scoreValue: 1, who: ["a1"] },
    { type: "Flagrant Foul Type 1", text: "Cy Cole flagrant foul type 1", team: { id: "2" }, who: ["h1"] },
    { type: "Offensive Rebound", text: "ZTA offensive team rebound", team: { id: "1" } },
    { type: "Shot Clock Turnover", text: "ZTA shot clock turnover", team: { id: "1" } },
    // A lane violation's text says "free throw": it isn't one.
    { type: "Lane Violation", text: "Cy Cole free throw lane violation", team: { id: "2" }, who: ["h1"] },
    // A held ball the home side wins back keeps its possession.
    { type: "Driving Layup Shot", text: "Cy Cole misses driving layup", team: { id: "2" }, shootingPlay: true, pointsAttempted: 2, who: ["h1"] },
    { type: "Jumpball", text: "Cy Cole vs. Al Able (Di Dunn gains possession)", team: { id: "2" }, who: ["h1", "a1", "h2"] },
    { type: "Jump Shot", text: "Di Dunn misses 12-foot jumper", team: { id: "2" }, shootingPlay: true, pointsAttempted: 2, who: ["h2"] },
  ]);
  const notes = [];
  const lines = basketball.reduce(basketball.readPlays(game, notes)).lines;
  assert.deepEqual(notes, []);
  assert.deepEqual(lines.a1, { PF: 1, FTA: 1, FTM: 1, PTS: 1 }, "the heave missed: no attempt; one foul of the double; the technical's free throw");
  assert.deepEqual(lines.a2, { FGA: 1, FGM: 1, "3PA": 1, "3PM": 1, PTS: 3 }, "a made heave is a basket");
  assert.deepEqual(lines.h1, { PF: 2, FGA: 1 }, "the double foul and the flagrant; no free throw on a lane violation");
  assert.deepEqual(lines.h2, { FGA: 1 }, "a technical isn't a personal foul");
  const plays = basketball.readPlays(game);
  assert.equal(plays.find((p) => /technical free throw/.test(p.text)).unit, plays[1].unit, "a technical's free throw is in someone else's possession");
  assert.deepEqual(plays[plays.length - 1].score, { 1: 4, 2: 0 });
  const [miss, jump, after] = plays.slice(-3);
  assert.deepEqual([jump.kind, jump.unit, after.unit], ["jump-ball", miss.unit, miss.unit]);
});

test("Basketball's defaults are data the spec reads: Yahoo's points and categories, slots of its positions, daily locks", () => {
  const d = defaultsFor("basketball");
  assert.equal(d.sport, "basketball");
  assert.deepEqual(d.scoring.points, { PTS: 1, REB: 1.2, AST: 1.5, STL: 3, BLK: 3, TO: -1 });
  for (const k of Object.keys(d.scoring.points)) assert.ok(basketball.stat(k) && basketball.stat(k).kind !== "rate", `${k} scores`);
  for (const k of d.categories.stats) assert.ok(basketball.stat(k), `${k} is a category`);
  const fill = new Set([...basketball.positions.map((p) => p.key), ...basketball.groups.map((g) => g.key)]);
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(fill.has(t), `${s.slot} takes ${t}`);
  assert.equal(d.closes, basketball.lock);
  const starters = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  assert.equal(d.specs.season.spec.count.start, starters, "the season's lineup is its slots");
  assert.equal(d.specs.season.spec.get.each, starters + d.slots.bench, "and its draft the slots and the bench");
  assert.equal(d.specs.season.spec.closes, d.closes);
  for (const { spec } of Object.values(d.specs).filter((x) => x.spec.score.by === "stats")) {
    assert.equal(spec.spec, 1);
    assert.equal(spec.score.by, "stats");
    assert.deepEqual(spec.score.points, d.scoring.points);
  }
});
