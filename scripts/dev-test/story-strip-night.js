// Dev-only test bank: the screenshot story's frames for episode night while your moves stay open (docs/design-round/strip-night-
// spec.md; built 2026-11-19, look C the app: src/new/show/strip-night.ts), real renders at a phone's size on night-fixture.js (new-fixture.js's zt
// couch: ZT Survivor 51's Couch Cup, Lineup League and Pool Party, in the real Survivor art; jordan the viewer, through Ep 5, Ep 6
// on air or just aired). For each situation and look, under --out:
//   <situation>.<look>.jpg            Tonight's first phone view (look: c, the app since it was built; the switch's today, a, b are gone)
//   <situation>.<look>.<flow>.jpg     each flow's shot (sheet: the strip tapped, Your moves open; notyet: its question answered Not yet;
//                                     lockin: answered I'm watching, the strip locked in; watchlock: Watch along's lock; save: a move saved;
//                                     games: the Games tab's card)
//   <...>.full.jpg                    a flow's full-page shot (`full`: how long the page runs; its height in index.json)
//   <...>.txt                         the frame's words
// and index.json (every frame with what it was) and overlaps.json (words drawn over words: DESIGN-PROCESS.md's rule), printed as
// OVERLAP lines as they're found.
//
// Situations (night-fixture.js's options; each brings the fixture up, and a flow that writes brings it up again after):
//   onair-set        on air, jordan's lineup saved and pick made (all set): "who did I start?"
//   onair-reported   on air, the lineup carried in, no pick, a replacement owed: the user's night (Tonight's badge 3)
//   onair-kept       on air, the lineup carried in complete, the pick made: set by the server's rule since 2026-11-19, no yellow
//   onair-gap        on air, a starter short and no pick: something really missing
//   onair-strict     on air, every game At airtime: locked
//   onair-mixed      on air, Lineup League At airtime, the pool live
//   aired-gap        ended ten minutes ago, no results: today's "Lock when it airs"
//   results-set      results in, not revealed: Seen Ep 6? above, the honour note's way out in the sheet
//   week             an ordinary week, Ep 6 revealed and Ep 7 next week: the Games tab's face plates outside the night
//   busy             on air with seven games (night-fixture.js --extra=4): Lineup League a starter short and no pool pick, the
//                    four more set: Tonight's plate and the Games tab, all of it (games-all, a full-page shot), and the plate's fold
//   busy-set         the same seven, every move in: "who did I start?" across all of them
//   nfl              a large lineup (draft-fixture.js --sport --slots: ZT Football's Gridiron, NFL's nine slots and six on the bench,
//                    Week 1 due), as alex: the Games tab's glance with nothing set, then nine set through the route, collapsed and opened
//
//   npm run dev   (the app on :3000; BASE= for another)
//   node scripts/dev-test/story-strip-night.js [--out=.ui-atlas/stories/strip-night/frames] [--looks=c]
//        [--only=<regex on the situation>] [--width=390 --height=844] [--keep]
// Takes the fixture down at the end unless --keep. zt_nd_ people only; refuses a non-local database (the fixture does). Shares
// new-fixture's couch: never beside another check that uses it.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, BASE } = require("./browser");
const { overlapsIn } = require("./overlaps");
const night = require("./night-fixture");
const NF = require("./new-fixture");
const Draft = require("./draft-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/strip-night/frames"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
// Look C is the app (built 2026-11-19): the only look. (Frames named by it, as the design round's were.)
const LOOKS = opt("looks", "c").split(",");
const ONLY = opt("only", null);
const KEEP = args.includes("--keep");

const sheet = '[role="dialog"]:not([aria-hidden="true"])';
// The one-line strip's own button (a direct child: never the plate's Lock in), or the plate's first row on Tonight.
const strip = "[data-strip] > button, [data-plate-row]";
// Flows: `tap` (the first match), `wait`, `pause`, `shot`. `writes`: the fixture comes up again after. `looks`: which looks run it.
const SHEET = { id: "sheet", looks: ["c"], steps: [{ tap: strip }, { wait: sheet }, { pause: 700 }, { shot: "sheet" }] };
// The question in the window (the user, 2026-11-18: nobody watching live may read it as theirs): Not yet opens the moves.
const NOT_YET = { id: "notyet", looks: ["c"], steps: [{ tap: strip }, { wait: "[data-started-gate]" }, { tap: "[data-gate-not-yet]" }, { pause: 600 }, { shot: "notyet" }] };
// Yes locks them in (the server's lock: /api/seasons/<id>/lock-in), then the strip; the fixture comes up again after.
const LOCK_IN = { id: "gatelock", looks: ["c"], writes: true, steps: [{ tap: strip }, { wait: "[data-started-gate]" }, { tap: "[data-gate-watching]" }, { pause: 1800 }, { shot: "gatelock" }] };
// C, the user's pick (2026-11-18): Lock in in the plate's first row ("I made my picks, I'm about to watch"). All set: it locks at
// once (the server's lock) and the plate gives way to the one-line strip, the fixture up again after; something unset: it asks
// first. A row opens its game, through the sheet's question. Locked in, the sheet says so and reads.
const C_LOCK = { id: "lockin", looks: ["c"], writes: true, steps: [{ tap: "[data-lock-in]" }, { pause: 1800 }, { shot: "lockin" }, { tap: strip }, { wait: sheet }, { pause: 700 }, { shot: "lockedsheet" }] };
const C_ASK = { id: "ask", looks: ["c"], steps: [{ tap: "[data-lock-in]" }, { wait: "[data-lock-in-ask]" }, { pause: 700 }, { shot: "ask" }] };
const C_ROW = { id: "row", looks: ["c"], steps: [{ tap: "[data-plate-row]" }, { wait: "[data-started-gate]" }, { pause: 700 }, { shot: "row" }, { tap: "[data-gate-not-yet]" }, { pause: 600 }, { shot: "rownotyet" }] };
const C_GAMES = { id: "games", looks: ["c"], steps: [{ go: "games" }, { pause: 1500 }, { shot: "games" }] };
// The Games tab's face plates (the user, 2026-11-18: an at-a-glance view of who you've got): each card's, scrolled to.
const PLATES = {
  id: "plates",
  looks: ["c"],
  steps: [{ go: "games" }, { pause: 1500 }, { scroll: '[data-move-plates][data-your-move="lineup"]' }, { shot: "plates-lineup" }, { scroll: '[data-move-plates][data-your-move="pick"]' }, { shot: "plates-pick" }],
};
// An Outlast's glance: a claim (who leaves, who comes in) on the night, your team under its swaps in a week.
const TEAM = { id: "team", looks: ["c"], steps: [{ go: "games" }, { pause: 1500 }, { scroll: '[data-move-plates][data-glance="claim"], [data-move-plates][data-glance="team"]' }, { shot: "plates-team" }] };
// A couch with seven games (the user, 2026-11-18: "keep the vertical real estate in check... who's to know how many games could be
// going on"): the Games tab's first view and all of it, and the plate's fold opened.
const BUSY_GAMES = { id: "busy", looks: ["c"], steps: [{ go: "games" }, { pause: 1500 }, { shot: "games" }, { full: "games-all" }] };
const C_FOLD = { id: "fold", looks: ["c"], steps: [{ tap: "[data-night-fold]" }, { pause: 600 }, { shot: "fold" }] };
// A glance's tiles opened in place: the face plates, the bench, Show less.
const GLANCE_OPEN = { id: "open", looks: ["c"], steps: [{ go: "games" }, { pause: 1500 }, { scroll: '[data-glance="lineup"]' }, { tap: '[data-glance="lineup"] [data-glance-tiles]' }, { pause: 500 }, { shot: "glance-open" }] };
// Watch along says first that starting locks your moves.
const WATCH_LOCK = { id: "watchlock", looks: ["c"], steps: [{ tap: "[data-progress-watch]" }, { wait: "[data-watch-lock]" }, { pause: 700 }, { shot: "watchlock" }] };
const SITUATIONS = [
  { id: "onair-set", fixture: { phase: "onair", moves: "set", pace: "live" }, flows: [SHEET, NOT_YET, WATCH_LOCK, LOCK_IN, C_LOCK, C_GAMES, PLATES, TEAM] },
  { id: "onair-reported", fixture: { phase: "onair", moves: "carried", pace: "live", owed: true }, flows: [SHEET, C_GAMES, C_ASK] },
  { id: "onair-kept", fixture: { phase: "onair", moves: "kept", pace: "live" }, flows: [C_GAMES, PLATES] },
  {
    id: "onair-gap",
    fixture: { phase: "onair", moves: "gap", pace: "live" },
    flows: [
      SHEET,
      C_ASK,
      C_ROW,
      C_GAMES,
      PLATES,
      // Fill the open slot and make the pick, save: the toast, then the strip all set.
      {
        id: "save",
        looks: ["c"],
        writes: true,
        steps: [{ tap: strip }, { wait: sheet }, { tap: "[data-gate-not-yet]" }, { tap: `${sheet} [data-starter][aria-pressed="false"]` }, { tap: `${sheet} button:has-text("Save")` }, { pause: 900 }, { shot: "toast" }, { pause: 2600 }, { shot: "after" }],
      },
    ],
  },
  { id: "busy", fixture: { phase: "onair", moves: "gap", pace: "live", extra: 4, extraMoves: "set" }, flows: [BUSY_GAMES, C_FOLD, { id: "episodes", looks: ["c"], steps: [{ go: "episodes" }, { pause: 1500 }, { shot: "episodes" }] }] },
  { id: "busy-set", fixture: { phase: "onair", moves: "set", pace: "live", extra: 4, extraMoves: "set" }, flows: [BUSY_GAMES, C_FOLD, GLANCE_OPEN] },
  { id: "onair-strict", fixture: { phase: "onair", moves: "set", pace: "strict" }, flows: [SHEET] },
  { id: "onair-mixed", fixture: { phase: "onair", moves: "set", pace: "mixed" }, flows: [SHEET] },
  { id: "aired-gap", fixture: { phase: "aired", moves: "gap", pace: "live" }, flows: [SHEET] },
  { id: "results-set", fixture: { phase: "results", moves: "set", pace: "live" }, flows: [SHEET] },
  // An ordinary week (Ep 6 revealed, Ep 7 next week): the Games tab's face plates outside the night (the lineup carried in, the
  // pick for Ep 7 still to make).
  { id: "week", fixture: { phase: "watched", moves: "set", pace: "live" }, flows: [C_GAMES, PLATES, TEAM, { ...C_GAMES, id: "games-today", looks: ["today"] }] },
  {
    id: "nfl",
    draft: { sport: true, slots: true },
    flows: [
      {
        id: "big",
        looks: ["c"],
        steps: [
          { go: "games" },
          { pause: 1500 },
          { scroll: '[data-move-plates][data-your-move="lineup"]' },
          { shot: "big-empty" },
          { setLineup: true },
          { go: "games" },
          { pause: 1500 },
          { scroll: '[data-move-plates][data-your-move="lineup"]' },
          { shot: "big-set" },
          { tap: "[data-glance-more]" },
          { pause: 500 },
          { scroll: '[data-move-plates][data-your-move="lineup"]' },
          { shot: "big-all" },
        ],
      },
    ],
  },
];

const index = [];
const overlaps = [];

async function fontsReady(p) {
  const ok = await p.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded");
  }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frame would show the fallback face");
}

