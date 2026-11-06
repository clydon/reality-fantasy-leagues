// The pieces guide (docs/GAME-PIECES.md, docs/PLAN-start-a-game-gpt.md step C1): every engine step keeps it current, and these
// keep it honest where drifting would be silent. Its size limits are the schema's, and every value the schema plays now
// (game-spec VOCAB's 'now') is named in it, so a step that adds a value or changes a limit without its entry fails here. Run with
// `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const G = require("../src/lib/game/game-spec/index.js");

const DOC = fs.readFileSync(path.join(__dirname, "..", "docs", "GAME-PIECES.md"), "utf8").replace(/\r\n/g, "\n");
const n = (v) => v.toLocaleString("en-US");

test("the guide's size limits are the schema's", () => {
  // The number of parlays (6) is the schema's MAX_PARLAYS, which it doesn't export: the rest of that row is checked.
  const rows = [
    ["A team scored by place (Outlast)", `1 to ${G.MAX_TEAM}`],
    ["A lineup", `1 to ${G.MAX_STARTERS} starters, a bench of up to ${G.MAX_BENCH} (${G.MAX_LINEUP_TEAM} drafted)`],
    ["Questions a game", `${G.MAX_QUESTIONS}`],
    ["A person or group pick", `1 to ${G.MAX_PICK}`],
    ["An order, a confidence ranking", `2 to ${G.MAX_ORDER}, scoring within 0 to ${G.MAX_WITHIN} places`],
    ["Chips to spread", `2 to ${G.MAX_CHIPS}`],
    ["Pairs", `1 to ${G.MAX_PAIRS}`],
    ["A question's points", `0 to ${G.MAX_QUESTION_POINTS}`],
    ["A choice's options", `2 to ${G.MAX_OPTIONS}`],
    ["A window (every, over, a cut's every)", `2 to ${G.MAX_WINDOW} episodes (a cut, 1 to ${G.MAX_WINDOW})`],
    ["Parlays", `6, each 2 to ${G.MAX_LEGS} legs; multipliers more than 1, up to ${G.MAX_TIMES}`],
    ["When points multiply", `${G.MAX_WHEN}`],
    ["Stages", `2 to ${G.MAX_STAGES}, a name up to ${G.MAX_STAGE_NAME} characters; copies of a stage a change starts, ${G.MAX_COPIES}`],
    ["A side stage's grouping", `held 1 to ${G.MAX_HELD} episodes`],
    ["The overall's points for places", `1 to ${G.MAX_PLACES} places`],
    ["Lives", `1 to ${G.MAX_LIVES}; mulligans 1 to ${G.MAX_MULLIGANS}; buybacks 1 to ${G.MAX_BUYBACKS}, cost 0 to ${G.MAX_BUYBACK_COST}`],
    ["Cuts", `${G.MAX_CUTS}; 1 to ${G.MAX_CUT_OUT} out, or half`],
    ["Teams of players", `2 to ${G.MAX_PLAYER_TEAMS}; a name up to ${G.MAX_TEAM_NAME} characters`],
    ["Playoffs", `2 to ${G.MAX_PLAYOFF_TEAMS} teams`],
    ["A handicap", `1 to ${G.MAX_HANDICAP} points an episode`],
    ["A budget", `1 to ${n(G.MAX_BUDGET)}; a sealed bid sheet, ${G.MAX_BIDS} bids`],
    ["A shared seat", `2 to ${G.MAX_SEAT_PEOPLE} people`],
    ["Group slots", `1 or ${G.MAX_GROUP_SLOTS}`],
    ["Side bets", `1 to ${G.MAX_BET_POINTS} points`],
    ["A race", `1 to ${n(G.MAX_RACE)} points`],
  ];
  for (const [what, limit] of rows) assert.ok(DOC.includes(`| ${what} | ${limit} |`), `docs/GAME-PIECES.md's size limits: "| ${what} | ${limit} |"`);
});

test("every value the schema plays now is named in the guide", () => {
  const missing = [];
  for (const [key, values] of Object.entries(G.VOCAB)) {
    for (const [value, builder] of Object.entries(values)) {
      if (builder === "now" && !DOC.includes(`\`${value}\``) && !DOC.includes(`"${value}"`)) missing.push(`${key}: ${value}`);
    }
  }
  assert.deepEqual(missing, [], "each is named in docs/GAME-PIECES.md, in backticks, with its entry");
});
