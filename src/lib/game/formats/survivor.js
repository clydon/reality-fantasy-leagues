// The Survivor format: everything about a show that's Survivor's own rather than any reality show's
// -- how people leave, what's worth scoring, the merge, how its wiki lays out a season, and what to
// ask research about. See docs/PLAN-show-formats.md for what a format is and why it's code.
//
// Moved here unchanged from state-logic.js, db/wiki-sync.js and db/episode-research.js, where it used
// to be hard-coded. Plain CommonJS with no dependencies, because the browser bundle (via
// state-logic.js) and the bare-node connectors both read it. That's also why the schemas are
// functions that are handed `z` rather than importing zod themselves.

// How someone can leave the game. Written straight onto castaway.exitMethod, which the Episodes UI
// renders and scoring reads, so the connectors use this as a hard enum rather than free text.
const exitMethods = ['Voted Out','Medically Evacuated','Quit','Lost Fire-Making','Lost Final Tribal (Jury Vote)','Sole Survivor','Other'];

// The Active Roster catalog. Ordered so the settings UI renders one point input per row in a stable
// order, and every default is commissioner-editable -- including down to 0, which is how you switch
// a category off without needing the catalog itself to change (same shape as the existing side-bet
// point inputs). Adding a type here automatically gives it a settings input and makes it selectable
// in the event-entry UI; `eventPoints` falls back to the catalog default for any type a league
// hasn't customised, so adding one never needs a migration.
const events = [
  { id: 'individualImmunity', label: 'Individual immunity win', defaultPoints: 5 },
  { id: 'tribeImmunity', label: 'Tribe/team immunity win', defaultPoints: 2 },
  { id: 'rewardWin', label: 'Reward win', defaultPoints: 2 },
  { id: 'idolFound', label: 'Idol/advantage found', defaultPoints: 3 },
  { id: 'idolPlayed', label: 'Idol/advantage played', defaultPoints: 2 },
  { id: 'zeroVotesSafe', label: 'Safe at Tribal, zero votes against', defaultPoints: 1 },
  // The next three exist because db/episode-research.js (a web search, not a wiki table) can answer
  // questions the wiki connector structurally can't -- see docs/RESEARCH-extractable-stats.md tier D.
  // Defaults are deliberately conservative (low or zero): these are new, unfamiliar categories and a
  // commissioner should decide on purpose whether "survived a vote" or "sat out" should earn points,
  // rather than inherit a value chosen for them. Changing any of these is a settings edit, not code.
  { id: 'survivedVotes', label: 'Received votes at Tribal but survived', defaultPoints: 1 },
  { id: 'advantageTargeted', label: 'Had an advantage used against them', defaultPoints: 1 },
  { id: 'satOut', label: 'Sat out a challenge', defaultPoints: 0 }
];

// ---------- wiki (db/wiki-sync.js) ----------

// Scoring-event types the connector is ALLOWED to suggest. This is `events` minus `idolFound`, and
// the omission is the point: the investigation found idol FINDS appear in neither the vote table nor
// the episode guide (they live in per-episode prose recaps, if anywhere), so the connector has no
// source for them. Leaving the value out of the enum makes it structurally impossible for the model
// to emit one, which is a stronger guarantee than dropping it in validation.
const wikiEventTypes = ['individualImmunity', 'tribeImmunity', 'rewardWin', 'idolPlayed', 'zeroVotesSafe'];

