// The game page's situations (tools/gameplay-bench/explorer/situations.cjs; docs/GAME-PAGE-SITUATIONS.md) rendered for a design
// round's screenshot story: each situation opened on the explorer page on the real routes (zt-gb rows the bench removes when it
// closes the case), then its game page opened at a phone's size in a context carrying the frame's session, as census-app.js does
// for the show's tabs. For each situation it keeps, under --out:
//   <id>.jpg          the first phone view
//   <id>.full.jpg     the whole page
//   <id>.txt          the page's words
//   <id>.games.json   the season's games route as the viewer reads it (the GameView the page draws), for design work
//   <id>.episodes.json  the season's episodes route as the viewer reads it (what's waiting to reveal)
//   <id>.<flow>.jpg   each flow step asked for (--flows): a tap on the page and the sheet it opens
//   <id>.<shot>.jpg   each shot of a multi-step flow (--sequences: SEQUENCES below), which writes through the real routes as
//                     the viewer (the bench's zt-gb rows, removed when it closes the case)
// and index.json, every situation with what happened and its first view's measures, and overlaps.json: every frame's words that
// sit on other words (a chart's label over its axis, say), printed as OVERLAP lines as they're found.
//
// Needs: the app on :3000 (npm run dev) and the Atlas on :4400 (bash scripts/dev-test/restart-atlas.sh). Waits for Archivo before
// each frame and fails without it (a mid-recompile dev server once shot a whole batch in the fallback face).
// Run:   node scripts/dev-test/story-situations.js --out=.ui-atlas/stories/<design>/before [--only=<regex on the id>]
//          [--width=390 --height=844] [--flows] [--sequences] [--dress=real] [--tab=tonight]
// --tab=<tonight|episodes|games|cast|chat>: shoot that show tab of the situation's show, as the same viewer, instead of the game
// page (the design round's step 3, Tonight); --flows then runs TAB_FLOWS (the strip, the ruler, a game's ledger, the reveal).
// --dress=real: each situation on a real game's people where a recording exists (tools/gameplay-bench/explorer/dress.cjs: a real
// season's castaways and photos, real NFL athletes and headshots, the show's art; record them first with real-dress.js and
// espn-snapshot.js). Its frames show real people: keep them in the ignored .ui-atlas, never in the repo.
// Nothing here touches a real account: the bench's zt-gb people only, closed after.
const fs = require("fs");
const path = require("path");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const has = (k) => args.includes(`--${k}`);
const root = path.resolve(__dirname, "../..");
const ATLAS = opt("atlas-base", "http://127.0.0.1:4400");
const OUT = path.resolve(opt("out", ".ui-atlas/stories/situations"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const only = opt("only", null);
const dress = opt("dress", null);
const TAB = opt("tab", null);
const Situations = require(path.join(root, "tools/gameplay-bench/explorer/situations.cjs"));
// The design round's situations, then the real games whose recordings are on this machine (situations.cjs real()).
const list = () => [...Situations.list(), ...Situations.real()];

// Flow steps (--flows): a selector on the game page to tap, then what to wait for. Missing selectors are skipped, not failed, so
// one list serves the page before and after a redesign.
const FLOWS = [
  { id: "matchup", tap: "[data-week-card] [data-open-matchup]", wait: '[role="dialog"]' },
  { id: "last", tap: "[data-week-card] [data-open-last]", wait: '[role="dialog"]' },
  { id: "bets", tap: "[data-side-bets-row]", wait: '[role="dialog"]' },
  { id: "square", tap: "[data-game-grid] [data-square]", wait: '[role="dialog"]', last: true },
  // The drill levels (step 2b): the league's other games, a person's season, a cast member's or athlete's weeks, an episode.
  { id: "games", tap: "[data-week-game]", wait: '[role="dialog"]' },
  { id: "person", tap: "[data-game-grid] [data-door-person]", wait: '[role="dialog"]', scroll: "[data-person-season]" },
  { id: "cast", tap: "[data-your-team] [data-door-cast]", wait: '[role="dialog"]', scroll: "[data-cast-chart], [data-athlete-chart]" },
  { id: "episode", tap: "[data-game-grid] [data-door-episode]", wait: '[role="dialog"]', last: true },
  // Step 2c: the game's scoring table, and a played week's pair opening the two-player compare.
  { id: "table", tap: "[data-door-table] button", wait: "[data-game-table]" },
  { id: "compare", tap: "[data-week-card] [data-open-last]", wait: "[data-matchup-pairs]", then: "[data-matchup-pairs] [data-pair]:not([disabled])", thenWait: "[data-compare]" },
];

// A show tab's flow steps (--tab with --flows): Tonight's strip, its ruler (where everyone is), a game's ledger opened in place,
// and the reveal's ask. Missing selectors are skipped, as above.
const TAB_FLOWS = [
  { id: "strip", tap: "[data-strip] button", wait: '[role="dialog"]' },
  { id: "ruler", tap: "[data-ruler]", wait: '[role="dialog"]' },
  { id: "ledger", tap: "[data-mini-ledger]", wait: "[data-ledger]", inPlace: true },
  { id: "reveal", tap: "[data-progress-reveal], [data-progress-watched]", wait: '[role="dialog"]' },
];
const READY = TAB ? "[data-progress], [data-strip], [data-last-time], main section" : "[data-game-page]";

// Multi-step flows, per situation (--sequences): a tap, a fill, a wait, a scroll into view, or a shot. Run after the single-tap
// flows, in order (each from a fresh page), so a later one sees what an earlier one wrote.
const SEQUENCES = {
  // BACKLOG 88: a sport's waivers name athletes as the game page does (surname, a defense by its nickname) with their position.
  "nfl-waivers-open": [
    { id: "waivers", steps: [{ go: "waivers" }, { wait: "[data-wv-row]" }, { shot: "waivers-0" }, { tap: "[data-wv-row] [data-swap]" }, { wait: "[data-fa]" }, { pause: 800 }, { shot: "waivers-pick" }] },
  ],
  // BACKLOG 87: the AI's call on each of last episode's bets, who changed one, and the one it wasn't sure of.
  "show-bets-settled": [
    { id: "ai", steps: [{ tap: "[data-side-bets-row]" }, { wait: "[data-settled-by]" }, { scroll: '[data-settled-by="ai"]' }, { shot: "ai-settled" }, { scroll: '[data-settled-by="changed"]' }, { shot: "ai-changed" }, { tap: '[data-bet="bet-idol"] [aria-label^="Right"]' }, { wait: '[data-bet="bet-idol"] [data-settled-by="changed"]' }, { scroll: '[data-bet="bet-idol"] [data-settled-by]' }, { shot: "ai-challenged" }] },
  ],
  "show-bets-waiting": [
    { id: "player", steps: [{ tap: "[data-side-bets-row]" }, { wait: "[data-settled-by]" }, { shot: "player-0" }, { scroll: '[data-settled-by="changed"]' }, { shot: "player-1" }] },
  ],
  "show-side-bets": [
    { id: "settle", steps: [{ tap: "[data-side-bets-row]" }, { wait: "[data-settle]" }, { scroll: "[data-settle]" }, { shot: "settle-0" }, { tap: '[data-settle-answer="Yes"]' }, { shot: "settle-1" }, { tap: "[data-settle-save]" }, { wait: '[data-bet-state="settled"]' }, { scroll: '[data-bet-state="settled"]' }, { shot: "settle-2" }] },
    { id: "call", steps: [{ tap: "[data-side-bets-row]" }, { wait: '[data-bet-state="open"]' }, { tap: '[data-bet-state="open"] [data-call]' }, { scroll: "[data-call-save]" }, { shot: "call-1" }, { tap: "[data-call-save]" }, { wait: '[data-bet-state="open"] >> text=/called/' }, { pause: 800 }, { shot: "call-2" }] },
    { id: "post", steps: [{ tap: "[data-side-bets-row]" }, { wait: "[data-post-bet]" }, { scroll: "[data-post-bet]" }, { fill: ["[data-post-label]", "Will anyone cry at Tribal?"] }, { tap: '[data-post-worth="3"]' }, { shot: "post-1" }, { tap: "[data-post-save]" }, { wait: "text=Will anyone cry at Tribal?" }, { pause: 900 }, { scroll: '[data-bet-state="open"]' }, { shot: "post-2" }] },
    { id: "row", steps: [{ pause: 600 }, { scroll: "[data-side-bets-row]" }, { shot: "row-after" }] },
  ],
};

async function faceReady(p) {
  const ok = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"); }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frame would show the fallback face");
}

async function shoot(p, base, full) {
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await faceReady(p);
  await p.screenshot({ path: base + ".jpg", type: "jpeg", quality: 84 });
  if (full) await p.screenshot({ path: base + ".full.jpg", type: "jpeg", quality: 80, fullPage: true });
  const hits = await overlaps(p);
  if (hits.length) {
    OVERLAPS.push({ frame: path.basename(base), hits });
    for (const h of hits) console.log(`OVERLAP ${path.basename(base)}: "${h[0]}" over "${h[1]}"`);
  }
}

/** Every frame's words that sit on other words (overlaps.js), kept in index.json and overlaps.json, never failing the run. */
const OVERLAPS = [];
const overlaps = (p) => overlapsIn(p, H);

/** The first view's measurable part: type sizes, yellow fills and the words in view. */
async function measure(p) {
  return p.evaluate((h) => {
    const sizes = new Set(), fills = [];
    let words = 0;
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.top >= h || r.bottom <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
      if (own) { sizes.add(cs.fontSize); words += own.split(/\s+/).length; }
      if (/rgb\(255, 197, 49\)/.test(cs.backgroundColor) && r.width * r.height > 200) fills.push(Math.round(r.top));
    }
    return { typeSizes: [...sizes].sort(), yellowFills: fills.length, words };
  }, H);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const index = fs.existsSync(path.join(OUT, "index.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8")) : {};
  const b = await open({ width: 1440, height: 1000, motion: "reduce" });
  const p = b.page;
  try {
    await p.goto(ATLAS + "/__atlas/explorer" + (dress ? "?dress=" + encodeURIComponent(dress) : ""));
    await p.waitForFunction(() => window.__GAMEPLAY_EXPLORER_PAGE__?.ready, {}, { timeout: 20000 });
    for (const x of list().filter((y) => !only || new RegExp(only).test(y.id))) {
      const t0 = Date.now();
      try {
        await p.locator("#open").click();
        await p.locator("#open-situation").click();
        await p.locator(`[data-situation="${x.id}"]`).click();
        await p.frameLocator("#device-a iframe").locator("[data-game-page]").waitFor({ timeout: 45000 });
        await p.waitForTimeout(1200);
        const frame = p.frames().find((f) => /\/show\/[^/]+\/game\//.test(f.url()));
        if (!frame) throw new Error("no game page frame");
        const url = new URL(frame.url());
        // A show tab instead of the game page: the same show, the same viewer.
        if (TAB) url.pathname = url.pathname.replace(/\/game\/[^/]+$/, `/${TAB}`);
        const ctx = await p.context().browser().newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
        await ctx.addCookies(await p.context().cookies(url.origin));
        const q = await ctx.newPage();
        try {
          await q.goto(url.href, { waitUntil: "domcontentloaded" });
          await q.locator(READY).first().waitFor({ timeout: 45000 });
          // A show tab's body loads after its bar: wait until nothing in it is still a skeleton.
          if (TAB) await q.waitForFunction(() => !document.querySelector("main [aria-busy]"), {}, { timeout: 30000 }).catch(() => {});
          await q.waitForTimeout(1500);
          const base = path.join(OUT, x.id);
          await shoot(q, base, true);
          const m = await measure(q);
          fs.writeFileSync(base + ".txt", await q.evaluate(() => document.body.innerText));
          // The games route the page read (its URL from the page's own requests), read again as the viewer.
          const games = await q.evaluate(async () => {
            const u = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/api\/seasons\/[^/]+\/games/.test(n));
            return u ? (await fetch(u)).json() : null;
          });
          if (games) fs.writeFileSync(base + ".games.json", JSON.stringify(games, null, 1));
          const episodes = await q.evaluate(async () => {
            const u = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/api\/seasons\/[^/]+\/episodes\?/.test(n));
            return u ? (await fetch(u)).json() : null;
          });
          if (episodes) fs.writeFileSync(base + ".episodes.json", JSON.stringify(episodes, null, 1));
          const flows = [];
          if (has("flows")) {
            const reload = async () => {
              await q.keyboard.press("Escape").catch(() => {});
              await q.waitForTimeout(500);
              await q.goto(url.href, { waitUntil: "domcontentloaded" });
              await q.locator(READY).first().waitFor({ timeout: 45000 });
              await q.waitForTimeout(900);
            };
            // Something to tap: there, shown and enabled (a game without a matchup, a pair or a grid square skips that flow).
            const tappable = async (el) => (await el.count()) > 0 && (await el.isVisible().catch(() => false)) && !(await el.isDisabled().catch(() => true));
            for (const f of TAB ? TAB_FLOWS : FLOWS) {
              const el = q.locator(f.tap)[f.last ? "last" : "first"]();
              if (!(await tappable(el))) continue;
              await el.scrollIntoViewIfNeeded().catch(() => {});
              await el.click();
              if (!(await q.locator(f.wait).last().waitFor({ timeout: 10000 }).then(() => true, () => false))) {
                console.log(`  ${x.id}: ${f.id} opened nothing, skipped`);
                await reload();
                continue;
              }
              await q.waitForTimeout(700);
              if (f.then) {
                const next = q.locator(f.then).first();
                if (!(await tappable(next))) {
                  await reload();
                  continue;
                }
                await next.click();
                await q.locator(f.thenWait).last().waitFor({ timeout: 10000 });
                await q.waitForTimeout(700);
              }
              if (f.scroll) {
                // Wait for what the sheet loads on its own (stats, a game log), then bring it into view.
                await q.locator(f.scroll).first().waitFor({ timeout: 8000 }).catch(() => {});
                await q.locator(f.scroll).first().evaluate((el) => el.scrollIntoView({ block: "start" })).catch(() => {});
                await q.waitForTimeout(500);
              }
              // A part that opens in place (a game's ledger): shoot it where it is, scrolled to its top.
              if (f.inPlace) await q.locator(f.wait).first().evaluate((el) => el.closest("[data-game-mini]")?.scrollIntoView({ block: "start" })).catch(() => {});
              await shoot(q, `${base}.${f.id}`, false);
              flows.push(f.id);
              await reload();
            }
          }
          if (has("sequences") && SEQUENCES[x.id]) {
            for (const seq of SEQUENCES[x.id]) {
              try {
                await q.goto(url.href, { waitUntil: "domcontentloaded" });
                await q.locator(READY).first().waitFor({ timeout: 45000 });
                await q.waitForTimeout(900);
                for (const st of seq.steps) {
                  // A page of the same show, as the viewer (waivers, draft): its path in place of the game's.
                  if (st.go) { const u = new URL(url.href); u.pathname = u.pathname.replace(/\/game\/[^/]+$/, `/${st.go}`); await q.goto(u.href, { waitUntil: "domcontentloaded" }); await q.waitForTimeout(900); }
                  else if (st.tap) { await q.locator(st.tap).last().click(); await q.waitForTimeout(500); }
                  else if (st.fill) await q.locator(st.fill[0]).last().fill(st.fill[1]);
                  else if (st.wait) await q.locator(st.wait).last().waitFor({ timeout: 15000 });
                  else if (st.scroll) await q.locator(st.scroll).last().scrollIntoViewIfNeeded();
                  else if (st.pause) await q.waitForTimeout(st.pause);
                  else if (st.shot) { await q.waitForTimeout(400); await shoot(q, `${base}.${st.shot}`, false); }
                }
                flows.push(seq.id);
              } catch (e) {
                console.log(`  sequence ${seq.id} stopped: ${e.message.split("\n")[0]}`);
              }
            }
          }
          const mine = OVERLAPS.filter((o) => o.frame === x.id || o.frame.startsWith(x.id + "."));
          index[x.id] = { label: x.label, shows: x.shows, ok: true, ...m, flows, overlaps: mine, at: new Date().toISOString() };
          console.log(`PASS ${x.id} (${Math.round((Date.now() - t0) / 1000)}s): ${m.typeSizes.length} sizes, ${m.yellowFills} yellow, ${m.words} words${flows.length ? `, flows ${flows.join(",")}` : ""}`);
        } finally {
          await ctx.close();
        }
      } catch (e) {
        index[x.id] = { label: x.label, ok: false, error: e.message.split("\n")[0] };
        console.log(`FAIL ${x.id}: ${e.message.split("\n")[0]}`);
      }
      fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 1));
    }
  } finally {
    await p.evaluate(async () => { const x = window.__GAMEPLAY_EXPLORER_PAGE__; for (const k of ["a", "b"]) if (x?.sides?.[k]?.id) await fetch("/__atlas/bench/runtime/close", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: x.sides[k].id }) }).catch(() => {}); }).catch(() => {});
    await b.close();
  }
  const bad = Object.values(index).filter((v) => !v.ok).length;
  fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(OVERLAPS, null, 1));
  console.log(OVERLAPS.length ? `${OVERLAPS.length} frame(s) with words over words (overlaps.json): look before calling it done` : "No words over words");
  console.log(bad ? `${bad} FAILED` : "ALL CAPTURED");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
