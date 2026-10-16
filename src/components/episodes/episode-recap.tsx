"use client";

import type { Castaway, Episode, LeagueState } from "@/lib/game/types";
import { episodeExits } from "./episode-status";
import type { ReactNode } from "react";
import StateLogic from "@/lib/game/state-logic.js";
import { episodeRecapWins } from "@/lib/game/episode-recap";
import { CastawayStatCard } from "@/components/castaway-stat-card";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { colourTag } from "@/components/ui/caption-plate";
import { Button } from "@/components/ui/button";
import { useShowTerms } from "@/lib/use-show-terms";
import { cn } from "cn";

// Every recap card is the same small width, so a tribe reward, a tribe immunity and one boot share a
// single phone line (three ~96px cards inside the episode card's ~320px).
const CARD_W = "w-24 shrink-0";

// What happened in an episode, as player cards. The episode's headline wins first (the format's
// `recap` list -- Survivor's Reward and Immunity), a whole tribe as one card, then everyone who left,
// each card with how they went. Groups sit side by side and wrap when they don't fit. `onUndoExit` is
// the commissioner's edit mode; `showExits={false}` is the episode page's read view, which shows who
// left as caption plates above this instead.
export function EpisodeRecap({
  ep,
  state,
  onUndoExit,
  showExits = true,
}: {
  ep: Episode;
  state: LeagueState;
  onUndoExit?: (castawayId: string) => void;
  showExits?: boolean;
}) {
  const terms = useShowTerms();
  const wins = episodeRecapWins(state, ep);
  // Boot order is only the score in a Classic league -- elsewhere the corner number is noise.
  const showPlacement = !StateLogic.getLeagueType(state).hasActiveRoster;
  const exits = showExits ? episodeExits(state, ep) : [];

  const card = (c: Castaway, extra?: ReactNode) => (
    <CastawayStatCard
      key={c.id}
      state={state}
      castaway={c}
      owners={c.ownerIds.map((id) => StateLogic.getPlayer(state, id)).filter((p): p is NonNullable<typeof p> => !!p)}
      showPoints={false}
      showPlacementBadge={showPlacement}
      expanded={false}
      compact
      className={CARD_W}
    >
      {extra}
    </CastawayStatCard>
  );

  if (wins.length === 0 && exits.length === 0) {
    return showExits ? <div className="text-sm text-muted-foreground">Nothing recorded yet.</div> : null;
  }

  // One labelled group: its heading over a row of cards, stretched to the tallest so they line up.
  const group = (label: string, cards: ReactNode) => (
    <div key={label} className="flex min-w-0 max-w-full flex-col">
      <h4 className="mb-1.5 text-[13px] font-semibold text-muted-foreground">{label}</h4>
      <div className="flex flex-1 flex-wrap gap-1.5">{cards}</div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-3">
      {wins.map((w) =>
        group(
          w.label,
          <>
            {/* A tribe win is one card in the tribe's colour, not every member -- a whole tribe's
                photos would crowd out the rest of the recap. */}
            {w.tribes.map(({ tribe }) => (
              <div
                key={tribe.id}
                className={cn(CARD_W, "flex flex-col items-center justify-center rounded-[10px] border-2 p-1.5 text-center text-white shadow-sm")}
                style={{ background: tribe.color, borderColor: tribe.color }}
              >
                <div className="break-words text-[0.8rem] font-bold uppercase leading-tight tracking-[1px]">{tribe.name}</div>
                <div className="mt-0.5 text-[0.62rem] font-semibold opacity-85">{terms.tribe}</div>
              </div>
            ))}
            {w.castaways.map((c) => card(c))}
          </>
        )
      )}
      {exits.length > 0 &&
        group(
          "Eliminated",
          exits.map(({ ev, c }) =>
            card(
              c,
              <>
                <div className="mt-0.5 text-[0.62rem] leading-tight text-muted-foreground">
                  {ev.method}
                  {typeof ev.juryVotes === "number" && ` · ${ev.juryVotes} jury vote${ev.juryVotes === 1 ? "" : "s"}`}
                </div>
                {onUndoExit && (
                  <Button variant="secondary" size="xs" className="mt-1" onClick={() => onUndoExit(c.id)}>
                    Undo
                  </Button>
                )}
              </>
            )
          )
        )}
    </div>
  );
}

