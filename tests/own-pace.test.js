// A game at your own pace (docs/PLAN-own-pace-games.md): a game on a season that's already aired, every seat a late joiner from
// the start (StateLogic.GhostLogic.paceAll), computer players catching up as people do (bot-logic.js catchUpTo: each week's pick
// on the copy a late joiner at that mark sees, never reading ahead), and the words that say where the others are
// (src/new/couch/pace.ts). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const S = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { othersLine, aheadWords, allHere } = jiti("../src/new/couch/pace.ts");

const { GhostLogic, PickEmLogic, SpoilerLogic } = S;
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [] };

/** A Survival Pool on a season of `n` castaways, played out: one goes home in each of Episodes 1..`eps` (C0 in 1, C1 in 2, ...),
 *  so every episode has results and the season's over. Seats `people`, plus a computer player when `bot`. */
function finished({ n = 10, eps = 8, people = ["ann", "bo"], bot = true } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "pickem");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", active: true, disabled: false }));
  if (bot) s.players.push({ id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true });
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, { preset: "survival-pool", span: { from: 3, to: null } }, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) {
    S.ensureEpisodeNumber(s, k, false);
    const ep = s.episodes.find((e) => e.number === k);
    S.addElimination(s, ep.id, s.castaways[k - 1].id, "Voted Out");
  }
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);

test("paceAll: every seat, the computer player too, starts catching up at the start, its mark the episode before", () => {
  const s = finished();
  assert.equal(GhostLogic.ownPace(s), false);
  assert.equal(GhostLogic.anyCatchingUp(s), false);
  GhostLogic.paceAll(s, 3);
  assert.equal(GhostLogic.ownPace(s), true);
  assert.equal(GhostLogic.anyCatchingUp(s), true);
  for (const id of ["ann", "bo", "bot"]) {
    assert.deepEqual(GhostLogic.lateJoinOf(s, id), { startEpisode: 3, catchingUp: true, seenThrough: 2 });
    assert.equal(S.getPlayer(s, id).ghost, undefined, "on the couch in the open");
  }
  // Ann's copy ends at her week: Episode 3, open, with no results past 2.
  const view = GhostLogic.viewFor(s, "ann", 2);
  assert.equal(view.episodes.length, 3);
  assert.equal(SpoilerLogic.latestWithResults(view), 2);
  assert.equal(S.gameOver(view), false, "not over for her");
});

test("a catching-up bot makes no live move; catchUpTo plays each week on its own copy, never reading ahead", () => {
  const s = finished();
  GhostLogic.paceAll(s, 3);
  assert.equal(Bots.run(s), 0, "nothing live to play");
  assert.equal(Bots.hasWork(s), false);
  // Ann reveals Episode 3: the bot picks for 3 first, from who was still in before it (C0, C1 went home in 1 and 2).
  assert.equal(Bots.catchUpTo(s, 3), 1);
  const pick3 = PickEmLogic.pickFor(s, ep(s, 3).id, "bot");
  assert.ok(pick3, "a pick for Episode 3");
  assert.ok(!["C0", "C1"].includes(S.getCastaway(s, pick3.castawayId).name), "from who was still in");
  assert.equal(GhostLogic.lateJoinOf(s, "bot").seenThrough, 3);
  assert.equal(Bots.catchUpTo(s, 3), 0, "a second call changes nothing");
  // Someone reveals 6: the bot plays 4, 5 and 6, each from who was still in before that week.
  assert.equal(Bots.catchUpTo(s, 6), 3);
  for (const k of [4, 5, 6]) {
    const p = PickEmLogic.pickFor(s, ep(s, k).id, "bot");
    assert.ok(p, `a pick for Episode ${k}`);
    const gone = s.castaways.slice(0, k - 1).map((c) => c.id);
    assert.ok(!gone.includes(p.castawayId), `Episode ${k}'s pick wasn't already out`);
  }
  assert.equal(GhostLogic.lateJoinOf(s, "bot").seenThrough, 6);
  assert.equal(GhostLogic.isCatchingUp(s, "bot"), true);
  // Someone behind reveals 4: the bot's already past it.
  assert.equal(Bots.catchUpTo(s, 4), 0);
  // The season's last episode: caught up, nothing more to play.
  Bots.catchUpTo(s, 8);
  assert.equal(GhostLogic.isCatchingUp(s, "bot"), false);
  assert.equal(GhostLogic.anyCatchingUp(s), true, "ann and bo still are");
});

