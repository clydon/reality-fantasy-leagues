// The moments a game's preview can have (docs/design-round/preview-story-spec.md, "Round 4"), named once for the story
// (story.tsx), the sheet (sheet.tsx) and their server pages. Plain module: no client code.
export type MomentKind = "game" | "draft" | "week" | "after" | "stage" | "out" | "finale";
export const MOMENT_NAMES: Record<MomentKind, string> = { game: "The game", draft: "The draft", week: "Each episode", after: "After the first results", stage: "The next stage", out: "Out", finale: "The finale" };

// Each moment's screens in the order the app takes you through them (docs/design-round/preview-story-spec.md, "Round 5"): where you
// meet it (a show tab), what a tap there opens, what it leads to. A screen with an app bug keeps its place: a sweeper sees it where a
// player would meet it.
export const PATH: Record<MomentKind, string[]> = {
  game: ["games", "rules"],
  draft: ["tonight", "room", "teams"],
  week: ["tonight", "move"],
  after: ["tonight", "page", "team"],
  stage: ["tonight", "room", "teams"],
  out: ["tonight", "page"],
  finale: ["tonight", "reveal", "page"],
};
/** A moment's screens in the app's path (any the path doesn't name last, in the order they were taken). */
export function inPath<T extends { id: string }>(kind: MomentKind, screens: T[]): T[] {
  const at = (s: T) => {
    const i = PATH[kind].indexOf(s.id);
    return i < 0 ? 99 : i;
  };
  return [...screens].sort((a, b) => at(a) - at(b));
}
/** The sheet's steps, in words: which part of every moment's path its phones show. */
export const STEPS = ["Where you meet it", "What it opens", "What it leads to"] as const;
