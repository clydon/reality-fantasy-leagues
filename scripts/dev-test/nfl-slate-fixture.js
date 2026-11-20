// Dev-only fixture: a real NFL season's slate on the local database (docs/PLAN-sports-ready.md, Phase 0 and the checks after it),
// served by the stand-in ESPN (fake-espn.js) from the season recorded once with espn-snapshot.js (32 teams, about 2,550 people,
// 272 games, the finished ones' box scores), never the real ESPN. Its league is renamed "football/zt-nfl-slate" ("ZT National
// Football League"), so nothing it makes can be mistaken for a real league's rows.
//
// Time is the process's own (sim-clock.js, installed here before the app's code loads): `up({ at })` puts the clock where the
// check wants it in the recorded season (by default the moment it was recorded, Week 10's Saturday morning), and `clock.set()`
// moves it on, so the app's locks, starts and reads see the recorded season's dates whenever the check runs. The database's own
// now() stays real.
//
// What `up` makes (every row keyed so `down` finds it again):
//   people   zt-nfl-ann, -bo, -cy, -di (usernames zt_nfl_*, password zt-pass-12345; up to 8 with `people`), on a couch "ZT NFL
//            couch" that ann owns
//   a slate  the league's season by week (find.ts addSlate, as POST /api/sports/start's { league, slate } adds it: since step 2.7 its
//            regular season's 18 weeks then its playoffs' four, one season), followed by ann; its show is the league's (sports_league
//            "espn:football/zt-nfl-slate"), its people filled from the teams' rosters (cast.ts castFromEvents, the function the slate's
//            own fill runs) unless `cast: false`
//   cache    the stand-in's answers under "zt-nfl-slate-standin:"
// and `down` removes them, with any league started on the slate or by its people.
//
// As a module (each check owns the run):
//   const fx = require("./nfl-slate-fixture");
//   const world = await fx.up({ at, edit, cast, people, postseason });   // at: an ISO time in the recorded season; edit(input): change
//                                                    // the recording before it's served (a signing, a trade, a final); cast: false
//                                                    // leaves people for later; people: how many on the couch (4; up to 8);
//                                                    // postseason: true plays the weeks still to play and adds a stand-in playoffs
//                                                    // (nfl-postseason.js: the 2025 bracket in this season's playoff weeks, each
//                                                    // round listed once the one before is over), as world.postseason
//   world.espn (fake-espn's server: .events, .asked), world.providers, world.seasonId, world.slug, world.couchId,
//   world.users.ann (a SessionUser), world.weeks (each regular-season week: { n, label, from, to, first, last, games }),
//   world.regular (the slate's last regular-season episode: 18), world.playoffWeeks (each playoff week, numbered on from 19, as weeks),
//   world.start(who, body) (start.ts startSport, the body POST /api/sports/start takes), world.league(id) (its stored state)
//   world.advance(at) (the clock on, the stand-in answering as of then: games started by then as recorded, later ones still to
//   play), world.daily() (the daily job's sports part now), await world.days(to) (the clock on a day at a time to `to`, the daily
//   job run each morning as production runs it), world.settle() (waits for a fill the app started after an answer)
//   fx.app("../../src/lib/...") loads the app's code through the fixture's own jiti (one module graph, one pool);
//   fx.clock (sim-clock.js); await fx.finish(world, { keep }) waits for fills, removes the rows (unless keep), ends the stand-in
//   and the pool.
// The recording's played weeks (1 to 9 in the 2026-11-15 one) can be played again: put the clock before a week, start and answer,
// then world.days() past it and its finals arrive as they did.
// From the shell: node scripts/dev-test/nfl-slate-fixture.js up | down | status
//
// Needs: the local database (it refuses any other), the recording in .ui-atlas/fixtures/espn/ (ignored: real athletes' names stay
// on this machine; `node scripts/dev-test/espn-snapshot.js record` makes it, about 200 calls to ESPN). No app server.
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env.local"), quiet: true });
const clock = require("./sim-clock");
clock.install();
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const app = require("jiti")(__filename, {
  alias: { "@": path.join(ROOT, "src"), "@db": path.join(ROOT, "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});
const fakeEspn = require("./fake-espn");
const snapshot = require("./espn-snapshot");

const LEAGUE = "football/zt-nfl-slate";
const CACHE = "zt-nfl-slate-standin:";
/** Everyone the fixture can make; `up({ people })` makes the first so many (4 unless said). */
const PEOPLE = ["ann", "bo", "cy", "di", "ed", "flo", "gus", "hal"];
/** Their password (the fixtures' own), so a browser can sign in as one (browser.js open({ user: "zt_nfl_ann", pass })). */
const PASSWORD = "zt-pass-12345";
const idOf = (who) => `zt-nfl-${who}`;
const DB = process.env.AUTH_DATABASE_URL || "";

function local() {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("nfl-slate-fixture runs against a local database only");
}

/** A recorded game's length: being played from its start for this long, then final as recorded (an NFL game runs about 3¼ hours). */
const GAME_MS = 3.5 * 3_600_000;

/** A headshot for the few the recording has none for, so a fill never asks Wikipedia for one (show-art.ts: a real network call). */
const NO_PHOTO = "https://a.espncdn.com/i/headshots/nophoto.png";

/**
 * The recorded NFL season as fake-espn's start() input, its league renamed LEAGUE ("ZT NFL": the show and season the app makes are
 * named from it), everyone with a headshot. Throws with what to run when it's missing.
 */
function recording(file) {
  let found;
  try {
    found = snapshot.latest("football/nfl", file);
  } catch {
    throw new Error(`no NFL recording in ${snapshot.DIR}: run node scripts/dev-test/espn-snapshot.js record (about 200 calls to ESPN)`);
  }
  const snap = JSON.parse(fs.readFileSync(found, "utf8"));
  const input = snapshot.forFake(snap, { as: LEAGUE });
  input.leagues = input.leagues.map((l) => (l.league === LEAGUE ? { ...l, name: "ZT National Football League", short: "ZT NFL" } : l));
  for (const t of input.teams) for (const p of t.roster ?? []) if (!p.headshot) p.headshot = NO_PHOTO;
  return { input, file: found, recordedNow: snap.calendars[snap.league]?.now ?? snap.recordedAt };
}

/**
 * The recording's games as ESPN would have answered at `at`: a game that starts after it still to play (no score, no box score);
 * one being played (GAME_MS from its start) in progress, with neither; one over by then as recorded (final with its box score for the weeks played before the recording; a game the recording
 * has still to play stays to play). One copy each, so a check can change them.
 */
function gamesAsOf(events, at) {
  const t = Date.parse(at);
  // A game listed later (a playoff game once its round's teams are set: nfl-postseason.js) isn't listed before then.
  return events.filter((e) => !e.listedAt || Date.parse(e.listedAt) <= t).map((e) => {
    const c = structuredClone(e);
    if (Date.parse(e.at) > t) {
      c.state = "pre";
      delete c.score;
      delete c.box;
    } else if (e.state === "post" && t < Date.parse(e.at) + GAME_MS) {
      // Being played: no final and no box score until its length is up (step 1.1's hourly check reads a final as it lands).
      c.state = "in";
      delete c.score;
      delete c.box;
    }
    return c;
  });
}

/** The stand-in answering as of `at` (its games, and its calendar's "now"), in place. */
function serveAsOf(espn, input, at) {
  espn.events.splice(0, espn.events.length, ...gamesAsOf(input.events, at));
  const cal = espn.calendars[LEAGUE];
  if (cal) cal.now = new Date(at).toISOString();
}

/** Each regular-season week of the recording (`type` 3: its playoff weeks, numbered on after the regular season's, as a full slate
 *  numbers them), with its games' first and last start. */
function weeksOf(input, type = 2) {
  const cal = input.calendars[LEAGUE];
  const regular = (cal.weeks ?? []).filter((w) => w.type === 2).length;
  return (cal.weeks ?? [])
    .filter((w) => w.type === type)
    .map((w, i) => {
      if (type !== 2) w = { ...w, value: regular + i + 1 };
      const games = input.events.filter((e) => e.league === LEAGUE && e.at >= w.from && e.at <= w.to).sort((a, b) => a.at.localeCompare(b.at));
      return { n: Number(w.value), label: w.label, from: w.from, to: w.to, first: games[0]?.at ?? null, last: games[games.length - 1]?.at ?? null, games };
    });
}

/**
 * The season's fill stamped at the process clock's moment instead of the database's (cast_fills.updated_at is the database's now(),
 * which stays real): the Players tab's read (rosters.ts) asks again once a game has ended since the last fill, comparing the two,
 * and in production both are the same clock.
 */
async function alignFill(pool, seasonId) {
  // Only a stamp the database's clock made (later than the process clock: the recording is in the past; or, the clock on past the
  // real day, a stamp made by the database's now() just now), so a fill's time stays the moment it ran.
  await pool.query(
    `UPDATE cast_fills SET updated_at = $2 WHERE season_id = $1 AND asking_at IS NULL
        AND (updated_at > $2::timestamptz + interval '1 minute' OR (updated_at > now() - interval '15 minutes' AND updated_at < $2::timestamptz - interval '1 minute'))`,
    [seasonId, new Date()]
  );
}

/** Every row of ours, gone. Returns how many. */
async function down(pool) {
  local();
  const { rows: shows } = await pool.query("SELECT id, slug FROM shows WHERE sports_league LIKE $1", [`%:${LEAGUE}`]);
  const slugs = shows.map((s) => s.slug);
  const ids = PEOPLE.map(idOf);
  let n = 0;
  n += (await pool.query("DELETE FROM leagues WHERE state->'settings'->>'showId' = ANY($1::text[]) OR created_by = ANY($2::text[])", [slugs, ids])).rowCount;
  n += (await pool.query("DELETE FROM season_events WHERE league = $1", [LEAGUE])).rowCount;
  n += (await pool.query("DELETE FROM shows WHERE id = ANY($1::uuid[])", [shows.map((s) => s.id)])).rowCount;
  n += (await pool.query("DELETE FROM sports_events WHERE league = $1", [LEAGUE])).rowCount;
  n += (await pool.query("DELETE FROM team_follows WHERE league = $1", [LEAGUE])).rowCount;
  n += (await pool.query("DELETE FROM sports_recordings WHERE league = $1", [LEAGUE])).rowCount;
  // Ours, and what a read that makes its own providers for the stand-in (rosters.ts: "zt-standin:") kept of this league.
  n += (await pool.query("DELETE FROM sports_cache WHERE key LIKE $1 OR (key LIKE 'zt-standin:%' AND key LIKE $2)", [`${CACHE}%`, `%${LEAGUE}%`])).rowCount;
  n += (await pool.query("DELETE FROM couches WHERE created_by = ANY($1::text[])", [ids])).rowCount;
  n += (await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [ids])).rowCount;
  return n;
}

/**
 * The slate, made. `at`: the process clock's moment (default: when the season was recorded); `edit(input)`: change the recording
 * before it's served; `cast: false`: no people yet; `file`: another recording.
 */
async function up(opts = {}) {
  local();
  const { pool } = app("../../src/lib/server/db.ts");
  const { sportsProviders } = app("../../src/lib/server/sports/index.ts");
  const { addSlate } = app("../../src/lib/server/sports/find.ts");
  const { castFromEvents } = app("../../src/lib/server/sports/cast.ts");
  const { startSport } = app("../../src/lib/server/sports/start.ts");
  const gone = await down(pool);
  if (gone) console.log(`(nfl-slate-fixture: removed ${gone} rows a run before left)`);

  const rec = recording(opts.file);
  const postseason = opts.postseason ? require("./nfl-postseason").withPostseason(rec.input, LEAGUE) : null;
  if (opts.edit) opts.edit(rec.input);
  const at = opts.at ?? rec.recordedNow;
  clock.set(at);
  const espn = await fakeEspn.start({ ...rec.input, events: [], calendars: structuredClone(rec.input.calendars) });
  serveAsOf(espn, rec.input, at);
  const providers = sportsProviders({ base: espn.url, prefix: CACHE });

  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const users = {};
  const people = PEOPLE.slice(0, Math.min(PEOPLE.length, Math.max(1, opts.people ?? 4)));
  for (const who of people) {
    const id = idOf(who);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'user', now(), now())`,
      [id, `zt_nfl_${who}`, `${id}@example.invalid`]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [`${id}-cred`, id, hash]);
    users[who] = { id, name: `zt_nfl_${who}`, username: `zt_nfl_${who}`, email: `${id}@example.invalid`, emailVerified: true, role: "user", image: null, createdAt: new Date(), updatedAt: new Date() };
  }
  const { rows: couch } = await pool.query("INSERT INTO couches (name, created_by) VALUES ('ZT NFL couch', $1) RETURNING id", [users.ann.id]);
  const couchId = couch[0].id;
  for (const who of people) await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, $3, 'couch')", [couchId, users[who].id, who === "ann" ? "owner" : "member"]);

  const added = await addSlate(users.ann.id, { league: LEAGUE, slate: {} }, { providers, cast: false });
  const { rows: show } = await pool.query("SELECT s.slug, ss.season_number FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1", [added.seasonId]);
  const cast = opts.cast === false ? null : await castFromEvents(added.seasonId, { providers });
  await alignFill(pool, added.seasonId);

  // The database stamps a final's time and a fill's with its own now() (matchup.ts storeEvents, cast_fills): the process clock's
  // here, as production's are the same clock.
  const aligned = async () => {
    // (The clock on past the real day, a final the database just stamped is the process clock's too: the finals' look-back reads it.)
    await pool.query(
      `UPDATE sports_events SET final_at = $2 WHERE league = $1
          AND (final_at > $2::timestamptz + interval '1 minute' OR (final_at > now() - interval '15 minutes' AND final_at < $2::timestamptz - interval '1 minute'))`,
      [LEAGUE, new Date()]
    );
    await alignFill(pool, added.seasonId);
  };
  const world = {
    espn,
    providers,
    pool,
    input: rec.input,
    recording: rec.file,
    /** The clock to `to`, and the stand-in answering as of then (the games started by then as recorded). */
    advance: (to) => {
      clock.set(to);
      serveAsOf(espn, rec.input, to);
    },
    /** The daily listings job's sports part, as it runs at the clock's moment (matchup.ts refreshSportsEvents: the slate's sync,
     *  each linked game's facts, then the finals' lines). */
    daily: async () => {
      // The slate's season and any other of the league's (a team's season a check added: step 2.7's grow with it), never another's.
      const { rows: mine } = await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.sports_league LIKE $1", [`%:${LEAGUE}`]);
      const only = [...new Set([added.seasonId, ...mine.map((r) => r.id)])];
      const out = await app("../../src/lib/server/sports/matchup.ts").refreshSportsEvents({ providers, now: new Date(), only });
      await aligned();
      return out;
    },
    /**
     * The hourly job's run (db/sports-refresh.js, step 1.1) at the clock's moment: the job's own script in a process of its own, on
     * the process clock (sim-clock.js's file), against the stand-in and this season alone; then the database's stamps aligned as
     * after a daily run. Returns what it printed.
     */
    hourly: async () => {
      const file = path.join(require("os").tmpdir(), `zt-nfl-clock-${process.pid}.txt`);
      clock.share(file, Date.now());
      const { stdout, stderr } = await require("util").promisify(require("child_process").execFile)(
        process.execPath,
        [path.join(ROOT, "db", "sports-refresh.js"), `--base=${espn.url}`, `--only=${added.seasonId}`, `--prefix=${CACHE}`],
        { cwd: ROOT, env: { ...process.env, NODE_OPTIONS: `--require ${path.join(__dirname, "sim-clock.js")}`, SIM_CLOCK_FILE: file }, encoding: "utf8", timeout: 180_000 }
      );
      await aligned();
      return `${stdout}${stderr}`;
    },
    /**
     * The clock moved on to `to` a day at a time, the daily job run each day at `hour` UTC (the bot VM's morning call: tv-listings.ts)
     * and once more at `to`, as production would have run it over those days. Returns each run's errors.
     */
    days: async (to, hour = 11) => {
      const end = Date.parse(to);
      const errors = [];
      let t = Date.now();
      for (;;) {
        const next = new Date(t);
        next.setUTCHours(hour, 0, 0, 0);
        if (next.getTime() <= t) next.setUTCDate(next.getUTCDate() + 1);
        if (next.getTime() >= end) break;
        world.advance(next.toISOString());
        errors.push(...(await world.daily()).errors);
        t = next.getTime();
      }
      world.advance(new Date(end).toISOString());
      errors.push(...(await world.daily()).errors);
      await world.settle();
      return errors;
    },
    /** Wait for a fill the app started after an answer (fillLater: next-after-stub runs it on its own), up to two minutes. */
    settle: async () => {
      for (let i = 0; i < 240; i++) {
        const { rows } = await pool.query("SELECT asking_at FROM cast_fills WHERE season_id = $1", [added.seasonId]);
        if (!rows[0]?.asking_at) return alignFill(pool, added.seasonId);
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error("a fill of the slate's people is still going after two minutes");
    },
    /** What the desk's Approve writes for the season's people (desk-cast-page.ts): the cast approved, so a game started on the season
     *  from then on gets them (new-game.ts makeLeague: approvedCastFor). Since BACKLOG 220 a sport's fill approves its people itself;
     *  `unapprove()` puts a season back as one filled before that was. */
    approveCast: () => pool.query("UPDATE show_seasons SET cast_approved_at = now(), updated_at = now() WHERE id = $1", [added.seasonId]),
    unapprove: () => pool.query("UPDATE show_seasons SET cast_approved_at = NULL, updated_at = now() WHERE id = $1", [added.seasonId]),
    /** What Make it a game writes on the season's show (make-game.ts: shows.set_up_at), the part a sport's reads look at. */
    makeGame: () => pool.query("UPDATE shows SET set_up_at = now() WHERE id = (SELECT show_id FROM show_seasons WHERE id = $1)", [added.seasonId]),
    seasonId: added.seasonId,
    slate: added,
    slug: show[0].slug,
    seasonNumber: show[0].season_number,
    couchId,
    users,
    cast,
    weeks: weeksOf(rec.input),
    /** Step 2.7: the slate's last regular-season episode (a full slate's playoffs come after it), and its playoff weeks. */
    regular: added.regularThrough ?? added.episodes,
    playoffWeeks: weeksOf(rec.input, 3),
    postseason,
    /** Start one of the sport's games as `who`, with the body POST /api/sports/start takes (it's that route's own function). */
    start: (who, body) => startSport(users[who], couchId, body, { providers, now: new Date() }),
    /** A league's state as stored. */
    league: async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0]?.state ?? null,
  };
  return world;
}

/** The stand-in and the pool, ended (the rows stay: `down` takes them), once any fill the app started is over. */
async function close(world) {
  if (world?.settle) await world.settle().catch((e) => console.error(e.message));
  if (world?.espn) await world.espn.close();
  await app("../../src/lib/server/db.ts").pool.end();
}

/** A check's end: any fill the app started waited for, the rows removed (unless `keep`), the stand-in and the pool ended. */
async function finish(world, { keep = false } = {}) {
  if (world?.settle) await world.settle().catch((e) => console.error(e.message));
  if (!keep) await down(app("../../src/lib/server/db.ts").pool);
  await close(world);
}

module.exports = { up, down, close, finish, app, clock, recording, weeksOf, gamesAsOf, alignFill, LEAGUE, CACHE, PEOPLE, PASSWORD, GAME_MS, idOf };

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    const { pool } = app("../../src/lib/server/db.ts");
    if (cmd === "down") console.log(`removed ${await down(pool)} rows`);
    else if (cmd === "status") {
      const { rows } = await pool.query(
        `SELECT ss.id, ss.name, (SELECT count(*)::int FROM season_cast c WHERE c.season_id = ss.id) AS people, (SELECT count(*)::int FROM season_events e WHERE e.season_id = ss.id) AS games
           FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.sports_league LIKE $1`,
        [`%:${LEAGUE}`]
      );
      console.log(rows.length ? rows : "nothing up");
    } else if (cmd === "up") {
      const world = await up();
      console.log(`up: ${world.slate.name} (${world.seasonId}), ${world.slate.episodes} weeks, ${world.cast?.filled ?? 0} people; couch ${world.couchId}`);
      await world.espn.close();
      console.log("(the stand-in ESPN stops with this process: a check brings the fixture up in its own run)");
    } else throw new Error("usage: up | down | status");
    await pool.end();
  })().catch((e) => {
    console.error(e.message || e);
    process.exitCode = 1;
  });
}
