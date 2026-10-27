// Web Push sending, and the bell's list: the one sender every notification goes through, shared by the Next.js API routes and
// the hourly jobs (db/reminders.js, db/waivers.js). Plain CommonJS for the same reason state-logic.js is: the standalone scripts
// can require() it directly, and the Next side imports it through push-core.d.ts. Keep it free of Next.js imports.
//
// The one rule every caller relies on: sendPush NEVER throws. It's always called AFTER the real work (a pick, an elimination,
// a chat message) has been committed, fire-and-forget, the same way insertSystemMessage is -- a push service being down, a bad
// key, or a dead subscription must never turn a successful mutation into a failed request.
//
// Notifications by moment (docs/PLAN-new-design.md step 15 part 2): a push is worded per reader (`message` may be a function of
// the reader, which is where the spoiler guard decides what the words may say, and in whose time zone), and opens the design
// the reader is on (`next` for the new design, `url` for classic: user_settings.ui). Everyone a notice is for gets it in the
// bell (the `notifications` table, read by the new design's hub), whatever their switches say; the push itself goes only where
// the reader's switches let it (moments.js: the type, its moment for this show) and to devices they've turned on.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const webpush = require("web-push");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const http = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see above
const { chatMode, momentOf, NEW_ONLY, pushAllowed } = require("../moments.js");

// Every notification type, in the order classic's Account settings lists them. `id` is what's stored in
// notification_prefs.disabled (db/migrations/0010) -- never rename one without migrating that. `sample` is what Account
// settings' per-type "Test" button sends -- worded like the real one (push-events.ts / db/reminders.js), with a stand-in
// league and names. Each belongs to one of moments.js's moments; the new design's switches are those.
const NOTIFICATION_TYPES = [
  { id: "draftTurn", label: "It's your turn to draft", description: "When the draft starts or reaches your pick.",
    sample: { title: "You're on the clock", body: "It's your turn to draft in Sample League." } },
  { id: "waivers", label: "Waivers", description: "Who you got when waivers process, or that you still have someone to replace. And when your commissioner opens a waiver window.",
    sample: { title: "You got Rob and Maggie", body: "Sample League: waivers processed. Free agency is open until Episode 4 airs." } },
  { id: "waiverReminder", label: "Waiver reminders", description: "Six hours before claims are due, if you have someone to replace with no claim in or haven't revealed the episode yet. And your commissioner's nudges.",
    sample: { title: "Claims due at 8:00 PM EDT", body: "Sample League: you have someone to replace." } },
  { id: "reminder", label: "Reminders before an episode", description: "A day and two hours before an episode airs, if your lineup, pick or a prediction is still open.",
    sample: { title: "Sample League: episode 9 airs in about 2 hours", body: "Set your episode 9 lineup (1 empty slot)" } },
  { id: "resultsDue", label: "Results to fill in", description: "Commissioners: the morning after an episode airs, if its results still aren't in.",
    sample: { title: "Sample League: episode 9 needs its results", body: "Nothing's in yet. Copy the question into any AI chat, paste its answer back, then apply." } },
  { id: "episodeResults", label: "Episode results", description: "When who went home is in for your show.",
    sample: { title: "Episode 9 results are in", body: "Survivor 50 · Reveal when you've watched." } },
  { id: "finalScores", label: "Final scores", description: "When an episode's full results are in, the morning after.",
    sample: { title: "Episode 9 final scores are in", body: "Survivor 50 · Reveal when you've watched." } },
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
  { id: "couchJoined", label: "New on your couch", description: "When someone joins a couch you're on.",
    sample: { title: "kat joined Couch Council", body: "Say hi in the chat." } },
  { id: "wikiReview", label: "Results ready to review", description: "Commissioners: when new episode results arrive from the wiki.",
    sample: { title: "Results ready to review", body: "Episode 9 results for Sample League are waiting for you." } },
  // The new design's own (moments.js NEW_ONLY): classic's Account settings doesn't list them.
  { id: "gameStarted", label: "A game started", description: "When someone on your couch starts a game.",
    sample: { title: "alex started a game for Survivor", body: "Weekly Lineup on Survivor 50, from Episode 5. Join from the Games tab." } },
  { id: "planned", label: "Watch alongs", description: "When someone invites you to a watch along.",
    sample: { title: "alex planned a watch along", body: "Survivor 50 · Episode 5 · the live airing, Wed 8:00 PM. Are you in?" } },
  { id: "planOff", label: "A watch along called off", description: "When a watch along you were in on is called off.",
    sample: { title: "alex called off Wednesday's watch along", body: "Survivor 50 · Episode 5." } },
  { id: "poll", label: "Polls", description: "When someone on your couch starts a poll.",
    sample: { title: "riley started a poll", body: "Survivor 50 · Episode 5: Who goes home?" } },
  { id: "bingoLine", label: "Bingo", description: "When someone on your couch calls BINGO (on an older card, when a line of yours or theirs counts).",
    sample: { title: "riley called BINGO", body: "Survivor 50 · Episode 5 · Look at their card" } },
  { id: "flagSettled", label: "Flags settled", description: "How a result you flagged was settled.",
    sample: { title: "You were right about Episode 5", body: "Survivor 50 · Kyle · voted out: every game has it put right." } },
  { id: "researchDone", label: "Results you asked for", description: "As each episode's results come in, when you asked our bot to look them up.",
    sample: { title: "Episode 5's results are in", body: "Traitors 5 · 12 results. The Players tab counts them now." } },
];
const TYPE_IDS = new Set(NOTIFICATION_TYPES.map((t) => t.id));

