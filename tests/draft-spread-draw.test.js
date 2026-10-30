// A draft's slots and a draw (docs/PLAN-start-a-game-gpt.md step A10 part 3: the stretch rows s05 "Everyone drafts one castaway
// from each tribe", s06 "Draft a guy and a girl each, and they score together", s38 "Names out of a hat: everyone gets a random
// castaway; last one standing wins", the dial row answer.draw). A draft spread across the cast's groups (get.across: the groups
// the data has people on when it drafts; no more than ceil(each / groups) from one, at least floor(each / groups) from each while
// it has someone to take; a show not divided drafts plainly; the spread never blocks a draft; after it a castaway is yours
// wherever they go), a guy and a girl refused by the data rule (no show records who is which), and a draw (get.order 'draw':
// dealt at random when it starts, seeded and recorded, exclusive or shared, a scheduled one drawn when it's due). Their shape,
// defaults, words and settings; the snake's and blind draft's checks, the draw, computer players; a plain draft as before. Run
// with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { draftKind, draftView } = jiti("../src/lib/game/draft-view.ts");
const { draftOpen } = jiti("../src/lib/game/computer-players.ts");
const { actionItems } = require("../src/lib/game/action-items.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const SPREAD = { of: "group" };
const outlast = (get = {}) => ({ preset: "outlast", get: { by: "draft", ...get } });
const lineup = (get = {}, start = 2) => ({ preset: "weekly-lineup", get: { by: "draft", ...get }, count: { start } });

/** A league on made-up tribes: `tribes` their sizes (t1, t2, ...), `people` its seats, the game `spec`. */
function league(spec, { tribes = [3, 3, 3], people = ["ann", "bo", "cy"], bots = [] } = {}) {
  const castaways = [];
  tribes.forEach((n, t) => {
    for (let i = 0; i < n; i++) castaways.push({ id: `c${t + 1}${i}`, name: `C${t + 1}${i} Person`, status: "active", tribeId: `t${t + 1}`, ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null });
  });
  const settings = { ...G.settingsOf(spec), showFormat: "survivor" };
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  return S.migrateLeagueState({
    settings,
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: tribes.map((_, t) => ({ id: `t${t + 1}`, name: ["Toka", "Savu", "Dina", "Kele"][t], color: "#000" })),
    castaways,
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
}
const tribeOf = (s, id) => s.castaways.find((c) => c.id === id).tribeId;
const team = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const tribesOf = (s, pid) => team(s, pid).map((id) => tribeOf(s, id)).sort();
/** Every seat's pick in turn: the first free castaway each one's `choose` takes (the spread's allowed ones, else the free). */
function snakeAll(s, choose = (allowed) => allowed[0]) {
  for (let guard = 0; guard < 100; guard++) {
    const turn = S.currentDraftTurn(s);
    if (!turn || turn.isComplete) return;
    const free = S.freeAgents(s).map((c) => c.id);
    const id = choose(S.SpreadLogic.allowedFor(s, turn.playerId, free), free, turn.playerId);
    const before = s.draftPicksMade;
    S.draftToCurrentTurn(s, id);
    assert.ok(s.draftPicksMade > before, `the pick of ${id} went in`);
  }
}

test("a spread draft and a draw: their shape, defaults, words and settings; what they wait for", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  // s05 and s38 as the tracker says them: valid, played today as Outlast, nothing to wait for.
  const s05 = outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD });
  const s38 = outlast({ each: 1, order: "draw" });
  for (const s of [s05, s38, lineup({ each: 3, order: "draw", own: "shared", across: SPREAD })]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.ok(G.typeOf(s), JSON.stringify(s));
    assert.deepEqual(G.specWaitsFor(s), []);
  }
  assert.equal(G.typeOf(s38), "classic-draft");
  assert.equal(G.typeOf(lineup({ each: 3, order: "draw", own: "shared" })), "active-roster");
  // The defaults (the user's to set): a draw said alone is exclusive (out of one hat); a spread keeps who it drafted.
  assert.equal(G.fullSpec(s38).get.own, "exclusive");
  assert.deepEqual(G.fullSpec(s05).get.across, { of: "group", then: "keep" });
  // A draw goes with either ownership; a draft people pick in still pairs its order with its ownership.
  assert.deepEqual(at(outlast({ each: 2, order: "draw", own: "shared" })), []);
  assert.deepEqual(at(outlast({ each: 2, order: "snake", own: "shared" })), ["get.order"]);
  assert.deepEqual(at(outlast({ each: 2, order: "hat" })), ["get.own", "get.order"]);
  // The spread's shape.
  assert.deepEqual(at(outlast({ each: 3, across: { of: "tribe" } })), ["get.across.of"]);
  assert.deepEqual(at(outlast({ each: 3, across: { of: "group", then: "refill" } })), ["get.across.then"]);
  assert.deepEqual(at(outlast({ each: 3, across: { of: "group", pick: 1 } })), ["get.across.pick"]);
  assert.deepEqual(at(outlast({ each: 3, across: "group" })), ["get.across"]);
  // The data rule: a show nobody is in a group on has nothing to spread across; a guy and a girl (s06) needs data that says
  // who is which, and no show's records it (and it waits on a step nobody has).
  assert.deepEqual(at(s05, { ...CTX, grouped: false }), ["get.across.of"]);
  const s06 = lineup({ each: 2, across: { of: "gender" } }, 2);
  assert.deepEqual(at(s06), ["get.across.of"]);
  assert.match(G.specProblems(s06, CTX)[0].problem, /guy and who's a girl/);
  assert.deepEqual(G.specWaitsFor(s06).map((w) => w.step), ["later"]);
  // Exclusive or shared, counted per group where it drafts (the 9:10 PM decision as the pool shrinks: one tribe's castaways for
  // that tribe's share): four of you each taking one from a tribe of three can't all; three can; shared can; a league's own
  // keeps its draft; and the draw counts as any exclusive draft does.
  const cnt = (spec, poolGroups, couch, opts) => at(spec, { ...CTX, poolGroups, couch }, opts);
  assert.deepEqual(cnt(s05, [4, 4, 3], 4), ["get.own"]);
  assert.match(G.specProblems(s05, { ...CTX, poolGroups: [4, 4, 3], couch: 4 })[0].problem, /4 of you each need 1 from every group, and one has only 3/);
  assert.deepEqual(cnt(s05, [4, 4, 3], 3), []);
  assert.deepEqual(cnt(outlast({ each: 3, order: "blind", own: "shared", across: SPREAD }), [4, 4, 3], 4), []);
  assert.deepEqual(cnt(s05, [4, 4, 3], 4, { league: true }), []);
  assert.deepEqual(cnt(outlast({ each: 2, across: SPREAD }), [4, 4, 3], 9), [], "a team of 2 over three tribes asks none from each");
  assert.deepEqual(at(s38, { ...CTX, pool: 18, couch: 20 }), ["get.own"]);
  assert.deepEqual(at(s38, { ...CTX, pool: 18, couch: 12 }), []);
  // The bounds: as even as a team's size allows.
  assert.deepEqual(G.spreadBounds(3, 3), { least: 1, most: 1 });
  assert.deepEqual(G.spreadBounds(5, 3), { least: 1, most: 2 });
  assert.deepEqual(G.spreadBounds(5, 4), { least: 1, most: 2 });
  assert.deepEqual(G.spreadBounds(2, 3), { least: 0, most: 1 });
  assert.equal(G.spreadBounds(3, 1), null, "one group isn't divided");
  // The settings, both ways (absent unless a game says it).
  for (const spec of [s05, s38, lineup({ each: 3, order: "draw", own: "shared", across: SPREAD })]) {
    const st = G.settingsOf(spec);
    assert.ok(G.sameValue(G.specOf(st), G.fullSpec(spec)), JSON.stringify(spec));
  }
  assert.equal(G.settingsOf(s38).draftDraw, true);
  assert.deepEqual(G.settingsOf(s05).draftAcross, { of: "group", then: "keep" });
  const plain = G.settingsOf(outlast({ each: 3 }));
  assert.ok(!("draftDraw" in plain && plain.draftDraw !== undefined) && plain.draftAcross === undefined, "a plain draft writes neither");
  assert.ok(G.OWNED.includes("draftDraw") && G.OWNED.includes("draftAcross"));
  // Words.
  const words = (spec) => G.describeSpec(spec, { show: "Survivor 51", castaway: "castaway", group: "tribe" });
  assert.match(words(s05).sentence, /everyone drafts 3 from across the tribes, all season/);
  assert.ok(words(s05).rules.some((r) => /as evenly as its size allows/.test(r)) && words(s05).rules.some((r) => /a swap or the merge changes nobody's team/.test(r)));
  assert.match(words(s38).sentence, /everyone gets 1 drawn at random/);
  assert.match(words(s38).sentence, /last one standing carries you/);
  assert.ok(words(s38).rules.some((r) => /from one hat, so nobody shares/.test(r)));
  assert.ok(!words(s38).rules.some((r) => /Snake-draft/.test(r)));
  assert.ok(words(outlast({ each: 2, order: "draw", own: "shared" })).rules.some((r) => /a hat of their own/.test(r)));
  assert.match(words(s38).details.find((d) => d.id === "draft").value, /At random, out of one hat/);
});

test("a snake draft spread across the tribes: one from each, a pick that breaks it refused with why", () => {
  const s = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }));
  S.forceStartDraft(s);
  // ann takes a Toka; her next pick can't be another (no more than one from each with three of each).
  S.draftToCurrentTurn(s, "c10");
  S.draftToCurrentTurn(s, "c11"); // bo
  S.draftToCurrentTurn(s, "c12"); // cy
  // The snake turns: cy again. A second Toka (there's none left anyway) or ... cy tries Savu, fine; then bo tries a Savu too.
  assert.equal(S.currentDraftTurn(s).playerId, "cy");
  S.draftToCurrentTurn(s, "c20");
  assert.equal(S.currentDraftTurn(s).playerId, "bo");
  // bo has a Toka; a third Savu pick for ann later would be refused: check the reason on someone's second from one tribe.
  S.draftToCurrentTurn(s, "c21");
  assert.equal(S.currentDraftTurn(s).playerId, "ann");
  const problem = S.SpreadLogic.pickProblem(s, "ann", "c22");
  assert.equal(problem, null, "ann has no Savu yet");
  S.draftToCurrentTurn(s, "c22");
  // Round three: ann again, then bo, then cy; ann trying a second Savu is refused (there's none left free: try her a Dina).
  assert.equal(S.currentDraftTurn(s).playerId, "ann");
  S.draftToCurrentTurn(s, "c30");
  assert.equal(S.currentDraftTurn(s).playerId, "bo");
  S.draftToCurrentTurn(s, "c31");
  S.draftToCurrentTurn(s, "c32");
  assert.ok(S.currentDraftTurn(s).isComplete);
  for (const p of ["ann", "bo", "cy"]) assert.deepEqual(tribesOf(s, p), ["t1", "t2", "t3"], p);

  // A second from one tribe, refused at the pick, with the reason; the draft doesn't move on.
  const t = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [4, 4, 4] });
  S.forceStartDraft(t);
  S.draftToCurrentTurn(t, "c10"); // ann: Toka
  S.draftToCurrentTurn(t, "c20"); // bo
  S.draftToCurrentTurn(t, "c30"); // cy
  S.draftToCurrentTurn(t, "c31"); // cy: Dina is cy's already
  assert.equal(t.draftPicksMade, 3, "cy's second Dina didn't go in");
  assert.match(S.SpreadLogic.pickProblem(t, "cy", "c31"), /Spread your team across the tribes: at least 1 from each, and no more than 1 from one/);
  assert.equal(S.SpreadLogic.pickProblem(t, "cy", "c11"), null);
  // Computer players and a plain draft: no spread, no check.
  const plain = league(outlast({ each: 3 }), { tribes: [4, 4, 4] });
  S.forceStartDraft(plain);
  assert.equal(S.SpreadLogic.pickProblem(plain, "ann", "c10"), null);
  assert.equal(S.SpreadLogic.groupsNow(plain), null);
});

