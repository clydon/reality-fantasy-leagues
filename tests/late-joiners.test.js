// Late joiners (GhostLogic, docs/PLAN-late-joiners.md): someone joining an underway league plays the
// season from an episode of their choosing, one episode at a time, unseen by the rest of the league.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");
const { GhostLogic } = StateLogic;

// Active Roster, two players, three episodes with results: E goes in episode 1, D in 2, C in 3.
// Every castaway earns one immunity in every episode.
function makeState() {
  const cast = ["a", "b", "c", "d", "e", "f"];
  const out = { e: 1, d: 2, c: 3 };
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", activeSlots: 1, benchSlots: 1, showFormat: "survivor", startEpisode: 1 },
    players: [
      { id: "p1", name: "Ann", color: "#111" },
      { id: "p2", name: "Bo", color: "#222" },
    ],
    draftOrder: ["p1", "p2"],
    draftPicksMade: 4,
    castaways: cast.map((id) => ({
      id,
      name: id.toUpperCase(),
      ownerIds: ["a", "b"].includes(id) ? ["p1"] : ["c", "d"].includes(id) ? ["p2"] : [],
      status: out[id] ? "eliminated" : "active",
      exitEpisodeId: out[id] ? `ep${out[id]}` : null,
      exitMethod: out[id] ? "Voted Out" : null,
      placementOrder: out[id] ? out[id] : null,
    })),
    episodes: [1, 2, 3, 4].map((n) => ({
      id: `ep${n}`,
      number: n,
      title: `Title ${n}`,
      airsAt: "2026-01-0" + n + "T01:00:00Z",
      events: Object.entries(out).filter(([, e]) => e === n).map(([c]) => ({ castawayId: c, method: "Voted Out" })),
      lineups: n <= 3 ? { p1: ["a"], p2: ["c"] } : {},
      scoringEvents: n <= 3 ? cast.map((cid) => ({ id: `s${n}${cid}`, type: "individualImmunity", castawayId: cid })) : [],
    })),
  });
}

function joinGhost(s) {
  const p = StateLogic.addPlayer(s, "Cy");
  return p.id;
}

test("joining an underway league makes a ghost who still has to choose a start", () => {
  const s = makeState();
  const id = joinGhost(s);
  const p = StateLogic.getPlayer(s, id);
  assert.equal(p.ghost, true);
  assert.equal(GhostLogic.needsStart(s, id), true);
  assert.ok(!s.draftOrder.includes(id));
});

test("a commissioner can switch late joining off: the old inactive seat", () => {
  const s = makeState();
  StateLogic.updateSettings(s, "allowLateJoiners", false);
  const p = StateLogic.getPlayer(s, joinGhost(s));
  assert.ok(!p.ghost);
  assert.equal(p.active, false);
});

test("the draft pool is the cast as it stood before the start episode, owned or not", () => {
  const s = makeState();
  assert.deepEqual(GhostLogic.draftPool(s, 2).sort(), ["a", "b", "c", "d", "f"]);
  assert.deepEqual(GhostLogic.draftPool(s, 1).sort(), ["a", "b", "c", "d", "e", "f"]);
});

test("begin refuses someone already gone, takes owned castaways without taking them from anyone", () => {
  const s = makeState();
  const id = joinGhost(s);
  assert.match(GhostLogic.begin(s, id, 2, ["e", "a"]), /still in the game/);
  assert.equal(GhostLogic.begin(s, id, 2, ["a", "f"]), null);
  assert.deepEqual(StateLogic.getCastaway(s, "a").ownerIds.sort(), ["p1", id].sort());
  // Still not a free agent, and not one for the league either way: f is free for the league.
  assert.ok(StateLogic.RosterLogic.freeAgents(s).some((c) => c.id === "f"));
  assert.equal(GhostLogic.isCatchingUp(s, id), true);
});

test("the league's own exclusive moves keep a ghost's private ownership", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  StateLogic.Core.setOwner(s, "f", "p2");
  assert.deepEqual(StateLogic.getCastaway(s, "f").ownerIds.sort(), ["p2", id].sort());
});

