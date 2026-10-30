// Golf (src/lib/sports/golf.ts, a FieldSport in src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, L5 part 3): its
// vocabulary, ESPN's two answers for a tournament (its board's holes, its leaderboard's rounds, places and statuses) read into
// plays and standings, and the proof: each recorded tournament's plays, reduced, come to ESPN's own numbers (every round's
// strokes and score to par, the nines, the board's counts of birdies and bogeys, a playoff's, the outs) and its final places,
// and with the final's correction (the earnings) every number. The recorded tournaments (tests/fixtures/espn/, recorded by
// scripts/dev-test/record-espn.js) are the 2026 Butterfield Bermuda Championship (cut to 54 holes, a three-hole playoff on the
// Monday, a withdrawal 10 holes into round 2, a cut), the 2026 TOUR Championship (30 players, no cut, a hole in one, a
// withdrawal) and the 2026 Buick LPGA Shanghai (the LPGA's feed: rounds, no holes). The same proof on every finished event of a
// tour's season is scripts/dev-test/check-field-reduce.js --league=golf/pga. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, FieldSport, TeamSport, toParOf, holeKind, roundStats, boardCounts } = jiti("../src/lib/sports/index.ts");

const golf = sportOf("golf/pga");
const BERMUDA = require("./fixtures/espn/pga-401850917.json");
const TOUR = require("./fixtures/espn/pga-401811964.json");
const SHANGHAI = require("./fixtures/espn/lpga-401835172.json");
const EVENTS = [
  ["the 2026 Bermuda Championship (54 holes, a playoff)", BERMUDA],
  ["the 2026 TOUR Championship", TOUR],
  ["the 2026 Buick LPGA Shanghai (rounds only)", SHANGHAI],
];
const idOf = (box, name) => Object.values(box.people).find((p) => p.name === name).id;
const lbComps = (a) => a.leaderboard.events[0].competitions[0].competitors;

// A made-up tournament in ESPN's two shapes, from each player's strokes hole by hole in the order played (from the 1st, or the
// 10th for `back`), on a par-72 course of fours but for its par 3s and 5s.
const PARS = [4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 5];
const dv = (n) => (n === 0 ? "E" : n > 0 ? `+${n}` : String(n));
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
function made({ rounds = 4, cutRound = 0, cutScore = 0, cutCount = 0, final = true, asked, scoring = "Medal", courses, players }) {
  const tee = (r, i) => new Date(Date.parse("2026-06-04T12:00:00Z") + (r - 1) * 86400000 + i * 600000).toISOString().replace(".000Z", "Z");
  const holesOf = (p, r) => (p.rounds[r] ?? []).map((s, h) => {
    const hole = p.back ? ((h + 9) % 18) + 1 : h + 1;
    return { value: s, period: hole, scoreType: { displayValue: p.types?.[r]?.[h] ?? dv(s - PARS[hole - 1]) } };
  });
  const status = { type: { state: final ? "post" : "in", completed: final, name: final ? "STATUS_FINAL" : "STATUS_IN_PROGRESS" } };
  const board = {
    id: "9",
    name: "Made-up Open",
    status,
    competitions: [{ id: "9", competitors: players.map((p, i) => ({ id: p.id, type: "athlete", order: i + 1, athlete: { displayName: p.name }, linescores: [...p.rounds.map((_, r) => ({ value: sum(p.rounds[r]), displayValue: dv(sum(holesOf(p, r).map((h) => h.value - PARS[h.period - 1]))), period: r + 1, linescores: holesOf(p, r), statistics: p.counts?.[r] ? { categories: [{ stats: p.counts[r].map((value) => ({ value })) }] } : undefined })), ...(p.playoff ? [{ value: sum(p.playoff), period: rounds + 1, linescores: p.playoff.map((value) => ({ value, period: 18, scoreType: { displayValue: dv(value - 5) } })) }] : [])] })) }],
  };
  const leaderboard = {
    events: [
      {
        id: "9",
        name: "Made-up Open",
        status,
        tournament: { numberOfRounds: rounds, cutRound, cutScore, cutCount, scoringSystem: { name: scoring } },
        courses: courses ?? [{ id: "1", holes: PARS.map((shotsToPar, i) => ({ number: i + 1, shotsToPar })) }],
        competitions: [
          {
            id: "9",
            status,
            competitors: players.map((p, i) => ({
              id: p.id,
              type: "athlete",
              earnings: p.earnings,
              athlete: { id: p.id, displayName: p.name },
              linescores: [
                ...Array.from({ length: rounds }, (_, r) => ({ ...(p.rounds[r] ? { value: sum(p.rounds[r]), displayValue: p.roundDv?.[r] ?? dv(sum(holesOf(p, r).map((h) => h.value - PARS[h.period - 1]))) } : { value: 0, displayValue: "-" }), period: r + 1, teeTime: tee(r + 1, i), isPlayoff: false })),
                ...(p.playoff ? [{ value: sum(p.playoff), period: rounds + 1, isPlayoff: true, linescores: p.playoff.map((value) => ({ value, period: 18, par: 5 })) }] : []),
              ],
              status: { period: p.period ?? rounds, thru: p.thru ?? 18, playoff: !!p.playoff || !!p.inPlayoff, type: { name: p.status === "MDF" ? "STATUS_MDF" : p.status && p.status !== "F" ? "STATUS_CUT" : "STATUS_FINISH", completed: final && (!p.status || p.status === "F"), shortDetail: p.status ?? "F" }, position: { displayName: p.place ?? "-", isTie: /^T/.test(p.place ?? "") } },
            })),
          },
        ],
      },
    ],
  };
  return { ...(asked ? { _asked: asked } : {}), board, leaderboard };
}
const par = (over = {}) => PARS.map((p, i) => p + (over[i + 1] ?? 0));

