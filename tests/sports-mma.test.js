// MMA (src/lib/sports/mma.ts, a BoutSport in src/lib/sports/sport.ts; docs/PLAN-start-a-game-gpt.md track L, L5 part 4a): its
// vocabulary for every promotion ESPN carries, ESPN's answers for a fight card (its board, its FightCenter, and from the core API
// each bout's rounds, status, timed plays and fighters' statistics) read into plays and results, and the proof: each recorded
// card's plays, reduced, come to ESPN's own numbers for every fighter (the core's statistics, which are the FightCenter's) and
// its results (the winner ESPN flags, how, the round and time, the judges' scores), bout by bout at the moments ESPN times. The
// recorded cards (tests/fixtures/espn/, recorded by scripts/dev-test/record-espn.js) are UFC 324 (a title over five rounds,
// every bout timed), UFC Fight Night: Usman vs. Buckley (a no contest and a technical draw), UFC Fight Night: Rosas Jr. vs.
// Barcelos (a disqualification, three rounds and an overtime round), UFC 312 (statistics but no plays: no times), PFL Dubai
// (results only) and Cage Warriors 176 (a one-night tournament: its winner on the card twice). The same proof on every finished
// card of a league's season is scripts/dev-test/check-bout-reduce.js --league=mma/ufc --season=2026. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { sportOf, sportById, defaultsFor, allSports, BoutSport, FieldSport, TeamSport, MMA, methodOf, mmaCoreStats, mmaCenterStats } = jiti("../src/lib/sports/index.ts");

const UFC324 = require("./fixtures/espn/ufc-600057024.json");
const USMAN = require("./fixtures/espn/ufc-600053732.json");
const ROSAS = require("./fixtures/espn/ufc-600061266.json");
const UFC312 = require("./fixtures/espn/ufc-600050481.json");
const PFL = require("./fixtures/espn/pfl-600056964.json");
const CAGE = require("./fixtures/espn/cage-warriors-600049962.json");
const CARDS = [
  ["UFC 324", UFC324],
  ["UFC Fight Night: Usman vs. Buckley", USMAN],
  ["UFC Fight Night: Rosas Jr. vs. Barcelos", ROSAS],
  ["UFC 312 (no plays)", UFC312],
  ["PFL Dubai (results only)", PFL],
  ["Cage Warriors 176 (a tournament)", CAGE],
];
const mma = sportOf("mma/ufc");
const clone = (x) => JSON.parse(JSON.stringify(x));
const idOf = (a, name) => Object.values(mma.readBox(a).people).find((p) => p.name === name).id;
const boutOf = (a, name) => mma.card(a).bouts.find((b) => b.sides.includes(idOf(a, name)));
const playOf = (a, bout, kind) => mma.readPlays(a).find((p) => p.bout === bout && p.kind === kind);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test("MMA's vocabulary: unique stat keys, weight classes as positions, every promotion ESPN carries, locks per event", () => {
  assert.ok(mma instanceof MMA && mma instanceof BoutSport && !(mma instanceof FieldSport) && !(mma instanceof TeamSport));
  for (const l of ["mma/ufc", "mma/pfl", "mma/lfa", "mma/cage-warriors", "mma/bellator", "mma/rizin", "mma/ksw", "mma/other"]) assert.equal(sportOf(l), mma, l);
  assert.equal(sportById("mma"), mma);
  assert.ok(allSports().includes(mma));
  assert.equal(mma.lock, "event");
  const keys = mma.stats.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "unique keys");
  for (const s of mma.stats) assert.ok(mma.statGroups.some((g) => g.key === s.group), `${s.key}'s group`);
  for (const k of ["W", "L", "D", "NC", "KO", "SUB", "DEC", "UD", "SD", "MD", "DQ", "WR1", "WR5", "QW", "TIME", "KD", "SSL", "SSA", "TSL", "TSA", "TDL", "TDA", "CTRL", "SUBA", "REV"]) assert.ok(mma.stat(k), k);
  assert.equal(mma.stat("L").better, "lower");
  assert.deepEqual(mma.full({ WR1: 1, WR3: 1, SSL: 30, SSA: 60, TDL: 1, TDA: 4 }).FIN, 2);
  assert.equal(mma.full({ SSL: 30, SSA: 60 }).SSACC, 0.5);
  assert.equal(mma.full({ TDL: 1, TDA: 4 }).TDACC, 0.25);
  assert.ok(!mma.specStats().some((s) => s.key === "SSACC"), "rates aren't scored");
  // Weight classes from ESPN's names, women's with a W.
  const classes = { Lightweight: "LW", "Light Heavyweight": "LHW", "W Flyweight": "WFLW", "W Strawweight": "WSW", "Catch Weight": "CW", Catchweight: "CW", "W Catch Weight": "WCW", Strawweight: "SW" };
  for (const [espn, key] of Object.entries(classes)) {
    assert.equal(mma.positionKey(espn), key, espn);
    assert.ok(mma.position(key), key);
  }
  assert.equal(mma.positionKey(null), null);
  assert.equal(mma.where({ period: 2, half: null, clock: "3:14", shootout: false }), "the 2nd round, 3:14 left");
  assert.equal(mma.where({ period: 0, half: null, clock: null, kind: "walkout" }), "the walkouts");
  assert.equal(mma.where({ period: 0, half: null, clock: null, kind: "result" }), "the result");
});

