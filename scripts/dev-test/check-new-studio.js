// Dev-only check for Appearance and the Studio theme (docs/PLAN-new-design.md step 15 part 4), against the dev server, on
// new-fixture.js's couch ("ZT Survivor 51": alex runs its three games, riley, jordan and sam on it; a ZT Traitors season it only
// watches), draft-fixture.js's couch about to draft, and a desk admin of its own (zt_nd_desk, removed with new-fixture's down).
//   API: user_settings.theme (Night by default), the profile's theme, a bad one refused, a saved one answered with this device's
//   `gys_theme` cookie (readable by the boot script, so not httpOnly), and the home read and GET /api/me writing the cookie only
//   when a device's differs (a second device catches up).
//   First paint: the server's HTML carries the boot script and the bars' colour for the cookie's theme, and with every script of
//   the app's blocked (nothing hydrates) the page is still drawn in it: Studio's ground, no `dark` on <html>.
//   Settings as alex at --width (390 by default): Appearance's three, Studio drawn at once and saved with Undo, Match phone
//   following the phone as it changes (no reload), a reload keeping it, a second device catching up on its first visit.
//   The sweep: every screen of the new design (signed out, the hub's two shapes, a show's five tabs and its pages, Backstage's
//   pages, the draft room, Settings, the desk, a few sheets) in Night and in Studio, screenshotted, and audited from the pixels
//   behind each piece of text: yellow as text, an icon, a border or an outline on a light ground fails (the yellow rule:
//   chyron-line, amber on Studio), and so does text under 3:1 against what's behind it (4.5:1 is listed, not failed). Nothing
//   wider than the screen; no page errors.
//
//   npm run dev                                                  (in another terminal)
//   node scripts/dev-test/check-new-studio.js <outDir> [--width=390] [--keep] [--api] [--themes=night,studio] [--only=<re>]
//
// --api: the API and first-paint half only. --only: just the screens whose name matches. Brings the fixtures up and takes them
// down (--keep leaves them); touches zt rows only; refuses a non-local database. Prints PASS/FAIL (and LOW for 3 to 4.5:1).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const fixture = require("./new-fixture");
const draftFixture = require("./draft-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-new-studio runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: check-new-studio.js <outDir> [--width=390] [--keep] [--api] [--themes=night,studio] [--only=<re>]");
const arg = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).slice(k.length + 3);
const width = Number(arg("width", "390"));
const themes = arg("themes", "night,studio").split(",");
const only = args.some((a) => a.startsWith("--only=")) ? new RegExp(arg("only", ""), "i") : null;
const apiOnly = args.includes("--api");
const keep = args.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const DESK = "zt_nd_desk";

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

const cookieOf = (res) => (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("gys_theme="));

