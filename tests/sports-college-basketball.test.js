// College basketball (src/lib/sports/basketball.ts's CollegeBasketball, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md
// track L, step L5 part 2): Basketball's vocabulary on ESPN's college feed, the men's in two halves and the women's in four
// quarters, and the proof: each recorded game's plays, reduced, come to ESPN's own box score (every player's counts, the team
// totals, the score), minutes coming from the final's correction. The recorded games (tests/fixtures/espn/, by
// scripts/dev-test/record-espn.js): the 2026 men's final (Michigan 69 UConn 63), Navy at Lehigh in two overtimes, the 2026
// women's final (UCLA 79 South Carolina 51), and Mount St. Mary's at Richmond, where one player's plays carry another id than
// her box line. The same proof against many real games is scripts/dev-test/check-sport-reduce.js --league=basketball/
// mens-college-basketball (or womens-) --groups=50. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, Basketball, CollegeBasketball } = jiti("../src/lib/sports/index.ts");

const mens = sportOf("basketball/mens-college-basketball");
const womens = sportOf("basketball/womens-college-basketball");
const FINAL = require("./fixtures/espn/ncaam-401856600.json");
const DOUBLE_OT = require("./fixtures/espn/ncaam-401820165.json");
const WFINAL = require("./fixtures/espn/ncaaw-401856590.json");
const RICHMOND = require("./fixtures/espn/ncaaw-401813906.json");
const GAMES = [
  [mens, FINAL],
  [mens, DOUBLE_OT],
  [womens, WFINAL],
  [womens, RICHMOND],
];
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);

test("college basketball: Basketball's vocabulary but plus/minus, the men's two halves and the women's four quarters, daily locks", () => {
  assert.ok(mens instanceof CollegeBasketball && womens instanceof CollegeBasketball);
  assert.notEqual(mens, womens);
  assert.ok(allSports().includes(mens) && allSports().includes(womens));
  assert.equal(mens.id, "basketball", "ESPN's sport slug: the defaults are basketball's");
  assert.deepEqual([mens.name, womens.name], ["Men's college basketball", "Women's college basketball"]);
  assert.equal(new Set(allSports().map((s) => s.name)).size, allSports().length, "every sport's name its own");
  assert.ok(sportById("basketball") instanceof Basketball && !(sportById("basketball") instanceof CollegeBasketball), "the sport's own is the NBA's");
  assert.equal(sportOf("basketball/nba"), sportById("basketball"));
  assert.deepEqual(mens.leagues, ["mens-college-basketball"]);
  assert.deepEqual(womens.leagues, ["womens-college-basketball"]);
  const nba = sportById("basketball");
  assert.deepEqual(mens.stats.map((s) => s.key), nba.stats.map((s) => s.key).filter((k) => k !== "PM"), "a college box has no plus/minus");
  assert.equal(mens.stat("PM"), null);
  assert.deepEqual(mens.stats.filter((s) => s.known === "final").map((s) => s.key), ["MIN"]);
  assert.deepEqual(mens.stats.filter((s) => s.judged).map((s) => s.key), ["OREB", "DREB", "REB", "AST", "STL", "BLK", "TO"]);
  assert.equal(new Set(mens.stats.map((s) => s.key)).size, mens.stats.length, "keys are unique");
  assert.deepEqual(mens.periods, { word: "half", plural: "halves", regulation: 2, extra: "overtime" });
  assert.deepEqual(womens.periods, nba.periods);
  assert.equal(mens.where({ period: 2, half: null, clock: "5:32" }), "2nd half, 5:32");
  assert.equal(mens.where({ period: 3, half: null, clock: "3:10" }), "overtime, 3:10");
  assert.equal(mens.where({ period: 4, half: null, clock: null }), "2nd overtime");
  assert.equal(womens.where({ period: 4, half: null, clock: "0:12" }), "4th quarter, 0:12");
  assert.equal(womens.where({ period: 5, half: null, clock: "1:00" }), "overtime, 1:00");
  assert.equal(mens.lock, "daily");
  // ESPN's own format says the same: halves of 20 minutes, quarters of 10.
  for (const [sport, game] of GAMES) assert.equal(Math.max(...game.plays.map((p) => p.period.number)) >= sport.periods.regulation, true);
  assert.deepEqual([...new Set(FINAL.plays.map((p) => p.period.displayValue))], ["1st Half", "2nd Half"]);
  assert.deepEqual([...new Set(WFINAL.plays.map((p) => p.period.displayValue))], ["1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter"]);
});

