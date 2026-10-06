// Scoring rules as data (src/lib/game/formats/rules.js, docs/PLAN-scoring-rules-as-data.md): rules
// evaluate the way each condition and built-in says, bad rules are refused with a reason, and a format
// nobody hand-wrote -- with its own rules, including a library built-in -- scores through research end
// to end. Run with `npm test`.
//
// That the four shipped formats score exactly as their hand-written functions did is proven separately,
// by diffing tests/harness/format-regression.js's output from before and after.
const test = require("node:test");
const assert = require("node:assert/strict");
const Rules = require("../src/lib/game/formats/rules.js");
const { defineFormat, formatProblems } = require("../src/lib/game/formats/define.js");
const Formats = require("../src/lib/game/formats/index.js");
const R = require("../db/episode-research.js");
const { termsFor } = require("../db/wiki-sync.js");

// What research.items stages for one entry, as [kind, eventType, method?] calls.
const stage = (rules, entry, ctx) => {
  const got = [];
  Rules.researchItemsFrom(rules)(entry, (...a) => got.push(a), ctx);
  return got;
};
const events = (rules, entry, ctx) => stage(rules, entry, ctx).map((a) => a[1]);

test("each test reads one answer the way it says", () => {
  const rule = (when) => [{ when, award: "x" }];
  const fires = (when, entry) => events(rule(when), entry).length === 1;
  assert.ok(fires({ answer: "a", is: "yes" }, { a: "yes" }));
  assert.ok(!fires({ answer: "a", is: "yes" }, { a: "Yes" }), "exact match only");
  assert.ok(fires({ answer: "a", isNot: "yes" }, {}), "a missing answer isn't yes");
  assert.ok(fires({ answer: "n", equals: 0 }, { n: 0 }));
  assert.ok(!fires({ answer: "n", equals: 0 }, { n: "0" }), "equals is strict");
  assert.ok(fires({ answer: "n", greaterThan: 0 }, { n: 2 }));
  assert.ok(!fires({ answer: "n", greaterThan: 0 }, { n: "2" }), "greaterThan only counts a number");
  assert.ok(!fires({ answer: "n", greaterThan: 0 }, { n: null }));
  assert.ok(fires({ answer: "l", present: true }, { l: ["Ada"] }));
  assert.ok(fires({ answer: "l", present: true }, { l: "Ada" }), "a list given as one string counts");
  assert.ok(!fires({ answer: "l", present: true }, { l: ["", null] }), "blanks don't count");
  assert.ok(fires({ answer: "l", present: false }, { l: [] }));
});

test("conditions combine with all, any and not", () => {
  const when = { all: [{ answer: "a", is: "yes" }, { any: [{ answer: "b", is: "yes" }, { not: { answer: "c", isNot: "no" } }] }] };
  const fires = (entry) => events([{ when, award: "x" }], entry).length === 1;
  assert.ok(fires({ a: "yes", b: "yes" }));
  assert.ok(fires({ a: "yes", c: "no" }));
  assert.ok(!fires({ a: "yes", b: "no", c: "unknown" }));
  assert.ok(!fires({ a: "no", b: "yes" }));
});

test("results come out in rule order, not deduplicated, with exile and role stages", () => {
  const rules = [
    { when: { answer: "a", is: "yes" }, award: "second" },
    { when: { answer: "a", is: "yes" }, stage: "exiled" },
    { when: { answer: "a", is: "yes" }, award: "first" },
    { when: { answer: "a", is: "yes" }, award: "second" },
    { when: { answer: "a", is: "yes" }, stage: "role", role: "Mole" },
  ];
  // Exactly the add() calls the hand-written functions made: an exile's eventType is '', a role's
  // value rides as the method.
  assert.deepEqual(stage(rules, { a: "yes" }), [["event", "second"], ["exiled", ""], ["event", "first"], ["event", "second"], ["role", "", "Mole"]]);
});

