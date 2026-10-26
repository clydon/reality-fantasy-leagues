// Dev-only check for playing solo (docs/PLAN-new-design.md step 9 part 3: a season's public pool and the practice couch),
// against the dev server, on solo-fixture.js ("ZT Solo 51": a curated season airing, Episode 6 in three days, who went
// home in 1-5 decided by an admin; zt_so_alex, riley and jordan on Episode 5, sam on 3; nobody on a couch).
//   API:
//   - the solo read: Play on your own lists ZT Solo 51 (its pool to join, a practice couch to start) and not the finished 50;
//   - the pool: the first Join makes it (one per season, on no couch, nobody running it, from Episode 6, calls on), a second
//     is refused; riley and jordan join the same one; the pick and the call for Episode 6 (someone out refused, a call taken
//     back); usernames only (others' undecided picks and calls never sent, who's picked a count); no chat (classic's routes
//     answer nothing or refuse), not in classic's league list, its join code refused; healCouches leaves it on no couch;
//   - sam, behind on Episode 3, joins: from Episode 6, told to reveal Episode 4 first, nobody out past his mark;
//   - the practice couch: alex starts Weekly Lineup against three Sharp computer players (on no couch, his alone, a second
//     refused); teams fitted to who's still in; the bots drafted before him and draft as he does; their lineups are set;
//   - Episode 6 airs and Danny goes home (the season sync, as an admin's decision would): the pool scores (alex's streak 1,
//     his call right; riley's wrong), the bots set Episode 7's lineups, sam still sees nothing past Episode 3;
//   - jordan leaves the pool; a full pool refuses a join; a finished season has neither; riley's Outlast practice (teams of
//     three now) ends; every real league's state unchanged.
//   In a real browser at --width (390 by default): alex's solo hub (Welcome, Watching solo opening Start a couch, Play on
//   your own, Better with friends' sheet), the pool card to its page (a pick and a call saved), the Games tab (On your own,
//   the pool as "Everyone", the computer players tagged), the practice sheet (end it; start Outlast against Easy players,
//   into the draft room, a pick and the bots' turns), jordan joining the pool again from its page, sam's reveal-first.
//   Nothing wider than the screen; no page errors. Screenshots go to <outDir>.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-solo.js <outDir> [--width=390] [--keep] [--api]
//
// --api: the API half only. Brings solo-fixture.js up and takes it down (--keep leaves it); runs the season sync itself
// (jiti); touches zt-so rows only; refuses a non-local database. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./solo-fixture");
const S = require("../../src/lib/game/state-logic.js");
// The season sync runs in this process (as an admin's decision would run it); after() has no request here (next-after-stub.js).
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-solo runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-solo.js <outDir> [--width=390] [--keep] [--api]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const apiOnly = args.includes("--api");
const PASSWORD = fixture.PASSWORD;
const POOL_CAP = 100; // solo.ts

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
/** The season's Who goes home? calls for an episode, with the names they call (Call it's, since step 12 part 2). */
const outCallsOf = async (db, seasonId, n) =>
  (await db.query(`SELECT c.answer, sc.name FROM episode_calls c LEFT JOIN season_cast sc ON sc.id::text = c.answer WHERE c.season_id = $1 AND c.episode = $2 AND c.question = 'out'`, [seasonId, n])).rows;
