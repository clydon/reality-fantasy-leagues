// The late joiners' leftovers (docs/PLAN-start-a-game-gpt.md step A11 part 5c): nobody new once someone's out, in every game that
// knocks people out (a pool's lives, a game of questions' walk as it stands, a draft's cuts as before); someone catching up in a
// pool with lives, whose episodes past their own week are no missed picks in anyone's copy; a late joiner after a draw, dealt from
// the hat; a late joiner's team under a price (a salary cap holds it, a stock market's cash pays for it) and castaways whoever runs
// the game gives a seat after the draft (activatePlayer) paid for too; a late joiner's captain and second pick, through
// GhostLogic.applyAs; and computer players filling their group slots. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const T = require("../src/lib/game/formats/format-timeline.js");
const Bots = require("../src/lib/game/bot-logic.js");

const { GhostLogic, PickEmLogic, DrawLogic, MarketLogic } = S;
const A = S.AnswerLogic;
const CTX = {
  moments: [
    { id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" },
    { id: "idolFound", label: "Found an idol", defaultPoints: 2, answeredBy: "research" },
  ],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};

/** A league of `n` castaways C0.. and seats `people`, its game `spec` through setGame, Episodes 1 to `eps` made, none with results;
 *  `type` its league type before the spec (a pool's). */
function league(spec, { n = 10, people = ["ann", "bo"], eps = 8, type = null } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  if (type) S.updateSettings(s, "leagueTypeId", type);
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const cid = (s, i) => s.castaways[i].id;
const gone = (s, k, ...out) => out.forEach((i) => S.addElimination(s, ep(s, k).id, cid(s, i), "Voted Out"));
const pick = (s, k, who, i, opts) => S.setPickEmPick(s, ep(s, k).id, who, cid(s, i), opts);
/** A late joiner on `s` (a ghost: the league is underway), started at `start` with `team` (castaway indexes), made visible. */
function joiner(s, start, team = [], opts) {
  const p = S.addPlayer(s, "cy");
  assert.ok(p.lateJoin && p.ghost, "a late joiner");
  assert.equal(GhostLogic.begin(s, p.id, start, team.map((i) => cid(s, i)), opts), null);
  GhostLogic.lateJoinOf(s, p.id).seenThrough = start - 1;
  return p.id;
}

test("nobody new once someone's out: a pool's lives and a game of questions' walk, as a draft's cuts", () => {
  // A pool with a life each: ann picks someone who goes home in Episode 1 and is out for good.
  const s = league({ preset: "survival-pool", score: { by: "survive", lives: 1 } }, { type: "pickem" });
  pick(s, 1, "ann", 0);
  pick(s, 1, "bo", 1);
  assert.equal(GhostLogic.someoneOut(s), false, "nothing decided yet");
  assert.equal(GhostLogic.allowed(s), true);
  gone(s, 1, 0);
  assert.equal(PickEmLogic.history(s, "ann").out, 1);
  assert.equal(GhostLogic.someoneOut(s), true);
  assert.equal(GhostLogic.allowed(s), false);
  assert.equal(GhostLogic.joinMode(s), "locked");
  // Someone joining now gets no late joiner's season (as a draft's cuts do: A11 part 1), and their seat waits, inactive, never
  // playing from the start (every episode before would be a missed pick, out at once); a computer player still plays.
  const c = structuredClone(s);
  const di = S.addPlayer(c, "di");
  assert.equal(di.lateJoin, undefined);
  assert.equal(di.active, false);
  assert.equal(S.addPlayer(c, "bot", { automated: true }).active, true);
  // A buyback takes them back in: nobody's out, so joining opens again.
  const back = league({ preset: "survival-pool", score: { by: "survive", lives: 1, buyback: { times: 1 } } }, { type: "pickem" });
  pick(back, 1, "ann", 0);
  gone(back, 1, 0);
  assert.equal(PickEmLogic.history(back, "ann").out, null);
  assert.equal(GhostLogic.allowed(back), true);
  // A pool without lives knocks nobody out; a seat that left, or a late joiner's private season, out doesn't count.
  const plain = league({ preset: "survival-pool" }, { type: "pickem" });
  pick(plain, 1, "ann", 0);
  gone(plain, 1, 0);
  assert.equal(GhostLogic.allowed(plain), true);
  s.players.find((x) => x.id === "ann").disabled = true;
  assert.equal(GhostLogic.someoneOut(s), false, "a seat that left");
  s.players.find((x) => x.id === "ann").disabled = false;
  s.players.find((x) => x.id === "ann").ghost = true;
  assert.equal(GhostLogic.someoneOut(s), false, "a late joiner's private season");

  // A game of questions with a life each: out only in the walk the state carries (the server's copy as it stands: asItStands).
  const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const q = league({ get: { by: "none" }, score: { by: "answers", lives: 1 }, rank: { by: "standing" }, ask: [BOOT] }, { type: "questions", people: ["ann", "bo", "cy"] });
  gone(q, 1, 0);
  const rows = [
    { playerId: "ann", question: "boot", episode: 1, answer: cid(q, 0) },
    { playerId: "bo", question: "boot", episode: 1, answer: cid(q, 0) },
    { playerId: "cy", question: "boot", episode: 1, answer: cid(q, 3) },
  ];
  const walk = A.walk(q, rows, A.facts(q));
  assert.deepEqual(walk.out, { cy: 1 });
  assert.equal(GhostLogic.allowed(q), true, "read without its walk: nobody out (the safe fallback a reader not taught yet gets)");
  const v = A.withWalk(q, walk);
  assert.equal(GhostLogic.someoneOut(v), true);
  assert.equal(GhostLogic.joinMode(v), "locked");
  // Joining by its code: the server reads it as it stands and says so (addPlayer's someoneOut); the seat waits. Read raw, a late joiner.
  assert.equal(S.addPlayer(structuredClone(q), "di", { someoneOut: true }).active, false);
  assert.ok(S.addPlayer(structuredClone(q), "di").lateJoin);
});

test("someone catching up in a pool with lives: past their own week nothing counts for them, in anyone's copy", () => {
  const s = league({ preset: "survival-pool", score: { by: "survive", lives: 1 } }, { type: "pickem" });
  // Never the same pick twice running (the pool's own rule): ann C9, C7, C5; bo C8, C6, C4; C0, C1 and C2 go home.
  for (const k of [1, 2, 3]) {
    pick(s, k, "ann", 11 - 2 * k);
    pick(s, k, "bo", 10 - 2 * k);
    gone(s, k, k - 1);
  }
  assert.equal(GhostLogic.someoneOut(s), false);
  const cy = joiner(s, 1);
  GhostLogic.convert(s, cy);
  assert.equal(GhostLogic.isCatchingUp(s, cy), true);
  // Their week is Episode 1: no pick in it yet, and Episodes 2 and 3 aren't theirs yet: no missed pick, no life lost, not out.
  let h = PickEmLogic.history(s, cy);
  assert.deepEqual(h.rows, []);
  assert.equal(h.out, null);
  assert.equal(h.lives, 1);
  assert.equal(GhostLogic.someoneOut(s), false);
  assert.ok(S.computeScores(s).some((r) => r.playerId === cy), "on the table, still in");
  // Their pick for their week, as they see it (applyAs), and counted once it's decided (it is, for everyone else).
  assert.equal(GhostLogic.applyAs(s, cy, 0, ep(s, 1).id, (vw) => S.setPickEmPick(vw, ep(s, 1).id, cy, cid(s, 5))), null);
  h = PickEmLogic.history(s, cy);
  assert.deepEqual(h.rows.map((r) => [r.episode, r.correct]), [[1, true]]);
  // Revealed 1: their week is 2, not picked yet: still nothing more.
  GhostLogic.lateJoinOf(s, cy).seenThrough = 1;
  assert.deepEqual(PickEmLogic.history(s, cy).rows.map((r) => r.episode), [1]);
  // Their pick for 2 counts; should the mark on the state lag behind it, the pick still does (only a miss waits for the mark).
  assert.equal(GhostLogic.applyAs(s, cy, 1, ep(s, 2).id, (vw) => S.setPickEmPick(vw, ep(s, 2).id, cy, cid(s, 6))), null);
  GhostLogic.lateJoinOf(s, cy).seenThrough = 0;
  assert.deepEqual(PickEmLogic.history(s, cy).rows.map((r) => [r.episode, r.correct]), [[1, true], [2, true]]);
  S.removePickEmPick(s, ep(s, 2).id, cy);
  GhostLogic.lateJoinOf(s, cy).seenThrough = 1;
  // Caught up: a missed episode is a miss again (they've had it).
  GhostLogic.markCaughtUp(s, cy, 3);
  GhostLogic.lateJoinOf(s, cy).seenThrough = 3;
  h = PickEmLogic.history(s, cy);
  assert.deepEqual(h.rows.map((r) => [r.episode, r.correct]), [[1, true], [2, false]]);
  assert.equal(h.out, 2);
});

test("a late joiner after a draw is dealt their team: what's left, or their own hat; the same deal each time", () => {
  const draw = (own) => {
    const s = league({ preset: "outlast", get: { by: "draft", each: 3, order: "draw", own } }, { n: 12 });
    s.castaways.forEach((c) => { c.ownerIds = []; });
    S.DraftLogic.forceStart(s);
    assert.ok(DrawLogic.drawn(s), "drawn");
    gone(s, 1, ...s.castaways.map((c, i) => i).filter((i) => !s.castaways[i].ownerIds.length).slice(0, 1));
    return s;
  };
  // Exclusive, let in to play in the open (the couch's join): from the free agents only, nobody picks.
  const s = draw("exclusive");
  const free = S.freeAgents(s).map((c) => c.id);
  const p = S.addPlayer(s, "cy");
  assert.equal(DrawLogic.dealsLate(s), true);
  const dealt = DrawLogic.lateDeal(s, p.id, 2, true);
  assert.equal(dealt.length, 3);
  assert.ok(dealt.every((id) => free.includes(id)), "from what's left");
  assert.deepEqual(DrawLogic.lateDeal(s, p.id, 2, true), dealt, "the same deal for the same seat");
  assert.equal(GhostLogic.begin(s, p.id, 2, [cid(s, 0)], { freeAgents: true }), null, "what they asked for isn't read");
  assert.deepEqual(s.castaways.filter((c) => (c.ownerIds || []).includes(p.id)).map((c) => c.id).sort(), [...dealt].sort());
  // A late joiner playing their own season (a ghost) is dealt from everyone still in at their start, owned or not.
  const t = draw("exclusive");
  const g = S.addPlayer(t, "cy");
  const own = DrawLogic.lateDeal(t, g.id, 1, false);
  assert.equal(own.length, 3);
  assert.ok(own.every((id) => GhostLogic.draftPool(t, 1, false).includes(id)));
  // Shared: their own hat, the whole cast still in.
  const u = draw("shared");
  const h = S.addPlayer(u, "cy");
  const hat = DrawLogic.lateDeal(u, h.id, 2, false);
  assert.equal(hat.length, 3);
  assert.ok(hat.every((id) => GhostLogic.draftPool(u, 2, false).includes(id)));
  // A draft that isn't a draw: they pick, as before.
  const snake = league({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" } }, { n: 12 });
  gone(snake, 1, 11);
  assert.equal(DrawLogic.dealsLate(snake), false);
});

test("a late joiner under a price: a salary cap holds their team, a stock market's cash pays for it, and so does a team given", () => {
  // Ann and Bo's snake market (budget 20, prices 5 to 15): two each at 8 before anyone scored; after Episode 1, C4 15, C0 12, the rest 5.
  const market = () => {
    const s = league({ preset: "weekly-lineup", get: { by: "draft", each: 2, order: "snake", own: "exclusive", budget: { total: 20, ceiling: 15, trade: {} } }, count: { start: 1 } }, { n: 6, eps: 4 });
    s.castaways.forEach((c) => { c.ownerIds = []; });
    S.DraftLogic.forceStart(s);
    for (const i of [0, 1, 2, 3]) S.draftToCurrentTurn(s, cid(s, i));
    for (let k = 0; k < 2; k++) S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 4));
    S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 0));
    return s;
  };
  const s = market();
  const prices = S.PriceLogic.prices(S.SpoilerLogic.viewThrough(s, 1));
  assert.equal(prices.get(cid(s, 4)), 15);
  assert.equal(prices.get(cid(s, 5)), 5);
  assert.equal(MarketLogic.cash(s, "ann"), 4);
  // From Episode 2: C4 and C5 at Episode 1's prices, the cap's 20 exactly; their cash what's left.
  const p = S.addPlayer(s, "cy");
  assert.match(GhostLogic.begin(s, p.id, 2, [cid(s, 4), cid(s, 0)]), /Your team would cost 27: the cap is 20/);
  assert.equal(GhostLogic.begin(s, p.id, 2, [cid(s, 4), cid(s, 5)]), null);
  assert.equal(S.getPlayer(s, p.id).joinPaid, 20);
  assert.equal(MarketLogic.cash(s, p.id), 0);
  assert.equal(MarketLogic.draftPaid(s, p.id), 20);
  // From Episode 1: nobody had scored, everyone at the middle price.
  const t = market();
  const q = S.addPlayer(t, "cy");
  assert.equal(GhostLogic.begin(t, q.id, 1, [cid(t, 4), cid(t, 5)]), null);
  assert.equal(MarketLogic.cash(t, q.id), 4);
  // The cheapest team is counted from who they could have (their pool): only dearer ones left, a team over the cap isn't refused.
  const then = S.SpoilerLogic.viewThrough(s, 1);
  assert.match(S.BudgetLogic.teamProblem(then, [cid(s, 4), cid(s, 0)]), /the cap is 20/);
  assert.equal(S.BudgetLogic.teamProblem(then, [cid(s, 4), cid(s, 0)], [], [cid(s, 4), cid(s, 0)]), null);
  // Castaways whoever runs the game gives a seat after the draft: paid at today's prices (the cap isn't theirs to refuse).
  const u = market();
  u.players.push({ id: "di", name: "di", color: "#000", active: false });
  S.activatePlayer(u, "di", [cid(u, 4), cid(u, 5)]);
  assert.equal(S.getPlayer(u, "di").joinPaid, 20);
  assert.equal(MarketLogic.cash(u, "di"), 0);
  // Without a price nothing is paid.
  const free = league({ preset: "weekly-lineup", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, count: { start: 1 } }, { n: 6, eps: 4 });
  free.players.push({ id: "di", name: "di", color: "#000", active: false });
  free.castaways.forEach((c) => { c.ownerIds = []; });
  S.activatePlayer(free, "di", [cid(free, 4)]);
  assert.equal(S.getPlayer(free, "di").joinPaid, undefined);
});

