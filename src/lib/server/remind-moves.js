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
 * A season's short word for one of its episodes, from shows.episode_term ("Week" → "Wk"): show-words.ts epShort's map, kept here
 * because the hourly job is plain CommonJS. A show's is "Ep".
 */
const SHORT = { Episode: "Ep", Week: "Wk", Game: "G", Round: "Rd", Matchday: "MD", Gameweek: "GW", Race: "Race", Day: "Day", Night: "Night" };
function shortEp(term) {
  const t = String(term || "").trim();
  const word = t ? t[0].toUpperCase() + t.slice(1) : "Episode";
  return SHORT[word] || word;
}

/** The Your moves sheet's tab for a move (src/new/show/moves.ts MovesTab), so a push opens on it. */
const TAB = { lineup: "lineup", pick: "pool", prediction: "predict" };

/** "Set your episode 6 lineup (1 empty slot)" → "Set your lineup (1 empty slot)": the title already says the episode. */
const plain = (text) => text.replace(/ episode \d+/i, "");

/**
 * One person's push about their open moves on one show, for the hourly job and a commissioner's Remind everyone alike (the
 * design round's step 8, docs/design-round/step8-notify-spec.md: one grammar for every push). The title is the news, number
 * first, inside what a phone shows: when the episode's moves lock ("Ep 6 locks in about 3 hours"), or, when every one of them
 * locks only as you watch (at your own pace), when it airs; with no time to give, that a move is still open. The body says
 * where (the season), who sent it when someone did, then each move, its game named when there's more than one. A tap opens the
 * show with Your moves open on the first move's tab (src/new/show/dock.tsx reads `?moves=`).
 *
 * `moves` are their open items (each with leagueId, leagueName, text, href, kind, episode, and ownPace when it locks only as they
 * watch); `season` { id, label, ep? } (ep: the season's short word, shortEp; "Ep" when not given); `next` { number, airAt } the episode they're for, or null; `byName` whoever sent it, or null for
 * the hourly job's own.
 */
function remindMessage(moves, season, next, byName, now = new Date()) {
  if (!moves.length) return null;
  const leagues = new Set(moves.map((m) => m.leagueId));
  const airAt = next && next.airAt ? new Date(next.airAt) : null;
  const ahead = airAt && airAt.getTime() > now.getTime();
  const n = (next && next.number) || moves[0].episode || null;
  const paced = moves.every((m) => m.ownPace);
  const ep = season.ep || "Ep";
  const lower = (t) => t.replace(/^./, (c) => c.toLowerCase());
  const first = moves[0];
  // Aired, and it locks only as they watch: theirs to set before they do ("Ep 5 aired: set your lineup first").
  const aired = !!airAt && !ahead && paced && !!n;
  const title = ahead
    ? `${ep} ${n} ${paced ? "airs" : "locks"} ${whenText(airAt, now)}`
    : aired
      ? `${ep} ${n} aired: ${moves.length === 1 ? lower(plain(first.text)).replace(/ \(.*\)$/, "") : "your moves"} first`
      : n
        ? `${ep} ${n}: ${moves.length === 1 ? "a move is" : "moves are"} still open`
        : "A move is still open";
  const lines = moves.map((m) => (leagues.size > 1 ? `${m.leagueName}: ${lower(plain(m.text))}` : plain(m.text)));
  const tab = TAB[first.kind];
  return {
    title,
    body: [season.label, byName ? `${byName} sent a reminder` : null, ...lines, paced && (ahead || aired) ? "It locks when you watch" : null].filter(Boolean).join(" · "),
    url: `${(first.href || "/").split("#")[0] || "/"}?league=${encodeURIComponent(first.leagueId)}`,
    next: tab ? `/show/${season.id}/tonight?moves=${tab}&game=${first.leagueId}` : `/show/${season.id}/tonight`,
    tag: `reminder-${season.id}`,
  };
}

module.exports = { COOLDOWN, KIND, TAB, shortEp, whenText, splitDue, remindMessage };
