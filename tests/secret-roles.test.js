// Secret roles among the players (docs/PLAN-start-a-game-gpt.md step A14 part 4; the tracker's s24, "Two of us are secretly traitors
// who score when the faithful's picks get banished."): some seats dealt a role at random once the game starts (SecretRoleLogic.deal,
// from a seed the server keeps with the deal: secret-roles.ts, secret_role_deals), each scoring by what the results say (the
// sequence's roleLines: each one gone whom a seat without the role held scores for every seat with it), hidden until the reveal (the
// server's stamp, state.secretRoles, only once the reveal's episode has results), the points through it landing in it. Its shape,
// defaults, refusals, words and settings; the deal; the reveal; an Outlast's and a lineup's table and series; votedOut against any
// way out; the spoiler view. Every number is worked out by hand in its comment. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Seq = require("../src/lib/game/sequence/index.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true, jury: true, votes: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const S24 = { preset: "outlast", score: { by: "place", roles: { count: 2, points: 2, on: "votedOut" } } };
const ONE = { preset: "outlast", span: { from: 1, to: 3 }, score: { by: "place", roles: { points: 2 } } };
const LINEUP = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { start: 2 }, score: { by: "moments", points: null, roles: { points: 1.5, reveal: 2 } } };

test("secret roles: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  for (const s of [S24, ONE, LINEUP, { ...S24, get: { by: "draft", each: 3, order: "blind", own: "shared" } }]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, s)), G.fullSpec(s), JSON.stringify(s));
  }
  assert.deepEqual(G.withSpec(S.defaultState().settings, S24).secretRoles, { count: 2, points: 2, on: "votedOut" });
  assert.deepEqual(G.rolesOf(ONE), { count: 1, name: "Traitor", points: 2, on: "out", deal: "random", reveal: "end", mates: true });
  assert.equal(G.rolesOf({ preset: "outlast" }), null);
  assert.equal(G.typeOf(S24), "classic-draft");
  // Words (through impeccable's clarify): the count a word, never read as the points.
  const d = G.describeSpec(S24, { castaway: "castaway" });
  assert.ok(d.sentence.endsWith("Secret roles: two of you are secretly Traitors. A Traitor scores 2 points each time someone who isn't a Traitor has a castaway voted out."), d.sentence);
  assert.ok(d.rules.includes("Roles are dealt at random when the game starts. You'll know if you're one; nobody else will. Traitors also know each other."));
  assert.ok(d.rules.includes("Who the Traitors are, and their Traitor points, stay secret until the game ends. Then their points are added to the standings."));
  assert.ok(d.rules.includes("Join after the game starts and you won't get a role."));
  const one = G.describeSpec(ONE, { castaway: "castaway" });
  assert.ok(one.sentence.includes("Secret roles: one of you is secretly a Traitor. A Traitor scores 2 points each time someone who isn't a Traitor loses a castaway."), one.sentence);
  assert.ok(!one.rules.some((r) => r.includes("know each other")), "one Traitor: nobody to know");
  const lineup = G.describeSpec(LINEUP, { castaway: "castaway" }).rules;
  assert.ok(lineup.includes("Who the Traitor is, and their Traitor points, stay secret until Episode 2's results. Then their points so far are added, and each episode after counts right away."));
  assert.ok(lineup.includes("Only starters count: a benched castaway going home scores nothing."));
  assert.ok(G.describeSpec({ ...S24, score: { by: "place", roles: { count: 3, points: 1, name: "Imposter", mates: false } } }).rules.some((r) => r.endsWith("Imposters don't know who the others are.")));
  assert.ok(G.describeSpec({ ...S24, get: { by: "draft", each: 3, order: "blind", own: "shared" } }, { castaway: "castaway" }).rules.includes("A castaway two of you had counts once."));
  assert.ok(G.describeSpec({ ...S24, score: { by: "place", roles: { count: 2, points: 1, name: "Spy" } } }).sentence.includes("two of you are secretly Spies"), "its plural");
  // Refused, each with why.
  const r = (roles, more = {}) => at({ ...S24, score: { by: "place", roles }, ...more });
  assert.deepEqual(r(2), ["score.roles"]);
  assert.deepEqual(r({ points: 0 }), ["score.roles.points"]);
  assert.deepEqual(r({ points: 1.25 }), ["score.roles.points"], "in halves");
  assert.deepEqual(r({ points: 2, count: 6 }), ["score.roles.count"]);
  assert.deepEqual(r({ points: 2, count: 0 }), ["score.roles.count"]);
  assert.deepEqual(r({ points: 2, name: "" }), ["score.roles.name"]);
  assert.deepEqual(r({ points: 2, name: "Traitor <b>" }), ["score.roles.name"]);
  assert.deepEqual(r({ points: 2, on: "immunity" }), ["score.roles.on"]);
  assert.deepEqual(r({ points: 2, deal: "maker" }), ["score.roles.deal"], "dealt at random only, for now");
  assert.deepEqual(r({ points: 2, reveal: "never" }), ["score.roles.reveal"]);
  assert.deepEqual(r({ points: 2, reveal: 4 }, { span: { from: 1, to: 3 } }), ["score.roles.reveal"], "after the game's end");
  assert.deepEqual(r({ points: 2, reveal: 1 }, { span: { from: 2 } }), ["score.roles.reveal"], "before the game's start");
  assert.deepEqual(r({ points: 2, mates: "yes" }), ["score.roles.mates"]);
  assert.deepEqual(r({ points: 2, team: true }), ["score.roles.team"], "an unknown key");
  assert.deepEqual(at(S24, { ...CTX, votes: false }), ["score.roles.on"], "nobody voted out on the show");
  assert.deepEqual(at(ONE, { ...CTX, votes: false }), [], "any way out still scores");
  assert.deepEqual(at(ONE, { ...CTX, results: false }), ["score.roles"]);
  assert.deepEqual(at({ ...S24, rank: { by: "standing", cut: [{ at: { every: 3 }, out: 1 }] } }), ["score.roles"], "not beside cuts");
  assert.deepEqual(at({ ...S24, rank: { by: "total", race: { to: 40 } } }), ["score.roles"], "not beside a race");
  assert.deepEqual(at({ ...S24, rank: { by: "matchups" } }), ["score.roles"], "not head to head");
  assert.deepEqual(at({ ...S24, rank: { by: "weeks" } }), ["score.roles"], "not weeks won");
  assert.ok(at({ preset: "survival-pool", score: { by: "survive", means: "staysIn", points: 1, roles: { points: 2 } } }).includes("score.roles"), "a pool has no roles");
  // Not in a stage: the deal is the game's.
  const staged = { stages: [{ id: "a", name: "First", game: { preset: "outlast", span: { from: 1, to: 4 }, score: { by: "place", roles: { points: 2 } } } }, { id: "b", name: "Second", game: { preset: "outlast", span: { from: 5 } } }], overall: { by: "sum" } };
  assert.ok(at(staged).includes("stages[0].game.score.roles"), JSON.stringify(at(staged)));
});

