// Racing (src/lib/sports/racing.ts, a FieldSport in src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, L5 part 3b):
// its vocabulary for the five series ESPN carries (F1; NASCAR's Cup, O'Reilly and Truck series; IndyCar), ESPN's answers for a
// race weekend (its board's sessions in finishing order, and from the core API each scored session's competitors with their
// statistics and F1's status) read into plays and standings, and the proof: each recorded weekend's plays, reduced, come to
// ESPN's own numbers session by session (the place, ESPN's `pole` statistic as the grid, laps, laps led, pit stops, the fastest
// lap, F1's statuses, bonus and penalty points), the event's championship points (F1's race number is the weekend's) and ESPN's
// order. The recorded weekends (tests/fixtures/espn/, recorded by scripts/dev-test/record-espn.js) are F1's 2025 Chinese Grand
// Prix (a sprint weekend, three disqualified after the race) and 2026 Miami Grand Prix (22 cars, a sprint disqualification),
// NASCAR's 2025 Daytona 500 (four didn't qualify, penalties) and IndyCar's 2025 Indianapolis 500 (one didn't qualify, three
// moved to the back after the race). The same proof on every finished weekend of a series' season, and its standings against
// ESPN's, is scripts/dev-test/check-field-reduce.js --league=racing/f1 --season=2025 --standings. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, FieldSport, Racing, RACING_SERIES, coreStats, weekendOver } = jiti("../src/lib/sports/index.ts");

const CHINA = require("./fixtures/espn/f1-600052046.json");
const MIAMI = require("./fixtures/espn/f1-600057432.json");
const DAYTONA = require("./fixtures/espn/nascar-premier-202502160001.json");
const INDY = require("./fixtures/espn/irl-202505250106.json");
const EVENTS = [
  ["F1's 2025 Chinese Grand Prix (a sprint weekend)", CHINA],
  ["F1's 2026 Miami Grand Prix (a sprint weekend, 22 cars)", MIAMI],
  ["NASCAR's 2025 Daytona 500", DAYTONA],
  ["IndyCar's 2025 Indianapolis 500", INDY],
];
const f1 = sportOf("racing/f1");
const cup = sportOf("racing/nascar-premier");
const indy = sportOf("racing/irl");
const sportFor = (a) => sportOf(a._recorded.league);
const idOf = (a, name) => Object.values(sportFor(a).readBox(a).people).find((p) => p.name === name).id;
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const ms = (t) => Date.parse(t);
const at = (t, plus = 0) => new Date(ms(t) + plus).toISOString();
const session = (a, abbr) => a.board.competitions.find((c) => (c.type?.abbreviation ?? "Race") === abbr);

// A made-up weekend in ESPN's shapes: sessions [{ abbr, date, state, laps, order: [ids in finishing order, null for one listed
// without a place], core: { id: { startOrder, stats, status } } }].
function made({ id = "9", final = true, asked, sessions }) {
  const status = (st) => ({ type: { state: st, completed: st === "post", name: st === "post" ? "STATUS_FINAL" : st === "in" ? "STATUS_IN_PROGRESS" : "STATUS_SCHEDULED" } });
  const board = {
    id,
    name: "Made-up Grand Prix",
    status: status(final ? "post" : "in"),
    competitions: sessions.map((s, i) => ({
      id: `${id}${i}`,
      date: s.date,
      ...(s.abbr ? { type: { abbreviation: s.abbr } } : {}),
      status: { period: s.laps ?? 0, ...status(s.state ?? "post") },
      competitors: (s.order ?? []).map((who, j) => ({ id: who ?? s.unplaced[j], type: "athlete", ...(who ? { order: j + 1 } : {}), athlete: { displayName: `Driver ${who ?? s.unplaced[j]}` } })),
    })),
  };
  const core = {};
  sessions.forEach((s, i) => {
    if (!s.core) return;
    core[`${id}${i}`] = {
      competitors: Object.entries(s.core).map(([who, c]) => ({
        id: who,
        ...(c.order != null ? { order: c.order } : {}),
        ...(c.startOrder != null ? { startOrder: c.startOrder } : {}),
        statistics: { splits: { categories: [{ stats: Object.entries(c.stats ?? {}).map(([name, value]) => ({ name, value })) }] } },
        ...(c.status ? { status: { type: { name: c.status } } } : {}),
      })),
    };
  });
  return { ...(asked ? { _asked: asked } : {}), board, core };
}

