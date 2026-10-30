// Reminders before an episode airs (db/migrations/0033): about a day before, and again about two
// hours before, push anyone whose lineup, Eliminator Pool pick or a prediction for that episode is
// still open. What counts as "open" is the action bar's own rule (src/lib/game/action-items.js), so
// a reminder never says something the app doesn't.
//
//   node db/reminders.js          # send whatever is due now
//   node db/reminders.js --dry    # say what would be sent, send and record nothing
//
// Run hourly by .github/workflows/reminders-waivers.yml, before waivers.js. Each (person,
// league, kind, episode, window) is sent at most once -- reminder_log's primary key -- so running it
// more often only makes it more punctual.
//
// Only leagues following a real season's air schedule: the league's show/season must be in the
// catalog with a schedule and still airing (season-clock.js isSeasonLive), and a catching-up league
// is skipped -- it plays at its own pace, not the broadcast's.
//
// And one for commissioners, after an episode rather than before it: the morning after it airs (9am
// in the season's time zone, at least six hours after airtime), if it still has no results, a push
// to fill them in -- the same "due" rule as their alert strip (action-items.js resultsDueEpisode).
// Any airing season counts here, not only auto-researched ones: filling in results is the
// commissioner's job by default, and the push stops being due the moment anyone (an admin, research)
// gets results in.
//
// And the players' "Final results are in" (the user, 2026-10-29): at 12:00 noon the day after an episode airs, in the season's
// zone (src/lib/game/final-results.js), to everyone on its games once its results are final, once per person and episode (the
// bell's key final:<season>:<n>, the one push-events.ts writes when final results land after that time instead). Within a day
// of that time, so a job that was down still sends it that afternoon.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { actionItems, resultsDueEpisode, resultsHref } = require("../src/lib/game/action-items.js");
const { sendPush } = require("../src/lib/server/push-core.js");
const { loadSeasons, isSeasonLive } = require("./season-clock.js");
const { finalResultsAt } = require("../src/lib/game/final-results.js");

const HOUR = 60 * 60 * 1000;
// Checked nearest-first: inside 2 hours is the "2h" reminder even if the 24h one never went out (the
// job wasn't running, or the lineup was only left open late), so nobody gets two at once.
const WINDOWS = [
  { id: "2h", within: 2 * HOUR },
  { id: "24h", within: 24 * HOUR },
];
const REMINDABLE = new Set(["lineup", "pick", "prediction"]);
// The results nudge: from the morning after airtime, for the rest of that day (a job that was down
// overnight doesn't send it at midnight).
const MORNING = "09:00";
const MORNING_GAP = 6 * HOUR;
const MORNING_LASTS = 12 * HOUR;
// The final results' push: from its time, for a day.
const FINAL_LASTS = 24 * HOUR;

function windowFor(airAt, now) {
  const left = airAt.getTime() - now.getTime();
  if (left <= 0) return null;
  return WINDOWS.find((w) => left <= w.within) || null;
}

function whenText(airAt, now) {
  const hours = Math.max(1, Math.round((airAt.getTime() - now.getTime()) / HOUR));
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

/** The first 9am (season time) at least six hours after `airAt`: "the morning after". */
function morningAfter(airAt, tz) {
  let date = Air.localDate(new Date(airAt.getTime() + MORNING_GAP), tz);
  let at = Air.zonedToUtc(date, MORNING, tz);
  if (at.getTime() < airAt.getTime() + MORNING_GAP) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
    at = Air.zonedToUtc(date, MORNING, tz);
  }
  return at;
}

async function runReminders(pool, opts = {}) {
  const now = opts.now || new Date();
  const key = (s) => `${s.slug}|${s.season_number}`;
  // Every airing season, for both the players' reminders and the commissioners' results nudge (see the top of the file). The
  // players' went only to seasons with auto-research's switch on until that switch went with paid research; the user chose
  // every airing season (2026-10-29, BACKLOG 23). Each person's own switches still decide what reaches them (push-core.js).
  const airing = new Map((await loadSeasons(pool, "ss.status = 'airing'")).filter((s) => isSeasonLive(s, now)).map((s) => [key(s), s]));
  if (!airing.size && !(await pool.query("SELECT 1 FROM show_seasons WHERE status = 'completed' AND finale_date >= current_date - 3 LIMIT 1")).rows.length) return { sent: 0 };

  // A deleted or archived game (step 10 part 2b) hears nothing.
  const { rows: leagues } = await pool.query("SELECT id, name, state FROM leagues WHERE deleted_at IS NULL AND COALESCE(state->'settings'->>'archivedAt', '') = ''");
  let sent = 0;
  for (const league of leagues) {
    try {
      sent += await remindLeague(pool, league, airing, now, opts);
      sent += await remindResults(pool, league, airing, now, opts);
    } catch (e) {
      // One league's bad state mustn't cost every other league its reminders.
      console.error(`[reminders] league ${league.id}:`, e.message);
    }
  }
  // A season that's ended since (its finale's results final in the morning) still gets its noon push: airing, or completed with
  // its finale in the last few days. Each is cheap unless an episode's final time came in the last day.
  for (const season of await loadSeasons(pool, "ss.status = 'airing' OR (ss.status = 'completed' AND ss.finale_date >= current_date - 3)")) {
    try {
      sent += await finalResults(pool, season, leagues.filter((l) => key({ slug: l.state.settings?.showId, season_number: l.state.settings?.wikiSeason }) === key(season)), now, opts);
    } catch (e) {
      console.error(`[reminders] final results, season ${season.id}:`, e.message);
    }
  }
  return { sent };
}