test("the sequence's lines: each one gone whom a seat without the role held scores for every seat with it", () => {
  const held = { c1: ["ann"], c2: ["cy"], c3: ["ann", "cy"], c4: [] };
  const of = (id) => held[id] || [];
  const lines = (gone, roled = ["cy", "di"]) => Seq.roleLines(gone, of, roled, 2).map((l) => [l.playerId, l.points, l.castawayId]);
  // ann's c1 gone: cy and di (both with the role) take 2 each.
  assert.deepEqual(lines(["c1"]), [["cy", 2, "c1"], ["di", 2, "c1"]]);
  // cy's own c2 (only a seat with the role held it): nothing. c3, ann's too: counts, once.
  assert.deepEqual(lines(["c2"]), []);
  assert.deepEqual(lines(["c3"]), [["cy", 2, "c3"], ["di", 2, "c3"]]);
  // Nobody held c4; nobody has the role; nothing gone.
  assert.deepEqual(lines(["c4"]), []);
  assert.deepEqual(lines(["c1"], []), []);
  assert.deepEqual(Seq.roleLines(null, of, ["cy"], 2), []);
});

// ---- the engine, on a league ----

/** A league of nine castaways C0 to C8, three players holding three each in order (ann C0-C2, bo C3-C5, cy C6-C8); its game `spec`
 *  through setGame; Episodes 1 to 5 made, none with results. */
function league(spec, players = ["ann", "bo", "cy"]) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 9; i++) S.addCastaway(s, `C${i}`);
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = [players[Math.floor(i / 3)]].filter(Boolean); });
  for (let n = 1; n <= 5; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}
const ep = (s, n) => s.episodes.find((e) => e.number === n);
const cid = (s, i) => s.castaways[i].id;
const out = (s, n, i, how = "Voted Out") => S.addElimination(s, ep(s, n).id, cid(s, i), how);
const totals = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));
const roles = (s) => Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.role]));
const series = (s, who) => S.ScoringLogic.walk(s, { series: true }).series.map((e) => e.totals.get(who));
const R = S.SecretRoleLogic;