test("Racing's vocabulary: unique stat keys, a series an instance (F1's sessions, NASCAR's and IndyCar's laps led), locks per event", () => {
  const all = allSports().filter((s) => s instanceof Racing);
  assert.deepEqual(all.map((s) => s.leagues[0]), ["nascar-premier", "nascar-secondary", "nascar-truck", "f1", "irl"]);
  assert.deepEqual(RACING_SERIES.map((s) => s.league), all.map((s) => s.leagues[0]));
  for (const s of all) {
    assert.ok(s instanceof FieldSport);
    assert.equal(s.id, "racing");
    assert.equal(sportOf(`racing/${s.leagues[0]}`), s, s.name);
    assert.equal(s.lock, "event");
    const keys = s.stats.map((x) => x.key);
    assert.equal(new Set(keys).size, keys.length, `${s.name}: unique keys`);
    for (const x of s.stats) assert.ok(s.statGroups.some((g) => g.key === x.group), `${s.name}: ${x.key}'s group`);
    for (const k of s.placeKeys) assert.ok(s.stat(k), k);
    for (const k of ["FIN", "GRID", "PG", "POLE", "LAPS", "LEADLAP", "LEDANY", "CHPTS", "POS", "W", "PODIUM", "TOP5", "TOP10"]) assert.ok(s.stat(k), `${s.name}: ${k}`);
  }
  assert.equal(sportById("racing"), cup, "the sport's first, NASCAR's Cup, whose defaults are the sport's");
  assert.equal(sportOf("racing/motogp"), null, "a series not read");
  // Each series offers what its feed has: F1 its sessions, statuses, pit stops and the fastest lap; NASCAR and IndyCar laps
  // led as laps, the most led, bonus and penalty points, who didn't qualify.
  for (const k of ["SPR", "SGRID", "SPG", "SFL", "SDNF", "QUAL", "Q2", "Q3", "SQ", "FP1", "FL", "PITS", "DNF", "DQ"]) assert.ok(f1.stat(k) && !cup.stat(k), k);
  for (const k of ["LED", "MOSTLED", "BONUS", "PEN", "DNQ"]) assert.ok(cup.stat(k) && indy.stat(k) && !f1.stat(k), k);
  assert.deepEqual(f1.statGroups.map((g) => g.key), ["race", "sprint", "qualifying", "practice", "finish", "points"]);
  assert.deepEqual(cup.statGroups.map((g) => g.key), ["race", "finish", "points"]);
  assert.ok(!cup.specStats().some((x) => x.key === "SPR"));
  assert.equal(f1.stat("FIN").better, "lower");
  assert.equal(f1.where({ period: 5, half: null, clock: null, session: "Race" }), "the race");
  assert.equal(f1.where({ period: 2, half: null, clock: null, session: "SS" }), "sprint qualifying");
  assert.equal(f1.where({ period: 2, half: null, clock: null, session: "FP2" }), "2nd practice");
  assert.equal(cup.periods.regulation, 1);
  assert.equal(f1.periods.regulation, 5);
});