// The players' final results for one season: each episode whose final time came in the last day, to everyone on a game of it
// whose results for it are final, once each. Worded as push-events.ts words it: no names (who went home was the early push's),
// and for someone who has seen the episode, the reveal again with the final results (Watch the final results: the show's
// ?page=reveal&ep=N). A result still waiting on its sources at that time isn't final yet: push-events.ts tells them when it is.
async function finalResults(pool, season, leagues, now, opts) {
  const tz = season.schedule.airTz || "America/New_York";
  const due = new Map();
  for (const league of leagues) {
    const state = league.state;
    const end = StateLogic.endEpisode(state);
    for (const ep of state.episodes || []) {
      if (StateLogic.resultsStage(ep) !== "final" || (end !== null && ep.number > end)) continue;
      const at = finalResultsAt(Air.episodeAirTime(season.schedule, ep.number, season.wikiAirDates), tz);
      const since = at ? now.getTime() - at.getTime() : -1;
      if (since < 0 || since >= FINAL_LASTS) continue;
      if (!due.has(ep.number)) due.set(ep.number, []);
      due.get(ep.number).push(league.id);
    }
  }
  if (!due.size) return 0;
  const { rows: names } = await pool.query("SELECT name FROM shows WHERE id = $1", [season.show_id]);
  const label = `${names[0]?.name ?? "Your show"} ${season.season_number}`;
  let sent = 0;
  for (const [n, leagueIds] of due) {
    // Who the other results pushes reach (push-targets.ts leagueMemberUserIds, ghosts too): not someone still catching up.
    const { rows: seats } = await pool.query("SELECT league_id, user_id, player_id FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND user_id IS NOT NULL", [leagueIds]);
    const stateOf = new Map(leagues.map((l) => [l.id, l.state]));
    const members = seats.filter((m) => !(m.player_id && StateLogic.GhostLogic.isCatchingUp(stateOf.get(m.league_id), m.player_id)));
    // Each reader's own game, for classic's link.
    const gameOf = new Map(members.map((m) => [m.user_id, m.league_id]));
    const R = `results:${season.id}:${n}`;
    const F = `final:${season.id}:${n}`;
    const message = async (reader) => {
      const { rows: told } = await pool.query("SELECT key FROM notifications WHERE user_id = $1 AND key = ANY($2::text[])", [reader.userId, [R, F]]);
      if (told.some((t) => t.key === F)) return null;
      const { rows: m } = await pool.query(
        `SELECT (SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2) AS mark,
                COALESCE((SELECT show_results_immediately FROM user_settings WHERE user_id = $1), false) AS immediate`,
        [reader.userId, season.id]
      );
      const sees = !!m[0]?.immediate || (Number.isInteger(m[0]?.mark) && m[0].mark >= n);
      return {
        title: `Episode ${n} final results are in`,
        body: `${label} · ${sees ? "Every point's in. Watch the final results." : "Reveal when you've watched."}`,
        url: `${sees ? "/episodes" : "/"}?league=${encodeURIComponent(gameOf.get(reader.userId) ?? leagueIds[0])}`,
        next: sees ? `/show/${season.id}/tonight?page=reveal&ep=${n}` : `/show/${season.id}/tonight`,
        tag: `results-${season.id}-${n}`,
        key: F,
        seasonId: season.id,
        // Never told it was in at all (results that came final at once): either moment of theirs lets it through.
        ...(told.some((t) => t.key === R) ? {} : { anyOf: ["episodeResults", "finalScores"] }),
      };
    };
    const userIds = [...gameOf.keys()];
    console.log(`[reminders] ${opts.dry ? "(dry) " : ""}final results: ${label} Episode ${n}, ${userIds.length} on its games`);
    if (!opts.dry) await sendPush(pool, userIds, "finalScores", message, { seasonId: season.id });
    sent += userIds.length;
  }
  return sent;
}

