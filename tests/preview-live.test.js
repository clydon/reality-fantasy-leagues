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

test("the live tier writes a local database, or the preview service's marked one, and never the app's", async () => {
  const { _guard } = require("../tools/gameplay-bench/live-db.cjs");
  const local = "postgres://u:p@localhost:5432/rfl", remote = "postgres://u:p@ep-preview.example.neon.tech/db", app = "postgres://u:p@ep-app.example.neon.tech/db";
  assert.equal(_guard.allowed(local, {}), "local");
  assert.throws(() => _guard.allowed(remote, {}), /local database only/);
  assert.equal(_guard.allowed(remote, { PREVIEW_SERVICE: "1" }), "service");
  // The app's own database by its host, whatever the flag says.
  assert.throws(() => _guard.allowed(app, { PREVIEW_SERVICE: "1", APP_DATABASE_HOSTS: "ep-other.example.neon.tech, EP-APP.example.neon.tech" }), /never writes to the app's database/);
  // And a service's database must say it's a preview database.
  const said = (value) => ({ query: async () => ({ rows: value === undefined ? [] : [{ value }] }) });
  await assert.rejects(_guard.marked(said(undefined)), /marked as a preview database/);
  await assert.rejects(_guard.marked(said(false)), /marked as a preview database/);
  await _guard.marked(said(true));
});