test("the bot's pick stays out of a copy behind it until that week", () => {
  const s = finished();
  GhostLogic.paceAll(s, 3);
  Bots.catchUpTo(s, 5);
  // Bo, still on Episode 3: his copy holds the bot's pick for 3 (his week) and nothing of 4 or 5.
  const view = GhostLogic.viewFor(s, "bo", 2);
  assert.equal(view.episodes.length, 3);
  assert.ok(PickEmLogic.pickFor(view, ep(view, 3).id, "bot"));
});

test("the words: where the others are, all here, and the gap in the reveal button", () => {
  const others = [
    { name: "riley", week: 2 },
    { name: "casey", week: 4 },
    { name: "sam", week: null },
  ];
  assert.equal(othersLine(3, others), "casey · Ep 4 · riley · Ep 2 · sam finished");
  assert.equal(othersLine(3, []), null);
  assert.equal(allHere(3, [{ name: "riley", week: 3 }]), true);
  assert.equal(allHere(3, others), false);
  assert.equal(allHere(3, [{ name: "sam", week: null }]), false, "finished isn't here");
  // Revealing Episode 3 puts you on 3; riley's on 2 (her mark 1): two ahead. Casey's ahead of you, sam's done: no words for them.
  assert.equal(aheadWords(3, others), "you'll be 2 ahead of riley");
  // Riley's on 3 too (her mark 2): revealing 3 puts you one ahead, which says nothing; 4 is two ahead.
  assert.equal(aheadWords(3, [{ name: "riley", week: 3 }]), null);
  assert.equal(aheadWords(4, [{ name: "riley", week: 3 }]), "you'll be 2 ahead of riley");
  assert.equal(aheadWords(5, [{ name: "riley", week: 3 }]), "you'll be 3 ahead of riley");
  // Two at the same gap, named together; the furthest behind decides the number.
  assert.equal(aheadWords(6, [{ name: "riley", week: 3 }, { name: "casey", week: 3 }, { name: "jo", week: 5 }]), "you'll be 4 ahead of riley and casey");
});

// ---- part 3a: shared teams (Outlast, Weekly Lineup) ----

/** A Weekly Lineup (shared, blind: a team of 5, 3 start) played out over `eps` episodes, made own-pace from `from`, as
 *  start-game.ts makes it: teams shared, no waivers, then paceAll and the bots' teams. */
function finishedLineup({ n = 12, eps = 8, people = ["ann", "bo"], bot = true, from = 3, preset = "weekly-lineup" } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", preset === "outlast" ? "classic-draft" : "active-roster");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", active: true, disabled: false }));
  if (bot) s.players.push({ id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true });
  S.updateSettings(s, "setupComplete", true);
  const spec = { preset, span: { from, to: null }, get: { by: "draft", each: preset === "outlast" ? 3 : 5, order: "blind", own: "shared" } };
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) {
    S.ensureEpisodeNumber(s, k, false);
    S.addElimination(s, s.episodes.find((e) => e.number === k).id, s.castaways[k - 1].id, "Voted Out");
  }
  GhostLogic.paceAll(s, from);
  return s;
}
const ownedBy = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);

test("3a: no draft is asked for, and the bot picks its team from who was in before the start", () => {
  const s = finishedLineup();
  assert.equal(S.BlindDraftLogic.isRevealed(s), true, "the blind draft reads as done");
  assert.equal(GhostLogic.needsTeam(s, "ann"), true);
  assert.equal(GhostLogic.needsTeam(s, "bot"), true);
  assert.equal(Bots.paceTeams(s), 1);
  const mine = ownedBy(s, "bot");
  assert.equal(mine.length, 5);
  const goneBefore3 = new Set([s.castaways[0].id, s.castaways[1].id]);
  assert.ok(mine.every((id) => !goneBefore3.has(id)), "nobody who'd already gone");
  assert.equal(GhostLogic.needsTeam(s, "bot"), false);
  assert.equal(Bots.paceTeams(s), 0, "once");
});

