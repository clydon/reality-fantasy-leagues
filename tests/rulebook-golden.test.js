// The legacy freeze's golden tests (docs/PLAN-rulebooks-implementation.md T-10, T-11): every built-in's rulebook,
// compiled on its own reader, is its format exactly -- the same events, points, rules, questions and exits -- and
// scores the same. The harness's research answers (tests/harness/research-fixtures.js) stage the same results
// through either, the same exits, exile and roles imply the same events, and demo leagues of every type score
// the same played by the frozen format (settings.showFormat) or by the compiled rulebook (settings.rulebook).
// Every stored format compiles back onto its own data the same way. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { z } = require("zod");
const Formats = require("../src/lib/game/formats/index.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { rulebookFor } = require("../src/lib/game/formats/blocks/index.js");
const R = require("../db/episode-research.js");
const S = require("../src/lib/game/state-logic.js");
const { CAST, TERM_SETS, ctxFor, patterned, scenarios } = require("./harness/research-fixtures.js");
const { buildDemoState } = jiti("../src/lib/game/demo-season-builder.ts");
const STORED = require("./fixtures/stored-formats.json");

const BUILT_INS = ["survivor", "traitors", "challenge"];

/** The format and the compiled rulebook standing in for it: { frozen, data, format, warnings }. */
function compiled(id, stored) {
  const r = rulebookFor(id, stored);
  const { data, problems, warnings } = compileRulebook(r.blocks, { aliases: r.aliases, reader: r.reader, base: r.base });
  assert.deepEqual(problems, [], id);
  return { frozen: Formats.formatFor(id, stored), data, format: Formats.formatForRulebook(data, r.reader), warnings };
}

// Everything that scores or asks, key by key (a rulebook owns its cast words, so `terms` may differ).
const SCORING_KEYS = ["exitMethods", "winnerExitMethod", "endgameExitMethods", "events", "rules", "roles", "hasMerge", "hasGroups"];
const ASKING_KEYS = ["research", "wiki"];

test("unedited, each built-in compiles to its own format: events, points, rules, questions, exits and groups", () => {
  for (const id of BUILT_INS) {
    const { frozen, data, warnings } = compiled(id);
    assert.deepEqual(warnings, [], id);
    for (const k of [...SCORING_KEYS, ...ASKING_KEYS, "eventCategories", "recap", "id", "name"]) assert.deepEqual(data[k], frozen.data[k], `${id}: ${k}`);
  }
});

test("each stored format compiles back onto its own data: what scores and what's asked are unchanged", () => {
  for (const [id, stored] of Object.entries({ generic: Formats.FORMATS.generic.data, ...STORED })) {
    const { frozen, data } = compiled(id, id === "generic" ? undefined : stored);
    // Every event as it was; a way out the format scored nothing for is a moment worth nothing (blocksFromFormat).
    for (const e of frozen.data.events) assert.deepEqual(data.events.find((x) => x.id === e.id), e, `${id}: ${e.id}`);
    const added = new Set(data.events.filter((x) => !frozen.data.events.some((f) => f.id === x.id)).map((e) => e.id));
    for (const e of added) assert.equal(data.events.find((x) => x.id === e).defaultPoints, 0, `${id}: ${e} scores nothing`);
    const rules = { research: data.rules.research, implied: data.rules.implied.filter((r) => !added.has(r.award)) };
    assert.deepEqual(rules, frozen.data.rules, `${id}: rules`);
    for (const k of SCORING_KEYS.filter((x) => x !== "events" && x !== "rules")) assert.deepEqual(data[k], frozen.data[k], `${id}: ${k}`);
    for (const k of ASKING_KEYS) assert.deepEqual(data[k], frozen.data[k], `${id}: ${k}`);
  }
});

// The pipeline's own steps for one answer: parse, review, stage, notes.
function researchRun(format, payload) {
  let parsed;
  try {
    parsed = R.parseJsonAnswer(JSON.stringify(payload), R.researchSchemaFor(format, false), "golden");
  } catch (e) {
    return { parseError: e.message };
  }
  const review = R.validateResearch(parsed, CAST, TERM_SETS.default, format);
  return {
    review,
    items: R.candidatesFor(parsed, format, 4),
    notes: review.entries.map((e) => [format.research.notes(e), format.research.sentences(e)]),
  };
}

test("the harness's research answers stage the same results through a built-in and its compiled rulebook", () => {
  for (const id of BUILT_INS) {
    const { frozen, format } = compiled(id);
    assert.deepEqual(
      z.toJSONSchema(format.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])), { io: "output" }),
      z.toJSONSchema(frozen.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])), { io: "output" }),
      `${id}: the same checklist schema`
    );
    const payloads = [...[0, 1, 2, 3, 4, 5].map((o) => [`patterned ${o}`, patterned(frozen, o)]), ...scenarios(frozen)];
    for (const [label, payload] of payloads) {
      assert.deepEqual(researchRun(format, payload), researchRun(frozen, payload), `${id}: ${label}`);
    }
  }
});

