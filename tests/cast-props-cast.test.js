// Cast properties in a season's cast (docs/PLAN-cast-properties.md, chunk 2): the cast prompt asks each property the rulebook
// declares and each person's bio, the parser keeps only what's stated (a listed value matched to its own spelling, anything
// else dropped and said), and the desk's diff makes each person's properties and bio a change of their own, merged over ours
// (a value the answer doesn't state never takes ours away), filling in where we have none and keeping ours where we have some.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/lib/game/formats/cast-prompt.js");
const D = require("../src/lib/desk-cast-diff.ts");
const W = require("../src/lib/cast-props-words.ts");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");

const properties = LIBRARY["below-deck"].blocks.cast.properties;
const format = { name: "Below Deck", hasGroups: false, terms: { castaway: "Crew member", tribe: "Group" }, properties };
const views = properties.map((p) => ({ key: p.key, name: p.name, main: !!p.main }));

test("the prompt asks each declared property (listed values, or the show's words) and a bio, only as stated", () => {
  const p = C.buildCastPrompt(format, { seasonName: "Season 12", showName: "Below Deck" });
  assert.match(p, /"department": "Their department at the start of the season: exactly one of \\"Interior\\", \\"Deck\\", \\"Galley\\", \\"Bridge\\", or \\"\\" if not stated"/);
  assert.match(p, /"job": "Their job at the start of the season, in the show's own words \(inside their department\)/);
  assert.match(p, /"hometown":/);
  assert.match(p, /"age": "Their age as billed at the premiere, a whole number, or null/);
  assert.match(p, /Never guess one from a name or a photo/);
  assert.match(p, /never ethnicity, religion, sexuality or health/);
  // A show with no properties still asks bios, and no properties.
  const plain = C.buildCastPrompt({ ...format, properties: [] }, { showName: "Survivor" });
  assert.ok(!plain.includes('"properties"'));
  assert.ok(plain.includes('"bio"'));
});

test("the parser keeps what's stated: values matched to their spelling, free text trimmed, bios cleaned", () => {
  const r = C.parseCastImport(
    {
      castaways: [
        { name: "Ana Monroe", photoUrl: "", properties: { department: "interior", job: "  Chief   Stew " }, bio: { hometown: "Ocean City, NJ", age: "25", occupation: "Nurse", line: "", source: "https://example.com/cast" } },
        { name: "Bo Penn", properties: { Department: "Engine", job: "not stated" }, bio: { hometown: "", age: "twenty", occupation: "Unknown" } },
        { name: "Cy Stone", properties: { department: "" }, bio: null },
      ],
    },
    format
  );
  const [ana, bo, cy] = r.castaways;
  assert.deepEqual(ana.props, { department: "Interior", job: "Chief Stew" });
  assert.deepEqual(ana.bio, { hometown: "Ocean City, NJ", age: 25, occupation: "Nurse", source: "https://example.com/cast" });
  assert.deepEqual(bo.props, {});
  assert.equal(bo.bio, null);
  assert.deepEqual(cy.props, {});
  const said = r.repairs.map((x) => x.message).join("\n");
  assert.match(said, /Dropped Department "Engine" -- not one of Interior, Deck, Galley, Bridge/);
  assert.match(said, /Dropped the age "twenty"/);
  // toCastImport carries them.
  assert.deepEqual(C.toCastImport(r).castaways[0].props, { department: "Interior", job: "Chief Stew" });
  // A show without properties drops them quietly.
  assert.deepEqual(C.parseCastImport({ castaways: [{ name: "Dee", properties: { department: "Deck" } }] }, { ...format, properties: [] }).castaways[0].props, {});
});

test("the diff: props and bio are changes of their own, merged over ours, filling in or a choice", () => {
  const ours = [
    { id: "a", name: "Ana Monroe", group: null, locked: false, props: {}, bio: null },
    { id: "b", name: "Bo Penn", group: null, locked: false, props: { department: "Deck", job: "Bosun" }, bio: { hometown: "Leeds" } },
    { id: "c", name: "Cy Stone", group: null, locked: true, props: {}, bio: null },
    { id: "d", name: "Dee Kwon", group: null, locked: false, props: { department: "Interior", job: "Second stew" }, bio: null },
  ];
  const theirs = [
    { name: "Ana Monroe", group: null, photo: null, props: { department: "Interior", job: "Chief stew" }, bio: { hometown: "Ocean City, NJ", age: 25 } },
    { name: "Bo Penn", group: null, photo: null, props: { job: "Lead deckhand" }, bio: { hometown: "Leeds", occupation: "Sailor" } },
    { name: "Cy Stone", group: null, photo: null, props: { department: "Galley" } },
    // Dee: the answer states only her department, the same as ours: nothing changes.
    { name: "Dee Kwon", group: null, photo: null, props: { department: "Interior" } },
    { name: "Eve New", group: null, photo: null, props: { department: "Deck", job: "Deckhand" }, bio: { age: 30 } },
  ];
  const changes = D.castChanges(ours, theirs, { groups: false, props: true });
  const by = (k, id) => changes.find((c) => c.k === k && (c.id === id || c.name === id));
  assert.deepEqual(by("props", "a").to, { department: "Interior", job: "Chief stew" });
  assert.equal(D.pickOf(by("props", "a")), "theirs", "we had none: it fills in");
  assert.deepEqual(by("props", "b").to, { department: "Deck", job: "Lead deckhand" }, "merged: the department we had stays");
  assert.equal(D.pickOf(by("props", "b")), "ours", "we had some: keep ours unless chosen");
  assert.deepEqual(by("bio", "b").to, { hometown: "Leeds", occupation: "Sailor" });
  assert.equal(by("props", "c"), undefined, "a locked castaway is never changed by an answer");
  assert.equal(by("props", "d"), undefined, "nothing new for Dee");
  assert.deepEqual(by("add", "Eve New").props, { department: "Deck", job: "Deckhand" });
  // Without props (a season with none), only bios count.
  assert.ok(!D.castChanges(ours, theirs, { groups: false }).some((c) => c.k === "props"));

  const plan = D.castPlan(changes, { [by("props", "b").key]: "theirs" });
  assert.deepEqual(plan.reprops.map((x) => x.id).sort(), ["a", "b"]);
  assert.deepEqual(plan.rebio.map((x) => x.id), ["a"], "Bo's bio keeps ours by default");
  assert.deepEqual(plan.add[0].props, { department: "Deck", job: "Deckhand" });
  assert.deepEqual(plan.add[0].bio, { age: 30 });
  assert.match(D.changesLine(changes), /1 new, 2 people's details, 2 bios/);
});

test("someone new under a new spelling joins with what the answer says about them", () => {
  const ours = [{ id: "a", name: "Fraser Olender", group: null, locked: false, props: {}, bio: null }];
  const theirs = [{ name: "Frasier Olender", group: null, photo: null, props: { department: "Deck", job: "Deckhand" }, bio: { hometown: "Cork" } }];
  const changes = D.castChanges(ours, theirs, { groups: false, props: true });
  const spell = changes.find((c) => c.k === "spell");
  const plan = D.castPlan(changes, { [spell.key]: "new" });
  assert.deepEqual(plan.add[0], { name: "Frasier Olender", group: null, photo: null, props: { department: "Deck", job: "Deckhand" }, bio: { hometown: "Cork" } });
  assert.equal(plan.reprops.length, 0, "the props go with the new person, not onto Fraser");
});

test("the words: a property line, the value under a name, a bio's head", () => {
  assert.equal(W.propsLine({ job: "Chief stew", department: "Interior" }, views), "Interior · Chief stew");
  assert.equal(W.mainValue({ job: "Chief stew", department: "Interior" }, views), "Chief stew");
  assert.equal(W.mainValue({ department: "Interior" }, views), "Interior", "no job stated: the next one stated");
  assert.equal(W.mainValue({}, views), null);
  assert.equal(W.bioLine({ hometown: "Ocean City, NJ", age: 25, occupation: "Nurse" }), "Ocean City, NJ · 25 · Nurse");
  assert.equal(W.bioLine({ residence: "Miami, FL" }), "Miami, FL");
  assert.equal(W.bioLine(null), "");
});

test("a game's stamp is never saved: castProps and castPropDefs are stamped keys", () => {
  const S = require("../src/lib/game/state-logic.js");
  const keys = new Set(S.StatsLogic.stampedKeys());
  assert.ok(keys.has("castProps") && keys.has("castPropDefs"));
  const saved = JSON.parse(JSON.stringify({ castaways: [], castProps: { a: { job: "Chef" } }, castPropDefs: [] }, (k, v) => (keys.has(k) ? undefined : v)));
  assert.deepEqual(Object.keys(saved), ["castaways"]);
});

test("a nickname in quotes is the same person: no new spelling, nobody added twice", () => {
  assert.deepEqual(D.nameForms("Angelica “Jelly” Loblack"), ["Angelica “Jelly” Loblack", "Angelica Loblack", "Jelly Loblack"]);
  const ours = [
    { id: "a", name: "Thien An Nguyen", group: "Toka", locked: false },
    { id: "b", name: "Jelly Loblack", group: "Toka", locked: false },
    { id: "c", name: "Danny Kilby", group: "Savu", locked: false },
  ];
  const theirs = [
    { name: "An “Thien An” Nguyen", group: "Toka", photo: null, bio: { hometown: "Fort Worth, Texas" } },
    { name: "Angelica “Jelly” Loblack", group: "Toka", photo: null, bio: { hometown: "Somewhere" } },
    { name: 'Danny "Kilby" Kilby', group: "Savu", photo: null },
  ];
  const changes = D.castChanges(ours, theirs, { groups: true });
  assert.deepEqual(changes.map((c) => `${c.k}:${c.id ?? c.name}`).sort(), ["bio:a", "bio:b"]);
});
