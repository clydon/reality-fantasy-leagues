// The Preview registry (docs/PLAN-new-design.md, "The Preview system"): every piece of the new design that isn't on
// real data yet, with the step that makes it real. A screen wraps such a piece in <Preview id="...">
// (src/new/ui/preview.tsx), which draws a dashed outline and a "Preview" tag and turns its taps into a "Coming
// soon" toast. Each step deletes its entries (and its fixtures in src/new/fixtures/) as it lands; at step C this
// file is empty and goes, with the component and the fixtures folder.
//
// `node scripts/dev-test/check-preview.js` lists what's still previewed per step, and fails when a step marked
// done in the plan's Status still has entries here, or an entry is never used (or a <Preview> names one that
// isn't here).
//
// step:  the plan's step that replaces it: the step that builds that screen, or makes that part real.
// title: what it is, in the words a player would use ("The TV guide"); the toast says "Coming soon: <title>".
// line:  what will be there, for the empty placeholder.

export interface PreviewEntry {
  step: string;
  title: string;
  line: string;
}

export const PREVIEWS = {
  // ---- the hub (ported in 0d; fixtures in src/new/fixtures/; its status line, Up next, your shows, the feed, your
  // numbers and More on the couch's pages are real since step 8; the couch switcher, Get the couch going and the foot since
  // step 9; Add a show, the "you both watch" nudge and The couch is watching since step 10; Start a game since 10 part 2b; the
  // TV guide on the couch's shows since step 11 part 1, all of TV in it since part 2; Couch verdicts and the taste twin since step
  // 12 part 1; Call it and the couch's polls in Commercial break's This week only since part 2, its bingo and trivia since part 3;
  // Watch along from Up next, Previously on and the solo hub since step 13 part 1, On now since part 2; Streaming on the couch since
  // step 14 part 1; the bell since step 15 part 2) and a show space (all real since step 15 part 2: its ⋯ menu's Notifications)
  // have nothing left here; nor Settings (real since step 15 part 1: your profile, spoilers, your AI, couches, help, your account;
  // What we notify you about since part 2; What your couch sees since part 3; Appearance since part 4).
  //
  // Empty since step 15 part 4: everything in the new design is on real data. The registry, <Preview> and the fixtures folder
  // stay until step C deletes them (the plan's "The Preview system"), so a later step that ports something before its data is
  // real can still mark it.
} satisfies Record<string, PreviewEntry>;

export type PreviewId = keyof typeof PREVIEWS;