// Exits, exile and roles as a league records them, from staged items: every exit method once, a finale's jury votes.
function episodeFrom(items, number) {
  const ep = { number, events: [], exiled: [], roles: [] };
  for (const i of items) {
    if (i.kind === "elimination") ep.events.push({ castawayId: i.castawayName, method: i.method, ...(Number.isInteger(i.juryVotes) ? { juryVotes: i.juryVotes } : {}) });
    if (i.kind === "exiled") ep.exiled.push({ castawayId: i.castawayName });
    if (i.kind === "role") ep.roles.push({ castawayId: i.castawayName, role: i.method });
  }
  return ep;
}

test("the same exits, exile and roles imply the same events", () => {
  for (const id of BUILT_INS) {
    const { frozen, format } = compiled(id);
    const episodes = [...[0, 1, 2, 3].map((o) => patterned(frozen, o)), ...scenarios(frozen).map(([, p]) => p)]
      .map((p, n) => episodeFrom(R.candidatesFor(p, frozen, n + 1), n + 1));
    // Every exit method, each with and without jury votes, in a finale (the winner leaves) and not.
    for (const finale of [false, true]) {
      for (const votes of [undefined, 0, 3]) {
        const exits = frozen.exitMethods.filter((m) => finale || m !== frozen.winnerExitMethod);
        episodes.push({ number: 9, events: exits.map((method, i) => ({ castawayId: `c${i}`, method, ...(votes === undefined ? {} : { juryVotes: votes }) })), exiled: [{ castawayId: "c9" }], roles: [] });
      }
    }
    // Roles as of the episode, both ways: everyone a Traitor, then nobody.
    for (const role of frozen.roles ? [...frozen.roles.values, undefined] : [undefined]) {
      const ctx = { roleOf: () => (role ? frozen.roles.roleFor(role) : frozen.roles && frozen.roles.default) };
      for (const ep of episodes) {
        const recorded = role ? { ...ep, roles: [...ep.roles, { castawayId: "c1", role }] } : ep;
        assert.deepEqual(format.impliedEvents(recorded, ctx), frozen.impliedEvents(recorded, ctx), `${id}: episode ${ep.number} (${role || "no role"})`);
      }
    }
  }
});

