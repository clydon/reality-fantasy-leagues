// The moments people choose their notifications by (docs/PLAN-new-design.md step 15 part 2; the mock's settings.js "What we
// notify you about"): a moment is a few of push-core.js's notification types, so classic's per-type switches and the new
// design's per-moment ones are one setting (notification_prefs.disabled, still keyed by type). Plain CommonJS with no imports:
// push-core.js require()s it under bare node (the hourly jobs), and the new design's Settings and a show's ⋯ menu import it.
//
// A moment is on while any of its types is (a type added later is on for everyone, as push-core's types always were);
// switching it writes all of its types. Couch chat is a choice of three: Every message, Quiet on episode nights (the
// recommended one: nothing while a message is folded for you) or Never (the `chat` type off). A show's own switches
// (notification_prefs.shows) turn a moment off for that show alone.

const MOMENTS = [
  {
    id: "lineup",
    title: "Lineup reminders",
    line: "Before your moves lock, only if something's open. And your turn to draft, and waivers",
    types: ["reminder", "waiverReminder", "draftTurn", "waivers"],
    perShow: true,
  },
  { id: "early", title: "Early results are in", line: "Who went home, minutes after the episode", types: ["episodeResults"], perShow: true },
  { id: "final", title: "Final scores are in", line: "The morning after. And how your predictions and flags went, and results you asked for", types: ["finalScores", "betResult", "flagSettled", "researchDone"], perShow: true },
  {
    id: "invites",
    title: "Invites and join requests",
    line: "Someone joins your couch or asks to join a game",
    types: ["invite", "memberJoined", "couchJoined"],
    perShow: false,
  },
  {
    id: "couch",
    title: "On the couch",
    line: "A new game, a watch along planned or called off, a poll or prediction to answer, a bingo line",
    types: ["gameStarted", "planned", "planOff", "poll", "newBet", "bingoLine"],
    perShow: true,
  },
  { id: "backstage", title: "Backstage", line: "If you run a game: results still to fill in the morning after", types: ["resultsDue", "wikiReview"], perShow: true },
  { id: "chat", title: "Couch chat", line: "Every message, quiet on episode nights, or never", types: ["chat"], perShow: true },
];

/** Couch chat's three choices, in the mock's order. */
const CHAT_CHOICES = [
  { id: "all", title: "Every message", line: "" },
  { id: "quiet", title: "Quiet on episode nights", line: "Catch up when you reveal", recommended: true },
  { id: "off", title: "Never", line: "Check chat when you open the app" },
];

const MOMENT_OF = new Map(MOMENTS.flatMap((m) => m.types.map((t) => [t, m.id])));

/**
 * Types only the new design has a page for (a poll, a planned night, a flag...): pushed only to someone on the new design, since
 * classic's own screens can't open them. Their notices still go in the bell, for the day they switch.
 */
const NEW_ONLY = new Set(["gameStarted", "planned", "planOff", "poll", "bingoLine", "flagSettled", "researchDone"]);

/** The moment a notification type belongs to (null for one that isn't anyone's, which can't happen for a known type). */
function momentOf(type) {
  return MOMENT_OF.get(type) || null;
}

/** Whether a moment is on, from notification_prefs.disabled (a missing row: everything on). */
function momentOn(moment, disabled) {
  const m = MOMENTS.find((x) => x.id === moment);
  if (!m) return false;
  return m.types.some((t) => !(disabled && disabled[t]));
}

/** Couch chat's choice: Never when the `chat` type is off, else notification_prefs.chat (NULL: quiet, the recommended one). */
function chatMode(disabled, chat) {
  if (disabled && disabled.chat) return "off";
  return chat === "all" ? "all" : "quiet";
}

/**
 * Whether a push of `type` reaches someone, from their switches: the type isn't off, nor its moment for this show (`showOff`:
 * the moments they've turned off for the show it's about). `anyOf`: any of these types being on is enough (results that arrive
 * final at once are both early and final).
 */
function pushAllowed(type, disabled, showOff, anyOf) {
  const types = anyOf && anyOf.length ? anyOf : [type];
  const off = new Set(Array.isArray(showOff) ? showOff : []);
  return types.some((t) => !(disabled && disabled[t]) && !off.has(momentOf(t)));
}

module.exports = { MOMENTS, CHAT_CHOICES, NEW_ONLY, momentOf, momentOn, chatMode, pushAllowed };
