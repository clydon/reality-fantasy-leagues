// Settings Round 3a's server half (docs/PLAN-settings-overhaul.md, Round 3; docs/design-round/settings-r3-spec.md), through the real
// routes as the zt_nd couch's people:
//   - Rename a game (A13): the Commissioner's, trimmed, 40 characters at most, a line in Recent changes; a Helper or a player is
//     refused; an empty name is refused.
//   - Remove someone from one game (A14): the preview names only that game; taking sam out of Pool Party leaves him in his other
//     games here and on the couch; a Helper can't; the last Commissioner can't be taken out; Undo (Recent changes) brings him back.
//   - Waivers' line in Start a game's words (the round's word table): "When your team is short", a feel named Relaxed, Standard
//     or Strict.
// Needs: the app (BASE in .env.local; in the settings lane, `node scripts/lane.js dev settings`). Brings new-fixture up and takes it
// down after unless --keep. zt_nd_ rows only; refuses a non-local database. Shares the zt_nd couch: never run beside another check
// on it.
// Run:   node scripts/dev-test/check-settings-r3.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-settings-r3 runs against a local database only");
const keep = process.argv.includes("--keep");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const S = fx.seasonId, L = fx.leagues, couch = fx.couchId;
    const as = {};
    for (const who of ["alex", "riley", "jordan"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const nameOf = async (id) => (await pool.query("SELECT name FROM leagues WHERE id = $1", [id])).rows[0]?.name;
    const memberOf = async (league, user) => (await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [league, user])).rows.length > 0;

    // ---- Rename (A13) ----
    const was = await nameOf(L.lineup);
    const r1 = await as.alex.call("PATCH", `/api/leagues/${L.lineup}`, { name: "  The   Tuesday League " });
    check(r1.status === 200 && (await nameOf(L.lineup)) === "The Tuesday League", "alex renames Lineup League: trimmed, spaces squeezed", `${r1.status} ${await nameOf(L.lineup)}`);
    const line = (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at DESC LIMIT 1", [L.lineup]).catch(() => ({ rows: [] }))).rows[0]?.text ?? "";
    check(/Renamed the game The Tuesday League/.test(line), "…with a line in Recent changes", line);
    check((await as.alex.call("PATCH", `/api/leagues/${L.lineup}`, { name: "x".repeat(41) })).status === 400, "a name over 40 characters: 400");
    check((await as.alex.call("PATCH", `/api/leagues/${L.lineup}`, { name: "   " })).status === 400, "an empty name: 400");
    check((await as.riley.call("PATCH", `/api/leagues/${L.lineup}`, { name: "Riley's League" })).status === 403, "riley, a Helper, can't rename it: 403");
    check((await as.jordan.call("PATCH", `/api/leagues/${L.lineup}`, { name: "Jordan's League" })).status === 403, "jordan, a player, can't: 403");
    await as.alex.call("PATCH", `/api/leagues/${L.lineup}`, { name: was });
    check((await nameOf(L.lineup)) === was, "…and back (the toast's Undo is the same route)");

    // ---- Remove from one game (A14) ----
    const remove = (who, user, league, preview) => as[who].call("POST", `/api/seasons/${S}/backstage/members/${user}/remove?couch=${couch}`, { preview, league });
    const pv = await remove("alex", fx.users.sam, L.pool, true);
    check(pv.status === 200 && pv.body.games?.length === 1 && pv.body.batch === null, "the preview names only Pool Party", JSON.stringify(pv.body));
    check((await remove("riley", fx.users.sam, L.lineup, true)).status === 403, "riley, a Helper, can't take anyone out: 403");
    const out = await remove("alex", fx.users.sam, L.pool, false);
    check(out.status === 200 && !!out.body.batch, "alex takes sam out of Pool Party", JSON.stringify(out.body));
    check(!(await memberOf(L.pool, fx.users.sam)), "…sam is out of Pool Party");
    check((await memberOf(L.lineup, fx.users.sam)) && (await memberOf(L.outlast, fx.users.sam)), "…and still in Lineup League and Couch Cup");
    const onCouch = (await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couch, fx.users.sam])).rows.length > 0;
    check(onCouch, "…and still on the couch");
    const undo = await as.alex.call("POST", `/api/seasons/${S}/changes/${out.body.batch}/undo?couch=${couch}`);
    check(undo.status === 200 && (await memberOf(L.pool, fx.users.sam)), "Undo brings him back into Pool Party", `${undo.status} ${JSON.stringify(undo.body).slice(0, 160)}`);
    const self = await remove("alex", fx.users.alex, L.pool, false);
    check(self.status === 400, "taking yourself out here is refused (you leave from the game's ⋯)", `${self.status}`);

    // ---- Waivers' words ----
    const wv = await as.alex.call("GET", `/api/seasons/${S}/backstage/waivers?couch=${couch}`);
    const summaries = (wv.body?.games ?? []).map((g) => g.summary).join(" | ");
    check(wv.status === 200 && !/Replace right away|Only when short|Wait for a waiver window|Balanced|Casual|Competitive/.test(summaries), "Waivers' lines use Start a game's words", summaries);
  } catch (e) {
    console.log(`FAIL  the check stopped: ${e.stack || e.message}`);
    failures++;
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`(down: ${e.message})`));
    await pool.end();
    console.log(failures ? `${failures} FAILED` : "ALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
