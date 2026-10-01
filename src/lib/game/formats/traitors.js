// The Traitors format. See survivor.js for the shape every format has, and docs/PLAN-show-formats.md
// for the confirmed catalog and the wiki investigation this is built on (US4 completed, US5 live).
//
// Two things set it apart from Survivor:
//
//   * ROLES. Everyone is a Faithful unless made a Traitor -- chosen at the start, or recruited later.
//     A role is recorded as a per-episode fact (episode.roles, like exile), so it reaches a league
//     through the same reveal-gated decisions as everything else: a league catching up doesn't learn
//     who the Traitors are before it reaches the episode that showed it.
//
//   * IMPLIED EVENTS. Being murdered, reaching the end, winning, being caught as a Traitor and being
//     recruited are all facts the league already holds as an exit or a role. They score through
//     impliedEvents rather than as separately reviewed events, so correcting an exit (Banished ->
//     Murdered) can't leave a stale event behind. Such events are marked `implied` and can't be
//     added by hand.

const exitMethods = ['Banished', 'Murdered', 'Left the game', 'Finalist', 'Winner', 'Other'];

// Role values a decision can record. Both mean "is a Traitor from this episode on"; the second is
// also the recruited event.
const ORIGINAL = 'Traitor';
const RECRUITED = 'Recruited Traitor';

// Defaults are commissioner-editable, and deliberately 0 for the two that are bad news for whoever
// owns the person -- whether being murdered or caught should cost points is a league's call.
const events = [
  { id: 'shieldWon', label: 'Won a shield or immunity', defaultPoints: 2 },
  { id: 'survivedRoundTable', label: 'Received banishment votes but survived', defaultPoints: 1 },
  { id: 'votedOutTraitor', label: 'Voted for a Traitor who was banished', defaultPoints: 2 },
  { id: 'recruited', label: 'Recruited as a Traitor', defaultPoints: 3, implied: true },
  { id: 'finalist', label: 'Reached the end as a Finalist', defaultPoints: { exclusive: 3, shared: 5 }, implied: true },
  { id: 'seasonWinner', label: 'Won the season', defaultPoints: { exclusive: 5, shared: 10 }, implied: true },
  // Murdered stays 0: it usually means the Traitors saw you as a threat, and nobody can see it coming
  // to bench you. Being banished either way, or walking out, costs points.
  { id: 'murdered', label: 'Murdered', defaultPoints: 0, implied: true },
  { id: 'banishedAsFaithful', label: 'Banished as a Faithful', defaultPoints: -3, implied: true },
  { id: 'banishedAsTraitor', label: 'Banished as a Traitor (caught)', defaultPoints: -3, implied: true },
  { id: 'leftGame', label: 'Left the game', defaultPoints: -5, implied: true },
];

// Events that follow from what an episode already records. `ctx.roleOf(castawayId, n)` is the role
// someone held as of episode n.
function impliedEvents(ep, ctx) {
  const out = [];
  for (const el of ep.events || []) {
    if (el.method === 'Murdered') out.push({ type: 'murdered', castawayId: el.castawayId });
    if (el.method === 'Finalist') out.push({ type: 'finalist', castawayId: el.castawayId });
    if (el.method === 'Winner') out.push({ type: 'seasonWinner', castawayId: el.castawayId });
    if (el.method === 'Banished') {
      const traitor = ctx.roleOf(el.castawayId, ep.number) === 'Traitor';
      out.push({ type: traitor ? 'banishedAsTraitor' : 'banishedAsFaithful', castawayId: el.castawayId });
    }
    if (el.method === 'Left the game') out.push({ type: 'leftGame', castawayId: el.castawayId });
  }
  for (const r of ep.roles || []) {
    if (r.role === RECRUITED) out.push({ type: 'recruited', castawayId: r.castawayId });
  }
  return out;
}

// ---------- wiki (db/wiki-sync.js) ----------
// A season page carries two tables, both transcluded from per-season templates:
//   == Contestants ==    Template:US5 Contestant Info -- one row per person: Faction ("Traitor",
//                        "Traitor (from Episode 3)"), Result, Exit Episode, Finish. Clean; the source
//                        for exits and roles.
//   == Voting History == Template:US5 Voting History -- one column per Round Table (an episode can
//                        have several), a row per person, with who they voted for and cell classes
//                        for shields, immunity, the murder shortlist and so on. Messy; the source for
//                        votes and shields.