test("3a: pickTeam takes who was in before your start, the right number, once; shared, so two can have the same person", () => {
  const s = finishedLineup();
  const ids = (k) => k.map((i) => s.castaways[i].id);
  assert.equal(GhostLogic.pickTeam(s, "ann", ids([0, 2, 3, 4, 5])), "Pick from who was still in the game", "C0 went home in Episode 1");
  assert.equal(GhostLogic.pickTeam(s, "ann", ids([2, 3, 4])), "Pick 5");
  assert.equal(GhostLogic.pickTeam(s, "ann", ids([2, 3, 4, 5, 6])), null);
  assert.equal(GhostLogic.pickTeam(s, "ann", ids([7, 8, 9, 10, 11])), "You have a team");
  assert.equal(GhostLogic.pickTeam(s, "bo", ids([2, 3, 4, 5, 6])), null, "the same five, shared");
  assert.deepEqual(GhostLogic.lateJoinOf(s, "ann"), { startEpisode: 3, catchingUp: true, seenThrough: 2 }, "the start left as it was");
});

test("3a: a catching-up bot sets its lineup for each week it plays, on its own copy", () => {
  const s = finishedLineup();
  Bots.paceTeams(s);
  Bots.catchUpTo(s, 4);
  for (const k of [3, 4]) {
    const ep = s.episodes.find((e) => e.number === k);
    const lineup = S.activeRosterLineupFor(s, ep.id, "bot");
    assert.equal(lineup.length, 3, `three start in Episode ${k}`);
    const gone = s.castaways.slice(0, k - 1).map((c) => c.id);
    assert.ok(lineup.every((id) => !gone.includes(id)), `nobody out before Episode ${k} starts`);
  }
});

test("3a: someone who started after your week holds nobody in your copy", () => {
  const s = finishedLineup({ preset: "outlast" });
  Bots.paceTeams(s);
  // A later joiner, from Episode 6, with a team from who was in then.
  const p = S.addPlayer(s, "cy");
  assert.equal(GhostLogic.begin(s, p.id, 6, s.castaways.slice(5, 8).map((c) => c.id)), null);
  GhostLogic.convert(s, p.id);
  const view = GhostLogic.viewFor(s, "ann", 2);
  assert.equal(view.castaways.filter((c) => (c.ownerIds || []).includes(p.id)).length, 0, "ann (on 3) doesn't see cy's team");
  assert.equal(view.castaways.filter((c) => (c.ownerIds || []).includes("bot")).length, 3, "the bot started with ann: its team shows");
});

// ---- exclusive teams: two sync points (docs/PLAN-own-pace-games.md) ----

const G2 = require("../src/lib/game/game-spec/index.js");
const Waivers = require("../src/lib/server/waivers.js");

/** An exclusive Outlast (snake, 2 each) made own-pace from `from` on a played-out season, waivers on when `waivers`. */
function exclusiveOutlast({ from = 3, waivers = false, n = 12, eps = 8 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", "classic-draft");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = [
    { id: "ann", name: "ann", color: "#000", active: true, disabled: false },
    { id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true },
  ];
  S.updateSettings(s, "setupComplete", true);
  const spec = { preset: "outlast", span: { from, to: null }, get: { by: "draft", each: 2, order: "snake", own: "exclusive" } };
  if (waivers) spec.extras = { waivers: { ...G2.NO_WAIVERS, replace: "always" } };
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) {
    S.ensureEpisodeNumber(s, k, false);
    S.addElimination(s, s.episodes.find((e) => e.number === k).id, s.castaways[k - 1].id, "Voted Out");
  }
  GhostLogic.paceAll(s, from);
  return s;
}

test("sync point 1: exclusive teams draft together, the bot drafting from the cast as it stood before the start", () => {
  const s = exclusiveOutlast();
  assert.equal(GhostLogic.draftsTogether(s), true);
  assert.equal(GhostLogic.needsTeam(s, "ann"), false, "no team of your own to pick: it's the draft's");
  assert.equal(GhostLogic.pickTeam(s, "ann", []), "Teams here come from the draft");
  assert.equal(GhostLogic.draftDone(s), false);
  s.draftOrder = ["bot", "ann"];
  s.draftForceStarted = true;
  assert.equal(Bots.run(s), 1, "the bot's first pick");
  const first = ownedBy(s, "bot")[0];
  assert.ok(first, "it picked someone");
  assert.ok(![s.castaways[0].id, s.castaways[1].id].includes(first), "not anyone who'd gone before Episode 3");
  const free = () => s.castaways.slice(2).find((c) => !(c.ownerIds || []).length).id;
  S.draftToCurrentTurn(s, free());
  S.draftToCurrentTurn(s, free());
  Bots.run(s);
  assert.equal(GhostLogic.draftDone(s), true, "two each, done");
  assert.equal(ownedBy(s, "ann").length, 2);
  assert.equal(ownedBy(s, "bot").length, 2);
});