// ---------- the audit, in the page: what's behind each piece of text, from a screenshot of the viewport ----------
// `shot` is the viewport as a PNG data URL, taken with every glyph and icon made invisible (BARE), so the pixels inside a piece of
// text's box are what it sits on: its own fill (a pill, a yellow button), a card, a show's art, a gradient. Each element with
// text of its own (or an icon) is measured against the median of a grid of those pixels; a border or an outline against the ring
// just outside it.
const BARE = `*,*::before,*::after{color:transparent!important;-webkit-text-stroke-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}
svg{visibility:hidden!important}::placeholder{color:transparent!important}`;
const AUDIT = async (shot) => {
  const img = new Image();
  await new Promise((r, j) => {
    img.onload = r;
    img.onerror = j;
    img.src = shot;
  });
  const scale = img.naturalWidth / window.innerWidth;
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const px = (x, y) => {
    const X = Math.max(0, Math.min(cv.width - 1, Math.round(x * scale)));
    const Y = Math.max(0, Math.min(cv.height - 1, Math.round(y * scale)));
    const d = cx.getImageData(X, Y, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const parse = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || "");
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const blend = (top, under, a) => [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a));
  const isYellow = (c) => c && Math.abs(c[0] - 255) < 6 && Math.abs(c[1] - 197) < 8 && Math.abs(c[2] - 49) < 10 && c[3] > 0.5;
  const median = (pts) => {
    pts.sort((a, b) => lum(a) - lum(b));
    return pts[Math.floor(pts.length / 2)];
  };
  // What a piece of text sits on: a grid inside each line of its own text (an icon: its box), on the glyph-free shot.
  const under = (el, r) => {
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      rects.push(...[...range.getClientRects()].filter((x) => x.width > 1 && x.height > 1));
    }
    const pts = [];
    for (const q of rects.length ? rects : [r]) for (let i = 1; i < 6; i++) for (let j = 1; j < 4; j++) pts.push(px(q.left + (q.width * i) / 6, q.top + (q.height * j) / 4));
    return median(pts);
  };
  // What a box sits on: the ring just outside it (leaving out a neighbouring picture: a row of photos sits on the card, not on
  // each other).
  const behind = (r, pad = 3) => {
    const pts = [];
    const take = (x, y) => {
      const hit = document.elementFromPoint(Math.max(0, Math.min(window.innerWidth - 1, x)), Math.max(0, Math.min(window.innerHeight - 1, y)));
      if (hit && hit.tagName === "IMG") return;
      pts.push(px(x, y));
    };
    for (let i = 0; i <= 6; i++) {
      const x = r.left + ((r.width * i) / 6);
      take(x, r.top - pad);
      take(x, r.bottom + pad);
    }
    for (let i = 1; i < 4; i++) {
      const y = r.top + ((r.height * i) / 4);
      take(r.left - pad, y);
      take(r.right + pad, y);
    }
    return pts.length ? median(pts) : px(r.left - pad, r.top - pad);
  };
  const visible = (el, r) => {
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    const hit = document.elementFromPoint(Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2)));
    return !!hit && (el.contains(hit) || hit.contains(el));
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) o *= Number(getComputedStyle(e).opacity);
    return o;
  };
  const label = (el) => {
    const t = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 48);
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter((c) => /chyron|white|black|text-|bg-|border-|outline-|#|rgba/.test(c)).slice(0, 5).join(" ");
    return `${el.tagName.toLowerCase()} "${t}"${cls ? ` [${cls}]` : ""}`;
  };
  const yellow = [];
  const low = [];
  const poor = [];
  const seen = new Set();
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("nextjs-portal, script, style, [aria-hidden=true] svg, [data-audit-skip]")) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const icon = el.tagName.toLowerCase() === "svg";
    // Disabled controls, and what's only decoration (aria-hidden: a face's initial beside the name), aren't held to a contrast.
    const disabled = el.closest("[disabled], [aria-disabled=true], [aria-hidden=true], [role=img]");
    if ((ownText || icon) && visible(el, r)) {
      // Outlined type (the wordmark's "Game" and "Show") is its stroke.
      let fg = parse(cs.color);
      if (fg && fg[3] === 0 && parseFloat(cs.webkitTextStrokeWidth) > 0) fg = parse(cs.webkitTextStrokeColor);
      if (fg && fg[3] > 0) {
        const bg = under(el, r);
        const a = fg[3] * opacityOf(el);
        const ink = blend(fg, bg, a);
        const k = ratio(ink, bg);
        const key = label(el);
        if (isYellow(fg) && lum(bg) > 0.45 && !seen.has(`y${key}`)) {
          seen.add(`y${key}`);
          yellow.push(`${key} yellow ${icon ? "icon" : "text"} on rgb(${bg.join(",")})`);
        } else if (!disabled && !icon && !seen.has(`c${key}`)) {
          seen.add(`c${key}`);
          const size = parseFloat(cs.fontSize);
          const large = size >= 24 || (size >= 18.6 && Number(cs.fontWeight) >= 700);
          if (k < 3) poor.push(`${key} ${k.toFixed(2)}:1 (rgb(${ink.map(Math.round).join(",")}) on rgb(${bg.join(",")}))`);
          else if (k < 4.5 && !large) low.push(`${key} ${k.toFixed(2)}:1`);
        }
      }
    }
    // Yellow lines: a border or an outline that isn't a fill's edge, on a light ground.
    if (visible(el, r)) {
      const sides = ["Top", "Right", "Bottom", "Left"].filter((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none" && isYellow(parse(cs[`border${s}Color`])));
      const outline = parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== "none" && isYellow(parse(cs.outlineColor));
      if ((sides.length || outline) && !isYellow(parse(cs.backgroundColor))) {
        const bg = behind(r, 1 + (outline ? Math.max(0, parseFloat(cs.outlineOffset) || 0) + parseFloat(cs.outlineWidth) : 0));
        const key = label(el);
        if (lum(bg) > 0.45 && !seen.has(`l${key}`)) {
          seen.add(`l${key}`);
          yellow.push(`${key} yellow ${outline ? "outline" : "border"} on rgb(${bg.join(",")})`);
        }
      }
    }
  }
  return { yellow, poor, low, over: document.documentElement.scrollWidth - window.innerWidth };
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const A = fx.users.alex;
    for (const u of Object.values(fx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new', theme = 'night'`, [u]);
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    const as = {};
    for (const who of ["alex", "riley", "sam"]) as[who] = await api({ user: fixture.username(who), pass: PASSWORD });

    // ---------- the API ----------
    const col = (await pool.query("SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'theme'")).rows[0];
    check(!!col && /night/.test(col.column_default) && col.is_nullable === "NO", "user_settings.theme: NOT NULL, Night by default", JSON.stringify(col));
    let r = await as.alex.call("GET", "/api/me/profile");
    check(r.status === 200 && r.body.theme === "night", "alex's profile: Night", JSON.stringify(r.body.theme));
    r = await as.alex.call("PUT", "/api/me/profile", { theme: "sepia" });
    check(r.status === 400 && /night, studio or phone/.test(r.body.error), "a theme we don't have: 400", JSON.stringify(r.body));
    const login = async (who) => {
      const s = await fetch(BASE + "/api/auth/sign-in/username", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ username: who, password: PASSWORD }) });
      return s.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    };
    const session = await login(fixture.username("alex"));
    let res = await fetch(BASE + "/api/me/profile", { method: "PUT", headers: { cookie: session, origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ theme: "studio" }) });
    let body = await res.json();
    let c = cookieOf(res);
    check(res.status === 200 && body.theme === "studio", "Studio: saved and answered", JSON.stringify(body.theme));
    check(!!c && /^gys_theme=studio/.test(c) && !/HttpOnly/i.test(c) && /Path=\//i.test(c) && /Max-Age=\d{6,}/i.test(c), "with this device's cookie: gys_theme=studio, readable by the page, kept for a year", c);
    check((await pool.query("SELECT theme FROM user_settings WHERE user_id = $1", [A])).rows[0].theme === "studio", "kept on the account");
    // Another device: no cookie yet, so the home read and /api/me write it; a device that has it gets nothing new.
    for (const [what, url] of [["the home read", "/api/me/home"], ["GET /api/me", "/api/me"]]) {
      res = await fetch(BASE + url, { headers: { cookie: session } });
      c = cookieOf(res);
      check(res.status === 200 && !!c && /^gys_theme=studio/.test(c), `${what}: a device without the cookie gets it`, c);
      res = await fetch(BASE + url, { headers: { cookie: `${session}; gys_theme=night` } });
      c = cookieOf(res);
      check(!!c && /^gys_theme=studio/.test(c), `${what}: a device on Night catches up to Studio`, c);
      res = await fetch(BASE + url, { headers: { cookie: `${session}; gys_theme=studio` } });
      check(!cookieOf(res), `${what}: a device already on it gets no cookie`, cookieOf(res));
    }
    body = await (await fetch(BASE + "/api/me/home", { headers: { cookie: session } })).json();
    check(body.user.theme === "studio", "the home read carries it on your own face", JSON.stringify(body.user));

    // ---------- first paint ----------
    const html = async (theme) => (await fetch(BASE + "/settings", { headers: { cookie: `${session}; gys_theme=${theme}` } })).text();
    let page = await html("studio");
    check(/data-nd-theme/.test(page) && /gys_theme/.test(page), "the server's HTML carries the boot script, which reads the cookie");
    check(/<meta name="theme-color" content="#ecebf1"/.test(page), "Studio: the bars are Studio's ground", (/<meta name="theme-color"[^>]*>/.exec(page) || [""])[0]);
    page = await html("night");
    check(/<meta name="theme-color" content="#16141d"/.test(page), "Night: the bars are Night's", (/<meta name="theme-color"[^>]*>/.exec(page) || [""])[0]);
    page = await html("phone");
    const metas = page.match(/<meta name="theme-color"[^>]*>/g) ?? [];
    check(
      metas.length === 2 && metas.some((m) => /#ecebf1/.test(m) && /prefers-color-scheme: light/.test(m)) && metas.some((m) => /#16141d/.test(m) && /prefers-color-scheme: dark/.test(m)),
      "Match phone: one for each of the phone's settings",
      metas.join(" ")
    );

    const noBadge = () => {
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      });
    };
    {
      // Nothing of the app's JavaScript runs: what's drawn is the server's HTML and the inline boot script alone.
      const b = await open({ user: fixture.username("alex"), pass: PASSWORD, width, motion: "off" });
      closers.push(b.close);
      await b.page.context().addInitScript(noBadge);
      await b.page.context().addCookies([{ name: "gys_theme", value: "studio", url: BASE }]);
      await b.page.route(/\/_next\/static\/.*\.js/, (route) => route.abort());
      await b.page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
      await b.page.waitForTimeout(800);
      const drawn = await b.page.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), attr: document.documentElement.getAttribute("data-nd-theme"), bg: getComputedStyle(document.querySelector(".nd") || document.body).backgroundColor }));
      check(!drawn.dark && drawn.attr === "studio" && drawn.bg === "rgb(236, 235, 241)", "with no app script at all, the page is drawn in Studio (before anything hydrates)", JSON.stringify(drawn));
      await b.page.screenshot({ path: path.join(out, "00-first-paint-studio.png") });
      await b.page.context().addCookies([{ name: "gys_theme", value: "night", url: BASE }]);
      await b.page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
      await b.page.waitForTimeout(500);
      const night = await b.page.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), bg: getComputedStyle(document.querySelector(".nd") || document.body).backgroundColor }));
      check(night.dark && night.bg === "rgb(22, 20, 29)", "and in Night with the cookie saying so", JSON.stringify(night));
      await b.close();
    }
    await as.alex.call("PUT", "/api/me/profile", { theme: "night" });

    if (!apiOnly) {
      let n = 0;
      const browse = async (who, { theme, user, cookie = true } = {}) => {
        const b = await open({ user: user ?? fixture.username(who), pass: PASSWORD, width, height: 844, motion: "off" });
        closers.push(b.close);
        await b.page.context().addInitScript(noBadge);
        if (theme && cookie) await b.page.context().addCookies([{ name: "gys_theme", value: theme, url: BASE }]);
        await b.page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
        let favicon = 0;
        b.page.on("console", (m) => m.type() === "error" && m.location().url.endsWith("/favicon.ico") && favicon++);
        const pg = b.page;
        const ready = async () => {
          await pg.locator(".nd").first().waitFor({ timeout: 30000 });
          await pg.waitForFunction(() => !document.querySelector("[aria-busy=true], [aria-busy='']") && !document.querySelector(".animate-pulse"), null, { timeout: 15000 }).catch(() => {});
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.waitForTimeout(800);
        };
        const shot = async (name) => {
          await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
          await pg.waitForTimeout(250);
          await pg.screenshot({ path: path.join(out, `${String(++n).padStart(3, "0")}-${name}.png`) });
        };
        const state = () => pg.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), attr: document.documentElement.getAttribute("data-nd-theme"), ground: getComputedStyle(document.querySelector(".nd")).backgroundColor, cookie: document.cookie.match(/gys_theme=([^;]*)/)?.[1] ?? null }));
        const toasted = async (re) => {
          try {
            await pg.waitForFunction((src) => new RegExp(src, "i").test(document.querySelector("[role=status]")?.textContent || ""), re.source, { timeout: 15000 });
            return true;
          } catch {
            return false;
          }
        };
        const errors = () => b.errors.filter((e) => !(favicon && /Failed to load resource/.test(e)));
        return { b, pg, ready, shot, state, toasted, errors };
      };

      // ---------- Settings › Appearance, as alex ----------
      if (!only || only.test("appearance")) {
        const a = await browse("alex", { theme: "night" });
        const { pg } = a;
        await pg.goto(`${BASE}/settings`, { waitUntil: "load" });
        await pg.locator("[data-settings-appearance]").waitFor({ timeout: 30000 });
        await a.ready();
        check((await pg.locator("[data-preview]").count()) === 0, "Settings: nothing in Preview any more");
        const choices = await pg.locator("[data-settings-appearance] [role=radio]").allInnerTexts();
        check(choices.join("|") === "Night|Studio|Match phone", "Appearance: Night · Studio · Match phone", choices.join("|"));
        check((await pg.locator('[data-theme-choice="night"]').getAttribute("aria-checked")) === "true", "Night is on");
        await pg.locator("[data-settings-appearance]").scrollIntoViewIfNeeded();
        await a.shot("appearance-night");
        await pg.locator('[data-theme-choice="studio"]').click();
        let s = await a.state();
        check(!s.dark && s.attr === "studio" && s.ground === "rgb(236, 235, 241)" && s.cookie === "studio", "Studio: drawn at once (no dark, Studio's ground) and this device's cookie says so", JSON.stringify(s));
        check(await a.toasted(/Saved: Studio/), "the toast: Saved: Studio, with Undo");
        await pg.waitForTimeout(400);
        check((await pg.locator('meta[name="theme-color"]').first().getAttribute("content")) === "#ecebf1", "the bars follow");
        check((await pool.query("SELECT theme FROM user_settings WHERE user_id = $1", [A])).rows[0].theme === "studio", "saved on the account");
        await a.shot("appearance-studio");
        await pg.locator("[role=status] button", { hasText: "Undo" }).click();
        await pg.waitForTimeout(800);
        s = await a.state();
        check(s.dark && s.attr === "night" && (await pool.query("SELECT theme FROM user_settings WHERE user_id = $1", [A])).rows[0].theme === "night", "Undo: back to Night, here and on the account", JSON.stringify(s));
        // Match phone: the phone says light, then dark, then light again, and the page follows without a reload.
        await pg.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await pg.locator('[data-theme-choice="phone"]').click();
        await pg.waitForTimeout(600);
        s = await a.state();
        check(!s.dark && s.attr === "phone" && s.cookie === "phone", "Match phone on a phone set to light: Studio", JSON.stringify(s));
        check(/Studio now/.test(await pg.locator("[data-settings-appearance]").innerText()), "and says so: Studio now");
        await a.shot("appearance-phone-light");
        await pg.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
        await pg.waitForTimeout(400);
        s = await a.state();
        check(s.dark && /Night now/.test(await pg.locator("[data-settings-appearance]").innerText()), "the phone goes dark: Night, as it changes", JSON.stringify(s));
        await pg.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
        await pg.reload({ waitUntil: "load" });
        await a.ready();
        s = await a.state();
        check(!s.dark && s.attr === "phone", "a reload keeps Match phone (and the phone's light)", JSON.stringify(s));
        check(a.errors().length === 0, "no page errors in Settings", a.errors().join(" | ").slice(0, 300));

        // A second device: no cookie, so its first screen is Night, until the home read says Studio.
        await as.alex.call("PUT", "/api/me/profile", { theme: "studio" });
        const d = await browse("alex", { theme: null });
        await d.pg.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
        await d.pg.waitForFunction(() => document.documentElement.getAttribute("data-nd-theme") === "studio", null, { timeout: 20000 }).catch(() => {});
        s = await d.state();
        check(!s.dark && s.attr === "studio" && s.cookie === "studio", "a second device catches up on its first visit (the home read)", JSON.stringify(s));
        await d.pg.goto(`${BASE}/settings`, { waitUntil: "load" });
        await d.ready();
        check((await d.pg.locator('[data-theme-choice="studio"]').getAttribute("aria-checked")) === "true", "and its Settings says Studio");
        await as.alex.call("PUT", "/api/me/profile", { theme: "night" });
      }

      // ---------- the sweep: every screen in each theme ----------
      const dfx = await draftFixture.up(pool);
      const deskId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      await pool.query(`DELETE FROM "user" WHERE username = $1`, [DESK]);
      await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
      const hash = (await pool.query(`SELECT a.password FROM account a JOIN "user" u ON u.id = a."userId" WHERE u.username = $1 AND a."providerId" = 'credential'`, [fixture.username("alex")])).rows[0].password;
      await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, hash]);
      await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [deskId]);
      for (const u of Object.values(dfx.users)) await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [u]);
      // alex's invite code (made the first time it's asked for), for the invite page signed out.
      const code = (await as.alex.call("GET", `/api/couches/${fx.couchId}/invite`)).body.code;
      const tsid = fx.traitorsSeasonId;
      const sheet = (pg) => pg.locator("[role=dialog][data-open]");
      const tap = async (pg, loc) => {
        await loc.first().click();
        await sheet(pg).first().waitFor({ timeout: 10000 }).catch(() => {});
      };
      // [name, who, url, then?]
      const SCREENS = [
        ["welcome", null, "/welcome"],
        ["signin", null, "/signin"],
        ["start-1", null, "/start/1"],
        ...(code ? [["join-invite", null, `/join/${code}`]] : []),
        ["hub-focus", "alex", "/home?hub=focus"],
        ["hub-grow", "alex", "/home"],
        ["hub-profile-sheet", "alex", "/home?hub=focus", (pg) => tap(pg, pg.locator("header button[aria-label*='rofile'], [data-profile-face], header button").first())],
        ["hub-bell", "alex", "/home?hub=focus", (pg) => tap(pg, pg.locator("[data-bell]"))],
        ["tonight", "alex", `/show/${sid}/tonight`],
        ["games-your-moves", "alex", `/show/${sid}/games`, (pg) => tap(pg, pg.locator("button.nd-dock"))],
        ["episodes", "alex", `/show/${sid}/episodes`],
        ["episode-page", "alex", `/show/${sid}/episodes?page=ep4`],
        ["games", "alex", `/show/${sid}/games`],
        ["cast", "alex", `/show/${sid}/cast`],
        ["stats", "alex", `/show/${sid}/cast?page=stats`],
        ["chat", "alex", `/show/${sid}/chat`],
        ["chat-message-sheet", "alex", `/show/${sid}/chat`, (pg) => tap(pg, pg.locator("[data-msg] button").last())],
        ["watch-along", "alex", `/show/${sid}/tonight?page=watch&ep=6`],
        ["waivers", "alex", `/show/${sid}/waivers`],
        ["backstage", "alex", `/show/${sid}/backstage`],
        ["backstage-results", "alex", `/show/${sid}/backstage/results`],
        ["backstage-waivers", "alex", `/show/${sid}/backstage/waivers`],
        ["backstage-rules", "alex", `/show/${sid}/backstage/rules`],
        ["backstage-members", "alex", `/show/${sid}/backstage/members`],
        ["backstage-settings", "alex", `/show/${sid}/backstage/settings`],
        ["backstage-history", "alex", `/show/${sid}/backstage/history`],
        ["traitors-tonight", "riley", `/show/${tsid}/tonight`],
        ["traitors-episodes", "riley", `/show/${tsid}/episodes`],
        ["reveal-sam", "sam", `/show/${sid}/tonight`, (pg) => tap(pg, pg.locator("button[data-dock='reveal'], button", { hasText: /^Reveal/ }))],
        ["draft-room", "dr-alex", `/show/${dfx.seasonId}/draft`],
        ["settings", "alex", "/settings"],
        ["desk", "desk", "/desk"],
        ["desk-find", "desk", "/desk/find"],
        ["desk-library", "desk", "/desk/library"],
      ].filter(([name]) => !only || only.test(name));

      const users = { "dr-alex": draftFixture.username("alex"), desk: DESK };
      for (const theme of themes) {
        const browsers = new Map();
        const get = async (who) => {
          if (!browsers.has(who)) {
            if (who && who !== "desk" && !who.startsWith("dr-")) await pool.query("UPDATE user_settings SET theme = $2 WHERE user_id = $1", [fx.users[who], theme]);
            else if (who === "desk") await pool.query("UPDATE user_settings SET theme = $2 WHERE user_id = $1", [deskId, theme]);
            else if (who) await pool.query("UPDATE user_settings SET theme = $2 WHERE user_id = $1", [dfx.users[who.slice(3)], theme]);
            const bb = who ? await browse(who, { theme, user: users[who] }) : await (async () => {
              const b = await open({ width, height: 844, motion: "off" });
              closers.push(b.close);
              await b.page.context().addInitScript(noBadge);
              await b.page.context().addCookies([{ name: "gys_theme", value: theme, url: BASE }]);
              await b.page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
              const pg = b.page;
              return {
                b,
                pg,
                ready: async () => {
                  await pg.locator(".nd").first().waitFor({ timeout: 30000 });
                  await Promise.race([b.settle(), pg.waitForTimeout(3000)]);
                  await pg.waitForTimeout(800);
                },
                shot: async (nm) => pg.screenshot({ path: path.join(out, `${String(++n).padStart(3, "0")}-${nm}.png`) }),
                errors: () => b.errors.filter((e) => !/favicon|Failed to load resource/.test(e)),
              };
            })();
            browsers.set(who, bb);
          }
          return browsers.get(who);
        };
        for (const [name, who, url, then] of SCREENS) {
          const v = await get(who);
          const { pg } = v;
          try {
            await pg.goto(`${BASE}${url}`, { waitUntil: "load" });
            await v.ready();
            if (then) {
              await then(pg);
              await pg.waitForTimeout(700);
            }
          } catch (e) {
            check(false, `${theme} ${name}: opens`, String(e).split("\n")[0]);
            continue;
          }
          const drawn = await pg.evaluate(() => document.documentElement.classList.contains("dark"));
          check(drawn === (theme === "night"), `${theme} ${name}: drawn in ${theme}`, `dark=${drawn}`);
          // Audit the viewport, then each screenful down (a sheet: just what's open).
          const found = { yellow: new Set(), poor: new Set(), low: new Set() };
          let over = 0;
          const steps = then ? 1 : Math.min(6, Math.ceil((await pg.evaluate(() => document.documentElement.scrollHeight)) / 844));
          for (let i = 0; i < steps; i++) {
            if (i) {
              await pg.evaluate((y) => window.scrollTo(0, y), i * 700);
              await pg.waitForTimeout(350);
            }
            if (i === 0) await pg.screenshot({ path: path.join(out, `${String(++n).padStart(3, "0")}-${theme}-${name}.png`) });
            await pg.evaluate((css) => {
              const st = document.createElement("style");
              st.id = "zt-bare";
              st.textContent = css;
              document.head.appendChild(st);
            }, BARE);
            await pg.waitForTimeout(60);
            const shot = `data:image/png;base64,${(await pg.screenshot()).toString("base64")}`;
            await pg.evaluate(() => document.getElementById("zt-bare")?.remove());
            const res = await pg.evaluate(AUDIT, shot);
            res.yellow.forEach((x) => found.yellow.add(x));
            res.poor.forEach((x) => found.poor.add(x));
            res.low.forEach((x) => found.low.add(x));
            over = Math.max(over, res.over);
          }
          check(found.yellow.size === 0, `${theme} ${name}: the yellow rule (no yellow text, icon or line on a light ground)`, [...found.yellow].slice(0, 6).join(" ; "));
          check(found.poor.size === 0, `${theme} ${name}: text at 3:1 or better against what's behind it`, [...found.poor].slice(0, 6).join(" ; "));
          for (const l of [...found.low].slice(0, 4)) console.log(`LOW   ${theme} ${name}: ${l}`);
          check(over <= 1, `${theme} ${name}: fits ${width}px`, `${over}px over`);
          const errs = v.errors();
          check(errs.length === 0, `${theme} ${name}: no page errors`, errs.join(" | ").slice(0, 300));
          v.b.errors.length = 0;
        }
        for (const v of browsers.values()) await v.b.close();
      }
      if (!keep) await draftFixture.down(pool);
    }
  } catch (e) {
    console.log("FAIL  the check itself:", e && e.stack ? e.stack.split("\n").slice(0, 4).join(" | ") : e);
    failures++;
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) {
      await pool.query(`DELETE FROM user_settings WHERE user_id IN (SELECT id FROM "user" WHERE username = $1)`, [DESK]).catch(() => {});
      await fixture.down(pool).catch((e) => console.log("down:", e.message));
    }
    await pool.end();
    console.log(failures ? `\n${failures} failed` : "\nall passed");
    process.exitCode = failures ? 1 : 0;
  }
})();
