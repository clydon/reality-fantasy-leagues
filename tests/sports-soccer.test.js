// Soccer (src/lib/sports/soccer.ts, on src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, step L5 part 1): its
// vocabulary, ESPN's match sheets (`rosters`) and play by play (its commentary and key events) read into its keys, and the
// proof: each recorded match's plays, reduced, come to ESPN's own lines (every player's counts, the team totals ESPN gives, the
// score), the scorer's calls apart (a shot ESPN's lines count on target that its commentary calls blocked), and with the final's
// correction every number. The recorded matches (tests/fixtures/espn/, recorded by scripts/dev-test/record-espn.js) are Chelsea
// 0-2 Tottenham, 2026-10-24 (an own goal by Chelsea's keeper, Palmer's second yellow, two handballs), San Diego 2-2 Seattle in
// MLS, 2026-10-24 (a penalty saved, one scored in stoppage time), Australia 1-1 Egypt in the 2026 World Cup's Round of 32 (an own
// goal, extra time, a keeper brought on for the shootout, Egypt through 4-2 on penalties) and the World Cup final, Spain 1-0
// Argentina (a second yellow in stoppage time, the winner in extra time); and the DFB-Pokal's thinner commentary, Holstein Kiel
// 1-1 Hoffenheim, 2026-10-28 (extra time, Kiel through on penalties). The same proof against many real matches is
// scripts/dev-test/check-sport-reduce.js --league=soccer/eng.1. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, plainName } = jiti("../src/lib/sports/index.ts");

const soccer = sportOf("soccer/eng.1");
const SPURS = require("./fixtures/espn/epl-401878767.json");
const MLS = require("./fixtures/espn/mls-761901.json");
const SHOOTOUT = require("./fixtures/espn/wc-760499.json");
const FINAL = require("./fixtures/espn/wc-760517.json");
const THIN = require("./fixtures/espn/dfb-401917034.json");
const GAMES = [
  ["Chelsea 0-2 Tottenham", SPURS],
  ["San Diego 2-2 Seattle (MLS)", MLS],
  ["Australia 1-1 Egypt (extra time, a shootout)", SHOOTOUT],
  ["Spain 1-0 Argentina (the World Cup final, extra time)", FINAL],
];
const nameOf = (box, name) => Object.values(box.people).find((p) => p.name === name);
const named = (box, deltas) => Object.fromEntries(Object.entries(deltas).map(([w, d]) => [box.people[w]?.name ?? w, d]));
const playOf = (plays, id) => plays.find((p) => p.id === id);

