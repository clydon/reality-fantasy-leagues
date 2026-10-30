// Dev-only frame-by-frame check for flashes of unloaded content (the user, 2026-10-29: "content that isn't loaded yet, or
// content that shows and then disappears"), in a real browser against the dev server, as new-fixture.js's alex, at --width
// (390 by default). Each journey goes somewhere (a tap from the hub, or a fresh load) while the page records itself:
//   - every frame's visible text (not hidden, anywhere on the page), in the page, from the first script on (a requestAnimationFrame loop, timestamped);
//   - its layout shifts (PerformanceObserver 'layout-shift', the browser's own measure);
//   - with --shots=<dir>, the screen itself as it paints (CDP's screencast), a JPEG per frame, named by milliseconds.
// Once the page has settled (no change for 1.5 s), a line of text that was on screen during the journey and isn't any more
// is a flash ("shown, then gone"), unless the journey's page went from one route to another (the page it left) or the
// line is a clock's. A journey passes with no flash and its layout shift under 0.1 (the browser's "good").
//
//   node scripts/lane.js dev                         (in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-flashes.js [--width=390] [--only=<journey>] [--shots=<dir>] [--keep] [--warm]
//
// Journeys: hub-upnext (the hub's Up next, its show link, the user's example), hub-show (Your shows' card), tab-<tab> (the
// show's tab bar from Tonight: Episodes, Games, Cast, Chat, which opens at its newest message), and fresh loads
// of the hub, the show's Tonight, Episodes, Games, Cast, Chat, Settings. --warm visits each page once first (the dev
// server compiles a page the first time it's asked for, which is a dev-only wait). Brings new-fixture.js up and takes it
// down (--keep leaves it: sign in as zt_nd_alex / zt-pass-12345); touches zt-nd rows only; refuses a non-local database.
// Prints PASS/FAIL per journey with what flashed, exits non-zero on a FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path_ = require("path");
const { Pool } = require("pg");
const { open } = require("./browser");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-flashes runs against a local database only");

