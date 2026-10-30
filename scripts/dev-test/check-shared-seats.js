// Dev-only check of a team two people share (docs/PLAN-start-a-game-gpt.md step A10 part 4b: game-spec schema.js extras.seats,
// settings.js seatPeople; db/migrations/0202's seat_slot and seat_moves; the server's shared-seats.ts, join-league.ts's share
// path, the invites route, freeSeat and the leave route, restoreMember, catchingUpMark and the reveal's lowest mark, couch-hub.ts
// crediting each person) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch
// (alex runs ZT Lineup, a Weekly Lineup on ZT Survivor 51 with results through Episode 5; riley, jordan and sam play it; casey,
// the fixture's fifth person, is on another couch). In order:
//   - before the game shares its teams: riley can't invite casey onto her seat (409: it belongs to someone).
//   - sharing turned on (extras.seats { people: 2 }, written into the game as the engine writes a spec: there's no screen for it
//     yet): jordan can't invite anyone onto riley's seat (403); riley invites casey onto it; casey accepts and shares it (seat_slot
//     1; the seat keeps its name, team and history; casey's mark starts where she is on the season, never past the latest
//     results); nobody else can join it (409: full).
//   - either acts for it: casey sets riley's seat's lineup for Episode 6, then riley sets another: the last one counts, who made
//     it recorded (seat_moves), no Recent changes line for either; casey can't set jordan's (403).
//   - the couch: riley and casey each credited with the team's place, one team in the field (couch-hub.ts).
//   - leaving: casey leaves (classic's leave): the seat stays riley's, playing; casey is invited back and shares it again; riley
//     leaves: the seat stays casey's, with its name; casey still sets its lineup.
//   - taken out and put back: casey invites riley back onto the team (she's on it now), riley taking the free seat_slot 0; alex
//     takes riley out (Members & roles): the seat stays casey's, playing, its Undo saying the team stayed with someone; Undo puts
//     riley back on it, beside casey.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-shared-seats.js [--keep]
//
// One fixed scenario on purpose, run again whenever shared seats change. Brings new-fixture.js up and takes it down (--keep leaves
// it; its down takes ZT Lineup, the invites, casey's follow and every seat_moves row with the zt rows); touches zt rows only;
// refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL,
// then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-shared-seats runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const WHO = ["alex", "riley", "jordan", "sam", "casey"];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const L = fx.leagues.lineup;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const members = async () => (await pool.query("SELECT user_id, player_id, seat_slot, results_seen_through FROM league_memberships WHERE league_id = $1 ORDER BY seat_slot", [L])).rows;
    const seatOf = async (who) => (await members()).find((m) => m.user_id === fx.users[who])?.player_id ?? null;
    const RILEY = await seatOf("riley");
    const JORDAN = await seatOf("jordan");
    let st = await league();
    const ep6 = st.episodes.find((e) => e.number === 6);
    check(!!RILEY && !!JORDAN && !!ep6 && S.getLeagueType(st).id === "active-roster", "ZT Lineup: a Weekly Lineup with riley's and jordan's seats and Episode 6 to play");
    const invite = (who, playerId, identifier = "zt_nd_casey") => as[who].call("POST", `/api/leagues/${L}/invites`, { identifier, playerId });
    const accept = async (who, inviteId) => as[who].call("POST", `/api/invites/${inviteId}/accept`);
    const changes = async () => Number((await pool.query("SELECT count(*) FROM league_changes WHERE league_id = $1", [L])).rows[0].count);

    // ---------- before the game shares its teams ----------
    let r = await invite("riley", RILEY);
    check(r.status === 409 && /already belongs to someone/.test(errorOf(r)), "not sharing: riley can't invite casey onto her seat (409)", `${r.status} ${errorOf(r)}`);

    // ---------- sharing on: up to two a team ----------
    st = await league();
    const problems = S.setGame(st, { ...S.gameOf(st), extras: { ...S.gameOf(st).extras, seats: { people: 2 } } });
    if (specsOn) GameSpecs.carryGame(st.settings, true);
    await write(st);
    check(!problems.length && st.settings.seatPeople === 2 && G.seatPeople(S.gameOf(st)) === 2, "sharing on: settings.seatPeople 2, the game's spec says it", JSON.stringify(problems));
    r = await invite("jordan", RILEY);
    check(r.status === 403, "jordan can't invite anyone onto riley's team (403)", `${r.status} ${errorOf(r)}`);
    // casey follows the season through Episode 4: her mark on the team starts there, not at the latest results (5).
    const season = fx.seasonId;
    await pool.query(
      `INSERT INTO show_follows (user_id, season_id, following, seen_through) VALUES ($1, $2, true, 4)
       ON CONFLICT (user_id, season_id) DO UPDATE SET following = true, seen_through = 4`,
      [fx.users.casey, season]
    );
    r = await invite("riley", RILEY);
    check(r.status === 200 && r.body.invite?.player_id === RILEY, "riley invites casey onto her team", `${r.status} ${errorOf(r)}`);
    r = await accept("casey", r.body.invite?.id);
    let ms = await members();
    const casey = ms.find((m) => m.user_id === fx.users.casey);
    st = await league();
    check(r.status === 200 && r.body.shared === true && casey?.player_id === RILEY && casey?.seat_slot === 1, "casey accepts: she shares riley's seat (seat_slot 1)", `${r.status} ${JSON.stringify(r.body)} ${JSON.stringify(casey)}`);
    check(S.getPlayer(st, RILEY)?.name === "riley" && st.players.length === 4, "  the seat keeps its name; no new seat", JSON.stringify(st.players.map((p) => p.name)));
    check(casey?.results_seen_through === 4, "  casey's mark: where she is on the season (4), not the latest results (5)", JSON.stringify(casey));
    r = await invite("alex", RILEY, "zt_nd_nobody_yet");
    check(r.status === 409 && /full/.test(errorOf(r)), "  nobody else can join it: the team's full (409)", `${r.status} ${errorOf(r)}`);
    const onCouch = (await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [fx.couchId, fx.users.casey])).rows.length;
    check(onCouch === 1, "  casey is on the couch now");

    // ---------- either acts for it ----------
    const team = S.Core.ownedCastawayIds(st, RILEY).filter((id) => S.getCastaway(st, id)?.status === "active");
    const slots = S.ActiveRosterLogic.activeSlots(st);
    const first = team.slice(0, slots);
    const second = team.slice(team.length - slots);
    const before = await changes();
    r = await as.casey.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${RILEY}`, { castawayIds: first });
    check(r.status === 200, "casey sets the team's lineup for Episode 6", `${r.status} ${errorOf(r)}`);
    let mv = (await pool.query("SELECT user_id FROM seat_moves WHERE league_id = $1 AND player_id = $2 AND kind = 'lineup' AND episode_id = $3", [L, RILEY, ep6.id])).rows;
    check(mv.length === 1 && mv[0].user_id === fx.users.casey, "  who made it recorded: casey (seat_moves)", JSON.stringify(mv));
    r = await as.riley.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${RILEY}`, { castawayIds: second });
    st = await league();
    const setIds = S.ActiveRosterLogic.lineupFor(st, ep6.id, RILEY);
    check(r.status === 200 && G.sameValue([...setIds].sort(), [...second].sort()), "riley sets another: the last one counts", `${r.status} ${errorOf(r)} ${JSON.stringify(setIds)}`);
    mv = (await pool.query("SELECT user_id FROM seat_moves WHERE league_id = $1 AND player_id = $2 AND kind = 'lineup' AND episode_id = $3", [L, RILEY, ep6.id])).rows;
    check(mv.length === 1 && mv[0].user_id === fx.users.riley, "  who made it now: riley", JSON.stringify(mv));
    check((await changes()) === before, "  neither is a Recent changes line (their own team's move)");
    r = await as.casey.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${JORDAN}`, { castawayIds: S.Core.ownedCastawayIds(st, JORDAN).slice(0, slots) });
    check(r.status === 403, "casey can't set jordan's lineup (403)", `${r.status} ${errorOf(r)}`);
    mv = (await pool.query("SELECT count(*) FROM seat_moves WHERE league_id = $1 AND player_id <> $2", [L, RILEY])).rows;
    check(Number(mv[0].count) === 0, "  and nothing is recorded for a team nobody shares");

    // ---------- the couch: each credited, one team in the field ----------
    r = await as.alex.call("GET", `/api/couches/${fx.couchId}/hub`);
    const rank = (who) => (r.body.rankings?.all || []).find((x) => x.userId === fx.users[who]);
    check(r.status === 200 && rank("casey")?.games === 1 && rank("riley")?.games >= 1, "the couch: casey credited with the team's game (one game: ZT Lineup)", `${r.status} ${JSON.stringify(r.body.rankings?.all?.map((x) => [x.name, x.games, x.total]))}`);
    const lineupPts = (who) => (rank(who)?.byShow || []).reduce((n, s) => n + s.points, 0);
    // Four teams in the field, not five rows: a place there is worth 10, 7, 4 or 1 (five rows would make it 10, 8, 6, 3 or 1).
    check(st.players.length === 4 && rank("casey") && rank("casey").total === lineupPts("casey") && [10, 7, 4, 1].includes(rank("casey").total), "  her points are the team's place among four teams", JSON.stringify(rank("casey")));
    r = await as.casey.call("GET", `/api/couches/${fx.couchId}/hub`);
    check(r.status === 200 && (r.body.you?.games ?? r.body.you?.played ?? 1) !== 0, "  casey's own hub reads", `${r.status}`);

    // ---------- leaving ----------
    r = await as.casey.call("POST", `/api/leagues/${L}/leave`);
    st = await league();
    ms = await members();
    check(r.status === 200 && !S.getPlayer(st, RILEY)?.disabled && ms.filter((m) => m.player_id === RILEY).length === 1, "casey leaves: the seat stays riley's, playing", `${r.status} ${JSON.stringify(ms)}`);
    r = await invite("riley", RILEY);
    r = r.status === 200 ? await accept("casey", r.body.invite?.id) : r;
    check(r.status === 200 && r.body.shared === true, "riley invites her back: she shares it again", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.riley.call("POST", `/api/leagues/${L}/leave`);
    st = await league();
    ms = await members();
    check(r.status === 200 && !S.getPlayer(st, RILEY)?.disabled && S.getPlayer(st, RILEY)?.name === "riley" && ms.filter((m) => m.player_id === RILEY).map((m) => m.user_id).join() === fx.users.casey, "riley leaves: the seat stays casey's, with its name", `${r.status} ${JSON.stringify(ms)}`);
    r = await as.casey.call("PUT", `/api/leagues/${L}/episodes/${ep6.id}/lineups/${RILEY}`, { castawayIds: first });
    check(r.status === 200, "  casey still sets its lineup", `${r.status} ${errorOf(r)}`);

    // ---------- taken out and put back ----------
    // riley back on her team (casey invites her: she's on it), then alex takes riley out: the seat stays casey's; Undo puts riley back.
    r = await invite("casey", RILEY, "zt_nd_riley");
    r = r.status === 200 ? await accept("riley", r.body.invite?.id) : r;
    ms = await members();
    check(r.status === 200 && r.body.shared === true && ms.find((m) => m.user_id === fx.users.riley)?.seat_slot === 0, "casey invites riley back onto it: riley takes the free seat_slot 0", `${r.status} ${JSON.stringify(r.body)} ${JSON.stringify(ms)}`);
    r = await as.alex.call("POST", `/api/seasons/${fx.seasonId}/backstage/members/${fx.users.riley}/remove?couch=${fx.couchId}`, {});
    st = await league();
    ms = await members();
    const out = ms.filter((m) => m.player_id === RILEY).map((m) => m.user_id);
    check(r.status === 200 && !!r.body.batch && !S.getPlayer(st, RILEY)?.disabled && out.join() === fx.users.casey, "alex takes riley out of the games: her team stays casey's, playing", `${r.status} ${JSON.stringify(r.body)} ${JSON.stringify(out)}`);
    const line = (await pool.query("SELECT undo FROM league_changes WHERE league_id = $1 AND batch = $2", [L, r.body.batch])).rows[0];
    check(line?.undo?.shared === true && line?.undo?.removed === false, "  its line's Undo says the team stayed with someone (shared)", JSON.stringify(line?.undo));
    r = await as.alex.call("POST", `/api/seasons/${fx.seasonId}/changes/${r.body.batch}/undo?couch=${fx.couchId}`, {});
    ms = await members();
    st = await league();
    const back = ms.find((m) => m.user_id === fx.users.riley);
    check(r.status === 200 && back?.player_id === RILEY && back?.seat_slot === 0 && ms.filter((m) => m.player_id === RILEY).length === 2 && st.players.length === 4, "  Undo puts riley back on it, beside casey", `${r.status} ${errorOf(r)} ${JSON.stringify(ms)}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exit(failures ? 1 : 0);
})();
