// Regression harness for the show formats (src/lib/game/formats/). Not a test: it prints everything a
// format feeds into -- every request the connectors would send (system prompt, user prompt, the JSON
// schema in all three provider dialects), the paste prompts and skeleton, parse/repair/validation of
// fixed answers, the staged results, the reviewer notes, the wiki read's validation, implied events,
// default points and Active Roster scores -- for every registered format, on fixed fixtures.
//
// The method docs/PLAN-show-formats.md phase 1 used and docs/PLAN-ai-generated-show-formats.md phase 2
// reuses: run it before a refactor, run it after, and diff. Byte-identical output means nothing a
// format drives has changed.
//
//   node tests/harness/format-regression.js > before.txt
//   ...refactor...
//   node tests/harness/format-regression.js > after.txt
//   git diff --no-index before.txt after.txt
//
// The last section ("function sources") hashes each format function's source text, so a diff there
// names exactly which functions changed; every other section is behaviour, and should never differ.

// Deterministic before anything is loaded: state-logic's ids come from Math.random.
let seed = 42;
Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const crypto = require("node:crypto");
const { z } = require("zod");
const { zodOutputFormat } = require("@anthropic-ai/sdk/helpers/zod");
const R = require("../../db/episode-research.js");
const W = require("../../db/wiki-sync.js");
const Formats = require("../../src/lib/game/formats/index.js");
const StateLogic = require("../../src/lib/game/state-logic.js");

const out = [];
const section = (title, value) => {
  out.push(`## ${title}`);
  out.push(typeof value === "string" ? value : JSON.stringify(value, replacer, 1));
  out.push("");
};
function replacer(_key, value) {
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value instanceof RegExp) return String(value);
  return value;
}
const attempt = (fn) => {
  try {
    return { ok: fn() };
  } catch (e) {
    return { error: e.message };
  }
};
// What the SDK sends for a schema: everything but the parse function.
const sent = (schema) => {
  const { parse, ...rest } = zodOutputFormat(schema);
  return { ...rest, parse: typeof parse };
};

const FORMAT_IDS = Formats.formatOptions().map((f) => f.id);

// ---------- the registry ----------
section("registry", {
  ids: Object.keys(Formats.FORMATS),
  options: Formats.formatOptions(),
  default: Formats.DEFAULT_FORMAT,
  fallback: [undefined, null, "", "nope", "survivor", "generic"].map((id) => Formats.formatFor(id).id),
});

// ---------- each format's static shape ----------
for (const id of FORMAT_IDS) section(`${id} :: object`, Formats.formatFor(id));

// ---------- research ----------
const TERM_SETS = {
  default: W.termsFor({}).terms,
  custom: W.termsFor({ castaway_term: "Contestants", tribe_term: "Factions" }).terms,
};
const CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Hedy Lamarr", "Claude Shannon"];
const BETS = [
  { label: "Will an idol be played?", guesses: ["yes", "no"] },
  { label: "Who goes home?", guesses: ["Ada", "Grace Hopper"] },
];
const ctxFor = (format, terms = TERM_SETS.default, domains = []) => ({
  showName: "Test Show",
  showSlug: "test",
  season: 3,
  episodeNumber: 4,
  castNames: CAST,
  terms,
  format,
  domains,
});