test("the proof: each recorded weekend's plays come to ESPN's own numbers, session by session, and its order; the timeline is the same", () => {
  for (const [name, a] of EVENTS) {
    const sport = sportFor(a);
    const box = sport.readBox(a);
    const event = sport.fieldEvent(a);
    const issues = [];
    const plays = sport.readPlays(a, issues);
    assert.deepEqual(issues, [], `${name}: the reader's notes`);
    assert.equal(box.final, true);
    const state = sport.reduce(plays, null, event);
    for (const [id, p] of Object.entries(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) if (!sport.placeKeys.includes(k)) assert.equal(state.lines[id]?.[k] ?? 0, v, `${name}: ${p.name} ${k}`);
      for (const [r, s] of Object.entries(p.parts)) for (const [k, v] of Object.entries(s)) assert.equal(state.parts[id]?.[r]?.[k] ?? 0, v, `${name}: ${p.name} session ${r} ${k}`);
      // ESPN's wins, top 5 and 10 are the standings' here.
      for (const k of ["W", "TOP5", "TOP10"]) assert.equal(state.lines[id]?.[k] ?? 0, p.stats[k] ?? 0, `${name}: ${p.name} ${k}`);
    }
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${name}: ${id} is ESPN's`);
    // The standings from the plays alone are ESPN's order (the disqualified and whoever didn't qualify out).
    assert.deepEqual(state.standings, box.standings, `${name}: the standings`);
    const race = session(a, "Race");
    assert.deepEqual(box.standings.filter((s) => s.status === "in").map((s) => s.id), race.competitors.filter((c) => c.order != null && !box.standings.find((s) => s.id === c.id && s.status !== "in")).map((c) => c.id));
    // ESPN's grid statistic (`pole`) is the core's startOrder, and its place the board's order.
    for (const c of a.core[race.id].competitors) {
      const st = coreStats(c);
      if (c.startOrder != null) assert.equal(st.pole, c.startOrder, `${name}: ${c.id}'s grid`);
      if (c.order != null) assert.equal(st.place, race.competitors.find((x) => x.id === c.id).order, `${name}: ${c.id}'s place`);
    }
    // The final's correction is nothing: every number's in the plays.
    const timeline = sport.timeline(a);
    const fix = timeline[timeline.length - 1];
    assert.equal(fix.kind, "final");
    assert.deepEqual(fix.deltas, {}, name);
    assert.deepEqual(sport.stateAt(a), sport.reduce(timeline, null, event), "stateAt with no moment: the end");
  }
  assert.equal(f1.fieldEvent({}), null);
  assert.equal(f1.readBox({}), null);
  assert.deepEqual(f1.readPlays({}), []);
});

test("F1's weekend: each session in its own keys, the sprint's points and the race's apart (ESPN's race number is the weekend's), the grid, statuses", () => {
  const box = f1.readBox(CHINA);
  const end = f1.stateAt(CHINA);
  const line = (n) => end.lines[idOf(CHINA, n)];
  // Piastri: 3rd in practice and sprint qualifying, 2nd in the sprint from 3rd, on pole, won the race from it.
  assert.deepEqual(line("Oscar Piastri"), { FP1: 3, SQ: 3, SGRID: 3, SPR: 2, SPG: 1, SLAPS: 19, CHPTS: 32, QUAL: 1, Q2: 1, Q3: 1, GRID: 1, POLE: 1, FIN: 1, LAPS: 56, LEADLAP: 1, LEDANY: 1, PITS: 1, POS: 1, W: 1, PODIUM: 1, TOP5: 1, TOP10: 1 });
  // The points: ESPN's race number is the weekend's (32 = the sprint's 7 + the race's 25), the plays have them apart.
  const plays = f1.readPlays(CHINA);
  const pts = (n, s) => plays.find((p) => p.who === idOf(CHINA, n) && p.session === s && p.kind.endsWith("result")).deltas[idOf(CHINA, n)].CHPTS ?? 0;
  assert.deepEqual([pts("Oscar Piastri", "SR"), pts("Oscar Piastri", "Race")], [7, 25]);
  assert.deepEqual([pts("Lewis Hamilton", "SR"), pts("Lewis Hamilton", "Race")], [8, 0], "won the sprint, disqualified from the race");
  assert.equal(box.people[idOf(CHINA, "Oscar Piastri")].stats.CHPTS, 32);
  // Disqualified after the race: ESPN's order kept (18th to 20th), out of the places, no places gained.
  for (const n of ["Charles Leclerc", "Lewis Hamilton", "Pierre Gasly"]) {
    assert.deepEqual(end.standings.find((s) => s.id === idOf(CHINA, n)), { id: idOf(CHINA, n), place: null, tied: false, status: "dq" });
    assert.equal(line(n).DQ, 1);
    assert.equal(line(n).PG, undefined);
    assert.equal(line(n).POS, undefined);
  }
  assert.equal(line("Lewis Hamilton").FIN, 19);
  assert.equal(line("Fernando Alonso").DNF, 1, "retired after 4 laps");
  assert.equal(line("Fernando Alonso").LAPS, 4);
  // The fastest laps: Norris's in the race, Hamilton's in the sprint (the driver with ESPN's fastestLapNum).
  assert.equal(line("Lando Norris").FL, 1);
  assert.equal(line("Lewis Hamilton").SFL, 1);
  assert.equal(Object.values(end.lines).filter((l) => l.FL).length, 1);
  // Qualifying: ten set a time in Q3, fifteen in Q2. Places gained count from the grid (ESPN's startOrder, not the qualifying
  // place after a penalty: 163 of 875 starts in 2025-26; the live test's b).
  assert.equal(Object.values(end.lines).filter((l) => l.Q3).length, 10);
  assert.equal(Object.values(end.lines).filter((l) => l.Q2).length, 15);
  assert.equal(line("Lando Norris").PG, 1, "3rd to 2nd");
  assert.equal(line("Lando Norris").SPG, -2, "6th to 8th in the sprint");
  assert.equal(line("George Russell").PG, -1);
  // Each play where it was: practice, sprint qualifying, the sprint's grid and result, qualifying, the grid, the race.
  assert.deepEqual([...new Set(plays.map((p) => p.kind))], ["practice-result", "sprint-qualifying-result", "sprint-grid", "sprint-result", "qualifying-result", "grid", "race-result"]);
  assert.match(plays.find((p) => p.kind === "race-result" && p.who === idOf(CHINA, "Lewis Hamilton")).text, /Lewis Hamilton: 19th in the race \(disqualified\)/);
  assert.equal(f1.where(plays.find((p) => p.kind === "sprint-result")), "the sprint");
  // Miami 2026: one disqualified from the sprint (SDQ, no places gained), one from qualifying, retirements.
  const m = f1.stateAt(MIAMI);
  assert.equal(Object.values(m.lines).filter((l) => l.SDQ).length, 1);
  assert.ok(Object.values(m.lines).filter((l) => l.SDQ).every((l) => l.SPG == null));
  assert.equal(Object.values(m.lines).filter((l) => l.QDQ).length, 1);
  assert.equal(Object.values(m.lines).filter((l) => l.DNF).length, 4);
  assert.equal(Object.values(m.lines).filter((l) => l.SDNF).length, 2);
  assert.equal(m.standings.length, 22);
  // A driver's car: its number and team.
  assert.deepEqual(box.people[idOf(CHINA, "Oscar Piastri")].car, { number: "81", team: "McLaren" });
});

