// Computer players in any game (src/lib/game/computer-players.ts): which games they play, when they can join (before the
// draft; with no draft, before the game's first result), that they never leave while the draft's open, and that one taken
// out after the draft frees its team and leaves the draft done. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const CP = jiti("../src/lib/game/computer-players.ts");
const StateLogic = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");

// Eight castaways on two tribes and one person; computer players are added by the test.
function league(type) {
  const s = StateLogic.defaultState();
  Object.assign(s.settings, { leagueTypeId: type, teamSize: 2, activeSlots: 2, benchSlots: 0, setupComplete: true });
  s.tribes = [
    { id: "A", name: "A", color: "#f00" },
    { id: "B", name: "B", color: "#00f" },
  ];
  const c = (id, tribeId) => ({ id, name: id, tribeId, ownerIds: [], status: "active", exitEpisodeId: null });
  s.castaways = ["a1", "a2", "a3", "a4"].map((id) => c(id, "A")).concat(["b1", "b2", "b3", "b4"].map((id) => c(id, "B")));
  s.players = [{ id: "p1", name: "Ada", color: "#f00", active: true, disabled: false }];
  s.draftOrder = ["p1"];
  s.episodes = [];
  StateLogic.ensureNextEpisode(s);
  return s;
}

test("they play the drafts and Survival Pool on a competition, not the calls or bingo games, nor a series or sport", () => {
  assert.ok(CP.botsPlay(league("classic-draft")));
  assert.ok(CP.botsPlay(league("active-roster")));
  assert.ok(CP.botsPlay(league("pickem")));
  assert.equal(CP.botsPlay(league("weekly-calls")), false);
  assert.equal(CP.botsPlay(league("weekly-bingo")), false);
  assert.equal(CP.botsPlay(league("classic-draft"), "sport"), false);
  assert.equal(CP.botsPlay(league("active-roster"), "series"), false);
});

test("named after nobody in the game, at the level asked, into the draft order", () => {
  const s = league("classic-draft");
  const a = CP.addBot(s, "sharp");
  const b = CP.addBot(s, "easy");
  // "Ada" is the person's name, so the first computer player is the next one.
  assert.equal(a.name, "Max");
  assert.equal(b.name, "Ivy");
  assert.deepEqual([a.automated, a.botLevel, CP.levelOf(a)], [true, "sharp", "sharp"]);
  assert.equal(CP.levelOf(b), "easy");
  assert.deepEqual(s.draftOrder, ["p1", a.id, b.id]);
  assert.equal(CP.botsIn(s).length, 2);
});

test("up to five, and only before the draft starts", () => {
  const s = league("classic-draft");
  for (let i = 0; i < CP.MAX_BOTS; i++) {
    assert.equal(CP.addProblem(s), null);
    CP.addBot(s, "normal");
  }
  assert.match(CP.addProblem(s), /up to 5/);
  const t = league("classic-draft");
  t.draftForceStarted = true;
  assert.match(CP.addProblem(t), /draft has started/);
});

test("never taken out while the draft's open; before it and once it's done they can be", () => {
  const s = league("classic-draft");
  const bot = CP.addBot(s, "normal");
  assert.equal(CP.removeProblem(s), null, "before the draft");
  s.draftForceStarted = true;
  assert.equal(CP.draftOpen(s), true);
  assert.match(CP.removeProblem(s), /draft's open/);
  // Snake of two, two each: p1, bot, bot, p1.
  StateLogic.draftToCurrentTurn(s, "a1");
  Bots.run(s);
  assert.match(CP.removeProblem(s), /draft's open/, "mid-draft");
  StateLogic.draftToCurrentTurn(s, s.castaways.find((c) => !c.ownerIds.length).id);
  assert.equal(CP.draftOpen(s), false);
  assert.equal(CP.removeProblem(s), null, "once it's done");
  // Taken out (as the server does): its team is free, and the draft stays done for whoever's left.
  const theirs = s.castaways.filter((c) => c.ownerIds.includes(bot.id)).map((c) => c.id);
  assert.equal(theirs.length, 2);
  StateLogic.removePlayer(s, bot.id);
  assert.ok(theirs.every((id) => !StateLogic.getCastaway(s, id).ownerIds.length));
  assert.equal(StateLogic.currentDraftTurn(s).isComplete, true);
  assert.equal(CP.draftOpen(s), false);
});

test("the blind draft is open until it's revealed", () => {
  const s = league("classic-draft");
  s.settings.ownershipMode = "shared";
  CP.addBot(s, "normal");
  assert.equal(CP.removeProblem(s), null);
  s.draftForceStarted = true;
  assert.match(CP.removeProblem(s), /draft's open/);
  s.blindDraft = { ...(s.blindDraft || {}), revealedAt: new Date().toISOString() };
  assert.equal(CP.removeProblem(s), null);
});

test("Survival Pool: they join until its first result, and leave any time", () => {
  const s = league("pickem");
  assert.equal(CP.addProblem(s), null);
  CP.addBot(s, "normal");
  const ep = s.episodes.find((e) => e.number === 1);
  ep.noExit = true;
  assert.match(CP.addProblem(s), /under way/);
  assert.equal(CP.removeProblem(s), null);
});

test("a name for a seventh computer player when the names run out", () => {
  const s = league("pickem");
  for (const n of ["Max", "Ivy", "Rex", "Zoe", "Kit", "Gus", "Mia", "Lou"]) s.players.push({ id: n, name: n, color: "#000", active: true, disabled: false });
  assert.equal(CP.freeBotName(s), "Computer 1");
});