test("the spread's fallbacks: a tribe that runs out asks only what it has, nothing blocks a draft, a show not divided drafts plainly", () => {
  // Four of you, teams of three over Toka 5, Savu 5, Dina 2: Dina runs out after two teams, and the other two fill from the rest.
  const s = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [5, 5, 2], people: ["ann", "bo", "cy", "di"] });
  S.forceStartDraft(s);
  // Everyone takes a Dina while there's one (the greedy chooser prefers the last listed), then whatever keeps them spread.
  snakeAll(s, (allowed) => allowed.find((id) => tribeOf(s, id) === "t3") || allowed[0]);
  assert.ok(S.currentDraftTurn(s).isComplete, "the draft finished");
  const dinas = ["ann", "bo", "cy", "di"].filter((p) => tribesOf(s, p).includes("t3"));
  assert.equal(dinas.length, 2);
  for (const p of ["ann", "bo", "cy", "di"]) {
    assert.equal(team(s, p).length, 3, p);
    const counts = tribesOf(s, p).reduce((m, t) => ({ ...m, [t]: (m[t] || 0) + 1 }), {});
    if (dinas.includes(p)) assert.deepEqual(counts, { t1: 1, t2: 1, t3: 1 }, p);
    else assert.ok(Object.values(counts).every((n) => n <= 2) && counts.t1 && counts.t2, `${p}: ${JSON.stringify(counts)}`);
  }
  // Nobody left that keeps a team spread: anyone can be taken (a team of 3 over two tribes of 1 and one of 7).
  const tight = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [1, 1, 7], people: ["ann", "bo"] });
  S.forceStartDraft(tight);
  snakeAll(tight);
  assert.ok(S.currentDraftTurn(tight).isComplete);
  assert.equal(team(tight, "ann").length + team(tight, "bo").length, 6);
  // One tribe (the merge before the draft), or nobody on one: a plain draft.
  const merged = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [9] });
  assert.equal(S.SpreadLogic.groupsNow(merged), null);
  // Someone on no group (unplaced) is a free pick, while the floors still hold.
  const unplaced = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [3, 3, 3] });
  unplaced.castaways.find((c) => c.id === "c32").tribeId = null;
  S.forceStartDraft(unplaced);
  S.draftToCurrentTurn(unplaced, "c32"); // ann: nobody's
  assert.equal(S.SpreadLogic.pickProblem(unplaced, "bo", "c10"), null);
  assert.deepEqual(S.SpreadLogic.groupsNow(unplaced).groups, ["t1", "t2", "t3"]);
  // After the draft a castaway is yours wherever they go: a swap moves nobody's team.
  const swap = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }));
  S.forceStartDraft(swap);
  snakeAll(swap);
  const before = ["ann", "bo", "cy"].map((p) => team(swap, p));
  swap.castaways.forEach((c) => { c.tribeId = c.tribeId === "t1" ? "t2" : c.tribeId; });
  assert.deepEqual(["ann", "bo", "cy"].map((p) => team(swap, p)), before);
  // The groups as the data has them now: a Toka swapped to Savu before the draft counts as Savu's.
  const moved = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { tribes: [4, 4, 4] });
  moved.castaways.find((c) => c.id === "c10").tribeId = "t2";
  S.forceStartDraft(moved);
  S.draftToCurrentTurn(moved, "c20"); // ann: Savu
  assert.match(S.SpreadLogic.pickProblem(moved, "ann", "c10"), /no more than 1 from one/, "c10 is Savu's now");
});

