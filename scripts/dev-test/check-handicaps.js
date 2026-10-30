// Dev-only check of handicaps (docs/PLAN-start-a-game-gpt.md step A11 part 5b: game-spec schema.js rank.handicap; settings.js
// rankHandicap; state-logic.js HandicapLogic; src/lib/server/handicaps.ts's stamp of each seat's history on the couch, written on
// every write by db.ts, and kept once a game starts; game-view.ts's rows' handicap and GameView.handicap; answer-points.ts's walk of
// a game of questions with one) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's
// couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three days off; alex runs its
// games). In order:
//   - The couch's history, made here: an earlier game on ZT Survivor 50 (a year before 51) with alex and riley; one on ZT Traitors
//     4 with jordan; one deleted with sam, and one on another couch with sam (neither counts). So nobody but sam is new to the
//     couch, and jordan and sam are new to Survivor on it.
//   - Lineup League made a game for Episodes 6 and 7 with a handicap, 5 points an episode for newcomers to the couch, through
//     RosterLogic.setGame with the show's ctx. sam's lineup through the route (a write): the stamp reads the history (alex, riley
//     and jordan one game here, alex and riley one of Survivor), nothing kept before the start; the Games tab names sam.
//   - A team two people share: casey (with a Survivor 50 game of their own) on sam's seat makes it not new (the most of its
//     accounts'); casey off it again, sam is new again (before the start it's the history as it stands).
//   - jordan's Survival Pool for Episode 6 on (the others join) made a game of questions, Who goes home? each episode to 8, with a
//     handicap of 2 for newcomers to the show (jordan and sam); the answers through the answers route.
//   - Episode 6 through the season sync: both games started, who's new kept (the lineup's sam; the pool's jordan and sam); sam's
//     row 5 points from it, in the total; the pool's walk adds 2 for jordan and sam to their right calls.
//   - The history changing mid-season (the Survivor 50 game deleted): not read again while everyone's kept; read again when
//     someone new comes in, and nothing kept moves.
//   - casey joins the pool on the couch after its start, from Episode 7, new to it: kept as new at the next write, 2 points from 7.
//   - Episode 7 through the season sync: sam's 10 in the lineup game (over); jordan's and sam's 4, casey's 2 in the pool; the hub
//     reads both.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-handicaps.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-handicaps runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const out = K.checker();
const { check } = out;
const { same, round } = K;

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
    const { seen, whoIs, decide, airs, stateOf, seatsOf, setGame, gameIn } = K.kit({ pool, fx, as, specsOn });

    // ---------- the couch's history ----------
    const showId = (await pool.query("SELECT show_id, premiere_date FROM show_seasons WHERE id = $1", [sid])).rows[0].show_id;
    const traitors = (await pool.query("SELECT s.id, s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [fx.traitorsSeasonId])).rows[0];
    const traitorsShow = traitors.id;
    await pool.query("INSERT INTO show_seasons (show_id, season_number, status, premiere_date) SELECT show_id, 50, 'completed', premiere_date - 365 FROM show_seasons WHERE id = $1", [sid]);
    await pool.query("INSERT INTO show_seasons (show_id, season_number, status, premiere_date) VALUES ($1, 4, 'completed', current_date - 400)", [traitorsShow]);
    const lineupState = await stateOf(fx.leagues.lineup);
    /** An earlier game on a couch, its seats `who` (each their own), on a show and season, made 400 days ago (deleted, if so). */
    const earlier = async (slug, couchId, show, season, who, deleted = false) => {
      const st = S.defaultState();
      Object.assign(st.settings, { showId: show, wikiSeason: season, setupComplete: true });
      for (const w of who) S.addPlayer(st, w);
      const { rows } = await pool.query(
        "INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, created_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, now() - interval '400 days', $7) RETURNING id",
        [slug, slug, slug.replace(/[^a-z0-9]/g, "").slice(-6).toUpperCase(), JSON.stringify(st), fx.users.alex, couchId, deleted ? new Date() : null]
      );
      for (const [i, w] of who.entries()) await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')", [rows[0].id, fx.users[w], st.players[i].id]);
      return rows[0].id;
    };
    const s50 = await earlier("zt-nd-hist-s50", couch, lineupState.settings.showId, 50, ["alex", "riley"]);
    await earlier("zt-nd-hist-t4", couch, traitors.slug, 4, ["jordan"]);
    await earlier("zt-nd-hist-gone", couch, lineupState.settings.showId, 50, ["sam"], true);
    await earlier("zt-nd-hist-away", fx.extraCouchId, lineupState.settings.showId, 50, ["sam"]);
    check(!!s50 && !!showId, "the couch's history: Survivor 50 with alex and riley, Traitors 4 with jordan; sam's games deleted, or on another couch");

    // ---------- Lineup League with a handicap, Episodes 6 and 7 ----------
    const L = fx.leagues.lineup;
    const pids = await seatsOf(L);
    let problems = await setGame(L, (g) => ({ ...g, span: { from: 6, to: 7 }, rank: { by: "total", handicap: { points: 5 } } }));
    let st = await stateOf(L);
    check(!problems.length && same(st.settings.rankHandicap, { points: 5 }) && S.getLeagueType(st).id === "active-roster" && S.HandicapLogic.on(st),
      "Lineup League made a game for Episodes 6 and 7 with a handicap: 5 points an episode for newcomers to the couch (rankHandicap; still a Weekly Lineup)", JSON.stringify({ problems, rankHandicap: st.settings.rankHandicap }));
    const ep6 = st.episodes.find((e) => e.number === 6);
    const lineupWrite = async (who, epNumber) => {
      const s = await stateOf(L);
      const e = s.episodes.find((x) => x.number === epNumber);
      return as[who].call("PUT", `/api/leagues/${L}/episodes/${e.id}/lineups/${pids[who]}`, { castawayIds: S.ActiveRosterLogic.lineupFor(s, e.id, pids[who]) });
    };
    let r = await lineupWrite("sam", 6);
    st = await stateOf(L);
    const history = (s) => Object.fromEntries(WHO.map((w) => [w, s.seatHistory?.[pids[w]] ?? null]));
    check(r.status === 200 && same(history(st), { alex: { couch: 1, show: 1 }, riley: { couch: 1, show: 1 }, jordan: { couch: 1, show: 0 }, sam: { couch: 0, show: 0 } }) && st.handicapSeats === undefined,
      "  sam's lineup through the route (a write): each seat's history stamped (alex and riley a Survivor game here, jordan a Traitors one, sam nothing that counts), nothing kept before the start",
      `${r.status} ${JSON.stringify({ history: history(st), kept: st.handicapSeats })}`);
    for (const who of WHO) await seen(who, 5);
    let g = await gameIn("jordan", L);
    const name = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    check(g?.handicap?.points === 5 && g.handicap.newTo === "couch" && same(g.handicap.newcomers.map(name), ["sam"]) && g.handicap.yours === false && g.handicap.kept === false && (g?.table ?? []).every((t) => t.handicap === 0),
      "  the Games tab as jordan reads it: sam the newcomer, not jordan; not kept yet; nothing from it yet (the game starts at 6)", JSON.stringify({ handicap: g?.handicap, table: (g?.table ?? []).map((t) => [name(t.playerId), t.handicap]) }));
    check((await gameIn("sam", L))?.handicap?.yours === true, "  as sam reads it: theirs");

    // ---------- a team two people share ----------
    const casey50 = await earlier("zt-nd-hist-casey", couch, lineupState.settings.showId, 50, ["casey"]);
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role, seat_slot) VALUES ($1, $2, $3, 'member', 1)", [L, fx.users.casey, pids.sam]);
    await lineupWrite("sam", 6);
    st = await stateOf(L);
    check(same(st.seatHistory?.[pids.sam], { couch: 1, show: 1 }) && !S.HandicapLogic.isNew(st, pids.sam),
      "  casey (a Survivor 50 game of their own) on sam's seat: the seat's history the most of its accounts', so it isn't new", JSON.stringify(st.seatHistory?.[pids.sam]));
    await pool.query("DELETE FROM league_memberships WHERE league_id = $1 AND user_id = $2", [L, fx.users.casey]);
    await pool.query("DELETE FROM leagues WHERE id = $1", [casey50]);
    await lineupWrite("sam", 6);
    st = await stateOf(L);
    check(same(st.seatHistory?.[pids.sam], { couch: 0, show: 0 }) && S.HandicapLogic.isNew(st, pids.sam), "  casey off it again: sam new again (before the start it's the history as it stands)", JSON.stringify(st.seatHistory?.[pids.sam]));

    // ---------- jordan's Survival Pool as a game of questions with a handicap for newcomers to the show ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/start?couch=${couch}`, { game: "survivalPool", tell: false });
    const Q = r.body.leagueId;
    check(r.status === 200 && !!Q, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    const join = async (who, id) => {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${id}`);
      return as[who].call("POST", `/api/couches/${couch}/games/${id}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
    };
    for (const who of ["alex", "riley", "sam"]) {
      const j = await join(who, Q);
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const qp = await seatsOf(Q);
    const qName = (pid) => Object.keys(qp).find((k) => qp[k] === pid) ?? (pid === qp.casey ? "casey" : pid);
    problems = await setGame(Q, (g0) => ({ spec: 1, span: { from: g0.span.from, to: 8 }, get: { by: "none" }, score: { by: "answers" }, ask: [BOOT], rank: { by: "total", handicap: { points: 2, newTo: "show" } } }));
    st = await stateOf(Q);
    check(!problems.length && st.settings.leagueTypeId === "questions" && same(st.settings.rankHandicap, { points: 2, newTo: "show" }),
      "  made a game of questions, Who goes home? each episode to 8, with a handicap of 2 for newcomers to Survivor on the couch", JSON.stringify({ problems, rankHandicap: st.settings.rankHandicap }));
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    const [X, Y, , P] = still;
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${Q}`, body);
    const six = [];
    for (const [who, c] of [["alex", X], ["jordan", X], ["riley", Y], ["sam", Y]]) six.push((await ask(who, { answers: { boot: c.id } })).status);
    check(six.every((x) => x === 200), `  Episode 6's answers: alex and jordan ${X.name}, riley and sam ${Y.name}`, JSON.stringify(six));

    // ---------- Episode 6 ----------
    st = await stateOf(L);
    const used = new Set(WHO.flatMap((w) => S.ActiveRosterLogic.lineupFor(st, ep6.id, pids[w])));
    const goner = st.castaways.filter((c) => c.status === "active" && !used.has(c.id) && ![X.name, Y.name, P.name].includes(c.name)).sort((a, b) => a.name.localeCompare(b.name))[0];
    const star = S.getCastaway(st, S.ActiveRosterLogic.lineupFor(st, ep6.id, pids.alex)[0]);
    await airs(4);
    await decide(6, "elimination", X.name);
    await decide(6, "elimination", goner.name);
    await decide(6, "event", star.name, "individualImmunity");
    for (const who of WHO) await seen(who, 6);
    st = await stateOf(L);
    const kept = (s, p) => Object.fromEntries(Object.entries(s.handicapSeats?.seats ?? {}).map(([pid, v]) => [p(pid), v]));
    check(st.handicapSeats?.newTo === "couch" && same(kept(st, name), { alex: false, riley: false, jordan: false, sam: true }),
      `Episode 6 through the season sync (${X.name} and ${goner.name} out, ${star.name}'s immunity, alex's): the lineup game started, who's new kept (sam)`, JSON.stringify(st.handicapSeats));
    // Each one's own points, without the handicap (the engine on a copy with no history), against the Games tab's.
    const plainOf = (s) => {
      const c = structuredClone(s);
      delete c.seatHistory;
      delete c.handicapSeats;
      return Object.fromEntries(S.computeScores(c).map((x) => [name(x.playerId), x.total]));
    };
    const plain6 = plainOf(st);
    g = await gameIn("alex", L);
    const rows6 = Object.fromEntries((g?.table ?? []).map((t) => [name(t.playerId), [t.total, t.handicap]]));
    check(same(rows6, { alex: [plain6.alex, 0], riley: [plain6.riley, 0], jordan: [plain6.jordan, 0], sam: [round(plain6.sam + 5), 5] }) && g?.handicap?.kept === true,
      `  the Games tab: sam's row 5 points from it, in the total (${round(plain6.sam + 5)}); everyone else's own`, JSON.stringify({ rows6, plain6 }));
    const order = (g?.table ?? []).map((t) => t.total);
    check(order.every((x, i) => i === 0 || order[i - 1] >= x), "  the table ranked with it", JSON.stringify(order));
    const qs = await stateOf(Q);
    check(same(kept(qs, qName), { alex: false, riley: false, jordan: true, sam: true }), "  the pool started too: newcomers to Survivor kept (jordan and sam)", JSON.stringify(qs.handicapSeats));
    let qg = await gameIn("alex", Q);
    let qRows = Object.fromEntries((qg?.table ?? []).map((t) => [qName(t.playerId), [t.total, t.handicap]]));
    check(same(qRows, { alex: [1, 0], jordan: [3, 2], riley: [0, 0], sam: [2, 2] }),
      "  the pool's table from its walk: alex's and jordan's right call, jordan's and sam's 2 from the handicap", JSON.stringify(qRows));

    // ---------- the history changing mid-season ----------
    await pool.query("UPDATE leagues SET deleted_at = now() WHERE id = $1", [s50]);
    r = await lineupWrite("sam", 7);
    st = await stateOf(L);
    check(r.status === 200 && same(st.seatHistory?.[pids.alex], { couch: 1, show: 1 }) && same(kept(st, name), { alex: false, riley: false, jordan: false, sam: true }) && same(((await gameIn("alex", L))?.handicap?.newcomers ?? []).map(name), ["sam"]),
      "the Survivor 50 game deleted: the next write doesn't read the history again (everyone's kept), and what was kept at the start stands", JSON.stringify({ history: st.seatHistory?.[pids.alex], kept: st.handicapSeats }));

    // ---------- a late joiner ----------
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [couch, fx.users.casey]);
    await pool.query("UPDATE show_follows SET seen_through = 6 WHERE user_id = $1 AND season_id = $2", [fx.users.casey, sid]);
    r = await join("casey", Q);
    const qp2 = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [Q, fx.users.casey])).rows[0]?.player_id;
    qp.casey = qp2;
    check(r.status === 200 && !!qp2, "casey joins the pool on the couch after its start, from Episode 7", JSON.stringify(r.body).slice(0, 300));
    const seven = [];
    st = await stateOf(Q);
    const left = st.castaways.filter((c) => c.status !== "eliminated");
    const boot7 = left.find((c) => c.name !== star.name && c.name !== P.name) ?? left[0];
    for (const [who, c] of [["alex", boot7], ["jordan", P], ["riley", P], ["sam", boot7], ["casey", boot7]]) seven.push((await ask(who, { answers: { boot: c.id } })).status);
    check(seven.every((x) => x === 200), `  Episode 7's answers: alex, sam and casey ${boot7.name}, jordan and riley ${P.name}`, JSON.stringify(seven));

    // ---------- Episode 7 ----------
    await airs(7);
    await decide(7, "elimination", boot7.name);
    await decide(7, "event", star.name, "individualImmunity");
    for (const who of [...WHO, "casey"]) await seen(who, 7);
    const q7 = await stateOf(Q);
    check(q7.handicapSeats?.seats?.[qp.casey] === true && q7.handicapSeats?.from?.[qp.casey] === undefined, `Episode 7 through the season sync (${boot7.name} out): casey kept as new to the pool (no Survivor game on the couch before), from their own start`, JSON.stringify(q7.handicapSeats));
    check(same(q7.seatHistory?.[qp.alex], { couch: 0, show: 0 }) && q7.handicapSeats?.seats?.[qp.alex] === false,
      "  read again for casey: alex's history now nothing (the Survivor 50 game deleted), but alex kept as not new", JSON.stringify({ history: q7.seatHistory?.[qp.alex], kept: q7.handicapSeats }));
    qg = await gameIn("alex", Q);
    qRows = Object.fromEntries((qg?.table ?? []).map((t) => [qName(t.playerId), [t.total, t.handicap]]));
    check(same(qRows, { alex: [2, 0], jordan: [5, 4], riley: [0, 0], sam: [5, 4], casey: [3, 2] }),
      "  the pool's table: jordan's and sam's 4 from the handicap, casey's 2 (from Episode 7, their start)", JSON.stringify(qRows));
    st = await stateOf(L);
    const plain7 = plainOf(st);
    g = await gameIn("alex", L);
    const rows7 = Object.fromEntries((g?.table ?? []).map((t) => [name(t.playerId), [t.total, t.handicap]]));
    check(same(rows7.sam, [round(plain7.sam + 10), 10]) && rows7.alex[1] === 0 && g?.over === true,
      `  the lineup game: sam's 10 from it (two episodes), in the total; over (its span's end)`, JSON.stringify({ rows7, plain7 }));
    const hub = (await as.jordan.call("GET", `/api/couches/${couch}/hub`)).body;
    const plaque = (hub.trophies?.plaques ?? []).find((x) => x.leagueId === L);
    const first = (g?.table ?? []).filter((t) => t.place === 1).map((t) => name(t.playerId)).sort();
    check(!!plaque && same(plaque.winners.map((x) => whoIs(x.userId)).sort(), first), `the hub as jordan reads it: the lineup game's plaque its winners with the handicap in (${first.join(", ")})`, JSON.stringify(plaque));
    const mine = (hub.games ?? []).find((x) => x.leagueId === Q);
    check(!!mine && mine.rank !== null, "  and the pool among jordan's games, placed", JSON.stringify(mine));
  } catch (e) {
    out.fail();
    console.log("FAIL  threw:", e && e.stack ? e.stack : e);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(out.failures() ? `${out.failures()} failed` : "ALL PASS");
    process.exit(out.failures() ? 1 : 0);
  }
})();
