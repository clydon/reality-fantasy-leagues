// Every push mid-season waivers send (docs/PLAN-midseason-waivers.md, phase 3; the canvas's board 11),
// in one place: who hears what when a week processes, the reminders six hours before it does, a
// commissioner's Nudge, the line the results push gains when results open a week, and (waivers v2,
// docs/PLAN-waivers-v2.md phase 3) "Waiver window open" when the commissioner opens, changes or turns
// off a window, with a notice to anyone whose claim it trimmed.
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
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const { windowLine } = require("../game/waiver-words.js");

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
    const owed = W.replacementsOwed(state, m.playerId, period).count;
    const until = `Episode ${n + 1} ${period.closesAt ? "airs" : "is in"}`;
    const fill = W.freeAgencyOn(state)
      ? `choose from free agency before ${until}.`
      : W.autoFillOn(state)
        ? `you get the top free agent when ${until}.`
        : "no claim, no replacement this week.";
    const stillOwed = owed ? `You still have someone to replace: ${fill}` : "";
    let title;
    let body;
    if (got.length) {
      title = `You got ${andList(got.map((r) => firstName(state, r.castawayId)))}`;
      body = `${name}: waivers processed. ${stillOwed || fa}`;
    } else if (missed) {
      title = "Your claim didn’t go through";
      body = `${name}: someone got there first. ${stillOwed || fa}`;
    } else if (owed) {
      title = "You still have someone to replace";
      body = `${name}: waivers processed, ${fill}`;
    } else if (fa && W.swapsLeft(state, period, m.playerId) > 0) {
      title = "Waivers processed";
      body = `${name}: ${fa} Your swap is still unused.`;
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
    } else if (W.replacementsOwed(state, m.playerId, p).count && !p.claimsIn.includes(m.playerId)) {
      kind = "waiverPickup";
      body = `${league.name}: you have someone to replace.`;
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
      title: `Claims due at ${clock(p.processAt, tz, false)}`,
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
      : W.replacementsOwed(state, playerId, p).count
        ? "You have someone to replace."
        : "A waiver window is open, if you want to swap.";
  return {
    userIds: m.map((x) => x.userId),
    message: {
      title: p.hold || !p.processAt ? "Waivers are open" : `Claims due ${clock(p.processAt, tz)}`,
      body: `${name}: ${byName} nudged you. ${what}`,
      url: link(waiversHref(state), leagueId),
      tag: `waivers-${leagueId}`,
    },
  };
}

// ---- Open a waiver window ----

/** The running week as a window, before the commissioner's change: { id, line, processAt }, or null
 *  when no window is open (so whatever happens next is news). */
function windowSnapshot(state) {
  const p = W.current(state);
  if (!p || p.phase !== "open" || !W.isWindow(p)) return null;
  return { id: p.id, line: windowLine(state, p), processAt: p.processAt || null };
}

/**
 * One message per member after the commissioner opened, changed or turned off a waiver window, or
 * none for them. Everyone in the rotation hears the window's line, the same no-names words the sheet
 * previewed ("Waiver window open: Replace who's out · Swap up to 2"), whatever they've revealed:
 * someone who hasn't is told to reveal the episode first, nothing more. A change that leaves the line
 * and the deadline as they were tells nobody. Anyone whose claim lost pairs (`trimmed`) hears that
 * instead. Turning a window off tells the rotation it's off, if it was a window. The commissioner who
 * did it (`opts.actorUserId`) hears nothing.
 */
function windowMessages(state, before, period, name, people, trimmed, tz, opts = {}) {
  const n = period.episode;
  const url = waiversHref(state);
  const cut = new Set(trimmed || []);
  const timed = period.phase === "open" && !period.hold && period.processAt;
  const due = timed ? `claims due ${clock(period.processAt, tz)}` : "claims are open";
  const on = period.phase === "open" && W.isWindow(period);
  const line = on ? windowLine(state, period) : "";
  const changed = !!before && before.id === period.id;
  const same = on && changed && before.line === line && before.processAt === (period.processAt || null);
  const closed = period.phase === "closed";
  const out = [];
  for (const m of people) {
    if (opts.actorUserId && m.userId === opts.actorUserId) continue;
    let title;
    let body;
    if (on && cut.has(m.playerId)) {
      title = "Your claim changed";
      body = `${name}: the waiver window changed, so claims it no longer allows came out. Check yours${timed ? ` before ${clock(period.processAt, tz)}` : ""}.`;
    } else if (!on && cut.has(m.playerId)) {
      title = closed ? "Your claims came out" : "Your swaps came out";
      body = `${name}: the waiver window was turned off, so your ${closed ? "claims" : "swaps"} came out.`;
    } else if (on && !same) {
      title = line ? `Waiver window open: ${line}` : "Waiver window open";
      body = m.seen < n
        ? `${name}: ${due}. Reveal Episode ${n} first to make yours.`
        : `${name}: ${changed ? "changed" : "optional"} · ${due}.`;
    } else if (!on && before) {
      title = "Waiver window off";
      body = `${name}: your commissioner turned it off. ${closed ? "Nothing to claim this week." : "No swaps this week."}`;
    } else continue;
    out.push({ userId: m.userId, message: { title, body, url } });
  }
  return out;
}

/**
 * Sends windowMessages for the week `periodId` once the commissioner's change has committed. `before`
 * is windowSnapshot from before it; `trimmed`, waivers.js openWindow's. Never throws; resolves to how
 * many were sent.
 */
async function sendWindow(db, leagueId, state, before, periodId, trimmed, opts = {}) {
  try {
    const period = W.periods(state).find((p) => p.id === periodId);
    if (!period) return 0;
    const [name, people, tz] = await Promise.all([leagueName(db, leagueId), members(db, leagueId, state), seasonTz(db, state)]);
    const msgs = windowMessages(state, before, period, name, people, trimmed, tz, opts);
    for (const { userId, message } of msgs) {
      const full = { ...message, url: link(message.url, leagueId), tag: `waivers-${leagueId}` };
      if (opts.log) opts.log(`${opts.dry ? "(dry) " : ""}${userId} -- ${full.title}: ${full.body}`);
      if (!opts.dry) await sendPush(db, [userId], "waivers", full);
    }
    return msgs.length;
  } catch (e) {
    console.error(`[waivers] window push for ${leagueId} failed:`, e && e.message);
    return 0;
  }
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
  windowSnapshot,
  windowMessages,
  sendWindow,
  resultsLine,
  REMIND_BEFORE,
};