test("the deal: seeded, recorded, a role for `count` seats and never everyone", () => {
  const s = league(S24, ["ann", "bo", "cy", "di", "ed"]);
  const a = R.deal(s, "seed-1");
  assert.deepEqual(a.seats, ["ann", "bo", "cy", "di", "ed"]);
  assert.equal(a.holders.length, 2);
  assert.ok(a.holders.every((id) => a.seats.includes(id)));
  assert.deepEqual(R.deal(s, "seed-1"), a, "the same seed deals the same");
  // Over enough seeds, every seat is dealt it sometimes (it's the seed's, not the list's order).
  const dealt = new Set();
  for (let i = 0; i < 40; i++) R.deal(s, `seed-${i}`).holders.forEach((id) => dealt.add(id));
  assert.deepEqual([...dealt].sort(), ["ann", "bo", "cy", "di", "ed"]);
  // Two seats and a count of two: one of them (somebody's left without it). One seat: nobody.
  assert.equal(R.deal(league(S24, ["ann", "bo"]), "x").holders.length, 1);
  assert.deepEqual(R.deal(league(S24, ["ann"]), "x").holders, []);
  // A seat catching up is one (a game at your own pace is all of them).
  const own = league(S24, ["ann", "bo"]);
  own.players.forEach((p) => { p.lateJoin = { startEpisode: 1, catchingUp: true }; });
  assert.deepEqual(R.deal(own, "x").seats, ["ann", "bo"]);
  // Someone disabled, a ghost (a late joiner on a season of their own) or still to be brought in isn't dealt among.
  const t = league(S24, ["ann", "bo", "cy", "di"]);
  t.players[1].disabled = true;
  t.players[2].ghost = true;
  t.players[3].active = false;
  assert.deepEqual(R.deal(t, "x").seats, ["ann"]);
  assert.deepEqual(R.deal(t, "x").holders, []);
  // Due once the game has started: its first episode has results (or has locked).
  assert.equal(R.due(s, Date.now()), false);
  out(s, 1, 3);
  assert.equal(R.due(s, Date.now()), true);
  assert.equal(R.due(league({ preset: "outlast" }), Date.now()), false, "no roles, nothing to deal");
});

test("the reveal: the game's end, or the episode it names, once it has results", () => {
  const s = league(ONE);
  assert.equal(R.revealAt(s), null);
  out(s, 1, 3);
  out(s, 2, 4);
  assert.equal(R.revealAt(s), null, "the game isn't over");
  out(s, 3, 5);
  assert.equal(R.revealAt(s), 3, "its span's last episode has results");
  // An episode named: revealed once it has results.
  const named = league(LINEUP);
  out(named, 1, 3);
  assert.equal(R.revealAt(named), null);
  out(named, 2, 4);
  assert.equal(R.revealAt(named), 2);
  // A season that ends before the episode it names (its winner crowned in Episode 2) reveals at its end.
  const short = league({ preset: "outlast", score: { by: "place", roles: { points: 2, reveal: 4 } } });
  out(short, 1, 3);
  assert.equal(R.revealAt(short), null);
  out(short, 2, 4, "Sole Survivor");
  assert.equal(R.revealAt(short), 2);
});

test("s24's game: hidden until the reveal, then everything through it lands in it, and each episode after in its own", () => {
  // Reveal after Episode 2 (a lineup reveals there; here an Outlast with reveal 2), cy with the role.
  const spec = { preset: "outlast", score: { by: "place", roles: { points: 2, reveal: 2 } } };
  const s = league(spec);
  out(s, 1, 3); // bo's C3: a seat without the role lost one: cy +2 (owed until the reveal).
  out(s, 2, 6); // cy's own C6: only cy held them: nothing.
  out(s, 3, 0); // ann's C0: cy +2, in Episode 3.
  // Before the reveal (no stamp): nobody's table says anything. Places: C3 1, C6 2, C0 3, the rest 4 (six left).
  // ann: 3 + 4 + 4 = 11; bo: 1 + 4 + 4 = 9; cy: 2 + 4 + 4 = 10.
  assert.deepEqual(totals(s), { ann: 11, bo: 9, cy: 10 });
  assert.ok(S.computeScores(s).every((r) => !("role" in r)));
  // The server's stamp once Episode 2 has results: cy's 2 from Episode 1 land in Episode 2, Episode 3's 2 in its own.
  s.secretRoles = { at: R.revealAt(s), holders: ["cy"] };
  assert.equal(s.secretRoles.at, 2);
  assert.deepEqual(roles(s), { ann: 0, bo: 0, cy: 4 });
  assert.deepEqual(totals(s), { ann: 11, bo: 9, cy: 14 });
  // The series: Episode 1 without it (places then: C3 1, the rest 2: cy 6), Episode 2 with 2 (C6 2, the rest 3: cy 2 + 3 + 3 + 2 =
  // 10), Episode 3 with 4 (cy 10 + 4).
  assert.deepEqual(series(s, "cy"), [6, 10, 14]);
  assert.deepEqual(R.pointsOf(s, "cy", ["cy"]), 4);
  assert.deepEqual(R.pointsOf(s, "ann", ["cy"]), 0);
  // The spoiler view: a copy through Episode 1 hasn't seen the reveal: no roles in it, and nothing counted.
  const view = S.SpoilerLogic.viewThrough(s, 1);
  assert.equal(view.secretRoles, undefined);
  assert.ok(S.computeScores(view).every((r) => !("role" in r)));
  assert.deepEqual(S.SpoilerLogic.viewThrough(s, 2).secretRoles, { at: 2, holders: ["cy"] });
  // Through Episode 2: the 2 landed, Episode 3's not seen.
  assert.deepEqual(roles(S.SpoilerLogic.viewThrough(s, 2)), { ann: 0, bo: 0, cy: 2 });
});

