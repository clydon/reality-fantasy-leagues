// The Survivor format: everything about a show that's Survivor's own rather than any reality show's
// -- how people leave, what's worth scoring, the merge, how its wiki lays out a season, and what to
// ask research about. See docs/PLAN-show-formats.md for what a format is.
//
// Every format is two halves, put together by defineFormat (define.js): DATA -- exit methods, the
// scoring catalog, wiki section names, the research checklist (checklist.js), the scoring rules
// (rules.js) -- that could live in a database row, and CODE -- the wiki read's schema and prompt,
// research's contradiction checks and notes -- that needs a developer. See
// docs/PLAN-ai-generated-show-formats.md and docs/PLAN-scoring-rules-as-data.md.
//
// Plain CommonJS with no dependencies, because the browser bundle (via state-logic.js) and the
// bare-node connectors both read it. That's also why the schemas are functions that are handed `z`
// rather than importing zod themselves.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js
const { defineFormat } = require('./define.js');

// How someone can leave the game. Written straight onto castaway.exitMethod, which the Episodes UI
// renders and scoring reads, so the connectors use this as a hard enum rather than free text.
const exitMethods = ['Voted Out','Medically Evacuated','Quit','Lost Fire-Making','Lost Final Tribal (Jury Vote)','Sole Survivor','Other'];

