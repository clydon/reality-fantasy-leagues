// Dev-only test bank: the game page's title card (docs/PLAN-start-a-game-redo.md B1, chunk 7; docs/design-round/b1-title-card-*.md)
// in each situation, for the round's screenshot story and its check. Real renders at a phone's size on this lane's dev server and
// database (rfl_wizard: the real Survivor 51 at Episode 9 next, The Traitors 5, the stand-in sports seasons), as zt_nd_alex on
// gallery-fixture.js's couch. Games are made through the API as Start a game makes them (zt rows on the zt couch): a Fantasy league
// just started, a Survival pool, a game with a very long name, a game in stages, and a sport's Pick'em; the couch's own ZT Survivor
// 51 games (new-fixture.js: results through Episode 5) give a lineup due and someone behind. Each frame is the page's first view
// (<id>.jpg) and its words (<id>.txt); index.json has each frame's measures (the card's height and its name's size, where the week
// block's faces start, where the move ends, against the PFD budget: faces ≤ 290 px, a due move ending ≤ 664 px) and overlaps.json
// the words drawn over words. The setup screen's card for the same Fantasy league is a frame too (continuity).
//
//   node scripts/dev-test/gallery-fixture.js up --db=rfl_wizard
//   node scripts/dev-test/story-game-title.js [--out=.ui-atlas/stories/b1-title-card/after] [--base-url=http://localhost:3013]
//        [--width=390 --height=844] [--only=<regex on the frame id>] [--keep]
//
// Takes the games it made away after (--keep leaves them). zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_
// couch: never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
process.env.BASE = opt("base-url", process.env.BASE || "http://localhost:3013");
const BASE = process.env.BASE;
const { open, api } = require("./browser");
const { overlapsIn } = require("./overlaps");
const C = require("../../src/lib/game/start-gallery/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("story-game-title runs against a local database only");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/b1-title-card/after"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const KEEP = args.includes("--keep");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const pool = new Pool({ connectionString: DB });
  const { rows: couch } = await pool.query("SELECT id FROM couches WHERE name = 'ZT Survivor 51' LIMIT 1");
  if (!couch[0]) throw new Error("bring gallery-fixture.js up first");
  const couchId = couch[0].id;
  const seasonOf = async (name, n) => (await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.name = $1 AND ss.season_number = $2", [name, n])).rows[0]?.id ?? null;
  const s51 = await seasonOf("Survivor", 51);
  // new-fixture.js's own season (ZT Survivor 51), by the show its couch's leagues play.
  const zt = (
    await pool.query(
      `SELECT ss.id FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
         JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE l.couch_id = $1 AND l.deleted_at IS NULL AND s.name LIKE 'ZT %' LIMIT 1`,
      [couchId]
    )
  ).rows[0]?.id ?? null;
  // The stand-in Eagles season (check-sports-couch.js --api --keep), as gallery-fixture.js finds it: the one with the most games.
  const eagles = (
    await pool.query("SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = 'ztcf' ORDER BY (SELECT count(*) FROM season_episodes e WHERE e.season_id = ss.id) DESC LIMIT 1")
  ).rows[0]?.id ?? null;
  if (!eagles) console.log("SKIP sport: no stand-in Eagles season (run check-sports-couch.js --api --keep first)");
  // A sport's pages read ESPN: the stand-in check-sports-couch.js uses (its world, its header), never the real one.
  let espn = null;
  if (eagles) {
    try {
      const { TEAMS, EVENTS, LEAGUE_NAMES } = require("./check-sports-couch");
      espn = await require("./fake-espn").start({ teams: TEAMS, leagues: LEAGUE_NAMES, events: EVENTS });
    } catch (e) {
      console.log(`[espn] the stand-in didn't start: ${String(e.message || e).slice(0, 200)}`);
    }
  }
  const headers = espn ? { "x-gys-sports": espn.url } : {};
  const alex = await api({ user: "zt_nd_alex", pass: "zt-pass-12345", headers });
  const made = [];
  /** A catalog base started on a season as the sheet would (its span, its name). */
  const start = async (seasonId, baseId, name, spanOf) => {
    const o = (await alex.call("GET", `/api/seasons/${seasonId}/start?couch=${couchId}&wizard=1`)).body;
    if (!o.wizard) return null;
    const pg = C.pageFacts(o.wizard.page, { show: o.label });
    const sp = spanOf ? spanOf(o) : { from: o.from, to: null };
    const spec = C.baseSpec(C.baseById(baseId), sp, pg);
    if (!spec) return null;
    const r = await alex.call("POST", `/api/seasons/${seasonId}/start?couch=${couchId}`, { spec: Array.isArray(spec.stages) ? spec : { ...spec, span: sp }, name, tell: false, pace: "live", made: { how: "base", base: baseId } });
    if (r.status !== 200) {
      console.log(`SKIP ${name}: ${r.body && r.body.error}`);
      return null;
    }
    made.push(r.body.leagueId);
    return { seasonId, leagueId: r.body.leagueId };
  };
  const games = {};
  if (s51) {
    games.fantasy = await start(s51, "fantasy", "Fantasy league");
    games.pool = await start(s51, "pool", "Survival pool");
    games.long = await start(s51, "sheet", "The Tribal Council Prediction Spectacular", (o) => ({ from: o.from, to: o.from }));
    games.stages = await start(s51, "redraft", "Redraft at the merge");
  }
  if (eagles) {
    const o = (await alex.call("GET", `/api/seasons/${eagles}/start?couch=${couchId}&wizard=1`)).body;
    const r = o && o.wizard ? await alex.call("POST", "/api/sports/start?couch=" + couchId, { seasonId: eagles, game: "pickem", only: true, tell: false }) : null;
    if (r && r.status === 200) {
      made.push(r.body.leagueId);
      games.sport = { seasonId: eagles, leagueId: r.body.leagueId };
    } else console.log(`SKIP sport: ${r && r.body && r.body.error}`);
  }
  // The couch's own ZT Survivor 51 games: a lineup with results in (new-fixture.js).
  if (zt) {
    const { rows } = await pool.query(
      `SELECT l.id, l.name, l.state->'settings'->>'leagueTypeId' AS t FROM leagues l JOIN shows s ON s.slug = l.state->'settings'->>'showId'
        JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
        WHERE l.couch_id = $1 AND ss.id = $2 AND l.deleted_at IS NULL AND l.stage_of IS NULL ORDER BY l.created_at`,
      [couchId, zt]
    );
    const lineup = rows.find((r) => r.t === "active-roster") ?? rows[0];
    if (lineup) games.midseason = { seasonId: zt, leagueId: lineup.id };
  }

  const browser = await open({ user: "zt_nd_alex", pass: "zt-pass-12345", width: W, height: H, motion: "off", headers: espn ? headers : undefined });
  const p = browser.page;
  // The couch's names as a couch's own would read: the fixture's prefix dropped from what the page reads (nothing in the database).
  await p.route("**/api/**", async (route) => {
    const res = await route.fetch().catch(() => null);
    if (!res) return route.abort();
    if (!(res.headers()["content-type"] || "").includes("json")) return route.fulfill({ response: res });
    return route.fulfill({ response: res, body: (await res.text()).replace(/"zt_nd_([a-z]+)"/g, '"$1"') });
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message.split("\n")[0]));
  const index = [];
  const overlaps = [];
  const shoot = async (id, note) => {
    await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await p.waitForTimeout(700);
    const hits = await overlapsIn(p, H).catch(() => []);
    overlaps.push({ frame: id, hits });
    for (const h of hits) console.log(`OVERLAP ${id}: "${h[0]}" over "${h[1]}"`);
    await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 86 });
    fs.writeFileSync(path.join(OUT, `${id}.txt`), await p.evaluate(() => document.body.innerText));
    const m = await p.evaluate(() => {
      const top = (sel) => {
        const e = document.querySelector(sel);
        return e ? Math.round(e.getBoundingClientRect().top) : null;
      };
      const bottom = (sel) => {
        const e = document.querySelector(sel);
        return e ? Math.round(e.getBoundingClientRect().bottom) : null;
      };
      const name = document.querySelector("[data-game-card-name]");
      return {
        card: (() => {
          const e = document.querySelector("[data-game-card]");
          return e ? Math.round(e.getBoundingClientRect().height) : null;
        })(),
        nameSize: name ? Math.round(parseFloat(getComputedStyle(name).fontSize)) : null,
        sentence: !!document.querySelector("[data-game-sentence]"),
        weekTop: top("[data-week-card]"),
        // The week block's first picture (a face, a tile, a team's mark): its second row, under the episode's label.
        facesTop: top("[data-week-side], [data-week-starters], [data-week-card] > :nth-child(2)"),
        moveBottom: bottom('[data-game-strip][data-game-due="yes"], [data-game-strip] button, [data-week-reveal]'),
      };
    });
    const ok = (m.facesTop === null || m.facesTop <= 290) && (m.moveBottom === null || m.moveBottom <= 664);
    index.push({ id, note, ...m, withinBudget: ok });
    console.log(`${ok ? "FRAME" : "OVER "} ${id}: card ${m.card ?? "–"} px (name ${m.nameSize ?? "–"} px${m.sentence ? ", sentence" : ""}), week at ${m.weekTop ?? "–"}, faces at ${m.facesTop ?? "–"}, move ends ${m.moveBottom ?? "–"}`);
  };
  const frame = async (id, note, go) => {
    if (ONLY && !new RegExp(ONLY).test(id)) return;
    try {
      await go();
      await shoot(id, note);
    } catch (e) {
      console.log(`SKIP ${id}: ${String(e.message || e).split("\n")[0]}`);
    }
  };
  const page = async (g) => {
    await p.goto(`${BASE}/show/${g.seasonId}/game/${g.leagueId}`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-game-page]").waitFor({ timeout: 60000 });
    await p.waitForTimeout(1200);
  };
  try {
    if (games.fantasy) {
      await frame("t0-setup", "The setup screen's card for a Fantasy league (Start a game, Set it up)", async () => {
        await p.goto(`${BASE}/show/${games.fantasy.seasonId}/games`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-start-row], [data-play-start]").first().click({ timeout: 60000 });
        await p.locator("[data-gallery=gallery]").waitFor({ timeout: 60000 });
        await p.locator('[data-gallery-lead="fantasy"]').click();
        await p.locator("[data-gallery=base]").waitFor();
      });
      await frame("t1-started", "Just started: a Fantasy league, the draft not done (the maker's first visit)", () => page(games.fantasy));
    }
    if (s51) {
      // The maker's arrival: Start a game, the Fantasy league's screen, Start, the page with Start's toast (and its Undo, used after).
      await frame("t8-arrive", "Arriving from Start a game: the same card, Start's toast with Undo", async () => {
        await p.goto(`${BASE}/show/${s51}/games`, { waitUntil: "domcontentloaded" });
        await p.locator("[data-start-row], [data-play-start]").first().click({ timeout: 60000 });
        await p.locator("[data-gallery=gallery]").waitFor({ timeout: 60000 });
        await p.locator('[data-gallery-lead="fantasy"]').click();
        await p.locator("[data-gallery=base]").waitFor();
        await p.locator("[data-gallery-start]").click();
        await p.waitForURL(/\/game\//, { timeout: 30000 });
        await p.locator('[data-toast="done"]').waitFor({ timeout: 15000 });
        await p.waitForTimeout(400);
      });
      const undo = p.locator('[data-toast="done"] button');
      if (await undo.count()) await undo.click().catch(() => {});
    }
    if (games.pool) await frame("t2-pool", "Just started: a Survival pool, the first pick due", () => page(games.pool));
    if (games.long) await frame("t3-long", "A very long name: The Tribal Council Prediction Spectacular, one episode", () => page(games.long));
    if (games.stages) await frame("t4-stages", "A game in stages: the redraft at the merge", () => page(games.stages));
    if (games.sport) await frame("t5-sport", "A sport: the Eagles' next game, Pick'em", () => page(games.sport));
    if (games.midseason) await frame("t6-midseason", "Mid-season: the couch's lineup game, results through Episode 5, the next lineup", () => page(games.midseason));
    if (games.midseason) {
      await frame("t7-scrolled", "Mid-season, scrolled: the card under the bar", async () => {
        await page(games.midseason);
        await p.mouse.wheel(0, 400);
        await p.waitForTimeout(500);
      });
    }
  } finally {
    // A run with --only keeps the other frames' rows from the last run.
    let kept = [];
    try {
      if (ONLY) kept = JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8")).frames.filter((f) => !index.some((x) => x.id === f.id));
    } catch {
      /* no index yet */
    }
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ at: new Date().toISOString(), width: W, height: H, frames: [...kept, ...index], errors }, null, 1));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 1));
    await browser.close();
    if (espn) await espn.close().catch(() => {});
    if (!KEEP && made.length) await pool.query("UPDATE leagues SET deleted_at = now() WHERE id = ANY($1::uuid[]) OR stage_of = ANY($1::uuid[])", [made]).catch(() => {});
    await pool.end();
  }
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
  console.log(`frames in ${OUT}`);
}

main().catch((e) => {
  console.log(`FAIL ${e && e.stack}`);
  process.exit(1);
});