test("Golf's vocabulary: unique stat keys, holes, rounds, a playoff, the finish, money; every stroke-play tour; locks per event", () => {
  assert.ok(golf instanceof FieldSport && !(golf instanceof TeamSport));
  assert.equal(golf.id, "golf");
  assert.equal(sportById("golf"), golf);
  for (const l of ["golf/pga", "golf/lpga", "golf/eur", "golf/liv", "golf/champions-tour", "golf/ntw", "golf/mens-olympics-golf", "golf/womens-olympics-golf"]) assert.equal(sportOf(l), golf, l);
  for (const l of ["golf/tgl", "golf/wtgl"]) assert.equal(sportOf(l), null, `${l}: match play, a bout's shape`);
  assert.ok(allSports().includes(golf));
  const keys = golf.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  const groups = new Set(golf.statGroups.map((g) => g.key));
  for (const s of golf.stats) {
    assert.ok(groups.has(s.group), s.key);
    assert.ok(s.label && s.short && s.noun, s.key);
    // A count a play carries; else the standings' (placeStats) or worked out from counts.
    if (s.kind !== "count") assert.ok(s.of || golf.placeKeys.includes(s.key), s.key);
  }
  assert.deepEqual(golf.stats.filter((s) => s.known === "final").map((s) => s.key), ["EARN", "CUPPTS"]);
  assert.deepEqual(golf.placeKeys, ["POS", "W", "TOP5", "TOP10", "TOP20", "TOP25", "CUT"]);
  assert.ok(golf.specStats().some((s) => s.key === "POS" && s.label === "place"), "a spec can name the place");
  assert.equal(golf.stat("BIR").better, "higher");
  assert.equal(golf.stat("BOG").better, "lower");
  assert.equal(golf.stat("POS").better, "lower");
  assert.equal(golf.lock, "event");
  assert.equal(golf.periods.word, "round");
  assert.equal(golf.where({ period: 2, half: null, clock: null, hole: 11, kind: "bir" }), "2nd round, 11th hole");
  assert.equal(golf.where({ period: 4, half: null, clock: null, hole: 18, kind: "playoff-hole" }), "playoff, 18th hole");
  assert.equal(golf.where({ period: 3, half: null, clock: null, kind: "round" }), "3rd round");
  assert.equal(golf.full({ BS3: 1, BS5: 1, RND: 2 }).BS, 2, "BS: rounds with three or more in a row");
});

test("a hole's score to par and kind, a round's own stats", () => {
  assert.deepEqual(["E", "-6", "+2", "-", "OTHER", ""].map(toParOf), [0, -6, 2, null, null, null]);
  assert.deepEqual(holeKind(1, -2), { key: "EAG", word: "a hole in one" }, "a hole in one on a par 3 is an eagle");
  assert.deepEqual(holeKind(2, -3), { key: "ALB", word: "a double eagle" }, "a 2 on a par 5");
  assert.equal(holeKind(3, -1).key, "BIR");
  assert.equal(holeKind(4, 0).key, "PAR");
  assert.equal(holeKind(6, 2).key, "DBL");
  assert.deepEqual(holeKind(7, 3), { key: "WORSE", word: "a triple bogey" });
  assert.equal(holeKind(9, null).key, "WORSE", "ESPN's OTHER: four or more over");
  const h = (toPar, strokes = 4 + toPar) => ({ strokes, toPar });
  assert.deepEqual(roundStats([h(-1), h(-1), h(-2), h(0), h(-1), ...Array(13).fill(h(0))]), { RND: 1, BFR: 1, U70: 1, UPAR: 1, BS3: 1 }, "an eagle in a streak counts (birdie or better); only the longest");
  assert.deepEqual(roundStats([...Array(6).fill(h(-1)), h(1), ...Array(11).fill(h(0))]), { RND: 1, U70: 1, UPAR: 1, BS6: 1 }, "six or more; a bogey isn't bogey-free");
  assert.deepEqual(roundStats(Array(18).fill(h(0))), { RND: 1, BFR: 1 }, "72: neither under 70 nor under par");
  assert.equal(boardCounts({ statistics: { categories: [{ stats: [0, 0, 0, 0, 0, 0, {}].map((value) => ({ value })) }] } }), null, "all 0: not filled in");
  assert.deepEqual(boardCounts({ statistics: { categories: [{ stats: [6, 1, 0, 0, 1, 10].map((value) => ({ value })) }] } }), { BIR: 6, BOG: 1, DBL: 0, EAG: 1, PAR: 10 });
});

