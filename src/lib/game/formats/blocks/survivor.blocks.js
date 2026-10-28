// Survivor as a rulebook's blocks (docs/PLAN-rulebooks-implementation.md 4.5), hand-written from
// survivor.js. Until someone edits it, the season plays by survivor.js's data exactly (the legacy freeze);
// these blocks are what How it works shows, and what the compiler turns back into the same scoring (on
// survivor.js's data as its base, rulebook-compile.js; tests/rulebook-golden.test.js proves it).
//
// They also say everything survivor.js's data half does on their own (docs/PLAN-start-a-game-gpt.md S1): compiled
// with no base and the generic reader, they give its events, questions and rules (the golden test again). Its
// conditions are the blocks' refinements: a tribe's reward win counts as winning it (groupWin), 2nd and 3rd come
// from an individual challenge's finishing place (places), the tribe that wins immunity skips Tribal Council
// (skippedBy), the Sole Survivor is a finalist too (winnerToo), cancelled votes are a count of an advantage played
// (cancelled), Exile is a side trip away from the tribe (away), and chosen for a reward leaves out its winners
// (exceptWinners). `research` carries survivor.js's own words for each question, which yeses need a source, the
// questions it asks besides (what was found or played, anything else notable, whether Tribal was held) and its
// search hint, so research is asked exactly what it always was. It also says how each answer reads to a reviewer, and
// its checks' words (docs/PLAN-start-a-game-gpt.md S2): the compiler makes survivor.js's checks from these blocks (the
// vote, the tribe its immunity win keeps away, the safety immunity gives, its finishing place, the votes an advantage
// cancels), so with the generic reader research is reviewed exactly as survivor.js reviews it.
//
// `points` carries survivor.js's own values, so How it works and a compiled rulebook score as it does, and
// `aliases` keeps every recorded result working: `events` maps a moment these blocks build to the event id
// leagues have already recorded and score (only where the two differ), `exits` maps each way out to the
// exit method string castaways carry, and `questions` maps each question these blocks build to the key stored
// research answers use. Every survivor.js event is built here exactly once (tests/rulebooks.test.js): the
// template moments it has no event for are switched off, and its events no template builds are moments added
// by hand, under their own ids.
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
        groupWin: 'won',
      },
      {
        id: 'immunityChallenge', name: 'Immunity challenge', summary: "Win it and you can't be voted out.",
        decidedBy: 'result', takesPart: 'groupsThenEach', decides: 'topThree', onTheLine: 'safety', often: 'everyEpisode',
        // 2nd and 3rd from an individual challenge's finishing order (survivor.js individualChallengeFinish).
        places: 'place',
      },
      {
        id: 'tribalCouncil', name: 'Tribal Council', summary: 'The tribe votes someone out.',
        decidedBy: 'vote', voters: 'cast', takesPart: 'atRisk', onTheLine: 'goingHome', often: 'everyEpisode',
        // The tribe that wins immunity doesn't go, so nobody on it is safe there with zero votes.
        skippedBy: 'immunityChallenge',
      },
      {
        id: 'fireMaking', name: 'Fire-making', summary: 'Two make fire, one goes home.',
        decidedBy: 'headToHead', takesPart: 'atRisk', decides: 'winner', onTheLine: 'goingHome', often: 'onePhase', phase: 'finale',
      },
    ],
    // In survivor.js's order, which its pickers and research's exit methods list.
    waysOut: [
      { id: 'votedOut', name: 'Voted out', means: 'out', cause: { segment: 'tribalCouncil' } },
      { id: 'medicallyEvacuated', name: 'Medically evacuated', means: 'out', cause: 'medical' },
      { id: 'quit', name: 'Quit', means: 'out', cause: 'ownChoice' },
      { id: 'lostFireMaking', name: 'Lost fire-making', means: 'out', cause: { segment: 'fireMaking' } },
      // Everyone at Final Tribal Council, the Sole Survivor too.
      { id: 'finalist', name: 'Finalist', means: 'finalist', winnerToo: true },
      { id: 'soleSurvivor', name: 'Sole Survivor', means: 'winner' },
    ],
    twists: [
      {
        id: 'advantages', type: 'advantage', name: 'Idols and advantages',
        summary: 'Found at camp or on journeys. Played at Tribal Council to stay safe or cancel votes.',
        oneIsCalled: 'an idol or advantage', gotBy: 'found', does: ['keepsSafe', 'cancelsVotes', 'hurtsSomeone'], lasts: 'untilPlayed',
        // How many votes the one they played cancelled (survivor.js votesNullified).
        cancelled: 'count',
        momentsOff: ['advantagesSavedBy', 'advantagesWentHomeHolding'],
      },
      {
        id: 'journeys', type: 'sideTrip', name: 'Journeys', summary: 'A side trip. Some come back with an advantage, some without their vote.',
        oneIsCalled: 'a journey', who: 'chosen', canGet: ['advantage', 'disadvantage'],
        momentsOff: ['journeysCameBackWithAdvantage', 'journeysLostSomething'],
      },
      {
        id: 'exile', type: 'sideTrip', name: 'Exile', summary: 'Sent away from their tribe for a while, still in the game.',
        oneIsCalled: 'Exile', who: 'chosen', canGet: ['nothing'], away: 'yes',
      },
    ],
    customMoments: [
      {
        id: 'chosenForReward', label: 'Chosen to join a reward', question: 'This episode, who was chosen to join a reward without winning it?',
        during: { segment: 'rewardChallenge' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually', exceptWinners: true,
      },
      { id: 'satOut', label: 'Sat out a challenge', question: 'This episode, who sat out a challenge?', during: { segment: 'immunityChallenge' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'learnedOfAdvantage', label: 'Learned of an idol or advantage privately', during: { twist: 'advantages' }, counted: 'yesNo', answeredBy: 'research', reliability: 'patchy' },
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
      exileWent: 0,
      lostFireMaking: -1,
      quit: -5,
      medicallyEvacuated: 0,
      finalist: { exclusive: 2, shared: 3 },
      soleSurvivor: { exclusive: 1, shared: 3 },
      finaleJuryVote: { exclusive: 0.5, shared: 1 },
      finaleNoJuryVotes: { exclusive: -2, shared: -3 },
    },
    momentNotes: { exileWent: { reliability: 'reliable' } },
    // survivor.js's own words for what research is asked, how each answer reads to a reviewer (its notes, and the fuller
    // sentences semantic search reads), and its checks' words, by these blocks' question keys.
    research: {
      searchHint: [
        "Search for the episode recap, the episode's wiki page, and any reporting on idols or advantages",
        'found or played in it, who voted for whom, and the finishing order of any individual challenge.',
        'Then answer the checklist for every person above.',
      ],
      questions: {
        tribalCouncilAttended: {
          needsSource: false,
          note: false,
          words:
            "Were they AT Tribal Council this episode, as one of the people voting? Before the merge only the " +
            "tribe(s) that lost immunity go: everyone on a tribe that won immunity did NOT attend ('no'), and " +
            "neither did anyone away from camp for it. 'unknown' if the sources don't say which tribe went.",
        },
        tribalCouncilVotesReceived: {
          words: 'How many votes were cast against them at Tribal this episode. 0 if they attended and got none. Null if unknown or no Tribal.',
          note: '{value} vote{s} against',
          sentence: 'received {value} vote(s) at Tribal',
        },
        tribalCouncilVotedFor: {
          words:
            "Who they voted for at Tribal this episode, written exactly as that person's name appears in the " +
            "list you were sent. If there was a revote, their vote in the FINAL round. Null if unknown, no " +
            "Tribal, or they didn't vote.",
          note: 'voted {value}',
          sentence: 'voted for {value}',
        },
        juryVotesReceived: {
          words:
            'Only for a finalist at Final Tribal Council this episode: how many jury votes they received to ' +
            "win. 0 if they got none. Null if they weren't a finalist this episode or it isn't reported.",
          note: '{value} jury vote{s}',
          sentence: 'received {value} jury vote(s) at Final Tribal',
          // None is worth saying too: the goat.
          shown: { any: [{ answer: 'juryVotesReceived', equals: 0 }, { answer: 'juryVotesReceived', greaterThan: 0 }] },
        },
        immunityChallengeWon: { words: 'Did they win INDIVIDUAL immunity (not as part of a tribe)?', note: 'individual immunity', sentence: 'won individual immunity' },
        immunityChallengeGroupWon: {
          needsSource: false, words: 'Were they on the tribe/team that won immunity?', note: 'tribe immunity', sentence: 'was on the tribe that won immunity',
        },
        rewardChallengeWon: { words: 'Did they win an INDIVIDUAL reward challenge (not as part of a tribe)?', note: 'individual reward', sentence: 'won individual reward' },
        rewardChallengeGroupWon: { needsSource: false, words: 'Were they on the tribe/team that won reward?', note: 'tribe reward', sentence: 'was on the tribe that won reward' },
        immunityChallengePlace: {
          words:
            "Their best finishing place in THIS episode's INDIVIDUAL challenge(s) -- 1 if they won, 2 for " +
            "runner-up, 3 for third -- only when a source states the order. Null for tribe/team challenges, " +
            "if they finished below third, or if the order isn't reported.",
          note: '{nth} in an individual challenge',
          sentence: 'finished {nth} in an individual challenge',
          shown: { any: [{ answer: 'immunityChallengePlace', equals: 2 }, { answer: 'immunityChallengePlace', equals: 3 }] },
        },
        satOut: { words: 'Did they sit out of a challenge this episode?', note: 'sat out a challenge' },
        chosenForReward: {
          words: "Did a reward WINNER choose them to come along on the reward, without them winning it themselves? 'no' if they won it.",
          note: 'chosen to join a reward',
        },
        fireMakingWon: { words: 'Did they WIN a fire-making challenge this episode (the final-four fire-making duel)?', note: 'won fire-making' },
        advantagesGot: { words: 'Did they FIND a hidden immunity idol or any advantage this episode?', note: 'found {advantageFoundName|an advantage}' },
        advantageFoundName: {
          type: 'string',
          words: "What they found, in the show's own words ('hidden immunity idol', 'Beware Advantage', 'Shot in the Dark'). Null if nothing.",
          note: false,
        },
        advantagesPlayed: { words: 'Did they PLAY an idol or advantage this episode (their own or on someone else)?', note: 'played {advantagePlayedName|an advantage}' },
        advantagePlayedName: { type: 'string', words: "What they played, in the show's own words. Null if nothing.", note: false },
        advantagesVotesCancelled: {
          words:
            'If they PLAYED an idol or advantage (on themselves or someone else), how many votes it cancelled ' +
            "-- 0 if it cancelled none. Null if they played nothing or it isn't reported.",
          note: 'nullified {value} vote{s}',
          sentence: false,
        },
        advantagesUsedAgainst: {
          needsSource: false, words: 'Was an advantage used against them (a vote stolen, blocked, nullified)?',
          note: 'advantage used against them', sentence: 'had an advantage used against them',
        },
        learnedOfAdvantage: {
          words:
            'Did they find out, this episode, that ANOTHER player has a hidden immunity idol or advantage -- ' +
            'told by them or someone else, saw it, or worked it out on screen? Only what the episode shows or ' +
            'a recap states, not speculation. It must be PRIVATE knowledge: learned alone or within an ' +
            'alliance or small group, not something the whole tribe or everyone at Tribal learned at once ' +
            '(e.g. an idol played at Tribal Council is not this). And only the FIRST time they learn about ' +
            "that particular idol or advantage -- 'no' if they already knew about it from an earlier episode.",
          note: "privately learned of someone's idol/advantage",
        },
        journeysWent: {
          words:
            'Were they sent on a JOURNEY this episode -- taken away from camp (often by boat) to a separate ' +
            'location, usually with a chance at an advantage or a risk to their vote?',
          note: 'went on a journey',
        },
        exileWent: {
          needsSource: false, words: 'Were they sent away from their tribe by an Exile Island-style twist while staying in the game?', note: 'exiled', sentence: 'was exiled',
        },
        notableTwist: {
          type: 'string',
          words: 'Any other notable, checkable thing that happened to this person this episode, in one short phrase. Null if nothing.',
          note: '{value}',
        },
        // survivor.js asked it by its key alone; a question asked besides says what it asks.
        tribalCouncilHeld: { type: 'answer', of: 'episode', words: 'Was there a Tribal Council this episode?' },
      },
      // The checks the compiler makes from these blocks, in survivor.js's words, and one of its own.
      checks: {
        immunityChallengeWonVotedOut: { words: '{name}: voted out despite winning individual immunity' },
        // Its finishing place is in any individual challenge, so a reward won is a 1st too.
        immunityChallengeFirstNotWon: {
          when: { all: [{ answer: 'immunityChallengePlace', equals: 1 }, { answer: 'immunityChallengeWon', isNot: 'yes' }, { answer: 'rewardChallengeWon', isNot: 'yes' }] },
          words: "{name}: finished 1st in an individual challenge but isn't marked as winning it",
        },
        tribalCouncilVotesWhileAway: { words: "{name}: {tribalCouncilVotesReceived} votes against someone who didn't attend Tribal" },
        tribalCouncilSkippedBy: { words: '{name}: marked as at Tribal, but on the tribe that won immunity (attendance cleared to unknown)' },
        tribalCouncilNoVotesFound: { words: 'Everyone at Tribal was given zero votes, so the vote counts look missing (cleared, nobody marked safe)' },
        tribalCouncilVoteCount: { words: '{against} votes counted against people, but {voters} people at Tribal are recorded voting: check who attended' },
        advantagesCancelledUnplayed: { words: "{name}: votes cancelled by an advantage they aren't marked as playing" },
        tribalCouncilGroupMove: { words: "{name} was at {group}'s Tribal but was still on {was}: added a move to {group} (reject it in review if that's wrong)" },
        advantagesGotUnnamed: {
          when: { all: [{ answer: 'advantagesGot', is: 'yes' }, { answer: 'advantageFoundName', present: false }] },
          words: "{name}: found an advantage but didn't say what",
        },
      },
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
      exileWent: 'wentToExile',
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
    // The keys research answers are stored under (survivor.js's checklist).
    questions: {
      rewardChallengeWon: 'wonIndividualReward',
      rewardChallengeGroupWon: 'wonTribeReward',
      immunityChallengeWon: 'wonIndividualImmunity',
      immunityChallengeGroupWon: 'wonTribeImmunity',
      immunityChallengePlace: 'individualChallengeFinish',
      tribalCouncilAttended: 'attendedTribal',
      tribalCouncilVotesReceived: 'votesReceived',
      tribalCouncilVotedFor: 'votedFor',
      satOut: 'satOutOfChallenge',
      fireMakingWon: 'wonFireMaking',
      advantagesGot: 'foundAdvantage',
      advantagesPlayed: 'playedAdvantage',
      advantagesVotesCancelled: 'votesNullified',
      advantagesUsedAgainst: 'advantageUsedAgainstThem',
      journeysWent: 'wentOnJourney',
      exileWent: 'exiled',
    },
  },
};
