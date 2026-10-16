// Every push mid-season waivers send (docs/PLAN-midseason-waivers.md, phase 3; the canvas's board 11),
// in one place: who hears what when a week processes, the reminders six hours before it does, a
// commissioner's Nudge, and the line the results push gains when results open a week.
//
// Plain CommonJS, like waivers.js beside it: withLeagueLock (db.ts) sends "Waivers processed" when a
// week processes during a request (lazily, or on Process now), and the hourly job (db/waivers.js) when
// it processes one on schedule with nobody looking. Both call sendProcessed, so a week is announced
// once, by whoever processed it. Keep it free of Next.js imports.
//
// Spoilers: whether you're owed a pickup says one of yours left, so nothing here names a castaway, or
// says you're owed anything, to someone who hasn't revealed the week's episode. They get the same
// words whatever happened ("Waivers processed", "reveal Episode 3 before then"), and they get them
// every week, owed or not, so even being sent one gives nothing away.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const StateLogic = require("../game/state-logic.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const { waiversHref } = require("../game/action-items.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const { sendPush } = require("./push-core.js");

const W = StateLogic.WaiverLogic;
const HOUR = 3600 * 1000;
// How long before processing the reminder goes out.
const REMIND_BEFORE = 6 * HOUR;
const DEFAULT_TZ = "America/New_York";

// ---- Times, in the season's zone (a push can't know the reader's) ----

/** The league's season's time zone, the one its air times are in. */
async function seasonTz(db, state) {
  const { showId, wikiSeason } = state.settings || {};
  if (!showId || wikiSeason == null) return DEFAULT_TZ;
  const { rows } = await db.query(
    "SELECT ss.air_tz FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug=$1 AND ss.season_number=$2",
    [showId, wikiSeason]
  );
  return (rows[0] && rows[0].air_tz) || DEFAULT_TZ;
}

/** "Tue 8:00 PM EDT"; `day: false` gives "8:00 PM EDT". */
function clock(iso, tz, day = true) {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || DEFAULT_TZ,
    weekday: day ? "short" : undefined,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
  return text.replace(", ", " ");
}

function link(path, leagueId) {
  return `${path}?league=${encodeURIComponent(leagueId)}`;
}

function andList(items) {
  return items.length <= 1 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function firstName(state, id) {
  const c = StateLogic.getCastaway(state, id);
  return c ? c.name.split(" ")[0] : "someone";
}

async function leagueName(db, leagueId) {
  const { rows } = await db.query("SELECT name FROM leagues WHERE id=$1", [leagueId]);
  return (rows[0] && rows[0].name) || "your league";
}

// ---- Who's in it ----

/**
 * Everyone in this league's waivers who has an account, with how far they've revealed: `seen` is
 * their mark (results-seen.ts), Infinity when they see results as they come (Account settings), -1 when
 * they've no mark yet (never opened the league since spoiler protection: treated as not revealed, the
 * safe way round). A late joiner always goes by their mark. Computer players and seats with no
 * account have nobody to tell.
 */
async function members(db, leagueId, state) {
  const { rows } = await db.query(
    `SELECT m.user_id, m.player_id, m.results_seen_through, COALESCE(us.show_results_immediately, false) AS immediate
       FROM league_memberships m LEFT JOIN user_settings us ON us.user_id = m.user_id
      WHERE m.league_id=$1 AND m.player_id IS NOT NULL`,
    [leagueId]
  );
  const rotation = new Set(W.rotation(state));
  return rows
    .filter((r) => rotation.has(r.player_id))
    .map((r) => {
      const late = StateLogic.GhostLogic.lateJoinOf(state, r.player_id);
      const mark = Number.isInteger(r.results_seen_through) ? r.results_seen_through : -1;
      return { userId: r.user_id, playerId: r.player_id, seen: r.immediate && !late ? Infinity : mark };
    });
}

// ---- Waivers processed ----

/** Where a week stands before a mutation, to tell afterwards whether it just processed. */
function snapshot(state) {
  const p = W.current(state);
  return p ? { id: p.id, runAt: p.run ? p.run.at : null } : null;
}

/** The week that processed since `before` and is still in free agency, else null. A week that
 *  processed and closed in one go (a later episode's results arrived) has nothing left to announce. */
function justProcessed(before, state) {
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || p.phase !== "processed" || !p.run) return null;
  if (before && before.id === p.id && before.runAt === p.run.at) return null;
  return p;
}

