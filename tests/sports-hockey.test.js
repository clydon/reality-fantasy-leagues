// Hockey (src/lib/sports/hockey.ts, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, step L1 part 2): its
// vocabulary, ESPN's box score and plays read into its keys, and the proof: each recorded game's plays, reduced, come to ESPN's
// own box score (every skater's and goalie's counts, the team totals ESPN gives, the score), with plus/minus, time on ice,
// shifts and a goalie's decision coming from the final's correction. The recorded games (tests/fixtures/espn/, recorded by
// scripts/dev-test/record-espn.js) are Kings at Rangers, 2026-10-26 (a goalie pulled after the 1st, an empty-net goal, power
// plays) and Red Wings at Kraken, 2026-10-20 (overtime, then a shootout). The same proof against many real games is
// scripts/dev-test/check-sport-reduce.js --league=hockey/nhl. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports } = jiti("../src/lib/sports/index.ts");
const { secondsOf } = jiti("../src/lib/sports/hockey.ts");

const hockey = sportOf("hockey/nhl");
const KINGS = require("./fixtures/espn/nhl-401892582.json");
const SHOOTOUT = require("./fixtures/espn/nhl-401892547.json");
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);
const named = (box, deltas) => Object.fromEntries(Object.entries(deltas).map(([w, d]) => [box.people[w]?.name ?? w, d]));

test("Hockey's vocabulary: unique stat keys for skaters and goalies, positions in their groups, three periods, daily locks", () => {
  assert.equal(hockey.id, "hockey");
  assert.equal(sportById("hockey"), hockey);
  assert.equal(sportOf("hockey/mens-college-hockey"), null, "college ends a tie otherwise: L5");
  assert.ok(allSports().includes(hockey));
  const keys = hockey.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique: a skater's goals are G, a goalie's against GA");
  const groups = new Set(hockey.statGroups.map((g) => g.key));
  for (const s of hockey.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    assert.ok(["higher", "lower"].includes(s.better), s.key);
    assert.equal(s.kind === "count", !s.of, `${s.key}: counts are counted, the rest worked out`);
  }
  // What the plays can't say (who's on the ice, who's the goalie of record) is the final's.
  assert.deepEqual(hockey.stats.filter((s) => s.known === "final").map((s) => s.key), ["PM", "SHFT", "W", "L", "OTL", "SO", "TOI", "PPTOI", "SHTOI", "ESTOI"]);
  // The real-time scorer's calls, which ESPN's box score can count otherwise after the play.
  assert.deepEqual(hockey.stats.filter((s) => s.judged).map((s) => s.key), ["SOG", "SM", "BLK", "HIT", "TK", "GV", "SA", "SV", "ESSV", "PPSV", "SHSV"]);
  const posGroups = new Set(hockey.groups.map((g) => g.key));
  for (const p of hockey.positions) assert.ok(posGroups.has(p.group), p.key);
  for (const g of hockey.groups) for (const s of g.stats) assert.ok(groups.has(s), g.key);
  assert.equal(hockey.lock, "daily");
  // ESPN's hockey clock counts up from the period's start.
  assert.equal(hockey.where({ period: 2, half: null, clock: "5:32" }), "2nd period, 5:32 in");
  assert.equal(hockey.where({ period: 4, half: null, clock: "1:10" }), "overtime, 1:10 in");
  assert.equal(hockey.where({ period: 6, half: null, clock: "12:00" }), "3rd overtime, 12:00 in");
  assert.equal(hockey.where({ period: 5, half: null, clock: null, shootout: true }), "shootout");
  const ctx = hockey.specStats();
  assert.deepEqual(ctx.find((s) => s.key === "PPP"), { key: "PPP", label: "power-play point" });
  assert.ok(!ctx.some((s) => s.key === "SV%" || s.key === "GAA"));
});

test("derived and rate stats: points, power-play points, faceoff and save percentages, goals against average", () => {
  const skater = hockey.full({ G: 1, A: 2, PPG: 1, PPA: 1, FW: 6, FL: 4 });
  assert.deepEqual([skater.PTS, skater.PPP, skater.SHP, skater["FO%"]], [3, 2, 0, 0.6]);
  assert.ok(!("SV%" in skater), "a skater has no saves");
  const goalie = hockey.full({ GA: 2, SA: 30, SV: 28, TOI: 3600 });
  assert.equal(goalie["SV%"], 28 / 30);
  assert.equal(goalie.GAA, 2);
  assert.ok(!("PTS" in goalie), "a goalie's line has no skating");
  assert.deepEqual([secondsOf("17:50"), secondsOf("59:19"), secondsOf("0:00"), secondsOf("--")], [1070, 3559, 0, null]);
});

