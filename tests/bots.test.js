// Computer players (src/lib/game/bot-logic.js): they make every move a person would, legally, and
// never the obvious mistakes -- in every league type and show.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");

// Two tribes of four (a1..a4 on A, b1..b4 on B), one person (p1) and one bot (bot).
function league(type, settings = {}) {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: type, teamSize: 2, activeSlots: 2, benchSlots: 1, setupComplete: true }, settings);
  s.tribes = [
    { id: "A", name: "A", color: "#f00" },
    { id: "B", name: "B", color: "#00f" },
  ];
  const c = (id, tribeId) => ({ id, name: id, tribeId, ownerIds: [], status: "active", exitEpisodeId: null });
  s.castaways = ["a1", "a2", "a3", "a4"].map((id) => c(id, "A")).concat(["b1", "b2", "b3", "b4"].map((id) => c(id, "B")));
  s.players = [
    { id: "p1", name: "Person", color: "#f00", active: true, disabled: false },
    { id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true },
  ];
  s.draftOrder = ["p1", "bot"];
  s.episodes = [];
  StateLogic.ensureNextEpisode(s);
  return s;
}
const owned = (s, pid) => s.castaways.filter((c) => c.ownerIds.includes(pid)).map((c) => c.id);
const ep1 = (s) => s.episodes.find((e) => e.number === 1);

test("a bot takes its draft turns as soon as they come round, and stops at a person's", () => {
  const s = league("classic-draft");
  s.draftForceStarted = true;
  assert.equal(Bots.run(s), 0, "p1 is up first");
  StateLogic.draftToCurrentTurn(s, "a1");
  // Snake: bot picks twice in a row (end of round 1, start of round 2), then it's p1 again.
  assert.equal(Bots.run(s), 2);
  assert.equal(StateLogic.currentDraftTurn(s).playerId, "p1");
  const mine = owned(s, "bot");
  assert.equal(mine.length, 2);
  // Spread across tribes rather than both from one.
  assert.notEqual(StateLogic.getCastaway(s, mine[0]).tribeId, StateLogic.getCastaway(s, mine[1]).tribeId);
});

test("no draft moves before the draft starts, and running again changes nothing", () => {
  const s = league("classic-draft");
  s.draftOrder = ["bot", "p1"];
  assert.equal(Bots.run(s), 0);
  s.draftForceStarted = true;
  assert.equal(Bots.run(s), 1);
  assert.equal(Bots.run(s), 0);
  assert.equal(Bots.hasWork(s), false);
});

test("Active Roster: fields a full lineup of people still in, and refills when a starter goes", () => {
  const s = league("active-roster");
  ["a1", "a2", "b1"].forEach((id) => StateLogic.Core.setOwner(s, id, "bot"));
  s.draftPicksMade = 6;
  Bots.run(s);
  const ep = ep1(s);
  const lineup = StateLogic.activeRosterLineupFor(s, ep.id, "bot");
  assert.equal(lineup.length, 2);
  // Results for episode 1: one of its starters is voted out; episode 2 opens.
  const out = lineup[0];
  StateLogic.addElimination(s, ep.id, out, "Voted Out");
  StateLogic.ensureNextEpisode(s);
  Bots.run(s);
  const ep2 = s.episodes.find((e) => e.number === 2);
  const next = StateLogic.activeRosterLineupFor(s, ep2.id, "bot");
  assert.equal(next.length, 2);
  assert.ok(!next.includes(out));
  assert.equal(Bots.hasWork(s), false);
});

test("Eliminator Pool: avoids whoever was in the firing line, and keeps to the cycle rule", () => {
  const s = league("pickem");
  const ep = ep1(s);
  // Everyone on tribe B except b4 received votes and survived; a tribe of four vs four.
  ["a1", "a2", "a3", "a4", "b1", "b2", "b3"].forEach((id) => StateLogic.addScoringEvent(s, ep.id, "survivedVotes", id));
  StateLogic.addElimination(s, ep.id, "b1", "Voted Out");
  StateLogic.ensureNextEpisode(s);
  Bots.run(s);
  const ep2 = s.episodes.find((e) => e.number === 2);
  assert.equal(StateLogic.pickEmPickFor(s, ep2.id, "bot").castawayId, "b4");
  // Next week b4 is off the table (no back-to-back), so it picks someone else.
  StateLogic.addElimination(s, ep2.id, "a1", "Voted Out");
  StateLogic.ensureNextEpisode(s);
  Bots.run(s);
  const ep3 = s.episodes.find((e) => e.number === 3);
  const pick = StateLogic.pickEmPickFor(s, ep3.id, "bot").castawayId;
  assert.notEqual(pick, "b4");
  assert.equal(StateLogic.getCastaway(s, pick).status, "active");
});