test("NASCAR's and IndyCar's race: laps led and the most, stage points as bonus, penalties, whoever didn't qualify out of the places", () => {
  const end = cup.stateAt(DAYTONA);
  const line = (n) => end.lines[idOf(DAYTONA, n)];
  // Byron won from 5th, leading 10 laps; his 50 points his finish's 40 and 10 of stages.
  assert.deepEqual(line("William Byron"), { GRID: 5, FIN: 1, PG: 4, LAPS: 201, LEADLAP: 1, LEDANY: 1, LED: 10, BONUS: 10, CHPTS: 50, POS: 1, W: 1, PODIUM: 1, TOP5: 1, TOP10: 1 });
  assert.equal(line("Austin Cindric").MOSTLED, 1, "59 laps led");
  assert.equal(Object.values(end.lines).filter((l) => l.MOSTLED).length, 1);
  // ESPN's laps led add up to 202 of the 201 run (its own: check-field-reduce.js lists them apart).
  assert.equal(sum(Object.values(end.lines).map((l) => l.LED ?? 0)), 202);
  // Penalty points, kept apart from the points ESPN gives (its season standings take them off: IndyCar's add up exactly); the
  // score is the points less them.
  const penalised = Object.keys(end.lines).filter((id) => end.lines[id].PEN);
  assert.equal(penalised.length, 2);
  for (const id of penalised) assert.equal(end.score[id], (end.lines[id].CHPTS ?? 0) - end.lines[id].PEN);
  // Four listed without a place didn't qualify: out of the places, after everyone else, nothing else read.
  const out = end.standings.filter((s) => s.status === "cut");
  assert.deepEqual(out.map((s) => cup.readBox(DAYTONA).people[s.id].name), ["J.J. Yeley", "B.J. McLeod", "Anthony Alfredo", "Chandler Smith"]);
  for (const s of out) assert.deepEqual(end.lines[s.id], { DNQ: 1 });
  assert.deepEqual(end.standings.slice(-4), out);
  assert.equal(end.standings.length, 45);
  // IndyCar: Palou won from 6th; his bonus his qualifying points and a lap led; Sato led the most; Abel didn't qualify; three
  // moved to the back after the race are ESPN's 31st to 33rd; McLaughlin out before the start (no laps).
  const i = indy.stateAt(INDY);
  const il = (n) => i.lines[idOf(INDY, n)];
  assert.deepEqual(il("Álex Palou"), { GRID: 6, FIN: 1, PG: 5, LAPS: 200, LEADLAP: 1, LEDANY: 1, LED: 14, BONUS: 8, CHPTS: 58, POS: 1, W: 1, PODIUM: 1, TOP5: 1, TOP10: 1 });
  assert.equal(il("Takuma Sato").MOSTLED, 1);
  assert.deepEqual(il("Jacob Abel"), { DNQ: 1 });
  assert.deepEqual(["Marcus Ericsson", "Kyle Kirkwood", "Callum Ilott"].map((n) => il(n).POS), [31, 32, 33]);
  assert.equal(il("Scott McLaughlin").LAPS, undefined);
  assert.equal(il("Scott McLaughlin").FIN, 30);
  assert.equal(sum(Object.values(i.lines).map((l) => l.LED ?? 0)), 200);
});