test("built-ins look across people", () => {
  const voted = [{ when: { answer: "leftTheGame", isNot: "yes" }, builtIn: "votedForLeaver", vote: "votedFor", exitMethod: "Voted Out", award: "with", otherwise: "against" }];
  const payload = { castaways: [{ name: "Ada Lovelace", leftTheGame: "yes", exitMethod: "Voted Out" }, { name: "Grace Hopper", leftTheGame: "yes", exitMethod: "Quit" }] };
  const firstName = (a, b) => a.split(" ")[0].toLowerCase() === b.split(" ")[0].toLowerCase();
  assert.deepEqual(events(voted, { votedFor: "Ada", leftTheGame: "no" }, { payload, same: firstName }), ["with"]);
  assert.deepEqual(events(voted, { votedFor: "Ada", leftTheGame: "no" }, { payload }), ["against"], "without ctx.same, names match case- and space-insensitively only");
  assert.deepEqual(events(voted, { votedFor: " ada lovelace", leftTheGame: "no" }, { payload }), ["with"]);
  assert.deepEqual(events(voted, { votedFor: "Grace Hopper", leftTheGame: "no" }, { payload }), ["against"], "a quit isn't a vote-out");
  assert.deepEqual(events(voted, { votedFor: "Ada", leftTheGame: "yes" }, { payload }), [], "the when gate");
  assert.deepEqual(events(voted, { votedFor: "Ada" }, { payload: { castaways: [] } }), [], "nobody went home: nothing to be against");

  const role = { exitMethod: "Banished", isRole: { answer: "mole", is: "yes" }, notRole: { answer: "mole", is: "no" } };
  const awards = { roleOnRole: "rr", otherOnRole: "or", roleOnOther: "ro", otherOnOther: "oo" };
  const byVote = [{ builtIn: "voteByRole", votes: "votedFor", ...role, ...awards }];
  const byCase = [{ builtIn: "caseLeadByRole", accusations: "accusedBy", ...role, ...awards }];
  const banished = (name, mole, accusedBy) => ({ name, leftTheGame: "yes", exitMethod: "Banished", mole, accusedBy });
  const room = { castaways: [banished("Mo", "yes", ["Al"]), banished("Fay", "no", "Al"), banished("Unk", "unknown", ["Al"])] };
  assert.deepEqual(events(byVote, { name: "Al", mole: "no", votedFor: ["Mo", "Fay", "Unk", "Nobody"] }, { payload: room }), ["or", "oo"], "an unknown role on either side scores nothing");
  assert.deepEqual(events(byVote, { name: "Al", mole: "yes", votedFor: "Fay" }, { payload: room }), ["ro"]);
  assert.deepEqual(events(byCase, { name: "Al", mole: "yes" }, { payload: room }), ["rr", "ro"]);
  assert.deepEqual(events(byCase, { name: "Al", mole: "unknown" }, { payload: room }), []);
  // isRole wins over notRole when the answers disagree.
  const both = { ...role, isRole: { answer: "chosen", is: "yes" } };
  assert.deepEqual(events([{ builtIn: "voteByRole", votes: "votedFor", ...both, ...awards }], { mole: "no", chosen: "yes", votedFor: ["Fay"] }, { payload: room }), ["ro"]);
});

test("votedForLeavers: naming anyone who left, no roles needed (an extra-vote twist)", () => {
  const votedPlural = [{ builtIn: "votedForLeavers", votes: "votedFor", exitMethod: "Dumped", award: "with", otherwise: "against" }];
  const payload = { castaways: [{ name: "Ada", leftTheGame: "yes", exitMethod: "Dumped" }, { name: "Grace", leftTheGame: "yes", exitMethod: "Dumped" }] };
  assert.deepEqual(events(votedPlural, { votedFor: ["Bea", "Ada"] }, { payload }), ["with"], "any one of several names matching a leaver is enough");
  assert.deepEqual(events(votedPlural, { votedFor: ["Ada", "Grace"] }, { payload }), ["with"], "still one award, not one per match");
  assert.deepEqual(events(votedPlural, { votedFor: "Ada" }, { payload }), ["with"], "a single string still works, not just a list");
  assert.deepEqual(events(votedPlural, { votedFor: ["Bea", "Cy"] }, { payload }), ["against"], "named people, none of whom left");
  assert.deepEqual(events(votedPlural, { votedFor: [] }, { payload }), [], "no votes cast: neither award");
  assert.deepEqual(events(votedPlural, { votedFor: ["Bea"] }, { payload: { castaways: [] } }), [], "nobody went home: nothing to be against");
});

