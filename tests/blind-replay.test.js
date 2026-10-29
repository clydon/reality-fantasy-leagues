// F4's blind replays (scripts/dev-test/blind.js; docs/PLAN-start-a-game-gpt.md, "Formats nobody announced"): the research as it
// would have come in live (the format section from the local bot's own answer or F1's fixture, who went home as the fixture has
// it), the players' answers to every kind of question (each one the engine's own check takes), and the checks on a game's
// record. No database, no tapes: F1's fixtures and made-up answers. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../scripts/dev-test/blind.js");
const Study = require("../scripts/dev-test/format-study.js");
const Spec = require("../src/lib/game/game-spec/index.js");
const Formats = require("../src/lib/game/formats/index.js");

const challenge = Formats.formatFor("challenge");
const survivor = Formats.formatFor("survivor");
const traitors = Formats.formatFor("traitors");

test("who left, in each format's own words", () => {
  assert.deepEqual(["eliminated", "quit", "medical", "disqualified", "purged", "placed", "won"].map((h) => B.howIn(h, challenge)), ["Eliminated", "Quit", "Medically removed", "Disqualified", "Eliminated", "Finalist", "Winner"]);
  assert.deepEqual(["voted out", "fire", "evacuated", "placed", "won"].map((h) => B.howIn(h, survivor)), ["Voted Out", "Lost Fire-Making", "Medically Evacuated", "Lost Final Tribal (Jury Vote)", "Sole Survivor"]);
  assert.deepEqual(["banished", "murdered", "quit", "won", "something else"].map((h) => B.howIn(h, traitors)), ["Banished", "Murdered", "Left the game", "Winner", "Other"]);
});

test("the stand-in: an episode's format section from F1's fixture, as research would say it at the episode's end", () => {
  const t = Study.loadTimeline("the-challenge", 41);
  // Episode 5: Cara Maria left, Jonna came in for her (with Jake), and every pair was re-drawn at its end for 6.
  const e5 = B.standIn(t, 5);
  assert.equal(e5.playedAs, "pairs");
  assert.deepEqual(e5.newcomers, [{ name: "Jonna Mannion", replaces: "Cara Maria Sorbello", group: "Jake Cornish" }]);
  assert.ok(e5.groups.every((g) => g.members.length > 1) && e5.groups.length >= 12, "the pairs going into 6");
  assert.ok(e5.changes.some((c) => c.kind === "swap" && c.from === 6 && c.sure === "high"), "the re-draw, sure");
  assert.ok(e5.changes.some((c) => c.kind === "newcomer" && c.from === 5));
  // Episode 9 was played alone and the Lock In's pairs were shown at its end: the section has them going into 10.
  const e9 = B.standIn(t, 9);
  assert.equal(e9.playedAs, "individuals");
  assert.equal(e9.groups.length, 12);
  assert.ok(e9.changes.some((c) => c.kind === "pairs-formed" && c.from === 10));
  // The reunion: nothing going on; an episode the fixture doesn't have: none.
  assert.equal(B.standIn(t, 21).groups.length, 0);
  assert.equal(B.standIn(t, 99), null);
});

test("where each episode's section comes from: the local bot's own answer, else the stand-in; the merge from either", () => {
  const t = Study.loadTimeline("survivor", 49);
  const f2 = { 4: { ok: true, parsed: { formatState: { playedAs: "tribes", groups: [], alone: [], newcomers: [], wentHomeAs: "individuals", changes: [] }, merged: "no" } }, 5: { ok: false, parsed: null } };
  const four = B.sectionFor(t, 4, f2, { hasMerge: true });
  assert.equal(four.from, "research");
  assert.equal(four.section, f2[4].parsed.formatState);
  assert.equal(four.merged, "no");
  assert.equal(B.sectionFor(t, 5, f2, { hasMerge: true }).from, "stand-in", "a failed ask isn't an answer");
  assert.equal(B.sectionFor(t, 7, {}, { hasMerge: true }).merged, "yes", "the fixture's merge, in the episode its phase first reads so");
  assert.equal(B.sectionFor(t, 6, {}, { hasMerge: true }).merged, "no");
  assert.equal(B.sectionFor(t, 7, {}, { hasMerge: false }).merged, null, "a format with no merge says nothing of one");
  assert.deepEqual(B.sectionFor(t, 99, {}), { section: null, from: null, merged: null });
});

