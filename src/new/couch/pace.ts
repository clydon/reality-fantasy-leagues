// A game at your own pace (docs/PLAN-own-pace-games.md), the words: where the others in it are, whether everyone's on your
// episode, and the reveal button's gap. Nothing locks: the words are the guardrail, read at the moment of tapping. Pure;
// tests/own-pace.test.js.

/** Someone else in the game: the episode they're on (their week), or null once they've finished it. */
export type PaceOther = { name: string; week: number | null };

/** "casey · Ep 4 · riley · Ep 2 · sam finished": furthest along first, finished last; null with nobody else in it. */
export function othersLine(week: number, others: PaceOther[], word = "Ep"): string | null {
  if (!others.length) return null;
  const going = others.filter((o) => o.week !== null).sort((a, b) => (b.week as number) - (a.week as number) || a.name.localeCompare(b.name));
  const done = others.filter((o) => o.week === null).sort((a, b) => a.name.localeCompare(b.name));
  return [...going.map((o) => `${o.name} · ${word} ${o.week}`), ...done.map((o) => `${o.name} finished`)].join(" · ");
}

/** Everyone else still playing is on your episode (and there is someone). */
export function allHere(week: number, others: PaceOther[]): boolean {
  const going = others.filter((o) => o.week !== null);
  return going.length > 0 && going.every((o) => o.week === week);
}

/**
 * Revealing `week` puts your mark there; someone on episode w has their mark at w-1. More than one ahead of anyone says so:
 * "you'll be 2 ahead of riley", the furthest behind deciding the number, those at the same gap named together. One ahead, or
 * nobody behind, says nothing.
 */
export function aheadWords(week: number, others: PaceOther[]): string | null {
  const gaps = others.filter((o) => o.week !== null).map((o) => ({ name: o.name, gap: week - ((o.week as number) - 1) }));
  const most = Math.max(0, ...gaps.map((g) => g.gap));
  if (most < 2) return null;
  const names = gaps.filter((g) => g.gap === most).map((g) => g.name);
  const who = names.length <= 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `you'll be ${most} ahead of ${who}`;
}
