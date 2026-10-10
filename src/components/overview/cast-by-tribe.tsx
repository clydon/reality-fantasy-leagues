"use client";

import { useState, type ReactNode } from "react";
import type { Castaway, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { cn } from "cn";
import { isKnockedOut } from "@/lib/game/selectors";

// `badge`: a number in the corner -- Active Roster's points (primary), Classic's finishing place
// (out, the red of BoardGrid's boot-order badge), or a medal emoji on its own.
export function Chip({
  state,
  castaway: c,
  ring,
  points,
  badgeTone = "primary",
  small,
  large,
  dim = isKnockedOut(state, c),
}: {
  state: LeagueState;
  castaway: Castaway;
  ring?: string;
  points?: number | string;
  badgeTone?: "primary" | "out" | "medal";
  small?: boolean;
  /** Eliminator Pool's board: one pick per row, so it can afford to be bigger than the default. */
  large?: boolean;
  /** Faded as out of the game -- by default whenever they are. */
  dim?: boolean;
}) {
  return (
    <div className="relative shrink-0" title={c.name}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2",
          small ? "h-7 w-7 opacity-80" : large ? "h-14 w-14" : "h-10 w-10",
          dim && "opacity-50"
        )}
        style={{ borderColor: ring ?? "var(--border)" }}
      >
        <CastawayAvatar expandable
          castaway={c}
          className={cn(
            "flex h-full w-full items-center justify-center bg-secondary font-mono font-bold text-muted-foreground",
            small ? "text-[0.55rem]" : large ? "text-[0.75rem]" : "text-[0.65rem]"
          )}
        />
      </div>
      {points !== undefined &&
        (badgeTone === "medal" ? (
          <span className="absolute -bottom-2 -right-2 text-lg leading-none drop-shadow-sm">{points}</span>
        ) : (
          <span
            className={cn(
              "absolute -bottom-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border-2 border-card px-0.5 font-mono text-[0.55rem] font-bold leading-none",
              badgeTone === "out" ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
            )}
          >
            {points}
          </span>
        ))}
    </div>
  );
}

// The whole cast, compact: a small photo per castaway grouped by current tribe (biggest group first,
// same as BoardGrid), a dot per owner beneath. Tap one for its full stat card. The Board for Classic
// and Active Roster (CastBoard below).
export function CastByTribe({
  state,
  bare,
  title,
  aside,
}: {
  state: LeagueState;
  /** No rule above it: it's the whole section. */
  bare?: boolean;
  /** The heading; the show's word for its cast when not given, none when null (the page names it). */
  title?: string | null;
  /** On the heading line (one link per section). */
  aside?: ReactNode;
}) {
  const terms = useShowTerms();
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = [{ id: null as string | null, name: "Unassigned", color: "#4a5245" }, ...state.tribes]
    .map((g) => ({
      g,
      members: state.castaways
        .filter((c) => (c.tribeId || null) === g.id)
        .sort(
          (a, b) =>
            Number(a.status === "eliminated") - Number(b.status === "eliminated") ||
            (a.status === "eliminated" ? (b.placementOrder ?? 0) - (a.placementOrder ?? 0) : a.name.localeCompare(b.name))
        ),
    }))
    .filter((x) => x.members.length > 0)
    .sort((a, b) => b.members.length - a.members.length);
  const open = openId ? StateLogic.getCastaway(state, openId) : null;

  return (
    <div className={cn(!bare && "mt-4 border-t border-border pt-3")}>
      {title !== null && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h3 className="section-title">{title ?? terms.castaways.replace(/^./, (ch) => ch.toUpperCase())}</h3>
          {aside}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {groups.map(({ g, members }) => (
          <div key={g.id ?? "unassigned"} className="flex gap-2">
            {state.tribes.length > 0 && <div className="w-1 shrink-0 rounded-full" style={{ background: g.color }} title={g.name} />}
            <div className="min-w-0 flex-1">
              {state.tribes.length > 0 && (
                <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide" style={{ color: g.color }}>
                  {g.name}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {members.map((c) => {
                  const owners = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p);
                  return (
                    <button
                      key={c.id}
                      className={cn(
                        "flex w-11 flex-col items-center gap-0.5 rounded-md p-0.5 hover:bg-secondary",
                        isKnockedOut(state, c) && "opacity-45",
                        openId === c.id && "bg-secondary"
                      )}
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      aria-expanded={openId === c.id}
                    >
                      <div
                        className="h-9 w-9 overflow-hidden rounded-md border-2"
                        style={{ borderColor: owners[0]?.color ?? "var(--border)" }}
                      >
                        <CastawayAvatar
                          castaway={c}
                          className="flex h-full w-full items-center justify-center bg-secondary font-mono text-[0.55rem] font-bold text-muted-foreground"
                        />
                      </div>
                      <span className="w-full truncate text-center text-[0.6rem] leading-tight">{c.name.split(" ")[0]}</span>
                      <span className="flex h-1.5 gap-0.5">
                        {owners.map((o) => (
                          <span key={o.id} className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} title={o.name} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {open && members.some((m) => m.id === open.id) && (
                <div className="mt-2 max-w-[260px]">
                  <CastawayStatCard
                    state={state}
                    castaway={open}
                    owners={open.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p)}
                    showPlacementBadge={false}
                    expanded
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// The cast for a roster league, by tribe. On Overview only before the draft, as "The cast" with a
// Scout link (docs/PLAN-ux-declutter.md). Who's starting whom is on the Lineup page's Everyone view
// (Active Roster); each team's faces are in Standings (Classic).
export function CastBoard({ state, title, aside }: { state: LeagueState; title?: string; aside?: ReactNode }) {
  return (
    <section id="board" className="scroll-mt-20">
      <CastByTribe state={state} bare title={title} aside={aside} />
    </section>
  );
}
