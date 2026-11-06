// Dev-only check for couches and joining their games (docs/PLAN-new-design.md step 9 part 1), against the dev server, on
// new-fixture.js's couch ("ZT Survivor 51": alex runs its three linked games, riley, jordan and sam play them; results
// through Episode 5) plus a newcomer, zt_nd_kat, on no couch.
//   API:
//   - invite codes: yours (six letters and digits, the same each time, another person's differs); what a code opens on,
//     signed out too (the couch, whose code, its games and who may join each; nothing about results); a bad code 404s;
//   - joining the couch with a code (typed loosely), again (already on it); a couch-only member is on it in its own right;
//   - who can join, per game: Weekly Lineup and Survival Pool open (shared / no teams), Outlast ask (exclusive); Game
//     settings' three ways (an exclusive game can't be open; locked refuses a join; Reset to recommended);
//   - Ask me first: joining without asking is refused, ask, withdraw, ask again; the request in Backstage's Needs you for
//     whoever runs it; a player can't answer it; Let in (a line in Recent changes); joining after, live from Episode 6
//     with a team of free agents only (refused with someone owned), seen by the game at once, your mark left where it was;
//   - Survival Pool, catching up from Episode 1: the game view says "Episode 1 of 5", the season's reveal leaves it out,
//     a pick for Episode 1 through the classic route, the catch-up reveal (one episode, its beats), Episode 2 next;
//   - the couch chat lets kat in (seen by the games, folded by her mark); Recent changes has every join;
//   - start a couch (a name, its owner, refused nameless or too long); leave one (the last Commissioner can't; kat can:
//     out of its games, restorable); taking jordan out of the games in Backstage keeps him on the couch.
//   In a real browser at --width (390 by default): alex's profile couch line and the switcher (switching couches and
//   back), a couch's details (members, code, seasons, leaving it guarded), starting a couch (Get the couch going with its
//   code), joining one with the code boxes (to its invite page); kat's invite page (Join the couch, then each game's
//   button), joining Weekly Lineup live with a team, Tonight's catch-up strip and a catch-up reveal, Commercial break's
//   Join a game; alex's Backstage request (Let in), Game settings' Who can join, Members' Invite, the show's ⋯ Invite a friend,
//   Settings' couches; the invite page signed out. Nothing wider than the screen; no page errors.
// Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-couches.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only;
// refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE, openFold } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-couches runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-couches.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const rid = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

