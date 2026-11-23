"use client";

import { Gamepad2 } from "lucide-react";

/** A game's going on this show or league (the user, 2026-11-15: "a game controller in the corner of the show's block"; the guide's
 *  card says it the same way): a white controller, with a yellow dot on it when a move of yours is due there. Its own file so the
 *  league's band (league-cards.tsx) shares it with the show's band without importing sections.tsx, which imports it. */
export function GamesMark({ due, className = "" }: { due: boolean; className?: string }) {
  return (
    <span
      data-games-mark={due ? "due" : "on"}
      role="img"
      aria-label={due ? "You play a game on it, and a move is due" : "You play a game on it"}
      className={`grid size-[26px] place-items-center text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,.85))] ${className}`}
    >
      <Gamepad2 className="size-[22px]" strokeWidth={2.2} aria-hidden />
      {due && <i className="absolute -right-0.5 top-0 size-2.5 rounded-full bg-chyron-line shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]" />}
    </span>
  );
}
