// Dev-only test bank: episode night while moves stay open after airtime (docs/design-round/strip-night-spec.md; the user's report
// from Survivor 51's Ep 9 night, 2026-11-18: "Locked for Ep 9" on a live game they hadn't watched). new-fixture.js's zt couch
// (ZT Survivor 51: Couch Cup, an Outlast; Lineup League; Pool Party, a survival pool; linked; alex runs them; results through Ep 5)
// with jordan, the viewer, through Ep 5 and Ep 6 put where the night is:
//   --phase=onair     Ep 6 started six minutes ago: on air now (90 minutes)                                      [default]
//           aired     Ep 6 ended ten minutes ago, no results yet
//           results   Ep 6's results in (who went home), jordan hasn't revealed it
//           watched   Ep 6's results in and jordan revealed it through the real route: Ep 7 is next week's
//   --moves=set       jordan's Ep 6 lineup saved and their pool pick made, before it aired                          [default]
//           carried   jordan's lineup carries in from Ep 5 (nothing saved for 6), no pool pick
//           kept      jordan's lineup carries in from Ep 5, their pool pick made (today's server still calls the lineup due)
//           gap       jordan's Ep 6 lineup saved a starter short, no pool pick
//   --pace=live       every game live: a move stays open until you've watched it or the next one airs              [default]
//          strict     every game At airtime
//          mixed      Lineup League At airtime, the pool live
//   --owed            jordan still owes Couch Cup a replacement (Ana); by default their claim is in, so nothing's due there
//   --extra=N         N more games on the couch for jordan (up to 6, not linked: new-fixture.js moreGames), in turn a Weekly Lineup,
//                     a survival pool and an Outlast: Blindside Lineup, Last One Standing, Fire Tokens Cup, The Tribe Has Spoken,
//                     Snuff Pool, Merge Madness (a couch with more going on than three games: the night's density check)
//   --extra-moves=set their lineups saved and picks made, any replacement claimed                                    [default]
//                 gap their lineups a starter short, no picks, replacements owed
// jordan's moves go through the real routes while Ep 6 is still three days off (as new-fixture.js leaves it); then the season's
// schedule moves so Ep 6 starts when --phase says (today, in the season's own zone), and the pace is set in each league's state as
// the Commissioner's setting stores it (settings.lockAtAir). Prints what jordan's games and the home's moves say at the end.
//
//   npm run dev   (the app on :3000; BASE= for another)
//   node scripts/dev-test/night-fixture.js up [--phase=onair] [--moves=set] [--pace=live] [--owed] [--extra=N] [--extra-moves=set] [--art]
//   node scripts/dev-test/night-fixture.js down
// Also a module: `const night = require("./night-fixture"); const ids = await night.up(pool, { phase, moves, pace, owed, extra,
// extraMoves, art })` resolves new-fixture's ids plus { viewer: "jordan", episode: 6, more: [the extra games' ids] };
// `await night.down(pool)` is new-fixture's down. Keyed on new-fixture's
// zt-nd- slugs and zt_nd_ usernames; refuses a non-local database. It IS new-fixture's zt_nd_ couch: never run it beside another
// check that uses that couch. Used by story-strip-night.js.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const NF = require("./new-fixture");
const { api } = require("./browser");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
const EP = 6;
// Minutes before now that Ep 6 started, per phase (its runtime is new-fixture's 90).
const STARTED = { onair: 6, aired: 100, results: 150, watched: 150 };
// Ep 6's boot in new-fixture's cast order (the sixth listed goes home sixth).
const BOOT = "Cristian Chavez";
// --extra's games, in the order they're added: each type in turn, one name long enough to test a card's head.
const EXTRA = [
  ["zt-nd-xblind", "Blindside Lineup", "active-roster"],
  ["zt-nd-xlast", "Last One Standing", "pickem"],
  ["zt-nd-xfire", "Fire Tokens Cup", "classic-draft"],
  ["zt-nd-xtribe", "The Tribe Has Spoken", "active-roster"],
  ["zt-nd-xsnuff", "Snuff Pool", "pickem"],
  ["zt-nd-xmerge", "Merge Madness", "classic-draft"],
];
const PLAYERS = ["alex", "riley", "jordan", "sam"];