test("the quick check and the full answer as a blind replay files them: who went home is the fixture's", () => {
  const t = Study.loadTimeline("the-challenge", 41);
  const tapeQuick = JSON.stringify({ found: true, episodeTitle: "Pride", left: [{ name: "Someone Else", how: "Quit" }], headline: "h", sources: ["https://a", "https://b"] });
  const q = B.fixtureQuick(t, 5, challenge, tapeQuick);
  const said = JSON.parse(q.text);
  assert.deepEqual(said.left, [{ name: "Cara Maria Sorbello", how: "Quit" }, { name: "Ben Davis", how: "Eliminated" }]);
  assert.deepEqual([said.episodeTitle, said.sources], ["Pride", ["https://a", "https://b"]], "the tape's title and sources kept");
  assert.ok(q.quick.left.every((p) => p.matched) && q.quick.found);
  assert.equal(JSON.parse(B.fixtureQuick(t, 5, challenge, null).text).sources.length, 2, "two sources at least, as the bot's would be trusted");
  // The full answer: the tape has Ben staying and Cy leaving; the fixture has Ben and Cara Maria leaving.
  const entry = (name, left, how = null) => ({ name, leftTheGame: left ? "yes" : "no", exitMethod: how, confidence: "high", sources: ["https://x"] });
  const full = JSON.stringify({ castaways: [entry("Cara Maria Sorbello", true, "Quit"), entry("Ben Davis", false), entry("Cy Young", true, "Eliminated")], merged: "no" });
  const asked = ["Cara Maria Sorbello", "Ben Davis", "Cy Young"].map((name) => ({ name, leftTheGame: "no", exitMethod: null }));
  const section = B.standIn(t, 5);
  const got = B.blindFull(full, { quick: q.quick, asked, format: challenge, section, merged: null });
  const raw = JSON.parse(got.text);
  assert.deepEqual(raw.castaways.map((c) => `${c.name}:${c.leftTheGame}`), ["Cara Maria Sorbello:yes", "Ben Davis:yes", "Cy Young:no"]);
  assert.deepEqual([got.changes.left, got.changes.stayed], [["Ben Davis (Eliminated)"], ["Cy Young (Eliminated)"]]);
  assert.deepEqual(raw.formatState, section, "the section put in");
  // An exit both say, worded differently and at medium confidence (the app would hold it: the playtest report's findings 2
  // and 3), is filed in the quick check's words and as sure as the fixture.
  const worded = JSON.stringify({ castaways: [{ ...entry("Cara Maria Sorbello", true, "Other"), confidence: "medium" }, entry("Ben Davis", true, "Eliminated")] });
  const w = JSON.parse(B.blindFull(worded, { quick: q.quick, asked: asked.slice(0, 2), format: challenge, section, merged: null }).text);
  assert.deepEqual(w.castaways.map((c) => [c.exitMethod, c.confidence]), [["Quit", "high"], ["Eliminated", "high"]]);
  // Survivor's merge goes in when the format has one, whether or not the answer said it.
  const s49 = B.blindFull(JSON.stringify({ castaways: [entry("Ann", false)] }), { quick: { found: true, left: [], sources: ["a", "b"] }, asked: [{ name: "Ann" }], format: survivor, section: null, merged: "yes" });
  assert.equal(JSON.parse(s49.text).merged, "yes");
});

