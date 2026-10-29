"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowDownUp, BookOpen, CalendarDays, Check, Globe, Image as ImageIcon, Plus, Search, Trophy, Tv, Type, Undo2, Users, X } from "lucide-react";
import { siteOf } from "@/lib/desk-show-sites";
import { pluralWord } from "@/lib/game/show-words";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { ArtSection } from "./art";
import { deskGet, deskSend, useAfterDesk, useDesk, type DeskShow, type ShowFilter, type ShowRow, type ShowSort, type ShowsList, type ShowWords } from "./data";
import { dateOf, DeleteRow, DeskHeader, DeskRow, Facts, Field, IconLead, LatestHistory, LowerThird, Says, Section, useChangeToast, useDebounced } from "./parts";
import { CON } from "./seats";
import { forgetDeskPage } from "./trail";

// A show on the desk (docs/PLAN-desk-parity.md part 7a; the mock's desk-shows.js and desk.js DK_LIST.shows, with step 7's
// Changes at approval: no wiki, so no wiki page on Add a season and the connector page is Research sites alone). Find › Shows
// (All · Airing · Not a game yet · Added by name · Archived; name or most games; 25 at a time, in the address; an archived
// one carries Restore). A show's page: its lower third (A game, Not a game yet, Added by name or Archived), Archived with
// Restore, or Added by name with Looks fine and Archive; Seasons (each with its status and games, the one airing with no
// schedule dotted) and Add a season; About the show (Research sites, Its words); its art (part 7b gives it a page); History;
// and its Delete, last (decision 4): refused while it has games, by season, with Archive it instead; else a hold. Every page
// under a show ends with the show's Delete. Server: src/lib/server/desk-shows.ts.

const FILTERS: [ShowFilter, string][] = [
  ["all", "All"],
  ["air", "Airing"],
  ["none", "Not a game yet"],
  ["byname", "Added by name"],
  ["archived", "Archived"],
];
const SORTS: [ShowSort, string][] = [
  ["name", "Name, A to Z"],
  ["games", "Most games"],
];
const KIND_WORDS: Record<string, string> = { competition: "A competition", series: "A series", talk: "A talk show", sport: "A sport" };
const STATUS_WORD = { upcoming: "Upcoming", airing: "Airing", completed: "Ended" } as const;
type Status = keyof typeof STATUS_WORD;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TAG = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";
const NOTE = "mt-2.5 text-[13px] leading-snug text-muted-foreground";
const LINK = "inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]";
const seasonWord = (kind: string | null, n: number) => (kind === "sport" ? `${n} season` : `Season ${n}`);

/** A show's art in a row or the lower third: its poster, else a TV in a square. */
function ArtLead({ url, size = 40 }: { url: string | null; size?: 40 | 64 }) {
  const box = size === 64 ? "size-16" : "size-10";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- a show's art from wherever it was found
    <img src={url} alt="" className={`${box} flex-none rounded-[3px] object-cover shadow-plate`} />
  ) : (
    <span className={`grid ${box} flex-none place-items-center rounded-[3px] bg-card`}>
      <Tv className={size === 64 ? "size-6 text-muted-foreground" : "size-5 text-muted-foreground"} aria-hidden />
    </span>
  );
}

/** A desk change on a show: every desk read moves on, then its toast with Undo. */
function useShowChange(id: string) {
  const after = useAfterDesk();
  const said = useChangeToast();
  return async (body: Record<string, unknown>) => {
    try {
      const out = await deskSend<DeskShow & { changeId?: string; text?: string; seasonId?: string }>(`/shows/${id}`, body);
      await after();
      if (out.text) said(out.text, out.changeId);
      return out;
    } catch (e) {
      toast.quiet((e as Error).message);
      throw e;
    }
  };
}

// ---------- Find › Shows ----------

/** "A game · Season 51 airing · 14 games", "Not a game yet · Season 2 · 3 watching", "Archived Oct 20 · out of everyone's search". */
function lineOf(x: ShowRow, found?: boolean): string {
  if (x.archived) return `Archived ${dateOf(x.archived.at)} · out of everyone's search`;
  const season = x.season ? `${x.season}${x.airing ? " airing" : ""}` : "No seasons";
  const what = x.kind ? `${x.kind === "competition" ? "A game" : `A game · ${x.kind === "talk" ? "talk show" : x.kind}`} · ${season} · ${plural(x.games, "game")}` : `Not a game yet · ${season}${x.watching ? ` · ${x.watching} watching` : ""}`;
  return `${found ? "Show · " : ""}${what}`;
}

