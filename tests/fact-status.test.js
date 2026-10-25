// What a shared fact's sources and flags add up to (src/lib/game/fact-status.ts, docs/PLAN-new-design.md step 6b):
// reported, confirmed, disputed, removed, and what reaches every league. Pure, no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { settleEpisode, coversFact, sourcesLine } = jiti("../src/lib/game/fact-status.ts");

const CAST = ["Brady", "Devin", "Kristin", "Mike"];
const full = (id, key, at) => ({ id, key, at, covers: { people: CAST, kinds: null } });
const quick = (id, key, at) => ({ id, key, at, covers: { people: CAST, kinds: ["elimination"] } });
const vouch = (id, key, at) => ({ id, key, at, covers: { only: true } });
const idol = (sources, extra = {}) => ({
  id: "f1", kind: "event", castawayName: "Brady", method: "", live: false, factStatus: "reported", locked: false, flags: [], sources, ...extra,
});
const yes = (researchId, confidence = "high", method = "") => ({ researchId, method, confidence });
const one = (fact, subs) => settleEpisode([fact], subs)[0];

test("one source is reported, and reaches every league only when it's confident", () => {
  const r = one(idol([yes("a")]), [full("a", "alex", 1)]);
  assert.equal(r.factStatus, "reported");
  assert.equal(r.live, true);
  assert.equal(sourcesLine(r), "1 source");
  const unsure = one(idol([yes("a", "medium")]), [full("a", "alex", 1)]);
  assert.equal(unsure.factStatus, "reported");
  assert.equal(unsure.live, false);
});

test("two people agreeing confirm it; the same person twice is one source", () => {
  const two = one(idol([yes("a"), yes("b")]), [full("a", "alex", 1), full("b", "riley", 2)]);
  assert.deepEqual([two.factStatus, two.live, two.yes, sourcesLine(two)], ["confirmed", true, 2, "2 sources agree"]);
  const twice = one(idol([yes("a"), yes("b")]), [full("a", "alex", 1), full("b", "alex", 2)]);
  assert.deepEqual([twice.factStatus, twice.yes], ["reported", 1]);
});

test("a source against it disputes it; the next answer settles it either way", () => {
  const split = one(idol([yes("a")], { live: true }), [full("a", "alex", 1), full("b", "riley", 2)]);
  assert.deepEqual([split.factStatus, split.live, split.yes, split.no], ["disputed", true, 1, 1]);
  const kept = one(idol([yes("a"), yes("c")], { live: true }), [full("a", "alex", 1), full("b", "riley", 2), full("c", "sam", 3)]);
  assert.deepEqual([kept.factStatus, kept.live], ["confirmed", true]);
  const gone = one(idol([yes("a")], { live: true }), [full("a", "alex", 1), full("b", "riley", 2), full("c", "sam", 3)]);
  assert.deepEqual([gone.factStatus, gone.live], ["removed", false]);
});

test("someone's newer answer is theirs; nothing left supporting it removes it", () => {
  const changed = one(idol([yes("a")], { live: true }), [full("a", "alex", 1), full("b", "alex", 2)]);
  assert.deepEqual([changed.factStatus, changed.live], ["removed", false]);
  const withdrawn = one(idol([yes("a")], { live: true }), []);
  assert.equal(withdrawn.factStatus, "removed");
});

test("a flag disputes it without changing anything, until an answer checks it", () => {
  const flags = [{ id: "x", status: "open", at: 5 }];
  const waiting = one(idol([yes("a")], { live: true, flags }), [full("a", "alex", 1)]);
  assert.deepEqual([waiting.factStatus, waiting.live, waiting.settle], ["disputed", true, []]);
  // The check reports it too: it stands, and the flag is answered.
  const kept = one(idol([yes("a"), yes("b")], { live: true, flags }), [full("a", "alex", 1), full("b", "riley", 9)]);
  assert.deepEqual([kept.factStatus, kept.live, kept.settle], ["confirmed", true, [{ id: "x", status: "kept" }]]);
  // The check doesn't: the players tip the split, and it comes out everywhere.
  const upheld = one(idol([yes("a")], { live: true, flags }), [full("a", "alex", 1), full("b", "riley", 9)]);
  assert.deepEqual([upheld.factStatus, upheld.live, upheld.settle], ["removed", false, [{ id: "x", status: "upheld" }]]);
  // Settled flags keep the answer where it landed.
  const after = one(idol([yes("a")], { live: false, flags: [{ id: "x", status: "upheld", at: 5 }] }), [full("a", "alex", 1), full("b", "riley", 9)]);
  assert.equal(after.factStatus, "removed");
  const keptAfter = one(idol([yes("a"), yes("b")], { live: true, flags: [{ id: "x", status: "kept", at: 5 }] }), [full("a", "alex", 1), full("b", "riley", 9)]);
  assert.equal(keptAfter.factStatus, "confirmed");
  // Two sources outweigh the players on their own.
  const strong = one(idol([yes("a"), yes("b"), yes("c")], { live: true, flags }), [full("a", "alex", 1), full("b", "riley", 2), full("c", "sam", 9)]);
  assert.equal(strong.factStatus, "confirmed");
});

