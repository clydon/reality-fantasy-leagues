// Dev-only check of a draft's slots and a draw (docs/PLAN-start-a-game-gpt.md step A10 part 3: game-spec schema.js get.across
// and get.order 'draw', settings.js draftAcross and draftDraw, state-logic.js SpreadLogic, DrawLogic and DrawDraftStrategy, the
// draft routes' refusals, db.ts and league-read.ts drawing a scheduled draw when it's due) against the dev server, through the
// API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51: results
// through Episode 5, one going home each, three tribes; Episode 6 three days off), and its ZT Extra (alex and casey). Each of
// the fixture's four games has its draft taken back and is made one of part 3's, through RosterLogic.setGame:
//   - Couch Cup, an Outlast of three each spread across the tribes (s05), snake: started by alex (force-start), drafted turn by
//     turn through the pick route; a second from one tribe refused (400, with why), someone else's turn refused; every team one
//     from each tribe at the end, as the tribes stand now (the data: the season cast's tribes, less who went home).
//   - Pool Party, names out of a hat (s38: an Outlast of one each, drawn, exclusive): started by alex, everyone dealt one at
//     once, nobody sharing, the draw recorded (its seed) and the same seed dealing the same teams from the league as it was; a
//     pick and the draft order refused (nobody picks; no turns); the draft room reads it as a draw, done.
//   - Lineup League, a Weekly Lineup of three dealt from a hat each (shared) and spread across the tribes, its draft scheduled
//     a minute ago: nobody starts it; jordan's read of the league draws it (readyLeague), each team one from each tribe; a
//     second read draws nothing new.
//   - ZT Extra, a Weekly Lineup of three, blind and spread across the tribes: casey's team of two Tokas refused (400, with
//     why); a spread one locked in; alex's too, and the reveal.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-draft-spread.js [--keep]
//
// One fixed scenario on purpose (the four drafts above), run again whenever a draft's slots or the draw change. Brings
// new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-draft-spread runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const SPREAD = { of: "group" };

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

