"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Ban, Check, ChevronRight, Copy, Ellipsis, Eye, KeyRound, Lock, Mail, RotateCcw, Search, Users, Zap } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink, useNav } from "../nav";
import { isUsername, USERNAME_RULE } from "@/lib/usernames";
import { paths } from "../routes";
import { BACK_FROM_ACTING } from "../session";
import { Avatar } from "../ui/bars";
import { HoldSheet } from "../ui/guards";
import { Btn, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskGet, deskSend, useAfterDesk, useDesk, type DeskPerson, type DeskSeatGame, type PeopleFilter, type PeopleList, type PeopleSort, type PersonRow } from "./data";
import { agoOf, dateOf, DeleteRow, DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section, useChangeToast } from "./parts";
import { andList, HandOnSheet, ROLE_TITLE, SeatSheet, type DeskSeat, type Handed } from "./seats";
import { forgetDeskPage } from "./trail";

// Find › People (docs/PLAN-desk-parity.md step 1; the mock's desk.js dkPeople): everyone, searched by name, username or
// email; Everyone · Waiting · Site admins (and Can't sign in while anyone can't), each with its count; newest, last active
// or name; 25 at a time with Show 25 more; Let in on a waiting row. The search, filter and sort live in the address
// (replaced, not pushed), so Back from a person comes back to the list as it was. A person's page and its actions (part
// 1b): Let in, Act as them, Name and email, Password, Signing in; their couches and games, each opening its seat's sheet
// (part 1c: seats.tsx), and Delete <name>'s account, last (tier 3), handing on first the games they run alone. Server:
// src/lib/server/desk-people.ts (reads), desk-person-actions.ts (the actions and the Delete) and desk-seats.ts (a seat).

/** Let in (tier 1): someone waiting can play at once; the toast's Undo puts them back on the list. */
export function useLetIn() {
  const after = useAfterDesk();
  const said = useChangeToast();
  return async (p: { id: string; name: string }) => {
    try {
      const { changeId } = await deskSend<{ changeId: string }>(`/people/${p.id}`, { letIn: true });
      await after();
      said(`${p.name} is in · they can play now`, changeId);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
}

/** Let in, on a waiting row (the mock's .dk-let). */
export function LetInButton({ p, className = "" }: { p: { id: string; name: string }; className?: string }) {
  const letIn = useLetIn();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      data-let-in={p.name}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await letIn(p);
        setBusy(false);
      }}
      className={`nd-press h-11 flex-none rounded-[3px] bg-card px-[15px] text-[14px] font-extrabold outline-1 -outline-offset-1 outline-input disabled:opacity-60 ${className}`}
    >
      Let in
    </button>
  );
}

