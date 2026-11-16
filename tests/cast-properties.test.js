// Cast properties in a rulebook (docs/PLAN-cast-properties.md, chunk 1): what else a show sorts its people by, in the
// rulebook's cast block. The schema checks a property's shape and the allowed-kinds rule (decided item 1: only what the show
// bills or splits by; never ethnicity, religion, sexuality, health or age; a secret role is a twist), research's prompt asks
// for them, and its review tidies an answer's without changing what it says. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/formats/rulebook-schema.js");
const R = require("../src/lib/game/formats/rulebook-research.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");

const clone = (x) => JSON.parse(JSON.stringify(x));
const belowDeck = () => clone(LIBRARY["below-deck"].blocks);
const withProps = (props, base = belowDeck()) => {
  base.cast = { ...base.cast, properties: props };
  return base;
};
const propProblems = (b) => S.blocksProblems(b).filter((p) => p.at.startsWith("cast.properties"));
const dept = { key: "department", name: "Department", values: ["Interior", "Deck", "Galley", "Bridge"], changes: "sometimes" };
const job = { key: "job", name: "Job", values: null, changes: "sometimes", main: true, of: "department" };

test("the library's Below Deck and The Challenge carry their properties, and validate", () => {
  const bd = belowDeck();
  assert.deepEqual(S.castProperties(bd).map((p) => p.key), ["department", "job"]);
  assert.equal(S.mainProperty(bd).key, "job");
  assert.deepEqual(S.blocksProblems(bd), []);
  const ch = BUILT_IN_BLOCKS.challenge.blocks;
  assert.deepEqual(S.castProperties(ch).map((p) => [p.key, p.values]), [["status", ["Veteran", "Rookie"]]]);
  assert.deepEqual(propProblems(ch), []);
  // Survivor's template sorts by tribe only: a returnee season's status is that season's research.
  assert.deepEqual(S.castProperties(BUILT_IN_BLOCKS.survivor.blocks), []);
});

test("a property's shape: key, name, values or free text, whether it changes, one main, of a property with values", () => {
  assert.deepEqual(propProblems(withProps([dept, job])), []);
  const msgs = (props) => propProblems(withProps(props)).map((p) => p.message);
  assert.match(msgs([{ ...dept, key: "Department" }]).join(), /camelCase/);
  assert.match(msgs([dept, { ...dept, name: "Dept again" }]).join(), /already has the key/);
  assert.match(msgs([{ ...dept, values: ["Interior"] }]).join(), /at least two/);
  assert.match(msgs([{ ...dept, values: ["Deck", "deck"] }]).join(), /listed twice/);
  assert.match(msgs([{ ...dept, values: ["Deck", "Not stated"] }]).join(), /left empty/);
  assert.match(msgs([{ ...dept, changes: "often" }]).join(), /whether it changes/);
  assert.match(msgs([{ ...dept, main: true }, job]).join(), /only one property/);
  assert.match(msgs([{ ...dept, main: false }]).join(), /should be true/);
  assert.match(msgs([job]).join(), /isn't another of the properties/);
  assert.match(msgs([{ ...dept, values: null }, job]).join(), /its own values/);
  assert.match(msgs([dept, job, { key: "title", name: "Title", values: null, changes: "never", of: "job" }]).join(), /its own values/);
  assert.match(msgs([{ ...dept, key: "position", name: "Position" }]).join(), /roster/);
  assert.match(msgs([{ key: "tribe", name: "Tribe", values: ["A", "B"], changes: "never" }]).join(), /groups/);
  assert.match(propProblems(withProps({})).map((p) => p.message).join(), /should be a list/);
});

test("what a property may never be: ethnicity, religion, sexuality, health, age, a secret role, the groups again", () => {
  for (const [name, kind] of [["Ethnicity", "ethnicity"], ["Race", "ethnicity"], ["Religion", "religion"], ["Sexual orientation", "sexuality"], ["Health", "health"], ["Age group", "age"], ["Age", "age"]]) {
    const b = withProps([{ key: S.camelId(name), name, values: ["One", "Two"], changes: "never" }]);
    assert.match(propProblems(b).map((p) => p.message).join(), new RegExp(`never ${kind}`), name);
  }
  // Words that only look alike pass: a stage, a department, a status.
  for (const name of ["Stage", "Status", "Department", "Gender"]) assert.equal(S.forbiddenPropertyKind({ key: S.camelId(name), name }), null, name);
  const traitors = clone(BUILT_IN_BLOCKS.traitors.blocks);
  traitors.cast.properties = [{ key: "side", name: "Side", values: ["Traitor", "Faithful"], changes: "sometimes" }];
  assert.match(propProblems(traitors).map((p) => p.message).join(), /secret role is a twist/);
  const survivor = clone(BUILT_IN_BLOCKS.survivor.blocks);
  survivor.cast.properties = [{ key: "camp", name: "Tribe", values: ["A", "B"], changes: "sometimes" }];
  assert.match(propProblems(survivor).map((p) => p.message).join(), /that's the groups/);
});

test("the research prompt asks for properties, with the rule and examples", () => {
  const p = R.buildRulebookPrompt({ show: "Below Deck" });
  assert.ok(p.includes('"properties": [ what else the show itself sorts them by'));
  assert.ok(p.includes("sometimes: Sometimes. A firing, a promotion, a swap."));
  assert.match(p, /Never ethnicity, religion, sexuality, health or age/);
  assert.match(p, /Gender isn't one to list: the cast's research asks it of every show/);
  assert.match(p, /Never a secret role \(that's a twist\)/);
});

test("the review tidies an answer's properties without changing what they say, and leaves out what may never be one", () => {
  const answer = withProps([
    { name: "Department", values: "Interior, Deck, Galley", changes: "sometimes" },
    { key: "Job Title", name: "Job", values: [], changes: "sometimes", main: true, of: "Department" },
    { key: "status", name: "Status", values: ["Returning", "New", "Unknown"], changes: "never", main: false },
    { key: "ethnicity", name: "Ethnicity", values: ["A", "B"], changes: "never" },
    { key: "position", name: "Position", values: ["QB", "WR"], changes: "never" },
  ]);
  const r = R.reviewRulebook(answer);
  assert.deepEqual(r.blocks.cast.properties, [
    { name: "Department", values: ["Interior", "Deck", "Galley"], changes: "sometimes", key: "department" },
    { key: "jobTitle", name: "Job", values: null, changes: "sometimes", main: true, of: "department" },
    { key: "status", name: "Status", values: ["Returning", "New"], changes: "never" },
  ]);
  const said = r.warnings.map((w) => w.message).join("\n");
  assert.match(said, /Left out Ethnicity: .*never ethnicity/);
  assert.match(said, /Left out Position: a sport's position comes from its roster/);
  assert.match(said, /Department gets the key "department"/);
  assert.match(said, /"not stated" isn't a value/);
  assert.deepEqual(r.problems.filter((p) => p.at.startsWith("cast.properties")), []);
  // Two mains stay a problem for a person to settle: the review never picks between them.
  const two = R.reviewRulebook(withProps([{ ...dept, main: true }, job]));
  assert.match(two.problems.map((p) => p.message).join(), /only one property/);
  assert.equal(two.approvable, false);
  // None at all is fine, and null is read as none.
  assert.equal(R.reviewRulebook(withProps([])).blocks.cast.properties.length, 0);
  assert.equal("properties" in R.reviewRulebook(withProps(null)).blocks.cast, false);
});