/** "Free agency is open until Episode 4 airs." ("" with free agency off). */
function freeAgencyLine(state, period) {
  if (!W.freeAgencyOn(state)) return "";
  const n = period.episode + 1;
  return period.closesAt ? `Free agency is open until Episode ${n} airs.` : `Free agency is open until Episode ${n}'s results.`;
}

/**
 * One message per member for a week that just processed, or none for them. Not revealed: the same
 * "Waivers processed" for everyone. Revealed: who you got, or that your claims missed, or that a
 * pickup's still yours to make; nothing at all for someone the week didn't touch, except on an
 * add/drop week with free agency, where an unused add/drop is still theirs.
 */
function processedMessages(state, period, name, people) {
  const n = period.episode;
  const fa = freeAgencyLine(state, period);
  const base = waiversHref(state);
  const out = [];
  for (const m of people) {
    if (m.seen < n) {
      out.push({ userId: m.userId, message: { title: "Waivers processed", body: `${name}: reveal Episode ${n} to see every move.`, url: base } });
      continue;
    }
    const mine = period.run.results.filter((r) => r.playerId === m.playerId);
    const got = mine.filter((r) => r.outcome === "got" && r.castawayId);
    const missed = mine.some((r) => r.outcome === "missed");
    const owed = W.pickupsOwed(state, m.playerId).count;
    const until = `Episode ${n + 1} ${period.closesAt ? "airs" : "is in"}`;
    const fill = W.freeAgencyOn(state) ? `choose one from free agency before ${until}.` : `one is assigned when ${until}.`;
    const stillOwed = owed ? `You still have a pickup: ${fill}` : "";
    let title;
    let body;
    if (got.length) {
      title = `You got ${andList(got.map((r) => firstName(state, r.castawayId)))}`;
      body = `${name}: waivers processed. ${stillOwed || fa}`;
    } else if (missed) {
      title = "Your claim didn’t go through";
      body = `${name}: someone got there first. ${stillOwed || fa}`;
    } else if (owed) {
      title = "You still have a pickup";
      body = `${name}: waivers processed, ${fill}`;
    } else if (period.addDrop && fa && !W.addDropUsed(state, period, m.playerId)) {
      title = "Waivers processed";
      body = `${name}: ${fa} Your add/drop is still unused.`;
    } else continue;
    out.push({ userId: m.userId, message: { title, body: body.trim(), url: `${base}/results/${n}` } });
  }
  return out;
}

/** Sends "Waivers processed" for `period`. Never throws (it runs after the write has committed). */
async function sendProcessed(db, leagueId, state, period, opts = {}) {
  try {
    const [name, people] = await Promise.all([leagueName(db, leagueId), members(db, leagueId, state)]);
    const msgs = processedMessages(state, period, name, people);
    for (const { userId, message } of msgs) {
      const full = { ...message, url: link(message.url, leagueId), tag: `waivers-${leagueId}` };
      if (opts.log) opts.log(`${opts.dry ? "(dry) " : ""}${userId} -- ${full.title}: ${full.body}`);
      if (!opts.dry) await sendPush(db, [userId], "waivers", full);
    }
    return msgs.length;
  } catch (e) {
    console.error(`[waivers] processed push for ${leagueId} failed:`, e && e.message);
    return 0;
  }
}

// ---- Six hours before processing ----

