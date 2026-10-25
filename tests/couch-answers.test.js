// A couch's own moments, settled (src/lib/game/couch-answers.ts, docs/PLAN-new-design.md step 6b part 3): whoever runs
// the games settles it alone, two people agreeing otherwise, one waits. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { settleCouchMoment } = jiti("../src/lib/game/couch-answers.ts");

const a = (userId, picks, at, runs = false) => ({ userId, runs, picks, at });

test("one person's tick waits for a second", () => {
  const r = settleCouchMoment([a("jordan", [{ name: "Eric" }], 1)], "yesNo");
  assert.equal(r.by, null);
  assert.deepEqual(r.settled, []);
  assert.deepEqual(r.waiting, [{ name: "Eric", votes: 1 }]);
});

test("two people agreeing settle a name; the rest waits", () => {
  const r = settleCouchMoment([a("jordan", [{ name: "Eric" }], 1), a("sam", [{ name: "Eric" }, { name: "Danny" }], 2)], "yesNo");
  assert.equal(r.by, "agreed");
  assert.deepEqual(r.settled, [{ name: "Eric" }]);
  assert.deepEqual(r.waiting, [{ name: "Danny", votes: 1 }]);
});

test("whoever runs the games settles it on their own, nobody included", () => {
  const r = settleCouchMoment([a("jordan", [{ name: "Eric" }], 1), a("sam", [{ name: "Eric" }], 2), a("alex", [], 3, true)], "yesNo");
  assert.equal(r.by, "runner");
  assert.deepEqual(r.settled, []);
  assert.deepEqual(r.waiting, []);
});

test("a count goes by what most agreeing people said, the lower on a tie; once is no count", () => {
  const each = (n) => [{ name: "Eric", times: n }];
  assert.deepEqual(settleCouchMoment([a("j", each(2), 1), a("s", each(2), 2), a("r", each(3), 3)], "eachTime").settled, [{ name: "Eric", times: 2 }]);
  assert.deepEqual(settleCouchMoment([a("j", each(3), 1), a("s", each(2), 2)], "eachTime").settled, [{ name: "Eric", times: 2 }]);
  assert.deepEqual(settleCouchMoment([a("j", each(1), 1), a("s", each(1), 2)], "eachTime").settled, [{ name: "Eric" }]);
  assert.deepEqual(settleCouchMoment([a("j", each(3), 1), a("s", each(3), 2)], "yesNo").settled, [{ name: "Eric" }], "a yes-or-no moment has no count");
});

test("two people saying nobody did it settle it as nobody", () => {
  const r = settleCouchMoment([a("jordan", [], 1), a("sam", [], 2)], "yesNo");
  assert.equal(r.by, "agreed");
  assert.deepEqual(r.settled, []);
});
