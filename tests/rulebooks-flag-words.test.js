// The rulebooks flag's check in words (docs/PLAN-desk-parity.md part 7c; src/lib/rulebooks-flag-words.ts): which leagues
// score the same on their season's rulebook, which stay on built-in rules and why, and which would score differently.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { tallyOf, whyDiffers, whyStays } = jiti("../src/lib/rulebooks-flag-words.ts");

test("a league written and scoring the same counts as the same; one not written stays, with why", () => {
  const t = tallyOf([
    { id: "a", written: true, same: true, rules: true },
    { id: "b", written: true, same: true, rules: true },
    { id: "c", written: false, reason: "no show picked" },
    { id: "d", written: false, mismatch: "Survivor (research, survivor) isn't what the league plays by (league, x)" },
  ]);
  assert.equal(t.same, 2);
  assert.deepEqual(t.stay, [
    { id: "c", why: "No show picked" },
    { id: "d", why: "It plays by rules of its own, not its season's rulebook" },
  ]);
  assert.deepEqual(t.differ, []);
});

test("a league written that scores differently, or by other rules, differs (and never counts as the same)", () => {
  const t = tallyOf([
    { id: "a", written: true, same: false, rules: true, differs: ["scores", "events"] },
    { id: "b", written: true, same: true, rules: false, differs: [] },
  ]);
  assert.equal(t.same, 0);
  assert.deepEqual(t.differ, [
    { id: "a", why: "On its rulebook, its standings and its episodes' points would change" },
    { id: "b", why: "Its rulebook's rules aren't the ones it plays by" },
  ]);
});

test("a deleted league isn't in the tally, whatever it found", () => {
  const t = tallyOf([
    { id: "a", written: true, same: true, rules: true },
    { id: "b", deleted: true, written: true, same: false, rules: true, differs: ["scores"] },
    { id: "c", deleted: true, written: false, reason: "no show picked" },
  ]);
  assert.deepEqual(t, { same: 1, stay: [], differ: [] });
});

test("each reason is said plainly", () => {
  assert.equal(whyStays({ reason: "its season isn't in the catalog" }), "Its season isn't in the catalog");
  assert.equal(whyStays({ reason: "its rulebook has no compiled rules" }), "Its rulebook has no rules yet");
  assert.equal(whyStays({ reason: "something new" }), "Something new");
  assert.equal(whyDiffers({ differs: ["ended", "winner", "catalog"] }), "On its rulebook, when its season ends, its winner and what scores would change");
  assert.equal(whyDiffers({ differs: ["exits"] }), "On its rulebook, how people leave would change");
});
