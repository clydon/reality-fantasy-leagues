import { useTourStore } from "./tour-store";

// The commissioner's tour never makes anyone search anything: where a real commissioner would paste an
// AI chat's answer, the tour's Paste button fills in one of these (components/paste-bar.tsx). They are
// what a chat plausibly writes back for Survivor 51, shaped exactly like the real answers so the real
// readers (cast-prompt.js, the review screens) take them. The episode results are made up: the tour
// says so, and nothing in them reaches a real league.

/** Survivor 51's starting cast, as a chat would list it (the roster in the dev database). */
const CAST: [name: string, tribe: string, photo: string][] = [
  ["Aaliyah Puglia", "Toka", "aaliyah"],
  ["Brady Booker", "Toka", "brady"],
  ["Danny Kilby", "Toka", "kilby"],
  ["Devin Way", "Toka", "devin"],
  ["Jelly Loblack", "Toka", "jelly"],
  ["Jenna Doore", "Toka", "jenna"],
  ["Lewis Kelly", "Toka", "lewis"],
  ["Maggie Nestor", "Toka", "maggie"],
  ["Mike Pinsky", "Toka", "mike"],
  ["Patt Cannaday", "Toka", "patt"],
  ["Thien An Nguyen", "Toka", "thien_an"],
  ["Alexis Levine", "Savu", "alexis"],
  ["Ana Sani", "Savu", "ana"],
  ["Carter Krull", "Savu", "carter"],
  ["Cristian Chavez", "Savu", "cristian"],
  ["Eric Macksoud", "Savu", "eric"],
  ["Kristin Flickinger", "Savu", "kristin"],
  ["Linnea Capobianco", "Savu", "linnea"],
  ["Ori Jean-Charles", "Savu", "ori"],
  ["Rob Antonson", "Savu", "rob"],
  ["Sharonda Cox", "Savu", "sharonda"],
];

export const TOUR_CAST_NAMES = CAST.map(([name]) => name);

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** The chat's answer to "Import a cast", with the chatter and code fence chats really add. */
export function castAnswer(): string {
  const json = {
    castaways: CAST.map(([name, startingGroup, photo]) => ({ name, photoUrl: `${origin()}/photos/s51/${photo}.jpg`, startingGroup })),
    sources: ["https://survivor.fandom.com/wiki/Survivor_51", "https://www.cbs.com/shows/survivor/cast/"],
  };
  return `Here is the starting cast of Survivor 51:\n\n\`\`\`json\n${JSON.stringify(json, null, 1)}\n\`\`\``;
}

/** The chat's answer to an episode's results question: a few people, as the checklist asks. */
export function resultsAnswer(n = 1): string {
  const row = (name: string, o: Record<string, unknown>) => ({
    name,
    wonTribeImmunity: "no",
    leftTheGame: "no",
    foundAdvantage: "no",
    votesReceived: 0,
    confidence: "high",
    ...o,
    sources: ["https://survivor.fandom.com/wiki/Episode_1"],
  });
  const people =
    n === 1
      ? [
          row("Mike Pinsky", { leftTheGame: "yes", exitMethod: "Voted Out", votesReceived: 6 }),
          row("Ana Sani", { wonTribeImmunity: "yes" }),
          row("Rob Antonson", { wonTribeImmunity: "yes" }),
          row("Kristin Flickinger", { wonTribeImmunity: "yes" }),
          row("Jelly Loblack", { votesReceived: 2 }),
          row("Jenna Doore", { foundAdvantage: "yes", confidence: "low" }),
        ]
      : [
          row("Eric Macksoud", { leftTheGame: "yes", exitMethod: "Voted Out", votesReceived: 5 }),
          row("Brady Booker", { wonTribeImmunity: "yes" }),
          row("Maggie Nestor", { wonTribeImmunity: "yes" }),
          row("Patt Cannaday", { wonTribeImmunity: "yes" }),
          row("Cristian Chavez", { foundAdvantage: "yes" }),
        ];
  const json = { episode: n, castaways: people };
  return `Practice answer for Survivor 51, episode ${n} (made up for the tour):\n\n\`\`\`json\n${JSON.stringify(json, null, 1)}\n\`\`\``;
}

/** The chat's answer to "Research a new show": a short sketch of the rules it found. */
export function formatAnswer(): string {
  const json = {
    name: "Survivor",
    castawayTerm: "Castaway",
    groupTerm: "Tribe",
    events: [
      { id: "individualImmunity", label: "Individual immunity win", points: 3 },
      { id: "tribeImmunity", label: "Tribe immunity win", points: 1 },
      { id: "idolFound", label: "Idol or advantage found", points: 2 },
      { id: "votedOut", label: "Voted out", points: -3 },
    ],
    sources: ["https://survivor.fandom.com/wiki/Survivor"],
  };
  return `Here are the rules I found for Survivor:\n\n\`\`\`json\n${JSON.stringify(json, null, 1)}\n\`\`\``;
}

export type SampleKey = "cast" | "results" | "format";
const SAMPLES: Record<SampleKey, (n?: number) => string> = { cast: castAnswer, results: resultsAnswer, format: formatAnswer };

/** The tour's ready-made answer for a paste box, or undefined outside the commissioner's tour. */
export function useTourSample(key: SampleKey): ((n?: number) => string) | undefined {
  const running = useTourStore((s) => s.step !== null && s.kind === "commissioner");
  return running ? SAMPLES[key] : undefined;
}
