// Bounties (docs/PLAN-start-a-game-gpt.md step A14 part 3; the tracker's s16, "Bounties: if your castaway votes out mine, you steal
// 2."): points that move between seats by what the results say. Who voted for whom is research's (formats/votes.js recordOf, from an
// episode's stored answer, sure only when its own answers agree), stamped on each episode with results (vote-records.ts); the
// sequence's bountyLines moves a bounty's points from each seat holding who went home to each other seat holding a voter; a draft's
// walk adds them up beside its points. Its shape, defaults, refusals, words and settings; the record's sureness; the lines; an
// Outlast's and a lineup's table and series; the fallback (void) on an unsure record or one the league's results disagree with; the
// spoiler view. Every number is worked out by hand in its comment. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Seq = require("../src/lib/game/sequence/index.js");
const F = require("../src/lib/game/formats/index.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true, jury: true, votes: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const S16 = { preset: "outlast", score: { by: "place", bounty: { points: 2 } } };
const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { start: 2 }, score: { by: "moments", points: null, bounty: { points: 1.5 } } };

test("a bounty: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  for (const s of [S16, LINEUP, { ...S16, get: { by: "draft", each: 3, order: "blind", own: "shared" } }]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(G.withSpec(S.defaultState().settings, S16).bounty, { points: 2 });
  assert.deepEqual(G.bountyOf(S16), { on: "votedOut", points: 2 });
  assert.equal(G.bountyOf({ preset: "outlast" }), null);
  assert.equal(G.typeOf(S16), "classic-draft");
  assert.equal(G.typeOf(LINEUP), "active-roster");
  // Words.
  const d = G.describeSpec(S16, { castaway: "castaway" });
  assert.ok(d.sentence.endsWith("Bounties: when one of your castaways votes out someone else's, you take 2 points from them."), d.sentence);
  assert.ok(d.rules.includes("Every one of yours who voted for who went home takes 2 points. If the episode's votes aren't clear, no bounty that episode."));
  assert.ok(G.describeSpec(LINEUP).rules.includes("Only starters count, voting or voted out."));
  assert.ok(G.describeSpec({ ...S16, get: { by: "draft", each: 3, order: "blind", own: "shared" } }, { castaway: "castaway" }).rules.some((r) => r.startsWith("Share a castaway with someone?")));
  // Refused, each with why.
  const b = (bounty, more = {}) => at({ ...S16, score: { by: "place", bounty }, ...more });
  assert.deepEqual(b(2), ["score.bounty"]);
  assert.deepEqual(b({ points: 0 }), ["score.bounty.points"]);
  assert.deepEqual(b({ points: 1.25 }), ["score.bounty.points"], "in halves");
  assert.deepEqual(b({ points: 11 }), ["score.bounty.points"]);
  assert.deepEqual(b({ points: 2, on: "immunity" }), ["score.bounty.on"]);
  assert.deepEqual(b({ points: 2, from: "bank" }), ["score.bounty.from"], "an unknown key");
  assert.deepEqual(at(S16, { ...CTX, votes: false }), ["score.bounty"], "nobody voted out on the show");
  assert.deepEqual(at(S16, { ...CTX, results: false }), ["score.bounty"]);
  assert.deepEqual(at({ ...S16, rank: { by: "standing", cut: [{ at: { every: 3 }, out: 1 }] } }), ["score.bounty"], "not beside cuts yet");
  assert.ok(at({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1, bounty: { points: 2 } } }).includes("score.bounty"), "a pool has no bounty");
  // The show's votes, read from the context's rules: the cast's vote that sends someone home.
  assert.deepEqual(F.votesOf(F.formatFor("survivor")), [{ key: "votedFor", count: "votesReceived", exitMethods: ["Voted Out"] }]);
  assert.deepEqual(F.votesOf(F.formatFor("traitors")), [{ key: "votedFor", count: "votesReceived", exitMethods: ["Banished"] }]);
  assert.deepEqual(F.votesOf(F.formatFor("challenge")), [], "nobody is voted out on The Challenge");
});

// ---- the record, from research's answer ----

