"use client";

import { useState } from "react";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { ApiError } from "@/lib/api";
import { seasonCastApi, type SeasonCastMode } from "@/lib/season-cast-api";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm-store";

// What League Settings' cast controls mean on a league with a season (docs/PLAN-universal-season-cast.md):
// the cast here is the SEASON's, shared by every league on it. Says which of the situations this is,
// and gives the creating commissioner the two season-level controls -- the starting-tribes question and
// "Finish cast". Renders nothing for a league whose cast is its own.
export function SeasonCastNotice({ state, cast, onChanged }: { state: LeagueState; cast: SeasonCastMode; onChanged: () => void }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const terms = useShowTerms();
  const [busy, setBusy] = useState(false);
  const hasGroups = StateLogic.formatOf(state).hasGroups;

  if (cast.kind === "own") return null;
  const season = `Season ${cast.seasonNumber}`;

  async function run(call: () => Promise<LeagueState>) {
    setBusy(true);
    try {
      setState(await call());
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    const ok = await confirm(
      `Finish ${season}'s cast? After this, only an admin can change it, for every league on the season.`,
      { confirmLabel: "Finish cast" }
    );
    if (ok) await run(() => seasonCastApi.finish(leagueId!));
  }

  const box = "mb-3 rounded-md border border-border bg-secondary/40 p-2.5 text-xs";

  if (cast.kind === "shared") {
    // Only someone who'd otherwise expect to edit needs telling why they can't; players see nothing new.
    if (!canManage) return null;
    return (
      <p className={box}>
        {cast.reason === "under-review"
          ? `An admin is reviewing ${season}'s cast. It'll arrive here once it's approved.`
          : `This is ${season}'s shared cast, the same for every league on the season. Only an admin can change it.`}
      </p>
    );
  }

  if (cast.kind === "create") {
    if (!canManage) return null;
    return (
      <p className={box}>
        {season} doesn&rsquo;t have a cast yet. The cast you enter here becomes {season}&rsquo;s shared cast: every league on
        the season gets it, and once you finish it, only an admin can change it.
      </p>
    );
  }

  // creating
  const hold = cast.tribesFromEpisode;
  return (
    <div className={box}>
      <p>
        You&rsquo;re creating {season}&rsquo;s shared cast
        {cast.otherLeagues > 0 ? `, already used by ${cast.otherLeagues} other ${cast.otherLeagues === 1 ? "league" : "leagues"}` : ""}.
        Changes here reach every league on the season. It&rsquo;s finished when you press Finish cast, or when any league on the
        season starts its draft.
      </p>
      {hasGroups && canManage && !cast.tribesConfirmed && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">Were the starting {terms.tribes} public before the premiere?</span>
          <Button size="xs" variant="secondary" disabled={busy} onClick={() => run(() => seasonCastApi.setTribesHold(leagueId!, null))}>
            Yes, show them now
          </Button>
          <Button size="xs" variant="secondary" disabled={busy} onClick={() => run(() => seasonCastApi.setTribesHold(leagueId!, 1))}>
            No, episode 1 shows them
          </Button>
          <span className="basis-full text-muted-foreground">
            Until you answer, starting {terms.tribes} are held back until each league reaches episode 1.
          </span>
        </div>
      )}
      {hasGroups && cast.tribesConfirmed && (
        <p className="mt-1 text-muted-foreground">
          Starting {terms.tribes}: {hold == null ? "public before the premiere" : `held until each league reaches episode ${hold}`}.
        </p>
      )}
      {canManage && (
        <div className="mt-2">
          <Button size="xs" disabled={busy} onClick={finish}>
            Finish cast
          </Button>
        </div>
      )}
    </div>
  );
}
