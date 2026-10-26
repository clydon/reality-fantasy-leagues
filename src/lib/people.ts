// A person's face in the new design (docs/PLAN-new-design.md step 15 part 1): their initial on their colour, or their picture.
// Shared by the server (what a colour may be) and the screens (ui/bars.tsx Avatar). Pure.

/** The colours a face can be: DESIGN.md's chart set and two more, each light enough for the initial's dark ink. */
export const PALETTE = [
  { hex: "#35b5a5", name: "Teal" },
  { hex: "#a76bb0", name: "Orchid" },
  { hex: "#f2804b", name: "Ember" },
  { hex: "#5089c9", name: "Lake" },
  { hex: "#e0b23a", name: "Gold" },
  { hex: "#e86f9a", name: "Rose" },
  { hex: "#8db85e", name: "Sage" },
  { hex: "#cfc8bb", name: "Bone" },
] as const;

/** The first six, which a face is on until its person picks one (the colours every face had before step 15). */
const FROM_ID = PALETTE.slice(0, 6).map((c) => c.hex);

/** Whether this is one of the palette's colours. */
export function isPaletteColour(hex: unknown): hex is string {
  return typeof hex === "string" && PALETTE.some((c) => c.hex === hex);
}

/** Someone's colour: the one they chose, else the one their id picks. */
export function colourOf(id: string, chosen?: string | null): string {
  if (chosen && isPaletteColour(chosen)) return chosen;
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
