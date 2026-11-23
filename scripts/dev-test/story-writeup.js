// Dev-only test bank: the screenshot story's frames for Last time's write-up on Tonight (docs/design-round/tonight-writeup-spec.md,
// -first-view.md, -shape.md; src/new/show/tonight.tsx WriteUp; src/lib/game/recap-text.ts). Real renders at a phone's size.
//
// Situations (each its own viewer, so they can't disturb each other):
//   survivor-watcher  zt_nd_casey follows the local copy of the REAL Survivor 51 through Ep 3, playing nothing there: Rob quit and
//                     Patt was voted out (two Out plates), and Ep 3's real write-up, which ends in a "[Source: …](…)" link. Also its
//                     Episodes page at Ep 3 (the write-up there, its source line gone). Real castaways: frames stay in .ui-atlas.
//   survivor-player   zt_nd_jordan on night-fixture's ZT Survivor 51 couch (three games), Ep 6 watched (Cristian out), with a
//                     made-up write-up that matches the fixture's boot, at the longest a write-up runs (about 600 characters).
//   story-show        zt_nd_alex on crew-fixture's ZT Yacht (a series standing in for Below Deck), through Ep 2, playing nothing:
//                     nobody left, so the write-up leads; Ep 2's made-up write-up runs long.
//   story-short       the same, through Ep 1, whose write-up fits in three lines: shown whole, with no "more".
//   guard             survivor-player with another episode's write-up on Ep 6 (names Ori, not Cristian): Tonight leaves it out.
//   guard-headline    survivor-player with a headline whose count isn't the write-up's: the headline is left off, the write-up shows.
// `--theme=studio` draws each page in Studio (light), in the page only (appearance.tsx paint's classes; nothing saved).
// Frames per situation, under --out: <situation>.first.jpg (the page's top), .last.jpg (scrolled to Last time), .open.jpg (the
// write-up opened; not with --before), .episodes.jpg (survivor-watcher only), .full.jpg; each one's words in a .txt; index.json
// with where Last time, the write-up and Your night sit on the first view (R5 of the first-view requirements); overlaps.json.
//
// `--before` shoots today's page: run it with src/ stashed (`git stash push -- src/`, then `git stash pop`).
// Headlines (migration 0456): ZT Survivor's Ep 6 and ZT Yacht's Ep 2 get one (made up); ZT Yacht's Ep 1 has none, so story-short
// shows "In this episode" without one. The real Survivor 51's come from scripts/headlines-once.js on the local copy.
//
//   npm run dev   (BASE= for another server)
//   node scripts/dev-test/story-writeup.js up        bring the fixtures and write-ups up (night-fixture watched, crew-fixture)
//   node scripts/dev-test/story-writeup.js [--out=.ui-atlas/stories/tonight-writeup/after] [--before] [--only=<regex>] [--width=390]
//   node scripts/dev-test/story-writeup.js down      take it all down (casey's follow of the real season, then new-fixture's down)
// Touches only zt rows: zt_nd_ people, zt- shows, and one show_follows row for zt_nd_casey on the real season (removed by down,
// and with the zt user). Refuses a non-local database (the fixtures do).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const night = require("./night-fixture");
const NF = require("./new-fixture");
const Crew = require("./crew-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const BEFORE = args.includes("--before");
const OUT = path.resolve(opt("out", `.ui-atlas/stories/tonight-writeup/${BEFORE ? "before" : "after"}`));
// The made-up headlines, as the recap search writes them (episode-recaps.ts recapPrompt). ZT Survivor's is the limit's full 45
// characters (recap-text.ts HEADLINE_MAX), the longest a headline can be: one line at 390, two at 320.
const ZT_EP6_HEADLINE = "Cristian out 5–2, his Shot in the Dark missed";
// A headline that disagrees with its write-up (a count the write-up doesn't have): Tonight leaves it off, the write-up shows alone.
const WRONG_HEADLINE = "Cristian out 7–1, his Shot in the Dark missed";
// --theme=studio: the page drawn in Studio (light) as appearance.tsx paint() draws it, in the page only, nothing saved.
const THEME = opt("theme", null);
const YACHT_HEADLINES = { 2: "Aesha's rules split the interior" };
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const ONLY = opt("only", null);
const cmd = args.find((a) => !a.startsWith("--"));

const REAL_S51 = "e3a42b04-cff2-42be-9554-0d67cabe1718";

// Made-up write-ups in the recap search's shape (episode-recaps.ts recapPrompt: two or three plain sentences in story order, who
// left last). ZT Survivor's Ep 6 ends in a source line, to be dropped, and runs as long as write-ups do (about 470 characters).
const ZT_EP6 =
  "Back at camp after the double boot, Cristian Chavez tried to rebuild trust after his name came up at both Tribal Councils, while Danny Kilby quietly pulled Maggie Nestor and Thien An Nguyen into a three-person bloc. Savu won immunity and a pastry reward in a puzzle comeback. After a scramble at the well and a Shot in the Dark that came back not safe, Cristian was voted out 5–2. [Source: Paramount+ recap](https://www.paramountplus.com/shows/survivor/)";
// Another episode's write-up (the real Survivor 51's Ep 6, which names Ori, not Cristian): the guard situation puts it on ZT
// Survivor's Ep 6, and Tonight must leave it out.
const WRONG_EP6 =
  "Following the double elimination, the three tribes continued competing as alliances shifted and tensions increased. At Savu, Jelly Loblack and Devin Way decided to keep their partnership rather than save Ori Jean-Charles, who unsuccessfully played his Shot in the Dark. Ori was voted out, leaving Jelly and Devin as the tribe's only remaining members.";
const YACHT = {
  1: "Captain Kerry Hale welcomed a new crew aboard for a season in the Grenadines, and Aesha Monroe set strict rules for the interior.",
  2: "Aesha Monroe's management style creates tension with Daisy Kwon and Ruby Ortiz as the interior team adjusts to working together. Bosun Fraser Bligh plays matchmaker on the crew night out, sparking romantic interest among several deckhands, although not everyone welcomes the attention. The first charter guests leave a generous tip, and Captain Kerry singles out the galley for praise.",
};

async function up(pool) {
  const ids = await night.up(pool, { phase: "watched" });
  const q = (sql, p) => pool.query(sql, p);
  await q(
    `INSERT INTO season_episodes (season_id, number, summary, headline, summary_at, source) VALUES ($1, 6, $2, $3, now(), 'listing')
     ON CONFLICT (season_id, number) DO UPDATE SET summary = EXCLUDED.summary, headline = EXCLUDED.headline, summary_at = now()`,
    [ids.seasonId, ZT_EP6, ZT_EP6_HEADLINE]
  );
  // casey follows the real Survivor 51 (the local copy) through Ep 3, on no game there.
  await q(
    `INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, 3, true)
     ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = 3, following = true`,
    [ids.users.casey, REAL_S51]
  );
  const yacht = await Crew.up(pool);
  const yachtId = typeof yacht === "string" ? yacht : yacht?.seasonId ?? yacht?.season ?? (await q(`SELECT ss.id FROM show_seasons ss JOIN shows sh ON sh.id = ss.show_id WHERE sh.slug = $1`, [Crew.SLUG])).rows[0].id;
  for (const [n, s] of Object.entries(YACHT))
    await q(
      `INSERT INTO season_episodes (season_id, number, summary, headline, summary_at, source) VALUES ($1, $2, $3, $4, now(), 'listing')
       ON CONFLICT (season_id, number) DO UPDATE SET summary = EXCLUDED.summary, headline = EXCLUDED.headline, summary_at = now()`,
      [yachtId, Number(n), s, YACHT_HEADLINES[n] ?? null]
    );
  const state = { zt: ids.seasonId, real: REAL_S51, yacht: yachtId, users: ids.users };
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`[writeup] up: ZT Survivor 51 ${ids.seasonId}, ZT Yacht ${yachtId}; casey follows the real S51 through 3`);
  return state;
}

