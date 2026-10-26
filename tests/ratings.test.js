// Rate it's numbers (src/lib/game/ratings.ts, docs/PLAN-new-design.md step 12 part 1): a verdict's average, you against
// the couch on one episode, your taste twin, how often you agree with the couch, and the rating accolades (taste twins,
// the contrarian, never misses a rating). No database: made-up ratings. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { average, againstCouch, tasteOf, ratingAccolades, verdictText, MIN_SHARED } = jiti("../src/lib/game/ratings.ts");

const people = ["ann", "bo", "cy", "di"].map((n) => ({ userId: n, name: n }));
/** Ratings from a table: { ann: [5, 4, 4, 3], ... } is ann's stars for episodes 1-4 of season s (null: not rated). */
const ratings = (table, seasonId = "s") =>
  Object.entries(table).flatMap(([userId, stars]) => stars.map((s, i) => (s === null ? null : { userId, seasonId, episode: i + 1, stars: s })).filter(Boolean));

test("a verdict is the average to one decimal; nothing to average is null", () => {
  assert.equal(average([4, 5, 4]), 4.3);
  assert.equal(average([3]), 3);
  assert.equal(average([]), null);
  assert.equal(verdictText(4), "4.0");
  assert.equal(verdictText(null), "–");
});

test("you against the couch: first, agree within a star, contrarian a star and a half off, else nothing", () => {
  assert.equal(againstCouch(4, []), "first");
  assert.equal(againstCouch(4, [4, 5]), "agree");
  assert.equal(againstCouch(5, [4, 4]), null); // a star off: nothing worth saying
  assert.equal(againstCouch(1, [3, 3]), "contrarian");
  assert.equal(againstCouch(null, [3]), null);
});

test("your taste twin: the closest on enough shared episodes, a star apart at most; the line says how alike", () => {
  const rated = ratings({ ann: [5, 4, 4, 3, 5], bo: [5, 4, 4, 3, 4], cy: [2, 5, 1, 5, 2], di: [5, 4, null, null, null] });
  const t = tasteOf(rated, "ann", people);
  assert.deepEqual(t.twin, { userId: "bo", name: "bo", line: "The same stars on 4 of 5 episodes" });
  // di has only two in common with ann: not enough to say.
  assert.equal(tasteOf(ratings({ ann: [5, 4], di: [5, 4] }), "ann", people).twin, null);
  // cy is never within a star on average: no twin.
  assert.equal(tasteOf(ratings({ ann: [5, 5, 5, 1], cy: [1, 2, 1, 5] }), "ann", people).twin, null);
  // Under half the same: within a star instead.
  const close = tasteOf(ratings({ ann: [5, 4, 3, 2], bo: [4, 3, 2, 2] }), "ann", people);
  assert.equal(close.twin.line, "Within a star on 4 of 4 episodes");
  assert.equal(MIN_SHARED, 3);
});

test("agree with the couch: within a star of everyone else's average, over episodes someone else rated", () => {
  const t = tasteOf(ratings({ ann: [5, 4, 1, 4, 5], bo: [5, 4, 4, 4, null], cy: [4, 4, 5, 3, null] }), "ann", people);
  // Episodes 1-4 have others (episode 5 is ann's alone): 1, 2 and 4 agree, 3 doesn't.
  assert.deepEqual(t.agree, { pct: 75, of: 4 });
  assert.equal(t.shows, 1);
  assert.equal(tasteOf(ratings({ ann: [5, 4], bo: [5, 4] }), "ann", people).agree, null);
});

test("the rating accolades: taste twins, the contrarian, never misses a rating; each only when it says something", () => {
  const rated = [
    ...ratings({ ann: [5, 4, 4, 3, 5], bo: [5, 4, 4, 3, 5], cy: [1, 1, 5, 5, 1], di: [4, null, 4, 3, null] }),
    ...ratings({ di: [3, 4, 3, 4, 3, 4] }, "t"),
  ];
  const a = ratingAccolades(rated, people, (id) => (id === "t" ? "Traitors 5" : "Survivor 51"));
  const by = Object.fromEntries(a.map((x) => [x.key, x]));
  assert.equal(by.twins.who, "ann and bo");
  assert.equal(by.twins.line, "the same stars on 5 of 5 episodes");
  assert.equal(by.contrarian.who, "cy");
  assert.match(by.contrarian.line, /^\d\.\d stars off the couch on average$/);
  assert.equal(by.rates.who, "di");
  assert.equal(by.rates.line, "6 episodes of Traitors 5 in a row");
  // Too little to say anything.
  assert.deepEqual(ratingAccolades(ratings({ ann: [5, 4], bo: [5, 4] }), people, () => null), []);
  // Someone not on the couch is never named.
  assert.deepEqual(ratingAccolades(ratings({ zed: [5, 4, 4, 3, 5], yan: [5, 4, 4, 3, 5] }), people, () => null), []);
});
