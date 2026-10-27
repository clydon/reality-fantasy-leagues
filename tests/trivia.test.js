// Trivia's rules (src/lib/game/trivia.ts, docs/PLAN-new-design.md step 12 part 3): a round of three questions from a season's facts
// (who won, who left first, who scored the most, who did a moment most, who lasted longer, who scored more), only the kinds a
// season still airing can say (who left first, who lasted longer of two who've left), the same round for the same seed, its
// grading and its week. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { triviaRound, scoreRound, weekOf, ROUND } = jiti("../src/lib/game/trivia.ts");

const person = (name, out, how, points, counts = {}) => ({ name, photo: null, out, how, points, counts });
const finished = {
  seasonId: "s49",
  label: "Survivor 49",
  finished: true,
  cast: [
    person("Ann", 13, "Sole Survivor", 40, { idol: 3 }),
    person("Bo", 13, "Finalist", 35, { idol: 1 }),
    person("Cy", 1, "Voted Out", 2),
    person("Di", 5, "Voted Out", 12, { idol: 1 }),
    person("Ed", 8, "Voted Out", 20),
    person("Flo", 10, "Quit", 25),
  ],
  stats: [{ key: "idol", name: "Found an idol" }],
  winners: ["Sole Survivor"],
  finalists: ["Finalist"],
};

test("a finished season: three questions, each with its answer among four faces (two for A or B)", () => {
  const round = triviaRound([finished], "show|2026-10-26");
  assert.equal(round.length, ROUND);
  assert.equal(new Set(round.map((q) => q.id)).size, ROUND);
  for (const q of round) {
    assert.ok(q.options.some((o) => o.key === q.answer), q.id);
    assert.equal(q.options.length, /^(longer|more):/.test(q.id) ? 2 : 4, q.id);
    assert.equal(new Set(q.options.map((o) => o.key)).size, q.options.length);
  }
  assert.deepEqual(triviaRound([finished], "show|2026-10-26"), round, "the same round for the same seed");
});

test("each kind asks the right thing", () => {
  const all = new Map();
  for (let w = 0; w < 40; w++) for (const q of triviaRound([finished], `show|${w}`)) all.set(q.id, q);
  assert.equal(all.get("winner:s49").answer, "Ann");
  assert.equal(all.get("winner:s49").lead, "Who won Survivor 49?");
  assert.equal(all.get("first:s49").answer, "Cy", "who left first (never a finalist)");
  assert.equal(all.get("points:s49").answer, "Ann");
  assert.equal(all.get("most:s49:idol").answer, "Ann");
  assert.equal(all.get("most:s49:idol").what, "Found an idol");
  const longer = [...all.values()].filter((q) => q.id.startsWith("longer:"));
  assert.ok(longer.length > 0);
  for (const q of longer) assert.ok(q.options.every((o) => !["Ann", "Bo"].includes(o.key)), "both have left (never by reaching the end)");
});

test("a season still airing: only who left first and who lasted longer, through what's been seen", () => {
  const airing = { ...finished, seasonId: "s51", label: "Survivor 51", finished: false, cast: finished.cast.map((c) => (c.out > 6 ? { ...c, out: null, how: null } : c)) };
  const ids = new Set();
  for (let w = 0; w < 30; w++) for (const q of triviaRound([airing], `x|${w}`)) ids.add(q.id.split(":")[0]);
  assert.deepEqual([...ids].sort(), ["first", "longer"]);
  // Nobody out yet: nothing to ask.
  assert.deepEqual(triviaRound([{ ...airing, cast: airing.cast.map((c) => ({ ...c, out: null, how: null })) }], "z"), []);
});

test("ties ask nothing: two winners, a shared top score", () => {
  const tied = { ...finished, cast: finished.cast.map((c) => (c.name === "Bo" ? { ...c, how: "Sole Survivor", points: 40, counts: { idol: 3 } } : c)) };
  for (let w = 0; w < 20; w++) {
    const ids = triviaRound([tied], `t|${w}`).map((q) => q.id);
    assert.ok(!ids.includes("winner:s49") && !ids.includes("points:s49") && !ids.includes("most:s49:idol"), ids.join());
  }
});

test("grading, and the week", () => {
  const round = triviaRound([finished], "g");
  const right = Object.fromEntries(round.map((q) => [q.id, q.answer]));
  assert.equal(scoreRound(round, right), 3);
  assert.equal(scoreRound(round, { ...right, [round[0].id]: "Nobody", "not-a-question": "Ann" }), 2);
  assert.equal(weekOf(new Date("2026-10-26T15:00:00Z")), "2026-10-26", "a Monday is its own week");
  assert.equal(weekOf(new Date("2026-11-01T23:59:00Z")), "2026-10-26", "Sunday is the week's last day");
  assert.equal(weekOf(new Date("2026-11-02T00:00:00Z")), "2026-11-02");
});

test("researched questions come first, in the order given, and the season's facts fill what's left", () => {
  const withPhotos = { ...finished, cast: finished.cast.map((c) => ({ ...c, photo: `${c.name}.jpg` })) };
  const r = (id, over = {}) => ({ id, seasonId: "s49", madeAfter: 4, episode: 4, kind: "cast", question: `Question ${id}?`, options: ["Ann", "Bo", "Cy", "Di"], answer: "Bo", why: "Bo did.", source: "https://example.com", ...over });
  const two = triviaRound([withPhotos], "w", ROUND, [r("a"), r("b", { kind: "number", options: ["2", "3", "4", "5"], answer: "3" })]);
  assert.equal(two.length, ROUND);
  assert.deepEqual(two.slice(0, 2).map((q) => q.id), ["r:a", "r:b"]);
  assert.ok(!two[2].id.startsWith("r:"), "the facts fill the third");
  assert.equal(two[0].lead, "Question a?");
  assert.equal(two[0].why, "Bo did.");
  assert.equal(two[0].options.find((o) => o.key === "Bo").photo, "Bo.jpg", "a person's face");
  assert.deepEqual(two[1].options.map((o) => o.key), ["2", "3", "4", "5"], "numbers stay in order");
  assert.equal(two[1].options[0].photo, null);
  const four = triviaRound([withPhotos], "w", ROUND, ["a", "b", "c", "d"].map((id) => r(id)));
  assert.deepEqual(four.map((q) => q.id), ["r:a", "r:b", "r:c"], "never more than a round");
  assert.equal(scoreRound(four, { "r:a": "Bo", "r:b": "Ann" }), 1);
});