test("a blind draft spread across the tribes: a team that isn't refused, one that is in any order", () => {
  const s = league(outlast({ each: 3, order: "blind", own: "shared", across: SPREAD }));
  S.forceStartDraft(s);
  assert.match(S.BlindDraftLogic.validateSubmission(s, "ann", ["c10", "c11", "c20"]), /Spread your team across the tribes/);
  for (const order of [["c10", "c20", "c30"], ["c30", "c10", "c20"], ["c21", "c32", "c12"]]) assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", order), null, order.join());
  // Shared: two of you can have the same one.
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "bo", ["c10", "c20", "c30"]), null);
  // A team of five over three tribes: two, two and one.
  const five = league(outlast({ each: 5, order: "blind", own: "shared", across: SPREAD }), { tribes: [4, 4, 4] });
  S.forceStartDraft(five);
  assert.equal(S.BlindDraftLogic.validateSubmission(five, "ann", ["c10", "c11", "c20", "c21", "c30"]), null);
  assert.match(S.BlindDraftLogic.validateSubmission(five, "ann", ["c10", "c11", "c12", "c20", "c30"]), /no more than 2 from one/);
  assert.match(S.BlindDraftLogic.validateSubmission(five, "ann", ["c10", "c11", "c20", "c21", "c22"]), /at least 1 from each/);
  // Not a blind draft: a draw's shared teams aren't submitted.
  const draw = league(outlast({ each: 3, order: "draw", own: "shared" }));
  assert.equal(S.BlindDraftLogic.validateSubmission(draw, "ann", ["c10", "c20", "c30"]), "This league is not running a blind draft");
});