test("a late joiner's captain and second pick go in as they see the league, and count", () => {
  // A lineup with a captain (A9 part 2), ann and bo holding four each; results through Episode 2.
  const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, count: { start: 1 }, score: { by: "moments", points: null, captain: { times: 2 } } };
  const s = league(LINEUP, { n: 8, eps: 4 });
  s.castaways.forEach((c, i) => { c.ownerIds = [i < 2 ? "ann" : i < 4 ? "bo" : null].filter(Boolean); });
  S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 6));
  S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 7));
  const cy = joiner(s, 1, [6, 7]);
  // Their week (Episode 1): a lineup of C6 with C6 its captain, as they see the league; it lands on the real episode.
  assert.equal(GhostLogic.applyAs(s, cy, 0, ep(s, 1).id, (v) => {
    assert.equal(S.setActiveRosterLineup(v, ep(s, 1).id, cy, [cid(s, 6)]), true);
    S.setActiveRosterCaptain(v, ep(s, 1).id, cy, cid(s, 6));
  }), null);
  assert.equal(S.ActiveRosterLogic.captainFor(s, ep(s, 1).id, cy), cid(s, 6));
  // Any other week isn't theirs yet.
  assert.match(GhostLogic.applyAs(s, cy, 0, ep(s, 2).id, () => {}), /ahead of you/);
  // Revealed 1: their captain doubled C6's immunity (3 exclusive, times 2).
  const mine = (st) => S.computeScores(GhostLogic.viewFor(st, cy, 1)).find((r) => r.playerId === cy).total;
  assert.equal(mine(s), 6);

  // A pool's second pick (A10 part 2), their week's first and second through the same door.
  const pool = league({ preset: "survival-pool", get: { by: "pick", second: {} }, score: { by: "survive" } }, { type: "pickem", eps: 4 });
  pick(pool, 1, "ann", 9);
  gone(pool, 1, 0, 1);
  const di = joiner(pool, 1);
  assert.equal(GhostLogic.applyAs(pool, di, 0, ep(pool, 1).id, (v) => {
    S.setPickEmPick(v, ep(pool, 1).id, di, cid(pool, 5));
    S.setPickEmPick(v, ep(pool, 1).id, di, cid(pool, 6), { second: true });
  }), null);
  assert.deepEqual(PickEmLogic.pickFor(pool, ep(pool, 1).id, di), { playerId: di, castawayId: cid(pool, 5), second: cid(pool, 6) });
  // A night two went home: both count.
  const row = PickEmLogic.history(pool, di).rows[0];
  assert.equal(row.correct, true);
  assert.equal(row.second.correct, true);
});

