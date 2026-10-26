// All of TV in the guide, "Also on" (the mock's tvguide.js): under each day's shows of yours and the couch's, the rest of
// TV that evening as shorter, faded cards. The guide itself is real since step 11 part 1; part 2 makes this real (the
// tv_listings table, kept by the daily job).
import { art } from "./people";

export const STEP = "11";

export interface AlsoOnCard {
  time: string;
  name: string;
  art?: string;
  sub: string;
}

/** By days from today. */
export const ALSO_ON: AlsoOnCard[][] = [
  [
    { time: "8:00 PM", name: "The Great British Bake Off", sub: "S16 · Competition" },
    { time: "9:00 PM", name: "Married at First Sight", sub: "S19 · Dating" },
  ],
  [
    { time: "7:30 PM", name: "Survivor Australia", sub: "S12 · Competition" },
    { time: "8:00 PM", name: "Big Brother", art: art("big-brother"), sub: "S27 · Competition" },
  ],
  [{ time: "8:00 PM", name: "The Bachelor", sub: "S30 · Dating" }],
  [
    { time: "8:00 PM", name: "Dancing with the Stars", art: art("dwts"), sub: "S34 · Competition" },
    { time: "9:00 PM", name: "Vanderpump Rules", sub: "S12 · Docuseries" },
  ],
  [
    { time: "8:00 PM", name: "Big Brother", art: art("big-brother"), sub: "S27 · Competition" },
    { time: "9:00 PM", name: "Love Is Blind", sub: "S9 · Dating" },
  ],
  [
    { time: "8:00 PM", name: "The Amazing Race", art: art("amazing-race"), sub: "S38 · Competition" },
    { time: "9:00 PM", name: "Top Chef", sub: "S23 · Competition" },
  ],
  [{ time: "8:00 PM", name: "RuPaul's Drag Race", art: art("drag-race"), sub: "S18 · Competition" }],
];