test("college's defaults are basketball's: a college box says G, F or C, and every slot takes them", () => {
  const d = defaultsFor(mens.id);
  assert.equal(d.sport, "basketball");
  for (const k of Object.keys(d.scoring.points)) assert.ok(mens.stat(k), `${k} scores in college too`);
  for (const k of d.categories.stats) assert.ok(mens.stat(k), `${k} is a category in college too`);
  const said = new Set();
  for (const [sport, game] of GAMES) for (const p of Object.values(sport.readBox(game).people)) said.add(p.position);
  assert.deepEqual([...said].sort(), ["C", "F", "G"]);
  const groupOf = (pos) => mens.position(pos)?.group;
  for (const s of d.slots.lineup) assert.ok(s.takes.some((t) => said.has(t) || [...said].some((p) => groupOf(p) === t)), `${s.slot} is filled by G, F or C`);
});

test("ESPN's college box score: the players' lines, and the team's totals without the team's own rebounds, turnovers and fouls", () => {
  const box = mens.readBox(FINAL);
  assert.equal(box.event, "401856600");
  assert.equal(box.final, true);
  assert.deepEqual(
    box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]),
    [
      ["130", "MICH", true, 69, true],
      ["41", "CONN", false, 63, false],
    ]
  );
  assert.deepEqual(nameOf(box, "Alex Karaban").stats, { MIN: 40, PTS: 17, FGM: 5, FGA: 14, "3PM": 3, "3PA": 10, FTM: 4, FTA: 6, REB: 11, AST: 2, TO: 1, STL: 2, BLK: 0, OREB: 3, DREB: 8, PF: 1 });
  assert.equal(nameOf(box, "Alex Karaban").position, "F");
  assert.deepEqual(box.teams[1].stats, { FGM: 21, FGA: 68, "3PM": 9, "3PA": 33, FTM: 12, FTA: 16, AST: 9, STL: 4, BLK: 2 });
  // Why they're left out: ESPN's own college totals are the players' and the team's own plays, exactly, on every recorded game
  // (293 of 294 sides in check-sport-reduce.js's games; the other ESPN's doubled feed).
  for (const [sport, game] of GAMES) {
    const b = sport.readBox(game);
    for (const side of game.boxscore.teams) {
      const espn = Object.fromEntries(side.statistics.map((s) => [s.name, Number(s.displayValue)]));
      const players = (k) => Object.values(b.people).filter((p) => p.team === side.team.id).reduce((n, p) => n + (p.stats[k] ?? 0), 0);
      const own = (re, extra = () => true) => game.plays.filter((p) => p.team?.id === side.team.id && re.test(p.type.text) && !(p.participants ?? []).length && extra(p)).length;
      const name = `${game.header.id} ${side.team.abbreviation}`;
      assert.equal(espn.offensiveRebounds, players("OREB") + own(/^offensive rebound/i), `${name} OREB`);
      assert.equal(espn.defensiveRebounds, players("DREB") + own(/^defensive rebound/i), `${name} DREB`);
      assert.equal(espn.totalRebounds, players("REB") + own(/^(?:offensive|defensive) rebound/i), `${name} REB`);
      assert.equal(espn.turnovers, players("TO") + own(/turnover/i), `${name} TO`);
      assert.equal(espn.fouls, players("PF") + own(/technical/i), `${name} PF: a bench technical`);
    }
  }
});

