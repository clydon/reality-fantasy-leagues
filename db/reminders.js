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
// (Commissioners' morning-after push to fill in results went in settings Round 1, C4 and BACKLOG 235: results settle on their
// own since 2026-11-20, so it told runners to copy and paste for nothing.)
//
// And one after an episode airs, for someone a Commissioner lets play at their own pace (docs/PLAN-own-pace-games.md: Backstage ›
// Members' switch, player.ownPace): once its air time has passed, while they haven't watched it and the next hasn't aired, one push
// that its lineup or pick is still theirs to set before they watch (StateLogic.GhostLogic.lateWindow; window 'late' in
// reminder_log, so once an episode). Their mark is their follow's (show_follows.seen_through); someone who sees results as they
// come in, or whose mark moves along by itself (Live), is never behind and hears nothing.
//
// And the players' "Final results are in" (the user, 2026-10-29): at 12:00 noon the day after an episode airs, in the season's
// zone (src/lib/game/final-results.js), to everyone on its games once its results are final, once per person and episode (the
// bell's key final:<season>:<n>, the one push-events.ts writes when final results land after that time instead). Within a day
// of that time, so a job that was down still sends it that afternoon.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const { actionItems } = require("../src/lib/game/action-items.js");
const { sendPush } = require("../src/lib/server/push-core.js");
const { remindMessage, shortEp } = require("../src/lib/server/remind-moves.js");
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
// The morning after airtime (9am in the season's zone, at least six hours after it aired): morningAfter, which the final
// results' time is reckoned from.
const MORNING = "09:00";
const MORNING_GAP = 6 * HOUR;
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
  // The players' reminders are gathered across leagues first, then sent one per person, show and episode (the design round's
  // step 8: three linked games are one push, not three), worded by remind-moves.js like a commissioner's own.
  const queue = new Map();
  for (const league of leagues) {
    try {
      await remindLeague(pool, league, airing, now, opts, queue);
      await remindLate(pool, league, airing, now, opts, queue);
    } catch (e) {
      // One league's bad state mustn't cost every other league its reminders.
      console.error(`[reminders] league ${league.id}:`, e.message);
    }
  }
  sent += await sendQueued(pool, queue, now, opts);
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
        title: `Ep ${n} final results are in`,
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

/** The after-airtime push for seats playing at their own pace (see the top of the file). */
async function remindLate(pool, league, seasons, now, opts, queue = null) {
  const G = StateLogic.GhostLogic;
  const settings = league.state.settings || {};
  const season = seasons.get(`${settings.showId}|${settings.wikiSeason}`);
  if (!season || StateLogic.RevealLogic.isCatchingUp(league.state)) return 0;
  if (!(league.state.players || []).some((p) => G.playsOwnPace(league.state, p.id))) return 0;
  // The league with its air times from the season's schedule, as the app stamps them (air-times.ts).
  const state = JSON.parse(JSON.stringify(league.state));
  for (const ep of state.episodes || []) {
    const at = Air.episodeAirTime(season.schedule, ep.number, season.wikiAirDates);
    if (at) ep.airsAt = at.toISOString();
  }
  const { rows: members } = await pool.query(
    `SELECT m.user_id, m.player_id, f.seen_through, f.keep_up, COALESCE(us.show_results_immediately, false) AS immediate
       FROM league_memberships m
       LEFT JOIN show_follows f ON f.user_id = m.user_id AND f.season_id = $2
       LEFT JOIN user_settings us ON us.user_id = m.user_id
      WHERE m.league_id = $1 AND m.player_id IS NOT NULL`,
    [league.id, season.id]
  );
  let sent = 0;
  for (const m of members) {
    if (!G.playsOwnPace(state, m.player_id) || m.immediate || m.keep_up === "auto") continue;
    const mark = Number.isInteger(m.seen_through) ? m.seen_through : 0;
    const w = G.lateWindow(state, m.player_id, mark, now.getTime());
    if (!w || mark !== w.episode - 1) continue;
    // Only something missing is due: a full lineup carried in from last week is set, as before airtime (the user, 2026-11-19; the
    // app's due move says the same). Locked in (the strip's Lock in) there's no window, so nothing to remind.
    const due = actionItems(G.lateCopy(state, w.episode), m.player_id, mark).filter((it) => (it.kind === "lineup" || it.kind === "pick") && it.episode === w.episode);
    if (!due.length) continue;
    if (!opts.dry) {
      const { rowCount } = await pool.query(
        `INSERT INTO reminder_log (user_id, league_id, kind, episode_number, reminder_window) VALUES ($1,$2,$3,$4,'late') ON CONFLICT DO NOTHING`,
        [m.user_id, league.id, due[0].kind, w.episode]
      );
      if (!rowCount) continue;
    }
    const airAt = Air.episodeAirTime(season.schedule, w.episode, season.wikiAirDates);
    const moves = due.map((it) => ({ leagueId: league.id, leagueName: league.name, text: it.text, href: it.href || "/", kind: it.kind, episode: w.episode, ownPace: true }));
    if (queue) enqueue(queue, { userId: m.user_id, season, episode: w.episode, airAt, window: "late", moves });
    else await sendOne(pool, { userId: m.user_id, season, episode: w.episode, airAt, window: "late", moves }, now, opts);
    sent++;
  }
  return sent;
}

