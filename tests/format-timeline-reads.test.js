// Where the engine first reads the format's state over time (F3 part 2 of docs/PLAN-start-a-game-gpt.md, "Formats nobody
// announced"): the season's timeline from its stored research (db/format-timeline.js), the groups going into an episode from
// it (who left since dropped, unsure said), the newcomers asked about and staged, the desk's cue for them, the season's one word
// for its groups, a pass about some of the cast moved by the stored section, and A6's group question on a season played in
// pairs: its pairs offered at the lock, graded on the pairs that played, with its fallback. No bot, no database but the
// in-memory one. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
// Before the research module binds the embeddings (staging a paste stores none here).
const { fakeResearchDb, stubEmbeddings } = require("./harness/fake-research-db.js");
stubEmbeddings();
const TL = require("../src/lib/game/formats/format-timeline.js");
const R = require("../db/episode-research.js");
const FT = require("../db/format-timeline.js");
const G = require("../src/lib/game/game-spec/index.js");
const Formats = require("../src/lib/game/formats/index.js");

const g = (name, ...members) => ({ name, members });
const p = (...members) => ({ name: null, members });
function report(episode, groups, { changes = [], left = [], playedAs = "pairs", newcomers = [], merged = null, alone = [] } = {}) {
  return { episode, left, merged, state: { playedAs, phase: null, groups, alone, newcomers, wentHomeAs: left.length ? "individuals" : "nobody", changes } };
}
const change = (kind, from, when, extra = {}) => ({ kind, from, when, what: `${kind} from ${from}`, sure: "high", ...extra });

