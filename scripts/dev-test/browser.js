// Dev-only test bank: an isolated headless Chromium for checking the UI locally (the Playwright MCP
// browser is often locked by the user's own Chrome). Finds Playwright in the npx cache and the
// newest Chromium it can in ms-playwright, so a Playwright update doesn't break it.
//
//   const { open } = require("./browser");
//   const { page, close } = await open({ user: "zt_tester", pass: "zt-pass-12345", width: 390, height: 844 });
//
// `motion: "on" | "off" | "reduce"` (or MOTION=...) and `watch: true` (or MOTION_WATCH=1) control and record
// animation in the page: see motion.js. Default on, as users see it.
//
// `BASE` (default http://localhost:3000) is the dev server; start it with `npm run dev` first.
const fs = require("fs");
const path = require("path");

const LOCAL = process.env.LOCALAPPDATA;
const BASE = process.env.BASE || "http://localhost:3000";
const motionTools = require("./motion");

function findPlaywright() {
  const npx = path.join(LOCAL, "npm-cache", "_npx");
  for (const d of fs.readdirSync(npx)) {
    const p = path.join(npx, d, "node_modules", "playwright");
    if (fs.existsSync(p)) return require(p);
  }
  throw new Error("playwright not in the npx cache: run `npx playwright --version` once");
}

function findChrome() {
  const root = path.join(LOCAL, "ms-playwright");
  const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => parseInt(b.slice(9)) - parseInt(a.slice(9)));
  for (const d of dirs) {
    const exe = path.join(root, d, "chrome-win64", "chrome.exe");
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error("no Chromium under " + root);
}

// `headers` go with every request the page makes (a check's stand-ins: { "x-gys-listings": tv.url }, fake-listings.js).
async function open({ user, pass, width = 390, height = 844, motion = process.env.MOTION || "on", watch = !!process.env.MOTION_WATCH, headers } = {}) {
  const browser = await findPlaywright().chromium.launch({ executablePath: findChrome() });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: width < 600,
    reducedMotion: motion === "reduce" ? "reduce" : "no-preference",
  });
  await motionTools.install(context, { mode: motion, watch });
  if (headers) await context.setExtraHTTPHeaders(headers);
  if (user) {
    const r = await context.request.post(BASE + "/api/auth/sign-in/username", { data: { username: user, password: pass }, headers: { origin: BASE } });
    if (!r.ok()) throw new Error("sign-in failed: " + r.status() + " " + (await r.text()));
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { page, errors, BASE, close: () => browser.close(), settle: () => motionTools.settle(page), motion: motionTools.motionApi(page) };
}

// The API as one signed-in user, without a browser: for checks that only need the routes (claims,
// moves, refusals). `call` resolves { status, body } and never throws on an HTTP error, so a check can
// assert a refusal as easily as a success.
//
//   const { api } = require("./browser");
//   const sam = await api({ user: "zt_wplayer", pass: "zt-pass-12345" });
//   const { status, body } = await sam.call("PUT", `/api/leagues/${id}/waivers/claims`, { pickupIds: [] });
// `headers` go with every call (a check's stand-in bot: { "x-gys-bot": bot.url }, fake-bot.js).
async function api({ user, pass, headers = {} }) {
  const r = await fetch(BASE + "/api/auth/sign-in/username", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (!r.ok) throw new Error(`sign-in as ${user} failed: ${r.status} ${await r.text()}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  async function call(method, url, body) {
    const res = await fetch(BASE + url, {
      method,
      headers: { cookie, origin: BASE, ...headers, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* not JSON: keep the text */ }
    return { status: res.status, body: parsed };
  }
  return { user, call };
}

module.exports = { open, api, BASE };