async function remindLeague(pool, league, seasons, now, opts, queue = null) {
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
    // Everything still open, gathered with their other games on the show (sendQueued sends one push for them all). Someone at
    // their own pace locks as they watch, so their reminder says when it airs rather than when it locks.
    const ownPace = !!StateLogic.GhostLogic.playsOwnPace(state, m.player_id);
    const moves = fresh.map((it) => ({ leagueId: league.id, leagueName: league.name, text: it.text, href: it.href || "/", kind: it.kind, episode: ep.number, ownPace }));
    if (queue) enqueue(queue, { userId: m.user_id, season, episode: ep.number, airAt, window: win.id, moves });
    else await sendOne(pool, { userId: m.user_id, season, episode: ep.number, airAt, window: win.id, moves }, now, opts);
    sent++;
  }
  return sent;
}

/** Adds a person's moves on one show's episode to the run's queue (one push each, sendQueued). */
function enqueue(queue, r) {
  const k = `${r.userId}|${r.season.id}|${r.episode}|${r.window}`;
  const had = queue.get(k);
  if (had) had.moves.push(...r.moves);
  else queue.set(k, { ...r, moves: [...r.moves] });
}

const showNames = new Map();
/** "Survivor 51" and its short word for an episode ("Ep"; a sport's "Wk", "G"...). */
async function seasonWords(pool, season) {
  if (!showNames.has(season.show_id)) {
    const row = (await pool.query("SELECT name, episode_term FROM shows WHERE id = $1", [season.show_id])).rows[0];
    showNames.set(season.show_id, { name: row?.name ?? "Your show", ep: shortEp(row?.episode_term) });
  }
  const w = showNames.get(season.show_id);
  return { label: `${String(w.name).replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "")} ${season.season_number}`, ep: w.ep };
}

/** One person's reminder for one show's episode: remind-moves.js's words, the bell's key saying which episode it's about. */
async function sendOne(pool, r, now, opts) {
  const message = remindMessage(r.moves, { id: r.season.id, ...(await seasonWords(pool, r.season)) }, { number: r.episode, airAt: r.airAt ? r.airAt.toISOString() : null }, null, now);
  if (!message) return 0;
  // The bell drops it once that episode has locked for them (notify-prefs.ts readNotes): "before" ones once it airs or they've
  // watched it, an "aired" one once they've watched it.
  const full = { ...message, key: `remind:${r.season.id}:${r.episode}:${r.window === "late" ? "aired" : "before"}:${r.window}`, seasonId: r.season.id };
  console.log(`[reminders] ${opts.dry ? "(dry) " : ""}${r.userId} -- ${full.title}: ${full.body}`);
  if (!opts.dry) await sendPush(pool, [r.userId], "reminder", full, { seasonId: r.season.id });
  return 1;
}

async function sendQueued(pool, queue, now, opts) {
  let sent = 0;
  for (const r of queue.values()) {
    try {
      sent += await sendOne(pool, r, now, opts);
    } catch (e) {
      console.error(`[reminders] ${r.userId} on season ${r.season.id}:`, e.message);
    }
  }
  return sent;
}

module.exports = { runReminders, windowFor, morningAfter, finalResults, remindLate };

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
