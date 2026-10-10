"use client";

import { useState } from "react";
import type { LeagueSummary } from "@/lib/store";
import { useShowCatalog } from "@/lib/use-show-terms";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, CrownIcon } from "@/components/icons";
import { cn } from "cn";

// Type badge and show name per row, both derived from /api/me's own league list (which also
// arrives already sorted) -- no per-league fetch, so nothing re-sorts or pops in after open.
export function useLeagueTypeBadges(leagues: LeagueSummary[]) {
  const { data: catalog } = useShowCatalog();
  const types = Object.fromEntries(leagues.map((l) => [l.id, l.type]));
  const showNames = Object.fromEntries(
    leagues.map((l) => [l.id, catalog?.shows.find((s) => s.slug === l.showId)?.name ?? null])
  );
  return { types, showNames };
}

type Entry =
  | { kind: "league"; league: LeagueSummary; groupName: string | null }
  | { kind: "group"; id: string; name: string; leagues: LeagueSummary[] };

/**
 * /api/me's league list as the dropdown shows it: a linked group (0040, named in 0047) is one entry
 * holding its leagues, which the server already sends next to each other and in the group's order.
 * A group you're in only one league of isn't worth a row of its own, so that league stands alone
 * (with the group's name under it).
 */
export function groupLeagues(leagues: LeagueSummary[]): Entry[] {
  const entries: Entry[] = [];
  for (const l of leagues) {
    const last = entries[entries.length - 1];
    if (l.group && last?.kind === "group" && last.id === l.group.id) last.leagues.push(l);
    else if (l.group) entries.push({ kind: "group", id: l.group.id, name: l.group.name, leagues: [l] });
    else entries.push({ kind: "league", league: l, groupName: null });
  }
  return entries.map((e) =>
    e.kind === "group" && e.leagues.length === 1 ? { kind: "league", league: e.leagues[0], groupName: e.name } : e
  );
}

/**
 * The league dropdown's contents, shared by the desktop sidebar's LeagueSwitcher and MobileNav's
 * top-bar menu. Groups start closed except the one holding the open league, and tapping a group only
 * opens or closes it -- the menu remounts each time it opens, so that resets with it. When the whole
 * menu would be one group (someone whose linked leagues are their only leagues), it's a fixed heading
 * over its leagues instead: a group row there would only add a tap.
 */
export function LeagueMenu({
  leagues,
  leagueId,
  onSelect,
  onJoinOrCreate,
}: {
  leagues: LeagueSummary[];
  leagueId: string | null;
  onSelect: (id: string) => void;
  onJoinOrCreate: () => void;
}) {
  const { types, showNames } = useLeagueTypeBadges(leagues);
  const entries = groupLeagues(leagues);
  const currentGroup = leagues.find((l) => l.id === leagueId)?.group?.id ?? null;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(currentGroup ? [currentGroup] : []));
  const onlyGroup = entries.length === 1 && entries[0].kind === "group";

  function toggle(id: string) {
    setOpenGroups((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leagueRow(l: LeagueSummary, opts: { groupName?: string | null; inGroup?: boolean } = {}) {
    const favorite = opts.inGroup && l.landOn === l.id;
    return (
      <button
        key={l.id}
        className={cn(
          "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-secondary",
          l.id === leagueId && "bg-secondary"
        )}
        onClick={() => onSelect(l.id)}
      >
        <span className="flex w-full items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{l.name}</span>
          {favorite && (
            <span className="shrink-0 text-xs text-chyron-line" title="The league the app opens on">
              ★
            </span>
          )}
          {!opts.inGroup && showNames[l.id] && (
            <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{showNames[l.id]}</span>
          )}
        </span>
        {(types[l.id] || l.role === "commissioner" || opts.groupName) && (
          <span className="flex flex-wrap items-center gap-1">
            {types[l.id] && (
              <Badge variant="secondary" className="text-[0.65rem]">
                {types[l.id]}
              </Badge>
            )}
            {l.role === "commissioner" && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <CrownIcon className="h-3 w-3 shrink-0" />
                Commissioner
              </span>
            )}
            {opts.groupName && <span className="text-xs text-muted-foreground">Linked · {opts.groupName}</span>}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {entries.map((e) => {
        if (e.kind === "league") return leagueRow(e.league, { groupName: e.groupName });
        const open = onlyGroup || openGroups.has(e.id);
        const showName = showNames[e.leagues[0].id];
        const commissioner = e.leagues.some((l) => l.role === "commissioner");
        return (
          <div key={e.id}>
            {onlyGroup ? (
              <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
              </div>
            ) : (
              <button
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-1.5 text-left hover:bg-secondary"
                aria-expanded={open}
                onClick={() => toggle(e.id)}
              >
                <span className="flex w-full items-center gap-1.5">
                  <ChevronDownIcon
                    className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}</span>
                  {showName && <span className="max-w-[45%] shrink-0 truncate text-xs text-muted-foreground">{showName}</span>}
                </span>
                <span className="flex items-center gap-1 pl-5 text-xs text-muted-foreground">
                  {e.leagues.length} leagues
                  {commissioner && <CrownIcon className="h-3 w-3 shrink-0 text-amber-600" />}
                </span>
              </button>
            )}
            {open && (
              <div className={cn("flex flex-col", !onlyGroup && "mb-1 ml-4 border-l border-border pl-1.5")}>
                {e.leagues.map((l) => leagueRow(l, { inGroup: true }))}
              </div>
            )}
          </div>
        );
      })}
      <button
        className="mt-1 flex w-full items-center rounded-md border-t border-border px-2.5 pb-1 pt-2 text-left text-sm font-semibold text-chyron-line hover:bg-secondary"
        onClick={onJoinOrCreate}
      >
        + Join or create a league
      </button>
    </>
  );
}