test("never picks after the episode airs", () => {
  const s = league("pickem");
  ep1(s).airsAt = new Date(Date.now() - 60000).toISOString();
  assert.equal(Bots.run(s), 0);
});

test("blind draft: a full, valid submission per bot, nothing once it's locked", () => {
  const s = league("classic-draft", { ownershipMode: "shared" });
  assert.deepEqual(Bots.blindSubmissions(s), [], "not started");
  s.draftForceStarted = true;
  const subs = Bots.blindSubmissions(s);
  assert.equal(subs.length, 1);
  assert.equal(subs[0].playerId, "bot");
  assert.equal(StateLogic.BlindDraftLogic.validateSubmission(s, "bot", subs[0].castawayIds), null);
  StateLogic.BlindDraftLogic.setLockedPlayerIds(s, ["bot"]);
  assert.deepEqual(Bots.blindSubmissions(s), []);
});

test("add/drops: a sharp bot claims a clearly better castaway, a casual one keeps its own", () => {
  for (const [level, expectSwap] of [["sharp", true], ["casual", false]]) {
    const s = league("active-roster", { tradeEnabled: true, swapEvery: 1 });
    StateLogic.getPlayer(s, "bot").botLevel = level;
    ["a1", "a2", "a3"].forEach((id) => StateLogic.Core.setOwner(s, id, "bot"));
    ["b1", "b2", "b3"].forEach((id) => StateLogic.Core.setOwner(s, id, "p1"));
    s.draftPicksMade = 6;
    const ep = ep1(s);
    // b4, a free agent, has a decent week -- better, but not by a mile.
    StateLogic.addScoringEvent(s, ep.id, "rewardWin", "b4");
    StateLogic.addScoringEvent(s, ep.id, "survivedVotes", "a3");
    StateLogic.addElimination(s, ep.id, "a4", "Voted Out");
    StateLogic.ensureNextEpisode(s);
    const week = StateLogic.WaiverLogic.open(s, Date.now());
    assert.ok(week.addDrop);
    const claim = Bots.waiverClaim(s, "bot", week);
    assert.equal(claim.addIds.includes("b4"), expectSwap, level);
    assert.equal(!!claim.dropId, expectSwap, `${level}: drops only when it adds`);
  }
});

test("finale picks are filled once there's something to go on, then left alone", () => {
  const s = league("classic-draft", { finalePredictionsEnabled: true });
  ["c1", "c2", "c3", "c4"].forEach((id) => s.castaways.push({ id, name: id, tribeId: "A", ownerIds: [], status: "active", exitEpisodeId: null }));
  s.draftForceStarted = true;
  s.draftPicksMade = 4;
  Bots.run(s);
  assert.ok(!(s.finalePredictions || []).some((f) => f.playerId === "bot"), "12 left, pre-merge: too early");
  ep1(s).postMerge = true;
  Bots.run(s);
  const fp = s.finalePredictions.find((f) => f.playerId === "bot");
  assert.ok(fp.winner);
  assert.equal(new Set(fp.top3.filter(Boolean)).size, 3);
  const before = JSON.stringify(fp);
  StateLogic.addScoringEvent(s, ep1(s).id, "survivedVotes", fp.winner);
  Bots.run(s);
  assert.equal(JSON.stringify(s.finalePredictions.find((f) => f.playerId === "bot")), before);
});

test("works for other shows: The Traitors (no tribes, roles) and The Challenge", () => {
  for (const showFormat of ["traitors", "challenge"]) {
    const s = league("pickem", { showFormat });
    s.castaways.forEach((c) => { c.tribeId = null; });
    const ep = ep1(s);
    const danger = showFormat === "traitors" ? "survivedRoundTable" : "nominatedSurvived";
    s.castaways.filter((c) => c.id !== "a2").forEach((c) => StateLogic.addScoringEvent(s, ep.id, danger, c.id));
    StateLogic.addElimination(s, ep.id, "b1", showFormat === "traitors" ? "Banished" : "Eliminated");
    StateLogic.ensureNextEpisode(s);
    Bots.run(s);
    const ep2 = s.episodes.find((e) => e.number === 2);
    assert.equal(StateLogic.pickEmPickFor(s, ep2.id, "bot").castawayId, "a2", showFormat);
  }
});

test("a seat that isn't automated, or is disabled, is never played", () => {
  const s = league("classic-draft");
  s.draftOrder = ["bot", "p1"];
  s.draftForceStarted = true;
  StateLogic.getPlayer(s, "bot").automated = false;
  assert.equal(Bots.run(s), 0);
  StateLogic.getPlayer(s, "bot").automated = true;
  StateLogic.disablePlayer(s, "bot");
  assert.equal(Bots.run(s), 0);
});
