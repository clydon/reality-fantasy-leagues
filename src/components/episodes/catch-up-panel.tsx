"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Catch-up mode's control surface (StateLogic.RevealLogic, docs/PLAN-spoiler-free-catch-up.md).
//
// A league that formed mid-season plays from the starting line: the connector has read the whole
// season, but this league only sees what the commissioner has revealed. One button moves that
// forward an episode at a time.
//
// What it deliberately never says is how much MORE the wiki knows. "3 more episodes are ready" is
// itself the spoiler this whole feature exists to prevent -- it tells a league how far the season
// has run, and a short remaining count tells them the finale is close. So the panel talks only
// about the episode being revealed next, never about the distance to the end.
export function CatchUpPanel({ state, onRevealed }: { state: LeagueState; onRevealed: () => void }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!StateLogic.RevealLogic.isCatchingUp(state)) return null;

  const revealed = StateLogic.RevealLogic.revealedThrough(state);
  const next = StateLogic.RevealLogic.nextEpisode(state);
  const live = mode === "live" && !!leagueId;

  async function reveal() {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      const res = await api.revealNextEpisode(leagueId!);
      setState(res.state);
      setNote(
        res.note ??
          `Episode ${res.revealedThroughEpisode} revealed — its results are below, waiting for you to confirm them.`
      );
      onRevealed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reveal the next episode.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Catching up</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        {revealed === 0 ? (
          <>
            This league is playing from the start of the season. Nothing has been revealed yet — draft and make your
            picks first, then reveal episode 1 when everyone&rsquo;s ready.
          </>
        ) : (
          <>
            This league has seen through <b className="text-foreground">episode {revealed}</b>. Later episodes stay
            hidden until you reveal them, however much the wiki already knows.
          </>
        )}
      </p>
      {canManage && live && (
        <Button disabled={busy} onClick={reveal}>
          {busy ? "Revealing…" : `Reveal episode ${next}`}
        </Button>
      )}
      {canManage && live && (
        <p className="mt-2 text-xs text-muted-foreground">
          Revealing makes that episode&rsquo;s results reviewable — nothing is scored until you confirm each one.
        </p>
      )}
      {note && <p className="mt-2 text-sm font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