test("a weekend as of a moment: each session known when the next one starts, a grid at its start, nobody placed until the race is known", () => {
  const box = f1.readBox(CHINA);
  const event = f1.fieldEvent(CHINA);
  const plays = f1.timeline(CHINA);
  const S = Object.fromEntries(CHINA.board.competitions.map((c) => [c.type.abbreviation, c.date]));
  const p = idOf(CHINA, "Oscar Piastri");
  const line = (t) => f1.reduce(plays, t, event).lines[p] ?? {};
  assert.deepEqual(line(at(S.FP1, 60_000)), {}, "practice on: nothing yet");
  assert.deepEqual(line(at(S.SS, -1)), {});
  assert.deepEqual(line(S.SS), { FP1: 3 }, "practice known when sprint qualifying starts");
  assert.deepEqual(line(S.SR), { FP1: 3, SQ: 3, SGRID: 3 }, "the sprint's grid at its start");
  assert.equal(line(S.Qual).SPR, 2);
  assert.equal(line(S.Qual).CHPTS, 7, "the sprint's points with it");
  assert.equal(line(S.Race).GRID, 1);
  assert.equal(line(S.Race).FIN, undefined, "the race on: no result yet");
  // Before the race is known, nobody's placed or won; the standings list the race's entrants.
  const mid = f1.reduce(plays, S.Race, event);
  assert.ok(mid.standings.every((s) => s.place == null && s.status === "in"));
  assert.equal(mid.standings.length, 20);
  assert.ok(!Object.values(mid.lines).some((l) => l.W || l.POS));
  // A finished weekend read with no `_asked`: the race known 12 hours after its start (nothing says sooner).
  assert.equal(line(at(S.Race, 12 * 3600_000 - 1)).FIN, undefined);
  assert.equal(line(at(S.Race, 12 * 3600_000)).FIN, 1);
  assert.deepEqual(f1.reduce(plays, Infinity, event).standings, box.standings);
  // Read on the evening of the race (`_asked`): known then.
  const asked = at(S.Race, 3 * 3600_000);
  const evening = f1.timeline({ ...CHINA, _asked: asked });
  assert.equal(f1.reduce(evening, asked, event).lines[p].FIN, 1);
  assert.equal(f1.reduce(evening, at(asked, -1), event).lines[p].FIN, undefined);
  // A moment that isn't one counts nothing.
  assert.deepEqual(f1.reduce(plays, "not a time", event).lines, {});
  // NASCAR's: the grid and who didn't qualify at the green flag, the result after.
  const d = cup.timeline(DAYTONA);
  const de = cup.fieldEvent(DAYTONA);
  const start = session(DAYTONA, "Race").date;
  const byron = idOf(DAYTONA, "William Byron");
  assert.deepEqual(cup.reduce(d, start, de).lines[byron], { GRID: 5 });
  assert.deepEqual(cup.reduce(d, start, de).lines[idOf(DAYTONA, "J.J. Yeley")], { DNQ: 1 });
  assert.equal(cup.reduce(d, start, de).standings.filter((s) => s.status === "cut").length, 4);
  assert.deepEqual(cup.reduce(d, at(start, -1), de).lines, {});
});

