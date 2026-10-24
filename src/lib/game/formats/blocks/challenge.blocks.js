// The Challenge as a rulebook's blocks (docs/PLAN-rulebooks-implementation.md 4.5), hand-written from
// challenge.js. Same rules as survivor.blocks.js: the season plays by challenge.js's data until someone edits
// it, and `aliases` maps what these blocks build onto the event ids and exit methods leagues have recorded.
module.exports = {
  blocks: {
    schema: 1,
    kind: 'competition',
    show: 'The Challenge',
    tagline: 'Daily challenges, then an elimination',
    premise:
      "A house full of challengers competes in teams or pairs. Win the daily challenge and you're safe; lose an elimination and you go home. The last ones standing run a days-long final for the prize.",
    cast: { unit: 'people', singular: 'challenger', plural: 'challengers', usualSize: 30, groups: { type: 'sides', singular: 'team', change: 'often' } },
    season: {
      phases: [{ id: 'season', name: 'The season', starts: { type: 'episode', n: 1 }, changes: [] }],
      finale: { decidedBy: 'firstToFinish', summary: 'A days-long final: the first across the finish line wins.' },
    },
    segments: [
      {
        id: 'dailyChallenge', name: 'Daily challenge', summary: "Win it and you're safe from the elimination.",
        decidedBy: 'result', takesPart: 'everyone', decides: 'winner', onTheLine: 'safety', often: 'everyEpisode',
      },
      {
        id: 'elimination', name: 'Elimination', summary: 'Two face off. The loser goes home.',
        decidedBy: 'headToHead', takesPart: 'atRisk', decides: 'winner', onTheLine: 'goingHome', often: 'everyEpisode',
      },
    ],
    waysOut: [
      { id: 'eliminated', name: 'Eliminated', means: 'out', cause: { segment: 'elimination' } },
      { id: 'disqualified', name: 'Disqualified', means: 'out', cause: 'removed' },
      { id: 'quit', name: 'Quit', means: 'out', cause: 'ownChoice' },
      { id: 'medicallyRemoved', name: 'Medically removed', means: 'out', cause: 'medical' },
      { id: 'finalist', name: 'Finalist', means: 'finalist' },
      { id: 'winner', name: 'Winner', means: 'winner' },
    ],
    twists: [],
    customMoments: [
      { id: 'captain', label: 'Served as team captain', question: 'This episode, who served as a team captain?', during: { segment: 'dailyChallenge' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'nominatedSurvived', label: 'Nominated for elimination and survived', question: 'This episode, who was nominated for elimination and survived?', during: { segment: 'elimination' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
    ],
    // The format's own points where they differ from the templates' suggestions.
    points: {
      captain: { exclusive: 0.5, shared: 1 },
      eliminationWon: 3,
      nominatedSurvived: 1,
      disqualified: -5,
      quit: -5,
      medicallyRemoved: 0,
      finalist: { exclusive: 3, shared: 5 },
      winner: { exclusive: 5, shared: 10 },
    },
    leftOut: [],
  },
  aliases: {
    events: {
      dailyChallengeWon: 'dailyWin',
      eliminationWon: 'eliminationWin',
      winner: 'seasonWinner',
    },
    exits: {
      eliminated: 'Eliminated',
      disqualified: 'Disqualified',
      quit: 'Quit',
      medicallyRemoved: 'Medically removed',
      finalist: 'Finalist',
      winner: 'Winner',
    },
  },
};
