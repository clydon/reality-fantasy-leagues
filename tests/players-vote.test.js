// The players' vote on a format change (docs/PLAN-start-a-game-gpt.md step A14 part 1: the dial row answer.vote, "a vote among the
// players"; A12 part 2's extras.changes.ok 'vote', which waited for it): a stage a format change starts (or a side stage) waits for
// the game's seats to vote, as it waits for the maker's OK, until the lock of the episode it would start with. Each seat votes start
// or skip (StateLogic.StageLogic.vote, on the change's votes so far: the server keeps them, stage_change_votes, never the state),
// changeable until it's decided: once more than half of them say the same, it is (recorded on the game, so nobody joining or leaving
// later moves it); at the lock the votes cast decide (the plan's input: every one cast), a tie or nobody voting the game's default.
// The maker's own answer stands over it. Its spec and words; the plan at each step; who votes (no late joiner on a season of their
// own, no computer player); a side stage too. No database: the server's side (change-stages.ts voteChange, the stage-changes route)
// is scripts/dev-test/check-players-game.js's. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const TL = require("../src/lib/game/formats/format-timeline.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");

const { StageLogic } = S;
const CTX = {
  show: "The Challenge 42",
  moments: [{ id: "dailyWin", label: "Won the daily", defaultPoints: 2, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  phases: [{ id: "game", name: "The game" }, { id: "final", name: "The final" }],
};
const SEATS = ["ann", "bo", "cy", "di"];
const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const SOLO = { id: "solo", name: "Solo", game: { preset: "outlast", get: DRAFT, span: { from: 1 } } };
const REDRAFT = { id: "re", name: "New draft", on: { change: ["split-into-individuals", "pairs-formed"], again: true }, game: { preset: "outlast", get: DRAFT } };
const voting = (unanswered = "carry-on") => ({ stages: [SOLO, REDRAFT], extras: { changes: { ok: "vote", unanswered } } });

/** A league of `n` castaways C0.. and seats `people`, its game `spec` through setGame, Episodes 1 to `eps` made. */
function league(spec, { n = 16, people = SEATS, eps = 12 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = people.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
// Made-up research (change-stages.test.js's): paired, then everyone on their own from 6 (said at 5's end).
const pair = (...members) => ({ name: null, members });
function report(episode, groups, { changes = [], playedAs = "pairs" } = {}) {
  return { episode, left: [], merged: null, state: { playedAs, phase: null, groups, alone: [], newcomers: [], wentHomeAs: "nobody", changes } };
}
const change = (kind, from) => ({ kind, from, when: "end", what: `${kind} from ${from}`, sure: "high" });
const CAST = "ABCDEFGH".split("");
const P1 = [pair("A", "B"), pair("C", "D"), pair("E", "F"), pair("G", "H")];
const TLINE = TL.buildTimeline([report(1, P1), report(2, P1), report(3, P1), report(4, P1), report(5, [], { changes: [change("split-into-individuals", 6)] })], { cast: CAST });
const KEY = "re@5:split-into-individuals";
const triggersOf = (state) => Object.fromEntries(StageLogic.onStages(state).map((st) => [st.id, TL.stageTriggers(TLINE, G.stageOn(st).change)]));
/** The votes as the server keeps them (stage_change_votes), per league: { key: { playerId: vote } }. */
const BOX = new WeakMap();
const box = (s) => (BOX.has(s) ? BOX.get(s) : BOX.set(s, {}).get(s));
/** A seat's vote as voteChange takes it: StageLogic.vote on the change's votes so far, kept when it's taken. */
function cast(s, key, what, playerId, at) {
  const b = box(s);
  const problem = StageLogic.vote(s, key, what, playerId, b[key] || {}, at);
  if (!problem) b[key] = { ...(b[key] || {}), [playerId]: what };
  return problem;
}
/** The plan, with the votes cast counted as the server counts them (readGame's input.votes). */
function plan(state, more = {}) {
  const votes = Object.fromEntries(Object.entries(box(state)).map(([k, b]) => [k, (({ start, skip }) => ({ start, skip }))(StageLogic.tally(state, b))]));
  return StageLogic.changePlan(state, { triggers: triggersOf(state), starts: { solo: 1 }, copies: {}, open: 6, last: 12, votes, ...more });
}
const spans = (p) => p.entries.map((e) => [e.key, e.from, e.to]);
/** The game as the season sync leaves it once it has seen the change (its record's `seen`). */
function seen(s) {
  s.changeStages = { seen: plan(s).seen };
  return s;
}

test("its spec, our check and its words: the players vote, the game's default on a tie or none", () => {
  assert.deepEqual(G.specProblems(voting(), CTX), []);
  assert.deepEqual(G.specWaitsFor(voting()), [], "the players' vote plays now");
  assert.deepEqual(G.fullSpec(voting()).extras.changes, { ok: "vote", unanswered: "carry-on" });
  const words = describeSpec(voting(), CTX).rules.join(" ");
  assert.match(words, /You vote on whether a new stage starts: once more than half of you say the same, that's it; else the most votes by its first episode decide, and a tie or no votes carries the game on as it is\. Whoever runs the game can still call it off\./);
  assert.match(describeSpec(voting("start"), CTX).rules.join(" "), /a tie or no votes starts it anyway/);
  // A side stage's words too.
  const side = { stages: [SOLO, { id: "side", name: "Pairs draft", side: { held: 2 }, game: { preset: "outlast", get: DRAFT } }], extras: { changes: { ok: "vote", unanswered: "start" } } };
  assert.deepEqual(G.specProblems(side, CTX), []);
  assert.match(describeSpec(side, CTX).rules.join(" "), /Pairs draft: you vote on whether it opens: .*a tie or no votes opens it anyway/);
});

test("who votes, and a vote: each seat but a late joiner on a season of their own or a computer player, changeable until more than half say the same", () => {
  const s = seen(league(voting(), { people: ["ann", "bo", "cy", "di", "ed"] }));
  s.players.push({ id: "late", name: "Late", color: "#000", ghost: true }, { id: "bot", name: "Bot", color: "#000", automated: true });
  s.players.find((p) => p.id === "ed").disabled = true;
  assert.deepEqual(StageLogic.voters(s), ["ann", "bo", "cy", "di"], "no ghost, no computer player, nobody disabled");
  assert.equal(cast(s, KEY, "maybe", "ann"), "Vote 'start' or 'skip'");
  assert.equal(cast(s, "other@5:merge", "start", "ann"), "That isn't one of this game's format changes");
  for (const id of ["late", "bot", "ed"]) assert.equal(cast(s, KEY, "start", id), "Only a seat in the game votes", id);
  assert.equal(cast(s, KEY, "start", "ann", "2026-10-31T10:00:00Z"), null);
  assert.equal(cast(s, KEY, "skip", "bo"), null);
  assert.deepEqual(StageLogic.tally(s, box(s)[KEY]), { start: 1, skip: 1, voted: 2, of: 4, decided: null });
  assert.equal(JSON.stringify(s).includes('"skip"'), false, "the votes are never in the state (every route returns it whole)");
  // Changed before it's decided.
  assert.equal(cast(s, KEY, "start", "bo"), null);
  assert.equal(StageLogic.tally(s, box(s)[KEY]).decided, null, "two of four isn't more than half");
  assert.equal(StageLogic.changeRecord(s).decided[KEY], undefined);
  assert.equal(cast(s, KEY, "start", "cy", "2026-10-31T11:00:00Z"), null);
  assert.deepEqual(StageLogic.changeRecord(s).decided[KEY], { do: "start", by: "vote", at: "2026-10-31T11:00:00Z" }, "three of four: decided, recorded on the game");
  assert.equal(cast(s, KEY, "skip", "di"), "It's been decided");
  // A game that doesn't vote.
  const maker = league({ stages: [SOLO, REDRAFT], extras: { changes: { ok: "maker" } } });
  assert.equal(cast(maker, KEY, "start", "ann"), "This game's players don't vote on its format changes");
  assert.equal(cast(league({ preset: "outlast" }), KEY, "start", "ann"), "This game's players don't vote on its format changes");
});

test("the plan: waiting for the vote until the lock; decided early it starts on time; at the lock the votes cast; a tie the default", () => {
  // Seen at 6's lock: it waits for the vote until 6 starts.
  const s = seen(league(voting()));
  const p = plan(s);
  assert.deepEqual(spans(p), [["solo", 1, null]]);
  assert.deepEqual(p.pending.map((x) => [x.key, x.until]), [[KEY, 6]]);
  // More than half say start before the lock: it starts from 6, as the maker's start would.
  ["ann", "bo", "cy"].forEach((id) => assert.equal(cast(s, KEY, "start", id), null));
  assert.deepEqual(spans(plan(s)), [["solo", 1, 5], [KEY, 6, null]]);
  // More than half say skip: never started.
  const k = seen(league(voting("start")));
  ["ann", "bo", "cy"].forEach((id) => cast(k, KEY, "skip", id));
  assert.deepEqual(spans(plan(k, { open: 7 })), [["solo", 1, null]]);
  assert.deepEqual(plan(k, { open: 7 }).skipped.map((x) => x.key), [KEY]);
  // Not decided by the lock: the votes cast decide, from the first episode still open (one later than it would have started).
  const m = seen(league(voting()));
  cast(m, KEY, "start", "ann");
  assert.deepEqual(spans(plan(m)), [["solo", 1, null]], "one of four before the lock: still waiting");
  assert.deepEqual(spans(plan(m, { open: 7 })), [["solo", 1, 6], [KEY, 7, null]], "at the lock, one start and no skip: it starts");
  const n = seen(league(voting("start")));
  cast(n, KEY, "start", "ann");
  cast(n, KEY, "skip", "bo");
  cast(n, KEY, "skip", "cy");
  assert.deepEqual(plan(n, { open: 7 }).skipped.map((x) => x.key), [KEY], "more skips: skipped, whatever the default");
  // A tie, or nobody voting: the game's default.
  const tie = seen(league(voting("carry-on")));
  cast(tie, KEY, "start", "ann");
  cast(tie, KEY, "skip", "bo");
  assert.deepEqual(plan(tie, { open: 7 }).lapsed.map((x) => x.key), [KEY], "a tie, carry-on: the game carries on");
  const none = seen(league(voting("start")));
  assert.deepEqual(spans(plan(none, { open: 7 })), [["solo", 1, 6], [KEY, 7, null]], "nobody voted, start: it starts anyway");
  // Decided stays decided: someone joining later doesn't undo a majority that was.
  s.players.push({ id: "ed", name: "ed", color: "#000", disabled: false, active: true }, { id: "fy", name: "fy", color: "#000", disabled: false, active: true });
  assert.deepEqual(spans(plan(s)), [["solo", 1, 5], [KEY, 6, null]]);
  // And a vote the lock decided stays decided: every vote cast counts, so one of its voters leaving later doesn't tie it.
  n.players.find((p) => p.id === "bo").disabled = true;
  assert.deepEqual(plan(n, { open: 8 }).skipped.map((x) => x.key), [KEY], "two skips to one start, cast before the lock, whoever's in now");
});

test("the maker's answer stands over the vote; a copy that started never moves", () => {
  const s = seen(league(voting()));
  ["ann", "bo", "cy"].forEach((id) => cast(s, KEY, "start", id));
  // The maker calls it off: a started copy taken away (their undo).
  assert.equal(StageLogic.decide(s, KEY, "skip", "maker"), null);
  const skipped = plan(s, { copies: { [KEY]: { from: 6 } }, open: 8 });
  assert.deepEqual(spans(skipped), [["solo", 1, null]]);
  // The maker starts one the vote lapsed.
  const t = seen(league(voting()));
  cast(t, KEY, "skip", "ann");
  cast(t, KEY, "start", "bo");
  assert.deepEqual(plan(t, { open: 7 }).lapsed.map((x) => x.key), [KEY]);
  assert.equal(StageLogic.decide(t, KEY, "start", "maker"), null);
  assert.deepEqual(spans(plan(t, { open: 7 })), [["solo", 1, 6], [KEY, 7, null]]);
  assert.deepEqual(box(t)[KEY], { ann: "skip", bo: "start" }, "the votes kept beside the maker's answer");
  // Once a copy has started (from before the first episode still open), it plays where it is.
  const u = seen(league(voting()));
  cast(u, KEY, "start", "ann");
  assert.deepEqual(spans(plan(u, { copies: { [KEY]: { from: 7 } }, open: 9 })), [["solo", 1, 6], [KEY, 7, null]]);
});
