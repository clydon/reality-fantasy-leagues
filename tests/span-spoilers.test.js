// BACKLOG 61 (the user's decision, 2026-11-14): a viewer's copy doesn't say where a game starts or ends by a phase of the season,
// nor who's on a team from a draft that opened at that start, until they've watched up to it (SpoilerLogic.spanAhead, unsettle,
// inside viewThrough). It said both: a stage "starts with Episode 4" tells someone on Episode 2 when the merge came, and its team
// who survived it. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const CTX = {
  show: "Survivor 51",
  season: "survivor/51",
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  phases: [{ id: "premerge", name: "Pre-merge" }, { id: "merged", name: "Merged" }],
};
const SEATS = ["ann", "bo", "cy"];
function league(spec, { n = 12, eps = 6 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = SEATS.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ep = (s, k) => s.episodes.find((e) => e.number === k);
const gone = (s, k, i) => S.addElimination(s, ep(s, k).id, s.castaways[i].id, "Voted Out");
const view = (s, n) => S.SpoilerLogic.viewThrough(s, n);
const owned = (s) => s.castaways.filter((c) => (c.ownerIds || []).length).length;
/** A shared lineup's teams as a private draft leaves them once it's revealed: each seat three of who's still in. */
function drafted(s) {
  const still = s.castaways.filter((c) => c.status === "active");
  SEATS.forEach((p, i) => [0, 1, 2].forEach((k) => still[(i + k) % still.length].ownerIds.push(p)));
  s.blindDraft = { lockedPlayerIds: [...SEATS], revealedAt: "2099-01-04T00:00:00.000Z" };
}
/** Episodes 1 to 3 played (the merge comes in Episode 3), someone gone in each. */
function played(s) {
  [1, 2, 3].forEach((k) => gone(s, k, k - 1));
}

test("a later stage: its start, its team and its lineup stay out of the copy of someone who hasn't watched up to it", () => {
  const spec = G.fullSpec({ preset: "weekly-lineup", span: { from: { phase: "merged" }, to: null } });
  spec.extras = { ...spec.extras, draft: { ...(spec.extras.draft || {}), opens: "start" } };
  const s = league(spec);
  played(s);
  // The merge is confirmed in Episode 3: the stage plays from Episode 4, and its draft opens on Episode 3's results.
  assert.deepEqual(S.settleStart(s, { from: 3, open: 4 }), []);
  assert.equal(S.startEpisode(s), 4);
  assert.equal(S.DraftLogic.waits(s), null);
  drafted(s);
  const mine = s.castaways.filter((c) => c.ownerIds.includes("ann")).map((c) => c.id);
  assert.equal(S.setActiveRosterLineup(s, ep(s, 4).id, "ann", mine.slice(0, 2)), true);
  const before = JSON.stringify(s);

  for (const mark of [0, 1, 2]) {
    const v = view(s, mark);
    assert.equal(S.startEpisode(v), null, `through ${mark}: no start`);
    assert.equal(G.spanPhase(S.gameOf(v).span), "merged", "it waits for its phase, as it did before the merge was known");
    assert.equal(owned(v), 0, `through ${mark}: nobody on a team`);
    assert.equal(S.DraftLogic.begun(v), false);
    assert.ok(S.DraftLogic.waits(v), "the draft isn't open in their copy");
    assert.deepEqual(ep(v, 4).lineups, {}, "no lineup for an episode of it");
    assert.equal(S.ActiveRosterLogic.validateLineup(v, ep(v, 4).id, "ann", []) !== null, true, "nothing to set");
  }
  // Seen the episode before it: it's as it is.
  for (const mark of [3, 4]) {
    const v = view(s, mark);
    assert.equal(S.startEpisode(v), 4, `through ${mark}`);
    assert.equal(owned(v), owned(s));
    assert.deepEqual(ep(v, 4).lineups.ann, mine.slice(0, 2));
  }
  assert.equal(S.startEpisode(view(s, null)), 4, "no mark: everything");
  assert.equal(JSON.stringify(s), before, "the league itself is untouched");
  // A seat's own copy (GhostLogic.viewFor) is cut the same way.
  assert.equal(S.startEpisode(S.GhostLogic.viewFor(s, "ann", 2)), null);
  assert.equal(owned(S.GhostLogic.viewFor(s, "ann", 2)), 0);
});

test("the stage before it: where it ends stays out until they've seen its last episode; its teams are as they were", () => {
  const s = league(G.fullSpec({ preset: "weekly-lineup", span: { from: 1, to: { phase: "merged" } } }));
  drafted(s);
  played(s);
  assert.deepEqual(S.settleStart(s, { end: 3, open: 4 }), []);
  assert.equal(S.endEpisode(s), 3);
  for (const mark of [0, 1, 2]) {
    const v = view(s, mark);
    assert.equal(S.endEpisode(v), null, `through ${mark}: no end`);
    assert.equal(G.spanEndPhase(S.gameOf(v).span), "merged");
    assert.equal(S.startEpisode(v), 1);
    assert.equal(owned(v), owned(s), "a team drafted as the season started says nothing");
  }
  assert.equal(S.endEpisode(view(s, 3)), 3);
  assert.equal(S.endEpisode(view(s, 5)), 3);
});

test("a game from a phase whose draft was made any time: its start waits, its teams stay", () => {
  const spec = G.fullSpec({ preset: "weekly-lineup", span: { from: { phase: "merged" }, to: null } });
  spec.extras = { ...spec.extras, draft: { ...(spec.extras.draft || {}), opens: "any" } };
  const s = league(spec);
  drafted(s);
  played(s);
  assert.deepEqual(S.settleStart(s, { from: 3, open: 4 }), []);
  const v = view(s, 1);
  assert.equal(S.startEpisode(v), null);
  assert.equal(owned(v), owned(s));
});

test("a game that starts and ends at episodes is cut as before: the same state when nothing's hidden", () => {
  const s = league(G.fullSpec({ preset: "weekly-lineup" }));
  drafted(s);
  played(s);
  assert.equal(view(s, 3), s, "nothing hidden: no copy");
  assert.equal(S.SpoilerLogic.spanAhead(s, 0), null);
  assert.equal(S.startEpisode(view(s, 1)), 1);
});

test("a game in stages' own summary: a stage's start and end the season set are cut at the mark; ones the game fixes aren't", () => {
  const entries = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => ({ episode: a + i, over: false, rows: [] }));
  const walk = {
    stages: [
      { key: "before", leagueId: "a", from: 1, to: 3, entries: entries(1, 3) },
      { key: "after", leagueId: "b", from: 4, to: 8, entries: entries(4, 6) },
      { key: "fixed", leagueId: "c", from: 5, to: 6, entries: entries(5, 6) },
    ],
  };
  const stages = [
    { id: "before", game: { span: { from: 1, to: { phase: "merged" } } } },
    { id: "after", game: { span: { from: { phase: "merged" }, to: null } } },
    { id: "fixed", game: { span: { from: 5, to: 6 } } },
  ];
  const at = (n) => Object.fromEntries(S.StageLogic.cutWalk(walk, n, stages).stages.map((st) => [st.key, [st.from, st.to, st.entries.length]]));
  // Through Episode 2 (the merge came in 3): the first stage's end and the next one's start aren't theirs to know.
  assert.deepEqual(at(2), { before: [1, null, 2], after: [null, null, 0], fixed: [5, 6, 0] });
  // Through Episode 3: the stage that starts with 4 is known; where it ends (the season said, at 8) isn't yet.
  assert.deepEqual(at(3), { before: [1, 3, 3], after: [4, null, 0], fixed: [5, 6, 0] });
  assert.deepEqual(at(8), { before: [1, 3, 3], after: [4, 8, 3], fixed: [5, 6, 2] });
  // Without the game's stages (an older caller): the entries alone, as before.
  assert.deepEqual(S.StageLogic.cutWalk(walk, 2).stages.map((st) => [st.from, st.to, st.entries.length]), [[1, 3, 2], [4, 8, 0], [5, 6, 0]]);
});

test("a later stage the game starts at a fixed episode: its start is the game's rule, its team still isn't theirs to see", () => {
  const spec = G.fullSpec({ preset: "weekly-lineup", span: { from: 4, to: null } });
  spec.extras = { ...spec.extras, draft: { ...(spec.extras.draft || {}), opens: "start" } };
  const s = league(spec);
  played(s);
  assert.equal(S.DraftLogic.waits(s), null, "Episode 3's results opened its draft");
  drafted(s);
  const mine = s.castaways.filter((c) => c.ownerIds.includes("ann")).map((c) => c.id);
  assert.equal(S.setActiveRosterLineup(s, ep(s, 4).id, "ann", mine.slice(0, 2)), true);
  for (const mark of [0, 1, 2]) {
    const v = view(s, mark);
    assert.equal(S.startEpisode(v), 4, "through " + mark + ": the start the game fixed is known to everyone");
    assert.equal(owned(v), 0, "through " + mark + ": nobody on a team drawn from who was still in after Episode 3");
    assert.ok(S.DraftLogic.waits(v), "in their copy the draft opens once Episode 3's results are in");
    assert.deepEqual(ep(v, 4).lineups, {});
  }
  assert.equal(owned(view(s, 3)), owned(s));
  assert.deepEqual(ep(view(s, 3), 4).lineups.ann, mine.slice(0, 2));
});
