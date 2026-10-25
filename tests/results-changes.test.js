// Results changes and how they're taken back (src/lib/game/results-changes.ts, docs/PLAN-new-design.md step 5): the
// diff a results write records and its undo, exactly; what applies on its own (option 5B: the quick check's verdict,
// which staged results are trusted); and the tier-2 preview of what an apply does to a game's table. Runs on made-up
// demo seasons, so no database is needed. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const { applyDecision } = jiti("../src/lib/game/decision-apply.ts");
const { resultsDiff, undoResults, quickVerdict, trustRows, exitMethodFor, previewLines } = jiti("../src/lib/game/results-changes.ts");
const S = require("../src/lib/game/state-logic.js");

const EPISODES = 12;
const CURSOR = 5; // results through episode 5; episode 6 has nothing in yet
const data = {
  id: "test", showId: "survivor", showName: "Test", seasonName: "Test", episodeCount: EPISODES,
  players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
  castaways: Array.from({ length: 18 }, (_, i) => ({
    key: `k${i}`, name: `Castaway ${i}`, placement: i + 1,
    exitEpisode: Math.min(i + 1, EPISODES), exitMethod: i === 17 ? "Sole Survivor" : "Voted Out",
  })),
};
const league = (type) => S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, type, CURSOR))));
const clone = (s) => JSON.parse(JSON.stringify(s));
const fact = (kind, name, extra = {}) => ({ episode_number: 6, post_merge: false, kind, castaway_name: name, method: "", event_type: "", jury_votes: null, units: null, applied: null, ...extra });
const ep6 = (s) => s.episodes.find((e) => e.number === 6);
// What undo has to put back exactly: the episode's results and stage, and everyone's status and placement.
const resultsOf = (s) => ({
  ep: (({ events, scoringEvents, roles, groups, exiled, resultsStage }) => ({ events, scoringEvents, roles, groups, exiled, resultsStage }))(ep6(s) || {}),
  cast: s.castaways.map((c) => [c.id, c.status, c.placementOrder ?? null, c.exitEpisodeId ?? null]),
});

test("who went home and the full results are recorded as a diff and taken back exactly, stage included", () => {
  for (const type of ["classic-draft", "active-roster", "pickem"]) {
    const before = league(type);
    const quick = clone(before);
    applyDecision(quick, fact("elimination", "Castaway 5", { method: "Voted Out" }), []);
    S.setResultsStage(quick, ep6(quick).id, "early");
    const q = resultsDiff(before, quick, 6);
    assert.equal(q.added.length, 1, type);
    assert.equal(q.stageBefore, null);
    assert.equal(S.resultsStage(ep6(quick)), "early");

    const full = clone(quick);
    applyDecision(full, fact("event", "Castaway 7", { event_type: "individualImmunity" }), []);
    applyDecision(full, fact("event", "Castaway 9", { event_type: "idolFound" }), []);
    S.setResultsStage(full, ep6(full).id, "final");
    const f = resultsDiff(quick, full, 6);
    assert.equal(f.added.length, 2, type);
    assert.equal(f.stageBefore, "early");

    // The full results come off and the episode is back at its early stage; then who went home comes off too.
    const undone = clone(full);
    undoResults(undone, f);
    assert.deepEqual(resultsOf(undone), resultsOf(quick), `${type}: back to early`);
    undoResults(undone, q);
    assert.deepEqual(resultsOf(undone), resultsOf(before), `${type}: back to nothing`);
  }
});

test("a removal is recorded too, and its undo puts it back", () => {
  const before = league("classic-draft");
  const ep5 = before.episodes.find((e) => e.number === 5);
  const out = ep5.events[0];
  const after = clone(before);
  S.removeElimination(after, ep5.id, out.castawayId);
  const d = resultsDiff(before, after, 5);
  assert.deepEqual(d.removed.map((r) => [r.kind, r.castawayId, r.method]), [["elimination", out.castawayId, out.method]]);
  undoResults(after, d);
  assert.deepEqual(after.episodes.find((e) => e.number === 5).events.map((e) => [e.castawayId, e.method]), [[out.castawayId, out.method]]);
  assert.equal(S.getCastaway(after, out.castawayId).status, "eliminated");
});

