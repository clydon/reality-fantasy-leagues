"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownUp, Search, Users } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { EmptyState } from "../ui/parts";
import { deskGet, useDesk, type DeskPerson, type PeopleFilter, type PeopleList, type PeopleSort, type PersonRow } from "./data";
import { DeskHeader, DeskRow, Facts, IconLead, LatestHistory, LowerThird, Section } from "./parts";

// Find › People (docs/PLAN-desk-parity.md step 1; the mock's desk.js dkPeople): everyone, searched by name, username or
// email; Everyone · Waiting · Site admins (and Can't sign in while anyone can't), each with its count; newest, last active
// or name; 25 at a time with Show 25 more. The search, filter and sort live in the address (replaced, not pushed), so
// Back from a person comes back to the list as it was. Server: src/lib/server/desk-people.ts.

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

/** "now", "12 minutes ago", "2 hours ago", "yesterday", "6 days ago", else "Oct 9". */
export function agoOf(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  if (m < 120) return "an hour ago";
  if (m < 1440) return `${Math.floor(m / 60)} hours ago`;
  if (m < 2880) return "yesterday";
  if (m < 10080) return `${Math.round(m / 1440)} days ago`;
  return dateOf(iso);
}

/** "Oct 9" (this year), else "Oct 9, 2025". */
export function dateOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }) });
}

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

/** One person in the list: their face, name and tags; then how they're doing, or when they signed up while they wait. */
function PersonListRow({ p, term }: { p: PersonRow; term: string }) {
  const t = term.toLowerCase();
  // When it's the email that matched, it's marked.
  const emailHit = !!t && !!p.email && !p.name.toLowerCase().includes(t) && p.email.toLowerCase().includes(t);
  const email = p.email ? emailHit ? <mark className="bg-transparent text-foreground underline decoration-chyron underline-offset-[3px]">{p.email}</mark> : p.email : "no email";
  return (
    <NavLink
      href={paths.deskItem("person", p.id)}
      data-person-row={p.name}
      className={`nd-press flex min-h-[66px] items-center gap-3 border-t border-border py-2.5 ${p.stopped ? "[&_[data-face]]:grayscale" : ""}`}
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
}

// ---------- a person ----------

const ROLE: Record<string, string> = { commissioner: "Commissioner", admin: "Game admin", member: "Player" };

/**
 * A person (the mock's dkPerson), in the page frame: who they are as a lower third, when they joined and were last active,
 * whether they're waiting or can't sign in, their couches with the games they have a seat in there and each seat's role,
 * and History. Its actions come with step 1's later parts: Act as them, Let in, the account and signing in (1b); a
 * seat's sheet and the Delete, last (1c).
 */
export function PersonPage({ id }: { id: string }) {
  const q = useDesk<DeskPerson>(`/people/${id}`);
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
      {(p.waiting || p.stopped) && (
        <Section>
          <div data-person-state={p.waiting ? "waiting" : "stopped"} className="rounded-[4px] bg-card p-3.5 outline-1 -outline-offset-1 outline-input">
            <b className="block text-[17px]">{p.waiting ? "Waiting to get in" : `${p.name} can't sign in`}</b>
            <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">
              {p.waiting
                ? `Made an account ${dateOf(p.joinedAt)}. Until they're let in, they see "You're on the list". Let them in from classic's admin for now (Settings › Not on the desk yet).`
                : "Their seats, scores and messages are untouched."}
            </small>
          </div>
        </Section>
      )}
      <Section title="Couches and games" aside={games || couches ? `${couches ? plural(couches, "couch", "couches") : "no couch"} · ${plural(games, "game", "games")}` : undefined}>
        {p.couches.length ? (
          <div data-person-couches className="border-b border-border">
            {p.couches.map((c) => (
              <div key={c.id ?? "none"} data-person-couch={c.name} className="border-t border-border first:border-t-0">
                {c.id ? (
                  <DeskRow
                    href={paths.deskItem("couch", c.id)}
                    lead={<IconLead icon={Users} />}
                    title={c.name}
                    line={`${c.role === "owner" ? "Started it" : c.role === "seat" ? "A seat here, not on the couch" : "On it"} · ${plural(c.people, "person", "people")}`}
                    data="couch"
                  />
                ) : (
                  <DeskRow lead={<IconLead icon={Users} />} title="On no couch" line="Games from before couches" data="couch" />
                )}
                {c.games.map((g) => (
                  <div key={g.leagueId} data-person-game={g.name} className="ml-[52px] flex min-h-[54px] items-center gap-2.5 border-t border-border py-2">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px] font-semibold">{g.name}</b>
                      <small className="block truncate text-[12.5px] text-muted-foreground">
                        {g.game}
                        {g.season ? ` · ${g.season}` : ""}
                      </small>
                    </span>
                    <span className={`whitespace-nowrap text-[13px] font-semibold ${g.role === "member" ? "text-muted-foreground" : ""}`}>{ROLE[g.role] ?? g.role}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[4px] bg-card p-3.5 text-[14px] leading-snug text-muted-foreground">
            {p.waiting ? "Not on a couch yet. Once they're in, they join one with a code or start their own." : "Not on a couch. They can join one with a code or start their own."}
          </p>
        )}
      </Section>
      <LatestHistory lines={p.history} />
    </div>
  );
}