const FILTERS: [PeopleFilter, string][] = [
  ["all", "Everyone"],
  ["waiting", "Waiting"],
  ["admins", "Site admins"],
  ["stopped", "Can't sign in"],
];
const SORTS: [PeopleSort, string][] = [
  ["new", "Newest first"],
  ["active", "Last active"],
  ["name", "Name, A to Z"],
];
const AMONG: Partial<Record<PeopleFilter, string>> = { waiting: "the people waiting", admins: "site admins", stopped: "people who can't sign in" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The small tags beside a name (the mock's .dk-t): You or Site admin, Waiting, Can't sign in. */
export function PersonTags({ p }: { p: Pick<PersonRow, "you" | "admin" | "waiting" | "stopped"> }) {
  const tag = "type-caption ml-1.5 inline-block rounded-[2px] px-1.5 pb-0.5 pt-[3px] align-[2px] text-[11px] not-italic leading-none tracking-[0.06em]";
  return (
    <>
      {(p.you || p.admin) && <i className={`${tag} bg-foreground text-background`}>{p.you ? "You" : "Site admin"}</i>}
      {p.waiting && <i className={`${tag} text-foreground outline-1 -outline-offset-1 outline-foreground`}>Waiting</i>}
      {p.stopped && <i className={`${tag} text-muted-foreground outline-1 -outline-offset-1 outline-input`}>Can&apos;t sign in</i>}
    </>
  );
}

/** `v`, once it has stopped changing for `ms` (a search as you type). */
export function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function PeoplePage() {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [f, setF] = useState<PeopleFilter>(FILTERS.some(([k]) => k === params.get("f")) ? (params.get("f") as PeopleFilter) : "all");
  const [sort, setSort] = useState<PeopleSort>(SORTS.some(([k]) => k === params.get("sort")) ? (params.get("sort") as PeopleSort) : "new");
  const term = useDebounced(q.trim(), 200);
  // The list as it is, in the address: Back from a person comes back to it.
  useEffect(() => {
    const qs = new URLSearchParams(Object.entries({ q: term, f: f === "all" ? "" : f, sort: sort === "new" ? "" : sort }).filter(([, v]) => v)).toString();
    const href = `${paths.deskPeople()}${qs ? `?${qs}` : ""}`;
    // null, as Next's guide has it: the router then syncs useSearchParams (and the trail's entry for this page) to it.
    if (href !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", href);
  }, [term, f, sort]);
  const list = useInfiniteQuery({
    queryKey: ["new-design", "desk", "people", term, f, sort],
    queryFn: ({ pageParam }) => deskGet<PeopleList>(`/people?${new URLSearchParams({ q: term, f, sort, offset: String(pageParam) })}`),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const n = all.reduce((a, p) => a + p.people.length, 0);
      return n < last.total ? n : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const pages = list.data?.pages ?? [];
  // Paged by offset over a live order (last active, newest): someone who moves between pages would show twice.
  const people = [...new Map(pages.flatMap((p) => p.people).map((p) => [p.id, p])).values()];
  const total = pages[0]?.total ?? 0;
  const counts = pages[0]?.counts;
  const left = Math.max(0, total - pages.reduce((n, p) => n + p.people.length, 0));
  const setFilter = (k: PeopleFilter) => setF(k);
  return (
    <div className="pb-16" data-desk-people>
      <DeskHeader title="People" back={{ label: "Find", href: paths.desk("find") }} />
      <Section className="mt-4">
        <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
          <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
          <input
            data-people-search
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, username or email"
            aria-label="Find a person by name, username or email"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </label>
        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {FILTERS.filter(([k]) => k !== "stopped" || f === "stopped" || (counts?.stopped ?? 0) > 0).map(([k, label]) => (
            <button
              key={k}
              type="button"
              data-people-filter={k}
              aria-pressed={f === k}
              onClick={() => setFilter(k)}
              className={`relative inline-flex h-11 items-center gap-1.5 rounded-[2px] px-3.5 text-[15px] font-semibold transition-colors ${f === k ? "bg-foreground text-background" : "bg-secondary"}`}
            >
              {label}
              <span className={`type-num text-[15px] ${f === k ? "" : "text-muted-foreground"}`}>{counts ? counts[k] : ""}</span>
              {k === "waiting" && (counts?.waiting ?? 0) > 0 && <i className="absolute right-1.5 top-1.5 size-[7px] rounded-full bg-chyron" aria-hidden />}
            </button>
          ))}
        </div>
        <div className="mt-1 flex min-h-11 items-center justify-between text-[13px] text-muted-foreground">
          <span data-people-count>{list.data ? plural(total, "person", "people") : ""}</span>
          <label className="relative flex h-11 cursor-pointer items-center gap-1.5 rounded-[3px] pl-2 text-[14px] font-bold text-foreground focus-within:outline-3 focus-within:outline-chyron">
            <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden />
            {SORTS.find(([k]) => k === sort)?.[1]}
            <select data-people-sort aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as PeopleSort)} className="absolute inset-0 w-full cursor-pointer text-base opacity-0">
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
        ) : people.length ? (
          <div data-people-list className="border-b border-border">
            {people.map((p) => (
              <PersonListRow key={p.id} p={p} term={term} />
            ))}
          </div>
        ) : (
          <div data-people-empty className="mt-1.5 flex flex-col items-center gap-2 rounded-[4px] bg-card px-4 py-8 text-center">
            {term ? (
              <>
                <b className="type-caption text-[22px]">Nobody matches &ldquo;{term}&rdquo;</b>
                <small className="max-w-[290px] text-[14px] leading-snug text-muted-foreground">Search looks at names, usernames and emails{AMONG[f] ? ` among ${AMONG[f]}` : ""}.</small>
                {f !== "all" && (
                  <button type="button" data-people-everyone onClick={() => setFilter("all")} className="text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                    Search everyone
                  </button>
                )}
              </>
            ) : f === "waiting" ? (
              <>
                <b className="type-caption text-[22px]">Nobody&apos;s waiting</b>
                <small className="max-w-[290px] text-[14px] leading-snug text-muted-foreground">Who gets in decides who waits: strangers who sign up wait here for you.</small>
              </>
            ) : (
              <b className="type-caption text-[22px]">Nobody here</b>
            )}
          </div>
        )}
        {left > 0 && (
          <button
            type="button"
            data-people-more
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

/** One person in the list: their face, name and tags; then how they're doing, or when they signed up while they wait (with Let in). */
function PersonListRow({ p, term }: { p: PersonRow; term: string }) {
  const t = term.toLowerCase();
  // When it's the email that matched, it's marked.
  const emailHit = !!t && !!p.email && !p.name.toLowerCase().includes(t) && p.email.toLowerCase().includes(t);
  const email = p.email ? emailHit ? <mark className="bg-transparent text-foreground underline decoration-chyron underline-offset-[3px]">{p.email}</mark> : p.email : "no email";
  const row = (
    <NavLink
      href={paths.deskItem("person", p.id)}
      data-person-row={p.name}
      className={`nd-press flex min-h-[66px] min-w-0 flex-1 items-center gap-3 py-2.5 ${p.waiting ? "" : "border-t border-border"} ${p.stopped ? "[&_[data-face]]:grayscale" : ""}`}
    >
      <Avatar id={p.id} name={p.name} size={40} colour={colourOf(p.id, p.colour)} />
      <span className="min-w-0 flex-1">
        <b className="line-clamp-2 block text-[16px] font-semibold leading-snug [overflow-wrap:anywhere]">
          {p.name}
          <PersonTags p={p} />
        </b>
        <small className="mt-[3px] line-clamp-2 block text-[13px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
          {p.waiting ? (
            <>Signed up {agoOf(p.joinedAt)}{p.email ? <> · {email}</> : null}</>
          ) : (
            <>
              {email} · {p.games ? plural(p.games, "game", "games") : "no games"} · {p.you ? "you" : p.stopped ? "can't sign in" : `active ${agoOf(p.activeAt)}`}
            </>
          )}
        </small>
      </span>
    </NavLink>
  );
  if (!p.waiting) return row;
  return (
    <div data-waiting-row={p.name} className="flex items-center gap-2.5 border-t border-border">
      {row}
      <LetInButton p={p} />
    </div>
  );
}

// ---------- a person ----------

/** "Practice games and public pools": what a person's games on no couch are. */
function noCouchLine(games: DeskSeatGame[]): string {
  const kinds = [
    games.some((g) => g.solo === "practice") && "practice games",
    games.some((g) => g.solo === "public") && "public pools",
    games.some((g) => !g.solo) && "games from before couches",
  ].filter(Boolean) as string[];
  const line = andList(kinds);
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * A person (the mock's dkPerson), in the page frame: who they are as a lower third, when they joined and were last active,
 * whether they're waiting (Let them in) or can't sign in (Let them back in), Act as them, their account (Name and email,
 * Password, Signing in), their couches with the games they have a seat in there and each seat's role (each opens its
 * seat's sheet; a busy person's couches fold to two games until opened), History, and Delete <name>'s account, last.
 */
export function PersonPage({ id }: { id: string }) {
  const q = useDesk<DeskPerson>(`/people/${id}`);
  const letIn = useLetIn();
  const [sheet, setSheet] = useState<"act" | "account" | "password" | "signing" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [seat, setSeat] = useState<DeskSeat | null>(null);
  const [handOn, setHandOn] = useState<{ games: { leagueId: string; name: string; couch: string | null }[]; deleting: boolean } | null>(null);
  // Who took which games this visit (the Delete's "dana runs ... now").
  const [handed, setHanded] = useState<Handed[]>([]);
  const [unfolded, setUnfolded] = useState<string[]>([]);
  const name = q.data?.name;
  // Back from acting as them (the Viewing as bar's Return, a full load): it's in their History.
  useEffect(() => {
    if (!name) return;
    try {
      if (sessionStorage.getItem(BACK_FROM_ACTING) !== name) return;
      sessionStorage.removeItem(BACK_FROM_ACTING);
    } catch {
      return;
    }
    toast(`Back to your account · it's in ${name}'s History`);
  }, [name]);
  const back = { label: "People", href: paths.deskPeople() };
  if (q.error)
    return (
      <>
        <DeskHeader title="Person" back={back} name={null} />
        <EmptyState title="Not here" line={(q.error as Error).message} />
      </>
    );
  if (!q.data)
    return (
      <>
        <DeskHeader title="Person" back={back} name={null} />
        <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />
      </>
    );
  const p = q.data;
  const [tag, tone] = p.you ? (["You", "you"] as const) : p.admin ? (["Site admin", "you"] as const) : p.waiting ? (["Waiting", "quiet"] as const) : p.stopped ? (["Can't sign in", "stopped"] as const) : (["Player", "quiet"] as const);
  const games = p.couches.reduce((n, c) => n + c.games.length, 0);
  const couches = p.couches.filter((c) => c.id && c.role !== "seat").length;
  const close = () => setSheet(null);
  // Act as them: not yourself, another site admin, someone waiting or someone who can't sign in (each says why).
  const actOff = p.you
    ? "Not on your own page: you're already you"
    : p.admin
      ? "Not another site admin's account"
      : p.waiting
        ? "Once they're in: until then there's nothing to see"
        : p.stopped
          ? "Not while they can't sign in: let them back in first"
          : null;
  return (
    <div className="pb-16" data-desk-person={p.name}>
      <DeskHeader title="Person" back={back} name={p.name} kind="Person" />
      <LowerThird
        lead={
          <span className={`flex-none shadow-plate ${p.stopped ? "grayscale" : ""}`}>
            <Avatar id={p.id} name={p.name} size={64} colour={colourOf(p.id, p.colour)} />
          </span>
        }
        tag={tag}
        tone={tone}
        title={p.name}
        detail={p.email ?? (p.username ? `Signs in as ${p.username} · no email` : "No email")}
      />
      <Facts>
        Joined {dateOf(p.joinedAt)} · {p.you ? "that's you" : `active ${agoOf(p.activeAt)}`}
        {p.devices ? ` · signed in on ${plural(p.devices, "device", "devices")}` : ""}
      </Facts>
      {p.waiting && (
        <Section>
          <StatePanel data="waiting" title="Waiting to get in" line={`Made an account ${dateOf(p.joinedAt)}. Until you let them in, they see "You're on the list".`}>
            <Btn
              data-person-let-in
              tone="must"
              wide
              className="mt-3 h-12"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await letIn(p);
                setBusy(false);
              }}
            >
              Let {p.name} in
            </Btn>
            <small className="mt-2.5 block text-[13px] leading-snug text-muted-foreground">Not someone you know? Leave them waiting, or delete the account at the bottom of this page.</small>
          </StatePanel>
        </Section>
      )}
      {p.stopped && (
        <Section>
          <StatePanel data="stopped" title={`${p.name} can't sign in`} line={`${stoppedSentence(p.stop)} Their seats, scores and messages are untouched.`}>
            <BackInButton p={p} />
          </StatePanel>
        </Section>
      )}
      <Section>
        {actOff ? (
          <div data-act="off" className="flex min-h-[68px] items-center gap-3 rounded-[4px] bg-card p-3">
            <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
              <Eye className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[16px] text-muted-foreground">{p.you ? "Act as them" : `Act as ${p.name}`}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{actOff}</small>
            </span>
          </div>
        ) : (
          <button
            type="button"
            data-act="on"
            onClick={() => setSheet("act")}
            className="nd-press flex min-h-[68px] w-full items-center gap-3 rounded-[4px] bg-card p-3 text-left outline-1 -outline-offset-1 outline-input"
          >
            <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-[#3c6ea6] text-white">
              <Eye className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[16px]">Act as {p.name}</b>
              <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">See and use the app as they do, for an hour</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        )}
      </Section>
      <Section title="Account">
        <div className="border-b border-border">
          <DeskRow data="account" onClick={() => setSheet("account")} lead={<IconLead icon={Mail} />} title="Name and email" line={`${p.username ?? p.name} · ${p.email ?? "no email"}`} />
          {p.you ? (
            <DeskRow data="password" href={paths.settings} lead={<IconLead icon={KeyRound} />} title="Password" line="Yours: change it in Settings" />
          ) : p.admin ? (
            <DeskRow data="password" lead={<IconLead icon={KeyRound} />} title="Password" line="Not another site admin's: theirs is changed in their Settings" />
          ) : (
            <DeskRow data="password" onClick={() => setSheet("password")} lead={<IconLead icon={KeyRound} />} title="Password" line="Reset it: a temporary one, shown once" />
          )}
          {!p.you && p.admin && <DeskRow data="signing" lead={<IconLead icon={Lock} />} title="Signing in" line="Not another site admin's" />}
          {!p.you && !p.admin && (
            <DeskRow
              data="signing"
              onClick={() => setSheet("signing")}
              lead={<IconLead icon={Lock} />}
              title="Signing in"
              line={p.stopped ? (p.stop?.since ? `Stopped since ${dateOf(p.stop.since)}` : "Stopped") : p.waiting ? `Can sign in; sees "You're on the list"` : `Allowed · ${signedInOn(p.devices)}`}
            />
          )}
        </div>
      </Section>
      <Section title="Couches and games" aside={games || couches ? `${couches ? plural(couches, "couch", "couches") : "no couch"} · ${plural(games, "game", "games")}` : undefined}>
        {p.couches.length ? (
          <div data-person-couches className="border-b border-border">
            {p.couches.map((c) => {
              const key = c.id ?? "none";
              // A busy person (more than six games): a couch with more than three shows two until it's opened.
              const fold = games > 6 && c.games.length > 3 && !unfolded.includes(key);
              return (
                <div key={key} data-person-couch={c.name} className="border-t border-border first:border-t-0">
                  {c.id ? (
                    <DeskRow
                      href={paths.deskItem("couch", c.id)}
                      lead={<IconLead icon={Users} />}
                      title={c.name}
                      line={`${c.role === "owner" ? "Started it" : c.role === "seat" ? "A seat here, not on the couch" : "On it"} · ${plural(c.people, "person", "people")}`}
                      data="couch"
                    />
                  ) : (
                    <DeskRow lead={<IconLead icon={Users} />} title="On no couch" line={noCouchLine(c.games)} data="couch" />
                  )}
                  {(fold ? c.games.slice(0, 2) : c.games).map((g) => (
                    <button
                      key={g.leagueId}
                      type="button"
                      data-person-game={g.name}
                      aria-label={`${p.name} in ${g.name}${g.season ? ` on ${g.season}` : ""}: ${ROLE_TITLE[g.role]}`}
                      onClick={() =>
                        setSeat({
                          leagueId: g.leagueId,
                          game: g.name,
                          season: g.season ? `${g.game} · ${g.season}` : g.game,
                          couch: c.id ? { id: c.id, name: c.name } : null,
                          user: { id: p.id, name: p.name },
                          role: g.role,
                          alone: g.alone,
                          others: g.others,
                        })
                      }
                      className="nd-press ml-[52px] flex min-h-[54px] w-[calc(100%-52px)] items-center gap-2.5 border-t border-border py-2 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px] font-semibold">{g.name}</b>
                        <small className="block truncate text-[12.5px] text-muted-foreground">
                          {g.game}
                          {g.season ? ` · ${g.season}` : ""}
                        </small>
                      </span>
                      <span className={`whitespace-nowrap text-[13px] font-semibold ${g.role === "member" ? "text-muted-foreground" : ""}`}>{ROLE_TITLE[g.role]}</span>
                      <Ellipsis className="size-[18px] flex-none text-muted-foreground" aria-hidden />
                    </button>
                  ))}
                  {fold && (
                    <button
                      type="button"
                      data-person-unfold={c.name}
                      onClick={() => setUnfolded((u) => [...u, key])}
                      className="ml-[52px] flex min-h-[54px] w-[calc(100%-52px)] items-center border-t border-border text-left text-[14px] font-bold underline decoration-input underline-offset-[3px]"
                    >
                      {c.games.length - 2} more on {c.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[4px] bg-card p-3.5 text-[14px] leading-snug text-muted-foreground">
            {p.waiting ? "Not on a couch yet. Once they're in, they join one with a code or start their own." : "Not on a couch. They can join one with a code or start their own."}
          </p>
        )}
      </Section>
      <LatestHistory lines={p.history} />
      {p.you ? (
        <DeleteRow data="person" off title="Delete your account" line="Not from the desk: another site admin would have to" />
      ) : p.admin ? (
        <DeleteRow data="person" off title={`Delete ${p.name}'s account`} line="Not another site admin's account" />
      ) : (
        <DeleteRow data="person" title={`Delete ${p.name}'s account`} line={deleteLine(p)} onClick={() => setSheet("delete")} />
      )}

      <SeatSheet
        seat={seat}
        open={!!seat}
        onClose={() => setSeat(null)}
        onHandOn={(s) => {
          setSeat(null);
          setTimeout(() => setHandOn({ games: [{ leagueId: s.leagueId, name: s.game, couch: s.couch?.name ?? null }], deleting: false }), 250);
        }}
      />
      <HandOnSheet
        open={!!handOn}
        onClose={() => setHandOn(null)}
        from={{ id: p.id, name: p.name }}
        games={handOn?.games ?? []}
        deleting={handOn?.deleting}
        onDone={(h) => {
          setHanded((was) => [...was, ...h]);
          if (handOn?.deleting) setTimeout(() => setSheet("delete"), 250);
        }}
      />
      {!p.you && !p.admin && (
        <DeleteSheet
          open={sheet === "delete"}
          onClose={close}
          p={p}
          handed={handed}
          onHandOn={(runs) => {
            close();
            setTimeout(() => setHandOn({ games: runs, deleting: true }), 250);
          }}
          onStopInstead={() => {
            close();
            setTimeout(() => setSheet("signing"), 250);
          }}
        />
      )}
      {!actOff && <ActSheet open={sheet === "act"} onClose={close} p={p} />}
      <AccountSheet key={`${p.username}-${p.email}`} open={sheet === "account"} onClose={close} p={p} />
      {!p.you && !p.admin && <PasswordSheet open={sheet === "password"} onClose={close} p={p} />}
      {!p.you && !p.admin && <SigningSheet open={sheet === "signing"} onClose={close} p={p} />}
    </div>
  );
}

/** "2 devices", or "not signed in now". */
const signedInOn = (n: number) => (n ? `signed in on ${plural(n, "device", "devices")}` : "not signed in now");

/** "Since Oct 20, by you: "Spam in the couch chat"." (what's known of it), or "" for a stop with nothing on record. */
function stoppedSentence(stop: DeskPerson["stop"]): string {
  if (!stop) return "";
  const when = [stop.since ? `Since ${dateOf(stop.since)}` : null, stop.since && (stop.byYou || stop.by) ? `by ${stop.byYou ? "you" : stop.by}` : null].filter(Boolean).join(", ");
  const why = stop.why ? `"${stop.why}"` : "";
  return when || why ? `${[when, why].filter(Boolean).join(": ")}.` : "";
}

/** The panel under the facts while they wait or can't sign in (the mock's .dk-state). */
function StatePanel({ data, title, line, children }: { data: string; title: string; line: string; children: ReactNode }) {
  return (
    <div data-person-state={data} className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
      <b className="block text-[17px]">{title}</b>
      <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">{line}</small>
      {children}
    </div>
  );
}

/** Let them back in (tier 1, Undo). `must`: the sheet's yellow; the panel's is an outline. */
function BackInButton({ p, must, onDone }: { p: DeskPerson; must?: boolean; onDone?: () => void }) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      data-back-in
      tone={must ? "must" : "optional"}
      wide
      className={must ? "mt-3.5" : "mt-3 h-12"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { changeId } = await deskSend<{ changeId: string }>(`/people/${p.id}`, { signIn: true });
          onDone?.();
          await after();
          said(`${p.name} can sign in again`, changeId);
        } catch (e) {
          toast.quiet((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      Let {p.name} back in
    </Btn>
  );
}

/** What a sheet says first (the mock's .cons). */
function Says({ children }: { children: ReactNode }) {
  return <p className="rounded-[3px] bg-background p-3 text-[16px] leading-normal">{children}</p>;
}

/** Act as them (decision 1): what it does first, then the app as them under the Viewing as bar; it's in History. */
function ActSheet({ open, onClose, p }: { open: boolean; onClose: () => void; p: DeskPerson }) {
  const [busy, setBusy] = useState(false);
  const points: [typeof Eye, string][] = [
    [Eye, "You see their couches and games, only as far as they've watched."],
    [Zap, `Opening their results reveals them for ${p.name} too. Look around; leave Reveal to them.`],
    [RotateCcw, `"Return to my account" at the top brings you back here, any time.`],
  ];
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Act as ${p.name}?`} subtitle="For an hour">
      <div data-act-sheet>
        <Says>For an hour you&apos;re {p.name}: anything you do is done as them. It&apos;s in History.</Says>
        <ul className="mb-[18px] mt-3.5 flex flex-col gap-2.5">
          {points.map(([Icon, t]) => (
            <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug text-muted-foreground">
              <Icon className="mt-px size-[18px] flex-none text-foreground" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <Btn
          data-act-go
          tone="must"
          wide
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const { go } = await deskSend<{ go: string }>(`/people/${p.id}/act`, {});
              // A full load: their session, and the design they use.
              window.location.assign(go);
            } catch (e) {
              setBusy(false);
              toast.quiet((e as Error).message);
            }
          }}
        >
          Act as {p.name}
        </Btn>
        <Btn wide className="mt-2" onClick={onClose}>
          Not now
        </Btn>
      </div>
    </Sheet>
  );
}

/** A field in a desk sheet (the mock's .dk-fl): its label, the input at 16px, a line under it or its problem. */
function Field({ label, hint, error, data, ...input }: { label: ReactNode; hint?: string; error?: string | null; data: string } & Omit<ComponentProps<"input">, "className">) {
  return (
    <label className="mt-3.5 block first:mt-0">
      <span className="mb-1.5 block text-[13px] font-bold text-muted-foreground">{label}</span>
      <input
        data-field-input={data}
        aria-invalid={error ? true : undefined}
        autoComplete="off"
        spellCheck={false}
        {...input}
        className="h-12 w-full rounded-[4px] bg-background px-3 text-base outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-chyron aria-invalid:outline-live"
      />
      {error ? (
        <em role="alert" data-field-error={data} className="mt-1.5 block text-[13px] not-italic text-live">
          {error}
        </em>
      ) : (
        hint && <small className="mt-1.5 block text-[12.5px] leading-snug text-muted-foreground">{hint}</small>
      )}
    </label>
  );
}

/** Name and email: their username, checked as sign-up checks it, and the email Forgot password sends to (tier 1, Undo). */
function AccountSheet({ open, onClose, p }: { open: boolean; onClose: () => void; p: DeskPerson }) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [name, setName] = useState(p.username ?? "");
  const [email, setEmail] = useState(p.email ?? "");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const n = name.trim().toLowerCase();
    const e = email.trim();
    if ((n || p.username) && !isUsername(n)) return setErrors({ name: USERNAME_RULE });
    if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return setErrors({ email: "That doesn't look like an email" });
    const nameChanged = !!n && n !== p.username;
    const emailChanged = !!e && e.toLowerCase() !== (p.email ?? "").toLowerCase();
    if (!nameChanged && !emailChanged) return onClose();
    setBusy(true);
    setErrors({});
    try {
      // Not deskSend: a problem with one field comes back as { error, field }, shown under that field.
      const res = await fetch(`/api/desk/people/${p.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(nameChanged ? { name: n } : {}), ...(emailChanged ? { email: e } : {}) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (out.field) setErrors({ [out.field]: out.error });
        else toast.quiet(out.error || "Couldn't save that");
        return;
      }
      onClose();
      await after();
      said(out.renamed ? `Renamed to ${out.name} · their games show the new name` : "Email saved", out.changeId);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Name and email" subtitle={`${p.name}'s account`}>
      <form
        data-account-sheet
        onSubmit={(ev) => {
          ev.preventDefault();
          void save();
        }}
      >
        <Field
          data="name"
          label="Name"
          value={name}
          placeholder={p.username ? undefined : "None yet"}
          onChange={(ev) => setName(ev.target.value)}
          error={errors.name}
          hint={p.username ? "Also their username: it's what they sign in with and what the couch sees." : `They have no username yet: the couch sees "${p.name}". One here is what they'd sign in with and what the couch sees.`}
          autoCapitalize="none"
        />
        <Field
          data="email"
          label="Email"
          type="email"
          value={email}
          placeholder={p.email ? undefined : "None yet"}
          onChange={(ev) => setEmail(ev.target.value)}
          error={errors.email}
          hint={p.email ? "Where Forgot password sends the link." : "They signed up with a username alone. An email here is where Forgot password sends the link."}
        />
        <Btn data-account-save type="submit" tone="must" wide className="mt-4" disabled={busy}>
          Save
        </Btn>
      </form>
    </Sheet>
  );
}

/** Reset password: a temporary one, shown once; the old one stops working and they're signed out everywhere. */
function PasswordSheet({ open, onClose, p }: { open: boolean; onClose: () => void; p: DeskPerson }) {
  const after = useAfterDesk();
  const [password, setPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = () => {
    onClose();
    // Shown once: gone with the sheet.
    setTimeout(() => setPassword(null), 300);
  };
  return (
    <Sheet open={open} onOpenChange={(o) => !o && done()} title={`Reset ${p.name}'s password`} subtitle="A temporary one, shown once">
      <div data-password-sheet>
        {password ? (
          <>
            <p className="text-[14px] leading-snug text-muted-foreground">Give it to {p.name} yourself, by text or in person. It isn&apos;t shown again; they can change it in Settings.</p>
            <div className="mt-3 flex items-center gap-2.5 rounded-[3px] bg-plate py-2.5 pl-3.5 pr-2.5 text-plate-foreground shadow-plate">
              <b data-temp-password className="type-caption min-w-0 flex-1 text-[26px] tabular-nums tracking-[0.05em] [overflow-wrap:anywhere]">
                {password}
              </b>
              <button
                type="button"
                data-copy-password
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(password);
                    toast("Copied");
                  } catch {
                    toast.quiet("Couldn't copy: select it instead");
                  }
                }}
                className="nd-press flex h-11 flex-none items-center gap-1.5 rounded-[3px] bg-plate-foreground px-3.5 text-[15px] font-bold text-plate"
              >
                <Copy className="size-4" aria-hidden />
                Copy
              </button>
            </div>
            <Btn data-password-done wide className="mt-3" onClick={done}>
              Done
            </Btn>
          </>
        ) : (
          <>
            <Says>Their old password stops working at once, and they&apos;re signed out on every device. You get a temporary one to give them.</Says>
            <Btn
              data-password-make
              tone="must"
              wide
              className="mt-3.5"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const out = await deskSend<{ password: string }>(`/people/${p.id}`, { password: "reset" });
                  setPassword(out.password);
                  await after();
                } catch (e) {
                  toast.quiet((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Make a temporary password
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** Signing in: Stop them (an optional reason only admins see; tier 1, Undo), or, stopped, Let them back in. */
function SigningSheet({ open, onClose, p }: { open: boolean; onClose: () => void; p: DeskPerson }) {
  const after = useAfterDesk();
  const said = useChangeToast();
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  if (p.stopped)
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Signing in" subtitle={`${p.name} can't sign in`}>
        <div data-signing-sheet="stopped">
          <Says>{stoppedSentence(p.stop) || "Stopped."}</Says>
          <BackInButton p={p} must onDone={onClose} />
        </div>
      </Sheet>
    );
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Signing in" subtitle={p.waiting ? `${p.name} is waiting` : `${p.name} · ${signedInOn(p.devices)}`}>
      <form
        data-signing-sheet="allowed"
        onSubmit={async (ev) => {
          ev.preventDefault();
          setBusy(true);
          try {
            const { changeId } = await deskSend<{ changeId: string }>(`/people/${p.id}`, { signIn: false, why });
            onClose();
            setWhy("");
            await after();
            said(`${p.name} can't sign in`, changeId);
          } catch (e) {
            toast.quiet((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Says>
          Stop {p.name} signing in: they&apos;re signed out on every device now and can&apos;t sign in again until you let them back. Their seats, scores and messages stay as they are, and their couches aren&apos;t told.
        </Says>
        <Field
          data="why"
          label={
            <>
              Why <i className="font-normal not-italic">(only admins see it)</i>
            </>
          }
          value={why}
          maxLength={200}
          placeholder="Optional"
          onChange={(ev) => setWhy(ev.target.value)}
        />
        <Btn data-stop type="submit" wide className="mt-4 text-live" disabled={busy}>
          <Ban className="size-[18px]" aria-hidden />
          Stop {p.name} signing in
        </Btn>
      </form>
    </Sheet>
  );
}

// ---------- Delete ----------

/** The games they're in, by what their Delete does to each (desk-person-actions.ts deleteAccount). */
function seatsOf(p: DeskPerson) {
  const all = p.couches.flatMap((c) => c.games.map((g) => ({ ...g, couch: c.id ? c.name : null })));
  // A game only they play (a practice game too) goes with them; a season's public pool stays, as anyone's.
  const only = all.filter((g) => g.others === 0 && g.solo !== "public");
  const rest = all.filter((g) => !only.includes(g));
  return {
    all,
    only,
    stays: rest.filter((g) => g.drafted),
    goes: rest.filter((g) => !g.drafted),
    // The games they run alone that someone else could take (Hand them on).
    runs: all.filter((g) => g.alone && g.others > 0),
  };
}

/** The Delete row's line: what it does, in brief. */
function deleteLine(p: DeskPerson): string {
  const { all, stays } = seatsOf(p);
  if (!all.length) return "Can't be undone";
  if (stays.length === all.length) return "Can't be undone · their seats stay, marked as left";
  if (!stays.length) return `Can't be undone · they come out of ${plural(all.length, "game", "games")}`;
  return `Can't be undone · ${stays.length} ${stays.length === 1 ? "seat stays" : "seats stay"}, ${all.length - stays.length} go`;
}

/**
 * Delete <name>'s account (tier 3, the mock's dkDelete): what it does to their seats said first, then a hold. While they
 * run a game alone that someone else plays, it says so and offers Hand them on (one person, or game by game); once
 * they're handed on it says who runs them now. Someone waiting can be left waiting instead, anyone else stopped from
 * signing in instead.
 */
function DeleteSheet({
  open,
  onClose,
  p,
  handed,
  onHandOn,
  onStopInstead,
}: {
  open: boolean;
  onClose: () => void;
  p: DeskPerson;
  handed: Handed[];
  onHandOn: (runs: { leagueId: string; name: string; couch: string | null }[]) => void;
  onStopInstead: () => void;
}) {
  const nav = useNav();
  const client = useQueryClient();
  const { all, only, stays, goes, runs } = seatsOf(p);
  const nameOf = (id: string) => all.find((g) => g.leagueId === id)?.name ?? "a game";
  const couchOf = (id: string) => all.find((g) => g.leagueId === id)?.couch ?? null;
  // Handed on this visit, and still not theirs alone (an Undo since puts a game back in the warning).
  const ok = handed.map((h) => ({ ...h, games: h.games.filter((id) => !runs.some((r) => r.leagueId === id)) })).filter((h) => h.games.length);
  const okCouches = [...new Set(ok.flatMap((h) => h.games.map(couchOf)))];
  const runCouch = new Set(runs.map((r) => r.couch)).size === 1 ? runs[0]?.couch : null;
  // A game on no couch (from before couches) reaches no Inbox.
  const toInbox = runs.every((r) => r.couch);
  const them = runs.length > 1 ? "them" : "it";
  const couches = p.couches.filter((c) => c.id && c.role !== "seat").map((c) => c.name);
  const lines = [`${p.name}'s account goes for good: they can't sign in, and it can't be restored.`];
  if (stays.length)
    lines.push(
      stays.length === 1
        ? "Their seat in 1 game stays, marked as left, so its table keeps their scores."
        : `Their seats in ${stays.length} games stay, marked as left, so the tables keep their scores.`
    );
  if (goes.length)
    lines.push(
      goes.length === 1
        ? `Their seat in ${goes[0].name} goes, as when someone leaves: it hasn't drafted, or has no draft.`
        : `Their seats in ${goes.length} games go, as when someone leaves: those haven't drafted, or have no draft.`
    );
  if (only.length)
    lines.push(
      only.length > 1 ? `${only.length} games only they play go too.` : only[0].solo === "practice" ? "Their practice game goes too." : `${only[0].name} goes too: nobody else plays it.`
    );
  if (couches.length) lines.push(`They come off ${andList(couches)}.`);
  if (p.invites) lines.push(p.invites === 1 ? "An invite they sent that nobody's used stops working." : `${p.invites} invites they sent that nobody's used stop working.`);
  if (!all.length && !couches.length) lines.push("They aren't on a couch, so nothing else changes.");
  const body = (
    <div data-delete-sheet>
      <ul data-delete-says className="flex flex-col gap-2 rounded-[3px] bg-background px-3.5 py-3">
        {lines.map((l) => (
          <li key={l} className="relative pl-4 text-[15px] leading-normal before:absolute before:left-0 before:top-[.6em] before:size-1.5 before:rounded-[1px] before:bg-live">
            {l}
          </li>
        ))}
      </ul>
      {runs.length > 0 && (
        <div data-delete-runs className="mt-2.5 rounded-[3px] bg-card px-3.5 py-3 shadow-[inset_0_0_0_1.5px_var(--color-chyron)]">
          <b className="block text-[15px]">
            Nobody else runs {runCouch ? `${andList(runs.map((r) => r.name))} on ${runCouch}` : andList(runs.map((r) => (r.couch ? `${r.name} on ${r.couch}` : r.name)))}
          </b>
          <small className="mt-1 block text-[13px] leading-snug text-muted-foreground">
            {toInbox
              ? `Hand ${them} on first, or ${runCouch ? `${runCouch} comes` : `${them} come`} to your Inbox with nobody running ${them}.`
              : `Hand ${them} on first, or nobody runs ${them}.`}
          </small>
          <Btn data-delete-hand-on wide className="mt-2.5 h-11 text-[15px]" onClick={() => onHandOn(runs.map((r) => ({ leagueId: r.leagueId, name: r.name, couch: r.couch })))}>
            Hand {them} on
          </Btn>
        </div>
      )}
      {ok.length > 0 && (
        <p data-delete-handed className="mt-2.5 flex items-start gap-2 rounded-[3px] bg-background px-3.5 py-3 text-[14px] leading-normal">
          <Check className="mt-px size-[18px] flex-none text-good" strokeWidth={2.6} aria-hidden />
          <span>
            {ok.map((h) => `${h.name} runs ${andList(h.games.map(nameOf))}`).join("; ")}
            {okCouches.length === 1 && okCouches[0] ? ` on ${okCouches[0]}` : ""} now, so every game keeps a Commissioner.
          </span>
        </p>
      )}
    </div>
  );
  return (
    <HoldSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${p.name}'s account?`}
      subtitle="This can't be undone"
      consequence=""
      body={body}
      cta={`delete ${p.name}'s account`}
      restore="Can't be undone"
      alt={
        p.waiting
          ? { label: "Leave them waiting", line: "They stay on the list and can't play until you let them in.", onClick: onClose }
          : p.stopped
            ? undefined
            : { label: "Stop them signing in instead", line: "Keeps everything, and you can let them back any time.", onClick: onStopInstead }
      }
      onConfirm={async () => {
        await deskSend(`/people/${p.id}`, {}, "DELETE");
        forgetDeskPage(paths.deskItem("person", p.id));
        nav.back(paths.deskPeople(), (prev) => prev === paths.deskPeople());
        toast(`Deleted ${p.name}'s account`);
        // Every desk read moves on but this page's own, which is gone.
        await client.invalidateQueries({ queryKey: ["new-design"], predicate: (q) => q.queryKey[2] !== `/people/${p.id}` });
      }}
    />
  );
}