test("nothing changed is no change", () => {
  const s = league("pickem");
  assert.equal(resultsDiff(s, clone(s), 6), null);
});

const SURVIVOR_EXITS = ["Voted Out", "Medically Evacuated", "Quit", "Lost Fire-Making", "Lost Final Tribal (Jury Vote)", "Sole Survivor", "Other"];
const quick = (left, sources = 2, found = true) => ({ found, left, headline: "x", sources: Array.from({ length: sources }, (_, i) => `https://s${i}.example`) });

test("the quick check applies on its own only when it's sure", () => {
  const ok = quickVerdict(quick([{ name: "Castaway 5", how: "voted out", matched: true }]), SURVIVOR_EXITS);
  assert.equal(ok.trusted, true);
  assert.deepEqual(ok.out, [{ name: "Castaway 5", method: "Voted Out" }]);
  assert.equal(quickVerdict(quick([{ name: "Castaway 5", how: null, matched: true }]), SURVIVOR_EXITS).trusted, true, "no how: the usual way out");
  assert.equal(quickVerdict(quick([{ name: "Someone", how: "Voted Out", matched: false }]), SURVIVOR_EXITS).doubt, "unknown-name");
  assert.equal(quickVerdict(quick([{ name: "Castaway 5", how: "Voted Out", matched: true }], 1), SURVIVOR_EXITS).doubt, "one-source");
  assert.equal(quickVerdict(quick([{ name: "Castaway 5", how: "a twist", matched: true }]), SURVIVOR_EXITS).doubt, "how");
  assert.equal(quickVerdict(quick([], 2), SURVIVOR_EXITS).doubt, "nobody");
  assert.equal(quickVerdict(quick([], 0, false), SURVIVOR_EXITS).doubt, "not-found");
  assert.equal(exitMethodFor("Medically evacuated after a fall", SURVIVOR_EXITS), "Medically Evacuated");
});

test("staged results: high confidence applies, the rest waits, and so does a disagreement about who went home", () => {
  const row = (kind, castawayName, confidence = "high", status = "pending") => ({ kind, castawayName, confidence, status });
  const rows = [
    row("event", "Ana"),
    row("event", "Bo", "medium"),
    row("event", "Cy"),
    row("elimination", "Dee"),
    row("elimination", "Eve"),
    row("event", "Fay", "high", "rejected"),
  ];
  const { trusted, waiting } = trustRows(rows, { disputed: new Set(["cy"]), out: ["Dee"] });
  assert.deepEqual(trusted.map((r) => r.castawayName), ["Ana", "Dee"]);
  assert.deepEqual(waiting.map((r) => r.castawayName), ["Bo", "Cy", "Eve"], "medium, disputed, and an out the quick check didn't name");
  assert.deepEqual(trustRows(rows.slice(3, 5)).trusted.length, 2, "with nobody out yet, both apply");
});

test("the preview says who goes out, whose team loses them, and who moves", () => {
  const before = league("classic-draft");
  const owner = S.computeScores(before).find((r) => r.roster.some((c) => c.status !== "eliminated"));
  const target = owner.roster.find((c) => c.status !== "eliminated");
  const after = clone(before);
  applyDecision(after, fact("elimination", target.name, { method: "Voted Out" }), []);
  const lines = previewLines(before, after, "Outlast", () => null);
  assert.equal(lines[0].face.kind, "castaway");
  assert.equal(lines[0].label, `${target.name} out · Outlast`);
  assert.match(lines[0].change, new RegExp(`${owner.name} loses them`));
  assert.ok(lines.every((l) => l.label && (l.face.kind === "castaway" || l.change)));
});