// A demo league on each built-in, played by the frozen format and by its compiled rulebook.
const EPISODES = 6;
function demo(id, leagueType) {
  const exits = Formats.FORMATS[id].exitMethods.filter((m) => m !== "Other");
  const winner = Formats.FORMATS[id].winnerExitMethod;
  const finalist = Formats.FORMATS[id].endgameExitMethods.find((m) => m !== winner);
  const out = exits.filter((m) => !Formats.FORMATS[id].endgameExitMethods.includes(m));
  const n = 10;
  const data = {
    id: `golden-${id}`, showId: id, showName: id, seasonName: id, episodeCount: EPISODES,
    players: ["ann", "bo", "cy"].map((key) => ({ key, name: key, color: "#000" })),
    castaways: Array.from({ length: n }, (_, i) => {
      const last = i === n - 1;
      const exitMethod = last ? winner : i >= n - 3 ? finalist : out[i % out.length];
      return {
        key: `k${i}`, name: CAST[i % CAST.length] + (i >= CAST.length ? ` ${i}` : ""), placement: i + 1,
        exitEpisode: Math.min(i + 1, EPISODES), exitMethod,
        ...(id === "traitors" && i % 3 === 0 ? { role: { value: i % 2 ? "Recruited Traitor" : "Traitor", sinceEpisode: 1 } } : {}),
      };
    }),
  };
  const s = S.migrateLeagueState(JSON.parse(JSON.stringify(buildDemoState(data, leagueType, EPISODES))));
  // The finalists' jury votes, so the finale's per-vote events score.
  for (const ep of s.episodes) for (const ev of ep.events || []) if (ev.method === finalist || ev.method === winner) ev.juryVotes = ev.method === winner ? 5 : 0;
  return s;
}

test("a league of every type scores the same played by the frozen format or by its compiled rulebook", () => {
  for (const id of BUILT_INS) {
    const { data } = compiled(id);
    for (const type of ["active-roster", "classic-draft", "pickem"]) {
      const frozen = demo(id, type);
      const ruled = JSON.parse(JSON.stringify(frozen));
      ruled.settings.rulebook = { data, reader: id };
      assert.notEqual(S.formatOf(ruled), S.formatOf(frozen), `${id}: the rulebook is what the league plays by`);
      assert.deepEqual(S.formatOf(ruled).data, data);
      const events = (s) => s.episodes.map((ep) => S.ActiveRosterLogic.episodeEvents(s, ep).map((e) => [e.type, e.castawayId, S.ActiveRosterLogic.eventPoints(s, e)]));
      if (type === "active-roster") assert.ok(events(frozen).flat().length > 10, `${id}: the demo scored something`);
      assert.deepEqual(events(ruled), events(frozen), `${id} ${type}: every event and its points`);
      assert.deepEqual(S.computeScores(ruled), S.computeScores(frozen), `${id} ${type}: the standings`);
      assert.deepEqual([S.seasonEnded(ruled), S.seasonWinner(ruled)], [S.seasonEnded(frozen), S.seasonWinner(frozen)], `${id} ${type}: the season's end`);
    }
  }
});

// ---------- Survivor on its own blocks (docs/PLAN-start-a-game-gpt.md S1) ----------
//
// What Survivor 51 switches onto (S3): Survivor's blocks with no base and the generic reader, so nothing of survivor.js is
// read. They give its events, questions and rules: by id, key and condition rather than in its order, and in the blocks'
// own labels (How it works already shows them). Research is reviewed the same way too (S2): the same problems, the same
// repairs, and the same notes and sentences, from checks and words that are the rulebook's data. Problems, notes and
// sentences are compared as sets: their order is the blocks'.
function onItsOwn() {
  const { blocks, aliases } = rulebookFor("survivor");
  const { data, problems, warnings } = compileRulebook(blocks, { aliases, reader: "research" });
  assert.deepEqual([problems, warnings], [[], []]);
  return { frozen: Formats.FORMATS.survivor, data, format: Formats.formatForRulebook(data, "research") };
}
// Key order never matters, and neither does the order of an `all` or `any`, nor of a list compared as a set.
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (!v || typeof v !== "object") return v;
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = k === "all" || k === "any" ? v[k].map(canon).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)) : canon(v[k]);
  return out;
}
const asSet = (xs) => xs.map((x) => JSON.stringify(canon(x))).sort();
const byId = (events) => asSet(events.map((e) => ({ id: e.id, points: e.defaultPoints, implied: !!e.implied })));
// A question as research is asked it (how it reads to a reviewer is compared as notes, below).
const questions = (fields) =>
  asSet(fields.map((f) => {
    const q = { ...f };
    for (const k of ["note", "sentence", "shown"]) delete q[k];
    return q;
  }));