test("how a bout ended, from every name ESPN gives in 2024-26 (the UFC's, and the smaller promotions' with the how in it)", () => {
  const names = {
    kotko: ["win", "KO"],
    "tko---doctors-stoppage": ["win", "KO"],
    "tko-doctor-stoppage": ["win", "KO"],
    "tko-retirement": ["win", "KO"],
    "tko---retirement": ["win", "KO"],
    tko: ["win", "KO"],
    "tko-punches": ["win", "KO"],
    "ko-head-kick": ["win", "KO"],
    submission: ["win", "SUB"],
    "technical-submission": ["win", "SUB"],
    "submission-rear-naked-choke": ["win", "SUB"],
    "technical-submission-ninja-choke": ["win", "SUB"],
    "decision---unanimous": ["win", "UD"],
    "decision---split": ["win", "SD"],
    "decision---majority": ["win", "MD"],
    "technical-decision": ["win", "DEC"],
    dq: ["win", "DQ"],
    "dq-illegal-kick": ["win", "DQ"],
    draw: ["draw", null],
    "decision---split-draw": ["draw", null],
    "no-contest": ["nc", null],
  };
  for (const [name, [outcome, method]] of Object.entries(names)) assert.deepEqual(methodOf(name), { outcome, method }, name);
  assert.equal(methodOf(""), null);
  assert.equal(methodOf("something-else"), null);
});

test("the proof: each recorded card's plays come to ESPN's own numbers and results; ESPN's two sets of totals agree", () => {
  for (const [name, a] of CARDS) {
    const issues = [];
    const plays = mma.readPlays(a, issues);
    const box = mma.readBox(a);
    const card = mma.card(a);
    assert.deepEqual(issues, [], `${name}: the reader's notes`);
    assert.equal(box.final, true, name);
    assert.equal(box.results.length, card.bouts.length, `${name}: every bout has its result`);
    const state = mma.reduce(plays, null, card);
    for (const [id, p] of Object.entries(box.people)) for (const k of new Set([...Object.keys(p.stats), ...Object.keys(state.lines[id] ?? {})])) assert.equal(state.lines[id]?.[k] ?? 0, p.stats[k] ?? 0, `${name}: ${p.name} ${k}`);
    for (const id of Object.keys(state.lines)) assert.ok(box.people[id], `${name}: ${id} is on ESPN's card`);
    assert.deepEqual(state.results, box.results, `${name}: the results`);
    // The final's correction is nothing: every number's in the plays.
    const timeline = mma.timeline(a);
    assert.equal(timeline[timeline.length - 1].kind, "final");
    assert.deepEqual(timeline[timeline.length - 1].deltas, {}, name);
    assert.deepEqual(mma.stateAt(a), mma.reduce(timeline, null, card), `${name}: stateAt with no moment: the end`);
    const fc = new Map(Object.values(a.fightcenter.cards).flatMap((s) => s.competitions).map((c) => [c.id, c]));
    for (const b of card.bouts) {
      const res = box.results.find((r) => r.bout === b.id);
      const board = a.board.competitions.find((c) => c.id === b.id);
      // The winner every answer flags, how ESPN names it.
      for (const cs of [board.competitors, fc.get(b.id)?.competitors, a.core[b.id]?.competitors]) if (cs) assert.equal(cs.find((c) => c.winner)?.id ?? null, res.winner, `${name}: bout ${b.id}'s winner`);
      assert.equal(methodOf(a.core[b.id].status.result.name).method, res.method, `${name}: bout ${b.id}`);
      assert.equal(res.round, a.core[b.id].status.period);
      assert.equal(res.time, a.core[b.id].status.displayClock);
      // The judges' scores, each [the first side's, the second's], are the FightCenter's text.
      const text = fc.get(b.id)?.judgesScores;
      if (text) assert.deepEqual(res.cards.map((c) => [...c].sort((x, y) => y - x).join("-")).sort(), text.split("|").map((x) => x.trim().split("-").map(Number).sort((x, y) => y - x).join("-")).sort(), `${name}: bout ${b.id}'s cards`);
      // ESPN's core statistics are its FightCenter's totals, number by number.
      for (const id of b.sides) {
        const core = mmaCoreStats(a.core[b.id].competitors.find((c) => c.id === id));
        const center = mmaCenterStats(fc.get(b.id)?.competitors.find((c) => c.id === id));
        if (core && center) for (const [k, v] of Object.entries(center)) assert.equal(core[k], v, `${name}: ${box.people[id].name} ${k}`);
      }
    }
  }
  assert.equal(mma.card({}), null);
  assert.equal(mma.readBox({}), null);
  assert.deepEqual(mma.readPlays({}), []);
});

