// Sample rulebooks for the kinds of show the built-ins don't cover, written to the schema
// (src/lib/game/formats/rulebook-schema.js) from the site mock's rulebook.js shows: a reality series (Below
// Deck), a scripted series (Pluribus), a talk show (Saturday Night Live), a sport (Formula 1) and a competition
// of pairs (The Amazing Race). Used by tests/rulebooks.test.js; reusable as fixtures for How it works (step 1)
// and the compiler (R2, the implementation plan's T-16).
module.exports = {
  belowDeck: {
    schema: 1, kind: 'series', start: 'reality', show: 'Below Deck Mediterranean',
    tagline: 'A yacht crew through a charter season',
    premise: 'A yacht crew works a summer of charters. Guests come and go every few days, the crew lives and works together, and the captain decides who stays.',
    cast: { unit: 'people', singular: 'crew member', plural: 'crew', usualSize: 9, groups: { type: 'sides', singular: 'department', change: 'never' } },
    season: {
      phases: [{ id: 'charterSeason', name: 'Charter season', starts: { type: 'episode', n: 1 }, changes: [] }],
      finale: { decidedBy: 'nobody', summary: 'No winner: the season ends with the last charter.' },
    },
    segments: [
      { id: 'newCharter', name: 'A new charter', summary: 'Guests arrive with a preference sheet.', decidedBy: 'nobody', often: 'someEpisodes' },
      { id: 'service', name: 'Service', summary: 'Meals, theme nights and whatever goes wrong.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'tipMeeting', name: 'The tip meeting', summary: 'The guests tip the whole crew.', decidedBy: 'nobody', onTheLine: 'reward', often: 'someEpisodes' },
      { id: 'crewNightOut', name: 'Crew night out', summary: 'Where the drama happens.', decidedBy: 'nobody', often: 'someEpisodes' },
    ],
    waysOut: [
      { id: 'firedByCaptain', name: 'Fired by the captain', means: 'out', cause: 'removed' },
      { id: 'quit', name: 'Quit', means: 'out', cause: 'ownChoice' },
    ],
    twists: [{ id: 'newHire', type: 'comeback', name: 'A new hire', summary: 'Joins partway through and takes the spot of whoever left.', who: 'newPeople', how: 'theShow' }],
    customMoments: [
      { id: 'praisedByCaptain', label: 'Praised by the captain', question: 'This episode, who was praised by the captain?', during: { segment: 'service' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'calledToOffice', label: "Called to the captain's office", question: "This episode, who was called to the captain's office?", counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'bigTip', label: 'A charter tip over $20K', question: 'This episode, who shared a charter tip over $20K?', during: { segment: 'tipMeeting' }, counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'crewHookup', label: 'A hookup with someone on the crew', question: 'This episode, who hooked up with someone on the crew?', during: { segment: 'crewNightOut' }, counted: 'yesNo', answeredBy: 'league', reliability: 'patchy' },
      { id: 'criesOnCamera', label: 'Cries on camera', question: 'This episode, how many times did each person cry on camera?', counted: 'eachTime', answeredBy: 'league', reliability: 'patchy' },
    ],
    points: { praisedByCaptain: 2, calledToOffice: -1, bigTip: 1, crewHookup: 1, criesOnCamera: 1, firedByCaptain: -5, quit: -3 },
    leftOut: [],
  },

  pluribus: {
    schema: 1, kind: 'series', start: 'scripted', show: 'Pluribus',
    tagline: 'One story told across the season',
    premise: "A drama told across the season. Nobody's playing to win, so the game is what happens to the characters, and calling it before it does.",
    cast: { unit: 'people', singular: 'main character', plural: 'main characters', usualSize: 6, groups: null },
    season: { phases: [{ id: 'season1', name: 'Season 1', starts: { type: 'episode', n: 1 }, changes: [] }], finale: { decidedBy: 'nobody', summary: 'No winner: the season ends where the story does.' } },
    segments: [
      { id: 'coldOpen', name: 'Cold open', summary: 'Before the titles. Often a flashback.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'theEpisode', name: 'The episode', summary: 'The main story.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'theEnding', name: 'The ending', summary: 'A reveal or a cliffhanger.', decidedBy: 'nobody', often: 'everyEpisode' },
    ],
    waysOut: [
      { id: 'writtenOut', name: 'Written out', means: 'out', cause: 'story' },
      { id: 'killedOff', name: 'Killed off', means: 'out', cause: 'story' },
    ],
    twists: [],
    customMoments: [
      { id: 'inTheEpisode', label: 'In the episode', question: 'This episode, who was in it?', counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'bigReveal', label: 'A big reveal about them', question: 'This episode, who did a big reveal turn on?', during: { segment: 'theEnding' }, counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'savesSomeone', label: 'Saves someone', question: 'This episode, who saved someone?', counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
      { id: 'inDanger', label: 'In danger and survives', question: 'This episode, who was in danger and survived?', counted: 'yesNo', answeredBy: 'research', reliability: 'usually' },
    ],
    points: { inTheEpisode: 1, bigReveal: 3, savesSomeone: 2, inDanger: 2, killedOff: -3, writtenOut: -2 },
    leftOut: ["Theories: the big questions the show hasn't answered yet, settled when the show answers them."],
  },

  snl: {
    schema: 1, kind: 'talk', show: 'Saturday Night Live',
    tagline: 'Sketch comedy, live on Saturday night',
    premise: 'A new host and musical guest every week, the same cast, sketches live from New York. Nobody leaves and nobody wins: the fun is calling what happens.',
    cast: { unit: 'people', singular: 'cast member', plural: 'cast members', usualSize: 17, groups: null },
    season: {
      phases: [
        { id: 'fall', name: 'Fall', starts: { type: 'episode', n: 1 }, changes: [], summary: 'October to December.' },
        { id: 'spring', name: 'Spring', starts: { type: 'announced' }, changes: [], summary: 'After the holidays.' },
      ],
    },
    segments: [
      { id: 'coldOpen', name: 'Cold open', summary: 'A sketch before the opening titles.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'monologue', name: 'Monologue', summary: "The host's welcome, sometimes a song.", decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'sketches', name: 'Sketches', summary: 'Live and taped, about eight a show.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'weekendUpdate', name: 'Weekend Update', summary: 'The news desk, and guests at it.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'musicalGuest', name: 'Musical guest', summary: 'Two songs.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'goodnights', name: 'Goodnights', summary: 'Everyone on stage, waving.', decidedBy: 'nobody', often: 'everyEpisode' },
    ],
    waysOut: [],
    twists: [],
    customMoments: [
      { id: 'breaksCharacter', label: 'Someone breaks character', during: { segment: 'sketches' }, counted: 'yesNo', answeredBy: 'league' },
      { id: 'surpriseCameo', label: 'A surprise cameo', counted: 'yesNo', answeredBy: 'league' },
      { id: 'hostSings', label: 'The host sings', during: { segment: 'monologue' }, counted: 'yesNo', answeredBy: 'league' },
      { id: 'recurringCharacter', label: 'A recurring character', during: { segment: 'sketches' }, counted: 'yesNo', answeredBy: 'league' },
      { id: 'guestInSketch', label: 'The musical guest in a sketch', counted: 'yesNo', answeredBy: 'league' },
      { id: 'flubbedLine', label: 'A flubbed line', counted: 'yesNo', answeredBy: 'league' },
    ],
    leftOut: [],
  },

  formula1: {
    schema: 1, kind: 'sport', show: 'Formula 1',
    parts: { singular: 'race', plural: 'races', label: 'Each race weekend' },
    tagline: 'A race series, most weekends',
    premise: 'Twenty-two drivers in eleven teams race on a different track most weekends. The real championship decides the title. Your game uses its own points, so every driver can matter.',
    cast: { unit: 'people', singular: 'driver', plural: 'drivers', usualSize: 22, groups: { type: 'sides', singular: 'team', change: 'never' } },
    season: {
      phases: [{ id: 'season', name: 'The season', starts: { type: 'episode', n: 1 }, changes: [], summary: 'Most weekends, March to December.' }],
      finale: { decidedBy: 'mostPoints', summary: 'Most points after Race 24 is the champion.' },
    },
    segments: [
      { id: 'practice', name: 'Practice', summary: 'Teams try their cars. Nothing scores.', decidedBy: 'nobody', often: 'everyEpisode' },
      { id: 'qualifying', name: 'Qualifying', summary: 'Sets the starting order. Fastest takes pole.', decidedBy: 'result', takesPart: 'everyone', decides: 'fullOrder', onTheLine: 'nothing', often: 'everyEpisode' },
      { id: 'sprint', name: 'Sprint', summary: 'A short Saturday race.', decidedBy: 'result', takesPart: 'everyone', decides: 'fullOrder', onTheLine: 'points', often: 'someEpisodes' },
      { id: 'race', name: 'The race', summary: 'The top ten score championship points.', decidedBy: 'result', takesPart: 'everyone', decides: 'fullOrder', onTheLine: 'points', often: 'everyEpisode' },
    ],
    waysOut: [
      { id: 'didNotFinish', name: 'Did not finish', means: 'outForOne' },
      { id: 'didNotStart', name: 'Did not start', means: 'outForOne' },
      { id: 'replacedForARace', name: 'Replaced for a race', means: 'outForOne', cause: 'removed' },
    ],
    twists: [],
    customMoments: [
      { id: 'beatTeammate', label: 'Beat their teammate', question: 'This race, who finished ahead of their teammate?', during: { segment: 'race' }, counted: 'yesNo', answeredBy: 'research', reliability: 'reliable' },
      { id: 'placesGained', label: 'Each place gained', question: 'This race, how many places did each driver gain from the start?', during: { segment: 'race' }, counted: 'perUnit', answeredBy: 'research', reliability: 'reliable' },
    ],
    points: { raceFirst: 10, qualifyingFirst: 3, beatTeammate: 2, placesGained: 1, didNotFinish: -5 },
    leftOut: [],
  },

  amazingRace: {
    schema: 1, kind: 'competition', show: 'The Amazing Race',
    parts: { singular: 'episode', plural: 'episodes', label: 'Each leg' },
    tagline: 'Teams race around the world',
    premise: 'Eleven teams of two race around the world, one leg at a time. The last team to the Pit Stop is usually out. The first team across the final finish line wins.',
    cast: { unit: 'pairs', singular: 'team', plural: 'teams', usualSize: 11, groups: null },
    season: {
      phases: [{ id: 'theRace', name: 'The race', starts: { type: 'episode', n: 1 }, changes: [] }],
      finale: { decidedBy: 'firstToFinish', finalists: 3, summary: 'The first team across the final finish line wins.' },
    },
    segments: [
      { id: 'routeInfo', name: 'Route Info', summary: 'Where to go next.', decidedBy: 'nobody', often: 'everyEpisode' },
      // Each team picks one of two tasks: nothing to score in the choice itself.
      { id: 'detour', name: 'Detour', summary: 'Pick one of two tasks.', decidedBy: 'pick', pickers: 'eachPerson', takesPart: 'everyone', often: 'everyEpisode', momentsOff: ['detourPicked', 'detourPickedFirst', 'detourNotPicked'] },
      { id: 'roadblock', name: 'Roadblock', summary: 'One teammate does it alone.', decidedBy: 'result', takesPart: 'everyone', decides: 'winner', onTheLine: 'nothing', often: 'everyEpisode' },
      { id: 'pitStop', name: 'Pit Stop', summary: 'The last team to arrive may be out.', decidedBy: 'result', takesPart: 'everyone', decides: 'fullOrder', onTheLine: 'goingHome', often: 'everyEpisode' },
    ],
    waysOut: [
      { id: 'eliminated', name: 'Eliminated at the Pit Stop', means: 'out', cause: { segment: 'pitStop' } },
      { id: 'quit', name: 'Quit', means: 'out', cause: 'ownChoice' },
      { id: 'medical', name: 'Medical', means: 'out', cause: 'medical' },
      { id: 'finalist', name: 'Finalist', means: 'finalist' },
      { id: 'wonTheRace', name: 'Won the race', means: 'winner' },
    ],
    twists: [
      { id: 'uTurn', type: 'advantage', name: 'U-Turn', summary: 'Makes another team do both sides of a Detour.', oneIsCalled: 'a U-Turn', gotBy: 'chosenByShow', does: ['hurtsSomeone'], lasts: 'oneUse' },
      { id: 'expressPass', type: 'advantage', name: 'Express Pass', summary: 'Skip one task.', oneIsCalled: 'an Express Pass', gotBy: 'wonAt', wonAt: 'pitStop', does: ['skipsATask'], lasts: 'oneUse' },
    ],
    customMoments: [],
    leftOut: ['Non-elimination legs: the last team stays, with a penalty on the next leg.'],
  },
};
