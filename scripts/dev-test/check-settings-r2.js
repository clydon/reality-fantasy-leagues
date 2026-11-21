// Settings Round 2's server half (docs/PLAN-settings-overhaul.md, Round 2; docs/design-round/settings-r2-spec.md), through the real
// routes as the zt_nd couch's people:
//   - When results show on one season (A7: show_follows.results): riley's The Traitors 5, "now" lets everything out (the space read's
//     mark is null) whatever the account says, "wait" holds it to the follow's mark even when the account says straight away, null
//     goes back to the account's; refused values; the space read says which.
//   - A new follow of a season still airing starts at Ask (When a new episode airs' Recommended); an existing follow keeps its own.
//   - Mute until the next episode (the user's pick on Round 1's story): it ends when Survivor 51's next episode starts, and Undo
//     (muteUntil) puts it back.
//   - Leave one game (A11): the preview names only that game; leaving takes jordan out of it and leaves his other games here.
//   - Which couch the hub shows, for the account (C25): saved and read back by the home read; a couch you're not on is refused.
// Needs: the app (BASE in .env.local; in the settings lane, `node scripts/lane.js dev settings`). Brings new-fixture up and takes it
// down after unless --keep. zt_nd_ rows only; refuses a non-local database. Shares the zt_nd couch: never run beside another check
// on it.
// Run:   node scripts/dev-test/check-settings-r2.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-settings-r2 runs against a local database only");
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
    const S = fx.seasonId, T = fx.traitorsSeasonId;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const space = async (who, season, couch = fx.couchId) => (await as[who].call("GET", `/api/seasons/${season}/space?couch=${couch}`)).body;

    // ---- When results show on one season (A7) ----
    const r0 = await space("riley", T);
    check(r0.you?.results === null && r0.you?.seenThrough === 2, "riley's Traitors: no choice of its own, held to his mark (Ep 2)", JSON.stringify(r0.you));
    const now = await as.riley.call("PUT", `/api/me/follows/${T}`, { results: "now" });
    const r1 = await space("riley", T);
    check(now.status === 200 && now.body.results === "now" && r1.you.results === "now" && r1.you.seenThrough === null, "results now on this season: everything shows here", JSON.stringify(r1.you));
    const s1 = await space("riley", S);
    check(Number.isInteger(s1.you.seenThrough), "…and only here: Survivor still goes by his mark", JSON.stringify(s1.you));
    await as.riley.call("PUT", "/api/me/profile", { hideScores: false });
    await as.riley.call("PUT", `/api/me/follows/${T}`, { results: "wait" });
    const r2 = await space("riley", T);
    check(r2.you.results === "wait" && r2.you.seenThrough === 2, "results wait here beats an account set to straight away", JSON.stringify(r2.you));
    await as.riley.call("PUT", `/api/me/follows/${T}`, { results: null });
    const r3 = await space("riley", T);
    check(r3.you.results === null && r3.you.seenThrough === null, "back to the default: the account's straight away", JSON.stringify(r3.you));
    await as.riley.call("PUT", "/api/me/profile", { hideScores: true });
    check((await as.riley.call("PUT", `/api/me/follows/${T}`, { results: "sometimes" })).status === 400, "a results value that isn't wait, now or null: 400");

    // ---- A new follow of an airing season starts at Ask ----
    await pool.query("DELETE FROM show_follows WHERE user_id = $1 AND season_id = $2", [fx.users.casey, T]);
    const c1 = await as.casey.call("PUT", `/api/me/follows/${T}`, { following: true, seenThrough: 1 });
    check(c1.status === 200 && c1.body.keepUp === "ask", "casey's new follow of The Traitors (airing): When a new episode airs starts at Ask", JSON.stringify(c1.body));
    await as.casey.call("PUT", `/api/me/follows/${T}`, { keepUp: "off" });
    const c2 = await as.casey.call("PUT", `/api/me/follows/${T}`, { following: true, seenThrough: 2 });
    check(c2.body.keepUp === "off", "an existing follow keeps its own choice", JSON.stringify(c2.body));

    // ---- Mute until the next episode ----
    const m1 = await as.jordan.call("PUT", `/api/seasons/${S}/notifications`, { mute: "next" });
    const until = m1.body?.muted ? Date.parse(m1.body.muted) : NaN;
    check(m1.status === 200 && until > Date.now() + 2 * 86400000 && until < Date.now() + 4 * 86400000, "muted until the next episode: Survivor's Ep 6, about 3 days off", `${m1.status} ${JSON.stringify(m1.body?.muted)}`);
    const m2 = await as.jordan.call("PUT", `/api/seasons/${S}/notifications`, { muteUntil: null });
    check(m2.status === 200 && m2.body.muted === null, "Undo puts it back (not muted)");
    check((await as.jordan.call("PUT", `/api/seasons/${S}/notifications`, { mute: "fortnight" })).status === 400, "a mute that isn't next, day, week or forever: 400");

    // ---- Leave one game (A11) ----
    const lineupName = (await pool.query("SELECT name FROM leagues WHERE id = $1", [fx.leagues.lineup])).rows[0].name;
    const p = await as.jordan.call("POST", `/api/seasons/${S}/leave?couch=${fx.couchId}&league=${fx.leagues.lineup}`, { preview: true });
    check(p.status === 200 && p.body.games?.length === 1 && p.body.games[0] === lineupName, `the preview names only ${lineupName}`, JSON.stringify(p.body));
    const before = (await pool.query("SELECT league_id FROM league_memberships WHERE user_id = $1", [fx.users.jordan])).rows.map((r) => r.league_id);
    const l = await as.jordan.call("POST", `/api/seasons/${S}/leave?couch=${fx.couchId}&league=${fx.leagues.lineup}`, {});
    const after = (await pool.query("SELECT league_id FROM league_memberships WHERE user_id = $1", [fx.users.jordan])).rows.map((r) => r.league_id);
    check(l.status === 200 && !after.includes(fx.leagues.lineup) && after.length === before.length - 1, "leaving takes him out of that game alone", `${l.status} ${before.length} → ${after.length}`);

    // ---- Which couch the hub shows, for the account (C25) ----
    const h1 = await as.alex.call("PUT", "/api/me/profile", { hubCouch: fx.extraCouchId });
    const home = (await as.alex.call("GET", "/api/me/home")).body;
    check(h1.status === 200 && home.user?.hubCouch === fx.extraCouchId, "alex's hub couch, saved for his account and read back", `${h1.status} ${home.user?.hubCouch}`);
    const other = (await pool.query("SELECT id FROM couches WHERE id <> ALL($1::uuid[]) LIMIT 1", [[fx.couchId, fx.extraCouchId]])).rows[0];
    if (other) check((await as.alex.call("PUT", "/api/me/profile", { hubCouch: other.id })).status === 403, "a couch he isn't on: 403");
    check((await as.alex.call("PUT", "/api/me/profile", { hubCouch: "nope" })).status === 400, "not a couch: 400");
  } catch (e) {
    failures++;
    console.log(`FAIL  ${e.stack || e.message}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`(down: ${e.message})`));
    await pool.end();
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})();