// The episode page's read view of what happened, kept short so it never buries how the league did
// (it sits at the foot of the page): one line per headline win, a tribe as a single chip in its own
// colour and anyone winning alone as a small face; then secret roles and tribe moves grouped by
// where they went ("→ Dina  Cristian, Danny, Eric"), so a swap is a few lines, not one row per person.
// Who left isn't here: the Out plates at the top of the page already say. The edit mode keeps the
// full cards and per-person rows above, since it needs an Undo on each.
export function EpisodeHappenings({ ep, state }: { ep: Episode; state: LeagueState }) {
  const wins = episodeRecapWins(state, ep);
  const roles = ep.roles || [];
  const groups = ep.groups || [];
  if (wins.length === 0 && roles.length === 0 && groups.length === 0) return null;
  const first = (id: string) => StateLogic.getCastaway(state, id)?.name.split(" ")[0] ?? "?";

  const byRole = new Map<string, string[]>();
  for (const r of roles) byRole.set(r.role, [...(byRole.get(r.role) ?? []), r.castawayId]);
  // Insertion order keeps the tribes in the order the moves were recorded; on their own goes last.
  const byTribe = new Map<string, string[]>();
  for (const g of groups) byTribe.set(g.tribeId ?? "", [...(byTribe.get(g.tribeId ?? "") ?? []), g.castawayId]);
  const tribeKeys = [...byTribe.keys()].sort((a, b) => Number(a === "") - Number(b === ""));

  const tag = "type-caption inline-flex min-h-6 shrink-0 items-center rounded-[2px] px-1.5 text-[13px] leading-none";
  const row = (key: string, label: ReactNode, body: ReactNode) => (
    <div key={key} className="flex min-h-11 items-start gap-3 border-t border-border py-2.5 first:border-t-0">
      <div className="flex min-h-6 w-[92px] shrink-0 items-center text-[13px] font-semibold text-muted-foreground">{label}</div>
      <div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-1.5">{body}</div>
    </div>
  );
  const names = (ids: string[]) => <span className="text-[15px] leading-snug">{ids.map(first).join(", ")}</span>;

  return (
    <div className="flex flex-col border-y border-border">
      {wins.map((w) =>
        row(
          `w-${w.label}`,
          w.label,
          <>
            {w.tribes.map(({ tribe }) => (
              <span key={tribe.id} className={tag} style={colourTag(tribe.color)}>
                {tribe.name}
              </span>
            ))}
            {w.castaways.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-[2px] bg-muted py-0.5 pl-0.5 pr-2 text-[14px] font-semibold">
                <CastawayAvatar
                  castaway={c}
                  className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-secondary text-[9px] font-bold text-muted-foreground [&_img]:object-top"
                />
                {c.name.split(" ")[0]}
              </span>
            ))}
          </>
        )
      )}
      {[...byRole].map(([role, ids]) =>
        row(`r-${role}`, <span className={cn(tag, "bg-foreground text-background")}>{role}</span>, names(ids))
      )}
      {tribeKeys.map((tid) => {
        const tribe = tid ? StateLogic.Core.getTribe(state, tid) : null;
        return row(
          `g-${tid}`,
          <span className={tag} style={colourTag(tribe?.color ?? "#4a4558")}>
            → {tribe?.name ?? "On their own"}
          </span>,
          names(byTribe.get(tid)!)
        );
      })}
    </div>
  );
}

// Secret roles taken (The Traitors) and tribe/team changes (swaps, the merge, new partners) in this
// episode. Only present once the viewer has the episode's results, so a league catching up doesn't
// see them early. The undo handlers are the commissioner's edit mode.
export function EpisodeChanges({
  ep,
  state,
  onUndoRole,
  onUndoMove,
}: {
  ep: Episode;
  state: LeagueState;
  onUndoRole?: (castawayId: string) => void;
  onUndoMove?: (castawayId: string) => void;
}) {
  const roles = ep.roles || [];
  const groups = ep.groups || [];
  if (roles.length === 0 && groups.length === 0) return null;
  const name = (id: string) => StateLogic.getCastaway(state, id)?.name ?? "?";
  const row = (key: string, tag: ReactNode, who: string, undo?: () => void) => (
    <div key={key} className="flex min-h-12 items-center gap-3 border-t border-border first:border-t-0">
      {tag}
      <span className="min-w-0 flex-1 truncate text-base font-semibold">{who}</span>
      {undo && (
        <Button variant="secondary" size="sm" onClick={undo}>
          Undo
        </Button>
      )}
    </div>
  );
  return (
    <div className="flex flex-col">
      {roles.map((r) =>
        row(
          `r-${r.castawayId}`,
          <span className="type-caption shrink-0 rounded-[2px] bg-foreground px-1.5 py-1 text-[13px] text-background">{r.role}</span>,
          name(r.castawayId),
          onUndoRole && (() => onUndoRole(r.castawayId)),
        ),
      )}
      {groups.map((g) => {
        const tribe = g.tribeId ? StateLogic.Core.getTribe(state, g.tribeId) : null;
        return row(
          `g-${g.castawayId}`,
          <span
            className="type-caption shrink-0 rounded-[2px] px-1.5 py-1 text-[13px] text-white"
            style={{ background: tribe?.color ?? "#4a4558" }}
          >
            → {tribe?.name ?? "On their own"}
          </span>,
          name(g.castawayId),
          onUndoMove && (() => onUndoMove(g.castawayId)),
        );
      })}
    </div>
  );
}