// The Active Roster catalog. Ordered so the settings UI renders one point input per row in a stable
// order, and every default is commissioner-editable -- including down to 0, which is how you switch
// a category off without needing the catalog itself to change (same shape as the existing side-bet
// point inputs). Adding a type here automatically gives it a settings input and makes it selectable
// in the event-entry UI; `eventPoints` falls back to the catalog default for any type a league
// hasn't customised, so adding one never needs a migration.
// Point values, balanced as a set. The aims:
//   * Rare, decisive moments (an immunity win, an idol that actually cancels votes) are worth the most;
//     things that happen to most of a tribe every week (tribe immunity, voting with the majority) the
//     least, so they add texture without deciding the league.
//   * {exclusive, shared}: in an exclusive league one team owns the eventual winner outright, and the
//     winner is usually the one piling up late-game immunity wins, challenge finishes and a safe vote
//     at every Tribal. Those categories are lower in exclusive leagues so owning the Sole Survivor is an
//     edge rather than the whole race. Strategic one-offs (idols, surviving votes) are the same in both:
//     they're spread across the cast rather than concentrated on the winner.
// Every value is a default: a league's own settings override it, and 0 switches a category off.
const events = [
  { id: 'individualImmunity', label: 'Individual immunity win', defaultPoints: { exclusive: 3, shared: 4 } },
  { id: 'challengeRunnerUp', label: 'Individual challenge: 2nd place', defaultPoints: { exclusive: 1.5, shared: 2 } },
  { id: 'challengeThird', label: 'Individual challenge: 3rd place', defaultPoints: 1 },
  { id: 'tribeImmunity', label: 'Tribe/team immunity win', defaultPoints: 1 },
  { id: 'rewardWin', label: 'Reward win', defaultPoints: { exclusive: 1, shared: 1.5 } },
  // Picked by a reward winner to go along: a read on who the winner trusts or needs.
  { id: 'chosenForReward', label: 'Chosen to join a reward (without winning it)', defaultPoints: 0.5 },
  { id: 'idolFound', label: 'Idol/advantage found', defaultPoints: 2 },
  { id: 'idolPlayed', label: 'Idol/advantage played', defaultPoints: 1 },
  // Tracked at 0 on purpose: whether research can tell this reliably (it lives in recaps, not tables)
  // is being checked against the episodes before it's worth anything. Private knowledge only (alone,
  // or within an alliance or small group -- not an idol everyone saw played at Tribal), and once per
  // advantage, or it becomes one of the most frequent events in the game. See
  // docs/RESEARCH-scoring-values.md.
  { id: 'learnedOfAdvantage', label: 'Learned of an idol/advantage (privately)', defaultPoints: 0 },
  { id: 'votesNegated', label: 'Played an idol/advantage that cancelled votes', defaultPoints: 2 },
  // Picked to go on a journey: a shot at an advantage, often at a risk (a lost vote), so it's worth
  // something but less than actually finding one (1 vs 2) -- and finding one there scores idolFound too.
  { id: 'wentOnJourney', label: 'Went on a journey', defaultPoints: 1 },
  // Scored from the episode's exile record (impliedEvents), but 0 by default: whether exile helps or
  // hurts is a live question this season (see EpisodeLogic.addExiled). A league can set it either way.
  { id: 'wentToExile', label: 'Sent to Exile', defaultPoints: 0, implied: true },
  { id: 'votedWithMajority', label: 'Voted with the majority (voted for who went home)', defaultPoints: { exclusive: 0.5, shared: 1 } },
  { id: 'zeroVotesSafe', label: 'Safe at Tribal, zero votes against', defaultPoints: { exclusive: 0.5, shared: 1 } },
  { id: 'survivedVotes', label: 'Received votes at Tribal but survived', defaultPoints: 1.5 },
  // Bad news, so negative: a stolen or blocked vote hurts, and sitting out usually marks a weak challenger.
  { id: 'advantageTargeted', label: 'Had an advantage used against them', defaultPoints: -0.5 },
  { id: 'satOut', label: 'Sat out a challenge', defaultPoints: -0.5 },
  // Tracked (the mirror of voting with the majority) but worth nothing by default -- a league can
  // choose to punish being on the wrong side of a vote.
  { id: 'votedAgainstMajority', label: 'Voted against the majority', defaultPoints: 0 },
  // How they left, scored automatically from the elimination itself (impliedEvents) -- the most
  // reliable data there is, and in Active Roster only a fielded castaway's exit counts, which is the
  // point: read the game and bench whoever's going home. A medevac isn't their doing and can't be
  // seen coming, and losing fire-making still means reaching the final four, so both are 0.
  { id: 'votedOut', label: 'Voted out', defaultPoints: -3, implied: true },
  { id: 'quit', label: 'Quit', defaultPoints: -5, implied: true },
  { id: 'medevac', label: 'Medically evacuated', defaultPoints: 0, implied: true },
  // Fire-making: winning is a big moment but not an immunity run (2 vs 3); losing it costs less than
  // being voted out (-1 vs -3) -- reaching the final four is something -- but it's still a loss.
  { id: 'wonFireMaking', label: 'Won fire-making', defaultPoints: 2 },
  { id: 'lostFireMaking', label: 'Lost fire-making', defaultPoints: -1, implied: true },
  // The finale, scored so how someone did at Final Tribal shows: every finalist (the winner too)
  // gets the base, then a point per jury vote, then the winner a bonus on top. A 7-2-0 vote is
  // 13 / 5 / 0 under shared defaults. The jury count rides on the elimination (ep.events[].juryVotes,
  // from research's juryVotesReceived), so all of these follow from it alone.
  { id: 'finalist', label: 'Reached Final Tribal Council', defaultPoints: { exclusive: 2, shared: 3 }, implied: true },
  { id: 'juryVote', label: 'Each jury vote received', defaultPoints: { exclusive: 0.5, shared: 1 }, implied: true },
  // The "goat": dragged to the end and given nothing by the jury. Cancels the finalist base by
  // default, so fielding one at the finale is worth nothing rather than a reward.
  { id: 'zeroJuryVotes', label: 'Finalist with no jury votes (goat)', defaultPoints: { exclusive: -2, shared: -3 }, implied: true },
  { id: 'soleSurvivor', label: 'Sole Survivor (bonus)', defaultPoints: { exclusive: 1, shared: 3 }, implied: true }
];

// ---------- scoring rules (rules.js) ----------

const yes = (answer) => ({ answer, is: 'yes' });
const notYes = (answer) => ({ answer, isNot: 'yes' });
const FINALISTS = ['Lost Final Tribal (Jury Vote)', 'Sole Survivor'];