test("everyone else's view leaves the ghost out entirely", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  const v = GhostLogic.viewFor(s, "p1", null);
  assert.ok(!v.players.some((p) => p.id === id));
  assert.ok(!v.castaways.some((c) => c.ownerIds.includes(id)));
  assert.ok(!StateLogic.computeScores(v).some((r) => r.playerId === id));
  // ...and the real state is untouched.
  assert.ok(s.players.some((p) => p.id === id));
});

test("a catching-up ghost's view ends at their week, which plays as if it airs tonight", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  const v = GhostLogic.viewFor(s, id, 1);
  assert.deepEqual(v.episodes.map((e) => e.number), [1, 2]);
  const ep2 = v.episodes.find((e) => e.number === 2);
  assert.equal(ep2.airsAt, undefined);
  assert.equal(ep2.title, null);
  assert.equal(StateLogic.ActiveRosterLogic.isLineupLocked(v, "ep2"), false);
  // D (out in episode 2) and C (out in 3) are still in the game for them.
  assert.equal(StateLogic.getCastaway(v, "d").status, "active");
  assert.equal(StateLogic.getCastaway(v, "c").status, "active");
  // They see themselves and the league's players.
  assert.deepEqual(v.players.map((p) => p.id).sort(), ["p1", "p2", id].sort());
});

test("a ghost's lineup for their week lands on the real episode; any other week is refused", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  const err = GhostLogic.applyAs(s, id, 1, "ep2", (v) => StateLogic.setActiveRosterLineup(v, "ep2", id, ["f"]));
  assert.equal(err, null);
  assert.deepEqual(s.episodes.find((e) => e.id === "ep2").lineups[id], ["f"]);
  assert.match(GhostLogic.applyAs(s, id, 1, "ep3", () => {}), /ahead of you/);
  assert.match(GhostLogic.applyAs(s, id, 2, "ep2", () => {}), /this week/);
});

test("a ghost scores only from their own start", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  GhostLogic.applyAs(s, id, 1, "ep2", (v) => StateLogic.setActiveRosterLineup(v, "ep2", id, ["f"]));
  const per = StateLogic.ActiveRosterLogic.pointsFor(s, "individualImmunity");
  // Episode 2 fielded F, carried into 3: two episodes' worth.
  assert.equal(StateLogic.computeScores(s).find((r) => r.playerId === id).total, 2 * per);
});

test("reaching the latest results ends catching up; converting brings them into the league", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "f"]);
  GhostLogic.markCaughtUp(s, id, 2);
  assert.equal(GhostLogic.isCatchingUp(s, id), true);
  GhostLogic.markCaughtUp(s, id, 3);
  assert.equal(GhostLogic.isCatchingUp(s, id), false);
  assert.equal(GhostLogic.convert(s, id), true);
  assert.ok(GhostLogic.viewFor(s, "p1", null).players.some((p) => p.id === id));
  assert.ok(s.draftOrder.includes(id));
});

test("pickups made after the ghost's mark are undone in their view", () => {
  const s = makeState();
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, ["a", "b"]);
  // After episode 2, Bo dropped D (out) and picked up F.
  StateLogic.Core.setOwner(s, "d", null);
  StateLogic.Core.setOwner(s, "f", "p2");
  s.midSeason.log.push({ id: "tx1", type: "replenish", playerId: "p2", addedCastawayId: "f", droppedCastawayId: "d", at: "", episode: 2 });
  const v = GhostLogic.viewFor(s, id, 1);
  assert.deepEqual(StateLogic.getCastaway(v, "f").ownerIds, []);
  assert.deepEqual(StateLogic.getCastaway(v, "d").ownerIds, ["p2"]);
  assert.equal(v.midSeason.log.length, 0);
});

// ---------- Classic and Eliminator Pool ----------
// The same season (E out in 1, D in 2, C in 3, episode 4 still to come), as the other league types.

function asType(leagueTypeId, extra) {
  const s = makeState();
  s.settings.leagueTypeId = leagueTypeId;
  Object.assign(s.settings, extra || {});
  s.episodes.forEach((ep) => {
    ep.lineups = {};
    ep.scoringEvents = [];
  });
  return s;
}

