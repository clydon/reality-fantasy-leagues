// The helpers the engine track's API checks share (A11 part 5b: check-handicaps.js first; check-teams.js, check-h2h.js,
// check-answer-h2h.js, check-coop.js and the knockouts' checks each carry a copy, to move here when next touched), on
// new-fixture.js's couch: PASS/FAIL lines, comparing stored objects whatever order jsonb hands their keys back in, and the fixture's
// moves (a spoiler mark, a result decided through the season sync, the season's clock moved, a game's spec set with the show's ctx,
// a game as the Games tab reads it).
//
//   const K = require("./check-kit");
//   const out = K.checker();                         // out.check(ok, label, detail); out.failures()
//   const k = K.kit({ pool, fx, as, specsOn });      // k.seen, k.decide, k.airs, k.stateOf, k.write, k.seatsOf, k.setGame, k.gameIn
//
// Needs what new-fixture.js needs (this lane's .env.local, a local database, the dev server for the API calls). Touches nothing
// itself but through the fixture's rows.
const path = require("path");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

/** PASS/FAIL lines, counted. */
function checker() {
  let failures = 0;
  return {
    check(ok, label, detail) {
      if (!ok) failures++;
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
    },
    fail() {
      failures++;
    },
    failures: () => failures,
  };
}
/** A refusal's words. */
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);
/** The same, whatever order a stored object's keys come back in (jsonb sorts them). */
const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const round = (n) => Math.round(n * 100) / 100;

/**
 * The fixture's moves, for a check on `fx` (new-fixture.js up's) with API clients `as` (by name: alex, riley, ...). `specsOn`: game
 * specs are on in this database (db/game-specs.js gameSpecsOn), so a spec set here is carried as the app carries it.
 */
function kit({ pool, fx, as, specsOn }) {
  const sid = fx.seasonId;
  const couch = fx.couchId;
  const { questionContext } = jiti("../../src/lib/server/answers.ts");
  const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
  const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
  const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
  const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
  return {
    whoIs,
    stateOf,
    write,
    /** Someone's spoiler mark on the season. */
    seen: (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]),
    /** A result accepted for episode n (an elimination, or a moment's event), then the season sync, as the desk's accept does. */
    async decide(n, kind, name, eventType) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, $3, $4, $5, $6, 'accepted', true, now(), false)`,
        [sid, n, kind, name, kind === "elimination" ? "Voted Out" : "", eventType || ""]
      );
      await syncSeasonLeagues(sid, null);
    },
    /** The season sync on its own (after a decision changed in place: give it a new decided_at first). */
    sync: () => syncSeasonLeagues(sid, null),
    /** The season's clock moved `days` on (its premiere that much earlier). */
    airs: (days) => pool.query("UPDATE show_seasons SET premiere_date = premiere_date - $2::int WHERE id = $1", [sid, days]),
    /** Each fixture person's seat in a league (the first account on it). */
    async seatsOf(id) {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1 AND seat_slot = 0", [id])).rows) {
        const who = whoIs(user_id);
        if (who) out[who] = player_id;
      }
      return out;
    },
    /** A game's spec changed as the engine writes one (there's no screen for it yet): setGame with the show's ctx; its problems. */
    async setGame(id, spec) {
      const st = await stateOf(id);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(id, sid);
      const problems = S.setGame(st, typeof spec === "function" ? spec(S.gameOf(st)) : spec, { ctx });
      if (!problems.length) await write(id, st);
      return problems;
    },
    /** A game as the Games tab reads it for `who`, at their mark. */
    gameIn: async (who, id) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).find((x) => x.leagueId === id) ?? null,
  };
}

module.exports = { checker, errorOf, sorted, same, round, kit };
