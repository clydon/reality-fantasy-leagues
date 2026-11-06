// The players' own answers settle a question (docs/PLAN-start-a-game-gpt.md step A14 part 1: the dial row settle.majority and the
// request s31 "Guess what most of us will pick; you score if you match the majority"): `settle: { by: 'players', take: 'majority' |
// 'minority', of?, tie? }`, the answer most of you gave in the window (or fewest), among its own answers or, with `of`, the game's
// question it names. Data settles it (the couch's answers, never what happened on the show); every answer is hidden until the lock
// (answers.ts); known once the window's first episode has results as far as the viewer has seen. Its shape and our check; its
// words; grading (majority, minority, a guess about another question, a wager, a split pot, a rollover); each fallback from the start
// (fewer than two answers, a minority everyone shared, a tie: void, or each tied one right with tie 'all'); at a viewer's mark; a
// life riding on it; the tally a read shows. The server's reads are proven by scripts/dev-test/check-players-game.js. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true };
/** Who goes home, before each episode: 2 points if yours is the answer most of you give (the tracker's s31). */
const HERD = { id: "herd", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "players", take: "majority" } };
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
/** What most of us will say to "Who goes home?" (a guess about the boot question's answers). */
const GUESS = { id: "guess", ask: "Who will most of us say goes home?", answer: "person", points: 3, asked: "each", settle: { by: "players", take: "majority", of: "boot" } };
const game = (ask, score = {}, extra = {}) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...score }, rank: { by: "total" }, ask, ...extra });
const SEATS = ["ann", "bo", "cy", "di", "ed"];

/** A game of questions on Survivor with castaways C0.. (two tribes) and seats ann .. ed. */
function league(spec, { n = 8, eps = 6, seats = SEATS } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "wikiSeason", 51);
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  const kele = S.addTribe(s, "Kele", "#c00");
  const hina = S.addTribe(s, "Hina", "#00c");
  s.castaways.forEach((c, i) => {
    c.tribeId = i < n / 2 ? kele.id : hina.id;
  });
  s.players = seats.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
/** Episode n's results: castaway `i` voted out. */
const boot = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
/** Answers for one question and episode: { playerId: answer }. */
const said = (n, by, question = "herd") => Object.entries(by).map(([playerId, answer]) => ({ playerId, question, episode: n, answer }));
const pts = (m) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));

test("its shape: one answer each, in a game of questions with one lock for everyone; of, tie and their words", () => {
  assert.deepEqual(G.specProblems(game([HERD]), CTX), []);
  assert.deepEqual(G.specWaitsFor(game([HERD])), []);
  assert.equal(G.fullSpec(game([HERD])).ask[0].settle.tie, "none", "a tie is void by default");
  assert.deepEqual(G.PLAYERS, { tie: "none" });
  assert.equal(G.isPlayers(HERD), true);
  assert.equal(G.isPlayers(BOOT), false);
  // Every kind with one answer: a person, a group (one each), yes or no, a choice, an over/under.
  const kinds = [
    { answer: "group", pick: 1 },
    { answer: "yesNo" },
    { answer: "choice", options: ["Kele", "Hina", "Neither"] },
    { answer: "overUnder", line: 1.5 },
  ];
  for (const k of kinds) assert.deepEqual(G.specProblems(game([{ ...HERD, ...k }]), CTX), [], k.answer);
  const problems = (spec) => ats(G.specProblems(spec, CTX));
  assert.deepEqual(problems(game([{ ...HERD, pick: 2 }])), ["ask[0].pick"], "one each: a majority of lists isn't one");
  assert.deepEqual(problems(game([{ ...HERD, answer: "number" }])), ["ask[0].settle"], "a number is the closest's, not the most said");
  assert.deepEqual(problems(game([{ ...HERD, answer: "order", pick: 3 }])), ["ask[0].settle"]);
  assert.deepEqual(problems(game([{ ...HERD, answer: "yesNo", each: "person" }])), ["ask[0].settle"], "a question about each person isn't one answer");
  assert.deepEqual(problems(game([{ ...HERD, settle: { by: "players", take: "most" } }])), ["ask[0].settle.take"]);
  assert.deepEqual(problems(game([{ ...HERD, settle: { by: "players", take: "majority", tie: "coin" } }])), ["ask[0].settle.tie"]);
  assert.deepEqual(problems(game([{ ...BOOT, settle: { by: "results", take: "out", tie: "all" } }])), ["ask[0].settle.tie"], "only the players' answers tie");
  assert.deepEqual(problems(game([{ ...BOOT, settle: { by: "results", take: "out", of: "herd" } }])), ["ask[0].settle.of"]);
  assert.deepEqual(problems(game([HERD], {}, { extras: { lateLock: { hours: 24 } } })), ["ask[0].settle"], "one lock for everyone: a late lock would show some the answers first");
  // In a game of questions, or (C2 part 4c) beside a draft as one of its own questions; never a pool's or a bingo card's.
  assert.ok(!problems({ preset: "outlast", ask: [HERD] }).includes("ask[0].settle"));
  assert.ok(problems({ preset: "survival-pool", ask: [HERD] }).includes("ask[0].settle"));
  // `of`: the game's question it guesses at, answered the same way and asked when it is.
  assert.deepEqual(G.specProblems(game([BOOT, GUESS]), CTX), []);
  assert.deepEqual(problems(game([BOOT, { ...GUESS, settle: { ...GUESS.settle, of: "nope" } }])), ["ask[1].settle.of"]);
  assert.deepEqual(problems(game([BOOT, { ...GUESS, settle: { ...GUESS.settle, of: "guess" } }])), ["ask[1].settle.of"], "not itself");
  assert.deepEqual(problems(game([HERD, { ...GUESS, settle: { ...GUESS.settle, of: "herd" } }])), ["ask[1].settle.of"], "not one the players settle");
  assert.deepEqual(problems(game([{ ...BOOT, answer: "group" }, GUESS])), ["ask[1].settle.of"], "the same kind of answer");
  assert.deepEqual(problems(game([{ ...BOOT, asked: "once" }, GUESS])), ["ask[1].settle.of"], "asked the same way");
  assert.deepEqual(problems(game([{ ...BOOT, pick: 2 }, GUESS])), ["ask[1].settle.of"], "one each there too");
  // Its round trip through a league's settings.
  const s = league(game([BOOT, GUESS]));
  assert.deepEqual(S.gameOf(s).ask[1].settle, { by: "players", take: "majority", of: "boot", tie: "none" });
});