async function up(pool, { phase = "onair", moves = "set", pace = "live", owed = false, extra = 0, extraMoves = "set", art = false } = {}) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("night-fixture runs against a local database only");
  if (!(phase in STARTED)) throw new Error(`--phase: one of ${Object.keys(STARTED).join(", ")}`);
  if (!["set", "carried", "kept", "gap"].includes(moves)) throw new Error("--moves: set, carried, kept or gap");
  if (!["live", "strict", "mixed"].includes(pace)) throw new Error("--pace: live, strict or mixed");
  if (!(Number.isInteger(extra) && extra >= 0 && extra <= EXTRA.length)) throw new Error(`--extra: 0 to ${EXTRA.length}`);
  if (!["set", "gap"].includes(extraMoves)) throw new Error("--extra-moves: set or gap");
  const ids = await NF.up(pool, { art });
  const sid = ids.seasonId;
  const couch = ids.couchId;
  const L = ids.leagues;
  // The extra games: everyone on each, jordan's seat moving along so their teams differ (the demo deals by seat); alex runs them.
  const more = extra
    ? await NF.moreGames(pool, EXTRA.slice(0, extra).map(([slug, name, type], i) => ({ slug, name, type, players: [...PLAYERS.slice(i % 4), ...PLAYERS.slice(0, i % 4)], commissioner: "alex" })))
    : [];
  const typeOf = new Map(EXTRA.slice(0, extra).map(([, , type], i) => [more[i], type]));
  const jordan = await api({ user: NF.username("jordan"), pass: NF.PASSWORD });
  const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
  const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
  const pid = async (id) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, ids.users.jordan])).rows[0].player_id;

  // Nothing of jordan's for Ep 6 yet (the demo season sets some): what follows is the whole of it.
  for (const id of [L.lineup, L.pool, ...more.filter((x) => typeOf.get(x) !== "classic-draft")]) {
    const me = await pid(id);
    const st = await stateOf(id);
    const ep = st.episodes.find((e) => e.number === EP);
    if (ep?.lineups) delete ep.lineups[me];
    if (ep?.picks) ep.picks = ep.picks.filter((p) => p.playerId !== me);
    await write(id, st);
  }

  // jordan's Ep 6 moves through the real routes, three days before it airs.
  const games = async () => (await jordan.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? [];
  const before = await games();
  const gameOf = (id) => before.find((g) => g.leagueId === id);
  // A lineup saved whole, or a starter short (`short`).
  const setLineup = async (id, short) => {
    const g = gameOf(id);
    const roster = g.lineup.roster.filter((c) => !g.cast.find((x) => x.id === c)?.left);
    const starters = roster.slice(0, short ? g.lineup.need - 1 : g.lineup.need);
    const r = await jordan.call("PUT", `/api/leagues/${id}/episodes/${encodeURIComponent(g.lineup.epId)}/lineups/${encodeURIComponent(await pid(id))}`, { castawayIds: starters });
    if (r.status !== 200) throw new Error(`jordan's Ep 6 lineup in ${g.name} wasn't saved: ${r.status} ${JSON.stringify(r.body)}`);
  };
  // A pick: the `k`th still to choose from, so two pools don't pick the same castaway.
  const setPick = async (id, k = 0) => {
    const g = gameOf(id);
    const r = await jordan.call("PUT", `/api/leagues/${id}/episodes/${encodeURIComponent(g.pick.epId)}/picks`, { playerId: await pid(id), castawayId: g.pick.available[k % g.pick.available.length] });
    if (r.status !== 200) throw new Error(`jordan's Ep 6 pick in ${g.name} wasn't made: ${r.status} ${JSON.stringify(r.body)}`);
  };
  // The demo season can owe jordan a replacement in an Outlast (in Couch Cup, Ana went home in Ep 3, its waiver week open): the claim
  // goes in through the real route, so nothing's owed there.
  const claim = async (id) => {
    const home = (await jordan.call("GET", "/api/me/home")).body;
    const due = (home.moves ?? []).find((m) => m.leagueId === id && m.kind === "pickup" && /\/claim\?drop=/.test(m.href));
    if (!due) return;
    const drop = decodeURIComponent(due.href.split("drop=")[1]);
    const cup = await stateOf(id);
    const meCup = await pid(id);
    const still = cup.castaways.filter((c) => c.status === "active");
    const add = (still.find((c) => !(c.ownerIds || []).length) ?? still.find((c) => !(c.ownerIds || []).includes(meCup)))?.id;
    const r = await jordan.call("PUT", `/api/leagues/${id}/waivers/claims`, { spot: { dropId: drop, addIds: [add] } });
    if (r.status !== 200) throw new Error(`jordan's claim in ${gameOf(id)?.name ?? id} wasn't taken: ${r.status} ${JSON.stringify(r.body)}`);
  };
  if (moves === "set" || moves === "gap") await setLineup(L.lineup, moves === "gap");
  if (moves === "set" || moves === "kept") await setPick(L.pool);
  // --owed keeps Couch Cup's due (the real couch's case after Survivor 51's Ep 8: every holder owed one).
  if (!owed) await claim(L.outlast);
  for (const [i, id] of more.entries()) {
    const type = typeOf.get(id);
    if (type === "active-roster") await setLineup(id, extraMoves === "gap");
    else if (type === "pickem" && extraMoves === "set") await setPick(id, i + 1);
    else if (type === "classic-draft" && extraMoves === "set") await claim(id);
  }

  // The pace, as Backstage stores it: At airtime is settings.lockAtAir; live stores nothing. The extra games follow --pace=strict.
  const strict = pace === "strict" ? [L.outlast, L.lineup, L.pool, ...more] : pace === "mixed" ? [L.lineup] : [];
  for (const id of strict) {
    const st = await stateOf(id);
    st.settings.lockAtAir = true;
    await write(id, st);
  }

  // Ep 6 starts when the phase says: every episode's air time is the season's time of day, weekly from the premiere.
  await pool.query(
    `UPDATE show_seasons
        SET air_time = to_char((now() - make_interval(mins => $2)) AT TIME ZONE air_tz, 'HH24:MI')::time,
            premiere_date = ((now() - make_interval(mins => $2)) AT TIME ZONE air_tz)::date - ($3 - 1) * 7
      WHERE id = $1`,
    [sid, STARTED[phase], EP]
  );

  if (phase === "results" || phase === "watched") {
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, EP, BOOT]
    );
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    await syncSeasonLeagues(sid, null);
  }
  if (phase === "watched") {
    const r = await jordan.call("POST", `/api/seasons/${sid}/reveal`, { episode: EP, couch });
    if (r.status !== 200) throw new Error(`jordan's reveal of Ep 6 failed: ${r.status} ${JSON.stringify(r.body)}`);
  }

  // What jordan now sees, in words: each game's move for the night and the home's moves.
  const after = await games();
  const home = (await jordan.call("GET", "/api/me/home")).body;
  const mine = new Set([...Object.values(L), ...more]);
  const summary = after.filter((g) => mine.has(g.leagueId)).map((g) => ({
    game: g.name,
    late: g.late,
    lineup: g.lineup && { episode: g.lineup.episode, set: g.lineup.set, carried: g.lineup.carried, locked: g.lineup.locked, starters: g.lineup.starters.length, need: g.lineup.need },
    pick: g.pick && { episode: g.pick.episode, open: g.pick.open, pick: !!g.pick.pick },
    revealFirst: g.revealFirst,
  }));
  const due = (home.moves ?? []).filter((m) => mine.has(m.leagueId)).map((m) => `${m.kind}${m.late ? " (late)" : ""} Ep ${m.episode ?? "?"}: ${m.text}`);
  console.log(`[night] up: phase ${phase}, moves ${moves}, pace ${pace}${owed ? ", a replacement owed" : ""}${extra ? `, ${extra} more games (${extraMoves})` : ""}; sign in as ${NF.username("jordan")} / ${NF.PASSWORD}`);
  for (const s of summary) console.log(`[night]   ${JSON.stringify(s)}`);
  console.log(`[night]   home moves: ${due.length ? due.join(" | ") : "none"}`);
  return { ...ids, viewer: "jordan", episode: EP, more, summary, due };
}

const down = (pool) => NF.down(pool);

module.exports = { up, down, EP };

if (require.main === module) {
  const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const pool = new Pool({ connectionString: DB });
  const cmd = process.argv[2];
  (cmd === "up"
    ? up(pool, { phase: arg("phase", "onair"), moves: arg("moves", "set"), pace: arg("pace", "live"), owed: process.argv.includes("--owed"), extra: Number(arg("extra", 0)), extraMoves: arg("extra-moves", "set"), art: process.argv.includes("--art") })
    : cmd === "down"
      ? down(pool).then(() => console.log("[night] down"))
      : Promise.reject(new Error("usage: up [--phase=onair|aired|results|watched] [--moves=set|carried|kept|gap] [--pace=live|strict|mixed] [--owed] [--extra=0-6] [--extra-moves=set|gap] [--art] | down")))
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      pool.end();
      process.exit(1);
    });
}
