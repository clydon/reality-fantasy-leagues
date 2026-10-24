// Stage 3's core (docs/PLAN-stage-3-format-proposals.md): a research proposal for a show nobody
// hand-wrote becomes a reviewable format -- every problem at the row it's about, sloppy rows repaired
// out loud -- and the approved data runs through research and scoring like a built-in format, via
// formats/custom.js and formatFor(id, data). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../src/lib/game/formats/proposal.js");
const Formats = require("../src/lib/game/formats/index.js");
const { buildDataFormat } = require("../src/lib/game/formats/custom.js");
const R = require("../db/episode-research.js");
const { termsFor } = require("../db/wiki-sync.js");

// What a chat might send back for Love Island, sloppiness included: a key that isn't camelCase, a
// question every format already asks, a tier-D question, a points value as text, and an exit that
// scores nothing.
const answer = () => ({
  show: { name: "Love Island (UK)", castawayTerm: "islander", tribeTerm: "Couple", hasMerge: false, hasGroups: true },
  seasonsChecked: ["Series 5", "Series 9", "Series 10", "Series 11"],
  exitMethods: [
    { name: "Dumped", kind: "out", meaning: "Voted out by the public or the Islanders" },
    { name: "Walked", kind: "out", meaning: "Left by choice" },
    { name: "Finalist", kind: "finalist", meaning: "Reached the final without winning" },
    { name: "Winner", kind: "winner", meaning: "Won the series" },
  ],
  questions: [
    { key: "wonChallenge", type: "answer", question: "Did they win this episode's challenge?", note: "won the challenge", tier: "A", where: "every recap" },
    { key: "at risk", type: "answer", question: "Were they in the bottom, at risk of being dumped?", note: "at risk", tier: "A", where: "every recap names the bottom couples" },
    { key: "dumpingVotes", type: "integer", question: "How many votes to dump them did they receive? Null if no vote.", note: "dumping votes", tier: "B", where: "counted from the vote" },
    { key: "votedToDump", type: "string", question: "Who did they vote to dump? Null if they didn't vote.", tier: "C", where: "most recaps list the votes" },
    { key: "leftTheGame", type: "answer", question: "Did they leave?", tier: "A" },
    { key: "fancies", type: "string", question: "Who do they fancy?", tier: "D", where: "speculation" },
  ],
  events: [
    { id: "wonChallenge", label: "Won a challenge", category: "Challenges", points: 2, tier: "A", why: "always reported", headline: true },
    { id: "survivedDumping", label: "At risk and survived", category: "Dumpings", points: "2", tier: "A", why: "the bottom is always named" },
    { id: "Voted With Dumping", label: "Voted to dump the Islander who left", category: "Dumpings", points: 1, tier: "C", why: "votes are listed most weeks" },
    { id: "votedAgainst", label: "Voted to dump someone who stayed", category: "Dumpings", points: 0, tier: "C", why: "the mirror" },
    { id: "dumped", label: "Dumped", category: "Leaving", points: -3, tier: "A", why: "how they left" },
    { id: "reachedFinal", label: "Reached the final", category: "Endgame", points: 4, tier: "A", why: "" },
    { id: "wonSeries", label: "Won the series", category: "Endgame", points: 8, tier: "A", why: "" },
  ],
  rules: {
    research: [
      { when: { answer: "wonChallenge", is: "yes" }, award: "wonChallenge" },
      { when: { all: [{ answer: "atRisk", is: "yes" }, { answer: "leftTheGame", isNot: "yes" }] }, award: "survivedDumping" },
      { when: { answer: "leftTheGame", isNot: "yes" }, builtIn: "votedForLeaver", vote: "votedToDump", exitMethod: "Dumped", award: "votedWithDumping", otherwise: "votedAgainst" },
    ],
    implied: [
      { whenExit: "Dumped", award: "dumped" },
      { whenExit: ["Finalist", "Winner"], award: "reachedFinal" },
      { whenExit: "Winner", award: "wonSeries" },
    ],
  },
  notTrackable: [{ fact: "Who's genuinely in love", why: "speculation" }],
  flagged: [{ name: "Casa Amor", what: "A second villa for a few episodes", whyCode: "Couples split across two groups temporarily", findings: "Series 5-11 all have it" }],
  domains: [{ domain: "https://www.itv.com/loveisland", why: "the broadcaster" }, { domain: "digitalspy.com", why: "recaps" }],
  sources: ["https://example.com/recap"],
});