// One castaway's answers -> the results they imply. rewardWin covers both individual and tribe reward
// with the SAME event type, matching the wiki connector's own catalog, so winning both in one episode
// still earns exactly one item (staging dedupes).
const researchRules = [
  { when: yes('wonIndividualImmunity'), award: 'individualImmunity' },
  // Only individual challenges: in tribe-vs-tribe, a place is a tribe's, and winning is scored already.
  { when: { answer: 'individualChallengeFinish', equals: 2 }, award: 'challengeRunnerUp' },
  { when: { answer: 'individualChallengeFinish', equals: 3 }, award: 'challengeThird' },
  { when: { all: [yes('playedAdvantage'), { answer: 'votesNullified', greaterThan: 0 }] }, award: 'votesNegated' },
  // Voted for someone who went home this episode, and didn't go home themselves -- or for someone who
  // didn't, at a Tribal where someone did (so a revote or tie isn't guessed at). Only a vote-out
  // counts: nobody voted for a quit or a medevac. votedFor may be written "Nicole" where the checklist
  // says "Nicole Mazullo", so names are compared by who they are.
  {
    when: notYes('leftTheGame'),
    builtIn: 'votedForLeaver', vote: 'votedFor', exitMethod: 'Voted Out', award: 'votedWithMajority', otherwise: 'votedAgainstMajority',
  },
  { when: yes('wonTribeImmunity'), award: 'tribeImmunity' },
  { when: { any: [yes('wonIndividualReward'), yes('wonTribeReward')] }, award: 'rewardWin' },
  { when: yes('foundAdvantage'), award: 'idolFound' },
  { when: yes('playedAdvantage'), award: 'idolPlayed' },
  { when: { all: [yes('attendedTribal'), { answer: 'votesReceived', equals: 0 }] }, award: 'zeroVotesSafe' },
  // Survived, not eliminated THIS episode: someone voted out with votes against them was voted out,
  // not "safe despite votes".
  { when: { all: [{ answer: 'votesReceived', greaterThan: 0 }, notYes('leftTheGame')] }, award: 'survivedVotes' },
  { when: yes('advantageUsedAgainstThem'), award: 'advantageTargeted' },
  { when: yes('satOutOfChallenge'), award: 'satOut' },
  { when: { all: [yes('chosenForReward'), notYes('wonIndividualReward'), notYes('wonTribeReward')] }, award: 'chosenForReward' },
  { when: yes('wonFireMaking'), award: 'wonFireMaking' },
  { when: yes('learnedOfAdvantage'), award: 'learnedOfAdvantage' },
  { when: yes('wentOnJourney'), award: 'wentOnJourney' },
  // Exile is recorded as a fact (EpisodeLogic.addExiled), and wentToExile scores from that fact
  // (the implied rules below) rather than as an event of its own.
  { when: yes('exiled'), stage: 'exiled' },
];