test("ESPN's box score in Hockey's keys: a skater's line, the goalies of record, time on ice in seconds, the team's totals", () => {
  const box = hockey.readBox(KINGS);
  assert.equal(box.event, "401892582");
  assert.deepEqual(
    box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]),
    [
      ["13", "NYR", true, 3, false],
      ["8", "LA", false, 6, true],
    ]
  );
  const doughty = nameOf(box, "Drew Doughty");
  assert.equal(doughty.position, "D");
  assert.deepEqual(doughty.stats, { G: 1, A: 2, PM: 3, SOG: 1, SM: 0, BLK: 2, HIT: 0, TK: 1, GV: 2, FW: 0, FL: 0, SHFT: 24, TOI: 1297, PPTOI: 16, SHTOI: 25, ESTOI: 1256, PN: 1, PIM: 2 });
  // The Rangers pulled Reimer after the 1st: Garand was in net for the Kings' winning goal, so the loss is his.
  assert.deepEqual(nameOf(box, "Darcy Kuemper").stats, { GA: 3, SA: 26, SV: 23, ESSV: 23, PPSV: 0, SHSV: 0, TOI: 3559, PIM: 0, W: 1, L: 0, OTL: 0, SO: 0 });
  assert.deepEqual([nameOf(box, "Dylan Garand").stats.L, nameOf(box, "James Reimer").stats.L, nameOf(box, "James Reimer").stats.GA], [1, 0, 3]);
  assert.equal(nameOf(box, "Dylan Garand").position, "G");
  assert.deepEqual(box.teams[0].stats, { BLK: 14, HIT: 24, TK: 4, SOG: 26, PPG: 1, SHG: 0, FW: 36, GV: 18 });
  assert.ok(!("PN" in box.teams[0].stats), "a team's penalties count a bench minor, which is nobody's");
  assert.equal(hockey.readBox({}), null);
});

for (const [name, game] of [
  ["Kings at Rangers", KINGS],
  ["Red Wings at Kraken (a shootout)", SHOOTOUT],
]) {
  test(`the proof, ${name}: the plays alone reduce to ESPN's own box score, every team total and the score`, () => {
    const box = hockey.readBox(game);
    const notes = [];
    const plays = hockey.readPlays(game, notes);
    assert.deepEqual(notes, [], "nothing the reader couldn't read");
    const state = hockey.reduce(plays);
    let compared = 0;
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        if (hockey.stat(k).known === "final") continue;
        assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
        compared++;
      }
    }
    assert.ok(compared > 400, `${compared} numbers compared`);
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${id} is in the box score`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(hockey.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) assert.equal(sum[k] ?? 0, v, `${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${t.abbreviation}'s score`);
    }
  });
}