test("names out of a hat: the draw deals everyone at random, seeded and recorded, the same seed the same teams", () => {
  const spec = outlast({ each: 1, order: "draw" });
  const s = league(spec);
  const type = S.getLeagueType(s);
  assert.equal(type.id, "classic-draft");
  assert.equal(S.piecesOf(s).draft, S.DrawDraftStrategy);
  assert.equal(type.hasRoster, true);
  assert.equal(S.getLeagueType(s), type, "built once");
  assert.equal(draftKind(s), "draw");
  assert.equal(S.currentDraftTurn(s), null, "before the draw, someone joining is in it");
  assert.equal(S.isDraftStarted(s), false);
  const before = JSON.parse(JSON.stringify(s));
  S.forceStartDraft(s);
  assert.ok(S.DrawLogic.drawn(s) && s.draw.seed && s.draw.at);
  assert.ok(S.currentDraftTurn(s).isComplete);
  const dealt = ["ann", "bo", "cy"].map((p) => team(s, p));
  assert.ok(dealt.every((t) => t.length === 1));
  assert.equal(new Set(dealt.flat()).size, 3, "out of one hat: nobody shares");
  assert.equal(s.draftLog.length, 3);
  assert.ok(s.draftLog.every((e) => e.drawn));
  assert.equal(s.draftPicksMade, 3);
  assert.deepEqual(s.draftOrder.slice(0, 3), s.draw.order, "the draw's order is the draft's");
  // Reproducible: the seed deals the same from the league as it was, on any copy; picks and undo do nothing.
  const again = S.DrawLogic.outcome(before, s.draw.seed);
  assert.deepEqual(Object.fromEntries(["ann", "bo", "cy"].map((p) => [p, again.teams[p]])), Object.fromEntries(["ann", "bo", "cy"].map((p, i) => [p, dealt[i]])));
  const copy = JSON.parse(JSON.stringify(before));
  S.DrawLogic.draw(copy, s.draw.seed);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => team(copy, p)), dealt);
  const seeds = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(S.DrawLogic.outcome(before, `seed-${i}`).teams)));
  assert.ok(seeds.size > 1, "another seed, another draw");
  assert.equal(S.DrawLogic.draw(s), false, "drawn once");
  S.draftToCurrentTurn(s, "c33");
  S.undraft(s, dealt[0][0]);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => team(s, p)), dealt);
  // The draft view: the teams, no turns or clock.
  const g = draftView({ leagueId: "L", name: "Hat", gameType: "classic-draft", gameName: "Outlast", yourRole: "member" }, s, "ann", null, (p) => p, { queue: [], mine: null }, () => null);
  assert.equal(g.kind, "draw");
  assert.equal(g.phase, "done");
  assert.equal(g.clock, null);
  assert.equal(g.teams.length, 3);
  // Someone joining after the draw joins as after any finished draft: a late joiner.
  const late = S.addPlayer(s, "dee");
  assert.equal(late.ghost, true);
});

