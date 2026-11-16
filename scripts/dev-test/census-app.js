// The whole-app census for a design round (docs/DESIGN-ROUND-PACKET.md, Phase 0): today's app, surface by surface, in the
// situations a redesign must handle, rendered for real at a phone width and kept for the round's screenshot story.
//
// Two sources, both real renders of today's code:
//   - the app itself on the zt_nd couch (new-fixture.js), its two finished seasons (hub-fixture.js) and the guide's shows
//     (guide-fixture.js: a talk show, a series on air now, a streaming drop), signed in as each person: the hub and the guide,
//     the show's five tabs, the game pages and their sheets, the reveal, watch along, waivers, Backstage, settings, the
//     signed-out pages, and the watching-only situations (a show with no game, behind, friends at different paces, caught up
//     mid-season, an old season);
//   - the UI Atlas's registered cases (its recorded playtest couch and the derived states: saved, locked, waiting, early,
//     finished, solo, no couch...), through its /__atlas/activate, when the Atlas runs (--atlas);
//   - the gameplay bench's situations (docs/GAME-PAGE-SITUATIONS.md), opened on the explorer page on the real routes, then
//     their show's tabs and game page at the census width (--bench, --bench-situations=nfl-due,nba-week-in-progress): a
//     sports show, since no sports season lives in the local database. The cases are closed after (their zt-gb rows go).
//
// For each situation it keeps, under --out (default .ui-atlas/stories/phase0/census):
//   <id>.jpg        the first phone view
//   <id>.full.jpg   the whole page (unless the situation is first-view only)
//   <id>.txt        the page's words
//   <id>.json       what the first view holds: its blocks top to bottom, its controls, how many type sizes and text colours,
//                   how many words, and how many screens tall the page is (the busy test's measurable part)
// and index.json, every situation with its surface, flavor, lens and what happened, and overlaps.json, every frame's words that sit
// on other words (overlaps.js), printed as OVERLAP lines as they're found.
//
// Needs: the app on :3000 (npm run dev; BASE= for another); for --atlas, the Atlas on :4400 (bash scripts/dev-test/restart-atlas.sh).
// Run:   node scripts/dev-test/census-app.js [--up] [--atlas] [--bench] [--only=<regex on the id>] [--width=390 --height=844] [--out=<dir>] [--down]
//   --up     brings the three fixtures up first, layered in one process (their own CLIs each restart the base couch), dressed in
//            show art (fixture-art.js; the Drop Show stays bare, the no-art case) unless --no-art;
//   --notes-words=before|after   the bell's notices in today's push words or step 8's (notes-fixture.js; default after);
//   --down   takes them down after (new-fixture.js's down removes the hub's and the guide's rows too).
// The fixture rows are all zt-nd-/zt-gd- keyed; nothing here touches a real account or league. The reveal situation advances
// zt_nd_sam's mark, so it runs after sam's other situations and a rerun wants --up again. Never run it beside another check on
// the zt_nd fixture.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
/** Each frame's words that sit on other words (the screenshot story's rule: DESIGN-PROCESS.md, "No words over words"). */
const OVERLAPS = [];

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const BASE = process.env.BASE || "http://localhost:3000";
const ATLAS = opt("atlas-base", "http://127.0.0.1:4400");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/phase0/census"));
const ONLY = opt("only");
// For a design's variants on the same situations: --query=<a=b&c=d> is added to every page's address, --tap=<selector> is tapped
// (its first match, if there) before the shot, and --suffix=<-x> is added to each frame's id so variants don't overwrite.
const QUERY = opt("query", null), TAP = opt("tap", null), SUFFIX = opt("suffix", "");
const PASS = "zt-pass-12345";
// A name on the zt_nd couch ("alex"), or a whole zt_ username (a solo person: "zt_so_alex", solo-fixture.js).
const u = (who) => (who.startsWith("zt_") ? who : `zt_nd_${who}`);

// What each fixture id resolves to (filled by setup() from the database, so a fresh `--up` keeps working).
const ids = {};

async function setup() {
  const { Pool } = require("pg");
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("census-app runs against a local database only");
  const pool = new Pool({ connectionString: DB });
  try {
    if (has("up")) {
      // Dressed in show art (fixture-art.js) unless --no-art: the census is for judging character as well as structure.
      const art = !has("no-art");
      const fx = await require("./new-fixture").up(pool, { art });
      await require("./hub-fixture").up(pool, fx, { art });
      await require("./guide-fixture").up(pool, fx, { art });
      await require("./crew-fixture").up(pool);
      // People on no couch, for the solo hub (the design round's step 7).
      await require("./solo-fixture").up(pool);
      // A week of the bell's notices in today's push words (step 8), the bell last read five days ago.
      await require("./notes-fixture").up(pool, { read: true, words: opt("notes-words", "after") });
    }
    const q = async (sql, p) => (await pool.query(sql, p)).rows;
    for (const r of await q(`SELECT ss.id, sh.slug, ss.season_number FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug LIKE 'zt-nd-%' OR sh.slug LIKE 'zt-gd-%' OR sh.slug LIKE 'zt-cr-%'`)) {
      const key = r.slug === "zt-nd-survivor" ? `s${r.season_number}` : r.slug.replace(/^zt-(nd|gd|cr)-/, "");
      ids[key] = r.id;
    }
    for (const r of await q(`SELECT id, slug FROM leagues WHERE slug LIKE 'zt-nd-%' AND deleted_at IS NULL`)) ids[r.slug.replace(/^zt-nd-/, "")] = r.id;
  } finally {
    await pool.end();
  }
}

