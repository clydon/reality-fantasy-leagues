// Late joiners in a game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 4c): someone joining once it has started joins each
// stage underway as that stage's own late joiner (live, by its own rules: a team from who's free in an exclusive draft, from who's still
// in where it's shared), every stage still to start from its start (into its draft), none that's over (it counts nothing for them);
// nobody new while a stage still playing keeps a newcomer waiting (someone's out of it: A11 part 5c's rule, one rule for the game);
// the game's join rule read from the walk (each stage's `joins`), the stored state's fallback nobody new once it's started; a seat that
// left a begun stage and comes back is the same seat there (the game keeps it, disabled, once any stage has begun); and part 4b's item 8
// (a stage on another season that never started is over once its league is, so the game can end). The server's side (the couch's join
// route) is scripts/dev-test/check-late-stages.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });

const { StageLogic, GhostLogic } = S;
const CTX = {
  show: "Survivor 51",
  season: "survivor/51",
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  phases: [{ id: "premerge", name: "Pre-merge" }, { id: "merged", name: "Merged" }],
  seasons: {
    "the-traitors-us/5": { show: "The Traitors 5", moments: [], results: true, winner: true, roles: ["Traitor", "Faithful"], phases: [{ id: "castle", name: "Castle" }] },
  },
};
const SEATS = ["ann", "bo", "cy", "di"];

/** A league of `n` castaways C0.. and seats `people`, its game `spec` through setGame (the type it's made as), Episodes 1 to `eps`. */
function league(spec, { n = 12, people = SEATS, eps = 10 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  const kind = G.typeOf(spec);
  if (kind !== "stages") S.updateSettings(s, "leagueTypeId", G.madeAs(kind));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const cid = (s, i) => s.castaways[i].id;
const gone = (s, k, i) => S.addElimination(s, ep(s, k).id, cid(s, i), "Voted Out");
/** The snake draft run to its end: each turn takes the first castaway still free. */
function snake(s) {
  S.forceStartDraft(s);
  for (let guard = 0; guard < 200; guard++) {
    const turn = S.currentDraftTurn(s);
    if (!turn || turn.isComplete) return;
    const free = s.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
    if (!free) return;
    S.draftToCurrentTurn(s, free.id);
  }
}
const team = (s, p) => s.castaways.filter((c) => (c.ownerIds || []).includes(p)).map((c) => c.name);
/** The walk's stage records as the server hands them over (answer-points.ts stageWalk), joins and all: the tables are each test's own. */
const walkStage = (key, state, entries = [], more = {}) => ({ key, leagueId: `zt-${key}`, from: S.startEpisode(state), to: S.lastEpisode(state), joins: StageLogic.joinsOf(state), entries, ...more });

/** The seat sync's server half (stages.ts), on stage states, with a client that holds no memberships. */
const stages = () => jiti("../src/lib/server/stages.ts");
const NO_ROWS = { query: async () => ({ rows: [] }) };
/** A db for stagesOf and stagesToSeat: the stage leagues as stored, no memberships. */
const dbOf = (list) => ({
  query: async (sql) => (/stage_key/.test(sql) ? { rows: list.map(({ id, key, state }) => ({ id, stage_key: key, state })) } : { rows: [] }),
});

const TWO = {
  stages: [
    { id: "pre", name: "Pre-merge", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, span: { from: 1, to: 4 } } },
    { id: "post", name: "Post-merge", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, span: { from: 5 } } },
  ],
  overall: { by: "points" },
};
/** The game and its two stage leagues, as the lab makes them (each stage's game whole, its seats the game's). */
function staged(spec = TWO) {
  const parent = league(spec);
  const full = G.fullSpec(spec);
  const kids = full.stages.map((st) => ({ id: `zt-${st.id}`, key: st.id, state: league(st.game) }));
  return { parent, kids, all: [parent, ...kids.map((k) => k.state)] };
}