// Only shields are read as events. Round Table outcomes are derived from the votes (derivedEvents),
// and everything in `events` marked implied comes from exits and roles.
const wikiEventTypes = ['shieldWon'];

function episodesSchema(z) {
  const person = z.string().describe("The person's FULL name, as the Contestants table gives it.");
  return z.object({
    originalTraitors: z
      .array(z.object({ name: person }))
      .describe(
        "The Traitors chosen at the start of the season: everyone whose Faction is plain 'Traitor'. Not " +
          "anyone recruited later (their Faction reads 'Traitor (from Episode N)')."
      ),
    episodes: z.array(
      z.object({
        number: z.number().int().describe("Episode number, starting at 1."),
        title: z.string().nullable().describe("Episode title if given, without wiki link markup."),
        airDate: z.string().nullable().describe("Air date exactly as printed. Null if absent."),
        eliminations: z
          .array(
            z.object({
              name: person,
              method: z
                .enum(exitMethods)
                .describe(
                  "From the Contestants table's Result column: Banished -> Banished; Murdered -> Murdered; " +
                    "left, withdrew or was removed -> Left the game; Finalist or Runner-up -> Finalist; " +
                    "Winner -> Winner. Use Other only if none of these fit."
                ),
            })
          )
          .describe(
            "Everyone whose Exit Episode in the Contestants table is THIS episode, with their Result. " +
              "A murder and a banishment in the same episode are both listed; the finale usually has " +
              "several. Someone with no Result yet is still in the game -- leave them out."
          ),
        recruited: z
          .array(z.object({ name: person }))
          .describe(
            "Anyone who became a Traitor in THIS episode: their Faction reads 'Traitor (from Episode N)' " +
              "with N equal to this episode. Empty otherwise."
          ),
        roundTables: z
          .array(
            z.object({
              banished: z
                .string()
                .nullable()
                .describe("FULL name of the person banished at this Round Table, from the Banishment row. Null if nobody was."),
              votes: z
                .array(z.object({ voter: person, votedFor: person }))
                .describe(
                  "One entry per person who cast a vote at this Round Table: the row's person and the " +
                    "name in their cell. Skip cells that aren't a vote (No Vote, Banish Again, End Game, " +
                    "Murdered, blank)."
                ),
            })
          )
          .describe(
            "Each Round Table in this episode, in order -- one per Voting History column whose header is " +
              "this episode. An episode can have more than one (a 'Banish Again' round) or none."
          ),
        events: z
          .array(
            z.object({
              type: z.enum(wikiEventTypes),
              name: person,
              confidence: z
                .enum(["high", "low"])
                .describe("'high' only when a cell states it directly. 'low' for anything inferred."),
            })
          )
          .describe(
            "shieldWon: someone whose Voting History cell in this episode's column is marked Shielded " +
              "({{c|shield|...}}) or Immune ({{c|immune|...}}). Once per person per episode. Omit rather " +
              "than guess."
          ),
      })
    ),
  });
}

function episodesPrompt(terms) {
  return {
    system:
      "You extract structured data from MediaWiki wikitext about a season of The Traitors. Report only " +
      "what the wikitext actually states. Never infer, complete or correct anything from outside " +
      "knowledge of the show -- if a field isn't in the text, return null, and if you cannot tell whether " +
      "something happened, omit it rather than guessing.\n\n" +
      "The text contains more than one table, each marked with an HTML comment naming the template it " +
      `came from. The Contestants table has one row per ${terms.castaway}: Faction, Result, Exit Episode ` +
      "and Finish. It is the authority for who left, how, in which episode, and who was a Traitor. The " +
      "Voting History table has a column per Round Table and a row per person, and is the authority for " +
      "votes and shields. A season still airing has blank Result and Exit Episode cells for everyone " +
      "still in the game.\n\n" +
      "Voting History cells use {{c|<class>|<text>|<colspan>|<rowspan>}}. The column headers are episode " +
      "numbers, and one episode can span several columns: work out which episode each cell belongs to " +
      "from the header row's colspans before reporting it. Classes: shield = Shielded, immune = Immune " +
      "from banishment, trial = on the Traitors' murder shortlist, dagger = used a Dagger (their vote " +
      "counted twice -- still one vote entry), murder = Murdered, banf/bant = the Banishment row's " +
      "banished Faithful / Traitor, traitor/recruit = the person's row marker for an original / recruited " +
      "Traitor, ryes = accepted a recruitment offer, novote/na/notingame = nothing to report.\n\n" +
      "The Voting History uses short names ('Rob R', 'Yam Yam'). Always report the FULL name from the " +
      "Contestants table for every person, including voters and the people they voted for.",
    user:
      "Extract the per-episode record for this season: who left each episode and how, who became a " +
      "Traitor, each Round Table's votes and banishment, and who held a shield or immunity.",
  };
}