test("the proof, every recorded college game: the plays alone reduce to ESPN's own box score, every team total and the score", () => {
  for (const [sport, game] of GAMES) {
    const box = sport.readBox(game);
    const notes = [];
    const plays = sport.readPlays(game, notes);
    assert.deepEqual(notes, [], `${game.header.id}: nothing the reader couldn't read`);
    const state = sport.reduce(plays);
    let compared = 0;
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        if (sport.stat(k).known === "final") continue;
        assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${game.header.id} ${p.name} ${k}`);
        compared++;
      }
    }
    assert.ok(compared >= 255, `${game.header.id}: ${compared} numbers compared`);
    for (const id of Object.keys(state.lines)) assert.ok(Object.keys(box.people[id]?.stats ?? {}).length, `${game.header.id}: ${id} played`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(sport.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${game.header.id} ${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${game.header.id} ${t.abbreviation}'s score`);
    }
  }
});

test("plays: in time order, each with its half, clock, possession, people and deltas; blocks and steals are plays of their own", () => {
  const plays = mens.readPlays(FINAL);
  assert.equal(plays.length, 482);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  for (const p of plays) assert.ok([1, 2].includes(p.period) && p.half === null && /^\d+:\d\d$/.test(p.clock), p.id);
  // "Jump Ball won by UConn": UConn's first possession (and the loser's play is no possession of its own).
  assert.deepEqual(plays.slice(0, 4).map((p) => [p.kind, p.team, p.unit]), [
    ["jump-ball", null, null],
    ["jump-ball", "41", "401856600:1"],
    ["jump-ball", "130", "401856600:1"],
    ["miss", "41", "401856600:1"],
  ]);
  // A block: the shooter's miss, then the blocker's play at the same clock.
  const block = plays.findIndex((p) => p.kind === "block");
  assert.deepEqual([plays[block - 1].text, plays[block - 1].kind, plays[block - 1].deltas], ["Silas Demary Jr. misses 5-foot jumper", "blocked", { 5054083: { FGA: 1 } }], "blocked, as the NBA's says");
  assert.deepEqual([plays[block].text, plays[block].deltas, plays[block].unit], ["Roddy Gayle Jr. Block.", { 5105836: { BLK: 1 } }, plays[block - 1].unit]);
  // A steal: the turnover ends UConn's possession, the steal is Michigan's.
  const steal = plays.findIndex((p) => p.kind === "steal");
  assert.deepEqual(plays[steal - 1].deltas, { 5105809: { TO: 1 } });
  assert.deepEqual(plays[steal].deltas, { 4869764: { STL: 1 } });
  assert.notEqual(plays[steal + 1].unit, plays[steal - 1].unit);
  assert.equal(plays[steal + 1].team, "130");
  // An assist, as the final writes it.
  const assisted = plays.find((p) => p.text === "Morez Johnson Jr. makes layup (Elliot Cadeau assists)");
  assert.deepEqual(assisted.deltas, { 4873153: { FGA: 1, FGM: 1, PTS: 2 }, 4869764: { AST: 1 } });
  // A team's own rebound is nobody's.
  assert.deepEqual(plays.find((p) => p.text === "Michigan Offensive Rebound.").deltas, {});
  // Three free throws, one possession, Michigan's.
  const three = plays.filter((p) => /free throw \d of 3/.test(p.text));
  assert.equal(new Set(three.map((p) => p.unit)).size, 1);
  // About 70 possessions a side in 40 minutes.
  const units = new Set(plays.map((p) => p.unit).filter(Boolean));
  assert.ok(units.size > 120 && units.size < 160, `${units.size} possessions`);
});