// Fills every checklist field from the schema itself, rotating through each field's possible values so
// every answer -> result mapping, contradiction check and note is reached somewhere.
function patterned(format, offset) {
  const json = R.jsonSchemaFor(R.researchSchemaFor(format, false), "strict");
  const entry = json.properties.castaways.items.properties;
  const skel = R.pasteSkeleton(ctxFor(format), []);
  skel.episodeTitle = `Episode ${offset}`;
  skel.airDate = "March 5, 2026";
  skel.summary = "Things happened.";
  for (const [k, node] of Object.entries(json.properties)) {
    if (node.enum && node.enum.includes("yes")) skel[k] = ["yes", "no", "unknown"][offset % 3];
  }
  skel.castaways.forEach((c, i) => {
    Object.keys(entry).forEach((key, j) => {
      const node = entry[key];
      const variants = node.anyOf || [node];
      const real = variants.find((v) => v.type !== "null") || node;
      const nullable = variants.some((v) => v.type === "null");
      const n = i + j + offset;
      if (["name", "sources", "confidence", "exitMethod"].includes(key)) return;
      if (real.enum && real.enum.includes("yes")) c[key] = ["yes", "no", "unknown"][n % 3];
      else if (real.enum) c[key] = nullable && n % 4 === 0 ? null : real.enum[n % real.enum.length];
      else if (real.type === "integer" || real.type === "number") c[key] = nullable && n % 5 === 0 ? null : n % 4;
      else if (real.type === "array") c[key] = nullable && n % 5 === 0 ? null : [[], [CAST[(i + 2) % CAST.length]], [CAST[(i + 1) % CAST.length].split(" ")[0], CAST[(i + 3) % CAST.length]]][n % 3];
      else if (real.type === "string") c[key] = nullable && n % 3 === 0 ? null : n % 3 === 1 ? CAST[(i + 1) % CAST.length] : `thing ${n}`;
    });
    if (c.leftTheGame === "yes") c.exitMethod = format.exitMethods[(i + offset) % format.exitMethods.length];
    else if (i === 0) c.exitMethod = format.exitMethods[0]; // an exit method on someone who didn't leave
    c.sources = (i + offset) % 4 === 3 ? [] : [`https://example.com/${i}`];
    c.confidence = ["high", "medium", "low"][(i + offset) % 3];
  });
  return skel;
}

function researchRun(format, payload, label) {
  const text = "Sure!\n```json\n" + JSON.stringify(payload, null, 2) + "\n```";
  const parsed = attempt(() => R.parseJsonAnswer(R.extractJsonObject(text), R.researchSchemaFor(format, false), label));
  if (parsed.error) return { parseError: parsed.error };
  const terms = TERM_SETS.default;
  const review = R.validateResearch(parsed.ok, CAST, terms, format);
  const items = R.candidatesFor(parsed.ok, format);
  const notes = review.entries.map((e) => ({ name: e.name, notes: format.research.notes(e), sentences: format.research.sentences(e) }));
  const logged = [];
  const log = console.log;
  console.log = (...a) => logged.push(a.join(" "));
  try {
    R.printResearch({ ...review, payload: parsed.ok, terms, format, provenance: { pagesRead: ["https://example.com/0"] } });
  } finally {
    console.log = log;
  }
  return { parsed: parsed.ok, review, items, notes, printed: logged.join("\n") };
}