test("Soccer's vocabulary: unique stat keys, positions in GK/DEF/MID/FWD, two halves and extra time, weekly locks, every league", () => {
  assert.equal(soccer.id, "soccer");
  assert.equal(sportById("soccer"), soccer);
  for (const l of ["soccer/usa.1", "soccer/uefa.champions", "soccer/fifa.world", "soccer/eng.league_cup", "soccer/ger.dfb_pokal"]) assert.equal(sportOf(l), soccer, `${l}: ESPN writes every league alike`);
  assert.ok(allSports().includes(soccer));
  const keys = soccer.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "keys are unique: a goal is G, a goal conceded GA, a shootout's goal SOGOAL");
  const groups = new Set(soccer.statGroups.map((g) => g.key));
  for (const s of soccer.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    assert.ok(["higher", "lower"].includes(s.better), s.key);
    assert.equal(s.kind === "count", !s.of, `${s.key}: counts are counted, the rest worked out`);
  }
  // Everything ESPN's lines have, the plays carry: nothing waits for the final.
  assert.deepEqual(soccer.stats.filter((s) => s.known === "final").map((s) => s.key), []);
  // The data provider's calls, which ESPN's lines can count otherwise after the play.
  assert.deepEqual(soccer.stats.filter((s) => s.judged).map((s) => s.key), ["A", "SHOT", "SOG", "OF", "SV", "FC", "FA"]);
  assert.deepEqual(soccer.groups.map((g) => g.key), ["GK", "DEF", "MID", "FWD"]);
  const posGroups = new Set(soccer.groups.map((g) => g.key));
  for (const p of soccer.positions) assert.ok(posGroups.has(p.group), p.key);
  for (const g of soccer.groups) for (const s of g.stats) assert.ok(groups.has(s), g.key);
  // A team's roster says G, D, M or F; a match sheet the slot in the formation; a bench slot isn't a position.
  assert.deepEqual(["G", "D", "M", "F", "CD-L", "AM-R", "CF-R"].map((k) => soccer.position(k).group), ["GK", "DEF", "MID", "FWD", "DEF", "MID", "FWD"]);
  assert.equal(soccer.positionKey("SUB"), null);
  assert.equal(soccer.lock, "weekly");
  assert.equal(soccer.where({ period: 1, half: null, clock: "23'" }), "1st half, 23'");
  assert.equal(soccer.where({ period: 2, half: null, clock: "90'+5'" }), "2nd half, 90'+5'");
  assert.equal(soccer.where({ period: 3, half: null, clock: "98'" }), "extra time, 1st half, 98'");
  assert.equal(soccer.where({ period: 4, half: null, clock: "117'" }), "extra time, 2nd half, 117'");
  assert.equal(soccer.where({ period: 5, half: null, clock: null, shootout: true }), "penalty shootout");
  const ctx = soccer.specStats();
  assert.deepEqual(ctx.find((s) => s.key === "CS"), { key: "CS", label: "clean sheet" });
  assert.ok(!ctx.some((s) => s.key === "SV%" || s.key === "SOG%"), "rates aren't scored");
});

test("derived and rate stats: 60 minutes, a clean sheet for anyone who played, every two conceded, every three saves", () => {
  const full90 = soccer.full({ APP: 1, GS: 1, MIN: 90 });
  assert.deepEqual([full90.MIN60, full90.CS, full90.GA2], [1, 1, 0], "a clean sheet with nothing in defending's counts");
  const subbed = soccer.full({ APP: 1, SUB: 1, MIN: 31 });
  assert.deepEqual([subbed.MIN60, subbed.CS], [0, 0], "under 60 minutes, no clean sheet (FPL's)");
  const beaten = soccer.full({ APP: 1, MIN: 90, GA: 3 });
  assert.deepEqual([beaten.CS, beaten.GA2], [0, 1]);
  const keeper = soccer.full({ APP: 1, MIN: 90, SV: 7, GA: 2 });
  assert.deepEqual([keeper.SV3, keeper["SV%"]], [2, 7 / 9]);
  assert.ok(!("SV3" in soccer.full({ APP: 1, MIN: 90, G: 1 })), "an outfield player's line has no goalkeeping");
  assert.ok(!("CS" in soccer.full({ YC: 1 })), "booked on the bench: he didn't play");
  assert.deepEqual([plainName("Gaëtan Perrin"), plainName("Pascal Groß"), plainName("Odin Bjørtuft"), plainName("Luc de Fougerolles")], ["gaetan perrin", "pascal gross", "odin bjortuft", "luc de fougerolles"]);
});