test("UFC 324 read: the card in the order fought, the main event's totals and result, its rounds counted from the plays", () => {
  const card = mma.card(UFC324);
  assert.equal(card.bouts.length, 11);
  assert.deepEqual(card.bouts.map((b) => b.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const main = card.bouts[10];
  assert.deepEqual([main.main, main.title, main.rounds, main.class, main.segment], [true, true, 5, "LW", "main"]);
  assert.deepEqual(main.lengths, [300, 300, 300, 300, 300]);
  assert.deepEqual(card.bouts.map((b) => b.segment), ["prelims2", "prelims2", "prelims1", "prelims1", "prelims1", "prelims1", "main", "main", "main", "main", "main"]);
  assert.equal(card.bouts.filter((b) => b.main).length, 1);
  const gaethje = idOf(UFC324, "Justin Gaethje");
  const pimblett = idOf(UFC324, "Paddy Pimblett");
  const box = mma.readBox(UFC324);
  // ESPN's: 200 of 313 strikes, 144 of 254 significant, 2 knockdowns, 3 of 3 takedowns, 5:55 in control; a five-round decision.
  assert.deepEqual(box.people[gaethje].stats, { BOUT: 1, TIME: 1500, KD: 2, SSL: 144, SSA: 254, TSL: 200, TSA: 313, SHL: 120, SHA: 222, SBL: 15, SBA: 21, SLL: 9, SLA: 11, SDL: 102, SDA: 198, SCL: 20, SCA: 27, SGL: 22, SGA: 29, TDL: 3, TDA: 3, CTRL: 355, W: 1, UD: 1, DEC: 1 });
  assert.deepEqual([box.people[pimblett].stats.L, box.people[pimblett].stats.TDA, box.people[pimblett].stats.TDL, box.people[pimblett].stats.W], [1, 5, undefined, undefined]);
  const res = box.results.find((r) => r.bout === main.id);
  assert.deepEqual(res, { bout: main.id, outcome: "win", winner: gaethje, loser: pimblett, method: "UD", how: null, round: 5, time: "5:00", cards: res.cards });
  assert.deepEqual(res.cards.map((c) => c[main.sides.indexOf(gaethje)]).sort(), [48, 49, 49]);
  assert.equal(playOf(UFC324, main.id, "result").text, "Justin Gaethje beat Paddy Pimblett by unanimous decision (49-46, 49-46, 48-47)");
  // The plays name no fighter: the bout's rounds count its knockdowns and takedowns (2 knockdowns, 3 of 8 takedowns: Gaethje's
  // 3 of 3 and Pimblett's 0 of 5).
  const rounds = mma.stateAt(UFC324).bouts[main.id].rounds;
  assert.deepEqual(rounds, { 1: { TDA: 1, KD: 1 }, 2: { TDA: 2, TDL: 2, KD: 1 }, 4: { TDA: 2, TDL: 1 }, 5: { TDA: 3 } });
  assert.equal(sum(Object.values(rounds).map((r) => r.KD ?? 0)), box.people[gaethje].stats.KD);
  assert.equal(sum(Object.values(rounds).map((r) => r.TDA ?? 0)), box.people[gaethje].stats.TDA + box.people[pimblett].stats.TDA);
  const first = card.bouts[0];
  assert.equal(playOf(UFC324, first.id, "result").text, "Ty Miller beat Adam Fugitt by KO/TKO (Punches), the 1st round at 4:59");
  // Every play's the bout's (its unit), never a fighter's but the result's.
  for (const p of mma.readPlays(UFC324)) {
    assert.equal(p.unit, p.bout);
    if (p.kind !== "result") assert.equal(p.who, null);
  }
});

test("the moments: a bout on in its round, over at its Fight Over (the totals, no result), done at its announcement; bout by bout", () => {
  const card = mma.card(UFC324);
  const first = card.bouts[0];
  const miller = idOf(UFC324, "Ty Miller");
  const fugitt = idOf(UFC324, "Adam Fugitt");
  // Before the card: nothing.
  const before = mma.stateAt(UFC324, "2026-01-24T22:00:00Z");
  assert.equal(before.plays, 0);
  assert.deepEqual(before.lines, {});
  assert.deepEqual(before.results, []);
  assert.ok(Object.values(before.bouts).every((b) => b.stage === "pre"));
  // ESPN's: round 1 started 23:11:52, a knockdown 23:16:23, the fight over 23:16:53, the unofficial winner 23:18:51.
  const on = mma.stateAt(UFC324, "2026-01-24T23:16:30Z");
  assert.deepEqual([on.bouts[first.id].stage, on.bouts[first.id].round], ["in", 1]);
  assert.deepEqual(on.bouts[first.id].rounds[1], { TDA: 2, KD: 1 });
  assert.deepEqual(on.lines, {}, "a fighter's numbers come with the bout's end");
  assert.equal(on.bouts[card.bouts[1].id].stage, "pre");
  assert.equal(playOf(UFC324, first.id, "bout-end").at, "2026-01-24T23:16:53Z");
  const over = mma.stateAt(UFC324, "2026-01-24T23:17:30Z");
  assert.equal(over.bouts[first.id].stage, "over");
  assert.equal(over.lines[miller].BOUT, 1);
  assert.equal(over.lines[miller].TIME, 299);
  assert.equal(over.lines[miller].W, undefined, "the result waits for its announcement");
  assert.deepEqual(over.results, []);
  assert.equal(playOf(UFC324, first.id, "result").at, "2026-01-24T23:18:51Z");
  const done = mma.stateAt(UFC324, "2026-01-24T23:18:51Z");
  assert.equal(done.bouts[first.id].stage, "done");
  assert.deepEqual([done.lines[miller].W, done.lines[miller].KO, done.lines[miller].WR1, done.lines[fugitt].L], [1, 1, 1, 1]);
  assert.equal(done.results.length, 1);
  // As of each result, that bout and every one before it are done, every one after it isn't (bouts are fought one by one).
  for (const [i, b] of card.bouts.entries()) {
    const at = mma.stateAt(UFC324, playOf(UFC324, b.id, "result").at);
    assert.deepEqual(card.bouts.map((x) => at.bouts[x.id].stage === "done"), card.bouts.map((_, j) => j <= i), `as of bout ${i + 1}'s result`);
    assert.equal(at.results.length, i + 1);
    if (i + 1 < card.bouts.length) assert.ok(Date.parse(playOf(UFC324, b.id, "bout-end").at) < Date.parse(mma.readPlays(UFC324).find((p) => p.bout === card.bouts[i + 1].id).at));
  }
  // A moment that isn't one counts nothing; the end is everything.
  assert.equal(mma.stateAt(UFC324, "not a time").plays, 0);
  assert.deepEqual(mma.stateAt(UFC324, Infinity), mma.stateAt(UFC324));
  // Times never go back.
  const ts = mma.readPlays(UFC324).map((p) => Date.parse(p.at));
  assert.ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]));
});

