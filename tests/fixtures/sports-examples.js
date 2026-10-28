// The user's two sports examples (docs/PLAN-start-a-game-gpt.md, "What the user asked for", examples 2 and 3), made real from
// ESPN in L1: what was typed, the spec it becomes (A1's shape, tests/fixtures/game-specs.js on the engine branch, with ESPN's
// team ids where the plan has placeholders), the games it spans (ESPN's event ids: a matchup is a season of its own, L1's
// schedule part) and what those games settle it to, from the recorded box scores. Fixtures for later: G3 (the GPT learns
// sports) checks its draft against `spec`; L3 and L4 score `spec` over the recorded games and must come to `settles`.
// tests/sports-baseball.test.js already checks the Red Sox–Yankees scoring against its two recorded games.
module.exports = {
  redSoxYankees: {
    words: "For this upcoming Red Sox–Yankees series I want a draft where we draft 3 players each. We'll score 5 points for every home run and 1 point for each total base.",
    league: "baseball/mlb",
    teams: { BOS: "2", NYY: "10" },
    // The 2026 AL Wild Card Series, Red Sox at Yankees: the Yankees won it in two (9-0, 9-2), so its third game was never played.
    games: ["401907924", "401907963"],
    recorded: ["espn/mlb-401907924.json", "espn/mlb-401907963.json"],
    spec: {
      spec: 1,
      span: { from: 1, to: 2 },
      pool: { of: "cast", where: { teams: ["2", "10"] } },
      get: { by: "draft", each: 3, order: "snake", own: "exclusive" },
      count: { all: true },
      score: { by: "stats", points: { HR: 5, TB: 1 } },
      rank: { by: "total" },
      closes: "start",
    },
    // The series' best, at 5 a home run and 1 a total base (total bases from the plays: ESPN's lines have none).
    settles: {
      best: [
        { name: "Ben Rice", HR: 2, TB: 12, points: 22 },
        { name: "Cody Bellinger", HR: 1, TB: 6, points: 11 },
        { name: "Luis Garcia Jr.", HR: 1, TB: 6, points: 11 },
        { name: "Willson Contreras", HR: 1, TB: 5, points: 10 },
        { name: "Nick Sogard", HR: 1, TB: 4, points: 9 },
      ],
    },
  },
  sixersOpener: {
    words: "I want to make a game for the 76ers home opener. I want us all to predict 3 things: winner, top scorer, and over/under total points.",
    league: "basketball/nba",
    teams: { PHI: "20", CLE: "5" },
    // 2026-10-22, Cleveland Cavaliers at Philadelphia 76ers: their first home game of 2026-27 (ESPN's team schedule).
    games: ["401909093"],
    // Recorded with Basketball, in L1's next part.
    recorded: [],
    // ESPN's line before it (its summary's pickcenter): the over/under's default.
    line: { provider: "DraftKings", details: "PHI -2.5", overUnder: 237.5 },
    spec: {
      spec: 1,
      span: { from: 1, to: 1 },
      pool: { of: "cast", where: { teams: ["20", "5"] } },
      get: { by: "none" },
      score: { by: "answers" },
      rank: { by: "total" },
      closes: "start",
      ask: [
        { id: "winner", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } },
        { id: "top", ask: "Who scores the most points?", answer: "person", points: 1, settle: { by: "stat", stat: "PTS", take: "most" } },
        { id: "total", ask: "Total points: over or under?", answer: "overUnder", line: 237.5, points: 1, settle: { by: "final", take: "total" } },
      ],
    },
    // 76ers 114, Cavaliers 106: 220, under. Tyrese Maxey and Donovan Mitchell both scored 32: "the most" is a tie, which the
    // settle has to decide (both right, the rule A4 keeps for a number's closest).
    settles: { winner: "20", score: { 20: 114, 5: 106 }, total: 220, overUnder: "under", top: { PTS: 32, people: ["Tyrese Maxey", "Donovan Mitchell"] } },
  },
};