test("ESPN's match sheets in Soccer's keys: a player's line, a keeper's saves, the bench, the team's totals, the shootout", () => {
  const box = soccer.readBox(SPURS);
  assert.equal(box.event, "401878767");
  assert.deepEqual(box.teams.map((t) => [t.id, t.abbreviation, t.home, t.score, t.winner]), [["363", "CHE", true, 0, false], ["367", "TOT", false, 2, true]]);
  // Palmer's second yellow: a red, and his first yellow off his line.
  const palmer = nameOf(box, "Cole Palmer");
  assert.equal(palmer.position, "CF-R");
  assert.deepEqual(palmer.stats, { APP: 1, FC: 2, FA: 0, OG: 0, RC: 1, SUB: 0, YC: 0, GA: 1, A: 0, OF: 0, SOG: 1, G: 0, SHOT: 2, GS: 1 });
  // A keeper's line has saves and no offsides; his own goal is his and one he conceded.
  assert.deepEqual(nameOf(box, "Mike Penders").stats, { APP: 1, FC: 0, FA: 0, OG: 1, RC: 0, SUB: 0, YC: 0, GA: 2, SV: 3, A: 0, SOG: 0, G: 0, SHOT: 0, GS: 1 });
  // A sub's slot is "SUB": no position (his roster's is G, D, M or F).
  assert.deepEqual([nameOf(box, "Estêvão").position, nameOf(box, "Estêvão").stats.SUB, nameOf(box, "Estêvão").stats.GS], [null, 1, 0]);
  assert.equal(Object.values(box.people).filter((p) => !Object.keys(p.stats).length).length, 10, "on the bench all game: no line");
  assert.deepEqual(box.teams[0].stats, { FC: 14, YC: 2, RC: 1, OF: 2, SV: 3, SHOT: 7, SOG: 4 });
  assert.ok(!("PKG" in box.teams[0].stats), "ESPN's team penalty goals are always 0: left out");
  // A shootout's goals are the header's, apart from the score.
  const so = soccer.readBox(SHOOTOUT);
  assert.deepEqual(so.teams.map((t) => [t.abbreviation, t.score, t.winner, t.stats.SOGOAL]), [["AUS", 1, false, 2], ["EGY", 1, true, 4]]);
  assert.equal(soccer.readBox({}), null);
});

