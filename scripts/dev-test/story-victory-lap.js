// Dev-only: the victory lap (docs/PLAN-sports-couch.md C3; the design: docs/design-round/victory-lap-spec.md, -first-view.md,
// -shape.md), every moment of it, for a design round's screenshot story and as a check of the laps route. On new-fixture.js's zt_nd
// couch, the stand-in ESPN (fake-espn.js by the x-gys-sports header) and the stand-in KLIPY (fake-gifs.js by x-gys-gifs): neither the
// real ESPN nor KLIPY is asked. The world is C2's (story-lone-fan.js): this week Bears at Giants (Jordan, the Giants' lone fan) and the
// Eagles at Jets rivalry (alex's Eagles, Riley's Jets); both made final here, the Giants 24-17 (Jordan called it, Sam faded him) and the
// Eagles 27-20. Casey follows no team: the spectator, and the one hiding sports scores.
//   won           Jordan's This week after the win: the lap card under the strip; .full
//   studio        the same in the light theme
//   sheet-ask     Jordan's game sheet for it: the ask under the couch line
//   pick          Take a victory lap: the lap sheet, the picker searching "Giants win"
//   say           a GIF picked: it big, the line, where it goes, Post it
//   posted        posted with a line: the lap as the couch sees it, Take it back
//   won-after     Jordan's This week after: no card, the room line names the lap
//   sam-sheet     Sam's game sheet: Victory laps
//   sam-room      Sam in the room's Bears at Giants thread: the lap message
//   sam-hub       Sam's hub: On the couch's lap row; .full
//   casey-hidden  Casey hiding sports scores: the hub with no lap
//   casey-shown   after Show records on This week, the hub again: the lap
//   rivalry       alex after the Eagles' rivalry win: "at riley's Jets"
//   skipped       alex after Not this time: the card gone
//   skip-sheet    alex's game sheet after: the quiet Take a victory lap
//   loser         Riley's This week: no card
// With --before (the old code checked out, e.g. git stash -u): won, sheet-ask, sam-room and sam-hub, after the same finals.
// Each frame: a .jpg at --width × --height, its words in a .txt, and words over words as OVERLAP lines (overlaps.json).
//
// Needs: the app (BASE) and the zt_nd couch (census-app.js --up, or new-fixture.js up; --up brings it up first); migration 0452 for the
// after frames. Every row it makes is a zt one and is removed after (check-sports-couch.js cleanup), unless --keep. One check at a time
// on the zt_nd couch.
// Run:   BASE=http://localhost:3019 node scripts/dev-test/story-victory-lap.js [--before] [--only=won,pick] [--out=...]
//          [--width=390 --height=844] [--up] [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const { open, api: signIn, BASE } = require("./browser");
const fixture = require("./new-fixture");
const fakeEspn = require("./fake-espn");
const fakeGifs = require("./fake-gifs");
const world = require("./check-sports-couch");
const { overlapsIn } = require("./overlaps");
const { now, at, HR, D, TEAMS, footballFor, COUCH, STANDINGS, E, C, G, J, B, L, FB } = require("./league-story-world");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-victory-lap runs against a local database only");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const BEFORE = has("before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/victory-lap/${BEFORE ? "before" : "after"}`));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", "") ? opt("only").split(",") : null;
const OVERLAPS = [];
let fails = 0;
let caseyOn = null;
const check = (ok, what, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}${detail ? `  ${detail}` : ""}`);
  if (!ok) fails++;
};

