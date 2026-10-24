// The couch's chat about Survivor 51, from the mock (show.js tabChat). Step 4 makes it the real chat for a couch and
// show, folded past where each reader is.
import type { Demo } from "./people";

export const STEP = "4";

export type ChatLine = { day: string } | { who: Demo; text: string } | { system: string };

export const CHAT: ChatLine[] = [
  { day: "Yesterday" },
  { who: "riley", text: "Carter is running this camp already" },
  { who: "jordan", text: "tribal is going to be chaos" },
  { who: "alex", text: "Kristin found an idol clue??" },
  { day: "Today" },
  { who: "sam", text: "who are we starting this week" },
  { who: "riley", text: "Carter, Mike, Danny. Not telling you why." },
  { system: "riley revealed Episode 4" },
];

/** Whose chat this is in the fixture: the mock's you. */
export const ME: Demo = "alex";