test("sync point 2: a waiver moment opens a week on the cast as it stood then, only once everyone's there, and settles", async () => {
  const s = exclusiveOutlast({ waivers: true });
  s.draftOrder = ["ann", "bot"];
  s.draftForceStarted = true;
  // ann takes C3 (goes home in Episode 4) and someone still free who lasts (C8 on: past the episodes played here); the bot its two.
  S.draftToCurrentTurn(s, s.castaways[3].id);
  Bots.run(s);
  S.draftToCurrentTurn(s, s.castaways.slice(8).find((c) => !(c.ownerIds || []).length).id);
  Bots.run(s);
  assert.equal(GhostLogic.draftDone(s), true);
  const client = { query: async () => ({ rows: [] }) };
  // Nobody's past Episode 2 yet: nothing to open.
  assert.deepEqual(await Waivers.syncWaivers(client, "L", s, Date.now()), []);
  // ann reveals 3 and 4 (C3 goes home in 4): ann's there, so the week opens at 4 (the bot keeps pace).
  GhostLogic.lateJoinOf(s, "ann").seenThrough = 4;
  Bots.catchUpTo(s, 4);
  const ev = await Waivers.syncWaivers(client, "L", s, Date.now());
  assert.deepEqual(ev.map((e) => [e.type, e.episode]), [["opened", 4]]);
  const week = S.WaiverLogic.current(s);
  assert.equal(week.episode, 4, "the week is Episode 4's, not the season's end");
  assert.equal(S.WaiverLogic.replacementsOwed(Waivers.pacedCopy(s), "ann", week).count, 1, "ann owes one, on the cast at 4");
  // Its time runs out (no claim): it settles.
  const later = Date.now() + 48 * 3600 * 1000;
  const ev2 = await Waivers.syncWaivers(client, "L", s, later);
  assert.ok(ev2.some((e) => e.type === "processed" && e.episode === 4), JSON.stringify(ev2));
  // Everyone moves on past it: the week closes, ann's empty spot filled from who was still in.
  GhostLogic.lateJoinOf(s, "ann").seenThrough = 5;
  Bots.catchUpTo(s, 5);
  const ev3 = await Waivers.syncWaivers(client, "L", s, later + 60 * 1000);
  assert.ok(ev3.some((e) => e.type === "closed" && e.episode === 4), JSON.stringify(ev3));
  const mine = ownedBy(s, "ann");
  assert.equal(mine.length, 2, "two again");
  const goneBy5 = s.castaways.slice(0, 5).map((c) => c.id);
  assert.ok(mine.every((id) => !goneBy5.includes(id)), "the replacement was still in");
});

// ---- One person at their own pace on a live game (the user, 2026-11-09): Backstage's "Plays at their own pace" ----

const HOUR = 3600 * 1000;
const NOW = Date.parse("2026-11-12T03:00:00Z");
const at = (h) => new Date(NOW + h * HOUR).toISOString();

/** A live Weekly Lineup (shared teams, three start), ann and bo each holding C2..C7 and a computer player: Episodes 1 and 2 played,
 *  Episode 3 aired two hours ago (`results3`: someone went home and C2 scored in it), Episode 4 airs in a week. */
function liveLineup({ results3 = false, preset = "weekly-lineup" } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", preset === "survival-pool" ? "pickem" : "active-roster");
  for (let i = 0; i < 10; i++) S.addCastaway(s, `C${i}`);
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000", active: true, disabled: false }));
  s.players.push({ id: "bot", name: "Bot", color: "#00f", active: true, disabled: false, automated: true });
  S.updateSettings(s, "setupComplete", true);
  const spec = preset === "survival-pool" ? { preset } : { preset, get: { by: "draft", each: 6, order: "blind", own: "shared" } };
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  if (preset !== "survival-pool") for (const c of s.castaways.slice(2, 8)) c.ownerIds = ["ann", "bo"];
  s.draftPicksMade = 6;
  for (let k = 1; k <= 4; k++) {
    S.ensureEpisodeNumber(s, k, false);
    ep(s, k).airsAt = at(k === 4 ? 24 * 7 - 2 : -2 - 24 * 7 * (3 - k));
  }
  for (const k of [1, 2]) S.addElimination(s, ep(s, k).id, s.castaways[k - 1].id, "Voted Out");
  if (results3) {
    S.addElimination(s, ep(s, 3).id, s.castaways[8].id, "Voted Out");
    if (preset !== "survival-pool") S.addScoringEvent(s, ep(s, 3).id, "individualImmunity", s.castaways[2].id);
  }
  return s;
}
const ids = (s, k) => k.map((i) => s.castaways[i].id);

