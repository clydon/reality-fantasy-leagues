// A repeatable shuffle (docs/PLAN-new-design.md step 12 part 3): the same seed gives the same order on every server and every read,
// so a bingo card is dealt the same way twice and everyone on Game Your Show gets the same trivia round in a week. Not for anything
// that must be unguessable.

/** FNV-1a: a string to 32 bits. */
export function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Numbers in [0, 1) from a seed (mulberry32). */
export function randomFrom(seed: string): () => number {
  let a = hashOf(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of `list` in an order `next` decides. */
export function shuffled<T>(list: readonly T[], next: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