/**
 * The reminders before a week processes (once each, reminder_log): anyone owed a pickup with no claim
 * in hears they have one to claim; anyone who hasn't revealed the episode hears to reveal it first,
 * owed or not. Optional add/drops get no reminder. A held week (after an Undo) has no time to remind
 * about. Returns how many were sent.
 */
async function remindWaivers(db, league, now, opts = {}) {
  const state = league.state;
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || p.phase !== "open" || p.hold || !p.processAt) return 0;
  const left = Date.parse(p.processAt) - now;
  if (!(left > 0 && left <= REMIND_BEFORE)) return 0;
  const n = p.episode;
  const tz = await seasonTz(db, state);
  let sent = 0;
  for (const m of await members(db, league.id, state)) {
    let kind;
    let body;
    if (m.seen < n) {
      kind = "waiverReveal";
      body = `${league.name}: reveal Episode ${n} before then to make any claims.`;
    } else if (W.pickupsOwed(state, m.playerId).count && !p.claimsIn.includes(m.playerId)) {
      kind = "waiverPickup";
      body = `${league.name}: you have a pickup to claim.`;
    } else continue;
    if (!opts.dry) {
      const { rowCount } = await db.query(
        `INSERT INTO reminder_log (user_id, league_id, kind, episode_number, reminder_window)
         VALUES ($1,$2,$3,$4,'6h') ON CONFLICT DO NOTHING`,
        [m.userId, league.id, kind, n]
      );
      if (!rowCount) continue;
    }
    const message = {
      title: `Waivers process at ${clock(p.processAt, tz, false)}`,
      body,
      url: link(kind === "waiverPickup" ? `${waiversHref(state)}/pickup` : waiversHref(state), league.id),
      tag: `waivers-${league.id}`,
    };
    if (opts.log) opts.log(`${opts.dry ? "(dry) " : ""}${m.userId} -- ${message.title}: ${message.body}`);
    if (!opts.dry) await sendPush(db, [m.userId], "waiverReminder", message);
    sent++;
  }
  return sent;
}

// ---- Nudge ----

/**
 * The commissioner's Nudge to one player, worded for what that player may know: not revealed, reveal
 * first; owed a pickup, claim it; otherwise the week's add/drop. { userIds, message }, or null when
 * the player has no account to reach.
 */
async function nudgeMessage(db, leagueId, state, playerId, byName) {
  const p = W.current(state);
  if (!p) return null;
  const m = (await members(db, leagueId, state)).filter((x) => x.playerId === playerId);
  if (!m.length) return null;
  const [name, tz] = await Promise.all([leagueName(db, leagueId), seasonTz(db, state)]);
  const n = p.episode;
  const what =
    m[0].seen < n
      ? `Reveal Episode ${n} before then to make any claims.`
      : W.pickupsOwed(state, playerId).count
        ? "You have a pickup to claim."
        : "Add/drops are open, if you want one.";
  return {
    userIds: m.map((x) => x.userId),
    message: {
      title: p.hold || !p.processAt ? "Waivers are open" : `Waivers process ${clock(p.processAt, tz)}`,
      body: `${name}: ${byName} nudged you. ${what}`,
      url: link(waiversHref(state), leagueId),
      tag: `waivers-${leagueId}`,
    },
  };
}

// ---- The results push's extra line ----

/** " Waivers process Tue 8:00 PM EDT." when episode `n`'s results opened this week, else "". It goes
 *  out every week, to everyone, so it says nothing about who left. */
async function resultsLine(db, state, n) {
  const p = W.enabled(state) ? W.current(state) : null;
  if (!p || p.episode !== n || p.phase !== "open" || p.hold || !p.processAt) return "";
  return ` Waivers process ${clock(p.processAt, await seasonTz(db, state))}.`;
}

module.exports = {
  seasonTz,
  clock,
  snapshot,
  justProcessed,
  processedMessages,
  sendProcessed,
  remindWaivers,
  nudgeMessage,
  resultsLine,
  REMIND_BEFORE,
};
