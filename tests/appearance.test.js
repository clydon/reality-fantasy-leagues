// Appearance and Lock it down, the pure halves (docs/PLAN-new-design.md step 15 part 4): the boot script that draws a page in its
// theme before the first paint (src/lib/theme-script.ts: the new design's account theme from this device's cookie, classic's own
// per-browser choice everywhere else), the cookie's reading (src/lib/appearance.ts), a game colour as text (src/new/games.ts), and
// the engine's competitive mode (GhostLogic.lockedDown: nobody new joins, and Who can join comes back as it was). Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { THEME_BOOT_SCRIPT } = jiti("../src/lib/theme-script.ts");
const A = jiti("../src/lib/appearance.ts");
const { gameInk, inkOf } = jiti("../src/new/games.ts");
const StateLogic = require("../src/lib/game/state-logic.js");
const { GhostLogic } = StateLogic;

/** Runs the boot script as the browser would, before anything else: what it leaves on <html>. */
function boot({ path: p, cookie = "", stored = null, phoneDark = false }) {
  const classes = new Set();
  const attrs = {};
  const document = { documentElement: { classList: { add: (c) => classes.add(c) }, setAttribute: (k, v) => (attrs[k] = v) }, cookie };
  const window = { matchMedia: () => ({ matches: phoneDark }) };
  new Function("document", "window", "location", "localStorage", THEME_BOOT_SCRIPT)(document, window, { pathname: p }, { getItem: () => stored });
  return { dark: classes.has("dark"), theme: attrs["data-nd-theme"] ?? null };
}

test("the new design's pages: Night unless this device's cookie says Studio, or Match phone and the phone is light", () => {
  assert.deepEqual(boot({ path: "/home" }), { dark: true, theme: "night" }, "no cookie: Night, as it's always been");
  assert.deepEqual(boot({ path: "/home", cookie: "gys_theme=studio" }), { dark: false, theme: "studio" });
  assert.deepEqual(boot({ path: "/show/abc/tonight", cookie: "a=1; gys_theme=phone", phoneDark: true }), { dark: true, theme: "phone" });
  assert.deepEqual(boot({ path: "/show/abc/tonight", cookie: "a=1; gys_theme=phone", phoneDark: false }), { dark: false, theme: "phone" });
  assert.deepEqual(boot({ path: "/settings", cookie: "gys_theme=sepia" }), { dark: true, theme: "night" }, "a theme we don't have reads as Night");
  for (const p of ["/welcome", "/signin", "/start/2", "/join/ABC123", "/desk/find"]) assert.equal(boot({ path: p, cookie: "gys_theme=studio" }).theme, "studio", p);
});

test("classic's pages keep classic's own choice, whatever the new design's cookie says", () => {
  assert.deepEqual(boot({ path: "/", cookie: "gys_theme=studio", stored: "dark" }), { dark: true, theme: null });
  assert.deepEqual(boot({ path: "/account", cookie: "gys_theme=night", stored: null }), { dark: false, theme: null }, "classic's default is light");
  assert.deepEqual(boot({ path: "/account", stored: "system", phoneDark: true }), { dark: true, theme: null });
  assert.deepEqual(boot({ path: "/homes", cookie: "gys_theme=night" }), { dark: false, theme: null }, "only the new design's own routes (not /homes)");
});

test("the cookie, read on either side: Night unless it names a theme we have", () => {
  assert.equal(A.themeFromCookies("gys_theme=studio"), "studio");
  assert.equal(A.themeFromCookies("x=1;  gys_theme=phone; y=2"), "phone");
  assert.equal(A.themeFromCookies("my_gys_theme=studio"), "night", "another cookie that ends the same isn't it");
  assert.equal(A.themeFromCookies(""), "night");
  assert.equal(A.themeFromCookies(null), "night");
  assert.deepEqual(A.THEMES, ["night", "studio", "phone"]);
  assert.ok(A.isTheme("studio") && !A.isTheme("light") && !A.isTheme(null));
});

test("a game's colour as text: mixed with the ink by --nd-ink-mix (62% on Studio, all of it on Night)", () => {
  assert.equal(gameInk("Outlast"), "color-mix(in oklab, #f2804b var(--nd-ink-mix, 100%), var(--foreground))");
  assert.equal(gameInk("Something new"), "var(--muted-foreground)");
  assert.equal(inkOf("var(--good)"), "color-mix(in oklab, var(--good) var(--nd-ink-mix, 100%), var(--foreground))");
});

function shared(settings = {}) {
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", ownershipMode: "shared", activeSlots: 1, benchSlots: 1, showFormat: "survivor", ...settings },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: [{ id: "a", name: "A", ownerIds: ["p1"], status: "active" }],
    episodes: [],
  });
}

test("Lock it down: nobody new joins (both designs ask allowed), and turning it off leaves Who can join as it was", () => {
  const s = shared({ joinMode: "ask" });
  assert.equal(GhostLogic.lockedDown(s), false);
  assert.equal(GhostLogic.joinMode(s), "ask");
  StateLogic.updateSettings(s, "lockedDown", true);
  assert.equal(s.settings.lockedDown, true);
  assert.equal(GhostLogic.lockedDown(s), true);
  assert.equal(GhostLogic.allowed(s), false, "classic's join code sees it closed too");
  assert.equal(GhostLogic.joinMode(s), "locked");
  assert.equal(s.settings.allowLateJoiners, undefined, "classic's own switch isn't touched");
  StateLogic.updateSettings(s, "lockedDown", false);
  assert.equal(GhostLogic.joinMode(s), "ask", "back to what Who can join said");
  assert.equal(GhostLogic.allowed(s), true);
  StateLogic.updateSettings(s, "lockedDown", "yes");
  assert.equal(s.settings.lockedDown, false, "only true locks it down");
  const open = shared();
  assert.equal(GhostLogic.joinMode(open), "open");
  StateLogic.updateSettings(open, "lockedDown", true);
  assert.equal(GhostLogic.joinMode(open), "locked", "an open game too");
});
