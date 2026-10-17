// Dev-only test bank: the world check-up-next.js and check-motion.js walk (docs/PLAN-league-tabs.md): the linked
// "Couch Crew" group (linked-fixture.js: Classic, Active Roster, Pool) with each league on its own made-up season
// (Survivor 97-99, show_seasons rows named "zt-up-next") so episode 7 has a real air time, which the server stamps
// from the schedule:
//   - Active Roster: episode 7 airs in 3 hours with your lineup empty  -> "Lineup", due soon
//   - Classic: episode 7 airs in 30 hours, with a prediction to guess   -> "Predict", not soon
//   - Pool: episode 7 aired 2 hours ago with no results                -> no pick; a commissioner's results job
//
//   const world = require("./up-next-fixture");
//   const { classic, roster, pickem } = await world.up(pool, { clear, member, seen });
//   ... await world.down(pool);
//
// clear: the lineup set, no prediction, Pool's episode 7 still to air with a pick in, waivers off (nothing to do
// anywhere but the commissioner's jobs). member: the tester plays in all three but runs none. seen: the tester's
// reveal mark (default 6 = everything revealed; 4 hides episodes 5-6). Also marks What's New read. All zt-*:
// `down` takes the group and the seasons away. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const fixture = require("./linked-fixture");
const S = require("../../src/lib/game/state-logic.js");

const HOUR = 3_600_000;
const SEASON_NAME = "zt-up-next";

// A weekly season whose episode 7 airs at `at` (UTC): premiere six weeks before, same time of day.
function seasonFor(at) {
  const d = new Date(at.getTime() - 42 * 24 * HOUR);
  return { premiere: d.toISOString().slice(0, 10), time: at.toISOString().slice(11, 16) };
}

async function seasonsDown(pool) {
  await pool.query(`DELETE FROM show_seasons WHERE name = $1`, [SEASON_NAME]);
}


async function up(pool, { clear = false, member = false, seen = 6 } = {}) {
  const [classic, roster, pickem] = await fixture.up(pool, { groupName: "Couch Crew" });
    await seasonsDown(pool);
    const { rows: show } = await pool.query(`SELECT id FROM shows WHERE slug = 'survivor'`);
    const now = Date.now();
    const plan = [
      [classic, 99, new Date(now + 30 * HOUR)],
      [roster, 98, new Date(now + 3 * HOUR)],
      [pickem, 97, new Date(now + (clear ? 50 : -2) * HOUR)],
    ];
    for (const [league, season, at] of plan) {
      const { premiere, time } = seasonFor(at);
      await pool.query(
        `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz) VALUES ($1,$2,$3,'airing',$4,$5,'UTC')`,
        [show[0].id, season, SEASON_NAME, premiere, time]
      );
      const { rows } = await pool.query(`SELECT state FROM leagues WHERE id = $1`, [league.leagueId]);
      const state = rows[0].state;
      state.settings.wikiSeason = season;
      const me = state.players[0].id;
      const ep7 = state.episodes.find((e) => e.number === 7);
      if (league === classic && !clear) {
        state.settings.bonusEnabled = true;
        S.addBet(state, ep7.id, "Who wins immunity?", 1, me);
      }
      if (league === roster) {
        // Explicitly empty: with none set, last week's lineup carries over.
        ep7.lineups = { ...ep7.lineups, [me]: [] };
        if (clear) {
          const mine = state.castaways.filter((c) => c.ownerIds.includes(me) && c.status !== "eliminated").map((c) => c.id);
          S.setActiveRosterLineup(state, ep7.id, me, mine.slice(0, S.ActiveRosterLogic.activeSlots(state)));
        }
      }
      if (league === pickem && clear) {
        const { available } = S.pickEmEligibility(state, ep7.id, me);
        if (available.length) S.setPickEmPick(state, ep7.id, me, available[0]);
      }
      // Waivers off, so the fixture's week owes nobody a replacement.
      if (clear) Object.assign(state.settings, { replaceRule: "never", waiverWindows: { schedule: "manual", every: 3, swaps: 0 } });
      await pool.query(`UPDATE leagues SET state = $2 WHERE id = $1`, [league.leagueId, JSON.stringify(state)]);
      await pool.query(`UPDATE league_memberships SET results_seen_through = $2, role = $3 WHERE league_id = $1`, [
        league.leagueId,
        seen,
        member ? "member" : "commissioner",
      ]);
    }
    const { LATEST_RELEASE_ID } = require("jiti")(__filename)("../../src/lib/whats-new.ts");
    await pool.query(
      `INSERT INTO user_settings (user_id, whats_new_seen) SELECT id, $2 FROM "user" WHERE username=$1
       ON CONFLICT (user_id) DO UPDATE SET whats_new_seen = $2`,
      [fixture.USERNAME, LATEST_RELEASE_ID]
    );

  return { classic, roster, pickem };
}

async function down(pool) {
  await fixture.down(pool);
  await seasonsDown(pool);
}

module.exports = { up, down, SEASON_NAME, USERNAME: fixture.USERNAME, PASSWORD: fixture.PASSWORD };
