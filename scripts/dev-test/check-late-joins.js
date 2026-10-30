// Dev-only check of the late joiners' leftovers (docs/PLAN-start-a-game-gpt.md step A11 part 5c: state-logic.js GhostLogic.someoneOut,
// begin and applyAs, PickEmLogic's catching-up reach, DrawLogic.lateDeal, TeamLogic's settle for a late joiner; couch-joins.ts reading
// a game of questions as it stands) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's
// couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three days off; alex runs its
// games; casey on the ZT Extra couch with alex). In order:
//   - Lineup League with a captain (A9 part 2): casey joins by its code (a late joiner, unseen), starts from Episode 4 through the
//     late-join route, and sets their week's lineup and its captain through the lineup route (GhostLogic.applyAs): it lands on the
//     real Episode 4, and their own copy at Episode 4 counts the captain twice.
//   - The Survival Pool from Episode 4 with a life each and a second pick (A10 part 2): casey (made one of the couch) joins it on the
//     couch catching up from Episode 4, makes their week's pick and second pick through the pick route (applyAs); in everyone's copy
//     their Episodes 5 and 6 aren't missed picks (their week is 4), so they're not out.
//   - jordan's Survival Pool made a game of questions with a life each (A11 part 2b), alex, riley and sam in; open to casey.
//   - Episode 6 through the season sync: sam's pick and sam's answer were the one who went home, so sam is out of both: casey finds
//     both locked on the couch's games (the game of questions read as it stands: its walk), and the join route refuses them.
//   - ZT Extra's game made a shared draw (names out of a hat) in two drawn teams, drawn; riley (made one of that couch) is told the
//     team is dealt, joins live (Episode 7: 6's results reached it) and is dealt two from their own hat, and goes onto the smallest
//     team from then.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-late-joins.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-late-joins runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const out = K.checker();
const { check } = out;
const { round, errorOf } = K;