let configured = null; // null = not tried yet, true/false = result
function ensureConfigured() {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) {
    // Not an error: a dev box or preview deploy without keys simply doesn't send pushes (the bell still keeps them).
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

/**
 * The people a notice is for, with what decides their words and whether it's pushed: the design they're on, their time zone
 * (kept from their phone), their switches, Couch chat's choice and what they've turned off for this season's show.
 */
async function readersOf(db, ids, seasonId) {
  const { rows } = await db.query(
    `SELECT u.id AS user_id, s.ui, s.tz, p.disabled, p.chat,
            CASE WHEN $2::uuid IS NULL THEN NULL ELSE p.shows -> (SELECT show_id::text FROM show_seasons WHERE id = $2::uuid) END AS show_off
       FROM "user" u LEFT JOIN user_settings s ON s.user_id = u.id LEFT JOIN notification_prefs p ON p.user_id = u.id
      WHERE u.id = ANY($1::text[])`,
    [ids, seasonId || null]
  );
  const byId = new Map(rows.map((r) => [r.user_id, r]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const r = byId.get(id);
      return {
        userId: id,
        ui: r.ui === "new" ? "new" : "classic",
        tz: r.tz || null,
        chat: chatMode(r.disabled, r.chat),
        disabled: r.disabled || {},
        showOff: Array.isArray(r.show_off) ? r.show_off : [],
      };
    });
}

/**
 * Keeps a notice in the reader's bell. False when its key is there already (it was told before: nothing more to do, the push
 * included). Rows older than 30 days go in the same statement, so the list never needs a job to tidy it.
 */
async function keep(db, userId, type, words, seasonId) {
  const { rows } = await db.query(
    `WITH gone AS (DELETE FROM notifications WHERE user_id = $1 AND created_at < now() - interval '30 days')
     INSERT INTO notifications (user_id, type, key, season_id, title, body, link, spoils, safe)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, key) WHERE key IS NOT NULL DO NOTHING RETURNING id`,
    [
      userId,
      type,
      words.key || null,
      words.seasonId || seasonId || null,
      words.title,
      words.body,
      words.next || "/home",
      Number.isInteger(words.spoils) ? words.spoils : null,
      words.safe ? JSON.stringify(words.safe) : null,
    ]
  );
  return rows.length > 0;
}

// A loopback push service in development (scripts/dev-test/fake-push.js): web-push only speaks https, so a dev server sends
// the same encrypted, signed request over plain http to 127.0.0.1. Never in production.
function loopback(endpoint) {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  } catch {
    return false;
  }
}

