// How a person's cast properties and bio read, the same on the desk and in the app (docs/PLAN-cast-properties.md): pure, so a
// page and the server say them alike.
import type { CastBio } from "@/lib/game/formats/cast-prompt";

/** A property as a page knows it (server/cast-props.ts propertyViews). */
export interface PropertyWords {
  key: string;
  name: string;
  main?: boolean;
}

/** "Interior · Chief stew": a person's values in the season's order of its properties, any others after. */
export function propsLine(p: Record<string, string> | null | undefined, props: PropertyWords[] = []): string {
  const v = p ?? {};
  const known = props.map((x) => v[x.key]).filter(Boolean);
  const rest = Object.entries(v)
    .filter(([k]) => !props.some((x) => x.key === k))
    .map(([, x]) => x);
  return [...known, ...rest].join(" · ");
}

/** The value shown under a name: the main property's, else the first one stated; null with none. */
export function mainValue(p: Record<string, string> | null | undefined, props: PropertyWords[] = []): string | null {
  const v = p ?? {};
  const main = props.find((x) => x.main) ?? props[0];
  return (main && v[main.key]) || props.map((x) => v[x.key]).find(Boolean) || null;
}

/** "Ocean City, NJ · 25 · Nurse": a bio's head line (where they're from, their age as billed, what they do); "" with none. */
export function bioLine(b: CastBio | null | undefined): string {
  if (!b) return "";
  return [b.hometown || b.residence, b.age != null ? String(b.age) : null, b.occupation].filter(Boolean).join(" · ");
}
