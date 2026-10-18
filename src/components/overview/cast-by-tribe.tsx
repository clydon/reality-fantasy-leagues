"use client";

import { useState, type ReactNode } from "react";
import type { LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { cn } from "cn";
import { colourTag } from "@/components/ui/caption-plate";
import { isKnockedOut } from "@/lib/game/selectors";
import { useMyPlayerId } from "@/lib/store";

// The whole cast, compact: a small photo per castaway grouped by current tribe (biggest group first,
// same as BoardGrid), a dot per owner beneath. Tap one for its full stat card. The Board for Classic
// and Active Roster (CastBoard below).
export function CastByTribe({
  state,
  bare,
  title,
  aside,
  remaining,
}: {
  state: LeagueState;
  /** Only who's still in the game (the Scoreboard's "Still in"). */
  remaining?: boolean;
  /** No rule above it: it's the whole section. */
  bare?: boolean;
  /** The heading; the show's word for its cast when not given, none when null (the page names it). */
  title?: string | null;
  /** On the heading line (one link per section). */
  aside?: ReactNode;
}) {
  const terms = useShowTerms();
  const [openId, setOpenId] = useState<string | null>(null);
  const me = useMyPlayerId();
  // Owners only in roster games: an Eliminator Pool has nobody's team, so no owner line.
  const hasRoster = !!StateLogic.getLeagueType(state).hasRoster;
  const groups = [{ id: null as string | null, name: "No tribe", color: "" }, ...state.tribes]
    .map((g) => ({
      g,
      members: state.castaways
        .filter((c) => (c.tribeId || null) === g.id && !(remaining && isKnockedOut(state, c)))
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
          <h3 className="type-caption text-[24px]">{title ?? terms.castaways.replace(/^./, (ch) => ch.toUpperCase())}</h3>
          {aside}
        </div>
      )}
      <div className="flex flex-col gap-5">
        {groups.map(({ g, members }) => {
          const tagged = state.tribes.length > 0;
          const inCount = members.filter((m) => !isKnockedOut(state, m)).length;
          return (
            <section key={g.id ?? "unassigned"} aria-label={tagged ? g.name : undefined}>
              {/* The tribe as a small caption tag in its own colour (tags, not fills), the count beside it. */}
              {tagged && (
                <div className="mb-2.5 flex h-7 items-stretch gap-3">
                  <span
                    className={cn("type-caption tag-cut flex items-center pl-2.5 pr-5 text-[15px] tracking-[0.04em]", !g.id && "bg-quiet-tag text-quiet-tag-foreground")}
                    style={g.id ? colourTag(g.color) : undefined}
                  >
                    {g.name}
                  </span>
                  <span className="flex items-center text-[13px] text-muted-foreground">
                    {remaining || inCount === members.length ? `${members.length} still in` : `${inCount} of ${members.length} still in`}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-x-2 gap-y-3">
                {members.map((c) => {
                  const owners = c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p);
                  const out = isKnockedOut(state, c);
                  const mine = !!me && c.ownerIds.includes(me);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="flex min-w-0 flex-col items-center gap-1 rounded-[2px] outline-none focus-visible:ring-[3px] focus-visible:ring-chyron-line"
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      aria-expanded={openId === c.id}
                      aria-label={`${c.name}${out ? ", out" : ""}${mine ? ", yours" : owners.length ? `, ${owners.map((o) => o.name).join(", ")}` : hasRoster ? ", free agent" : ""}`}
                    >
                      <CastawayAvatar
                        castaway={c}
                        className={cn(
                          "flex aspect-square w-full items-center justify-center rounded-[2px] bg-secondary text-xs font-bold text-muted-foreground [&_img]:object-top",
                          out && "grayscale brightness-[.6]",
                          openId === c.id
                            ? "outline outline-[3px] outline-offset-2 outline-chyron-line"
                            : mine && "outline outline-2 outline-chyron-line/70"
                        )}
                      />
                      <span className={cn("w-full truncate text-center text-[12px] leading-tight", out ? "text-muted-foreground" : "font-semibold")}>
                        {c.name.split(" ")[0]}
                      </span>
                      {/* Whose, in words (Research's owner line): yours carry the outline instead, so say nothing. */}
                      {hasRoster && (
                        <span className={cn("-mt-0.5 h-3.5 w-full truncate text-center text-[11px] leading-[14px]", owners.length ? "text-muted-foreground" : "font-semibold text-good")}>
                          {mine ? "" : owners.length === 0 ? (out ? "" : "Free") : owners.length === 1 ? owners[0].name : `${owners.length} teams`}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {open && members.some((m) => m.id === open.id) && (
                <div className="mt-3">
                  <CastawayStatCard
                    state={state}
                    castaway={open}
                    owners={open.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is Player => !!p)}
                    showPlacementBadge={false}
                    expanded
                  />
                </div>
              )}
            </section>
          );
        })}
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
