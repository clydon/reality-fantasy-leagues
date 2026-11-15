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
// and index.json, every situation with its surface, flavor, lens and what happened.
//
// Needs: the app on :3000 (npm run dev; BASE= for another); for --atlas, the Atlas on :4400 (bash scripts/dev-test/restart-atlas.sh).
// Run:   node scripts/dev-test/census-app.js [--up] [--atlas] [--bench] [--only=<regex on the id>] [--width=390 --height=844] [--out=<dir>] [--down]
//   --up     brings the three fixtures up first, layered in one process (their own CLIs each restart the base couch), dressed in
//            show art (fixture-art.js; the Drop Show stays bare, the no-art case) unless --no-art;
//   --down   takes them down after (new-fixture.js's down removes the hub's and the guide's rows too).
// The fixture rows are all zt-nd-/zt-gd- keyed; nothing here touches a real account or league. The reveal situation advances
// zt_nd_sam's mark, so it runs after sam's other situations and a rerun wants --up again. Never run it beside another check on
// the zt_nd fixture.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { open } = require("./browser");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const BASE = process.env.BASE || "http://localhost:3000";
const ATLAS = opt("atlas-base", "http://127.0.0.1:4400");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/phase0/census"));
const ONLY = opt("only");
const PASS = "zt-pass-12345";
const u = (who) => `zt_nd_${who}`;

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
    }
    const q = async (sql, p) => (await pool.query(sql, p)).rows;
    for (const r of await q(`SELECT ss.id, sh.slug, ss.season_number FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug LIKE 'zt-nd-%' OR sh.slug LIKE 'zt-gd-%'`)) {
      const key = r.slug === "zt-nd-survivor" ? `s${r.season_number}` : r.slug.replace(/^zt-(nd|gd)-/, "");
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
  try { await require("./new-fixture").down(pool); console.log("[census] fixtures down"); } finally { await pool.end(); }
}

