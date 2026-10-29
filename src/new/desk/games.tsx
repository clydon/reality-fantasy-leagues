"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, BookOpen, ChevronRight, Copy, Eye, Search, Trophy, Tv, Users } from "lucide-react";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { toast } from "../ui/toast";
import { setCouch } from "../data";
import { startReadOnly } from "../read-only";
import { deskGet, deskSend, useAfterDesk, useDesk, type DeskGame, type GameFilter, type GameOpen, type GameRow, type GameSeats, type GameSort, type GamesList } from "./data";
import { dateOf, DeleteRow, DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { useDebounced } from "./people";
import { CON, GameSeatsSection, HandOnSheet } from "./seats";
import { forgetDeskPage } from "./trail";

// Games on the desk (docs/PLAN-desk-parity.md step 6, part 6a; the mock's desk.js DK_LIST.games and desk-games.js): Find ›
// Games, a list like People's (a game's name, season, show, couch or join code; Playing · Nobody runs it · Ended · Archived
// · Deleted; newest, most players, name; 25 at a time, the search, filter and sort in the address), where a code-shaped
// search finds its game whatever the filter, deleted ones within 30 days too (with Restore), and says why when no game has
// it; and a game's page: its lower third and facts, Restore or Hand it on when it needs one, Part of (its couch, its season,
// its rulebook), its Join code, its Seats (part 6b: seats.tsx), History, and its Delete last (decision 4): Archive offered
// first, then restorable for 30 days, and for a deleted one Delete it for good, now. Open <game> (part 6c) opens it in the
// app: as you when you play it, else read-only as its couch sees it (src/new/read-only.tsx).
// Server: src/lib/server/desk-games.ts and desk-seat-moves.ts.

const FILTERS: [GameFilter, string][] = [
  ["all", "Playing"],
  ["nobody", "Nobody runs it"],
  ["ended", "Ended"],
  ["archived", "Archived"],
  ["deleted", "Deleted"],
];
const SORTS: [GameSort, string][] = [
  ["new", "Newest first"],
  ["big", "Most players"],
  ["name", "Name, A to Z"],
];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TAG = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";
const STATE_TAG: Partial<Record<GameRow["state"], [string, string]>> = {
  nobody: ["Nobody runs it", "bg-chyron text-chyron-foreground"],
  ended: ["Ended", "text-foreground outline-1 -outline-offset-1 outline-foreground"],
  archived: ["Archived", "text-foreground outline-1 -outline-offset-1 outline-foreground"],
  deleted: ["Deleted", "text-live outline-1 -outline-offset-1 outline-live"],
};
const MARK = "bg-transparent text-foreground underline decoration-chyron underline-offset-[3px]";

/** Where a game is: its couch, or what it is on no couch. */
const whereOf = (g: Pick<GameRow, "couch" | "solo">) => g.couch?.name ?? (g.solo === "practice" ? "a practice game" : g.solo === "public" ? "the season's public pool" : "on no couch");

/**
 * Open <game> (part 6c; the mock's dgOpenRow): you play it, so it opens as you on its couch; else read-only, as its couch
 * sees it, at your own spoiler mark, a line in its History first (desk-games.ts openReadOnly).
 */
function OpenRow({ g, open }: { g: DeskGame; open: GameOpen }) {
  const nav = useNav();
  const client = useQueryClient();
  const after = useAfterDesk();
  const [busy, setBusy] = useState(false);
  const over = g.state === "ended" || g.archived !== null;
  const line =
    open.as === "you"
      ? "You play it: it opens as you"
      : over
        ? "As it ended, read-only"
        : `As its couch sees it, read-only · ${open.mark === null ? "all of it: you see results straight away" : open.mark ? `up to ${open.episode} ${open.mark}, where you are` : "as far as you've watched"}`;
  const go = async () => {
    if (open.as === "you") {
      setCouch(open.couchId);
      nav.push(paths.show(open.seasonId, "games"));
      return;
    }
    setBusy(true);
    try {
      const o = await deskSend<{ leagueId: string; name: string; seasonId: string; couchId: string; couch: string }>(`/games/${g.id}`, { open: true });
      await after();
      startReadOnly(client, { ...o, runBy: g.runBy });
      nav.push(paths.show(o.seasonId, "games"));
    } catch (e) {
      toast.quiet((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <section className="mt-5 px-4">
      <button
        type="button"
        data-game-open={open.as}
        disabled={busy}
        onClick={() => void go()}
        className="nd-press flex min-h-[76px] w-full items-center gap-3 rounded-[4px] bg-card p-3 text-left outline-1 -outline-offset-1 outline-input"
      >
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-foreground text-background">
          <Eye className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[17px] font-semibold">Open {g.name}</b>
          <small className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">{line}</small>
        </span>
        <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
    </section>
  );
}

/** "Archived Oct 18 by quinn · on the trophy shelf", "deleted by omar Oct 26 · until Nov 25", else null. */
function noteOf(g: GameRow): string | null {
  if (g.deleted) return `deleted${g.deleted.by ? ` by ${g.deleted.by}` : ""} ${dateOf(g.deleted.at)} · until ${dateOf(g.deleted.until)}`;
  if (g.archived) return `Archived ${dateOf(g.archived.at)}${g.archived.by ? ` by ${g.archived.by}` : ""} · on the trophy shelf`;
  return null;
}

/** Why no game has a code: one it can't be, a start no code has, or a whole one nobody has. */
function codeWhy(code: string): string {
  if (/[01OI]/.test(code)) return "Codes never have a 0, O, 1 or I, so it was misread somewhere.";
  if (code.length < 6) return "No code starts that way. Codes are six letters and numbers.";
  return "Check it with whoever sent it.";
}

function Code({ code, hit }: { code: string; hit: string | null }) {
  return hit && code.startsWith(hit) ? (
    <span className="tabular-nums tracking-[0.04em] text-foreground">
      <mark data-code-hit className={MARK}>
        {code.slice(0, hit.length)}
      </mark>
      {code.slice(hit.length)}
    </span>
  ) : (
    <span className="tabular-nums tracking-[0.04em] text-foreground">{code}</span>
  );
}

/** A deleted game's Restore, from its row or its page: back as it was, with Undo. */
function useRestore() {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  const restore = async (id: string) => {
    setBusy(true);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/games/${id}`, { restore: true });
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

/**
 * One game in a list (and in Find's search, `found`): its name and state, then what it is and where; a code the search
 * matched leads the line, marked; a deleted one carries Restore.
 */
export function GameListRow({ g, found, code }: { g: GameRow; found?: boolean; code: string | null }) {
  const { restore, busy } = useRestore();
  const tag = STATE_TAG[g.state];
  const what = [g.game, g.season, whereOf(g)].filter(Boolean).join(" · ");
  const note = noteOf(g);
  const pre = found ? "Game · " : "";
  const line: ReactNode = g.codeHit ? (
    <>
      {pre}Join code <Code code={g.code} hit={code} /> · {what}
      {note ? ` · ${note}` : ""}
    </>
  ) : note ? (
    `${pre}${what} · ${note}`
  ) : (
    <>
      {pre}
      {what} · <Code code={g.code} hit={null} />
    </>
  );
  return (
    <div data-game-row={g.name} data-game-id={g.id} data-game-state={g.state} className="flex items-center gap-2.5 border-t border-border first:border-t-0">
      <NavLink href={paths.deskItem("game", g.id)} data-desk-item={found ? "game" : undefined} className="nd-press flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2.5">
        <IconLead icon={Trophy} />
        <span className="min-w-0 flex-1">
          <b className="line-clamp-2 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {g.name}
            {tag && <i className={`${TAG} ${tag[1]}`}>{tag[0]}</i>}
          </b>
          <small className="mt-[3px] line-clamp-2 block text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{line}</small>
        </span>
      </NavLink>
      {g.state === "deleted" && (
        <Btn data-game-restore={g.id} className="h-11 flex-none px-3.5 text-[15px]" disabled={busy} onClick={() => void restore(g.id)}>
          Restore
        </Btn>
      )}
    </div>
  );
}

/** Find › Games: filtered, sorted and searched, 25 at a time; a join code finds its game whatever the filter. */
export function GamesPage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<GameFilter>(FILTERS.some(([k]) => k === params.get("f")) ? (params.get("f") as GameFilter) : "all");
  const [sort, setSort] = useState<GameSort>(SORTS.some(([k]) => k === params.get("sort")) ? (params.get("sort") as GameSort) : "new");
  const term = useDebounced(q.trim(), 200);
  // The list as it is, in the address: Back from a game comes back to it.
  useEffect(() => {
    const href = paths.deskGames({ q: term, f: f === "all" ? "" : f, sort: sort === "new" ? "" : sort });
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [term, f, sort]);
  const list = useInfiniteQuery({
    queryKey: ["new-design", "desk", "games", term, f, sort],
    // The chips' counts come with the first page only.
    queryFn: ({ pageParam }) => deskGet<GamesList>(`/games?${new URLSearchParams({ q: term, f, sort, offset: String(pageParam), ...(pageParam ? { counts: "0" } : {}) })}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((a, p) => a + p.games.length, 0);
      return n < last.total ? n : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = list.data?.pages ?? [];
  const games = [...new Map(pages.flatMap((p) => p.games).map((g) => [g.id, g])).values()];
  const total = pages[0]?.total ?? 0;
  const counts = pages[0]?.counts;
  const code = pages[0]?.code ?? null;
  const left = Math.max(0, total - pages.reduce((n, p) => n + p.games.length, 0));
  return (
    <div className="pb-16" data-desk-games>
      <DeskHeader title="Games" back={{ label: "Find", href: paths.desk("find") }} />
      <Section className="mt-4">
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-games-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Game, show, couch or join code"
            aria-label="Find a game by its name, show, couch or join code"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {/* The first, the one you're on, and any with games in it. */}
          {FILTERS.filter(([k]) => k === "all" || k === f || (counts?.[k] ?? 0) > 0).map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-games-filter={k}
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
          <span data-games-count>{list.data ? plural(total, "game") : ""}</span>
          <label className="relative flex h-11 cursor-pointer items-center gap-1.5 rounded-[3px] pl-2 text-[14px] font-bold text-foreground focus-within:outline-3 focus-within:outline-chyron">
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
            {SORTS.find(([k]) => k === sort)?.[1]}
            <select data-games-sort aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as GameSort)} className="absolute inset-0 w-full cursor-pointer text-base opacity-0">
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
        ) : games.length ? (
          <div data-games-list className="border-y border-border">
            {games.map((g) => (
              <GameListRow key={g.id} g={g} code={code} />
            ))}
          </div>
        ) : (
          <div data-games-empty className="mt-1.5 flex flex-col items-center gap-2 rounded-[4px] bg-card px-4 py-8 text-center">
            {/* A code's no-match when it has a number in it (a word like "pool" is searched as a word). */}
            {term && code && /\d/.test(code) ? (
              <>
                <b className="type-caption text-[22px]">No game has the code {code}</b>
                <small className="max-w-[300px] text-[14px] leading-snug text-muted-foreground">
                  {codeWhy(code)} A deleted game&apos;s code still finds it here for 30 days.
                </small>
              </>
            ) : term ? (
              <>
                <b className="type-caption text-[22px]">Nothing matches &ldquo;{term}&rdquo;</b>
                {f !== "all" && (
                  <button type="button" data-games-playing onClick={() => setF("all")} className="text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                    Search playing games
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
            data-games-more
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

const LT_TAG: Record<GameRow["state"], string> = { playing: "Playing", nobody: "Playing", ended: "Ended", archived: "Archived", deleted: "Deleted" };

/**
 * A game (the mock's desk-games.js dkGamePage): its lower third and facts; Restore when it's deleted, Hand it on when
 * nobody runs it; Part of; its Join code; its Seats; History; and its Delete, last.
 */
export function GamePage({ id }: { id: string }) {
  const q = useDesk<DeskGame & { seats: GameSeats | null; open: GameOpen | null }>(`/games/${id}`);
  const after = useAfterDesk();
  const said = useChangeToast();
  const nav = useNav();
  const client = useQueryClient();
  const { restore, busy } = useRestore();
  const [sheet, setSheet] = useState<"delete" | "gone" | "hand" | null>(null);
  // Deleted for good: this page's own read stops, so the refetch of everything else doesn't 404 it.
  const [gone, setGone] = useState(false);
  const back = { label: "Games", href: paths.deskGames() };
  if (q.error)
    return (
      <>
        <DeskHeader title="Game" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data || gone)
    return (
      <>
        <DeskHeader title="Game" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const g = q.data;
  const where = whereOf(g);
  const deleted = g.state === "deleted";
  const live = g.state === "playing" || g.state === "nobody";
  const archive = async () => {
    setSheet(null);
    try {
      const out = await deskSend<{ changeId: string; text: string }>(`/games/${g.id}`, { archive: true });
      await after();
      said(out.text, out.changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return (
    <div className="pb-16" data-desk-game={g.state}>
      <DeskHeader title="Game" back={back} name={g.name} kind="Game" />
      <LowerThird
        lead={
          g.art ? (
            // eslint-disable-next-line @next/next/no-img-element -- a season's art from wherever it was found
            <img src={g.art} alt="" className="size-16 flex-none rounded-[3px] object-cover shadow-plate" />
          ) : (
            <span className="grid size-16 flex-none place-items-center rounded-[3px] bg-card shadow-plate">
              <Trophy className="size-7" aria-hidden />
            </span>
          )
        }
        tag={LT_TAG[g.state]}
        tone={deleted ? "stopped" : "quiet"}
        title={g.name}
        detail={[g.season, where].filter(Boolean).join(" · ")}
      />
      <Facts>
        <span data-game-facts>
          {g.game} · Started {dateOf(g.startedAt)} · {plural(g.players, "player")}
          {g.runBy.length ? ` · run by ${g.runBy.join(", ")}` : ""}
          {g.archived ? ` · ${noteOf(g)}` : ""}
        </span>
      </Facts>
      {deleted && g.deleted && (
        <section className="mt-5 px-4">
          <div data-game-deleted className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">Deleted</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              {(() => {
                const n = noteOf(g)!;
                return n[0].toUpperCase() + n.slice(1);
              })()}
              . {g.restorable ? "Restore it and everyone's teams, picks and scores come back as they were." : "It can't come back from here."}
            </small>
            {g.restorable && (
              <Btn data-game-restore={g.id} wide className="mt-3 h-12" disabled={busy} onClick={() => void restore(g.id)}>
                Restore {g.name}
              </Btn>
            )}
          </div>
        </section>
      )}
      {g.state === "nobody" && (
        <section className="mt-5 px-4">
          <div data-game-nobody className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">Nobody runs it</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">Its Commissioner left. Hand it to someone who plays.</small>
            <Btn data-game-hand wide className="mt-3 h-12" onClick={() => setSheet("hand")}>
              Hand it on
            </Btn>
          </div>
        </section>
      )}
      <HandOnSheet open={sheet === "hand"} onClose={() => setSheet(null)} from={null} games={[{ leagueId: g.id, name: g.name, couch: g.couch?.name ?? null }]} />
      {g.open && <OpenRow g={g} open={g.open} />}
      <Section title="Part of">
        <div className="border-b border-border">
          {g.couch && <DeskRow href={paths.deskItem("couch", g.couch.id)} data="part-couch" lead={<IconLead icon={Users} />} title={g.couch.name} line="The couch" />}
          {g.seasonId && g.season && (
            <DeskRow
              href={paths.deskItem("season", g.seasonId)}
              data="part-season"
              lead={
                g.art ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a season's art from wherever it was found
                  <img src={g.art} alt="" className="size-10 flex-none rounded-[3px] object-cover" />
                ) : (
                  <IconLead icon={Tv} />
                )
              }
              title={g.season}
              line="The season"
            />
          )}
          {g.rulebook && (
            <DeskRow
              href={paths.deskItem("rulebook", g.rulebook.id)}
              data="part-rulebook"
              lead={<IconLead icon={BookOpen} />}
              title={g.rulebook.own || !g.season ? `${g.name}'s rulebook` : `${g.season}'s rulebook`}
              line={g.rulebook.own ? "Its own copy · what it plays by" : "What it plays by"}
            />
          )}
          {!g.couch && <DeskRow data="part-solo" lead={<IconLead icon={Users} />} title={where[0].toUpperCase() + where.slice(1)} line="On no couch" />}
        </div>
      </Section>
      {/* A practice game or a public pool isn't joined by code (join-league.ts), so it has no Join code to read out. */}
      {!deleted && g.couch && (
        <Section title="Join code">
          <div data-game-code className="flex min-h-[72px] items-center gap-3 rounded-[4px] bg-card py-2.5 pl-4 pr-2.5 outline-1 -outline-offset-1 outline-input">
            <b aria-label={`Join code ${[...g.code].join(" ")}`} className="type-caption min-w-0 flex-1 text-[44px] leading-none tracking-[0.1em] tabular-nums">
              {g.code}
            </b>
            <Btn
              data-game-copy
              className="h-11 flex-none gap-1.5 px-3.5 text-[15px]"
              onClick={() =>
                navigator.clipboard
                  ?.writeText(g.code)
                  .then(() => toast(`Copied ${g.code}`))
                  .catch(() => toast.quiet("Couldn't copy it: read it out instead"))
              }
            >
              <Copy className="size-4" aria-hidden />
              Copy
            </Btn>
          </div>
          <p data-game-code-note className="mt-2.5 text-[14px] leading-snug text-muted-foreground">
            {live ? `Anyone with it can join ${g.couch.name}, then ${g.name}.` : `The game's over: the code still leads to ${g.couch.name}, and lets nobody into ${g.name}.`} Find › Games finds the
            game by it.
          </p>
        </Section>
      )}
      {g.seats && <GameSeatsSection g={{ id: g.id, name: g.name, season: g.season, couch: g.couch }} seats={g.seats} />}
      <LatestHistory lines={g.history} />
      {deleted && g.deleted ? (
        <DeleteRow data="game-gone" title={`Delete ${g.name} for good, now`} line={`Can't be undone · it goes on its own ${dateOf(g.deleted.until)}`} onClick={() => setSheet("gone")} />
      ) : g.off ? (
        <DeleteRow data="game" title={`Delete ${g.name}`} line={g.off} off />
      ) : (
        <DeleteRow data="game" title={`Delete ${g.name}`} line="Everyone's picks and scores go · restorable for 30 days" onClick={() => setSheet("delete")} />
      )}
      <HoldSheet
        open={sheet === "delete"}
        onOpenChange={(o) => setSheet(o ? "delete" : null)}
        title={`Delete ${g.name}?`}
        subtitle={[g.season, where].filter(Boolean).join(" · ")}
        consequence=""
        body={
          <ul data-game-delete className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
            <li className={CON}>{g.players ? `${plural(g.players, "player")} lose their teams, picks and scores in it, and are told.` : "Nobody plays it yet."}</li>
            {g.couch && g.others > 0 && <li className={CON}>{g.couch.name}&apos;s other {g.others === 1 ? "game is" : "games are"} untouched.</li>}
          </ul>
        }
        alt={g.archived ? undefined : { label: "Archive it instead", line: "It stays on the trophy shelf as it stood; nothing scores it.", onClick: () => void archive() }}
        cta={`delete ${g.name}`}
        restore="Restorable for 30 days from Games › Deleted"
        onConfirm={async () => {
          const out = await deskSend<{ text: string }>(`/games/${g.id}`, { delete: true });
          await after();
          toast(out.text);
        }}
      />
      {deleted && g.deleted && (
        <HoldSheet
          open={sheet === "gone"}
          onOpenChange={(o) => setSheet(o ? "gone" : null)}
          title={`Delete ${g.name} for good?`}
          subtitle="This can't be undone"
          consequence=""
          body={
            <ul data-game-gone className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
              <li className={CON}>It&apos;s gone now instead of {dateOf(g.deleted.until)}, and can&apos;t come back.</li>
              <li className={CON}>Its join code stops finding it.</li>
            </ul>
          }
          cta="delete it for good"
          restore="Can't be undone"
          onConfirm={async () => {
            const out = await deskSend<{ text: string }>(`/games/${g.id}`, {}, "DELETE");
            setGone(true);
            forgetDeskPage(paths.deskItem("game", g.id));
            // Back to the list it came from, else Games › Deleted.
            nav.back(paths.deskGames({ f: "deleted" }), (prev) => prev === "/desk/games");
            toast(out.text);
            // Every desk read moves on but this page's own, which is gone.
            await client.invalidateQueries({ queryKey: ["new-design"], predicate: (x) => x.queryKey[2] !== `/games/${g.id}` });
          }}
        />
      )}
    </div>
  );
}
