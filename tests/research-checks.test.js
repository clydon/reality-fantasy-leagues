// Research answers checked against each other before anything is staged: a paste whose copy button
// escaped Markdown, Tribal attendance that contradicts immunity or the vote counts (the mistakes that
// score "safe at Tribal" for people who were never there), a swapped castaway voted out the same night
// whose move the chat left out, and pages read pooled across runs. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../db/episode-research.js");
const Formats = require("../src/lib/game/formats/index.js");

const survivor = Formats.formatFor("survivor");
const TERMS = { castaways: "castaways" };

// One castaway's answer: nothing happened, sourced, unless `extra` says otherwise.
const person = (name, extra = {}) => ({
  ...R.pasteSkeleton({ castNames: [name], format: survivor }, []).castaways[0],
  name,
  leftTheGame: "no",
  attendedTribal: "no",
  confidence: "high",
  sources: ["https://example.com/recap"],
  ...extra,
});
const episode = (castaways, extra = {}) => ({ episodeTitle: "T", airDate: null, summary: "s", tribalCouncilHeld: "yes", merged: "no", rulesNote: null, sourcesRead: [], castaways, ...extra });
const safe = (payload) => R.candidatesFor(payload, survivor, 4).filter((c) => c.eventType === "zeroVotesSafe").map((c) => c.castawayName);

// Savu's Tribal from Survivor 51 episode 4: Jenna out 4-1, Alexis the 1.
const savuTribal = () => [
  person("Jenna Doore", { attendedTribal: "yes", votesReceived: 4, votedFor: "Alexis Levine", leftTheGame: "yes", exitMethod: "Voted Out" }),
  person("Devin Way", { attendedTribal: "yes", votesReceived: 0, votedFor: "Jenna Doore" }),
  person("Jelly Loblack", { attendedTribal: "yes", votesReceived: 0, votedFor: "Jenna Doore" }),
  person("Ori Jean-Charles", { attendedTribal: "yes", votesReceived: 0, votedFor: "Jenna Doore" }),
  person("Alexis Levine", { attendedTribal: "yes", votesReceived: 1, votedFor: "Jenna Doore" }),
];

test("a paste whose copy button escaped Markdown (\\[ \\] \\_) still reads, and a real \\\\ stays a backslash", () => {
  const schema = R.researchSchemaFor(survivor, false);
  const answer = episode([person("Ada", { notableTwist: "C:\\path", sources: ["https://x.example/a_b"] })]);
  const escaped = JSON.stringify(answer).replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/_b/g, "\\_b");
  const parsed = R.parseJsonAnswer(escaped, schema, "The pasted JSON");
  assert.equal(parsed.castaways[0].sources[0], "https://x.example/a_b");
  assert.equal(parsed.castaways[0].notableTwist, "C:\\path");
  assert.throws(() => R.parseJsonAnswer("{ not json", schema, "The pasted JSON"), /wasn't valid JSON/);
});

test("Tribal: a clean vote stages safe-with-zero-votes for exactly the attendees nobody voted for", () => {
  const p = episode([...savuTribal(), person("Brady Booker", { wonTribeImmunity: "yes" })]);
  const review = R.validateResearch(p, p.castaways.map((c) => c.name), TERMS, survivor);
  assert.deepEqual(review.problems, []);
  assert.deepEqual(safe(p).sort(), ["Devin Way", "Jelly Loblack", "Ori Jean-Charles"]);
});

test("Tribal: someone on the tribe that won immunity is never safe at Tribal, and the attendance is cleared and reported", () => {
  const p = episode([...savuTribal(), person("Brady Booker", { attendedTribal: "yes", votesReceived: 0, wonTribeImmunity: "yes" })]);
  const review = R.validateResearch(p, p.castaways.map((c) => c.name), TERMS, survivor);
  assert.ok(review.problems.some((m) => /Brady Booker: .*won immunity/.test(m)), review.problems.join("; "));
  assert.ok(!safe(p).includes("Brady Booker"));
});

test("Tribal: after the merge, an individual immunity winner at Tribal with no votes is still safe", () => {
  const p = episode(
    [...savuTribal(), person("Kim", { attendedTribal: "yes", votesReceived: 0, wonIndividualImmunity: "yes", votedFor: "Jenna Doore" })],
    { merged: "yes" }
  );
  R.validateResearch(p, p.castaways.map((c) => c.name), TERMS, survivor);
  assert.ok(safe(p).includes("Kim"));
});

test("Tribal: everyone on zero votes means the counts are missing, not that everyone was safe", () => {
  const p = episode([person("A", { attendedTribal: "yes", votesReceived: 0 }), person("B", { attendedTribal: "yes", votesReceived: 0 })]);
  const review = R.validateResearch(p, ["A", "B"], TERMS, survivor);
  assert.ok(review.problems.some((m) => /look missing/.test(m)));
  assert.deepEqual(safe(p), []);
});

test("Tribal: no Tribal Council this episode clears anyone marked as attending", () => {
  const p = episode([person("A", { attendedTribal: "yes", votesReceived: 0 })], { tribalCouncilHeld: "no" });
  const review = R.validateResearch(p, ["A"], TERMS, survivor);
  assert.ok(review.problems.some((m) => /No Tribal Council/.test(m)));
  assert.deepEqual(safe(p), []);
});

test("a swapped castaway voted out the same night: the missed move is added from the Tribal they were at", () => {
  const p = episode(savuTribal().map((c) => ({ ...c, newGroup: ["Devin Way", "Jelly Loblack"].includes(c.name) ? "Savu" : null })));
  const groups = { "Jenna Doore": "Toka", "Devin Way": "Toka", "Jelly Loblack": "Toka", "Ori Jean-Charles": "Savu", "Alexis Levine": "Savu" };
  const review = R.validateResearch(p, p.castaways.map((c) => c.name), TERMS, survivor, { groups });
  assert.ok(review.problems.some((m) => /Jenna Doore was at Savu's Tribal .*added a move to Savu/.test(m)), review.problems.join("; "));
  const moves = R.candidatesFor(p, survivor, 4).filter((c) => c.kind === "group").map((c) => `${c.castawayName}->${c.method}`).sort();
  assert.deepEqual(moves, ["Devin Way->Savu", "Jelly Loblack->Savu", "Jenna Doore->Savu"]);
});

test("a joint Tribal of two tribes isn't mistaken for missed moves", () => {
  const p = episode(savuTribal().map((c) => ({ ...c, newGroup: null })));
  const groups = { "Jenna Doore": "Toka", "Devin Way": "Toka", "Jelly Loblack": "Savu", "Ori Jean-Charles": "Savu", "Alexis Levine": "Toka" };
  const review = R.validateResearch(p, p.castaways.map((c) => c.name), TERMS, survivor, { groups });
  assert.ok(!review.problems.some((m) => /added a move/.test(m)), review.problems.join("; "));
});

test("pages read are pooled across runs by URL, the newer run's dates winning", () => {
  const stored = { castaways: [], sourcesRead: [{ url: "a", published: "2026-10-15", updated: null }, { url: "b", published: null, updated: null }] };
  const { payload } = R.mergeResearchPayload(stored, { castaways: [], sourcesRead: [{ url: "b", published: "2026-10-15T09:00:00-04:00", updated: null }] });
  assert.deepEqual(
    payload.sourcesRead.map((s) => [s.url, s.published]),
    [["a", "2026-10-15"], ["b", "2026-10-15T09:00:00-04:00"]]
  );
});