// ---- helpers for a situation's own steps ----
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
    { id: "hub-guide", surface: "guide", who: "alex", go: "/home", ready: "[data-guide-card]", act: (p) => scrollTo(p, "[data-guide-card]"), flavor: "mixed", lens: "the TV guide, inline on the hub", full: false },
    { id: "hub-person-sheet", surface: "hub", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, '[data-couch-face="zt_nd_riley"]'); await sheetOpen(p); }, flavor: "competition", lens: "a friend's face opens their sheet", full: false },
    { id: "hub-add-show", surface: "hub", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-add-show-poster]"); await sheetOpen(p); }, flavor: "mixed", lens: "following: Add a show", full: false },
    { id: "hub-tour", surface: "onboarding", who: "sam", tour: true, go: "/home?tour=1", ready: "[data-hub]", flavor: "competition", lens: "first-time tour, its welcome card", full: false },
    { id: "hub-bell", surface: "notifications", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, "[data-bell]"); await p.waitForTimeout(900); }, flavor: "mixed", lens: "notifications: the bell", full: false },
    { id: "hub-profile-menu", surface: "settings", who: "alex", go: "/home", ready: "[data-hub]", act: async (p) => { await tap(p, '[data-tour="you"]'); await p.waitForTimeout(900); }, flavor: "mixed", lens: "your picture's menu", full: false },
    { id: "start-1", surface: "onboarding", who: null, go: "/start/1", ready: "body", wait: 2500, flavor: "mixed", lens: "first run, step 1: your shows", full: false },
    { id: "pace-sheet-alex", surface: "tonight", who: "alex", go: () => `/show/${ids.s51}/tonight`, ready: '[data-tab="tonight"]', act: async (p) => { await tap(p, '[aria-label^="Where everyone is"]'); await p.waitForTimeout(1000); }, flavor: "competition", lens: "where everyone is: the couch's pace", full: false },
    { id: "progress-chooser-sam", surface: "episodes", who: "sam", go: () => `/show/${ids.s51}/episodes`, ready: '[data-tab="episodes"]', act: async (p) => { await tap(p, ':is(button,a):has-text("Spoiler-safe")'); await p.waitForTimeout(1000); }, flavor: "competition", lens: "the viewing-progress chooser (Spoiler-safe › Change)", full: false },

    // A competition show, three linked games (ZT Survivor 51): alex caught up with a move due, sam two behind
    { id: "tonight-alex", surface: "tonight", who: "alex", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "caught up mid-season, live, a move due", full: true },
    { id: "tonight-sam", surface: "tonight", who: "sam", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "two behind, results waiting", full: true },
    { id: "tonight-riley", surface: "tonight", who: "riley", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "caught up, a Game admin", full: false },
    { id: "moves-alex", surface: "moves", who: "alex", go: show(S51, "tonight"), ready: '[data-tab="tonight"]', act: async (p) => { await tap(p, ':is(button,a):has-text("Make my pick")'); await p.waitForTimeout(900); }, flavor: "competition", lens: "Your moves, opened from Tonight", full: false },
    { id: "episodes-alex", surface: "episodes", who: "alex", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "caught up", full: true },
    { id: "episodes-sam", surface: "episodes", who: "sam", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "two behind", full: true },
    { id: "episode-page-alex", surface: "episodes", who: "alex", go: show(S51, "episodes"), ready: '[data-tab="episodes"]', act: async (p) => { await tap(p, ':is(button,a):has-text("Carter out")'); await p.waitForTimeout(900); }, flavor: "competition", lens: "one episode's page", full: true },
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
    { id: "chat-alex", surface: "chat", who: "alex", go: show(S51, "chat"), ready: "[data-chat]", flavor: "competition", lens: "caught up", full: false },
    { id: "chat-sam", surface: "chat", who: "sam", go: show(S51, "chat"), ready: "[data-chat]", flavor: "competition", lens: "two behind: the fold", full: false },
    { id: "watch-alex", surface: "watch", who: "alex", go: show(S51, "tonight") + "?page=watch", ready: "[data-watch-along], [data-tab='tonight']", flavor: "competition", lens: "watch along", full: false },
    { id: "waivers-alex", surface: "waivers", who: "alex", go: `/show/${S51}/waivers`, ready: "body", wait: 2500, flavor: "competition", lens: "waivers", full: true },
    { id: "scoring-alex", surface: "scoring", who: "alex", go: `/show/${S51}/scoring`, ready: "body", wait: 2500, flavor: "competition", lens: "how it scores", full: true },
    { id: "backstage-alex", surface: "backstage", who: "alex", go: `/show/${S51}/backstage`, ready: "body", wait: 2500, flavor: "competition", lens: "a commissioner's Backstage", full: true },
    { id: "start-game-alex", surface: "wizard", who: "riley", go: show(TR, "games"), ready: '[data-tab="games"]', flavor: "competition", lens: "a watched show with no game: start one", full: true },

    // Watching only
    { id: "watchonly-riley-traitors", surface: "tonight", who: "riley", go: show(TR, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "watching only, no game; friends at different paces (riley 2, jordan 4)", full: true },
    { id: "watchonly-jordan-traitors", surface: "tonight", who: "jordan", go: show(TR, "tonight"), ready: '[data-tab="tonight"]', flavor: "competition", lens: "watching only, ahead of a friend, a private follow", full: false },
    { id: "watchonly-riley-episodes", surface: "episodes", who: "riley", go: show(TR, "episodes"), ready: '[data-tab="episodes"]', flavor: "competition", lens: "watching only: episodes", full: true },
    { id: "watchonly-riley-cast", surface: "cast", who: "riley", go: show(TR, "cast"), ready: "[data-cast]", flavor: "competition", lens: "watching only: the cast", full: false },
    { id: "watchonly-riley-chat", surface: "chat", who: "riley", go: show(TR, "chat"), ready: "[data-chat]", flavor: "competition", lens: "watching only: the chat", full: false },
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
  const base = path.join(OUT, s.id);
  await p.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  // The dev server's own badge (Next's dev tools) isn't the app's: hidden from the frames.
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (s.act) await s.act(p);
  await p.waitForTimeout(s.wait || 700);
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
          await b.page.goto(BASE + go, { waitUntil: "domcontentloaded" });
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
    if (has("down")) await teardown();
  }
  const bad = Object.entries(index).filter(([k, v]) => want(k.replace(/^atlas-/, "")) && !v.ok);
  console.log(bad.length ? `${bad.length} failed` : "ALL CAPTURED");
})().catch((e) => { console.error(e); process.exit(1); });
