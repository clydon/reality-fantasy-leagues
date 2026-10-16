// Web Push sending, shared by the Next.js API routes and db/wiki-sync.js (the nightly job). Plain
// CommonJS for the same reason state-logic.js is: the standalone script can require() it directly,
// and the Next side imports it through push-core.d.ts. Keep it free of Next.js imports.
//
// The one rule every caller relies on: sendPush NEVER throws. It's always called AFTER the real work
// (a pick, an elimination, a chat message) has been committed, fire-and-forget, the same way
// insertSystemMessage is -- a push service being down, a bad key, or a dead subscription must never
// turn a successful mutation into a failed request.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const webpush = require("web-push");

// Every notification type, in the order the Account settings page lists them. `id` is what's stored
// in notification_prefs.disabled (db/migrations/0010) -- never rename one without migrating that.
// `sample` is what Account settings' per-type "Test" button sends -- worded like the real one
// (push-events.ts / db/reminders.js), with a stand-in league and names.
const NOTIFICATION_TYPES = [
  { id: "draftTurn", label: "It's your turn to draft", description: "When the draft starts or reaches your pick.",
    sample: { title: "You're on the clock", body: "It's your turn to draft in Sample League." } },
  { id: "waivers", label: "Waivers processed", description: "Who you got when waivers process, or that a pickup is still yours to make.",
    sample: { title: "You got Rob and Maggie", body: "Sample League: waivers processed. Free agency is open until Episode 4 airs." } },
  { id: "waiverReminder", label: "Waiver reminders", description: "Six hours before waivers process, if you owe a pickup with no claim in or haven't revealed the episode yet. And your commissioner's nudges.",
    sample: { title: "Waivers process at 8:00 PM EDT", body: "Sample League: you have a pickup to claim." } },
  { id: "reminder", label: "Reminders before an episode", description: "A day and two hours before an episode airs, if your lineup, pick or a prediction is still open.",
    sample: { title: "Sample League: episode 9 airs in about 2 hours", body: "Set your episode 9 lineup (1 empty slot)" } },
  { id: "resultsDue", label: "Results to fill in", description: "Commissioners: the morning after an episode airs, if its results still aren't in.",
    sample: { title: "Sample League: episode 9 needs its results", body: "Nothing's in yet. Copy the question into any AI chat, paste its answer back, then apply." } },
  { id: "episodeResults", label: "Episode results", description: "When an elimination is logged for your league.",
    sample: { title: "Episode 9 results", body: "Results are in · Sample League" } },
  { id: "newBet", label: "New predictions", description: "When someone proposes a prediction you can guess on.",
    sample: { title: "New prediction", body: "“Who finds the next idol?” · Sample League" } },
  { id: "betResult", label: "Prediction results", description: "When your guess on a prediction is graded.",
    sample: { title: "You got it right (+2)", body: "“Who finds the next idol?” — you guessed Kyle" } },
  { id: "chat", label: "League chat", description: "When someone posts in your league's chat.",
    sample: { title: "Sample League", body: "Alex: Did anyone else see that blindside coming?" } },
  { id: "invite", label: "League invites", description: "When you're invited to join a league.",
    sample: { title: "League invite", body: "Alex invited you to Sample League." } },
  { id: "memberJoined", label: "New league members", description: "When someone joins a league you're in.",
    sample: { title: "New league member", body: "Alex joined Sample League." } },
  { id: "wikiReview", label: "Results ready to review", description: "Commissioners: when new episode results arrive from the wiki.",
    sample: { title: "Results ready to review", body: "Episode 9 results for Sample League are waiting for you." } },
];
const TYPE_IDS = new Set(NOTIFICATION_TYPES.map((t) => t.id));

let configured = null; // null = not tried yet, true/false = result
function ensureConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) {
    // Not an error: a dev box or preview deploy without keys simply doesn't send pushes.
    console.warn("[push] VAPID keys not set -- push notifications are disabled");
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } catch (e) {
    console.error("[push] invalid VAPID configuration:", e.message);
    configured = false;
  }
  return configured;
}

// Sends one notification of `type` to every device of every user in `userIds` who hasn't turned
// that type off. `message` = { title, body, url?, tag? } -- `url` is where tapping it goes, `tag`
// collapses repeats on the device (a second "your turn" replaces the first instead of stacking).
//
// `opts.ignorePrefs` skips the per-type opt-out check -- only for the "send test notification"
// button, which has to work even for someone who has switched every real type off.
//
// Resolves to { sent, removed } for tests/logging; never rejects.
async function sendPush(pool, userIds, type, message, opts) {
  const ignorePrefs = !!(opts && opts.ignorePrefs);
  const result = { sent: 0, removed: 0 };
  try {
    if (!TYPE_IDS.has(type)) throw new Error(`unknown notification type "${type}"`);
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length || !ensureConfigured()) return result;

    // One query does both filters: skip anyone who disabled this type, and fetch every device of
    // everyone else. A user with no prefs row has nothing disabled (LEFT JOIN -> NULL -> not
    // disabled), which is what makes every type on by default.
    const { rows } = await pool.query(
      `SELECT s.id, s.endpoint, s.p256dh, s.auth
         FROM push_subscriptions s
         LEFT JOIN notification_prefs p ON p.user_id = s.user_id
        WHERE s.user_id = ANY($1::text[])
          AND ($3 OR COALESCE((p.disabled ->> $2)::boolean, false) = false)`,
      [ids, type, ignorePrefs]
    );
    if (!rows.length) return result;

    const payload = JSON.stringify({
      title: message.title,
      body: message.body,
      url: message.url || "/",
      tag: message.tag || type,
    });

    await Promise.all(
      rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            // A day is plenty: "it's your turn" delivered two days late is noise, not news.
            { TTL: 60 * 60 * 24, urgency: type === "draftTurn" ? "high" : "normal" }
          );
          result.sent++;
          await pool.query("UPDATE push_subscriptions SET last_success_at=now() WHERE id=$1", [sub.id]).catch(() => {});
        } catch (e) {
          // 404/410 = this subscription is gone for good (app uninstalled, permission revoked,
          // browser data cleared). Delete it so future pushes stop paying for a guaranteed failure.
          // Anything else (5xx, network) is transient -- keep the row and try again next time.
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            await pool.query("DELETE FROM push_subscriptions WHERE id=$1", [sub.id]).catch(() => {});
            result.removed++;
          } else {
            console.warn(`[push] send failed (${e && e.statusCode}):`, e && e.message);
          }
        }
      })
    );
  } catch (e) {
    console.error("[push] sendPush failed:", e && e.message);
  }
  return result;
}

// Test hook: lets a unit test swap in a fake web-push and reset the configured-once flag.
function _setWebPushForTests(fake) {
  Object.assign(webpush, fake);
  configured = null;
}

module.exports = { sendPush, NOTIFICATION_TYPES, _setWebPushForTests };