async function remindLeague(pool, league, seasons, now, opts) {
  const state = league.state;
  const settings = state.settings || {};
  const season = seasons.get(`${settings.showId}|${settings.wikiSeason}`);
  if (!season || StateLogic.RevealLogic.isCatchingUp(state)) return 0;
  const ep = StateLogic.currentEpisode(state);
  if (!ep) return 0;
  const airAt = Air.episodeAirTime(season.schedule, ep.number, season.wikiAirDates);
  const win = airAt && windowFor(airAt, now);
  if (!win) return 0;

  let sent = 0;
  const { rows: members } = await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id=$1", [league.id]);
  for (const m of members) {
    if (!m.player_id) continue;
    const due = actionItems(state, m.player_id).filter((it) => REMINDABLE.has(it.kind) && it.episode === ep.number);
    // Record first, push only what was newly recorded: a rerun can't repeat a reminder.
    const fresh = [];
    for (const it of due) {
      if (opts.dry) {
        fresh.push(it);
        continue;
      }
      const { rowCount } = await pool.query(
        `INSERT INTO reminder_log (user_id, league_id, kind, episode_number, reminder_window)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [m.user_id, league.id, it.kind, ep.number, win.id]
      );
      if (rowCount) fresh.push(it);
    }
    if (!fresh.length) continue;
    // One push per person per league, listing everything still open.
    // Classic's page for the first thing still open, or (the new design, step 15 part 2) the show's Tonight, where its moves are.
    const message = {
      title: `${league.name}: episode ${ep.number} airs ${whenText(airAt, now)}`,
      body: fresh.map((it) => it.text).join(" · "),
      url: `${fresh[0].href.split("#")[0] || "/"}?league=${encodeURIComponent(league.id)}`,
      next: `/show/${season.id}/tonight`,
      tag: `reminder-${league.id}`,
      seasonId: season.id,
    };
    console.log(`[reminders] ${opts.dry ? "(dry) " : ""}${m.user_id} -- ${message.title}: ${message.body}`);
    if (!opts.dry) await sendPush(pool, [m.user_id], "reminder", message, { seasonId: season.id });
    sent++;
  }
  return sent;
}

// The commissioner's results nudge for one league: the episode due now (aired, in play, nothing
// recorded), once its morning-after has come, to each commissioner, once.
async function remindResults(pool, league, seasons, now, opts) {
  const state = league.state;
  const settings = state.settings || {};
  const season = seasons.get(`${settings.showId}|${settings.wikiSeason}`);
  if (!season) return 0;
  // Air times from the catalog (as the app stamps them on read), on a copy: never written back.
  const stamped = { ...state, episodes: state.episodes.map((ep) => ({ ...ep })) };
  for (const ep of stamped.episodes) {
    const at = Air.episodeAirTime(season.schedule, ep.number, season.wikiAirDates);
    if (at) ep.airsAt = at.toISOString();
    else delete ep.airsAt;
  }
  const ep = resultsDueEpisode(stamped, now.getTime());
  if (!ep) return 0;
  const morning = morningAfter(new Date(ep.airsAt), season.schedule.airTz || "America/New_York");
  const since = now.getTime() - morning.getTime();
  if (since < 0 || since >= MORNING_LASTS) return 0;

  let sent = 0;
  const { rows: commissioners } = await pool.query(
    "SELECT user_id FROM league_memberships WHERE league_id=$1 AND role='commissioner'",
    [league.id]
  );
  for (const m of commissioners) {
    if (!opts.dry) {
      const { rowCount } = await pool.query(
        `INSERT INTO reminder_log (user_id, league_id, kind, episode_number, reminder_window)
         VALUES ($1,$2,'results',$3,'morning') ON CONFLICT DO NOTHING`,
        [m.user_id, league.id, ep.number]
      );
      if (!rowCount) continue;
    }
    const message = {
      title: `${league.name}: episode ${ep.number} needs its results`,
      body: "Nothing's in yet. Copy the question into any AI chat, paste its answer back, then apply.",
      url: `${resultsHref(state, ep)}?league=${encodeURIComponent(league.id)}`,
      next: `/show/${season.id}/backstage/results?ep=${ep.number}`,
      tag: `results-${league.id}`,
      seasonId: season.id,
    };
    console.log(`[reminders] ${opts.dry ? "(dry) " : ""}${m.user_id} -- ${message.title}`);
    if (!opts.dry) await sendPush(pool, [m.user_id], "resultsDue", message, { seasonId: season.id });
    sent++;
  }
  return sent;
}

module.exports = { runReminders, windowFor, morningAfter, finalResults };

if (require.main === module) {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  runReminders(pool, { dry: process.argv.includes("--dry") })
    .then(({ sent }) => console.log(`[reminders] ${sent} reminder${sent === 1 ? "" : "s"} ${process.argv.includes("--dry") ? "due" : "sent"}`))
    .catch((e) => {
      console.error("[reminders] failed:", e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