// Hand-built answers the patterned ones won't reach: a Survivor Tribal, a Traitors Round Table, a
// Challenge elimination, and answers a chat gets wrong (an exit method the show doesn't have, a wrong
// type, a missing person).
function scenarios(format) {
  const s = () => R.pasteSkeleton(ctxFor(format), []);
  const set = (skel, name, fields) => Object.assign(skel.castaways.find((c) => c.name === name), { sources: ["x"], confidence: "high" }, fields);
  const list = [];
  if (format.id === "survivor") {
    const t = s();
    set(t, "Ada Lovelace", { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 3, votedFor: "Grace Hopper" });
    set(t, "Grace Hopper", { attendedTribal: "yes", votesReceived: 1, votedFor: "Ada" });
    set(t, "Alan Turing", { attendedTribal: "yes", votesReceived: 0, votedFor: "Ada Lovelace", playedAdvantage: "yes", advantagePlayedName: "idol", votesNullified: 2 });
    set(t, "Katherine Johnson", { attendedTribal: "yes", votesReceived: 0, votedFor: "Grace Hopper", wonIndividualReward: "yes", wonTribeReward: "yes" });
    set(t, "Hedy Lamarr", { juryVotesReceived: 0, individualChallengeFinish: 1 });
    set(t, "Claude Shannon", { leftTheGame: "yes", exitMethod: "Sole Survivor", juryVotesReceived: 5, exiled: "yes" });
    list.push(["tribal", t]);
  }
  if (format.id === "traitors") {
    const t = s();
    const at = { attendedRoundTable: "yes" };
    set(t, "Ada Lovelace", { ...at, isTraitor: "yes", votesReceived: 1, votedFor: ["Grace Hopper"] });
    set(t, "Grace Hopper", { ...at, isTraitor: "yes", leftTheGame: "yes", exitMethod: "Banished", votesReceived: 3, votedFor: ["Ada"], accusedBy: ["Alan Turing"] });
    set(t, "Alan Turing", { ...at, isTraitor: "no", votesReceived: 1, votedFor: ["Grace"] });
    set(t, "Katherine Johnson", { ...at, isTraitor: "no", votesReceived: 0, votedFor: "Grace Hopper", accusedBy: "Grace Hopper" });
    set(t, "Hedy Lamarr", { isTraitor: "no", recruitedAsTraitor: "yes", becameTraitor: "yes", declinedRecruitment: "yes", onMurderShortlist: "yes" });
    set(t, "Claude Shannon", { leftTheGame: "yes", exitMethod: "Murdered", wonShield: "yes", shieldSavedThem: "yes", wonPower: "yes" });
    list.push(["round table", t]);
  }
  if (format.id === "challenge") {
    const t = s();
    set(t, "Ada Lovelace", { wasNominated: "yes", competedInElimination: "yes", wonElimination: "yes" });
    set(t, "Grace Hopper", { wasNominated: "yes", competedInElimination: "yes", wonElimination: "no", leftTheGame: "yes", exitMethod: "Eliminated" });
    set(t, "Alan Turing", { wonDailyChallenge: "yes", wasCaptain: "yes" });
    set(t, "Katherine Johnson", { wonElimination: "yes", competedInElimination: "no", leftTheGame: "yes", exitMethod: "Eliminated" });
    list.push(["elimination", t]);
  }
  const bad = s();
  set(bad, "Ada Lovelace", { leftTheGame: "yes", exitMethod: "Vanished into thin air" });
  set(bad, "Grace Hopper", { leftTheGame: "maybe" });
  list.push(["repairable", bad]);
  const fatal = s();
  set(fatal, "Grace Hopper", { confidence: "certain" });
  list.push(["unrepairable", fatal]);
  const wrongType = s();
  wrongType.castaways[0].leftTheGame = 7;
  list.push(["wrong type", wrongType]);
  const missing = s();
  missing.castaways.pop();
  missing.castaways.push({ ...missing.castaways[0], name: "Nobody Atall" });
  list.push(["missing person", missing]);
  return list;
}

for (const id of FORMAT_IDS) {
  const format = Formats.formatFor(id);
  for (const withBets of [false, true]) {
    const schema = R.researchSchemaFor(format, withBets);
    section(`${id} :: research schema (bets=${withBets}) :: sent to Anthropic`, sent(schema));
    section(`${id} :: research schema (bets=${withBets}) :: strict`, R.jsonSchemaFor(schema, "strict"));
    section(`${id} :: research schema (bets=${withBets}) :: gemini`, R.jsonSchemaFor(schema, "gemini"));
  }
  section(`${id} :: checklist alone`, z.toJSONSchema(format.research.checklistSchema(z, z.enum(["yes", "no", "unknown"])), { io: "output" }));
  section(`${id} :: episode fields`, Object.keys(format.research.episodeFields(z, z.enum(["yes", "no", "unknown"]))));
  for (const [tname, terms] of Object.entries(TERM_SETS)) {
    for (const [bname, bets] of [["no bets", []], ["bets", BETS]]) {
      const ctx = ctxFor(format, terms, tname === "custom" ? ["goldderby.com", "today.com"] : []);
      section(`${id} :: buildPrompt (${tname}, ${bname})`, R.buildPrompt({ ...ctx, bets }));
      section(`${id} :: paste prompt prose (${tname}, ${bname})`, R.buildPastePrompt(ctx, bets));
      section(`${id} :: paste prompt structured (${tname}, ${bname})`, R.buildPastePrompt(ctx, bets, { structured: true }));
      section(`${id} :: paste skeleton (${tname}, ${bname})`, R.pasteSkeleton(ctx, bets));
    }
  }
  for (const offset of [0, 1, 2, 3]) section(`${id} :: research run, patterned ${offset}`, researchRun(format, patterned(format, offset), `p${offset}`));
  for (const [label, payload] of scenarios(format)) section(`${id} :: research run, ${label}`, researchRun(format, payload, label));
}

