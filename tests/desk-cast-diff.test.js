// What a cast answer changes (src/lib/desk-cast-diff.ts, docs/PLAN-desk-parity.md part 5a): exact names match, a new spelling
// is a same-person guess, a group the answer has differently is a change only where it names one, someone new joins, someone
// no longer listed is only said, and a locked castaway is never changed by an answer.
const test = require("node:test");
const assert = require("node:assert");
const D = require("../src/lib/desk-cast-diff.ts");

const ours = [
  { id: "a", name: "Thien An Nguyen", group: "Toka", locked: false },
  { id: "b", name: "Carter Lewis", group: "Savu", locked: false },
  { id: "c", name: "Brady Hill", group: "Toka", locked: false },
  { id: "d", name: "Matt Jones", group: "Savu", locked: false },
  { id: "e", name: "Ana Ruiz", group: "Savu", locked: true },
];
const t = (name, group = null, photo = null) => ({ name, group, photo });

test("an answer the same as the cast changes nothing", () => {
  assert.deepStrictEqual(D.castChanges(ours, ours.map((c) => t(c.name.toUpperCase(), c.group)), { groups: true }), []);
});

test("a new spelling, a group, someone new, someone not listed", () => {
  const ch = D.castChanges(ours, [t("Thien-An Nguyen", "Toka"), t("Carter Lewis", "Toka"), t("Brady Hill"), t("Matthew Jones", "Savu"), t("Ana Ruiz", "Toka"), t("Zoe New", "Savu", "https://x/z.jpg")], { groups: true });
  const by = (k) => ch.filter((c) => c.k === k);
  assert.deepStrictEqual(by("spell").map((c) => [c.id, c.to]), [["a", "Thien-An Nguyen"], ["d", "Matthew Jones"]]);
  // Brady's empty group says nothing; Ana is locked.
  assert.deepStrictEqual(by("group").map((c) => [c.id, c.from, c.to]), [["b", "Savu", "Toka"]]);
  assert.deepStrictEqual(by("add").map((c) => [c.name, c.group, c.photo]), [["Zoe New", "Savu", "https://x/z.jpg"]]);
  assert.deepStrictEqual(by("gone"), []);
  assert.strictEqual(D.changesLine(ch, { group: "tribe", groups: "tribes" }), "2 new spellings, 1 starting tribe, 1 new");
});

test("someone not listed is said, not taken out; without groups a group is never a change", () => {
  const ch = D.castChanges(ours, [t("Thien An Nguyen", "Savu"), t("Carter Lewis"), t("Brady Hill"), t("Matt Jones")], { groups: false });
  assert.deepStrictEqual(ch.map((c) => [c.k, c.name]), [["gone", "Ana Ruiz"]]);
  assert.deepStrictEqual(D.castPlan(ch), { rename: [], add: [], regroup: [] });
});

test("a stranger isn't a spelling of anyone", () => {
  const ch = D.castChanges(ours.slice(0, 1), [t("Bob Smith")], { groups: true });
  assert.deepStrictEqual(ch.map((c) => c.k), ["add", "gone"]);
});

test("a short name is never a spelling of another; nor is a first name much longer", () => {
  const two = [
    { id: "b", name: "Ben", group: null, locked: false },
    { id: "c", name: "Chris Smith", group: null, locked: false },
  ];
  const ch = D.castChanges(two, [t("Ben"), t("Jen"), t("Chris Smith"), t("Christine Smith")], { groups: true });
  assert.deepStrictEqual(ch.map((c) => [c.k, c.name]), [["add", "Jen"], ["add", "Christine Smith"]]);
  const m = D.castChanges([{ id: "m", name: "Matt Jones", group: null, locked: false }], [t("Matthew Jones")], { groups: true });
  assert.deepStrictEqual(m.map((c) => c.k), ["spell"]);
});

test("the closest spelling wins, one match each", () => {
  const two = [
    { id: "x", name: "Jon Smith", group: null, locked: false },
    { id: "y", name: "John Smyth", group: null, locked: false },
  ];
  const ch = D.castChanges(two, [t("John Smith"), t("Jon Smith")], { groups: true });
  assert.deepStrictEqual(ch.map((c) => [c.k, c.id, c.to]), [["spell", "y", "John Smith"]]);
});

test("the plan: Same person renames, Someone new joins, Use theirs regroups, Keep ours does nothing", () => {
  const ch = D.castChanges(ours, [t("Thien-An Nguyen"), t("Carter Lewis", "Toka"), t("Brady Hill"), t("Matt Jones"), t("Ana Ruiz"), t("Zoe New")], { groups: true });
  assert.deepStrictEqual(D.castPlan(ch), { rename: [{ id: "a", from: "Thien An Nguyen", to: "Thien-An Nguyen" }], add: [{ name: "Zoe New", group: null, photo: null }], regroup: [] });
  const p = D.castPlan(ch, { "spell:a": "new", "group:b": "theirs" });
  assert.deepStrictEqual(p.rename, []);
  assert.deepStrictEqual(p.add.map((a) => a.name), ["Thien-An Nguyen", "Zoe New"]);
  assert.deepStrictEqual(p.regroup, [{ id: "b", name: "Carter Lewis", from: "Savu", to: "Toka" }]);
});
