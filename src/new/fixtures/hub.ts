// The hub's own data, from the mock (index.html, refine.js, couchpages.js, stats.js): the feed (On the couch), your
// profile's numbers, and the six pages of More on the couch. Step 8 (Hub I) makes them real.
import type { GameName } from "../games";
import { art, castPhoto, type Demo } from "./people";

export const STEP = "8";

const s51 = (name: string) => castPhoto("survivor-51", name);
const t5 = (name: string) => castPhoto("the-traitors-us-5", name);

export const SHOW_COLOUR = { Survivor: "#f2804b", Traitors: "#c23a4b", Challenge: "#5089c9" } as const;

// ---------- On the couch: the feed ----------
export type ReactKind = "fire" | "laugh" | "eye" | "crown";
export interface FeedItem {
  who: Demo;
  /** "set a Survivor lineup"; none for something they said. */
  did?: string;
  /** The line under it, or what they said. */
  line?: string;
  /** For something said: where. */
  where?: string;
  reactions?: { kind: ReactKind; n: number; mine?: boolean }[];
}
export const FEED: FeedItem[] = [
  { who: "sam", did: "started watching Pluribus", line: "Episode 1 · left 9 reactions for whoever watches next" },
  { who: "jordan", did: "is on Episode 5 of The Amazing Race" },
  { who: "riley", did: "set a Survivor lineup", line: "Hidden until Wed 8:05 PM", reactions: [{ kind: "fire", n: 3, mine: true }, { kind: "laugh", n: 1 }] },
  { who: "jordan", line: "Traitors banishment is going to be messy. Calling it now.", where: "Traitors 5", reactions: [{ kind: "eye", n: 2 }] },
  { who: "sam", did: "joined Episode 5 Bingo" },
];
export const TYPING = "sam is typing";

// ---------- your profile (the avatar's sheet) ----------
export const PROFILE = {
  since: "since Survivor 49",
  stats: [
    ["2", "Titles"],
    ["94", "Ranking points"],
    ["71%", "Agree with the couch"],
  ] as [string, string][],
  bestShow: { name: "Survivor", art: art("survivor"), position: "64% 50%" },
  lines: [
    { icon: "star", title: "Taste twin: riley", line: "You rate episodes within half a star 8 times in 10" },
    { icon: "bolt", title: "Called it: 4 in a row", line: "Predictions right since Survivor 51 Episode 1" },
  ] as { icon: "star" | "bolt"; title: string; line: string }[],
};

// ---------- More on the couch: the six pages ----------
/** Power rankings: this year's points per show, by person. */
export const RANKINGS: { who: Demo; points: [number, number, number]; move?: "up" | "down" }[] = [
  { who: "riley", points: [41, 38, 33], move: "up" },
  { who: "alex", points: [52, 24, 18], move: "down" },
  { who: "jordan", points: [30, 26, 22] },
  { who: "sam", points: [22, 30, 12] },
];
export const RANKING_SHOWS = ["Survivor", "Traitors", "Challenge"] as const;

/** Commercial break: the games you're in, and this week's one-night games. */
export const PLAYING: { game: GameName; show: string; art: string; position: string; line: string; place?: string; due?: string }[] = [
  { game: "Weekly Lineup", show: "Survivor 51", art: art("survivor"), position: "64% 50%", line: "Your lineup is due", due: "Due Wed" },
  { game: "Outlast", show: "Survivor 51", art: art("survivor"), position: "64% 50%", line: "Last Survivor Standing", place: "1st" },
  { game: "Survival Pool", show: "Survivor 51", art: art("survivor"), position: "64% 50%", line: "Avoid Elimination · streak 3", place: "3rd" },
  { game: "Outlast", show: "Traitors 5", art: art("traitors"), position: "74% 35%", line: "The Round Table", place: "1st" },
];
export const THIS_WEEK: { title: string; line: string; art: string; position: string; icon: "bingo" | "poll" | "quiz" }[] = [
  { title: "Episode 5 bingo", line: "Opens Wed 8:05 PM", art: art("survivor"), position: "64% 50%", icon: "bingo" },
  { title: "Episode 4 bingo", line: "Opens Thu 9:00 PM", art: art("traitors"), position: "74% 35%", icon: "bingo" },
  { title: "Episode 7 bingo", line: "Opens Tue 8:00 PM", art: art("challenge"), position: "62% 30%", icon: "bingo" },
  { title: "Banishment poll", line: "Started by riley · 10 seconds", art: art("traitors"), position: "74% 35%", icon: "poll" },
  { title: "Survivor 49 trivia", line: "3 questions · riley got 2", art: art("survivor"), position: "64% 50%", icon: "quiz" },
];

