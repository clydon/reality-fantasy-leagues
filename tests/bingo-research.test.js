// Bingo's bank prompt and parse (db/bingo-research.js, docs/PLAN-bingo-bank.md): the kind of episode from where it falls and its
// title, the phase the season's in, the prompt fitted to an episode (or the season's own bank, with no names), and the strict parse
// that keeps every square, live or dropped with why. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const B = require("../db/bingo-research.js");

const survivor = BUILT_IN_BLOCKS.survivor.blocks;
const avoid = [...new Set(momentsFor(survivor).filter((m) => !m.off).map((m) => m.label))];
const base = { showName: "Survivor", season: 51, kind: "competition", part: { singular: "episode", plural: "episodes" }, count: 13, phases: survivor.season.phases, term: "castaways", avoid };
const json = (squares) => "Here you go:\n```json\n" + JSON.stringify({ squares }) + "\n```";

test("what kind of episode: premiere, finale, reunion, regular", () => {
  assert.equal(B.episodeKind({ n: 1, count: 13 }), "premiere");
  assert.equal(B.episodeKind({ n: 13, count: 13 }), "finale");
  assert.equal(B.episodeKind({ n: 12, count: 14, title: "Two-Hour Finale, Part 1" }), "finale");
  assert.equal(B.episodeKind({ n: 14, count: 14, title: "Reunion" }), "reunion");
  assert.equal(B.episodeKind({ n: 6, count: 13, note: "after a week off" }), "regular");
  assert.equal(B.episodeKind({ n: 6, count: null }), "regular");
});

test("where the season is: the phase it's in, and one starting about now", () => {
  const phases = survivor.season.phases;
  assert.deepEqual(B.phaseLines(phases, 4, 15), [`The season is in its "Tribes" phase: ${phases[0].summary}`]);
  const soon = B.phaseLines(phases, 7, 13);
  assert.equal(soon.length, 2);
  assert.match(soon[1], /"Merged" starts when 12 are left, and 13 are left now, so it may start this episode/);
  assert.match(B.phaseLines(phases, 8, 11)[0], /"Merged" phase/);
  assert.deepEqual(B.phaseLines(phases, 4, null), [`The season is in its "Tribes" phase: ${phases[0].summary}`], "an episode-1 start counts with nobody counted");
  assert.deepEqual(B.phaseLines([{ name: "Only", starts: { type: "episode", n: 1 } }], 3, 10), [], "a season of one phase says nothing");
});