// Per-field confidence, which the plan asks for explicitly: "auto-suggested + high confidence for
// exit method/tribe assignments; auto-suggested + lower confidence ... for immunity/reward winners and
// idol plays/zero-vote safes". Carried through to the review UI so the two aren't reviewed alike.
function episodesSchema(z) {
  return z.object({
    mergeEpisode: z
      .number()
      .int()
      .nullable()
      .describe(
        "The episode number from which the cast plays as one merged group, read from the vote table's " +
          "top header row (its columns are grouped into original/shuffled/merged spans). Null if the " +
          "table doesn't show a merge."
      ),
    episodes: z.array(
      z.object({
        number: z.number().int().describe("Episode number as the table numbers it, starting at 1."),
        title: z.string().nullable().describe("Episode title if given, without wiki link markup."),
        airDate: z.string().nullable().describe("Air date exactly as printed, e.g. 'March 1, 2023'. Null if absent."),
        postMerge: z.boolean().describe("True if this episode is at or after mergeEpisode."),
        eliminations: z
          .array(
            z.object({
              name: z
                .string()
                .describe(
                  "The person's FULL name. The vote table's cells carry it in the image link target " +
                    "(e.g. [[File:...|link=Bruce Perreault]]) even though the visible caption is just " +
                    "the first name -- use the link target when one is present."
                ),
              method: z
                .enum(exitMethods)
                .describe(
                  "How they left, from the Finish column: 'Nth Voted Out' -> Voted Out; 'Evacuated' -> " +
                    "Medically Evacuated; 'Quit' -> Quit; lost a fire-making challenge -> Lost " +
                    "Fire-Making; lost the final jury vote -> Lost Final Tribal (Jury Vote); the winner " +
                    "-> Sole Survivor. Use Other only if none of these fit."
                ),
            })
          )
          .describe(
            "Everyone who left the game PERMANENTLY in this episode, in the order they left. Almost " +
              "always exactly one -- only include more than one if the Finish column explicitly marks " +
              "more than one person as out THIS episode (a rare, explicit double/triple boot). " +
              "Receiving votes is NOT the same as being eliminated: only the person(s) the Finish " +
              "column actually marks as out belong here. Someone who received votes but was saved by " +
              "an idol, a steal-a-vote, or a random-chance advantage (e.g. a 'Shot in the Dark') is " +
              "still active -- do not list them. Do not guess based on vote counts alone."
          ),
        exiled: z
          .array(z.object({ name: z.string().describe("FULL name, same rule as eliminations.") }))
          .describe(
            "Some seasons run an 'Exile Island'-style twist: one or more people are sent away from " +
              "their tribe for this episode (or until a later one) WITHOUT being eliminated -- they " +
              "stay in the game and return to a tribe later. List anyone the text identifies as " +
              "currently exiled/away from their tribe here, NEVER in eliminations. Omit entirely if " +
              "the season has no such twist or none is in effect this episode."
          ),
        events: z
          .array(
            z.object({
              type: z.enum(wikiEventTypes),
              name: z.string().describe("FULL name, same rule as eliminations."),
              confidence: z
                .enum(["high", "low"])
                .describe(
                  "'high' only when the table states this directly and unambiguously. Use 'low' for " +
                    "anything inferred -- whether an immunity win was individual or tribal, anything " +
                    "read via a footnote marker, and any zero-votes-safe you worked out by counting."
                ),
            })
          )
          .describe(
            "Notable things that happened to individuals this episode. tribeImmunity/rewardWin: when a " +
              "TRIBE wins, list every member of it. individualImmunity: post-merge individual wins only. " +
              "idolPlayed: from the footnote marker on a vote cell. zeroVotesSafe: someone who attended " +
              "Tribal Council and received no votes -- count the votes cast in that episode's column. " +
              "Omit an event entirely rather than guessing at it."
          ),
      })
    ),
  });
}

// Per-episode extraction reads BOTH tables in one call because it needs both: who left and how comes
// from the vote table's terminal cells and the guide's Finish column, while immunity and reward wins
// are only in the guide.
function episodesPrompt(terms) {
  return {
    system:
      "You extract structured data from MediaWiki wikitext. Report only what the wikitext actually " +
      "states. Never infer, complete or correct anything from outside knowledge of the show -- if a " +
      "field isn't in the text, return null, and if you cannot tell whether an event happened, omit " +
      "it rather than guessing.\n\n" +
      "The text contains more than one table, each marked with an HTML comment naming the template it " +
      "came from. One is a per-episode guide (air date, reward and immunity winners, who was " +
      "eliminated, their finish). Another is a vote grid with one column per episode and one row per " +
      `${terms.castaway}. They describe the SAME episodes -- combine them, keyed on episode number.\n\n` +
      "These tables use rowspan and colspan heavily, so one cell can belong to several rows or " +
      "columns. Work out which episode each cell belongs to before reporting it.\n\n" +
      "Footnote markers look like {{sup|[[#endnote <anchor>|<n>]]}} and resolve against the " +
      "{{note|<anchor>|<n>}} entries in the Notes block at the bottom of the same table. Match them " +
      "by ANCHOR, never by number: the numbers differ from season to season.\n\n" +
      "The vote grid's per-episode column can carry several DIFFERENT kinds of cell that are easy to " +
      "conflate -- keep them separate: (1) who was voted out this episode -- goes in eliminations, " +
      "and is normally exactly one person; (2) how many votes each attendee received -- a count, not " +
      "an elimination, even for the person with the most votes if someone else was actually voted out " +
      "or if a save changed the result; (3) an advantage played that changed or nullified the result " +
      "(idol, steal-a-vote, a random-chance save like a 'Shot in the Dark') -- the person it saved is " +
      "NOT eliminated even though they were in the vote; (4) someone sent to an 'Exile Island'-style " +
      "twist, away from their tribe but still in the game -- goes in exiled, never in eliminations. " +
      "When in doubt about whether a name belongs in eliminations, leave it out rather than guess.",
    user:
      "Extract the per-episode record for this season: who left each episode and how, and which " +
      "notable things happened to individuals.",
  };
}