const rid = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const until = async (fn, ms = 12000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise((r) => setTimeout(r, 300))) if (await fn()) return true;
  return false;
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  let close = async () => {};
  const realHash = async () =>
    (await pool.query(`SELECT md5(string_agg(md5(state::text), '' ORDER BY id)) AS h, count(*)::int AS n FROM leagues WHERE solo IS NULL AND slug NOT LIKE 'zt-%'`)).rows[0];
  try {
    const before = await realHash();
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const as = {};
    for (const who of fixture.PEOPLE) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });
    const name = (i) => fixture.nameOf(fixture.FACES[i]);
    const leagueOf = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const cid = (state, n) => state.castaways.find((c) => c.name === n)?.id;
    const ep = (state, n) => state.episodes.find((e) => e.number === n);
    const seat = async (leagueId, who) => (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [leagueId, fx.users[who]])).rows[0]?.player_id;

    // ---------- the solo read ----------
    let r = await as.alex.call("GET", "/api/me/solo");
    const s51 = r.body.seasons?.find((s) => s.seasonId === sid);
    check(r.status === 200 && !!s51 && !s51.pool.joined && s51.pool.blocked === null && s51.pool.leagueId === null, "Play on your own: ZT Solo 51's pool, not made yet, open to join", JSON.stringify(r.body).slice(0, 300));
    check(!!s51 && s51.practice.leagueId === null && s51.practice.blocked === null, "and a practice couch to start");
    check(!r.body.seasons?.some((s) => s.seasonId === fx.finishedSeasonId), "the finished season 50 isn't offered");

    // ---------- the pool ----------
    r = await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "join" });
    check(r.status === 200 && r.body.start === 6 && !!r.body.leagueId, "alex joins: the pool is made, from Episode 6", JSON.stringify(r.body));
    const P = r.body.leagueId;
    let row = await leagueOf(P);
    check(row.solo === "public" && row.solo_season_id === sid && row.couch_id === null && row.created_by === null, "a public pool: one season's, on no couch, made by nobody in particular");
    const st = row.state;
    check(st.settings.leagueTypeId === "pickem" && st.settings.calls === true && S.startEpisode(st) === 6, "Survival Pool with Who goes home? calls, starting at Episode 6");
    check(st.castaways.length === 18 && st.castaways.filter((c) => c.status === "eliminated").length === 5, "the season's cast, five out through the shared results");
    check(st.players.length === 1 && st.players[0].name === fixture.username("alex") && !st.players[0].ghost, "alex's seat is his username, seen at once");
    check((await pool.query("SELECT role FROM league_memberships WHERE league_id = $1", [P])).rows.every((m) => m.role === "member"), "nobody runs it: every seat a member's");
    r = await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "join" });
    check(r.status === 409, "joining again is refused", String(r.status));
    for (const who of ["riley", "jordan"]) await as[who].call("POST", `/api/seasons/${sid}/pool`, { action: "join" });
    check((await pool.query("SELECT count(*)::int AS n FROM leagues WHERE solo = 'public' AND solo_season_id = $1", [sid])).rows[0].n === 1, "riley and jordan join the same pool: one per season");

    r = await as.alex.call("GET", `/api/seasons/${sid}/pool`);
    let g = r.body.game;
    check(r.body.joined && r.body.players === 3 && g?.players === 3 && g.table.length === 3, "alex's pool: three people on the board", JSON.stringify(r.body).slice(0, 200));
    check(g?.pick?.episode === 6 && g.pick.open && g.pick.available.length === 13, "the pick for Episode 6: open, the thirteen still in");
    check(g?.call?.episode === 6 && g.call.open && g.call.available.length === 13 && g.call.call === null, "Who goes home? for Episode 6: open");
    check(g?.from === 6 && g.through === 5 && g.revealFirst === null, "it counts from Episode 6; through 5; nothing to reveal first");
    check(g?.progress?.of === 3 && g.progress.people.length === 0, "who's picked is a count: nobody named");
    check(g?.table.every((r) => /^zt_so_/.test(r.name)), "the board: usernames only");
    const six = ep(st, 6).id;
    const alexP = await seat(P, "alex");
    const rileyP = await seat(P, "riley");
    r = await as.alex.call("PUT", `/api/leagues/${P}/episodes/${six}/picks?quiet`, { playerId: alexP, castawayId: cid(st, name(5)) });
    check(r.status === 200, "alex picks Cristian through the league's pick route", JSON.stringify(r.body));
    r = await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "call", castawayId: cid(st, name(0)) });
    check(r.status === 400, "calling someone already out is refused", String(r.status));
    await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "call", castawayId: cid(st, name(7)) });
    r = await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "call", castawayId: null });
    check(r.status === 200 && r.body.call === null, "a call taken back");
    r = await as.alex.call("POST", `/api/seasons/${sid}/pool`, { action: "call", castawayId: cid(st, name(6)) });
    check(r.status === 200 && r.body.call === cid(st, name(6)), "alex calls Danny going home");
    await as.riley.call("PUT", `/api/leagues/${P}/episodes/${six}/picks?quiet`, { playerId: rileyP, castawayId: cid(st, name(6)) });
    await as.riley.call("POST", `/api/seasons/${sid}/pool`, { action: "call", castawayId: cid(st, name(5)) });
    row = await leagueOf(P);
    // A call is the person's Call it since step 12 part 2 (episode_calls, against the season's cast), not the pool's state.
    const outCalls = (n) => outCallsOf(pool, sid, n);
    check(ep(row.state, 6).picks.length === 2 && (await outCalls(6)).length === 2 && !ep(row.state, 6).calls, "two picks on Episode 6 in the pool, two calls in Call it's", JSON.stringify(await outCalls(6)));
    r = await as.riley.call("GET", `/api/seasons/${sid}/games`);
    const rg = r.body.games?.find((x) => x.leagueId === P);
    const aRow = rg?.table.find((x) => x.name === fixture.username("alex"));
    check(rg?.solo === "public" && aRow && aRow.picks.length === 0 && aRow.calls === 0, "riley's view: alex's pick and call aren't sent before they're decided");
    check(rg?.call?.call === cid(st, name(5)) && rg?.progress?.people.length === 0, "riley sees his own call; who's picked is a count");
    // No chat, not in classic, its code refused, still on no couch.
    r = await as.alex.call("GET", `/api/leagues/${P}/chat`);
    check(r.status === 200 && Array.isArray(r.body.messages) && r.body.messages.length === 0, "classic's chat for the pool answers nothing");
    r = await as.alex.call("POST", `/api/leagues/${P}/chat`, { text: "hello everyone" });
    check(r.status === 403, "and refuses a message", String(r.status));
    check((await pool.query("SELECT count(*)::int AS n FROM chat_messages WHERE league_id = $1", [P])).rows[0].n === 0, "no message stored");
    r = await as.alex.call("GET", "/api/me");
    check(r.status === 200 && !(r.body.leagues ?? []).some((l) => l.id === P), "classic's league list leaves the pool out");
    r = await as.sam.call("POST", "/api/leagues/join", { code: row.join_code });
    check(r.status === 403, "the pool's classic join code is refused", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.alex.call("GET", "/api/me/home");
    const home51 = r.body.shows?.find((s) => s.seasonId === sid);
    check(r.body.couches?.length === 0 && (await leagueOf(P)).couch_id === null, "the home's healCouches leaves it on no couch; alex is on none");
    check(home51?.games.some((x) => x.leagueId === P && x.solo === "public") && !r.body.moves.some((m) => m.leagueId === P), "the home lists the pool as one of his games (his pick's made, nothing due there)");

    // sam, behind
    r = await as.sam.call("GET", `/api/seasons/${sid}/pool`);
    check(r.body.joined === false && r.body.players === 3, "sam (on Episode 3) sees a pool of three to join");
    r = await as.sam.call("POST", `/api/seasons/${sid}/pool`, { action: "join" });
    check(r.status === 200 && r.body.start === 6, "sam joins from Episode 6 too");
    g = (await as.sam.call("GET", `/api/seasons/${sid}/pool`)).body.game;
    check(g?.revealFirst === 4 && g.through === 3, "sam: reveal Episode 4 first; the board through 3", JSON.stringify({ revealFirst: g?.revealFirst, through: g?.through }));
    check(g?.cast.find((c) => c.name === name(3))?.left === false && g.cast.find((c) => c.name === name(2))?.left === true, "nobody out past his mark (Brady, out in 4, is still in for him)");

    // ---------- the practice couch ----------
    r = await as.alex.call("POST", `/api/seasons/${sid}/practice`, { game: "bingo", level: "sharp" });
    check(r.status === 400, "a practice couch needs Weekly Lineup or Outlast", String(r.status));
    r = await as.alex.call("POST", `/api/seasons/${sid}/practice`, { game: "active-roster", level: "sharp" });
    check(r.status === 200 && !!r.body.leagueId, "alex starts a practice couch: Weekly Lineup against Sharp players", JSON.stringify(r.body));
    const PR = r.body.leagueId;
    row = await leagueOf(PR);
    let ps = row.state;
    check(row.solo === "practice" && row.couch_id === null && row.created_by === fx.users.alex, "a practice couch: on no couch, alex's");
    const bots = ps.players.filter((p) => p.automated);
    check(ps.players.length === 4 && bots.length === 3 && bots.every((b) => b.botLevel === "sharp") && bots.map((b) => b.name).join() === "Ada,Max,Ivy", "alex and three Sharp computer players: Ada, Max, Ivy");
    check(ps.settings.ownershipMode === "exclusive" && ps.settings.activeSlots === 2 && ps.settings.benchSlots === 1 && S.startEpisode(ps) === 6, "a turn-based draft, teams of three (13 still in), from Episode 6");
    const turn = S.currentDraftTurn(structuredClone(ps));
    const alexPR = await seat(PR, "alex");
    check(S.isDraftStarted(ps) && turn?.playerId === alexPR && ps.draftPicksMade === ps.draftOrder.indexOf(alexPR), "the draft is open and waiting on alex: the bots before him have picked", JSON.stringify({ made: ps.draftPicksMade, order: ps.draftOrder.indexOf(alexPR) }));
    r = await as.alex.call("POST", `/api/seasons/${sid}/practice`, { game: "classic-draft", level: "easy" });
    check(r.status === 409, "a second practice couch on the season is refused", String(r.status));
    // alex drafts his three; the bots answer each pick.
    for (let k = 0; k < 3; k++) {
      ps = (await leagueOf(PR)).state;
      const t = S.currentDraftTurn(structuredClone(ps));
      if (!t || t.isComplete || t.playerId !== alexPR) break;
      const free = ps.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      r = await as.alex.call("POST", `/api/seasons/${sid}/draft`, { leagueId: PR, action: "pick", castawayId: free.id, n: t.overallPickNumber });
      if (r.status !== 200) check(false, "alex's draft pick", JSON.stringify(r.body));
    }
    ps = (await leagueOf(PR)).state;
    check(S.currentDraftTurn(structuredClone(ps))?.isComplete && ps.players.every((p) => ps.castaways.filter((c) => (c.ownerIds || []).includes(p.id)).length === 3), "the draft's done: four teams of three, the bots' picks made as alex made his");
    const six2 = ep(ps, 6).id;
    check(bots.every((b) => S.activeRosterLineupFor(ps, six2, b.id).length === 2), "each bot has set Episode 6's lineup");
    const mine = ps.castaways.filter((c) => (c.ownerIds || []).includes(alexPR)).map((c) => c.id);
    r = await as.alex.call("PUT", `/api/leagues/${PR}/episodes/${six2}/lineups/${alexPR}?quiet`, { castawayIds: mine.slice(0, 2) });
    check(r.status === 200, "alex sets his lineup", JSON.stringify(r.body));
    r = await as.alex.call("GET", `/api/seasons/${sid}/practice`);
    check(r.body.leagueId === PR && r.body.gameName === "Weekly Lineup" && r.body.level === "sharp" && r.body.drafting === false && r.body.game.table.filter((x) => x.bot).length === 3, "his practice couch: Weekly Lineup, Sharp, drafted, three computer players on the table");

    // ---------- Episode 6 airs; Danny goes home ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 7 WHERE id = $1", [sid]);
    await fixture.addExit(pool, sid, 6, name(6));
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const synced = await syncSeasonLeagues(sid, null);
    const outIn = async (id) => {
      const s = (await leagueOf(id)).state;
      return !!ep(s, 6)?.events.some((e) => e.castawayId === cid(s, name(6)));
    };
    check(synced.length === 2 && synced.every((x) => !x.error && x.applied >= 1) && (await outIn(P)) && (await outIn(PR)), "the season sync brings Episode 6 (Danny out) to the pool and the practice couch", JSON.stringify(synced));
    ps = (await leagueOf(PR)).state;
    const seven = ep(ps, 7);
    check(!!seven && bots.every((b) => {
      const l = S.activeRosterLineupFor(ps, seven.id, b.id);
      return l.length >= 1 && l.every((id) => S.getCastaway(ps, id).status === "active");
    }), "the bots set Episode 7's lineups from who's still in");
    await as.alex.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6 });
    await as.riley.call("POST", `/api/seasons/${sid}/reveal`, { episode: 6 });
    g = (await as.alex.call("GET", `/api/seasons/${sid}/pool`)).body.game;
    check(g?.you?.week === 1 && g.you.place === 1 && g.call?.right === 1 && g.you.calls === 1, "alex: Cristian survived (streak 1, 1st), his Danny call right", JSON.stringify(g?.you));
    const rRow = g?.table.find((x) => x.name === fixture.username("riley"));
    check(rRow?.total === 0 && rRow.calls === 0 && rRow.picks.length === 1 && rRow.picks[0].correct === false, "riley: Danny went home (decided picks show now)");
    check(g?.pick?.episode === 7 && g.pick.open && g.pick.blocked.some((b) => b.id === cid(st, name(5))), "Episode 7's pick is open, Cristian not back to back");
    g = (await as.sam.call("GET", `/api/seasons/${sid}/pool`)).body.game;
    check(g?.through === 3 && g.table.every((x) => x.picks.every((p) => p.episode <= 3)) && g.cast.find((c) => c.name === name(6))?.left === false, "sam still sees nothing past Episode 3");

    // ---------- leaving, a full pool, a finished season ----------
    r = await as.jordan.call("POST", `/api/seasons/${sid}/pool`, { action: "leave" });
    check(r.status === 200 && (await pool.query("SELECT count(*)::int AS n FROM league_memberships WHERE league_id = $1", [P])).rows[0].n === 3, "jordan leaves: three left");
    check(!(await leagueOf(P)).state.players.some((p) => p.name === fixture.username("jordan")) && (await as.jordan.call("GET", `/api/seasons/${sid}/pool`)).body.joined === false, "his seat and picks go");
    const fill = [];
    for (let i = 0; i < POOL_CAP - 3; i++) {
      const uid = rid();
      fill.push(uid);
      await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, now(), now())`, [uid, `zt_so_fill${i}`, `zt_so_fill${i}@example.invalid`]);
      await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')`, [P, uid, `p_fill${i}`]);
    }
    r = await as.jordan.call("GET", `/api/seasons/${sid}/pool`);
    check(r.body.full === true && r.body.players === POOL_CAP, `a pool of ${POOL_CAP} reads as full`);
    r = await as.jordan.call("POST", `/api/seasons/${sid}/pool`, { action: "join" });
    check(r.status === 409 && /full/i.test(r.body.error), "and refuses a join", JSON.stringify(r.body));
    await pool.query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [fill]);
    r = await as.alex.call("POST", `/api/seasons/${fx.finishedSeasonId}/pool`, { action: "join" });
    check(r.status === 409 && /over/i.test(r.body.error), "a finished season has no pool to join", JSON.stringify(r.body));
    r = await as.alex.call("POST", `/api/seasons/${fx.finishedSeasonId}/practice`, { game: "classic-draft", level: "easy" });
    check(r.status === 409, "nor a practice couch");
    r = await as.riley.call("POST", `/api/seasons/${sid}/practice`, { game: "classic-draft", level: "easy" });
    const RP = r.body.leagueId;
    ps = RP ? (await leagueOf(RP)).state : null;
    check(!!ps && ps.settings.teamSize === 3 && S.startEpisode(ps) === 7 && ps.players.filter((p) => p.automated).every((b) => b.botLevel === "casual"), "riley's Outlast practice: teams of three (12 left), from Episode 7, Easy (casual) players", JSON.stringify(ps?.settings && { teamSize: ps.settings.teamSize, start: ps.settings.startEpisode }));
    r = await as.riley.call("DELETE", `/api/seasons/${sid}/practice`);
    check(r.status === 200 && !(await leagueOf(RP)) && (await as.riley.call("GET", `/api/seasons/${sid}/practice`)).body.leagueId === null, "riley ends it: the game goes");
    r = await as.riley.call("DELETE", `/api/seasons/${sid}/practice`);
    check(r.status === 404, "ending one that isn't there 404s");

    if (!apiOnly) await browserHalf({ fx, sid, P, PR, name, leagueOf, cid, ep, outCalls, setClose: (c) => (close = c) });

    const after = await realHash();
    check(after.h === before.h && after.n === before.n, `every real league's state unchanged (${after.n})`);
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close().catch(() => {});
    // The in-process sync's own connections (db.ts), once its pushes have had their moment, or this process never exits.
    await new Promise((r) => setTimeout(r, 500));
    await jiti("../../src/lib/server/db.ts").pool.end().catch(() => {});
    if (!args.includes("--keep")) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }

  async function browserHalf({ fx, sid, P, name, leagueOf, cid, ep, outCalls, setClose }) {
    const shot = async (page, file, full = false) => {
      await Promise.race([settle(page), page.waitForTimeout(3000)]);
      await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((n) => (n.style.display = "none")));
      if (full) {
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width, height: Math.min(h, 7000) });
        await page.waitForTimeout(300);
      }
      await page.screenshot({ path: path.join(out, `${file}.png`) });
      if (full) await page.setViewportSize({ width, height: 844 });
    };
    const fits = async (page, what) => check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${what}: nothing wider than the screen`);
    const toast = async (page, re) => until(async () => re.test((await page.locator("[role=status]").allInnerTexts()).join(" ")), 8000);

    const a = await open({ user: fixture.username("alex"), pass: PASSWORD, width });
    setClose(a.close);
    const page = a.page;
    await page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    check(await page.locator('[data-hub="solo"]').waitFor({ timeout: 60000 }).then(() => true, () => false), "alex's hub is the solo hub");
    check(/Welcome, zt_so_alex\./.test(await page.locator("[data-solo-hello]").innerText()), "Welcome, alex: your shows, spoiler-safe");
    await page.locator("[data-play-solo] [data-pool]").waitFor({ timeout: 15000 });
    const cardText = (await page.locator("[data-play-solo] [data-pool]").innerText()).toLowerCase();
    check(/zt solo 51 · everyone/.test(cardText) && /streak 1/.test(cardText) && /open/.test(cardText), "Play on your own: the pool card (streak 1, Open)", cardText);
    check(/weekly lineup vs 3 computer players/i.test(await page.locator("[data-play-solo] [data-practice]").innerText()), "and the practice couch card");
    await shot(page, "01-solo-hub", true);
    await fits(page, "the solo hub");
    await page.locator("[data-solo-invite]").click();
    check(await page.getByRole("dialog", { name: /Start a couch/i }).waitFor({ timeout: 5000 }).then(() => true, () => false), "Watching solo opens Start a couch");
    await page.keyboard.press("Escape");
    await page.locator('[data-friends-game="Survival Pool"]').click();
    const fsheet = page.locator("[role=dialog][data-open]");
    check(/public pool/i.test(await fsheet.innerText().catch(() => "")), "Better with friends: a game's sheet (and Start a couch)");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // The pool's page from the hub.
    await page.locator("[data-play-solo] [data-pool]").click();
    await page.waitForURL(/\/games\?page=pool/, { timeout: 15000 });
    check(await page.locator('[data-pool-page="in"] [data-pool-hero]').waitFor({ timeout: 20000 }).then(() => true, () => false), "the pool's page: your streak");
    const hero = (await page.locator("[data-pool-hero]").innerText()).toLowerCase();
    check(/^1/.test(hero.trim()) && /1st of 3/.test(hero) && /episode 7/.test(hero), "streak 1 · 1st of 3 · pick who survives Episode 7", hero);
    check((await page.locator("[data-board-row]").count()) === 3, "the board: three usernames");
    await shot(page, "02-pool-page");
    let st = (await leagueOf(P)).state;
    const alexP = st.players.find((p) => p.name === fixture.username("alex")).id;
    await page.locator(`[data-pick="${name(7)}"]`).click();
    check(await toast(page, /Devin locked in/), "tapping Devin: locked in (a toast)");
    st = (await leagueOf(P)).state;
    check(S.pickEmPickFor(st, ep(st, 7).id, alexP)?.castawayId === cid(st, name(7)), "his Episode 7 pick is saved");
    await page.locator(`[data-call="${name(8)}"]`).click();
    check(await toast(page, /You called Eric going home/), "a call: You called Eric going home");
    check((await outCalls(7)).some((x) => x.name === name(8)), "his call is saved (as his Call it)", JSON.stringify(await outCalls(7)));
    await shot(page, "03-pool-picked", true);
    await fits(page, "the pool's page");
    await page.locator('[role=dialog][aria-hidden="false"] button', { hasText: "Back" }).click();
    await page.locator("[data-solo-lede]").waitFor({ timeout: 10000 });
    const tables = await page.locator("[data-table]").allInnerTexts();
    check(tables.some((t) => /Everyone · 3 people/i.test(t)) && tables.some((t) => /computer/i.test(t) && /Practice couch/i.test(t)), "the Games tab: the pool as Everyone · 3 people, the practice table with its computer players");
    await shot(page, "04-games-tab", true);
    await fits(page, "the Games tab");

    // The practice sheet: end it, start Outlast against Easy players.
    await page.locator("[data-solo-lede] ~ div [data-practice]").click();
    await page.locator('[data-practice-sheet="mine"]').waitFor({ timeout: 8000 });
    await shot(page, "05-practice-mine");
    await page.locator("[data-practice-end]").click();
    await page.locator("[data-practice-end-confirm]").click();
    check(await toast(page, /Practice couch ended/), "End it: Practice couch ended");
    check(await until(async () => !(await pool.query("SELECT 1 FROM leagues WHERE solo = 'practice' AND created_by = $1", [fx.users.alex])).rows.length), "his practice couch is gone");
    await page.locator("[data-solo-lede] ~ div [data-practice]").filter({ hasText: "Start" }).waitFor({ timeout: 10000 });
    await page.locator("[data-solo-lede] ~ div [data-practice]").click();
    await page.locator('[data-practice-sheet="start"]').waitFor({ timeout: 8000 });
    await page.locator('[data-practice-game="Outlast"]').click();
    await page.locator('[data-practice-level="Easy"]').click();
    await shot(page, "06-practice-start");
    await page.locator("[data-practice-start]").click();
    await page.waitForURL(/\/draft\?game=/, { timeout: 20000 });
    const PR2 = new URL(page.url()).searchParams.get("game");
    const ps = (await leagueOf(PR2)).state;
    check(ps.settings.leagueTypeId === "classic-draft" && ps.players.filter((p) => p.automated && p.botLevel === "casual").length === 3, "Start the draft: an Outlast practice against Easy players, into its draft room");
    const me2 = ps.players.find((p) => !p.automated).id;
    const made = ps.draftPicksMade;
    const up = await page.locator('[data-clock="you"]').waitFor({ timeout: 20000 }).then(() => true, () => false);
    check(up, "the room: you're up");
    const free = ps.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
    await page.locator(`[data-tile="${free.id}"]`).click();
    await page.locator("[data-draft-go]").click();
    check(await until(async () => {
      const s = (await leagueOf(PR2)).state;
      const t = S.currentDraftTurn(structuredClone(s));
      return (s.castaways.find((c) => c.id === free.id).ownerIds || []).includes(me2) && s.draftPicksMade > made && (t.isComplete || t.playerId === me2);
    }), "alex drafts, and the computer players take their turns until he's up again");
    await shot(page, "07-practice-draft");
    await fits(page, "the practice draft room");
    await a.close();

    // jordan joins again from the pool's page.
    const j = await open({ user: fixture.username("jordan"), pass: PASSWORD, width });
    setClose(j.close);
    await j.page.goto(`${BASE}/show/${sid}/games?page=pool`, { waitUntil: "networkidle" });
    check(await j.page.locator('[data-pool-page="out"] [data-pool-join]').waitFor({ timeout: 30000 }).then(() => true, () => false), "jordan (left it): the pool's page offers Join");
    await shot(j.page, "08-pool-join");
    await j.page.locator("[data-pool-join]").click();
    check(await toast(j.page, /You're in the ZT Solo 51 pool from Episode 7/), "Join: You're in, from Episode 7");
    check(await j.page.locator('[data-pool-page="in"] [data-pool-hero]').waitFor({ timeout: 15000 }).then(() => true, () => false), "and the page shows his streak and pick");
    await fits(j.page, "jordan's pool page");
    await j.close();

    // sam, behind.
    const s = await open({ user: fixture.username("sam"), pass: PASSWORD, width });
    setClose(s.close);
    await s.page.goto(`${BASE}/home`, { waitUntil: "networkidle" });
    await s.page.locator("[data-play-solo] [data-pool]").waitFor({ timeout: 30000 });
    check(/reveal episode 4 first/i.test(await s.page.locator("[data-play-solo] [data-pool]").innerText()), "sam's pool card: reveal Episode 4 first");
    await s.page.locator("[data-play-solo] [data-pool]").click();
    check(await s.page.locator("[data-pool-reveal]").waitFor({ timeout: 20000 }).then(() => true, () => false), "his pool page: Episode 4 is in, reveal it first");
    await shot(s.page, "09-sam-reveal-first");
    // Chrome's own /favicon.ico fetch now and then logs a bare "Failed to load resource" (the app's icon is icon1.png).
    const errs = [...a.errors, ...j.errors, ...s.errors].filter((e) => !/^Failed to load resource: the server responded with a status of 404/.test(e));
    check(errs.length === 0, "no page errors", errs.join(" | "));
    await s.close();
    setClose(async () => {});
  }
})();