for (const [name, game] of GAMES) {
  test(`the proof, ${name}: the plays alone reduce to ESPN's own lines, every team total and the score`, () => {
    const box = soccer.readBox(game);
    const notes = [];
    const plays = soccer.readPlays(game, notes);
    assert.deepEqual(notes, [], "nothing the reader couldn't read");
    const state = soccer.reduce(plays);
    let compared = 0;
    const judged = [];
    for (const p of Object.values(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) {
        const had = state.lines[p.id]?.[k] ?? 0;
        if (soccer.stat(k).judged && had !== v) judged.push(`${p.name} ${k}`);
        else assert.equal(had, v, `${p.name} ${k}`);
        compared++;
      }
    }
    assert.ok(compared > 400, `${compared} numbers compared`);
    // The provider's calls the plays tell otherwise: one at most here (a shot its commentary calls blocked, counted saved).
    assert.ok(judged.length <= 1, judged.join(", "));
    for (const [id, l] of Object.entries(state.lines)) assert.ok(Object.keys(box.people[id]?.stats ?? {}).length, `${box.people[id]?.name ?? id} played (${Object.keys(l)})`);
    for (const t of box.teams) {
      const sum = {};
      for (const p of Object.values(box.people)) {
        if (p.team !== t.id) continue;
        for (const [k, v] of Object.entries(soccer.full(state.lines[p.id] ?? {}))) sum[k] = (sum[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(t.stats)) if (!soccer.stat(k).judged || !judged.length) assert.equal(sum[k] ?? 0, v, `${t.abbreviation} ${k}`);
      assert.equal(state.score[t.id], t.score, `${t.abbreviation}'s score`);
    }
  });
}

test("plays: in time order with their period and minute; an own goal, a second yellow, handballs, offsides and saves read off the text", () => {
  const box = soccer.readBox(SPURS);
  const plays = soccer.readPlays(SPURS);
  for (let i = 1; i < plays.length; i++) assert.ok(plays[i].at >= plays[i - 1].at, `${plays[i].id} after ${plays[i - 1].id}`);
  assert.ok(plays.every((p) => p.period >= 1 && p.period <= 2 && p.half === null && p.unit === null));
  // The kickoff puts the starters on: their appearance and start.
  const kickoff = plays[0];
  assert.equal(kickoff.kind, "kickoff");
  assert.equal(Object.keys(kickoff.deltas).length, 22);
  assert.deepEqual(named(box, kickoff.deltas)["Cole Palmer"], { APP: 1, GS: 1 });
  // Chelsea's keeper's own goal: his, and Tottenham's goal, conceded by everyone Chelsea had on.
  const og = playOf(plays, "54194895");
  assert.equal(soccer.where(og), "2nd half, 77'");
  assert.deepEqual(og.score, { 363: 0, 367: 1 });
  assert.deepEqual(named(box, og.deltas)["Mike Penders"], { OG: 1, GA: 1 });
  assert.equal(Object.values(og.deltas).filter((d) => d.GA).length, 11);
  // Palmer's second yellow: a red, his first yellow off, and his minutes to it; three minutes later Tel's goal finds him gone.
  assert.deepEqual(named(box, playOf(plays, "54195373").deltas), { "Cole Palmer": { RC: 1, YC: -1, MIN: 35 } });
  const tel = playOf(plays, "54196045");
  assert.deepEqual(named(box, tel.deltas)["Mathys Tel"], { G: 1, SHOT: 1, SOG: 1 });
  assert.equal(Object.values(tel.deltas).filter((d) => d.GA).length, 10, "ten men left to concede it");
  // A handball is a foul committed; an offside is the one its text says was caught, not its person (who played the pass).
  assert.deepEqual(named(box, playOf(plays, "54186790").deltas), { "Mohammed Kudus": { FC: 1 } });
  assert.deepEqual(named(box, playOf(plays, "54189511").deltas), { "Morgan Rogers": { OF: 1 } });
  // A foul's two sentences, one play: who fouled, who was fouled.
  const foul = plays.find((p) => p.kind === "foul");
  assert.deepEqual(Object.values(foul.deltas).map((d) => Object.keys(d)[0]).sort(), ["FA", "FC"]);
  // A save is the keeper's the text names.
  const save = plays.find((p) => p.kind === "shot-on-target");
  assert.ok(/saved .* by (.+?) \(/.test(save.text));
  assert.ok(Object.entries(save.deltas).some(([w, d]) => d.SV && box.people[w].position === "G"));
  // Minutes: 90 for anyone on all game, to the minute shown for a substitution (stoppage time not counted).
  const end = soccer.reduce(plays).lines;
  assert.deepEqual([end[nameOf(box, "Jordan Henderson").id].MIN, end[nameOf(box, "Cole Palmer").id].MIN, end[nameOf(box, "Estêvão").id].MIN], [90, 80, 18]);
});

test("penalties: one saved (the keeper's save and penalty save, the taker's miss), one scored (a goal and a penalty)", () => {
  const box = soccer.readBox(MLS);
  const plays = soccer.readPlays(MLS);
  assert.deepEqual(named(box, playOf(plays, "54260039").deltas), { "Anders Dreyer": { SHOT: 1, SOG: 1, PKA: 1, PKM: 1 }, "Andy Thomas": { SV: 1, PKSV: 1 } });
  const pen = playOf(plays, "54262080");
  assert.equal(soccer.where(pen), "2nd half, 90'+6'");
  assert.deepEqual(named(box, pen.deltas)["Cédric Bakambu"], { G: 1, SHOT: 1, SOG: 1, PKG: 1, PKA: 1 });
  assert.deepEqual(pen.score, { 9726: 2, 22529: 2 });
  // A goal's assist is its second person's; a shot's "Assisted by" isn't one.
  assert.deepEqual(named(box, playOf(plays, "54259868").deltas)["Hassani Dotson"], { A: 1 });
  const lines = soccer.reduce(plays).lines;
  assert.ok(Object.values(lines).every((l) => !l.A || l.A <= 1));
});

test("extra time and a shootout: periods 3 and 4, 120 minutes, the shootout's own counts and never the score", () => {
  const box = soccer.readBox(SHOOTOUT);
  const plays = soccer.readPlays(SHOOTOUT);
  const et = plays.filter((p) => p.period === 3 || p.period === 4);
  assert.ok(et.length > 40);
  assert.equal(soccer.where(et.find((p) => p.kind === "foul" && p.period === 3)).split(",").slice(0, 2).join(","), "extra time, 1st half");
  const so = plays.filter((p) => p.shootout);
  assert.ok(so.length === 10 && so.every((p) => p.period === 5 && p.clock === null && soccer.where(p) === "penalty shootout"));
  assert.ok(so.every((p) => JSON.stringify(p.score) === JSON.stringify({ 628: 1, 2620: 1 })), "the score stays 1-1");
  const shootout = soccer.reduce(so).lines;
  const sum = (team, k) => Object.entries(shootout).filter(([w]) => box.people[w].team === team).reduce((n, [, l]) => n + (l[k] ?? 0), 0);
  assert.deepEqual([sum("628", "SOGOAL"), sum("2620", "SOGOAL"), sum("628", "SOMISS")], [2, 4, 2], "the header's 2-4");
  // Australia brought on a keeper for it (Ryan for Beach, 119'): the shootout's goals against are his.
  assert.deepEqual(shootout[nameOf(box, "Mathew Ryan").id], { SOGA: 4 });
  const end = soccer.reduce(plays).lines;
  assert.deepEqual([end[nameOf(box, "Mohamed Salah").id].MIN, end[nameOf(box, "Patrick Beach").id].MIN, end[nameOf(box, "Mathew Ryan").id].MIN], [120, 119, 1]);
  assert.equal(end[nameOf(box, "Mohamed Salah").id].SOGOAL, 1);
  assert.ok(!end[nameOf(box, "Mohamed Salah").id].G, "his kick isn't a goal");
});

test("a game as of a moment: the end of normal time in the World Cup final, then extra time's winner", () => {
  const box = soccer.readBox(FINAL);
  const plays = soccer.timeline(FINAL);
  const ninety = plays.find((p) => p.kind === "end-regular-time");
  const at = soccer.reduce(plays, ninety.at);
  assert.deepEqual(at.score, { 164: 0, 202: 0 });
  const messi = nameOf(box, "Lionel Messi").id;
  const enzo = nameOf(box, "Enzo Fernández").id;
  assert.deepEqual([at.lines[messi].MIN, at.lines[enzo].MIN, at.lines[enzo].RC, at.lines[enzo].YC], [90, 90, 1, undefined]);
  assert.equal(soccer.where(at.last), "2nd half, 90'+9'");
  const winner = plays.find((p) => p.kind === "goal");
  assert.equal(soccer.where(winner), "extra time, 2nd half, 106'");
  const end = soccer.reduce(plays);
  assert.deepEqual(end.score, { 164: 1, 202: 0 });
  assert.equal(end.lines[messi].MIN, 120);
  assert.equal(end.lines[nameOf(box, "Ferran Torres").id].G, 1);
  // Before the kickoff: 0-0, nobody on.
  assert.deepEqual(soccer.stateAt(FINAL, Date.parse(plays[0].at) - 1).score, { 164: 0, 202: 0 });
});

test("the final's correction: only the provider's calls, and with it every number of ESPN's lines", () => {
  for (const [, game] of GAMES) {
    const box = soccer.readBox(game);
    const correction = soccer.correction(soccer.reduce(soccer.readPlays(game)), box);
    for (const [who, d] of Object.entries(correction)) for (const k of Object.keys(d)) assert.ok(soccer.stat(k).judged, `${box.people[who].name} ${k}`);
    const end = soccer.reduce(soccer.timeline(game));
    for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
  }
  const live = JSON.parse(JSON.stringify(SPURS));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!soccer.timeline(live).some((p) => p.final));
});

test("the thinner commentary (the DFB-Pokal's): goals, cards, substitutions and minutes exact; the rest at the final; the shootout filed in period 0", () => {
  const box = soccer.readBox(THIN);
  const notes = [];
  const plays = soccer.readPlays(THIN, notes);
  assert.deepEqual(notes, []);
  assert.equal(THIN.commentary.length, 30, "its commentary is its key events again, and the kicks");
  const state = soccer.reduce(plays);
  let exact = 0;
  for (const p of Object.values(box.people)) {
    for (const [k, v] of Object.entries(p.stats)) {
      if (soccer.stat(k).judged) continue;
      assert.equal(state.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
      exact++;
    }
  }
  assert.ok(exact > 250, `${exact} numbers`);
  // Kiel through 4-3 on penalties: kicks at 121'-128' in period 0, the shootout's, never the score.
  const so = plays.filter((p) => p.shootout);
  assert.ok(so.length === 10 && so.every((p) => p.period === 5 && soccer.where(p) === "penalty shootout"));
  assert.deepEqual(box.teams.map((t) => [t.abbreviation, state.score[t.id], t.score, t.winner]), [["KSV", 1, 1, true], ["TSG", 1, 1, false]]);
  const sum = (team, k) => Object.entries(state.lines).filter(([w]) => box.people[w].team === team).reduce((n, [, l]) => n + (l[k] ?? 0), 0);
  assert.deepEqual(box.teams.map((t) => [t.abbreviation, sum(t.id, "SOGOAL"), t.stats.SOGOAL]), [["KSV", 4, 4], ["TSG", 3, 3]]);
  // Extra time's minutes: 120 for anyone on throughout.
  assert.ok(Object.values(state.lines).some((l) => l.MIN === 120));
  // The final's correction brings the shots, fouls, offsides, saves and assists: only judged stats, then every number.
  const correction = soccer.correction(state, box);
  for (const d of Object.values(correction)) for (const k of Object.keys(d)) assert.ok(soccer.stat(k).judged, k);
  const end = soccer.reduce(soccer.timeline(THIN));
  for (const p of Object.values(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[p.id]?.[k] ?? 0, v, `${p.name} ${k}`);
});

test("a thinner feed's full time: no event says it, so everyone on is counted to the end in a play of the final's", () => {
  const box = soccer.readBox(THIN);
  // Cut to the first two halves, a match that ended at 90' (no half time, no end: the thinner feed has neither).
  const ninety = { ...THIN, commentary: THIN.commentary.filter((c) => c.play?.period?.number >= 1 && c.play.period.number <= 2), keyEvents: THIN.keyEvents.filter((e) => e.period?.number >= 1 && e.period.number <= 2) };
  const plays = soccer.readPlays(ninety);
  const end = plays[plays.length - 1];
  assert.deepEqual([end.kind, end.final, end.period], ["end", true, 2]);
  const lines = soccer.reduce(plays).lines;
  const starters = Object.values(box.people).filter((p) => p.stats.GS && !THIN.commentary.some((c) => c.play?.type?.type === "substitution" && c.play.participants?.[1]?.athlete?.displayName === p.name && c.play.period.number <= 2) && !p.stats.RC);
  assert.ok(starters.length >= 10, `${starters.length} on throughout`);
  for (const p of starters) assert.equal(lines[p.id].MIN, 90, p.name);
  // Live, it isn't there: full time is known at the final.
  const live = JSON.parse(JSON.stringify(ninety));
  live.header.competitions[0].status.type = { state: "in", completed: false };
  assert.ok(!soccer.readPlays(live).some((p) => p.kind === "end"));
});

// A made-up match for what the recorded ones don't show: the away side (1) at the home side (2).
function made({ commentary = [], keyEvents = [], starters = ["a1", "a2", "k1", "h1", "h2", "k2"], bench = ["a3", "h3"] } = {}) {
  const NAMES = { a1: "Al Able", a2: "Bo Baker", a3: "Ed Evans", k1: "Kai Keeper", h1: "Cy Cole", h2: "Diego Gómez", h3: "Joe Gomez", k2: "Lu Last" };
  const team = (id) => (id[0] === "a" || id === "k1" ? "1" : "2");
  const row = (id) => ({ starter: starters.includes(id), athlete: { id, displayName: NAMES[id] }, position: { abbreviation: id[0] === "k" ? "G" : starters.includes(id) ? "CM" : "SUB" }, stats: [] });
  const players = [...starters, ...bench];
  const tname = { 1: "Zt Away", 2: "Zt Home" };
  const play = (p, i) => ({ id: p.id ?? `z${i}`, type: { type: p.type }, period: { number: p.period ?? 1 }, clock: { value: p.at ?? i * 60, displayValue: `${Math.ceil((p.at ?? i * 60) / 60)}'` }, team: p.team ? { displayName: tname[p.team] } : undefined, participants: (p.who ?? []).map((w) => ({ athlete: { displayName: NAMES[w] } })), wallclock: p.wallclock === null ? undefined : `2026-10-24T14:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z` });
  return {
    header: {
      id: "zt3",
      competitions: [{ status: { type: { state: "post", completed: true } }, competitors: [{ homeAway: "away", score: "0", team: { id: "1", displayName: tname[1], abbreviation: "ZTA" } }, { homeAway: "home", score: "0", team: { id: "2", displayName: tname[2], abbreviation: "ZTH" } }] }],
    },
    rosters: ["1", "2"].map((t) => ({ team: { id: t, displayName: tname[t] }, roster: players.filter((id) => team(id) === t).map(row) })),
    keyEvents: keyEvents.map((e, i) => ({ ...play(e, i), participants: (e.who ?? []).map((w) => ({ athlete: { id: w, displayName: NAMES[w] } })), team: e.team ? { id: e.team } : undefined, text: e.text })),
    commentary: commentary.map((c, i) => ({ sequence: i, time: { value: c.at ?? i * 60, displayValue: `${Math.ceil((c.at ?? i * 60) / 60)}'` }, text: c.text, ...(c.type ? { play: play(c, i) } : {}) })),
  };
}

test("the commentary ESPN's lines go by: a foul's names in its sentences, its other sentence with no play, a foul filed twice, simulation", () => {
  const game = made({
    commentary: [
      { type: "kickoff", text: "First Half begins." },
      // Its people say Al Able; its sentence (and ESPN's lines) Bo Baker.
      { id: "f1", type: "foul", team: "1", who: ["a1", "h1"], at: 120, text: "Foul by Bo Baker (Zt Away)." },
      { at: 120, text: "Cy Cole (Zt Home) wins a free kick in the defensive half." },
      // Filed twice under two ids, a sentence each: one foul.
      { id: "f2", type: "foul", team: "2", who: ["h1", "a2"], at: 300, text: "Bo Baker (Zt Away) wins a free kick on the left wing." },
      { id: "f3", type: "foul", team: "2", who: ["h1", "a2"], at: 300, text: "Foul by Cy Cole (Zt Home)." },
      // Both sentences with no play: a foul of its own.
      { at: 600, text: "Diego Gómez (Zt Home) wins a free kick in the attacking half." },
      { at: 601, text: "Foul by Al Able (Zt Away)." },
      { at: 900, text: "Al Able (Zt Away) has gone down, but the referee deems it simulation." },
      { at: 950, text: "Penalty conceded by Cy Cole (Zt Home) with a handball in the penalty area." },
    ],
  });
  // (Final with no end said: everyone on to 90 minutes.)
  const lines = soccer.reduce(soccer.readPlays(game)).lines;
  assert.deepEqual(lines.a1, { APP: 1, GS: 1, FC: 2, MIN: 90 });
  assert.deepEqual(lines.a2, { APP: 1, GS: 1, FC: 1, FA: 1, MIN: 90 });
  assert.deepEqual(lines.h1, { APP: 1, GS: 1, FA: 1, FC: 2, MIN: 90 });
  assert.deepEqual(lines.h2, { APP: 1, GS: 1, FA: 1, MIN: 90 }, "Brighton's Diego Gómez, never Joe Gomez on the bench");
  assert.ok(!lines.h3);
});

test("a thinner commentary (key events only, the DFB-Pokal's): a red after a yellow is a second; goals conceded by who's on, in ESPN's order", () => {
  const game = made({
    keyEvents: [
      { type: "kickoff" },
      { type: "yellow-card", team: "1", who: ["a1"], at: 600, text: "Al Able (Zt Away) Yellow Card at 10'" },
      { type: "red-card", team: "1", who: ["a1"], at: 1200, text: "Al Able (Zt Away) Red Card at 20'" },
      { type: "yellow-card", team: "2", who: ["h1"], at: 1300, text: "Cy Cole (Zt Home) Yellow Card at 22'" },
      { type: "red-card", team: "2", who: ["h1"], at: 1400, text: "Cy Cole (Zt Home) is shown the red card." },
      // A substitution, then a goal in the same minute: the one who came on concedes it.
      { type: "substitution", team: "1", who: ["a3", "a2"], at: 1800 },
      { type: "goal", team: "2", who: ["h2"], at: 1810, text: "Diego Gómez (Zt Home) Goal at 31'" },
      { type: "retired", team: "2", who: ["k2"], at: 2400, text: "Lu Last went off injured after Zt Home had used all subs." },
      { type: "halftime", at: 2700 },
    ],
  });
  const lines = soccer.reduce(soccer.readPlays(game)).lines;
  assert.deepEqual(lines.a1, { APP: 1, GS: 1, RC: 1, MIN: 20 }, "his yellow comes off: a second yellow");
  assert.deepEqual(lines.h1, { APP: 1, GS: 1, YC: 1, RC: 1, MIN: 24 }, "\"shown the red card\": a straight red keeps his yellow");
  // Half time said, full time not (the match is final): the second half counted at the end.
  assert.deepEqual(lines.a3, { APP: 1, SUB: 1, GA: 1, MIN: 60 });
  assert.deepEqual(lines.a2, { APP: 1, GS: 1, MIN: 30 });
  assert.deepEqual([lines.k1.GA, lines.k1.MIN], [1, 90]);
  assert.deepEqual([lines.h2.G, lines.k2.MIN], [1, 40], "off injured at 40'");
});

test("Soccer's defaults are data the spec reads: FPL's points (by position beside), the squad and slots, weekly locks", () => {
  const d = defaultsFor("soccer");
  assert.equal(d.sport, "soccer");
  assert.deepEqual(d.scoring.points, { APP: 1, MIN60: 1, G: 5, A: 3, CS: 1, GA2: 0, SV3: 1, PKSV: 5, PKM: -2, YC: -1, RC: -3, OG: -2 });
  for (const k of Object.keys(d.scoring.points)) assert.ok(soccer.stat(k) && soccer.stat(k).kind !== "rate", `${k} scores`);
  // By position: a goal 10 to a keeper, 6 to a defender, 5 to a midfielder, 4 to a forward; `points` has the midfielder's.
  assert.deepEqual(d.scoring.byPosition.G, { GK: 10, DEF: 6, MID: 5, FWD: 4 });
  assert.deepEqual(d.scoring.byPosition.CS, { GK: 4, DEF: 4, MID: 1, FWD: 0 });
  for (const [k, by] of Object.entries(d.scoring.byPosition)) {
    assert.ok(soccer.stat(k), k);
    assert.deepEqual(Object.keys(by), soccer.groups.map((g) => g.key), `${k} by every group`);
    assert.equal(by.MID, d.scoring.points[k], `${k}: the flat table is a midfielder's`);
  }
  assert.deepEqual(d.categories.stats, []);
  const fill = new Set([...soccer.positions.map((p) => p.key), ...soccer.groups.map((g) => g.key)]);
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(fill.has(t), `${s.slot} takes ${t}`);
  assert.equal(d.closes, soccer.lock);
  const starters = d.slots.lineup.reduce((n, s) => n + s.n, 0);
  assert.equal(starters, 11);
  assert.equal(d.specs.season.spec.count.start, starters, "the season's lineup is its slots");
  assert.equal(d.specs.season.spec.get.each, starters + d.slots.bench, "and its draft the slots and the bench");
  assert.equal(Object.values(d.slots.squad).reduce((a, b) => a + b, 0), d.specs.season.spec.get.each, "FPL's squad of 15");
  for (const { spec } of Object.values(d.specs)) {
    assert.equal(spec.spec, 1);
    assert.equal(spec.score.by, "stats");
    assert.deepEqual(spec.score.points, d.scoring.points);
  }
});