/** C2's world: this week reshaped (Bears at Giants, Cowboys at Lions), ids of their own (96 4xx). */
function events() {
  const xs = footballFor(4, true);
  Object.assign(xs.find((e) => e.id === "96451"), { away: B, home: G });
  Object.assign(xs.find((e) => e.id === "96452"), { away: C, home: L, at: at(2 * D + 5 * HR) });
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
  // The fan's search starts on "Giants win": tiles of its own, beside the mock's.
  const gifs = await fakeGifs.start({ extra: [["Giants win", "#1f4fb4", "#0b2a6b"], ["Giants win big", "#a3202d", "#4e0c13"], ["Giants win again", "#e9e6ef", "#1f4fb4"]] });
  const headers = { "x-gys-sports": espn.url, "x-gys-gifs": gifs.url };
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
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [couch, await idOf("casey")]);
    caseyOn = { couch, id: await idOf("casey") };
    const bg = espn.events.find((e) => e.id === "96451");
    const ej = espn.events.find((e) => e.id === "96450");

    // Jordan calls the Giants before kickoff and Sam fades him (the real route), then both games go final.
    const called = await (await call("jordan")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: bg.id, team: G, side: G });
    if (!BEFORE) check(called.status === 200, "Jordan calls the Giants", `${called.status}`);
    await (await call("sam")).call("POST", `/api/sports/calls?couch=${couch}`, { league: FB, event: bg.id, team: G, side: B });
    const final = async (e, score) => {
      e.state = "post";
      e.at = new Date(now - 3.5 * HR).toISOString();
      e.score = score;
      delete e.clock;
      delete e.odds;
      await pool.query("UPDATE season_events SET starts_at = $2 WHERE league = $1 AND event_id = $3", [FB, e.at, e.id]);
    };
    await final(bg, [24, 17]);
    await final(ej, [20, 27]);
    await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");

    /** One browser for a run of frames: each step acts, then its frame is shot. */
    const session = async (who, firstPath, steps, o = {}) => {
      const wanted = steps.filter((s) => !ONLY || ONLY.includes(s.name));
      if (!wanted.length) return {};
      const b = await open({ user: user(who), pass: fixture.PASSWORD, width: W, height: H, headers, motion: "reduce" });
      const got = {};
      try {
        await b.page.goto(BASE + firstPath, { waitUntil: "domcontentloaded" });
        await b.page.locator(o.wait ?? "[data-this-week]").first().waitFor({ timeout: 45000 });
        await b.page.waitForTimeout(4000);
        await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
        for (const s of steps) {
          await s.go?.(b.page);
          // A step that navigates loses the style: the dev server's badge stays out of every frame.
          await b.page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
          if (ONLY && !ONLY.includes(s.name)) continue;
          await b.page.screenshot({ path: path.join(OUT, `${s.name}.jpg`), type: "jpeg", quality: 84 });
          if (s.full) await b.page.screenshot({ path: path.join(OUT, `${s.name}.full.jpg`), type: "jpeg", quality: 78, fullPage: true });
          fs.writeFileSync(path.join(OUT, `${s.name}.txt`), await b.page.evaluate(() => document.body.innerText).catch(() => ""));
          const hits = await overlapsIn(b.page, H).catch(() => []);
          if (hits.length) OVERLAPS.push({ frame: s.name, hits });
          for (const h of hits) console.log(`OVERLAP ${s.name}: "${h[0]}" over "${h[1]}"`);
          const info = await b.page.evaluate(() => {
            const card = document.querySelector("[data-lap-card]");
            const r = card?.getBoundingClientRect();
            const words = (sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, " ").trim() ?? null;
            return {
              wide: document.documentElement.scrollWidth,
              yellow: [...document.querySelectorAll("*")].filter((e) => getComputedStyle(e).backgroundColor === "rgb(255, 197, 49)" && e.getBoundingClientRect().height > 20 && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0).length,
              card: card ? Math.round(r.height) : null,
              cardTop: card ? Math.round(r.top) : null,
              cardWords: words("[data-lap-card]"),
              sheet: words("[role=dialog]"),
              feed: words("[data-feed-list]"),
              laps: words("[data-victory-laps]"),
              room: words("[data-room-lap]"),
              all: document.body.innerText,
            };
          });
          console.log(`SHOT ${s.name}  ${info.wide} px wide, ${info.yellow} yellow in view${info.card ? `, lap card ${info.card} px at ${info.cardTop}` : ""}`);
          for (const k of ["cardWords", "sheet", "laps", "room"]) if (info[k]) console.log(`      ${k}: ${info[k].slice(0, 300)}`);
          got[s.name] = info;
        }
      } catch (e) {
        console.log(`FAIL ${who}: ${e.message.split("\n")[0]}`);
        fails++;
      } finally {
        await b.close();
      }
      return got;
    };
    const wait = (ms) => (pg) => pg.waitForTimeout(ms);
    const tap = (sel, ms = 1500) => async (pg) => {
      await pg.locator(sel).first().click();
      await pg.waitForTimeout(ms);
    };
    const closeSheet = async (pg) => {
      await pg.keyboard.press("Escape");
      await pg.waitForTimeout(800);
    };
    const week = `/league/${FB}/week`;
    const room = `/league/${FB}/chat?thread=${bg.id}`;
    const hubWait = { wait: "[data-feed-list]" };

    if (BEFORE) {
      await session("jordan", week, [
        { name: "won", full: true },
        { name: "sheet-ask", go: tap(`[data-call-row="${bg.id}"] [data-call-game]`, 2500) },
      ]);
      await session("sam", room, [{ name: "sam-room", go: wait(1500) }], { wait: "[data-msg], main" });
      await session("sam", "/home", [{ name: "sam-hub", full: true, go: async (pg) => pg.locator("[data-feed-list]").evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120)) }], hubWait);
      return;
    }

    // Jordan: the card, the sheet's ask, then the lap itself from the card.
    await setting(pool, user("jordan"), "theme", "studio");
    await session("jordan", week, [{ name: "studio" }]);
    await setting(pool, user("jordan"), "theme", "night");
    const j = await session("jordan", week, [
      { name: "won", full: true },
      { name: "sheet-ask", go: tap(`[data-call-row="${bg.id}"] [data-call-game]`, 2500) },
      {
        name: "pick",
        go: async (pg) => {
          await closeSheet(pg);
          await pg.evaluate(() => window.scrollTo(0, 0));
          await tap("[data-lap-card] [data-lap-take]", 2500)(pg);
        },
      },
      { name: "say", go: tap("[data-gif]", 1500) },
      {
        name: "posted",
        go: async (pg) => {
          await pg.locator("[data-lap-line]").fill("Never a doubt. Never.");
          await tap("[data-lap-post]", 2500)(pg);
        },
      },
      {
        name: "won-after",
        go: async (pg) => {
          await closeSheet(pg);
          await pg.reload({ waitUntil: "domcontentloaded" });
          await pg.locator("[data-this-week]").first().waitFor();
          await pg.waitForTimeout(4000);
          await pg.locator("[data-room-line]").first().evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 300)).catch(() => {});
        },
      },
    ]);
    if (j.won) {
      check(!!j.won.cardWords && /giants won/i.test(j.won.cardWords) && /you called it/i.test(j.won.cardWords), "Jordan's lap card: Giants won, you called it", j.won.cardWords ?? "none");
      check(j.won.card != null && j.won.card <= 120, "the card is at most 120 px", `${j.won.card}`);
      check(j.won.yellow === 0, "the card isn't yellow (nothing due on the page)", `${j.won.yellow}`);
    }
    if (j["sheet-ask"]) check(/Take a victory lap/.test(j["sheet-ask"].sheet ?? ""), "the game's sheet asks too");
    if (j.pick) check(gifs.asked.some((a) => /q=Giants(\+|%20)win/i.test(a)), "the picker searched Giants win", gifs.asked.slice(-2).join(" "));
    if (j["won-after"]) check(!j["won-after"].cardWords && /took a victory lap/.test(j["won-after"].all), "after: no card; the room line names the lap");
    const t0 = new Date(Date.now() - 60_000).toISOString();
    const lapsSam = (await (await call("sam")).call("GET", `/api/sports/laps?couch=${couch}&league=${encodeURIComponent(FB)}&teams=${C}`)).body;
    const lap = (lapsSam.laps ?? []).find((l) => l.event === bg.id);
    check(!!lap && lap.line === "Never a doubt. Never." && lap.score?.join("-") === "24-17", "the lap is the couch's, with its line and the final", JSON.stringify(lap ?? null).slice(0, 200));
    const pushes = await pool.query(`SELECT count(*)::int AS n FROM notifications WHERE created_at > $1 AND user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_nd\\_%')`, [t0]);
    check(pushes.rows[0].n === 0, "a lap sends no push", `${pushes.rows[0].n}`);
    const notFan = await (await call("sam")).call("POST", `/api/sports/laps?couch=${couch}`, { league: FB, event: bg.id, team: G, line: "ha" });
    check(notFan.status === 409, "a lap for a team you don't follow is refused", `${notFan.status}`);

    // Sam (no stake): the sheet, the room, the hub.
    const s = await session("sam", week, [{ name: "sam-sheet", go: tap(`[data-call-row="${bg.id}"] [data-call-game]`, 3000) }]);
    if (s["sam-sheet"]) check(/Never a doubt/.test(s["sam-sheet"].laps ?? ""), "Sam's game sheet shows Jordan's lap");
    const r = await session("sam", room, [{ name: "sam-room", go: wait(2000) }], { wait: "[data-msg], main" });
    if (r["sam-room"]) check(/victory lap/i.test(r["sam-room"].room ?? "") && /24–17/.test(r["sam-room"].room ?? ""), "the room's message wears the lap and its final", r["sam-room"].room ?? "none");
    const h = await session("sam", "/home", [{ name: "sam-hub", full: true, go: async (pg) => pg.locator("[data-feed-list]").evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120)) }], hubWait);
    if (h["sam-hub"]) check(/took a victory lap/.test(h["sam-hub"].feed ?? ""), "Sam's feed has the lap", (h["sam-hub"].feed ?? "").slice(0, 200));

    // Casey hiding sports scores: nothing of the lap, then all of it once she shows the week.
    await setting(pool, user("casey"), "hide_sports_scores", true);
    const c = await session(
      "casey",
      "/home",
      [
        { name: "casey-hidden", go: async (pg) => pg.locator("[data-feed-list]").evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120)) },
        {
          name: "casey-shown",
          go: async (pg) => {
            await pg.goto(BASE + week, { waitUntil: "domcontentloaded" });
            await pg.locator("[data-show-records]").first().waitFor({ timeout: 30000 });
            await pg.waitForTimeout(2500);
            await pg.locator("[data-show-records]").first().click();
            await pg.waitForTimeout(1000);
            await pg.goto(BASE + "/home", { waitUntil: "domcontentloaded" });
            await pg.locator("[data-feed-list]").first().waitFor();
            await pg.waitForTimeout(4000);
            await pg.locator("[data-feed-list]").evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120));
          },
        },
      ],
      hubWait
    );
    if (c["casey-hidden"]) check(!/victory lap|24–17/i.test(c["casey-hidden"].all), "hiding: no lap, no score on the hub");
    if (c["casey-shown"]) check(/took a victory lap/.test(c["casey-shown"].feed ?? ""), "after Show records: the lap");
    await setting(pool, user("casey"), "hide_sports_scores", false);

    // alex: the rivalry win, Not this time, the sheet's quiet link. Riley: nothing.
    const a = await session("alex", week, [
      { name: "rivalry" },
      { name: "skipped", go: tap("[data-lap-card] [data-lap-skip]", 2000) },
      {
        name: "skip-sheet",
        go: async (pg) => {
          await pg.goto(BASE + `/league/${FB}/team/${E}`, { waitUntil: "domcontentloaded" });
          await pg.locator("[data-team-page]").first().waitFor();
          await pg.waitForTimeout(3500);
          const row = pg.locator(`[data-sched-row="${ej.id}"]`).first();
          await row.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 200));
          await row.click();
          await pg.waitForTimeout(2500);
        },
      },
    ]);
    if (a.rivalry) check(/eagles won/i.test(a.rivalry.cardWords ?? "") && /at zt_nd_riley’s Jets/i.test(a.rivalry.cardWords ?? ""), "the rivalry's lap names the rival", a.rivalry.cardWords ?? "none");
    if (a.skipped) check(!a.skipped.cardWords, "Not this time: the card is gone");
    if (a["skip-sheet"]) check(/Take a victory lap/.test(a["skip-sheet"].sheet ?? "") && !/Not this time/.test(a["skip-sheet"].sheet ?? ""), "the sheet keeps the quiet link");
    const alexOpen = (await (await call("alex")).call("GET", `/api/sports/laps?couch=${couch}&league=${encodeURIComponent(FB)}&teams=${E}`)).body.open ?? [];
    check(alexOpen.length === 1 && alexOpen[0].skipped === true, "Not this time is kept on the server", JSON.stringify(alexOpen).slice(0, 160));
    const lo = await session("riley", week, [{ name: "loser" }]);
    if (lo.loser) check(!lo.loser.cardWords, "the losing fan gets no card");

    // Take it back: the room message and the lap go.
    const back = await (await call("jordan")).call("DELETE", `/api/sports/laps?couch=${couch}&league=${encodeURIComponent(FB)}&event=${bg.id}`);
    const after = (await (await call("sam")).call("GET", `/api/sports/laps?couch=${couch}&league=${encodeURIComponent(FB)}&teams=${C}`)).body.laps ?? [];
    check(back.status === 200 && !after.some((l) => l.event === bg.id), "Take it back removes the lap", `${back.status}`);
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
    await gifs.close?.();
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
