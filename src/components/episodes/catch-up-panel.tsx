"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useShowCatalog } from "@/lib/use-show-terms";
import { api, ApiError } from "@/lib/api";
import { CaptionPlate } from "@/components/ui/caption-plate";

// Catch-up mode's control surface (StateLogic.RevealLogic, docs/PLAN-spoiler-free-catch-up.md), at the
// top of Episodes; the canvas's "A · Spoilers & reveal" → CatchUp. The list below it is the episode
// list, which already says where each one stands.
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
  const router = useRouter();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const { data: catalog } = useShowCatalog();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Castaways sorted into their starting tribe by this reveal, when the season held the division
  // back until the premiere. Worth saying out loud -- it's a change to the cast the reveal made.
  const [tribed, setTribed] = useState<string[]>([]);
  // Accepted results that name someone this league doesn't have -- the reveal worked, those didn't land.
  const [skipped, setSkipped] = useState<{ name: string; why: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!StateLogic.RevealLogic.isCatchingUp(state)) return null;

  const revealed = StateLogic.RevealLogic.revealedThrough(state) as number;
  // Winner revealed: the season is over for this league, so there's no "next episode" to offer.
  if (StateLogic.RevealLogic.isComplete(state)) {
    return (
      <section className="mb-6 flex flex-col gap-1.5">
        <h3 className="section-title">Season complete</h3>
        <p className="text-sm text-muted-foreground">This league has caught up through the finale. Every episode&rsquo;s results are revealed.</p>
      </section>
    );
  }
  const next = StateLogic.RevealLogic.nextEpisode(state) as number;
  const canAct = canManage && mode === "live" && !!leagueId;
  const show = catalog?.shows.find((s) => s.slug === state.settings.showId);
  const season = [show?.name, state.settings.wikiSeason].filter(Boolean).join(" ");

  async function reveal() {
    setBusy(true);
    setNote(null);
    setTribed([]);
    setSkipped([]);
    setError(null);
    try {
      const res = await api.revealNextEpisode(leagueId!);
      setState(res.state);
      const n = res.revealedThroughEpisode;
      // Results landed and there's nothing to fix: straight into the reveal, which is where the
      // commissioner sees them like everyone else. Otherwise stay and say what happened; the reveal
      // prompt offers the results once there are any.
      if (res.applied > 0 && res.skipped.length === 0 && res.tribed.length === 0) {
        router.push(`/reveal/${n}`);
        return;
      }
      setNote(
        res.applied > 0
          ? `Episode ${n} revealed: ${res.applied} result${res.applied === 1 ? "" : "s"} applied.` +
              (res.awaitingReview ? ` ${res.awaitingReview} more still being reviewed; they'll appear on their own.` : "")
          : res.awaitingReview
            ? `Episode ${n} revealed. Its results are still being reviewed and will appear on their own once they are.`
            : `Episode ${n} revealed. No results have been recorded for it yet; they'll appear on their own once they are.`,
      );
      setTribed(res.tribed);
      setSkipped(res.skipped);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  // One muted sentence, then the next episode as one plate (docs/PLAN-ux-declutter.md): it stands in
  // for that episode's row in the list below, and for the commissioner its Reveal is the screen's one
  // yellow.
  return (
    <section className="mb-6 flex flex-col gap-3.5">
      <p className="text-sm leading-snug text-muted-foreground">
        {revealed === 0
          ? `Catching up on ${season || "the season"} from the start; episodes stay hidden for everyone until they're revealed.`
          : `Catching up on ${season || "the season"}. Played through Episode ${revealed}; later episodes stay hidden for everyone.`}
        {!canManage && " The commissioner reveals each one once everyone has watched."}
      </p>
      <CaptionPlate
        tone="quiet"
        tag={`Ep ${next}`}
        title="Up next"
        subtitle={nextDetail(state, next)}
        {...(canAct
          ? {
              onClick: busy ? undefined : reveal,
              action: busy ? "Revealing…" : "Reveal",
              actionTone: "chyron" as const,
              "aria-label": `Reveal Episode ${next} results`,
            }
          : {})}
      />

      {note && <p className="text-sm font-semibold text-good">{note}</p>}
      {tribed.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          This episode also revealed the starting line-up: <b>{tribed.length}</b> {tribed.length === 1 ? "castaway is" : "castaways are"} now sorted
          into their tribes.
        </p>
      )}
      {skipped.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <b>{skipped.length}</b> result{skipped.length === 1 ? "" : "s"} couldn&rsquo;t be applied:{" "}
          {skipped.map((x) => `${x.name} (${x.why})`).join(", ")}. Fix the name in League Settings, or log it by hand.
        </p>
      )}
      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
    </section>
  );
}

// What's going in on the next episode before anyone knows how it went: lineups (Active Roster), picks
// (Eliminator Pool), or predictions.
function nextDetail(state: LeagueState, number: number): string {
  const type = StateLogic.getLeagueType(state);
  const ep = state.episodes.find((e) => e.number === number);
  const players = state.players.filter((p) => p.active !== false);
  if (ep && players.length) {
    if (type.hasActiveRoster && !type.hasWeeklyPicks) {
      const set = players.filter((p) => {
        const available = state.castaways.filter((c) => c.ownerIds.includes(p.id) && c.status !== "eliminated");
        const fielded = StateLogic.activeRosterLineupFor(state, ep.id, p.id).filter((id) => available.some((c) => c.id === id));
        return fielded.length >= Math.min(StateLogic.ActiveRosterLogic.activeSlots(state), available.length);
      }).length;
      return `${set} of ${players.length} have set their lineups`;
    }
    if (type.hasWeeklyPicks) {
      const picked = players.filter((p) => (ep.picks || []).some((pk) => pk.playerId === p.id)).length;
      return `${picked} of ${players.length} have made their picks`;
    }
  }
  return state.settings.bonusEnabled ? "Predictions go in now" : "Its results stay hidden until it's revealed";
}
