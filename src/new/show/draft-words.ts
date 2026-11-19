import type { DraftSoon } from "@/lib/game/draft-soon";

// What a draft that hasn't started says, in the same words on the strip, the hub's plate, the game's own move and the draft room
// (docs/design-round/draft-start-spec.md; PFD's R3: one fact, one set of words). `runs`: you're the game's Commissioner, whose
// Start it is. A draft that's yours to start now is a move (action-items.js runnerItems): due, never these quiet words, except where
// a surface has no moves to read (the game's own move reads the draft room's `startDue`).

export function draftSoonWords(soon: DraftSoon, runs: boolean, when: (iso: string) => string): { title: string; line: string; due: boolean } {
  if (soon.at) return { title: `The draft starts ${when(soon.at)}`, line: runs ? "It starts by itself" : "You pick your team then", due: false };
  if (soon.waits) return { title: soon.waits, line: "Nothing to do till then", due: false };
  if (runs) return soon.startDue ? { title: "Start the draft", line: "Nobody can pick until you do", due: true } : { title: "The draft can't start yet", line: "Backstage says what it needs", due: false };
  return { title: `Waiting for ${soon.runBy ?? "whoever runs the game"} to start the draft`, line: "You pick your team when it starts", due: false };
}

/** The draft room a game's draft is in. */
export const draftRoomPage = (kind: string | null | undefined) => (kind === "blind" ? "blind" : "draft");
