// A game over a span (docs/PLAN-sports-data.md step 6): a game that plays from the next episode to air through a chosen one
// (settings.endEpisode; StateLogic.endEpisode, inPlay, spanView, gameOver), instead of to the season's end. The choices are
// read from the season itself, for any show: the rest of the season (as before), just the next one, any later episode the
// listing has, and, for a sport whose episodes are linked to the provider's games (season_events), "this series": the run of
// consecutive games between the same teams. Nothing here knows a sport. A span that starts later (post-merge, the playoffs)
// is a game started when it's next.

/** One of the season's episodes, as the choices read it. `teams`: its linked game's teams' ids and names, when it has one. */
export interface SpanEpisode {
  number: number;
  title: string | null;
  teams: { id: string; name: string }[] | null;
}

export interface SpanChoice {
  /** The last episode it plays, or null: to the season's end. */
  to: number | null;
  kind: "rest" | "one" | "series";
  /** "The rest of the season", "Just Game 4", "This series". */
  label: string;
  /** What it covers: "Game 4 to the season's end", "Games 4–6 · Tampa Bay Rays and Milwaukee Brewers". */
  line: string;
}

/** What one part of the season is called ("game", "race", "episode"). */
export interface PartWord {
  singular: string;
  plural: string;
}

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const sameTeams = (a: SpanEpisode["teams"], b: SpanEpisode["teams"]) =>
  !!a && !!b && a.length >= 2 && a.map((t) => t.id).sort().join("|") === b.map((t) => t.id).sort().join("|");

/** "Game 4", "Games 4–6"; with no end, "Game 4 on". */
export function spanName(from: number, to: number | null, part: PartWord): string {
  if (to === null) return `${cap(part.singular)} ${from} on`;
  return to === from ? `${cap(part.singular)} ${from}` : `${cap(part.plural)} ${from}–${to}`;
}

/** The last of the consecutive episodes from `from` whose linked games are between the same teams, or null (no run of two). */
export function seriesEnd(eps: SpanEpisode[], from: number): number | null {
  const at = new Map(eps.map((e) => [e.number, e]));
  const first = at.get(from);
  if (!first?.teams) return null;
  let k = from;
  while (sameTeams(at.get(k + 1)?.teams ?? null, first.teams)) k++;
  return k > from ? k : null;
}

/** "Tampa Bay Rays and Milwaukee Brewers". */
const teamsOf = (e: SpanEpisode | undefined) => (e?.teams ?? []).map((t) => t.name).join(" and ");

/**
 * The spans a game starting at `from` can run: the rest of the season first (the default), just `from` when the listing has
 * it, and this series when its linked games say there is one. Any later listed episode can be the end too (`ends`).
 */
export function spanChoices(eps: SpanEpisode[], from: number, part: PartWord): SpanChoice[] {
  const first = eps.find((e) => e.number === from);
  const out: SpanChoice[] = [{ to: null, kind: "rest", label: "The rest of the season", line: `${cap(part.singular)} ${from} to the season's end` }];
  if (!first) return out;
  const title = first.title && first.title.trim().toLowerCase() !== `${part.singular} ${from}` ? first.title.trim() : null;
  out.push({ to: from, kind: "one", label: `Just ${cap(part.singular)} ${from}`, line: title ?? `One ${part.singular}` });
  const end = seriesEnd(eps, from);
  if (end !== null) out.push({ to: end, kind: "series", label: "This series", line: `${spanName(from, end, part)} · ${teamsOf(first)}` });
  return out;
}

/**
 * Run it back on a span that's over (`last`): the next one, starting at `from` (the next episode to air). When it was a series
 * (its linked games all between the same teams), the next series; else (or when the next series isn't listed yet) the same
 * number of episodes again, as far as the listing goes. Its last episode, or null when the listing has nothing from `from`.
 */
export function nextSpan(eps: SpanEpisode[], from: number, last: { from: number; to: number }): number | null {
  const listed = eps.filter((e) => e.number >= from).map((e) => e.number);
  if (!listed.includes(from)) return null;
  const wasSeries = last.to > last.from && (seriesEnd(eps, last.from) ?? 0) >= last.to;
  const series = wasSeries ? seriesEnd(eps, from) : null;
  if (series !== null) return series;
  return Math.min(from + (last.to - last.from), Math.max(...listed));
}

/** The later episodes a span can end with: every listed one after `from`, in order. */
export function spanEnds(eps: SpanEpisode[], from: number): { number: number; title: string | null }[] {
  return eps.filter((e) => e.number > from).sort((a, b) => a.number - b.number).map((e) => ({ number: e.number, title: e.title }));
}
