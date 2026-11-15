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
  return { x, s, snap: s.snapshot(), view: (p = x.viewerId) => s.project(x.gameId, p).game };
}
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
