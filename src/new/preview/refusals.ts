// Why a preview didn't open, in one grammar (docs/design-round/preview-flow-spec.md §4, first-view R3): a headline in the person's
// terms, one line saying what to do or when it changes, and whether a minute could change it (Try again) or not (Back). "This one
// wasn't counted." closes the line wherever a use was taken and given back (the server gives it back on every refusal after taking
// it). Never an error code or the server's own reason. The gallery's Try it (the wizard lane, step 15) reads the same table.

export type Why = "none-left" | "busy" | "full" | "down" | "off" | "couch" | "season" | "game" | "signin" | "failed" | "ended" | "used";

export interface Refusal {
  why: Why;
  title: string;
  line: string;
  /** A minute could change it: Try again leads. */
  retry: boolean;
  /** Nothing to come back to on this host (the story's own): the way on is the app. */
  gone: boolean;
}

const NOT_COUNTED = "This one wasn't counted.";

const TABLE: Record<Why, Omit<Refusal, "why">> = {
  "none-left": { title: "No previews left this week", line: "More on Monday. You can still make the game.", retry: false, gone: false },
  busy: { title: "Lots of previews right now", line: `Try again in a minute. ${NOT_COUNTED}`, retry: true, gone: false },
  full: { title: "Previews are full this month", line: `Back on the 1st. ${NOT_COUNTED}`, retry: false, gone: false },
  down: { title: "Previews aren't answering", line: `Try again in a minute. ${NOT_COUNTED}`, retry: true, gone: false },
  off: { title: "Previews are off for now", line: "You can still make the game.", retry: false, gone: false },
  couch: { title: "No couch to play it on", line: "A preview plays the season your couch watches. Start one, or join one with its code.", retry: false, gone: false },
  season: { title: "No preview for this season", line: `Its cast or episodes aren't set up for one yet. You can still make the game. ${NOT_COUNTED}`, retry: false, gone: false },
  game: { title: "No preview for this game yet", line: `Everything else about it works, so you can still make it. ${NOT_COUNTED}`, retry: false, gone: false },
  signin: { title: "Sign in to preview", line: "A preview is made for you.", retry: false, gone: false },
  failed: { title: "The preview didn't come together", line: NOT_COUNTED, retry: true, gone: false },
  ended: { title: "This preview has ended", line: "Make another from the game. If you kept it, opening it again is free.", retry: false, gone: true },
  used: { title: "This link has been used", line: "A preview opens only for whoever made it, from the game.", retry: false, gone: true },
};

export const refusal = (why: Why): Refusal => ({ why, ...TABLE[why] });

/** The refusal an answer means: its status and the server's message (read for its kind, never shown). A fetch that never answered
 *  is `down`. */
export function refusalOf(status: number | null, message = ""): Refusal {
  const m = message.toLowerCase();
  if (status === null) return refusal("down");
  if (status === 401) return refusal("signin");
  if (status === 429) return refusal("none-left");
  if (status === 403) return refusal(/aren't open|off/.test(m) ? "off" : "ended");
  if (status === 422) return refusal(/couch/.test(m) ? "couch" : /season|sport/.test(m) ? "season" : "game");
  if (status === 503) return refusal(/full this month/.test(m) ? "full" : /busy/.test(m) ? "busy" : "down");
  return refusal("failed");
}