function postPlain(details) {
  return new Promise((resolve, reject) => {
    const u = new URL(details.endpoint);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: details.method, headers: details.headers }, (res) => {
      res.resume();
      res.on("end", () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve() : reject(Object.assign(new Error(`push service ${res.statusCode}`), { statusCode: res.statusCode }))));
    });
    req.on("error", reject);
    req.end(details.body);
  });
}

async function deliver(sub, payload, options) {
  const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
  if (loopback(sub.endpoint)) return postPlain(webpush.generateRequestDetails(subscription, payload, options));
  return webpush.sendNotification(subscription, payload, options);
}

// Sends one notification of `type` to each of `userIds`: worded for each (`message`, or `message(reader)` -> words or null for
// nobody), kept in each one's bell, and pushed to every device of everyone whose switches let it through.
//
// Words: { title, body, url (classic's link), next (the new design's), tag (collapses repeats on a device: a second "your turn"
// replaces the first), key (once per person: a notice with a key someone already has is neither kept nor pushed again),
// seasonId, spoils + safe (the episode the words give away, and the words for someone not past it: the bell reads rows back
// through the guard), anyOf (any of these types on is enough to push) }.
//
// opts: { seasonId (whose show's switches apply), bell: false (push only: chat), ignorePrefs (the "send test notification"
// button, which has to work even for someone who has switched every real type off; nothing kept) }.
//
// Resolves to { sent, removed, kept } for tests/logging; never rejects.
async function sendPush(pool, userIds, type, message, opts) {
  const o = opts || {};
  const result = { sent: 0, removed: 0, kept: 0 };
  try {
    if (!TYPE_IDS.has(type)) throw new Error(`unknown notification type "${type}"`);
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) return result;
    const readers = await readersOf(pool, ids, o.seasonId);
    const out = [];
    for (const reader of readers) {
      let words;
      try {
        words = typeof message === "function" ? await message(reader) : message;
      } catch (e) {
        console.error(`[push] ${type} words for ${reader.userId} failed:`, e && e.message);
        continue;
      }
      if (!words) continue;
      if (!o.ignorePrefs && o.bell !== false && type !== "chat") {
        if (!(await keep(pool, reader.userId, type, words, o.seasonId))) continue;
        result.kept++;
      }
      if (!o.ignorePrefs) {
        if (!pushAllowed(type, reader.disabled, reader.showOff, words.anyOf)) continue;
        // Something only the new design can open isn't pushed to someone on classic (it's in their bell for later).
        if (NEW_ONLY.has(type) && reader.ui !== "new") continue;
      }
      out.push({ reader, words });
    }
    if (!out.length || !ensureConfigured()) return result;

    const { rows } = await pool.query("SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ANY($1::text[])", [
      out.map((x) => x.reader.userId),
    ]);
    if (!rows.length) return result;
    const byUser = new Map(out.map((x) => [x.reader.userId, x]));

    await Promise.all(
      rows.map(async (sub) => {
        const { reader, words } = byUser.get(sub.user_id);
        const payload = JSON.stringify({
          title: words.title,
          body: words.body,
          // The design they're on (step 15 part 2): the new design's page, or classic's.
          url: reader.ui === "new" ? words.next || "/home" : words.url || "/",
          tag: words.tag || type,
        });
        try {
          // A day is plenty: "it's your turn" delivered two days late is noise, not news.
          await deliver(sub, payload, { TTL: 60 * 60 * 24, urgency: type === "draftTurn" ? "high" : "normal" });
          result.sent++;
          await pool.query("UPDATE push_subscriptions SET last_success_at=now() WHERE id=$1", [sub.id]).catch(() => {});
        } catch (e) {
          // 404/410 = this subscription is gone for good (app uninstalled, permission revoked, browser data cleared). Delete
          // it so future pushes stop paying for a guaranteed failure. Anything else (5xx, network) is transient -- keep the
          // row and try again next time.
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

module.exports = { sendPush, NOTIFICATION_TYPES, momentOf, loopback, _setWebPushForTests };