test("ESPN's leaderboard in Golf's keys: rounds, places and ties, a playoff, a withdrawal, the cut, earnings", () => {
  const box = golf.readBox(BERMUDA);
  assert.equal(box.event, "401850917");
  assert.equal(box.final, true);
  assert.equal(box.parts, 3, "cut to 54 holes");
  assert.deepEqual(box.cut, { after: 2, score: -5 });
  assert.equal(box.field.length, 120);
  const smo = box.people[idOf(box, "Austin Smotherman")];
  assert.deepEqual(smo.stats, { STR: 197, TOPAR: -16, MC: 0, WD: 0, DQ: 0, MDF: 0, PO: 1, POW: 1, POH: 3, POSTR: 9, EARN: 1080000, CUPPTS: 0 });
  assert.deepEqual(smo.parts, { 1: { STR: 65, TOPAR: -6 }, 2: { STR: 66, TOPAR: -5 }, 3: { STR: 66, TOPAR: -5 } });
  assert.deepEqual(smo.standing, { id: smo.id, place: 1, tied: false, status: "in", madeCut: true });
  assert.deepEqual(box.people[idOf(box, "Séamus Power")].standing.place, 2);
  assert.equal(box.people[idOf(box, "Séamus Power")].stats.POSTR, 10);
  const grey = box.people[idOf(box, "Max Greyserman")];
  assert.deepEqual([grey.standing.status, grey.standing.place, grey.stats.WD, grey.stats.STR], ["wd", null, 1, 114], "73 and 41 for the 10 holes he played");
  assert.equal(box.standings.filter((s) => s.status === "cut").length, 47);
  assert.ok(box.standings.slice(0, 72).every((s) => s.status === "in"), "the standings: the placed first, then the cut, then the withdrawn");
  assert.equal(box.standings[box.standings.length - 1].status, "wd");
  const tied = box.standings.filter((s) => s.place === 3);
  assert.ok(tied.length > 1 && tied.every((s) => s.tied));
  assert.equal(golf.readBox({ board: BERMUDA.board }), null, "no leaderboard: no box");
});

test("the proof: each recorded tournament's plays come to ESPN's own numbers and places; with the final's correction, every number", () => {
  for (const [name, a] of EVENTS) {
    const box = golf.readBox(a);
    const event = golf.fieldEvent(a);
    const issues = [];
    const plays = golf.readPlays(a, issues);
    assert.deepEqual(issues, [], `${name}: the reader's notes`);
    const state = golf.reduce(plays, null, event);
    for (const [id, p] of Object.entries(box.people)) {
      for (const [k, v] of Object.entries(p.stats)) if (golf.stat(k).known !== "final") assert.equal(state.lines[id]?.[k] ?? 0, v, `${name}: ${p.name} ${k}`);
      for (const [r, s] of Object.entries(p.parts)) for (const k of ["STR", "TOPAR"]) assert.equal(state.parts[id]?.[r]?.[k] ?? 0, s[k], `${name}: ${p.name} round ${r} ${k}`);
    }
    // The places from the plays alone are ESPN's.
    assert.deepEqual(state.standings, box.standings, `${name}: the standings`);
    // The nines and the board's counts, from the holes.
    for (const c of lbComps(a)) {
      for (const r of c.linescores) {
        const holes = plays.filter((p) => p.who === c.id && p.period === r.period && p.hole != null && p.kind !== "playoff-hole");
        if (holes.length !== 18) continue;
        const nine = (lo, hi) => sum(holes.filter((p) => p.hole >= lo && p.hole <= hi).map((p) => p.deltas[c.id].STR));
        assert.deepEqual([nine(1, 9), nine(10, 18)], [r.outScore, r.inScore], `${name}: ${c.athlete.displayName} round ${r.period}'s nines`);
      }
    }
    for (const c of a.board.competitions[0].competitors) {
      for (const r of c.linescores) {
        const counted = boardCounts(r);
        if (!counted || (r.linescores ?? []).length < 18) continue;
        const mine = state.parts[c.id][r.period];
        assert.deepEqual({ BIR: mine.BIR ?? 0, BOG: mine.BOG ?? 0, DBL: mine.DBL ?? 0, EAG: (mine.EAG ?? 0) + (mine.ALB ?? 0), PAR: mine.PAR ?? 0 }, counted, `${name}: ${c.athlete.displayName} round ${r.period}`);
      }
    }
    // The final's correction is what only the final says: the earnings.
    const timeline = golf.timeline(a);
    const fix = timeline[timeline.length - 1];
    assert.equal(fix.kind, "final");
    assert.deepEqual([...new Set(Object.values(fix.deltas).flatMap(Object.keys))], ["EARN"], name);
    const end = golf.reduce(timeline, null, event);
    for (const [id, p] of Object.entries(box.people)) for (const [k, v] of Object.entries(p.stats)) assert.equal(end.lines[id]?.[k] ?? 0, v, `${name}: the timeline, ${p.name} ${k}`);
    assert.deepEqual(end.standings, box.standings);
    assert.deepEqual(golf.stateAt(a), end, "stateAt with no moment: the end");
  }
  const t = golf.stateAt(TOUR);
  const sch = idOf(golf.readBox(TOUR), "Scottie Scheffler");
  assert.deepEqual(t.lines[sch], { STR: 264, HOLES: 72, PAR: 46, BIR: 21, TOPAR: -16, RND: 4, BFR: 2, U70: 4, UPAR: 4, BOG: 5, BS3: 1, EARN: 10000000, POS: 1, W: 1, TOP5: 1, TOP10: 1, TOP20: 1, TOP25: 1 });
});