/** The league's draft taken back: nobody owns anyone, no picks, not started, no draw; the order its players in the rotation. */
function undraft(st) {
  for (const c of st.castaways) Object.assign(c, { ownerIds: [], acquiredVia: null, formerOwnerId: null, departedVia: null, replenishClaimed: false });
  Object.assign(st, { draftPicksMade: 0, draftLog: [], draftForceStarted: false, draftOrder: st.players.filter((p) => !p.disabled && !p.ghost).map((p) => p.id) });
  delete st.draftStartedAt;
  delete st.draftTurnAt;
  delete st.draw;
  st.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  if (st.midSeason) st.midSeason.log = [];
  for (const e of st.episodes) e.lineups = {};
}
const teamOf = (st, pid) => st.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const tribesOf = (st, pid) => teamOf(st, pid).map((id) => st.castaways.find((c) => c.id === id).tribeId).sort();

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const pidsOf = async (id) => {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [id])).rows) {
        const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
        if (who) out[who] = player_id;
      }
      return out;
    };
    /** The league made `spec`, its draft taken back (setGame, as a league's own; the game-specs flag's copy carried when it's on). */
    const remake = async (id, spec, extra = (st) => st) => {
      const st = await league(id);
      undraft(st);
      const problems = S.setGame(st, spec);
      extra(st);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      await write(id, st);
      return problems;
    };
    const tribeName = (st, tid) => st.tribes.find((t) => t.id === tid)?.name ?? tid;

    // ---------- Couch Cup: an Outlast of three spread across the tribes (s05), snake ----------
    const O = fx.leagues.outlast;
    const pO = await pidsOf(O);
    let problems = await remake(O, { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive", across: SPREAD } });
    let st = await league(O);
    const g = S.SpreadLogic.groupsNow(st);
    check(!problems.length && g && g.groups.length === 3 && g.least === 1 && g.most === 1, "Couch Cup made an Outlast of three spread across the tribes: three tribes now, one from each", JSON.stringify({ problems, g: g && { groups: g.groups.map((t) => tribeName(st, t)), least: g.least, most: g.most } }));
    let r = await as.alex.call("POST", `/api/leagues/${O}/draft/force-start`, {});
    check(r.status === 200, "  alex starts the draft", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    st = await league(O);
    const tribes = g ? g.groups : [];
    const pickAs = async (who, castawayId) => as[who].call("POST", `/api/leagues/${O}/draft/pick`, { castawayId });
    const whoOn = async () => {
      const turn = S.currentDraftTurn(await league(O));
      return turn && !turn.isComplete ? Object.keys(pO).find((k) => pO[k] === turn.playerId) : null;
    };
    // Round one: each takes the first free of a tribe in turn (alex Toka's, riley Savu's, ...), so a second from one is refused later.
    const plan = {};
    let refusedSecond = null;
    let refusedTurn = null;
    for (let guard = 0; guard < 20; guard++) {
      const who = await whoOn();
      if (!who) break;
      st = await league(O);
      const free = S.freeAgents(st).map((c) => c.id);
      const mine = tribesOf(st, pO[who]);
      if (!refusedTurn) {
        const other = Object.keys(pO).find((k) => k !== who);
        refusedTurn = await pickAs(other, free[0]);
      }
      if (mine.length === 1 && !refusedSecond) {
        // A second from the tribe they have, while one's free: refused, with why.
        const again = free.find((id) => st.castaways.find((c) => c.id === id).tribeId === mine[0]);
        if (again) refusedSecond = { who, r: await pickAs(who, again) };
      }
      const want = tribes.find((t) => !mine.includes(t) && free.some((id) => st.castaways.find((c) => c.id === id).tribeId === t));
      const id = free.find((x) => st.castaways.find((c) => c.id === x).tribeId === want) ?? free[0];
      r = await pickAs(who, id);
      (plan[who] ||= []).push(r.status);
    }
    check(refusedTurn && refusedTurn.status === 403, "  a pick on someone else's turn is refused (403)", JSON.stringify(refusedTurn && [refusedTurn.status, refusedTurn.body]));
    check(refusedSecond && refusedSecond.r.status === 400 && /Spread your team across the tribes: at least 1 from each, and no more than 1 from one/.test(refusedSecond.r.body?.error ?? JSON.stringify(refusedSecond.r.body)), "  a second from the tribe someone has is refused (400), saying why", JSON.stringify(refusedSecond && [refusedSecond.who, refusedSecond.r.status, refusedSecond.r.body]));
    st = await league(O);
    check(S.currentDraftTurn(st)?.isComplete === true && Object.values(plan).flat().every((s) => s === 200), "  the draft runs to the end through the pick route", JSON.stringify(plan));
    check(Object.values(pO).every((p) => G.sameValue(tribesOf(st, p), [...tribes].sort())), "  every team one from each tribe", JSON.stringify(Object.fromEntries(Object.entries(pO).map(([w, p]) => [w, tribesOf(st, p).map((t) => tribeName(st, t))]))));

    // ---------- Pool Party: names out of a hat (s38) ----------
    const P = fx.leagues.pool;
    const pP = await pidsOf(P);
    problems = await remake(P, { preset: "outlast", get: { by: "draft", each: 1, order: "draw" } });
    st = await league(P);
    const before = JSON.parse(JSON.stringify(st));
    check(!problems.length && S.piecesOf(st).draft === S.DrawDraftStrategy && st.settings.draftDraw === true && !S.DrawLogic.drawn(st), "Pool Party made names out of a hat (an Outlast of one each, drawn): not drawn yet", JSON.stringify(problems));
    r = await as.alex.call("POST", `/api/leagues/${P}/draft/force-start`, {});
    st = await league(P);
    const dealt = Object.fromEntries(Object.entries(pP).map(([w, p]) => [w, teamOf(st, p)]));
    check(r.status === 200 && S.DrawLogic.drawn(st) && Object.values(dealt).every((t) => t.length === 1) && new Set(Object.values(dealt).flat()).size === 4, "  alex starts it: everyone dealt one at once, nobody sharing", JSON.stringify([r.status, dealt]));
    const again = S.DrawLogic.outcome(before, st.draw.seed);
    check(!!st.draw.seed && Object.entries(pP).every(([w, p]) => G.sameValue(again.teams[p], dealt[w])), "  the draw recorded: its seed deals the same teams from the league as it was", JSON.stringify({ seed: st.draw.seed, again: again.teams }));
    check(st.draftLog.length === 4 && st.draftLog.every((e) => e.drawn), "  each dealt a line in the draft's log, drawn");
    r = await as.alex.call("POST", `/api/leagues/${P}/draft/pick`, { castawayId: S.freeAgents(st)[0].id });
    check(r.status === 400, "  a pick is refused: nobody picks in a draw", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.alex.call("POST", `/api/seasons/${sid}/draft`, { leagueId: P, action: "order", order: [...st.draftOrder].reverse() });
    check(r.status === 400, "  and so is a new draft order through the draft room (no turns)", `${r.status} ${JSON.stringify(r.body)}`);
    const room = (await as.jordan.call("GET", `/api/seasons/${sid}/draft`)).body;
    const roomGame = (room?.games ?? []).find((x) => x.leagueId === P);
    check(roomGame?.kind === "draw" && roomGame.phase === "done" && roomGame.teams.length === 4 && roomGame.clock === null, "  the draft room reads it as a draw, done, the teams dealt", JSON.stringify(roomGame && { kind: roomGame.kind, phase: roomGame.phase, teams: roomGame.teams?.length }).slice(0, 300));

    // ---------- Lineup League: a Weekly Lineup dealt from a hat each, spread, scheduled a minute ago ----------
    const L = fx.leagues.lineup;
    const pL = await pidsOf(L);
    const past = new Date(Date.now() - 60e3).toISOString();
    problems = await remake(L, { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "draw", own: "shared", across: SPREAD }, count: { start: 2 }, extras: { draft: { at: past, timer: 0, away: "wait" } } });
    st = await league(L);
    check(!problems.length && S.DrawLogic.due(st) && !S.DrawLogic.drawn(st), "Lineup League made a Weekly Lineup of three, a hat each, spread across the tribes, due a minute ago: nobody's drawn it", JSON.stringify(problems));
    r = await as.jordan.call("GET", `/api/leagues/${L}/state`);
    st = await league(L);
    const lineTribes = Object.fromEntries(Object.entries(pL).map(([w, p]) => [w, tribesOf(st, p)]));
    check(r.status === 200 && S.DrawLogic.drawn(st) && Object.values(lineTribes).every((t) => G.sameValue(t, [...tribes].sort())), "  jordan's read of the league draws it: each team one from each tribe", JSON.stringify([r.status, lineTribes]));
    const seed = st.draw && st.draw.seed;
    const teams = JSON.stringify(Object.values(pL).map((p) => teamOf(st, p)));
    await as.riley.call("GET", `/api/leagues/${L}/state`);
    st = await league(L);
    check(st.draw.seed === seed && JSON.stringify(Object.values(pL).map((p) => teamOf(st, p))) === teams, "  a second read draws nothing new");

    // ---------- ZT Extra: a blind Weekly Lineup spread across the tribes ----------
    const X = fx.leagues.extra;
    const pX = await pidsOf(X);
    problems = await remake(X, { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "blind", own: "shared", across: SPREAD }, count: { start: 2 } });
    r = await as.alex.call("POST", `/api/leagues/${X}/draft/force-start`, {});
    st = await league(X);
    const [t1, t2, t3] = tribes;
    const of = (tid, i = 0) => st.castaways.filter((c) => c.status === "active" && c.tribeId === tid)[i].id;
    check(!problems.length && r.status === 200 && S.isDraftStarted(st), "ZT Extra made a blind Weekly Lineup of three spread across the tribes, started", JSON.stringify([problems, r.status]));
    r = await as.casey.call("POST", `/api/leagues/${X}/draft/blind/lock`, { playerId: pX.casey, castawayIds: [of(t1), of(t1, 1), of(t2)] });
    check(r.status === 400 && /Spread your team across the tribes/.test(JSON.stringify(r.body)), "  casey's team of two from one tribe is refused (400), saying why", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.casey.call("POST", `/api/leagues/${X}/draft/blind/lock`, { playerId: pX.casey, castawayIds: [of(t3), of(t1), of(t2)] });
    check(r.status === 200, "  a spread team locks in", `${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    r = await as.alex.call("POST", `/api/leagues/${X}/draft/blind/lock`, { playerId: pX.alex, castawayIds: [of(t1), of(t2), of(t3)] });
    st = await league(X);
    check(r.status === 200 && S.BlindDraftLogic.isRevealed(st) && G.sameValue(tribesOf(st, pX.casey), [...tribes].sort()) && G.sameValue(tribesOf(st, pX.alex), [...tribes].sort()), "  alex's too: revealed, both teams spread", JSON.stringify([r.status, tribesOf(st, pX.casey), tribesOf(st, pX.alex)]));
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
