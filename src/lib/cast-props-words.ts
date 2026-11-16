// How a person's cast properties and bio read, the same on the desk and in the app (docs/PLAN-cast-properties.md): pure, so a
// page and the server say them alike.
import type { CastBio } from "@/lib/game/formats/cast-prompt";

/** A property as a page knows it (server/cast-props.ts propertyViews). */
export interface PropertyWords {
  key: string;
  name: string;
  main?: boolean;
}

/** "Interior · Chief stew · Woman": a person's values in the season's order of its properties (only its properties: never a
 *  note kept beside them, like where a gender came from). */
export function propsLine(p: Record<string, string> | null | undefined, props: PropertyWords[] = []): string {
  const v = p ?? {};
  return props
    .map((x) => v[x.key])
    .filter(Boolean)
    .join(" · ");
}

/** Whether a person's gender was the research's inference, not the show's billing or the desk's (the desk says "guessed"). */
export const genderGuessed = (p: Record<string, string> | null | undefined) => !!p?.gender && p.genderFrom === "inferred";

/** The value shown under a name: the main property's, else the first one stated; null with none. */
export function mainValue(p: Record<string, string> | null | undefined, props: PropertyWords[] = []): string | null {
  const v = p ?? {};
  const main = props.find((x) => x.main) ?? props.find((x) => x.key !== "gender");
  return (main && v[main.key]) || props.filter((x) => x.key !== "gender").map((x) => v[x.key]).find(Boolean) || null;
}

/** "Ocean City, NJ · 25 · Nurse": a bio's head line (where they're from, their age as billed, what they do); "" with none. */
export function bioLine(b: CastBio | null | undefined): string {
  if (!b) return "";
  return [b.hometown || b.residence, b.age != null ? String(b.age) : null, b.occupation].filter(Boolean).join(" · ");
}