test("live: the race's running order from the board at the answer's moment, provisional; a grid before the start; no `_asked`, only at the end", () => {
  const sessions = [
    { abbr: "Qual", date: "2026-11-01T18:00:00Z", order: ["a", "b", "c"], core: { a: { order: 1 }, b: { order: 2 }, c: { order: 3 } } },
    // b qualified 2nd and starts 3rd (a penalty): places gained from the grid.
    { abbr: "Race", date: "2026-11-02T20:00:00Z", state: "in", laps: 12, order: ["b", "a", "c"], core: { a: { startOrder: 1 }, b: { startOrder: 3 }, c: { startOrder: 2 } } },
  ];
  const asked = "2026-11-02T20:20:00Z";
  const a = made({ final: false, asked, sessions });
  const plays = f1.readPlays(a);
  const event = f1.fieldEvent(a);
  const now = f1.reduce(plays, asked, event);
  assert.deepEqual(now.standings.map((s) => [s.id, s.place]), [["b", 1], ["a", 2], ["c", 3]]);
  assert.deepEqual(now.lines.b, { QUAL: 2, GRID: 3, FIN: 1, PG: 2, POS: 1, W: 1, PODIUM: 1, TOP5: 1, TOP10: 1 });
  assert.equal(f1.readBox(a).final, false);
  assert.ok(!f1.timeline(a).some((p) => p.kind === "final"), "live: no final's correction");
  // Qualifying known by the race's start; the grid at it.
  assert.deepEqual(f1.reduce(plays, "2026-11-02T20:00:00Z", event).lines.a, { QUAL: 1, GRID: 1, POLE: 1 });
  // Before the race starts: the grid where the core has it, no result.
  const pre = made({ final: false, asked: "2026-11-02T19:00:00Z", sessions: [sessions[0], { ...sessions[1], state: "pre", order: [], core: sessions[1].core }] });
  const pp = f1.readPlays(pre);
  assert.deepEqual(f1.reduce(pp, Infinity, f1.fieldEvent(pre)).lines.a, { QUAL: 1, GRID: 1, POLE: 1 });
  assert.equal(pp.find((x) => x.kind === "grid").at, "2026-11-02T19:00:00Z", "known when asked, before its start");
  // With no `_asked`, a live answer's race counts only at the end.
  const noAsk = made({ final: false, sessions });
  const np = f1.readPlays(noAsk);
  assert.equal(np[np.length - 1].at, null);
  assert.equal(f1.reduce(np, "2026-11-03T00:00:00Z", f1.fieldEvent(noAsk)).lines.b.FIN, undefined);
  assert.equal(f1.reduce(np, null, f1.fieldEvent(noAsk)).lines.b.FIN, 1);
  // ESPN's board says final from the first session's end (its status the last session over's: Mexico City 2026 after FP1),
  // FP2 to the race still scheduled: the weekend isn't over, so no final's correction yet.
  const afterFp1 = made({ final: true, asked: "2026-10-30T20:05:00Z", sessions: [{ abbr: "FP1", date: "2026-10-30T18:30:00Z", order: ["a", "b"] }, { abbr: "FP2", date: "2026-10-30T22:00:00Z", state: "pre" }, { abbr: "Race", date: "2026-11-01T20:00:00Z", state: "pre" }] });
  assert.equal(f1.readBox(afterFp1).final, false);
  assert.ok(!f1.timeline(afterFp1).some((p) => p.kind === "final"), "a weekend under way: no final's correction");
  assert.equal(weekendOver(made({ final: true, sessions: [{ abbr: "FP1", date: "2026-10-30T18:30:00Z", order: ["a"] }] }).board), true);
  // A session called off ("post", not completed) doesn't hold the weekend open.
  const off = made({ final: true, sessions: [{ abbr: "FP3", date: "2026-10-31T17:30:00Z", order: [] }, { abbr: "Race", date: "2026-11-01T20:00:00Z", order: ["a"] }] });
  off.board.competitions[0].status.type = { state: "post", completed: false, name: "STATUS_CANCELED" };
  assert.equal(weekendOver(off.board), true);
});

