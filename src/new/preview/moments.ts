// The moments a game's preview can have (docs/design-round/preview-story-spec.md, "Round 4"), named once for the story
// (story.tsx), the sheet (sheet.tsx) and their server pages. Plain module: no client code.
export type MomentKind = "game" | "draft" | "week" | "after" | "stage" | "out" | "finale";
export const MOMENT_NAMES: Record<MomentKind, string> = { game: "The game", draft: "The draft", week: "Each episode", after: "After the first results", stage: "The next stage", out: "Out", finale: "The finale" };