test("the draw's fallbacks: a hat that runs out comes up short; shared hats; a spread draw; a scheduled draw drawn when it's due", () => {
  // Four of you, three each, nine in the hat: the last dealt come up short, and the draw says who.
  const s = league(outlast({ each: 3, order: "draw", own: "exclusive" }), { people: ["ann", "bo", "cy", "di"] });
  S.forceStartDraft(s);
  const sizes = ["ann", "bo", "cy", "di"].map((p) => team(s, p).length);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 9);
  assert.deepEqual(s.draw.short.slice().sort(), ["ann", "bo", "cy", "di"].filter((p, i) => sizes[i] < 3).sort());
  assert.equal(s.draw.short.length, 3);
  // Shared: each from a hat of their own, spread across the tribes.
  const shared = league(lineup({ each: 3, order: "draw", own: "shared", across: SPREAD }), { tribes: [3, 3, 3] });
  assert.equal(S.getLeagueType(shared).id, "active-roster");
  S.forceStartDraft(shared);
  for (const p of ["ann", "bo", "cy"]) assert.deepEqual(tribesOf(shared, p), ["t1", "t2", "t3"], p);
  // Exclusive and spread: one from each tribe, nobody sharing.
  const both = league(outlast({ each: 3, order: "draw", own: "exclusive", across: SPREAD }));
  S.forceStartDraft(both);
  for (const p of ["ann", "bo", "cy"]) assert.deepEqual(tribesOf(both, p), ["t1", "t2", "t3"], p);
  assert.equal(new Set(["ann", "bo", "cy"].flatMap((p) => team(both, p))).size, 9);
  // Scheduled: not due before its time, drawn by the settle once it has come (every write and every read that finds it due).
  const later = league(outlast({ each: 1, order: "draw" }));
  later.settings.draftScheduledAt = new Date(Date.now() + 3600e3).toISOString();
  assert.equal(S.DrawLogic.due(later), false);
  assert.equal(S.DrawLogic.settle(later), false);
  const due = league(outlast({ each: 1, order: "draw" }));
  due.settings.draftScheduledAt = new Date(Date.now() - 60e3).toISOString();
  assert.equal(S.isDraftStarted(due), true);
  assert.equal(S.DrawLogic.due(due), true);
  assert.equal(S.DrawLogic.settle(due), true);
  assert.equal(S.DrawLogic.due(due), false);
  assert.equal(["ann", "bo", "cy"].map((p) => team(due, p).length).join(), "1,1,1");
  // No cast, nothing drawn.
  const empty = league(outlast({ each: 1, order: "draw" }));
  empty.castaways.forEach((c) => { c.status = "eliminated"; });
  S.forceStartDraft(empty);
  assert.equal(S.DrawLogic.drawn(empty), false);
});