test("every answer the players give is one the engine's own check takes, for every kind of question", () => {
  const faces = ["c1", "c2", "c3", "c4"].map((id) => ({ id, name: id.toUpperCase(), photo: null }));
  const seat = { role: "tinkerer", label: "Tinkerer" };
  const drive = { role: "driveby", label: "Drive-by" };
  const base = { pick: null, from: "cast", line: null, options: null, chips: null, wager: null, pairs: null, each: null, faces, stakeMost: null };
  const qs = [
    { id: "out", answer: "person" },
    { id: "top3", answer: "person", pick: 3 },
    { id: "tribe", answer: "group" },
    { id: "idol", answer: "yesNo", faces: null },
    { id: "count", answer: "number", faces: null },
    { id: "total", answer: "overUnder", line: 7.5, faces: null },
    { id: "pick", answer: "choice", options: ["A", "B", "C"], faces: null },
    { id: "boot", answer: "order", pick: 3 },
    { id: "conf", answer: "confidence", pick: 4 },
    { id: "chips", answer: "chips", chips: 10 },
    { id: "split", answer: "split", faces: null },
    { id: "pairs", answer: "pairs", faces: null, pairs: [{ key: "c1|c2", faces: [faces[0], faces[1]] }, { key: "c3|c4", faces: [faces[2], faces[3]] }] },
    { id: "each", answer: "yesNo", each: "person" },
    { id: "eachN", answer: "number", each: "person" },
    { id: "bet", answer: "person", wager: 3 },
    { id: "all", answer: "yesNo", wager: "total", stakeMost: 5, faces: null },
  ].map((q) => ({ ...base, ...q }));
  for (const who of [seat, drive]) {
    for (const q of qs) {
      for (const n of [1, 2, 7]) {
        const v = B.answerFor(who, q, n);
        assert.notEqual(v, undefined, `${q.id} answered`);
        const set = q.answer === "pairs" ? new Set(q.pairs.flatMap((p) => p.faces.map((f) => `${p.key}:${f.id}`))) : q.faces ? new Set(q.faces.map((f) => f.id)) : null;
        assert.equal(Spec.answerProblem(q, v, set, { most: q.stakeMost ?? undefined }), null, `${who.role} ${q.id} at ${n}: ${JSON.stringify(v)}`);
      }
    }
  }
  // Nothing to answer with: no faces (an unsure lock offers none), no options.
  assert.equal(B.answerFor(seat, { ...base, id: "tribe", answer: "group", faces: [] }, 3), undefined);
  assert.equal(B.answerFor(seat, { ...base, id: "pick", answer: "choice", options: [], faces: null }, 3), undefined);
  // A drive-by takes the list's first; the others their own order, the same each time.
  assert.equal(B.answerFor(drive, qs[0], 4), "c1");
  assert.equal(B.answerFor(seat, qs[0], 4), B.answerFor(seat, qs[0], 4));
  // The runner answers every week; the forgetter one week in three.
  assert.ok([1, 2, 3, 4, 5, 6].every((n) => B.answersThisWeek(seat, n)));
  assert.ok([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => B.answersThisWeek({ role: "forgetter", label: "Forgetter" }, n)).length < 6);
});

test("a game's record checked at the season's end", () => {
  const ok = { leagueId: "x", over: true, lastEpisode: 9, episodes: [{ episode: 9, played: true, table: { A: 3, B: 0 }, verdicts: { daily: { state: "known", offered: 4, earned: { A: 1 }, void: ["B"] } } }], problems: [] };
  assert.deepEqual(B.problemsOf(ok), []);
  assert.deepEqual(B.problemsOf({ problems: ["nope"] }), ["never started: nope"]);
  const bad = {
    leagueId: "x",
    over: false,
    lastEpisode: 9,
    episodes: [
      { episode: 8, table: { A: NaN }, verdicts: { daily: { state: "off", offered: 0, earned: { A: 1 } } }, refused: ["A: Name a group"] },
      { episode: 9, table: { A: 1 }, verdicts: { daily: { state: "known", offered: 3, earned: { B: 1 }, void: ["B"] } } },
    ],
    problems: ["episode 9: moves failed"],
  };
  assert.deepEqual(B.problemsOf(bad), [
    "not over after its last episode (9)",
    "episode 8: A's score is NaN",
    "episode 8: daily was off but scored",
    "episode 8: an answer was refused: A: Name a group",
    "episode 9: daily: B's void pick scored",
    "episode 9: moves failed",
  ]);
});

test("what a game did at an episode, in a line", () => {
  const g = {
    episodes: [
      { episode: 2, played: true, offered: { daily: { faces: [], offWhy: "Who is with whom going into this episode isn't sure" } }, verdicts: { daily: { state: "off" } } },
      { episode: 3, played: true, offered: { daily: { faces: ["A & B", "C & D", "E & F", "G & H"], offWhy: null } }, verdicts: { daily: { state: "known", right: ["C & D"], void: ["Fan"] } } },
      { episode: 4, played: true },
      { episode: 5 },
    ],
  };
  assert.equal(B.didLine(g, 2), "daily: off (Who is with whom going into this episode isn't sure); off");
  assert.equal(B.didLine(g, 3), "daily: offered 4: A & B, C & D, E & F, ...; right C & D, void for Fan");
  assert.equal(B.didLine(g, 4), "rides on the people (nothing it plays reads the format)");
  assert.equal(B.didLine(g, 5), null, "not played: nothing to say");
});