/** An archived show's Restore, from its row or its page: back in everyone's search, with Undo. */
function useRestoreShow() {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  const restore = async (id: string) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/shows/${id}`, { restore: true });
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

/** One show in a list (and in Find's search, `found`). */
export function ShowListRow({ x, found }: { x: ShowRow; found?: boolean }) {
  const { restore, busy } = useRestoreShow();
  const tag = x.archived ? (["Archived", "text-muted-foreground outline-1 -outline-offset-1 outline-input"] as const) : x.byName ? (["Added by name", "bg-chyron text-chyron-foreground"] as const) : null;
  return (
    <div data-show-row={x.name} data-show-id={x.id} data-show-state={x.archived ? "archived" : x.byName ? "byname" : x.kind ? "game" : "watching"} className="flex items-center gap-2.5 border-t border-border first:border-t-0">
      <NavLink href={paths.deskItem("show", x.id)} data-desk-item={found ? "show" : undefined} className="nd-press flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2.5">
        <ArtLead url={x.art} />
        <span className="min-w-0 flex-1">
          <b className="line-clamp-2 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {x.name}
            {tag && <i className={`${TAG} ${tag[1]}`}>{tag[0]}</i>}
          </b>
          <small className="mt-[3px] line-clamp-2 block text-[13px] leading-snug text-muted-foreground">{lineOf(x, found)}</small>
        </span>
      </NavLink>
      {x.archived && (
        <Btn data-show-restore={x.id} className="h-11 flex-none px-3.5 text-[15px]" disabled={busy} onClick={() => void restore(x.id)}>
          Restore
        </Btn>
      )}
    </div>
  );
}

/** Find › Shows: filtered, sorted and searched, 25 at a time. */
export function ShowsPage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<ShowFilter>(FILTERS.some(([k]) => k === params.get("f")) ? (params.get("f") as ShowFilter) : "all");
  const [sort, setSort] = useState<ShowSort>(SORTS.some(([k]) => k === params.get("sort")) ? (params.get("sort") as ShowSort) : "name");
  const term = useDebounced(q.trim(), 200);
  // The list as it is, in the address: Back from a show comes back to it.
  useEffect(() => {
    const href = paths.deskShows({ q: term, f: f === "all" ? "" : f, sort: sort === "name" ? "" : sort });
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [term, f, sort]);
  const list = useInfiniteQuery({
    queryKey: ["new-design", "desk", "shows", term, f, sort],
    queryFn: ({ pageParam }) => deskGet<ShowsList>(`/shows?${new URLSearchParams({ q: term, f, sort, offset: String(pageParam), ...(pageParam ? { counts: "0" } : {}) })}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((a, p) => a + p.shows.length, 0);
      return n < last.total ? n : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = list.data?.pages ?? [];
  const shows = [...new Map(pages.flatMap((p) => p.shows).map((x) => [x.id, x])).values()];
  const total = pages[0]?.total ?? 0;
  const counts = pages[0]?.counts;
  const left = Math.max(0, total - pages.reduce((n, p) => n + p.shows.length, 0));
  return (
    <div className="pb-16" data-desk-shows>
      <DeskHeader title="Shows" back={{ label: "Find", href: paths.desk("find") }} />
      <Section className="mt-4">
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-shows-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Show name"
            aria-label="Find a show by its name"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {/* The first, the one you're on, and any with shows in it. */}
          {FILTERS.filter(([k]) => k === "all" || k === f || (counts?.[k] ?? 0) > 0).map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-shows-filter={k}
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
          <span data-shows-count>{list.data ? plural(total, "show") : ""}</span>
          <label className="relative flex h-11 cursor-pointer items-center gap-1.5 rounded-[3px] pl-2 text-[14px] font-bold text-foreground focus-within:outline-3 focus-within:outline-chyron">
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
            {SORTS.find(([k]) => k === sort)?.[1]}
            <select data-shows-sort aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as ShowSort)} className="absolute inset-0 w-full cursor-pointer text-base opacity-0">
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
        ) : shows.length ? (
          <div data-shows-list className="border-y border-border">
            {shows.map((x) => (
              <ShowListRow key={x.id} x={x} />
            ))}
          </div>
        ) : (
          <div data-shows-empty className="mt-1.5 flex flex-col items-center gap-2 rounded-[4px] bg-card px-4 py-8 text-center">
            {term ? (
              <>
                <b className="type-caption text-[22px]">Nothing matches &ldquo;{term}&rdquo;</b>
                {f !== "all" && (
                  <button type="button" data-shows-all onClick={() => setF("all")} className="text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                    Search all shows
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
            data-shows-more
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

// ---------- a show ----------

const Loading = () => <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
const toShows = { label: "Shows", href: paths.deskShows() };

/** A season's number in its square (the mock's .dk-sn). */
const SeasonNumber = ({ n }: { n: number }) => (
  <span className={`type-num grid h-10 min-w-10 flex-none place-items-center rounded-[3px] bg-card px-1 ${n >= 1000 ? "text-[17px]" : "text-[24px]"}`}>{n}</span>
);

/** "Upcoming · no schedule yet · 0 games", "Airing · 15 games"; the newest of a show that isn't a game says so first. */
function seasonLine(s: DeskShow, x: DeskShow["seasons"][number], newest: boolean): string {
  const pre = newest && !s.setUp ? "Not a game yet · " : "";
  return `${pre}${STATUS_WORD[x.status]}${!x.scheduled && x.status !== "completed" ? " · no schedule yet" : ""} · ${plural(x.games, "game")}`;
}

/** The show's lower third and, on every page under it, its name and art. */
function ShowThird({ s, tag, tone, detail }: { s: DeskShow; tag?: string; tone?: "quiet" | "stopped"; detail?: string }) {
  const newest = s.seasons[0];
  const own =
    s.archived
      ? "Out of everyone's search"
      : s.setUp
        ? `${KIND_WORDS[s.kind ?? ""] ?? "A competition"} · ${plural(s.seasons.length, "season")} here`
        : `${newest ? `${seasonWord(null, newest.number)}${newest.status === "airing" ? " airing" : ""}` : "No seasons yet"}${s.watching ? ` · ${s.watching} watching` : ""}`;
  return (
    <LowerThird
      lead={<ArtLead url={s.art.off ? null : s.art.poster} size={64} />}
      tag={tag ?? (s.archived ? "Archived" : s.added && !s.added.listing && !s.setUp ? "Added by name" : s.setUp ? "A game" : "Not a game yet")}
      tone={tone ?? (s.archived ? "stopped" : "quiet")}
      title={s.name}
      detail={detail ?? own}
    />
  );
}

export function ShowPage({ id }: { id: string }) {
  const q = useDesk<DeskShow>(`/shows/${id}`);
  const change = useShowChange(id);
  const after = useAfterDesk();
  const { restore, busy } = useRestoreShow();
  const [sheet, setSheet] = useState<"add" | "words" | null>(null);
  if (q.error)
    return (
      <>
        <DeskHeader title="Show" back={toShows} name={null} />
        <EmptyState title="Not here" line={(q.error as Error)?.message ?? "It's gone."} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Show" back={toShows} name={null} />
        <Loading />
      </>
    );
  const s = q.data;
  const byName = !!s.added && !s.added.listing;
  // The art's own actions (part 7b gives them a page): each answers the show as it is, with a toast.
  const artAct = async (body: unknown, done: string) => {
    try {
      const out = await deskSend<DeskShow>(`/shows/${id}`, body);
      await after();
      toast(done);
      return out;
    } catch (e) {
      toast.quiet((e as Error).message);
      throw e;
    }
  };
  const playing = s.delete.blocked.reduce((n, b) => n + (b.states.playing ?? 0), 0);
  return (
    <div className="pb-16" data-desk-show={s.archived ? "archived" : s.setUp ? "game" : "watching"}>
      <DeskHeader title="Show" back={toShows} name={s.name} kind="Show" />
      <ShowThird s={s} />
      <Facts>{s.added ? `Added by ${s.added.by ?? "someone"} ${s.added.listing ? "from the TV listings" : "by name"}` : "From the TV listings"}</Facts>
      {s.archived ? (
        <section className="mt-5 px-4">
          <div data-show-archived className="rounded-[4px] p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">Archived</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              Out of everyone&apos;s search, Add a show and the TV listings since {dateOf(s.archivedAt ?? new Date().toISOString())}. Anyone following it keeps it
              {playing ? `, and its ${plural(playing, "game")} ${playing === 1 ? "plays" : "play"} on` : ""}. While it&apos;s archived, adding &ldquo;{s.name}&rdquo; by name makes a new show.
            </small>
            <Btn data-show-restore-page wide className="mt-3" disabled={busy} onClick={() => void restore(id)}>
              <Undo2 className="size-[18px]" aria-hidden />
              Restore {s.name}
            </Btn>
          </div>
        </section>
      ) : (
        byName &&
        !s.reviewed &&
        !s.setUp && (
          <section className="mt-5 px-4">
            <div data-show-review className="rounded-[4px] p-3.5 outline-1 -outline-offset-1 outline-input">
              <b className="block text-[17px]">Added by name: not in the TV listings</b>
              <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
                It&apos;s in everyone&apos;s search with no schedule. Keep it if it&apos;s a real show; archive it if it isn&apos;t (anyone following it keeps it).
              </small>
              <div className="mt-3 flex gap-2">
                <Btn
                  data-show-fine
                  className="h-11 flex-1 text-[15px]"
                  onClick={async () => {
                    try {
                      await deskSend(`/shows/${id}`, { action: "reviewed" });
                      await after();
                      toast("Looks fine · it stays in search");
                    } catch (e) {
                      toast.quiet((e as Error).message);
                    }
                  }}
                >
                  Looks fine
                </Btn>
                <Btn data-show-archive className="h-11 flex-1 text-[15px]" onClick={() => void change({ archive: true }).catch(() => {})}>
                  Archive
                </Btn>
              </div>
            </div>
          </section>
        )
      )}
      <Section title="Seasons" aside={plural(s.seasons.length, "season")}>
        <div className="border-b border-border">
          {s.seasons.map((x, i) => (
            <DeskRow
              key={x.id}
              data={`season-${x.number}`}
              href={paths.deskItem("season", x.id)}
              lead={<SeasonNumber n={x.number} />}
              title={x.ownName ?? seasonWord(s.kind, x.number)}
              dot={x.status === "airing" && !x.scheduled ? "need" : undefined}
              line={seasonLine(s, x, i === 0)}
            />
          ))}
          <DeskRow data="show-add-season" onClick={() => setSheet("add")} lead={<IconLead icon={Plus} />} title="Add a season" line="Its number and status" />
        </div>
        {!s.setUp && s.seasons[0] && (
          <NavLink href={paths.deskNew(s.seasons[0].id)} data-show-make className={`${LINK} mt-1`}>
            Make it a game: set its rules up
          </NavLink>
        )}
      </Section>
      <Section title="About the show">
        <div className="border-b border-border">
          <DeskRow
            data="show-sites"
            href={paths.deskShowPage(id, "sites")}
            lead={<IconLead icon={Globe} />}
            title="Research sites"
            line={s.sites.own ? `${plural(s.sites.list.length, "site")}, its own: ${s.sites.list.slice(0, 2).map((x) => x.host).join(", ")}${s.sites.list.length > 2 ? "…" : ""}` : `Our usual: ${s.sites.usual.join(", ")}`}
          />
          <DeskRow
            data="show-words"
            onClick={() => setSheet("words")}
            lead={<IconLead icon={Type} />}
            title="Its words"
            line={`${s.words.people[0].toUpperCase()}${s.words.people.slice(1)}, ${s.words.groups}, ${pluralWord(s.words.episode).toLowerCase()}`}
          />
        </div>
      </Section>
      <ArtSection show={s} act={artAct} />
      <LatestHistory lines={s.history} emptyLine="Nothing changed here yet." />
      <ShowDeleteRow s={s} />
      <AddSeasonSheet open={sheet === "add"} onClose={() => setSheet(null)} s={s} />
      <WordsSheet open={sheet === "words"} onClose={() => setSheet(null)} s={s} change={change} />
    </div>
  );
}

// ---------- Add a season ----------

const ADD_STATUS: [Status, string][] = [
  ["upcoming", "Not on yet: no episode counts as aired. Games can start ahead of it."],
  ["airing", "On now: each episode counts as aired once its time passes, so it needs a schedule."],
  ["completed", "Over: every episode counts as aired, and no new games start on it."],
];

/** One thing that comes with it (the mock's .dk-pts). */
const Point = ({ icon: Icon, children }: { icon: typeof Check; children: ReactNode }) => (
  <li className="flex gap-2.5 text-[15px] leading-snug text-muted-foreground">
    <Icon className="mt-0.5 size-[18px] flex-none text-foreground" aria-hidden />
    <span>{children}</span>
  </li>
);

function AddSeasonSheet({ open, onClose, s }: { open: boolean; onClose: () => void; s: DeskShow }) {
  const top = s.seasons.reduce((m, x) => Math.max(m, x.number), 0);
  // Untouched (null), it opens on the next one, Upcoming; closing forgets what was picked.
  const [picked, setPicked] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const after = useAfterDesk();
  const client = useQueryClient();
  const nav = useNav();
  const n = picked ?? top + 1;
  const status = chosen ?? "upcoming";
  const setN = (f: (v: number) => number) => setPicked(f(n));
  const setStatus = setChosen;
  const shut = () => {
    setPicked(null);
    setChosen(null);
    setError(null);
    onClose();
  };
  const sport = s.kind === "sport";
  const word = seasonWord(s.kind, n);
  const dup = s.seasons.some((x) => x.number === n);
  const last = s.seasons[0];
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await deskSend<{ seasonId: string; changeId: string; text: string }>(`/shows/${s.id}`, { action: "season", number: n, status });
      shut();
      await after();
      nav.push(paths.deskItem("season", out.seasonId));
      // Its Undo takes the season away again, so it leaves the season's page first, back to the show (the mock's toast).
      toast(out.text, {
        undo: async () => {
          try {
            await deskSend(`/changes/${out.changeId}/undo`, {});
            forgetDeskPage(paths.deskItem("season", out.seasonId));
            const show = paths.deskItem("show", s.id);
            nav.back(show, (prev) => prev === show);
            toast("Undone");
            await client.invalidateQueries({ queryKey: ["new-design"], predicate: (x) => !String(x.queryKey[2] ?? "").startsWith(`/seasons/${out.seasonId}`) });
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Add a season" subtitle={s.name}>
      <div data-add-season className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <b className="block text-[17px]">{sport ? "Year" : "Season"}</b>
          <small data-add-season-line className={`block text-[14px] leading-snug ${dup ? "font-bold text-live" : "text-muted-foreground"}`}>
            {dup ? `${word} is here already` : n === top + 1 ? "The next one" : n > top ? "Later than the next one" : "An earlier one"}
          </small>
        </span>
        <button type="button" data-step="-1" aria-label={sport ? "Earlier" : "Lower"} onClick={() => setN((v) => Math.max(1, v - 1))} className="grid size-11 place-items-center rounded-[3px] bg-secondary text-[22px] font-bold">
          −
        </button>
        <b data-add-season-n className="type-num min-w-14 text-center text-[30px] leading-none">
          {n}
        </b>
        <button type="button" data-step="1" aria-label={sport ? "Later" : "Higher"} onClick={() => setN((v) => Math.min(9999, v + 1))} className="grid size-11 place-items-center rounded-[3px] bg-secondary text-[22px] font-bold">
          +
        </button>
      </div>
      <div className="mt-5">
        <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">Status</span>
        <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-1 rounded-[4px] p-1 outline-1 -outline-offset-1 outline-input">
          {ADD_STATUS.map(([k]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={status === k}
              data-add-status={k}
              onClick={() => setStatus(k)}
              className={`h-11 rounded-[3px] text-[15px] font-bold transition-colors ${status === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {STATUS_WORD[k]}
            </button>
          ))}
        </div>
        <small data-add-status-line className="mt-1.5 block text-[13px] leading-snug text-muted-foreground">
          {ADD_STATUS.find(([k]) => k === status)?.[1]}
        </small>
      </div>
      <h3 className="type-caption mb-2.5 mt-5 text-[17px] tracking-[0.04em] text-muted-foreground">What comes with it</h3>
      <ul data-add-season-what className="flex flex-col gap-2.5">
        <Point icon={BookOpen}>{s.setUp ? `It plays by ${last ? `${last.name}'s` : "the show's"} rulebook, as its next season.` : "Not a game yet: Make it a game sets its rules up."}</Point>
        <Point icon={CalendarDays}>
          {status === "airing"
            ? "It needs a schedule: its Setup is next, and it waits in your Inbox until it has one."
            : status === "upcoming"
              ? "Its schedule comes from the TV listings once they list it, or set it in its Setup."
              : "No schedule needed: every episode counts as aired."}
        </Point>
        <Point icon={Users}>Its cast: ask our bot for it on its Cast page.</Point>
        <Point icon={ImageIcon}>Its art and photos are found on their own.</Point>
        <Point icon={Check}>Results from sources that agree, like every season.</Point>
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-live">
          {error}
        </p>
      )}
      <Btn data-add-season-go tone="must" wide className="mt-4" disabled={dup || busy} onClick={() => void add()}>
        {dup ? "Pick a number that isn't here" : `Add ${word}`}
      </Btn>
    </Sheet>
  );
}

// ---------- its words ----------

const WORD_FIELDS: [keyof ShowWords, string][] = [
  ["person", "One person"],
  ["people", "Many"],
  ["group", "One group"],
  ["groups", "Many"],
];

function WordsSheet({ open, onClose, s, change }: { open: boolean; onClose: () => void; s: DeskShow; change: (body: Record<string, unknown>) => Promise<unknown> }) {
  // What's typed over its words; closing forgets it.
  const [edit, setEdit] = useState<Partial<ShowWords>>({});
  const [busy, setBusy] = useState(false);
  const w: ShowWords = { ...s.words, ...edit };
  const shut = () => {
    setEdit({});
    onClose();
  };
  const changed = (Object.keys(w) as (keyof ShowWords)[]).some((k) => w[k].trim() !== s.words[k]);
  const blank = (Object.keys(w) as (keyof ShowWords)[]).some((k) => !w[k].trim());
  const set = (k: keyof ShowWords) => (e: { target: { value: string } }) => setEdit((o) => ({ ...o, [k]: e.target.value }));
  const sample = `${s.sample.people} ${w.people.trim() || "…"}${s.sample.groups ? ` in ${s.sample.groups} ${w.groups.trim() || "…"}` : ""} · ${w.episode.trim() || "…"} ${s.sample.episode} is tonight`;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Its words" subtitle={s.name}>
      <div data-words className="grid grid-cols-2 gap-x-2.5">
        {WORD_FIELDS.map(([k, label]) => (
          <div key={k} className="mt-3.5 first:mt-0 [&:nth-child(2)]:mt-0">
            <Field data={`word-${k}`} label={label} value={w[k]} maxLength={40} onChange={set(k)} />
          </div>
        ))}
      </div>
      <div className="mt-3.5">
        <Field data="word-episode" label="Each episode is a" value={w.episode} maxLength={40} onChange={set("episode")} />
      </div>
      <p data-words-sample className="mt-3.5 rounded-[3px] bg-background p-3 text-[16px] leading-snug">
        {sample}
      </p>
      <p className={NOTE}>Used everywhere in the app, and each season&apos;s rulebook takes them too: its How it works, stats and research questions.</p>
      {s.rulebook && (
        <NavLink href={paths.deskItem("rulebook", s.rulebook.id)} data-words-rulebook onClick={shut} className={LINK}>
          {s.rulebook.season}&apos;s rulebook
        </NavLink>
      )}
      <Btn
        data-words-save
        tone="must"
        wide
        className="mt-3"
        disabled={!changed || blank || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await change({ words: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.trim()])) });
            shut();
          } catch {
            /* toasted */
          } finally {
            setBusy(false);
          }
        }}
      >
        Save
      </Btn>
    </Sheet>
  );
}

// ---------- its Delete ----------

const STATE_WORD: Record<string, string> = { playing: "playing", ended: "ended", archived: "archived", deleted: "deleted" };

/** The show's Delete, last on its page and every page under it (decision 4): refused while it has games, else a hold. */
export function ShowDeleteRow({ s }: { s: DeskShow }) {
  const nav = useNav();
  const client = useQueryClient();
  const change = useShowChange(s.id);
  const [open, setOpen] = useState(false);
  const d = s.delete;
  const blocked = d.games > 0;
  const archive = async () => {
    setOpen(false);
    await change({ archive: true }).catch(() => {});
  };
  return (
    <>
      <DeleteRow data="show" title={`Delete ${s.name}`} line={d.line} onClick={() => setOpen(true)} />
      <Sheet open={open && blocked} onOpenChange={setOpen} title={`${s.name} can't go yet`} subtitle="Not while it has games">
        <Says data="show-blocked">
          {plural(d.games, "game")} {d.games === 1 ? "is" : "are"} on its seasons. Ended and deleted games count too: a deleted one is kept until it&apos;s gone for good. Delete them first, then the show.
        </Says>
        {!s.archived && (
          <>
            <Btn data-show-archive-instead wide className="mt-3.5" onClick={() => void archive()}>
              <Archive className="size-[18px]" aria-hidden />
              Archive it instead
            </Btn>
            <p className="mt-1.5 text-center text-[13px] leading-snug text-muted-foreground">Out of everyone&apos;s search; its games play on, and anyone following it keeps it.</p>
          </>
        )}
        <div className="mb-1 mt-5 flex items-baseline justify-between">
          <h3 className="type-caption text-[17px] tracking-[0.04em] text-muted-foreground">In the way</h3>
          <span className="text-[13px] text-muted-foreground">{plural(d.games, "game")}</span>
        </div>
        <div data-show-blockers className="border-b border-border">
          {d.blocked.map((b) =>
            b.one ? (
              <DeskRow
                key={b.label}
                data="show-blocker"
                href={paths.deskItem("game", b.one.id)}
                lead={<IconLead icon={Trophy} />}
                title={
                  <>
                    {b.one.name}
                    {b.one.state !== "playing" && <i className={`${TAG} ${b.one.state === "deleted" ? "text-live outline-1 -outline-offset-1 outline-live" : "text-muted-foreground outline-1 -outline-offset-1 outline-input"}`}>{STATE_WORD[b.one.state]}</i>}
                  </>
                }
                line={`${b.label}${b.one.couch ? ` · ${b.one.couch}` : ""}`}
              />
            ) : (
              <DeskRow
                key={b.label}
                data="show-blocker"
                href={b.seasonId ? paths.deskItem("season", b.seasonId) : undefined}
                lead={<ArtLead url={s.art.off ? null : s.art.poster} />}
                title={b.label}
                line={`${plural(b.count, "game")}: ${(["playing", "ended", "archived", "deleted"] as const)
                  .filter((k) => b.states[k])
                  .map((k) => `${b.states[k]} ${STATE_WORD[k]}`)
                  .join(", ")}`}
              />
            )
          )}
        </div>
        <p className={NOTE}>Each season&apos;s Delete lists its games; each game&apos;s page ends with its delete.</p>
      </Sheet>
      <HoldSheet
        open={open && !blocked}
        onOpenChange={setOpen}
        title={`Delete ${s.name}?`}
        subtitle="This can't be undone"
        consequence=""
        body={
          <ul data-show-delete className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
            <li className={CON}>{d.seasons === 1 ? "Its season goes" : d.seasons ? `Its ${d.seasons} seasons go` : "It goes"}, with every episode, cast and result.</li>
            {d.pools + d.practice > 0 && (
              <li className={CON}>
                {[d.pools ? plural(d.pools, "public pool") : null, d.practice ? plural(d.practice, "practice game") : null].filter(Boolean).join(" and ")} on it {d.pools + d.practice === 1 ? "goes" : "go"} too.
              </li>
            )}
            {d.followers > 0 && (
              <li className={CON}>
                {plural(d.followers, "person", "people")} following it {d.followers === 1 ? "loses" : "lose"} it from their shows and the guide, with any watch along planned for it.
              </li>
            )}
            <li className={CON}>Couches&apos; chat about it goes too.</li>
          </ul>
        }
        alt={s.archived ? undefined : { label: "Archive it instead", line: "Out of everyone's search; anyone following it keeps it.", onClick: () => void archive() }}
        cta={`delete ${s.name}`}
        restore="Can't be undone"
        onConfirm={async () => {
          const out = await deskSend<{ text: string }>(`/shows/${s.id}`, {}, "DELETE");
          forgetDeskPage(paths.deskItem("show", s.id));
          forgetDeskPage(paths.deskShowPage(s.id, "sites"));
          for (const x of s.seasons) forgetDeskPage(paths.deskItem("season", x.id));
          nav.back(paths.deskShows(), (prev) => prev === "/desk/shows");
          toast(out.text);
          // Every desk read moves on but this show's own, which are gone.
          await client.invalidateQueries({ queryKey: ["new-design"], predicate: (x) => !String(x.queryKey[2] ?? "").startsWith(`/shows/${s.id}`) });
        }}
      />
    </>
  );
}

// ---------- Research sites ----------

const FROM_WORD = (show: string) => ({ wiki: "Its wiki", usual: "One of our usual", added: `Added for ${show}` });

/** A show's Research sites (the connector page's one section since approval): the sites our bot's prompt starts from. */
export function SitesPage({ id }: { id: string }) {
  const q = useDesk<DeskShow>(`/shows/${id}`);
  const change = useShowChange(id);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const back = { label: "Show", href: paths.deskItem("show", id) };
  if (q.error)
    return (
      <>
        <DeskHeader title="Research sites" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error)?.message ?? "It's gone."} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Research sites" back={back} name={null} />
        <Loading />
      </>
    );
  const s = q.data;
  const sites = s.sites;
  const words = FROM_WORD(s.name);
  const go = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    await change({ sites: body }).catch(() => {});
    setBusy(null);
  };
  return (
    <div className="pb-16" data-desk-sites={sites.own ? "own" : "usual"}>
      <DeskHeader title="Research sites" back={{ label: s.name, href: paths.deskItem("show", id) }} name="Research sites" />
      <ShowThird s={s} tag="Research" detail={sites.own ? `${plural(sites.list.length, "site")}, its own` : "Our usual sites"} />
      <Facts>The sites our bot&apos;s research looks at first, for every season of {s.name}, and the copy-and-paste brief too.</Facts>
      <Section title="Research sites" aside={sites.own ? plural(sites.list.length, "site") : "Our usual"}>
        <p className="-mt-1 mb-2 text-[13px] leading-snug text-muted-foreground">Research asks the AI to look here first, for every season.</p>
        <div data-sites className="border-b border-border">
          {sites.list.map((x) => (
            <div key={x.host} data-site={x.host} className="flex min-h-[62px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
              <IconLead icon={Globe} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[16px] font-semibold leading-snug">{x.host}</b>
                <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{words[x.from]}</small>
              </span>
              <button
                type="button"
                data-site-off={x.host}
                aria-label={`Take ${x.host} off`}
                disabled={busy !== null}
                onClick={() => void go(x.host, { remove: x.host })}
                className="nd-press grid size-11 flex-none place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input disabled:opacity-60"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          ))}
          <DeskRow data="site-add" onClick={() => setAdding(true)} lead={<IconLead icon={Plus} />} title="Add a site" line="An address, or just its name" />
        </div>
        {sites.own && (
          <button type="button" data-sites-usual disabled={busy !== null} onClick={() => void go("usual", { usual: true })} className={`${LINK} mt-1`}>
            Back to our usual {sites.usual.length === 3 ? "three" : sites.usual.length === 2 ? "two" : ""}
          </button>
        )}
        <p className={NOTE}>Changes reach the next research run. What&apos;s in already stays.</p>
      </Section>
      <LatestHistory lines={s.history} emptyLine="Nothing changed here yet." />
      <ShowDeleteRow s={s} />
      <AddSiteSheet open={adding} onClose={() => setAdding(false)} s={s} onAdd={(host) => go("add", { add: host })} />
    </div>
  );
}

function AddSiteSheet({ open, onClose, s, onAdd }: { open: boolean; onClose: () => void; s: DeskShow; onAdd: (host: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const shut = () => {
    setText("");
    onClose();
  };
  const host = siteOf(text);
  const dup = !!host && s.sites.list.some((x) => x.host === host);
  const kept = host && text.trim().toLowerCase() !== host;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && shut()} title="Add a site" subtitle={`${s.name} · research looks here first`}>
      <Field
        data="site"
        label="The site"
        value={text}
        inputMode="url"
        placeholder="insidesurvivor.com"
        onChange={(e) => setText(e.target.value)}
        hint={kept ? `Kept as ${host}.` : "Paste any page from it, or type its name: only its address is kept."}
      />
      <Btn
        data-site-go
        tone="must"
        wide
        className="mt-4"
        disabled={!host || dup}
        onClick={async () => {
          if (!host || dup) return;
          shut();
          await onAdd(host);
        }}
      >
        {dup ? `${host} is on the list already` : host ? `Add ${host}` : "Add it"}
      </Btn>
    </Sheet>
  );
}
