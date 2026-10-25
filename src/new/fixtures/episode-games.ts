// This week's one-night games, from the mock (gamestab.js epGamesHTML, refine.js Extras, couchpages.js breakPage): every
// show the couch follows gets them automatically. Step 12 builds them (bingo, Call it, polls, trivia).
import { art } from "./people";

export const STEP = "12";

/** The Games tab's "This week", after the episode's bingo (whose time is the show's own). */
export const THIS_WEEK: { icon: "bingo" | "quiz"; title: string; line: string }[] = [
  { icon: "quiz", title: "Who goes home?", line: "One tap · closes at airtime" },
  { icon: "quiz", title: "Survivor 49 trivia", line: "3 questions from the real season" },
];

/** Commercial break's "This week only", on the hub: each show's episode games and the couch's own. */
export const HUB_THIS_WEEK: { title: string; line: string; art: string; position: string; icon: "bingo" | "poll" | "quiz" }[] = [
  { title: "Episode 6 bingo", line: "Opens at airtime", art: art("survivor"), position: "64% 50%", icon: "bingo" },
  { title: "Who goes home?", line: "One tap · closes at airtime", art: art("survivor"), position: "64% 50%", icon: "poll" },
  { title: "Banishment poll", line: "Started by riley · 10 seconds", art: art("traitors"), position: "74% 35%", icon: "poll" },
  { title: "Survivor 49 trivia", line: "3 questions · riley got 2", art: art("survivor"), position: "20% 50%", icon: "quiz" },
];

/** Tonight's Extras: your bingo card for the episode. */
export const BINGO_CARD = { title: "Your bingo card", line: "marks open at airtime", state: "Ready" };
