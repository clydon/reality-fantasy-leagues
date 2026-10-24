// Survivor as a rulebook's blocks (docs/PLAN-rulebooks-implementation.md 4.5), hand-written from
// survivor.js. Until someone edits it, the season plays by survivor.js's data exactly (the legacy freeze);
// these blocks are what How it works shows, and what the compiler turns back into the same scoring (on
// survivor.js's data as its base, rulebook-compile.js; tests/rulebook-golden.test.js proves it).
//
// `points` carries survivor.js's own values, so How it works and a compiled rulebook score as it does, and
// `aliases` keeps every recorded result working: `events` maps a moment these blocks build to the event id
// leagues have already recorded and score (only where the two differ), and `exits` maps each way out to the
// exit method string castaways carry. Every survivor.js event is built here exactly once (tests/rulebooks
// .test.js): the template moments it has no event for are switched off, and its events no template builds are
// moments added by hand, under their own ids.
module.exports = {
  blocks: {
    schema: 1,
    kind: 'competition',
    show: 'Survivor',
    tagline: 'Castaways voted out one by one',
    premise:
      'Eighteen castaways start in three tribes. Every episode someone is voted out, until the people voted out late in the game, the jury, choose the Sole Survivor.',
    cast: { unit: 'people', singular: 'castaway', plural: 'castaways', usualSize: 18, groups: { type: 'sides', singular: 'tribe', change: 'atPhases' } },
    season: {
      phases: [
        { id: 'tribes', name: 'Tribes', starts: { type: 'episode', n: 1 }, changes: [], summary: 'Challenges are won as a tribe. The losing tribe goes to Tribal Council.' },
        {
          id: 'merged', name: 'Merged', starts: { type: 'remaining', n: 12 }, changes: ['groupsEnd', 'juryStarts'],
          summary: 'No tribes. Challenges are individual. Everyone voted out from here sits on the jury.',
        },
      ],
      finale: { decidedBy: 'juryVote', finalists: 3, summary: 'Fire-making at the final four decides one finalist. The jury votes for a winner from the final three.' },
    },
    segments: [
      {
        id: 'rewardChallenge', name: 'Reward challenge', summary: 'The winners get food, comfort or a trip.',
        decidedBy: 'result', takesPart: 'groupsThenEach', decides: 'winner', onTheLine: 'reward', often: 'someEpisodes',
        // One reward win, as a tribe or alone (survivor.js rewardWin).
        momentsOff: ['rewardChallengeGroupWon'],
      },
      {
        id: 'immunityChallenge', name: 'Immunity challenge', summary: "Win it and you can't be voted out.",
        decidedBy: 'result', takesPart: 'groupsThenEach', decides: 'topThree', onTheLine: 'safety', often: 'everyEpisode',
      },
      {
        id: 'tribalCouncil', name: 'Tribal Council', summary: 'The tribe votes someone out.',
        decidedBy: 'vote', voters: 'cast', takesPart: 'atRisk', onTheLine: 'goingHome', often: 'everyEpisode',
      },
      {
        id: 'fireMaking', name: 'Fire-making', summary: 'Two make fire, one goes home.',
        decidedBy: 'headToHead', takesPart: 'atRisk', decides: 'winner', onTheLine: 'goingHome', often: 'onePhase', phase: 'finale',
      },
    ],
    waysOut: [
      { id: 'votedOut', name: 'Voted out', means: 'out', cause: { segment: 'tribalCouncil' } },
      { id: 'lostFireMaking', name: 'Lost fire-making', means: 'out', cause: { segment: 'fireMaking' } },
      { id: 'quit', name: 'Quit', means: 'out', cause: 'ownChoice' },
      { id: 'medicallyEvacuated', name: 'Medically evacuated', means: 'out', cause: 'medical' },
      { id: 'finalist', name: 'Finalist', means: 'finalist' },
      { id: 'soleSurvivor', name: 'Sole Survivor', means: 'winner' },
    ],
    twists: [
      {
        id: 'advantages', type: 'advantage', name: 'Idols and advantages',
        summary: 'Found at camp or on journeys. Played at Tribal Council to stay safe or cancel votes.',
        oneIsCalled: 'an idol or advantage', gotBy: 'found', does: ['keepsSafe', 'cancelsVotes', 'hurtsSomeone'], lasts: 'untilPlayed',
        momentsOff: ['advantagesSavedBy', 'advantagesWentHomeHolding'],
      },
      {
        id: 'journeys', type: 'sideTrip', name: 'Journeys', summary: 'A side trip. Some come back with an advantage, some without their vote.',
        oneIsCalled: 'a journey', who: 'chosen', canGet: ['advantage', 'disadvantage'],
        momentsOff: ['journeysCameBackWithAdvantage', 'journeysLostSomething'],
      },
    ],
    customMoments: [
      { id: 'chosenForReward', label: 'Chosen to join a reward', question: 'This episode, who was chosen to join a reward without winning it?', during: { segment: 'rewardChallenge' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'satOut', label: 'Sat out a challenge', question: 'This episode, who sat out a challenge?', during: { segment: 'immunityChallenge' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'learnedOfAdvantage', label: 'Learned of an idol or advantage privately', during: { twist: 'advantages' }, counted: 'yesNo', answeredBy: 'research', reliability: 'patchy' },
      { id: 'wentToExile', label: 'Sent to Exile', question: 'This episode, who was sent to Exile?', during: { twist: 'journeys' }, counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
    ],
    // The format's own points where they differ from the templates' suggestions.
    points: {
      rewardChallengeWon: { exclusive: 1, shared: 1.5 },
      chosenForReward: 0.5,
      immunityChallengeWon: { exclusive: 3, shared: 4 },
      immunityChallengeSecond: { exclusive: 1.5, shared: 2 },
      immunityChallengeThird: 1,
      satOut: -0.5,
      tribalCouncilZeroVotes: { exclusive: 0.5, shared: 1 },
      tribalCouncilSurvivedVotes: 1.5,
      tribalCouncilVotedWithMajority: { exclusive: 0.5, shared: 1 },
      advantagesUsedAgainst: -0.5,
      lostFireMaking: -1,
      quit: -5,
      medicallyEvacuated: 0,
      finalist: { exclusive: 2, shared: 3 },
      soleSurvivor: { exclusive: 1, shared: 3 },
      finaleJuryVote: { exclusive: 0.5, shared: 1 },
      finaleNoJuryVotes: { exclusive: -2, shared: -3 },
    },
    leftOut: [],
  },
  aliases: {
    events: {
      rewardChallengeWon: 'rewardWin',
      immunityChallengeWon: 'individualImmunity',
      immunityChallengeSecond: 'challengeRunnerUp',
      immunityChallengeThird: 'challengeThird',
      immunityChallengeGroupWon: 'tribeImmunity',
      tribalCouncilZeroVotes: 'zeroVotesSafe',
      tribalCouncilSurvivedVotes: 'survivedVotes',
      tribalCouncilVotedWithMajority: 'votedWithMajority',
      tribalCouncilVotedAgainstMajority: 'votedAgainstMajority',
      fireMakingWon: 'wonFireMaking',
      advantagesGot: 'idolFound',
      advantagesPlayed: 'idolPlayed',
      advantagesCancelledVotes: 'votesNegated',
      advantagesUsedAgainst: 'advantageTargeted',
      journeysWent: 'wentOnJourney',
      medicallyEvacuated: 'medevac',
      finaleJuryVote: 'juryVote',
      finaleNoJuryVotes: 'zeroJuryVotes',
    },
    exits: {
      votedOut: 'Voted Out',
      lostFireMaking: 'Lost Fire-Making',
      quit: 'Quit',
      medicallyEvacuated: 'Medically Evacuated',
      finalist: 'Lost Final Tribal (Jury Vote)',
      soleSurvivor: 'Sole Survivor',
    },
  },
};