test("computer players keep a spread draft, and leave a draw to the draw", () => {
  const s = league(outlast({ each: 3, order: "snake", own: "exclusive", across: SPREAD }), { people: [], bots: ["b1", "b2", "b3"], tribes: [4, 4, 4] });
  S.forceStartDraft(s);
  Bots.run(s);
  assert.ok(S.currentDraftTurn(s).isComplete, "the bots drafted");
  for (const p of ["b1", "b2", "b3"]) assert.deepEqual(tribesOf(s, p), ["t1", "t2", "t3"], p);
  const blind = league(outlast({ each: 3, order: "blind", own: "shared", across: SPREAD }), { people: ["ann"], bots: ["b1", "b2"] });
  S.forceStartDraft(blind);
  const subs = Bots.blindSubmissions(blind);
  assert.equal(subs.length, 2);
  for (const x of subs) assert.deepEqual(x.castawayIds.map((id) => tribeOf(blind, id)).sort(), ["t1", "t2", "t3"]);
  const draw = league(outlast({ each: 3, order: "draw", own: "shared" }), { people: ["ann"], bots: ["b1"] });
  assert.deepEqual(Bots.blindSubmissions(draw), []);
  Bots.run(draw);
  assert.equal(S.DrawLogic.drawn(draw), false, "the bots don't start the draw");
});