// Six people in pairs: kept through 2, one pair re-drawn at 3's start (Cal and Eve swap partners), an answer at 4 that
// contradicts itself (unsure), pairs at 5, then everyone for themselves from 6.
const P = ["Ann", "Bea", "Cal", "Dee", "Eve", "Fay"];
function paired() {
  return [
    report(1, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay")]),
    report(2, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay")]),
    report(3, [p("Ann", "Bea"), p("Cal", "Fay"), p("Eve", "Dee")], { changes: [change("swap", 3, "start")] }),
    report(4, [p("Ann", "Bea"), p("Cal", "Fay"), p("Eve", "Dee")], { changes: [change("split-into-individuals", 4, "start")] }),
    report(5, [p("Ann", "Bea"), p("Cal", "Fay"), p("Eve", "Dee")]),
    report(6, [], { playedAs: "individuals", changes: [change("split-into-individuals", 6, "start")] }),
  ];
}
const CAST = P.map((name, i) => ({ id: `c${i}`, name }));
const id = (name) => CAST.find((c) => c.name === name).id;

test("the timeline from stored research: one query a season, who went home from each answer, cues for who came in", async () => {
  const rows = [
    { episode_number: 1, state: paired()[0].state, merged: null, left_names: [] },
    { episode_number: 2, state: { ...paired()[1].state, newcomers: [{ name: "Joy", replaces: "Fay", group: "Eve" }], groups: [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Joy")] }, merged: null, left_names: ["Fay"] },
    { episode_number: 3, state: null, merged: "no", left_names: ["Joy"] },
  ];
  const seen = [];
  const pool = { query: async (sql, params) => (seen.push([sql, params]), sql.startsWith("SELECT id FROM shows") ? { rows: [{ id: "show-1" }] } : { rows: rows.filter((r) => r.episode_number < params[2]) }) };
  const tl = await FT.seasonFormatTimeline(pool, { showId: "show-1", season: "41", cast: P, before: 3 });
  assert.equal(seen[0][0], FT.REPORTS);
  assert.deepEqual(seen[0][1], ["show-1", 41, 3]);
  assert.equal(tl.last, 2, "only the episodes before");
  assert.deepEqual(TL.at(tl, 2).left, ["Fay"]);
  assert.deepEqual(TL.newcomersIn(tl, 3, P), ["Joy"], "Joy is still in going into 3, and isn't on the list");
  assert.deepEqual(TL.newcomersIn(tl, 3, [...P, "joy"]), [], "someone already on the list is never asked twice");
  assert.deepEqual(TL.newcomersIn(tl, 2, P), [], "not before the episode after the one she came in");
  // The whole season: Joy went home in 3. The desk's cue, while the season's cast doesn't have her.
  const all = await FT.timelineForShow(pool, "the-challenge", 41, P);
  assert.deepEqual(TL.newcomerCues(all, P), [{ name: "Joy", episode: 2, replaces: "Fay", group: "Eve", leftIn: 3 }]);
  assert.deepEqual(TL.newcomerCues(all, [...P, "Joy"]), [], "on the cast: no cue");
  assert.deepEqual(TL.newcomersIn(all, 4, P), [], "gone: not asked about");
  assert.equal(await FT.timelineForShow(pool, null, 41), null);
  // A malformed row: no castaways, a state that isn't one.
  assert.deepEqual(FT.reportOf({ episode_number: 7, state: "x", merged: null, left_names: null }), { episode: 7, state: null, left: [], merged: null });
});

test("the groups going in, from the timeline: who left since dropped, the answer that said it, and unsure said in the prompt", () => {
  const reports = [
    report(1, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay")]),
    report(2, null, { left: ["Dee"] }),
  ];
  const tl = TL.buildTimeline(reports, { cast: P });
  const gi = R.formatGoingIntoFrom(tl, 3);
  assert.equal(gi.episode, 1, "carried on from the answer that said who is with whom");
  assert.deepEqual(gi.state.groups, [p("Ann", "Bea"), p("Eve", "Fay")], "Dee went home in 2: Cal is on his own");
  assert.deepEqual(gi.state.alone, ["Cal"]);
  assert.equal(gi.state.playedAs, "pairs");
  assert.equal(gi.sure, false);
  assert.ok(gi.why.some((w) => /carried on from episode 1/.test(w)));
  const ctx = { showName: "The Challenge", season: 41, episodeNumber: 3, castNames: ["Ann", "Bea", "Cal", "Eve", "Fay"], terms: { castaway: "challenger", castaways: "challengers", tribe: "agency" }, format: Formats.formatFor("challenge"), domains: [] };
  const { user } = R.buildPrompt({ ...ctx, formatGoingIn: gi });
  assert.match(user, /as of the end of episode 1, playing as pairs/);
  assert.match(user, /We aren't sure of these: an earlier answer may have them wrong, so check them against what you find\./);
  assert.match(user, /On their own: Cal\./);
  // A sure state says nothing more, and none before the first answer is null.
  const sure = R.formatGoingIntoFrom(TL.buildTimeline([reports[0]], { cast: P }), 2);
  assert.equal(sure.sure, true);
  assert.doesNotMatch(R.buildPrompt({ ...ctx, episodeNumber: 2, formatGoingIn: sure }).user, /We aren't sure/);
  assert.equal(R.formatGoingIntoFrom(TL.buildTimeline([], { cast: P }), 1), null);
});

test("the season's word for its groups beside the section: tribe or team when the timeline says it, else the show's own", () => {
  const tribes = TL.buildTimeline([report(1, [g("Hina", "Ann", "Bea", "Cal"), g("Kele", "Dee", "Eve", "Fay")], { playedAs: "tribes" })], { cast: P });
  assert.equal(TL.groupWord(tribes, 2), "tribe", "played as tribes going in");
  const pairs = TL.buildTimeline(paired(), { cast: P });
  assert.equal(TL.groupWord(pairs, 3), null, "pairs aren't what staging moves: the show's own word stands");
  assert.equal(TL.groupWord(null, 1), null, "nothing known");
  // The show's own word is its data (Dancing with the Stars' couple), never a list of ours.
  const ctx = { showName: "Dancing with the Stars", season: 34, episodeNumber: 2, castNames: ["Ann", "Bea"], castGroups: { Ann: "Ann & Val" }, terms: { castaway: "celebrity", castaways: "celebrities", tribe: "couple" }, format: Formats.formatFor("survivor"), domains: [] };
  assert.match(R.buildPrompt(ctx).user, /The couple after each name is the one they were on going INTO this episode/);
  // The schema's newGroup and merged say the context's word.
  const person = (word) => R.jsonSchemaFor(R.researchSchemaFor(Formats.formatFor("survivor"), false, word), "strict").properties.castaways.items.properties;
  assert.match(person("team").newGroup.description, /moved to another team/);
  assert.match(person(null).newGroup.description, /moved to another tribe/);
});

test("the research context asks about the newcomers still in, and staging stages their results at the season level", async () => {
  const cast = ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn", "Eve Eno", "Fay Fox"];
  const { db, pool } = fakeResearchDb({
    shows: [{ id: "show-1", slug: "the-challenge", name: "The Challenge", format: "challenge", tribe_term: "Agency" }],
    seasons: [{ id: "season-41", show_id: "show-1", season_number: 41 }],
    seasonCast: cast.map((name, i) => ({ season_id: "season-41", name, tribe_name: i < 3 ? "Vets" : "New Threats" })),
  });
  const paste = async (n, groups, { left = {}, newcomers = [] } = {}) => {
    const ctx = await R.resolveSeasonResearchContext(pool, "the-challenge", 41, n);
    const skel = R.pasteSkeleton(ctx, []);
    skel.summary = `Episode ${n}.`;
    for (const c of skel.castaways) Object.assign(c, { leftTheGame: left[c.name] ? "yes" : "no", exitMethod: left[c.name] || null, confidence: "high", sources: ["https://example.com"] });
    skel.formatState = { playedAs: "pairs", phase: null, groups, alone: [], newcomers, wentHomeAs: Object.keys(left).length ? "individuals" : "nobody", changes: newcomers.length ? [{ kind: "newcomer", when: "mid", from: n, what: "Joy came in.", sure: "high" }] : [] };
    return { ctx, run: await R.researchFromPaste(pool, "the-challenge", 41, n, JSON.stringify(skel), { structured: true }) };
  };
  const one = await paste(1, [p("Ann Able", "Bea Bell"), p("Cal Cole", "Dev Dunn"), p("Eve Eno", "Fay Fox")]);
  assert.deepEqual(one.ctx.castNames, cast);
  assert.equal(one.ctx.groupWord, null, "nothing known going in: the show's own word stands (its row's data)");
  // Fay quits in 2; Joy Jones comes in for her, beside Eve.
  const two = await paste(2, [p("Ann Able", "Bea Bell"), p("Cal Cole", "Dev Dunn"), p("Eve Eno", "Joy Jones")], { left: { "Fay Fox": "Quit" }, newcomers: [{ name: "Joy Jones", replaces: "Fay Fox", group: "Eve Eno" }] });
  assert.ok(two.run.problems.some((x) => /Joy Jones came in this episode \(for Fay Fox\) and isn't in the cast/.test(x)), two.run.problems.join(" | "));
  // Episode 3 asks about her, with the pairs going in (Eve & Joy), and stages her exit.
  const three = await paste(3, [p("Ann Able", "Bea Bell"), p("Cal Cole", "Dev Dunn")], { left: { "Eve Eno": "Eliminated", "Joy Jones": "Eliminated" } });
  assert.deepEqual(three.ctx.castNames, ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn", "Eve Eno", "Joy Jones"]);
  assert.deepEqual(three.ctx.newcomers, ["Joy Jones"]);
  assert.deepEqual(three.ctx.formatGoingIn.state.groups.map((x) => x.members.join(" & ")), ["Ann Able & Bea Bell", "Cal Cole & Dev Dunn", "Eve Eno & Joy Jones"]);
  assert.equal(three.ctx.formatGoingIn.sure, true);
  const prompt = R.buildPastePrompt(three.ctx, [], { structured: true });
  assert.match(prompt, /6\. Joy Jones\n/, "on the checklist like anyone");
  assert.match(prompt, /- Eve Eno & Joy Jones\n/);
  assert.doesNotMatch(prompt, /agenc/i);
  assert.match(prompt, /The group after each name is the one our records give them going INTO this episode, which may be only a label/, "Vets and New Threats beside the pairs: only a label");
  const exits = db.decisions.filter((d) => d.kind === "elimination" && d.episode_number === 3).map((d) => `${d.castaway_name}:${d.method}`).sort();
  assert.deepEqual(exits, ["Eve Eno:Eliminated", "Joy Jones:Eliminated"], "her exit staged for the season, under research's name for her");
  // The desk's cue, from the database.
  const cues = TL.newcomerCues(TL.buildTimeline(await FT.seasonReports(pool, { showId: "show-1", season: 41 }), { cast }), cast);
  assert.deepEqual(cues, [{ name: "Joy Jones", episode: 2, replaces: "Fay Fox", group: "Eve Eno", leftIn: 3 }]);
});

test("a newcomer named like someone on the cast stays their own person when staged", async () => {
  const { pool } = fakeResearchDb({ seasons: [{ id: "season-1", show_id: "show-1", season_number: 1 }], seasonCast: [{ season_id: "season-1", name: "Joy Jones" }, { season_id: "season-1", name: "Cal Cole" }] });
  const entry = (name, left) => ({ name, leftTheGame: left ? "yes" : "no", exitMethod: left ? "Eliminated" : null, confidence: "high", sources: ["https://x"] });
  const run = { seasonId: "season-1", episodeNumber: 3, format: Formats.formatFor("challenge") };
  // "Joy" came in (the cast's forgiving match would make her Joy Jones, who has an entry of her own) and goes home.
  const items = await R.researchItems(pool, "season-1", run, { castaways: [entry("Joy Jones", false), entry("Cal Cole", false), entry("Joy", true)] });
  assert.deepEqual(items.filter((i) => i.kind === "elimination").map((i) => i.name), ["Joy"]);
  // A name said another way for one person (no entry of its own for who it resolves to) still takes the cast's spelling.
  const one = await R.researchItems(pool, "season-1", run, { castaways: [entry("Cal Cole", false), entry("Joy", true)] });
  assert.deepEqual(one.filter((i) => i.kind === "elimination").map((i) => i.name), ["Joy Jones"]);
});

test("a pass about some of the cast: the stored section says the moves of whoever it asked again", () => {
  const survivor = Formats.formatFor("survivor");
  const cast = ["Ann Able", "Bea Bell", "Cal Cole", "Dev Dunn"];
  const groups = { "Ann Able": "Reds", "Bea Bell": "Reds", "Cal Cole": "Blues", "Dev Dunn": "Blues" };
  const stored = { playedAs: "tribes", phase: null, groups: [g("Reds", "Ann Able", "Cal Cole"), g("Blues", "Bea Bell", "Dev Dunn")], alone: [], newcomers: [], wentHomeAs: "nobody", changes: [change("swap", 3, "start")] };
  // Asked again about Bea and Cal (low confidence the first time); the partial answer's newGroup says nothing.
  const parsed = { castaways: ["Bea Bell", "Cal Cole"].map((name) => ({ name, leftTheGame: "no", exitMethod: null, confidence: "high", sources: ["https://x"], newGroup: null })) };
  const review = R.validateResearch(parsed, cast, { castaways: "castaways" }, survivor, { partial: true, groups, storedState: stored });
  assert.deepEqual(review.entries.map((e) => `${e.name}->${e.newGroup}`), ["Bea Bell->Blues", "Cal Cole->Reds"]);
  // Without the stored section, as before.
  const bare = { castaways: parsed.castaways.map((c) => ({ ...c, newGroup: null })) };
  assert.deepEqual(R.validateResearch(bare, cast, { castaways: "castaways" }, survivor, { partial: true, groups }).entries.map((e) => e.newGroup), [null, null]);
});

test("A6 on the timeline: which source wins, the pairs offered at each lock, and how each episode was played", () => {
  const tl = TL.buildTimeline(paired(), { cast: P });
  const fg = TL.groupFacts(tl, { cast: CAST, tribes: ["Vets", "New Threats"] });
  assert.deepEqual([...fg.keys()], [2, 3, 4, 5, 6, 7], "from the first lock with pairs going in (the premiere's are its own answer's), to the next one");
  const names = (n) => fg.get(n).offered.map((x) => x.name);
  assert.deepEqual(names(3), ["Ann & Bea", "Cal & Dee", "Eve & Fay"], "the pairs going into 3: offered at its lock");
  assert.equal(fg.get(3).byCastaway.get(id("Cal")), fg.get(3).offered[1].id);
  assert.deepEqual([...fg.get(3).played.held].map((x) => fg.get(3).offered.find((o) => o.id === x).name), ["Ann & Bea"], "re-drawn at 3's start: only Ann & Bea played it as offered");
  assert.equal(fg.get(3).played.sure, true);
  assert.equal(fg.get(5).lockSure, false, "4's answer contradicted itself: the state going into 5 isn't sure");
  assert.equal(fg.get(4).played.sure, false, "nor how 4 was played");
  assert.deepEqual(names(7), [], "everyone for themselves from 6: nothing to pick");
  assert.equal(fg.get(7).played, null, "7 has no report yet");
  // Named tribes the league holds stay the league's (Survivor: its staged tribe moves); pairs it doesn't, the timeline's.
  const tribes = TL.buildTimeline([report(1, [g("Hina", "Ann", "Bea", "Cal"), g("Kele", "Dee", "Eve", "Fay")], { playedAs: "tribes" }), report(2, [g("Hina", "Ann", "Bea", "Cal"), g("Kele", "Dee", "Eve", "Fay")], { playedAs: "tribes" })], { cast: P });
  assert.equal(TL.groupFacts(tribes, { cast: CAST, tribes: ["Hina", "Kele"] }).size, 0);
  assert.equal(TL.unstaged([g("Hina", "Ann", "Bea", "Cal"), g("Kele", "Dee", "Eve", "Fay")], ["Hina"]), false, "named tribes, one of them new: staged (a swap's new tribe is a move)");
  assert.equal(TL.unstaged([g("Hina", "Ann", "Bea"), g("Kele", "Cal", "Dee")], ["Hina"]), false, "small tribes, one of them the league's: still its tribes (Survivor late in its pre-merge)");
  assert.equal(TL.unstaged([g("Hina", "Ann", "Bea"), p("Cal", "Dee"), g("Kele", "Eve", "Fay", "Gus")].slice(0, 2), ["Hina"]), false, "one left unnamed beside one the league has: its tribes");
  assert.equal(TL.unstaged([g("Pair 1", "Ann", "Bea"), g("Pair 2", "Cal", "Dee")], ["Vets"]), true, "named pairs the league hasn't got: the timeline's, as movesFromState moves nobody onto them");
  assert.equal(TL.unstaged([p("Ann", "Bea"), p("Cal", "Dee")], []), true, "unnamed pairs: the timeline's");
  assert.equal(TL.unstaged([g("Red", "Ann", "Bea"), g("Blue", "Cal", "Dee")], ["Red", "Blue"]), false, "named pairs the league has");
  assert.equal(TL.unstaged([p("Ann", "Bea", "Cal"), p("Dee", "Eve", "Fay")], []), false, "tribes an answer left unnamed: still the league's (Survivor never moves to the timeline over a missing name)");
  assert.equal(TL.groupLabel(p("Ann", "Bea", "Cal")), "Ann, Bea & Cal");
  // The code review's cases. A lock past the last report (its research not in yet) is still the timeline's, unsure, not the
  // league's tribes; an episode with research but no format section played unsure; a pair kept at a re-draw that went home
  // whole held; members matched the forgiving way.
  const later = TL.groupFacts(tl, { cast: CAST, tribes: [], through: 9 });
  assert.deepEqual([...later.keys()], [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual([later.get(9).offered, later.get(9).lockSure, later.get(9).played], [[], false, null]);
  const gap = TL.buildTimeline([report(1, [p("Ann", "Bea"), p("Cal", "Dee")]), { episode: 2, left: [], merged: null, state: null }, report(3, [p("Ann", "Bea"), p("Cal", "Dee")])], { cast: P });
  const gf = TL.groupFacts(gap, { cast: CAST });
  assert.equal(gf.get(2).played.sure, false, "no format section in 2: how it was played isn't known");
  const home = TL.buildTimeline([report(1, [p("Ann", "Bea"), p("Cal", "Dee"), p("Eve", "Fay")]), report(2, [p("Cal", "Eve"), p("Dee", "Fay")], { left: ["Ann", "Bea"], changes: [change("swap", 2, "start")] })], { cast: P });
  const hf = TL.groupFacts(home, { cast: CAST });
  const held = [...hf.get(2).played.held].map((x) => hf.get(2).offered.find((o) => o.id === x).name);
  assert.deepEqual(held, ["Ann & Bea"], "kept at the re-draw and voted out together: held; the re-drawn ones not");
  const loose = TL.groupFacts(tl, { cast: [{ id: "x", name: "Ann Able" }], resolve: (m) => (m === "Ann" ? "x" : null) });
  assert.deepEqual(loose.get(3).offered[0].members, ["x"]);
});

test("A6 on the timeline: graded on the pairs that played, a re-drawn pair void, an unsure episode void, carry-on follows the people", () => {
  const tl = TL.buildTimeline(paired(), { cast: P });
  const formatGroups = TL.groupFacts(tl, { cast: CAST, tribes: [] });
  const won = (n, who) => ({ out: [], events: new Map([["dailyWin", 1]]), who: new Map([["dailyWin", new Map([[id(who), 1]])]]), in: CAST.map((c) => c.id), groups: new Map(), roles: new Map(), points: null });
  const facts = (eps) => ({ from: 1, to: null, over: false, episodes: new Map(eps), winner: null, ended: false, order: null, names: new Map(CAST.map((c) => [c.id, c.name])), groupNames: new Map(), formatGroups });
  const Q = { id: "pair", ask: "Which pair wins the daily?", answer: "group", points: 2, asked: "each", closes: "start", pick: 1, settle: { by: "moment", moment: "dailyWin", take: "who" } };
  const at3 = formatGroups.get(3).offered.map((x) => x.id);
  const [AB, CD, EF] = at3;
  const answers = [{ playerId: "ann", answer: AB }, { playerId: "bo", answer: CD }, { playerId: "cy", answer: EF }];
  // Ann won 3: Ann & Bea held, right; the re-drawn pairs' picks are void, neither right nor wrong.
  let v = G.verdictOf(Q, 3, facts([[3, won(3, "Ann")]]));
  assert.equal(v.state, "known");
  assert.deepEqual(v.groups, [AB]);
  assert.deepEqual(v.held, [AB]);
  assert.deepEqual([...G.pointsFor(Q, v, answers)], [["ann", 2]]);
  assert.deepEqual(answers.map((a) => G.isRight(Q, v, a, answers)), [true, null, null]);
  // A wager on a void pick stakes nothing either way.
  const W = { ...Q, wager: 3 };
  const bets = [{ playerId: "bo", answer: { answer: CD, stake: 3 } }, { playerId: "ann", answer: { answer: AB, stake: 1 } }];
  assert.deepEqual([...G.pointsFor(W, G.verdictOf(W, 3, facts([[3, won(3, "Ann")]])), bets)], [["ann", 3]]);
  // Cal won 3, on a pair that didn't play as offered: nobody's right, Cal & Dee's pick still void.
  v = G.verdictOf(Q, 3, facts([[3, won(3, "Cal")]]));
  assert.deepEqual(v.groups, []);
  assert.deepEqual([...G.pointsFor(Q, v, answers)], []);
  assert.deepEqual(answers.map((a) => G.isRight(Q, v, a, answers)), [false, null, null]);
  // Following the people (carry-on): Cal & Dee as offered, Cal won.
  const C = { ...Q, fallback: "carry-on" };
  v = G.verdictOf(C, 3, facts([[3, won(3, "Cal")]]));
  assert.deepEqual(v.groups, [CD]);
  assert.deepEqual([...G.pointsFor(C, v, answers)], [["bo", 2]]);
  // Held all through 2: graded as it stands.
  assert.deepEqual(G.verdictOf(Q, 2, facts([[2, won(2, "Eve")]])).groups, [formatGroups.get(2).offered[2].id]);
  // 4 played unsure, 5's lock unsure: void (off), no points either way; carry-on grades them by the people.
  assert.equal(G.verdictOf(Q, 4, facts([[4, won(4, "Ann")]])).state, "off");
  assert.equal(G.verdictOf(Q, 5, facts([[5, won(5, "Ann")]])).state, "off");
  assert.equal(G.verdictOf(C, 5, facts([[5, won(5, "Ann")]])).state, "known");
  // Results in, no report yet: waiting. Asked once, or over a window: the league's own groups, as before.
  assert.equal(G.verdictOf(Q, 7, facts([[7, won(7, "Ann")]])).state, "waiting");
  assert.equal(G.verdictOf({ ...Q, over: 2 }, 3, facts([[3, won(3, "Ann")], [4, won(4, "Ann")]])).state, "off", "the league's groups: nobody on one");
  // A game over with an episode research never came for: void, not waiting for ever.
  assert.equal(G.verdictOf(Q, 7, { ...facts([[7, won(7, "Ann")]]), over: true }).state, "off");
  // One test for which questions read the timeline, the grader's and the server's.
  assert.deepEqual([Q, { ...Q, asked: "once" }, { ...Q, over: 2 }, { ...Q, answer: "person" }].map(G.readsTimeline), [true, false, false, false]);
});

test("a group question's fallback in the spec: void or carry-on, only on a group asked about each episode; next-stage is A12's", () => {
  const Q = { id: "pair", ask: "Which pair wins the daily?", answer: "group", points: 1, asked: "each", settle: { by: "results", take: "out" } };
  const game = (q) => ({ spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [q] });
  const ats = (q) => G.specProblems(game(q)).map((x) => x.at);
  assert.deepEqual(ats({ ...Q, fallback: "void" }), []);
  assert.deepEqual(ats({ ...Q, fallback: "carry-on" }), []);
  assert.deepEqual(ats({ ...Q, fallback: "maybe" }), ["ask[0].fallback"]);
  assert.deepEqual(ats({ ...Q, answer: "person", fallback: "void" }), ["ask[0].fallback"]);
  assert.deepEqual(ats({ ...Q, asked: "once", fallback: "void" }), ["ask[0].fallback"]);
  assert.deepEqual(ats({ ...Q, over: 2, fallback: "void" }), ["ask[0].fallback"]);
  assert.deepEqual(G.specWaitsFor(game({ ...Q, fallback: "next-stage" })).map((x) => x.step), ["later"]);
  assert.equal(G.playable({ ...Q, fallback: "next-stage" }), false);
  assert.equal(G.playable({ ...Q, fallback: "void" }), true);
});