const NAMES = ["Ann One", "Bo Two", "Cy Three", "Di Four", "Ed Five"];
const resolve = (name) => {
  const hit = NAMES.find((n) => n.toLowerCase() === String(name).toLowerCase() || n.split(" ")[0].toLowerCase() === String(name).toLowerCase());
  return hit ? `id-${hit.split(" ")[0]}` : null;
};
const answer = (rows) => ({ castaways: rows.map(([name, votedFor, votesReceived, exit]) => ({ name, votedFor, votesReceived, leftTheGame: exit ? "yes" : "no", exitMethod: exit || null })) });

test("who voted for whom: sure only when research's answers agree", () => {
  const survivor = F.formatFor("survivor");
  // Ann, Bo and Cy vote Di out (3 against her); Di votes Ann; Ed doesn't vote. A short name ("Di") is who it says.
  const tribal = [["Ann One", "Di", 1], ["Bo Two", "Di Four", 0], ["Cy Three", "Di Four", 0], ["Di Four", "Ann One", 3, "Voted Out"], ["Ed Five", null, 0]];
  assert.deepEqual(F.voteRecordOf(answer(tribal), survivor, resolve), {
    sure: true,
    votes: [["id-Ann", "id-Di"], ["id-Bo", "id-Di"], ["id-Cy", "id-Di"], ["id-Di", "id-Ann"]],
    out: ["id-Di"],
  });
  // Research counted 4 against Di, named 3: not sure (a vote it missed may be anyone's).
  const off = F.voteRecordOf(answer(tribal.map((r) => (r[0] === "Di Four" ? [r[0], r[1], 4, r[3]] : r))), survivor, resolve);
  assert.equal(off.sure, false);
  assert.equal(off.why, "The votes research named don't add up to the count against who went home");
  // No count against who went home: nothing to check it by.
  assert.equal(F.voteRecordOf(answer(tribal.map((r) => (r[0] === "Di Four" ? [r[0], r[1], null, r[3]] : r))), survivor, resolve).sure, false);
  // A vote for someone not on the cast.
  const stranger = F.voteRecordOf(answer(tribal.map((r) => (r[0] === "Ed Five" ? [r[0], "Zed", 0] : r))), survivor, resolve);
  assert.deepEqual([stranger.sure, stranger.why], [false, "A vote names someone who isn't on the cast"]);
  // A double boot asked as one vote each: Di and Ed both out, each counted 3, the votes naming each fewer.
  const double = [["Ann One", "Di", 1], ["Bo Two", "Di Four", 0], ["Cy Three", "Ed Five", 0], ["Di Four", "Ann One", 3, "Voted Out"], ["Ed Five", "Ann One", 3, "Voted Out"]];
  assert.equal(F.voteRecordOf(answer(double), survivor, resolve).sure, false);
  // A medevac isn't a vote: nobody voted them out, and nothing's checked for them.
  const evac = F.voteRecordOf(answer([["Ann One", null, 0], ["Bo Two", null, 0, "Medically Evacuated"]]), survivor, resolve);
  assert.deepEqual(evac, { sure: true, votes: [], out: [] });
  // The Traitors: a list of votes, one per banishment (a finale's several).
  const traitors = F.formatFor("traitors");
  const rt = { castaways: [
    { name: "Ann One", votedFor: ["Bo Two", "Cy Three"], votesReceived: 0, leftTheGame: "no" },
    { name: "Di Four", votedFor: ["Bo Two", "Cy Three"], votesReceived: 0, leftTheGame: "no" },
    { name: "Bo Two", votedFor: ["Ann One"], votesReceived: 2, leftTheGame: "yes", exitMethod: "Banished" },
    { name: "Cy Three", votedFor: ["Ann One"], votesReceived: 2, leftTheGame: "yes", exitMethod: "Banished" },
  ] };
  assert.deepEqual(F.voteRecordOf(rt, traitors, resolve).out, ["id-Bo", "id-Cy"]);
  assert.equal(F.voteRecordOf(rt, traitors, resolve).sure, true);
  // Nothing to record: no answer, or a show nobody votes out.
  assert.equal(F.voteRecordOf({ castaways: [] }, survivor, resolve), null);
  assert.equal(F.voteRecordOf(answer(tribal), F.formatFor("challenge"), resolve), null);
});

