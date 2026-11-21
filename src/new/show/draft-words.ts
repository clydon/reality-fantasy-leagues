import type { DraftSoon } from "@/lib/game/draft-soon";
import { airTime, calmWhen } from "../clock";

/** A draft's time, said the same way everywhere: with how far off once it's more than a day away ("Sat 10:43 AM · in 2 days"),
 *  else just the time (the calm clock ticks inside the last day, and these words don't re-render each second). */
export const draftWhen = (iso: string, now = Date.now()) => {
  const t = Date.parse(iso);
  return t - now > 86400000 ? calmWhen(t, now) : airTime(t);
};

// What a draft that hasn't started says, in the same words on the strip, the hub's plate, the game's own move and the draft room
// (docs/design-round/draft-start-spec.md; PFD's R3: one fact, one set of words). `runs`: you're the game's Commissioner, whose
// Start it is. A draft that's yours to start now is a move (action-items.js runnerItems): due, never these quiet words, except where
// a surface has no moves to read (the game's own move reads the draft room's `startDue`).

export function draftSoonWords(soon: DraftSoon, runs: boolean, when: (iso: string) => string, ep = "Ep"): { title: string; line: string; due: boolean; backstage: boolean } {
  // A time after the game's first episode airs: nobody would have a team for it, so it's the runner's to move (round 5's check).
  if (soon.late && runs) return { title: `Move the draft before ${ep} ${soon.late}`, line: `It's set for ${when(soon.at!)}, after it airs`, due: true, backstage: false };
  if (soon.at) return { title: `The draft starts ${when(soon.at)}`, line: runs ? "It starts by itself" : "You pick your team then", due: false, backstage: false };
  if (soon.waits) return { title: soon.waits, line: "Nothing to do till then", due: false, backstage: false };
  if (runs && soon.needs) return { title: soon.needs === "players" ? "The draft needs one more person" : "The draft needs its cast", line: soon.needs === "players" ? "Invite someone to the couch" : "It comes in when the show announces it", due: false, backstage: true };
  if (runs) return { title: "Start the draft", line: "Nobody can pick until you do", due: soon.startDue, backstage: false };
  return { title: `Waiting for ${soon.runBy ?? "whoever runs the game"} to start the draft`, line: "You pick your team when it starts", due: false, backstage: false };
}

/** The draft room a game's draft is in. */
export const draftRoomPage = (kind: string | null | undefined) => (kind === "blind" ? "blind" : "draft");
