// Dev-only test bank: the screenshot story's frames for one episode at a time (docs/design-round/step-through-spec.md): Tonight's
// progress control while behind (src/new/show/step-through.tsx: the user's pick A, with Up to… and air dates, shipped 2026-11-17;
// the mock round's B and C and the switch are gone, so every frame is the app as it is, named "-a" as the round named it), real renders at a phone's size on step-fixture.js's couch (ZT Traitors in the real Traitors 5 cast and art, ZT Survivor's Weekly
// Lineup). For each situation and look it keeps, under --out:
//   <situation>-<look>.jpg              the first phone view
//   <situation>-<look>.<flow>.jpg       each flow step (the guard, the reveal's end, Tonight after, Not yet)
//   <...>.txt                           the frame's words
// and index.json (every frame with what happened) and overlaps.json (words drawn over words: DESIGN-PROCESS.md's rule), printed as
// OVERLAP lines as they're found.
//
// Situations (each brings the fixture up as it needs; a flow that writes brings it up again after):
//   watch-2     riley watches ZT Traitors, through 8 of 10 out, 11 in all (the user's case, 2026-11-17)
//   watch-1     the same, through 9: one behind
//   watch-long  a 30-episode season, through 12 of 20 out
//   play-2      sam plays ZT Survivor's Weekly Lineup, through 3, results in for 4 and 5
//   live        riley keeps up with ZT Traitors live (keep_up 'ask'): Live's card on Tonight, and the guard it opens
//
//   npm run dev   (the app on :3000; BASE= for another)
//   node scripts/dev-test/story-step-through.js [--out=.ui-atlas/stories/step-through/frames] [--looks=a]
//        [--only=<regex on the frame id>] [--width=390 --height=844] [--keep]
// Takes the fixture down at the end unless --keep. zt_st_ people only; refuses a non-local database (the fixture does).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const { overlapsIn } = require("./overlaps");
const fx = require("./step-fixture");

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = path.resolve(opt("out", ".ui-atlas/stories/step-through/frames"));
const W = Number(opt("width", 390)), H = Number(opt("height", 844));
const LOOKS = opt("looks", "a").split(",");
const ONLY = opt("only", null);
const want = (id) => !ONLY || new RegExp(ONLY).test(id);

const SITUATIONS = {
  "watch-2": { who: "riley", show: "traitors", fixture: { aired: 10, seen: 8, count: 11 } },
  "watch-1": { who: "riley", show: "traitors", fixture: { aired: 10, seen: 9, count: 11 } },
  "watch-long": { who: "riley", show: "traitors", fixture: { aired: 20, seen: 12, count: 30 } },
  "play-2": { who: "sam", show: "survivor", fixture: { aired: 10, seen: 8, count: 11 } },
  live: { who: "riley", show: "traitors", fixture: { aired: 10, seen: 8, count: 11, live: true }, ready: "[data-seen-it]" },
};

const sheet = '[role="dialog"]:not([aria-hidden="true"])';
// Flows, per look: steps from a fresh Tonight. `tap` a selector (the first match), `shot` a frame, `skip` the reveal to its end,
// `close` the reveal by its last button. `writes`: the fixture comes up again after.
const FLOWS = {
  a: [
    { id: "yes", steps: [{ tap: "[data-ask-yes]" }, { wait: "[data-step-guard]" }, { shot: "guard" }] },
    {
      id: "one",
      writes: true,
      steps: [{ tap: "[data-ask-yes]" }, { tap: "[data-step-guard-yes]" }, { wait: `${sheet} [data-stage]` }, { shot: "reveal" }, { skip: true }, { shot: "end" }, { close: true }, { shot: "after" }],
    },
    // Up to… (the user's addition, 2026-11-17): the picker, a later episode picked (the long season picks its 5th out), then
    // Recap them in turn or Skip to it.
    {
      id: "pick",
      steps: [{ tap: "[data-ask-yes]" }, { tap: "[data-step-guard-pick]" }, { wait: "[data-step-picker]" }, { shot: "picker" }, { tapNth: ["[data-step-picker] [data-ledger-row]", 4] }, { shot: "picked" }],
    },
    {
      id: "recap",
      writes: true,
      steps: [{ tap: "[data-ask-yes]" }, { tap: "[data-step-guard-pick]" }, { tapLast: "[data-step-picker] [data-ledger-row]" }, { tap: "[data-step-recap]" }, { wait: `${sheet} [data-stage]` }, { skip: true }, { shot: "end" }],
    },
    {
      id: "skip",
      writes: true,
      steps: [{ tap: "[data-ask-yes]" }, { tap: "[data-step-guard-pick]" }, { tapLast: "[data-step-picker] [data-ledger-row]" }, { tap: "[data-step-skip]" }, { wait: `${sheet} [data-stage]` }, { pause: 2500 }, { shot: "reveal" }],
    },
    { id: "later", writes: true, steps: [{ tap: "[data-ask-later]" }, { pause: 1500 }, { shot: "later" }, { tap: "[data-step-seen]" }, { wait: "[data-step-guard]" }, { shot: "guard" }] },
  ],
};

// Live keep-up's card (seen-it.tsx): Seen Ep 9 opens the same guard.
const LIVE = [{ id: "card", steps: [{ tap: "[data-seen-it-yes]" }, { wait: "[data-step-guard]" }, { shot: "guard" }] }];

