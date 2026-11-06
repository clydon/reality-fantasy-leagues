"use client";

import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useMyPlayerId } from "@/lib/store";
import { episodePlayerPoints } from "@/lib/game/active-roster-rows";
import { episodeGains, predictionsRight } from "@/lib/game/classic-view";
import { episodeExits } from "./episode-status";

// One-line summaries of a decided episode, shared by the Episodes list's rows and Last time on
// Episodes (week.tsx). Read from the viewer's trimmed state, so only ever an episode they've revealed.

/** Who went home: names for one or two, a count beyond that. */
export function ScoredHeadline({ ep, state }: { ep: Episode; state: LeagueState }) {
  const exits = episodeExits(state, ep);
  if (exits.length === 0) return <>No one left</>;
  if (exits.length > 2) return <>{exits.length} left the game</>;
  return <>{exits.map((x) => x.c.name).join(" and ")} out</>;
}

/** What it meant for you: your starters' points (Active Roster), whether your pick survived
 *  (Eliminator Pool), or what your team earned and whether your prediction paid (Classic). */
export function ScoredDetail({ ep, state }: { ep: Episode; state: LeagueState }) {
  const me = useMyPlayerId();
  const text = scoredText(ep, state, me);
  return text ? <>{text}</> : null;
}

export function scoredText(ep: Episode, state: LeagueState, me: string | null): string | null {
  const type = StateLogic.getLeagueType(state);
  if (type.hasActiveRoster) {
    const rows = episodePlayerPoints(state, ep.id);
    const mine = rows.find((r) => r.player.id === me);
    const top = rows[0];
    const parts = [
      mine && (mine.points === 0 ? "Your starters scored 0" : `You ${fmtPoints(mine.points)}`),
      top && top.player.id !== me && top.points > 0 && `top: ${top.player.name} ${fmtPoints(top.points)}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ").replace(/^./, (ch) => ch.toUpperCase()) : null;
  }
  if (type.hasWeeklyPicks) {
    const pick = (ep.picks || []).find((p) => p.playerId === me);
    if (!pick) return me ? "You didn't pick" : null;
    const name = StateLogic.getCastaway(state, pick.castawayId)?.name ?? "Your pick";
    const out = StateLogic.PickEmLogic.wentHome(state, ep, pick.castawayId);
    const streak = me ? StateLogic.pickEmHistory(state, me).rows.find((r) => r.episode === ep.number)?.streak : undefined;
    return out ? `Your pick, ${name}, went home` : `Your pick, ${name}, survived${streak ? ` · streak ${streak}` : ""}`;
  }
  const gains = episodeGains(state, ep);
  const mine = gains.find((g) => g.player.id === me);
  const top = gains[0];
  const { right, points } = predictionsRight(state, ep, me);
  const parts = [
    mine && `you +${mine.points}`,
    top && top.player.id !== me && top.points > 0 && `top: ${top.player.name} +${top.points}`,
    right.length > 0 && `${right.length === 1 ? "your prediction was" : `${right.length} predictions`} right, +${points}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ").replace(/^./, (ch) => ch.toUpperCase());
}

export function fmtPoints(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}