test("the episode's prompt: fitted to it, who's still in, the scoring moments left out", () => {
  const fourteen = ["Kyle Fraser", "Jelinsky", "Sue Smey", ...Array.from({ length: 11 }, (_, i) => `Castaway ${i + 1}`)];
  const p = B.buildBingoPrompt({ ...base, episode: 6, airAt: "Wed, Oct 29, 8:00 PM EDT", title: "Bring the Thunder", stillIn: fourteen });
  assert.match(p, /Episode 6, "Bring the Thunder", airs Wed, Oct 29, 8:00 PM EDT\. It hasn't aired yet\./);
  assert.match(p, /Write 30 bingo squares for people watching episode 6 together/);
  assert.match(p, /A regular episode: lean on the show's staples/);
  assert.match(p, /"Tribes" phase/);
  assert.match(p, /at most 3 squares may name someone, and only someone from this list of the castaways still in, written as listed:\n  Kyle Fraser, Jelinsky, Sue Smey, Castaway 1,/);
  assert.ok(p.includes("Won the Immunity challenge") && p.includes("Sat out a challenge"), "the scoring moments are named, to leave out");
  assert.match(p, /\{"squares": \[\{"square": "It rains", "likelihood": "maybe"\}\]\}/);
  assert.match(p, /The network's own description of the episode is fine\./, "an episode may lean on the network's description");
  const finale = B.buildBingoPrompt({ ...base, episode: 13, stillIn: ["A", "B", "C", "D"] });
  assert.match(finale, /It's the finale\./);
  assert.match(finale, /is the next to air\. It hasn't aired yet\./, "no air time: the next to air");
  assert.match(B.buildBingoPrompt({ ...base, episode: 1, stillIn: [] }), /It's the premiere\./);
  assert.ok(!/name someone/.test(B.buildBingoPrompt({ ...base, episode: 3, stillIn: [] })), "a show without a cast: nothing about names");
});

test("the season's own prompt: any regular episode, nobody named, no episode-only words", () => {
  const p = B.buildBingoPrompt({ ...base, episode: null, stillIn: ["Kyle Fraser"] });
  assert.match(p, /Write 30 bingo squares for any regular episode of it/);
  assert.match(p, /each square has to fit any episode of the season/);
  assert.match(p, /About nobody in particular: no names/);
  assert.ok(!/Kyle/.test(p) && !/hasn't aired/.test(p) && !/phase/.test(p));
  const race = B.buildBingoPrompt({ ...base, kind: "sport", part: { singular: "race", plural: "races" }, episode: 4, stillIn: [] });
  assert.match(race, /Race 4 is the next to air/);
  assert.match(race, /it comes up in most races/);
});

test("the parse: every square kept, live or dropped with why", () => {
  const { squares, skipped } = B.parseBingoAnswer(
    json([
      { square: "It rains.", likelihood: "maybe" },
      { square: "  “Someone goes fishing”  ", likelihood: "Likely" },
      { square: "a chat at the water well", likelihood: "long shot" },
      { square: "Does anyone cry?", likelihood: "maybe" },
      { square: "It rains", likelihood: "likely" },
      { square: "Won the Immunity challenge", likelihood: "likely" },
      { square: "Someone talks for a really very long time about their family", likelihood: "maybe" },
      { square: "Jeff says he'll tally the votes", likelihood: "sometimes" },
      { square: "A slow-motion shot" },
      { square: "" },
      "A recap montage",
    ]),
    { avoid }
  );
  assert.equal(skipped, 1);
  const by = Object.fromEntries([...squares].reverse().map((s) => [s.label, s]));
  assert.deepEqual(by["It rains"], { label: "It rains", likelihood: "maybe", status: "live", note: null });
  assert.equal(by["Someone goes fishing"].likelihood, "likely");
  assert.equal(by["A chat at the water well"].likelihood, "longshot", "capitalised, 'long shot' read as longshot");
  assert.equal(by["Does anyone cry?"].note, "a question, not something you see");
  assert.equal(squares.filter((s) => s.label === "It rains")[1].note, "written twice");
  assert.equal(by["Won the Immunity challenge"].note, "one of the show's scoring moments");
  assert.equal(by["Someone talks for a really very long time about their family"].note, "too long for a square");
  assert.equal(by["Jeff says he'll tally the votes"].note, "no likelihood (likely, maybe or longshot)");
  assert.deepEqual([by["A slow-motion shot"].likelihood, by["A slow-motion shot"].status], ["maybe", "live"], "no likelihood given: maybe");
  assert.equal(by["A recap montage"].status, "live", "a bare string is a square");
  assert.ok(squares.every((s) => s.label.length <= 60));
  assert.throws(() => B.parseBingoAnswer("Sorry, I can't search right now."));
});

test("names: an episode's bank names someone in at most three squares; the season's names nobody", () => {
  const names = ["Kyle Fraser", "Sue Smey", "Jelinsky", "Al"];
  const answer = json([
    { square: "Kyle talks about his kids", likelihood: "maybe" },
    { square: "Sue laughs at camp", likelihood: "maybe" },
    { square: "Jelinsky makes a joke", likelihood: "likely" },
    { square: "Kyle Fraser fishes", likelihood: "maybe" },
    { square: "Totally normal square", likelihood: "maybe" },
    { square: "Albatross flies over", likelihood: "longshot" },
  ]);
  const ep = B.parseBingoAnswer(answer, { names }).squares;
  assert.deepEqual(ep.map((s) => s.status), ["live", "live", "live", "dropped", "live", "live"], "a first name under three letters isn't matched inside a word");
  assert.equal(ep[3].note, "more than 3 squares name someone");
  const season = B.parseBingoAnswer(answer, { names, anyone: false }).squares;
  assert.deepEqual(season.map((s) => s.status), ["dropped", "dropped", "dropped", "dropped", "live", "live"]);
  assert.equal(season[0].note, "names someone (the season's squares name nobody)");
});

// ---------- the bot's check (step 2) ----------
const sq = (label, likelihood = "maybe", status = "live", note = null) => ({ label, likelihood, status, note });
const verdict = (o = {}) => ({ seen: true, likely: true, scoring: false, spoiler: false, sameAs: null, likelihood: null, note: "", ...o });

test("the check's prompt: every square numbered, each judgement asked, the scoring moments named", () => {
  const p = B.buildCheckPrompt({ ...base, episode: 6, squares: [sq("It rains"), sq("Someone goes fishing", "likely")] });
  assert.match(p, /These are bingo squares for people watching Survivor season 51 together, for episode 6\. Someone else wrote them; check every one\./);
  assert.match(p, /Episode 6 hasn't aired yet: never look for what happens in it\./);
  assert.match(p, /\n1\. It rains \(maybe\)\n2\. Someone goes fishing \(likely\)\n/);
  for (const k of ["seen", "likely", "scoring", "spoiler", "sameAs", "likelihood", "note"]) assert.ok(p.includes(`- ${k}:`), k);
  assert.ok(p.includes("Sat out a challenge"), "the scoring moments, to judge against");
  assert.match(p, /\{"checks": \[\{"n": 1, "seen": true, "likely": true, "scoring": false, "spoiler": false, "sameAs": null, "likelihood": "maybe", "note": ""\}\]\}/);
  const season = B.buildCheckPrompt({ ...base, episode: null, squares: [sq("It rains")] });
  assert.match(season, /for any episode of the season/);
  assert.ok(!/hasn't aired/.test(season));
});

test("the check's answer: given outright to pass, an earlier square for sameAs, a likelihood it can correct", () => {
  const text = "```json\n" + JSON.stringify({
    checks: [
      { n: 1, seen: true, likely: true, scoring: false, spoiler: false, sameAs: null, likelihood: "Long shot", note: "" },
      { n: 2, seen: true, likely: true, sameAs: 1 },
      { n: 3, seen: true, likely: true, scoring: false, spoiler: false, sameAs: 3 },
      { n: 3, seen: false },
      { n: 9, seen: true },
    ],
  }) + "\n```";
  const v = B.parseCheckAnswer(text, 4);
  assert.deepEqual(v[0], { seen: true, likely: true, scoring: false, spoiler: false, sameAs: null, likelihood: "longshot", note: null });
  assert.equal(v[1].scoring, true, "scoring not said: not passed");
  assert.equal(v[1].spoiler, true);
  assert.equal(v[1].sameAs, 1);
  assert.equal(v[2].sameAs, null, "itself isn't an earlier square");
  assert.equal(v[2].seen, true, "the first verdict for a square stands");
  assert.equal(v[3], null, "not checked");
  assert.throws(() => B.parseCheckAnswer("no idea", 2));
});

test("judged: each square's verdict, the parse's drops kept, a duplicate only of a square still live", () => {
  const squares = [
    sq("It rains"),
    sq("Too long a square to keep at all for anything", "maybe", "dropped", "too long for a square"),
    sq("Rain at camp"),
    sq("A shark appears", "longshot"),
    sq("Jeff says the tribe has spoken", "likely"),
    sq("Kyle goes home"),
    sq("Sat at Tribal"),
    sq("Someone sits at Tribal"),
    sq("Someone cries", "likely"),
  ];
  // One verdict for each square the parse kept (8), in order.
  const checks = [
    verdict({ likelihood: "likely" }),
    verdict({ sameAs: 1, note: "both rain" }),
    verdict({ likely: false, note: "rare" }),
    verdict({ likely: false, note: "every episode" }),
    verdict({ spoiler: true }),
    verdict({ seen: false }),
    verdict({ sameAs: 6 }),
    null,
  ];
  const out = B.judged(squares, checks);
  const by = (label) => out.find((s) => s.label === label);
  assert.deepEqual(by("It rains"), { label: "It rains", likelihood: "likely", status: "live", note: null }, "live, its likelihood corrected");
  assert.equal(by("Too long a square to keep at all for anything").note, "too long for a square", "the parse's drop stands");
  assert.equal(by("Rain at camp").note, 'the check: the same moment as "It rains" (both rain)');
  assert.equal(by("A shark appears").note, "the check: too rare, or too certain, to be a square (rare)");
  assert.equal(by("Jeff says the tribe has spoken").status, "dropped");
  assert.equal(by("Kyle goes home").note, "the check: gives something away");
  assert.equal(by("Sat at Tribal").note, "the check: not something you'd see on screen");
  assert.equal(by("Someone sits at Tribal").status, "live", "the same as a square the check dropped: kept");
  assert.equal(by("Someone cries").note, "the check: not checked");
  assert.equal(out.length, squares.length);
  assert.equal(B.BOT_MIN, 16);
});
