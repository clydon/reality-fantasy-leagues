// The moments people choose their notifications by (docs/PLAN-new-design.md step 15 part 2; settings Round 1,
// docs/design-round/settings-r1-spec.md): a moment is a few of push-core.js's notification types, so classic's per-type switches
// and the new design's per-moment ones are one setting (notification_prefs.disabled, still keyed by type). Plain CommonJS with no
// imports: push-core.js require()s it under bare node (the hourly jobs), and the new design's Settings and a show's ⋯ menu import it.
//
// A moment is on only while every one of its types is (settings Round 1: a switch that read On while classic had one of its types
// off said you'd hear something you wouldn't); switching it writes all of its types, so turning it on mends a mix. A type added
// later is on for everyone, as push-core's types always were. Round 1's moments, named for what reaches you:
//   - Reminders before your moves lock (picks, lineups, your draft turn, waivers);
//   - Results (who went home soon after the episode, then the final scores at noon the next day: one switch since Round 1, C2);
//   - Your couch's activity;
//   - Invites and join requests, always on with no switch (`fixed`: someone's waiting on you, C3);
//   - Couch chat, a choice of three: Every message, Skip possible spoilers (the recommended one: nothing while a message is folded
//     for you) or Never (the `chat` type off). A couch can set its own (couch_members.chat_notify, push-core's readersOf).
// A show's own switches (notification_prefs.shows) turn a moment off for that show alone, and muting a show
// (notification_prefs.muted) quiets everything of it but the reminders. The Backstage moment went in Round 1 (C4): its two types
// are RETIRED, never sent.

const MOMENTS = [
  {
    id: "lineup",
    title: "Reminders before your moves lock",
    line: "Only while a pick, lineup, draft turn or waiver claim is still open",
    types: ["reminder", "waiverReminder", "draftTurn", "waivers"],
    perShow: true,
  },
  {
    id: "results",
    title: "Results",
    line: "Who went home soon after the episode, then the final scores at noon the next day",
    types: ["episodeResults", "finalScores", "betResult", "flagSettled", "researchDone", "resultsChanged"],
    perShow: true,
  },
  {
    id: "couch",
    title: "Your couch's activity",
    line: "A new game, a watch along, a poll or prediction to answer, a bingo line",
    types: ["gameStarted", "planned", "planOff", "poll", "newBet", "bingoLine"],
    perShow: true,
  },
  {
    id: "invites",
    title: "Invites and join requests",
    line: "Always on: someone's waiting on you",
    types: ["invite", "memberJoined", "couchJoined"],
    perShow: false,
    fixed: true,
  },
  { id: "chat", title: "Couch chat", line: "Every message, skip possible spoilers, or never", types: ["chat"], perShow: true },
];

/** Types no moment covers any more, and that are never sent: Backstage's results to fill in, and wiki results to review (C4). */
const RETIRED = new Set(["resultsDue", "wikiReview"]);

/** Couch chat's three choices. */
const CHAT_CHOICES = [
  { id: "all", title: "Every message", line: "Each one buzzes as it's sent" },
  {
    id: "quiet",
    title: "Skip possible spoilers",
    line: "A message that might be about an episode you haven't watched doesn't buzz. Read it once you've caught up",
    recommended: true,
  },
  { id: "off", title: "Never", line: "No chat notifications. Read it when you open a show's chat" },
];

const MOMENT_OF = new Map(MOMENTS.flatMap((m) => m.types.map((t) => [t, m.id])));
/** A show's offs saved before Round 1 by the old ids (Early results, Final results): either is Results now. */
const LEGACY = { early: "results", final: "results" };

/**
 * Types only the new design has a page for (a poll, a planned night, a flag...): pushed only to someone on the new design, since
 * classic's own screens can't open them. Their notices still go in the bell, for the day they switch.
 */
const NEW_ONLY = new Set(["gameStarted", "planned", "planOff", "poll", "bingoLine", "flagSettled", "researchDone", "resultsChanged"]);

/** The moment a notification type belongs to (null for a retired one). */
function momentOf(type) {
  return MOMENT_OF.get(type) || null;
}

/** Whether a moment is on, from notification_prefs.disabled (a missing row: everything on): every one of its types on. */
function momentOn(moment, disabled) {
  const m = MOMENTS.find((x) => x.id === moment);
  if (!m) return false;
  if (m.fixed) return true;
  return m.types.every((t) => !(disabled && disabled[t]));
}

/** Couch chat's choice: Never when the `chat` type is off, else notification_prefs.chat (NULL: quiet, the recommended one). */
function chatMode(disabled, chat) {
  if (disabled && disabled.chat) return "off";
  return chat === "all" ? "all" : "quiet";
}

/** A show's offs as moment ids, the old Early and Final results read as Results. */
function showOffSet(showOff) {
  return new Set((Array.isArray(showOff) ? showOff : []).map((id) => LEGACY[id] || id));
}

/** Whether a mute (notification_prefs.muted's value for one show: an ISO end, or "forever") holds at `now` (ms). */
function mutedNow(until, now) {
  if (!until) return false;
  if (until === "forever") return true;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > (now == null ? Date.now() : now);
}

/**
 * Whether a push of `type` reaches someone, from their switches: the type isn't off, nor its moment for this show (`showOff`: the
 * moments they've turned off for the show it's about), nor the show muted (`extra.muted`; reminders before your moves lock still
 * come). `anyOf`: any of these types being on is enough (results that arrive final at once are both early and final). Invites
 * always come. Couch chat goes by `extra.chat` when the sender knows the couch (that couch's own choice over the account's).
 */
function pushAllowed(type, disabled, showOff, anyOf, extra) {
  if (RETIRED.has(type)) return false;
  const off = showOffSet(showOff);
  const x = extra || {};
  const mo = momentOf(type);
  if (mo && MOMENTS.find((m) => m.id === mo).fixed) return true;
  if (x.muted && mo !== "lineup") return false;
  if (type === "chat" && x.chat) return x.chat !== "off" && !off.has("chat");
  const types = anyOf && anyOf.length ? anyOf : [type];
  return types.some((t) => !(disabled && disabled[t]) && !off.has(momentOf(t)));
}

module.exports = { MOMENTS, RETIRED, CHAT_CHOICES, NEW_ONLY, momentOf, momentOn, chatMode, showOffSet, mutedNow, pushAllowed };