/** A zt_nd_ person on no couch (new-fixture's down removes them with the rest). */
async function newcomer(pool, who) {
  const { hashPassword } = await import("better-auth/crypto");
  const id = rid();
  const name = `zt_nd_${who}`;
  await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`, [
    id,
    name,
    `${name}@example.invalid`,
  ]);
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
    rid(),
    id,
    await hashPassword(PASSWORD),
  ]);
  return id;
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  try {
    const fx = await fixture.up(pool);
    const L = fx.leagues;
    const sid = fx.seasonId;
    const couch = fx.couchId;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const katId = await newcomer(pool, "kat");
    for (const u of [fx.users.alex, katId]) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "kat"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const state = async (key) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L[key]])).rows[0].state;
    const lines = async () => (await pool.query("SELECT text FROM league_changes WHERE league_id = ANY($1::uuid[]) ORDER BY created_at", [[L.outlast, L.lineup, L.pool]])).rows.map((r) => r.text);

    // ---- invite codes ----
    const a1 = await as.alex.call("GET", `/api/couches/${couch}/invite`);
    const code = a1.body.code;
    check(a1.status === 200 && /^[A-HJ-NP-Z2-9]{6}$/.test(code ?? ""), "alex's invite code: six letters and digits, nothing to misread", JSON.stringify(a1.body));
    check((await as.alex.call("GET", `/api/couches/${couch}/invite`)).body.code === code, "the same code each time");
    const rileyCode = (await as.riley.call("GET", `/api/couches/${couch}/invite`)).body.code;
    check(rileyCode && rileyCode !== code, "riley has a code of her own");
    check((await as.kat.call("GET", `/api/couches/${couch}/invite`)).status === 404, "someone off the couch gets no code (404)");

    const anon = await fetch(`${BASE}/api/couches/invite/${code}`).then(async (r) => ({ status: r.status, body: await r.json() }));
    const inv = anon.body;
    const games51 = inv.seasons?.find((s) => s.seasonId === sid)?.games ?? [];
    const mode = (list, name) => list.find((g) => g.gameName === name)?.mode;
    check(anon.status === 200 && inv.couch?.name === "ZT Survivor 51" && inv.couch.size === 4 && inv.from === "zt_nd_alex", "signed out, a code shows the couch and whose code it is", JSON.stringify(inv).slice(0, 300));
    check(inv.signedIn === false && inv.onIt === false && games51.every((g) => g.you === null), "signed out: nothing about you");
    check(games51.length === 3 && mode(games51, "Weekly Lineup") === "open" && mode(games51, "Survival Pool") === "open" && mode(games51, "Outlast") === "ask", "who may join: Weekly Lineup and Survival Pool open, Outlast ask first", games51.map((g) => `${g.gameName}:${g.mode}`).join());
    check(games51.every((g) => g.latest === 5 && g.underway), "each game underway, five episodes in");
    check(!/voted out|eliminat|winner/i.test(JSON.stringify(inv)), "nothing about results in an invite");
    check((await fetch(`${BASE}/api/couches/invite/ZZZZZZ`)).status === 404, "a code that leads nowhere: 404");

    // ---- joining the couch ----
    const k1 = await as.kat.call("POST", "/api/couches/join", { code: ` ${code.toLowerCase().slice(0, 3)}-${code.toLowerCase().slice(3)} ` });
    check(k1.status === 200 && k1.body.couchId === couch && k1.body.already === false, "kat joins with the code, however it's typed", JSON.stringify(k1.body));
    check((await as.kat.call("POST", "/api/couches/join", { code })).body.already === true, "again: already on it");
    const via = (await pool.query("SELECT via, role FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couch, katId])).rows[0];
    check(via?.via === "couch" && via.role === "member", "kat is on the couch in her own right", JSON.stringify(via));
    const katHome = (await as.kat.call("GET", "/api/me/home")).body;
    const homeCouch = katHome.couches?.find((c) => c.id === couch);
    check(!!homeCouch && homeCouch.seasons?.some((s) => s.label === "ZT Survivor 51"), "her home has the couch and its seasons", JSON.stringify(homeCouch?.seasons));
    const kInv = (await as.kat.call("GET", `/api/couches/invite/${code}`)).body;
    check(kInv.onIt === true && kInv.signedIn === true, "the invite page knows she's on it now");

    // ---- who can join: Game settings ----
    const settings = async (who, leagueId, body) => as[who].call("PATCH", `/api/seasons/${sid}/backstage/settings?couch=${couch}`, { leagueId, ...body });
    const gs = (await as.alex.call("GET", `/api/seasons/${sid}/backstage/settings?couch=${couch}`)).body;
    const joiningOf = (name) => gs.games?.find((g) => g.gameName === name)?.joining;
    check(joiningOf("Outlast")?.mode === "ask" && joiningOf("Outlast")?.rec === "ask" && joiningOf("Weekly Lineup")?.mode === "open", "Game settings: Outlast ask (recommended), Weekly Lineup open", JSON.stringify(gs.games?.map((g) => g.joining)));
    check((await settings("alex", L.outlast, { set: { joinMode: "open" } })).status === 400, "an exclusive game can't be open to anyone");
    const lock = await settings("alex", L.lineup, { set: { joinMode: "locked" }, text: "Closed the game to new players" });
    check(lock.status === 200 && (await state("lineup")).settings.allowLateJoiners === false, "locking Weekly Lineup closes it in classic too", JSON.stringify(lock.body));
    const refused = await as.kat.call("POST", `/api/couches/${couch}/games/${L.lineup}`, { action: "join", start: 6, team: [] });
    check(refused.status === 403 && /Nobody new/.test(refused.body.error), "locked: kat can't join it", JSON.stringify(refused.body));
    const reset = await settings("alex", L.lineup, { reset: "joining" });
    check(reset.status === 200 && (await state("lineup")).settings.joinMode === "open" && (await state("lineup")).settings.allowLateJoiners === true, "Reset to recommended: open again", JSON.stringify(reset.body));

    // ---- Ask me first: Outlast ----
    const games = async (who) => (await as[who].call("GET", `/api/couches/${couch}/games`)).body;
    const outlastFor = async (who) => (await games(who)).games.find((g) => g.leagueId === L.outlast);
    const noAsk = await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "join", start: 6, team: [] });
    check(noAsk.status === 403 && /Ask/.test(noAsk.body.error), "Outlast: joining without asking is refused", JSON.stringify(noAsk.body));
    await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "ask" });
    await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "ask" });
    const open1 = (await pool.query("SELECT count(*)::int AS n FROM game_join_requests WHERE league_id = $1 AND user_id = $2 AND decided_at IS NULL", [L.outlast, katId])).rows[0].n;
    check(open1 === 1 && (await outlastFor("kat")).you.asked === true, "asking twice is one request");
    await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "withdraw" });
    check((await outlastFor("kat")).you.asked === false, "taken back");
    await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "ask" });
    const bs = (await as.alex.call("GET", `/api/seasons/${sid}/backstage?couch=${couch}`)).body;
    const req = bs.needs?.find((n) => n.id === "request");
    check(req?.title === "zt_nd_kat asked to join Outlast" && /New to the couch/.test(req.detail), "alex's Needs you: kat asked to join Outlast", JSON.stringify(req));
    check((await as.jordan.call("POST", `/api/couches/${couch}/requests/${req?.request?.id}`, { letIn: true })).status === 403, "a player can't answer it");
    const letIn = await as.alex.call("POST", `/api/couches/${couch}/requests/${req?.request?.id}`, { letIn: true });
    check(letIn.status === 200 && (await outlastFor("kat")).you.letIn === true, "alex lets her in", JSON.stringify(letIn.body));
    check((await lines()).includes("Let zt_nd_kat into Outlast"), "Recent changes: Let zt_nd_kat into Outlast");
    check(!(await as.alex.call("GET", `/api/seasons/${sid}/backstage?couch=${couch}`)).body.needs.some((n) => n.id === "request"), "the request is gone from Needs you");

    const opt = (await as.kat.call("GET", `/api/couches/${couch}/games/${L.outlast}?start=6`)).body;
    const outlastState = await state("outlast");
    const owned = new Set(outlastState.castaways.filter((c) => (c.ownerIds ?? []).length).map((c) => c.id));
    check(opt.starts?.live === 6 && opt.starts.catchUp === null && opt.seen === 0, "Outlast (exclusive): only live from Episode 6, and kat's on Episode 0", JSON.stringify({ starts: opt.starts, seen: opt.seen }));
    check(opt.team > 0 && opt.pool.length > 0 && opt.pool.every((c) => !owned.has(c.id)), "her team comes from free agents only", `${opt.team} of ${opt.pool.length}`);
    const ownedId = [...owned].find((id) => outlastState.castaways.find((c) => c.id === id)?.status === "active");
    const need = Math.min(opt.team, opt.pool.length);
    const bad = await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "join", start: 6, team: [ownedId, ...opt.pool.slice(1, need).map((c) => c.id)] });
    check(bad.status === 400, "someone else's castaway is refused", JSON.stringify(bad.body));
    const team = opt.pool.slice(0, need).map((c) => c.id);
    const joined = await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "join", start: 6, team });
    check(joined.status === 200 && joined.body.catchingUp === false && joined.body.start === 6, "kat joins Outlast from Episode 6", JSON.stringify(joined.body));
    const after = await state("outlast");
    const kat = after.players.find((p) => p.name === "zt_nd_kat");
    check(!!kat && !kat.ghost && kat.active !== false && after.draftOrder.includes(kat.id), "seen by the game at once (not a ghost), in its order", JSON.stringify(kat));
    check(team.every((id) => after.castaways.find((c) => c.id === id).ownerIds.includes(kat.id)), "her team is hers");
    const seat = (await pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [L.outlast, katId])).rows[0];
    check(seat?.results_seen_through === 0, "her mark stays where she is (0): she reveals the rest like anyone behind", JSON.stringify(seat));
    check((await pool.query("SELECT outcome FROM game_join_requests WHERE league_id = $1 AND user_id = $2 AND outcome IS NOT NULL ORDER BY created_at DESC LIMIT 1", [L.outlast, katId])).rows[0]?.outcome === "joined", "the let-in is used");
    check((await lines()).includes("zt_nd_kat joined Outlast from Episode 6"), "Recent changes: zt_nd_kat joined Outlast from Episode 6");
    check((await as.kat.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "join", start: 6, team })).status === 409, "joining twice: 409");

    // ---- Survival Pool: catching up ----
    const popt = (await as.kat.call("GET", `/api/couches/${couch}/games/${L.pool}`)).body;
    check(popt.starts?.live === 6 && popt.starts.catchUp === 1 && popt.team === 0, "Survival Pool: live from 6 or catch up from 1, no team", JSON.stringify(popt.starts));
    const pj = await as.kat.call("POST", `/api/couches/${couch}/games/${L.pool}`, { action: "join", start: 1 });
    check(pj.status === 200 && pj.body.catchingUp === true, "kat joins Survival Pool, catching up from Episode 1", JSON.stringify(pj.body));
    check((await lines()).includes("zt_nd_kat joined Survival Pool, catching up from Episode 1"), "Recent changes: catching up from Episode 1");
    const view = (await as.kat.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body;
    const poolView = view.games?.find((g) => g.leagueId === L.pool);
    check(poolView?.catchingUp && poolView.catchUp?.week === 1 && poolView.catchUp.latest === 5 && poolView.pick?.open && poolView.pick.episode === 1, "her Survival Pool: Episode 1 of 5, its pick open", JSON.stringify({ cu: poolView?.catchingUp, c: poolView?.catchUp, p: poolView?.pick && { e: poolView.pick.episode, o: poolView.pick.open }, keys: Object.keys(poolView ?? {}) }));
    const eps = (await as.kat.call("GET", `/api/seasons/${sid}/episodes?couch=${couch}`)).body;
    check(eps.reveal?.episode === 1 && eps.reveal, "the season's reveal is Outlast's own Episode 1 (she's behind there)", JSON.stringify(eps.reveal));
    const pickId = poolView.pick.available[0];
    const pk = await as.kat.call("PUT", `/api/leagues/${L.pool}/episodes/${encodeURIComponent(poolView.pick.epId)}/picks?quiet`, { playerId: poolView.playerId, castawayId: pickId });
    check(pk.status === 200, "her pick for Episode 1 goes through the classic route", JSON.stringify(pk.body).slice(0, 200));
    const cu = await as.kat.call("POST", `/api/seasons/${sid}/catchup`, { leagueId: L.pool, couch });
    check(cu.status === 200 && cu.body.episode === 1 && cu.body.out.length === 1 && cu.body.next === 2, "the catch-up reveal: Episode 1, who went home, Episode 2 next", JSON.stringify(cu.body).slice(0, 300));
    check(!!cu.body.game?.line, "and how her pick did", JSON.stringify(cu.body.game));
    const marks = (await pool.query("SELECT league_id, results_seen_through FROM league_memberships WHERE user_id = $1", [katId])).rows;
    check(marks.find((m) => m.league_id === L.pool)?.results_seen_through === 1, "her Survival Pool mark is 1", JSON.stringify(marks));
    const view2 = (await as.kat.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games.find((g) => g.leagueId === L.pool);
    check(view2?.catchUp?.week === 2, "now Episode 2 of 5", JSON.stringify(view2?.catchUp));
    check((await as.kat.call("POST", `/api/seasons/${sid}/catchup`, { leagueId: L.outlast, couch })).status === 409, "a game she isn't catching up in has no catch-up reveal");

    // ---- the couch chat ----
    const chat = (await as.kat.call("GET", `/api/seasons/${sid}/chat?couch=${couch}`)).body;
    check(!chat.out && Array.isArray(chat.messages), "kat's in the couch chat (the games can see her)", JSON.stringify(chat).slice(0, 120));
    check(chat.messages.some((m) => m.folded) && chat.fold?.count > 0, "folded past where she is", JSON.stringify(chat.fold));

    // ---- starting and leaving couches ----
    check((await as.riley.call("POST", "/api/couches", { name: "  " })).status === 400, "a couch needs a name");
    check((await as.riley.call("POST", "/api/couches", { name: "x".repeat(41) })).status === 400, "and not too long a one");
    const made = await as.riley.call("POST", "/api/couches", { name: "ZT Watch Club" });
    check(made.status === 200 && /^[A-HJ-NP-Z2-9]{6}$/.test(made.body.code ?? ""), "riley starts ZT Watch Club, with a code", JSON.stringify(made.body));
    const rh = (await as.riley.call("GET", "/api/me/home")).body.couches.find((c) => c.id === made.body.id);
    check(rh?.yourRole === "owner" && rh.members.length === 1 && rh.games.length === 0, "she owns it, alone, no games yet");
    const alexLeave = (await as.alex.call("POST", `/api/couches/${couch}/leave`, { preview: true })).body;
    check(!!alexLeave.problem && alexLeave.games.length === 3, "alex can't leave: he's the last Commissioner of its games", JSON.stringify(alexLeave));
    check((await as.alex.call("POST", `/api/couches/${couch}/leave`, {})).status === 409, "refused for real too");
    const jordanOut = await as.alex.call("POST", `/api/seasons/${sid}/backstage/members/${fx.users.jordan}/remove?couch=${couch}`, {});
    const jordanVia = (await pool.query("SELECT via FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couch, fx.users.jordan])).rows[0]?.via;
    check(jordanOut.status === 200 && jordanVia === "couch", "taking jordan out of the games keeps him on the couch", `${jordanOut.status} ${JSON.stringify(jordanOut.body).slice(0, 150)} via=${jordanVia}`);

    if (!apiOnly) {
      const lee = await newcomer(pool, "lee");
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [lee]);
      // Someone not in Outlast asks (jordan, taken out of the games above), and kat's pick for her Episode 2.
      await as.jordan.call("POST", `/api/couches/${couch}/games/${L.outlast}`, { action: "ask" });
      const kv = (await as.kat.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games.find((g) => g.leagueId === L.pool);
      await as.kat.call("PUT", `/api/leagues/${L.pool}/episodes/${encodeURIComponent(kv.pick.epId)}/picks?quiet`, { playerId: kv.playerId, castawayId: kv.pick.available[0] });

      const hideBadge = (ctx) =>
        ctx.addInitScript(() => {
          document.addEventListener("DOMContentLoaded", () => {
            const s = document.createElement("style");
            s.textContent = "nextjs-portal{display:none!important}";
            document.head.appendChild(s);
          });
        });
      const session = async (user) => {
        const b = await open(user ? { user, pass: PASSWORD, width, motion: "off" } : { width, motion: "off" });
        await hideBadge(b.page.context());
        await b.page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
        return b;
      };
      let n = 0;
      const shot = async (name, p) => {
        await p.waitForTimeout(450);
        await p.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`) });
      };
      const fits = async (where, p) => {
        const wide = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
      };
      const toasted = async (re, p) => {
        try {
          await p.waitForFunction((src) => new RegExp(src).test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
        } catch {
          /* the text says what came instead */
        }
        return ((await p.locator("[role=status]").textContent().catch(() => "")) || "").trim();
      };
      const sheet = (p) => p.locator("[role=dialog][data-open]");
      const sheetGone = (p) => p.locator("[role=dialog][data-open]").first().waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
      const hold = async (p) => {
        await p.locator("[data-hold]:not([disabled])").waitFor();
        const box = await p.locator("[data-hold]").boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await p.mouse.down();
        await p.waitForTimeout(1800);
        await p.mouse.up();
      };

      // ---- alex: the couch line, the switcher, a couch's details ----
      const A = await session("zt_nd_alex");
      close = A.close;
      const page = A.page;
      await page.goto(`${BASE}/home`);
      await page.locator("[data-hub]").waitFor({ timeout: 30_000 });
      await page.getByRole("button", { name: "Your profile" }).click();
      await page.locator("[data-couch-line]").waitFor();
      check(/ZT Survivor 51/.test(await page.locator("[data-couch-line]").innerText()) && /5 people/.test(await page.locator("[data-couch-line]").innerText()), "the profile's couch line: its name, its show and its people", await page.locator("[data-couch-line]").innerText());
      await shot("profile", page);
      await page.locator("[data-couch-line]").click();
      await page.locator("[data-couch-switcher]").waitFor();
      const rows = await page.locator("[data-couch-switcher] [data-couch]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-couch")}${e.getAttribute("aria-current") ? "*" : ""}`));
      check(rows.includes("ZT Survivor 51*") && rows.includes("ZT Extra"), "the switcher: alex's couches, the hub's ticked", rows.join());
      await fits("the switcher", page);
      await shot("switcher", page);
      await page.locator('[data-couch-switcher] [data-couch="ZT Extra"]').click();
      check(/Switched to ZT Extra/.test(await toasted(/Switched/, page)), "tapping one switches the hub to it");
      check((await page.evaluate(() => localStorage.getItem("gys.couch"))) === fx.extraCouchId, "remembered on this device");
      await sheetGone(page);
      await page.getByRole("button", { name: "Your profile" }).click();
      check(/ZT Extra/.test(await page.locator("[data-couch-line]").innerText()), "the profile follows the switch");
      await page.locator("[data-couch-line]").click();
      await page.locator('[data-couch-switcher] [data-couch="ZT Survivor 51"]').click();
      await toasted(/Switched to ZT Survivor 51/, page);
      await sheetGone(page);
      await page.getByRole("button", { name: "Your profile" }).click();
      await page.locator("[data-couch-line]").click();
      await sheet(page).getByText("ZT Survivor 51 details").click();
      await page.locator("[data-couch-details]").waitFor();
      await page.locator(`[data-invite-code="${code}"]`).waitFor({ timeout: 10_000 }).catch(() => {});
      const members = await page.locator("[data-couch-details] [data-member]").evaluateAll((els) => els.map((e) => e.getAttribute("data-member")));
      check(members.length === 5 && members.includes("zt_nd_kat") && members.includes("zt_nd_jordan"), "its details: everyone on it (kat joined, jordan stayed)", members.join());
      check((await page.locator("[data-couch-details] [data-invite-code]").getAttribute("data-invite-code")) === code, "alex's code on the plate");
      check(/ZT Survivor 51/i.test(await page.locator("[data-couch-details] ol").innerText()), "seasons together");
      await fits("a couch's details", page);
      await shot("details", page);
      await page.locator("[data-couch-details] [data-invite-code] button").click();
      check(/Invite code copied/.test(await toasted(/copied/, page)) && (await page.evaluate(() => navigator.clipboard.readText())) === code, "Copy puts the code on the clipboard");
      await sheet(page).getByText("Leave this couch").click();
      await page.locator("[data-guard-problem]").waitFor({ timeout: 10_000 }).catch(() => {});
      check(/Commissioner/.test(await page.locator("[data-guard-problem]").innerText().catch(() => "")), "leaving it: alex is its games' last Commissioner, so he can't");
      await shot("leave-guarded", page);
      await page.keyboard.press("Escape");
      await sheetGone(page);

      // ---- starting a couch, then joining one with the code boxes ----
      await page.getByRole("button", { name: "Your profile" }).click();
      await page.locator("[data-couch-line]").click();
      await page.locator("[data-new-couch]").click();
      await page.locator("[data-couch-name]").fill("ZT Book Club");
      await shot("new-couch", page);
      await sheet(page).getByRole("button", { name: "Start the couch" }).click();
      await page.locator("[data-couch-made]").waitFor({ timeout: 15_000 });
      const bookCode = await page.locator("[data-couch-made] [data-invite-code]").getAttribute("data-invite-code");
      check(/^[A-HJ-NP-Z2-9]{6}$/.test(bookCode ?? ""), "ZT Book Club is ready, with a code to send", bookCode);
      await shot("couch-made", page);
      await sheet(page).getByRole("button", { name: "Go to ZT Book Club" }).click();
      await page.locator("[data-get-going]").waitFor({ timeout: 15_000 });
      const going = await page.locator("[data-get-going]").innerText();
      check(new RegExp(`Send ${bookCode}\\. 1 on the couch so far`).test(going.replace(/\n/g, " ")), "the hub: Get the couch going, with the code and who's on it", going.replace(/\n/g, " | "));
      await fits("a new couch's hub", page);
      await shot("get-going", page);
      await page.locator('[data-go-step="3"]').click();
      await sheet(page).locator(`[data-invite-code="${bookCode}"]`).waitFor({ timeout: 10_000 });
      check(true, "Invite more people opens the code");
      await page.keyboard.press("Escape");
      await sheetGone(page);
      await page.locator("[data-foot-join]").scrollIntoViewIfNeeded();
      await page.locator("[data-foot-join]").click();
      await page.locator("[data-code-boxes] input").first().waitFor();
      await page.locator("[data-code-boxes] input").first().click();
      await page.keyboard.type(made.body.code.toLowerCase());
      await shot("join-code", page);
      await sheet(page).getByRole("button", { name: "Join" }).click();
      await page.waitForURL(new RegExp(`/join/${made.body.code}`), { timeout: 15_000 });
      await page.locator("[data-on-couch]").waitFor({ timeout: 15_000 });
      check((await page.locator("[data-join-page]").getAttribute("data-join-page")) === "ZT Watch Club", "the code boxes join riley's couch and open its page");
      check((await pool.query("SELECT via FROM couch_members cm JOIN couches c ON c.id = cm.couch_id WHERE c.name = 'ZT Watch Club' AND cm.user_id = $1", [fx.users.alex])).rows[0]?.via === "couch", "alex is on it");
      await shot("joined-watch-club", page);

      // ---- alex's Backstage: a request, Who can join, Invite ----
      await page.evaluate((id) => localStorage.setItem("gys.couch", id), couch);
      await page.goto(`${BASE}/show/${sid}/backstage`);
      await page.locator('[data-request="zt_nd_jordan"]').waitFor({ timeout: 30_000 });
      check(/zt_nd_jordan asked to join Outlast/.test(await page.locator('[data-request="zt_nd_jordan"]').innerText()), "Backstage's Needs you: jordan asked to join Outlast");
      await fits("Backstage", page);
      await shot("backstage-request", page);
      await page.locator('[data-request="zt_nd_jordan"] [data-let-in]').click();
      check(/zt_nd_jordan can join now/.test(await toasted(/can join now/, page)), "Let in");
      check((await pool.query("SELECT outcome FROM game_join_requests WHERE league_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1", [L.outlast, fx.users.jordan])).rows[0]?.outcome === "let-in", "jordan's let in");
      await page.goto(`${BASE}/show/${sid}/backstage/settings`);
      await page.locator('[data-settings-game="Outlast"] [data-settings="joining"]').waitFor({ timeout: 30_000 });
      const outlastModes = await page.locator('[data-settings-game="Outlast"] [data-join]').evaluateAll((els) => els.map((e) => e.getAttribute("data-join")));
      const lineupModes = await page.locator('[data-settings-game="Weekly Lineup"] [data-join]').evaluateAll((els) => els.map((e) => e.getAttribute("data-join")));
      check(outlastModes.join() === "ask,locked" && lineupModes.join() === "open,ask,locked", "Who can join: Outlast ask or nobody new; Weekly Lineup any of three", `${outlastModes} / ${lineupModes}`);
      await page.locator('[data-settings-game="Weekly Lineup"] [data-settings="joining"]').scrollIntoViewIfNeeded();
      await shot("who-can-join", page);
      await page.locator('[data-settings-game="Weekly Lineup"] [data-join="ask"]').click();
      check(/Ask me first/.test(await toasted(/Ask me first/, page)) && (await state("lineup")).settings.joinMode === "ask", "Weekly Lineup: Ask me first, saved at once");
      await page.locator("[role=status]").getByRole("button", { name: "Undo" }).click();
      await page.waitForTimeout(1500);
      check((await state("lineup")).settings.joinMode === "open", "and Undo opens it again", (await state("lineup")).settings.joinMode);
      await page.goto(`${BASE}/show/${sid}/backstage/members`);
      await page.locator("[data-members-invite]").click();
      await sheet(page).locator(`[data-invite-code="${code}"]`).waitFor({ timeout: 10_000 });
      check(true, "Members & roles: Invite opens alex's code");
      await page.keyboard.press("Escape");
      await sheetGone(page);
      await page.goto(`${BASE}/show/${sid}/tonight`);
      await page.getByRole("button", { name: /Show menu/ }).click();
      await sheet(page).getByText("Invite a friend").click();
      await sheet(page).locator(`[data-invite-code="${code}"]`).waitFor({ timeout: 10_000 });
      check(/Invite to ZT Survivor 51/i.test(await sheet(page).innerText()) && /They join ZT Survivor 51 too/i.test(await sheet(page).innerText()), "the show's ⋯ menu: Invite a friend");
      await shot("invite-show", page);
      await page.keyboard.press("Escape");
      await sheetGone(page);

      // ---- Settings: your couches; leaving one ----
      await page.goto(`${BASE}/settings`);
      await openFold(page, "couches");
      await page.locator("[data-settings-couches]").waitFor({ timeout: 30_000 });
      await page.waitForFunction(() => document.querySelectorAll("[data-settings-couch]").length >= 4, null, { timeout: 15_000 }).catch(() => {});
      const listed = await page.locator("[data-settings-couch]").evaluateAll((els) => els.map((e) => e.getAttribute("data-settings-couch")));
      check(["ZT Survivor 51", "ZT Extra", "ZT Book Club", "ZT Watch Club"].every((x) => listed.includes(x)), "Settings: every couch alex is on", listed.join());
      await fits("Settings", page);
      await page.locator("[data-settings-couches]").scrollIntoViewIfNeeded();
      await shot("settings-couches", page);
      await page.locator('[data-settings-couch="ZT Book Club"]').click();
      await sheet(page).getByText("Leave this couch").click();
      await hold(page);
      check(/You left ZT Book Club/.test(await toasted(/You left/, page)), "a hold leaves ZT Book Club");
      check(!(await pool.query("SELECT 1 FROM couches WHERE name = 'ZT Book Club'")).rows.length, "nobody on it and no games: it's gone");

      // ---- lee: an invite, joining the couch, then its games ----
      const Lee = await session("zt_nd_lee");
      const lp = Lee.page;
      await lp.goto(`${BASE}/join/${code}`);
      await lp.locator("[data-join-couch]").waitFor({ timeout: 30_000 });
      check(/zt_nd_alex saved you a seat/i.test(await lp.locator("h1").innerText()), "the invite page: whose code it is");
      await fits("the invite page", lp);
      await shot("invite-page", lp);
      await lp.locator("[data-join-couch]").click();
      check(/You joined ZT Survivor 51/.test(await toasted(/You joined/, lp)), "Join ZT Survivor 51");
      await lp.locator("[data-on-couch]").waitFor({ timeout: 15_000 });
      await lp.locator('[data-join-game="Weekly Lineup"] [data-join-button]').waitFor();
      const btns = {
        lineup: await lp.locator('[data-join-game="Weekly Lineup"] [data-join-button]').count(),
        outlast: await lp.locator('[data-join-game="Outlast"] [data-ask-button]').count(),
        pool: await lp.locator('[data-join-game="Survival Pool"] [data-join-button]').count(),
      };
      check(btns.lineup === 1 && btns.outlast === 1 && btns.pool === 1, "on it now: Join (Weekly Lineup, Survival Pool), Ask to join (Outlast)", JSON.stringify(btns));
      await shot("invite-on-couch", lp);
      await lp.locator('[data-join-game="Outlast"] [data-ask-button]').click();
      check(/Request sent to zt_nd_alex/.test(await toasted(/Request sent/, lp)), "Ask to join Outlast");
      await lp.locator('[data-join-game="Outlast"] [data-asked]').waitFor({ timeout: 10_000 });
      check(true, "Asked · zt_nd_alex will see it");
      await lp.locator('[data-join-game="Weekly Lineup"] [data-join-button]').click();
      await lp.locator("[data-join-starts]").waitFor({ timeout: 15_000 });
      const starts = await lp.locator("[data-join-starts] [data-start]").evaluateAll((els) => els.map((e) => e.getAttribute("data-start")));
      check(starts.join() === "live,catchup" && /Episodes 1 to 5 have aired/.test(await sheet(lp).innerText()), "Join Weekly Lineup: start live or catch up", starts.join());
      check(/You're on Episode 0/.test(await sheet(lp).innerText()), "live says it shows who's still in, since lee hasn't watched");
      await shot("join-starts", lp);
      await lp.locator('[data-start="live"]').click();
      await lp.locator("[data-team-pick]").waitFor({ timeout: 15_000 });
      const tiles = lp.locator("[data-team-pick] [data-castaway]");
      const want = Number((/(\d+) castaways?/.exec(await sheet(lp).innerText()) ?? [])[1] ?? 0);
      for (let i = 0; i < want; i++) await tiles.nth(i).click();
      await shot("join-team", lp);
      await lp.locator("[data-join-confirm]").click();
      check(/You're in Weekly Lineup/.test(await toasted(/You're in/, lp)), "joined, with a team of " + want);
      await lp.waitForURL(new RegExp(`/show/${sid}`), { timeout: 15_000 });
      const leeLineup = (await state("lineup")).players.find((p) => p.name === "zt_nd_lee");
      check(!!leeLineup && !leeLineup.ghost && (await state("lineup")).castaways.filter((c) => (c.ownerIds ?? []).includes(leeLineup.id)).length === want, "lee plays Weekly Lineup in the open, with that team");
      await lp.locator("[data-tab]").waitFor({ timeout: 15_000 });
      await fits("the show after joining", lp);
      await shot("joined-show", lp);
      await Lee.close();

      // ---- kat: catching up on Tonight, Commercial break ----
      const K = await session("zt_nd_kat");
      const kp = K.page;
      await kp.goto(`${BASE}/show/${sid}/tonight`);
      await kp.locator(`[data-catchup="${L.pool}"]`).waitFor({ timeout: 30_000 });
      check(/Episode 2 of 5/.test(await kp.locator(`[data-catchup="${L.pool}"]`).innerText()), "Tonight: Catching up · Episode 2 of 5");
      check((await kp.locator("[data-results-in]").count()) === 0, "in step with the season's next reveal, the strip is the one way to it (no second Results are in)");
      await fits("Tonight catching up", kp);
      await shot("catchup-strip", kp);
      await kp.locator(`[data-catchup="${L.pool}"]`).click();
      await kp.locator('[data-catchup-step="2"]').waitFor();
      check(/Your pick:/.test(await kp.locator("[data-catchup-move]").innerText()), "the catch-up sheet: her pick for Episode 2");
      await shot("catchup-step", kp);
      await kp.locator("[data-catchup-reveal]").click();
      await kp.locator('[data-catchup-result="2"]').waitFor({ timeout: 15_000 });
      check(/ out$/im.test(await kp.locator('[data-catchup-result="2"]').innerText()) && /streak/i.test(await kp.locator('[data-catchup-result="2"]').innerText()), "revealed: who went home in Episode 2, and how her pick did", await kp.locator('[data-catchup-result="2"]').innerText());
      await shot("catchup-result", kp);
      await kp.locator("[data-catchup-next]").click();
      await kp.locator('[data-catchup-step="3"]').waitFor({ timeout: 15_000 });
      check(/No pick yet/.test(await kp.locator("[data-catchup-move]").innerText()), "Next: Episode 3, no pick yet");
      await kp.keyboard.press("Escape");
      await sheetGone(kp);
      await kp.evaluate((id) => localStorage.setItem("gys.couch", id), couch);
      await kp.goto(`${BASE}/home?page=break`);
      await kp.locator("[data-break-join]").waitFor({ timeout: 30_000 });
      const toJoin = await kp.locator("[data-break-join] [data-join-game]").evaluateAll((els) => els.map((e) => e.getAttribute("data-join-game")));
      check(toJoin.join() === "Weekly Lineup", "Commercial break: Join a game lists the one she's not in", toJoin.join());
      await kp.locator("[data-break-join]").scrollIntoViewIfNeeded();
      await shot("break-join", kp);
      await K.close();

      // ---- signed out: the couch first ----
      const O = await session(null);
      await O.page.goto(`${BASE}/join/${code}`);
      await O.page.locator('[data-join-page="ZT Survivor 51"]').waitFor({ timeout: 30_000 });
      const games0 = await O.page.locator("[data-join-game]").count();
      check(games0 === 3 && (await O.page.locator("[data-invite-way-in] [data-join-couch]").count()) === 1, "signed out: the couch and its games, and Join (making the account: check-new-way-in.js)", `${games0}`);
      await fits("the invite page signed out", O.page);
      await shot("invite-signed-out", O.page);
      const bad = O.errors.filter((e) => !/Failed to load resource/.test(e));
      check(!bad.length, "no page errors signed out", bad.join(" | "));
      await O.close();

      const alexErrors = A.errors.filter((e) => !/Failed to load resource/.test(e));
      check(!alexErrors.length, "no page errors (alex)", alexErrors.join(" | "));
      await A.close();
      close = async () => {};
    }

    const katLeave = (await as.kat.call("POST", `/api/couches/${couch}/leave`, { preview: true })).body;
    check(!katLeave.problem && katLeave.games.length === 2 && katLeave.drafted, "kat's leave: out of her two games, her teams stay in the standings", JSON.stringify(katLeave));
    const gone = await as.kat.call("POST", `/api/couches/${couch}/leave`, {});
    const katRow = (await pool.query("SELECT 1 FROM couch_members WHERE couch_id = $1 AND user_id = $2", [couch, katId])).rows.length;
    const katSeats = (await pool.query("SELECT count(*)::int AS n FROM league_memberships WHERE user_id = $1", [katId])).rows[0].n;
    check(gone.status === 200 && !katRow && katSeats === 0, "she's off the couch and out of its games", JSON.stringify(gone.body));
    const left = (await pool.query("SELECT count(*)::int AS n FROM league_changes WHERE text = 'zt_nd_kat left the couch' AND undo IS NOT NULL")).rows[0].n;
    check(left === 2, "each game logs it, restorable", `${left}`);
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close();
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
