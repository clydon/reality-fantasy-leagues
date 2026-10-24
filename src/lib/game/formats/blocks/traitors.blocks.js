// The Traitors as a rulebook's blocks (docs/PLAN-rulebooks-implementation.md 4.5), hand-written from
// traitors.js. Same rules as survivor.blocks.js: the season plays by traitors.js's data until someone edits
// it, and `aliases` maps what these blocks build onto the event ids and exit methods leagues have recorded.
//
// Its two banishments are two ways out here, as the rulebook mockup has them, though both are recorded as the
// one exit "Banished" (the role decides which scores). The role-aware Round Table moments the templates don't
// build (a Traitor turning on a Traitor, a Faithful voting out a Faithful, leading a case) and the endgame's
// role bonuses are moments added by hand, under their own ids.
module.exports = {
  blocks: {
    schema: 1,
    kind: 'competition',
    show: 'The Traitors',
    tagline: 'Faithful hunting the Traitors among them',
    premise:
      'A castle full of players, a few of them secretly Traitors. Each night the Traitors murder someone; each day everyone votes to banish who they think is one. Faithful who catch every Traitor share the prize; a Traitor who lasts takes it.',
    cast: { unit: 'people', singular: 'player', plural: 'players', usualSize: 21, groups: null },
    season: {
      phases: [{ id: 'castle', name: 'The castle', starts: { type: 'episode', n: 1 }, changes: [], summary: 'A murder each night, a mission each day, a banishment at the Round Table.' }],
      finale: {
        decidedBy: 'castVote', finalists: 4,
        summary: 'The finalists vote to end the game or banish again. Faithful win together; a Traitor left standing takes it all.',
      },
    },
    segments: [
      {
        id: 'mission', name: 'Mission', summary: 'The group earns money for the prize, and some win a shield or a power.',
        decidedBy: 'result', takesPart: 'everyone', decides: 'winner', onTheLine: 'advantage', often: 'everyEpisode',
        momentsOff: ['missionWon'],
      },
      {
        id: 'murder', name: 'Murder', summary: 'The Traitors choose someone to murder in the night.',
        decidedBy: 'vote', voters: 'secretGroup', takesPart: 'everyone', onTheLine: 'goingHome', often: 'everyEpisode',
      },
      {
        id: 'roundTable', name: 'Round Table', summary: 'Everyone votes to banish who they think is a Traitor.',
        decidedBy: 'vote', voters: 'cast', takesPart: 'everyone', onTheLine: 'goingHome', often: 'everyEpisode',
        // Who voted for whom scores by role here (the secret role's moments), not by majority.
        momentsOff: ['roundTableVotedWithMajority', 'roundTableVotedAgainstMajority'],
      },
    ],
    waysOut: [
      { id: 'banishedAsFaithful', name: 'Banished as a Faithful', means: 'out', cause: { segment: 'roundTable' } },
      { id: 'banishedAsTraitor', name: 'Banished as a Traitor', means: 'out', cause: { segment: 'roundTable' } },
      { id: 'murdered', name: 'Murdered', means: 'out', cause: { segment: 'murder' } },
      { id: 'leftTheGame', name: 'Left the game', means: 'out', cause: 'ownChoice' },
      { id: 'finalist', name: 'Finalist', means: 'finalist' },
      { id: 'winner', name: 'Winner', means: 'winner' },
    ],
    twists: [
      {
        id: 'traitors', type: 'secretRole', name: 'Traitors and Faithful', summary: 'Hidden until they leave. A Faithful can be recruited partway through.',
        roles: ['Traitor', 'Faithful'], revealed: 'whenTheyLeave', canSwitch: 'recruited',
      },
      {
        id: 'shields', type: 'advantage', name: 'Shields', summary: 'Won on missions. A shield stops a murder for one night.',
        oneIsCalled: 'a shield', gotBy: 'wonAt', wonAt: 'mission', does: ['keepsSafe'], lasts: 'oneEpisode',
        momentsOff: ['shieldsPlayed'],
      },
    ],
    customMoments: [
      { id: 'missionStandout', label: 'Credited with carrying a mission', question: 'This episode, who was credited with carrying the mission?', during: { segment: 'mission' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'missionBlunder', label: 'Blamed for a mission failure or lost money', question: 'This episode, who was blamed for a mission failure or lost money?', during: { segment: 'mission' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'gaveShield', label: 'Gave their shield to someone else', during: { twist: 'shields' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'consideredForMurder', label: 'Considered for murder and survived', question: 'This episode, who did the Traitors consider murdering who survived the night?', during: { segment: 'murder' }, counted: 'yesNo', answeredBy: 'research', reliability: 'patchy' },
      { id: 'accusedAtRoundTable', label: 'Accused at the Round Table and survived it', question: 'This episode, who was accused at the Round Table and survived it?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'turnedOnTraitor', label: 'As a Traitor, voted out a fellow Traitor', question: 'This episode, which Traitors voted out a fellow Traitor?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'votedOutFaithful', label: 'As a Faithful, voted out a Faithful', question: 'This episode, which Faithful voted for a Faithful who was banished?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'ledCaseAgainstTraitor', label: 'As a Faithful, led the case that banished a Traitor', question: 'This episode, which Faithful led the case that banished a Traitor?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'ledCaseAgainstPartner', label: 'As a Traitor, led the case that banished a fellow Traitor', question: 'This episode, which Traitors led the case that banished a fellow Traitor?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'framedFaithful', label: 'As a Traitor, led the case that banished a Faithful', question: 'This episode, which Traitors led the case that banished a Faithful?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'ledCaseAgainstFaithful', label: 'As a Faithful, led the case that banished a Faithful', question: 'This episode, which Faithful led the case that banished a Faithful?', during: { segment: 'roundTable' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'wonAsTraitor', label: 'Won the season as a Traitor', counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'fooledToTheEnd', label: 'Finalist who lost to a Traitor', question: 'This episode, which finalists lost to a Traitor?', counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'banishedInFinale', label: 'Banished in the finale', question: 'This episode, who was banished in the finale?', counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
    ],
    leftOut: [],
  },
  aliases: {
    events: {
      missionEarnedAdvantage: 'wonPower',
      murderTargetedSurvived: 'onMurderShortlist',
      roundTableZeroVotes: 'zeroVotes',
      roundTableSurvivedVotes: 'survivedRoundTable',
      traitorsCaughtAtRoundTable: 'votedOutTraitor',
      traitorsFooledAtRoundTable: 'traitorVotedOutFaithful',
      traitorsRecruited: 'recruited',
      traitorsTurnedDown: 'declinedRecruitment',
      shieldsGot: 'shieldWon',
      shieldsSavedBy: 'shieldSavedThem',
      leftTheGame: 'leftGame',
      winner: 'seasonWinner',
    },
    exits: {
      banishedAsFaithful: 'Banished',
      banishedAsTraitor: 'Banished',
      murdered: 'Murdered',
      leftTheGame: 'Left the game',
      finalist: 'Finalist',
      winner: 'Winner',
    },
  },
};
