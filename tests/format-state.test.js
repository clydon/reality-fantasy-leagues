// The research prompt's format section (F2 of docs/PLAN-start-a-game-gpt.md, "Formats nobody announced"; the proposals and
// results in docs/STUDY-format-changes.md): its schema on every show, the prompt's words (the groups going in, never a
// format's built-in group word), old answers without it and new ones with it (repaired, never failing a run), the review's
// checks, a second pass filling it in, our own comparison of two states and its cross-check with the answer's, and the
// scorer F2's proof uses (scripts/dev-test/format-asks.js) against F1's timelines. Made-up answers, no bot, no database.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");
const FS = require("../src/lib/game/formats/format-state.js");
const Study = require("../scripts/dev-test/format-study.js");
const Asks = require("../scripts/dev-test/format-asks.js");
const { termsFor } = require("../db/wiki-sync.js");

const CAST = ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn", "Eve Eno"];
const FORMATS = Formats.formatOptions().map((f) => Formats.formatFor(f.id));
const survivor = Formats.formatFor("survivor");
const challenge = Formats.formatFor("challenge");
const ctxFor = (format, extra = {}) => ({ showName: "Test Show", showSlug: "test", season: 1, episodeNumber: 5, castNames: CAST, terms: termsFor({}).terms, format, domains: [], ...extra });
const parse = (format, obj) => R.parseJsonAnswer(R.extractJsonObject(JSON.stringify(obj)), R.researchSchemaFor(format, false), "test");
// A whole answer off the real skeleton, everyone in, with `formatState` and per-person edits.
function answer(format, formatState, edits = {}) {
  const skel = R.pasteSkeleton(ctxFor(format), []);
  skel.summary = "An episode.";
  for (const c of skel.castaways) Object.assign(c, { leftTheGame: "no", confidence: "high", sources: ["https://example.com"] }, edits[c.name] || {});
  if (formatState !== undefined) skel.formatState = formatState;
  else delete skel.formatState;
  return skel;
}
const pairs = (...ps) => ps.map((p) => ({ name: null, members: p }));

test("every show's research asks the format section, before the sources and the cast; a cut-down ask doesn't", () => {
  for (const format of FORMATS) {
    const json = R.jsonSchemaFor(R.researchSchemaFor(format, false), "strict");
    const keys = Object.keys(json.properties);
    assert.ok(keys.includes("formatState"), `${format.id} asks it`);
    assert.ok(keys.indexOf("formatState") < keys.indexOf("castaways") && keys.indexOf("formatState") > keys.indexOf("rulesNote"), `${format.id}: after the rules note, before the cast`);
    const node = json.properties.formatState.anyOf.find((v) => v.type === "object");
    assert.deepEqual(node.properties.playedAs.enum, FS.PLAYED_AS);
    assert.deepEqual(node.properties.wentHomeAs.enum, FS.WENT_HOME_AS);
    assert.deepEqual(node.properties.changes.items.properties.kind.enum, FS.KINDS);
    assert.deepEqual(Object.keys(node.properties.changes.items.properties), ["kind", "when", "from", "what", "sure"]);
    const only = R.onlyFormat(format, []);
    assert.ok(!("formatState" in R.researchSchemaFor(only, false).shape), `${format.id}: a re-ask of a few questions leaves it out`);
  }
  assert.deepEqual(FS.KINDS, Study.KINDS, "the study's vocabulary, word for word");
});

test("the skeleton shows the section at its don't-know values, not null", () => {
  const skel = R.pasteSkeleton(ctxFor(survivor), []);
  assert.deepEqual(skel.formatState, { playedAs: "unknown", phase: null, groups: null, alone: [], newcomers: [], wentHomeAs: "unknown", changes: [] });
});

