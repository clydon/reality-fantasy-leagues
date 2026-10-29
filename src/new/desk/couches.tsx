"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownUp, Search, Users } from "lucide-react";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, type CouchFilter, type CouchRow, type CouchSort, type CouchesList } from "./data";
import { dateOf, DeskHeader, IconLead, Section, useChangeToast } from "./parts";
import { useDebounced } from "./people";

// Find › Couches (docs/PLAN-desk-parity.md part 6d; the mock's desk.js DK_LIST.couches): a list like Games' (a couch's name
// or who runs it; All · Nobody runs it · New this month · Deleted; newest, most people, name; 25 at a time from the server,
// the search, filter and sort in the address), a deleted one carrying Restore (desk.js dkRestore: back with the games it
// took, Undo deleting it again). A couch's page and its Delete are pages.tsx's CouchPage. Server: src/lib/server/desk-couches.ts.

const FILTERS: [CouchFilter, string][] = [
  ["all", "All"],
  ["nobody", "Nobody runs it"],
  ["new", "New this month"],
  ["deleted", "Deleted"],
];
const SORTS: [CouchSort, string][] = [
  ["new", "Newest first"],
  ["big", "Most people"],
  ["name", "Name, A to Z"],
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TAG = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";

/** "Deleted by quinn Oct 29 · until Nov 28" (the mock's c.note). */
export const deletedNote = (d: { at: string; by: string | null; until: string }) => `Deleted${d.by ? ` by ${d.by}` : ""} ${dateOf(d.at)} · until ${dateOf(d.until)}`;

/** "6 people · 2 games · run by priya", "its games have no Commissioner", or (some of them) "· 1 nobody runs". */
function lineOf(c: CouchRow): string {
  const who =
    c.stranded && c.stranded === c.games
      ? "its games have no Commissioner"
      : `${c.runBy.length ? `run by ${c.runBy.join(", ")}` : "nobody runs it"}${c.stranded ? ` · ${c.stranded} nobody runs` : ""}`;
  return `${plural(c.people, "person", "people")} · ${plural(c.games, "game")} · ${who}`;
}

/** A deleted couch's Restore, from its row or its page: back with its people and the games it took, with Undo. */
export function useCouchRestore() {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  const restore = async (id: string) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/couches/${id}`, { restore: true });
      await after();
      said(out.text, out.changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { restore, busy };
}

/** One couch in a list (and in Find's search, `found`): its name and tag, then its people, games and who runs them; a
 *  deleted one says when it went and carries Restore. */
export function CouchListRow({ c, found }: { c: CouchRow; found?: boolean }) {
  const { restore, busy } = useCouchRestore();
  const tag = c.deleted ? (["Deleted", "text-live outline-1 -outline-offset-1 outline-live"] as const) : c.stranded ? (["Nobody runs it", "bg-chyron text-chyron-foreground"] as const) : null;
  const line = c.deleted ? deletedNote(c.deleted) : `${found ? "Couch · " : ""}${lineOf(c)}`;
  return (
    <div data-couch-row={c.name} data-couch-id={c.id} data-couch-state={c.deleted ? "deleted" : c.stranded ? "nobody" : "ok"} className="flex items-center gap-2.5 border-t border-border first:border-t-0">
      <NavLink href={paths.deskItem("couch", c.id)} data-desk-item={found ? "couch" : undefined} className="nd-press flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2.5">
        <IconLead icon={Users} />
        <span className="min-w-0 flex-1">
          <b className="line-clamp-2 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {c.name}
            {tag && <i className={`${TAG} ${tag[1]}`}>{tag[0]}</i>}
          </b>
          <small className="mt-[3px] line-clamp-2 block text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{line}</small>
        </span>
      </NavLink>
      {c.deleted && (
        <Btn data-couch-restore={c.id} className="h-11 flex-none px-3.5 text-[15px]" disabled={busy} onClick={() => void restore(c.id)}>
          Restore
        </Btn>
      )}
    </div>
  );
}

/** Find › Couches: filtered, sorted and searched, 25 at a time. */
export function CouchesPage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<CouchFilter>(FILTERS.some(([k]) => k === params.get("f")) ? (params.get("f") as CouchFilter) : "all");
  const [sort, setSort] = useState<CouchSort>(SORTS.some(([k]) => k === params.get("sort")) ? (params.get("sort") as CouchSort) : "new");
  const term = useDebounced(q.trim(), 200);
  // The list as it is, in the address: Back from a couch comes back to it.
  useEffect(() => {
    const href = paths.deskCouches({ q: term, f: f === "all" ? "" : f, sort: sort === "new" ? "" : sort });
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [term, f, sort]);
  const list = useInfiniteQuery({
    queryKey: ["new-design", "desk", "couches", term, f, sort],
    // The chips' counts come with the first page only.
    queryFn: ({ pageParam }) => deskGet<CouchesList>(`/couches?${new URLSearchParams({ q: term, f, sort, offset: String(pageParam), ...(pageParam ? { counts: "0" } : {}) })}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((a, p) => a + p.couches.length, 0);
      return n < last.total ? n : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = list.data?.pages ?? [];
  const couches = [...new Map(pages.flatMap((p) => p.couches).map((c) => [c.id, c])).values()];
  const total = pages[0]?.total ?? 0;
  const counts = pages[0]?.counts;
  const left = Math.max(0, total - pages.reduce((n, p) => n + p.couches.length, 0));
  return (
    <div className="pb-16" data-desk-couches>
      <DeskHeader title="Couches" back={{ label: "Find", href: paths.desk("find") }} />
      <Section className="mt-4">
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-couches-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Couch name, or who runs it"
            aria-label="Find a couch by its name, or who runs it"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {/* The first, the one you're on, and any with couches in it. */}
          {FILTERS.filter(([k]) => k === "all" || k === f || (counts?.[k] ?? 0) > 0).map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-couches-filter={k}
              aria-pressed={f === k}
              onClick={() => setF(k)}
              className={`inline-flex h-11 items-center gap-1.5 rounded-[2px] px-3.5 text-[15px] font-semibold transition-colors ${f === k ? "bg-foreground text-background" : "bg-secondary"}`}
            >
              {label}
              <span className={`type-num text-[15px] ${f === k ? "" : "text-muted-foreground"}`}>{counts ? counts[k] : ""}</span>
            </button>
          ))}
        </div>
        <div className="mt-1 flex min-h-11 items-center justify-between text-[13px] text-muted-foreground">
          <span data-couches-count>{list.data ? plural(total, "couch", "couches") : ""}</span>
          <label className="relative flex h-11 cursor-pointer items-center gap-1.5 rounded-[3px] pl-2 text-[14px] font-bold text-foreground focus-within:outline-3 focus-within:outline-chyron">
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
            {SORTS.find(([k]) => k === sort)?.[1]}
            <select data-couches-sort aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as CouchSort)} className="absolute inset-0 w-full cursor-pointer text-base opacity-0">
              {SORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!list.data ? (
          <div aria-busy className="mt-1 h-64 animate-pulse rounded-[4px] bg-card" />
        ) : couches.length ? (
          <div data-couches-list className="border-y border-border">
            {couches.map((c) => (
              <CouchListRow key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div data-couches-empty className="mt-1.5 flex flex-col items-center gap-2 rounded-[4px] bg-card px-4 py-8 text-center">
            {term ? (
              <>
                <b className="type-caption text-[22px]">Nothing matches &ldquo;{term}&rdquo;</b>
                {f !== "all" && (
                  <button type="button" data-couches-all onClick={() => setF("all")} className="text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                    Search all couches
                  </button>
                )}
              </>
            ) : (
              <b className="type-caption text-[22px]">Nothing here</b>
            )}
          </div>
        )}
        {left > 0 && (
          <button
            type="button"
            data-couches-more
            disabled={list.isFetchingNextPage}
            onClick={() => list.fetchNextPage()}
            className="nd-press mt-3.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-[3px] bg-card text-[14px] font-bold outline-1 -outline-offset-1 outline-input"
          >
            Show {Math.min(25, left)} more <span className="font-normal text-muted-foreground">· {left} left</span>
          </button>
        )}
      </Section>
    </div>
  );
}