test("implied rules follow exits, exiles and roles, fact by fact", () => {
  const rules = [
    { whenExit: "Out", award: "out" },
    { whenExit: ["Final", "Champ"], award: "final" },
    { whenExit: ["Final", "Champ"], award: "vote", per: "juryVotes" },
    { whenExit: ["Final", "Champ"], when: { fact: "juryVotes", equals: 0 }, award: "goat" },
    { whenExit: "Out", when: { all: [{ fact: "finale", is: "no" }, { fact: "role", is: "Mole" }] }, award: "caught" },
    { whenExit: "Final", when: { fact: "role", isNot: "Mole" }, builtIn: "roleWonEpisode", role: "Mole", award: "fooled" },
    { whenRole: "Recruited", award: "recruited" },
    { whenExiled: true, award: "exiled" },
  ];
  const implied = Rules.impliedEventsFrom(rules, { winnerExitMethod: "Champ" });
  const roleOf = (cid, n) => (cid === "m" && n === 4 ? "Mole" : "Player");
  const ids = (ep) => implied(ep, { roleOf }).map((e) => `${e.type}:${e.castawayId}`);
  // Exits first (their first rule comes first), each exit through every rule in order, then roles,
  // then exiles.
  assert.deepEqual(ids({ number: 4, events: [{ castawayId: "m", method: "Out" }], roles: [{ castawayId: "r", role: "Recruited" }], exiled: [{ castawayId: "x" }] }), ["out:m", "caught:m", "recruited:r", "exiled:x"]);
  assert.deepEqual(ids({ number: 3, events: [{ castawayId: "m", method: "Out" }] }), ["out:m"], "role as of the episode");
  assert.deepEqual(
    ids({ number: 4, events: [{ castawayId: "a", method: "Final", juryVotes: 0 }, { castawayId: "m", method: "Champ", juryVotes: 2 }, { castawayId: "b", method: "Final" }] }),
    ["final:a", "goat:a", "fooled:a", "final:m", "vote:m", "vote:m", "final:b", "fooled:b"],
    "per counts only a known whole number; the goat only a known zero",
  );
  assert.deepEqual(ids({ number: 4, events: [{ castawayId: "a", method: "Final", juryVotes: 1.5 }, { castawayId: "c", method: "Champ" }] }), ["final:a", "final:c"], "a Player won: nobody was fooled");
  assert.deepEqual(ids({ number: 1 }), []);
});

// ---------- validation ----------

const shipped = (id) => structuredClone(Formats.formatFor(id).data);
// formatProblems for Survivor's data with one rule replaced.
const withRule = (list, rule, id = "survivor") => {
  const data = shipped(id);
  data.rules[list] = [rule];
  return formatProblems(data).join("; ");
};

test("the shipped formats' rules are valid, and split between data and built-ins as recorded", () => {
  const counts = {};
  for (const id of Object.keys(Formats.FORMATS)) {
    const { rules } = Formats.formatFor(id).data;
    assert.deepEqual(Rules.rulesProblems(rules, Formats.formatFor(id).data), [], id);
    counts[id] = { research: Rules.ruleCounts(rules.research), implied: Rules.ruleCounts(rules.implied) };
  }
  // The "how much fits" numbers in docs/PLAN-scoring-rules-as-data.md. A change here is a change to
  // how a format scores: update the plan's table with it.
  assert.deepEqual(counts, {
    survivor: { research: { data: 17, builtIn: 1, builtIns: ["votedForLeaver"] }, implied: { data: 9, builtIn: 0, builtIns: [] } },
    traitors: { research: { data: 14, builtIn: 2, builtIns: ["voteByRole", "caseLeadByRole"] }, implied: { data: 9, builtIn: 1, builtIns: ["roleWonEpisode"] } },
    challenge: { research: { data: 4, builtIn: 0, builtIns: [] }, implied: { data: 6, builtIn: 0, builtIns: [] } },
    generic: { research: { data: 2, builtIn: 0, builtIns: [] }, implied: { data: 4, builtIn: 0, builtIns: [] } },
  });
});