// Round Table outcomes, derived from the extracted votes rather than asked for, so they're only as
// wrong as the vote read itself. `same(a, b)` compares two names by who they resolve to.
function derivedEvents(ep, extracted, same) {
  const out = [];
  const traitors = [
    ...(extracted.originalTraitors || []).map((t) => t.name),
    ...(extracted.episodes || []).filter((e) => e.number <= ep.number).flatMap((e) => (e.recruited || []).map((r) => r.name)),
  ];
  const leftThisEpisode = (ep.eliminations || []).map((el) => el.name);
  const survived = [];
  for (const rt of ep.roundTables || []) {
    for (const v of rt.votes || []) {
      const target = v.votedFor;
      if (!target || (rt.banished && same(target, rt.banished))) continue;
      if (leftThisEpisode.some((n) => same(n, target)) || survived.some((n) => same(n, target))) continue;
      survived.push(target);
    }
    if (rt.banished && traitors.some((t) => same(t, rt.banished))) {
      for (const v of rt.votes || []) {
        if (v.votedFor && same(v.votedFor, rt.banished)) out.push({ type: 'votedOutTraitor', name: v.voter, confidence: 'low' });
      }
    }
  }
  for (const name of survived) out.push({ type: 'survivedRoundTable', name, confidence: 'low' });
  return out;
}

// Role facts from the read: originals at episode 1, recruits at the episode they turned.
function wikiRoles(extracted) {
  return [
    ...(extracted.originalTraitors || []).map((t) => ({ episode: 1, name: t.name, role: ORIGINAL })),
    ...(extracted.episodes || []).flatMap((e) => (e.recruited || []).map((r) => ({ episode: e.number, name: r.name, role: RECRUITED }))),
  ];
}

// ---------- research (db/episode-research.js) ----------

function checklistSchema(z, Answer) {
  return z.object({
    name: z.string().describe("The contestant's full name, exactly as given in the list you were sent."),

    // --- leaving the game ---
    leftTheGame: Answer.describe("Did this person leave the game permanently in THIS episode (murdered, banished, left, or the finale)?"),
    exitMethod: z.enum(exitMethods).nullable().describe("How they left, if they left. Null if they did not leave."),

    // --- the Round Table ---
    attendedRoundTable: Answer.describe("Did they attend a Round Table this episode?"),
    votesReceived: z
      .number()
      .int()
      .nullable()
      .describe("How many banishment votes were cast against them this episode. 0 if they attended and got none. Null if unknown or no Round Table."),
    votedFor: z.string().nullable().describe("The full name of the person they voted to banish, if reported. Null if unknown or they did not vote."),
    votedForBanishedTraitor: Answer.describe("Did they vote for the person banished this episode, AND was that person revealed as a Traitor?"),

    // --- safety and roles ---
    wonShield: Answer.describe("Did they win or hold a shield (protection from murder) or immunity from banishment this episode?"),
    recruitedAsTraitor: Answer.describe("Did they become a Traitor this episode (recruited or given an ultimatum and accepted)?"),

    notableTwist: z
      .string()
      .nullable()
      .describe("Any other notable, checkable thing that happened to this person this episode, in one short phrase. Null if nothing."),

    // --- provenance, per person ---
    sources: z
      .array(z.string())
      .describe("URLs you actually read that support the answers above for THIS person. Empty only if every answer is 'unknown'."),
    confidence: z
      .enum(["high", "medium", "low"])
      .describe("high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source."),
  });
}

function episodeFields(z, Answer) {
  return { roundTableHeld: Answer, murderHappened: Answer };
}

const researchSearchHint = [
  "Search for the episode recap, the episode's wiki page, and any reporting on who was murdered, who",
  "was banished and how people voted at the Round Table, shields, and any recruitment. Then answer the",
  "checklist for every person above.",
];

function researchEntryProblems(entry) {
  const problems = [];
  if (entry.attendedRoundTable === "no" && Number.isInteger(entry.votesReceived) && entry.votesReceived > 0) {
    problems.push(`${entry.name}: ${entry.votesReceived} votes against someone who didn't attend the Round Table`);
  }
  if (entry.wonShield === "yes" && entry.exitMethod === "Murdered") {
    problems.push(`${entry.name}: murdered despite holding a shield`);
  }
  if (entry.votedForBanishedTraitor === "yes" && !entry.votedFor) {
    problems.push(`${entry.name}: voted out a Traitor but no vote given`);
  }
  return problems;
}

