// The commissioner's "Remind everyone" (Backstage's home; backstage-remind.ts, the route
// /api/seasons/[seasonId]/backstage/remind): one push to each person with a move still open in a game they run, on
// demand, between the hourly job's own reminders (db/reminders.js: a day and two hours before an episode airs). The
// pure half: who gets one, and what it says. Plain CommonJS like waiver-pushes.js, so a unit test can require it
// under bare node; types in remind-moves.d.ts.
//
// What counts as "open" is the app's own to-do (due-moves.ts, the same read as Up next and the classic action bar),
// so a reminder never says something the app doesn't. One push per person listing every game's moves, never one per
// game: someone with a lineup in one game and a pick in another hears once.
//
// Once every few hours (COOLDOWN): a second tap inside that window skips whoever already heard, and the button says
// so. Recorded in reminder_log (db/migrations/0033) as kind "manual", its window the time it was sent, so the hourly
// job's rows (24h, 2h) and these never collide.

const HOUR = 60 * 60 * 1000;
/** How long after a reminder from here the same person isn't reminded from here again. */
const COOLDOWN = 4 * HOUR;
/** reminder_log.kind for the commissioner's own. */
const KIND = "manual";

/** The hourly job's words for how far off an airing is: "in about 3 hours". */
function whenText(airAt, now) {
  const hours = Math.max(1, Math.round((airAt.getTime() - now.getTime()) / HOUR));
  return hours === 1 ? "in about an hour" : `in about ${hours} hours`;
}

/**
 * Who hears, and who doesn't: `moves` is each person's open moves in the games being reminded (user id -> moves, empty
 * for nobody), `recent` the user ids reminded from here inside the cooldown, `actor` whoever's tapping (never reminded
 * about their own moves by themselves). Returns { due: [userId...], skipped: [userId...] } -- due in the order given.
 */
function splitDue(moves, recent, actor) {
  const due = [];
  const skipped = [];
  for (const [userId, items] of moves) {
    if (!items.length || userId === actor) continue;
    (recent.has(userId) ? skipped : due).push(userId);
  }
  return { due, skipped };
}

/**
 * One person's push: what's open, in the games' names when more than one, and when the episode airs if the schedule
 * says. `moves` are their open items (each with leagueId, leagueName, text, href, episode); `season` { id, label } for
 * the title and the new design's link; `next` { number, airAt } the next episode to air, or null; `byName` whoever
 * sent it. Opens classic's page for the first move (its league), or the show's Tonight, where the moves are.
 */
function remindMessage(moves, season, next, byName, now = new Date()) {
  if (!moves.length) return null;
  const leagues = new Set(moves.map((m) => m.leagueId));
  const airAt = next && next.airAt ? new Date(next.airAt) : null;
  const ahead = airAt && airAt.getTime() > now.getTime();
  const title = ahead ? `${season.label}: episode ${next.number} airs ${whenText(airAt, now)}` : `${season.label}: you still have a move to make`;
  const lines = moves.map((m) => (leagues.size > 1 ? `${m.leagueName}: ${m.text}` : m.text));
  const first = moves[0];
  return {
    title,
    body: `${byName} sent a reminder · ${lines.join(" · ")}`,
    url: `${(first.href || "/").split("#")[0] || "/"}?league=${encodeURIComponent(first.leagueId)}`,
    next: `/show/${season.id}/tonight`,
    tag: `reminder-${first.leagueId}`,
  };
}

module.exports = { COOLDOWN, KIND, whenText, splitDue, remindMessage };
