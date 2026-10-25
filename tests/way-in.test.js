// The way in's pure parts (docs/PLAN-new-design.md step 9 part 2): first run's picks kept on the device, where you are
// in words, a username from an email, where signing in goes on to, who gets in, and the new routes. The screens and
// the server are checked in a browser by scripts/dev-test/check-new-way-in.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const W = jiti("../src/new/way-in.ts");
const R = jiti("../src/new/routes.ts");
const S = jiti("../src/lib/signups.ts");

const A = "2f7c1e9a-0000-4000-8000-000000000001";
const B = "2f7c1e9a-0000-4000-8000-000000000002";

test("first run's stored picks: kept a week, cleaned, where you are defaults to nothing seen", () => {
  const now = Date.now();
  const kept = W.parseFirstRun(JSON.stringify({ picked: [A, B, 7], where: { [A]: 3, [B]: -1 }, at: now - 1000 }), now);
  assert.deepEqual(kept.picked, [A, B]);
  assert.deepEqual(kept.where, { [A]: 3, [B]: 0 });
  assert.deepEqual(W.parseFirstRun(JSON.stringify({ picked: [A], where: {}, at: now - 8 * 24 * 3600 * 1000 }), now).picked, []);
  assert.deepEqual(W.parseFirstRun("not json", now).picked, []);
  assert.deepEqual(W.parseFirstRun(null, now).picked, []);
});

test("what first run saves never goes past what's aired", () => {
  const p = { picked: [A, B], where: { [A]: 9, [B]: 2 }, at: 0 };
  const aired = { [A]: 5, [B]: null };
  assert.deepEqual(W.followsOf(p, (id) => aired[id]), [
    { seasonId: A, seenThrough: 5 },
    { seasonId: B, seenThrough: 2 },
  ]);
});

test("where you are, in words", () => {
  const on = { aired: 5, status: "airing", premiere: "2026-09-23" };
  assert.equal(W.whereLabel(on, 0), "Haven't started");
  assert.equal(W.whereLabel(on, 3), "Seen through Episode 3 of 5");
  assert.equal(W.whereLabel(on, 5), "Caught up through Episode 5");
  assert.equal(W.whereLabel({ aired: 0, status: "upcoming", premiere: "2026-11-04" }, 0), "Premieres Nov 4");
  assert.equal(W.whereLabel({ aired: 0, status: "upcoming", premiere: null }, 0), "Premieres soon");
  assert.equal(W.whereLabel({ aired: null, status: "completed", premiere: null }, 4), "Seen through Episode 4");
  assert.equal(W.whereCap(null), 99);
  assert.equal(W.whereCap(5), 5);
});

test("a username from Google's email: the part before the @, as the username plugin takes it", () => {
  assert.equal(W.usernameFrom("Alex.Smith+tv@example.com"), "alex.smithtv");
  assert.equal(W.usernameFrom("al@example.com"), "");
  assert.equal(W.usernameFrom("x".repeat(40)).length, 30);
});

test("signing in goes on to a path of this site only", () => {
  assert.equal(R.safeNext("/join/K7Q2XZ"), "/join/K7Q2XZ");
  assert.equal(R.safeNext("/start/4"), "/start/4");
  for (const bad of ["https://example.invalid/", "//example.invalid", "/\\example.invalid", "/api/me", "/signin?next=/x", "", null, undefined]) assert.equal(R.safeNext(bad), null, String(bad));
  assert.equal(R.paths.signin("/join/K7Q2XZ"), "/signin?next=%2Fjoin%2FK7Q2XZ");
  assert.equal(R.paths.signin(), "/signin");
});

test("the landing and sign-in are the new design's; classic keeps /sign-in", () => {
  assert.ok(R.isNewDesignRoute("/welcome") && R.isNewDesignRoute("/signin"));
  assert.ok(!R.isNewDesignRoute("/sign-in") && !R.isNewDesignRoute("/"));
  assert.equal(R.depthOf("/welcome"), 0);
  assert.equal(R.depthOf("/signin"), 1);
});

test("who gets in: unset means invites let people in; a bad value waits for an admin; invites and open let invites in", () => {
  assert.equal(S.signupModeOf(undefined), "invites");
  assert.equal(S.signupModeOf(null), "invites");
  assert.equal(S.signupModeOf("approve"), "approve");
  assert.equal(S.signupModeOf("everyone"), "approve");
  assert.equal(S.signupModeOf("invites"), "invites");
  assert.equal(S.signupModeOf("open"), "open");
  assert.ok(!S.invitesLetIn("approve") && S.invitesLetIn("invites") && S.invitesLetIn("open"));
});
