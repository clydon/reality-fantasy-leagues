// Dev-only check: the polls that run while a league is open stay correct now that they're kept small
// (2026-10-24, Neon's transfer allowance). Covers the chat route's version (`?v=` answers { unchanged }
// until anything it's built from changes), the unread badge's count route, and the state cache behind
// /state and /api/me/actions (src/lib/server/league-states.ts): a state written behind its back, without
// touching updated_at, still comes back fresh.
//
//   npm run dev                                  (in another terminal)
//   node scripts/dev-test/check-chat-polls.js    brings linked-fixture.js up, checks, takes it down
//     --ui=<outDir> [--width=390]                also in a browser: the badge counts a new message on a
//                                                league page, and the open chat picks up the next one
//
// Only touches zt- rows (linked-fixture.js's group and the messages it adds); refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const assert = require("node:assert/strict");
const { Pool } = require("pg");
const { api, open } = require("./browser");
const fixture = require("./linked-fixture");
const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || "").slice(name.length + 3) || null;

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-chat-polls runs against a local database only");

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const [a, b] = await fixture.up(pool);
    const me = await api({ user: fixture.USERNAME, pass: fixture.PASSWORD });
    const chat = (v) => me.call("GET", `/api/leagues/${a.leagueId}/chat${v ? `?v=${v}` : ""}`);
    const unread = (since) => me.call("GET", `/api/leagues/${a.leagueId}/chat/unread${since ? `?since=${encodeURIComponent(since)}` : ""}`);

    // An empty chat, then the same version again: nothing to send.
    let r = await chat();
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.messages, []);
    let v = r.body.v;
    assert.match(v, /^[0-9a-f]{32}$/);
    assert.deepEqual((await chat(v)).body, { unchanged: true, v });
    assert.equal((await unread()).body.unread, 0);

    // Someone else posts in a linked league (one conversation for the group): a new version, one unread.
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, NULL, 'ann', 'message', 'zt hello') RETURNING id, created_at`,
      [b.leagueId]
    );
    const msg = rows[0];
    r = await chat(v);
    assert.equal(r.body.unchanged, undefined, "a new message changes the version");
    assert.equal(r.body.messages.length, 1);
    assert.notEqual(r.body.v, v);
    v = r.body.v;
    assert.equal((await unread()).body.unread, 1, "someone else's message is unread");
    assert.equal((await unread(new Date(msg.created_at.getTime() + 1).toISOString())).body.unread, 0, "seen on this device");

    // Reading it on the server clears the badge everywhere; the reads changed, so the version did too.
    assert.equal((await me.call("POST", `/api/leagues/${a.leagueId}/chat/read`, { at: msg.created_at.toISOString() })).status, 200);
    assert.equal((await unread()).body.unread, 0, "read on the server");
    r = await chat(v);
    assert.equal(r.body.unchanged, undefined, "a read changes the version");
    v = r.body.v;
    assert.deepEqual((await chat(v)).body, { unchanged: true, v });

    // A reaction and an edit each change it.
    assert.equal((await me.call("POST", `/api/leagues/${a.leagueId}/chat/${msg.id}/react`, { emoji: "🔥" })).status, 200);
    r = await chat(v);
    assert.equal(r.body.unchanged, undefined, "a reaction changes the version");
    v = r.body.v;
    await pool.query("UPDATE chat_messages SET text='zt hello!', edited_at=now() WHERE id=$1", [msg.id]);
    r = await chat(v);
    assert.equal(r.body.unchanged, undefined, "an edit changes the version");
    assert.equal(r.body.messages[0].text, "zt hello!");

    // The state cache: read twice (the second from the cache), then write the row directly, without
    // updated_at, and the next read has it.
    const state = () => me.call("GET", `/api/leagues/${a.leagueId}/state`);
    r = await state();
    assert.equal(r.status, 200);
    const name = r.body.state.players[0].name;
    assert.equal((await state()).body.state.players[0].name, name);
    await pool.query(`UPDATE leagues SET state = jsonb_set(state, '{players,0,name}', '"zt renamed"') WHERE id=$1`, [a.leagueId]);
    assert.equal((await state()).body.state.players[0].name, "zt renamed", "/state sees a write made behind the cache's back");
    r = await me.call("GET", "/api/me/actions");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.body.items));
    // The chat's version covers the leagues' states (they decide who's out of the conversation).
    assert.equal((await chat(v)).body.unchanged, undefined, "a state change changes the chat version");

    const out = arg("ui");
    if (out) {
      const width = parseInt(arg("width") || "390", 10);
      const post = (text) =>
        pool.query(`INSERT INTO chat_messages (league_id, user_id, author_name, type, text) VALUES ($1, NULL, 'bo', 'message', $2)`, [b.leagueId, text]);
      const { page, errors, BASE, close } = await open({ user: fixture.USERNAME, pass: fixture.PASSWORD, width });
      try {
        // The badge: a league page open, someone posts, the 15s poll counts it.
        await page.goto(BASE + "/", { waitUntil: "networkidle" });
        await post("zt badge check");
        const badge = page.locator('a[href="/chat"] span').filter({ hasText: /^[1-9]/ }).first();
        await badge.waitFor({ timeout: 25_000 });
        await page.screenshot({ path: `${out}/chat-badge-${width}.png` });
        // The open chat: everything shows, and the next message arrives with the 5s poll.
        await page.goto(BASE + "/chat", { waitUntil: "networkidle" });
        await page.getByText("zt badge check").waitFor({ timeout: 10_000 });
        await post("zt arrives while open");
        await page.getByText("zt arrives while open").waitFor({ timeout: 12_000 });
        await page.screenshot({ path: `${out}/chat-open-${width}.png` });
        assert.deepEqual(errors, [], "no console errors");
      } finally {
        await close();
      }
    }

    console.log("check-chat-polls: all good");
  } finally {
    await fixture.down(pool); // the messages, reads and reactions go with the zt- leagues
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
