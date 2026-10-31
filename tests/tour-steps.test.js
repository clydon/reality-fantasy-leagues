// The first-time tour's step list (src/new/tour/steps.ts, docs/PLAN-first-time-tour.md): the couch first, then the game, then
// what brings you back; solo players get the couch pitched and no Couch points; the reminders step only while this phone could
// start getting them. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { tourSteps } = jiti("../src/new/tour/steps.ts");

const ids = (steps) => steps.map((s) => s.id);

test("a couch member: nine steps, couch first, reminders last", () => {
  const steps = tourSteps({ solo: false, reminders: "off" });
  assert.deepEqual(ids(steps), ["couch", "add", "theirs", "invite", "move", "reveal", "show", "points", "remind"]);
  assert.equal(steps[0].targets[0], "[data-guide]");
  assert.equal(steps.at(-1).line, "We'll remind you before your moves lock.");
});

test("reminders already on this phone (or blocked, or unsupported): no reminders step", () => {
  assert.deepEqual(ids(tourSteps({ solo: false, reminders: null })), ["couch", "add", "theirs", "invite", "move", "reveal", "show", "points"]);
});

test("an iPhone outside the Home Screen app: the reminders step says to add it first", () => {
  const last = tourSteps({ solo: false, reminders: "install" }).at(-1);
  assert.equal(last.id, "remind");
  assert.match(last.line, /Home Screen/);
});

test("solo: the couch pitched, no Couch points", () => {
  const steps = tourSteps({ solo: true, reminders: "off" });
  assert.deepEqual(ids(steps), ["couch", "add", "theirs", "invite", "move", "reveal", "show", "remind"]);
  const by = Object.fromEntries(steps.map((s) => [s.id, s]));
  assert.equal(by.couch.line, "A couch is your people. See what they watch.");
  assert.deepEqual(by.theirs.targets, []);
  assert.equal(by.invite.line, "Start a couch, or join one with a code.");
  assert.equal(by.invite.targets[0], "[data-solo-start-couch]");
});

test("every line is short, and every step but the last has somewhere to look or an example of its own", () => {
  for (const solo of [false, true]) {
    for (const s of tourSteps({ solo, reminders: "off" })) {
      assert.ok(s.line.split(/\s+/).length <= 10, `${s.id}: "${s.line}" is over ten words`);
      assert.ok(s.title.length <= 24, `${s.id}: title "${s.title}" is long`);
    }
  }
});
