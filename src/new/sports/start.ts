"use client";

import { useState } from "react";
import { sportsApi, useAfterReveal, useHome, useCurrentCouch, wizardApi } from "../data";
import { useNav } from "../nav";
import { paths } from "../routes";
import { toast } from "../ui/toast";

// Starting a sport's game (docs/PLAN-start-a-game-gpt.md U1's sports slice; src/lib/server/sports/start.ts), as the wizard's Start
// it does (start-wizard.tsx): the couch hears after a 10-second Undo, said in the toast; then the game's own page. Play the next game
// is this with Pick'em on one game.

export type SportStartAsk = Omit<Parameters<typeof sportsApi.start>[1], "tell"> & { tell?: boolean };

export function useStartSport() {
  const { data: home } = useHome();
  const couch = useCurrentCouch(home);
  const refresh = useAfterReveal();
  const nav = useNav();
  const [busy, setBusy] = useState(false);
  const start = async (ask: SportStartAsk, after?: () => void) => {
    if (!couch) return toast.quiet("Start or join a couch first: a game is played on one");
    setBusy(true);
    try {
      const r = await sportsApi.start(couch.id, { tell: true, ...ask });
      await refresh();
      after?.();
      toast(`${r.name} on ${r.season} started${r.told ? " · the couch hears in 10 seconds" : ""}`, {
        ms: r.holdMs,
        undo: () => {
          wizardApi.undo(r.seasonId, couch.id, r.leagueId).then(
            async () => {
              await refresh();
              toast(`Not started${r.told ? ": nobody was told" : ""}`);
            },
            (e: Error) => toast.quiet(e.message)
          );
        },
      });
      nav.push(paths.gamePage(r.seasonId, r.leagueId));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { start, busy, couch };
}
