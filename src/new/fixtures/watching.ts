// What the couch watches, from the mock (watching.js, streaming.js): the "you both watch" nudge, The couch is
// watching, and the Add a show poster. Step 10 (follows, Add a show, Make it a game) makes them real.
import { art, type Demo } from "./people";

export const STEP = "10";

export const NUDGE = { show: "The Amazing Race", art: art("amazing-race"), with: ["jordan"] as Demo[] };

export interface CouchWatchCard {
  name: string;
  art: string;
  position?: string;
  /** Not on your list yet. */
  notYours?: boolean;
  /** Someone's on it right now. */
  onNow?: Demo;
  people: [Demo, string][];
}

export const COUCH_WATCHING: CouchWatchCard[] = [
  { name: "Saturday Night Live", art: art("late-night"), notYours: true, people: [["riley", "caught up"], ["jordan", "caught up"]] },
  { name: "Formula 1", art: art("f1"), notYours: true, people: [["jordan", "caught up"], ["sam", "caught up"]] },
  { name: "Below Deck Med", art: art("below-deck"), position: "50% 25%", onNow: "riley", people: [["riley", "now"], ["sam", "caught up"]] },
  { name: "Love Island USA", art: art("love-island"), position: "96% 30%", notYours: true, people: [["riley", "Ep 13"]] },
];