test("its words: what most (or fewest) of you give, to it or to the question it's about, and when it doesn't count", () => {
  const words = describeSpec(game([HERD]), { ...CTX, show: "Survivor" });
  assert.match(words.sentence, /2 points when yours is the answer most of you give\./);
  assert.match(words.rules.join(" "), /Who goes home\? 2 points if yours is the answer most of you give\. A tie doesn't count either way\. If fewer than two of you answer, it doesn't count either way\./);
  assert.match(words.rules.join(" "), /Nobody sees them until then/, "every answer is hidden until its lock");
  const minority = describeSpec(game([{ ...HERD, settle: { by: "players", take: "minority", tie: "all" } }]), CTX);
  assert.match(minority.rules.join(" "), /the answer fewest of you give\. A tie: each of them counts\. If you all say the same, or fewer than two of you answer, it doesn't count either way\./);
  const guess = describeSpec(game([BOOT, GUESS]), CTX).rules.join(" ");
  assert.match(guess, /3 points if yours is what most of you answer to "Who goes home\?"/);
});

test("majority: the answer most of you gave is right once its episode is in; a tie and too few answers void it", () => {
  const s = league(game([HERD]));
  const c = (i) => cid(s, i);
  const rows = said(1, { ann: c(0), bo: c(0), cy: c(1), di: c(2) });
  // Waiting until its episode has results (every answer is in by the lock, but its points come with the episode).
  assert.deepEqual(A.grade(s, rows).verdicts.get("herd|1"), { state: "waiting" });
  boot(s, 1, 5);
  const g = A.grade(s, rows);
  const v = g.verdicts.get("herd|1");
  assert.equal(v.state, "known");
  assert.deepEqual(v.right, [c(0)], "what most of you said, whoever went home");
  assert.deepEqual(v.tally, [{ answer: c(0), n: 2 }, { answer: c(1), n: 1 }, { answer: c(2), n: 1 }]);
  assert.deepEqual(pts(g.points), { ann: 2, bo: 2 });
  // Each answer's own verdict, as the reads show it.
  assert.equal(G.isRight(S.gameOf(s).ask[0], v, rows[0], rows), true);
  assert.equal(G.isRight(S.gameOf(s).ask[0], v, rows[2], rows), false);
  // A tie for the most: void (the default), no points either way ...
  const tie = said(1, { ann: c(0), bo: c(0), cy: c(1), di: c(1) });
  const off = A.grade(s, tie).verdicts.get("herd|1");
  assert.equal(off.state, "off");
  assert.match(off.why, /tie/);
  assert.equal(off.tally.length, 2, "the tally still says what each said");
  assert.equal(A.grade(s, tie).points.size, 0);
  // ... or each tied one right, with tie 'all'.
  const all = league(game([{ ...HERD, settle: { by: "players", take: "majority", tie: "all" } }]));
  boot(all, 1, 5);
  const tieAll = said(1, { ann: cid(all, 0), bo: cid(all, 0), cy: cid(all, 1), di: cid(all, 1), ed: cid(all, 2) });
  assert.deepEqual(pts(A.grade(all, tieAll).points), { ann: 2, bo: 2, cy: 2, di: 2 });
  // Fewer than two answers: nobody's majority.
  const one = A.grade(s, said(1, { ann: c(0) })).verdicts.get("herd|1");
  assert.equal(one.state, "off");
  assert.match(one.why, /Fewer than two/);
  // Nobody answered at all: void too (a read of a window with no answers).
  assert.equal(G.verdictOf(S.gameOf(s).ask[0], 1, A.facts(s)).state, "off");
  // Everyone the same: all right.
  assert.deepEqual(pts(A.grade(s, said(1, { ann: c(3), bo: c(3), cy: c(3) })).points), { ann: 2, bo: 2, cy: 2 });
});

test("minority: the answer fewest of you gave; everyone the same is void; a yes or no, a choice and a group", () => {
  const spec = (a) => game([{ ...HERD, ...a, settle: { by: "players", take: "minority" } }]);
  const s = league(spec({}));
  boot(s, 1, 5);
  const c = (i) => cid(s, i);
  const rows = said(1, { ann: c(0), bo: c(0), cy: c(0), di: c(1), ed: c(1) });
  assert.deepEqual(A.grade(s, rows).verdicts.get("herd|1").right, [c(1)]);
  assert.deepEqual(pts(A.grade(s, rows).points), { di: 2, ed: 2 });
  const same = A.grade(s, said(1, { ann: c(0), bo: c(0), cy: c(0) })).verdicts.get("herd|1");
  assert.equal(same.state, "off");
  assert.match(same.why, /all said the same/);
  // A tie for the fewest is a tie.
  assert.equal(A.grade(s, said(1, { ann: c(0), bo: c(0), cy: c(0), di: c(1), ed: c(2) })).verdicts.get("herd|1").state, "off");
  // A yes or no, matched however it's written.
  const yn = league(spec({ answer: "yesNo", ask: "Will there be a blindside?" }));
  boot(yn, 1, 5);
  assert.deepEqual(pts(A.grade(yn, said(1, { ann: "yes", bo: "yes", cy: "no" })).points), { cy: 2 });
  // A choice's options.
  const ch = league(game([{ ...HERD, answer: "choice", options: ["Kele", "Hina"], ask: "Which tribe wins immunity?" }]));
  boot(ch, 1, 5);
  assert.deepEqual(pts(A.grade(ch, said(1, { ann: "Kele", bo: "Hina", cy: "Kele" })).points), { ann: 2, cy: 2 });
  // A group, by its id.
  const gr = league(game([{ ...HERD, answer: "group", pick: 1, ask: "Which tribe goes to tribal?" }]));
  boot(gr, 1, 5);
  const [kele, hina] = gr.tribes.map((t) => t.id);
  assert.deepEqual(pts(A.grade(gr, said(1, { ann: [kele], bo: hina, cy: kele })).points), { ann: 2, cy: 2 }, "one named as a list of one counts the same");
});

test("a guess about another question: what most of you answered to it, whoever answered the guess", () => {
  const s = league(game([BOOT, GUESS]));
  const c = (i) => cid(s, i);
  boot(s, 1, 1);
  const boots = said(1, { ann: c(1), bo: c(1), cy: c(1), di: c(2) }, "boot");
  const guesses = said(1, { ann: c(2), bo: c(1), ed: c(1) }, "guess");
  const g = A.grade(s, [...boots, ...guesses]);
  assert.deepEqual(g.verdicts.get("guess|1").right, [c(1)], "settled by the boot question's answers, not the guesses'");
  assert.deepEqual(pts(g.points), { ann: 1, bo: 4, cy: 1, ed: 3 }, "the boot question by the results, the guess by what most said");
  // Nobody guessed: how it stands all the same, for the reads.
  assert.deepEqual(A.grade(s, boots).verdicts.get("guess|1").right, [c(1)]);
});

test("with A9's ways: a wager on matching the majority, a split pot and a rollover through void weeks", () => {
  const w = league(game([{ ...HERD, answer: "yesNo", ask: "Will there be a blindside?", wager: 5 }]));
  boot(w, 1, 5);
  const bet = said(1, { ann: { answer: "yes", stake: 3 }, bo: { answer: "yes", stake: 1 }, cy: { answer: "no", stake: 2 } });
  assert.deepEqual(pts(A.grade(w, bet).points), { ann: 5, bo: 3, cy: -2 }, "counted by what each said, not their stakes");
  const sp = league(game([{ ...HERD, points: 6, share: "split" }]));
  boot(sp, 1, 5);
  const c = (i) => cid(sp, i);
  assert.deepEqual(pts(A.grade(sp, said(1, { ann: c(0), bo: c(0), cy: c(0), di: c(1) })).points), { ann: 2, bo: 2, cy: 2 });
  // A rollover: a tie on 1 (void) carries its points into 2.
  const ro = league(game([{ ...HERD, rollover: true }]));
  boot(ro, 1, 5);
  boot(ro, 2, 6);
  const r = (i) => cid(ro, i);
  const g = A.grade(ro, [...said(1, { ann: r(0), bo: r(1) }), ...said(2, { ann: r(0), bo: r(0), cy: r(1) })]);
  assert.equal(g.worth.get("herd|2"), 4);
  assert.deepEqual(pts(g.points), { ann: 4, bo: 4 });
});

test("at a viewer's mark, and asked once (settled at the game's first episode)", () => {
  const s = league(game([HERD]));
  const c = (i) => cid(s, i);
  boot(s, 1, 5);
  boot(s, 2, 6);
  const rows = [...said(1, { ann: c(0), bo: c(0), cy: c(1) }), ...said(2, { ann: c(1), bo: c(2), cy: c(2) })];
  // Someone who has seen Episode 1 only: Episode 2's still waiting for them.
  const view = S.GhostLogic.viewFor(s, "ann", 1);
  const g = A.grade(view, rows);
  assert.equal(g.verdicts.get("herd|1").state, "known");
  assert.equal(g.verdicts.get("herd|2").state, "waiting");
  assert.deepEqual(pts(g.points), { ann: 2, bo: 2 });
  // A late joiner playing a season of their own (a ghost, in nobody else's copy) is graded on the couch's majority, never counted in
  // it, so every copy says the same.
  s.players.push({ id: "gh", name: "gh", color: "#000", ghost: true });
  const withGhost = [...rows, ...said(1, { gh: c(1) })];
  const full = A.grade(s, withGhost);
  assert.deepEqual(full.verdicts.get("herd|1").tally, [{ answer: c(0), n: 2 }, { answer: c(1), n: 1 }], "the ghost's answer isn't in the tally");
  assert.equal(full.points.get("gh"), undefined, "and it missed the majority");
  assert.deepEqual(A.grade(S.GhostLogic.viewFor(s, "gh", 1), withGhost).verdicts.get("herd|1").tally, full.verdicts.get("herd|1").tally, "the same in the ghost's own copy");
  s.players.pop();
  // Asked once: about the game, closing at its first episode, known once that one is in.
  const once = league(game([{ ...HERD, asked: "once", ask: "Who wins? Score if you match most of us" }]));
  const o = (i) => cid(once, i);
  const answers = said(0, { ann: o(0), bo: o(0), cy: o(1) });
  assert.equal(A.grade(once, answers).verdicts.get("herd|0").state, "waiting");
  boot(once, 1, 5);
  assert.deepEqual(pts(A.grade(once, answers).points), { ann: 2, bo: 2 });
});

test("a life riding on it: a pool of questions where missing the majority costs one", () => {
  const spec = game([HERD], { lives: 1 }, { rank: { by: "standing" } });
  assert.deepEqual(G.specProblems(spec, CTX), []);
  const s = league(spec);
  const c = (i) => cid(s, i);
  boot(s, 1, 5);
  boot(s, 2, 6);
  const rows = [...said(1, { ann: c(0), bo: c(0), cy: c(1), di: c(0), ed: c(0) }), ...said(2, { ann: c(1), bo: c(1), di: c(1), ed: c(2) })];
  const walk = A.walk(s, rows, A.facts(s));
  // Episode 1: cy missed the majority (out); Episode 2: ed missed it (out). ann, bo and di stand.
  assert.deepEqual(walk.out, { cy: 1, ed: 2 });
});
