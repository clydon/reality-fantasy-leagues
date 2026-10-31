// Dev-only check for the couch's chat about a show (docs/PLAN-new-design.md step 4), against the dev server, on
// new-fixture.js (its chat is timed around episodes 4 and 5 across the three linked leagues, plus a chat on the
// Traitors, which the couch watches without a game):
//   - GET /api/seasons/[id]/chat?couch=: one conversation from all three leagues, reactions, reveal lines; `?v=`
//     answers { unchanged } until something changes; a couch you're not on is refused;
//   - the fold, on the server: sam (on 3 of 5) gets everyone else's messages since Episode 4 aired without their words
//     or reactions, his own and the reveal lines in full, and who has revealed it; `&unfold=5` shows them, `&unfold=4`
//     only what was said before Episode 5 aired;
//   - posting goes into the couch's first game (classic's group chat shows it); a show the couch only watches posts to
//     the couch and season (no league); reads move the couch's and classic's marks, and the badge's count; editing and
//     removing: your own, or anyone's for whoever runs a game here; a message from another couch's chat is refused,
//     here and in classic's react route;
//   - in a browser at --width as alex: the Chat tab (no Preview), days, runs, reveal lines, the composer above the tab
//     bar, opening at the newest; send, react and edit through a message's sheet; the badge on the Chat tab and
//     Tonight; the open chat's poll sends its version; as sam: the fold, Show them, and Tonight's "riley and jordan
//     have revealed"; as riley: the Traitors' chat, folded past Episode 2;
//   - Earlier messages (step 15 part 4): with 520 more said since Episode 4 aired, a read sends the newest 300 and says there
//     are more; `&before=` the 100 before a message, oldest first, folded for sam exactly as the rest (nothing of theirs leaves
//     the server), refused for a message that isn't this chat's; `&since=` everything from a message on; in the browser, as
//     alex, Earlier messages at the top adds 100 and keeps his place, and the open chat's poll asks `since` from then on; that
//     very message deleted while it's open: `since`/`before` with its time (`&at=`) read from where it was, and the page drops it;
//   - GIFs (0156; KLIPY, here fake-gifs.js through `x-gys-gifs`): a GIF is its own message, its text "GIF", refused with no GIFs
//     set up (409) or from anywhere but KLIPY (400), not editable, folded for sam like any message; the read says whether GIFs are
//     on; in a browser, no GIF button without them, and with them jordan picks one from the sheet and it shows in the chat;
//   - nothing wider than the screen, no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-chat.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only; refuses a non-local
// database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const fixture = require("./new-fixture");
const fakeGifs = require("./fake-gifs");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-chat runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-chat.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    const L = fx.leagues;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new'), ($2, 'new'), ($3, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [
      fx.users.alex, fx.users.sam, fx.users.riley,
    ]);
    const as = {};
    // `x-gys-gifs: off`: no GIFs for these, whatever .env.local says (gifs.ts); the GIF steps name the stand-in instead.
    for (const who of ["alex", "sam", "riley", "jordan", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD, headers: { "x-gys-gifs": "off" } });
    const chat = (who, season, q = "") => as[who].call("GET", `/api/seasons/${season}/chat?couch=${fx.couchId}${q}`);
    const airOf = async (season, n) =>
      (await pool.query(`SELECT (((premiere_date + $2::int * 7) + air_time) AT TIME ZONE air_tz) AS t FROM show_seasons WHERE id = $1`, [season, n - 1])).rows[0].t;
    const seeded = fixture.CHAT.length;

    // ---- one conversation ----
    let r = await chat("alex", sid);
    const a = r.body;
    check(r.status === 200 && a.messages.length === seeded && !a.fold && a.messages.every((m) => m.text), "alex (on 5): every message in full, nothing folded", `${r.status} ${a.messages && a.messages.length}`);
    const leaguesSeen = (await pool.query(`SELECT DISTINCT league_id FROM chat_messages WHERE id = ANY($1::uuid[])`, [a.messages.map((m) => m.id)])).rows.map((x) => x.league_id);
    check(leaguesSeen.length === 3 && [L.outlast, L.lineup, L.pool].every((id) => leaguesSeen.includes(id)), "the three linked leagues' chats are one conversation");
    check(a.messages.filter((m) => m.type === "reveal").length === 4 && a.messages[0].reactions["😂"]?.count === 2, "reveal lines and reactions come with it");
    check(/^[0-9a-f]{32}$/.test(a.v) && JSON.stringify((await chat("alex", sid, `&v=${a.v}`)).body) === JSON.stringify({ unchanged: true, v: a.v }), "the same version again: { unchanged }");
    check((await chat("casey", sid)).status === 404, "a couch you're not on is refused");

    // ---- the fold, on the server ----
    const ep4 = await airOf(sid, 4);
    const ep5 = await airOf(sid, 5);
    const s = (await chat("sam", sid)).body;
    const othersSince = (t) => s.messages.filter((m) => m.type === "message" && m.userId !== fx.users.sam && new Date(m.at) >= t);
    const folded = s.messages.filter((m) => m.folded);
    check(s.fold && s.fold.episode === 4 && s.fold.latest === 5 && folded.length === othersSince(ep4).length && folded.length === s.fold.count && folded.length === 5, "sam (on 3): everyone else's messages since Episode 4 aired are folded", JSON.stringify(s.fold));
    check(folded.every((m) => m.text === null && !Object.keys(m.reactions).length) && !JSON.stringify(s).includes("blindside") && !JSON.stringify(s).includes("never safe"), "folded messages arrive without their words or reactions");
    check(s.messages.some((m) => m.userId === fx.users.sam && m.text) && s.messages.filter((m) => m.type === "reveal").every((m) => m.text), "his own message and the reveal lines show");
    check(s.messages.find((m) => /running this camp/.test(m.text || "")) && s.fold.revealed.join() === "riley,jordan", "what was said before Episode 4 aired shows; riley and jordan have revealed it", s.fold.revealed.join());
    const u5 = (await chat("sam", sid, "&unfold=5")).body;
    check(u5.messages.every((m) => !m.folded) && u5.messages.some((m) => /blindside/.test(m.text || "")), "&unfold=5 shows them");
    const u4 = (await chat("sam", sid, "&unfold=4")).body;
    const u4folded = u4.messages.filter((m) => m.folded);
    check(u4.messages.some((m) => /blindside/.test(m.text || "")) && u4folded.length > 0 && u4folded.every((m) => new Date(m.at) >= ep5), "&unfold=4: only what was said before Episode 5 aired", `${u4folded.length}`);

    // ---- reads and the badge ----
    const badge = async (who, q = "") => (await as[who].call("GET", `/api/seasons/${sid}/chat/unread?couch=${fx.couchId}${q}`)).body;
    check((await badge("alex")).unread === seeded, "alex hasn't read any of it", JSON.stringify(await badge("alex")));
    const samBadge = await badge("sam", "&reveal=4");
    check(JSON.stringify(samBadge.revealed) === JSON.stringify(["riley", "jordan"]), "the badge's read says who has revealed Episode 4", JSON.stringify(samBadge));
    const newest = a.messages[a.messages.length - 1].at;
    check((await as.alex.call("POST", `/api/seasons/${sid}/chat/read?couch=${fx.couchId}`, { at: newest })).status === 200 && (await badge("alex")).unread === 0, "reading it clears the badge");
    const reads = (await pool.query(`SELECT count(*)::int AS n FROM chat_reads WHERE user_id = $1 AND league_id = ANY($2::uuid[]) AND last_read_at >= $3`, [fx.users.alex, [L.outlast, L.lineup, L.pool], newest])).rows[0].n;
    const couchRead = (await pool.query(`SELECT last_read_at FROM couch_chat_reads WHERE user_id = $1 AND couch_id = $2 AND season_id = $3`, [fx.users.alex, fx.couchId, sid])).rows[0];
    check(reads === 3 && couchRead && new Date(couchRead.last_read_at).toISOString() === newest, "the couch's mark and classic's in all three leagues moved");
    const classicUnread = (await as.alex.call("GET", `/api/leagues/${L.pool}/chat/unread`)).body.unread;
    check(classicUnread === 0, "classic's badge agrees", `${classicUnread}`);

    // ---- posting, editing, removing ----
    const p = await as.riley.call("POST", `/api/seasons/${sid}/chat?couch=${fx.couchId}`, { text: "zt check: who's watching live?" });
    const row = (await pool.query(`SELECT league_id, couch_id, season_id FROM chat_messages WHERE id = $1`, [p.body.message && p.body.message.id])).rows[0];
    check(p.status === 200 && row && row.league_id === L.outlast && !row.couch_id, "a post goes into the couch's first game", JSON.stringify(row));
    const classic = (await as.alex.call("GET", `/api/leagues/${L.lineup}/chat`)).body;
    check(classic.messages.some((m) => m.id === p.body.message.id), "classic's group chat shows it");
    check((await badge("alex")).unread === 1 && (await chat("alex", sid, `&v=${a.v}`)).body.unchanged === undefined, "alex: one unread, and a new version");
    const mid = p.body.message.id;
    check((await as.sam.call("PATCH", `/api/seasons/${sid}/chat/${mid}?couch=${fx.couchId}`, { text: "hacked" })).status === 403, "sam can't edit riley's message");
    const ed = await as.riley.call("PATCH", `/api/seasons/${sid}/chat/${mid}?couch=${fx.couchId}`, { text: "zt check: who's watching live tonight?" });
    check(ed.status === 200 && ed.body.message.edited, "riley edits her own");
    const revealLine = a.messages.find((m) => m.type === "reveal");
    check((await as.sam.call("DELETE", `/api/seasons/${sid}/chat/${revealLine.id}?couch=${fx.couchId}`)).status === 400, "sam can't remove a reveal line");
    await as.riley.call("POST", `/api/seasons/${sid}/chat/${mid}/react?couch=${fx.couchId}`, { emoji: "🔥" });
    const reacted = (await chat("riley", sid)).body.messages.find((m) => m.id === mid);
    await as.riley.call("POST", `/api/seasons/${sid}/chat/${mid}/react?couch=${fx.couchId}`, { emoji: "🔥" });
    const unreacted = (await chat("riley", sid)).body.messages.find((m) => m.id === mid);
    check(reacted.reactions["🔥"]?.count === 1 && !unreacted.reactions["🔥"], "a reaction toggles");
    check((await as.alex.call("DELETE", `/api/seasons/${sid}/chat/${mid}?couch=${fx.couchId}`)).status === 200, "alex (runs the games here) removes anyone's");
    const elsewhere = (await pool.query(`INSERT INTO chat_messages (league_id, user_id, author_name, text) VALUES ($1, $2, 'casey', 'zt other couch') RETURNING id`, [L.extra, fx.users.casey])).rows[0].id;
    check((await as.riley.call("POST", `/api/seasons/${sid}/chat/${elsewhere}/react?couch=${fx.couchId}`, { emoji: "👍" })).status === 404, "a message from another couch's chat is refused");
    check((await as.riley.call("POST", `/api/leagues/${L.lineup}/chat/${elsewhere}/react`, { emoji: "👍" })).status === 404, "and in classic's react route (it never checked)");

    // ---- a show the couch only watches ----
    const t = (await chat("riley", tid)).body;
    check(t.messages.length === fixture.TRAITORS_CHAT.length && t.fold && t.fold.episode === 3 && t.messages.filter((m) => m.folded).length === 2 && t.messages.find((m) => /castle/.test(m.text || "")), "the Traitors (watched, no game): riley (on 2) has jordan's two from Episode 3 folded", JSON.stringify(t.fold));
    check(!(await chat("jordan", tid)).body.fold, "jordan (on 4) has nothing folded");
    const tp = await as.riley.call("POST", `/api/seasons/${tid}/chat?couch=${fx.couchId}`, { text: "zt check: castle tour when?" });
    const trow = (await pool.query(`SELECT league_id, couch_id, season_id FROM chat_messages WHERE id = $1`, [tp.body.message.id])).rows[0];
    check(tp.status === 200 && trow.league_id === null && trow.couch_id === fx.couchId && trow.season_id === tid, "a post there goes to the couch and season, no league", JSON.stringify(trow));
    await pool.query(`DELETE FROM chat_messages WHERE id = $1`, [tp.body.message.id]);
    // ---- GIFs (0156; KLIPY since 2026-10-31, the stand-in here) ----
    const gifs = await fakeGifs.start();
    closers.push(gifs.close);
    const chatPath = `/api/seasons/${sid}/chat?couch=${fx.couchId}`;
    const gifAlex = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD, headers: { "x-gys-gifs": gifs.url } });
    const hit = (await gifAlex.call("GET", "/api/gifs?q=clap")).body.gifs?.[0];
    check(!!hit && hit.url.startsWith(gifs.url), "the stand-in's search answers, in KLIPY's shape", JSON.stringify(hit));
    const keep = { id: hit.id, url: hit.url, w: hit.w, h: hit.h, title: hit.title };
    check((await as.alex.call("POST", chatPath, { gif: keep })).status === 409, "a GIF with no GIFs set up: 409");
    check((await gifAlex.call("POST", chatPath, { gif: { ...keep, url: "https://example.com/x.gif" } })).status === 400, "a GIF from anywhere but KLIPY: 400");
    const gp = await gifAlex.call("POST", chatPath, { gif: keep });
    const gm = gp.body.message;
    check(gp.status === 200 && gm.gif?.url === keep.url && gm.text === "GIF", "a GIF posts as its own message, its text GIF (for classic and the push)", JSON.stringify(gp.body));
    check((await gifAlex.call("PATCH", `/api/seasons/${sid}/chat/${gm.id}?couch=${fx.couchId}`, { text: "words" })).status === 400, "a GIF can't be edited");
    const gifSam = (await chat("sam", sid)).body.messages.find((m) => m.id === gm.id);
    check(!!gifSam && gifSam.folded && !gifSam.gif && gifSam.text === null, "folded for sam (past Episode 4): no picture, as no words", JSON.stringify(gifSam));
    check((await chat("riley", sid)).body.messages.find((m) => m.id === gm.id)?.gif?.url === keep.url, "riley (on 5) sees the GIF");
    check((await gifAlex.call("GET", chatPath)).body.gifs === true && (await chat("alex", sid)).body.gifs === false, "the read says whether GIFs are on (the composer's GIF button)");
    await pool.query(`DELETE FROM chat_messages WHERE id = $1`, [gm.id]);
    const alexT = (await chat("alex", tid)).body;
    check(alexT.fold && alexT.fold.episode === 1 && alexT.messages.filter((m) => m.folded).length === 3, "alex (not following it) has everyone's folded from Episode 1", JSON.stringify(alexT.fold));

    // ---- in a browser, as alex ----
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, height: 844, headers: { "x-gys-gifs": "off" } });
    closers.push(b.close);
    const { page, BASE, errors } = b;
    const hideBadge = () =>
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      });
    await page.context().addInitScript(hideBadge);
    const fits = async (where, pg = page) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px over`);
    };
    const shot = (name, pg = page) => pg.screenshot({ path: path.join(out, `${name}.png`) });
    const text = async (sel, pg = page) => ((await pg.locator(sel).first().textContent()) || "").replace(/\s+/g, " ").trim();

    // Someone else posts: the Chat tab's badge says so on Tonight.
    await as.riley.call("POST", `/api/seasons/${sid}/chat?couch=${fx.couchId}`, { text: "Carter's going far, mark my words" });
    await page.goto(`${BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    const chatTab = page.locator('nav[aria-label="Show"] a', { hasText: "Chat" });
    await chatTab.locator("span").first().waitFor({ timeout: 15_000 });
    check((await chatTab.textContent()).includes("1"), "Tonight: the Chat tab's badge says 1", await chatTab.textContent());

    const polls = [];
    page.on("response", async (res) => {
      if (!/\/api\/seasons\/[^/]+\/chat\?/.test(res.url())) return;
      polls.push({ url: res.url(), body: await res.json().catch(() => null) });
    });
    await chatTab.click();
    await page.locator("[data-chat]").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    check((await page.locator("[data-preview]").count()) === 0, "the Chat tab has no Preview left");
    check((await page.locator("[data-msg]").count()) === seeded - 4 + 1 && (await page.locator("[data-reveal-line]").count()) === 4, "every message and reveal line", `${await page.locator("[data-msg]").count()}`);
    check((await page.locator("[data-day]").count()) >= 2 && /revealed Episode 5/.test(await text("[data-reveal-line] >> nth=3")), "day lines, and reveal lines say Episode");
    const last = page.locator("[data-msg]").last();
    const lastBox = await last.boundingBox();
    const composer = await page.locator("[data-composer]").boundingBox();
    const tabbar = await page.locator('nav[aria-label="Show"]').boundingBox();
    check(composer && tabbar && composer.y + composer.height <= tabbar.y + 1 && lastBox && lastBox.y + lastBox.height <= composer.y + 1 && lastBox.y > 0, "opens at the newest, above the composer, which sits on the tab bar", JSON.stringify({ lastBox, composer, tabbar }));
    check(!(await chatTab.textContent()).match(/\d/), "the badge is gone on Chat");
    const marked = (await pool.query(`SELECT last_read_at FROM couch_chat_reads WHERE user_id = $1 AND couch_id = $2 AND season_id = $3`, [fx.users.alex, fx.couchId, sid])).rows[0];
    check(marked && Date.now() - new Date(marked.last_read_at).getTime() < 60_000, "opening it marks it read");
    await fits("Chat");
    await shot("chat");

    await page.locator('textarea[aria-label="Message"]').fill("I'm starting Kristin, she's due");
    await page.keyboard.press("Enter");
    await page.locator("[data-msg]", { hasText: "she's due" }).waitFor({ timeout: 10_000 });
    const sent = (await pool.query(`SELECT league_id FROM chat_messages WHERE user_id = $1 AND text = $2`, [fx.users.alex, "I'm starting Kristin, she's due"])).rows;
    check(sent.length === 1 && sent[0].league_id === L.outlast, "Enter sends it, into the couch's first game");
    await page.waitForTimeout(6000);
    check(polls.some((x) => /[?&]v=[0-9a-f]{32}/.test(x.url) && x.body && x.body.unchanged === true), "the open chat polls its version (answered { unchanged })", `${polls.length} polls`);

    await page.locator("[data-msg]", { hasText: "running this camp" }).locator("button").first().click();
    const sheet = page.locator("[data-message-sheet]");
    await sheet.waitFor();
    await page.waitForTimeout(400);
    await shot("chat-message-sheet");
    await sheet.getByRole("button", { name: "React 🔥" }).click();
    await page.locator("[data-msg]", { hasText: "running this camp" }).getByRole("button", { name: /🔥 1, including you/ }).waitFor({ timeout: 10_000 });
    check(true, "a reaction from the sheet shows under the message");
    await page.locator("[data-msg]", { hasText: "she's due" }).locator("button").first().click();
    await sheet.waitFor();
    await sheet.getByRole("button", { name: "Edit" }).click();
    const editField = page.locator('[role=dialog] textarea[aria-label="Message"]');
    await editField.fill("I'm starting Kristin, she's so due");
    await page.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
    await page.locator("[data-msg]", { hasText: "she's so due" }).getByText("edited").waitFor({ timeout: 10_000 });
    check(true, "Edit from the sheet: the new words, marked edited");
    await page.waitForTimeout(500);
    await fits("Chat after sending");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await shot("chat-sent");

    // ---- as sam: the fold ----
    const sb = await open({ user: fixture.username("sam"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(sb.close);
    await sb.page.context().addInitScript(hideBadge);
    await sb.page.goto(`${sb.BASE}/show/${sid}/tonight`, { waitUntil: "networkidle" });
    await sb.page.locator("[data-results-in='4'] [data-revealed]").waitFor({ timeout: 20_000 });
    check(/riley and jordan have revealed · chat is folded for you/.test(await text("[data-results-in='4'] [data-revealed]", sb.page)), "Tonight: riley and jordan have revealed · chat is folded for you");
    await sb.page.locator("[data-results-in='4']").screenshot({ path: path.join(out, "sam-tonight-revealed.png") });
    await sb.page.goto(`${sb.BASE}/show/${sid}/chat`, { waitUntil: "networkidle" });
    await sb.page.locator("[data-fold]").first().waitFor({ timeout: 20_000 });
    await sb.page.waitForTimeout(800);
    const foldText = await text("[data-fold]", sb.page);
    const samFold = (await chat("sam", sid)).body.fold;
    check((await sb.page.locator("[data-fold]").count()) === 1 && foldText.includes(`${samFold.count} messages since Episode 4 aired`) && /riley and jordan have revealed it/.test(foldText) && /Reveal Episode 4/.test(foldText), "sam's chat: one fold for all of them, who has revealed, Reveal Episode 4", foldText);
    const pageText = await sb.page.locator("[data-chat]").textContent();
    check(!/blindside|never safe|so due/.test(pageText) && /running this camp/.test(pageText), "what's folded isn't on the page; what came before is");
    await fits("sam's chat", sb.page);
    await sb.page.locator("[data-fold]").first().scrollIntoViewIfNeeded();
    await shot("chat-sam-folded", sb.page);
    await sb.page.locator("[data-fold]").first().getByRole("button", { name: "Show them" }).click();
    await sb.page.locator("[data-msg]", { hasText: "blindside" }).waitFor({ timeout: 10_000 });
    check((await sb.page.locator("[data-fold]").count()) === 0, "Show them unfolds them");
    await shot("chat-sam-shown", sb.page);

    // ---- as riley: the Traitors, watched without a game ----
    const rb = await open({ user: fixture.username("riley"), pass: fixture.PASSWORD, width, height: 844 });
    closers.push(rb.close);
    await rb.page.context().addInitScript(hideBadge);
    await rb.page.goto(`${rb.BASE}/show/${tid}/chat`, { waitUntil: "networkidle" });
    await rb.page.locator("[data-fold]").first().waitFor({ timeout: 20_000 });
    const tFold = await text("[data-fold]", rb.page);
    check(/2 messages since Episode 3 aired/.test(tFold) && /From jordan/.test(tFold) && !/Reveal Episode/.test(tFold), "the Traitors' chat: jordan's two folded, no Reveal (no game)", tFold);
    check((await rb.page.locator('textarea[aria-label="Message"]').getAttribute("placeholder")) === "Message the couch about ZT Traitors 5", "its composer: Message the couch about ZT Traitors 5");
    await fits("the Traitors' chat", rb.page);
    await shot("chat-traitors", rb.page);

    // ---- Earlier messages (step 15 part 4) ----
    // 520 more from jordan in the hour and a half after Episode 4 aired (folded for sam, on 3), so the conversation runs past one read.
    const ep4At = await airOf(sid, 4);
    await pool.query(
      `INSERT INTO chat_messages (league_id, user_id, author_name, type, text, created_at)
       SELECT $1, $2, 'jordan', 'message', 'zt-earlier ' || g, $3::timestamptz + (g * interval '10 seconds') FROM generate_series(1, 520) g`,
      [L.lineup, fx.users.jordan, ep4At]
    );
    const total = Number((await pool.query(
      `SELECT count(*) FROM chat_messages WHERE (league_id = ANY($1::uuid[])) AND type <> 'system'`, [[L.outlast, L.lineup, L.pool]]
    )).rows[0].count);
    const main = (await chat("alex", sid)).body;
    check(main.messages.length === 300 && main.more === true, "a read sends the newest 300, and says there are more", `${main.messages.length} of ${total}, more ${main.more}`);
    const first = main.messages[0];
    const page1 = (await chat("alex", sid, `&before=${first.id}`)).body;
    check(page1.messages.length === 100 && page1.more === (total > 400), "&before=: the 100 before it, and whether there are more", `${page1.messages.length} more ${page1.more}`);
    check(
      page1.messages.every((m, i) => i === 0 || m.at >= page1.messages[i - 1].at) && page1.messages[99].at <= first.at && !page1.messages.some((m) => main.messages.some((x) => x.id === m.id)),
      "oldest first, all of them before the read's first, none of them twice"
    );
    check(page1.messages.every((m) => !m.folded), "alex (on 5): in full");
    const samMain = (await chat("sam", sid)).body;
    const samPage = (await chat("sam", sid, `&before=${samMain.messages[0].id}`)).body;
    const theirs = samPage.messages.filter((m) => m.userId === fx.users.jordan && new Date(m.at) >= new Date(ep4At));
    check(
      samMain.more === true && theirs.length > 0 && theirs.every((m) => m.folded && m.text === null) && !JSON.stringify(samPage).includes("zt-earlier"),
      "sam (on 3): an earlier page folds what was said since Episode 4 aired, as the rest (nothing of it leaves the server)",
      `${theirs.length} folded`
    );
    check(samPage.messages.filter((m) => new Date(m.at) < new Date(ep4At)).every((m) => !m.folded), "and what came before it shows");
    check((await chat("alex", sid, `&before=${elsewhere}`)).status === 404 && (await chat("alex", sid, "&before=nope")).status === 404, "&before= a message that isn't this chat's: 404");
    const since = (await chat("alex", sid, `&since=${page1.messages[0].id}`)).body;
    check(since.messages.length === 400 && since.messages[0].id === page1.messages[0].id && since.more === (total > 400), "&since=: everything from that message on", `${since.messages.length}`);

    // In the browser: Earlier messages at the top, the place kept, and the poll asking from there on.
    const sinceAsked = [];
    page.on("request", (rq) => /\/chat\?.*since=/.test(rq.url()) && sinceAsked.push(rq.url()));
    await page.goto(`${BASE}/show/${sid}/chat`, { waitUntil: "load" });
    await page.locator("[data-msg]").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const earlierBtn = page.locator("[data-earlier]");
    check((await earlierBtn.count()) === 1 && /Earlier messages/.test(await earlierBtn.innerText()), "Earlier messages, at the top of the chat");
    const shown = await page.locator("[data-msg]").count();
    const firstId = await page.locator("[data-msg]").first().getAttribute("data-msg");
    await shot("chat-earlier-before");
    await earlierBtn.click();
    await page.waitForFunction((n) => document.querySelectorAll("[data-msg]").length > n, shown, { timeout: 15_000 });
    await page.waitForTimeout(600);
    const after = await page.locator("[data-msg]").count();
    const kept = await page.evaluate((id) => document.querySelector(`[data-msg="${id}"]`)?.getBoundingClientRect().top ?? -1, firstId);
    check(after - shown === 100 - page1.messages.filter((m) => m.type === "reveal").length, "a tap adds the 100 before", `${shown} → ${after}`);
    check(kept > 0 && kept < 844, "and keeps your place: what was first is still on screen", `${kept}`);
    await shot("chat-earlier-after");
    await page.waitForTimeout(6000);
    check(sinceAsked.length > 0, "the open chat asks since the earliest you've read from then on", `${sinceAsked.length}`);
    check((await page.locator("[data-msg]").count()) === after, "and keeps them all", `${await page.locator("[data-msg]").count()}`);

    // The message the open chat reads from, deleted while it's open (whoever runs a game removes it): the read goes on from the next
    // one, placed by the time the page sends with it, and the page drops it and keeps the rest.
    const anchor = page1.messages[0];
    const next = since.messages[1];
    check((await as.alex.call("DELETE", `/api/seasons/${sid}/chat/${anchor.id}?couch=${fx.couchId}`)).status === 200, "alex removes the message his open chat reads from");
    const at = encodeURIComponent(anchor.at);
    const gone = (await chat("alex", sid, `&since=${anchor.id}&at=${at}`)).body;
    check(
      gone.messages.length === since.messages.length - 1 && gone.messages[0].id === next.id && !gone.messages.some((m) => m.id === anchor.id),
      "&since= a deleted message, with its time: from the next one on (not the newest 300)",
      `${gone.messages.length}, from the next ${gone.messages[0]?.id === next.id}`
    );
    const before = (await chat("alex", sid, `&before=${anchor.id}&at=${at}`)).body;
    check(before.messages?.length > 0 && before.messages.every((m) => m.at <= anchor.at), "&before= a deleted message, with its time: the ones before where it was", `${before.messages?.length}`);
    check((await chat("alex", sid, `&before=${anchor.id}`)).status === 404, "and without its time, 404 as before");
    const asked = sinceAsked.length;
    await page.waitForFunction((id) => !document.querySelector(`[data-msg="${id}"]`), anchor.id, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(5500);
    check(!(await page.locator(`[data-msg="${anchor.id}"]`).count()), "the open chat drops the deleted message");
    check((await page.locator("[data-msg]").count()) === after - (anchor.type === "message" ? 1 : 0), "and keeps the rest it had read back to", `${after} → ${await page.locator("[data-msg]").count()}`);
    check(sinceAsked.slice(asked).some((u) => u.includes(`since=${anchor.id}`) && /[?&]at=/.test(u)), "its poll still asks from there, with the time");
    await shot("chat-earlier-deleted");

    // ---- GIFs in the browser: none without them; with them, jordan sends one from the sheet ----
    check((await page.locator("[data-chat-gif-button]").count()) === 0, "no GIFs set up: no GIF button in the composer");
    const jb = await open({ user: fixture.username("jordan"), pass: fixture.PASSWORD, width, height: 844, headers: { "x-gys-gifs": gifs.url } });
    closers.push(jb.close);
    await jb.page.goto(`${BASE}/show/${sid}/chat`, { waitUntil: "load" });
    await jb.page.locator("[data-chat-gif-button]").waitFor({ timeout: 30_000 });
    await jb.page.locator("[data-chat-gif-button]").click();
    const gifSheet = jb.page.locator("[role=dialog][data-open]");
    await gifSheet.locator("[data-gif-grid] [data-gif]").first().waitFor({ timeout: 10_000 });
    check(/Powered by KLIPY/.test(await gifSheet.innerText()) && (await gifSheet.locator("[data-gif]").count()) === fakeGifs.GIFS.length, "the GIF sheet: what's featured, Powered by KLIPY");
    await jb.page.screenshot({ path: path.join(out, "chat-gif-sheet.png") });
    await gifSheet.locator("[data-gif-search]").fill("plot");
    await jb.page.waitForFunction(() => document.querySelectorAll("[role=dialog][data-open] [data-gif]").length === 1, null, { timeout: 10_000 }).catch(() => {});
    await gifSheet.locator("[data-gif]").first().click();
    await jb.page.locator("[data-chat-gif]").last().waitFor({ timeout: 15_000 });
    const sentGif = (await pool.query(`SELECT text, gif FROM chat_messages WHERE user_id = $1 AND gif IS NOT NULL ORDER BY created_at DESC LIMIT 1`, [fx.users.jordan])).rows[0];
    check(sentGif?.text === "GIF" && sentGif.gif?.id === fakeGifs.idOf("Plot twist"), "picked from a search, it shows in the chat (kept as GIF with its picture)", JSON.stringify(sentGif));
    await jb.page.waitForTimeout(600);
    await jb.page.screenshot({ path: path.join(out, "chat-gif-sent.png") });
    await jb.page.locator("[data-chat-gif]").last().click();
    const jsheet = jb.page.locator("[data-message-sheet]");
    await jsheet.waitFor();
    check((await jsheet.getByRole("button", { name: "Edit" }).count()) === 0 && (await jsheet.getByRole("button", { name: "Copy text" }).count()) === 0, "a GIF's sheet has no Edit or Copy text");

    const real = [...errors, ...sb.errors, ...rb.errors, ...jb.errors].filter((e) => !/Download the React DevTools|\[HMR\]|\[Fast Refresh\]/.test(e));
    check(real.length === 0, "no page errors", real.slice(0, 3).join(" | "));
  } catch (e) {
    failures++;
    console.log("FAIL  " + (e.stack || e));
  } finally {
    for (const close of closers.reverse()) await close().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
