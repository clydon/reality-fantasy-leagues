// The guided tour's scripted season (src/lib/tour/rise-and-fall.ts, docs/PLAN-guided-tour.md): it
// starts undrafted, the computer players draft instantly, Clive wins every week whoever has him, and
// Gus is in the bottom two every week he's still in. Plays it through, under the real rules, for the
// drafts and lineups that change what happens. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const T = jiti("../src/lib/tour/rise-and-fall.ts");
const S = require("../src/lib/game/state-logic.js");

const total = (s, id) => S.computeScores(s).find((r) => r.playerId === id).total;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const events = (s, n, type) => ep(s, n).scoringEvents.filter((e) => e.type === type).map((e) => e.castawayId);
const byName = (name) => (fa) => fa.find((c) => c.name === name) ?? fa[0];

// `choose` picks each of your three from what's still free; `start` picks two of your three to start.
function playThrough(choose, start = (mine) => mine.slice(0, 2)) {
  const s = T.buildTourState();
  assert.ok(S.isDraftStarted(s), "the draft is already open");
  assert.equal(S.currentDraftTurn(s).playerId, T.TOUR_ME, "you're on the clock first");
  while (!S.currentDraftTurn(s).isComplete) {
    S.draftToCurrentTurn(s, choose(S.freeAgents(s)).id);
    T.botsDraft(s);
  }
  T.afterDraft(s);
  const mine = s.castaways.filter((c) => c.ownerIds.includes(T.TOUR_ME)).map((c) => c.id);
  assert.equal(mine.length, 3);
  const starters = start(mine);
  assert.ok(S.setActiveRosterLineup(s, ep(s, 1).id, T.TOUR_ME, starters), "two starters is a valid lineup");

  T.scriptEpisode(s, 1);
  assert.deepEqual(events(s, 1, "wonWeek"), [T.TOUR_STAR], "Clive wins Episode 1");
  assert.ok(events(s, 1, "bottomTwo").includes(T.TOUR_FLOP), "Gus is in the bottom two");
  assert.equal(events(s, 1, "bottomTwo").length, 2);
  const out1 = s.castaways.filter((c) => c.status === "eliminated");
  assert.equal(out1.length, 1);
  assert.ok(starters.includes(out1[0].id), "one of your starters went home");

  const free = T.pickupName(s);
  assert.ok(free, "there's someone to pick up");
  T.startPickups(s);
  assert.equal(S.currentReplenishTurn(s).playerId, T.TOUR_ME, "only you are owed a pickup");
  S.replenishAssign(s, S.freeAgents(s).find((c) => c.status === "active").id);
  T.afterPickup(s);
  assert.equal(s.midSeason.replenish, null, "the round closes after your pickup");
  assert.equal(S.activeRosterLineupFor(s, ep(s, 2).id, T.TOUR_ME).length, 2, "the pickup starts in the open slot");

  const gusIn = S.getCastaway(s, T.TOUR_FLOP).status === "active";
  T.scriptEpisode(s, 2);
  assert.deepEqual(events(s, 2, "wonWeek"), [T.TOUR_STAR], "Clive wins Episode 2");
  if (gusIn) {
    assert.ok(events(s, 2, "bottomTwo").includes(T.TOUR_FLOP), "Gus is in the bottom two again");
    assert.equal(S.getCastaway(s, T.TOUR_FLOP).status, "eliminated", "and goes home");
  }
  assert.equal(S.getCastaway(s, T.TOUR_STAR).status, "active", "Clive never goes home");
  return { s, free, mine };
}

test("drafting the first baker each time: Ben gets Clive and finishes top", () => {
  const { s, free } = playThrough((fa) => fa[0]);
  assert.equal(free, "Ivy", "Ivy is the one left over");
  assert.deepEqual(T.starIn(s, 1), { owner: T.TOUR_BEN, started: true });
  assert.match(T.benLine(s), /Top of the table/);
});

test("drafting and starting Clive: he scores for you both weeks", () => {
  const { s } = playThrough(byName("Clive"), (mine) => [T.TOUR_STAR, mine.find((id) => id !== T.TOUR_STAR)]);
  assert.deepEqual(T.starIn(s, 1), { owner: T.TOUR_ME, started: true });
  assert.ok(total(s, T.TOUR_ME) >= 5, "+3 twice, less a bottom two");
});

test("drafting Clive but benching him: the bench lesson", () => {
  const { s } = playThrough(byName("Clive"), (mine) => mine.filter((id) => id !== T.TOUR_STAR));
  assert.deepEqual(T.starIn(s, 1), { owner: T.TOUR_ME, started: false });
  assert.ok(total(s, T.TOUR_ME) <= 2, "his Episode 1 win didn't count");
});

test("drafting and starting Gus: he's the one who goes home", () => {
  const { s } = playThrough(byName("Gus"), (mine) => [T.TOUR_FLOP, mine.find((id) => id !== T.TOUR_FLOP)]);
  assert.equal(S.getCastaway(s, T.TOUR_FLOP).exitEpisodeId, ep(s, 1).id);
});

test("drafting Ivy yourself: someone else is left over", () => {
  const { free } = playThrough(byName("Ivy"));
  assert.notEqual(free, "Ivy");
});

test("Rise & Fall scores two events, nothing for going home, and every baker has a headshot", () => {
  const s = T.buildTourState();
  const f = S.formatOf(s);
  assert.equal(f.id, "rise-and-fall");
  assert.deepEqual(f.events.map((e) => [e.id, e.defaultPoints]), [["wonWeek", 3], ["bottomTwo", -1]]);
  const fs = require("fs");
  for (const c of s.castaways) assert.ok(fs.existsSync(path.join(__dirname, "..", "public", c.photoUrl)), c.photoUrl);
});
