// The Challenge format. See survivor.js for the shape every format has, traitors.js for implied and
// derived events, and docs/PLAN-show-formats.md for the confirmed catalog and wiki investigation
// (All Stars 4 and Vets & New Threats completed, Cutthroat 2026 live).
//
// What sets it apart: the rules change every season (teams, pairs, captains, Stars, points), so the
// read takes in the season's own ==Format== prose and its own colour key rather than assuming one
// table shape. The Game Summary section is the source for nearly everything -- its Elimination chart
// (one row per episode: daily winners, captains, who went into the elimination and who won) is the
// cleanest table on the wiki and carries full names in its links.

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS on purpose, see index.js
const { defineFormat } = require('./define.js');

const exitMethods = ['Eliminated', 'Disqualified', 'Quit', 'Medically removed', 'Finalist', 'Winner', 'Other'];

// Leaving, finishing and winning score through impliedEvents, so they follow the exit if it's ever
// corrected. The four ways of leaving default to 0: whether they cost points is a league's call.
const events = [
  { id: 'dailyWin', label: 'Won a daily challenge', defaultPoints: 2 },
  { id: 'eliminationWin', label: 'Won an elimination', defaultPoints: 3 },
  { id: 'nominatedSurvived', label: 'Nominated for elimination and survived', defaultPoints: 1 },
  { id: 'captain', label: 'Served as team captain / leader', defaultPoints: { exclusive: 0.5, shared: 1 } },
  { id: 'finalist', label: 'Reached and completed the Final', defaultPoints: { exclusive: 3, shared: 5 }, implied: true },
  { id: 'seasonWinner', label: 'Won the season', defaultPoints: { exclusive: 5, shared: 10 }, implied: true },
  // Leaving costs points, so benching someone headed into an elimination is a real decision. Quitting
  // and being disqualified are their own doing; a medical removal isn't, so it stays 0.
  { id: 'eliminated', label: 'Eliminated', defaultPoints: -3, implied: true },
  { id: 'disqualified', label: 'Disqualified', defaultPoints: -5, implied: true },
  { id: 'quit', label: 'Quit', defaultPoints: -5, implied: true },
  { id: 'medicallyRemoved', label: 'Medically removed', defaultPoints: 0, implied: true },
];

// How someone left -> what it scores (rules.js).
const impliedRules = [
  { whenExit: 'Finalist', award: 'finalist' },
  { whenExit: 'Winner', award: 'seasonWinner' },
  { whenExit: 'Eliminated', award: 'eliminated' },
  { whenExit: 'Disqualified', award: 'disqualified' },
  { whenExit: 'Quit', award: 'quit' },
  { whenExit: 'Medically removed', award: 'medicallyRemoved' },
];

// ---------- wiki (db/wiki-sync.js) ----------

// Only captaincy is read as an event directly; the rest come from the Elimination chart's rows
// (derivedEvents), which the schema captures as the chart states them.
const wikiEventTypes = ['captain'];

function episodesSchema(z) {
  const person = z.string().describe("The person's FULL name, from the image link target (link=Full Name) or the Contestants table.");
  return z.object({
    episodes: z.array(
      z.object({
        number: z.number().int().describe("Episode number, from the Elimination chart's # column, starting at 1."),
        title: z.string().nullable().describe("The episode's title, from the Episodes table. Null if absent."),
        airDate: z.string().nullable().describe("Air date exactly as printed in the Episodes table. Null if absent."),
        eliminations: z
          .array(
            z.object({
              name: person,
              method: z
                .enum(exitMethods)
                .describe(
                  "Lost an elimination (or was eliminated at a challenge) -> Eliminated; disqualified for " +
                    "conduct -> Disqualified; withdrew / quit -> Quit; removed or disqualified for injury or " +
                    "medical reasons -> Medically removed; completed the Final without winning (second, third, " +
                    "... place, runner-up) -> Finalist; won the Final -> Winner. Use Other only if none fit."
                ),
            })
          )
          .describe(
            "Everyone who left the game in THIS episode, from the Elimination chart's Eliminated column, the " +
              "Episode Progress grid's exit cells (OUT, QUIT, DQ, MED and the like, per the season's key) and " +
              "the Contestants table's Finish. For the Final, list everyone who finished it in finishing " +
              "order, LAST place first and the winner(s) last. Someone still 'In the Game' is left out."
          ),
        dailyWinners: z
          .array(z.object({ name: person }))
          .describe(
            "Everyone who won THIS episode's daily challenge, individually or as a member of the winning " +
              "team or pair. When the chart names a team ('Gray Team'), list its members from the Episode " +
              "Progress grid's cells for this episode whose key meaning is a win. Not the Final."
          ),
        eliminationRound: z
          .array(
            z.object({
              name: person,
              via: z
                .enum(["nominated", "volunteer"])
                .describe("'nominated' if voted in, nominated or otherwise sent in; 'volunteer' if they chose to go in."),
              result: z
                .enum(["won", "lost", "not needed"])
                .describe("'not needed' for a nominee who didn't end up competing (another nominee was picked)."),
            })
          )
          .describe(
            "Everyone who was nominated for or went into THIS episode's elimination (the Arena, the Jungle, " +
              "...), from the Elimination chart's Arena contestants and outcome columns and the Episode " +
              "Progress key. Empty if the episode had no elimination."
          ),
        groupChanges: z
          .array(
            z.object({
              name: person,
              group: z
                .string()
                .nullable()
                .describe(
                  "Their team from this episode, by its name ('Gray', 'Yellow Team'); for a pair, both " +
                    "partners' first names as 'A & B'; null if they now play as an individual."
                ),
            })
          )
          .describe(
            "Everyone whose team, partner or individual status in THIS episode differs from the previous " +
              "episode's -- from the Team Progress or Partner Progress grid, the Episode Progress colours " +
              "and the season's key, or the Elimination chart. Teams formed at the start of the season " +
              "(the draft) are not changes; a team disbanding or merging is. Only people still in the game."
          ),
        events: z
          .array(
            z.object({
              type: z.enum(wikiEventTypes),
              name: person,
              confidence: z.enum(["high", "low"]).describe("'high' only when the text states it directly."),
            })
          )
          .describe(
            "captain: everyone listed as a team captain or leader for THIS episode (the Elimination chart's " +
              "captain columns, or the season's key). Omit if the season has no captains."
          ),
      })
    ),
  });
}