async function teardown() {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL || "" });
  try { await require("./new-fixture").down(pool); await require("./solo-fixture").down(pool); console.log("[census] fixtures down"); } finally { await pool.end(); }
}

// ---- helpers for a situation's own steps ----
// (Chat opens at its newest message, as the app scrolls it: capture() resets to the top first, so a chat case scrolls back down.)
const tap = async (p, sel, i = 0) => { const l = p.locator(sel).nth(i); await l.waitFor({ timeout: 15000 }); await l.click(); await p.waitForTimeout(900); };
const sheetOpen = async (p) => { await p.locator('[role="dialog"], [data-sheet]').last().waitFor({ timeout: 10000 }); await p.waitForTimeout(700); };
const scrollTo = async (p, sel) => { await p.locator(sel).first().evaluate((e) => e.scrollIntoView({ block: "start" })); await p.waitForTimeout(600); };

// ---- the situations ----
// flavor: competition | sports | story; lens: the frame's lenses or the brief's situations it stands for.
function situations() {
  const S51 = ids.s51, TR = ids.traitors, S50 = ids.s50, S49 = ids.s49, LATE = ids["late-show"], LIVE = ids["live-now"], DROP = ids["drop-show"];
  const show = (sid, tab) => `/show/${sid}/${tab}`;
  return [
    // The hub and the guide
    { id: "hub-alex", surface: "hub", who: "alex", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "playing live, several shows, a couch", full: true },
    { id: "hub-sam", surface: "hub", who: "sam", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "two episodes behind", full: true },
    { id: "hub-casey", surface: "hub", who: "casey", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "a small couch, one game", full: true },
    // The guide: inline on the hub before the design round's step 7, its own page (opened from On TV) since. Each act works on both.
    { id: "hub-guide", surface: "guide", who: "alex", go: "/home", ready: "[data-guide-card]", act: async (p) => { if (await p.locator("[data-on-tv-open]").count()) { await tap(p, "[data-on-tv-open]"); await p.locator("[data-guide-page]").waitFor({ timeout: 15000 }); await p.waitForTimeout(900); } else await scrollTo(p, "[data-guide-card]"); }, flavor: "mixed", lens: "the TV guide: today", full: false },
    { id: "hub-guide-tomorrow", surface: "guide", who: "alex", go: "/home", ready: "[data-guide-card]", act: async (p) => { if (await p.locator("[data-on-tv-open]").count()) { await tap(p, '[data-on-tv] [data-guide-day="1"] [data-guide-card]'); await p.locator('[data-guide-page] [data-guide-day="1"]').waitFor({ timeout: 15000 }); await p.waitForTimeout(900); } else { await scrollTo(p, "[data-guide-card]"); await p.locator("[data-guide-reel]").evaluate((e) => (e.scrollLeft = 165)); await p.waitForTimeout(500); } }, flavor: "mixed", lens: "the TV guide: a card in On TV's crawl opens its day (tomorrow)", full: false },
    { id: "hub-guide-alltv", surface: "guide", who: "alex", go: "/home", ready: "[data-guide-card]", act: async (p) => { if (await p.locator("[data-on-tv-open]").count()) { await tap(p, "[data-on-tv-open]"); await p.locator("[data-guide-page]").waitFor({ timeout: 15000 }); } else await scrollTo(p, "[data-guide-card]"); await tap(p, '[data-guide-tv-choice="all"]'); await p.waitForTimeout(1500); if (await p.locator("[data-guide-page]").count()) await p.locator("[data-guide-page] [data-guide-day]").first().evaluate((e) => e.scrollIntoView({ block: "start" })); await p.waitForTimeout(600); }, flavor: "mixed", lens: "the TV guide: All TV (Also on under your shows)", full: true },
    { id: "hub-guide-foot", surface: "guide", who: "alex", go: "/home", ready: "[data-guide-card]", act: async (p) => { if (await p.locator("[data-on-tv-open]").count()) { await tap(p, "[data-on-tv-open]"); await p.locator("[data-guide-page]").waitFor({ timeout: 15000 }); await p.waitForTimeout(600); } const rail = p.locator("[data-rail]").last(); if (await rail.count()) await rail.evaluate((e) => e.scrollIntoView({ block: "center" })); await p.waitForTimeout(600); }, flavor: "mixed", lens: "streaming: on the hub before step 7, At your own pace in the guide since", full: false },
    { id: "hub-solo", surface: "hub", who: "zt_so_alex", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "solo: on no couch", full: true },
    { id: "hub-new-couch", surface: "hub", who: "casey", go: "/home?hub=new", ready: "[data-hub]", flavor: "competition", lens: "a brand-new couch (the hub's grow shape)", full: false },
    { id: "hub-riley", surface: "hub", who: "riley", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "caught up, all set or a move due, a Game admin", full: false },
    { id: "hub-add-show", surface: "hub", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-add-show-poster]"); await sheetOpen(p); }, flavor: "mixed", lens: "following: Add a show", full: false },
    { id: "hub-tour", surface: "onboarding", who: "sam", tour: true, go: "/home?tour=1", ready: "[data-hub]", flavor: "competition", lens: "first-time tour, its welcome card", full: false },
    { id: "hub-bell-dot", surface: "notifications", who: "alex", go: "/home", ready: "[data-hub]", flavor: "competition", lens: "notifications: the bell's dot on the hub, a week unread", full: false },
    { id: "hub-bell", surface: "notifications", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-bell]"); await p.waitForTimeout(900); }, flavor: "mixed", lens: "notifications: the bell", full: false },
    { id: "hub-bell-sam", surface: "notifications", who: "sam", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-bell]"); await p.waitForTimeout(900); }, flavor: "competition", lens: "notifications: the bell, two episodes behind (the guard's words)", full: false },
    { id: "hub-bell-more", surface: "notifications", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-bell]"); await p.waitForTimeout(900); await p.locator("[data-note]").last().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(600); }, flavor: "competition", lens: "notifications: the bell, scrolled to its oldest", full: false },
    { id: "settings-notify", surface: "notifications", who: "alex", go: "/settings", ready: "body", wait: 2500, act: async (p) => { await tap(p, ':is(button,a):has-text("Which notifications")'); await p.waitForTimeout(1200); }, flavor: "mixed", lens: "notifications: Settings' What we notify you about", full: false },
    { id: "show-notify", surface: "notifications", who: "alex", go: () => `/show/${ids.s51}/tonight`, ready: '[data-tab="tonight"]', act: async (p) => { await tap(p, 'button[aria-label^="Show menu"]'); await p.waitForTimeout(700); await tap(p, ':is(button,a):has-text("Notifications")'); await sheetOpen(p); }, flavor: "competition", lens: "notifications: a show's own, from its ⋯ menu", full: false },
    { id: "hub-profile-menu", surface: "settings", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, '[data-tour="you"]'); await p.waitForTimeout(900); }, flavor: "mixed", lens: "your picture's menu", full: false },
    { id: "start-1", surface: "onboarding", who: null, go: "/start/1", ready: "body", wait: 2500, flavor: "mixed", lens: "first run, step 1: your shows", full: false },
    { id: "pace-sheet-alex", surface: "tonight", who: "alex", go: () => `/show/${ids.s51}/tonight`, ready: '[data-tab="tonight"]', act: async (p) => { await tap(p, '[aria-label^="Where everyone is"]'); await p.waitForTimeout(1000); }, flavor: "competition", lens: "where everyone is: the couch's pace", full: false },
    { id: "progress-chooser-sam", surface: "episodes", who: "sam", go: () => `/show/${ids.s51}/episodes`, ready: '[data-tab="episodes"]', act: async (p) => { await tap(p, ':is([data-progress-mark], button:has-text("Spoiler-safe"))'); await p.waitForTimeout(1000); }, flavor: "competition", lens: "the viewing-progress chooser (the compact control's mark since step 4; Spoiler-safe › Change before)", full: false },

    // A competition show, three linked games (ZT Survivor 51): alex caught up with a move due, sam two behind
    { id: "tonight-alex", surface: "tonight", who: "alex", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "caught up mid-season, live, a move due", full: true },
    { id: "tonight-sam", surface: "tonight", who: "sam", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "two behind, results waiting", full: true },
    { id: "tonight-riley", surface: "tonight", who: "riley", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "caught up, a Game admin", full: false },
    { id: "moves-alex", surface: "moves", who: "alex", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', act: async (p) => { await tap(p, ':is(button,a):has-text("Make my pick")'); await p.waitForTimeout(900); }, flavor: "competition", lens: "Your moves, opened from Tonight", full: false },
    { id: "episodes-alex", surface: "episodes", who: "alex", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "caught up", full: true },
    { id: "episodes-sam", surface: "episodes", who: "sam", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "two behind", full: true },
    { id: "episode-page-alex", surface: "episodes", who: "alex", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', act: async (p) => { await tap(p, ':is(button,a):has-text("Carter out")'); await p.waitForTimeout(900); }, flavor: "competition", lens: "one episode's page", full: true },
    { id: "episode-page-alex-foot", surface: "episodes", who: "alex", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', act: async (p) => { await p.waitForTimeout(0); await tap(p, ':is(button,a):has-text("Carter out")'); await p.waitForTimeout(900);  await p.locator("[data-replay-reveal]").last().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(600); }, flavor: "competition", lens: "one episode's page", full: false },
    { id: "games-alex", surface: "games", who: "alex", go: show(S51, "games"), ready: '[data-tab="games"]', flavor: "competition", lens: "three games, a move due", full: true },
    { id: "games-sam", surface: "games", who: "sam", go: show(S51, "games"), ready: '[data-tab="games"]', flavor: "competition", lens: "two behind", full: false },
    { id: "games-person-sheet", surface: "games", who: "alex", go: show(S51, "games"), ready: '[data-tab="games"]', act: async (p) => { await tap(p, ':is(button,a,[role=button]):has-text("jordan")'); await sheetOpen(p); }, flavor: "competition", lens: "a table row opens that player's sheet", full: false },
    { id: "game-lineup-alex", surface: "game", who: "alex", go: () => `/show/${S51}/game/${ids.lineup}`, ready: "[data-game-page]", flavor: "competition", lens: "Weekly Lineup, a lineup due", full: true },
    { id: "game-outlast-alex", surface: "game", who: "alex", go: () => `/show/${S51}/game/${ids.outlast}`, ready: "[data-game-page]", flavor: "competition", lens: "Outlast (exclusive draft)", full: true },
    { id: "game-pool-alex", surface: "game", who: "alex", go: () => `/show/${S51}/game/${ids.pool}`, ready: "[data-game-page]", flavor: "competition", lens: "Survival Pool", full: true },
    { id: "game-lineup-sheet", surface: "game", who: "alex", go: () => `/show/${S51}/game/${ids.lineup}`, ready: "[data-game-page]", act: async (p) => { await tap(p, "[data-game-page] [data-move], [data-game-page] [data-your-move], [data-game-page] a:has-text('lineup'), [data-game-page] button:has-text('lineup')"); await sheetOpen(p); }, flavor: "competition", lens: "the lineup sheet", full: false },
    { id: "game-person-sheet", surface: "game", who: "alex", go: () => `/show/${S51}/game/${ids.lineup}`, ready: "[data-game-page]", act: async (p) => { await tap(p, "[data-game-page] [data-sheet-open], [data-game-page] button:has-text('Your sheet'), [data-game-page] a:has-text('Your sheet')"); await sheetOpen(p); }, flavor: "competition", lens: "your sheet (the person sheet)", full: false },
    { id: "cast-alex", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", flavor: "competition", lens: "caught up", full: true },
    { id: "cast-sheet", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, ':is(button,a,[role=button]):has-text("JELLY")'); await sheetOpen(p); }, flavor: "competition", lens: "a castaway's sheet", full: false },
    // Step 5's drill levels: the numbers (one table, the show's facts), a game chosen as the lens, the person sheet's numbers and
    // games, the compare, and a game's own sheet for them opened from the person sheet.
    { id: "cast-numbers", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: (p) => scrollTo(p, "[data-numbers]"), flavor: "competition", lens: "the numbers: counted by the show", full: false },
    { id: "cast-lens", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, '[data-lens-option][aria-checked="false"]'); await p.locator("[data-lens-game]").first().waitFor({ timeout: 10000 }); await scrollTo(p, "[data-numbers]"); }, flavor: "competition", lens: "the numbers: a game chosen", full: false },
    { id: "cast-sheet-more", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, ':is(button,a,[role=button]):has-text("JELLY")'); await sheetOpen(p); await p.locator("[data-their-numbers], [data-story]").first().evaluate((e) => e.scrollIntoView({ block: "start" })).catch(() => {}); await p.waitForTimeout(600); }, flavor: "competition", lens: "a castaway's sheet: their numbers and games", full: false },
    { id: "cast-compare", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, ':is(button,a,[role=button]):has-text("JELLY")'); await sheetOpen(p); await tap(p, "[data-compare-with]"); await p.waitForTimeout(600); await tap(p, '[data-face-wall] button[data-cast="Ori"]'); await sheetOpen(p); }, flavor: "competition", lens: "two side by side", full: false },
    { id: "cast-game-sheet", surface: "cast", who: "alex", go: show(S51, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, ':is(button,a,[role=button]):has-text("JELLY")'); await sheetOpen(p); await tap(p, "[data-person-game]"); await p.waitForTimeout(900); await sheetOpen(p); }, flavor: "competition", lens: "In your games: their sheet in one game", full: false },
    { id: "chat-alex", surface: "chat", who: "alex", go: show(S51, "chat"), ready: "[data-chat]", act: async (p) => { await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600); }, flavor: "competition", lens: "caught up", full: false },
    { id: "chat-sam", surface: "chat", who: "sam", go: show(S51, "chat"), ready: "[data-chat]", act: async (p) => { await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600); }, flavor: "competition", lens: "two behind: the fold", full: false },
    { id: "watch-alex", surface: "watch", who: "alex", go: show(S51, "tonight") + "?page=watch", ready: "[data-watch-along], [data-tab='tonight']", flavor: "competition", lens: "watch along", full: false },
    { id: "waivers-alex", surface: "waivers", who: "alex", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, flavor: "competition", lens: "waivers", full: true },
    { id: "waivers-sam", surface: "waivers", who: "sam", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, flavor: "competition", lens: "waivers, two episodes behind (gated)", full: true },
    { id: "waivers-riley", surface: "waivers", who: "riley", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, flavor: "competition", lens: "waivers, nothing to replace (swaps)", full: true },
    { id: "waivers-pick", surface: "waivers", who: "alex", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, act: async (p) => { const plate = p.locator('[data-wv-plate] [data-swap]'); if (await plate.count()) await plate.first().click(); else await p.getByRole("button", { name: "Swap", exact: true }).last().click(); await sheetOpen(p); }, flavor: "competition", lens: "waivers: the claim picker", full: false },
    { id: "waivers-how", surface: "waivers", who: "alex", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, act: async (p) => { await tap(p, ':is(button,a):has-text("How waivers work")'); await sheetOpen(p); }, flavor: "competition", lens: "waivers: How waivers work here", full: false },
    { id: "waivers-lineup", surface: "waivers", who: "alex", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, act: async (p) => { await tap(p, ':is(button,a):has-text("Weekly Lineup")'); await p.waitForTimeout(900); }, flavor: "competition", lens: "waivers: the other game (shared draft)", full: true },
    { id: "scoring-alex", surface: "scoring", who: "alex", go: `/show/${S51}/scoring`, ready: "body", wait: 2500, flavor: "competition", lens: "how it scores", full: true },
    { id: "backstage-alex", surface: "backstage", who: "alex", go: `/show/${S51}/backstage`, ready: "body", wait: 2500, flavor: "competition", lens: "a commissioner's Backstage", full: true },
    { id: "start-game-alex", surface: "wizard", who: "riley", go: show(TR, "games"), ready: '[data-tab="games"]', flavor: "competition", lens: "a watched show with no game: start one", full: true },

    // Watching only
    { id: "watchonly-riley-traitors", surface: "tonight", who: "riley", go: show(TR, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "watching only, no game; friends at different paces (riley 2, jordan 4)", full: true },
    { id: "watchonly-jordan-traitors", surface: "tonight", who: "jordan", go: show(TR, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "watching only, ahead of a friend, a private follow", full: false },
    { id: "where-riley-traitors", surface: "episodes", who: "riley", go: show(TR, "episodes"), ready: '[data-tab="episodes"]', act: async (p) => { await tap(p, ':is([data-progress-mark], button:has-text("Spoiler-safe"))'); await p.waitForTimeout(1200); }, flavor: "competition", lens: "where you are on a show you watch: the episode ledger (step 4)", full: false },
    { id: "watchonly-riley-episodes", surface: "episodes", who: "riley", go: show(TR, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "watching only: episodes", full: true },
    { id: "watchonly-riley-cast", surface: "cast", who: "riley", go: show(TR, "cast"), ready: "[data-cast]", flavor: "competition", lens: "watching only: the cast", full: false },
    // A crew (crew-fixture.js): each person's role under their name, grouped by department (the user, 2026-11-15).
    { id: "crew-alex-cast", surface: "cast", who: "alex", go: () => `/show/${ids.yacht}/cast`, ready: "[data-cast]", flavor: "story", lens: "a crew: roles and departments", full: false },
    { id: "watchonly-riley-cast-sheet", surface: "cast", who: "riley", go: show(TR, "cast"), ready: "[data-cast]", act: async (p) => { await tap(p, "[data-face-wall] button[data-cast]"); await sheetOpen(p); }, flavor: "competition", lens: "watching only: a player's sheet (a secret role)", full: false },
    { id: "watchonly-riley-chat", surface: "chat", who: "riley", go: show(TR, "chat"), ready: "[data-chat]", act: async (p) => { await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600); }, flavor: "competition", lens: "watching only: the chat", full: false },
    { id: "story-late-show", surface: "tonight", who: "alex", go: show(LATE, "tonight"), ready: '[data-tab="tonight"]', flavor: "story", lens: "a talk show, nightly, watching only", full: true },
    { id: "story-late-show-episodes", surface: "episodes", who: "alex", go: show(LATE, "episodes"), ready: '[data-tab="episodes"]', flavor: "story", lens: "a talk show's episodes", full: false },
    { id: "story-live-now", surface: "tonight", who: "alex", go: show(LIVE, "tonight"), ready: '[data-tab="tonight"]', flavor: "story", lens: "a series on air right now, watching only", full: false },
    { id: "story-drop-show", surface: "tonight", who: "riley", go: show(DROP, "tonight"), ready: '[data-tab="tonight"]', flavor: "story", lens: "a streaming drop, all eight at once, not out yet", full: false },
    { id: "old-season-alex", surface: "tonight", who: "alex", go: () => show(ids.s50, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "an old season, finished, seen to the end", full: true },
    { id: "old-season-games", surface: "games", who: "alex", go: () => show(ids.s50, "games"), ready: '[data-tab="games"]', flavor: "competition", lens: "an old season's games (won)", full: false },

    // Account and signed out
    { id: "settings-alex", surface: "settings", who: "alex", go: "/settings", ready: "body", wait: 2500, flavor: "mixed", lens: "settings", full: true },
    { id: "welcome", surface: "onboarding", who: null, go: "/welcome", ready: "body", wait: 2500, flavor: "mixed", lens: "signed out: the landing", full: true },
    { id: "signin", surface: "onboarding", who: null, go: "/signin", ready: "body", wait: 2500, flavor: "mixed", lens: "signed out: sign in", full: false },

    // Last: the reveal (it moves sam's mark)
    { id: "reveal-sam-1", surface: "reveal", who: "sam", go: show(S51, "tonight") + "?page=reveal&ep=4", ready: "body", wait: 2500, flavor: "competition", lens: "the reveal, its opening", full: false },
    { id: "reveal-sam-2", surface: "reveal", who: "sam", continue: true, act: async (p) => { await p.mouse.click(W * 0.8, H * 0.5); await p.waitForTimeout(1800); await p.mouse.click(W * 0.8, H * 0.5); await p.waitForTimeout(1800); }, flavor: "competition", lens: "the reveal, two beats on", full: false },
    { id: "reveal-sam-3", surface: "reveal", who: "sam", continue: true, act: async (p) => { for (let i = 0; i < 3; i++) { await p.mouse.click(W * 0.8, H * 0.5); await p.waitForTimeout(1600); } }, flavor: "competition", lens: "the reveal, later beats", full: false },
    { id: "reveal-sam-end", surface: "reveal", who: "sam", continue: true, act: async (p) => { for (let i = 0; i < 4; i++) { await p.mouse.click(W * 0.8, H * 0.5); await p.waitForTimeout(1600); } }, flavor: "competition", lens: "the reveal, its table and its end (step 4: one primary)", full: false },
  ];
}

// The Atlas's cases worth a frame in the census (the recorded playtest couch and its derived states).
const ATLAS_CASES = [
  "hub.no-couch", "hub.empty-couch", "hub.one-show", "hub.multiple-shows",
  "tonight.live", "tonight.watcher", "tonight.catchup", "tonight.reveal-ready", "tonight.solo", "tonight.caught-up", "tonight.saved",
  "tonight.locked", "tonight.waiting", "tonight.early", "tonight.finished", "tonight.loading", "tonight.error",
  "episodes.watcher", "games.live", "games.watcher", "games.solo", "cast.live", "chat.live",
  "game.live", "scoring.live", "draft.drafting", "blind.drafting", "wizard.live", "watch.live", "welcome.live",
];

// ---- capture ----
async function measure(p) {
  return p.evaluate(({ W, H }) => {
    const inView = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
    const sizes = new Set(), colors = new Set();
    let words = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const n = walker.currentNode, el = n.parentElement;
      if (!el || !n.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const range = document.createRange(); range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (!inView(r)) continue;
      sizes.add(Math.round(parseFloat(cs.fontSize)));
      colors.add(cs.color);
      if (!seen.has(n)) { seen.add(n); words += n.textContent.trim().split(/\s+/).length; }
    }
    const controls = [...document.querySelectorAll("button, a[href], [role=button], input, select, textarea")].map((e) => {
      const r = e.getBoundingClientRect();
      return { label: (e.getAttribute("aria-label") || e.innerText || e.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 80), y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), first: inView(r) && r.top >= 0 && r.bottom <= H };
    }).filter((c) => c.h > 0 && c.w > 0);
    // The first view's blocks: the top-level pieces a person reads, top to bottom (a heading, a card, a row of faces).
    const blocks = [];
    for (const el of document.querySelectorAll("h1, h2, h3, h4, [data-section], section > *:first-child, header, nav")) {
      const r = el.getBoundingClientRect();
      if (!inView(r) || r.top < -5) continue;
      const t = (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 90);
      if (t) blocks.push({ y: Math.round(r.top), tag: el.tagName.toLowerCase(), text: t });
    }
    blocks.sort((a, b) => a.y - b.y);
    const doc = document.scrollingElement || document.documentElement;
    return { typeSizes: [...sizes].sort((a, b) => a - b), textColours: colors.size, words, controlsInFirstView: controls.filter((c) => c.first).length, screensTall: +(doc.scrollHeight / H).toFixed(1), wide: doc.scrollWidth > doc.clientWidth + 1, blocks: blocks.slice(0, 40), controls: controls.slice(0, 120) };
  }, { W, H });
}