// ---------- the wiki read ----------
const WIKI_CAST = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Hedy Lamarr", "Claude Shannon", "Barbara Liskov", "Edsger Dijkstra"];
const wikiState = () =>
  StateLogic.migrateLeagueState({
    settings: {},
    castaways: WIKI_CAST.map((name, i) => ({ id: `c${i}`, name, status: "active", ownerIds: [] })),
    episodes: [],
  });

function wikiExtractions(format) {
  const m = format.exitMethods;
  const win = format.winnerExitMethod;
  const base = (eps) => ({ episodes: eps });
  const common = [
    {
      number: 1, title: "One", airDate: "Jan 1", postMerge: false,
      eliminations: [{ name: "Ada", method: m[0] }],
      groupChanges: [{ name: "Grace Hopper", group: "Blue" }, { name: "Alan Turing", group: "Hedy & Alan" }],
      events: [],
    },
    {
      number: 2, title: "Two", airDate: null, postMerge: true,
      eliminations: [{ name: "Grace Hopper", method: m[1] }, { name: "Alan Turing", method: m[2] }, { name: "Ada Lovelace", method: m[0] }, { name: "Mystery Person", method: m[0] }],
      groupChanges: [{ name: "Ada Lovelace", group: "Red" }, { name: "Katherine", group: null }],
      events: [],
    },
    {
      number: 3, title: "Finale", airDate: "Mar 3", postMerge: true,
      eliminations: [{ name: "Katherine Johnson", method: m[m.length - 3] || m[0] }, { name: "Hedy Lamarr", method: win }],
      events: [],
    },
    { number: 3, title: "dup", eliminations: [], events: [] },
    { number: 99, eliminations: [], events: [] },
  ];
  const types = format.wiki.eventTypes;
  common.forEach((ep, i) => {
    for (const [j, type] of types.entries()) {
      ep.events.push({ type, name: WIKI_CAST[(i + j) % WIKI_CAST.length], confidence: j % 2 ? "low" : "high" });
    }
    if (types.length) ep.events.push({ type: types[0], name: WIKI_CAST[i % WIKI_CAST.length], confidence: "high" });
  });
  const list = [["common", base(common)]];
  if (format.id === "survivor") {
    list.push([
      "survivor",
      {
        mergeEpisode: 2,
        episodes: [
          { number: 1, title: "A", airDate: null, postMerge: true, eliminations: [{ name: "Ada", method: "Voted Out" }], exiled: [{ name: "Grace" }, { name: "Nobody" }],
            events: [{ type: "individualImmunity", name: "Alan Turing", confidence: "high" }, { type: "zeroVotesSafe", name: "Ada", confidence: "low" }] },
          { number: 2, title: "B", airDate: null, postMerge: false, eliminations: [],
            events: [{ type: "individualImmunity", name: "Alan Turing", confidence: "high" }, { type: "idolPlayed", name: "Claude", confidence: "low" }] },
        ],
      },
    ]);
  }
  if (format.id === "traitors") {
    list.push([
      "traitors",
      {
        originalTraitors: [{ name: "Ada Lovelace" }, { name: "Grace Hopper" }, { name: "Ada" }],
        episodes: [
          { number: 1, title: "A", airDate: null, recruited: [], eliminations: [{ name: "Alan Turing", method: "Murdered" }, { name: "Katherine Johnson", method: "Banished" }],
            roundTables: [{ banished: "Katherine Johnson", votes: [{ voter: "Ada", votedFor: "Katherine" }, { voter: "Hedy Lamarr", votedFor: "Katherine Johnson" }, { voter: "Katherine Johnson", votedFor: "Hedy" }, { voter: "Claude Shannon", votedFor: "Barbara Liskov" }, { voter: "Barbara Liskov", votedFor: "Hedy Lamarr" }] }],
            events: [{ type: "shieldWon", name: "Claude", confidence: "high" }] },
          { number: 2, title: "B", airDate: null, recruited: [{ name: "Hedy Lamarr" }], eliminations: [{ name: "Grace Hopper", method: "Banished" }],
            roundTables: [{ banished: "Grace Hopper", votes: [{ voter: "Hedy Lamarr", votedFor: "Grace Hopper" }, { voter: "Claude", votedFor: "Grace" }, { voter: "Grace Hopper", votedFor: "Claude Shannon" }, { voter: "Edsger Dijkstra", votedFor: "Claude Shannon" }] }, { banished: null, votes: [{ voter: "Ada", votedFor: "Edsger" }] }],
            events: [] },
          { number: 3, title: "Fin", airDate: null, recruited: [], eliminations: [{ name: "Barbara Liskov", method: "Banished" }, { name: "Claude Shannon", method: "Finalist" }, { name: "Ada Lovelace", method: "Winner" }, { name: "Hedy Lamarr", method: "Winner" }],
            roundTables: [{ banished: "Barbara Liskov", votes: [{ voter: "Ada", votedFor: "Barbara" }, { voter: "Claude Shannon", votedFor: "Barbara Liskov" }] }], events: [] },
        ],
      },
    ]);
  }
  if (format.id === "challenge") {
    list.push([
      "challenge",
      {
        episodes: [
          { number: 1, title: "A", airDate: "x", dailyWinners: [{ name: "Ada" }, { name: "Grace Hopper" }],
            eliminationRound: [{ name: "Alan Turing", via: "nominated", result: "won" }, { name: "Katherine Johnson", via: "nominated", result: "lost" }, { name: "Hedy Lamarr", via: "volunteer", result: "won" }, { name: "Claude Shannon", via: "nominated", result: "not needed" }, { name: "Barbara Liskov", via: "nominated", result: "not needed" }],
            eliminations: [{ name: "Katherine Johnson", method: "Eliminated" }, { name: "Barbara Liskov", method: "Quit" }],
            groupChanges: [], events: [{ type: "captain", name: "Ada", confidence: "high" }] },
          { number: 2, title: "Final", airDate: null, dailyWinners: [], eliminationRound: [],
            eliminations: [{ name: "Edsger Dijkstra", method: "Finalist" }, { name: "Alan Turing", method: "Finalist" }, { name: "Grace Hopper", method: "Winner" }], groupChanges: [], events: [] },
        ],
      },
    ]);
  }
  return list;
}

