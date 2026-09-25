"use client";

import { useState } from "react";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Catch-up mode's control surface (StateLogic.RevealLogic, docs/PLAN-spoiler-free-catch-up.md).
//
// A league that formed mid-season plays from the starting line: results may be decided for the
// whole season already, but this league only sees what the commissioner has revealed.
//
// One action per episode: REVEAL. The next episode always exists already (the server keeps one
// ready -- EpisodeLogic.ensureNextEpisode), so bets, picks and lineups go in on its card before
// anyone knows how it went, and revealing its results creates the one after. There used to be a
// separate "Open episode N" step first; it was pure friction once the episode could simply exist.
//
// What the panel never says is how much MORE the wiki knows. "3 more episodes are ready" is itself
// the spoiler this feature exists to prevent: it tells a league how far the season has run, and a
// short remaining count says the finale is close. So it only ever talks about the next episode.
export function CatchUpPanel({ state }: { state: LeagueState }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  // Castaways sorted into their starting tribe by this reveal, when the season held the division
  // back until the premiere. Worth saying out loud -- it's a change to the cast the reveal made.
  const [tribed, setTribed] = useState<string[]>([]);
  // Accepted results that name someone this league doesn't have -- the reveal worked, those didn't land.
  const [skipped, setSkipped] = useState<{ name: string; why: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!StateLogic.RevealLogic.isCatchingUp(state)) return null;

  const revealed = StateLogic.RevealLogic.revealedThrough(state) as number;
  const next = StateLogic.RevealLogic.nextEpisode(state) as number;
  const live = mode === "live" && !!leagueId;
  const canAct = canManage && live;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    setTribed([]);
    setSkipped([]);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const reveal = () =>
    run(async () => {
      const res = await api.revealNextEpisode(leagueId!);
      setState(res.state);
      const n = res.revealedThroughEpisode;
      setNote({
        text:
          res.applied > 0
            ? `Episode ${n} revealed — ${res.applied} result${res.applied === 1 ? "" : "s"} applied.` +
              (res.awaitingReview ? ` ${res.awaitingReview} more still being reviewed; they'll appear on their own.` : "")
            : res.awaitingReview
              ? `Episode ${n} revealed — its results are still being reviewed and will appear on their own once they are.`
              : `Episode ${n} revealed — no results have been recorded for it yet; they'll appear on their own once they are.`,
        ok: true,
      });
      setTribed(res.tribed);
      setSkipped(res.skipped);
    });

  return (
    <div className="mb-4 rounded-lg border border-primary/40 bg-card p-4 shadow-sm">
      <h3 className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Catching up</h3>
      <p className="mb-2 text-sm text-muted-foreground">
        {revealed === 0 ? (
          <>This league is playing from the start of the season, whatever the wiki already knows.</>
        ) : (
          <>
            This league has played through <b className="text-foreground">episode {revealed}</b>. Later episodes stay
            hidden until you reveal them.
          </>
        )}{" "}
        Episode {next} is <b className="text-foreground">up next</b> — bets and picks go on its card now; reveal what
        happened once everyone&rsquo;s in.
      </p>
      {canAct && (
        <div className="flex flex-wrap gap-1.5">
          <Button disabled={busy} onClick={reveal}>
            {busy ? "Revealing…" : `Reveal episode ${next} results`}
          </Button>
        </div>
      )}
      {canAct && (
        <p className="mt-2 text-xs text-muted-foreground">
          Revealing applies that episode&rsquo;s results, as reviewed once for the whole season.
        </p>
      )}
      {note && (
        <p className={`mt-2 text-sm font-semibold ${note.ok ? "text-good" : "text-destructive"}`}>{note.text}</p>
      )}
      {tribed.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          This episode also revealed the starting line-up: <b>{tribed.length}</b> {tribed.length === 1 ? "castaway is" : "castaways are"}{" "}
          now sorted into their tribes.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <b>{skipped.length}</b> result{skipped.length === 1 ? "" : "s"} couldn&rsquo;t be applied:{" "}
          {skipped.map((x) => `${x.name} (${x.why})`).join(", ")}. Fix the name in League Settings, or log it by hand.
        </p>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