test("live at your own pace: off by default; on, the aired episode stays open until they've watched it or the next airs", () => {
  const s = liveLineup();
  assert.equal(GhostLogic.playsOwnPace(s, "ann"), false);
  assert.equal(GhostLogic.lateWindow(s, "ann", 2, NOW), null, "off: nothing open late");
  assert.equal(GhostLogic.setPlaysOwnPace(s, "ann", true), null);
  assert.equal(GhostLogic.setPlaysOwnPace(s, "bot", true), "Computer players keep up by themselves");
  assert.equal(GhostLogic.playsOwnPace(s, "ann"), true);
  assert.deepEqual(GhostLogic.lateWindow(s, "ann", 2, NOW), { episode: 3, epId: ep(s, 3).id, until: ep(s, 4).airsAt });
  assert.equal(GhostLogic.lateWindow(s, "ann", 3, NOW), null, "watched it: closed");
  assert.equal(GhostLogic.lateWindow(s, "ann", Number.POSITIVE_INFINITY, NOW), null, "sees results as they come: never behind");
  assert.equal(GhostLogic.lateWindow(s, "ann", 2, Date.parse(ep(s, 4).airsAt) + 1000)?.episode, 4, "the next one aired: 3 closed, 4 is the one open");
  assert.equal(GhostLogic.lateWindow(s, "ann", 2, Date.parse(ep(s, 3).airsAt) - 1000), null, "before airtime it's an ordinary move");
  assert.equal(GhostLogic.lateWindow(s, "bo", 2, NOW), null, "only the seat that's switched on");
  assert.equal(GhostLogic.setPlaysOwnPace(s, "ann", false), null);
  assert.equal(GhostLogic.lateWindow(s, "ann", 2, NOW), null, "switched off again");
});

