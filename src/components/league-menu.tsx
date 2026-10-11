"use client";

import { Check, Crown, Link2, Plus, Star } from "lucide-react";
import type { LeagueSummary } from "@/lib/store";
import { useShowCatalog } from "@/lib/use-show-terms";
import { PlainButton } from "@/components/draft/draft-ui";
import { cn } from "cn";

// Type and show name per row, both derived from /api/me's own league list (which also arrives
// already sorted) -- no per-league fetch, so nothing re-sorts or pops in after open.
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
 * /api/me's league list as the menu shows it: a linked group (0040, named in 0047) is one entry
 * holding its leagues, which the server already sends next to each other and in the group's order.
 * A group you're in only one league of isn't worth a section of its own, so that league stands alone
 * (with the group's name in its detail line).
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
 * The league menu's list, shared by the mobile header's sheet and the desktop sidebar's plate. Rows
 * are the app's index rows (60px, name over a muted line, hairlines). Leagues on their own come first
 * in the server's order, unheaded (the menu's title covers them); each linked group follows as its own
 * section under a small caps heading, all open, so every league is one tap. The open league sits on the raised fill with a chyron-line tick.
 */
export function LeagueMenu({
  leagues,
  leagueId,
  onSelect,
}: {
  leagues: LeagueSummary[];
  leagueId: string | null;
  onSelect: (id: string) => void;
}) {
  const { types, showNames } = useLeagueTypeBadges(leagues);
  const entries = groupLeagues(leagues);
  const solo = entries.flatMap((e) => (e.kind === "league" ? [e] : []));
  const groups = entries.flatMap((e) => (e.kind === "group" ? [e] : []));

  function row(l: LeagueSummary, opts: { groupName?: string | null; inGroup?: boolean } = {}) {
    const current = l.id === leagueId;
    // The league a linked group opens on; only worth saying inside the group.
    const favorite = opts.inGroup && l.landOn === l.id;
    const detail = [
      !opts.inGroup && showNames[l.id],
      types[l.id],
      opts.groupName && `Linked · ${opts.groupName}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <button
        key={l.id}
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={() => onSelect(l.id)}
        className={cn(
          "flex min-h-[60px] w-full items-center gap-3 border-t border-border px-4 py-2 text-left outline-none transition-colors focus-visible:bg-accent",
          current ? "bg-secondary" : "hover:bg-accent/40",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-foreground">
            <span className="truncate">{l.name}</span>
            {favorite && (
              <span className="flex shrink-0 text-muted-foreground" title="The league this group opens on">
                <Star className="size-3.5 fill-current" aria-hidden />
                <span className="sr-only">(opens first)</span>
              </span>
            )}
          </span>
          {(detail || l.role === "commissioner") && (
            <span className="flex min-w-0 items-center gap-1 text-[13px] text-muted-foreground">
              {l.role === "commissioner" && (
                <span className="flex shrink-0" title="You're the commissioner">
                  <Crown className="size-3.5" strokeWidth={2.2} aria-hidden />
                  <span className="sr-only">Commissioner{detail ? "," : ""}</span>
                </span>
              )}
              <span className="truncate">{detail}</span>
            </span>
          )}
        </span>
        {current && <Check className="size-5 shrink-0 text-chyron-line" strokeWidth={2.6} aria-label="Open now" />}
      </button>
    );
  }

  return (
    <div className="flex flex-col">
      {solo.length > 0 && (
        <section className="border-b border-border">
          {solo.map((e) => row(e.league, { groupName: e.groupName }))}
        </section>
      )}
      {groups.map((g) => (
        <section key={g.id} className="border-b border-border" aria-label={`${g.name}, linked leagues`}>
          <SectionHeading aside={`${g.leagues.length} linked · one chat`} icon>
            {g.name}
          </SectionHeading>
          {g.leagues.map((l) => row(l, { inGroup: true }))}
        </section>
      ))}
    </div>
  );
}

function SectionHeading({ children, aside, icon }: { children: React.ReactNode; aside?: string; icon?: boolean }) {
  return (
    // The aside drops under the name when they don't fit side by side (the desktop rail).
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-4 pb-2 pt-4 text-muted-foreground">
      <span className="flex min-w-0 max-w-full items-center gap-1.5">
        {icon && <Link2 className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />}
        <h3 className="type-caption min-w-0 truncate text-[14px] tracking-[0.04em]">{children}</h3>
      </span>
      {aside && <span className="ml-auto shrink-0 text-[13px]">{aside}</span>}
    </div>
  );
}

/** The menu's two ways into another league, the same pair My Leagues offers. Neither is chyron: the
 *  menu's job is switching, and a yellow button here would be the screen's second "now". */
export function LeagueMenuActions({ onGo }: { onGo: (href: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      <PlainButton className="min-w-[140px] flex-1" onClick={() => onGo("/new-league")}>
        <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden />
        New league
      </PlainButton>
      <PlainButton className="min-w-[140px] flex-1" onClick={() => onGo("/dashboard?join=1")}>
        Join with a code
      </PlainButton>
    </div>
  );
}