test("draws, no contests, a disqualification, an overtime round, a quick win; and ESPN's own: a draw it flags a winner of", () => {
  const box = mma.readBox(USMAN);
  const craig = idOf(USMAN, "Paul Craig");
  const brundage = idOf(USMAN, "Cody Brundage");
  const nc = box.results.find((r) => r.bout === boutOf(USMAN, "Paul Craig").id);
  assert.deepEqual([nc.outcome, nc.winner, nc.method, nc.round, nc.time], ["nc", null, null, 1, "4:59"]);
  assert.equal(box.people[craig].stats.NC, 1);
  assert.equal(box.people[craig].stats.W, undefined);
  // A technical draw: stopped in round 3 at 0:36, to the cards of the rounds before.
  const draw = box.results.find((r) => r.bout === boutOf(USMAN, "Cody Brundage").id);
  assert.deepEqual([draw.outcome, draw.round, draw.time], ["draw", 3, "0:36"]);
  assert.deepEqual(draw.cards.map((c) => c.join("-")).sort(), ["19-19", "19-19", "20-18"].sort());
  assert.equal(box.people[brundage].stats.D, 1);
  assert.equal(box.people[brundage].stats.TIME, 636);
  assert.equal(playOf(USMAN, draw.bout, "result").text, "Cody Brundage and Mansur Abdul-Malik drew (19-19, 20-18, 19-19)");

  const rosas = mma.readBox(ROSAS);
  const uulu = idOf(ROSAS, "Ilimbek Akylbek Uulu");
  assert.deepEqual([rosas.people[uulu].stats.W, rosas.people[uulu].stats.DQ, rosas.people[uulu].stats.WR1, rosas.people[uulu].stats.QW], [1, 1, 1, undefined]);
  const ot = boutOf(ROSAS, "Ilimbek Akylbek Uulu");
  assert.deepEqual([ot.rounds, ot.overtime, ot.lengths.length], [3, true, 4], "ESPN's \"3 Rnd + OT (5-5-5-5)\"");
  // A submission at 0:57 of the 1st round: a quick win (60 seconds or less); a KO at 1:02 isn't.
  const hernandez = idOf(ROSAS, "Luis Hernandez");
  assert.deepEqual([rosas.people[hernandez].stats.SUB, rosas.people[hernandez].stats.WR1, rosas.people[hernandez].stats.QW], [1, 1, 1]);
  assert.equal(rosas.people[idOf(ROSAS, "Yazmin Jauregui")].stats.QW, undefined);
  assert.equal(mma.full(rosas.people[hernandez].stats).FIN, 1);

  // ESPN's own: a 2024 Rizin bout named "decision---split-draw" and flagged a win everywhere: the flags, and the reader says so.
  const a = clone(UFC324);
  const bout = a.board.competitions[10];
  a.core[bout.id].status.result = { name: "decision---split-draw", displayName: "Decision - Split (Draw)" };
  const issues = [];
  mma.readPlays(a, issues);
  assert.match(issues[0], /names a draw .* flags a winner/);
  assert.deepEqual([mma.readBox(a).results[10].outcome, mma.readBox(a).results[10].method], ["win", "DEC"]);
  // Without a flag anywhere, it's a draw; with only the FightCenter's (live, before the board says it), a win.
  const fcOf = Object.values(a.fightcenter.cards).flatMap((s) => s.competitions).find((c) => c.id === bout.id);
  for (const c of [...bout.competitors, ...a.core[bout.id].competitors]) c.winner = false;
  assert.equal(mma.readBox(a).results[10].winner, idOf(UFC324, "Justin Gaethje"), "the FightCenter's flag");
  for (const c of fcOf.competitors) c.winner = false;
  assert.equal(mma.readBox(a).results[10].outcome, "draw");
  // A win ESPN doesn't say how of scores the win, not a round's finish.
  const b2 = clone(UFC324);
  const first = b2.board.competitions[0];
  b2.core[first.id].status.result = {};
  Object.values(b2.fightcenter.cards).flatMap((s) => s.competitions).find((c) => c.id === first.id).status.result = {};
  const miller = mma.readBox(b2).people[idOf(UFC324, "Ty Miller")].stats;
  assert.deepEqual([miller.W, miller.KO, miller.WR1], [1, undefined, undefined]);
  // A live bout with no plays at all (the PFL's), its totals so far: on.
  const live = clone(PFL);
  live._asked = "2026-02-07T18:00:00Z";
  const pb = live.board.competitions[0];
  for (const s of [pb, live.core[pb.id], Object.values(live.fightcenter.cards).flatMap((x) => x.competitions).find((c) => c.id === pb.id)]) s.status = { period: 2, type: { state: "in", completed: false } };
  assert.equal(mma.stateAt(live).bouts[pb.id].stage, "in");
  // A tournament's fighter is once in the card's field.
  assert.equal(new Set(mma.card(CAGE).field).size, mma.card(CAGE).field.length);
});

