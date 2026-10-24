// The TV guide, "This week on the couch" (the mock's index.html guideDays, tvguide.js): a column per day from today,
// your shows and the couch's first, then the rest of TV as shorter, faded cards. Step 11 makes it real (schedules,
// listings, hide from guide, drops, planned nights).
import { art, type Demo } from "./people";

export const STEP = "11";

export interface GuideCard {
  time: string;
  name: string;
  art?: string;
  position?: string;
  sub: string;
  faces?: Demo[];
  /** A small tag over the name: a planned Watch along, a drop. */
  tag?: { text: string; tone?: "good" | "drop" };
  /** Watching, not playing yet: dashed and desaturated. */
  watchOnly?: boolean;
  /** One of your moves is due for it. */
  due?: boolean;
}

export interface GuideDay {
  /** Days from today. */
  offset: number;
  /** Your shows and the couch's, in time order; an array is two at the same time. */
  mine: (GuideCard | GuideCard[])[];
  /** Where the "Now" line falls in `mine` (today only). */
  nowBefore?: number;
  /** The rest of TV. */
  also: GuideCard[];
}

export const GUIDE: GuideDay[] = [
  {
    offset: 0,
    nowBefore: 0,
    mine: [
      { time: "9:00 PM", name: "Severance", art: art("severance"), sub: "riley + jordan", faces: ["riley", "jordan"], tag: { text: "Watch along · Ep 7", tone: "good" } },
      { time: "11:30 PM", name: "Saturday Night Live", art: art("late-night"), sub: "S52 · Ep 4", faces: ["riley", "jordan"], watchOnly: true },
    ],
    also: [
      { time: "8:00 PM", name: "The Great British Bake Off", sub: "S16 · Competition" },
      { time: "9:00 PM", name: "Married at First Sight", sub: "S19 · Dating" },
    ],
  },
  {
    offset: 1,
    mine: [
      { time: "3:00 PM", name: "Formula 1", art: art("f1"), sub: "2026 season · Ep 19", faces: ["jordan", "sam"], watchOnly: true },
      { time: "9:00 PM", name: "Love Island USA", art: art("love-island"), position: "96% 30%", sub: "S7 · Ep 14", faces: ["riley"], watchOnly: true },
    ],
    also: [
      { time: "7:30 PM", name: "Survivor Australia", sub: "S12 · Competition" },
      { time: "8:00 PM", name: "Big Brother", art: art("big-brother"), sub: "S27 · Competition" },
    ],
  },
  {
    offset: 2,
    mine: [
      { time: "8:00 PM", name: "Below Deck Med", art: art("below-deck"), position: "50% 25%", sub: "S10 · Ep 7", faces: ["riley", "sam"], watchOnly: true },
      [
        { time: "9:00 PM", name: "Love Island USA", art: art("love-island"), position: "96% 30%", sub: "S7 · Ep 15", faces: ["riley"], watchOnly: true },
        { time: "9:00 PM", name: "Harry Potter", art: art("harry-potter"), sub: "HBO Max", tag: { text: "All 8 drop", tone: "drop" } },
      ],
    ],
    also: [{ time: "8:00 PM", name: "The Bachelor", sub: "S30 · Dating" }],
  },
  {
    offset: 3,
    mine: [{ time: "8:00 PM", name: "The Challenge", art: art("challenge"), position: "62% 30%", sub: "S37 · Ep 7", faces: ["alex", "sam"], watchOnly: true }],
    also: [
      { time: "8:00 PM", name: "Dancing with the Stars", art: art("dwts"), sub: "S34 · Competition" },
      { time: "9:00 PM", name: "Vanderpump Rules", sub: "S12 · Docuseries" },
    ],
  },
  {
    offset: 4,
    mine: [{ time: "8:05 PM", name: "Survivor", art: art("survivor"), position: "64% 50%", sub: "S51 · Ep 5", faces: ["alex", "riley", "jordan", "sam"], due: true }],
    also: [
      { time: "8:00 PM", name: "Big Brother", art: art("big-brother"), sub: "S27 · Competition" },
      { time: "9:00 PM", name: "Love Is Blind", sub: "S9 · Dating" },
    ],
  },
  {
    offset: 5,
    mine: [{ time: "9:00 PM", name: "The Traitors", art: art("traitors"), position: "74% 35%", sub: "S5 · Ep 5", faces: ["alex", "riley", "jordan", "sam"], due: true }],
    also: [
      { time: "8:00 PM", name: "The Amazing Race", art: art("amazing-race"), sub: "S38 · Competition" },
      { time: "9:00 PM", name: "Top Chef", sub: "S23 · Competition" },
    ],
  },
  {
    offset: 6,
    mine: [{ time: "9:00 PM", name: "Pluribus", art: art("pluribus"), position: "22% 40%", sub: "S1 · Ep 4", faces: ["sam"], watchOnly: true }],
    also: [{ time: "8:00 PM", name: "RuPaul's Drag Race", art: art("drag-race"), sub: "S18 · Competition" }],
  },
];
