// Dev-only check of teams of players (docs/PLAN-start-a-game-gpt.md step A11 part 5: game-spec schema.js rank.teams; settings.js
// rankTeams; state-logic.js TeamLogic, rankKey; db.ts's settle that keeps the teams once a game starts; the player-teams route;
// game-view.ts's sides and teams; answer-points.ts's walk handing a game of questions' episodes over; the couch hub's plaque and
// head to head) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex,
// riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three days off; alex runs its games).
// In order:
//   - Lineup League made a game for Episodes 6 and 7 in two chosen teams, the Reds and the Blues, their points summed, through
//     RosterLogic.setGame with the show's ctx (its field rankTeams; still a Weekly Lineup). The Games tab: the teams not set, nobody
//     on one. Each picks through the route: alex and riley the Reds, jordan and sam the Blues; a team that isn't one refused; riley
//     can't pick for jordan.
//   - jordan's Survival Pool for Episode 6 on (the others join) made a game of questions, Who goes home? each episode, in two teams
//     drawn at the start, their points summed; the answers through the answers route.
//   - Episode 6 through the season sync: both games started, their teams kept (the Lineup League's as chosen, from 6; the pool's as
//     drawn); each team's points its members' (the Lineup League's from each one's own points, the pool's from the walk of its
//     answers: the right calls); every member sharing their team's place in the table. sam's switch refused now (the teams are set);
//     alex, running the game, moves riley to the Blues, from Episode 7.
//   - Episode 7 through the season sync: riley's points go to the Blues, Episode 6's stay with the Reds; the game over (its span's
//     end); the hub's plaque the winning team's members, with no margin in anyone's points, and teammates never in each other's
//     head to head.
//   - Episode 7's moment corrected (re-decided): worked out again.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-teams.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-teams runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);
// The same, whatever order a stored object's keys come back in (jsonb sorts them).
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const round = (n) => Math.round(n * 100) / 100;

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
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const decide = async (n, kind, name, eventType) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
        [sid, n, kind, name, kind === "elimination" ? "Voted Out" : "", eventType || ""]
      );
      await syncSeasonLeagues(sid, null);
    };
    const airs = (days) => pool.query("UPDATE show_seasons SET premiere_date = premiere_date - $2::int WHERE id = $1", [sid, days]);
    const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const seatsOf = async (id) => {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [id])).rows) {
        const who = whoIs(user_id);
        if (who) out[who] = player_id;
      }
      return out;
    };
    // A game's spec changed as the engine writes one (there's no screen for it yet): setGame with the show's ctx.
    const setGame = async (id, spec) => {
      const st = await stateOf(id);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(id, sid);
      const problems = S.setGame(st, typeof spec === "function" ? spec(S.gameOf(st)) : spec, { ctx });
      if (!problems.length) await write(id, st);
      return problems;
    };
    const gameIn = async (who, id) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === id) ?? null;
    const teamsOf = (g) => Object.fromEntries((g?.teams?.teams ?? []).map((t) => [t.id, t.points]));

    // ---------- Lineup League in two chosen teams, Episodes 6 and 7 ----------
    const L = fx.leagues.lineup;
    const pids = await seatsOf(L);
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    let problems = await setGame(L, (g) => ({ ...g, span: { from: 6, to: 7 }, rank: { by: "total", teams: { of: 2, made: "choose", score: "sum", names: ["Reds", "Blues"] } } }));
    let st = await stateOf(L);
    check(!problems.length && same(st.settings.rankTeams, { of: 2, made: "choose", score: "sum", names: ["Reds", "Blues"] }) && S.getLeagueType(st).id === "active-roster" && S.TeamLogic.on(st),
      "Lineup League made a game for Episodes 6 and 7 in two chosen teams, the Reds and the Blues, their points summed (rankTeams; still a Weekly Lineup)", JSON.stringify({ problems, rankTeams: st.settings.rankTeams }));
    for (const who of WHO) await seen(who, 5);
    let g = await gameIn("jordan", L);
    check(g?.teams?.made === "choose" && g?.teams?.set === false && g?.teams?.yours === null && same(g.teams.teams.map((t) => [t.id, t.name, t.members.length]), [["t1", "Reds", 0], ["t2", "Blues", 0]]),
      "  the Games tab as jordan reads it: the teams not set, nobody on one yet", JSON.stringify(g?.teams));
    const pick = (who, seat, team) => as[who].call("PUT", `/api/leagues/${L}/player-teams/${pids[seat]}`, { team });
    const picks = [(await pick("alex", "alex", "t1")).status, (await pick("riley", "riley", "t1")).status, (await pick("jordan", "jordan", "t2")).status, (await pick("sam", "sam", "t2")).status];
    check(same(picks, [200, 200, 200, 200]), "  each picks through the route: alex and riley the Reds, jordan and sam the Blues", JSON.stringify(picks));
    let r = await pick("sam", "sam", "t3");
    check(r.status === 400 && /No such team/.test(errorOf(r)), "  a team that isn't one refused", `${r.status} ${errorOf(r)}`);
    r = await pick("riley", "jordan", "t1");
    check(r.status === 403, "  riley can't pick jordan's", `${r.status} ${errorOf(r)}`);
    g = await gameIn("sam", L);
    check(g?.teams?.yours === "t2" && same(g.teams.teams.map((t) => [t.id, t.members.map(whoOf).sort()]), [["t1", ["alex", "riley"]], ["t2", ["jordan", "sam"]]]),
      "  as sam reads it: theirs the Blues; the Reds alex and riley", JSON.stringify(g?.teams));

    // ---------- jordan's Survival Pool as a game of questions in two drawn teams ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const Q = r.body.leagueId;
    check(r.status === 200 && !!Q, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["alex", "riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${Q}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${Q}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const qp = await seatsOf(Q);
    const qWho = (pid) => Object.keys(qp).find((k) => qp[k] === pid) ?? pid;
    problems = await setGame(Q, (g0) => ({ spec: 1, span: { from: g0.span.from, to: 7 }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT], rank: { by: "total", teams: { of: 2, score: "sum" } } }));
    st = await stateOf(Q);
    check(!problems.length && st.settings.leagueTypeId === "questions" && same(st.settings.rankTeams, { of: 2, score: "sum" }),
      "  made a game of questions, Who goes home? each episode to 7, in two teams drawn at the start, their points summed", JSON.stringify({ problems, rankTeams: st.settings.rankTeams }));
    check(typeof st.teamDraw?.seed === "string" && !st.teamDraw.kept && st.teamSeats === undefined, "  its draw's seed set as it's made (setGame), nothing kept before the start", JSON.stringify({ draw: st.teamDraw, seats: st.teamSeats }));
    r = await as.alex.call("PUT", `/api/leagues/${Q}/player-teams/${qp.alex}`, { team: "t1" });
    check(r.status === 400 && /drawn at the game's start/.test(errorOf(r)), "  nobody picks in a drawn game: refused, the teams are drawn at its start", `${r.status} ${errorOf(r)}`);
    // What the Games tab shows before the start is the draw it keeps.
    const before = Object.fromEntries(((await gameIn("riley", Q))?.teams?.teams ?? []).flatMap((t) => t.members.map((m) => [qWho(m), t.id])));
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    const [X, Y, Z, P] = still;
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${Q}`, body);
    const six = [];
    for (const [who, c] of [["alex", X], ["jordan", X], ["riley", Y], ["sam", X]]) six.push((await ask(who, { answers: { boot: c.id } })).status);
    check(six.every((s) => s === 200), `  Episode 6's answers: alex, jordan and sam ${X.name}, riley ${Y.name}`, JSON.stringify(six));

    // ---------- Episode 6 ----------
    st = await stateOf(L);
    const ep6 = st.episodes.find((e) => e.number === 6);
    const starters = (s, epId, who) => S.ActiveRosterLogic.lineupFor(s, epId, pids[who]);
    const used = new Set(WHO.flatMap((w) => starters(st, ep6.id, w)));
    // Someone in nobody's lineup goes home; one of riley's starters (not jordan's or sam's) wins immunity.
    const goner = st.castaways.filter((c) => c.status === "active" && !used.has(c.id) && c.name !== Y.name).sort((a, b) => a.name.localeCompare(b.name))[0];
    const rileysStar = S.getCastaway(st, starters(st, ep6.id, "riley").find((id) => !starters(st, ep6.id, "jordan").includes(id) && !starters(st, ep6.id, "sam").includes(id)));
    await airs(4);
    await decide(6, "elimination", X.name);
    await decide(6, "elimination", goner.name);
    await decide(6, "event", rileysStar.name, "individualImmunity");
    for (const who of WHO) await seen(who, 6);
    st = await stateOf(L);
    check(st.teamDraw?.kept === true && same(Object.fromEntries(WHO.map((w) => [w, st.teamSeats?.[pids[w]]])), { alex: [{ team: "t1", from: 6 }], riley: [{ team: "t1", from: 6 }], jordan: [{ team: "t2", from: 6 }], sam: [{ team: "t2", from: 6 }] }),
      `Episode 6 through the season sync (${X.name} and ${goner.name} out, ${rileysStar.name}'s immunity): the Lineup League's teams kept as chosen, from 6`, JSON.stringify({ draw: st.teamDraw, seats: st.teamSeats }));
    g = await gameIn("alex", L);
    const own = Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), t.points]));
    const reds6 = round(own.alex + own.riley);
    const blues6 = round(own.jordan + own.sam);
    check(same(teamsOf(g), { [reds6 >= blues6 ? "t1" : "t2"]: Math.max(reds6, blues6), [reds6 >= blues6 ? "t2" : "t1"]: Math.min(reds6, blues6) }) && reds6 > blues6,
      `  each team's points its members' own, added up: the Reds ${reds6}, the Blues ${blues6}`, JSON.stringify({ teams: g?.teams?.teams, own }));
    const sides = Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), [t.side?.id, t.side?.place]]));
    check(same(sides, { alex: ["t1", 1], riley: ["t1", 1], jordan: ["t2", 2], sam: ["t2", 2] }) && same((g?.table ?? []).slice(0, 2).map((t) => whoOf(t.playerId)).sort(), ["alex", "riley"]) && (g?.table ?? [])[0].points >= (g?.table ?? [])[1].points,
      "  the table: every member sharing their team's place, the Reds first (each team listed by its members' own points)", JSON.stringify({ sides, order: (g?.table ?? []).map((t) => whoOf(t.playerId)) }));
    const rileys6 = own.riley;
    // The pool's teams: drawn as they stood, each team's points its members' right calls (alex, jordan and sam called X).
    const qs = await stateOf(Q);
    const drawn = Object.fromEntries(WHO.map((w) => [w, qs.teamSeats?.[qp[w]]?.[0]?.team ?? null]));
    const sizes = ["t1", "t2"].map((t) => Object.values(drawn).filter((x) => x === t).length);
    check(qs.teamDraw?.kept === true && same(sizes, [2, 2]) && Object.values(qs.teamSeats ?? {}).every((sp) => sp[0].from === 6) && same(drawn, before),
      `  the pool's teams kept as drawn, two and two, from 6 (${JSON.stringify(drawn)}): the teams its Games tab showed before the start`, JSON.stringify({ seats: qs.teamSeats, before }));
    const qg = await gameIn("alex", Q);
    const right = { alex: 1, jordan: 1, sam: 1, riley: 0 };
    const want = { t1: 0, t2: 0 };
    for (const w of WHO) want[drawn[w]] += right[w];
    const qTable = Object.fromEntries((qg?.table ?? []).map((t) => [qWho(t.playerId), t.total]));
    check(teamsOf(qg).t1 === want.t1 && teamsOf(qg).t2 === want.t2 && WHO.every((w) => qTable[w] === right[w]) && (qg?.table ?? []).every((t) => t.side?.id === drawn[qWho(t.playerId)]),
      `  the pool's teams' points their members' right calls, from the walk: ${JSON.stringify(want)}; each row on its drawn team`, JSON.stringify({ teams: qg?.teams?.teams, table: (qg?.table ?? []).map((t) => [qWho(t.playerId), t.total, t.side]) }));

    // ---------- after the start ----------
    r = await pick("sam", "sam", "t1");
    check(r.status === 400 && /The teams are set/.test(errorOf(r)), "  sam's switch refused now: the teams are set", `${r.status} ${errorOf(r)}`);
    r = await pick("alex", "riley", "t2");
    st = await stateOf(L);
    check(r.status === 200 && same(st.teamSeats?.[pids.riley], [{ team: "t1", from: 6 }, { team: "t2", from: 7 }]),
      "  alex, running the game, moves riley to the Blues, from Episode 7", `${r.status} ${errorOf(r)} ${JSON.stringify(st.teamSeats?.[pids.riley])}`);

    // ---------- Episode 7 ----------
    st = await stateOf(L);
    const ep7 = st.episodes.find((e) => e.number === 7);
    check(!!ep7, "  Episode 7 is there to play", JSON.stringify(st.episodes.map((e) => e.number)));
    const star7 = S.getCastaway(st, starters(st, ep7.id, "riley").find((id) => !starters(st, ep7.id, "alex").includes(id)));
    await airs(7);
    await decide(7, "elimination", P.name === star7.name ? Z.name : P.name);
    await decide(7, "event", star7.name, "individualImmunity");
    for (const who of WHO) await seen(who, 7);
    g = await gameIn("alex", L);
    const own7 = Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), t.points]));
    const reds7 = round(own7.alex + rileys6);
    const blues7 = round(own7.jordan + own7.sam + (own7.riley - rileys6));
    check(same(teamsOf(g).t1, reds7) && same(teamsOf(g).t2, blues7) && g?.over === true,
      `Episode 7 (${star7.name}'s immunity, riley's): riley's points go to the Blues, Episode 6's stay with the Reds: the Reds ${reds7}, the Blues ${blues7}; over`, JSON.stringify({ teams: g?.teams?.teams, own7, rileys6 }));
    const winners = reds7 > blues7 ? ["alex"] : reds7 < blues7 ? ["jordan", "riley", "sam"] : WHO;
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === L);
    check(!!plaque && same(plaque.winners.map((x) => whoIs(x.userId)).sort(), [...winners].sort()) && plaque.by === null,
      `the hub as jordan reads it: the plaque is the winning team's (${winners.join(", ")}), with no margin in anyone's points`, JSON.stringify(plaque));
    check(!!hub.rankings && (hub.rankings.counted?.all ?? 0) > 0, "  the hub's power rankings and head to head read with the teams game in them", JSON.stringify(hub.rankings?.counted));

    // ---------- a corrected result ----------
    const alexs7 = S.getCastaway(st, starters(st, ep7.id, "alex").find((id) => !starters(st, ep7.id, "riley").includes(id) && !starters(st, ep7.id, "jordan").includes(id) && !starters(st, ep7.id, "sam").includes(id)) ?? starters(st, ep7.id, "alex")[0]);
    await pool.query("UPDATE season_decisions SET castaway_name = $3, decided_at = now() WHERE season_id = $1 AND episode_number = 7 AND castaway_name = $2 AND kind = 'event'", [sid, star7.name, alexs7.name]);
    await syncSeasonLeagues(sid, null);
    g = await gameIn("alex", L);
    const own7b = Object.fromEntries((g?.table ?? []).map((t) => [whoOf(t.playerId), t.points]));
    const reds7b = round(own7b.alex + rileys6);
    const blues7b = round(own7b.jordan + own7b.sam + (own7b.riley - rileys6));
    check(same(teamsOf(g).t1, reds7b) && same(teamsOf(g).t2, blues7b) && (reds7b !== reds7 || blues7b !== blues7),
      `the desk corrects Episode 7's immunity to ${alexs7.name} (alex's): worked out again, the Reds ${reds7b}, the Blues ${blues7b}`, JSON.stringify({ teams: g?.teams?.teams, own7b }));
  } catch (e) {
    failures++;
    console.log("FAIL  threw:", e && e.stack ? e.stack : e);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `${failures} failed` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
