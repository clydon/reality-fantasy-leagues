// The first redesign page's situations (tools/gameplay-bench/explorer/situations.cjs; docs/GAME-PAGE-SITUATIONS.md): each is a
// definition and the runtime actions that bring it there, and each must be what it says it is. Every situation is built (its
// steps played once by the runtime, so a refused step fails), played again from its definition the way the explorer page plays it,
// and held to its own claims on the viewer's projection: who they play, whether a lineup is due, set or locked, what they've been
// told, the playoffs, a champion, a week in progress. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const root = path.join(__dirname, "..");
const Sit = require(path.join(root, "tools/gameplay-bench/explorer/situations.cjs"));
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));
const P = require(path.join(root, "tools/gameplay-bench/explorer/runtime-profile.cjs"));
const Sports = require(path.join(root, "tools/gameplay-bench/explorer/runtime-sports.cjs"));

/** Open a situation as the explorer page does: its definition, then its steps. Returns { s, snap, view(personId) }. */
function opened(id) {
  const x = Sit.build(id), s = R.open(x.input);
  for (const a of x.steps) assert.equal(s.apply(a).status, "accepted", id + ": " + JSON.stringify(a).slice(0, 120));
  return { x, s, snap: s.snapshot(), view: (p = x.viewerId, gameId = x.gameId) => s.project(gameId, p).game };
}
/** A game's latest waiver week (its state's), and who lost someone (a castaway of theirs gone home and not replaced). */
const week = (snap, gameId = "h2h") => { const ps = snap.games[gameId].state.midSeason.waivers.periods; return ps[ps.length - 1]; };
const lost = (snap, personId, gameId = "h2h") => snap.games[gameId].state.castaways.filter((c) => c.ownerIds.includes(personId) && c.status !== "active");
/** An exclusive draft: nobody's castaway on two teams. */
const exclusive = (snap, gameId = "h2h") => assert.ok(snap.games[gameId].state.castaways.every((c) => c.ownerIds.length <= 1), "nobody on two teams");
const CLAIMS = {
  "show-due": ({ view }) => { const v = view(); assert.ok(v.lineup && !v.lineup.set && !v.lineup.locked, "a lineup due"); assert.ok(v.matchups.next?.opponent, "this week's opponent"); assert.equal(v.matchups.last.episode, 3); },
  "show-set": ({ view }) => { const v = view(); assert.ok(v.lineup.set && !v.lineup.locked, "set, not locked"); assert.ok(v.matchups.next?.opponent); },
  "show-locked": ({ view, snap }) => { const v = view(); assert.ok(!v.lineup || v.lineup.locked || v.lineup.episode > 4, "nothing open for the aired episode"); assert.equal(snap.contexts.show.events[3].resultStatus, "unavailable", "no results yet"); assert.ok(Date.parse(snap.clock) > Date.parse(snap.contexts.show.events[3].airAt)); },
  "show-early": ({ snap }) => assert.equal(snap.contexts.show.events[3].resultStatus, "partial", "early results"),
  "show-results": ({ view }) => { const v = view(); assert.equal(v.matchups.last.episode, 4); assert.ok(["win", "loss", "tie"].includes(v.matchups.last.result), "decided: " + v.matchups.last.result); },
  "show-behind": ({ view, snap }) => { assert.equal(snap.contexts.show.marks.find((m) => m.personId === "ann").through, 3); assert.ok(view().matchups.last.episode <= 3, "nothing past her mark"); assert.equal(view("bo").matchups.last.episode, 5, "Bo has seen 5"); },
  "show-friend-behind": ({ view, snap }) => { const last = view().matchups.last; assert.equal(last.episode, 4); assert.ok(last.opponent); assert.equal(snap.contexts.show.marks.find((m) => m.personId === last.opponent).through, 3, "her opponent hasn't watched it"); },
  "show-quiet": ({ view }) => { const v = view(); assert.equal(v.matchups.last.episode, 4); assert.equal(v.matchups.last.result, null, "a night that counts for nobody"); },
  "show-playoffs": ({ view }) => { const p = view().matchups.playoffs; assert.ok(p && p.seeds && p.seeds.length === 2, "seeded"); assert.equal(p.champion, null, "the final still to come"); assert.ok(["ann", "bo", "cy", "di"].some((id) => !view(id).matchups.record.alive), "someone out of the playoffs"); },
  "show-champion": ({ view }) => { const p = view().matchups.playoffs; assert.ok(p.champion, "a champion"); },
  "show-long-names": ({ snap }) => assert.ok(snap.people.every((p) => p.name.length > 30)),
  "show-solo": ({ view }) => { const v = view(); assert.equal(v.table.length, 1); assert.equal(v.matchups, null); },
  // The pilot with an exclusive draft and waivers: nobody's castaway on two teams; the week after Episode 4 open, Ann owed a
  // replacement, Bo's swap in; live, both claims wait for the week's time; at its own pace Ann's claim runs it at once.
  "xw-waivers-open": ({ view, snap }) => { exclusive(snap); const p = week(snap); assert.equal(p.episode, 4); assert.equal(p.phase, "open"); assert.ok(lost(snap, "ann").length, "Ann lost someone in Episode 4"); assert.deepEqual(p.claimsIn, ["bo"], "Bo's claim in, Ann's not yet"); assert.ok(view().matchups.next?.opponent, "this week's opponent"); },
  "xw-claims-in": ({ snap }) => { exclusive(snap); const p = week(snap); assert.equal(p.phase, "open", "waiting for its time"); assert.ok(Date.parse(p.processAt) > Date.parse(snap.clock)); assert.deepEqual([...p.claimsIn].sort(), ["ann", "bo"]); assert.equal(JSON.stringify(snap.games.h2h.state).includes('"pairs"'), false, "no claim in the league's state"); },
  "xw-waivers-run": ({ view, snap }) => { exclusive(snap); const p = week(snap); assert.equal(p.phase, "processed", "run the moment everyone owed claimed"); assert.ok(Date.parse(p.processAt) > Date.parse(snap.clock), "before its time"); const st = snap.games.h2h.state; assert.equal(st.castaways.filter((c) => c.ownerIds.includes("ann") && c.status === "active").length, 3, "Ann's loss replaced"); assert.ok(view().lineup && !view().lineup.locked, "the next lineup due"); },
  "nfl-real-pool-due": ({ view, snap }) => { const w = snap.contexts.sport; assert.equal(w.participants.length, 344); assert.equal(w.context.athletes, "real"); const roleOf = (id) => w.participants.find((p) => p.id === id).role; const ep = snap.games.g.state.episodes.find((e) => e.id === view().lineup.epId); for (const p of ["bo", "cy"]) { const r = ep.lineups[p].map(roleOf); assert.equal(r.filter((x) => x === "QB").length, 1, p + " starts one quarterback"); assert.ok(r.length === 9 && r.includes("PK") && r.includes("DEF") && r.includes("TE") && r.filter((x) => x === "RB").length >= 2 && r.filter((x) => x === "WR").length >= 2, p + " fills every slot by position: " + r.join(",")); } assert.ok(view().lineup && !view().lineup.locked, "Ann's lineup open"); },
  "nfl-waivers-open": ({ snap }) => { const w = snap.contexts.sport, st = snap.games.g.state; assert.equal(w.participants.length, 344); assert.ok(st.castaways.filter((c) => !c.ownerIds.length).length >= 290, "some 300 free agents"); const p = week(snap, "g"); assert.equal(p.phase, "open"); assert.equal(p.swaps, 2); assert.deepEqual(p.claimsIn, ["bo"]); },
  // The staged pilot: two stages split at the merge (Episode 4), each head to head with its own draft and record.
  "staged-before-merge": ({ view }) => { const a = view(undefined, "h2h~before"), b = view(undefined, "h2h~merged"); assert.ok(a.lineup && !a.lineup.locked && a.lineup.episode === 4, "the first stage's lineup due"); assert.ok(a.matchups.next?.opponent); assert.equal(b.from, null, "the merged stage not started"); assert.equal((b.you?.team || []).length, 0, "nobody drafted there yet"); },
  "staged-merged": ({ view }) => { const a = view(undefined, "h2h~before"), b = view(undefined, "h2h~merged"); assert.equal(a.to, 4); assert.ok(a.over, "the first stage over"); assert.equal(a.matchups.playoffs, null, "no playoff before the merge"); assert.equal(b.from, 5); assert.equal((b.you?.team || []).length, 3, "drafted from who's still in"); assert.deepEqual([b.matchups.record.wins, b.matchups.record.losses, b.matchups.record.ties], [0, 0, 0], "a fresh record"); assert.equal(b.matchups.next?.episode, 5); assert.ok(b.lineup && !b.lineup.locked && b.lineup.episode === 5); },
  "staged-champion": ({ view }) => { const b = view(undefined, "h2h~merged"), v = view(); assert.ok(b.over && b.matchups.playoffs?.champion, "the merged stage's champion"); assert.ok(v.over, "the game over with its last stage"); const sum = (id) => ["h2h~before", "h2h~merged"].reduce((n, g) => n + view(undefined, g).table.find((r) => r.playerId === id).total, 0); for (const r of v.table) assert.equal(r.total, sum(r.playerId), "the overall is " + r.playerId + "'s stages added up"); },
  "show-side-bets": ({ view }) => {
    const v = view(), b = v.bets;
    assert.ok(b, "side bets are on");
    const open = b.bets.find((x) => x.open), toSettle = b.bets.find((x) => x.played);
    assert.equal(open?.episode, 5, "this week's bet open to call");
    assert.equal(open.mine, null, "not called by the viewer");
    assert.equal(open.everyone, null, "others' calls hidden before it starts");
    assert.equal(toSettle?.episode, 4, "last episode's bet played");
    assert.equal(toSettle.everyone.length, 3, "everyone's calls shown once locked");
    assert.equal(b.unsettled, 3, "three calls to settle");
    assert.equal(b.postTo, 5, "a new bet goes on Episode 5");
  },
  "nfl-due": ({ view }) => { const v = view(); assert.ok(v.lineup && !v.lineup.locked, "a lineup open"); assert.ok(v.matchups.next, "this week's matchup"); },
  "nfl-results-told": ({ view, snap }) => { assert.equal(snap.contexts.sport.marks.find((m) => m.personId === "ann").through, 1); assert.equal(view().matchups.last.episode, 2, "told game 2 though she hasn't marked it"); },
  "nfl-hides-behind": ({ view }) => assert.equal(view().matchups.last.episode, 1, "held to her mark"),
  "nfl-cancelled": ({ view, snap }) => { assert.equal(snap.contexts.sport.events[2].resultStatus, "cancelled"); const v = view(); assert.equal(v.matchups.last.episode, 3); assert.equal(v.matchups.last.result, null); assert.equal(v.lineup.episode, 4); },
  "nba-week-in-progress": ({ snap, view }) => { const w = snap.contexts.sport, week = w.events[1]; assert.equal(week.resultStatus, "unavailable"); assert.equal(Object.keys(w.facts.find((f) => f.eventId === week.id).data.games).length, 1, "one game final"); assert.ok(view().lineup?.eachGame, "a lineup locking game by game"); },
};

test("every situation has claims, and every claim a situation", () => {
  assert.deepEqual(Sit.list().map((x) => x.id).sort(), Object.keys(CLAIMS).sort());
  for (const x of Sit.list()) assert.ok(x.label && x.shows && ["show", "sport"].includes(x.page), x.id);
});
for (const { id } of Sit.list()) test(`situation ${id}: it opens without a gap, its steps replay, and it is what it says`, () => {
  const o = opened(id);
  try {
    assert.deepEqual(P.inspect(o.x.input).gaps, [], "no gap");
    CLAIMS[id](o);
  } finally { o.s.dispose(); }
});
test("the bench's Publish and a situation's results are one function: a slate's week publishes (it threw without its event)", () => {
  const { resultsData } = require(path.join(root, "tools/gameplay-bench/explorer/publish.cjs"));
  const o = opened("nba-week-in-progress");
  try {
    const w = o.snap.contexts.sport, d = resultsData(o.snap, o.s.export().input, "sport", w.events[2].id, "final");
    assert.deepEqual(Object.keys(d.games).sort(), Sports.gamesOf(w.context, w.events[2]).map((g) => g.id).sort());
  } finally { o.s.dispose(); }
});
