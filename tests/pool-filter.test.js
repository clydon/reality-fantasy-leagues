// A pool of some teams' or positions' players (docs/PLAN-start-a-game-gpt.md step G3 part 3b: the tracker's w055, "Premier League
// this weekend, draft 3 strikers each, goals 5 assists 3"; part 1's and 2's Noticed, "the Lakers' players"). The spec's
// pool.where gains a sport's teams (ESPN team ids) and positions (its position groups), together or not; our check reads them
// against the page's; the settings carry them (poolWhere); every place a draft, a pickup or a pick offers someone asks the pool
// (state-logic.js PoolLogic, on the server's stamp: statTeams and statGroups): a snake pick, a blind team, a draw's hat, an
// auction's bids, waivers and replacements, a pool's pick, a person answer's faces, a bot's draft, and the exclusive-or-shared
// count as a draft opens. Its fallbacks: someone whose team or position isn't known is out; no stamp of it holds no filter;
// someone already on a team stays. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const Words = require("../src/lib/game/game-words/index.js");
const { sportPageContext } = jiti("../src/lib/sports/page.ts");

const SOCCER = sportPageContext("soccer/eng.1", { show: "Premier League" });
const TEAMS = [{ id: "359", name: "Arsenal" }, { id: "364", name: "Liverpool" }, { id: "382", name: "Manchester City" }];
const at = (spec, ctx, opts) => G.specProblems(spec, ctx, opts).map((p) => `${p.at}: ${p.problem}`);
const FWD = { of: "cast", where: { positions: ["FWD"] } };
/** w055's game: a draft of 3 strikers each, goals 5 and assists 3, everyone drafted counting. */
const w055 = (more = {}) => ({ spec: 1, span: { from: 1, to: 1 }, pool: FWD, get: { by: "draft", each: 3, own: "shared" }, count: { all: true }, score: { by: "stats", points: { G: 5, A: 3 } }, ...more });

/**
 * A league on three teams of four (Arsenal, Liverpool, Manchester City as tribes t1-t3), each team's players alternating forward and
 * defender, `people` its seats, the game `spec`; stamped (`stamp: false` leaves it unstamped) as the server stamps it: each one's
 * position group and their team's ESPN id.
 */