test("the prompt asks for primitives, tiers and rules in the app's language", () => {
  const prompt = P.buildProposalPrompt({ showName: "Love Island (UK)", wikiUrl: "https://loveisland.fandom.com", terms: { castaway: "Islander" } });
  for (const want of ['"Love Island (UK)"', "https://loveisland.fandom.com", "PRIMITIVES", "D -- rarely", "notTrackable", "flagged", '"whenExit"', "votedForLeaver [research rules", '"seasonsChecked"', "camelCase"]) {
    assert.ok(prompt.includes(want), want);
  }
  assert.ok(!/\n\n\n/.test(prompt), "no runs of blank lines");
  // A data-only format has no secret roles yet, so the built-ins that need them aren't offered.
  assert.ok(!prompt.includes("roleWonEpisode") && prompt.includes("Secret"));
});

test("a pasted answer parses with chatter around it, and fails with a reason otherwise", () => {
  assert.deepEqual(P.parseProposal('Here you go!\n```json\n{"show":{"name":"X"}}\n```\nEnjoy'), { show: { name: "X" } });
  assert.throws(() => P.parseProposal("no json here"), /no JSON object/);
  assert.throws(() => P.parseProposal("{ show: oops }"), /doesn't parse/);
});

test("a sloppy proposal is repaired out loud and becomes approvable format data", () => {
  const review = P.reviewProposal(answer());
  assert.deepEqual(review.problems, []);
  assert.equal(review.approvable, true);
  assert.equal(review.id, "love-island-uk");

  const repairs = review.repairs.map((r) => `${r.at}: ${r.message}`);
  assert.ok(repairs.includes(`questions[atRisk]: key "at risk" isn't camelCase; renamed atRisk`));
  assert.ok(repairs.includes(`events[votedWithDumping]: id "Voted With Dumping" isn't camelCase; renamed votedWithDumping`));
  assert.ok(repairs.some((r) => /leftTheGame is asked on every format already/.test(r)));
  assert.ok(repairs.some((r) => /questions\[fancies\]: tier D: moved/.test(r)));
  assert.deepEqual(review.notTrackable.map((x) => x.fact), ["Who's genuinely in love", "Who do they fancy?"]);

  const warnings = review.warnings.map((w) => `${w.at}: ${w.message}`);
  assert.ok(warnings.includes("exits[Walked]: leaving this way scores nothing"));
  assert.ok(warnings.includes("questions[dumpingVotes]: no rule reads it: asked every episode, never scored"));
  assert.ok(warnings.includes("questions[votedToDump]: tier C: reported often but not always"));

  const d = review.data;
  assert.deepEqual(Formats.formatProblems(d), []);
  assert.deepEqual(d.exitMethods, ["Dumped", "Walked", "Finalist", "Winner", "Other"], "Other added");
  assert.equal(d.winnerExitMethod, "Winner");
  assert.deepEqual(d.endgameExitMethods, ["Finalist", "Winner"]);
  assert.deepEqual(d.terms, { castaway: "Islander", tribe: "Couple" });
  assert.deepEqual(d.events.filter((e) => e.implied).map((e) => e.id), ["dumped", "reachedFinal", "wonSeries"], "implied comes from the rules");
  assert.equal(d.events.find((e) => e.id === "survivedDumping").defaultPoints, 2, "points given as text");
  assert.deepEqual(d.eventCategories.map((c) => c.label), ["Challenges", "Dumpings", "Leaving", "Endgame"]);
  assert.deepEqual(d.recap, [{ label: "Won a challenge", events: ["wonChallenge"] }]);
  assert.deepEqual(d.research.checklist.map((f) => f.key), ["name", "leftTheGame", "exitMethod", "wonChallenge", "atRisk", "dumpingVotes", "votedToDump", "sources", "confidence"]);
  assert.deepEqual(d.research.claims, ["leftTheGame", "wonChallenge", "atRisk"]);
  // Nothing review-only leaks into the data half.
  assert.ok(!JSON.stringify(d).includes("tier"));

  // The screen's rows: grouped, each event with the rules that award it as sentences.
  const dumpings = review.categories.find((c) => c.label === "Dumpings");
  assert.deepEqual(dumpings.events.find((e) => e.id === "survivedDumping").rules, [
    { at: "rules.research[1]", sentence: "When at risk is yes and left the game isn't yes → At risk and survived" },
  ]);
  assert.match(dumpings.events.find((e) => e.id === "votedWithDumping").rules[0].sentence, /Voted for someone who left this episode by Dumped: Voted to dump the Islander who left/);
  assert.deepEqual(review.flagged.map((f) => f.name), ["Casa Amor"]);
  assert.deepEqual(review.domains, [
    { domain: "itv.com", why: "the broadcaster", preChecked: false },
    { domain: "digitalspy.com", why: "recaps", preChecked: true },
  ]);
});

test("problems land on the row they're about", () => {
  const broken = answer();
  broken.rules.research.push({ when: { answer: "wonVeto", is: "yes" }, award: "wonChallenge" });
  broken.rules.research.push({ when: { answer: "atRisk", is: "yes" }, award: "dumped" });
  broken.events[0].points = "lots";
  broken.questions[2].type = "number";
  broken.exitMethods[3].kind = "out";
  const review = P.reviewProposal(broken);
  assert.equal(review.approvable, false);
  const at = (where) => review.problems.filter((p) => p.at === where).map((p) => p.message).join("; ");
  assert.match(at("rules.research[3]"), /no checklist question "wonVeto"/);
  assert.match(at("events[dumped]"), /awarded by both a research rule and an exit rule/);
  assert.match(at("events[wonChallenge]"), /points must be a number/);
  assert.match(at("questions[dumpingVotes]"), /type must be one of/);
  assert.match(at("format"), /exactly one exit method must be the winner \(found 0\)/);
  // The row on the screen carries its own problems.
  const row = review.categories.flatMap((c) => c.events).find((e) => e.id === "wonChallenge");
  assert.deepEqual(row.problems, ["points must be a number"]);
  // A bad row is left out of the data rather than failing it: the rest still builds.
  assert.ok(!review.data.events.some((e) => e.id === "wonChallenge"));
  assert.ok(review.data.events.some((e) => e.id === "survivedDumping"));

  assert.match(P.reviewProposal({}).problems.map((p) => p.message).join("; "), /the show's name is missing.*rules must have a research list/);
});

test("formatFor resolves a stored format from its data, and never shadows a built-in", () => {
  const { data } = P.reviewProposal(answer());
  const f = Formats.formatFor(data.id, data);
  assert.equal(f.name, "Love Island (UK)");
  assert.equal(Formats.formatFor(data.id, data), f, "built once per data object");
  assert.equal(Formats.formatFor(data.id).id, "survivor", "no data: the default, as for any unknown id");
  assert.equal(Formats.formatFor("other-id", data).id, "survivor", "data for a different id is ignored");
  assert.equal(Formats.formatFor("traitors", { ...data, id: "traitors" }).id, "traitors", "a built-in id is always the built-in");
  assert.ok(Formats.isBuiltInFormat("generic") && !Formats.isBuiltInFormat(data.id) && !Formats.isBuiltInFormat("toString"));
  // Secret roles in a data-only format (step R2): a recorded value is the role it names, unless `becomes` maps it.
  const roles = buildDataFormat({ ...data, roles: { default: "A", values: ["B", "Recruited B"], becomes: { "Recruited B": "B" } } }).roles;
  assert.deepEqual([roles.roleFor("B"), roles.roleFor("Recruited B")], ["B", "B"]);
  assert.match(Formats.formatProblems({ ...data, roles: { default: "A", values: ["B"], becomes: { C: "B" } } }).join(), /roles.becomes: C isn't one of the role values/);
});

test("an approved proposal runs through research and scoring end to end", () => {
  const { data } = P.reviewProposal(answer());
  const format = Formats.formatFor(data.id, data);
  const cast = ["Amber Gill", "Greg O'Shea", "Molly-Mae Hague", "Tommy Fury"];
  const ctx = { showName: data.name, showSlug: "love-island", season: 5, episodeNumber: 40, castNames: cast, terms: termsFor({ castaway_term: "Islanders" }).terms, format, domains: [] };

  // The prompt asks every question, and every provider dialect accepts the schema.
  const prose = R.buildPastePrompt(ctx, []);
  for (const f of data.research.checklist.filter((x) => !["name", "sources", "confidence"].includes(x.key))) {
    assert.ok(prose.includes(f.description.replace(/\bNull\b/g, "None")), f.key);
  }
  for (const dialect of ["strict", "gemini"]) {
    const item = R.jsonSchemaFor(R.researchSchemaFor(format, false), dialect).properties.castaways.items;
    // ...plus the group move every grouped format is asked (db/episode-research.js researchSchemaFor).
    const keys = data.research.checklist.map((f) => f.key).concat(data.hasGroups ? ["newGroup"] : []);
    assert.deepEqual(Object.keys(item.properties), keys, dialect);
  }

  const skel = R.pasteSkeleton(ctx, []);
  const fill = (name, fields) => Object.assign(skel.castaways.find((c) => c.name === name), { sources: ["https://example.com"], confidence: "high" }, fields);
  fill("Amber Gill", { wonChallenge: "yes", atRisk: "yes", dumpingVotes: 1, votedToDump: "Molly-Mae" });
  fill("Greg O'Shea", { atRisk: "yes", votedToDump: "Tommy Fury" });
  fill("Molly-Mae Hague", { atRisk: "yes", leftTheGame: "yes", exitMethod: "Dumped", dumpingVotes: 3 });
  fill("Tommy Fury", { leftTheGame: "yes", exitMethod: "Walked" });
  const parsed = R.parseJsonAnswer(R.extractJsonObject(JSON.stringify(skel)), R.researchSchemaFor(format, false), "li");
  const review = R.validateResearch(parsed, cast, ctx.terms, format);
  assert.deepEqual(review.fatal, []);
  assert.deepEqual(R.candidatesFor(parsed, format).map((i) => `${i.castawayName}:${i.kind}:${i.eventType || i.method}`), [
    "Amber Gill:event:wonChallenge",
    "Amber Gill:event:survivedDumping",
    "Amber Gill:event:votedWithDumping",
    "Greg O'Shea:event:survivedDumping",
    "Greg O'Shea:event:votedAgainst",
    "Molly-Mae Hague:elimination:Dumped",
    "Tommy Fury:elimination:Walked",
  ]);

  // Reviewer notes come from each question's note.
  assert.deepEqual(format.research.notes(review.entries[0]), ["won the challenge", "at risk", "dumping votes: 1", "voted to dump: Molly-Mae"]);
  assert.deepEqual(format.research.notes(review.entries[2]), ["OUT — Dumped", "at risk", "dumping votes: 3"]);

  // Exits score through the implied rules; the wiki read knows this format's exits.
  assert.deepEqual(format.impliedEvents({ number: 41, events: [{ castawayId: "g", method: "Finalist" }, { castawayId: "a", method: "Winner" }, { castawayId: "t", method: "Walked" }] }, {}).map((e) => `${e.type}:${e.castawayId}`), ["reachedFinal:g", "reachedFinal:a", "wonSeries:a"]);
  const { z } = require("zod");
  assert.deepEqual(z.toJSONSchema(format.wiki.episodesSchema(z)).properties.episodes.items.properties.eliminations.items.properties.method.enum, data.exitMethods);
});