test("with no base and the generic reader, Survivor's blocks give survivor.js's events, questions and rules", () => {
  const { frozen, data, format } = onItsOwn();
  assert.notEqual(format.research.notes, frozen.research.notes, "nothing of survivor.js's code half");
  const f = frozen.data;
  assert.deepEqual(byId(data.events), byId(f.events), "every event, its points, and whether a fact implies it");
  for (const k of ["exitMethods", "winnerExitMethod", "endgameExitMethods", "hasMerge", "hasGroups", "roles", "id", "name"]) assert.deepEqual(data[k], f[k], k);
  assert.deepEqual(questions(data.research.checklist), questions(f.research.checklist), "every question, word for word");
  // The one difference: whether Tribal was held, which survivor.js asked by its key alone, says what it asks.
  assert.deepEqual(f.research.episodeFields, [{ key: "tribalCouncilHeld", type: "answer" }]);
  assert.deepEqual(data.research.episodeFields, [{ key: "tribalCouncilHeld", type: "answer", description: "Was there a Tribal Council this episode?" }]);
  assert.deepEqual([...data.research.claims].sort(), [...f.research.claims].sort(), "the yeses that need a source");
  assert.deepEqual(data.research.searchHint, f.research.searchHint);
  assert.deepEqual(data.research.groupVotes, f.research.groupVotes, "the vote one tribe goes to at a time, and its words for a missed move");
  const schema = (fmt) => {
    const s = z.toJSONSchema(fmt.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])), { io: "output" });
    return canon({ ...s, required: [...s.required].sort() });
  };
  assert.deepEqual(schema(format), schema(frozen), "the same research schema");
  assert.deepEqual(asSet(data.rules.research), asSet(f.rules.research), "research rules");
  assert.deepEqual(asSet(data.rules.implied), asSet(f.rules.implied), "implied rules");
  const recap = (r) => asSet(r.map((x) => ({ events: [...x.events].sort(), tribe: [...(x.tribeEvents || [])].sort() })));
  assert.deepEqual(recap(data.recap), recap(f.recap), "an episode's headline wins, and which a tribe wins");
  // What each moment says about someone's place in the game (S2 part 2): what the computer players and the Safety ranking
  // read, so they play and rank exactly as on survivor.js (tests/moment-tags.test.js has the rest).
  const tags = (events) => asSet(events.map((e) => ({ id: e.id, tags: [...(e.tags || [])].sort() })));
  assert.deepEqual(tags(data.events), tags(f.events), "every event's tags");
  assert.ok(f.events.filter((e) => e.tags).length >= 7, "survivor.js tags what the computer players read");
});

test("only blocks these tests prove say they stand alone, which is what makes a new season's rulebook compile from them", () => {
  const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
  assert.deepEqual(Object.keys(BUILT_IN_BLOCKS).filter((id) => BUILT_IN_BLOCKS[id].standsAlone === true), ["survivor"]);
});

test("Survivor on its own blocks: the harness's answers stage the same results, and the same exits and exile imply the same events", () => {
  const { frozen, format } = onItsOwn();
  const staged = (fmt, payload, n) => asSet(R.candidatesFor(JSON.parse(JSON.stringify(payload)), fmt, n));
  const payloads = [...[0, 1, 2, 3, 4, 5].map((o) => [`patterned ${o}`, patterned(frozen, o)]), ...scenarios(frozen)];
  for (const [label, payload] of payloads) assert.deepEqual(staged(format, payload, 4), staged(frozen, payload, 4), label);
  const episodes = payloads.map(([, p], n) => episodeFrom(R.candidatesFor(p, frozen, n + 1), n + 1));
  for (const finale of [false, true]) {
    for (const votes of [undefined, 0, 3]) {
      const exits = frozen.exitMethods.filter((m) => finale || m !== frozen.winnerExitMethod);
      episodes.push({ number: 9, events: exits.map((method, i) => ({ castawayId: `c${i}`, method, ...(votes === undefined ? {} : { juryVotes: votes }) })), exiled: [{ castawayId: "c9" }], roles: [] });
    }
  }
  assert.ok(episodes.some((ep) => ep.exiled.length && frozen.impliedEvents(ep, {}).some((e) => e.type === "wentToExile")), "exile is in there");
  for (const ep of episodes) assert.deepEqual(asSet(format.impliedEvents(ep, {})), asSet(frozen.impliedEvents(ep, {})), `episode ${ep.number}`);
});

