// The generic format: the safe fallback for any show that doesn't fit survivor/traitors/challenge,
// per docs/PLAN-show-formats.md and docs/PLAN-ai-generated-show-formats.md's phase 1. Deliberately
// minimal -- exit methods and elimination-order scoring only -- so it works as a manual-entry
// fallback with no wiki/research pipeline needed: an admin can run a whole season off eliminations
// and challenge wins typed in by hand. See survivor.js for the shape every format has.

const exitMethods = ['Eliminated', 'Quit', 'Removed', 'Winner', 'Other'];

const events = [
  { id: 'challengeWin', label: 'Won a challenge/competition', defaultPoints: 2 },
  { id: 'safeAtRisk', label: 'Safe while at risk of elimination', defaultPoints: 1 },
  // Leaving the game, scored from the exit itself (impliedEvents) so a corrected exit re-scores on
  // its own. Winning ends the season; the other three default to 0, same discipline as every other
  // format -- whether they cost points is a league's call.
  { id: 'winner', label: 'Won the season', defaultPoints: { exclusive: 5, shared: 10 }, implied: true },
  { id: 'eliminated', label: 'Eliminated', defaultPoints: -3, implied: true },
  { id: 'quit', label: 'Quit', defaultPoints: -5, implied: true },
  { id: 'removed', label: 'Removed', defaultPoints: 0, implied: true },
];

const EXIT_EVENTS = {
  Winner: 'winner',
  Eliminated: 'eliminated',
  Quit: 'quit',
  Removed: 'removed',
};

function impliedEvents(ep) {
  return (ep.events || [])
    .filter((el) => EXIT_EVENTS[el.method])
    .map((el) => ({ type: EXIT_EVENTS[el.method], castawayId: el.castawayId }));
}

// ---------- wiki (db/wiki-sync.js) ----------
// No show-specific vocabulary to read a table by, so the connector is only asked for the one thing
// every reality competition reports: who left, and how.

const wikiEventTypes = [];

function episodesSchema(z) {
  return z.object({
    episodes: z.array(
      z.object({
        number: z.number().int().describe('Episode number, starting at 1.'),
        title: z.string().nullable().describe("Episode title, if given. Null if absent."),
        airDate: z.string().nullable().describe('Air date exactly as printed. Null if absent.'),
        eliminations: z
          .array(
            z.object({
              name: z.string().describe("The person's FULL name."),
              method: z
                .enum(exitMethods)
                .describe(
                  'How they left: lost a challenge or vote and left the game -> Eliminated; withdrew ' +
                    '-> Quit; removed for conduct or medical reasons -> Removed; won the season -> ' +
                    'Winner. Use Other only if none fit.'
                ),
            })
          )
          .describe('Everyone who left the game PERMANENTLY in THIS episode, in the order they left.'),
        events: z.array(z.object({ type: z.enum(['placeholder']), name: z.string() })).describe('Unused for this format.'),
      })
    ),
  });
}

function episodesPrompt() {
  return {
    system:
      'You extract structured data from wiki or recap text about a season of a reality competition ' +
      "show. Report only what the text actually states. Never infer, complete or correct anything " +
      "from outside knowledge of the show -- if a field isn't in the text, return null, and if you " +
      'cannot tell whether someone left this episode, omit them rather than guessing.',
    user: 'Extract the per-episode record for this season: who left each episode and how.',
  };
}

// ---------- research (db/episode-research.js) ----------
// Only the two things every show this format covers can reliably report: did they leave, and were
// they at risk but safe.

function checklistSchema(z, Answer) {
  return z.object({
    name: z.string().describe("The contestant's full name, exactly as given in the list you were sent."),

    leftTheGame: Answer.describe('Did this person leave the game permanently in THIS episode?'),
    exitMethod: z.enum(exitMethods).nullable().describe('How they left, if they left. Null if they did not leave.'),

    wonChallenge: Answer.describe("Did they win this episode's main challenge or competition?"),
    wasAtRiskButSafe: Answer.describe('Were they at risk of elimination this episode but ultimately safe?'),

    notableTwist: z
      .string()
      .nullable()
      .describe('Any other notable, checkable thing that happened to this person this episode, in one short phrase. Null if nothing.'),

    sources: z
      .array(z.string())
      .describe('URLs you actually read that support the answers above for THIS person. Empty only if every answer is "unknown".'),
    confidence: z
      .enum(['high', 'medium', 'low'])
      .describe("high: a source states it plainly. medium: a source implies it. low: pieced together or a single weak source."),
  });
}

function episodeFields(z, Answer) {
  return { eliminationHeld: Answer };
}

const researchSearchHint = [
  'Search for the episode recap and any reporting on who won this episode, who was at risk of',
  'elimination, and who left the game. Then answer the checklist for every person above.',
];

function researchEntryProblems(entry) {
  const problems = [];
  if (entry.wonChallenge === 'yes' && entry.leftTheGame === 'yes' && entry.exitMethod === 'Eliminated') {
    problems.push(`${entry.name}: eliminated despite winning the challenge`);
  }
  return problems;
}

const researchClaims = ['leftTheGame', 'wonChallenge', 'wasAtRiskButSafe'];

function researchItems(entry, add) {
  if (entry.wonChallenge === 'yes') add('event', 'challengeWin');
  if (entry.wasAtRiskButSafe === 'yes') add('event', 'safeAtRisk');
}

function researchNotes(c) {
  const notes = [];
  if (c.leftTheGame === 'yes') notes.push(`OUT — ${c.exitMethod || 'method unknown'}`);
  if (c.wonChallenge === 'yes') notes.push('won the challenge');
  if (c.wasAtRiskButSafe === 'yes') notes.push('at risk but safe');
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

function researchSentences(c) {
  const notes = [];
  if (c.leftTheGame === 'yes') notes.push(`left the game (${c.exitMethod || 'method unknown'})`);
  if (c.wonChallenge === 'yes') notes.push('won the challenge');
  if (c.wasAtRiskButSafe === 'yes') notes.push('was at risk of elimination but safe');
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

module.exports = {
  id: 'generic',
  name: 'Generic',
  exitMethods,
  terms: { castaway: 'Contestant', tribe: 'Team' },
  winnerExitMethod: 'Winner',
  endgameExitMethods: ['Winner'],
  events,
  eventCategories: [
    { id: 'challenges', label: 'Challenges', events: ['challengeWin', 'safeAtRisk'] },
    { id: 'leaving', label: 'Leaving the game', events: ['eliminated', 'quit', 'removed'] },
    { id: 'endgame', label: 'Endgame', events: ['winner'] },
  ],
  recap: [{ label: 'Challenge win', events: ['challengeWin'] }],
  impliedEvents,
  hasMerge: false,
  hasGroups: false,
  wiki: {
    version: 1,
    voteSections: [],
    guideSections: [],
    missingVotesNote: 'no vote/elimination table found -- eliminations will be missing',
    missingGuideNote: 'no episode guide found -- eliminations will be missing',
    eventTypes: wikiEventTypes,
    episodesSchema,
    episodesPrompt,
    rejectEvent: () => null,
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