test("no times: a card with statistics and no plays (UFC 312), and one with results only (PFL Dubai), known at the end or when asked", () => {
  const box = mma.readBox(UFC312);
  assert.equal(mma.readPlays(UFC312).filter((p) => !["bout-end", "result"].includes(p.kind)).length, 0, "no plays of ESPN's");
  // Read later with no `_asked`: 12 hours after the last segment's start (the main card's, 03:00).
  assert.ok(mma.readPlays(UFC312).every((p) => p.at === "2025-02-09T15:00:00Z"));
  assert.deepEqual(mma.stateAt(UFC312, "2025-02-09T14:59:59Z").results, []);
  assert.equal(mma.stateAt(UFC312, "2025-02-09T15:00:00Z").results.length, 12);
  const crute = idOf(UFC312, "Jimmy Crute");
  assert.equal(box.people[crute].stats.D, 1);
  assert.ok(box.people[crute].stats.SSL > 0, "the statistics are ESPN's");
  assert.deepEqual(mma.stateAt(UFC312).bouts[boutOf(UFC312, "Jimmy Crute").id].rounds, {}, "no plays, no rounds");
  assert.equal(mma.card(UFC312).bouts.filter((b) => b.title).length, 2);
  for (const n of ["Quillan Salkilld", "Tallison Teixeira"]) assert.equal(box.people[idOf(UFC312, n)].stats.QW, 1, n);
  // When asked, the results are known then.
  const asked = { ...UFC312, _asked: "2025-02-09T06:10:00Z" };
  assert.ok(mma.readPlays(asked).every((p) => p.at === "2025-02-09T06:10:00Z"));

  const pfl = mma.readBox(PFL);
  const nurmagomedov = idOf(PFL, "Usman Nurmagomedov");
  assert.deepEqual(pfl.people[nurmagomedov].stats, { BOUT: 1, TIME: 881, W: 1, SUB: 1, WR3: 1 }, "ESPN's technical submission: only the result's numbers");
  assert.ok(Object.values(pfl.people).every((p) => p.stats.SSL == null), "the PFL has no statistics");
  assert.ok(pfl.results.every((r) => !r.cards.length), "nor the judges' scores");
  assert.equal(mma.card(PFL).bouts.filter((b) => b.title).length, 2);
});