async function down(pool) {
  const casey = (await pool.query(`SELECT id FROM "user" WHERE username = $1`, [NF.username("casey")])).rows[0]?.id;
  if (casey) await pool.query(`DELETE FROM show_follows WHERE user_id = $1 AND season_id = $2`, [casey, REAL_S51]);
  await Crew.down(pool).catch(() => {});
  await night.down(pool);
  fs.rmSync(STATE, { force: true });
  console.log("[writeup] down");
}

const STATE = path.resolve(".ui-atlas/stories/tonight-writeup/state.json");

// ---------- frames ----------

const index = [];
const overlaps = [];

async function fontsReady(p) {
  const ok = await p.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded");
  }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frame would show the fallback face");
}

async function shoot(p, id, note = {}) {
  fs.mkdirSync(OUT, { recursive: true });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await fontsReady(p);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 88 });
  fs.writeFileSync(path.join(OUT, `${id}.txt`), await p.evaluate(() => document.body.innerText).catch(() => ""));
  for (const h of await overlapsIn(p, H).catch(() => [])) {
    console.log(`OVERLAP ${id}: ${JSON.stringify(h)}`);
    overlaps.push({ id, words: h });
  }
  index.push({ id, ...note });
  console.log(`shot ${id}`);
}

async function shootFull(p, id) {
  await p.evaluate(() => {
    const st = document.createElement("style");
    st.id = "zt-full";
    st.textContent = ".nd-tabbar{display:none!important} nextjs-portal{display:none!important}";
    document.head.appendChild(st);
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(400);
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.screenshot({ path: path.join(OUT, `${id}.full.jpg`), type: "jpeg", quality: 80, fullPage: true });
  await p.evaluate(() => document.getElementById("zt-full")?.remove());
  index.push({ id: `${id}.full`, height });
  console.log(`full ${id}: ${height}px`);
}

/** Where Last time, the write-up, the stat and Your night sit at the page's top (CSS px from the viewport's top). */
const measure = (p) =>
  p.evaluate(() => {
    window.scrollTo(0, 0);
    const top = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), height: Math.round(r.height) };
    };
    return { lastTime: top("[data-last-time]"), writeUp: top("[data-last-writeup]"), state: document.querySelector("[data-last-writeup]")?.getAttribute("data-last-writeup") ?? null, out: top("[data-last-out]"), yourNight: top("[data-your-night]"), viewport: window.innerHeight };
  });