const researchClaims = ["leftTheGame", "wonShield", "recruitedAsTraitor", "votedForBanishedTraitor"];

// Exits aren't staged from research (the wiki's Contestants table is the source for those), so
// neither are the events they imply.
function researchItems(entry, add) {
  if (entry.wonShield === "yes") add("event", "shieldWon");
  if (typeof entry.votesReceived === "number" && entry.votesReceived > 0 && entry.leftTheGame !== "yes") {
    add("event", "survivedRoundTable");
  }
  if (entry.votedForBanishedTraitor === "yes") add("event", "votedOutTraitor");
  if (entry.recruitedAsTraitor === "yes") add("role", "", RECRUITED);
}

// One person's answers as short phrases for a reviewer, listing only what happened.
function researchNotes(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`OUT — ${c.exitMethod || "method unknown"}`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`${c.votesReceived} vote${c.votesReceived === 1 ? "" : "s"} against`);
  if (c.votedFor) notes.push(`voted ${c.votedFor}`);
  if (c.votedForBanishedTraitor === "yes") notes.push("voted out a Traitor");
  if (c.wonShield === "yes") notes.push("shield / immunity");
  if (c.recruitedAsTraitor === "yes") notes.push("became a Traitor");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The same, as sentences, for semantic search (db/embeddings.js).
function researchSentences(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`left the game (${c.exitMethod || "method unknown"})`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`received ${c.votesReceived} vote(s) at the Round Table`);
  if (c.votedFor) notes.push(`voted for ${c.votedFor}`);
  if (c.votedForBanishedTraitor === "yes") notes.push("voted for a Traitor who was banished");
  if (c.wonShield === "yes") notes.push("won a shield or immunity");
  if (c.recruitedAsTraitor === "yes") notes.push("became a Traitor");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

module.exports = {
  id: 'traitors',
  name: 'The Traitors',
  exitMethods,
  winnerExitMethod: 'Winner',
  events,
  // Groups for "How starters score" (active-roster-lineup-grid.tsx), in this order.
  eventCategories: [
    { id: 'missions', label: 'Missions', events: ['shieldWon'] },
    { id: 'roundTable', label: 'Round Table', events: ['votedOutTraitor', 'survivedRoundTable', 'banishedAsFaithful', 'banishedAsTraitor'] },
    { id: 'twists', label: 'Twists', events: ['recruited', 'murdered'] },
    { id: 'leaving', label: 'Leaving the game', events: ['leftGame'] },
    { id: 'endgame', label: 'Endgame', events: ['seasonWinner', 'finalist'] },
  ],
  impliedEvents,
  hasMerge: false,
  hasGroups: false,
  roles: {
    // What everyone is until a role decision says otherwise.
    default: 'Faithful',
    values: [ORIGINAL, RECRUITED],
    // Which role a recorded value makes someone.
    roleFor: () => 'Traitor',
  },
  wiki: {
    voteSections: ["Voting History", "Vote History", "Voting"],
    // The "guide" half here is the Contestants table: exits, results and factions.
    guideSections: ["Contestants", "Contestant Info", "Cast", "Players"],
    missingVotesNote: "no voting table found -- shields and Round Table votes will be missing",
    missingGuideNote: "no contestants table found -- exits and Traitors will be missing",
    // Faction is a secret role, not a grouping -- read as one it would hand every league the list of
    // Traitors as "tribes" the moment the cast is approved.
    castNote:
      "The Faction column (Traitor / Faithful) is a secret role, NOT a group: never report it as a tribe " +
      "or as anyone's tribeName. This show has no groups unless the table has a separate team column.",
    eventTypes: wikiEventTypes,
    episodesSchema,
    episodesPrompt,
    rejectEvent: () => null,
    derivedEvents,
    roles: wikiRoles,
    // A murder and a banishment is an ordinary episode here, so only flag more than that.
    routineEliminations: 2,
  },
  research: {
    checklistSchema,
    episodeFields,
    searchHint: researchSearchHint,
    entryProblems: researchEntryProblems,
    claims: researchClaims,
    items: researchItems,
    notes: researchNotes,
    sentences: researchSentences,
  },
};
