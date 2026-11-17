// A moment's band on the castaway sheet (docs/design-round/drill-person-sheet-scoring-spec.md; decisions.md, 2026-11-17): by the
// show's points for one, against its rulebook's typical moment, so every rulebook, whatever its scale, gets the same four bands.
// A setback costs points; neutral is at most half the typical moment (a tight window by design); great is at least one and a half
// times it; good is in between. The typical moment is the median of the rulebook's scoring moments' points, all of them (not only
// those that have happened, so the bands never move mid-season), and the median (not the top, so one big finale moment can't
// squash the rest). Pure, for the server (cast-stats.ts sends `typical`) and the sheet alike.

export type Band = "great" | "good" | "neutral" | "setback";

/** The bands as a key reads them, a column's top to its bottom: great on top, then good, then neutral, setbacks under the line. */
export const BANDS: Band[] = ["great", "good", "neutral", "setback"];

/** The typical moment: the median of the points that score (above zero); null when nothing does. */
export function typicalOf(points: number[]): number | null {
  const pos = points.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (!pos.length) return null;
  const m = pos.length >> 1;
  return pos.length % 2 ? pos[m] : (pos[m - 1] + pos[m]) / 2;
}

/** A moment's band from its points for one and its rulebook's typical moment (1 when there's none to go by). */
export function bandOf(points: number, typical: number | null | undefined): Band {
  const t = typical && typical > 0 ? typical : 1;
  if (points < 0) return "setback";
  if (points <= t / 2) return "neutral";
  if (points >= t * 1.5) return "great";
  return "good";
}