for (const id of FORMAT_IDS) {
  const format = Formats.formatFor(id);
  section(`${id} :: wiki episodes schema :: sent to Anthropic`, sent(format.wiki.episodesSchema(z)));
  for (const [tname, terms] of Object.entries(TERM_SETS)) section(`${id} :: wiki episodes prompt (${tname})`, format.wiki.episodesPrompt(terms));
  for (const [label, extracted] of wikiExtractions(format)) {
    section(`${id} :: wiki validate, ${label}`, attempt(() => W.validateEpisodes(extracted, wikiState(), TERM_SETS.default, format)));
  }
}

// ---------- league state: points, implied events, scores ----------
function leagueFor(format, mode) {
  const exits = format.exitMethods;
  const castaways = exits.map((_, i) => ({ id: `c${i}`, name: `Person ${i}`, ownerIds: [i % 2 ? "p2" : "p1"], status: "active" }));
  castaways.push({ id: "cx", name: "Exiled", ownerIds: ["p1"], status: "active" });
  const manual = format.events.filter((e) => !e.implied);
  const ep1 = {
    id: "ep1", number: 1, title: "", events: [{ castawayId: "c0", method: exits[0] }],
    exiled: [{ castawayId: "cx" }],
    roles: format.roles ? [{ castawayId: "c1", role: format.roles.values[0] }] : [],
    lineups: { p1: castaways.filter((c, i) => i % 2 === 0).map((c) => c.id), p2: castaways.filter((c, i) => i % 2 === 1).map((c) => c.id) },
    scoringEvents: manual.map((e, i) => ({ id: `s${i}`, type: e.id, castawayId: castaways[i % castaways.length].id })),
  };
  const ep2 = {
    id: "ep2", number: 2, title: "",
    events: exits.slice(1).map((method, i) => ({ castawayId: `c${i + 1}`, method, ...(i % 2 ? { juryVotes: i % 3 } : {}) })),
    roles: format.roles ? [{ castawayId: "c2", role: format.roles.values[format.roles.values.length - 1] }] : [],
    lineups: ep1.lineups, scoringEvents: [],
  };
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", showFormat: format.id, ownershipMode: mode, activeSlots: 6, benchSlots: 2, startEpisode: 1 },
    players: [{ id: "p1", name: "Ann", color: "#111" }, { id: "p2", name: "Bob", color: "#222" }],
    castaways,
    episodes: [ep1, ep2],
  });
}