test("a one-night tournament: a fighter on the card twice has both bouts' numbers", () => {
  const box = mma.readBox(CAGE);
  const brown = box.people[idOf(CAGE, "Omiel Brown")];
  assert.equal(brown.bouts.length, 2);
  assert.deepEqual([brown.stats.BOUT, brown.stats.W, brown.stats.KO, brown.stats.WR1, brown.stats.SD, brown.stats.DEC], [2, 2, 1, 1, 1, 1]);
  const camara = box.people[idOf(CAGE, "Bourama Camara")];
  assert.deepEqual([camara.stats.BOUT, camara.stats.W, camara.stats.L], [2, 1, 1]);
  assert.deepEqual(mma.stateAt(CAGE).lines[brown.id], brown.stats);
  // Its tournament bouts are two rounds (ESPN's format).
  assert.equal(boutOf(CAGE, "Henri Lintula").rounds, 2);
});

test("live: a bout on shows its totals so far at when it was asked; one not started has nothing; the result only once ESPN says it", () => {
  // UFC 324 as ESPN would have had it at 05:10 during the main event's 3rd round (made up from the recording: the plays up to
  // then, its status in, its winner and the judges unsaid, the FightCenter's totals so far, no core statistics).
  const t = "2026-01-25T05:10:00Z";
  const a = clone(UFC324);
  a._asked = t;
  a.board.status.type = { state: "in", completed: false, name: "STATUS_IN_PROGRESS" };
  const main = a.board.competitions[10];
  const live = { clock: 120, displayClock: "2:00", period: 3, type: { state: "in", completed: false, name: "STATUS_IN_PROGRESS" } };
  main.status = live;
  for (const c of main.competitors) (c.winner = false), delete c.linescores;
  a.core[main.id].status = live;
  a.core[main.id].plays = a.core[main.id].plays.filter((p) => Date.parse(p.wallclock) <= Date.parse(t));
  for (const c of a.core[main.id].competitors) (c.winner = false), delete c.statistics;
  const fc = Object.values(a.fightcenter.cards).flatMap((s) => s.competitions).find((c) => c.id === main.id);
  fc.status = live;
  fc.judgesScores = "";
  for (const c of fc.competitors) {
    c.winner = false;
    c.stats = [{ name: "sigStrikes", value: 50, displayValue: "50/100" }, { name: "knockDowns", value: 1, displayValue: "1" }];
  }
  const issues = [];
  const plays = mma.readPlays(a, issues);
  assert.deepEqual(issues, []);
  const soFar = plays.find((p) => p.kind === "so-far");
  assert.equal(soFar.at, t);
  assert.equal(soFar.bout, main.id);
  const s = mma.stateAt(a);
  const gaethje = idOf(UFC324, "Justin Gaethje");
  assert.deepEqual(s.lines[gaethje], { SSL: 50, SSA: 100, KD: 1 });
  assert.deepEqual([s.bouts[main.id].stage, s.bouts[main.id].round], ["in", 3]);
  assert.equal(s.bouts[main.id].result, null);
  assert.equal(s.results.length, 10, "the ten bouts before are done");
  assert.equal(mma.readBox(a).final, false);
  assert.ok(!mma.timeline(a).some((p) => p.kind === "final"), "no final's correction while live");
  // A later watch at the main event's walkouts sees none of it.
  assert.equal(mma.stateAt(a, "2026-01-25T04:45:00Z").lines[gaethje], undefined);
  // A bout not started yet, live: nothing of it.
  const pre = clone(a);
  const prestat = { clock: 0, displayClock: "-", period: 0, type: { state: "pre", completed: false, name: "STATUS_SCHEDULED" } };
  pre.board.competitions[10].status = prestat;
  pre.core[main.id].status = prestat;
  pre.core[main.id].plays = [];
  Object.values(pre.fightcenter.cards).flatMap((x) => x.competitions).find((c) => c.id === main.id).status = prestat;
  assert.equal(mma.readPlays(pre).filter((p) => p.bout === main.id).length, 0);
  assert.equal(mma.stateAt(pre).bouts[main.id].stage, "pre");
});