test("the sequence's lines: each vote moves a bounty from who went home's seats to the voter's, adding up to nothing", () => {
  const holders = { v1: ["ann"], v2: ["bo"], v3: ["ann", "cy"], gone: ["bo"], free: [] };
  const of = (id) => holders[id] || [];
  const sum = (lines) => lines.reduce((t, l) => t + l.points, 0);
  // ann's v1 voted bo's castaway out: ann +2, bo -2.
  assert.deepEqual(Seq.bountyLines([["v1", "gone"]], of, 2).map((l) => [l.playerId, l.points]), [["ann", 2], ["bo", -2]]);
  // bo's own v2 voting out bo's own: nothing from itself.
  assert.deepEqual(Seq.bountyLines([["v2", "gone"]], of, 2), []);
  // v3 held by ann and cy: each takes it from bo.
  const shared = Seq.bountyLines([["v3", "gone"]], of, 2);
  assert.deepEqual(shared.map((l) => [l.playerId, l.points]), [["ann", 2], ["bo", -2], ["cy", 2], ["bo", -2]]);
  assert.equal(sum(shared), 0);
  // Nobody holds who went home, or the voter: nothing moves.
  assert.deepEqual(Seq.bountyLines([["v1", "free"], ["free", "gone"]], of, 2), []);
  assert.deepEqual(Seq.bountyLines(null, of, 2), []);
});

// ---- the engine, on a league ----

/** A league of nine castaways C0 to C8, three players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8); its game `spec`
 *  through setGame; Episodes 1 to 5 made, none with results. */
function league(spec) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 9; i++) S.addCastaway(s, `C${i}`);
  const players = ["ann", "bo", "cy"];
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [players[Math.floor(i / 3)]]; });
  for (let n = 1; n <= 5; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
/** Episode n: castaway `gone` voted out, by the votes [[voter, votedFor]] (indexes); the record as the stamp writes it. */
function tribal(s, n, gone, votes, record = {}) {
  S.addElimination(s, ep(s, n).id, cid(s, gone), "Voted Out");
  ep(s, n).voteRecord = { sure: true, votes: votes.map(([a, b]) => [cid(s, a), cid(s, b)]), out: [cid(s, gone)], ...record };
}
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));
const bounties = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.bounty]));
const series = (s, who) => S.ScoringLogic.walk(s, { series: true }).series.map((e) => e.totals.get(who));

test("s16: an Outlast's bounty, each vote out moving 2 points from who went home's team to each voter's", () => {
  const s = league(S16);
  // Episode 1: bo's C3 voted out by ann's C0 and C1 and cy's C6; bo's C4 voted with them too (its own: nothing), C3 voted C0.
  tribal(s, 1, 3, [[0, 3], [1, 3], [6, 3], [4, 3], [3, 0]]);
  // ann takes 4 from bo, cy 2: ann +4, bo -6, cy +2. Places after one boot: C3 1, everyone else still in 2. ann 6, bo 1 + 4 = 5,
  // cy 6. With the bounties: ann 10, bo -1, cy 8.
  assert.deepEqual(bounties(s), { ann: 4, bo: -6, cy: 2 });
  assert.deepEqual(totals(s), { ann: 10, bo: -1, cy: 8 });
  // Episode 2: ann's C0 voted out by cy's C7 alone (1 counted against it); ann -2, cy +2. Places: C3 1, C0 2, the rest 3. ann 2 + 6
  // = 8, bo 1 + 6 = 7, cy 9. Bounties through it: ann 2, bo -6, cy 4.
  tribal(s, 2, 0, [[7, 0]]);
  assert.deepEqual(bounties(s), { ann: 2, bo: -6, cy: 4 });
  assert.deepEqual(totals(s), { ann: 10, bo: 1, cy: 13 });
  // The series reads it episode by episode.
  assert.deepEqual(series(s, "bo"), [-1, 1]);
  assert.deepEqual(series(s, "ann"), [10, 10]);
  // Without a bounty, the same season scores its places alone, and its rows carry no bounty.
  const plain = league({ preset: "outlast" });
  tribal(plain, 1, 3, [[0, 3]]);
  tribal(plain, 2, 0, [[7, 0]]);
  assert.deepEqual(totals(plain), { ann: 8, bo: 7, cy: 9 });
  assert.ok(S.computeScores(plain).every((r) => !("bounty" in r)));
});