test("sources disagreeing on how someone left: the method most of them gave", () => {
  const out = (sources, live = true) => ({ id: "e", kind: "elimination", castawayName: "Mike", method: "Voted Out", live, factStatus: "reported", locked: false, flags: [], sources });
  const subs = [quick("a", "alex", 1), quick("b", "riley", 2), quick("c", "sam", 3)];
  const split = one(out([yes("a", "high", "Voted Out"), yes("b", "high", "Quit")]), subs.slice(0, 2));
  assert.deepEqual([split.factStatus, split.method], ["disputed", "Voted Out"]);
  const quit = one(out([yes("a", "high", "Voted Out"), yes("b", "high", "Quit"), yes("c", "high", "Quit")]), subs);
  assert.deepEqual([quit.factStatus, quit.method, quit.live], ["confirmed", "Quit", true]);
});

test("who went home answers only for eliminations; a ticked result only for itself", () => {
  assert.equal(coversFact({ people: CAST, kinds: ["elimination"] }, { kind: "event", castawayName: "Brady" }), false);
  assert.equal(coversFact({ people: CAST, kinds: null }, { kind: "event", castawayName: "brady" }), true);
  const r = one(idol([yes("a")]), [full("a", "alex", 1), quick("q", "riley", 2), vouch("v", "sam", 3)]);
  assert.deepEqual([r.factStatus, r.no], ["reported", 0]);
  // A ticked result vouches: confident, so it applies.
  const ticked = one(idol([yes("a", "medium"), yes("v")]), [full("a", "alex", 1), vouch("v", "alex", 2)]);
  assert.deepEqual([ticked.factStatus, ticked.live], ["reported", true]);
});

test("a confident source isn't trusted while any answer for the episode says otherwise", () => {
  // alex's quick check named one person; their full answer names a second: it waits.
  const second = { id: "e2", kind: "elimination", castawayName: "Devin", method: "Voted Out", live: false, factStatus: "reported", locked: false, flags: [], sources: [yes("f", "high", "Voted Out")] };
  const r = one(second, [quick("q", "alex", 1), full("f", "alex", 2)]);
  assert.deepEqual([r.factStatus, r.live], ["reported", false]);
});

test("an admin's decision stays as it is", () => {
  const r = one(idol([], { locked: true, live: true, factStatus: "canonical" }), [full("b", "riley", 2)]);
  assert.deepEqual([r.factStatus, r.live], ["canonical", true]);
});

test("nobody went home: any answer about who went home speaks to it (step 6c)", () => {
  const noexit = (sources, extra = {}) => ({ id: "n1", kind: "noexit", castawayName: "", method: "", live: false, factStatus: "reported", locked: false, flags: [], sources, ...extra });
  const nobody = (id, key, at) => ({ id, key, at, covers: { people: CAST, kinds: ["elimination", "noexit"] } });
  assert.equal(coversFact({ people: CAST, kinds: ["elimination"] }, { kind: "noexit", castawayName: "" }), true);
  assert.equal(coversFact({ people: CAST, kinds: null }, { kind: "noexit", castawayName: "" }), true);
  assert.equal(coversFact({ people: CAST, kinds: ["event"] }, { kind: "noexit", castawayName: "" }), false);
  assert.equal(coversFact({ only: true }, { kind: "noexit", castawayName: "" }), false);
  // Entered by someone who watched it: in every league on its own.
  const one_ = one(noexit([yes("a")]), [nobody("a", "alex", 1)]);
  assert.deepEqual([one_.factStatus, one_.live], ["reported", true]);
  // A quick check naming who went home is against it; a second "nobody" confirms it.
  const split = one(noexit([yes("a")], { live: true }), [nobody("a", "alex", 1), quick("b", "riley", 2)]);
  assert.deepEqual([split.factStatus, split.live], ["disputed", true]);
  const two = one(noexit([yes("a"), yes("c")]), [nobody("a", "alex", 1), nobody("c", "sam", 3)]);
  assert.deepEqual([two.factStatus, two.live], ["confirmed", true]);
  // And saying nobody went home is against whoever someone else said left.
  const out = { id: "e1", kind: "elimination", castawayName: "Brady", method: "Voted Out", live: false, factStatus: "reported", locked: false, flags: [], sources: [yes("b", "high", "Voted Out")] };
  const against = one(out, [nobody("a", "alex", 1), quick("b", "riley", 2)]);
  assert.deepEqual([against.factStatus, against.no], ["disputed", 1]);
});