test("rules that refer to something that doesn't exist, or can't be tested that way, are refused with a reason", () => {
  const cases = [
    [{ when: { answer: "wonImunity", is: "yes" }, award: "individualImmunity" }, /answer: no checklist question "wonImunity"/],
    [{ when: { answer: "wonIndividualImmunity", is: "maybe" }, award: "individualImmunity" }, /isn't a possible value of wonIndividualImmunity \(yes, no, unknown\)/],
    [{ when: { answer: "wonIndividualImmunity", greaterThan: 0 }, award: "individualImmunity" }, /greaterThan: "wonIndividualImmunity" is answer, which takes is \/ isNot/],
    [{ when: { answer: "votesReceived", is: "2" }, award: "survivedVotes" }, /is: "votesReceived" is integer, which takes equals \/ greaterThan/],
    [{ when: { answer: "votesReceived", equals: "2" }, award: "survivedVotes" }, /equals: a number/],
    [{ when: { answer: "confidence", is: "certain" }, award: "satOut" }, /isn't a possible value of confidence \(high, medium, low\)/],
    [{ when: { answer: "exitMethod", is: "Banished" }, award: "satOut" }, /isn't a possible value of exitMethod/],
    [{ when: { answer: "sources", present: "yes" }, award: "satOut" }, /present: true or false/],
    [{ when: { answer: "satOutOfChallenge", is: "yes" }, award: "satOutt" }, /award: no event "satOutt" in the catalog/],
    [{ when: { answer: "satOutOfChallenge", is: "yes" }, award: "votedOut" }, /votedOut is implied .* so research can't award it/],
    [{ award: "satOut" }, /when: missing/],
    [{ when: { answer: "satOutOfChallenge", is: "yes" }, award: "satOut", stage: "exiled" }, /award and stage: one or the other/],
    [{ when: { answer: "exiled", is: "yes" }, stage: "role", role: "Traitor" }, /stage: this format has no roles to stage/],
    [{ when: { answer: "exiled", is: "yes" }, stage: "banished" }, /stage: one of exiled, role/],
    [{ when: { all: [] }, award: "satOut" }, /when: all: a non-empty list of conditions/],
    [{ when: { answer: "satOutOfChallenge", is: "yes", not: { answer: "exiled", is: "yes" } }, award: "satOut" }, /not must be alone in its condition/],
    [{ when: { answer: "satOutOfChallenge", is: "yes", isNot: "no" }, award: "satOut" }, /needs exactly one test/],
    [{ when: { fact: "juryVotes", equals: 0 }, award: "satOut" }, /only an exit rule reads facts/],
    [{ when: { answer: "satOutOfChallenge", is: "yes" }, award: "satOut", points: 3 }, /unknown key "points"/],
    [{ whenExit: "Voted Out", award: "votedOut" }, /whenExit belongs in the implied rules/],
    [{ builtIn: "votedWithMajority" }, /no built-in called "votedWithMajority" \(there are: votedForLeaver/],
    [{ builtIn: "roleWonEpisode", role: "Traitor", award: "finalist" }, /roleWonEpisode is for the implied rules/],
    [{ builtIn: "votedForLeaver", vote: "votedFor", exitMethod: "Voted Out", award: "votedWithMajority" }, /otherwise: missing \(votedForLeaver needs it\)/],
    [{ builtIn: "votedForLeaver", vote: "votesReceived", exitMethod: "Voted Out", award: "votedWithMajority", otherwise: "votedAgainstMajority" }, /vote: votesReceived is integer; votedForLeaver reads string/],
    [{ builtIn: "votedForLeaver", vote: "votedFor", exitMethod: "Banished", award: "votedWithMajority", otherwise: "votedAgainstMajority" }, /exitMethod: "Banished" isn't one of the format's exit methods/],
  ];
  for (const [rule, why] of cases) assert.match(withRule("research", rule), why, JSON.stringify(rule));

  const implied = [
    [{ award: "votedOut" }, /needs exactly one of whenExit, whenExiled, whenRole/],
    [{ whenExit: "Booted", award: "votedOut" }, /whenExit: "Booted" isn't one of the format's exit methods/],
    [{ whenExit: [], award: "votedOut" }, /whenExit: an exit method or a non-empty list/],
    [{ whenExit: "Voted Out", award: "satOut" }, /satOut isn't marked implied, so it could also be added by hand/],
    [{ whenExit: "Voted Out", award: "votedOut", per: "votes" }, /per: must be a whole-number exit fact \(juryVotes\)/],
    [{ whenExit: "Voted Out", when: { answer: "exiled", is: "yes" }, award: "votedOut" }, /an implied rule reads recorded facts, not research answers/],
    [{ whenExit: "Voted Out", when: { fact: "tribe", is: "x" }, award: "votedOut" }, /no exit fact "tribe" \(there are: juryVotes, role, finale\)/],
    [{ whenExit: "Voted Out", when: { fact: "role", is: "Traitor" }, award: "votedOut" }, /fact: this format has no roles/],
    [{ whenExit: "Voted Out", when: { fact: "finale", is: "true" }, award: "votedOut" }, /isn't a possible value of finale \(yes, no\)/],
    [{ whenExiled: "yes", award: "wentToExile" }, /whenExiled: true/],
    [{ whenExiled: true, when: { fact: "finale", is: "yes" }, award: "wentToExile" }, /only an exit rule has facts to test/],
    [{ whenRole: "Traitor", award: "wentToExile" }, /whenRole: this format has no roles/],
    [{ whenExit: "Voted Out", builtIn: "votedForLeaver" }, /votedForLeaver is for the research rules/],
    [{ whenExiled: true, builtIn: "roleWonEpisode", role: "Traitor", award: "wentToExile" }, /an implied built-in runs per exit, so it needs whenExit/],
  ];
  for (const [rule, why] of implied) assert.match(withRule("implied", rule), why, JSON.stringify(rule));

  // Roles are checked against the format's own (The Traitors).
  assert.match(withRule("implied", { whenRole: "Spy", award: "recruited" }, "traitors"), /whenRole: "Spy" isn't one of the format's role values \(Traitor, Recruited Traitor\)/);
  assert.match(withRule("implied", { whenExit: "Winner", when: { fact: "role", is: "Spy" }, award: "seasonWinner" }, "traitors"), /isn't a possible value of role \(Faithful, Traitor, Recruited Traitor\)/);
  assert.match(withRule("implied", { whenExit: "Finalist", builtIn: "roleWonEpisode", role: "Spy", award: "fooledToTheEnd" }, "traitors"), /role: "Spy" isn't a role in this format/);
  assert.match(withRule("research", { when: { answer: "isTraitor", is: "yes" }, stage: "role", role: "Faithful" }, "traitors"), /role: "Faithful" isn't one of the format's role values/);
  assert.match(
    withRule("research", { builtIn: "voteByRole", votes: "votedFor", exitMethod: "Banished", isRole: { answer: "isTraitr", is: "yes" }, notRole: { answer: "isTraitor", is: "no" }, roleOnRole: "turnedOnTraitor", otherOnRole: "votedOutTraitor", roleOnOther: "traitorVotedOutFaithful", otherOnOther: "votedOutFaithful" }, "traitors"),
    /isRole: answer: no checklist question "isTraitr"/,
  );

  // The rules themselves must be there.
  const data = shipped("generic");
  delete data.rules;
  assert.match(formatProblems(data).join(), /rules: missing/);
  assert.match(formatProblems({ ...shipped("generic"), rules: { research: [] } }).join(), /rules.implied: a list of rules/);
  assert.match(formatProblems({ ...shipped("generic"), rules: { research: [], implied: [], extra: [] } }).join(), /rules: unknown key "extra"/);
});

test("defineFormat builds items and impliedEvents from the rules; code can't supply them", () => {
  const f = Formats.formatFor("traitors");
  assert.equal(f.research.items.name, "researchItems");
  assert.equal(f.impliedEvents.name, "impliedEvents");
  const code = { wiki: { episodesSchema: () => null, episodesPrompt: () => null, rejectEvent: () => null }, research: { entryProblems: () => [], notes: () => [], sentences: () => [] } };
  const data = shipped("generic");
  assert.throws(() => defineFormat(data, { ...code, impliedEvents: () => [] }), /code can't supply "impliedEvents"/);
  assert.throws(() => defineFormat(data, { ...code, research: { ...code.research, items: () => {} } }), /"items" isn't something code supplies/);
  // Nothing implied: no impliedEvents at all (state-logic then scores only what was recorded).
  assert.ok(!("impliedEvents" in defineFormat({ ...data, rules: { ...data.rules, implied: [] } }, code)));
});

// ---------- a format nobody hand-wrote ----------

// What phase 3's research step might propose for a Love Island-style show: plain data, scoring
// included, using a library built-in with its own params for the one rule that reads everyone's
// answers.
const EXITS = ["Dumped", "Walked", "Finalist", "Winner", "Other"];
const CORE = [
  { key: "name", type: "string", description: "Their full name." },
  { key: "leftTheGame", type: "answer", description: "Did they leave the villa for good this episode?" },
  { key: "exitMethod", type: "exitMethod", nullable: true, description: "How they left. Null if they stayed." },
];
const loveIsland = {
  id: "love-island",
  name: "Love Island",
  exitMethods: EXITS,
  terms: { castaway: "Islander", tribe: "Couple" },
  winnerExitMethod: "Winner",
  endgameExitMethods: ["Finalist", "Winner"],
  events: [
    { id: "wonChallenge", label: "Won a challenge", defaultPoints: 2 },
    { id: "survivedDumping", label: "At risk of dumping and survived", defaultPoints: 2 },
    { id: "votedToDumpLeaver", label: "Voted to dump the Islander who left", defaultPoints: 1 },
    { id: "votedToDumpOther", label: "Voted to dump someone who stayed", defaultPoints: 0 },
    { id: "dumped", label: "Dumped", defaultPoints: -3, implied: true },
    { id: "walked", label: "Walked", defaultPoints: -5, implied: true },
    { id: "finalist", label: "Reached the final", defaultPoints: 4, implied: true },
    { id: "winner", label: "Won the season", defaultPoints: 8, implied: true },
  ],
  eventCategories: [
    { id: "villa", label: "In the villa", events: ["wonChallenge", "survivedDumping", "votedToDumpLeaver", "votedToDumpOther"] },
    { id: "leaving", label: "Leaving", events: ["dumped", "walked"] },
    { id: "endgame", label: "Endgame", events: ["finalist", "winner"] },
  ],
  recap: [{ label: "Challenge", events: ["wonChallenge"] }],
  hasMerge: false,
  hasGroups: true,
  wiki: {
    voteSections: ["Dumpings"],
    guideSections: ["Islanders"],
    missingVotesNote: "no dumping table",
    missingGuideNote: "no Islander table",
    eventTypes: [],
    routineEliminations: 2,
  },
  research: {
    checklist: [
      ...CORE,
      { key: "wonChallenge", type: "answer", description: "Did they win this episode's challenge?" },
      { key: "atRisk", type: "answer", description: "Were they in the bottom, at risk of being dumped?" },
      { key: "votedToDump", type: "string", nullable: true, description: "Who they voted to dump, if there was a vote. Null otherwise." },
      { key: "sources", type: "stringList", description: "URLs." },
      { key: "confidence", type: "enum", values: ["high", "medium", "low"], description: "How sure." },
    ],
    episodeFields: [{ key: "dumpingHeld", type: "answer" }],
    searchHint: ["Search for this episode's recap.", "", "Then answer the checklist."],
    claims: ["leftTheGame", "wonChallenge", "atRisk"],
  },
  rules: {
    research: [
      { when: { answer: "wonChallenge", is: "yes" }, award: "wonChallenge" },
      { when: { all: [{ answer: "atRisk", is: "yes" }, { answer: "leftTheGame", isNot: "yes" }] }, award: "survivedDumping" },
      { when: { answer: "leftTheGame", isNot: "yes" }, builtIn: "votedForLeaver", vote: "votedToDump", exitMethod: "Dumped", award: "votedToDumpLeaver", otherwise: "votedToDumpOther" },
    ],
    implied: [
      { whenExit: "Dumped", award: "dumped" },
      { whenExit: "Walked", award: "walked" },
      { whenExit: ["Finalist", "Winner"], award: "finalist" },
      { whenExit: "Winner", award: "winner" },
    ],
  },
};
const loveIslandCode = {
  wiki: { episodesSchema: (z) => z.object({ episodes: z.array(z.object({ number: z.number() })) }), episodesPrompt: () => ({ system: "s", user: "u" }), rejectEvent: () => null },
  research: { entryProblems: () => [], notes: () => [], sentences: () => [] },
};

test("a proposed format's rules run through research end to end", () => {
  assert.deepEqual(formatProblems(loveIsland), []);
  const format = defineFormat(loveIsland, loveIslandCode);
  const cast = ["Amber Gill", "Greg O'Shea", "Molly-Mae Hague", "Tommy Fury"];
  const ctx = { showName: "Love Island", showSlug: "li", season: 5, episodeNumber: 40, castNames: cast, terms: termsFor({ castaway_term: "Islanders" }).terms, format, domains: [] };

  const skel = R.pasteSkeleton(ctx, []);
  const fill = (name, fields) => Object.assign(skel.castaways.find((c) => c.name === name), { sources: ["https://example.com"], confidence: "high" }, fields);
  fill("Amber Gill", { wonChallenge: "yes", atRisk: "yes", votedToDump: "Tommy" });
  fill("Greg O'Shea", { atRisk: "yes", votedToDump: "molly-mae hague" });
  fill("Molly-Mae Hague", { atRisk: "yes", leftTheGame: "yes", exitMethod: "Dumped", votedToDump: "Greg O'Shea" });
  fill("Tommy Fury", { leftTheGame: "yes", exitMethod: "Walked" });
  const parsed = R.parseJsonAnswer(R.extractJsonObject("```json\n" + JSON.stringify(skel) + "\n```"), R.researchSchemaFor(format, false), "li");
  assert.deepEqual(R.validateResearch(parsed, cast, ctx.terms, format).fatal, []);

  const staged = R.candidatesFor(parsed, format).map((i) => `${i.castawayName}:${i.kind}:${i.eventType || i.method}`);
  assert.deepEqual(staged, [
    "Amber Gill:event:wonChallenge",
    "Amber Gill:event:survivedDumping",
    // Voted for Tommy, who walked rather than being dumped: someone was dumped, so that's a vote for
    // someone else.
    "Amber Gill:event:votedToDumpOther",
    "Greg O'Shea:event:survivedDumping",
    // "molly-mae hague" is matched to Molly-Mae Hague by who she is.
    "Greg O'Shea:event:votedToDumpLeaver",
    "Molly-Mae Hague:elimination:Dumped",
    "Tommy Fury:elimination:Walked",
  ]);

  // The exits it stages then score through the implied rules, on every read.
  const ep = { number: 40, events: [{ castawayId: "m", method: "Dumped" }, { castawayId: "t", method: "Walked" }] };
  assert.deepEqual(format.impliedEvents(ep, { roleOf: () => undefined }), [{ type: "dumped", castawayId: "m" }, { type: "walked", castawayId: "t" }]);
  const finale = { number: 41, events: [{ castawayId: "g", method: "Finalist" }, { castawayId: "a", method: "Winner" }] };
  assert.deepEqual(format.impliedEvents(finale, {}).map((e) => `${e.type}:${e.castawayId}`), ["finalist:g", "finalist:a", "winner:a"]);
});
