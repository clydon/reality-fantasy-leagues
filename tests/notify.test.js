// Notifications by moment (docs/PLAN-new-design.md step 15 part 2): the moments over classic's notification types
// (src/lib/moments.js), and push-core.js's one sender: words worked out per reader, the bell kept for everyone whatever their
// switches say (once per key), the push only where the reader's switches let it, opening the design the reader is on, and the
// new design's own moments never pushed to someone on classic. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../src/lib/moments.js");
const core = require("../src/lib/server/push-core.js");

test("every notification type belongs to exactly one moment, or is retired; every moment's types exist", () => {
  const ids = core.NOTIFICATION_TYPES.map((t) => t.id);
  for (const id of ids) assert.ok(M.momentOf(id) || M.RETIRED.has(id), `${id} has a moment`);
  const all = M.MOMENTS.flatMap((m) => m.types);
  assert.equal(new Set(all).size, all.length, "no type in two moments");
  assert.deepEqual([...all, ...M.RETIRED].sort(), [...ids].sort());
  for (const t of M.NEW_ONLY) assert.ok(ids.includes(t));
});

test("a moment is on only while every one of its types is (settings Round 1); invites always; Couch chat's three choices", () => {
  assert.equal(M.momentOn("lineup", {}), true);
  assert.equal(M.momentOn("lineup", { reminder: true }), false, "classic turned one type off: the switch says off, never a reminder that won't come");
  assert.equal(M.momentOn("lineup", { reminder: true, waiverReminder: true, draftTurn: true, waivers: true }), false);
  assert.equal(M.momentOn("results", null), true);
  assert.equal(M.momentOn("invites", { invite: true }), true, "invites have no switch: always on");
  assert.equal(M.chatMode({}, null), "quiet", "the recommended one by default");
  assert.equal(M.chatMode({}, "all"), "all");
  assert.equal(M.chatMode({ chat: true }, "all"), "off", "classic's chat switch off is Never");
});

test("a push needs its type on and its moment on for the show; results that arrive final need either", () => {
  assert.equal(M.pushAllowed("reminder", {}, []), true);
  assert.equal(M.pushAllowed("reminder", { reminder: true }, []), false);
  assert.equal(M.pushAllowed("reminder", {}, ["lineup"]), false, "lineup reminders off for this show");
  assert.equal(M.pushAllowed("chat", {}, ["chat"]), false);
  assert.equal(M.pushAllowed("finalScores", { finalScores: true }, [], ["episodeResults", "finalScores"]), true, "early on is enough");
  assert.equal(M.pushAllowed("finalScores", { finalScores: true, episodeResults: true }, [], ["episodeResults", "finalScores"]), false);
  assert.equal(M.pushAllowed("finalScores", {}, ["early", "final"], ["episodeResults", "finalScores"]), false);
  assert.equal(M.pushAllowed("episodeResults", {}, ["early"]), false, "a show's old Early results off reads as Results off");
  assert.equal(M.pushAllowed("finalScores", {}, ["results"]), false);
});

test("invites always come; retired types never; a muted show keeps only the reminders; a couch's own chat choice", () => {
  assert.equal(M.pushAllowed("invite", { invite: true }, []), true, "no switch can leave an invite stuck off");
  assert.equal(M.pushAllowed("resultsDue", {}, []), false, "Backstage's results push went in Round 1 (C4)");
  assert.equal(M.pushAllowed("episodeResults", {}, [], null, { muted: true }), false);
  assert.equal(M.pushAllowed("chat", {}, [], null, { muted: true, chat: "all" }), false, "muted beats a couch's Every message");
  assert.equal(M.pushAllowed("reminder", {}, [], null, { muted: true }), true, "a muted show never costs you a pick");
  assert.equal(M.pushAllowed("chat", { chat: true }, [], null, { chat: "all" }), true, "a couch's Every message over the account's Never");
  assert.equal(M.pushAllowed("chat", {}, [], null, { chat: "off" }), false, "a couch's Never over the account's choice");
  assert.equal(M.pushAllowed("chat", {}, ["chat"], null, { chat: "all" }), false, "a show's own chat off still wins on that show");
  assert.equal(M.mutedNow("forever"), true);
  assert.equal(M.mutedNow(new Date(Date.now() + 60_000).toISOString()), true);
  assert.equal(M.mutedNow(new Date(Date.now() - 60_000).toISOString()), false, "a mute that's run out is just ignored");
  assert.equal(M.mutedNow(null), false);
});

