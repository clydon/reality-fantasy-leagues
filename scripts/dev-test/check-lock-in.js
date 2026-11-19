// Dev-only test bank: the episode-night strip's Lock in as a real lock, and the carried rule (docs/design-round/strip-night-spec.md;
// the user's calls, 2026-11-19: build the lock; a full lineup carried in is set in the window). On night-fixture.js's zt couch
// (jordan one behind, Ep 6 on air or just aired, every game live), through the real routes on the running app:
//   1. the window's open: jordan's games say late 6; the home's moves list what's missing and nothing more (--moves=kept: the
//      lineup carried in full is set, so no lineup move; --moves=gap: the lineup a starter short is due);
//   2. POST /api/seasons/<id>/lock-in { episode: 6 }: every game of jordan's with Ep 6 open is locked in (the answer names them);
//   3. the games say watching 6 and no window, the lineup locked; the home lists none of Ep 6's moves; a lineup change is refused;
//   4. DELETE { episode: 6 } (the toast's Undo, within its minute): the window's back; a second DELETE is refused (nothing to undo);
//   5. lock in again; once more is refused (nothing open), as is an episode jordan has already watched (5).
// Prints PASS/FAIL lines and exits 1 on any FAIL. Takes the fixture down at the end unless --keep.
//
//   npm run dev   (the app on :3000; BASE= for another)
//   node scripts/dev-test/check-lock-in.js [--phase=onair|aired] [--moves=kept|gap|set] [--keep]
// zt_nd_ people only; refuses a non-local database (the fixture does). It IS new-fixture's couch: never beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const night = require("./night-fixture");
const NF = require("./new-fixture");
const { api } = require("./browser");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const phase = arg("phase", "onair");
const moves = arg("moves", "kept");
if (!["onair", "aired"].includes(phase)) throw new Error("--phase: onair or aired (the window before results)");
if (!["kept", "gap", "set"].includes(moves)) throw new Error("--moves: kept, gap or set");

let failed = 0;
const check = (ok, label) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
};

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    const ids = await night.up(pool, { phase, moves, pace: "live" });
    const n = ids.episode;
    const sid = ids.seasonId;
    const mine = new Set(Object.values(ids.leagues));
    const jordan = await api({ user: NF.username("jordan"), pass: NF.PASSWORD });
    const games = async () => ((await jordan.call("GET", `/api/seasons/${sid}/games?couch=${ids.couchId}`)).body.games ?? []).filter((g) => mine.has(g.leagueId));
    const homeMoves = async () => ((await jordan.call("GET", "/api/me/home")).body.moves ?? []).filter((m) => mine.has(m.leagueId) && m.episode === n);
    const lineupGame = (gs) => gs.find((g) => g.leagueId === ids.leagues.lineup);

    // 1. Open.
    const before = await games();
    const open = before.filter((g) => g.late?.episode === n);
    check(open.length > 0, `before: ${open.length} of jordan's games have Ep ${n} open (${open.map((g) => g.name).join(", ")})`);
    const due = await homeMoves();
    const lineupDue = due.some((m) => m.kind === "lineup" && m.leagueId === ids.leagues.lineup);
    if (moves === "kept") {
      check(lineupGame(before)?.lineup?.set && lineupGame(before)?.lineup?.carried, "kept: Lineup League's lineup is carried in full");
      check(!lineupDue, "kept: no lineup move due (a full lineup carried in is set)");
    } else if (moves === "gap") check(lineupDue, "gap: the lineup a starter short is due");
    else check(!due.length, "set: nothing due");

    // 2. Lock in.
    const locked = await jordan.call("POST", `/api/seasons/${sid}/lock-in`, { episode: n });
    check(locked.status === 200 && (locked.body.leagues ?? []).length === open.length, `lock in: ${locked.status}, ${(locked.body.leagues ?? []).length} games locked`);

    // 3. Closed, on the server.
    const after = await games();
    check(after.every((g) => g.late == null), "after: no game has a window");
    check(open.every((o) => after.find((g) => g.leagueId === o.leagueId)?.watching === n), `after: each game that was open says watching ${n}`);
    const lg = lineupGame(after);
    check(!!lg?.lineup && lg.lineup.episode === n && lg.lineup.locked, `after: Lineup League shows its Ep ${n} lineup, locked`);
    check(!(await homeMoves()).length, `after: the home lists none of Ep ${n}'s moves`);
    const pid = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [ids.leagues.lineup, ids.users.jordan])).rows[0].player_id;
    const roster = lg.lineup.roster.filter((c) => !lg.cast.find((x) => x.id === c)?.left);
    const change = await jordan.call("PUT", `/api/leagues/${ids.leagues.lineup}/episodes/${encodeURIComponent(lg.lineup.epId)}/lineups/${encodeURIComponent(pid)}`, { castawayIds: roster.slice(-lg.lineup.need) });
    check(change.status >= 400, `after: a lineup change for Ep ${n} is refused (${change.status} ${change.body?.error ?? ""})`);

    // 4. Undo, for a moment only.
    const undo = await jordan.call("DELETE", `/api/seasons/${sid}/lock-in`, { episode: n });
    check(undo.status === 200, `undo: ${undo.status}`);
    check((await games()).filter((g) => g.late?.episode === n).length === open.length, "undo: the window's back");
    const again = await jordan.call("DELETE", `/api/seasons/${sid}/lock-in`, { episode: n });
    check(again.status === 409, `undo again: refused (${again.status})`);

    // 5. Lock in again; then nothing's open.
    check((await jordan.call("POST", `/api/seasons/${sid}/lock-in`, { episode: n })).status === 200, "lock in again");
    check((await jordan.call("POST", `/api/seasons/${sid}/lock-in`, { episode: n })).status === 409, "once more: refused (nothing open)");
    check((await jordan.call("POST", `/api/seasons/${sid}/lock-in`, { episode: n - 1 })).status === 409, `Ep ${n - 1}, watched: refused`);
  } finally {
    if (!process.argv.includes("--keep")) await night.down(pool).catch((e) => console.log(`[down] ${e.message}`));
    await pool.end();
  }
  console.log(failed ? `${failed} failed` : "every check passes");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