test("the other way ESPN writes them: \"made Layup. Assisted by X.\", and free throws that don't say which of how many", () => {
  const plays = womens.readPlays(RICHMOND);
  const assisted = plays.find((p) => p.id === "401813906113716109");
  assert.equal(assisted.text, "Ally Sweeney made Three Point Jumper. Assisted by Tierra Simon.");
  assert.equal(assisted.kind, "three");
  assert.deepEqual(assisted.deltas, { 5174384: { FGA: 1, FGM: 1, "3PA": 1, "3PM": 1, PTS: 3 }, 4900556: { AST: 1 } });
  // Two missed at 1:49, a dead ball's team rebound between them (the shooter's side's ball): one possession.
  const pair = plays.filter((p) => p.kind === "free-throw" && p.clock === "1:49");
  assert.deepEqual(pair.map((p) => p.text), ["Teodora Ivanovic missed Free Throw.", "Teodora Ivanovic missed Free Throw."]);
  assert.equal(pair[0].unit, pair[1].unit);
});

test("a player's plays under another id than her box line's are hers, by the name the play's text gives", () => {
  // ESPN's data: every one of Tierra Simon's 22 plays names her by an id that isn't in the box score.
  const raw = RICHMOND.plays.filter((p) => (p.participants ?? []).some((x) => x.athlete.id === "5174393"));
  assert.equal(raw.length, 22);
  assert.ok(raw.every((p) => p.text.includes("Tierra Simon")));
  assert.ok(!RICHMOND.boxscore.players.some((s) => s.statistics.some((t) => t.athletes.some((a) => a.athlete.id === "5174393"))));
  const box = womens.readBox(RICHMOND);
  const simon = nameOf(box, "Tierra Simon");
  assert.equal(simon.id, "4900556");
  const state = womens.reduce(womens.readPlays(RICHMOND));
  assert.equal(state.lines["5174393"], undefined);
  for (const [k, v] of Object.entries(simon.stats)) if (k !== "MIN") assert.equal(state.lines[simon.id]?.[k] ?? 0, v, `Simon's ${k}`);
});

test("a game as of a moment: the men's final at the half, and two overtimes", () => {
  const plays = mens.timeline(FINAL);
  const half = plays.find((p) => p.kind === "period-end" && p.period === 1);
  assert.equal(mens.where(half), "1st half, 0:00");
  assert.deepEqual(mens.reduce(plays, half.at).score, { 41: 29, 130: 33 });
  const karaban = nameOf(mens.readBox(FINAL), "Alex Karaban").id;
  assert.ok(!("MIN" in (mens.reduce(plays, half.at).lines[karaban] ?? {})), "minutes come with the final");
  assert.equal(mens.reduce(plays).lines[karaban].MIN, 40);
  const ot = mens.timeline(DOUBLE_OT);
  const regulation = ot.find((p) => p.kind === "period-end" && p.period === 2);
  const first = ot.find((p) => p.kind === "period-end" && p.period === 3);
  const tied = (s) => Object.values(s)[0] === Object.values(s)[1];
  assert.ok(tied(mens.reduce(ot, regulation.at).score), "level after 40 minutes");
  assert.ok(tied(mens.reduce(ot, first.at).score), "and after the first overtime");
  assert.equal(mens.where(ot.find((p) => p.period === 4)), `2nd overtime, ${ot.find((p) => p.period === 4).clock}`);
  assert.deepEqual(mens.reduce(ot).score, { 2329: 79, 2426: 82 });
  const w = womens.timeline(WFINAL);
  assert.deepEqual(womens.reduce(w, w.find((p) => p.kind === "period-end" && p.period === 2).at).score, { 26: 36, 2579: 23 });
});