// The tribes going into the episode, so research fills in a missed tribe move as well.
const GROUPS = { "Ada Lovelace": "Kele", "Grace Hopper": "Kele", "Alan Turing": "Kele", "Katherine Johnson": "Kele", "Hedy Lamarr": "Lavo", "Claude Shannon": "Lavo" };

// Answers that trip each of survivor.js's checks, and the missed move, which the patterned ones may not reach.
function checkScenarios(frozen) {
  const out = [];
  const one = (label, fill) => {
    const skel = R.pasteSkeleton(ctxFor(frozen), []);
    const at = (name, fields) => Object.assign(skel.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high" }, fields);
    fill(skel, at);
    out.push([label, skel]);
  };
  one("no Tribal held", (p, at) => {
    p.tribalCouncilHeld = "no";
    at("Ada Lovelace", { attendedTribal: "yes", votesReceived: 2, votedFor: "Grace Hopper" });
    at("Grace Hopper", { attendedTribal: "yes", votesReceived: 0, wonTribeImmunity: "yes" });
  });
  one("the tribe that won immunity, at Tribal", (p, at) => {
    p.tribalCouncilHeld = "yes";
    at("Ada Lovelace", { attendedTribal: "yes", votesReceived: 0, wonTribeImmunity: "yes", votedFor: "Hedy Lamarr" });
    at("Grace Hopper", { attendedTribal: "yes", votesReceived: 3, wonTribeImmunity: "no", votedFor: "Hedy Lamarr" });
    at("Hedy Lamarr", { attendedTribal: "yes", votesReceived: 1, leftTheGame: "yes", exitMethod: "Voted Out" });
  });
  one("everyone at Tribal on zero", (p, at) => {
    for (const n of ["Ada Lovelace", "Grace Hopper", "Alan Turing"]) at(n, { attendedTribal: "yes", votesReceived: 0, votedFor: "Hedy Lamarr" });
  });
  one("votes against and voters disagree", (p, at) => {
    at("Ada Lovelace", { attendedTribal: "yes", votesReceived: 4, votedFor: "Grace Hopper" });
    at("Grace Hopper", { attendedTribal: "yes", votesReceived: 1, votedFor: "Ada Lovelace" });
  });
  one("one person contradicting themselves", (p, at) => {
    at("Ada Lovelace", { attendedTribal: "no", votesReceived: 2 });
    at("Grace Hopper", { wonIndividualImmunity: "yes", leftTheGame: "yes", exitMethod: "Voted Out" });
    at("Alan Turing", { foundAdvantage: "yes", advantageFoundName: null });
    at("Katherine Johnson", { individualChallengeFinish: 1, wonIndividualImmunity: "no", wonIndividualReward: "no" });
    at("Hedy Lamarr", { votesNullified: 2, playedAdvantage: "no" });
    at("Claude Shannon", { individualChallengeFinish: 1, wonIndividualReward: "yes", foundAdvantage: "yes", advantageFoundName: "an idol", notableTwist: "Lost a shoe" });
  });
  one("a missed tribe move", (p, at) => {
    for (const n of ["Ada Lovelace", "Grace Hopper", "Alan Turing"]) at(n, { attendedTribal: "yes", votesReceived: 1, votedFor: "Hedy Lamarr" });
    at("Hedy Lamarr", { attendedTribal: "yes", votesReceived: 3, leftTheGame: "yes", exitMethod: "Voted Out" });
  });
  return out;
}

// One answer through research's review: what's refused and reported, what's repaired, each person's notes and sentences,
// and what it stages afterwards.
function reviewed(format, payload) {
  let parsed;
  try {
    parsed = R.parseJsonAnswer(JSON.stringify(payload), R.researchSchemaFor(format, false), "golden");
  } catch (e) {
    return { parseError: e.message };
  }
  const review = R.validateResearch(parsed, CAST, TERM_SETS.default, format, { groups: GROUPS });
  // The claims with no source are listed in the checklist's order, which is the blocks'.
  const claims = (p) => p.replace(/claims (.+) with no source cited$/, (_, keys) => `claims ${keys.split(", ").sort().join(", ")} with no source cited`);
  return {
    problems: review.problems.map(claims).sort(),
    fatal: review.fatal,
    counts: review.counts,
    repaired: review.entries.map(canon),
    notes: review.entries.map((e) => [[...format.research.notes(e)].sort(), [...format.research.sentences(e)].sort()]),
    staged: asSet(R.candidatesFor(parsed, format, 4)),
  };
}

test("Survivor on its own blocks: research is reviewed the same, problems, repairs, notes and sentences", () => {
  const { frozen, format } = onItsOwn();
  assert.notEqual(format.research.episodeProblems, frozen.research.episodeProblems, "nothing of survivor.js's code half");
  const payloads = [...[0, 1, 2, 3, 4, 5].map((o) => [`patterned ${o}`, patterned(frozen, o)]), ...scenarios(frozen), ...checkScenarios(frozen)];
  const seen = [];
  for (const [label, payload] of payloads) {
    const ours = reviewed(format, JSON.parse(JSON.stringify(payload)));
    const theirs = reviewed(frozen, JSON.parse(JSON.stringify(payload)));
    assert.deepEqual(ours, theirs, label);
    seen.push(...(theirs.problems || []));
  }
  // Every check, and the missed move, was reached somewhere: taking one out of the rulebook fails a case above.
  const reached = [
    /votes against someone who didn't attend Tribal$/, /voted out despite winning individual immunity$/, /found an advantage but didn't say what$/,
    /finished 1st in an individual challenge but isn't marked as winning it$/, /votes cancelled by an advantage they aren't marked as playing$/,
    /^No Tribal Council this episode/, /on the tribe that won immunity \(attendance cleared to unknown\)$/, /^Everyone at Tribal was given zero votes/,
    /people at Tribal are recorded voting: check who attended$/, /was at Kele's Tribal but was still on Lavo/,
  ];
  for (const re of reached) assert.ok(seen.some((p) => re.test(p)), `reached: ${re}`);
  // Notes say what happened, in survivor.js's words (a few, spelled out).
  const notes = reviewed(format, checkScenarios(frozen).find(([l]) => l === "one person contradicting themselves")[1]).notes;
  assert.deepEqual(notes[2][0], ["found an advantage"], "a find with no name says so");
  assert.deepEqual(notes[5][0], ["Lost a shoe", "found an idol", "individual reward"]);
});

test("Survivor on its own blocks: a league of every type scores the same", () => {
  const { data } = onItsOwn();
  for (const type of ["active-roster", "classic-draft", "pickem"]) {
    const frozen = demo("survivor", type);
    // Exile on one episode, so the implied event is in the scores too.
    frozen.episodes[1].exiled = [{ castawayId: frozen.castaways[4].id }];
    const ruled = JSON.parse(JSON.stringify(frozen));
    ruled.settings.rulebook = { data, reader: "research" };
    assert.equal(S.formatOf(ruled).data, data, "the rulebook is what the league plays by");
    const events = (s) => s.episodes.map((ep) => asSet(S.ActiveRosterLogic.episodeEvents(s, ep).map((e) => [e.type, e.castawayId, S.ActiveRosterLogic.eventPoints(s, e)])));
    if (type === "active-roster") assert.ok(events(frozen).flat().length > 10, "the demo scored something");
    assert.deepEqual(events(ruled), events(frozen), `${type}: every event and its points`);
    assert.deepEqual(S.computeScores(ruled), S.computeScores(frozen), `${type}: the standings`);
    assert.deepEqual([S.seasonEnded(ruled), S.seasonWinner(ruled)], [S.seasonEnded(frozen), S.seasonWinner(frozen)], `${type}: the season's end`);
  }
});
