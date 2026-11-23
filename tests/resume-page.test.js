// Reopening the installed app where you left off (src/lib/resume-page.ts): what's remembered for a page, and the <head>
// script that sends a fresh launch back to it, run here in a made-up window. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const vm = require("node:vm");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const R = jiti("../src/lib/resume-page.ts");

const S = "/show/2f7c1e9a-0000-4000-8000-000000000001";
const HOUR = 60 * 60 * 1000;

test("a page is remembered with its query, less a reveal or Make it a game", () => {
  assert.equal(R.pathToRemember(`${S}/chat`, ""), `${S}/chat`);
  assert.equal(R.pathToRemember(`${S}/games`, "?game=abc&ep=3"), `${S}/games?game=abc&ep=3`);
  assert.equal(R.pathToRemember(`${S}/tonight`, "?page=watch&ep=4"), `${S}/tonight?page=watch&ep=4`);
  assert.equal(R.pathToRemember(`${S}/tonight`, "?page=reveal&ep=4"), `${S}/tonight`);
  assert.equal(R.pathToRemember(`${S}/games`, "?page=make&then=start"), `${S}/games`);
  assert.equal(R.pathToRemember("//evil.example", ""), null);
});

// Runs the boot script in a window made of the given parts; answers where it went (null: it stayed).
function launch({ at = "/home", search = "", standalone = true, launched = false, reload = false, saved, now = 10 * HOUR } = {}) {
  const session = new Map(launched ? [[R.RESUME_LAUNCHED_KEY, "1"]] : []);
  const local = new Map(saved === undefined ? [] : [[R.RESUME_KEY, JSON.stringify(saved)]]);
  let went = null;
  const store = (m) => ({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) });
  const ctx = {
    sessionStorage: store(session),
    localStorage: store(local),
    navigator: {},
    performance: { getEntriesByType: () => [{ type: reload ? "reload" : "navigate" }] },
    location: { pathname: at, search, replace: (p) => (went = p) },
    document: { documentElement: { style: {} } },
    Date: { now: () => now },
    JSON,
  };
  ctx.window = { matchMedia: () => ({ matches: standalone }) };
  vm.runInNewContext(R.RESUME_BOOT_SCRIPT, ctx);
  return { went, launched: session.get(R.RESUME_LAUNCHED_KEY) };
}

const recent = (p, ago = HOUR) => ({ userId: "u1", path: p, at: 10 * HOUR - ago });

test("a launch at the start URL goes back to the page you left within six hours", () => {
  assert.equal(launch({ saved: recent(`${S}/chat`) }).went, `${S}/chat`);
  assert.equal(launch({ at: "/", saved: recent(`${S}/games?game=abc`) }).went, `${S}/games?game=abc`);
  assert.equal(launch({ saved: recent(`${S}/chat`, 5.9 * HOUR) }).went, `${S}/chat`);
});

test("after six hours, Home", () => {
  assert.equal(launch({ saved: recent(`${S}/chat`, 6.1 * HOUR) }).went, null);
});

test("only a fresh launch of the installed app, at the start URL", () => {
  const saved = recent(`${S}/chat`);
  assert.equal(launch({ saved, standalone: false }).went, null, "a browser tab");
  assert.equal(launch({ saved, launched: true }).went, null, "already launched");
  assert.equal(launch({ saved, reload: true }).went, null, "a reload");
  assert.equal(launch({ saved, search: "?from=push" }).went, null, "a link with a query");
  assert.equal(launch({ saved, at: `${S}/tonight` }).went, null, "a notification's own page");
  assert.equal(launch({ saved, standalone: false }).launched, "1", "marked launched either way");
});

test("nothing remembered, Home remembered, or an address off the site: stays", () => {
  assert.equal(launch({}).went, null);
  assert.equal(launch({ saved: recent("/home") }).went, null);
  assert.equal(launch({ saved: recent("//evil.example") }).went, null);
  assert.equal(launch({ saved: recent("/\\evil.example") }).went, null);
  assert.equal(launch({ saved: { path: 3 } }).went, null);
});