async function scrollTo(p, sel) {
  await p.locator(sel).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
  await p.waitForTimeout(450);
}

async function tonight(state, { id, who, season }) {
  const { page: p, close } = await open({ user: NF.username(who), pass: NF.PASSWORD, width: W, height: H, motion: "off" });
  try {
    await p.goto(`${process.env.BASE || "http://localhost:3000"}/show/${season}/tonight`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-progress]").first().waitFor({ timeout: 90000 });
    await p.locator("[data-last-time]").first().waitFor({ timeout: 30000 });
    if (THEME === "studio")
      await p.evaluate(() => {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-nd-theme", "studio");
      });
    await p.waitForTimeout(2500);
    const m = await measure(p);
    console.log(`[writeup] ${id}: ${JSON.stringify(m)}`);
    await shoot(p, `${id}.first`, { measures: m });
    await shootFull(p, id);
    await scrollTo(p, "[data-last-time]");
    await shoot(p, `${id}.last`, { writeUp: await p.locator("[data-last-writeup]").count() });
    if (!BEFORE && (await p.locator('[data-last-writeup="cut"]').count())) {
      // Opened by its "more" (a tap on the text may land on a face plate, which opens that person instead).
      await p.locator('[data-last-writeup="cut"] button[aria-expanded="false"]').first().click();
      await p.waitForTimeout(400);
      // A second tap on the text must leave it open (only "less" closes it): where there are no face plates to land on.
      if (!(await p.locator("[data-writeup-cast]").count())) {
        await p.locator('[data-last-writeup="open"] p').first().click({ position: { x: 20, y: 10 } });
        await p.waitForTimeout(300);
      }
      await shoot(p, `${id}.open`, { opened: await p.locator('[data-last-writeup="open"]').count(), stillOpenAfterTextTap: true });
    }
  } finally {
    await close();
  }
}