const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of [...WHO, "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const { decide, seen, stateOf, write, seatsOf, setGame } = K.kit({ pool, fx, as, specsOn });
    const pidOf = async (league, who) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [league, fx.users[who]])).rows[0]?.player_id;
    const epId = (st, n) => st.episodes.find((e) => e.number === n).id;
    const games = async (who, c = couch) => (await as[who].call("GET", `/api/couches/${c}/games`)).body.games ?? [];
    const modeOf = async (who, id, c = couch) => (await games(who, c)).find((g) => g.leagueId === id)?.mode;
    let r;
    let st;

    // ---------- Lineup League with a captain: casey, a late joiner, sets their week's captain ----------
    const L = fx.leagues.lineup;
    let problems = await setGame(L, (g) => ({ ...g, score: { ...g.score, captain: { times: 2 } } }));
    check(!problems.length, "Lineup League gets a captain each episode (twice their points)", JSON.stringify(problems));
    const code = (await pool.query("SELECT join_code FROM leagues WHERE id = $1", [L])).rows[0].join_code;
    r = await as.casey.call("POST", "/api/leagues/join", { code });
    const cL = await pidOf(L, "casey");
    st = await stateOf(L);
    check(r.status === 200 && !!cL && S.GhostLogic.isGhost(S.getPlayer(st, cL)), "casey joins Lineup League by its code: a late joiner, unseen", JSON.stringify(r.body).slice(0, 200));
    const size = S.GhostLogic.teamSize(st);
    const poolAt4 = S.GhostLogic.draftPool(st, 4, false);
    // The one with the most points in Episode 4, so the captain shows.
    const ep4 = st.episodes.find((e) => e.number === 4);
    const pointsIn4 = (id) => S.ActiveRosterLogic.episodeEvents(st, ep4).filter((ev) => ev.castawayId === id).reduce((n, ev) => n + S.ActiveRosterLogic.eventPoints(st, ev), 0);
    const ranked = [...poolAt4].sort((a, b) => pointsIn4(b) - pointsIn4(a));
    const team = ranked.slice(0, size);
    r = await as.casey.call("POST", `/api/leagues/${L}/late-join`, { startEpisode: 4, castawayIds: team });
    check(r.status === 200, `  casey starts from Episode 4 with ${size} of who was still in`, errorOf(r));
    const star = team[0];
    r = await as.casey.call("PUT", `/api/leagues/${L}/episodes/${ep4.id}/lineups/${cL}`, { castawayIds: [star], captainId: star });
    st = await stateOf(L);
    const e4 = st.episodes.find((e) => e.number === 4);
    check(r.status === 200 && e4.captains?.[cL] === star && JSON.stringify(e4.lineups?.[cL]) === JSON.stringify([star]),
      "  their week's lineup and captain through the lineup route land on the real Episode 4 (applyAs)", `${r.status} ${errorOf(r)} ${JSON.stringify({ lineup: e4.lineups?.[cL], captain: e4.captains?.[cL] })}`);
    r = await as.casey.call("PUT", `/api/leagues/${L}/episodes/${epId(st, 5)}/lineups/${cL}`, { castawayIds: [star], captainId: star });
    check(r.status === 400 && /ahead of you/.test(errorOf(r)), "  Episode 5 isn't theirs yet: refused", `${r.status} ${errorOf(r)}`);
    const theirs = S.computeScores(S.GhostLogic.viewFor(st, cL, 4)).find((x) => x.playerId === cL);
    check(pointsIn4(star) > 0 && round(theirs.total) === round(2 * pointsIn4(star)), `  their own copy at Episode 4 counts the captain twice: ${theirs.total} (${pointsIn4(star)} × 2)`, JSON.stringify(theirs));

    // ---------- The Survival Pool from Episode 4, a life each and a second pick: casey catches up ----------
    const P = fx.leagues.pool;
    problems = await setGame(P, (g) => ({ ...g, span: { from: 4, to: null }, get: { ...g.get, second: {} }, score: { ...g.score, lives: 1 } }));
    st = await stateOf(P);
    const still4 = st.castaways.filter((c) => c.status === "active").map((c) => c.id).reverse();
    const seats = await seatsOf(P);
    // Everyone's Episodes 4 and 5 right (someone who lasts the season), as the pool's own rule allows (never the same twice running).
    for (const [i, who] of WHO.entries()) {
      for (const n of [4, 5]) {
        const e = st.episodes.find((x) => x.number === n);
        e.picks = (e.picks || []).filter((pk) => pk.playerId !== seats[who]);
        e.picks.push({ playerId: seats[who], castawayId: still4[(i * 2 + n) % 8] });
      }
    }
    await write(P, st);
    check(!problems.length && WHO.every((w) => S.PickEmLogic.history(st, seats[w]).out === null), "The Survival Pool from Episode 4, a life each and a second pick; everyone right in 4 and 5", JSON.stringify(problems));
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [couch, fx.users.casey]);
    let o = await as.casey.call("GET", `/api/couches/${couch}/games/${P}`);
    check(o.status === 200 && o.body.starts?.catchUp === 4 && o.body.starts?.live === 6, "  casey, now on the couch, can start live from 6 or catch up from 4", JSON.stringify(o.body.starts));
    r = await as.casey.call("POST", `/api/couches/${couch}/games/${P}`, { action: "join", start: 4 });
    const cP = await pidOf(P, "casey");
    st = await stateOf(P);
    check(r.status === 200 && !!cP && S.GhostLogic.isCatchingUp(st, cP), "  casey joins it, catching up from Episode 4", JSON.stringify(r.body).slice(0, 200));
    const view4 = S.GhostLogic.viewFor(st, cP, 3);
    const safe = view4.castaways.filter((c) => c.status === "active").map((c) => c.id).filter((id) => !st.episodes.find((e) => e.number === 4).events.some((ev) => ev.castawayId === id));
    const pickUrl = `/api/leagues/${P}/episodes/${epId(st, 4)}/picks`;
    r = await as.casey.call("PUT", pickUrl, { playerId: cP, castawayId: safe[0] });
    const r2 = await as.casey.call("PUT", pickUrl, { playerId: cP, castawayId: safe[1], second: true });
    st = await stateOf(P);
    const theirPick = S.PickEmLogic.pickFor(st, epId(st, 4), cP);
    check(r.status === 200 && r2.status === 200 && theirPick?.castawayId === safe[0] && theirPick?.second === safe[1],
      "  their week's pick and second pick through the pick route land on the real Episode 4 (applyAs)", JSON.stringify({ s: [r.status, r2.status], theirPick }));
    let h = S.PickEmLogic.history(st, cP);
    check(h.out === null && JSON.stringify(h.rows.map((x) => [x.episode, x.correct])) === "[[4,true]]",
      "  in everyone's copy: Episode 4 right, and Episode 5 (not their week yet) no missed pick: still in", JSON.stringify({ out: h.out, rows: h.rows.map((x) => [x.episode, x.correct]) }));
    check((await modeOf("alex", P)) === "open", "  nobody's out: the pool takes newcomers");

    // ---------- jordan's Survival Pool made a game of questions with a life each ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const Q = r.body.leagueId;
    check(r.status === 200 && !!Q, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body).slice(0, 200));
    for (const who of ["alex", "riley", "sam"]) {
      const g = await as[who].call("GET", `/api/couches/${couch}/games/${Q}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${Q}`, { action: "join", start: g.body.starts?.live ?? g.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 200));
    }
    problems = await setGame(Q, (g0) => ({ spec: 1, span: { from: g0.span.from, to: null }, get: { by: "none" }, score: { by: "answers", lives: 1 }, rank: { by: "standing" }, ask: [BOOT] }));
    st = await stateOf(Q);
    check(!problems.length && st.settings.leagueTypeId === "questions", "  made a game of questions, Who goes home? each episode, a life each", JSON.stringify(problems));
    check((await modeOf("casey", Q)) === "open", "  nobody's out yet: casey could join it");

    // ---------- Episode 6: sam's pick and sam's answer went home ----------
    st = await stateOf(P);
    const boot = st.castaways.find((c) => c.status === "active" && !WHO.some((w) => S.PickEmLogic.history(st, seats[w]).rows.some((x) => x.castawayId === c.id)));
    // Never the same pick twice running: someone else than their Episode 5 pick.
    const was5 = (who) => S.PickEmLogic.pickFor(st, epId(st, 5), seats[who])?.castawayId;
    const keepers = st.castaways.filter((c) => c.status === "active" && c.id !== boot.id).map((c) => c.id).reverse();
    const sent = {};
    const picks6 = [];
    for (const [i, who] of WHO.entries()) {
      const id = who === "sam" ? boot.id : keepers.filter((x) => x !== was5(who))[i];
      sent[who] = id;
      picks6.push((await as[who].call("PUT", `/api/leagues/${P}/episodes/${epId(st, 6)}/picks`, { playerId: seats[who], castawayId: id })).status);
    }
    st = await stateOf(P);
    const stored6 = WHO.map((w) => S.PickEmLogic.pickFor(st, epId(st, 6), seats[w])?.castawayId === sent[w]);
    check(picks6.every((x) => x === 200) && stored6.every(Boolean), `  Episode 6's pool picks through the pick route: sam ${boot.name}, the others someone else`, JSON.stringify({ picks6, stored6 }));
    const qs = await stateOf(Q);
    const qBoot = qs.castaways.find((c) => c.name === boot.name);
    const qOther = qs.castaways.find((c) => c.status === "active" && c.name !== boot.name);
    // sam has seen through Episode 3 only: caught up to 5, so they can answer for 6.
    await seen("sam", 5);
    const said = [];
    for (const [who, c] of [["alex", qBoot], ["riley", qBoot], ["jordan", qBoot], ["sam", qOther]]) said.push((await as[who].call("POST", `/api/seasons/${sid}/answers?league=${Q}`, { answers: { boot: c.id } })).status);
    check(said.every((x) => x === 200), `  Episode 6's answers: alex, riley and jordan ${boot.name}, sam ${qOther.name}`, JSON.stringify(said));
    await decide(6, "elimination", boot.name);
    st = await stateOf(P);
    h = S.PickEmLogic.history(st, seats.sam);
    check(h.out === 6, `  ${boot.name} goes home in Episode 6 (the season sync): sam's out of the pool`, JSON.stringify({ out: h.out }));
    h = S.PickEmLogic.history(st, cP);
    check(h.out === null && h.rows.every((x) => x.episode === 4), "  casey, still on their week, isn't: Episodes 5 and 6 aren't theirs yet", JSON.stringify({ out: h.out, rows: h.rows.map((x) => x.episode) }));
    check((await modeOf("casey", P)) === "locked", "  the pool takes nobody new now (someone's out)");
    check((await modeOf("casey", Q)) === "locked", "  the game of questions, read as it stands (its walk): nobody new either");
    o = await as.casey.call("GET", `/api/couches/${couch}/games/${Q}`);
    r = await as.casey.call("POST", `/api/couches/${couch}/games/${Q}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
    check(r.status === 403 && /Nobody new/.test(errorOf(r)) && !(await pidOf(Q, "casey")), "  casey's join refused by the route", `${r.status} ${errorOf(r)}`);

    // ---------- ZT Extra: a shared draw in two drawn teams; riley joins and is dealt ----------
    const X = fx.leagues.extra;
    const xc = fx.extraCouchId;
    problems = await setGame(X, { preset: "outlast", get: { by: "draft", each: 2, order: "draw", own: "shared" }, rank: { by: "total", teams: { of: 2 } } });
    st = await stateOf(X);
    st.castaways.forEach((c) => { c.ownerIds = []; });
    S.DraftLogic.forceStart(st);
    await write(X, st);
    const xs = await seatsOf(X);
    check(!problems.length && S.DrawLogic.drawn(st) && ["alex", "casey"].every((w) => S.Core.ownedCastawayIds(st, xs[w]).length === 2),
      "ZT Extra's game made a shared draw of two each, in two drawn teams: drawn", JSON.stringify(problems));
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [xc, fx.users.riley]);
    // Episode 6's results reached it too (the season sync): live is 7.
    const live = (await as.riley.call("GET", `/api/couches/${xc}/games/${X}`)).body.starts?.live;
    o = await as.riley.call("GET", `/api/couches/${xc}/games/${X}?start=${live}`);
    check(o.status === 200 && o.body.dealt === true && o.body.team === 2 && !o.body.pool.length, `  riley, now on that couch, starting live from ${live}, is told the team is dealt as they join (nothing to pick)`, JSON.stringify({ live, dealt: o.body.dealt, team: o.body.team, pool: o.body.pool?.length }));
    r = await as.riley.call("POST", `/api/couches/${xc}/games/${X}`, { action: "join", start: live, team: [] });
    const rX = await pidOf(X, "riley");
    st = await stateOf(X);
    const dealt = rX ? S.Core.ownedCastawayIds(st, rX) : [];
    const stillIn = new Set(S.GhostLogic.draftPool(st, live, false));
    check(r.status === 200 && dealt.length === 2 && dealt.every((id) => stillIn.has(id)), `  riley joins live and is dealt two from their own hat (who's still in)`, `${r.status} ${errorOf(r)} ${JSON.stringify(dealt)}`);
    const spells = st.teamSeats?.[rX];
    const sizes = new Map();
    for (const w of ["alex", "casey"]) sizes.set(S.TeamLogic.teamAt(st, xs[w], live), (sizes.get(S.TeamLogic.teamAt(st, xs[w], live)) || 0) + 1);
    check(Array.isArray(spells) && spells.length === 1 && spells[0].from === live && !!spells[0].team, `  and goes onto a team from Episode ${live} (the smallest, a tie to the first): ${spells?.[0]?.team}`, JSON.stringify({ spells, teams: [...sizes] }));
    check(st.teamDraw?.kept === true && S.TeamLogic.teamAt(st, xs.alex, live) !== S.TeamLogic.teamAt(st, xs.casey, live), "  the draw kept: alex and casey one a team");
  } catch (e) {
    out.fail();
    console.error(e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
  }
  console.log(out.failures() ? `${out.failures()} FAILED` : "ALL PASS");
  process.exit(out.failures() ? 1 : 0);
})();
