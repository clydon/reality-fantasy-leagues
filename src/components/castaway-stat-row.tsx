"use client";

import type { LeagueState, Castaway } from "@/lib/game/types";
import { castawayEventStats } from "@/lib/game/active-roster-rows";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { RoleBadge } from "@/components/role-badge";
import { XMarkIcon } from "@/components/icons";
import { cn } from "cn";
import StateLogic from "@/lib/game/state-logic.js";

// Active Roster's "Your Team" row: photo on the left, stat breakdown already open to its right --
// unlike CastawayStatCard (a vertical card, breakdown below the photo, collapsed until tapped), this
// is meant for a place that already wants every castaway's stats visible at a glance without a click,
// one per row. No placement/boot-order badge (see castaway-stat-card.tsx's showPlacementBadge note --
// Active Roster doesn't score on elimination order) and no owner tag (always rendered under "your"
// roster, so whose it is is already established by context).
// `stats` narrows what's shown (one episode, or what they earned for you); `fade: false` keeps an
// eliminated castaway at full strength, e.g. in last week's lineup, where they did play.
export function CastawayStatRow({
  state,
  castaway: c,
  stats: given,
  fade = true,
  emptyText = "Nothing scored yet.",
}: {
  state: LeagueState;
  castaway: Castaway;
  stats?: { total: number; byType: { type: string; label: string; count: number; points: number }[] };
  fade?: boolean;
  emptyText?: string;
}) {
  const stats = given ?? castawayEventStats(state, c.id);

  const eliminated = c.status === "eliminated";
  const out = eliminated && fade;

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border border-border bg-card p-2.5", out && "opacity-[.55] saturate-[.75]")}>
      <div className="relative h-14 w-14 shrink-0">
        <CastawayAvatar
          castaway={c}
          className="flex h-14 w-14 items-center justify-center rounded-[12px] border border-border bg-secondary font-mono text-[0.95rem] font-bold text-muted-foreground"
        />
        {eliminated && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[12px] bg-black/10" aria-hidden>
            <XMarkIcon className="h-8 w-8 text-destructive drop-shadow-[0_1px_2px_rgba(0,0,0,.4)]" />
          </div>
        )}
        <div
          className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 font-mono text-[0.65rem] font-bold leading-none text-primary-foreground"
          title={`${stats.total} point${stats.total === 1 ? "" : "s"} scored`}
        >
          {stats.total}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.84rem] font-semibold text-foreground">
          {c.name}
          <RoleBadge state={state} castawayId={c.id} />
        </div>
        {stats.byType.length === 0 ? (
          <span className="text-[0.7rem] italic text-muted-foreground">{emptyText}</span>
        ) : (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {stats.byType.map((s) => (
              <span key={s.type} className="text-[0.7rem] text-muted-foreground">
                {s.label} <b className="text-foreground">×{s.count}</b> ({StateLogic.roundPoints(s.count * s.points)} pts)
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