function league(spec, { people = ["ann", "bo", "cy"], bots = [], stamp = true } = {}) {
  const castaways = [];
  TEAMS.forEach((t, k) => {
    for (let i = 0; i < 4; i++) castaways.push({ id: `c${k + 1}${i}`, name: `${t.name} ${i}`, status: "active", tribeId: `t${k + 1}`, ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null });
  });
  const settings = { ...G.settingsOf(spec), showFormat: "survivor" };
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  const s = S.migrateLeagueState({
    settings,
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: TEAMS.map((t, k) => ({ id: `t${k + 1}`, name: t.name, color: "#000" })),
    castaways,
    episodes: [1, 2, 3].map((n) => ({ id: `ep${n}`, number: n, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  if (stamp) stampOf(s);
  return s;
}
/** The server's stamp (sports/score.ts stampStats): positions by index, teams by tribe. */
function stampOf(s, o = {}) {
  const groups = Object.fromEntries(s.castaways.map((c) => [c.id, Number(c.id.slice(2)) % 2 === 0 ? "FWD" : "DEF"]));
  const teams = Object.fromEntries(s.castaways.map((c) => [c.id, TEAMS[Number(c.tribeId.slice(1)) - 1].id]));
  return S.StatsLogic.stamp(s, { groups: { ...groups, ...(o.groups || {}) }, teams: { ...teams, ...(o.teams || {}) } });
}
const forwards = (s) => s.castaways.filter((c) => s.statGroups[c.id] === "FWD").map((c) => c.id);
const team = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const outlast = (pool, get = {}) => ({ preset: "outlast", pool, get: { by: "draft", each: 2, ...get } });

test("the spec: a sport's teams and positions play, checked against the page's; a group still waits; the settings carry them", () => {
  // w055 on the Premier League's page: forwards only (the sport's position groups).
  assert.deepEqual(at(w055(), SOCCER), []);
  assert.deepEqual(G.specWaitsFor(w055()), []);
  assert.equal(G.typeOf(w055()), "active-roster");
  assert.deepEqual(G.poolFilter(G.fullSpec(w055())), { positions: ["FWD"] });
  assert.equal(G.poolFilter(G.fullSpec({ preset: "outlast" })), null, "everyone still in is no filter");
  // Teams and positions together, stillIn beside them; a team not on the page, a position not the sport's.
  const both = { of: "cast", where: { stillIn: true, teams: ["359"], positions: ["FWD", "MID"] } };
  assert.deepEqual(at(w055({ pool: both }), { ...SOCCER, teamList: TEAMS }), []);
  assert.deepEqual(at(w055({ pool: { of: "cast", where: { teams: ["999"] } } }), { ...SOCCER, teamList: TEAMS }), ['pool.where.teams: "999" isn\'t one of the page\'s teams']);
  assert.deepEqual(at(w055({ pool: { of: "cast", where: { positions: ["ST"] } } }), SOCCER), ['pool.where.positions: "ST" isn\'t one of the sport\'s positions: GK, DEF, MID, FWD']);
  // The shape: lists of ids, each once; a group alone, and later.
  assert.deepEqual(at(w055({ pool: { of: "cast", where: { positions: [] } } }), null), ["pool.where.positions: The positions are a list of the sport's position groups, each once"]);
  assert.deepEqual(at(w055({ pool: { of: "cast", where: { teams: ["359", "359"] } } }), null), ["pool.where.teams: The teams are a list of team ids, each once"]);
  assert.equal(at(w055({ pool: { of: "cast", where: { group: "t1", teams: ["359"] } } }), null)[0].split(":")[0], "pool.where");
  assert.deepEqual(G.specWaitsFor({ preset: "outlast", pool: { of: "cast", where: { group: "t1" } } }).map((w) => w.at), ["pool.where"]);
  // A show's game has no positions or teams to pick from; a field sport no teams.
  const show = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [] };
  assert.deepEqual(at(outlast(FWD), show), ["pool.where.positions: Only a sport's players have positions to pick from"]);
  assert.deepEqual(at(outlast({ of: "cast", where: { teams: ["359"] } }), show), ["pool.where.teams: Only a team sport's players have teams to pick from"]);
  const golf = sportPageContext("golf/pga", { show: "The Masters" });
  assert.ok(at(outlast({ of: "cast", where: { teams: ["359"] } }), golf).includes("pool.where.teams: Only a team sport's players have teams to pick from"));
  // The settings: written as poolWhere, read back as it was said; a game with none writes none.
  const st = G.settingsOf(w055({ pool: both }));
  assert.deepEqual(st.poolWhere, both.where);
  assert.deepEqual(G.specOf(st).pool, both);
  assert.equal(G.settingsOf(w055({ pool: { of: "cast", where: { stillIn: true } } })).poolWhere, undefined);
  const plain = G.withSpec(st, G.fullSpec(w055({ pool: { of: "cast", where: { stillIn: true } } })));
  assert.equal(plain.poolWhere, undefined, "taking the filter off takes it out of the settings");
});

test("exclusive or shared by the math: a filtered pool counts smaller (ctx.poolOf where it's made, the pool as it opens)", () => {
  // 12 players still in, 6 of them forwards: 4 of you × 2 forwards each is 8, more than the 6.
  const poolOf = Array.from({ length: 12 }, (_, i) => ({ team: TEAMS[i % 3].id, position: i % 2 === 0 ? "FWD" : "DEF" }));
  const ctx = { ...SOCCER, couch: 4, pool: 12, poolOf };
  const exclusive = w055({ get: { by: "draft", each: 2, own: "exclusive" } });
  assert.deepEqual(at(exclusive, ctx), ["get.own: 4 of you × 2 picks is more than the 6 who can be drafted: make it shared, so two of you can have the same one"]);
  assert.deepEqual(at({ ...exclusive, pool: { of: "cast", where: { stillIn: true } } }, ctx), [], "without the filter, 12 cover 8");
  assert.equal(G.poolCount(G.fullSpec(exclusive), { pool: 12 }), null, "a filter with no poolOf isn't counted");
  assert.equal(G.poolCount(G.fullSpec({ ...exclusive, pool: { of: "cast", where: { teams: ["359"], positions: ["FWD"] } } }), ctx), 2);
  // As the draft opens (settleDraftShare): 4 seats × 2 is more than the 6 forwards, so it's played shared.
  const opens = { ...outlast(FWD, { order: "snake", own: "exclusive" }), extras: { draft: { at: null, timer: 0, away: "wait", opens: "start" } } };
  const s = league(opens, { people: ["ann", "bo", "cy", "di"] });
  assert.deepEqual(S.settleDraftShare(s), { was: "snake", pool: 6, teams: 4, each: 2 });
  assert.equal(S.gameOf(s).get.own, "shared");
  // Three seats are covered by the 6.
  const three = league(opens);
  assert.equal(S.settleDraftShare(three), null);
});

test("a snake draft and its fallbacks: only the pool is free; unknown is out; no stamp holds no filter; a trade moves nobody", () => {
  const s = league(outlast(FWD, { order: "snake", own: "exclusive" }));
  assert.deepEqual(S.freeAgents(s).map((c) => c.id).sort(), forwards(s).sort());
  S.forceStartDraft(s);
  const turn = S.currentDraftTurn(s);
  S.draftToCurrentTurn(s, "c11");
  assert.equal(s.draftPicksMade || 0, 0, "a defender isn't picked");
  assert.match(S.PoolLogic.reason(s, S.Core.getCastaway(s, "c11")), /^Arsenal 1 can't be picked in this game: it's FWD only$/);
  S.draftToCurrentTurn(s, "c10");
  assert.deepEqual(team(s, turn.playerId), ["c10"]);
  // Someone whose position isn't known isn't in the pool.
  stampOf(s, { groups: { c12: undefined } });
  delete s.statGroups.c12;
  assert.ok(!S.PoolLogic.has(s, "c12"));
  // A trade (their position read anew): someone on a team stays on it; only new picks are filtered.
  stampOf(s, { groups: { c10: "DEF" } });
  assert.deepEqual(team(s, turn.playerId), ["c10"]);
  assert.ok(!S.freeAgents(s).some((c) => c.id === "c10"));
  // A league with no stamp at all (nothing read yet): no filter, so a draft never stalls.
  const bare = league(outlast(FWD, { order: "snake", own: "exclusive" }), { stamp: false });
  assert.equal(S.freeAgents(bare).length, 12);
  // Teams: only Liverpool's; both together, Liverpool's forwards.
  const lfc = league(outlast({ of: "cast", where: { teams: ["364"] } }, { order: "snake", own: "exclusive" }));
  assert.deepEqual(S.freeAgents(lfc).map((c) => c.id), ["c20", "c21", "c22", "c23"]);
  const lfcFwd = league(outlast({ of: "cast", where: { teams: ["364"], positions: ["FWD"] } }, { order: "snake", own: "exclusive" }));
  assert.deepEqual(S.freeAgents(lfcFwd).map((c) => c.id), ["c20", "c22"]);
  // A bot drafts from the pool too.
  const bots = league(outlast(FWD, { order: "snake", own: "exclusive" }), { people: [], bots: ["b1", "b2", "b3"] });
  S.forceStartDraft(bots);
  Bots.run(bots);
  assert.equal(bots.draftPicksMade, 6);
  for (const pid of ["b1", "b2", "b3"]) assert.ok(team(bots, pid).every((id) => bots.statGroups[id] === "FWD"), `${pid} drafted forwards`);
});

test("a blind team, a draw's hat and an auction's bids take only the pool", () => {
  const blind = league(outlast(FWD, { order: "blind", own: "shared" }));
  S.forceStartDraft(blind);
  assert.equal(S.BlindDraftLogic.validateSubmission(blind, "ann", ["c10", "c11"]), "Arsenal 1 can't be picked in this game: it's FWD only");
  assert.equal(S.BlindDraftLogic.validateSubmission(blind, "ann", ["c10", "c12"]), null);
  // A bot's blind team.
  const bb = league(outlast(FWD, { order: "blind", own: "shared" }), { people: ["ann"], bots: ["b1"] });
  S.forceStartDraft(bb);
  const sub = Bots.blindSubmissions(bb).find((x) => x.playerId === "b1");
  assert.ok(sub.castawayIds.length === 2 && sub.castawayIds.every((id) => bb.statGroups[id] === "FWD"));

  const draw = league(outlast(FWD, { order: "draw", own: "exclusive" }));
  const dealt = S.DrawLogic.outcome(draw, "seed");
  assert.ok(Object.values(dealt.teams).flat().every((id) => draw.statGroups[id] === "FWD"), "the hat holds forwards only");
  assert.equal(Object.values(dealt.teams).flat().length, 6);

  const BUDGET = { total: 100 };
  const auction = league(outlast(FWD, { order: "auction", own: "exclusive", budget: BUDGET }));
  S.forceStartDraft(auction);
  assert.equal(S.AuctionLogic.validateBids(auction, "ann", [{ castawayId: "c11", bid: 5 }]), "Arsenal 1 can't be picked in this game: it's FWD only");
  const won = S.AuctionLogic.outcome(auction, { ann: [{ castawayId: "c11", bid: 50 }, { castawayId: "c10", bid: 40 }] }, "seed").won;
  assert.ok(won.every((x) => auction.statGroups[x.castawayId] === "FWD"), "a bid on a defender wins nothing, and the fill is forwards");
});

test("waivers, a replacement owed and a pool's pick offer only the pool; a person answer names anyone", () => {
  const lineup = { preset: "weekly-lineup", pool: FWD, get: { by: "draft", each: 1, order: "snake", own: "exclusive" }, count: { start: 1 } };
  const s = league(lineup);
  assert.deepEqual(S.availableFor(s, "ann", "replace").map((c) => c.id).sort(), forwards(s).sort());
  assert.ok(!S.MidSeasonLogic.isAvailableFor(s, "c11", "ann", "replace"));
  assert.ok(S.MidSeasonLogic.isAvailableFor(s, "c12", "ann", "replace"));
  // A pool's pick: its eligibility (its cycle over the pool's), and a pick outside it refused.
  const pick = { preset: "survival-pool", pool: FWD };
  const p = league(pick);
  assert.deepEqual(S.pickEmEligibility(p, "ep1", "ann").available.sort(), forwards(p).sort());
  S.PickEmLogic.setPick(p, "ep1", "ann", "c11");
  assert.ok(!S.pickEmPickFor(p, "ep1", "ann"), "a defender isn't picked");
  S.PickEmLogic.setPick(p, "ep1", "ann", "c10");
  assert.equal(S.pickEmPickFor(p, "ep1", "ann").castawayId, "c10");
  // A question names anyone (a race's winner, a game's top scorer may be outside it): the pool is who can be held.
  const top = { id: "top", ask: "Who scores the most?", answer: "person", points: 1, settle: { by: "stat", stat: "G", take: "most" } };
  const q = league({ spec: 1, span: { from: 1, to: 1 }, pool: { of: "cast", where: { teams: ["382"] } }, get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [top] });
  assert.equal(S.AnswerLogic.faces(q, top).length, 12);
});

test("the words: the sentence and the short form say who it picks from; our check reads a team's name and a position's label", () => {
  const d = G.describeSpec(w055(), SOCCER);
  assert.match(d.sentence, /everyone drafts 3, forwards only/);
  assert.ok(d.short.line.includes("Forwards only"), d.short.line);
  const named = G.describeSpec(w055({ pool: { of: "cast", where: { teams: ["359"], positions: ["FWD"] } } }), { ...SOCCER, teamList: TEAMS });
  assert.match(named.sentence, /everyone drafts 3, Arsenal forwards only/);
  assert.match(G.describeSpec(w055({ pool: { of: "cast", where: { teams: ["359", "364"] } } }), SOCCER).sentence, /everyone drafts 3, two teams' players only/, "a team the page hasn't named");
  // Our check on the Premier League's page: "Liverpool" is its id, "forwards" the group FWD; a team it hasn't got is asked.
  const pack = Words.packOf({ label: "Premier League", kind: "sport", sport: { league: "soccer/eng.1" }, teams: TEAMS, cast: [], ctx: SOCCER });
  const words = "Premier League this weekend, draft 3 strikers each from Liverpool, goals 5 assists 3";
  const draft = (where) => ({ game: { ...w055(), pool: { of: "cast", where } }, said: [{ part: "get.each", quote: "draft 3" }, { part: "score.points", quote: "goals 5 assists 3" }] });
  const r = Words.checkDraft(draft({ teams: ["Liverpool"], positions: ["forwards"] }), { ctx: SOCCER, pack, words, kind: "sport" });
  assert.deepEqual(r.spec.pool, { of: "cast", where: { teams: ["364"], positions: ["FWD"] } });
  assert.deepEqual(r.fixed.map((f) => f.part), ["pool.where.teams", "pool.where.positions"], "one fix a list, at the list");
  // One the page hasn't got beside one it has: the list kept with the one it has, and asked.
  const half = Words.checkDraft(draft({ teams: ["Chelsea", "Arsenal"] }), { ctx: SOCCER, pack, words, kind: "sport" });
  assert.deepEqual(half.spec.pool.where.teams, ["359"]);
  assert.ok(half.ask.some((a) => a.part === "pool.where.teams"));
  assert.deepEqual(r.problems, []);
  const lost = Words.checkDraft(draft({ teams: ["Chelsea"] }), { ctx: SOCCER, pack, words, kind: "sport" });
  assert.deepEqual(lost.spec.pool, { of: "cast", where: { stillIn: true } });
  assert.deepEqual(lost.ask.find((a) => a.part === "pool.where.teams").options, ["Any team", "Arsenal", "Liverpool", "Manchester City"]);
  // The manual says the page's positions.
  assert.match(Words.manualFor(SOCCER, { kind: "sport" }), /"positions": \[the sport's position groups: GK \(Goalkeepers\), DEF \(Defenders\), MID \(Midfielders\), FWD \(Forwards\)\]/);
});

test("a refusal names the teams by their names and the positions by their keys; a game stopping early is won by its end", () => {
  const s = league(outlast({ of: "cast", where: { teams: ["364", "382"], positions: ["FWD"] } }, { order: "blind", own: "shared" }));
  assert.equal(S.PoolLogic.reason(s, S.Core.getCastaway(s, "c10")), "Arsenal 0 can't be picked in this game: it's Liverpool or Manchester City FWD only");
  assert.match(G.describeSpec({ preset: "weekly-bingo", span: { from: 1, to: 4 } }, {}).sentence, /Most lines by Episode 4 wins\.$/);
  assert.match(G.describeSpec({ preset: "weekly-bingo", span: { from: 1, to: { phase: "merged" } } }, {}).sentence, /Most lines by the end of the game wins\.$/);
  const staged = { spec: 1, stages: [{ id: "a", name: null, game: { preset: "weekly-bingo", span: { from: 1, to: 4 } } }, { id: "b", name: null, game: { preset: "outlast", span: { from: 5, to: null } } }], overall: { by: "points" } };
  assert.match(G.describeSpec(staged, {}).sentence, /Most lines by the end of the stage wins; then Stage 2/);
});
