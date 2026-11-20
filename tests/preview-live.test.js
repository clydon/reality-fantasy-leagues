// A live preview's keys (src/lib/server/preview-live.ts; docs/PLAN-preview-release.md, steps 3 and 4): whose a preview is is kept as
// an opaque key, never the person's id; a way in is kept as its hash; and the server mints a session only for a preview's made-up
// people (src/lib/preview-session.ts). The flow itself (a way in used once, a stranger refused) is the end-to-end check's:
// scripts/dev-test/preview-live-check.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { ownerKey, tokenHash } = jiti("../src/lib/server/preview-live.ts");
const { PREVIEW_USER } = jiti("../src/lib/preview-session.ts");

test("whose a preview is: the same person the same key, another person another, and never their id", () => {
  assert.equal(ownerKey("user-1"), ownerKey("user-1"));
  assert.notEqual(ownerKey("user-1"), ownerKey("user-2"));
  assert.ok(!ownerKey("user-1").includes("user-1"));
});

test("a way in is kept as its hash: the token itself is never stored", () => {
  const t = "a-token";
  assert.equal(tokenHash(t), tokenHash(t));
  assert.notEqual(tokenHash(t), t);
  assert.notEqual(tokenHash(t), tokenHash("b-token"));
});

test("a minted session is only ever a preview's made-up person", () => {
  for (const ok of ["alex_ztgb4405c3a71", "riley_ztgb0a1b2c3d12"]) assert.match(ok, PREVIEW_USER);
  for (const no of ["alex", "zt_pv_1234abcd", "alex_ztgb", "alex_ztgb4405c3a7", "admin", "alex_ztgb4405c3a71x", "a b_ztgb4405c3a71"]) assert.doesNotMatch(no, PREVIEW_USER);
});
