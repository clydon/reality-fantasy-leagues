// Holdings (docs/PLAN-cast-properties.md, chunk 6b): who holds which idol or advantage now. Research asks, for a format with
// advantage twists, what changed hands this episode and who holds what at its end; the changes are staged as holding facts; the
// ledger built from them says what someone has as of an episode; the snapshot is the desk's check. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const H = jiti("../src/lib/game/holdings.ts");
const W = jiti("../src/lib/game/dated-fact-words.ts");
const ER = require("../db/episode-research.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");

const f = (episode, holder, how, name, other = "") => ({ episode, holder, how, name, other, twist: "advantages" });

test("the ledger: found, given, played, a gift to someone, as of an episode", () => {
  const rows = H.ledger([
    f(2, "Kristin", "found", "Hidden Immunity Idol"),
    f(3, "Eric", "found", "Block a Vote"),
    f(4, "Kristin", "gave", "Hidden Immunity Idol", "Eric"),
    f(5, "Eric", "played", "Hidden Immunity Idol", "Eric"),
  ]);
  const at = (who, n) => H.holdsAt(rows, who, n).map((r) => r.name);
  assert.deepEqual(at("Kristin", 1), []);
  assert.deepEqual(at("Kristin", 3), ["Hidden Immunity Idol"]);
  assert.deepEqual(at("Kristin", 4), [], "gave it away");
  assert.deepEqual(at("Eric", 4).sort(), ["Block a Vote", "Hidden Immunity Idol"], "and Eric has it from then");
  assert.deepEqual(at("Eric", 5), ["Block a Vote"], "played it");
  assert.equal(H.holdsLine(H.holdsAt(rows, "Eric", 4).find((r) => r.name === "Hidden Immunity Idol")), "Has a Hidden Immunity Idol · given by Kristin Ep 4");
  assert.equal(H.holdsLine(H.holdsAt(rows, "Kristin", 3)[0]), "Has a Hidden Immunity Idol · found Ep 2");
});

test("the snapshot is the desk's check: who it says holds something the record doesn't, and the other way", () => {
  const rows = H.ledger([f(2, "Kristin", "found", "Idol")]);
  assert.deepEqual(H.snapshotDisagreements(rows, [{ holder: "Kristin", name: "Idol" }], 2, ["Kristin", "Eric"]), []);
  const off = H.snapshotDisagreements(rows, [{ holder: "Eric", name: "Idol" }], 2, ["Kristin", "Eric"]);
  assert.equal(off.length, 2);
  assert.match(off.join("\n"), /The snapshot says Eric holds Idol; the record has nothing of theirs open/);
  assert.match(off.join("\n"), /The record says Kristin still holds Idol; the snapshot has nothing of theirs/);
});

test("research asks it of a format with advantages, and stages each change as a holding", () => {
  const { data, problems } = compileRulebook(BUILT_IN_BLOCKS.survivor.blocks, { id: "survivor", reader: "research" });
  assert.deepEqual(problems, []);
  assert.deepEqual(data.research.holdings.map((h) => h.twist), ["advantages"]);
  const format = { hasGroups: false, research: { ...data.research, items: () => {} } };
  const payload = {
    castaways: [{ name: "Kristin" }, { name: "Eric" }],
    holdings: { changes: [{ who: "Kristin", name: "Hidden Immunity Idol", how: "found", other: null }, { who: "Eric", name: "Shot in the Dark", how: "Played", other: "" }, { who: "Eric", name: "Idol", how: "lent" }], atEnd: [{ holder: "Kristin", name: "Hidden Immunity Idol" }] },
  };
  const items = ER.candidatesFor(payload, format, 3).filter((i) => i.kind === "holding");
  assert.deepEqual(items.map((i) => `${i.castawayName}|${i.eventType}|${i.method}`), ["Kristin|advantages:found:hidden-immunity-idol|", "Eric|advantages:played:shot-in-the-dark|"], "an unknown how left out");
  assert.equal(ER.holdingType("a", "found", "Hidden Immunity Idol!"), W.holdingType("a", "found", "Hidden Immunity Idol!"), "the JS and TS slugs agree");
});