test("NASCAR's core before ESPN fills it in (Martinsville 2026, live): every car the race's laps, none led, no points; only places and the grid read", () => {
  // At lap 493 and at the first final answer: everyone the same laps, nobody a lap led, no points.
  const race = (stats) => [{ date: "2026-11-01T19:00:00Z", laps: 493, order: ["a", "b", "c"], core: { a: { order: 1, startOrder: 2, stats: { place: 1, pole: 2, ...stats.a } }, b: { order: 2, startOrder: 1, stats: { place: 2, pole: 1, ...stats.b } }, c: { order: 3, startOrder: 3, stats: { place: 3, pole: 3, ...stats.c } } } }];
  const empty = { lapsCompleted: 493, lapsLead: 0, championshipPts: 0 };
  const live = made({ final: false, asked: "2026-11-01T22:33:00Z", sessions: race({ a: empty, b: empty, c: empty }) });
  const issues = [];
  const event = cup.fieldEvent(live);
  const now = cup.reduce(cup.readPlays(live, issues), null, event);
  assert.deepEqual(now.lines.a, { FIN: 1, GRID: 2, PG: 1, POS: 1, W: 1, PODIUM: 1, TOP5: 1, TOP10: 1 }, "no laps, laps led or points");
  assert.ok(issues.some((x) => /not filled in yet/.test(x)));
  // Final on the board, the core not filled: not the final yet.
  const early = made({ final: true, sessions: race({ a: empty, b: empty, c: empty }) });
  assert.equal(cup.readBox(early).final, false);
  // Filled in: read whole, and final.
  const done = made({ final: true, sessions: race({ a: { lapsCompleted: 500, lapsLead: 362, championshipPts: 55 }, b: { lapsCompleted: 500, lapsLead: 138, championshipPts: 35 }, c: { lapsCompleted: 222, championshipPts: 1 } }) });
  const di = [];
  cup.readPlays(done, di);
  const box = cup.readBox(done);
  assert.equal(box.final, true);
  assert.equal(box.people.a.stats.LED, 362);
  assert.equal(box.people.c.stats.LAPS, 222);
  assert.ok(!di.some((x) => /not filled in yet/.test(x)));
  // A core asked without its statistics (laps 0 everywhere) isn't taken for one not filled in.
  const bare = made({ final: false, asked: "2026-11-01T22:33:00Z", sessions: race({ a: {}, b: {}, c: {} }) });
  const bi = [];
  cup.readPlays(bare, bi);
  assert.ok(!bi.some((x) => /not filled in yet/.test(x)));
});

test("ESPN's own: wins and top 10s all 0 (the order says who won); laps for one listed without a place (didn't qualify, nothing read)", () => {
  const sessions = [{ date: "2026-06-14T19:00:00Z", laps: 160, order: ["a", "b", null], unplaced: [null, null, "c"], core: { a: { order: 1, startOrder: 2, stats: { place: 1, pole: 2, lapsCompleted: 160, lapsLead: 100, wins: 0, top5: 0, top10: 0, championshipPts: 55 } }, b: { order: 2, startOrder: 1, stats: { place: 2, pole: 1, lapsCompleted: 160, lapsLead: 60, championshipPts: 35 } }, c: { stats: { lapsCompleted: 120 } } } }];
  const a = made({ sessions });
  const end = cup.stateAt(a);
  assert.equal(end.lines.a.W, 1, "the order's win, ESPN's flags 0");
  assert.equal(cup.readBox(a).people.a.stats.W, undefined, "ESPN's own (check-field-reduce.js lists it apart)");
  assert.deepEqual(end.lines.c, { DNQ: 1 }, "ESPN's 120 laps aren't read for one it gives no place");
  assert.deepEqual(cup.readBox(a).people.c.stats, { DNQ: 1 });
  assert.equal(end.lines.a.MOSTLED, 1);
  assert.equal(end.lines.b.POLE, 1);
  assert.deepEqual(end.standings.map((s) => [s.id, s.place, s.status]), [["a", 1, "in"], ["b", 2, "in"], ["c", null, "cut"]]);
  // One on the board without a place and missing from the core didn't qualify either.
  const boardOnly = made({ sessions: [{ ...sessions[0], core: { a: sessions[0].core.a, b: sessions[0].core.b } }] });
  assert.deepEqual(cup.stateAt(boardOnly).lines.c, { DNQ: 1 });
  // A live race's first answers, before ESPN's order is out: nobody's a non-qualifier yet.
  const early = made({ final: false, asked: "2026-06-14T19:01:00Z", sessions: [{ date: "2026-06-14T19:00:00Z", state: "in", laps: 0, order: [null, null, null], unplaced: ["a", "b", "c"], core: { a: { startOrder: 2 }, b: { startOrder: 1 }, c: {} } }] });
  const e = cup.stateAt(early);
  assert.ok(e.standings.every((s) => s.status === "in" && s.place == null));
  assert.deepEqual(e.lines.b, { GRID: 1, POLE: 1 });
  assert.equal(e.lines.c, undefined);
  // A session ESPN types otherwise isn't read, and says so.
  const issues = [];
  f1.readPlays(made({ sessions: [{ abbr: "FP4", date: "2026-06-14T19:00:00Z", order: ["a"] }] }), issues);
  assert.match(issues[0], /FP4/);
});