for (const id of FORMAT_IDS) {
  const format = Formats.formatFor(id);
  for (const mode of ["exclusive", "shared"]) {
    const s = leagueFor(format, mode);
    section(`${id} :: league (${mode})`, {
      formatOf: StateLogic.formatOf(s).id,
      defaultEventPoints: StateLogic.defaultEventPoints(s),
      pointsFor: Object.fromEntries(format.events.map((e) => [e.id, StateLogic.ActiveRosterLogic.pointsFor(s, e.id)])),
      episodeEvents: s.episodes.map((ep) => StateLogic.ActiveRosterLogic.episodeEvents(s, ep)),
      addEvent: format.events.map((e) => [e.id, !!StateLogic.ActiveRosterLogic.addEvent(leagueFor(format, mode), "ep2", e.id, "c0")]),
      roleOf: format.roles ? s.castaways.map((c) => [c.id, StateLogic.roleOf(s, c.id, 1), StateLogic.roleOf(s, c.id, 2)]) : null,
      scores: attempt(() => StateLogic.computeScores(s)),
    });
  }
  if (format.impliedEvents) {
    const roleOf = (cid) => (cid === "c1" ? "Traitor" : "Faithful");
    const every = { number: 5, events: format.exitMethods.map((method, i) => ({ castawayId: `c${i}`, method, juryVotes: i % 3 })), exiled: [{ castawayId: "cx" }], roles: format.roles ? format.roles.values.map((role, i) => ({ castawayId: `c${i}`, role })) : [] };
    const noWinner = { ...every, events: every.events.filter((e) => e.method !== format.winnerExitMethod) };
    section(`${id} :: impliedEvents`, { every: format.impliedEvents(every, { roleOf }), noWinner: format.impliedEvents(noWinner, { roleOf }), empty: format.impliedEvents({ number: 1 }, { roleOf }) });
  }
}

// ---------- function sources ----------
// Not behaviour: which functions changed. A refactor that moves data out of a format should only
// ever show the functions it rebuilt from data here.
function sources(obj, path, acc) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "function") acc[`${path}.${k}`] = crypto.createHash("sha256").update(v.toString()).digest("hex").slice(0, 16);
    else if (v && typeof v === "object" && !Array.isArray(v)) sources(v, `${path}.${k}`, acc);
  }
  return acc;
}
section("function sources", Object.fromEntries(FORMAT_IDS.map((id) => [id, sources(Formats.formatFor(id), id, {})])));

process.stdout.write(out.join("\n"));