test("Classic: a late joiner drafts a full team from who was left, and scores their placements", () => {
  const s = asType("classic-draft", { teamSize: 2 });
  const id = joinGhost(s);
  assert.equal(GhostLogic.isGhost(StateLogic.getPlayer(s, id)), true);
  assert.equal(GhostLogic.teamSize(s), 2);
  // Starting at 3: E and D are gone; C (out in 3) is still in the pool, as is A, whom Ann owns.
  assert.deepEqual(GhostLogic.draftPool(s, 3).sort(), ["a", "b", "c", "f"]);
  assert.match(GhostLogic.begin(s, id, 3, ["a"]), /Pick 2/);
  assert.equal(GhostLogic.begin(s, id, 3, ["a", "c"]), null);
  assert.deepEqual(StateLogic.getCastaway(s, "a").ownerIds.sort(), ["p1", id].sort(), "A stays Ann's too");
  // Classic counts live: C went third and keeps 3; A, still in after three exits, has 4 so far.
  const row = StateLogic.computeScores(s).find((r) => r.playerId === id);
  assert.equal(row.locked, 7);
  assert.equal(row.banked, 3);
  // The league's own Classic moves still see A and C as Ann's and Bo's, not free.
  assert.ok(!StateLogic.freeAgents(s).some((c) => c.id === "a"));
  // Their copy ends at their week, and the rest of the league can't see them.
  const v = GhostLogic.viewFor(s, id, 2);
  assert.deepEqual(v.episodes.map((e) => e.number), [1, 2, 3]);
  assert.equal(StateLogic.getCastaway(v, "c").status, "active", "C is still in, as far as they know");
  assert.ok(!GhostLogic.viewFor(s, "p1", null).players.some((p) => p.id === id));
});

test("Eliminator Pool: no draft, and a pick for their week lands on the real episode", () => {
  const s = asType("pickem");
  const id = joinGhost(s);
  assert.equal(GhostLogic.teamSize(s), 0);
  assert.equal(GhostLogic.begin(s, id, 2, []), null, "nothing to draft");
  // Week 2 as they see it: D (out in 2) and C (out in 3) are still in the game.
  const err = GhostLogic.applyAs(s, id, 1, "ep2", (v) => {
    const { available } = StateLogic.PickEmLogic.eligibility(v, "ep2", id);
    assert.deepEqual(available.sort(), ["a", "b", "c", "d", "f"]);
    StateLogic.setPickEmPick(v, "ep2", id, "d");
  });
  assert.equal(err, null);
  assert.deepEqual(StateLogic.PickEmLogic.pickFor(s, "ep2", id), { playerId: id, castawayId: "d" });
  assert.match(GhostLogic.applyAs(s, id, 1, "ep3", () => {}), /ahead of you/);
});

test("Eliminator Pool: the pick rules follow their own picks, and their season starts at their episode", () => {
  const s = asType("pickem");
  const id = joinGhost(s);
  GhostLogic.begin(s, id, 2, []);
  GhostLogic.applyAs(s, id, 1, "ep2", (v) => StateLogic.setPickEmPick(v, "ep2", id, "a"));
  // Revealed 2; now on 3. A was their last pick, so it's blocked; D went home in 2.
  GhostLogic.applyAs(s, id, 2, "ep3", (v) => {
    const { available, blocked } = StateLogic.PickEmLogic.eligibility(v, "ep3", id);
    assert.deepEqual(available.sort(), ["b", "c", "f"]);
    assert.equal(blocked.a.reason, "backToBack");
  });
  GhostLogic.applyAs(s, id, 2, "ep3", (v) => StateLogic.setPickEmPick(v, "ep3", id, "b"));
  // Episode 1 was before they joined: history starts at 2, so it isn't a missed pick.
  const { rows, currentStreak } = StateLogic.PickEmLogic.history(s, id);
  assert.deepEqual(rows.map((r) => r.episode), [2, 3]);
  assert.ok(rows.every((r) => r.correct === true), "A and B both survived their episodes");
  assert.equal(currentStreak, 2, "a streak of two, not broken by an episode before they joined");
});
