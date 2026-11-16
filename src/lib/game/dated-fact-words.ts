// How cast properties' dated facts read wherever a fact is named (docs/PLAN-cast-properties.md chunks 6 and 6b): the desk's
// episode page, a league's result plates and season-decisions' labels. Pure.

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const words = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]+/g, " ").toLowerCase();

/** A property change: "Job: Bosun". */
export function propLabel(key: string, value: string): string {
  return `${cap(words(key))}: ${value}`;
}

const HOW: Record<string, string> = {
  found: "Found",
  won: "Won",
  given: "Was given",
  bought: "Bought",
  played: "Played",
  gave: "Gave away",
  expired: "Had expire",
  lost: "Lost",
  stolen: "Had stolen",
};

/** The parts of a holding's event_type, "<twist>:<how>:<name slug>". */
export function holdingParts(eventType: string): { twist: string; how: string; name: string } {
  const [twist = "", how = "", slug = ""] = String(eventType).split(":");
  return { twist, how, name: slug.replace(/-/g, " ") };
}

/** A holding: "Found a hidden immunity idol", "Gave away a block a vote to Eric", "Played a shot in the dark on Eric". */
export function holdingLabel(eventType: string, other: string): string {
  const { how, name } = holdingParts(eventType);
  const head = HOW[how] ?? cap(how);
  const thing = name ? (/^(a|an|the)\s/i.test(name) ? name : `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`) : "something";
  const to = other ? (how === "gave" ? ` to ${other}` : how === "given" || how === "stolen" ? ` by ${other}` : how === "played" ? ` on ${other}` : ` (${other})`) : "";
  return `${head} ${thing}${to}`;
}

/** "<twist>:<how>:<slug>" from its parts (the slug lower-case, words joined by -). */
export function holdingType(twist: string, how: string, name: string): string {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${twist}:${how}:${slug}`;
}
