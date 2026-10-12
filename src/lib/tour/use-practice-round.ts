"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { useTourStore } from "./tour-store";
import { buildPracticeState, practiceBotNames, practiceTypeOf, realEarlyExits } from "./practice";
import { practiceSteps } from "./practice-steps";

/**
 * The practice round for the league that's open (docs/PLAN-practice-round.md): whether it has one (a
 * live league whose game type has a script, with a cast to draft), and how to start it. `returnTo` is
 * where its end card goes back to; the page you're on unless said otherwise.
 */
export function usePracticeRound() {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useLeagueStore((s) => s.mode);
  const raw = useLeagueStore((s) => s.rawState);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const myName = useLeagueStore((s) => s.rawState.players.find((p) => p.id === s.membership?.playerId)?.name ?? "You");
  const terms = useShowTerms();
  const type = useMemo(() => (mode === "live" ? practiceTypeOf(raw) : null), [mode, raw]);

  function start(returnTo: string = pathname) {
    if (!type) return;
    const bots = practiceBotNames(raw);
    const state = buildPracticeState(raw, bots, myName);
    const league = leagueName ?? "your league";
    const steps = practiceSteps({
      league,
      type,
      terms,
      bots,
      shared: state.settings.ownershipMode === "shared",
      size: StateLogic.rosterSize(state),
      activeSlots: state.settings.activeSlots,
      benchSlots: state.settings.benchSlots,
      bets: type === "classic-draft" && !!state.settings.bonusEnabled,
    });
    useTourStore.getState().startPractice({ leagueName: league, returnTo, steps, avoid: realEarlyExits(raw) }, state);
    router.push("/");
  }

  return { available: !!type, start };
}
