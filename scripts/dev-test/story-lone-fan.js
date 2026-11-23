// Dev-only: the lone fan (docs/PLAN-sports-couch.md C2; the design: docs/design-round/lone-fan-spec.md, -first-view.md, -shape.md),
// every moment of This week's calls, the team page's fan card and call row, and the game sheet's I'm watching, for a design round's
// screenshot story and as a check of the calls and watching routes. On new-fixture.js's zt_nd couch and the stand-in ESPN
// (fake-espn.js by the x-gys-sports header; the real ESPN is never asked), the league story's world (league-story-world.js) with this
// week reshaped so two couch teams play teams nobody follows: Bears at Giants (Jordan, the Giants' lone fan) and Cowboys at Lions
// (Sam's), beside the Eagles at Jets rivalry (alex vs Riley). Casey follows no team: the spectator.
// A season of Jordan's calls is seeded first (made up, marked so in the story): calls on ten of the Giants' eleven games, 9–1, Sam
// fading and Casey backing some, made through the real server functions at a clock set before each game.
//   fan              Jordan midweek, no call: This week's calls with Your call (Giants first, the yellow); .full
//   spectator-empty  Casey before any call this week: no calls card (nothing to back)
//   fan-called       Jordan after tapping Giants: "You called Giants", Change
//   spectator        Sam: his own Cowboys call first, then Jordan's row with Back · Fade
//   spectator-faded  Sam after tapping Fade Jordan
//   fan-backed       Jordan after Casey backs and Sam fades: the backing line, "It's backed: your call stands"
//   team-fan         Jordan on the Giants' page: the fan card (Your calls 9–1, the ticks), the call row under the bug; .full
//   team-spectator   Sam on the Giants' page: Jordan's card, the couch on his calls, Back · Fade; .full
//   studio           Jordan's This week in the light theme
//   on               Bears at Giants on now, Jordan and Casey watching: the row's watchers (Sam's view)
//   sheet-watching   Casey's game sheet for it: I'm watching on, who's watching
//   over             final, Giants 24-17: "zt_nd_jordan called it", the backing's checks, the record 10–1 (Casey's view)
//   over-hidden      Casey hiding sports scores: the call and backing, no result or record
//   over-hidden-shown after Show records
//   team-over        Jordan's fan card after the final
// With --before (the old code checked out): fan, spectator, team-fan, team-spectator and sheet-on (the game sheet, on now), before any
// call. Each frame: a .jpg at --width × --height, its words in a .txt, and words over words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE) and the zt_nd couch (census-app.js --up, or new-fixture.js up; --up brings it up first); migration 0451 for
// the after frames. Every row it makes is a zt one and is removed after (check-sports-couch.js cleanup), unless --keep. One check at a
// time on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-lone-fan.js [--before] [--only=fan,over] [--out=...]
//          [--width=390 --height=844] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");
const { now, at, HR, D, TEAMS, footballFor, COUCH, STANDINGS, E, C, G, J, B, L, FB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-lone-fan runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/lone-fan/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const OVERLAPS = [];
let fails = 0;
let caseyOn = null;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `  ${detail}` : ""}`);
  if (!ok) fails++;
};

/** The world: the league story's midweek, this week reshaped (Bears at Giants, Cowboys at Lions), ids of their own (96 4xx). */
function events() {
  const xs = footballFor(4, true);
  const bg = xs.find((e) => e.id === "96451");
  Object.assign(bg, { away: B, home: G });
  const cl = xs.find((e) => e.id === "96452");
  Object.assign(cl, { away: C, home: L, at: at(2 * D + 5 * HR) });
  return xs;
}

async function setting(pool, user, col, v) {
  await pool.query('INSERT INTO user_settings (user_id) SELECT id FROM "user" WHERE username = $1 ON CONFLICT (user_id) DO NOTHING', [user]);
  await pool.query(`UPDATE user_settings SET ${col} = $2 WHERE user_id = (SELECT id FROM "user" WHERE username = $1)`, [user, v]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = new Pool({ connectionString: DB });
  await world.cleanup(pool);
  if (has("up")) await fixture.up(pool);
  const espn = await fakeEspn.start({ teams: [...TEAMS, ...world.MB_TEAMS], leagues: [...world.LEAGUE_NAMES, world.MB_NAME], events: [], calendars: world.calendarsAround(), standings: STANDINGS });
  const headers = { "x-gys-sports": espn.url };
  const { pool: appPool } = jiti("../../src/lib/server/db.ts");
  const { leagueShow } = jiti("../../src/lib/server/sports/matchup.ts");
  const user = (who) => fixture.username(who);
  try {
    const couch = (await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id;
    if (!couch) throw new Error("the zt_nd couch isn't up (run census-app.js --up, or this with --up)");
    const idOf = async (who) => (await pool.query('SELECT id FROM "user" WHERE username = $1', [user(who)])).rows[0].id;
    const call = (who) => signIn({ user: user(who), pass: fixture.PASSWORD, headers });
    for (const l of [...world.LEAGUE_NAMES, world.MB_NAME]) await leagueShow(appPool, "espn", l.league, "", null, { name: l.name, short: l.short });
    espn.events.push(...events());
    for (const [who, league, team] of COUCH) await (await call(who)).call("POST", "/api/sports/follow", { league, team, follow: true });
    const bg = espn.events.find((e) => e.id === "96451");
    // Casey, on the couch for the story's run with no team (the spectator); taken off after.
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [couch, await idOf("casey")]);
    caseyOn = { couch, id: await idOf("casey") };

    const shoot = async (name, who, go, o = {}) => {
      if (ONLY && !ONLY.includes(name)) return null;
      const b = await open({ user: user(who), pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      try {
        await b.page.goto(BASE + (o.path ?? `/league/${FB}/week`), { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-this-week]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(4000);
        if (o.scroll) {
          const el = b.page.locator(o.scroll).first();
          if (await el.count()) await el.evaluate((x) => window.scrollBy(0, x.getBoundingClientRect().top - 140));
          await b.page.waitForTimeout(500);
        }
        await go?.(b.page);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        await b.page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 84 });
        if (o.full) await b.page.screenshot({ path: path.join(OUT, `${name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
        fs.writeFileSync(path.join(OUT, `${name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
        const hits = await overlapsIn(b.page, H).catch(() => []);
        if (hits.length) OVERLAPS.push({ frame: name, hits });
        for (const h of hits) console.log(`OVERLAP ${name}: "${h[0]}" over "${h[1]}"`);
        const info = await b.page.evaluate(() => {
          const card = document.querySelector("[data-calls-card]");
          const fan = document.querySelector("[data-fan-card]");
          const r = card?.getBoundingClientRect();
          return {
            wide: document.documentElement.scrollWidth,
            yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).length,
            card: card ? `${Math.round(r.top)}-${Math.round(r.bottom)} (${Math.round(r.height)} px)` : null,
            words: card?.innerText.replace(/\s+/g, " ").trim() ?? null,
            fan: fan?.innerText.replace(/\s+/g, " ").trim() ?? null,
            callRow: document.querySelector("[data-team-now] [data-call-row]")?.innerText.replace(/\s+/g, " ").trim() ?? null,
            sheet: document.querySelector("[data-game-sheet]")?.innerText.replace(/\s+/g, " ").trim() ?? null,
          };
        });
        console.log(`SHOT ${name}  ${info.wide} px wide, ${info.yellow} yellow in view${info.card ? `, calls card ${info.card}` : ""}`);
        for (const k of ["words", "fan", "callRow", "sheet"]) if (info[k]) console.log(`      ${k}: ${info[k].slice(0, 400)}`);
        return info;
      } catch (e) {
        console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
        fails++;
        return null;
      } finally {
        await b.close();
      }
    };
    const tap = (sel) => async (pg) => {
      await pg.locator(sel).first().click();
      await pg.waitForTimeout(1500);
    };
    const setGame = async (state, score) => {
      bg.state = state;
      bg.at = new Date(now - 1.6 * HR).toISOString();
      if (score) bg.score = score;
      if (state === "in") bg.clock = { period: 3, display: "8:12", detail: "8:12 - 3rd", possession: G, down: "1st & 10" };
      else delete bg.clock;
      await pool.query("UPDATE season_events SET starts_at = $2 WHERE league = $1 AND event_id = $3", [FB, bg.at, bg.id]);
      await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
    };
    const teamPath = `/league/${FB}/team/${G}`;

    if (BEFORE) {
      await shoot("fan", "jordan", null, { full: true });
      await shoot("spectator", "sam", null, { full: true });
      await shoot("team-fan", "jordan", null, { path: teamPath, wait: "[data-team-page]", full: true });
      await shoot("team-spectator", "sam", null, { path: teamPath, wait: "[data-team-page]" });
      await setGame("in", [7, 10]);
      await shoot("sheet-on", "casey", tap(`[data-sched-row="${bg.id}"]`), { path: teamPath, wait: "[data-team-page]", scroll: `[data-sched-row="${bg.id}"]` });
      return;
    }

    // A season of Jordan's calls (made up): through the server functions, the clock a day before each game.
    const { pickCall } = jiti("../../src/lib/server/sports/calls.ts");
    const { pickedKindOf } = jiti("../../src/lib/sports/fan-call.ts");
    const StateLogic = jiti("../../src/lib/game/state-logic.js");
    const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
    const providers = sportsProviders({ base: espn.url });
    const asUser = async (who) => ({ id: await idOf(who), username: user(who), name: user(who) });
    const giants = espn.events.filter((e) => e.state === "post" && (e.home === G || e.away === G) && e.id.startsWith("964")).sort((a, b) => a.at.localeCompare(b.at));
    // Weeks 1-11: Jordan calls nine (Giants each time but Week 5, the Lions); Sam fades some, Casey backs some.
    const plan = [["G"], ["G", "fade"], ["G", null, "back"], ["G", "fade", "back"], ["L"], ["G", "fade"], null, ["G", "fade", "back"], ["G", "fade"], ["G", null, "back"], ["G"]];
    const jordan = await asUser("jordan");
    const sam = await asUser("sam");
    const casey = await asUser("casey");
    // A past episode has its result, so the engine refuses an answer there (rightly). The real functions make each game and join each
    // person at a clock a day before it (start.ts and the join take `now`); the answer the refusal kept out is then written straight
    // into the fixture's game_answers row, as the call would have made it.
    const seededLeagues = new Set();
    const seedPick = async (u, e, side, clock) => {
      await pickCall(u, couch, { league: FB, event: e.id, team: e.home, side }, clock).catch((err) => {
        if (!/closed|started|outside a request scope/.test(err.message)) throw err;
      });
      // Its game: the couch's call game (by its spec) whose one game is this one, with this person in it.
      const { rows: cands } = await pool.query(
        `SELECT m.league_id, m.player_id, l.state, se.episode FROM league_memberships m JOIN leagues l ON l.id = m.league_id
           JOIN shows s ON s.slug = l.state->'settings'->>'showId'
           JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
           JOIN season_events se ON se.season_id = ss.id AND se.event_id = $3 AND se.league = $4
          WHERE m.user_id = $1 AND l.couch_id = $2`,
        [u.id, couch, e.id, FB]
      );
      const rows = cands.filter((r) => pickedKindOf({ ask: StateLogic.AnswerLogic.questions(r.state) }) === "call" && StateLogic.startEpisode(r.state) === r.episode);
      if (!rows[0]) throw new Error(`no call game for ${u.username} on ${e.id}`);
      seededLeagues.add(rows[0].league_id);
      await pool.query(
        `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by) VALUES ($1, $2, 'winner', $3, to_jsonb($4::text), $5)
         ON CONFLICT (league_id, player_id, question, episode) DO UPDATE SET answer = EXCLUDED.answer`,
        [rows[0].league_id, rows[0].player_id, rows[0].episode, side, u.id]
      );
    };
    for (const [i, e] of giants.entries()) {
      const p = plan[i];
      if (!p) continue;
      const clock = { providers, now: new Date(Date.parse(e.at) - D) };
      const mine = p[0] === "G" ? G : e.home === G ? e.away : e.home;
      const other = mine === e.home ? e.away : e.home;
      await seedPick(jordan, e, mine, clock);
      if (p[1] === "fade") await seedPick(sam, e, other, clock);
      if (p[2] === "back") await seedPick(casey, e, mine, clock);
    }
    // The made-up history's games are stamped final (ep.gameFinal), as the app's final reads stamp a sports game's episode (they
    // don't run in the stand-in world); else each would ask its maker to fill in its episode's results.
    for (const id of seededLeagues) {
      const { rows } = await pool.query("SELECT state FROM leagues WHERE id = $1", [id]);
      const state = rows[0].state;
      for (const ep of state.episodes ?? []) ep.gameFinal = true;
      await pool.query("UPDATE leagues SET state = $2 WHERE id = $1", [id, state]);
    }
    const seeded = (await (await call("casey")).call("GET", `/api/sports/calls?couch=${couch}&league=${encodeURIComponent(FB)}&teams=${[E, J, C, G].join(",")}`)).body;
    check((seeded.games ?? []).length >= 9, "nine past calls seeded", `${(seeded.games ?? []).length}`);

    const f = await shoot("fan", "jordan", null, { full: true });
    if (f) check(f.yellow === 1, "one yellow on Jordan's page (his call, or the rivalry's)", `${f.yellow}`);
    const se = await shoot("spectator-empty", "casey");
    if (se) check(!se.words, "Casey sees no calls card before any call");
    await setting(pool, user("jordan"), "theme", "studio");
    await shoot("studio", "jordan");
    await setting(pool, user("jordan"), "theme", "night");
    // Jordan's call from the card itself (the real button).
    await shoot("fan-called", "jordan", tap(`[data-call-row="${bg.id}"] [data-call-pick="${G}"]`), { scroll: "[data-calls-card]" });
    const g1 = (await (await call("casey")).call("GET", `/api/sports/calls?couch=${couch}&league=${encodeURIComponent(FB)}&teams=${[E, J, C, G].join(",")}`)).body.games?.find((x) => x.event === bg.id);
    check(!!g1 && g1.picks.some((p) => p.side === G), "Jordan's call started the game, public to Casey", JSON.stringify(g1?.picks ?? null));
    await new Promise((r) => setTimeout(r, 1200));
    const pushes = await pool.query("SELECT count(*)::int AS n FROM notifications WHERE created_at > now() - interval '5 minutes' AND user_id IN (SELECT id FROM \"user\" WHERE username LIKE 'zt\\_nd\\_%') AND (title ILIKE '%call%' OR body ILIKE '%call%')");
    check(pushes.rows[0].n === 0, "a call sends no push", `${pushes.rows[0].n}`);
    const casePre = await (await call("casey")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: "96452", team: L, side: L });
    check(casePre.status === 409, "a back before any call is refused", `${casePre.status}`);
    const sp = await shoot("spectator", "sam", null, { scroll: "[data-calls-card]" });
    if (sp) check(/zt_nd_jordan called Giants.*\bBack\b.*\bFade\b/.test(sp.words ?? ""), "Sam sees Back · Fade on Jordan's call (a long name left off the buttons)");
    await shoot("spectator-faded", "sam", tap(`[data-call-row="${bg.id}"] [data-call-fade]`), { scroll: "[data-calls-card]" });
    await (await call("casey")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: bg.id, team: G, side: G });
    const change = await (await call("jordan")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: bg.id, team: G, side: B });
    check(change.status === 409, "Jordan's call stands once backed", `${change.status}`);
    await shoot("fan-backed", "jordan", null, { scroll: "[data-calls-card]" });
    const tf = await shoot("team-fan", "jordan", null, { path: teamPath, wait: "[data-team-page]", full: true });
    if (tf) check(/9–1/.test(tf.fan ?? ""), "the fan card's record: 9–1", tf.fan ?? "");
    await shoot("team-spectator", "sam", null, { path: teamPath, wait: "[data-team-page]", full: true });

    // On now: Jordan and Casey watching (Casey from the sheet's own toggle).
    await setGame("in", [7, 10]);
    const w = await (await call("jordan")).call("POST", `/api/sports/watching?couch=${couch}`, { league: FB, game: bg.id, on: true });
    check(w.status === 200, "Jordan marks watching", `${w.status}`);
    await shoot("sheet-watching", "casey", async (pg) => {
      await pg.locator(`[data-call-row="${bg.id}"] [data-call-game]`).first().click();
      await pg.waitForTimeout(2000);
      await pg.locator("[data-watching-toggle]").first().click();
      await pg.waitForTimeout(1500);
    }, { scroll: "[data-calls-card]" });
    const wl = (await (await call("sam")).call("GET", `/api/sports/watching?couch=${couch}&league=${encodeURIComponent(FB)}`)).body;
    check((wl.watching ?? []).filter((x) => x.game === bg.id).length === 2, "two watching, as Sam sees it", JSON.stringify(wl));
    await setting(pool, user("casey"), "share_where", false);
    const wl2 = (await (await call("sam")).call("GET", `/api/sports/watching?couch=${couch}&league=${encodeURIComponent(FB)}`)).body;
    check((wl2.watching ?? []).filter((x) => x.game === bg.id).length === 1, "Casey's mark hidden once she stops sharing When I'm watching");
    await setting(pool, user("casey"), "share_where", true);
    await shoot("on", "sam", null, { scroll: "[data-calls-card]" });
    const late = await (await call("sam")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: bg.id, team: G, side: G });
    check(late.status === 409, "a back after kickoff is refused", `${late.status}`);

    await setGame("post", [24, 17]);
    const o = await shoot("over", "casey", null, { scroll: "[data-calls-card]", full: true });
    if (o) check(/called it/i.test(o.words ?? "") && /10–1/.test(o.words ?? ""), "the result line and the record (10–1)", o.words ?? "");
    await setting(pool, user("casey"), "hide_sports_scores", true);
    const hd = await shoot("over-hidden", "casey", null, { scroll: "[data-calls-card]" });
    if (hd) check(!/called it|10–1|24/i.test(hd.words ?? ""), "hidden: no result, score or record", hd.words ?? "");
    await shoot("over-hidden-shown", "casey", async (pg) => {
      await pg.locator("[data-show-records]").first().click();
      await pg.waitForTimeout(1500);
      await pg.locator("[data-calls-card]").evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 140));
      await pg.waitForTimeout(500);
    });
    await setting(pool, user("casey"), "hide_sports_scores", false);
    await shoot("team-over", "jordan", null, { path: teamPath, wait: "[data-team-page]" });
  } catch (e) {
    console.error(e);
    fails++;
  } finally {
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 2));
    if (!has("keep")) {
      await world.cleanup(pool);
      if (caseyOn) await pool.query("DELETE FROM couch_members WHERE couch_id = $1 AND user_id = $2", [caseyOn.couch, caseyOn.id]);
    }
    await espn.close?.();
    await pool.end();
    await appPool.end?.().catch?.(() => {});
    console.log(fails ? `${fails} failed` : "all passed");
    process.exit(fails ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