// Just enough of pg's Pool for sendPush: readers, the bell and the devices.
function fakePool(readers) {
  const kept = [];
  const pool = {
    kept,
    async query(sql, params) {
      if (sql.includes('FROM "user" u')) return { rows: readers.filter((r) => params[0].includes(r.user_id)) };
      if (sql.includes("INSERT INTO notifications")) {
        const [userId, type, key] = params;
        if (key && kept.some((k) => k.userId === userId && k.key === key)) return { rows: [] };
        kept.push({ userId, type, key, title: params[4], link: params[6], spoils: params[7] });
        return { rows: [{ id: String(kept.length) }] };
      }
      if (sql.includes("FROM push_subscriptions")) return { rows: readers.filter((r) => params[0].includes(r.user_id)).map((r) => ({ id: `s-${r.user_id}`, user_id: r.user_id, endpoint: `https://push.example/${r.user_id}`, p256dh: "k", auth: "a" })) };
      if (sql.startsWith("UPDATE push_subscriptions")) return { rows: [] };
      throw new Error("unexpected query: " + sql);
    },
  };
  return pool;
}

function withFakeWebPush(fn) {
  const sent = [];
  const env = { ...process.env };
  Object.assign(process.env, { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:test@example.invalid" });
  core._setWebPushForTests({ setVapidDetails() {}, async sendNotification(sub, payload) { sent.push({ endpoint: sub.endpoint, ...JSON.parse(payload) }); } });
  return fn(sent).finally(() => {
    process.env = env;
    core._setWebPushForTests({});
  });
}

const readers = [
  { user_id: "alex", ui: "new", tz: "America/Los_Angeles", disabled: {}, chat: null, show_off: null },
  { user_id: "riley", ui: "classic", tz: null, disabled: {}, chat: "all", show_off: null },
  { user_id: "sam", ui: "new", tz: null, disabled: { episodeResults: true }, chat: null, show_off: ["early"] },
];

test("words per reader, the design each is on, the bell for everyone, the push only where the switches let it", () =>
  withFakeWebPush(async (sent) => {
    const pool = fakePool(readers);
    const seen = { alex: 6, riley: 4, sam: 6 };
    const r = await core.sendPush(pool, ["alex", "riley", "sam"], "episodeResults", (reader) => ({
      title: seen[reader.userId] >= 6 ? "Episode 6: Cristian Chavez went home" : "Episode 6 results are in",
      body: reader.tz || "season zone",
      url: "/episodes?league=L",
      next: "/show/S/tonight",
      key: "results:S:6",
      spoils: seen[reader.userId] >= 6 ? 6 : null,
    }), { seasonId: "S" });
    assert.equal(r.kept, 3, "everyone's bell keeps it");
    assert.equal(r.sent, 2, "sam has early results off (and off for this show): no push");
    const byUser = Object.fromEntries(sent.map((s) => [s.endpoint.split("/").pop(), s]));
    assert.equal(byUser.alex.url, "/show/S/tonight", "the new design's page for alex");
    assert.equal(byUser.riley.url, "/episodes?league=L", "classic's for riley");
    assert.equal(byUser.alex.body, "America/Los_Angeles", "a reader's own zone reaches the words");
    assert.equal(byUser.riley.title, "Episode 6 results are in", "the guard's words for someone behind");
    assert.equal(pool.kept.find((k) => k.userId === "alex").spoils, 6);

    const again = await core.sendPush(pool, ["alex", "riley"], "episodeResults", { title: "x", body: "y", key: "results:S:6" }, { seasonId: "S" });
    assert.deepEqual([again.kept, again.sent], [0, 0], "a key someone has already: not kept, not pushed again");
  }));

test("the new design's own moments reach classic readers' bells, never their phones; chat is never kept", () =>
  withFakeWebPush(async (sent) => {
    const pool = fakePool(readers);
    const r = await core.sendPush(pool, ["alex", "riley"], "poll", { title: "riley started a poll", body: "b", next: "/show/S/tonight", key: "poll:1" });
    assert.equal(r.kept, 2);
    assert.deepEqual(sent.map((s) => s.endpoint.split("/").pop()), ["alex"]);
    const chat = await core.sendPush(pool, ["alex"], "chat", { title: "t", body: "b", next: "/show/S/chat" });
    assert.deepEqual([chat.kept, chat.sent], [0, 1]);
    const nobody = await core.sendPush(pool, ["alex", "riley"], "reminder", (reader) => (reader.userId === "alex" ? null : { title: "t", body: "b" }));
    assert.equal(nobody.kept, 1, "no words for alex: nothing kept or pushed for alex");
  }));