test("live at your own pace: a late lineup runs on the copy where the episode's open, is marked, and scores as if on time", () => {
  const s = liveLineup({ results3: true });
  GhostLogic.setPlaysOwnPace(s, "ann", true);
  const e3 = ep(s, 3);
  assert.ok(S.ActiveRosterLogic.validateLineup(s, e3.id, "ann", ids(s, [2, 3, 4])), "locked for everyone the ordinary way");
  const set = (v) => S.ActiveRosterLogic.validateLineup(v, e3.id, "ann", ids(s, [2, 3, 4])) ?? (S.setActiveRosterLineup(v, e3.id, "ann", ids(s, [2, 3, 4])), null);
  assert.equal(GhostLogic.applyAs(s, "ann", 2, e3.id, set, { late: true }), null);
  assert.deepEqual(S.activeRosterLineupFor(s, e3.id, "ann"), ids(s, [2, 3, 4]));
  assert.deepEqual(e3.lateSet, { ann: true }, "the couch's quiet marker");
  assert.equal(S.ActiveRosterLogic.episodeScore(s, e3, "ann").total > 0, true, "C2's immunity counts, as if set at airtime");
  // Nobody outside the roster, as at airtime; the episode before is closed.
  const bad = (v) => S.ActiveRosterLogic.validateLineup(v, e3.id, "ann", ids(s, [2, 3, 9]));
  assert.match(GhostLogic.applyAs(s, "ann", 2, e3.id, bad, { late: true }), /isn't on your roster/);
  assert.equal(GhostLogic.applyAs(s, "ann", 2, ep(s, 2).id, set, { late: true }), "Only this week’s episode is open");
  assert.equal(GhostLogic.movedFor(s, "bo", e3.id), false, "bo's untouched");
});

test("live at your own pace: a late pick in a Survival Pool, from who was in at airtime, counted as made on time", () => {
  const s = liveLineup({ results3: true, preset: "survival-pool" });
  GhostLogic.setPlaysOwnPace(s, "ann", true);
  const e3 = ep(s, 3);
  const c8 = s.castaways[8].id;
  S.setPickEmPick(s, e3.id, "ann", c8);
  assert.ok(!PickEmLogic.pickFor(s, e3.id, "ann"), "closed the ordinary way");
  assert.equal(GhostLogic.applyAs(s, "ann", 2, e3.id, (v) => S.setPickEmPick(v, e3.id, "ann", c8), { late: true }), null);
  assert.equal(PickEmLogic.pickFor(s, e3.id, "ann").castawayId, c8, "C8 was still in at airtime");
  assert.equal(e3.lateSet.ann, true);
  assert.equal(S.pickEmHistory(s, "ann").rows.find((r) => r.episode === 3)?.correct, false, "and went home in it: scored as it fell");
});

test("live at your own pace: the couch waits on them until it's set; a carried lineup doesn't count as set", () => {
  const s = liveLineup();
  GhostLogic.setPlaysOwnPace(s, "ann", true);
  S.setActiveRosterLineup(s, ep(s, 2).id, "ann", ids(s, [2, 3, 4]));
  const marks = new Map([["ann", 2]]);
  assert.deepEqual(GhostLogic.lateWaiting(s, marks, NOW), [{ playerId: "ann", episode: 3 }], "her Episode 2 lineup carries, but she hasn't set 3");
  assert.deepEqual(GhostLogic.lateWaiting(s, new Map([["ann", 3]]), NOW), [], "watched it: nobody waits");
  GhostLogic.applyAs(s, "ann", 2, ep(s, 3).id, (v) => S.setActiveRosterLineup(v, ep(s, 3).id, "ann", ids(s, [5, 6, 7])), { late: true });
  assert.deepEqual(GhostLogic.lateWaiting(s, marks, NOW), []);
});

test("live at your own pace: the game view opens the aired episode in your copy, says why it's due, and the couch waits", () => {
  const { gameView } = jiti("../src/lib/game/game-view.ts");
  const { yourMove } = jiti("../src/new/show/your-move.ts");
  const s = liveLineup({ results3: true });
  GhostLogic.setPlaysOwnPace(s, "ann", true);
  S.setActiveRosterLineup(s, ep(s, 2).id, "ann", ids(s, [2, 3, 4]));
  const ref = { leagueId: "L", name: "Lineup", gameType: "active-roster", gameName: "Weekly Lineup", yourRole: "member" };
  const own = { marks: new Map([["ann", 2]]), now: NOW };
  const g = gameView(ref, s, "ann", 2, () => null, undefined, own);
  assert.deepEqual(g.late, { episode: 3, until: ep(s, 4).airsAt });
  assert.equal(g.revealFirst, null, "Episode 3's results don't stand in the way of its own lineup");
  assert.equal(g.lineup.episode, 3);
  assert.equal(g.lineup.locked, false, "open in her copy");
  const move = yourMove(g, { seasonId: "S", episode: "Episode", when: (iso) => iso });
  assert.equal(move.due, true, "carried in from Episode 2, so still the yellow");
  assert.equal(move.title, "Set your Episode 3 lineup");
  assert.equal(move.line, "Episode 3 aired · you haven't watched it · set your lineup first");
  // Bo, live, sees Episode 3 with its results (he's watched it), and the couch waiting on ann.
  const bo = gameView(ref, s, "bo", 3, () => null, undefined, own);
  assert.equal(bo.late, null);
  assert.deepEqual(bo.waiting, [{ playerId: "ann", name: "ann", episode: 3 }]);
  // Without the switch, ann's Episode 3 is locked like anyone's, and she's told to reveal it.
  GhostLogic.setPlaysOwnPace(s, "ann", false);
  const off = gameView(ref, s, "ann", 2, () => null, undefined, own);
  assert.equal(off.late, null);
  assert.equal(off.revealFirst, 3);
  // Set late: no longer due, the square marked, the couch no longer waiting.
  GhostLogic.setPlaysOwnPace(s, "ann", true);
  GhostLogic.applyAs(s, "ann", 2, ep(s, 3).id, (v) => S.setActiveRosterLineup(v, ep(s, 3).id, "ann", ids(s, [2, 3, 5])), { late: true });
  const after = gameView(ref, s, "ann", 2, () => null, undefined, own);
  assert.equal(yourMove(after, { seasonId: "S", episode: "Episode", when: (iso) => iso }).line, "Change until you watch it");
  const seen = gameView(ref, s, "bo", 3, () => null, undefined, own);
  assert.deepEqual(seen.waiting, []);
  assert.equal(seen.plays.rows.ann.find((q) => q.episode === 3)?.late, true, "the quiet marker on her square");
  assert.equal(seen.plays.rows.bo.find((q) => q.episode === 3)?.late, undefined);
});