test("each stage's own rule for someone new (StageLogic.joinsOf): its draft, its late joiner, waiting, or none once it's over", () => {
  const { kids } = staged();
  const [pre, post] = kids.map((k) => k.state);
  assert.equal(StageLogic.joinsOf(pre), "draft", "before its draft: into it, as anyone");
  snake(pre);
  assert.equal(StageLogic.joinsOf(pre), "late", "its draft done: a late joiner, by its own rules");
  assert.equal(StageLogic.joinsOf(post), "draft", "still to start");
  [1, 2, 3, 4].forEach((k) => gone(pre, k, k - 1));
  assert.equal(StageLogic.joinsOf(pre), "over", "its last episode has results: nobody new is seated in it");
  // A pool with a life each, someone out of it: nobody new there (A11 part 5c), so the game takes nobody new.
  const pool = league({ preset: "survival-pool", score: { by: "survive", lives: 1 } });
  S.setPickEmPick(pool, ep(pool, 1).id, "ann", cid(pool, 0));
  S.setPickEmPick(pool, ep(pool, 1).id, "bo", cid(pool, 1));
  gone(pool, 1, 0);
  assert.equal(StageLogic.joinsOf(pool), "waits");
  // A stage of bingo ends as its last episode airs (no results to wait for).
  const bingo = league({ preset: "weekly-bingo", score: { by: "lines", points: 5 }, span: { from: 1, to: 2 } });
  assert.notEqual(StageLogic.joinsOf(bingo), "over");
  ep(bingo, 2).airsAt = new Date(Date.now() - 86400000).toISOString();
  assert.equal(StageLogic.joinsOf(bingo), "over");
  // A stage whose joining is shut (its own Who can join: locked).
  const shut = league({ ...TWO.stages[1].game, span: { from: 1 }, extras: { join: "locked" } });
  snake(shut);
  assert.equal(StageLogic.joinsOf(shut), "waits");
});

test("a game in stages' join rule (StageLogic.closed): as any game before it starts; then its stages', from the walk; no walk, nobody", () => {
  const { parent, kids, all } = staged();
  const [pre, post] = kids.map((k) => k.state);
  snake(pre);
  const walk = () => ({ stages: [walkStage("pre", pre), walkStage("post", post)] });
  assert.equal(StageLogic.closed(parent), false, "before its first stage starts");
  assert.equal(GhostLogic.allowed(parent), true);
  [1, 2].forEach((k) => all.forEach((s) => gone(s, k, k - 1)));
  assert.equal(StageLogic.started(parent), true);
  // The stored state, no walk: nobody new (the safe fallback), as before.
  assert.equal(StageLogic.closed(parent), true);
  assert.equal(GhostLogic.joinMode(parent), "locked");
  assert.equal(S.addPlayer(structuredClone(parent), "eve").active, false, "a code join waits, inactive");
  // Read with its stages (the server's walk): Pre-merge takes a late joiner, Post-merge drafts later: open.
  const read = StageLogic.withWalk(parent, walk());
  assert.deepEqual(read.stageWalk.stages.map((x) => x.joins), ["late", "draft"]);
  assert.equal(StageLogic.closed(read), false);
  assert.equal(GhostLogic.allowed(read), true);
  assert.notEqual(GhostLogic.joinMode(read), "locked");
  // Live only: catching up would move the game's mark and each stage's apart.
  assert.deepEqual(GhostLogic.startChoices(parent), [3]);
  // A join route reads the walk and says so (the write runs on the stored state): a late joiner from the next episode.
  const c = structuredClone(parent);
  const eve = S.addPlayer(c, "eve", { stagesOpen: true });
  assert.ok(eve.lateJoin && eve.ghost);
  assert.equal(GhostLogic.begin(c, eve.id, 1, []), "Pick an episode from the list", "no catching up");
  assert.equal(GhostLogic.begin(c, eve.id, 3, []), null, "the game itself has no team to pick");
  assert.equal(S.addPlayer(structuredClone(parent), "fay", { stagesOpen: false }).active, false);
  // Any stage that keeps a newcomer waiting closes the game; a walk that doesn't say how a stage takes them (an older reader) too.
  assert.equal(StageLogic.closed(StageLogic.withWalk(parent, { stages: [walkStage("pre", pre, [], { joins: "waits" }), walkStage("post", post)] })), true);
  assert.equal(StageLogic.closed(StageLogic.withWalk(parent, { stages: [walkStage("pre", pre, [], { joins: undefined }), walkStage("post", post)] })), true);
  assert.equal(StageLogic.closed(StageLogic.withWalk(parent, { stages: [] })), true, "no stage league read: nowhere to seat them");
  // Every stage there now over (a stage a format change starts may still come): open, the game's end is gameOver's to say.
  assert.equal(StageLogic.closed(StageLogic.withWalk(parent, { stages: [walkStage("pre", pre, [], { joins: "over" }), walkStage("post", post, [], { joins: "over" })] })), false);
});

