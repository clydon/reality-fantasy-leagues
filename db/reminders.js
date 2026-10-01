// Reminders before an episode airs (db/migrations/0033): about a day before, and again about two
// hours before, push anyone whose lineup, Eliminator Pool pick or a prediction for that episode is
// still open. What counts as "open" is the action bar's own rule (src/lib/game/action-items.js), so
// a reminder never says something the app doesn't.
//
//   node db/reminders.js          # send whatever is due now
//   node db/reminders.js --dry    # say what would be sent, send and record nothing
//
// Run hourly by .github/workflows/auto-research.yml, right after auto-research. Each (person,
// league, kind, episode, window) is sent at most once -- reminder_log's primary key -- so running it
// more often only makes it more punctual.
//
// Only leagues following a real season's air schedule: the league's show/season must be in the
// catalog with a schedule and still airing (auto-research's isSeasonLive), and a catching-up league
// is skipped -- it plays at its own pace, not the broadcast's.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { actionItems } = require("../src/lib/game/action-items.js");
const { sendPush } = require("../src/lib/server/push-core.js");
const { loadSeasons, isSeasonLive } = require("./auto-research.js");

const HOUR = 60 * 60 * 1000;
// Checked nearest-first: inside 2 hours is the "2h" reminder even if the 24h one never went out (the
// job wasn't running, or the lineup was only left open late), so nobody gets two at once.
const WINDOWS = [
  { id: "2h", within: 2 * HOUR },
  { id: "24h", within: 24 * HOUR },
];
const REMINDABLE = new Set(["lineup", "pick", "prediction"]);

function windowFor(airAt, now) {
  const left = airAt.getTime() - now.getTime();
  if (left <= 0) return null;
  return WINDOWS.find((w) => left <= w.within) || null;
}

function whenText(airAt, now) {
  const hours = Math.max(1, Math.round((airAt.getTime() - now.getTime()) / HOUR));
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

async function runReminders(pool, opts = {}) {
  const now = opts.now || new Date();
  const seasons = new Map(
    (await loadSeasons(pool)).filter((s) => isSeasonLive(s, now)).map((s) => [`${s.slug}|${s.season_number}`, s])
  );
  if (!seasons.size) return { sent: 0 };

  const { rows: leagues } = await pool.query("SELECT id, name, state FROM leagues");
  let sent = 0;
  for (const league of leagues) {
    try {
      sent += await remindLeague(pool, league, seasons, now, opts);
    } catch (e) {
      // One league's bad state mustn't cost every other league its reminders.
      console.error(`[reminders] league ${league.id}:`, e.message);
    }
  }
  return { sent };
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
    const message = {
      title: `${league.name}: episode ${ep.number} airs ${whenText(airAt, now)}`,
      body: fresh.map((it) => it.text).join(" · "),
      url: `${fresh[0].href.split("#")[0] || "/"}?league=${encodeURIComponent(league.id)}`,
      tag: `reminder-${league.id}`,
    };
    console.log(`[reminders] ${opts.dry ? "(dry) " : ""}${m.user_id} -- ${message.title}: ${message.body}`);
    if (!opts.dry) await sendPush(pool, [m.user_id], "reminder", message);
    sent++;
  }
  return sent;
}

module.exports = { runReminders, windowFor };

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