const args = process.argv.slice(2);
const arg = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const width = Number(arg("width") || 390);
const only = arg("only");
const shots = arg("shots");
const keep = args.includes("--keep");
const warm = args.includes("--warm");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `\n      ${detail.split("\n").join("\n      ")}` : ""}`);
  if (!ok) failures++;
}

// In the page, before its scripts: the visible text of each frame that changed, and the layout shifts.
function recorder() {
  const log = [];
  const shifts = [];
  window.__flash = { log, shifts, t0: performance.now() };
  let last = "";
  const visibleText = () => {
    const out = [];
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.textContent.replace(/\s+/g, " ").trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || el.closest("script, style, noscript, [aria-hidden=true], nextjs-portal, [data-nextjs-toast]")) continue;
      if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      // Anywhere on the page: pushed below the fold isn't gone (the layout shift says it moved).
      out.push(t);
    }
    return out;
  };
  const frame = () => {
    if (document.body) {
      const lines = visibleText();
      const key = lines.join("\n");
      if (key !== last) {
        last = key;
        log.push({ t: Math.round(performance.now()), path: location.pathname, lines });
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) shifts.push({ t: Math.round(e.startTime), value: e.value });
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
}

// Clocks and countdowns change by themselves: "in 3 days", "NOW 1:59 PM", "2h", "5d".
const CLOCKISH = /^(now\b.*|\d{1,2}:\d{2}\s?(am|pm)?|in \d+.*|\d+[smhd]|.*\bago)$/i;

/** What was on screen during the journey and isn't once it settled, on the page it ended on. */
function analyse(log, endPath) {
  if (!log.length) return { flashes: [], frames: 0 };
  const final = new Set(log.at(-1).lines);
  const onEnd = log.filter((f) => f.path === endPath);
  const gone = new Map();
  for (const f of onEnd) {
    for (const l of f.lines) {
      if (final.has(l) || CLOCKISH.test(l) || gone.has(l)) continue;
      const lastSeen = [...onEnd].reverse().find((g) => g.lines.includes(l));
      gone.set(l, { from: f.t, to: lastSeen.t });
    }
  }
  return { flashes: [...gone].map(([line, w]) => ({ line, ...w })), frames: log.length };
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  let close = async () => {};
  try {
    const f = await fixture.up(pool);
    const b = await open({ user: fixture.username("alex"), pass: fixture.PASSWORD, width, motion: "on" });
    close = b.close;
    const { BASE } = b;
    const context = b.page.context();
    await context.addInitScript(recorder);
    const S = `/show/${f.seasonId}`;

    const settle = async (page) => {
      // No new frame for 1.5 s, or 15 s in all.
      const end = Date.now() + 15000;
      let n = -1;
      let still = 0;
      while (Date.now() < end && still < 1500) {
        await page.waitForTimeout(250);
        const m = await page.evaluate(() => window.__flash.log.length).catch(() => n);
        still = m === n ? still + 250 : 0;
        n = m;
      }
    };

    // One journey failing (a link not there, a page that never loads) is its FAIL; the rest still run.
    async function journey(name, steps) {
      if (only && only !== name) return;
      await walk(name, steps).catch((e) => check(false, `${name}: didn't finish`, String(e).split(String.fromCharCode(10))[0]));
    }
    async function walk(name, { from, go, endPath }) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      let cdp = null;
      const dir = shots && path_.join(shots, name);
      if (from) {
        await page.goto(BASE + from, { waitUntil: "load" });
        await settle(page);
      }
      if (dir) {
        fs.mkdirSync(dir, { recursive: true });
        cdp = await context.newCDPSession(page);
        let t0 = null;
        cdp.on("Page.screencastFrame", async (fr) => {
          t0 ??= fr.metadata.timestamp;
          fs.writeFileSync(path_.join(dir, `${String(Math.round((fr.metadata.timestamp - t0) * 1000)).padStart(5, "0")}.jpg`), Buffer.from(fr.data, "base64"));
          await cdp.send("Page.screencastFrameAck", { sessionId: fr.sessionId }).catch(() => {});
        });
        await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, everyNthFrame: 1 });
      }
      // From here on is the journey: what was logged before it (the page it started on) is left out.
      const startAt = from ? await page.evaluate(() => performance.now()) : 0;
      await go(page);
      await settle(page);
      if (cdp) await cdp.send("Page.stopScreencast").catch(() => {});
      const { log, shifts } = await page.evaluate(() => window.__flash);
      const path = new URL(page.url()).pathname;
      const within = log.filter((x) => x.t >= startAt);
      const { flashes, frames } = analyse(within, endPath?.(path) ?? path);
      const cls = shifts.filter((s) => s.t >= startAt).reduce((a, s) => a + s.value, 0);
      const detail = [
        ...flashes.map((x) => `shown ${Math.round(x.from - startAt)}-${Math.round(x.to - startAt)} ms, then gone: "${x.line.slice(0, 90)}"`),
        cls >= 0.1 ? `layout shift ${cls.toFixed(3)}` : "",
        ...errors,
      ].filter(Boolean);
      check(!flashes.length && cls < 0.1 && !errors.length, `${name}: ${frames} frames to ${path}, layout shift ${cls.toFixed(3)}`, detail.join("\n"));
      // The chat opens at its newest message (it scrolls once it's on screen).
      if (/\/chat$/.test(path)) {
        const gap = await page.evaluate(() => document.documentElement.scrollHeight - window.scrollY - window.innerHeight);
        check(gap < 140, `${name}: the chat opens at its newest message`, `${Math.round(gap)} px above the bottom`);
      }
      if (dir) fs.writeFileSync(path_.join(dir, "frames.json"), JSON.stringify(within, null, 1));
      await page.close();
    }

    if (warm) {
      const page = await context.newPage();
      for (const p of ["/home", `${S}/tonight`, `${S}/episodes`, `${S}/games`, `${S}/cast`, `${S}/chat`, "/settings"]) {
        await page.goto(BASE + p, { waitUntil: "load" });
        await settle(page);
      }
      await page.close();
    }

    const tap = (sel) => async (page) => {
      await page.locator(sel).first().click();
      await page.waitForURL((u) => u.pathname.startsWith(S), { timeout: 20000 });
    };
    await journey("hub-upnext", { from: "/home", go: tap(`[data-upnext] a[href^="${S}"]`) });
    // A tab of the show by its tab bar, from Tonight.
    const tabTo = (name) => async (page) => {
      await page.locator("nav[aria-label=Show] a", { hasText: new RegExp(`^${name}`, "i") }).click();
      await page.waitForURL((u) => u.pathname === `${S}/${name.toLowerCase()}`, { timeout: 20000 });
    };
    for (const t of ["Episodes", "Games", "Cast", "Chat"]) await journey(`tab-${t.toLowerCase()}`, { from: `${S}/tonight`, go: tabTo(t) });
    await journey("hub-show", { from: "/home", go: tap(`[data-flip] a[href^="${S}"], a[data-poster][href^="${S}"], [data-poster] a[href^="${S}"]`) });
    for (const [name, p] of [
      ["load-hub", "/home"],
      ["load-tonight", `${S}/tonight`],
      ["load-episodes", `${S}/episodes`],
      ["load-games", `${S}/games`],
      ["load-cast", `${S}/cast`],
      ["load-chat", `${S}/chat`],
      ["load-settings", "/settings"],
    ]) {
      await journey(name, { go: (page) => page.goto(BASE + p, { waitUntil: "commit" }) });
    }
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await close().catch(() => {});
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exit(failures ? 1 : 0);
  }
})();
