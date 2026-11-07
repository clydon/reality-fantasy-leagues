// The Start-a-game GPT's three examples (docs/PLAN-start-a-game-gpt.md, "The three examples as specs"): what someone
// types, the game spec it becomes, what the spec refers to (ctx: the show's words, the data that settles it) and what the
// wizard says. Fixtures for tests/game-spec.test.js now (A1); end to end in G2 and G3. G3: the two sports examples are on their
// own matchup's page (a season of the series' games, of the opener alone), whose people are its two teams' players.
module.exports = [
  {
    name: "a fantasy league for Survivor 51",
    words: "I want to set up a fantasy league for Survivor 51.",
    // The wizard asked which game (Weekly Lineup, recommended); the rest is the preset's.
    spec: {
      spec: 1, preset: "weekly-lineup", span: { from: 7, to: null },
      pool: { of: "cast", where: { stillIn: true } },
      get: { by: "draft", each: 5, order: "blind", own: "shared" }, count: { start: 3 },
      score: { by: "moments", points: null }, rank: { by: "total" }, closes: "start",
    },
    ctx: { show: "Survivor 51", castaway: "castaway" },
    sentence: "A Weekly Lineup for Survivor 51: everyone drafts 5 and starts 3 each episode, Episode 7 to the finale. Scored by Survivor 51's rules.",
    type: "active-roster",
    waits: [],
  },
  {
    name: "the Red Sox–Yankees series",
    words: "For this upcoming Red Sox–Yankees series I want a draft where we draft 3 players each. We'll score 5 points for every home run and 1 point for each total base.",
    // The series' games, as a season of their own (a matchup: L1 part 3), whose people are its two teams' players (G3: so no
    // filter by team is needed on its page).
    spec: {
      spec: 1, span: { from: 1, to: 3 },
      get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: { all: true },
      score: { by: "stats", points: { HR: 5, TB: 1 } }, rank: { by: "total" }, closes: "start",
    },
    // ESPN's per-player batting columns, and total bases, which the sports branch's Baseball reducer counts from the plays.
    ctx: {
      show: "the Red Sox–Yankees series", castaway: "player", part: { singular: "game", plural: "games" },
      stats: [{ key: "AB" }, { key: "R" }, { key: "H" }, { key: "RBI" }, { key: "HR", label: "home run" }, { key: "BB" }, { key: "K" }, { key: "TB", label: "total base" }],
    },
    sentence: "A game for the Red Sox–Yankees series: everyone drafts 3, Games 1–3. Scored 5 a home run and 1 a total base.",
    // G3: it plays today (everyone drafted, scored by the sport's stats: L3 part 2a's hook on a draft's type).
    type: "active-roster",
    // L3 part 2: the engine scores a sport's stats; G3: the matchup's own page has the two teams' players.
    waits: [],
  },
  {
    name: "the 76ers home opener",
    words: "I want to make a game for the 76ers home opener. I want us all to predict 3 things: winner, top scorer, and over/under total points.",
    spec: {
      spec: 1, span: { from: 1, to: 1 },
      get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, closes: "start",
      ask: [
        { id: "winner", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } },
        { id: "top", ask: "Who scores the most points?", answer: "person", points: 1, settle: { by: "stat", stat: "PTS", take: "most" } },
        // L3 part 3b: the game's own line (ESPN's, kept when the question opens: 237.5 from the opener's summary).
        { id: "total", ask: "Total points: over or under?", answer: "overUnder", line: "game", points: 1, settle: { by: "final", take: "total" } },
      ],
    },
    ctx: { show: "the 76ers home opener", castaway: "player", part: { singular: "game", plural: "games" }, stats: [{ key: "PTS", label: "point" }, { key: "REB" }, { key: "AST" }] },
    sentence: "A game for the 76ers home opener: everyone answers three questions before Game 1: who wins, who scores the most points and total points: over or under (the game's line). A point for each right answer.",
    type: "questions",
    // L3 part 2c: the engine plays the sports settles and the side answer; G3: the game's own page has its two teams' players.
    waits: [],
  },
];