test("the code review's cases: a start nobody could be dealt yet, a drafted league never dealt over, a shared draw is no blind draft", () => {
  // Started before anyone was in the rotation: nothing dealt then, dealt by the next settle once someone is.
  const early = league(outlast({ each: 1, order: "draw" }), { people: [] });
  S.forceStartDraft(early);
  assert.equal(S.DrawLogic.drawn(early), false);
  early.players.push({ id: "ann", name: "ann", color: "#000", active: true }, { id: "bo", name: "bo", color: "#000", active: true });
  assert.equal(S.DrawLogic.due(early), true, "the Commissioner's Start still counts");
  assert.equal(S.DrawLogic.settle(early), true);
  assert.equal(team(early, "ann").length + team(early, "bo").length, 2);
  // A league drafted another way, then made a draw whose time has come: its teams stand.
  const drafted = league(outlast({ each: 3, order: "snake", own: "exclusive" }));
  S.forceStartDraft(drafted);
  snakeAll(drafted);
  const teams = ["ann", "bo", "cy"].map((p) => team(drafted, p));
  Object.assign(drafted.settings, { draftDraw: true, draftScheduledAt: new Date(Date.now() - 60e3).toISOString() });
  assert.equal(S.DrawLogic.on(drafted), true);
  assert.equal(S.DrawLogic.due(drafted), false);
  assert.equal(S.DrawLogic.settle(drafted), false);
  assert.deepEqual(["ann", "bo", "cy"].map((p) => team(drafted, p)), teams);
  // A shared draw: no lock-in asked of anyone, the bots can be taken out once it's dealt, and each team in the order it was dealt.
  const shared = league(outlast({ each: 3, order: "draw", own: "shared" }));
  assert.equal(S.BlindDraftLogic.on(shared), false);
  S.forceStartDraft(shared);
  assert.ok(!actionItems(shared, "ann", null).some((it) => it.kind === "blindDraft"), "nothing to lock in");
  assert.equal(draftOpen(shared), false, "dealt: the draft's done");
  const g = draftView({ leagueId: "L", name: "Hat", gameType: "classic-draft", gameName: "Outlast", yourRole: "member" }, shared, "ann", null, (p) => p, { queue: [], mine: null }, () => null);
  for (const p of ["ann", "bo", "cy"]) {
    const dealt = shared.draftLog.filter((e) => e.playerId === p).map((e) => e.castawayId);
    assert.deepEqual(g.teams.find((t) => t.playerId === p).castawayIds, dealt, p);
  }
  const notYet = league(outlast({ each: 3, order: "draw", own: "shared" }));
  notYet.settings.draftScheduledAt = new Date(Date.now() - 60e3).toISOString();
  assert.equal(draftOpen(notYet), true, "started, not dealt yet: open");
  // A blind draft is still one.
  assert.equal(S.BlindDraftLogic.on(league(outlast({ each: 3, order: "blind", own: "shared" }))), true);
});
