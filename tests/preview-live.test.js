// A live preview's pass (src/lib/server/preview-live.ts; docs/PLAN-game-preview.md, "On demand"): its story on the preview host gets
// in only with its own preview's signed pass, unexpired; a made-up or another preview's pass gets nothing. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { passFor, livePreviewSeat, livePreviewStory } = jiti("../src/lib/server/preview-live.ts");

test("a pass is the preview's own: the same id and expiry sign the same, any other differs", () => {
  const exp = Date.now() + 60000;
  assert.equal(passFor("a", exp), passFor("a", exp));
  assert.notEqual(passFor("a", exp), passFor("b", exp));
  assert.notEqual(passFor("a", exp), passFor("a", exp + 1));
});

test("no preview, no seat: an unknown preview or a made-up pass is refused, never a sign-in", () => {
  const exp = Date.now() + 60000;
  assert.throws(() => livePreviewSeat("nope", exp, passFor("nope", exp)), /This preview has ended/);
  assert.throws(() => livePreviewStory("nope", exp, "made-up"), /This preview has ended/);
});
