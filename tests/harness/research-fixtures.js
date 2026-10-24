// The research answers the format harness (format-regression.js) feeds every format, shared so tests can run
// the same answers through two formats and compare (tests/rulebook-golden.test.js: a built-in against its
// compiled rulebook). Deterministic: no randomness, so the harness output is unchanged by the move.
//
//   patterned(format, offset)  every checklist field filled from the schema, rotating through its values
//   scenarios(format)          hand-built answers the patterned ones won't reach, [label, payload] pairs
const R = require("../../db/episode-research.js");
const W = require("../../db/wiki-sync.js");

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
    // Chosen for a reward: scores only for someone who didn't win it themselves.
    const r = s();
    set(r, "Ada Lovelace", { chosenForReward: "yes", wonIndividualReward: "no", wonTribeReward: "no" });
    set(r, "Grace Hopper", { chosenForReward: "yes", wonTribeReward: "yes" });
    set(r, "Alan Turing", { chosenForReward: "yes", wonIndividualReward: "yes" });
    // Two results from one person in the same breath (their order is pinned), and an idol that
    // cancelled exactly one vote.
    set(r, "Hedy Lamarr", { wonIndividualImmunity: "yes", individualChallengeFinish: 2, playedAdvantage: "yes", votesNullified: 1 });
    list.push(["reward", r]);
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
    // Danger from the Traitors (scored only for a Faithful, or someone not known to be a Traitor, who
    // stayed), and votes and case leads where one side's role is unknown (never scored).
    const d = s();
    set(d, "Ada Lovelace", { isTraitor: "no", wonShield: "yes", shieldSavedThem: "yes", onMurderShortlist: "yes", consideredForMurder: "yes" });
    set(d, "Grace Hopper", { isTraitor: "unknown", onMurderShortlist: "no", consideredForMurder: "yes" });
    set(d, "Alan Turing", { ...at, isTraitor: "unknown", leftTheGame: "yes", exitMethod: "Banished", votesReceived: 4, accusedBy: ["Katherine Johnson", "Hedy"] });
    set(d, "Katherine Johnson", { ...at, isTraitor: "no", votedFor: ["Alan Turing"] });
    set(d, "Hedy Lamarr", { ...at, isTraitor: "yes", votedFor: ["Alan"], consideredForMurder: "yes" });
    set(d, "Claude Shannon", { isTraitor: "no", becameTraitor: "yes", onMurderShortlist: "yes" });
    list.push(["murder danger", d]);
    // Every Traitor-side outcome, and answers that disagree about a role (any "Traitor" answer wins
    // over isTraitor "no"), on both the voter's and the banished person's side. Blank names in a list
    // don't count.
    const b = s();
    set(b, "Ada Lovelace", { ...at, isTraitor: "yes", votedFor: ["Grace Hopper"] });
    set(b, "Grace Hopper", { ...at, isTraitor: "no", leftTheGame: "yes", exitMethod: "Banished", votesReceived: 3, accusedBy: ["Ada Lovelace", "Alan Turing"] });
    set(b, "Alan Turing", { ...at, isTraitor: "no", becameTraitor: "yes", votedFor: ["Grace", ""] });
    set(b, "Katherine Johnson", { ...at, isTraitor: "no", votedFor: ["Hedy Lamarr"], accusedBy: ["", ""] });
    set(b, "Hedy Lamarr", { ...at, isTraitor: "no", recruitedAsTraitor: "yes", leftTheGame: "yes", exitMethod: "Banished", accusedBy: ["Katherine Johnson"] });
    list.push(["roles both ways", b]);
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

module.exports = { TERM_SETS, CAST, BETS, ctxFor, patterned, scenarios };