test("the fallback: an unsure record, or one the league's results disagree with, moves nothing that episode", () => {
  const s = league(S16);
  tribal(s, 1, 3, [[0, 3]], { sure: false, why: "The votes research named don't add up to the count against who went home" });
  assert.deepEqual(bounties(s), { ann: 0, bo: 0, cy: 0 });
  // Research says C4 went home; the league's results say C3: void.
  const other = league(S16);
  tribal(other, 1, 3, [[0, 3], [0, 4]], { out: [cid(other, 4)] });
  assert.deepEqual(bounties(other), { ann: 0, bo: 0, cy: 0 });
  // A medevac isn't a vote out: research's votes for them move nothing.
  const evac = league(S16);
  S.addElimination(evac, ep(evac, 1).id, cid(evac, 3), "Medically Evacuated");
  ep(evac, 1).voteRecord = { sure: true, votes: [[cid(evac, 0), cid(evac, 3)]], out: [] };
  assert.deepEqual(bounties(evac), { ann: 0, bo: 0, cy: 0 });
  // No record (research not in yet): nothing, until it is.
  const none = league(S16);
  S.addElimination(none, ep(none, 1).id, cid(none, 3), "Voted Out");
  assert.deepEqual(bounties(none), { ann: 0, bo: 0, cy: 0 });
});

test("a lineup's bounty: only starters count, voting or voted out", () => {
  const s = league(LINEUP);
  // ann starts C0 and C1 (C2 benched); bo starts C3 and C4; cy C6 and C7.
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "ann", [cid(s, 0), cid(s, 1)]);
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "bo", [cid(s, 3), cid(s, 4)]);
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "cy", [cid(s, 6), cid(s, 7)]);
  // C3 (bo's starter) voted out by C0 (ann's starter), C2 (ann's bench) and C8 (cy's bench): ann takes 1.5, bo pays 1.5.
  tribal(s, 1, 3, [[0, 3], [2, 3], [8, 3]]);
  assert.deepEqual(bounties(s), { ann: 1.5, bo: -1.5, cy: 0 });
  // Voted out from the bench: bo benches C5, who goes home in Episode 2 by ann's C0: nothing moves.
  S.ActiveRosterLogic.setLineup(s, ep(s, 2).id, "bo", [cid(s, 4)]);
  tribal(s, 2, 5, [[0, 5]]);
  assert.deepEqual(bounties(s), { ann: 1.5, bo: -1.5, cy: 0 });
  // The total is the moments' plus the bounty: against the same game without one.
  const plain = league({ ...LINEUP, score: { by: "moments", points: null } });
  for (const [n, who, ids] of [[1, "ann", [0, 1]], [1, "bo", [3, 4]], [1, "cy", [6, 7]], [2, "bo", [4]]]) S.ActiveRosterLogic.setLineup(plain, ep(plain, n).id, who, ids.map((i) => cid(plain, i)));
  S.addElimination(plain, ep(plain, 1).id, cid(plain, 3), "Voted Out");
  S.addElimination(plain, ep(plain, 2).id, cid(plain, 5), "Voted Out");
  const p = totals(plain);
  assert.deepEqual(totals(s), { ann: p.ann + 1.5, bo: p.bo - 1.5, cy: p.cy });
});

test("the spoiler view takes the record off with the results it would give away", () => {
  const s = league(S16);
  tribal(s, 1, 3, [[0, 3]]);
  tribal(s, 2, 0, [[7, 0]]);
  const view = S.SpoilerLogic.viewThrough(s, 1);
  assert.ok(ep(view, 1).voteRecord, "seen: kept");
  assert.equal(ep(view, 2).voteRecord, undefined, "not seen: taken off");
  // Through Episode 1 only: ann's 2 from bo.
  assert.deepEqual(bounties(view), { ann: 2, bo: -2, cy: 0 });
});
