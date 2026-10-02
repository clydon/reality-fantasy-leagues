// Who sees which "What's New" releases (src/lib/whats-new.ts). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { RELEASES, unseenItems } = jiti("../src/lib/whats-new.ts");

const OLD_ACCOUNT = "2026-09-01T00:00:00Z";
const all = RELEASES.flatMap((r) => r.items).length;

test("someone who saw nothing gets every release; someone a release behind gets just the newer ones", () => {
  assert.equal(unseenItems(null, OLD_ACCOUNT).length, all);
  assert.deepEqual(unseenItems(RELEASES[1].id, OLD_ACCOUNT), RELEASES[0].items);
  assert.deepEqual(unseenItems(RELEASES[0].id, OLD_ACCOUNT), []);
});

test("an account made after a release isn't told it's new", () => {
  assert.deepEqual(unseenItems(null, "2027-01-01T00:00:00Z"), []);
});