test("a late joiner seated in each stage by its own rule: the stage in play's late joiner, live, a later stage's draft, none that's over", async () => {
  const { seatStage, inSpecOrder, lateStages } = stages();
  const { parent, kids, all } = staged();
  const [pre, post] = kids.map((k) => k.state);
  snake(pre);
  assert.deepEqual(team(pre, "ann"), ["C0", "C7"]);
  [1, 2].forEach((k) => all.forEach((s) => gone(s, k, k - 1)));
  // eve joins the game from Episode 3 (the couch's join route: couch-joins.ts joinStaged).
  const eve = S.addPlayer(parent, "eve", { stagesOpen: true });
  assert.equal(GhostLogic.begin(parent, eve.id, 3, []), null);
  GhostLogic.convert(parent, eve.id);
  // The stages in the spec's order, and the one taking a late joiner with a team to pick.
  assert.deepEqual(inSpecOrder(parent, [...kids].reverse()).map((k) => k.key), ["pre", "post"]);
  const { late, picks } = await lateStages(dbOf(kids), "zt-game", parent);
  assert.deepEqual(late.map((k) => k.key), ["pre"]);
  assert.equal(picks.key, "pre");
  // The game's write seats her in each: Pre-merge as its own late joiner (needing her start there), Post-merge in its draft.
  assert.equal(await seatStage(NO_ROWS, "zt-game", parent, "zt-pre", pre), true);
  assert.equal(await seatStage(NO_ROWS, "zt-game", parent, "zt-post", post), true);
  const inPre = pre.players.find((p) => p.id === eve.id);
  assert.ok(inPre && inPre.ghost && GhostLogic.needsStart(pre, eve.id), "Pre-merge: a late joiner choosing her start");
  assert.ok(post.draftOrder.includes(eve.id) && !post.players.find((p) => p.id === eve.id).lateJoin, "Post-merge: in its draft, as anyone");
  // Started live in Pre-merge with a team from who's free (its castaways are one team's each), and seen at once.
  const free = S.freeAgents(pre).map((c) => c.id);
  assert.equal(GhostLogic.begin(pre, eve.id, 3, [cid(pre, 0)], { freeAgents: true }), "Pick from who was still in the game", "ann's is taken");
  assert.equal(GhostLogic.begin(pre, eve.id, 3, free.slice(0, 2), { freeAgents: true }), null);
  GhostLogic.convert(pre, eve.id);
  assert.deepEqual(team(pre, eve.id), ["C8", "C9"]);
  // Her points from Episode 3 there; the overall is her stages' as they stand (Post-merge yet to start: nothing).
  [3, 4].forEach((k) => all.forEach((s) => gone(s, k, k + 6)));
  const rows = S.computeScores(pre);
  assert.ok(rows.find((r) => r.playerId === eve.id), "she's on Pre-merge's table");
  // Post-merge's draft opens with her in its rotation, so the exclusive count counts her: 5 of you × 2 is more than the 6 left.
  all.forEach((s) => S.settleStart(s, { from: 5, end: 5, open: 5 }));
  assert.deepEqual(S.settleDraftShare(post), { was: "snake", teams: 5, each: 2, pool: 8 });
  // A stage that's over seats nobody new: gus joins once Pre-merge is over, and is seated in Post-merge only.
  const gus = S.addPlayer(parent, "gus", { stagesOpen: true });
  if (gus.lateJoin) {
    assert.equal(GhostLogic.begin(parent, gus.id, 5, []), null);
    GhostLogic.convert(parent, gus.id);
  }
  assert.equal(StageLogic.joinsOf(pre), "over");
  assert.equal(await seatStage(NO_ROWS, "zt-game", parent, "zt-pre", pre), false, "nothing to write in a stage that's over");
  assert.equal(pre.players.some((p) => p.id === gus.id), false);
  await seatStage(NO_ROWS, "zt-game", parent, "zt-post", post);
  assert.ok(post.players.some((p) => p.id === gus.id));
  // And it's never a stage to write again (stagesToSeat agrees with seatStage).
  const { stagesToSeat } = stages();
  assert.deepEqual(await stagesToSeat(dbOf(kids), "zt-game", parent), []);
  // The overall: a stage they weren't in counts nothing for them.
  const walk = { stages: [walkStage("pre", pre, [{ episode: 4, over: true, rows: [{ playerId: "ann", points: 4, place: 1 }, { playerId: eve.id, points: 2, place: 2 }] }]), walkStage("post", post, [{ episode: 5, over: false, rows: [{ playerId: eve.id, points: 1, place: 1 }, { playerId: gus.id, points: 1, place: 1 }] }])] };
  gone(parent, 5, 11);
  const read = StageLogic.withWalk(parent, walk);
  const overall = StageLogic.overall(read);
  const of = (id) => overall.find((r) => r.playerId === id);
  assert.equal(of(gus.id).points, 1);
  assert.deepEqual(of(gus.id).stages.map((x) => x.points), [null, 1], "Pre-merge counts nothing for him");
  assert.equal(of(eve.id).points, 3);
});

