"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { nameKey, sameShow } from "@/lib/game/listing";
import { useListingSearch, type CatalogSeason, type ListingHit } from "../data";
import { ShowArt } from "../ui/show-bar";

// Searching for a show (docs/PLAN-new-design.md step 10 part 1; the mock's refine.js addShowSheet): what's here (every
// show's seasons, from the catalog) and what's in the TV listings that isn't (TVmaze, through /api/listings/search), as you
// type, then "Add '<name>' as a new show" when nothing's called that. Add a show (sheets.tsx) adds what you tap; first
// run's search (welcome/first-run.tsx) picks it.

export type SearchRow =
  | { kind: "season"; key: string; season: CatalogSeason; title: string; sub: string; art: string | null; position: string; state: RowState }
  | { kind: "listing"; key: string; hit: ListingHit; title: string; sub: string; art: string | null; position: string; state: RowState };

/** On your list, set up as a game, the latest season of a show that's here, or not a game yet. */
export type RowState = "yours" | "ready" | "season" | "new";

const DAYS: Record<string, string> = { Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" };

const country = (code: string | null) => (code && code !== "US" ? (code === "GB" ? "UK" : code) : null);

/** "Season 51 · Wednesdays", "Season 9 · Coming up", "Season 1 · Finished · ZT Two · UK" (a listing's network told apart). */
export function seasonLine(s: CatalogSeason) {
  const when = s.status === "airing" ? (s.airsOn ? (DAYS[s.airsOn] ?? "On now") : "On now") : s.status === "upcoming" ? "Coming up" : "Finished";
  return [s.season, when, s.network, country(s.country)].filter(Boolean).join(" · ");
}

/** "2019 · Peacock", "2015 · ITV2 · UK": enough to tell shows with one name apart. */
export function listingLine(h: ListingHit) {
  return [h.year, h.network, country(h.country), h.running ? null : "ended"].filter(Boolean).join(" · ");
}

/** A season here of a show an admin named before the listings came in, matched by name (and country). */
const namedAs = (s: CatalogSeason, hit: ListingHit) => s.tvmazeId == null && sameShow(s.show, hit);

/**
 * Does a season here stand for this listing (so it isn't shown twice)? A show made from (or linked to) this listing does.
 * A show matched by name does when its season here is on now or coming up, or the show has ended; otherwise the listing
 * is offered too, as its latest season (adding it links the show and follows that).
 */
function covered(hit: ListingHit, catalog: CatalogSeason[]) {
  return catalog.some((s) => s.tvmazeId === hit.tvmazeId || (namedAs(s, hit) && (s.status !== "completed" || !hit.running)));
}

/** A listing whose show is here already (by name): adding it follows that show's latest season. */
const known = (hit: ListingHit, catalog: CatalogSeason[]) => catalog.some((s) => namedAs(s, hit));

export function useShowSearch(q: string, catalog: CatalogSeason[], mine: Set<string>, watchers?: (seasonId: string) => string[]) {
  const t = q.trim().toLowerCase();
  // The listings are asked once typing pauses (each answer sits in the edge cache, so a repeat costs nothing).
  const [asked, setAsked] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => setAsked(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const listings = useListingSearch(asked);
  return useMemo(() => {
    if (!t) return { rows: [] as SearchRow[], exact: false, loading: false, unavailable: false };
    const seasons = catalog.filter((s) => `${s.show} ${s.label}`.toLowerCase().includes(t)).slice(0, 8);
    const rows: SearchRow[] = seasons.map((s) => {
      const who = watchers?.(s.seasonId) ?? [];
      return {
        kind: "season",
        key: s.seasonId,
        season: s,
        title: s.label,
        sub:
          who.length && !mine.has(s.seasonId)
            ? [`${who.slice(0, 2).join(" and ")}${who.length > 2 ? ` and ${who.length - 2} more` : ""} ${who.length === 1 ? "watches" : "watch"}`, s.network, country(s.country)].filter(Boolean).join(" · ")
            : seasonLine(s),
        art: s.artUrl,
        position: s.artPosition,
        state: mine.has(s.seasonId) ? "yours" : s.ready ? "ready" : "new",
      };
    });
    for (const h of listings.data?.hits ?? []) {
      if (covered(h, catalog)) continue;
      rows.push({ kind: "listing", key: `tv:${h.tvmazeId}`, hit: h, title: h.name, sub: listingLine(h), art: h.thumb, position: "center", state: known(h, catalog) ? "season" : "new" });
    }
    const key = nameKey(q);
    const exact = rows.some((r) => nameKey(r.kind === "season" ? r.season.show : r.hit.name) === key);
    return { rows, exact, loading: (asked !== q || listings.isFetching) && t.length >= 2, unavailable: !!listings.data?.unavailable };
  }, [t, q, asked, catalog, mine, watchers, listings.data, listings.isFetching]);
}

const PILL: Record<RowState, [string, string]> = {
  yours: ["On your list", "bg-good/15 text-(--nd-good)"],
  ready: ["Ready", "outline-1 -outline-offset-1 outline-input"],
  season: ["Latest season", "outline-1 -outline-offset-1 outline-dashed outline-input"],
  new: ["Not a game yet", "outline-1 -outline-offset-1 outline-dashed outline-input text-muted-foreground"],
};

export function StatePill({ state }: { state: RowState }) {
  const [text, cls] = PILL[state];
  return <span className={`type-caption flex-none whitespace-nowrap rounded-[2px] px-[7px] py-[3px] text-[11px] tracking-[0.05em] ${cls}`}>{text}</span>;
}

/** The rows, each a tap: its art, name, one line, and where it stands (or `picked` instead, in first run). */
export function SearchRows({ rows, onPick, picked }: { rows: SearchRow[]; onPick: (r: SearchRow) => void; picked?: Set<string> }) {
  return (
    <div className="mt-1" data-search-results>
      {rows.map((r) => (
        <button key={r.key} type="button" data-hit={r.title} data-hit-kind={r.kind} onClick={() => onPick(r)} className="nd-press flex min-h-16 w-full items-center gap-3 border-b border-border text-left">
          <ShowArt seasonId={`search-${r.key}`} artUrl={r.art} name={r.title[0]} position={r.position} className="size-12 flex-none rounded-[3px] text-[22px]" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[16px]">{r.title}</b>
            <small className="block truncate text-[12px] text-muted-foreground">{r.sub}</small>
          </span>
          {picked ? (
            picked.has(r.key) && <span className="type-caption flex-none rounded-[2px] bg-chyron px-[7px] py-[3px] text-[11px] tracking-[0.05em] text-chyron-foreground">Picked</span>
          ) : (
            <StatePill state={r.state} />
          )}
        </button>
      ))}
    </div>
  );
}

/** "Add '<name>' as a new show": nothing found is called that. */
export function AddNewBlock({ q, any, onPick }: { q: string; any: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-add-new={q.trim()}
      onClick={onPick}
      className="nd-press mt-3 flex min-h-16 w-full items-center gap-3 rounded-[4px] p-3 text-left outline-1 -outline-offset-1 outline-dashed outline-input"
    >
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Plus className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] [overflow-wrap:anywhere]">Add &ldquo;{q.trim()}&rdquo; as a new show</b>
        <small className="block text-[12.5px] leading-snug text-muted-foreground">{any ? "Not one of these? " : ""}Added by name; its episodes come later</small>
      </span>
    </button>
  );
}

/** What the search is still doing, or couldn't. */
export function SearchNote({ loading, unavailable }: { loading: boolean; unavailable: boolean }) {
  if (!loading && !unavailable) return null;
  return (
    <p className="mt-3 text-[13px] text-muted-foreground" data-search-note>
      {loading ? "Looking in the TV listings…" : "The TV listings aren't answering right now, so these are the shows already here."}
    </p>
  );
}

/** TVmaze's data is CC BY-SA: credited, with a link back, wherever it's shown. */
export function ListingsCredit() {
  return (
    <p className="mt-4 text-center text-[12px] text-muted-foreground">
      TV listings from{" "}
      <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
        TVmaze
      </a>
    </p>
  );
}

/** A suggestion card (the mock's art grid): art, name, one line, a + or a tick. */
export function SuggestionCard({ title, sub, art, position, on, onClick }: { title: string; sub: string; art: string | null; position: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-suggest={title}
      aria-pressed={on}
      onClick={onClick}
      className={`relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-[4px] p-2.5 text-left text-white ${on ? "shadow-[0_0_0_3px_var(--chyron-line)]" : ""}`}
    >
      <ShowArt seasonId={`suggest-${title}`} artUrl={art} name={title} position={position} className="absolute inset-0 -z-[2] size-full" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_30%,rgba(10,8,14,.92))]" />
      <span aria-hidden className={`absolute right-2 top-2 grid size-[30px] place-items-center rounded-full ${on ? "bg-chyron text-chyron-foreground" : "bg-[rgba(10,8,14,.6)]"}`}>
        {on ? <Check className="size-4" strokeWidth={3} /> : <Plus className="size-4" />}
      </span>
      <b className="type-caption text-[18px] leading-none">{title}</b>
      <small className="mt-1 block truncate text-[12px] opacity-85">{on ? "On your list" : sub}</small>
    </button>
  );
}