test("Racing's defaults are data the spec reads: DraftKings' NASCAR, F1 Fantasy's and IndyCar's own points, their places beside, locks per event", () => {
  const d = defaultsFor("racing");
  assert.equal(d.sport, "racing");
  assert.match(d.scoring.source, /DraftKings/);
  assert.deepEqual(d.scoring.points, { PG: 1, LED: 0.25 });
  const pos = d.scoring.byPlace.POS;
  assert.deepEqual([pos[1], pos[2], pos[3], pos[10], pos[11], pos[20], pos[21], pos[30], pos[31], pos[40]], [45, 42, 41, 34, 32, 23, 21, 12, 10, 1]);
  assert.equal(Object.keys(pos).length, 40);
  const f = defaultsFor("racing", "racing/f1");
  assert.match(f.scoring.source, /F1 Fantasy/);
  assert.deepEqual(f.scoring.points, { PG: 1, FL: 10, SFL: 5, DNF: -20, DQ: -20, SDNF: -10, QDQ: -5 });
  assert.deepEqual(Object.keys(f.scoring.byPlace), ["POS", "SPR", "QUAL"]);
  assert.deepEqual(f.slots.lineup, [{ slot: "D", n: 5, takes: ["drivers"] }]);
  assert.deepEqual(defaultsFor("racing", "irl").scoring.points, { CHPTS: 1, PEN: -1 });
  assert.equal(defaultsFor("racing", "nascar-truck"), d, "NASCAR's three series share the sport's");
  for (const s of allSports().filter((x) => x instanceof Racing)) {
    const own = defaultsFor("racing", s.leagues[0]);
    for (const k of [...Object.keys(own.scoring.points), ...Object.keys(own.scoring.byPlace ?? {})]) assert.ok(s.stat(k), `${s.name}: ${k}`);
    for (const spec of Object.values(own.specs).filter((x) => x.spec.score.by === "stats")) assert.deepEqual(spec.spec.score.points, own.scoring.points, s.name);
    assert.equal(own.specs.season.spec.get.each, sum(own.slots.lineup.map((x) => x.n)) + own.slots.bench);
    for (const slot of own.slots.lineup) for (const t of slot.takes) assert.ok(s.groups.some((g) => g.key === t), t);
    assert.equal(own.closes, s.lock);
  }
  // Scored by the tables on recorded races: Byron's Daytona 500 (DraftKings: 45 for the win, 4 places gained, 10 laps led),
  // Piastri's Chinese Grand Prix (F1 Fantasy: 25 for the win, 7 for 2nd in the sprint, 10 for pole; 0 places gained).
  const score = (dd, line) => sum(Object.entries(dd.scoring.points).map(([k, v]) => (line[k] ?? 0) * v)) + sum(Object.entries(dd.scoring.byPlace ?? {}).map(([k, t]) => t[line[k]] ?? 0));
  assert.equal(score(d, cup.stateAt(DAYTONA).lines[idOf(DAYTONA, "William Byron")]), 45 + 4 + 2.5);
  assert.equal(score(f, f1.stateAt(CHINA).lines[idOf(CHINA, "Oscar Piastri")]), 25 + 7 + 10);
  // Hamilton: the sprint's win (8) and fastest lap (5), 5th in qualifying (6), disqualified from the race (-20).
  assert.equal(score(f, f1.stateAt(CHINA).lines[idOf(CHINA, "Lewis Hamilton")]), 8 + 5 + 6 - 20);
});
