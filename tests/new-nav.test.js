// The new design's shell, its pure parts (docs/PLAN-new-design.md step 0c): which routes are the new design's, which
// way the screen moves between them (src/new/routes.ts, the mock's nav.js rules), and calm clocks (src/new/clock.ts).
// The motion itself is checked in a browser by scripts/dev-test/check-new-shell.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const R = jiti("../src/new/routes.ts");
const C = jiti("../src/new/clock.ts");

const S = "/show/2f7c1e9a-0000-4000-8000-000000000001";

test("the new design owns its own paths and nothing of classic's", () => {
  for (const p of ["/home", `${S}/tonight`, `${S}/backstage/rules`, "/settings", "/start/2", "/join/K7Q2XZ"]) assert.ok(R.isNewDesignRoute(p), p);
  for (const p of ["/", "/account", "/waivers", "/setup/rules", "/admin", "/homework", "/showcase", "/sign-in"]) assert.ok(!R.isNewDesignRoute(p), p);
});

test("depth: the hub, a show's tabs, pages pushed over a show, Backstage's own pages", () => {
  assert.equal(R.depthOf("/home"), 0);
  assert.equal(R.depthOf(`${S}/cast`), 1);
  assert.equal(R.depthOf(`${S}/backstage`), 2);
  assert.equal(R.depthOf(`${S}/draft?x=1`), 2);
  assert.equal(R.depthOf(`${S}/backstage/members`), 3);
  assert.equal(R.depthOf("/settings"), 1);
});

test("a show's tabs slide by tab order; the same tab is a crossfade", () => {
  assert.equal(R.navKind(`${S}/tonight`, `${S}/episodes`), "left");
  assert.equal(R.navKind(`${S}/chat`, `${S}/games`), "right");
  assert.equal(R.navKind(`${S}/cast`, `${S}/cast`), "fade");
  // Another show's tab isn't a tab move.
  assert.equal(R.navKind(`${S}/cast`, "/show/other/cast"), "fade");
});

test("deeper pushes, shallower pops; first run by its steps", () => {
  assert.equal(R.navKind(`${S}/tonight`, `${S}/backstage`), "push");
  assert.equal(R.navKind(`${S}/backstage`, `${S}/backstage/results`), "push");
  assert.equal(R.navKind(`${S}/backstage/results`, `${S}/backstage`), "pop");
  assert.equal(R.navKind(`${S}/backstage`, `${S}/episodes`), "pop");
  assert.equal(R.navKind("/home", "/settings"), "push");
  assert.equal(R.navKind("/start/1", "/start/2"), "push");
  assert.equal(R.navKind("/start/3", "/start/2"), "pop");
});

test("the hub and a show: the channel change when there's art to grow, and always on the way back", () => {
  assert.equal(R.navKind("/home", `${S}/tonight`, { channel: true }), "channel");
  assert.equal(R.navKind("/home", `${S}/tonight`), "push");
  assert.equal(R.navKind(`${S}/episodes`, "/home"), "channel");
  assert.equal(R.navKind(`${S}/backstage`, "/home"), "pop");
});

test("up from a page: where its own Back leads, on up to the hub (the phone's back, components/phone-back.tsx)", () => {
  assert.equal(R.upFrom("/home"), null);
  assert.equal(R.upFrom("/welcome"), null);
  for (const tab of R.SHOW_TABS) assert.equal(R.upFrom(`${S}/${tab}`), "/home", tab);
  assert.equal(R.upFrom(S), "/home");
  for (const p of ["draft", "blind", "waivers"]) assert.equal(R.upFrom(`${S}/${p}`), `${S}/tonight`, p);
  assert.equal(R.upFrom(`${S}/backstage`), `${S}/tonight`);
  assert.equal(R.upFrom(`${S}/backstage/results`), `${S}/backstage`);
  assert.equal(R.upFrom(`${S}/backstage/history`), `${S}/tonight`);
  // A page pushed over the screen closes to the screen under it, its own params and all.
  assert.equal(R.upFrom(`${S}/tonight?page=watch&ep=3`), `${S}/tonight`);
  assert.equal(R.upFrom("/home?page=how"), "/home");
  assert.equal(R.upFrom("/settings"), "/home");
  assert.equal(R.upFrom("/join/K7Q2XZ"), "/home");
  assert.equal(R.upFrom("/start/3"), "/start/2");
  assert.equal(R.upFrom("/start/1"), "/home");
  assert.equal(R.upFrom("/desk"), "/home");
  assert.equal(R.upFrom("/desk/find"), "/home");
  assert.equal(R.upFrom("/desk/library"), "/desk/find");
  assert.equal(R.upFrom("/desk/new?season=abc"), "/desk/library");
  assert.equal(R.upFrom("/desk/fact/42"), "/desk");
  assert.equal(R.upFrom("/desk/castaway/7"), "/desk/find");
  // Signed out, the top is the landing.
  assert.equal(R.upFrom("/signin"), "/welcome");
  assert.equal(R.upFrom("/start/1", { signedIn: false }), "/welcome");
  assert.equal(R.upFrom("/join/K7Q2XZ", { signedIn: false }), "/welcome");
});

test("reduced motion: every move is the calm crossfade", () => {
  assert.equal(R.navKind("/home", `${S}/tonight`, { channel: true, reducedMotion: true }), "calm");
  assert.equal(R.navKind(`${S}/tonight`, `${S}/cast`, { reducedMotion: true }), "calm");
});

test("calm clocks: days when it's more than a day out, a ticking countdown inside the last day", () => {
  const now = new Date(2026, 9, 24, 12, 0, 0).getTime(); // a Saturday noon, local time
  const at = (d, h, m = 0, s = 0) => new Date(2026, 9, 24 + d, h, m, s).getTime();
  assert.equal(C.calm(at(4, 20, 5), now), "in 4 days");
  assert.equal(C.calm(at(2, 9), now), "in 2 days");
  // More than a day away but tomorrow's date.
  assert.equal(C.calm(at(1, 20), now), "tomorrow");
  assert.ok(!C.ticks(at(1, 20), now));
  // Inside the last day it ticks, tomorrow or not.
  assert.ok(C.ticks(at(1, 9), now));
  assert.equal(C.calm(at(1, 9), now), "21:00:00");
  assert.equal(C.calm(at(0, 12, 12, 5), now), "12:05");
  assert.equal(C.calm(at(0, 15, 4, 9), now), "3:04:09");
  assert.equal(C.calm(now - 1000, now), "now");
  assert.equal(C.calmWhen(at(4, 20, 5), now), "Wed 8:05 PM · in 4 days");
});