const index = [];
const overlaps = [];

async function fontsReady(p) {
  const ok = await p.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded");
  }).catch(() => false);
  if (!ok) throw new Error("Archivo never loaded: the frame would show the fallback face");
}

async function shoot(p, id, note, now = false) {
  fs.mkdirSync(OUT, { recursive: true });
  // The dev server's own badge (bottom left, over the tab bar) isn't the app.
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  // `now`: a frame of motion (look C's walk), taken as it moves.
  if (!now) await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(OUT, `${id}.jpg`), type: "jpeg", quality: 84 });
  const words = await p.evaluate(() => document.body.innerText).catch(() => "");
  fs.writeFileSync(path.join(OUT, `${id}.txt`), words);
  // Words cut short in the control (a truncated line hides what's out): printed as TRUNC lines, kept in index.json.
  const cut = await p.evaluate(() =>
    [...document.querySelectorAll("[data-progress] .truncate")].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 1).map((el) => el.textContent.trim())
  ).catch(() => []);
  for (const t of cut) console.log(`TRUNC ${id}: ${t}`);
  if (cut.length) note = { ...note, truncated: cut };
  const hits = await overlapsIn(p, H).catch(() => []);
  for (const h of hits) {
    console.log(`OVERLAP ${id}: ${JSON.stringify(h)}`);
    overlaps.push({ id, words: h });
  }
  index.push({ id, note });
  console.log(`shot ${id}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const sessions = new Map();
  let ids = null, upFor = null;
  const bring = async (fixture) => {
    ids = await fx.up(pool, fixture);
    upFor = JSON.stringify(fixture);
    // The couch's people changed ids: sign in afresh.
    for (const s of sessions.values()) await s.close();
    sessions.clear();
  };
  const session = async (who) => {
    if (!sessions.has(who)) sessions.set(who, await open({ user: fx.username(who), pass: fx.PASSWORD, width: W, height: H, motion: "on" }));
    return sessions.get(who);
  };
  const tonight = async (sit, look) => {
    const s = SITUATIONS[sit];
    const { page } = await session(s.who);
    const p = await page.context().newPage();
    const season = s.show === "traitors" ? ids.traitorsSeasonId : ids.survivorSeasonId;
    await p.goto(`${process.env.BASE || "http://localhost:3000"}/show/${season}/tonight`, { waitUntil: "domcontentloaded" });
    await p.locator("[data-progress]").first().waitFor({ timeout: 20000 });
    await fontsReady(p);
    await p.waitForTimeout(1400);
    return p;
  };
  try {
    for (const [sit, s] of Object.entries(SITUATIONS)) {
      for (const look of LOOKS) {
        const base = `${sit}-${look}`;
        const flows = sit === "live" ? LIVE : sit === "watch-2" || sit === "play-2" || sit === "watch-long" ? FLOWS[look] ?? [] : [];
        if (!want(base) && !flows.some((f) => want(`${base}.${f.id}`))) continue;
        if (upFor !== JSON.stringify(s.fixture)) await bring(s.fixture);
        if (want(base)) {
          const p = await tonight(sit, look);
          await shoot(p, base, { situation: sit, look, frame: "first view" });
          await p.close();
        }
        for (const f of flows) {
          // A show you play takes the guard and the reveal only (its Not yet and range are the watcher's flows, shot on watch-2);
          // the long season takes the guard alone.
          if (sit === "play-2" && !["yes", "first", "yes-play", "pick"].includes(f.id)) continue;
          if (sit === "watch-long" && f.writes) continue;
          if (!want(`${base}.${f.id}`)) continue;
          const p = await tonight(sit, look);
          try {
            for (const st of f.steps) {
              if (st.tap || st.tapLast) {
                const loc = p.locator(st.tap || st.tapLast);
                await (st.tap ? loc.first() : loc.last()).click({ timeout: 8000 });
                if (!st.motion) await p.waitForTimeout(700);
              } else if (st.tapNth) {
                // The nth match, or the last when there are fewer (two out: the latest).
                const loc = p.locator(st.tapNth[0]);
                const n = await loc.count();
                await loc.nth(Math.min(st.tapNth[1], n - 1)).click({ timeout: 8000 });
                await p.waitForTimeout(700);
              } else if (st.wait) await p.locator(st.wait).first().waitFor({ timeout: 12000 });
              else if (st.pause) await p.waitForTimeout(st.pause);
              else if (st.skip) {
                await p.locator(`${sheet} button:has-text("Skip")`).first().click({ timeout: 8000 });
                await p.waitForTimeout(1200);
              } else if (st.close) {
                await p.locator(`${sheet} button:has-text("Back to")`).last().click({ timeout: 8000 });
                await p.waitForTimeout(1800);
              } else if (st.shot) await shoot(p, `${base}.${f.id}-${st.shot}`, { situation: sit, look, flow: f.id, frame: st.shot }, !!st.now);
            }
          } catch (e) {
            console.log(`SKIP ${base}.${f.id}: ${e.message.split("\n")[0]}`);
          }
          await p.close();
          if (f.writes) await bring(s.fixture);
        }
      }
    }
  } finally {
    for (const s of sessions.values()) await s.close();
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
    fs.writeFileSync(path.join(OUT, "overlaps.json"), JSON.stringify(overlaps, null, 2));
    if (!args.includes("--keep")) await fx.down(pool);
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