test("plays: in time order, each with its period and clock; goals against whoever was in net, the empty net nobody's", () => {
  const plays = hockey.readPlays(KINGS);
  const box = hockey.readBox(KINGS);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  for (const p of plays) assert.ok(p.period >= 1 && p.period <= 3 && p.half === null && /^\d+:\d\d$/.test(p.clock), p.id);
  const goals = plays.filter((p) => p.kind === "goal");
  assert.equal(goals.length, 9);
  // The 1st's three Kings goals were Reimer's; the 2nd's two Garand's; the Kings' last went into an empty net.
  const against = goals.filter((p) => p.team === "8").map((p) => Object.entries(p.deltas).find(([, d]) => d.GA)?.[0]).map((w) => (w ? box.people[w].name : null));
  assert.deepEqual(against, ["James Reimer", "James Reimer", "James Reimer", "Dylan Garand", "Dylan Garand", null]);
  // Panarin's power-play goal: his and his assisters' power-play points.
  const pp = goals.find((p) => /^Artemi Panarin Goal/.test(p.text));
  assert.equal(hockey.where(pp), "2nd period, 1:30 in");
  assert.deepEqual(named(box, pp.deltas), { "Artemi Panarin": { G: 1, SOG: 1, PPG: 1 }, "Erik Gustafsson": { A: 1, PPA: 1 }, "Alex Laferriere": { A: 1, PPA: 1 }, "Dylan Garand": { GA: 1, SA: 1 } });
  assert.deepEqual(pp.score, { 8: 4, 13: 1 });
  // A shot blocked by a teammate isn't a blocked shot.
  const own = plays.find((p) => p.text === "Erik Gustafsson shot blocked by Quinton Byfield");
  assert.deepEqual(own.deltas, {});
  // A faceoff starts a run of play (live calls' unit): its winner's and its loser's.
  const faceoff = plays.find((p) => p.kind === "faceoff");
  assert.deepEqual(named(box, faceoff.deltas), { "Alex Laferriere": { FW: 1 }, "J.T. Miller": { FL: 1 } });
  assert.equal(faceoff.unit, "401892582:1");
  const runs = new Set(plays.map((p) => p.unit).filter(Boolean));
  assert.equal(runs.size, plays.filter((p) => p.kind === "faceoff").length);
  // A save by the shooting side's strength.
  const saves = hockey.reduce(plays).lines[nameOf(box, "Dylan Garand").id];
  assert.deepEqual([saves.SV, saves.ESSV, saves.PPSV, saves.SHSV], [15, 10, 3, 2]);
});

test("the shootout: its own plays and counts, never the game's; its winner's one goal at its end; the goalies of record", () => {
  const box = hockey.readBox(SHOOTOUT);
  const plays = hockey.readPlays(SHOOTOUT);
  assert.deepEqual(box.teams.map((t) => [t.abbreviation, t.score, t.winner]), [["SEA", 4, true], ["DET", 3, false]]);
  const so = plays.filter((p) => p.shootout);
  assert.ok(so.length >= 10 && so.every((p) => p.period === 5 && p.clock === null && p.unit === null && hockey.where(p) === "shootout"));
  assert.equal(hockey.where(plays.find((p) => p.period === 4 && p.kind === "shot-missed")), "overtime, 0:42 in");
  const before = plays.findIndex((p) => p.kind === "shootout-end");
  assert.deepEqual(plays[before - 1].score, { 5: 3, 124292: 3 }, "level through overtime and the shootout's goals");
  assert.deepEqual(plays[before].score, { 5: 3, 124292: 4 }, "the Kraken won it");
  const lines = hockey.reduce(so).lines;
  const by = (n) => lines[nameOf(box, n).id];
  assert.deepEqual([by("Frederick Gaudreau"), by("Bobby McMann"), by("Viktor Arvidsson")], [{ SOGOAL: 1 }, { SOGOAL: 1 }, { SOGOAL: 1 }]);
  assert.deepEqual([by("Philipp Grubauer"), by("Daniil Tarasov")], [{ SOSV: 3, SOGA: 1 }, { SOSV: 2, SOGA: 2 }]);
  // The game as it ended: in the shootout.
  assert.equal(hockey.where(hockey.reduce(hockey.timeline(SHOOTOUT)).last), "shootout");
  // An overtime or shootout loss in the regular season is an OTL.
  assert.deepEqual([nameOf(box, "Philipp Grubauer").stats.W, nameOf(box, "Daniil Tarasov").stats.OTL, nameOf(box, "Daniil Tarasov").stats.L], [1, 1, 0]);
});

test("a game as of a moment: the 1st period's end, then the final with time on ice and the decisions", () => {
  const plays = hockey.timeline(KINGS);
  const box = hockey.readBox(KINGS);
  const first = plays.find((p) => p.kind === "period-end" && p.period === 1);
  const at = hockey.reduce(plays, first.at);
  assert.deepEqual(at.score, { 8: 3, 13: 1 });
  const reimer = nameOf(box, "James Reimer").id;
  assert.deepEqual([at.lines[reimer].GA, at.lines[reimer].TOI], [3, undefined]);
  const end = hockey.reduce(plays);
  assert.deepEqual(end.score, { 8: 6, 13: 3 });
  assert.equal(end.lines[reimer].TOI, 1200);
  assert.equal(end.lines[nameOf(box, "Darcy Kuemper").id].W, 1);
});