function episodesPrompt(terms) {
  return {
    system:
      "You extract structured data from MediaWiki wikitext about a season of The Challenge. Report only " +
      "what the wikitext actually states. Never infer, complete or correct anything from outside " +
      "knowledge of the show -- if a field isn't in the text, return null, and if you cannot tell whether " +
      "something happened, omit it rather than guessing.\n\n" +
      "The rules change every season. The text starts with this season's Format section: read it first " +
      "to learn how this season works (teams, pairs, captains, nominations, the elimination's name) " +
      "before reading the tables. Then comes the Episodes table (number, title, air date); the " +
      "Contestants table's Finish names the episode someone left in by its TITLE, so use this table to " +
      "turn a title into a number.\n\n" +
      "The Game Summary section holds an Elimination chart (one row per episode: challenge, winners, " +
      "captains, who went into the elimination, who won and who was eliminated), an Episode Progress grid " +
      `(a row per ${terms.castaway}, a column per episode, coloured cells) and further grids. The meaning ` +
      "of each Episode Progress colour is given by THIS season's own key (the ':{{colorbox|<colour>}} " +
      "...' lines after the grid) -- colours mean different things in different seasons, so use the key, " +
      "never an assumption. The Contestants section has each person's Finish.\n\n" +
      "These tables use rowspan and colspan heavily: work out which episode each cell belongs to before " +
      "reporting it. Cells show short names; always report the FULL name from the image link target " +
      "(link=Full Name) or the Contestants table.",
    user:
      "Extract the per-episode record for this season: who left each episode and how, who won each daily " +
      "challenge, who was nominated for or went into each elimination and how it went, who was captain, " +
      "and whose team or partner changed.",
  };
}

// Results that follow from the chart's rows, worked out here rather than asked for separately.
// `same(a, b)` compares two names by who they resolve to.
function derivedEvents(ep, extracted, same) {
  const out = [];
  const left = (ep.eliminations || []).map((el) => el.name);
  for (const w of ep.dailyWinners || []) out.push({ type: 'dailyWin', name: w.name, confidence: 'high' });
  for (const r of ep.eliminationRound || []) {
    if (r.result === 'won') out.push({ type: 'eliminationWin', name: r.name, confidence: 'high' });
    // A nominee who didn't have to go in but left the game anyway (quit, removed) didn't survive.
    if (r.via === 'nominated' && r.result !== 'lost' && !left.some((n) => same(n, r.name))) {
      out.push({ type: 'nominatedSurvived', name: r.name, confidence: 'high' });
    }
  }
  return out;
}

// ---------- research (db/episode-research.js) ----------

