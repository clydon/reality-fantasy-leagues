// Dev-only check for step 0b, the new design's backend foundation (docs/PLAN-new-design.md), over HTTP against
// the dev server with new-fixture.js's couch:
//   - /api/me/home, /api/couches/[id], /api/seasons/[id]/space: the couch, its people and games, your shows
//     with where you are and what's next; a show watched privately isn't shared; no couch you're not on.
//   - PUT /api/me/follows/[seasonId]: follow, watch privately, where you are (not on a season you play).
//   - The classic app keeps it all in step: a reveal moves progress; making, joining, leaving, linking and
//     unlinking a league move couches; a league with no couch is healed when its people open home.
//   - Roles: a Game admin isn't a commissioner in classic; the last Commissioner can't step down.
//   - Nothing about results leaves these endpoints (no castaway names), and classic's /api/me/actions still works.
//
//   npm run dev                                     (in another terminal)
//   node scripts/dev-test/check-foundation.js       brings new-fixture.js up, checks, takes it down
//
// Then scripts/dev-test/check-foundation-data.js runs on the local database. Only touches zt-nd rows (the
// fixture's and the leagues this check makes); refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-foundation runs against a local database only");

(async () => {
  const pool = new Pool({ connectionString: DB });
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  try {
    const f = await fixture.up(pool);
    const as = {};
    for (const who of fixture.PEOPLE) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD });
    const ok = (r, what) => {
      assert.equal(r.status, 200, `${what}: ${r.status} ${JSON.stringify(r.body)}`);
      return r.body;
    };
    const noResults = (body, what) => assert.doesNotMatch(JSON.stringify(body), /Castaway \d/, `${what} says nothing about the cast or results`);

    // Home: the couch like the live one, and the extra couch; your show, where you are, what's next.
    let home = ok(await as.alex.call("GET", "/api/me/home"), "home");
    noResults(home, "home");
    const main = home.couches.find((c) => c.id === f.couchId);
    assert.ok(main, "alex's home has the couch");
    assert.equal(main.name, "ZT Survivor 51");
    assert.equal(main.yourRole, "owner");
    assert.deepEqual(main.members.map((m) => m.name), ["alex", "riley", "jordan", "sam"].map(fixture.username), "owner first, then by joining");
    assert.deepEqual(main.games.map((g) => g.gameName), ["Outlast", "Weekly Lineup", "Survival Pool"], "three games, in the group's order");
    assert.ok(home.couches.some((c) => c.id === f.extraCouchId), "and the extra couch");
    const show = home.shows.find((s) => s.seasonId === f.seasonId);
    assert.equal(show.seenThrough, 5);
    assert.equal(show.upNext.number, 6, "episode 6 is next");
    assert.equal(show.upNext.live, false);
    assert.equal(show.upNext.runtimeMin, 90, "the season's episode length");
    assert.equal(show.latestAired, 5);
    assert.equal(show.games.length, 4, "every game alex plays on it, the extra league included");
    // Sharing: riley follows the Traitors season openly, jordan privately.
    const watching = (who) => main.members.find((m) => m.userId === f.users[who]).watching;
    assert.ok(watching("riley").includes(f.traitorsSeasonId), "riley's open follow shows");
    assert.ok(!watching("jordan").includes(f.traitorsSeasonId), "jordan's private follow doesn't");
    const jordan = ok(await as.jordan.call("GET", "/api/me/home"), "jordan's home");
    const own = jordan.shows.find((s) => s.seasonId === f.traitorsSeasonId);
    assert.equal(own.private, true, "jordan sees their own private follow");
    assert.equal(own.seenThrough, 4);
    assert.equal((ok(await as.sam.call("GET", "/api/me/home"), "sam's home").shows.find((s) => s.seasonId === f.seasonId)).seenThrough, 3);

    // The show space, for the couch and on its own.
    let space = ok(await as.alex.call("GET", `/api/seasons/${f.seasonId}/space?couch=${f.couchId}`), "space");
    noResults(space, "space");
    assert.equal(space.show.name, "ZT Survivor");
    assert.equal(space.you.seenThrough, 5);
    assert.equal(space.schedule.upNext.number, 6);
    assert.equal(space.schedule.episodes.length, 13, "the season's 13 episodes");
    assert.equal(space.games.length, 3, "the couch's games here");
    assert.deepEqual(space.people.map((p) => p.playing.length), [3, 3, 3, 3]);
    assert.equal(ok(await as.alex.call("GET", `/api/seasons/${f.seasonId}/space`), "space alone").games.length, 4, "no couch: your own games");
    const traitors = ok(await as.alex.call("GET", `/api/seasons/${f.traitorsSeasonId}/space?couch=${f.couchId}`), "traitors space");
    assert.deepEqual(Object.fromEntries(traitors.people.map((p) => [p.name, p.watching])), {
      [fixture.username("alex")]: false, [fixture.username("riley")]: true, [fixture.username("jordan")]: false, [fixture.username("sam")]: false,
    }, "who watches it, privately watched left out");
    assert.equal(traitors.you.seenThrough, 0, "a season alex doesn't follow: episode 0");
    assert.equal((await as.casey.call("GET", `/api/seasons/${f.seasonId}/space?couch=${f.couchId}`)).status, 404, "not on the couch: 404");
    assert.equal((await as.alex.call("GET", `/api/seasons/00000000-0000-0000-0000-000000000000/space`)).status, 404);

    // One couch.
    const couch = ok(await as.alex.call("GET", `/api/couches/${f.couchId}`), "couch");
    noResults(couch, "couch");
    assert.equal(couch.members.length, 4);
    assert.equal(couch.seasons.length, 1);
    assert.equal(couch.seasons[0].games.length, 3);
    assert.equal((await as.casey.call("GET", `/api/couches/${f.couchId}`)).status, 404, "casey isn't on it");
    assert.equal((await as.alex.call("GET", "/api/couches/not-a-uuid")).status, 404);

    // Follows: on a season you play, where you are comes from your games.
    let r = await as.alex.call("PUT", `/api/me/follows/${f.seasonId}`, { seenThrough: 6 });
    assert.equal(r.status, 409, "a season alex plays");
    assert.equal((await as.alex.call("PUT", `/api/me/follows/${f.traitorsSeasonId}`, { seenThrough: "3" })).status, 400);
    assert.equal((await as.alex.call("PUT", `/api/me/follows/${f.traitorsSeasonId}`, {})).status, 400, "nothing to change");
    r = ok(await as.alex.call("PUT", `/api/me/follows/${f.traitorsSeasonId}`, { seenThrough: 3, private: true }), "follow");
    assert.deepEqual(r, { seenThrough: 3, following: true, private: true });
    const rileysView = ok(await as.riley.call("GET", `/api/seasons/${f.traitorsSeasonId}/space?couch=${f.couchId}`), "riley's view");
    assert.equal(rileysView.people.find((p) => p.userId === f.users.alex).watching, false, "alex watches it privately");
    r = ok(await as.alex.call("PUT", `/api/me/follows/${f.traitorsSeasonId}`, { seenThrough: 1, private: false }), "back a step");
    assert.equal(r.seenThrough, 1, "where you are can be corrected on a season you only follow");
    assert.equal(ok(await as.riley.call("GET", `/api/seasons/${f.traitorsSeasonId}/space?couch=${f.couchId}`), "again").people.find((p) => p.userId === f.users.alex).watching, true);

    // A classic reveal moves progress (results-seen.ts -> follows.ts), across the linked leagues.
    ok(await as.sam.call("POST", `/api/leagues/${f.leagues.lineup}/results-seen`, { through: 4 }), "sam reveals 4");
    assert.equal((await one("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [f.users.sam, f.seasonId])).seen_through, 4);
    assert.equal(ok(await as.sam.call("GET", `/api/seasons/${f.seasonId}/space`), "sam's space").you.seenThrough, 4);

    // Roles: riley is a Game admin in the lineup league: a member as far as classic goes.
    assert.equal((await as.riley.call("POST", `/api/leagues/${f.leagues.lineup}/reveal-next`)).status, 403, "a Game admin isn't a commissioner in classic");
    const role = (who, leagueId, target, value) => as[who].call("PUT", `/api/leagues/${leagueId}/members/${f.users[target]}/role`, { role: value });
    r = await role("alex", f.leagues.pool, "alex", "member");
    assert.equal(r.status, 409, "the last Commissioner can't step down");
    assert.match(r.body.error, /Every game needs a Commissioner/);
    assert.equal((await role("sam", f.leagues.pool, "sam", "commissioner")).status, 403, "only a Commissioner changes roles");
    assert.equal((await role("alex", f.leagues.pool, "riley", "owner")).status, 400);
    assert.equal(ok(await role("alex", f.leagues.pool, "riley", "commissioner"), "share it").role, "commissioner");
    assert.equal(ok(await role("alex", f.leagues.pool, "alex", "admin"), "step down").role, "admin", "with another Commissioner, alex can step down");
    assert.equal((await role("alex", f.leagues.pool, "riley", "member")).status, 403, "and is no longer a Commissioner there");
    ok(await role("riley", f.leagues.pool, "alex", "commissioner"), "hand it back");

    // Classic keeps couches in step. Make a league: a couch of its own, alex the owner.
    const made = ok(await as.alex.call("POST", "/api/leagues", { name: "zt-nd Made" }), "make a league").league;
    assert.match((await one("SELECT slug FROM leagues WHERE id = $1", [made.id])).slug, /^zt-nd-made-/);
    let row = await one("SELECT l.couch_id, c.name FROM leagues l JOIN couches c ON c.id = l.couch_id WHERE l.id = $1", [made.id]);
    assert.equal(row.name, "zt-nd Made");
    const members = async (couchId) =>
      Object.fromEntries((await pool.query("SELECT user_id, role FROM couch_members WHERE couch_id = $1", [couchId])).rows.map((x) => [x.user_id, x.role]));
    assert.deepEqual(await members(row.couch_id), { [f.users.alex]: "owner" });
    // riley joins it by code, then leaves: on the couch, then off it.
    ok(await as.riley.call("POST", "/api/leagues/join", { code: made.join_code }), "join");
    assert.deepEqual(await members(row.couch_id), { [f.users.alex]: "owner", [f.users.riley]: "member" });
    ok(await as.riley.call("POST", `/api/leagues/${made.id}/leave`), "leave");
    assert.deepEqual(await members(row.couch_id), { [f.users.alex]: "owner" }, "off the couch with no league left on it");

    // Link the extra league into the group: its couch folds into the main one, casey with it.
    ok(await as.alex.call("POST", `/api/leagues/${f.leagues.outlast}/link`, { otherLeagueId: f.leagues.extra }), "link");
    assert.equal((await one("SELECT couch_id FROM leagues WHERE id = $1", [f.leagues.extra])).couch_id, f.couchId);
    assert.equal((await one("SELECT count(*)::int AS n FROM couches WHERE id = $1", [f.extraCouchId])).n, 0, "the emptied couch is gone");
    assert.equal((await members(f.couchId))[f.users.casey], "member", "casey is on the couch now");
    assert.equal(ok(await as.casey.call("GET", `/api/couches/${f.couchId}`), "casey's view").seasons[0].games.length, 4);
    // Unlink it: a couch of its own again; casey off the main couch.
    ok(await as.alex.call("DELETE", `/api/leagues/${f.leagues.extra}/link`), "unlink");
    row = await one("SELECT l.couch_id, c.name FROM leagues l JOIN couches c ON c.id = l.couch_id WHERE l.id = $1", [f.leagues.extra]);
    assert.notEqual(row.couch_id, f.couchId);
    assert.equal(row.name, "ZT Extra");
    assert.deepEqual(await members(row.couch_id), { [f.users.alex]: "owner", [f.users.casey]: "member" });
    assert.equal((await members(f.couchId))[f.users.casey], undefined, "casey is off the main couch");

    // A league with no couch (made outside the app) is healed when its people open home.
    await pool.query("UPDATE leagues SET couch_id = NULL WHERE id = $1", [made.id]);
    home = ok(await as.alex.call("GET", "/api/me/home"), "home heals");
    row = await one("SELECT l.couch_id, c.name FROM leagues l JOIN couches c ON c.id = l.couch_id WHERE l.id = $1", [made.id]);
    assert.equal(row.name, "zt-nd Made", "a couch named after it");
    assert.ok(home.couches.some((c) => c.id === row.couch_id), "and it's on alex's home");

    // Classic's action bar still answers the same way.
    const actions = ok(await as.alex.call("GET", "/api/me/actions"), "actions");
    assert.ok(Array.isArray(actions.items) && Array.isArray(actions.commish));
    assert.deepEqual(home.moves, actions.items.filter((it) => it.kind !== "invite"), "home's moves are the action bar's");

    console.log("check-foundation: all good");
  } finally {
    await fixture.down(pool);
    await pool.end();
  }
  const data = spawnSync(process.execPath, [path.join(__dirname, "check-foundation-data.js")], { encoding: "utf8" });
  process.stdout.write(data.stdout + data.stderr);
  if (data.status !== 0) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