test("the final's correction: only what the plays can't say, and with it every number of ESPN's box score", () => {
  for (const game of [KINGS, SHOOTOUT]) {
    const box = hockey.readBox(game);
    const correction = hockey.correction(hockey.reduce(hockey.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.equal(hockey.stat(k).known, "final", `${box.people[who].name} ${k}`);
    const end = hockey.reduce(hockey.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  }
  const live = JSON.parse(JSON.stringify(KINGS));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!hockey.timeline(live).some((p) => p.final));
  assert.ok(!("W" in nameOf(hockey.readBox(live), "Darcy Kuemper").stats), "no decision until the final");
});

// A made-up game for the rules the recorded ones don't show: the away team (1) against the home team (2).
function made({ plays, season = 2, detail = "Final", winner = "1", score = ["1", "0"], goalies = { 1: ["g1"], 2: ["g2"] } }) {
  const skater = (id, name) => ({ athlete: { id, displayName: name }, stats: ["0", "0"] });
  const goalie = (id) => ({ athlete: { id, displayName: id }, stats: ["0", "60:00"] });
  const side = (team, skaters) => ({ team: { id: team }, statistics: [{ name: "forwards", labels: ["G", "A"], athletes: skaters }, { name: "goalies", labels: ["GA", "TOI"], athletes: goalies[team].map(goalie) }] });
  return {
    header: {
      id: "zt2",
      season: { type: season },
      competitions: [
        {
          status: { type: { state: "post", completed: true, detail }, featuredAthletes: [{ name: "winningGoalie", athlete: { id: winner === "1" ? goalies[1][0] : goalies[2][0] } }, { name: "losingGoalie", athlete: { id: winner === "1" ? goalies[2][0] : goalies[1][0] } }] },
          competitors: [
            { homeAway: "away", score: score[0], winner: winner === "1", team: { id: "1", abbreviation: "ZTA" } },
            { homeAway: "home", score: score[1], winner: winner === "2", team: { id: "2", abbreviation: "ZTH" } },
          ],
        },
      ],
    },
    boxscore: { players: [side("1", [skater("a1", "Al Able"), skater("a2", "Bo Baker")]), side("2", [skater("h1", "Cy Cole"), skater("h2", "Di Dunn")])] },
    plays: plays.map((p, i) => ({ id: `z${i}`, period: { number: 3 }, clock: { displayValue: `19:${String(i).padStart(2, "0")}` }, wallclock: `2026-10-20T03:00:${String(i).padStart(2, "0")}Z`, ...p, participants: (p.who ?? []).map(([type, id]) => ({ type, athlete: { id } })) })),
  };
}

test("the rules the recorded games don't show: an empty net's shorthanded goal, a bench minor, a playoff overtime loss, a shutout", () => {
  const game = made({
    plays: [
      { type: { abbreviation: "shot-on-goal" }, team: { id: "2" }, strength: { abbreviation: "power-play" }, who: [["shooter", "h1"], ["saver", "g1"]] },
      // The home side pulled its goalie on the power play: the away side's empty-net goal was shorthanded.
      { type: { abbreviation: "goal" }, team: { id: "1" }, scoringPlay: true, scoreValue: 1, strength: { abbreviation: "empty-net" }, shotInfo: { abbreviation: "empty-net" }, who: [["scorer", "a1"], ["assister", "a2"]] },
      { type: { abbreviation: "Too many men/ice - bench", penaltyMinutes: "2", penaltyType: "Bench" }, team: { id: "2" } },
      { type: { abbreviation: "Hooking", penaltyMinutes: "2", penaltyType: "Minor" }, team: { id: "1" }, who: [[undefined, "a2"], [undefined, "h1"]] },
      // ESPN types a player's own penalty "Bench" too: it's his.
      { type: { abbreviation: "Unsportsmanlike conduct-sitting on boards", penaltyMinutes: "2", penaltyType: "Bench" }, team: { id: "2" }, who: [[undefined, "h2"]] },
    ],
  });
  const lines = hockey.reduce(hockey.readPlays(game)).lines;
  assert.deepEqual(lines.a1, { G: 1, SOG: 1, SHG: 1 });
  assert.deepEqual(lines.a2, { A: 1, SHA: 1, PN: 1, PIM: 2 });
  assert.ok(!lines.g2, "the empty net's goal is nobody's against");
  assert.deepEqual(lines.g1, { SV: 1, SA: 1, PPSV: 1 });
  assert.ok(!lines.h1?.PN, "a bench minor is nobody's");
  assert.deepEqual(lines.h2, { PN: 1, PIM: 2 });
  // The winner's goalie, the only one his side used, kept the other side off the board: a shutout.
  const box = hockey.readBox(game);
  assert.deepEqual([box.people.g1.stats.W, box.people.g1.stats.SO, box.people.g2.stats.L], [1, 1, 1]);
  // In the playoffs an overtime loss is a loss; two goalies share no shutout.
  const playoff = hockey.readBox(made({ plays: [], season: 3, detail: "Final/2OT", goalies: { 1: ["g1", "g3"], 2: ["g2"] } }));
  assert.deepEqual([playoff.people.g2.stats.L, playoff.people.g2.stats.OTL, playoff.people.g1.stats.SO], [1, 0, 0]);
  const regular = hockey.readBox(made({ plays: [], detail: "Final/OT" }));
  assert.deepEqual([regular.people.g2.stats.L, regular.people.g2.stats.OTL], [0, 1]);
});

test("whose goal it was against: a goalie changed at the intermission, whose first shot was a goal; a playoff 2OT isn't a shootout", () => {
  const game = made({
    goalies: { 1: ["g1"], 2: ["g2", "g3"] },
    plays: [
      { period: { number: 1 }, type: { abbreviation: "shot-on-goal" }, team: { id: "1" }, who: [["shooter", "a1"], ["saver", "g2"]] },
      { period: { number: 1 }, type: { abbreviation: "goal" }, team: { id: "1" }, scoringPlay: true, scoreValue: 1, who: [["scorer", "a1"]] },
      // The home side changed goalies in the break: the 2nd period's first shot is a goal, then g3 makes a save.
      { period: { number: 2 }, type: { abbreviation: "goal" }, team: { id: "1" }, scoringPlay: true, scoreValue: 1, who: [["scorer", "a2"]] },
      { period: { number: 2 }, type: { abbreviation: "shot-on-goal" }, team: { id: "1" }, who: [["shooter", "a1"], ["saver", "g3"]] },
    ],
  });
  const lines = hockey.reduce(hockey.readPlays(game)).lines;
  assert.deepEqual([lines.g2, lines.g3], [{ SV: 1, SA: 2, ESSV: 1, GA: 1 }, { GA: 1, SA: 2, SV: 1, ESSV: 1 }]);
  // A playoff game's 5th period, named "2OT": overtime's goals, not a shootout's, even with no season type to say so.
  const playoff = made({ plays: [{ period: { number: 5, displayValue: "2OT" }, type: { abbreviation: "goal" }, team: { id: "2" }, scoringPlay: true, scoreValue: 1, who: [["scorer", "h1"]] }] });
  delete playoff.header.season;
  const [goal] = hockey.readPlays(playoff);
  assert.deepEqual([goal.kind, goal.shootout, goal.deltas.h1, goal.score], ["goal", undefined, { G: 1, SOG: 1 }, { 1: 0, 2: 1 }]);
});

test("Hockey's defaults are data the spec reads: Yahoo's points for skaters and goalies, categories, slots, daily locks", () => {
  const d = defaultsFor("hockey");
  assert.equal(d.sport, "hockey");
  assert.deepEqual(d.scoring.points, { G: 6, A: 4, PM: 2, PPP: 2, SOG: 0.9, BLK: 1, W: 5, GA: -3, SV: 0.6, SO: 5 });
  for (const k of Object.keys(d.scoring.points)) assert.ok(hockey.stat(k) && hockey.stat(k).kind !== "rate", `${k} scores`);
  for (const k of d.categories.stats) assert.ok(hockey.stat(k), `${k} is a category`);
  const fill = new Set([...hockey.positions.map((p) => p.key), ...hockey.groups.map((g) => g.key)]);
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(fill.has(t), `${s.slot} takes ${t}`);
  assert.equal(d.closes, hockey.lock);
  const starters = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  assert.equal(d.specs.season.spec.count.start, starters, "the season's lineup is its slots");
  assert.equal(d.specs.season.spec.get.each, starters + d.slots.bench, "and its draft the slots and the bench");
  for (const { spec } of Object.values(d.specs).filter((x) => x.spec.score.by === "stats")) {
    assert.equal(spec.spec, 1);
    assert.equal(spec.score.by, "stats");
    assert.deepEqual(spec.score.points, d.scoring.points);
  }
});