test("a seat that leaves a begun stage and comes back is the same seat there; gone from a stage that hasn't begun, seated again on return", async () => {
  const { seatStage, stagesToSeat, stagesBegun } = stages();
  const { parent, kids } = staged();
  const [pre, post] = kids.map((k) => k.state);
  assert.equal(await stagesBegun(dbOf(kids), "zt-game"), false, "nothing begun: a seat leaving goes (backstage-members.ts freeSeat)");
  snake(pre);
  assert.equal(await stagesBegun(dbOf(kids), "zt-game"), true, "a stage has begun: the game keeps the seat, disabled");
  const mine = team(pre, "bo");
  // bo leaves: the game disables the seat (its account kept on it).
  S.disablePlayer(parent, "bo", "u-bo");
  assert.deepEqual(await stagesToSeat(dbOf(kids), "zt-game", parent), ["zt-pre", "zt-post"]);
  await seatStage(NO_ROWS, "zt-game", parent, "zt-pre", pre);
  await seatStage(NO_ROWS, "zt-game", parent, "zt-post", post);
  assert.equal(pre.players.find((p) => p.id === "bo").disabled, true, "left with his team in the begun stage");
  assert.deepEqual(team(pre, "bo"), mine);
  assert.equal(post.players.some((p) => p.id === "bo"), false, "gone from the stage still to begin");
  assert.deepEqual(await stagesToSeat(dbOf(kids), "zt-game", parent), [], "and nothing more to write");
  // He comes back (join-league.ts reclaims his own seat by his account): the same seat everywhere.
  S.reclaimPlayer(parent, "bo");
  assert.deepEqual(await stagesToSeat(dbOf(kids), "zt-game", parent), ["zt-pre", "zt-post"]);
  await seatStage(NO_ROWS, "zt-game", parent, "zt-pre", pre);
  await seatStage(NO_ROWS, "zt-game", parent, "zt-post", post);
  const back = pre.players.find((p) => p.id === "bo");
  assert.equal(back.disabled, false);
  assert.equal(back.name, "bo");
  assert.deepEqual(team(pre, "bo"), mine, "his team as he left it");
  assert.equal(pre.players.filter((p) => p.name === "bo" || p.formerName === "bo").length, 1, "never a second seat");
  assert.ok(post.draftOrder.includes("bo"), "in Post-merge's draft again, under the same id");
});

test("part 4b's item 8: a stage on another season that never starts is over once its league is, so the game can end", () => {
  const spec = {
    stages: [
      { id: "survivor", name: "Survivor", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, span: { from: 1, to: 10 } } },
      { id: "traitors", name: "The Traitors", season: { show: "the-traitors-us", number: 5 }, game: { preset: "survival-pool" } },
    ],
    overall: { by: "points" },
  };
  const parent = league(spec);
  assert.equal(StageLogic.crosses(parent), true);
  for (let k = 1; k <= 10; k++) gone(parent, k, k - 1);
  const done = { episode: 10, over: true, rows: [{ playerId: "ann", points: 5, place: 1 }] };
  const walk = (more) => ({ stages: [{ key: "survivor", leagueId: "zt-s", from: 1, to: 10, joins: "over", entries: [done] }, { key: "traitors", leagueId: "zt-t", from: null, to: null, season: "the-traitors-us/5", joins: "draft", entries: [], ...more }] });
  // Its season hasn't ended (or the viewer hasn't seen it end there): the game waits on it, as before.
  assert.equal(S.gameOver(StageLogic.withWalk(parent, walk())), false);
  assert.equal(StageLogic.standings(StageLogic.withWalk(parent, walk())).find((x) => x.key === "traitors").over, false);
  // Its league is over without its ever starting (its season ended first): over, counting nothing, and the game with it.
  const ended = StageLogic.withWalk(parent, walk({ ended: true }));
  const row = StageLogic.standings(ended).find((x) => x.key === "traitors");
  assert.deepEqual([row.started, row.over, row.rows], [false, true, []]);
  assert.equal(S.gameOver(ended), true);
  assert.deepEqual(StageLogic.overall(ended).find((r) => r.playerId === "ann").stages.map((x) => x.points), [5, null]);
});
