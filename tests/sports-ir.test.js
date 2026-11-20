// Step 2.4 (docs/PLAN-sports-ready.md): injured reserve (the spec's get.ir: StateLogic.IrLogic). Someone their roster lists as the IR
// takes (the NFL's IR, O or PUP: state.castInjuries, stamped per read) sits outside the roster's count, so the seat can add someone
// into the open spot; they never start or score there; bringing them back needs room; someone healthy left on IR blocks the seat's
// adds (Yahoo's and ESPN's rule) unless the game says they stay. Each team sport's season game carries its league's IR (Yahoo's
// defaults, 2026-11-20). Moves count from the episode after the latest with results, so a week played keeps whom it fielded. Run
// with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { defaultsFor, sportOf, groupOf, specContextOf } = jiti("../src/lib/sports/index.ts");

const IR = S.IrLogic;
const NFL = "football/nfl";
const NOW = Date.parse("2026-11-20T18:00:00Z");

// A small NFL season game: the league's season spec with a roster of four (a QB and a WR start), ann's team and a bot's, two free
// receivers; Episode 1 has its results, 2 and 3 to come.
function league({ hurt = {}, ir, people = ["ann"], lineups = {} } = {}) {
  const sport = sportOf(NFL);
  const d = defaultsFor("football", NFL).specs.season.spec;
  const spec = {
    ...d,
    get: { ...d.get, each: 4, ...(ir !== undefined ? { ir } : {}) },
    count: { start: 2, slots: [{ label: "QB", of: "position", values: ["QB"], n: 1 }, { label: "WR", of: "position", values: ["WR"], n: 1 }] },
  };
  const roster = [
    ["qb1", "QB", "ann"], ["wr1", "WR", "ann"], ["wr2", "WR", "ann"], ["rb1", "RB", "ann"],
    ["qb2", "QB", "bo"], ["wr5", "WR", "bo"], ["wr6", "WR", "bo"], ["rb2", "RB", "bo"],
    ["wr3", "WR", null], ["wr4", "WR", null],
  ];
  const seats = [...people, ...(people.includes("bo") ? [] : ["bo"])];
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: seats.map((id) => ({ id, name: id, color: "#000", active: true, ...(id === "bo" ? { automated: true } : {}) })),
    draftOrder: seats,
    tribes: [{ id: "t1", name: "Rivertown" }],
    castaways: roster.map(([id, , owner]) => ({ id, name: id.toUpperCase(), status: "active", tribeId: "t1", ownerIds: owner ? [owner] : [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [1, 2, 3].map((n) => ({ id: `ep${n}`, number: n, events: [], scoringEvents: [], bets: [], picks: [], lineups: lineups[n] || {}, ...(n === 1 ? { noExit: true } : {}) })),
    draftPicksMade: 8,
  });
  s.castProps = Object.fromEntries(roster.map(([id, pos]) => [id, { position: pos }]));
  s.castPropDefs = [];
  s.statGroups = Object.fromEntries(roster.map(([id, pos]) => [id, groupOf(sport, pos)]));
  s.castInjuries = Object.fromEntries(Object.entries(hurt).map(([id, code]) => [id, { code, status: code, date: null }]));
  return s;
}
const owns = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id).sort();
// A waiver week with `swaps`, run with `claims`, so free agency is open.
function freeAgency(s, claims = {}, swaps = 2) {
  S.WaiverLogic.openWindow(s, swaps, NOW);
  return S.WaiverLogic.process(s, claims, { now: NOW });
}

test("each team sport's season game carries its league's IR (Yahoo's defaults); a short game none", () => {
  const irOf = (league) => defaultsFor(league.split("/")[0], league).specs.season.spec.get.ir;
  assert.deepEqual(irOf("football/nfl"), { n: 2, takes: ["IR", "O", "PUP"] });
  assert.deepEqual(irOf("basketball/nba"), { n: 3, takes: ["O"] });
  assert.deepEqual(irOf("hockey/nhl"), { n: 2, takes: ["IR"] });
  assert.deepEqual(irOf("baseball/mlb"), { n: 4, takes: ["IL7", "IL10", "IL15", "IL60"] });
  assert.equal(defaultsFor("football", NFL).specs.short.spec.get.ir, undefined, "a few players, every one counting: no IR");
  assert.equal(defaultsFor("golf", "golf/pga").specs.season?.spec.get.ir, undefined);
  for (const league of ["football/nfl", "basketball/nba", "hockey/nhl", "baseball/mlb"]) {
    const sport = sportOf(league);
    const spec = defaultsFor(sport.id, league).specs.season.spec;
    assert.deepEqual(G.specProblems(spec, specContextOf(sport, league.split("/")[1])).filter((p) => /get/.test(p.at)), [], league);
    // Through the settings and back (a league's stored spec).
    assert.deepEqual(G.gameOf(G.settingsOf(spec)).get.ir, spec.get.ir, `${league}: settings round trip`);
  }
});

test("the spec's check: IR's places, codes and its healthy rule", () => {
  const d = defaultsFor("football", NFL).specs.season.spec;
  const at = (ir, more = {}) => G.specProblems({ ...d, ...more, get: { ...d.get, ir } }).filter((p) => p.at.startsWith("get.ir")).map((p) => p.at);
  assert.deepEqual(at({ n: 2, takes: ["IR"], healthy: "stays" }), []);
  assert.deepEqual(at({ n: 0, takes: ["IR"] }), ["get.ir.n"]);
  assert.deepEqual(at({ n: 7, takes: ["IR"] }), ["get.ir.n"]);
  assert.deepEqual(at({ n: 1, takes: [] }), ["get.ir.takes"]);
  assert.deepEqual(at({ n: 1, takes: ["IR", "IR"] }), ["get.ir.takes"]);
  assert.deepEqual(at({ n: 1, takes: ["IR"], healthy: "gone" }), ["get.ir.healthy"]);
  assert.deepEqual(at({ n: 1, takes: ["IR"], slots: 2 }), ["get.ir.slots"]);
  // The words.
  const words = G.describeSpec({ ...d, get: { ...d.get, ir: { n: 2, takes: ["IR", "O", "PUP"] } } });
  const all = [...words.rules, ...(words.details || []).flatMap((x) => (typeof x === "string" ? [x] : [x.text || ""]))].join(" ");
  assert.match(all, /two IR spots beside its roster, for someone listed IR, O or PUP/);
  assert.match(all, /healthy, you can’t add anyone/);
});

test("someone listed Out goes on IR, out of the lineup from the next episode on, never out of a week played", () => {
  const s = league({ hurt: { wr1: "O", rb1: "IR", qb1: "PUP" }, lineups: { 1: { ann: ["qb1", "wr1"] } } });
  assert.equal(IR.places(s), 2);
  assert.match(IR.place(s, "ann", "wr2", NOW) || "", /Only someone listed IR, O, PUP can go on IR/);
  assert.match(IR.place(s, "ann", "wr5", NOW) || "", /not on your roster/);
  assert.equal(IR.place(s, "ann", "wr1", NOW), null);
  assert.match(IR.place(s, "ann", "wr1", NOW) || "", /already on IR/);
  assert.deepEqual([...IR.onNow(s, "ann")], ["wr1"]);
  assert.deepEqual([...IR.onFor(s, "ann", 1)], [], "Episode 1 had its results: it keeps him");
  assert.deepEqual([...IR.onFor(s, "ann", 2)], ["wr1"]);
  assert.deepEqual(S.ActiveRosterLogic.lineupFor(s, "ep1", "ann"), ["qb1", "wr1"], "the week played keeps him");
  assert.deepEqual(S.ActiveRosterLogic.lineupFor(s, "ep2", "ann"), ["qb1"], "carried into Episode 2 without him: a gap to fill");
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep2", "ann", ["qb1", "wr1"]) || "", /WR1 is on IR: bring them back to start them/);
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep2", "ann", ["qb1", "wr2"]), null);
  assert.equal(IR.openSpots(s, "ann"), 1, "he doesn't count toward the roster of four");
  // Two places: the second takes another, the third is refused.
  assert.equal(IR.place(s, "ann", "rb1", NOW), null);
  assert.match(IR.place(s, "ann", "qb1", NOW) || "", /Your IR is full: it holds 2/);
  // Without IR in the game: none of it.
  const plain = league({ hurt: { wr1: "O" }, ir: null });
  delete plain.settings.draftIr;
  const p2 = S.migrateLeagueState(plain);
  assert.equal(IR.on(p2), false);
  assert.match(IR.place(p2, "ann", "wr1", NOW) || "", /no IR/);
});

test("a lineup that's locked keeps its starter: he goes on IR once its results are in", () => {
  const s = league({ hurt: { wr1: "O", rb1: "IR" }, lineups: { 2: { ann: ["qb1", "wr1"] } } });
  s.episodes.find((e) => e.id === "ep2").lineupsLocked = true;
  assert.match(IR.place(s, "ann", "wr1", NOW) || "", /in a lineup that's locked: move them once its results are in/);
  assert.equal(IR.place(s, "ann", "rb1", NOW), null, "someone on the bench isn't held by the lock");
  s.episodes.find((e) => e.id === "ep2").noExit = true;
  assert.equal(IR.place(s, "ann", "wr1", NOW), null, "Episode 2's results are in: it counts from Episode 3");
  assert.deepEqual(S.ActiveRosterLogic.lineupFor(s, "ep2", "ann"), ["qb1", "wr1"]);
});

test("the open spot takes a free agent with no drop, in free agency and in a waiver claim", () => {
  const s = league({ hurt: { wr1: "O" } });
  freeAgency(s);
  assert.equal(S.WaiverLogic.freeAgencyMove(s, "ann", "wr3", null, NOW), "Choose who to drop", "no open spot yet");
  assert.equal(IR.place(s, "ann", "wr1", NOW), null);
  assert.equal(S.WaiverLogic.freeAgencyMove(s, "ann", "wr3", null, NOW), null);
  assert.deepEqual(owns(s, "ann"), ["qb1", "rb1", "wr1", "wr2", "wr3"], "five held, four on the roster");
  assert.equal(IR.openSpots(s, "ann"), 0);
  assert.equal(S.WaiverLogic.freeAgencyMove(s, "ann", "wr4", null, NOW), "Choose who to drop");
  const tx = s.midSeason.log[s.midSeason.log.length - 1];
  assert.equal(tx.droppedCastawayId, null);
  assert.equal(tx.via, "freeAgency");

  // A waiver claim: { addId, dropId: null }.
  const w = league({ hurt: { wr1: "O" } });
  IR.place(w, "ann", "wr1", NOW);
  const period = S.WaiverLogic.openWindow(w, 1, NOW).period;
  const checked = S.WaiverLogic.checkClaim(w, period, "ann", { pairs: [{ addId: "wr4", dropId: null }, { addId: "wr3", dropId: null }] });
  assert.equal(checked.error, undefined);
  assert.deepEqual(checked.claim.pairs, [{ addId: "wr4", dropId: null }, { addId: "wr3", dropId: null }]);
  const run = S.WaiverLogic.process(w, { ann: checked.claim }, { now: NOW });
  assert.deepEqual(run.results.filter((r) => r.outcome === "got").map((r) => [r.castawayId, r.droppedCastawayId]), [["wr4", null]], "one spot, one add");
  assert.ok(owns(w, "ann").includes("wr4") && !owns(w, "ann").includes("wr3"));
  // Without an open spot the pair is refused.
  const full = league({ hurt: { wr1: "O" } });
  const p2 = S.WaiverLogic.openWindow(full, 1, NOW).period;
  assert.equal(S.WaiverLogic.checkClaim(full, p2, "ann", { pairs: [{ addId: "wr4", dropId: null }] }).error, "Your roster is full: drop someone");
});

test("someone healthy on IR blocks adds until they're back (a drop makes room) or dropped; 'stays' lets them sit", () => {
  const s = league({ hurt: { wr1: "O" } });
  freeAgency(s);
  IR.place(s, "ann", "wr1", NOW);
  S.WaiverLogic.freeAgencyMove(s, "ann", "wr3", null, NOW);
  s.castInjuries = {}; // healed
  assert.deepEqual(IR.healthy(s, "ann"), ["wr1"]);
  assert.match(S.WaiverLogic.freeAgencyMove(s, "ann", "wr4", "rb1", NOW) || "", /WR1 is healthy: bring them back from IR, or drop them, before you add anyone/);
  assert.match(IR.back(s, "ann", "wr1", null, NOW) || "", /Your roster is full: drop someone to bring WR1 back/);
  assert.equal(IR.back(s, "ann", "wr1", "wr3", NOW), null);
  assert.deepEqual(owns(s, "ann"), ["qb1", "rb1", "wr1", "wr2"]);
  assert.deepEqual([...IR.onNow(s, "ann")], []);
  assert.equal(IR.addProblem(s, "ann"), null);
  const drop = s.midSeason.log[s.midSeason.log.length - 1];
  assert.deepEqual([drop.addedCastawayId, drop.droppedCastawayId, drop.via], [null, "wr3", "ir"]);
  assert.equal(S.WaiverLogic.swapsMade(s, S.WaiverLogic.current(s), "ann"), 1, "the drop on its own uses no swap");

  // Or drop the healthy one himself.
  const d = league({ hurt: { wr1: "O" } });
  IR.place(d, "ann", "wr1", NOW);
  d.castInjuries = {};
  assert.equal(IR.drop(d, "ann", "wr1", NOW), null);
  assert.deepEqual([...IR.onNow(d, "ann")], []);
  assert.equal(IR.addProblem(d, "ann"), null);

  // 'stays': no block. A copy without the rosters' injuries can't tell: no block either.
  const st = league({ hurt: { wr1: "O" }, ir: { n: 2, takes: ["IR", "O", "PUP"], healthy: "stays" } });
  IR.place(st, "ann", "wr1", NOW);
  st.castInjuries = {};
  assert.equal(IR.addProblem(st, "ann"), null);
  const blind = league({ hurt: { wr1: "O" } });
  IR.place(blind, "ann", "wr1", NOW);
  delete blind.castInjuries;
  assert.equal(IR.addProblem(blind, "ann"), null);
});

test("a viewer behind sees no IR move past their mark; undoing a waiver run puts a dropped IR player back", () => {
  const s = league({ hurt: { wr1: "O" } });
  IR.place(s, "ann", "wr1", NOW);
  const copy = structuredClone(s);
  S.WaiverLogic.redact(copy, 0);
  assert.deepEqual([...IR.onNow(copy, "ann")], [], "logged at Episode 1, which a viewer at 0 hasn't seen");
  S.WaiverLogic.redact(s, 1);
  assert.deepEqual([...IR.onNow(s, "ann")], ["wr1"]);

  // A claim that drops the IR player takes him off IR; Undo puts him back on it, and back on the team.
  const w = league({ hurt: { wr1: "O" } });
  IR.place(w, "ann", "wr1", NOW);
  const period = S.WaiverLogic.openWindow(w, 1, NOW).period;
  S.WaiverLogic.process(w, { ann: { pairs: [{ addId: "wr3", dropId: "wr1" }] } }, { now: NOW });
  assert.ok(!owns(w, "ann").includes("wr1"));
  assert.deepEqual([...IR.onNow(w, "ann")], []);
  assert.equal(S.WaiverLogic.undo(w), null);
  assert.ok(owns(w, "ann").includes("wr1"));
  assert.deepEqual([...IR.onNow(w, "ann")], ["wr1"]);
  assert.ok(period);
});

test("computer players put the hurt on IR, claim into the spot, and bring the healthy back", () => {
  const s = league({ hurt: { wr5: "O" }, people: ["ann", "bo"] });
  assert.ok(Bots.run(s) > 0);
  assert.deepEqual([...IR.onNow(s, "bo")], ["wr5"]);
  assert.ok(!(S.ActiveRosterLogic.lineupFor(s, "ep2", "bo") || []).includes("wr5"), "and never starts him");
  const period = S.WaiverLogic.openWindow(s, 1, NOW).period;
  const claim = Bots.waiverClaim(s, "bo", period);
  assert.ok(claim.pairs.some((x) => x.dropId === null), JSON.stringify(claim.pairs));
  S.WaiverLogic.process(s, { bo: claim }, { now: NOW });
  assert.equal(owns(s, "bo").length, 5);
  // Healed: back, dropping whom it rates lowest (or him), so its adds never block.
  s.castInjuries = {};
  Bots.run(s);
  assert.deepEqual(IR.healthy(s, "bo"), []);
  assert.equal(IR.addProblem(s, "bo"), null);
  assert.equal(owns(s, "bo").length, 4);
  assert.equal(Bots.run(structuredClone(s)), 0, "then quiet");
});
