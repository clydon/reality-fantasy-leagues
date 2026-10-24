// The couch and progress backfills (db/migrations/0101_couches_backfill.sql, 0103_show_follows_backfill.sql),
// run for real: zt leagues, groups and people go into the local database inside a transaction, both files run
// (twice, to prove a second run changes nothing), and everything is rolled back, so nothing is left behind and
// no real league is touched. Run with `npm test`; skipped when the local database isn't there.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });
const { Pool } = require("pg");

const DB = process.env.AUTH_DATABASE_URL || "";
const LOCAL = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB);
const sql = (f) => fs.readFileSync(path.join(__dirname, "..", "db", "migrations", f), "utf8");
const COUCHES = sql("0101_couches_backfill.sql");
const FOLLOWS = sql("0103_show_follows_backfill.sql");

test("backfill: one couch per linked group, one per other league, everyone on it, progress per person", { skip: !LOCAL && "needs the local database" }, async (t) => {
  const pool = new Pool({ connectionString: DB });
  let c;
  try {
    c = await pool.connect();
  } catch (e) {
    await pool.end();
    return t.skip(`local database not reachable: ${e.code || e.message}`);
  }
  try {
    await c.query("BEGIN");
    const one = async (q, p) => (await c.query(q, p)).rows[0];
    const user = (name) =>
      one(`INSERT INTO "user" (id, name, email, "emailVerified", username, "createdAt", "updatedAt")
           VALUES ($1, $1, $1 || '@example.invalid', true, $1, now(), now()) RETURNING id`, [`zt_bf_${name}`]).then((r) => r.id);
    const [ann, bo, cy] = [await user("ann"), await user("bo"), await user("cy")];
    const show = (await one(`INSERT INTO shows (slug, name) VALUES ('zt-bf-show', 'ZT Show') RETURNING id`)).id;
    const season = (await one(`INSERT INTO show_seasons (show_id, season_number, status) VALUES ($1, 7, 'airing') RETURNING id`, [show])).id;
    const group = async (name) => (await one(`INSERT INTO league_groups (name) VALUES ($1) RETURNING id`, [name])).id;
    let n = 0;
    const league = async ({ name, group: g = null, pos = null, by = null, wikiSeason = 7, couch = null }) => {
      n += 1;
      const state = { settings: { showId: "zt-bf-show", wikiSeason } };
      return (await one(
        `INSERT INTO leagues (name, slug, join_code, state, created_by, group_id, group_position, couch_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + ($9 || ' seconds')::interval) RETURNING id`,
        [name, `zt-bf-${n}`, `ZTBF${n}X`, JSON.stringify(state), by, g, pos, couch, String(n)]
      )).id;
    };
    const member = (leagueId, userId, role, seen = null) =>
      c.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)`, [
        leagueId, userId, `p-${userId}`, role, seen,
      ]);

    // A linked group with no name and no maker, like the live couch: named for its show and season.
    const g1 = await group(null);
    const a = await league({ name: "zt A", group: g1, pos: 0, by: ann });
    const b = await league({ name: "zt B", group: g1, pos: 1, by: ann });
    await member(a, ann, "commissioner", 3);
    await member(b, ann, "commissioner", 5);
    await member(a, bo, "member", null);
    await member(b, cy, "member", 2);
    // A named group.
    const g2 = await group("zt Couch Cup");
    const e = await league({ name: "zt E", group: g2, pos: 0 });
    await member(e, cy, "commissioner", 1);
    // A league on its own, made by nobody on it: its earliest commissioner owns the couch.
    const solo = await league({ name: "zt Solo" });
    await member(solo, cy, "member", 0);
    await member(solo, bo, "commissioner", null);
    // A league nobody's in, and one on a season the catalog doesn't have.
    const empty = await league({ name: "zt Empty" });
    const offCatalog = await league({ name: "zt Off", wikiSeason: 99 });
    await member(offCatalog, ann, "commissioner", 4);
    // A group half-done (linked after couches existed): the rest joins the couch it already has.
    const kept = (await one(`INSERT INTO couches (name) VALUES ('zt Kept') RETURNING id`)).id;
    const g3 = await group(null);
    const f = await league({ name: "zt F", group: g3, pos: 0, couch: kept });
    const g = await league({ name: "zt G", group: g3, pos: 1 });
    await member(f, ann, "member", null);
    await member(g, bo, "commissioner", null);
    // A follow already further on than the league says: it never moves back.
    await c.query(`INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, 4)`, [cy, season]);

    await c.query(COUCHES);
    await c.query(FOLLOWS);
    const snapshot = async () =>
      (await c.query(`SELECT (SELECT count(*) FROM couches)::int AS couches, (SELECT count(*) FROM couch_members)::int AS members,
                             (SELECT string_agg(user_id || season_id || seen_through, ',' ORDER BY user_id, season_id) FROM show_follows) AS follows`)).rows[0];
    const first = await snapshot();
    await c.query(COUCHES);
    await c.query(FOLLOWS);
    assert.deepEqual(await snapshot(), first, "a second run changes nothing");

    const couchOf = async (id) => (await one("SELECT couch_id FROM leagues WHERE id = $1", [id])).couch_id;
    const couch = async (id) => one("SELECT name, created_by FROM couches WHERE id = $1", [id]);
    const people = async (couchId) =>
      Object.fromEntries((await c.query("SELECT user_id, role FROM couch_members WHERE couch_id = $1", [couchId])).rows.map((r) => [r.user_id, r.role]));

    const c1 = await couchOf(a);
    assert.equal(await couchOf(b), c1, "a linked group is one couch");
    assert.deepEqual(await couch(c1), { name: "ZT Show 7", created_by: ann }, "named for its show and season; made by its first league's maker");
    assert.deepEqual(await people(c1), { [ann]: "owner", [bo]: "member", [cy]: "member" }, "everyone in its leagues; its maker owns it");

    assert.equal((await couch(await couchOf(e))).name, "zt Couch Cup", "a named group keeps its name");
    const cSolo = await couchOf(solo);
    assert.notEqual(cSolo, c1);
    assert.equal((await couch(cSolo)).name, "zt Solo", "a league on its own is a couch named after it");
    assert.deepEqual(await people(cSolo), { [bo]: "owner", [cy]: "member" }, "no maker on it: its commissioner owns it");
    assert.deepEqual(await people(await couchOf(empty)), {}, "a league nobody's in: a couch with nobody on it");
    assert.equal(await couchOf(g), kept, "a half-done group joins the couch it has");
    assert.deepEqual(await people(kept), { [ann]: "member", [bo]: "owner" }, "with both leagues' people; its commissioner owns it");

    const seen = async (userId) => (await c.query("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [userId, season])).rows[0]?.seen_through;
    assert.equal(await seen(ann), 5, "the furthest of their leagues");
    assert.equal(await seen(bo), 0, "no mark yet is 0: fail closed");
    assert.equal(await seen(cy), 4, "a follow never moves back");
    const { rows: off } = await c.query("SELECT count(*)::int AS n FROM show_follows WHERE user_id = $1", [ann]);
    assert.equal(off[0].n, 1, "a league off the catalog gives no follow");
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    c.release();
    await pool.end();
  }
});