async function shoot(p, id, note) {
  fs.mkdirSync(OUT, { recursive: true });
  // The dev server's own badge (bottom left, over the tab bar) isn't the app.
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 86 });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await p.evaluate(() => document.body.innerText).catch(() => ""));
  const hits = await overlapsIn(p, H).catch(() => []);
  for (const h of hits) {
    console.log(`OVERLAP ${id}: ${JSON.stringify(h)}`);
    overlaps.push({ id, words: h });
  }
  index.push({ id, ...note });
  console.log(`shot ${id}`);
}

/** The whole page, top to bottom (the window scrolls the page): how long it runs, beside the phone's first view. */
async function shootFull(p, id, note) {
  fs.mkdirSync(OUT, { recursive: true });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  // The tab bar is fixed to the window: in a shot of the whole page it would sit across the middle.
  await p.evaluate(() => {
    const st = document.createElement("style");
    st.id = "zt-full";
    st.textContent = ".nd-tabbar{display:none!important}";
    document.head.appendChild(st);
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(350);
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 80, fullPage: true });
  await p.evaluate(() => document.getElementById("zt-full")?.remove());
  index.push({ id: `${id}.full`, height, ...note });
  console.log(`full ${id}: ${height}px`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  let session = null;
  try {
    for (const sit of SITUATIONS) {
      if (ONLY && !new RegExp(ONLY).test(sit.id)) continue;
      let ids = sit.draft ? await Draft.up(pool, sit.draft).then((x) => ({ ...x, seasonId: x.sport.seasonId, gameId: x.sport.leagueId })) : await night.up(pool, { ...sit.fixture, art: true });
      const viewer = sit.draft ? { user: Draft.username("alex"), pass: Draft.PASSWORD } : { user: NF.username("jordan"), pass: NF.PASSWORD };
      if (session) await session.close();
      session = await open({ ...viewer, width: W, height: H, motion: "on" });
      const looks = [...LOOKS.map((l) => ({ look: l, carried: false })), ...(sit.carriedSet ? LOOKS.filter((l) => l !== "today").map((l) => ({ look: l, carried: true })) : [])];
      for (const { look, carried } of looks) {
        const name = `${sit.id}.${look}${carried ? "-set" : ""}`;
        const page = async (tab = "tonight") => {
          const p = await session.page.context().newPage();
          await p.goto(`${BASE}/show/${ids.seasonId}/${tab}`, { waitUntil: "domcontentloaded" });
          await p.locator("[data-progress]").first().waitFor({ timeout: 60000 });
          // The sheet's once-a-device peek (swipe-pager.tsx) is a moment, not the sheet: frames show it settled (the check).
          await p.evaluate(() => { try { localStorage.setItem("gys.moves-games.peeked", "1"); } catch {} });
          await p.locator("[data-strip]").first().waitFor({ timeout: 15000 }).catch(() => {});
          // The page under the strip (Last time, Your games): a frame of skeletons isn't the page.
          if (tab === "tonight") await p.locator("[data-last-time], [data-your-games]").first().waitFor({ timeout: 20000 }).catch(() => {});
          await fontsReady(p);
          await p.waitForTimeout(1400);
          return p;
        };
        const p = await page();
        await shoot(p, name, { situation: sit.id, look, carried, fixture: sit.fixture, due: ids.due });
        await p.close();
        for (const flow of sit.flows) {
          if (!flow.looks.includes(look) || carried) continue;
          const q = await page();
          try {
            for (const step of flow.steps) {
              if (step.go) {
                await q.goto(`${BASE}/show/${ids.seasonId}/${step.go}`, { waitUntil: "domcontentloaded" });
                await q.locator("[data-progress]").first().waitFor({ timeout: 60000 });
                // The cards, not their skeletons.
                if (step.go === "games") await q.locator("[data-whats-on], [data-table]").first().waitFor({ timeout: 30000 }).catch(() => {});
                await fontsReady(q);
              }
              if (step.scroll) {
                // Its card's head in view (the game's name), the plates under it.
                await q.locator(step.scroll).first().evaluate((el) => (el.closest("section") ?? el).scrollIntoView({ block: "start" })).catch(() => {});
                await q.waitForTimeout(400);
              }
              if (step.tap) await q.locator(step.tap).first().click({ timeout: 10000 });
              if (step.wait) await q.locator(step.wait).first().waitFor({ timeout: 10000 });
              if (step.pause) await q.waitForTimeout(step.pause);
              if (step.js) await q.evaluate(step.js);
              if (step.setLineup) {
                const r = await q.evaluate(async ({ sid, couch, game }) => {
                  const games = (await (await fetch(`/api/seasons/${sid}/games?couch=${couch}`)).json()).games ?? [];
                  const g = games.find((x) => x.leagueId === game);
                  const L = g?.lineup;
                  if (!L) return "no lineup";
                  const ls = L.lineupSlots;
                  const used = new Set();
                  const ids = [];
                  if (ls) {
                    ls.labels.forEach((_, i) => {
                      const id = L.roster.find((x) => !used.has(x) && (ls.fits[x] ?? []).includes(i));
                      if (id) { used.add(id); ids.push(id); }
                    });
                  } else ids.push(...L.roster.slice(0, L.need));
                  const res = await fetch(`/api/leagues/${game}/episodes/${encodeURIComponent(L.epId)}/lineups/${encodeURIComponent(g.playerId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ castawayIds: ids }) });
                  return `${res.status} ${ids.length} set`;
                }, { sid: ids.seasonId, couch: ids.couchId, game: ids.gameId });
                console.log(`setLineup: ${r}`);
              }
              if (step.shot) await shoot(q, `${name}.${step.shot}`, { situation: sit.id, look, flow: flow.id });
              if (step.full) await shootFull(q, `${name}.${step.full}`, { situation: sit.id, look, flow: flow.id });
            }
          } catch (e) {
            console.log(`FLOW ${name}.${flow.id} stopped: ${e.message.split("\n")[0]}`);
            index.push({ id: `${name}.${flow.id}`, failed: e.message.split("\n")[0] });
          }
          await q.close();
          if (flow.writes) ids = await night.up(pool, { ...sit.fixture, art: true }).then(async (x) => {
            await session.close();
            session = await open({ user: NF.username("jordan"), pass: NF.PASSWORD, width: W, height: H, motion: "on" });
            return x;
          });
        }
      }
    }
  } finally {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
    if (session) await session.close();
    if (!KEEP) {
      await night.down(pool);
      await Draft.down(pool);
    }
    await pool.end();
  }
  console.log(`${index.length} frames, ${overlaps.length} overlaps → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