test("votedOut scores a vote's exits only; any way out ('out') scores a medevac too; a winner isn't going home", () => {
  const voted = league(S24);
  out(voted, 1, 3, "Medically Evacuated");
  out(voted, 2, 4, "Voted Out");
  voted.secretRoles = { at: 2, holders: ["ann", "cy"] };
  // Only C4's vote out: ann and cy, 2 each.
  assert.deepEqual(roles(voted), { ann: 2, bo: 0, cy: 2 });
  const any = league({ preset: "outlast", score: { by: "place", roles: { points: 2, count: 2, reveal: 2 } } });
  out(any, 1, 3, "Medically Evacuated");
  out(any, 2, 4, "Voted Out");
  any.secretRoles = { at: 2, holders: ["ann", "cy"] };
  assert.deepEqual(roles(any), { ann: 4, bo: 0, cy: 4 });
  // A stamp naming someone no longer in the game is skipped; a seat with the role still holds its own team.
  any.secretRoles = { at: 2, holders: ["cy", "zed"] };
  assert.deepEqual(roles(any), { ann: 0, bo: 0, cy: 4 });
});

test("a lineup's roles: only starters count; a shared castaway counts once, while someone without the role has them", () => {
  const s = league(LINEUP);
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "ann", [cid(s, 0), cid(s, 1)]);
  S.ActiveRosterLogic.setLineup(s, ep(s, 1).id, "bo", [cid(s, 3), cid(s, 4)]);
  S.ActiveRosterLogic.setLineup(s, ep(s, 2).id, "bo", [cid(s, 3)]);
  out(s, 1, 4); // bo's starter: cy +1.5.
  out(s, 2, 5); // bo's bench: nothing.
  s.secretRoles = { at: 2, holders: ["cy"] };
  assert.deepEqual(roles(s), { ann: 0, bo: 0, cy: 1.5 });
  // Shared: C0 held by ann and cy (cy with the role): counts once; C6, cy's alone: nothing.
  const shared = league({ preset: "outlast", get: { by: "draft", each: 3, order: "blind", own: "shared" }, score: { by: "place", roles: { points: 2, reveal: 1 } } });
  shared.castaways[0].ownerIds = ["ann", "cy"];
  out(shared, 1, 0);
  out(shared, 2, 6);
  shared.secretRoles = { at: 1, holders: ["cy"] };
  assert.deepEqual(roles(shared), { ann: 0, bo: 0, cy: 2 });
});

test("dealt, the roles stay as they were dealt: setGame refuses any change to them, and nothing else", () => {
  const s = league(S24);
  s.secretRolesDealt = true;
  for (const roles of [{ count: 1, points: 2, on: "votedOut" }, { count: 2, points: 2, on: "votedOut", reveal: 1 }, undefined]) {
    const problems = S.setGame(s, { ...S.gameOf(s), score: { by: "place", ...(roles ? { roles } : {}) } }, { ctx: CTX });
    assert.deepEqual(ats(problems), ["score.roles"], JSON.stringify(roles));
    assert.deepEqual(s.settings.secretRoles, { count: 2, points: 2, on: "votedOut" });
  }
  // The rest of the game can change: a team of 4.
  assert.deepEqual(S.setGame(s, { ...S.gameOf(s), get: { ...S.gameOf(s).get, each: 4 } }, { ctx: CTX }), []);
  // Before the deal, anything goes.
  const t = league(S24);
  assert.deepEqual(S.setGame(t, { ...S.gameOf(t), score: { by: "place", roles: { points: 3 } } }, { ctx: CTX }), []);
});

test("a game without roles reads as it did: no field, no stamp", () => {
  const plain = league({ preset: "outlast" });
  out(plain, 1, 3);
  plain.secretRoles = { at: 1, holders: ["cy"] };
  assert.ok(S.computeScores(plain).every((r) => !("role" in r)), "a stale stamp on a game with none counts nothing");
  assert.equal(R.revealAt(plain), null);
});
