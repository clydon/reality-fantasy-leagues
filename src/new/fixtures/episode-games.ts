// This week's one-night games, from the mock (gamestab.js epGamesHTML, refine.js Extras): every show the couch
// follows gets them automatically. Step 12 builds them (bingo, Call it, polls, trivia).

export const STEP = "12";

/** The Games tab's "This week", after the episode's bingo (whose time is the show's own). */
export const THIS_WEEK: { icon: "bingo" | "quiz"; title: string; line: string }[] = [
  { icon: "quiz", title: "Who goes home?", line: "One tap · closes at airtime" },
  { icon: "quiz", title: "Survivor 49 trivia", line: "3 questions from the real season" },
];

/** Tonight's Extras: your bingo card for the episode. */
export const BINGO_CARD = { title: "Your bingo card", line: "marks open at airtime", state: "Ready" };