test("MMA's defaults are data the spec reads: DraftKings' MMA, six fighters, locks per event", () => {
  const d = defaultsFor("mma");
  assert.equal(d.sport, "mma");
  assert.match(d.scoring.source, /DraftKings/);
  assert.deepEqual(d.scoring.points, { TSL: 0.2, SSL: 0.2, CTRL: 0.03, TDL: 5, REV: 5, KD: 10, WR1: 90, WR2: 70, WR3: 45, WR4: 40, WR5: 40, DEC: 30, QW: 25 });
  for (const k of Object.keys(d.scoring.points)) assert.ok(mma.stat(k), k);
  for (const spec of Object.values(d.specs)) assert.deepEqual(spec.spec.score.points, d.scoring.points);
  assert.equal(d.specs.season.spec.get.each, sum(d.slots.lineup.map((x) => x.n)) + d.slots.bench);
  for (const slot of d.slots.lineup) for (const t of slot.takes) assert.ok(mma.groups.some((g) => g.key === t), t);
  assert.equal(d.closes, mma.lock);
  assert.equal(defaultsFor("mma", "mma/pfl"), d, "every promotion shares them");
  // Scored by the table: Gaethje's UFC 324 (200 strikes, 144 significant, 5:55 in control, 3 takedowns, 2 knockdowns, a
  // decision) and Hernandez's quick submission (a 1st-round win in 57 seconds).
  const score = (line) => sum(Object.entries(d.scoring.points).map(([k, v]) => (line[k] ?? 0) * v));
  const close = (x, y) => assert.ok(Math.abs(x - y) < 1e-9, `${x} vs ${y}`);
  close(score(mma.stateAt(UFC324).lines[idOf(UFC324, "Justin Gaethje")]), 0.2 * 200 + 0.2 * 144 + 0.03 * 355 + 5 * 3 + 10 * 2 + 30);
  const h = mma.stateAt(ROSAS).lines[idOf(ROSAS, "Luis Hernandez")];
  close(score(h), 0.2 * h.TSL + 0.2 * h.SSL + 0.03 * (h.CTRL ?? 0) + 5 * (h.TDL ?? 0) + 5 * (h.REV ?? 0) + 10 * (h.KD ?? 0) + 90 + 25);
  // On a card ESPN has no statistics for, only the result scores: Nurmagomedov's 3rd-round submission.
  assert.equal(score(mma.stateAt(PFL).lines[idOf(PFL, "Usman Nurmagomedov")]), 45);
});