async function episodes(state, { id, who, season, n }) {
  const { page: p, close } = await open({ user: NF.username(who), pass: NF.PASSWORD, width: W, height: H, motion: "off" });
  try {
    await p.goto(`${process.env.BASE || "http://localhost:3000"}/show/${season}/episodes?page=ep${n}`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-ep-happened]").first().waitFor({ timeout: 90000 });
    await p.waitForTimeout(1500);
    await scrollTo(p, "[data-ep-happened]");
    await shoot(p, `${id}.episodes`);
  } finally {
    await close();
  }
}

async function run() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const situations = [
    { id: "survivor-watcher", go: async () => (await tonight(state, { id: "survivor-watcher", who: "casey", season: state.real }), await episodes(state, { id: "survivor-watcher", who: "casey", season: state.real, n: 3 })) },
    { id: "survivor-player", go: () => tonight(state, { id: "survivor-player", who: "jordan", season: state.zt }) },
    {
      id: "guard-headline",
      go: async () => {
        await pool.query(`UPDATE season_episodes SET headline = $2 WHERE season_id = $1 AND number = 6`, [state.zt, WRONG_HEADLINE]);
        try {
          await tonight(state, { id: "guard-headline", who: "jordan", season: state.zt });
        } finally {
          await pool.query(`UPDATE season_episodes SET headline = $2 WHERE season_id = $1 AND number = 6`, [state.zt, ZT_EP6_HEADLINE]);
        }
      },
    },
    {
      id: "guard",
      go: async () => {
        await pool.query(`UPDATE season_episodes SET summary = $2, headline = NULL WHERE season_id = $1 AND number = 6`, [state.zt, WRONG_EP6]);
        try {
          await tonight(state, { id: "guard", who: "jordan", season: state.zt });
        } finally {
          await pool.query(`UPDATE season_episodes SET summary = $2, headline = $3 WHERE season_id = $1 AND number = 6`, [state.zt, ZT_EP6, ZT_EP6_HEADLINE]);
        }
      },
    },
    { id: "story-show", go: async () => (await pool.query(`UPDATE show_follows SET seen_through = 2 WHERE user_id = $1 AND season_id = $2`, [state.users.alex, state.yacht]), await tonight(state, { id: "story-show", who: "alex", season: state.yacht })) },
    {
      id: "story-short",
      go: async () => {
        await pool.query(`UPDATE show_follows SET seen_through = 1 WHERE user_id = $1 AND season_id = $2`, [state.users.alex, state.yacht]);
        try {
          await tonight(state, { id: "story-short", who: "alex", season: state.yacht });
        } finally {
          await pool.query(`UPDATE show_follows SET seen_through = 2 WHERE user_id = $1 AND season_id = $2`, [state.users.alex, state.yacht]);
        }
      },
    },
  ];
  try {
    for (const s of situations) if (!ONLY || new RegExp(ONLY).test(s.id)) await s.go();
  } finally {
    await pool.end();
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
  console.log(`[writeup] ${index.length} frames in ${OUT}; ${overlaps.length} overlaps`);
}

(async () => {
  if (cmd === "up" || cmd === "down") {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    try {
      await (cmd === "up" ? up(pool) : down(pool));
    } finally {
      await pool.end();
    }
  } else await run();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