// Scored from how someone left, so a corrected exit re-scores on its own and nothing is double-counted.
// A finalist -- winner or not -- also gets `finalist`, one `juryVote` per vote received, and
// `zeroJuryVotes` when that's none; the count only scores once it's known (el.juryVotes). Being sent
// to Exile follows from ep.exiled the same way, so removing the exile record removes the event.
const impliedRules = [
  { whenExiled: true, award: 'wentToExile' },
  { whenExit: 'Voted Out', award: 'votedOut' },
  { whenExit: 'Quit', award: 'quit' },
  { whenExit: 'Medically Evacuated', award: 'medevac' },
  { whenExit: 'Lost Fire-Making', award: 'lostFireMaking' },
  { whenExit: 'Sole Survivor', award: 'soleSurvivor' },
  { whenExit: FINALISTS, award: 'finalist' },
  { whenExit: FINALISTS, award: 'juryVote', per: 'juryVotes' },
  { whenExit: FINALISTS, when: { fact: 'juryVotes', equals: 0 }, award: 'zeroJuryVotes' },
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
        groupChanges: z
          .array(
            z.object({
              name: z.string().describe("FULL name, same rule as eliminations."),
              group: z
                .string()
                .nullable()
                .describe("The tribe they're on from this episode, as the table names it. Null if they no longer have one."),
            })
          )
          .describe(
            "Everyone whose tribe changes in THIS episode: a tribe swap, the merge, a new tribe formed or " +
              "one dissolved. Who moved where comes from each person's own row in the cast table's tribe " +
              "columns (Switched, Shuffled, Merged, ...) -- someone whose row has no entry in a column never " +
              "joined that tribe, even if they were in the game when it formed (e.g. voted out at the merge " +
              "before joining it). The vote grid's header spans show the episode each arrangement starts. " +
              "Someone whose later column repeats their earlier tribe didn't move. Never list anyone's " +
              "STARTING tribe. Empty for an episode where nobody changed tribe."
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
      "Extract the per-episode record for this season: who left each episode and how, which notable " +
      "things happened to individuals, and whose tribe changed.",
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

// One castaway's checklist, as data: checklist.js says what a field can be and builds the Zod schema.
const checklist = [
  { key: 'name', type: 'string', description: "The castaway's full name, exactly as given in the list you were sent." },

  // --- leaving the game ---
  { key: 'leftTheGame', type: 'answer', description: "Did this person leave the game permanently in THIS episode?" },
  {
    key: 'exitMethod', type: 'exitMethod', nullable: true,
    description: "How they left, if they left. Null if they did not leave.",
  },

  // --- tribal council ---
  { key: 'attendedTribal', type: 'answer', description: "Did they attend Tribal Council this episode?" },
  {
    key: 'votesReceived', type: 'integer', nullable: true,
    description:
      "How many votes were cast against them at Tribal this episode. 0 if they attended and got none. " +
      "Null if unknown or no Tribal.",
  },
  {
    key: 'votedFor', type: 'string', nullable: true,
    description:
      "Who they voted for at Tribal this episode, written exactly as that person's name appears in the " +
      "list you were sent. If there was a revote, their vote in the FINAL round. Null if unknown, no " +
      "Tribal, or they didn't vote.",
  },
  {
    key: 'juryVotesReceived', type: 'integer', nullable: true,
    description:
      "Only for a finalist at Final Tribal Council this episode: how many jury votes they received to " +
      "win. 0 if they got none. Null if they weren't a finalist this episode or it isn't reported.",
  },

  // --- challenges ---
  { key: 'wonIndividualImmunity', type: 'answer', description: "Did they win INDIVIDUAL immunity (not as part of a tribe)?" },
  { key: 'wonTribeImmunity', type: 'answer', description: "Were they on the tribe/team that won immunity?" },
  {
    key: 'wonIndividualReward', type: 'answer',
    description: "Did they win an INDIVIDUAL reward challenge (not as part of a tribe)?",
  },
  { key: 'wonTribeReward', type: 'answer', description: "Were they on the tribe/team that won reward?" },
  {
    key: 'individualChallengeFinish', type: 'integer', nullable: true,
    description:
      "Their best finishing place in THIS episode's INDIVIDUAL challenge(s) -- 1 if they won, 2 for " +
      "runner-up, 3 for third -- only when a source states the order. Null for tribe/team challenges, " +
      "if they finished below third, or if the order isn't reported.",
  },
  { key: 'satOutOfChallenge', type: 'answer', description: "Did they sit out of a challenge this episode?" },
  {
    key: 'chosenForReward', type: 'answer',
    description:
      "Did a reward WINNER choose them to come along on the reward, without them winning it themselves? " +
      "'no' if they won it.",
  },
  {
    key: 'wonFireMaking', type: 'answer',
    description: "Did they WIN a fire-making challenge this episode (the final-four fire-making duel)?",
  },

  // --- advantages ---
  { key: 'foundAdvantage', type: 'answer', description: "Did they FIND a hidden immunity idol or any advantage this episode?" },
  {
    key: 'advantageFoundName', type: 'string', nullable: true,
    description:
      "What they found, in the show's own words ('hidden immunity idol', 'Beware Advantage', 'Shot in " +
      "the Dark'). Null if nothing.",
  },
  {
    key: 'playedAdvantage', type: 'answer',
    description: "Did they PLAY an idol or advantage this episode (their own or on someone else)?",
  },
  {
    key: 'advantagePlayedName', type: 'string', nullable: true,
    description: "What they played, in the show's own words. Null if nothing.",
  },
  {
    key: 'votesNullified', type: 'integer', nullable: true,
    description:
      "If they PLAYED an idol or advantage (on themselves or someone else), how many votes it cancelled " +
      "-- 0 if it cancelled none. Null if they played nothing or it isn't reported.",
  },
  {
    key: 'advantageUsedAgainstThem', type: 'answer',
    description: "Was an advantage used against them (a vote stolen, blocked, nullified)?",
  },

  // --- twists ---
  {
    key: 'learnedOfAdvantage', type: 'answer',
    description:
      "Did they find out, this episode, that ANOTHER player has a hidden immunity idol or advantage -- " +
      "told by them or someone else, saw it, or worked it out on screen? Only what the episode shows or " +
      "a recap states, not speculation. It must be PRIVATE knowledge: learned alone or within an " +
      "alliance or small group, not something the whole tribe or everyone at Tribal learned at once " +
      "(e.g. an idol played at Tribal Council is not this). And only the FIRST time they learn about " +
      "that particular idol or advantage -- 'no' if they already knew about it from an earlier episode.",
  },
  {
    key: 'wentOnJourney', type: 'answer',
    description:
      "Were they sent on a JOURNEY this episode -- taken away from camp (often by boat) to a separate " +
      "location, usually with a chance at an advantage or a risk to their vote?",
  },
  {
    key: 'exiled', type: 'answer',
    description: "Were they sent away from their tribe by an Exile Island-style twist while staying in the game?",
  },
  {
    key: 'notableTwist', type: 'string', nullable: true,
    description:
      "Any other notable, checkable thing that happened to this person this episode, in one short " +
      "phrase. Null if nothing.",
  },

  // --- provenance, per person ---
  {
    key: 'sources', type: 'stringList',
    description:
      "URLs you actually read that support the answers above for THIS person. Empty only if every " +
      "answer is 'unknown'.",
  },
  {
    key: 'confidence', type: 'enum', values: ['high', 'medium', 'low'],
    description:
      "high: a source states it plainly. medium: a source implies it. low: pieced together or a single " +
      "weak source.",
  },
];

// Episode-level questions, asked alongside the per-person list.
const episodeFields = [
  { key: 'tribalCouncilHeld', type: 'answer' },
];

// The line of the research prompt that says what to look for.
const researchSearchHint = [
  "Search for the episode recap, the episode's wiki page, and any reporting on idols or advantages",
  "found or played in it, who voted for whom, and the finishing order of any individual challenge.",
  "Then answer the checklist for every person above.",
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
  if (entry.individualChallengeFinish === 1 && entry.wonIndividualImmunity !== "yes" && entry.wonIndividualReward !== "yes") {
    problems.push(`${entry.name}: finished 1st in an individual challenge but isn't marked as winning it`);
  }
  if (typeof entry.votesNullified === "number" && entry.votesNullified > 0 && entry.playedAdvantage !== "yes") {
    problems.push(`${entry.name}: votes cancelled by an advantage they aren't marked as playing`);
  }
  return problems;
}

// Positive claims that need a source behind them.
const researchClaims = [
  "leftTheGame", "wonIndividualImmunity", "wonIndividualReward", "foundAdvantage", "playedAdvantage", "satOutOfChallenge",
  "chosenForReward", "wonFireMaking", "learnedOfAdvantage", "wentOnJourney",
];

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
  if (c.individualChallengeFinish === 2 || c.individualChallengeFinish === 3) {
    notes.push(`${c.individualChallengeFinish === 2 ? "2nd" : "3rd"} in an individual challenge`);
  }
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.chosenForReward === "yes") notes.push("chosen to join a reward");
  if (c.wonFireMaking === "yes") notes.push("won fire-making");
  if (c.learnedOfAdvantage === "yes") notes.push("privately learned of someone's idol/advantage");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (typeof c.votesNullified === "number" && c.votesNullified > 0) notes.push(`nullified ${c.votesNullified} vote${c.votesNullified === 1 ? "" : "s"}`);
  if (typeof c.juryVotesReceived === "number") notes.push(`${c.juryVotesReceived} jury vote${c.juryVotesReceived === 1 ? "" : "s"}`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("advantage used against them");
  if (c.wentOnJourney === "yes") notes.push("went on a journey");
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
  if (c.individualChallengeFinish === 2 || c.individualChallengeFinish === 3) {
    notes.push(`finished ${c.individualChallengeFinish === 2 ? "2nd" : "3rd"} in an individual challenge`);
  }
  if (c.satOutOfChallenge === "yes") notes.push("sat out a challenge");
  if (c.chosenForReward === "yes") notes.push("chosen to join a reward");
  if (c.wonFireMaking === "yes") notes.push("won fire-making");
  if (c.learnedOfAdvantage === "yes") notes.push("privately learned of someone's idol/advantage");
  if (c.foundAdvantage === "yes") notes.push(`found ${c.advantageFoundName || "an advantage"}`);
  if (c.playedAdvantage === "yes") notes.push(`played ${c.advantagePlayedName || "an advantage"}`);
  if (typeof c.juryVotesReceived === "number") notes.push(`received ${c.juryVotesReceived} jury vote(s) at Final Tribal`);
  if (c.advantageUsedAgainstThem === "yes") notes.push("had an advantage used against them");
  if (c.wentOnJourney === "yes") notes.push("went on a journey");
  if (c.exiled === "yes") notes.push("was exiled");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The data half (see define.js): plain JSON that a database row could hold.
const data = {
  id: 'survivor',
  name: 'Survivor',
  exitMethods,
  // What a new show on these rules calls its people and groups, until an admin says otherwise.
  terms: { castaway: 'Castaway', tribe: 'Tribe' },
  // The exit method that crowns the winner. Seeing it ends the season: no further episodes are
  // created, and the winner isn't a "loss" for replenish.
  winnerExitMethod: 'Sole Survivor',
  // Exits that mean reaching the end, not being knocked out: shown as finishers, never dimmed as out.
  endgameExitMethods: ['Lost Final Tribal (Jury Vote)', 'Sole Survivor'],
  events,
  // Groups for "How starters score" (active-roster-lineup-grid.tsx), in this order. Every event above
  // belongs to exactly one; anything left out would land in a trailing "Other".
  eventCategories: [
    { id: 'challenges', label: 'Challenges', events: ['individualImmunity', 'challengeRunnerUp', 'challengeThird', 'tribeImmunity', 'rewardWin', 'chosenForReward', 'satOut'] },
    { id: 'tribal', label: 'Tribal Council', events: ['votesNegated', 'survivedVotes', 'votedWithMajority', 'zeroVotesSafe', 'votedAgainstMajority', 'votedOut'] },
    { id: 'advantages', label: 'Idols & Advantages', events: ['idolFound', 'idolPlayed', 'learnedOfAdvantage', 'advantageTargeted'] },
    { id: 'twists', label: 'Journeys & Exile', events: ['wentOnJourney', 'wentToExile'] },
    { id: 'leaving', label: 'Leaving the game', events: ['medevac', 'quit'] },
    { id: 'endgame', label: 'Endgame', events: ['finalist', 'juryVote', 'soleSurvivor', 'wonFireMaking', 'lostFireMaking', 'zeroJuryVotes'] },
  ],
  // An episode's headline wins, at the top of its Recap (episode-recap.tsx). Both are won as a tribe
  // before the merge (anyone brought along by a twist is chosenForReward, not a winner), so a tribe
  // shows as its tribe even when only some of it was logged; after the merge they're individual.
  recap: [
    { label: 'Reward', events: ['rewardWin'], tribeEvents: ['rewardWin'] },
    { label: 'Immunity', events: ['tribeImmunity', 'individualImmunity'], tribeEvents: ['tribeImmunity'] },
  ],
  // The season has a merge, so episodes carry a post-merge flag and the UI offers it.
  hasMerge: true,
  // Players are in tribes, which can change (swaps, the merge) -- see GroupLogic.
  hasGroups: true,
  wiki: {
    // Bumped when the episodes read asks for something new, so cached reads are re-done once (see
    // wiki-sync.js's cachedExtraction). 2: tribe changes (groupChanges).
    version: 2,
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
    // More eliminations than this in one episode is flagged for a second look: a double boot is rare
    // and explicit, and it's exactly what a misread rowspan would produce.
    routineEliminations: 1,
  },
  research: {
    checklist,
    episodeFields,
    searchHint: researchSearchHint,
    claims: researchClaims,
  },
  rules: { research: researchRules, implied: impliedRules },
};

module.exports = defineFormat(data, {
  wiki: {
    episodesSchema,
    episodesPrompt,
    rejectEvent: rejectWikiEvent,
  },
  research: {
    entryProblems: researchEntryProblems,
    notes: researchNotes,
    sentences: researchSentences,
  },
});