test("the final's correction: only minutes, and with it every number of ESPN's box score; none live", () => {
  for (const [sport, game] of GAMES) {
    const box = sport.readBox(game);
    const correction = sport.correction(sport.reduce(sport.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.equal(sport.stat(k).known, "final", `${game.header.id} ${box.people[who].name} ${k}`);
    const end = sport.reduce(sport.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${game.header.id} ${p.name} ${k}`);
    const live = JSON.parse(JSON.stringify(game));
    live.header.competitions[0].status.type = { state: "in", completed: false };
    assert.ok(!sport.timeline(live).some((p) => p.final));
  }
});

// A made-up college game for the rules the recordings don't show, the away team (1) against the home team (2).
function made(plays) {
  const athlete = (id, name) => ({ athlete: { id, displayName: name }, stats: [] });
  return {
    header: { id: "zt1", competitions: [{ status: { type: { state: "in", completed: false } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", abbreviation: "ZTA" } }, { homeAway: "home", score: "0", team: { id: "2", abbreviation: "ZTH" } }] }] },
    boxscore: { players: [{ team: { id: "1" }, statistics: [{ labels: [], athletes: [athlete("a1", "Al Able"), athlete("a2", "Bo Baker")] }] }, { team: { id: "2" }, statistics: [{ labels: [], athletes: [athlete("h1", "Cy Cole"), athlete("h2", "Di Dunn"), athlete("h3", "Ed Dunn")] }] }] },
    plays: plays.map((p, i) => ({ id: `z${i}`, period: { number: 2 }, clock: { displayValue: p.clock ?? "5:00" }, wallclock: `2026-01-17T20:00:${String(i).padStart(2, "0")}Z`, scoringPlay: false, scoreValue: 0, ...p, type: { text: p.type }, participants: (p.who ?? []).map((id) => ({ athlete: { id } })) })),
  };
}

test("the rules the recordings don't show: technicals, a technical's free throws, free throws with no count, a team's own, an unknown id", () => {
  const game = made([
    { type: "LayUpShot", text: "Bo Baker missed Layup.", team: { id: "1" }, shootingPlay: true, pointsAttempted: 2, who: ["a2"] },
    { type: "Offensive Rebound", text: "Bo Baker Offensive Rebound.", team: { id: "1" }, who: ["a2"] },
    { type: "Technical Foul", text: "Technical Foul on Al Able.", team: { id: "1" }, who: ["a1"] },
    { type: "Technical Foul", text: "Technical Foul on ZTH.", team: { id: "2" } },
    // The technical's free throw, in the middle of the away side's possession.
    { type: "MadeFreeThrow", text: "Cy Cole made Free Throw.", team: { id: "2" }, shootingPlay: true, scoringPlay: true, scoreValue: 1, pointsAttempted: 1, who: ["h1"] },
    // Two free throws with no count: the possession ends only at the second, made.
    { type: "PersonalFoul", text: "Foul on Cy Cole.", team: { id: "2" }, who: ["h1"], clock: "4:00" },
    { type: "MadeFreeThrow", text: "Bo Baker made Free Throw.", team: { id: "1" }, shootingPlay: true, scoringPlay: true, scoreValue: 1, pointsAttempted: 1, who: ["a2"], clock: "4:00" },
    { type: "Substitution", text: "Ed Dunn subbing in for ZTH", team: { id: "2" }, who: ["h3"], clock: "4:00" },
    { type: "MadeFreeThrow", text: "Bo Baker made Free Throw.", team: { id: "1" }, shootingPlay: true, scoringPlay: true, scoreValue: 1, pointsAttempted: 1, who: ["a2"], clock: "4:00" },
    // The home side's: a team turnover and a dead ball's rebound are nobody's.
    { type: "Lost Ball Turnover", text: "ZTH  Turnover.", team: { id: "2" }, clock: "3:40" },
    { type: "Steal", text: "Al Able Steal.", team: { id: "1" }, who: ["a1"], clock: "3:40" },
    { type: "JumpShot", text: "Al Able missed Three Point Jumper.", team: { id: "1" }, shootingPlay: true, pointsAttempted: 3, who: ["a1"], clock: "3:30" },
    { type: "Dead Ball Rebound", text: "ZTH Deadball Team Rebound.", team: { id: "2" }, clock: "3:28" },
    // A name the box hasn't by that id: Di Dunn's (the only one of the side's the text names), not Ed Dunn's.
    { type: "DunkShot", text: "Di Dunn made Dunk. Assisted by Cy Cole.", team: { id: "2" }, shootingPlay: true, scoringPlay: true, scoreValue: 2, pointsAttempted: 2, who: ["x9", "h1"], clock: "3:10" },
    // One the text can't tell ("Dunn" alone fits two): left as it is.
    { type: "Block Shot", text: "Dunn Block.", team: { id: "2" }, who: ["x8"], clock: "3:00" },
    // A name inside a longer one isn't it ("Ed Dunnson" isn't Ed Dunn).
    { type: "Defensive Rebound", text: "Ed Dunnson Defensive Rebound.", team: { id: "2" }, who: ["x7"], clock: "2:55" },
    // A technical owes the other side two free throws at its clock; a third of theirs there is the foul's.
    { type: "JumpShot", text: "Al Able made Jumper.", team: { id: "1" }, shootingPlay: true, scoringPlay: true, scoreValue: 2, pointsAttempted: 2, who: ["a1"], clock: "2:00" },
    { type: "PersonalFoul", text: "Foul on Bo Baker.", team: { id: "1" }, who: ["a2"], clock: "1:50" },
    { type: "Technical Foul", text: "Technical Foul on Bo Baker.", team: { id: "1" }, who: ["a2"], clock: "1:50" },
    ...[1, 2, 3, 4].map(() => ({ type: "MadeFreeThrow", text: "Ed Dunn made Free Throw.", team: { id: "2" }, shootingPlay: true, scoringPlay: true, scoreValue: 1, pointsAttempted: 1, who: ["h3"], clock: "1:50" })),
  ]);
  const notes = [];
  const plays = womens.readPlays(game, notes);
  assert.deepEqual(notes, []);
  const lines = womens.reduce(plays).lines;
  assert.deepEqual(lines.a1, { PF: 1, STL: 1, FGA: 2, "3PA": 1, FGM: 1, PTS: 2 }, "a player's technical is one of his fouls");
  assert.deepEqual(lines.a2, { FGA: 1, REB: 1, OREB: 1, FTA: 2, FTM: 2, PTS: 2, PF: 2 });
  assert.deepEqual(lines.h1, { FTA: 1, FTM: 1, PTS: 1, PF: 1, AST: 1 }, "a bench technical is nobody's");
  assert.deepEqual(lines.h2, { FGA: 1, FGM: 1, PTS: 2 }, "the unknown id is the box's Di Dunn");
  assert.equal(lines.x9, undefined);
  assert.deepEqual(lines.x8, { BLK: 1 }, "two Dunns: nobody's guess");
  assert.deepEqual(lines.x7, { REB: 1, DREB: 1 }, "Ed Dunnson isn't Ed Dunn");
  assert.deepEqual(lines.h3, { FTA: 4, FTM: 4, PTS: 4 });
  const unit = (text) => plays.find((p) => p.text === text).unit;
  assert.equal(unit("Cy Cole made Free Throw."), unit("Bo Baker missed Layup."), "a technical's free throw is the away side's possession");
  assert.equal(unit("Bo Baker Offensive Rebound."), unit("Bo Baker missed Layup."));
  const fts = plays.filter((p) => p.text === "Bo Baker made Free Throw.");
  assert.equal(fts[0].unit, fts[1].unit, "the first of two doesn't end it");
  assert.notEqual(unit("ZTH  Turnover."), fts[1].unit, "the second does");
  assert.equal(unit("ZTH Deadball Team Rebound."), unit("Di Dunn made Dunk. Assisted by Cy Cole."), "the home side's ball after the dead ball");
  const four = plays.filter((p) => p.text === "Ed Dunn made Free Throw.").map((p) => p.unit);
  assert.deepEqual([four[0], four[1]], [unit("Al Able made Jumper."), unit("Al Able made Jumper.")], "the technical's two: in the possession they interrupt");
  assert.notEqual(four[2], four[0], "the foul's are the home side's own");
  assert.equal(four[3], four[2]);
  assert.deepEqual(plays[plays.length - 1].score, { 1: 4, 2: 7 });
});