test("the prompt: the groups going in, as far as we know, and what to say about the end of the episode", () => {
  const goingIn = {
    episode: 4,
    state: { playedAs: "pairs", phase: "Rotating pairs", groups: pairs(["Ann Able", "Bea Bell"], ["Cal Cole", "Zed Gone"], ["Dev Dunn", "Jo New"]), alone: ["Eve Eno"] },
    newcomers: ["Jo New"],
  };
  const { user } = R.buildPrompt({ ...ctxFor(challenge), castGroups: { "Ann Able": "Vets" }, formatGoingIn: goingIn, terms: { ...termsFor({}).terms, tribe: "agency" } });
  assert.match(user, /HOW THE GAME IS ORGANISED \(formatState\)/);
  assert.match(user, /as of the end of the last episode, playing as pairs, in "Rotating pairs"/);
  assert.match(user, /- Ann Able & Bea Bell\n/);
  assert.match(user, /- Dev Dunn & Jo New\n/, "a newcomer since the cast was made stays with their partner");
  assert.doesNotMatch(user, /Zed Gone/, "someone no longer on the list is gone");
  assert.match(user, /On their own: Eve Eno, Cal Cole\./, "a partner who went home leaves the other on their own");
  assert.match(user, /episode 5 for a change at its start or partway through,\nepisode 6 for one at its end/);
  assert.match(user, /don't leave it in notableTwist alone/);
  const block = user.slice(user.indexOf("HOW THE GAME"));
  assert.doesNotMatch(block, /agenc/i, "the format section never says the format's built-in word for its groups");
  // F3 part 2: nor the line beside it, whose groups here are a label (Vets beside the pairs going in), said as one; the plural
  // is still spelt right where a word that needs it is said.
  assert.doesNotMatch(user, /agenc/i, "one word for the groups beside the section: never the show row's built-in one");
  assert.match(user, /The group after each name is the one our records give them going INTO this episode, which may be only a label/);
  assert.equal(R.plural("agency"), "agencies");
  // An older answer than the last episode's: said so.
  const older = R.buildPrompt({ ...ctxFor(survivor), formatGoingIn: { ...goingIn, episode: 2, state: { ...goingIn.state, groups: [{ name: "Hina", members: ["Ann Able", "Bea Bell", "Cal Cole"] }, { name: "Kele", members: ["Dev Dunn", "Eve Eno"] }], alone: [] } } }).user;
  assert.match(older, /as of the end of episode 2/);
  assert.match(older, /- Hina: Ann Able, Bea Bell, Cal Cole\n/);
  // Everyone for themselves going in.
  const none = R.buildPrompt({ ...ctxFor(survivor), formatGoingIn: { episode: 4, state: { playedAs: "individuals", phase: null, groups: [], alone: [] }, newcomers: [] } }).user;
  assert.match(none, /nobody was in a group: everyone played for themselves/);
  // Nothing known: the cast list's groups may be a label, or there are none.
  const labelled = R.buildPrompt({ ...ctxFor(challenge), castGroups: { "Ann Able": "Vets", "Bea Bell": "New Threats" } }).user;
  assert.match(labelled, /only a label the show gives them \(like Vets and New Threats\)/);
  const bare = R.buildPrompt({ ...ctxFor(Formats.formatFor("traitors")) }).user;
  assert.match(bare, /We have no groups on record for this season/);
  // The prose prompt asks it too, with the vocabulary.
  const prose = R.buildPastePrompt(ctxFor(survivor), []);
  assert.match(prose, /How the game is organised:/);
  assert.match(prose, /'split-into-individuals' \(the groups ended: everyone for themselves\)/);
  assert.equal(R.plural("tribe"), "tribes");
  assert.equal(R.plural("agency"), "agencies");
  assert.equal(R.plural("match"), "matches");
});

test("an answer from before the section still parses (null), and a new one comes through whole", () => {
  for (const format of FORMATS) {
    const old = parse(format, answer(format, undefined));
    assert.equal(old.formatState, null, `${format.id}: an old answer has no section`);
    assert.ok(!(old.repairs || []).length, `${format.id}: and nothing to repair`);
  }
  const state = { playedAs: "pairs", phase: "Rotating pairs", groups: pairs(["Ann Able", "Bea Bell"], ["Cal Cole", "Dev Dunn"]), alone: ["Eve Eno"], newcomers: [], wentHomeAs: "nobody", changes: [{ kind: "swap", when: "end", from: 6, what: "Everyone re-paired.", sure: "high" }] };
  const now = parse(challenge, answer(challenge, state));
  assert.deepEqual(now.formatState, state);
});

test("a section said loosely is repaired and reported, never a failed run", () => {
  const repairs = [];
  const st = FS.looseFormatState(
    {
      playedAs: "Pair",
      groups: [["Ann Able", "Bea Bell"], { name: " Hina ", members: ["Cal Cole", "", "Dev Dunn"] }, { members: [] }, "nonsense"],
      alone: "Eve",
      newcomers: ["Jo New", { name: "Kim Ko", replaces: "Ann", group: null }, {}],
      wentHomeAs: "a pair",
      changes: [
        { kind: "Teams formed", when: "Beginning", from: "6", what: "Teams.", sure: "HIGH" },
        { kind: "tribal shuffle", when: "end", from: 6, what: "?", sure: "high" },
        { kind: "twist", when: "later", from: 0, what: "A twist.", sure: "maybe" },
        "not a change",
      ],
    },
    repairs
  );
  assert.equal(st.playedAs, "pairs");
  assert.deepEqual(st.groups, [{ name: null, members: ["Ann Able", "Bea Bell"] }, { name: "Hina", members: ["Cal Cole", "Dev Dunn"] }]);
  assert.deepEqual(st.alone, [], "a name where a list goes isn't a list of names");
  assert.deepEqual(st.newcomers.map((x) => x.name), ["Jo New", "Kim Ko"]);
  assert.equal(st.wentHomeAs, "unknown");
  assert.deepEqual(st.changes, [
    { kind: "teams-formed", when: "start", from: 6, what: "Teams.", sure: "high" },
    { kind: "twist", when: null, from: null, what: "A twist.", sure: "low" },
  ]);
  assert.ok(repairs.some((r) => /kind "tribal shuffle"/.test(r)));
  assert.ok(repairs.some((r) => /wentHomeAs "a pair"/.test(r)));
  assert.equal(FS.looseFormatState("nope", repairs), null);
  assert.equal(FS.looseFormatState(undefined, []), null);
  // Through the parser: the bad parts repaired, the rest of the answer fine.
  const parsed = parse(challenge, answer(challenge, { playedAs: "teams", groups: null, alone: [], newcomers: [], wentHomeAs: "nobody", changes: [{ kind: "shuffle" }] }));
  assert.equal(parsed.formatState.changes.length, 0);
  assert.ok(parsed.repairs.some((r) => /kind "shuffle"/.test(r)));
  assert.equal(parsed.castaways.length, CAST.length);
});

test("the review's checks: names made the list's own, and what doesn't add up", () => {
  const ctx = ctxFor(survivor);
  const parsed = parse(
    survivor,
    answer(
      survivor,
      {
        playedAs: "tribes",
        phase: null,
        groups: [{ name: "Hina", members: ["Ann", "Bea Bell", "Nobody Here"] }, { name: "Kele", members: ["Cal Cole", "ann able"] }, { name: "Uli", members: ["Dev Dunn"] }],
        alone: [],
        newcomers: [{ name: "Jo New", replaces: "Eve", group: "Kele" }],
        wentHomeAs: "groups",
        changes: [],
      },
      { "Eve Eno": { leftTheGame: "yes", exitMethod: "Voted Out" }, "Bea Bell": { newGroup: "Kele" } }
    )
  );
  const goingIn = { episode: 4, state: { groups: [{ name: null, members: ["Eve Eno", "Cal Cole"] }], alone: [] }, newcomers: [] };
  const v = R.validateResearch(parsed, ctx.castNames, ctx.terms, ctx.format, { formatGoingIn: goingIn });
  const st = parsed.formatState;
  assert.deepEqual(st.groups, [{ name: "Hina", members: ["Ann Able", "Bea Bell"] }], "first names made whole; a group of one isn't a group");
  assert.deepEqual(st.alone, ["Cal Cole", "Dev Dunn"], "Kele down to Cal once Ann's second place is dropped: on his own");
  assert.equal(st.newcomers[0].replaces, "Eve Eno");
  const says = (re) => assert.ok(v.problems.some((p) => re.test(p)), `a problem matching ${re}: ${v.problems.join(" | ")}`);
  says(/Ann Able is in two groups/);
  says(/Nobody Here isn't in the list or the newcomers \(dropped\)/);
  says(/a group of one \(Cal Cole\)/);
  says(/a group of one \(Dev Dunn\)/);
  says(/a whole group went home together, but Eve Eno left and Cal Cole \(with them going in\) didn't/);
  says(/no group going in left whole/);
  says(/Bea Bell: newGroup says Kele, but formatState has them on Hina/);
  assert.equal(v.fatal.length, 0, "never fatal");
  // A leaver still grouped, and nobody said to leave when someone did.
  const p2 = parse(survivor, answer(survivor, { playedAs: "tribes", phase: null, groups: [{ name: "Hina", members: CAST }, { name: "Kele", members: [] }], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [] }, { "Eve Eno": { leftTheGame: "yes", exitMethod: "Voted Out" } }));
  const v2 = R.validateResearch(p2, CAST, ctx.terms, survivor, {});
  assert.ok(v2.problems.some((p) => /Eve Eno went home this episode but is still placed at its end/.test(p)));
  assert.ok(v2.problems.some((p) => /wentHomeAs says nobody left/.test(p)));
  // The answer against itself: a split said, groups still listed; teams said formed, none listed.
  const self = FS.looseFormatState({ playedAs: "teams", groups: [["Ann Able", "Bea Bell"], ["Cal Cole", "Dev Dunn", "Eve Eno"]], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [{ kind: "split-into-individuals", when: "end", from: 6, sure: "high" }] });
  assert.ok(FS.formatStateProblems(self, {}).some((p) => /everyone plays for themselves from episode 6, but the groups at the end still divide them/.test(p)));
  const none = FS.looseFormatState({ playedAs: "teams", groups: [], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [{ kind: "teams-formed", when: "mid", from: 5, sure: "high" }] });
  assert.ok(FS.formatStateProblems(none, {}).some((p) => /teams formed from episode 5, but there are no groups at the end/.test(p)));
  // ...but not a change announced for later than the next episode (the Lock In, told in 7 for 10).
  const ahead = FS.looseFormatState({ playedAs: "pairs", groups: [], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [{ kind: "pairs-formed", when: "end", from: 10, sure: "high" }] });
  assert.ok(!FS.formatStateProblems(ahead, { episode: 7 }).some((p) => /pairs formed/.test(p)));
  assert.ok(FS.formatStateProblems(ahead, { episode: 9 }).some((p) => /pairs formed from episode 10/.test(p)));
  // Someone still in, in no group and not on their own.
  const p4 = parse(survivor, answer(survivor, { playedAs: "tribes", phase: null, groups: [{ name: "Hina", members: ["Ann Able", "Bea Bell"] }, { name: "Kele", members: ["Cal Cole", "Dev Dunn"] }], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [] }));
  assert.ok(R.validateResearch(p4, CAST, ctx.terms, survivor, {}).problems.some((p) => /Eve Eno is still in but in no group/.test(p)));
  // An answer without the section: no checks, no problems from it.
  const p3 = parse(survivor, answer(survivor, undefined));
  assert.ok(!R.validateResearch(p3, CAST, ctx.terms, survivor, {}).problems.some((p) => /formatState/.test(p)));
});

test("a second pass fills the section in where it could tell, and never erases what the first could", () => {
  const first = { castaways: [], formatState: { playedAs: "pairs", phase: "Rotating", groups: pairs(["A", "B"]), alone: [], newcomers: [{ name: "Jo" }], wentHomeAs: "individuals", changes: [{ kind: "swap" }] } };
  const vague = { castaways: [], formatState: { playedAs: "unknown", phase: null, groups: null, alone: [], newcomers: [], wentHomeAs: "unknown", changes: [] } };
  assert.deepEqual(R.mergeResearchPayload(first, vague, { fill: true }).payload.formatState, first.formatState);
  const split = { castaways: [], formatState: { ...vague.formatState, playedAs: "individuals", groups: [] } };
  const out = R.mergeResearchPayload(first, split, { fill: true }).payload.formatState;
  assert.equal(out.playedAs, "individuals");
  assert.deepEqual(out.groups, [], "an empty list is an answer: everyone for themselves");
  assert.deepEqual(out.newcomers, [{ name: "Jo" }]);
  // An old pass with none, then a new one: the new one's.
  assert.deepEqual(R.mergeResearchPayload({ castaways: [], formatState: null }, first, { fill: true }).payload.formatState, first.formatState);
});

test("the state going in: the latest earlier answer that says who is with whom, and every newcomer since", async () => {
  const rows = [
    { episode_number: 4, state: { playedAs: "pairs", groups: null, newcomers: [] } },
    { episode_number: 3, state: { playedAs: "pairs", groups: pairs(["A", "B"]), newcomers: [{ name: "Jo" }] } },
    { episode_number: 2, state: { playedAs: "pairs", groups: pairs(["A", "C"]), newcomers: [{ name: "Kim" }] } },
  ];
  const pool = { query: async (sql, params) => (assert.match(sql, /payload->'formatState'/), assert.deepEqual(params, ["show-1", 41, 5]), { rows }) };
  const got = await R.formatGoingInto(pool, "show-1", "41", 5);
  assert.equal(got.episode, 3);
  assert.deepEqual(got.state.groups, pairs(["A", "B"]));
  assert.deepEqual(got.newcomers.sort(), ["Jo", "Kim"]);
  assert.equal(await R.formatGoingInto({ query: async () => ({ rows: [] }) }, "show-1", 41, 5), null);
  assert.equal(await R.formatGoingInto(pool, null, 41, 5), null);
});

test("our comparison: what changed between two states, from who is with whom (never anyone's label)", () => {
  const S = (groups, alone = []) => ({ groups, alone });
  const kinds = (x) => x.map((c) => c.kind);
  // Rotating pairs: every pair new.
  const swap = FS.changesBetween(S(pairs(["A", "B"], ["C", "D"])), S(pairs(["A", "C"], ["B", "D"])));
  assert.deepEqual(kinds(swap), ["swap"]);
  assert.equal(swap[0].allNew, true);
  // A claim: two pairs re-formed, one kept.
  const claim = FS.changesBetween(S(pairs(["A", "B"], ["C", "D"], ["E", "F"])), S(pairs(["A", "C"], ["B", "D"], ["E", "F"])));
  assert.deepEqual(kinds(claim), ["swap"]);
  assert.equal(claim[0].allNew, false);
  assert.deepEqual(claim[0].moved.sort(), ["A", "B", "C", "D"]);
  // Someone going home isn't a move, and a pair losing one leaves nobody moved.
  assert.deepEqual(FS.changesBetween(S(pairs(["A", "B"], ["C", "D"], ["E", "F"])), S(pairs(["C", "D"], ["E", "F"]), ["B"]), { left: ["A"] }), []);
  // A newcomer taking a leaver's place beside their partner: a newcomer, not a swap.
  assert.deepEqual(kinds(FS.changesBetween(S(pairs(["A", "B"], ["C", "D"])), S(pairs(["A", "J"], ["C", "D"])), { left: ["B"], newcomers: ["J"] })), ["newcomer"]);
  // The merge, a split, teams and pairs formed.
  const tribes = S([{ name: "Hina", members: ["A", "B", "C"] }, { name: "Kele", members: ["D", "E", "F"] }]);
  assert.deepEqual(kinds(FS.changesBetween(tribes, S([{ name: "Lewatu", members: ["A", "B", "C", "D", "E", "F"] }]))), ["merge"]);
  assert.deepEqual(kinds(FS.changesBetween(tribes, S([]))), ["split-into-individuals"]);
  assert.deepEqual(kinds(FS.changesBetween(S([]), S(pairs(["A", "B"], ["C", "D"])))), ["pairs-formed"]);
  assert.deepEqual(kinds(FS.changesBetween(S([]), tribes)), ["teams-formed"]);
  assert.deepEqual(kinds(FS.changesBetween(S(pairs(["A", "B"], ["C", "D"], ["E", "F"])), tribes)), ["teams-formed"]);
  assert.deepEqual(kinds(FS.changesBetween(tribes, S(pairs(["A", "B"], ["C", "D"], ["E", "F"])))), ["pairs-formed"]);
  // A partial swap between tribes (Survivor's), and the merged tribe then everyone for themselves: no change.
  const swapped = S([{ name: "Hina", members: ["A", "B", "D"] }, { name: "Kele", members: ["C", "E", "F"] }]);
  assert.deepEqual(FS.changesBetween(tribes, swapped)[0].moved.sort(), ["C", "D"]);
  assert.deepEqual(FS.changesBetween(S([{ name: "Lewatu", members: ["A", "B", "C"] }]), S([])), []);
  // Someone on their own joining a group moved.
  assert.deepEqual(kinds(FS.changesBetween(S(pairs(["A", "B"], ["C", "D"]), ["E"]), S([{ name: null, members: ["A", "B", "E"] }, { name: null, members: ["C", "D"] }]))), ["swap"]);
  // Not known on either side: can't tell.
  assert.equal(FS.changesBetween(S(null), S([])), null);
  assert.equal(FS.changesBetween(null, S([])), null);
});

test("the cross-check: a change both see is as sure as the answer says; one side alone is unsure", () => {
  const ours = [{ kind: "swap", moved: ["A"], newcomers: [], allNew: true }, { kind: "newcomer", moved: [], newcomers: ["J"], allNew: false }];
  const theirs = [
    { kind: "swap", when: "end", from: 6, what: "Re-paired.", sure: "high" },
    { kind: "merge", when: "start", from: 5, what: "Merged.", sure: "high" },
    { kind: "twist", when: "mid", from: 5, what: "A twist.", sure: "high" },
  ];
  const out = FS.crossCheck(ours, theirs);
  const by = (k) => out.find((c) => c.kind === k);
  assert.deepEqual([by("swap").by, by("swap").sure, by("swap").from, by("swap").when], ["both", "high", 6, "end"]);
  assert.deepEqual([by("newcomer").by, by("newcomer").sure, by("newcomer").from], ["ours", "low", null]);
  assert.deepEqual([by("merge").by, by("merge").sure], ["theirs", "low"], "a grouping change the states don't show is unsure");
  assert.deepEqual([by("twist").by, by("twist").sure], ["said", "high"], "what our code can't see is the answer's alone");
  // The answer unsure of a change both see: unsure.
  assert.equal(FS.crossCheck([{ kind: "swap" }], [{ kind: "swap", sure: "low" }])[0].sure, "low");
  // States that can't be compared: every grouping change the answer has is unsure.
  assert.deepEqual(FS.crossCheck(null, theirs).map((c) => c.sure), ["low", "low", "high"]);
});

test("the scorer's truth: the groups at each episode's end, from F1's timelines", () => {
  const c41 = Study.loadTimeline("the-challenge", 41);
  const e5 = Asks.truthAtEnd(c41, 5);
  assert.equal(e5.playedAs, "pairs");
  assert.equal(e5.groups.length, 13, "the pairs drawn at 5's end, for 6");
  assert.deepEqual(e5.newcomers, ["Jonna Mannion"]);
  assert.equal(e5.wentHomeAs, "individuals");
  const e8 = Asks.truthAtEnd(c41, 8);
  assert.equal(e8.groups.length > 0 && e8.alt && e8.alt.groups.length, 0, "Episode 9 played alone: either answer counts at 8's end");
  assert.equal(Asks.truthAtEnd(c41, 9).groups.length, 12, "the Lock In's pairs, shown at 9's end");
  assert.equal(Asks.truthAtEnd(c41, 12).wentHomeAs, "groups", "a locked pair went home together");
  const c40 = Study.loadTimeline("the-challenge", 40);
  assert.deepEqual(Asks.truthAtEnd(c40, 2).groups, [], "the eras were a label until they played as teams");
  assert.equal(Asks.truthAtEnd(c40, 2).alt.groups.length, 4, "...from 3's start: either counts");
  assert.equal(Asks.truthAtEnd(c40, 5).groups.length, 4);
  assert.deepEqual(Asks.truthAtEnd(c40, 9).groups, [], "the team phase's end, announced at 9's end");
  const s49 = Study.loadTimeline("survivor", 49);
  assert.equal(Asks.truthAtEnd(s49, 3).groups.length, 3);
  assert.equal(Asks.truthAtEnd(s49, 3).alt.groups.length, 2, "the swap at 4's start");
  assert.deepEqual(Asks.truthAtEnd(s49, 7).groups, [], "merged: one tribe of everyone is no division");
  const t4 = Study.loadTimeline("the-traitors-us", 4);
  assert.deepEqual(Asks.truthAtEnd(t4, 1).groups, []);
  assert.equal(Asks.truthAtEnd(t4, 1).playedAs, "everyone");
  // The changes an answer should report: where they were shown.
  assert.deepEqual(Asks.changesReportedIn(c41, 5).map((c) => [c.kind, c.from, c.when]), [["newcomer", 5, "start"], ["swap", 6, "end"]]);
  assert.deepEqual(Asks.changesReportedIn(c41, 9).map((c) => c.kind).sort(), ["pairs-formed", "split-into-individuals"]);
});

test("the scorer: a right answer scores full marks, a vague one none, and the state going in chains", () => {
  const t = Study.loadTimeline("the-challenge", 41);
  const truth = Asks.truthAtEnd(t, 5);
  const before = Asks.truthAtEnd(t, 4);
  const right = {
    episode: 5,
    ok: true,
    goingIn: { from: "truth", episode: 4, state: { groups: before.groups, alone: before.alone } },
    parsed: {
      left: ["Cara Maria Sorbello", "Ben Davis"],
      formatState: {
        playedAs: "pairs", phase: "Rotating pairs", groups: truth.groups, alone: truth.alone, newcomers: [{ name: "Jonna Mannion", replaces: "Cara Maria Sorbello", group: null }], wentHomeAs: "individuals",
        changes: [{ kind: "newcomer", when: "start", from: 5, what: "", sure: "high" }, { kind: "swap", when: "end", from: 6, what: "", sure: "high" }],
      },
    },
  };
  const s = Asks.scoreAnswer(t, right);
  assert.ok(s.playedAs.right && s.groups.exact && s.wentHomeAs.right);
  assert.equal(s.groups.peopleRight, s.groups.people);
  assert.deepEqual(s.said.rows.map((r) => r.kind && r.from && r.when), [true, true]);
  assert.deepEqual(s.ours.rows.map((r) => [r.expected.kind, r.kind, r.got.sure]), [["newcomer", true, "high"], ["swap", true, "high"]]);
  const vague = { ...right, parsed: { left: [], formatState: { playedAs: "unknown", phase: null, groups: null, alone: [], newcomers: [], wentHomeAs: "unknown", changes: [] } } };
  const v = Asks.scoreAnswer(t, vague);
  assert.equal(v.groups.known, false);
  assert.equal(v.oursKnown, false);
  assert.deepEqual(v.said.rows.map((r) => r.kind), [false, false]);
  const sum = Asks.totals([s, v, { episode: 6, ok: false }]);
  assert.deepEqual([sum.asked, sum.answered, sum.groupsExact, sum.changes, sum.saidKind, sum.oursKind, sum.oursSure], [3, 2, 1, 4, 2, 2, 2]);
  // Going in: this run's answer for the episode before, else the truth, else none.
  assert.equal(Asks.goingInFor(t, 6, { 5: right }).from, "answer");
  assert.deepEqual(Asks.goingInFor(t, 6, { 5: right }).newcomers, ["Jonna Mannion"]);
  assert.equal(Asks.goingInFor(t, 6, { 5: vague }).from, "truth", "an answer that doesn't know who is with whom isn't one to go on");
  assert.equal(Asks.goingInFor(t, 6, {}).state.groups.length, 13);
  assert.equal(Asks.goingInFor(t, 1, {}).from, "none");
  // Groups scored: found, extra, and each person.
  const g = Asks.groupScore({ groups: pairs(["A", "B"], ["C", "E"]), alone: ["D"] }, { groups: pairs(["A", "B"], ["C", "D"]), alone: ["E"] });
  assert.deepEqual([g.exact, g.found, g.extra, g.peopleRight, g.people], [false, 1, 1, 2, 5]);
  assert.equal(Asks.groupScore({ groups: [{ name: "X", members: ["A", "B", "C"] }], alone: [] }, { groups: [], alone: [] }).exact, true, "one group of everyone is none");
});

test("the review's cases: a partial ask, newcomers since, a name like a newcomer's, a stale going-in, a trio, one answer for groups and alone", () => {
  // A pass asked about only some of the cast (a commissioner's paste for whoever isn't settled) leaves the section out.
  const ctx = ctxFor(challenge);
  assert.equal(R.formatForAsking(ctx, CAST.slice(0, 2)).asksFormat, false);
  assert.ok(!("formatState" in R.researchSchemaFor(R.formatForAsking(ctx, CAST.slice(0, 2)), false).shape));
  assert.equal(R.formatForAsking(ctx, CAST), ctx.format, "the whole cast: asked");
  assert.doesNotMatch(R.buildPrompt({ ...ctx, castNames: CAST.slice(0, 2), format: R.formatForAsking(ctx, CAST.slice(0, 2)) }).user, /HOW THE GAME/);
  // Beside the section a group change goes in it (F3: each person's move is worked out from it), and newGroup only for whoever
  // moved and went home the same night; a pass about some of the cast, which leaves the section out, asks newGroup as the
  // only place.
  const swapPrompt = R.buildPrompt({ ...ctxFor(survivor), castGroups: { "Ann Able": "Hina" } }).user;
  assert.doesNotMatch(swapPrompt, /the only place/);
  assert.match(swapPrompt, /If tribes were swapped, re-divided, dissolved or merged in this episode, say so in formatState below;\nsomeone who moved and then went home in this same episode: the tribe they went home from, in newGroup\./);
  const partialPrompt = R.buildPrompt({ ...ctxFor(survivor), castNames: CAST.slice(0, 2), castGroups: { "Ann Able": "Hina" }, format: R.formatForAsking(ctxFor(survivor), CAST.slice(0, 2)) }).user;
  assert.match(partialPrompt, /tribe in newGroup -- that is the only place a tribe change is recorded/);
  assert.doesNotMatch(R.buildPrompt({ ...ctxFor(survivor), castGroups: { "Ann Able": "Hina" }, format: R.onlyFormat(survivor, []) }).user, /HOW THE GAME/, "a cut-down ask: no section");
  // Someone who came in an earlier episode (not on the list) keeps their place; a newcomer's own name isn't a cast member's.
  const cast = ["Leonardo Dionicio", "Bea Bell", "Cal Cole", "Dev Dunn"];
  const st = FS.looseFormatState({ playedAs: "pairs", groups: [["Leonardo Dionicio", "Jonna Mannion"], ["Bea Bell", "Leo"], ["Cal Cole", "Dev Dunn"]], alone: [], newcomers: [{ name: "Leo" }], wentHomeAs: "nobody", changes: [] });
  const roster = { castaways: cast.map((name, i) => ({ id: String(i), name })) };
  const SL = require("../src/lib/game/state-logic.js");
  const resolve = (n) => {
    const { castaway } = SL.Core.findCastawayByName(roster, n);
    return castaway ? cast[Number(castaway.id)] : null;
  };
  const probs = FS.formatStateProblems(st, { resolve, entries: cast.map((name) => ({ name, leftTheGame: "no" })), newcomers: ["Jonna Mannion"] });
  assert.deepEqual(st.groups.map((g) => g.members), [["Leonardo Dionicio", "Jonna Mannion"], ["Bea Bell", "Leo"], ["Cal Cole", "Dev Dunn"]]);
  assert.ok(!probs.some((p) => /two groups|isn't in the list|already in the list/.test(p)), probs.join(" | "));
  // A going-in state from an earlier episode: a partner gone since (not on the list) isn't one who stayed.
  const stale = { groups: [{ name: null, members: ["Cal Cole", "Gone Before"] }, { name: null, members: ["Bea Bell", "Dev Dunn"] }] };
  const st2 = FS.looseFormatState({ playedAs: "pairs", groups: [["Leonardo Dionicio", "Bea Bell"]], alone: [], newcomers: [], wentHomeAs: "groups", changes: [] });
  const p2 = FS.formatStateProblems(st2, { resolve, entries: [{ name: "Cal Cole", leftTheGame: "yes" }, { name: "Dev Dunn", leftTheGame: "yes" }, { name: "Bea Bell", leftTheGame: "no" }], goingIn: stale });
  assert.ok(!p2.some((p) => /Gone Before/.test(p)), p2.join(" | "));
  assert.ok(p2.some((p) => /Dev Dunn left and Bea Bell \(with them going in\) didn't/.test(p)));
  // A trio going in, one of them gone and the answer saying a whole group went.
  const trio = { groups: [{ name: null, members: ["Bea Bell", "Cal Cole", "Dev Dunn"] }] };
  const p3 = FS.formatStateProblems(FS.looseFormatState({ playedAs: "pairs", groups: [], alone: [], newcomers: [], wentHomeAs: "groups", changes: [] }), { resolve, entries: [{ name: "Bea Bell", leftTheGame: "yes" }], goingIn: trio });
  assert.ok(p3.some((p) => /Bea Bell left and Cal Cole, Dev Dunn/.test(p)));
  assert.ok(p3.some((p) => /no group going in left whole/.test(p)));
  // A second pass that knows the groups says who's on their own too.
  const first = { castaways: [], formatState: { playedAs: "pairs", phase: null, groups: null, alone: ["Kyle"], newcomers: [], wentHomeAs: "unknown", changes: [] } };
  const second = { castaways: [], formatState: { playedAs: "pairs", phase: null, groups: pairs(["Kyle", "Nia"]), alone: [], newcomers: [], wentHomeAs: "unknown", changes: [] } };
  const merged = R.mergeResearchPayload(first, second, { fill: true }).payload.formatState;
  assert.deepEqual([merged.groups, merged.alone], [pairs(["Kyle", "Nia"]), []]);
});