test("plays: each competitor's holes in the order played, a round's own stats on its 18th, four over from the course's par, a hole in one", () => {
  const box = golf.readBox(BERMUDA);
  const plays = golf.readPlays(BERMUDA);
  const smo = idOf(box, "Austin Smotherman");
  const mine = plays.filter((p) => p.who === smo);
  // A back-nine start: the 10th first.
  assert.deepEqual(mine.filter((p) => p.period === 1).map((p) => p.hole), [10, 11, 12, 13, 14, 15, 16, 17, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const twelfth = mine[2];
  assert.equal(twelfth.text, "Austin Smotherman: a birdie on the 12th (3)");
  assert.deepEqual([twelfth.kind, twelfth.period, twelfth.unit, twelfth.people, twelfth.deltas], ["bir", 1, `${smo}:1`, [smo], { [smo]: { STR: 3, HOLES: 1, BIR: 1, TOPAR: -1 } }]);
  assert.deepEqual(twelfth.score, { [smo]: -1 }, "each competitor's score to par after it");
  assert.deepEqual(mine.filter((p) => p.period === 1).pop().deltas[smo], { STR: 4, HOLES: 1, PAR: 1, TOPAR: 0, RND: 1, BFR: 1, U70: 1, UPAR: 1 }, "his bogey-free 65's last hole");
  // ESPN's "OTHER" (four or more over) read from the course's par.
  const yu = plays.find((p) => p.who === idOf(box, "Kevin Yu") && p.deltas[p.who].STR === 10);
  assert.deepEqual([yu.text, yu.deltas[yu.who].TOPAR, yu.deltas[yu.who].WORSE], ["Kevin Yu: a 10, 5 over on the 2nd (10)", 5, 1]);
  const rose = idOf(golf.readBox(TOUR), "Justin Rose");
  const ace = golf.readPlays(TOUR).find((p) => p.who === rose && p.deltas[rose].HIO);
  assert.deepEqual([ace.text, ace.deltas[rose]], ["Justin Rose: a hole in one on the 9th (1)", { STR: 1, HOLES: 1, EAG: 1, TOPAR: -2, HIO: 1 }]);
  // The cut, a withdrawal and the playoff: ESPN's statuses and places.
  assert.equal(plays.filter((p) => p.kind === "missed-cut").length, 47);
  assert.ok(plays.filter((p) => p.kind === "missed-cut").every((p) => p.period === 2));
  const wd = plays.find((p) => p.kind === "withdrew");
  assert.deepEqual([wd.text, wd.period], ["Max Greyserman withdrew", 2], "the last round he played, not ESPN's status's third");
  const po = mine.filter((p) => p.kind.startsWith("playoff"));
  assert.deepEqual(po.map((p) => [p.kind, p.hole ?? null, p.deltas[smo]]), [["playoff-hole", 16, { POH: 1, POSTR: 3 }], ["playoff-hole", 16, { POH: 1, POSTR: 3 }], ["playoff-hole", 16, { POH: 1, POSTR: 3 }], ["playoff", null, { PO: 1, POW: 1 }]]);
  assert.equal(po[3].text, "Austin Smotherman won the playoff");
  assert.equal(golf.where(po[0]), "playoff, 16th hole");
  assert.ok(!po.some((p) => p.deltas[smo].STR), "a playoff's strokes aren't the tournament's");
  assert.equal(plays.length, 5608 + 47 + 1 + 6 + 2, "the board's 5,614 holes are 5,608 of the rounds' and the playoff's 6");
});

test("a tournament as of a moment: each round known when the next one starts, the cut with its round, the playoff and the end", () => {
  const box = golf.readBox(BERMUDA);
  const plays = golf.readPlays(BERMUDA);
  const smo = idOf(box, "Austin Smotherman");
  // Each round's holes at the next round's first tee time (round 3's by the fourth's, which it never played); the playoff's,
  // the last thing ESPN times (Monday at 11:55), 12 hours after its tee time, the answers having no `_asked`.
  assert.deepEqual([...new Set(plays.map((p) => p.at))], ["2026-10-23T10:35:00Z", "2026-10-24T12:50:00Z", "2026-10-25T10:45:00Z", "2026-10-26T23:55:00Z"]);
  assert.deepEqual(plays.filter((p) => p.at === "2026-10-26T23:55:00Z").map((p) => p.kind), ["playoff-hole", "playoff-hole", "playoff-hole", "playoff", "playoff-hole", "playoff-hole", "playoff-hole", "playoff"]);
  const before = golf.stateAt(BERMUDA, "2026-10-23T10:34:59Z");
  assert.equal(before.plays, 0);
  assert.ok(before.standings.every((s) => s.place === 1 && s.tied), "before anything's known, everyone level");
  // After round 1: ESPN's places when round 2 started, for everyone (its startPosition).
  const r1 = golf.stateAt(BERMUDA, "2026-10-23T10:35:00Z");
  const start2 = lbComps(BERMUDA).filter((c) => c.linescores.find((l) => l.period === 2)?.startPosition != null);
  assert.ok(start2.length > 100);
  for (const c of start2) assert.equal(r1.standings.find((s) => s.id === c.id).place, c.linescores.find((l) => l.period === 2).startPosition, c.athlete.displayName);
  assert.deepEqual(r1.lines[smo], { STR: 65, HOLES: 18, PAR: 12, BIR: 6, TOPAR: -6, RND: 1, BFR: 1, U70: 1, UPAR: 1, POS: 11, TOP20: 1, TOP25: 1 });
  // After round 2, the cut: 47 out, the rest through it; the withdrawal out.
  const r2 = golf.stateAt(BERMUDA, "2026-10-24T12:50:00Z");
  assert.equal(r2.standings.filter((s) => s.status === "cut").length, 47);
  assert.deepEqual(r2.standings.filter((s) => s.status === "wd").map((s) => s.id), [idOf(box, "Max Greyserman")]);
  assert.ok(r2.standings.filter((s) => s.status === "in").every((s) => s.madeCut));
  assert.equal(r2.lines[smo].CUT, 1);
  const places2 = golf.placesAfter(r2, 2);
  for (const c of lbComps(BERMUDA)) {
    const start = c.linescores.find((l) => l.period === 3 && l.value > 0)?.startPosition;
    if (start != null) assert.equal(places2.get(c.id).place, start, c.athlete.displayName);
  }
  // After round 3 and before the playoff's known: Smotherman and Power tied first.
  const r3 = golf.stateAt(BERMUDA, "2026-10-26T12:00:00Z");
  assert.deepEqual(r3.standings.slice(0, 2).map((s) => [box.people[s.id].name, s.place, s.tied]), [["Austin Smotherman", 1, true], ["Séamus Power", 1, true]]);
  assert.equal(r3.lines[smo].W, 1, "provisional: the leader's a win now");
  // The end: the playoff decides it, and ESPN's places stand; at any moment after it too (a finished answer read later).
  const end = golf.stateAt(BERMUDA, Infinity);
  assert.deepEqual(end.standings.slice(0, 2).map((s) => [box.people[s.id].name, s.place, s.tied]), [["Austin Smotherman", 1, false], ["Séamus Power", 2, false]]);
  assert.deepEqual(golf.stateAt(BERMUDA, "2027-01-01T00:00:00Z"), end);
  assert.deepEqual(golf.stateAt(TOUR, "2027-01-01T00:00:00Z"), golf.stateAt(TOUR), "the TOUR Championship's last round, months later");
  // A moment that isn't one counts nothing, and before anything's known nobody's placed in a line (everyone's level).
  const nothing = golf.stateAt(BERMUDA, "not a moment");
  assert.deepEqual([nothing.plays, nothing.lines], [0, {}]);
  assert.deepEqual(before.lines, {}, "no POS 1 or win for anyone before a shot's known");
  // A copy of ESPN's places: sorting them changes nothing after.
  end.standings.reverse();
  assert.equal(golf.stateAt(BERMUDA).standings[0].id, smo);
});

test("the LPGA's feed: rounds whole (strokes, score to par, under 70), no kinds of holes; a withdrawal's partial round", () => {
  const box = golf.readBox(SHANGHAI);
  const plays = golf.readPlays(SHANGHAI);
  assert.deepEqual([...new Set(plays.map((p) => p.kind))], ["round", "withdrew"]);
  const yin = idOf(box, "Ruoning Yin");
  const hers = plays.filter((p) => p.who === yin);
  assert.equal(hers.length, 4);
  assert.deepEqual(Object.keys(hers[0].deltas[yin]).sort(), ["HOLES", "RND", "STR", "TOPAR", ...(hers[0].deltas[yin].U70 ? ["U70"] : []), ...(hers[0].deltas[yin].UPAR ? ["UPAR"] : [])].sort());
  assert.equal(hers[0].hole, undefined);
  assert.equal(golf.where(hers[1]), "2nd round");
  const end = golf.stateAt(SHANGHAI);
  assert.deepEqual([end.lines[yin].STR, end.lines[yin].TOPAR, end.lines[yin].RND, end.lines[yin].POS, end.lines[yin].BIR], [277, -11, 4, 1, undefined]);
  const wd = box.standings.filter((s) => s.status === "wd");
  assert.equal(wd.length, 5);
  assert.equal(box.cut, null, "no cut");
  // Withdrawn before teeing off (ESPN's status says the fourth round, when it was flagged): out from the first round's end.
  const yam = idOf(box, "Miyu Yamashita");
  assert.deepEqual(plays.filter((p) => p.who === yam).map((p) => [p.kind, p.period, p.at]), [["withdrew", 1, "2026-10-16T00:10:00Z"]]);
  assert.equal(golf.stateAt(SHANGHAI, "2026-10-17T00:05:00Z").standings.find((s) => s.id === yam).status, "wd");
  // A withdrawal's partial round (fewer strokes than a round can be) isn't a round played; a whole one is.
  const partial = made({
    rounds: 2,
    players: [
      { id: "1", name: "Whole", rounds: [par(), par()], place: "1" },
      { id: "2", name: "Partial", rounds: [par(), par().slice(0, 9)], status: "WD", period: 2, thru: 0 },
      { id: "3", name: "Stopped after one", rounds: [par({ 1: 2 })], status: "WD", period: 2, thru: 0 },
    ],
  });
  for (const c of partial.board.competitions[0].competitors) for (const r of c.linescores) delete r.linescores; // rounds only
  const pl = golf.stateAt(partial).lines;
  assert.deepEqual([pl["2"].RND, pl["2"].HOLES, pl["2"].STR, pl["2"].U70], [1, 18, 108, undefined], "36 strokes for nine holes: not a round under 70");
  assert.deepEqual([pl["3"].RND, pl["3"].HOLES], [1, 18]);
});

test("live: a round in progress, its holes known when the answer was had, places by the score now; a round counts once it's 18 holes", () => {
  const asked = "2026-06-05T15:00:00Z";
  const a = made({
    final: false,
    asked,
    players: [
      { id: "1", name: "A. Early", rounds: [par({ 3: -1 }), par({ 1: -1, 2: -1 }).slice(0, 7)], period: 2, thru: 7, place: "1" },
      { id: "2", name: "B. Late", rounds: [par({ 5: -1, 9: -1 }), []], period: 2, thru: 0, place: "T2" },
      { id: "3", name: "C. Steady", rounds: [par(), par({ 4: 1 }).slice(0, 12)], period: 2, thru: 12, place: "T2" },
    ],
  });
  const plays = golf.readPlays(a);
  // Round 1's by round 2's first tee time (12:00 the next day), round 2's when the answer was had.
  assert.deepEqual([...new Set(plays.filter((p) => p.period === 1).map((p) => p.at))], ["2026-06-05T12:00:00Z"]);
  assert.deepEqual([...new Set(plays.filter((p) => p.period === 2).map((p) => p.at))], [asked]);
  const now = golf.stateAt(a, asked);
  assert.equal(golf.readBox(a).final, false);
  assert.equal(golf.timeline(a).some((p) => p.final), false, "live: no final's correction");
  assert.deepEqual(now.standings.map((s) => [s.id, s.place, s.tied]), [["1", 1, false], ["2", 2, false], ["3", 3, false]]);
  assert.deepEqual([now.parts["1"][2].HOLES, now.parts["1"][2].TOPAR, now.lines["1"].RND, now.lines["1"].TOPAR], [7, -2, 1, -3], "thru 7 at two under today; one round played");
  assert.equal(now.lines["3"].BOG, 1);
  // A later watch at round 2's start sees round 1 only: B. Late led it.
  assert.deepEqual(golf.stateAt(a, "2026-06-05T12:30:00Z").standings.map((s) => [s.id, s.place, s.tied]), [["2", 1, false], ["1", 2, false], ["3", 3, false]]);
  // Before round 2's tee times, an answer had in the evening knows round 1 then.
  const evening = golf.readPlays({ ...a, _asked: "2026-06-04T22:00:00Z" });
  assert.equal(evening.find((p) => p.period === 1).at, "2026-06-04T22:00:00Z");
});

test("playoffs: the winner its place says, else live the one who's survived the most holes in fewest strokes; everyone beaten ties for second", () => {
  const four = (extra) => [par({ 1: -1 }), par(), par(), par(extra)];
  const players = [
    { id: "1", name: "Winner", rounds: four({ 2: -1 }), place: "1", playoff: [5, 4] },
    { id: "2", name: "Loser A", rounds: four({ 3: -1 }), place: "T2", playoff: [5, 5] },
    { id: "3", name: "Loser B", rounds: four({ 4: -1 }), place: "T2", playoff: [6] },
    { id: "4", name: "Fourth", rounds: four({}), place: "4" },
  ];
  const a = made({ players });
  const box = golf.readBox(a);
  const st = golf.stateAt(a, Infinity);
  assert.deepEqual(st.standings.map((s) => [s.id, s.place, s.tied]), [["1", 1, false], ["2", 2, true], ["3", 2, true], ["4", 4, false]]);
  assert.deepEqual(golf.reduce(golf.readPlays(a), null, golf.fieldEvent(a)).standings, box.standings, "the plays alone: ESPN's places");
  assert.deepEqual([st.lines["1"].POW, st.lines["1"].POH, st.lines["1"].POSTR, st.lines["3"].POH], [1, 2, 9, 1]);
  assert.equal(st.lines["1"].STR, 286, "a playoff's strokes aren't the tournament's");
  // Live, before ESPN's places say who won: the holes do.
  const live = made({ players: players.map((p) => ({ ...p, place: "T1" })), final: false });
  assert.deepEqual(golf.stateAt(live, Infinity).standings.slice(0, 3).map((s) => [s.id, s.place, s.tied]), [["1", 1, false], ["2", 2, true], ["3", 2, true]]);
  // One beaten: second, not tied.
  const two = made({ players: [players[0], { ...players[1], place: "2" }, { ...players[3], place: "3" }] });
  assert.deepEqual(golf.stateAt(two).standings.map((s) => [s.id, s.place, s.tied]), [["1", 1, false], ["2", 2, false], ["4", 3, false]]);
  // The leaderboard flags only who's in it, the board has the playoff past the tournament's rounds: not a round of theirs.
  const flagged = made({ players });
  for (const c of lbComps(flagged)) c.linescores = c.linescores.filter((l) => !l.isPlayoff);
  const fl = golf.reduce(golf.readPlays(flagged), null, golf.fieldEvent(flagged));
  assert.deepEqual([fl.lines["1"].STR, fl.lines["1"].RND, fl.lines["1"].POH, fl.lines["1"].POW, fl.parts["1"][5]], [286, 4, 2, 1, { POH: 2, POSTR: 9, PO: 1, POW: 1 }], "the board's holes as the playoff's");
  // ESPN lists only some of a playoff (the winner's hole, or nothing): its place says who won.
  const bare = made({ players: [{ ...players[0], playoff: undefined, inPlayoff: true }, { ...players[1], place: "2", playoff: undefined, inPlayoff: true }, players[3]] });
  assert.deepEqual(golf.reduce(golf.readPlays(bare), null, golf.fieldEvent(bare)).standings.map((s) => [s.id, s.place]), [["1", 1], ["2", 2], ["4", 3]]);
});

test("the cut is who ESPN says missed it (its cut score isn't always the line); through a cut but not to the end, placed after", () => {
  const two = (a, b) => [par(a), par(b)];
  // ESPN's cut score says +2, and it cut everyone at +2 (the 2026 Turkish Airlines Open's).
  const a = made({
    rounds: 3,
    cutRound: 2,
    cutScore: 2,
    cutCount: 2,
    players: [
      { id: "1", name: "Made", rounds: [...two({}, {}), par()], place: "1" },
      { id: "2", name: "Also", rounds: [...two({ 1: 1 }, {}), par({ 2: 1 })], place: "2" },
      { id: "3", name: "Cut", rounds: two({ 1: 1 }, { 2: 1 }), status: "CUT", period: 2 },
      { id: "4", name: "Gone", rounds: [...two({}, { 3: 1 }), par({ 4: 1 }).slice(0, 4)], status: "WD", period: 3, thru: 4 },
    ],
  });
  const end = golf.reduce(golf.readPlays(a), null, golf.fieldEvent(a));
  assert.deepEqual(end.standings.map((s) => [s.id, s.place, s.status, s.madeCut]), [["1", 1, "in", true], ["2", 2, "in", true], ["3", null, "cut", false], ["4", null, "wd", true]]);
  assert.deepEqual([end.lines["3"].MC, end.lines["3"].CUT, end.lines["1"].CUT, end.lines["4"].CUT], [1, undefined, 1, 1], "a withdrawal in the third round made the cut");
  // Through a cut, not on to the last round (ESPN's MDF): after everyone who finished, by their score; one who played it is anyone.
  const mdf = made({
    rounds: 3,
    players: [
      { id: "1", name: "Finished", rounds: [par(), par(), par({ 1: 2, 2: 2 })], place: "1" },
      { id: "2", name: "Stopped", rounds: [par({ 1: -1 }), par()], status: "MDF", place: "3", period: 3 },
      { id: "3", name: "Typed MDF, played it", rounds: [par(), par(), par({ 1: 3, 2: 2 })], status: "MDF", place: "2" },
    ],
  });
  const m = golf.reduce(golf.readPlays(mdf), null, golf.fieldEvent(mdf));
  assert.deepEqual(m.standings, golf.readBox(mdf).standings, "the plays alone: ESPN's places");
  assert.deepEqual(m.standings.map((s) => [s.id, s.place]), [["1", 1], ["3", 2], ["2", 3]]);
  assert.deepEqual([m.lines["2"].MDF, m.lines["3"].MDF], [1, undefined]);
});

test("a hole's score to par where ESPN's types are wrong: the course's pars; with two courses, the one the board's counts agree with", () => {
  const strokes = par({ 3: -1, 7: 1 });
  // ESPN's types say a birdie is a bogey and the other way round (the 2026 Chubb Classic's): the course's pars are right.
  const wrong = strokes.map((s, h) => (h === 2 ? "+1" : h === 6 ? "-1" : dv(s - PARS[h])));
  const one = made({ rounds: 1, players: [{ id: "1", name: "A", rounds: [strokes], types: [wrong], place: "1" }] });
  const p = golf.stateAt(one).lines["1"];
  assert.deepEqual([p.BIR, p.BOG, p.TOPAR ?? 0], [1, 1, 0]);
  // Two courses, the round on the second, ESPN's types wrong: both courses come to its score, and the board's counts say which.
  const other = [...PARS];
  [other[0], other[2]] = [other[2], other[0]]; // a par 3 first, then a par 4 third
  const round = other.map((x, i) => x + (i === 1 ? -1 : i === 5 ? 1 : 0));
  const two = made({
    rounds: 1,
    courses: [
      { id: "1", holes: PARS.map((shotsToPar, i) => ({ number: i + 1, shotsToPar })) },
      { id: "2", holes: other.map((shotsToPar, i) => ({ number: i + 1, shotsToPar })) },
    ],
    players: [{ id: "1", name: "B", rounds: [round], types: [round.map(() => "E")], roundDv: ["E"], counts: [[1, 1, 0, 0, 0, 16, 0]], place: "1" }],
  });
  const q = golf.stateAt(two).lines["1"];
  assert.deepEqual([q.BIR, q.BOG, q.PAR, q.TOPAR ?? 0, q.DBL ?? 0, q.EAG ?? 0], [1, 1, 16, 0, 0, 0], "the second course's: a birdie on the 2nd, a bogey on the 6th");
  // One hole ESPN can't type ("OTHER") and no par: what the round's score leaves.
  const left = made({ rounds: 1, courses: [], players: [{ id: "1", name: "C", rounds: [par({ 9: 4 })], types: [par({ 9: 4 }).map((s, h) => (h === 8 ? "OTHER" : dv(s - PARS[h])))], place: "1" }] });
  const issues = [];
  const nine = golf.readPlays(left, issues).find((x) => x.hole === 9);
  assert.deepEqual([nine.deltas["1"].TOPAR, nine.deltas["1"].WORSE, issues], [4, 1, []]);
});

test("a tour's board listing two events (an opposite-field week): the leaderboard's", () => {
  const a = made({ players: [{ id: "1", name: "A", rounds: [par(), par(), par(), par()], place: "1" }] });
  const other = { ...a.board, id: "8", name: "Opposite Open", competitions: [{ id: "8", competitors: [{ id: "77", type: "athlete", athlete: { displayName: "Elsewhere" }, linescores: [{ value: 60, displayValue: "-12", period: 1 }] }] }] };
  const listed = { ...a, board: { events: [other, a.board] } };
  assert.deepEqual(golf.fieldEvent(listed).field, ["1"]);
  assert.deepEqual(Object.keys(golf.stateAt(listed).lines), ["1"]);
});

test("not a field: match play and Stableford aren't read; an event called off has no box", () => {
  const match = made({ scoring: "Match", players: [{ id: "1", name: "A", rounds: [par()], place: "1" }] });
  assert.equal(golf.fieldEvent(match), null);
  assert.equal(golf.readBox(match), null);
  assert.deepEqual(golf.readPlays(match), []);
  assert.equal(golf.fieldEvent(made({ scoring: "Modified Stableford", players: [] })), null);
  assert.equal(golf.readBox({ leaderboard: { events: [{ id: "1", status: { type: { name: "STATUS_CANCELED", state: "post" } }, tournament: { numberOfRounds: 4 }, competitions: [{}] }] } }), null);
  assert.equal(golf.fieldEvent({}), null);
});

test("Golf's defaults are data the spec reads: Yahoo's points per hole and round, its places beside, six golfers, locks per event", () => {
  const d = defaultsFor("golf");
  assert.equal(d.sport, "golf");
  assert.match(d.scoring.source, /Yahoo/);
  assert.deepEqual(d.scoring.points, { HIO: 5, ALB: 15, EAG: 9, BIR: 3.5, PAR: 0.5, BOG: -1.3, DBL: -5, WORSE: -5, BFR: 5, BS3: 3, BS4: 5, BS5: 10, BS6: 18 });
  for (const k of Object.keys(d.scoring.points)) assert.ok(golf.stat(k), k);
  assert.deepEqual(d.scoring.byPlace, { POS: { 1: 25, 2: 12, 3: 10, "4-10": 8, "11-20": 3 } });
  assert.deepEqual(d.categories.stats, []);
  assert.deepEqual(d.slots.lineup, [{ slot: "G", n: 6, takes: ["golfers"] }]);
  assert.equal(d.specs.season.spec.get.each, sum(d.slots.lineup.map((s) => s.n)) + d.slots.bench, "a season's draft fills its slots and bench");
  assert.equal(d.specs.season.spec.count.start, sum(d.slots.lineup.map((s) => s.n)));
  for (const s of d.slots.lineup) for (const t of s.takes) assert.ok(golf.groups.some((g) => g.key === t) || golf.position(t), t);
  assert.equal(d.closes, golf.lock);
  for (const spec of Object.values(d.specs)) assert.deepEqual(spec.spec.score.points, d.scoring.points);
  // Scored by the table on a recorded tournament: Smotherman's 54 holes (the playoff's score nothing).
  const line = golf.stateAt(BERMUDA).lines[idOf(golf.readBox(BERMUDA), "Austin Smotherman")];
  const pts = Object.entries(d.scoring.points).reduce((a, [k, v]) => a + (line[k] ?? 0) * v, 0);
  assert.equal(Math.round(pts * 10) / 10, Math.round((9 * 1 + 3.5 * 17 + 0.5 * 33 - 1.3 * 3 + 5 * 1) * 10) / 10);
});