/** By the numbers: a deck of stat cards, then every stat by show. */
export const STAT_DECK: ({ show: string; showArt: string; stat: string; who: string; photo: string; n: number; unit: string } | { couch: true; stat: string; who: Demo; line: string })[] = [
  { show: "Survivor 51", showArt: art("survivor"), stat: "Voted with the majority", who: "Maggie", photo: s51("Maggie Nestor"), n: 2, unit: "times" },
  { show: "Survivor 51", showArt: art("survivor"), stat: "Never written down", who: "Devin", photo: s51("Devin Way"), n: 3, unit: "tribals" },
  { couch: true, stat: "Most shows on their list", who: "riley", line: "7 shows · 3 nobody else watches" },
  { show: "Traitors 5", showArt: art("traitors"), stat: "Shields won", who: "Abby", photo: t5("Abby Lee"), n: 1, unit: "shield" },
  { show: "Survivor 51", showArt: art("survivor"), stat: "Tribe immunity wins", who: "Cristian", photo: s51("Cristian Chavez"), n: 3, unit: "wins" },
];
export const STAT_LISTS: { show: string; upTo: number; rows: { stat: string; who: string; photo: string; n: number }[] }[] = [
  {
    show: "Survivor 51",
    upTo: 4,
    rows: [
      { stat: "Voted with the majority", who: "Maggie", photo: s51("Maggie Nestor"), n: 2 },
      { stat: "Never written down", who: "Devin", photo: s51("Devin Way"), n: 3 },
      { stat: "Most votes against", who: "Jenna", photo: s51("Jenna Doore"), n: 2 },
      { stat: "Survived votes against", who: "Danny", photo: s51("Danny Kilby"), n: 1 },
      { stat: "Tribe immunity wins", who: "Cristian", photo: s51("Cristian Chavez"), n: 3 },
      { stat: "Reward wins", who: "Brady", photo: s51("Brady Booker"), n: 2 },
      { stat: "Idols found", who: "Brady", photo: s51("Brady Booker"), n: 1 },
    ],
  },
  {
    show: "Traitors 5",
    upTo: 3,
    rows: [
      { stat: "Never voted for at the Round Table", who: "Abbey", photo: t5("Abbey Benjamin"), n: 1 },
      { stat: "Shields won", who: "Abby", photo: t5("Abby Lee"), n: 1 },
      { stat: "Survived votes at the Round Table", who: "Kim", photo: t5("Kim Daily"), n: 1 },
    ],
  },
];

/** Couch verdicts: how the couch rated the latest episode you've seen of each show. */
export const VERDICTS: { show: string; episode: number; art: string; position: string; score: string; from: number; ratings: [Demo, number][]; take: { who: Demo; text: string }; byEpisode: number[] }[] = [
  { show: "Survivor 51", episode: 4, art: art("survivor"), position: "100% 50%", score: "4.0", from: 4, ratings: [["riley", 4.5], ["jordan", 3.5], ["sam", 3.5]], take: { who: "riley", text: "Kristin is SO calm, love it" }, byEpisode: [3.6, 3.4, 3.8, 4.0] },
  { show: "Traitors 5", episode: 3, art: art("traitors"), position: "74% 35%", score: "4.2", from: 4, ratings: [["riley", 4.7], ["jordan", 3.7], ["sam", 3.7]], take: { who: "riley", text: "the turret scenes are unhinged this season" }, byEpisode: [3.9, 4.1, 4.2] },
  { show: "Challenge 37", episode: 4, art: art("challenge"), position: "62% 30%", score: "3.7", from: 2, ratings: [["sam", 3.2]], take: { who: "sam", text: "this daily is chaos" }, byEpisode: [3.5, 3.8, 3.4, 3.7] },
  { show: "Below Deck Med", episode: 6, art: art("below-deck"), position: "50% 25%", score: "3.6", from: 3, ratings: [["riley", 4.1], ["sam", 3.1]], take: { who: "riley", text: "Already chaos and they haven't left the dock" }, byEpisode: [3.2, 3.9, 3.3, 3.5, 3.8, 3.6] },
];