async function capture(p, s) {
  const base = path.join(OUT, s.id + SUFFIX);
  await p.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  // The dev server's own badge (Next's dev tools) isn't the app's: hidden from the frames.
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (s.act) await s.act(p);
  if (TAP) {
    const el = p.locator(TAP).first();
    if (await el.count()) {
      await el.click();
      await p.waitForTimeout(900);
    }
  }
  await p.waitForTimeout(s.wait || 700);
  // A frame in the fallback face isn't today's app: one run on 2026-11-14 caught the dev server mid-recompile and kept a
  // whole batch in Arial, which read as "the condensed display font is missing at 390". Wait for Archivo, fail if it never comes.
  const face = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!face) throw new Error("Archivo never loaded: the frame would show the fallback face (is the dev server mid-recompile?)");
  // Words over words in the first view (overlaps.js, as story-situations.js reports them): printed, and kept in overlaps.json.
  const hits = await overlapsIn(p, H).catch(() => []);
  OVERLAPS.push({ frame: path.basename(base), hits });
  for (const h of hits) console.log(`OVERLAP ${path.basename(base)}: "${h[0]}" over "${h[1]}"`);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 82 });
  const m = await measure(p);
  const text = await p.evaluate(() => document.body.innerText).catch(() => "");
  fs.writeFileSync(base + ".txt", text);
  if (s.full) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 78, fullPage: true });
  }
  fs.writeFileSync(base + ".json", JSON.stringify({ id: s.id, surface: s.surface, flavor: s.flavor, lens: s.lens, url: p.url(), measuredAt: new Date().toISOString(), ...m }, null, 2));
  return m;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const index = fs.existsSync(path.join(OUT, "index.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8")) : {};
  const want = (id) => !ONLY || new RegExp(ONLY).test(id);
  await setup();
  const sessions = new Map();
  const session = async (who, tour) => {
    const key = (who || "anon") + (tour ? ":tour" : "");
    if (!sessions.has(key)) sessions.set(key, await open(who ? { user: u(who), pass: PASS, width: W, height: H, motion: "reduce", tour: !!tour } : { width: W, height: H, motion: "reduce" }));
    return sessions.get(key);
  };
  try {
    for (const s of situations().filter((x) => want(x.id))) {
      try {
        const b = await session(s.who, s.tour);
        if (!s.continue) {
          const go = typeof s.go === "function" ? s.go() : s.go;
          if (!go || /undefined/.test(go)) throw new Error("its fixture id is missing (run with --up)");
          await b.page.goto(BASE + go + (QUERY ? (go.includes("?") ? "&" : "?") + QUERY : ""), { waitUntil: "domcontentloaded" });
          await b.page.locator(s.ready).first().waitFor({ timeout: 45000 });
          await b.page.waitForTimeout(1500);
        }
        const m = await capture(b.page, s);
        index[s.id] = { source: "app", surface: s.surface, flavor: s.flavor, lens: s.lens, who: s.who ? u(s.who) : "signed out", ok: true, typeSizes: m.typeSizes.length, textColours: m.textColours, words: m.words, controls: m.controlsInFirstView, screensTall: m.screensTall, wide: m.wide };
        console.log(`PASS ${s.id}: ${m.screensTall} screens, ${m.typeSizes.length} sizes, ${m.textColours} colours, ${m.words} words, ${m.controlsInFirstView} controls in view`);
      } catch (e) {
        index[s.id] = { source: "app", surface: s.surface, flavor: s.flavor, lens: s.lens, ok: false, error: e.message.split("\n")[0] };
        console.log(`FAIL ${s.id}: ${e.message.split("\n")[0]}`);
      }
    }
    if (has("atlas")) {
      const b = await open({ width: W, height: H, motion: "reduce" });
      sessions.set("atlas", b);
      for (const id of ATLAS_CASES.filter((x) => want("atlas-" + x))) {
        const sid = "atlas-" + id;
        try {
          const r = await fetch(ATLAS + "/__atlas/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: id, theme: "night", clock: "captured" }) });
          const info = await r.json();
          if (!r.ok) throw new Error(info.error || "activate failed");
          await b.page.goto(info.url, { waitUntil: "domcontentloaded" });
          // A read failure retries before it says so; give the error case long enough to reach its own state.
          await b.page.waitForTimeout(id.endsWith(".loading") ? 2500 : id.endsWith(".error") ? 15000 : 3500);
          const s = { id: sid, surface: id.split(".")[0], flavor: "competition", lens: "Atlas: " + id, full: !/loading|error/.test(id) };
          const m = await capture(b.page, s);
          index[sid] = { source: "atlas", surface: s.surface, flavor: s.flavor, lens: s.lens, case: id, ok: true, typeSizes: m.typeSizes.length, textColours: m.textColours, words: m.words, controls: m.controlsInFirstView, screensTall: m.screensTall, wide: m.wide };
          console.log(`PASS ${sid}: ${m.screensTall} screens, ${m.typeSizes.length} sizes, ${m.words} words`);
        } catch (e) {
          index[sid] = { source: "atlas", case: id, ok: false, error: e.message.split("\n")[0] };
          console.log(`FAIL ${sid}: ${e.message.split("\n")[0]}`);
        }
      }
    }
    if (has("bench")) {
      // A bench situation (tools/gameplay-bench/explorer/situations.cjs) opened on the explorer page, as check-situations-page.js
      // does, then its show's tabs and game page at the census width in a context carrying the frame's session.
      const ex = await open({ width: 1440, height: 1000, motion: "reduce" });
      sessions.set("bench", ex);
      const p = ex.page;
      await p.goto(ATLAS + "/__atlas/explorer");
      await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__?.ready, {}, { timeout: 20000 });
      const ready = { tonight: '[data-tab="tonight"]', episodes: '[data-tab="episodes"]', games: '[data-tab="games"]', cast: "[data-cast]", chat: "[data-chat]" };
      try {
        for (const sit of opt("bench-situations", "nfl-due,nba-week-in-progress").split(",")) {
          try {
            await p.locator("#open").click(); await p.locator("#open-situation").click();
            await p.locator(`[data-situation="${sit}"]`).click();
            await p.frameLocator("#device-a iframe").locator("[data-game-page]").waitFor({ timeout: 45000 });
            await p.waitForTimeout(1500);
            const frame = p.frames().find((f) => /\/show\/[^/]+\/game\//.test(f.url()));
            if (!frame) throw new Error("no game page frame");
            const url = new URL(frame.url());
            const seasonId = url.pathname.split("/")[2];
            const ctx = await p.context().browser().newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
            await ctx.addCookies(await p.context().cookies(url.origin));
            const q = await ctx.newPage();
            try {
              for (const tab of ["game", "tonight", "episodes", "games", "cast"]) {
                const sid = `bench-${sit}-${tab}`;
                if (!want(sid)) continue;
                try {
                  await q.goto(tab === "game" ? url.href : `${url.origin}/show/${seasonId}/${tab}`, { waitUntil: "domcontentloaded" });
                  await q.locator(tab === "game" ? "[data-game-page]" : ready[tab]).first().waitFor({ timeout: 45000 });
                  await q.waitForTimeout(1500);
                  const s = { id: sid, surface: tab === "cast" ? "cast" : tab, flavor: "sports", lens: `bench ${sit}: ${tab}`, full: true };
                  const m = await capture(q, s);
                  index[sid] = { source: "bench", surface: s.surface, flavor: "sports", lens: s.lens, ok: true, typeSizes: m.typeSizes.length, textColours: m.textColours, words: m.words, controls: m.controlsInFirstView, screensTall: m.screensTall, wide: m.wide };
                  console.log(`PASS ${sid}: ${m.screensTall} screens, ${m.typeSizes.length} sizes, ${m.words} words`);
                } catch (e) {
                  index[sid] = { source: "bench", ok: false, error: e.message.split("\n")[0] };
                  console.log(`FAIL ${sid}: ${e.message.split("\n")[0]}`);
                }
              }
            } finally { await ctx.close(); }
          } catch (e) {
            console.log(`FAIL bench ${sit}: ${e.message.split("\n")[0]}`);
          }
        }
      } finally {
        // Close the bench's cases (their zt-gb rows go with them: BACKLOG 78).
        await p.evaluate(async () => { const x = window.__GAMEPLAY_EXPLORER_PAGE__; for (const k of ["a", "b"]) if (x?.sides?.[k]?.id) await fetch("/__atlas/bench/runtime/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: x.sides[k].id }) }).catch(() => {}); }).catch(() => {});
      }
    }
  } finally {
    for (const b of sessions.values()) await b.close().catch(() => {});
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
    if (has("down")) await teardown();
  }
  const bad = Object.entries(index).filter(([k, v]) => want(k.replace(/^atlas-/, "")) && !v.ok);
  console.log(bad.length ? `${bad.length} failed` : "ALL CAPTURED");
})().catch((e) => { console.error(e); process.exit(1); });