// Checks on one extracted event that only make sense for Survivor. Returns null to keep it, or why
// it was dropped: `problem` for the log and the proposal, `why` for the reviewer.
function rejectWikiEvent({ type, name, episode, eliminated, postMerge }) {
  // Someone voted out this episode can't also have been safe at that Tribal with no votes. This
  // is the cheapest real check available on the least reliable event type.
  if (type === "zeroVotesSafe" && eliminated) {
    return {
      problem: `dropped zeroVotesSafe for ${name} in episode ${episode} -- they were eliminated that episode`,
      why: "marked safe with no votes, but they were voted out that episode",
    };
  }
  // individualImmunity is a post-merge concept. Pre-merge, immunity is won by a tribe.
  if (type === "individualImmunity" && !postMerge) {
    return {
      problem: `dropped individualImmunity for ${name} in pre-merge episode ${episode}`,
      why: "read as an individual immunity win, which can't happen before the merge",
    };
  }
  return null;
}

// ---------- research (db/episode-research.js) ----------

// One castaway's checklist. `Answer` is the shared yes/no/unknown enum.
function checklistSchema(z, Answer) {
  return z.object({
    name: z.string().describe("The castaway's full name, exactly as given in the list you were sent."),

    // --- leaving the game ---
    leftTheGame: Answer.describe("Did this person leave the game permanently in THIS episode?"),
    exitMethod: z
      .enum(exitMethods)
      .nullable()
      .describe("How they left, if they left. Null if they did not leave."),

    // --- tribal council ---
    attendedTribal: Answer.describe("Did they attend Tribal Council this episode?"),
    votesReceived: z
      .number()
      .int()
      .nullable()
      .describe("How many votes were cast against them at Tribal this episode. 0 if they attended and got none. Null if unknown or no Tribal."),
    votedFor: z
      .string()
      .nullable()
      .describe("The full name of the person they voted for, if reported. Null if unknown or they did not vote."),

    // --- challenges ---
    wonIndividualImmunity: Answer,
    wonTribeImmunity: Answer.describe("Were they on the tribe/team that won immunity?"),
    wonIndividualReward: Answer,
    wonTribeReward: Answer.describe("Were they on the tribe/team that won reward?"),
    satOutOfChallenge: Answer.describe("Did they sit out of a challenge this episode?"),

    // --- advantages ---
    foundAdvantage: Answer.describe("Did they FIND a hidden immunity idol or any advantage this episode?"),
    advantageFoundName: z
      .string()
      .nullable()
      .describe("What they found, in the show's own words ('hidden immunity idol', 'Beware Advantage', 'Shot in the Dark'). Null if nothing."),
    playedAdvantage: Answer.describe("Did they PLAY an idol or advantage this episode (their own or on someone else)?"),
    advantagePlayedName: z.string().nullable(),
    votesNullified: z
      .number()
      .int()
      .nullable()
      .describe("If an idol they played nullified votes, how many. Null otherwise."),
    advantageUsedAgainstThem: Answer.describe("Was an advantage used against them (a vote stolen, blocked, nullified)?"),

    // --- twists ---
    exiled: Answer.describe("Were they sent away from their tribe by an Exile Island-style twist while staying in the game?"),
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

// Episode-level questions, asked alongside the per-person list.
function episodeFields(z, Answer) {
  return { tribalCouncilHeld: Answer };
}

// The line of the research prompt that says what to look for.
const researchSearchHint = [
  "Search for the episode recap, the episode's wiki page, and any reporting on idols or advantages",
  "found or played in it. Then answer the checklist for every person above.",
];

// Answers that contradict each other in ways only Survivor's checklist can. Each is cheap to check
// and each would otherwise reach a reviewer as a plausible-looking pair of answers.
function researchEntryProblems(entry) {
  const problems = [];
  if (entry.attendedTribal === "no" && Number.isInteger(entry.votesReceived) && entry.votesReceived > 0) {
    problems.push(`${entry.name}: ${entry.votesReceived} votes against someone who didn't attend Tribal`);
  }
  if (entry.wonIndividualImmunity === "yes" && entry.leftTheGame === "yes" && entry.exitMethod === "Voted Out") {
    problems.push(`${entry.name}: voted out despite winning individual immunity`);
  }
  if (entry.foundAdvantage === "yes" && !entry.advantageFoundName) {
    problems.push(`${entry.name}: found an advantage but didn't say what`);
  }
  return problems;
}

// Positive claims that need a source behind them.
const researchClaims = ["leftTheGame", "wonIndividualImmunity", "wonIndividualReward", "foundAdvantage", "playedAdvantage", "satOutOfChallenge"];

// One castaway's "yes" answers -> the results they imply. rewardWin covers both individual and tribe
// reward with the SAME event type, matching the wiki connector's own catalog, so winning both in one
// episode still earns exactly one item.
function researchItems(entry, add) {
  if (entry.wonIndividualImmunity === "yes") add("event", "individualImmunity");
  if (entry.wonTribeImmunity === "yes") add("event", "tribeImmunity");
  if (entry.wonIndividualReward === "yes" || entry.wonTribeReward === "yes") add("event", "rewardWin");
  if (entry.foundAdvantage === "yes") add("event", "idolFound");
  if (entry.playedAdvantage === "yes") add("event", "idolPlayed");
  if (entry.attendedTribal === "yes" && entry.votesReceived === 0) add("event", "zeroVotesSafe");
  // Survived, not eliminated THIS episode: someone voted out with votes against them was voted out,
  // not "safe despite votes", so leftTheGame excludes them from this one.
  if (typeof entry.votesReceived === "number" && entry.votesReceived > 0 && entry.leftTheGame !== "yes") {
    add("event", "survivedVotes");
  }
  if (entry.advantageUsedAgainstThem === "yes") add("event", "advantageTargeted");
  if (entry.satOutOfChallenge === "yes") add("event", "satOut");
  // Exile is a fact, not a scoring event -- same as everywhere else exile appears in this app
  // (EpisodeLogic.addExiled). eventType stays '' to satisfy episode_research_items_shape.
  if (entry.exiled === "yes") add("exiled", "");
}

// One person's answers as short phrases for a reviewer (Admin, the CLI), listing only what happened.
function researchNotes(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`OUT — ${c.exitMethod || "method unknown"}`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`${c.votesReceived} vote${c.votesReceived === 1 ? "" : "s"} against`);
  if (c.votedFor) notes.push(`voted ${c.votedFor}`);
  if (c.wonIndividualImmunity === "yes") notes.push("individual immunity");
  if (c.wonTribeImmunity === "yes") notes.push("tribe immunity");
  if (c.wonIndividualReward === "yes") notes.push("individual reward");
  if (c.wonTribeReward === "yes") notes.push("tribe reward");
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (typeof c.votesNullified === "number" && c.votesNullified > 0) notes.push(`nullified ${c.votesNullified} vote${c.votesNullified === 1 ? "" : "s"}`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("advantage used against them");
  if (c.exiled === "yes") notes.push("exiled");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The same, as sentences, for semantic search (db/embeddings.js).
function researchSentences(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`left the game (${c.exitMethod || "method unknown"})`);
  if (typeof c.votesReceived === "number" && c.votesReceived > 0) notes.push(`received ${c.votesReceived} vote(s) at Tribal`);
  if (c.votedFor) notes.push(`voted for ${c.votedFor}`);
  if (c.wonIndividualImmunity === "yes") notes.push("won individual immunity");
  if (c.wonTribeImmunity === "yes") notes.push("was on the tribe that won immunity");
  if (c.wonIndividualReward === "yes") notes.push("won individual reward");
  if (c.wonTribeReward === "yes") notes.push("was on the tribe that won reward");
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("had an advantage used against them");
  if (c.exiled === "yes") notes.push("was exiled");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

module.exports = {
  id: 'survivor',
  name: 'Survivor',
  exitMethods,
  // The exit method that crowns the winner. Seeing it ends the season: no further episodes are
  // created, and the winner isn't a "loss" for replenish.
  winnerExitMethod: 'Sole Survivor',
  events,
  // The season has a merge, so episodes carry a post-merge flag and the UI offers it.
  hasMerge: true,
  wiki: {
    // What a season page might call the two per-episode tables. Generous synonyms rather than one
    // hardcoded heading, because the Survivor wiki's "Season Summary" is another wiki's "Season
    // Overview".
    voteSections: ["Voting History", "Vote History", "Voting Table", "Votes", "Voting"],
    guideSections: ["Season Summary", "Season Overview", "Episode Guide", "Episode Table", "Episodes", "Summary"],
    // Each half is genuinely optional, but they cover different fields, so say what's missing rather
    // than quietly extracting less.
    missingVotesNote: "no voting table found -- idol plays and zero-vote-safes will be missing",
    missingGuideNote: "no episode guide found -- immunity and reward wins will be missing",
    eventTypes: wikiEventTypes,
    episodesSchema,
    episodesPrompt,
    rejectEvent: rejectWikiEvent,
    // More eliminations than this in one episode is flagged for a second look: a double boot is rare
    // and explicit, and it's exactly what a misread rowspan would produce.
    routineEliminations: 1,
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