const checklist = [
  { key: 'name', type: 'string', description: "The contestant's full name, exactly as given in the list you were sent." },

  // --- leaving the game ---
  {
    key: 'leftTheGame', type: 'answer',
    description:
      "Did this person leave the game permanently in THIS episode (eliminated, disqualified, quit, " +
      "removed, or the Final)?",
  },
  {
    key: 'exitMethod', type: 'exitMethod', nullable: true,
    description: "How they left, if they left. Null if they did not leave.",
  },

  // --- the daily challenge ---
  {
    key: 'wonDailyChallenge', type: 'answer',
    description: "Did they win this episode's daily challenge, alone or on the winning team or pair?",
  },
  { key: 'wasCaptain', type: 'answer', description: "Were they a team captain or leader this episode?" },

  // --- the elimination ---
  {
    key: 'wasNominated', type: 'answer',
    description: "Were they nominated, voted in or otherwise at risk of going into this episode's elimination?",
  },
  {
    key: 'competedInElimination', type: 'answer',
    description: "Did they compete in this episode's elimination (the Arena, the Jungle, ...)?",
  },
  { key: 'wonElimination', type: 'answer', description: "Did they win that elimination?" },
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

const episodeFields = [
  { key: 'eliminationHeld', type: 'answer' },
];

const researchSearchHint = [
  "Search for the episode recap, the episode's wiki page, and any reporting on who won the daily",
  "challenge, who was nominated and who went into the elimination, who won it and who went home.",
  "Then answer the checklist for every person above.",
];

function researchEntryProblems(entry) {
  const problems = [];
  if (entry.wonElimination === "yes" && entry.competedInElimination === "no") {
    problems.push(`${entry.name}: won an elimination they didn't compete in`);
  }
  if (entry.wonElimination === "yes" && entry.leftTheGame === "yes" && entry.exitMethod === "Eliminated") {
    problems.push(`${entry.name}: eliminated despite winning the elimination`);
  }
  return problems;
}

const researchClaims = ["leftTheGame", "wonDailyChallenge", "wonElimination", "wasCaptain"];

// One person's answers -> the results they imply (rules.js).
const researchRules = [
  { when: { answer: 'wonDailyChallenge', is: 'yes' }, award: 'dailyWin' },
  { when: { answer: 'wonElimination', is: 'yes' }, award: 'eliminationWin' },
  { when: { all: [{ answer: 'wasNominated', is: 'yes' }, { answer: 'leftTheGame', isNot: 'yes' }] }, award: 'nominatedSurvived' },
  { when: { answer: 'wasCaptain', is: 'yes' }, award: 'captain' },
];

function researchNotes(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`OUT — ${c.exitMethod || "method unknown"}`);
  if (c.wonDailyChallenge === "yes") notes.push("won the daily");
  if (c.wasCaptain === "yes") notes.push("captain");
  if (c.wasNominated === "yes") notes.push("nominated");
  if (c.competedInElimination === "yes") notes.push(c.wonElimination === "yes" ? "won the elimination" : "went into the elimination");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

function researchSentences(c) {
  const notes = [];
  if (c.leftTheGame === "yes") notes.push(`left the game (${c.exitMethod || "method unknown"})`);
  if (c.wonDailyChallenge === "yes") notes.push("won the daily challenge");
  if (c.wasCaptain === "yes") notes.push("was a team captain");
  if (c.wasNominated === "yes") notes.push("was nominated for elimination");
  if (c.competedInElimination === "yes") notes.push(c.wonElimination === "yes" ? "won the elimination" : "competed in the elimination");
  if (c.notableTwist) notes.push(c.notableTwist);
  return notes;
}

// The data half (see define.js): plain JSON that a database row could hold.
const data = {
  id: 'challenge',
  name: 'The Challenge',
  exitMethods,
  // What a new show on these rules calls its people and groups, until an admin says otherwise.
  terms: { castaway: 'Challenger', tribe: 'Team' },
  winnerExitMethod: 'Winner',
  // Exits that mean reaching the end, not being knocked out: shown as finishers, never dimmed as out.
  endgameExitMethods: ['Finalist', 'Winner'],
  events,
  // Groups for "How starters score" (active-roster-lineup-grid.tsx), in this order.
  eventCategories: [
    { id: 'challenges', label: 'Challenges', events: ['dailyWin', 'eliminationWin', 'nominatedSurvived', 'captain'] },
    { id: 'leaving', label: 'Leaving the game', events: ['eliminated', 'disqualified', 'quit', 'medicallyRemoved'] },
    { id: 'endgame', label: 'Endgame', events: ['seasonWinner', 'finalist'] },
  ],
  // An episode's headline wins, at the top of its Recap (episode-recap.tsx).
  recap: [
    { label: 'Daily challenge', events: ['dailyWin'] },
    { label: 'Won the elimination', events: ['eliminationWin'] },
  ],
  hasMerge: false,
  // Teams, pairs or individuals, changing as often as every episode -- see GroupLogic.
  hasGroups: true,
  wiki: {
    // Bumped when the episodes read asks for something new (see survivor.js). 2: team changes.
    version: 2,
    // Game Summary holds the Elimination chart and every progress grid, as subsections.
    voteSections: ["Game Summary", "Elimination Chart", "Episode Progress"],
    guideSections: ["Contestants", "Cast"],
    // Read first: this season's own rules, and its episode list (titles and air dates, which the admin
    // episode list uses to know what has aired).
    contextSections: ["Format", "Episodes"],
    missingVotesNote: "no Game Summary found -- challenge wins, eliminations and captains will be missing",
    missingGuideNote: "no contestants table found -- finishes will come from the Game Summary alone",
    castNote:
      "The cast is split into male and female tables: gender is NOT a group. Report a starting group only " +
      "if the season starts in named teams (a Team Draft or the Format says so), naming the team, never " +
      "a colour code. If everyone starts as an individual, give no groups.",
    eventTypes: wikiEventTypes,
    // A male and a female elimination in one episode is common; more than that is worth a look.
    routineEliminations: 2,
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
    rejectEvent: () => null,
    derivedEvents,
  },
  research: {
    entryProblems: researchEntryProblems,
    notes: researchNotes,
    sentences: researchSentences,
  },
});
