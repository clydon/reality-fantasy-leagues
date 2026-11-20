import crypto from "node:crypto";
import { HttpError } from "./http-error";

// A live preview's season, the pure parts (preview-definition.ts reads the rest from the database): its calendar and the made-up
// season's seed (docs/PLAN-preview-release.md, step 1 and decision 6).

const WEEK = 7 * 24 * 3600_000;

/** The season's calendar to its last episode: the listed air times, any missing ones a week on from the one before. */
export function calendar(listed: { number: number; airAt: string | null }[], last: number, next: { number: number; airs: string } | null): { number: number; airAt: string }[] {
  const at = new Map(listed.filter((e) => e.airAt).map((e) => [e.number, Date.parse(e.airAt as string)]));
  if (next?.airs && !at.has(next.number)) at.set(next.number, Date.parse(next.airs));
  if (!at.size) throw new HttpError(422, "No preview for this season: none of its episodes has an air time");
  const known = [...at.keys()].sort((a, b) => a - b);
  const out: { number: number; airAt: string }[] = [];
  for (let n = 1; n <= last; n++) {
    let t = at.get(n);
    if (t === undefined) {
      const before = known.filter((k) => k < n).at(-1), after = known.find((k) => k > n);
      t = before !== undefined ? (at.get(before) as number) + (n - before) * WEEK : (at.get(after as number) as number) - ((after as number) - n) * WEEK;
    }
    out.push({ number: n, airAt: new Date(t).toISOString() });
  }
  return out;
}

/** The made-up season's seed: the person, the season and the mark (never the game), so a change previewed again plays the same one. */
export function seedOf(userId: string, seasonId: string, mark: number): number {
  return parseInt(crypto.createHash("sha256").update(`preview.${userId}.${seasonId}.${mark}`).digest("hex").slice(0, 8), 16);
}