/** Previously on: one show's story so far, up to where you are. */
export const PREVIOUSLY = {
  shows: [
    { name: "Survivor 51", art: art("survivor"), position: "64% 50%" },
    { name: "Traitors 5", art: art("traitors"), position: "74% 35%" },
    { name: "Challenge 37", art: art("challenge"), position: "62% 30%" },
  ],
  upTo: 4,
  art: art("survivor"),
  lastTime: [{ name: "Jenna", how: "Voted out", place: "17th", photo: s51("Jenna Doore") }],
  gone: [
    { name: "Aaliyah", ep: 1, photo: s51("Aaliyah Puglia") },
    { name: "Ana", ep: 2, photo: s51("Ana Sani") },
    { name: "Patt", ep: 3, photo: s51("Patt Cannaday") },
    { name: "Rob", ep: 3, photo: s51("Rob Antonson") },
    { name: "Jenna", ep: 4, photo: s51("Jenna Doore") },
  ],
  stillIn: [
    { group: "Toka", colour: "#ffd700", people: ["Brady Booker", "Maggie Nestor", "Mike Pinsky", "Thien An Nguyen", "Carter Krull", "Kristin Flickinger"] },
    { group: "Dina", colour: "#f3214a", people: ["Danny Kilby", "Lewis Kelly", "Cristian Chavez", "Eric Macksoud", "Linnea Capobianco", "Sharonda Cox"] },
    { group: "Savu", colour: "#5d2a87", people: ["Devin Way", "Jelly Loblack", "Alexis Levine", "Ori Jean-Charles"] },
  ].map((g) => ({ ...g, people: g.people.map((n) => ({ name: n.split(" ")[0], photo: s51(n) })) })),
  episodes: [
    { ep: 4, line: "Jenna voted out", faces: [s51("Jenna Doore")] },
    { ep: 3, line: "Patt voted out, Rob quit", faces: [s51("Patt Cannaday"), s51("Rob Antonson")] },
    { ep: 2, line: "Ana voted out", faces: [s51("Ana Sani")] },
    { ep: 1, line: "Aaliyah voted out", faces: [s51("Aaliyah Puglia")] },
  ],
};

/** Trophy shelf. */
export const TROPHIES = {
  titles: 2,
  seasons: 9,
  line: "Average finish 2nd. riley holds the most, with 3.",
  plaques: [
    { show: "Traitors 4", art: art("traitors"), place: "1st", line: "You won Outlast", won: true },
    { show: "Survivor 50", art: art("survivor"), place: "2nd", line: "riley won by 4", ribbon: "Ran it back" },
    { show: "Challenge 36", art: art("challenge"), place: "3rd", line: "jordan won" },
    { show: "Survivor 49", art: art("survivor"), place: "2nd", line: "riley won" },
  ],
  records: [
    { icon: "crown", title: "Most titles", line: "3", who: "riley" },
    { icon: "repeat", title: "Ran it back", line: "Survivor 49 and 50", who: "riley" },
    { icon: "shield", title: "Longest pool streak", line: "9 episodes", who: "jordan" },
    { icon: "bolt", title: "Biggest comeback", line: "8th to 1st · Traitors 4", who: "alex" },
  ] as { icon: "crown" | "repeat" | "shield" | "bolt"; title: string; line: string; who: Demo }[],
};

/** The grows-with-you hub's promise of what's to come. */
export const GROW_NOTE = [
  { icon: "cup", text: "Power rankings, after your first scored episode" },
  { icon: "poll", text: "By the numbers, once the stats come in" },
  { icon: "crown", text: "The trophy shelf, when a season ends" },
] as { icon: "cup" | "poll" | "crown"; text: string }[];
