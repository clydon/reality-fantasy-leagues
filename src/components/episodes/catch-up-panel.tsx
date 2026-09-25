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
// season, but this league only sees what the commissioner has revealed.
//
// One action per episode: REVEAL. The next episode always exists already (the server keeps one
// ready -- EpisodeLogic.ensureNextEpisode), so bets, picks and lineups go in on its card before
// anyone knows how it went, and revealing its results creates the one after. There used to be a
// separate "Open episode N" step first; it was pure friction once the episode could simply exist.
//
// What the panel never says is how much MORE the wiki knows. "3 more episodes are ready" is itself
// the spoiler this feature exists to prevent: it tells a league how far the season has run, and a
// short remaining count says the finale is close. So it only ever talks about the next episode.
export function CatchUpPanel({ state, onRevealed }: { state: LeagueState; onRevealed: () => void }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  // Kept apart from `note`: names the wiki used that this league's cast doesn't have are neither a
  // success nor a failure -- the reveal worked, and those particular results were skipped.
  const [unmatched, setUnmatched] = useState<string[]>([]);
  // Castaways sorted into their starting tribe by this reveal, when the season held the division
  // back until the premiere. Worth saying out loud -- it's a change to the cast the reveal made.
  const [tribed, setTribed] = useState<string[]>([]);
  // The two ways a castaway can end up with nothing to review: a result the validation refused, and
  // a castaway the wiki said nothing about. Both used to be invisible -- the first a console line,
  // the second nothing at all -- which is how someone can be missing from the list entirely without
  // anything looking wrong.
  const [dropped, setDropped] = useState<{ name: string; why: string }[]>([]);
  const [noResultFor, setNoResultFor] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!StateLogic.RevealLogic.isCatchingUp(state)) return null;

  const revealed = StateLogic.RevealLogic.revealedThrough(state) as number;
  const next = StateLogic.RevealLogic.nextEpisode(state) as number;
  const live = mode === "live" && !!leagueId;
  const canAct = canManage && live;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    setUnmatched([]);
    setTribed([]);
    setDropped([]);
    setNoResultFor([]);
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
      // `note` from the server is always a reason nothing landed (the wiki hasn't been read that far
      // yet, no cast to match against). It used to render in the same green as success, which is how
      // a validation failure ended up looking like a result.
      setNote(
        res.note
          ? { text: res.note, ok: false }
          : {
              text:
                res.written > 0
                  ? `Episode ${res.revealedThroughEpisode} revealed — ${res.written} result${res.written === 1 ? " is" : "s are"} on that episode's card, waiting for you to confirm.`
                  : `Episode ${res.revealedThroughEpisode} revealed — the wiki had no results for it.`,
              ok: true,
            }
      );
      setUnmatched(res.unmatched);
      setTribed(res.tribed);
      setDropped(res.dropped);
      setNoResultFor(res.noResultFor);
      onRevealed();
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
          Revealing makes that episode&rsquo;s results reviewable — nothing is scored until you confirm each one.
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
      {dropped.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">
          <b>{dropped.length}</b> result{dropped.length === 1 ? " was" : "s were"} thrown out as impossible, so{" "}
          {dropped.length === 1 ? "that castaway has" : "those castaways have"} nothing to review:
          <ul className="mt-0.5 list-inside list-disc">
            {dropped.map((d) => (
              <li key={`${d.name}-${d.why}`}>
                <b>{d.name}</b> — {d.why}
              </li>
            ))}
          </ul>
          Add anything real by hand on the episode card below.
        </div>
      )}
      {noResultFor.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          The wiki reported nothing this episode for <b>{noResultFor.length}</b>{" "}
          {noResultFor.length === 1 ? "castaway" : "castaways"}: {noResultFor.join(", ")}. That&rsquo;s normal for
          anyone who went to Tribal and took votes — but if one of them had a notable episode, the extraction missed it
          and it needs adding by hand.
        </p>
      )}
      {unmatched.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <b>{unmatched.length}</b> result{unmatched.length === 1 ? "" : "s"} named someone this league doesn&rsquo;t
          have and {unmatched.length === 1 ? "was" : "were"} skipped: {unmatched.join(", ")}. Add or rename them in
          League Settings and reveal again, or log those results by hand.
        </p>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