test("computer players fill an empty group slot with the group they rate best, and ride with it while it lasts", () => {
  const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 4, order: "snake", own: "exclusive", groups: {} }, count: { start: 2 }, score: { by: "moments", points: null } };
  const s = league(LINEUP, { n: 8, eps: 6 });
  s.castaways.forEach((c, i) => { c.ownerIds = [i < 4 ? "ann" : "bo"]; });
  s.players.find((p) => p.id === "bo").automated = true;
  const pairs = (...ps) => ps.map((m) => ({ name: null, members: m.map((i) => `C${i}`) }));
  const rep = (k, groups, changes = []) => ({ episode: k, state: { playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "nobody", changes }, left: [], merged: null });
  const settle = (reports) => {
    const tl = T.buildTimeline(reports, { cast: s.castaways.map((c) => c.name) });
    S.GroupSlotLogic.settle(s, T.slotRecords(tl, { resolve: (name) => (s.castaways.find((c) => c.name === name) || {}).id || null }));
  };
  const L = S.GroupSlotLogic;
  // Nothing on offer going into the premiere: the slot stays empty.
  assert.equal(Bots.groupSlotPicks(s), 0);
  // Episode 1 in pairs; C5 scored big in it, so the pair with C5 rates best going into 2.
  for (let k = 0; k < 3; k++) S.addScoringEvent(s, ep(s, 1).id, "individualImmunity", cid(s, 5));
  const reports = [rep(1, pairs([0, 4], [1, 5], [2, 6], [3, 7]))];
  settle(reports);
  assert.equal(L.offered(s, 2).groups.length, 4);
  assert.equal(Bots.groupSlotPicks(structuredClone(s)), 1);
  assert.ok(Bots.run(s) >= 1, "its lineup and its slot");
  const held = L.standing(s, "bo", 0, 2);
  assert.deepEqual([...held.pick.members].sort(), [cid(s, 1), cid(s, 5)].sort());
  assert.equal(L.standing(s, "ann", 0, 2).status, "empty", "a person's slot is theirs to fill");
  assert.equal(Bots.groupSlotPicks(s), 0, "nothing more: run again, it does nothing");
  assert.equal(Bots.hasWork(s), false);
  // Episode 2 played, the pairs still together: it rides with its group.
  S.addScoringEvent(s, ep(s, 2).id, "idolFound", cid(s, 0));
  reports.push(rep(2, pairs([0, 4], [1, 5], [2, 6], [3, 7])));
  settle(reports);
  assert.equal(Bots.groupSlotPicks(s), 0);
  assert.equal(L.standing(s, "bo", 0, 3).status, "waiting");
  // Episode 3 re-pairs everyone at its end: the slot drops, and the bot picks from the new pairs going into 4.
  S.addScoringEvent(s, ep(s, 3).id, "idolFound", cid(s, 2));
  reports.push(rep(3, pairs([0, 5], [1, 4], [2, 7], [3, 6]), [{ kind: "swap", when: "end", from: 4, what: "Everyone re-paired", sure: "high" }]));
  settle(reports);
  assert.equal(L.standing(s, "bo", 0, 4).status, "dropped");
  assert.equal(Bots.groupSlotPicks(s), 1);
  const next = L.standing(s, "bo", 0, 4);
  assert.equal(next.from, 4);
  assert.ok(L.offered(s, 4).groups.some((g) => g.id === next.pick.id), "one of the pairs going into 4");
  // Knocked out of the game, or nothing on offer: nothing.
  assert.equal(G.specProblems(LINEUP, CTX).length, 0);
});
