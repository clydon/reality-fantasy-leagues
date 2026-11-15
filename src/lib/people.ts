// A person's face in the new design (docs/PLAN-new-design.md step 15 part 1): their initial on their colour, or their picture.
// Shared by the server (what a colour may be) and the screens (ui/bars.tsx Avatar). Pure.

/**
 * The colours a face can be, each light enough for the initial's dark ink. Gold and teal left on 2026-11-15 (the user,
 * docs/design-round/decisions.md): gold only ever means "due for you" and teal a win, so no face wears either.
 */
export const PALETTE = [
  { hex: "#a76bb0", name: "Orchid" },
  { hex: "#f2804b", name: "Ember" },
  { hex: "#5089c9", name: "Lake" },
  { hex: "#e86f9a", name: "Rose" },
  { hex: "#8db85e", name: "Sage" },
  { hex: "#cfc8bb", name: "Bone" },
] as const;

/** A retired colour someone chose, and the nearest hue left that their face wears instead (teal to Lake, gold to Ember). */
const RETIRED: Record<string, string> = { "#35b5a5": "#5089c9", "#e0b23a": "#f2804b" };

/**
 * The colours a face is on until its person picks one, by their id: the six every face had before step 15, in the same slots
 * so nobody else's face moves, with teal's slot now Sage and gold's Ember. (Teal's nearest hue is Lake, but Lake already has a
 * slot: Sage keeps five colours among faces nobody chose, where Lake twice would make more of a couch share one.)
 */
const FROM_ID = ["#8db85e", "#a76bb0", "#f2804b", "#5089c9", "#f2804b", "#e86f9a"];

/** Whether this is one of the palette's colours (what someone may choose now). */
export function isPaletteColour(hex: unknown): hex is string {
  return typeof hex === "string" && PALETTE.some((c) => c.hex === hex);
}

/** A stored choice as the palette has it today: itself, a retired colour's nearest hue, else null (off the palette). */
export function paletteColour(hex: unknown): string | null {
  if (isPaletteColour(hex)) return hex;
  return typeof hex === "string" && hex in RETIRED ? RETIRED[hex] : null;
}

/** Someone's colour: the one they chose, else the one their id picks. */
export function colourOf(id: string, chosen?: string | null): string {
  const picked = paletteColour(chosen);
  if (picked) return picked;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FROM_ID[h % FROM_ID.length];
}

/** Where a picture is read from: its version (when it was saved, in ms) keeps a browser's copy right for good. */
export const pictureUrl = (userId: string, version: number) => `/api/people/${encodeURIComponent(userId)}/picture?v=${version}`;

/** A face as the screens draw it: their name, chosen colour (null: from their id) and picture version (null: none). */
export interface Face {
  userId: string;
  name: string;
  colour: string | null;
  picture: number | null;
}
