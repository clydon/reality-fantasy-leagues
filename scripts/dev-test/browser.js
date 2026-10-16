// Dev-only test bank: an isolated headless Chromium for checking the UI locally (the Playwright MCP
// browser is often locked by the user's own Chrome). Finds Playwright in the npx cache and the
// newest Chromium it can in ms-playwright, so a Playwright update doesn't break it.
//
//   const { open } = require("./browser");
//   const { page, close } = await open({ user: "zt_tester", pass: "zt-pass-12345", width: 390, height: 844 });
//
// `BASE` (default http://localhost:3000) is the dev server; start it with `npm run dev` first.
const fs = require("fs");
const path = require("path");

const LOCAL = process.env.LOCALAPPDATA;
const BASE = process.env.BASE || "http://localhost:3000";

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

async function open({ user, pass, width = 390, height = 844 } = {}) {
  const browser = await findPlaywright().chromium.launch({ executablePath: findChrome() });
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, isMobile: width < 600 });
  if (user) {
    const r = await context.request.post(BASE + "/api/auth/sign-in/username", { data: { username: user, password: pass }, headers: { origin: BASE } });
    if (!r.ok()) throw new Error("sign-in failed: " + r.status() + " " + (await r.text()));
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { page, errors, BASE, close: () => browser.close() };
}

module.exports = { open, BASE };
