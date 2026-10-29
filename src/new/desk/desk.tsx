"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, Check, CheckCheck, ChevronRight, Flag, KeyRound, Lock, RotateCcw, Search, User, Users, Zap } from "lucide-react";
import { colourOf } from "@/lib/people";
import { NavLink } from "../nav";
import { paths, type DeskKind, type DeskSeasonPage } from "../routes";
import { useMe } from "../session";
import { Avatar } from "../ui/bars";
import { EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { deskSend, useAfterDesk, useDesk, type ComingUp, type DeskSettings, type DeskLine, type FoundItem, type Inbox, type InboxItem, type PeopleList, type PersonRow, type ReportRow } from "./data";
import { LibraryPage } from "./library";
import { NewShowFlow } from "./new-show";
import { CouchPage, FactPage, SeasonPage, ShowPage } from "./pages";
import { LetInButton, PeoplePage, PersonPage, PersonTags, useDebounced } from "./people";
import { ReportListRow, ReportPage, ReportsPage } from "./reports";
import { andList } from "./seats";
import { useDeskStay, useRecentlyOpened } from "./trail";
import { agoOf, ChoiceCard, DeskHeader, DeskRow, History, IconLead, ItemRow, Section, Tag } from "./parts";
import { RulebookPage } from "./rulebook";
import { EpisodePage } from "./episode";
import { BingoPage } from "./bingo";
import { CastPage } from "./cast";
import { CastawayPage, OldCastawayPage } from "./castaway";
import { ResearchPage } from "./research";
import { SetupPage } from "./setup";

// The admin's desk (docs/PLAN-new-design.md step 6b part 2; the mock's community.js admin), from the profile menu: Inbox
// (only what the community couldn't settle, and what settled on its own this week), Find (one search; each thing has a
// page with Override, Lock and History; with nothing typed, Browse: a list of each kind, docs/PLAN-desk-parity.md step 1)
// and Settings (grouped by the question you have, step 1). Site admins only: anyone else is told so, and every read is
// refused by its own route. People, the library and New show (step 10 part 3) are pages a level down, from Find.

type Tab = "inbox" | "find" | "settings";
type Page = Tab | "library" | "new" | "people" | "reports";

const TAB_NAMES: Record<Tab, string> = { inbox: "Inbox", find: "Find", settings: "Settings" };

export function DeskScreen({ tab, item }: { tab: Page | null; item: { kind: DeskKind; id: string; sub?: DeskSeasonPage; episode?: number; castaway?: string } | null }) {
  const me = useMe();
  useDeskStay();
  if (!me.isSuperAdmin) {
    return (
      <div>
        <DeskHeader title="Admin" back={{ label: "Home", href: paths.home }} badge={false} start />
        <EmptyState title="The desk is for site admins" line="Results settle by the couches. Anything that needs an admin comes here." />
      </div>
    );
  }
  if (item?.episode) return <EpisodePage id={item.id} n={item.episode} />;
  if (item?.castaway) return <CastawayPage seasonId={item.id} id={item.castaway} />;
  if (item?.sub === "setup") return <SetupPage id={item.id} />;
  if (item?.sub === "research") return <ResearchPage id={item.id} />;
  if (item?.sub === "bingo") return <BingoPage id={item.id} />;
  if (item?.sub === "cast") return <CastPage id={item.id} />;
  if (item) {
    const page = { fact: FactPage, season: SeasonPage, castaway: OldCastawayPage, couch: CouchPage, person: PersonPage, show: ShowPage, rulebook: RulebookPage, report: ReportPage }[item.kind];
    const Page = page;
    return <Page id={item.id} />;
  }
  if (tab === "library") return <LibraryPage />;
  if (tab === "people") return <PeoplePage />;
  if (tab === "reports") return <ReportsPage />;
  if (tab === "new") return <NewShowFlow />;
  return <DeskTabs tab={tab ?? "inbox"} />;
}

function DeskTabs({ tab }: { tab: Tab }) {
  const inbox = useDesk<Inbox>("/inbox");
  const n = inbox.data?.items.length ?? 0;
  const tabs: [Tab, string, string][] = [
    ["inbox", "Inbox", paths.desk()],
    ["find", "Find", paths.desk("find")],
    ["settings", "Settings", paths.desk("settings")],
  ];
  return (
    <div className="pb-16">
      <DeskHeader title="Admin" back={{ label: "Home", href: paths.home }} name={TAB_NAMES[tab]} start />
      <nav className="mx-4 mt-3 grid grid-cols-3 gap-2" aria-label="The desk">
        {tabs.map(([k, label, href]) => (
          <NavLink
            key={k}
            href={href}
            replace
            data-desk-tab={k}
            aria-current={k === tab ? "page" : undefined}
            className={`nd-press flex h-12 items-center justify-center gap-2 rounded-[3px] text-[16px] font-bold ${k === tab ? "bg-foreground text-background" : "bg-card text-muted-foreground"}`}
          >
            {label}
            {k === "inbox" && n > 0 && <i className="grid size-6 place-items-center rounded-full bg-live text-[12px] not-italic text-live-foreground">{n}</i>}
          </NavLink>
        ))}
      </nav>
      {tab === "inbox" && <InboxTab data={inbox.data} loading={inbox.isLoading} />}
      {tab === "find" && <FindTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

// Each kind's tag (the mock's desk-inbox.js): yellow only where the couches couldn't settle a result.
const TAGS: Record<InboxItem["kind"], [string, "must" | "quiet"]> = {
  split: ["Disputed", "must"],
  stale: ["Disputed", "must"],
  phase: ["Confirm", "must"],
  change: ["New?", "must"],
  stranded: ["Couch", "quiet"],
  schedule: ["Schedule", "quiet"],
  cast: ["Cast", "quiet"],
  people: ["People", "quiet"],
  report: ["Report", "quiet"],
  suggestion: ["Fix", "quiet"],
  made: ["Rulebook", "quiet"],
  show: ["Show", "quiet"],
};

/** One thing that needs you (the mock's .adm-item.dk-ii): its kind's tag, what it is, a line, and the faces it's about. */
function InboxRow({ item }: { item: InboxItem }) {
  const [tag, tone] = TAGS[item.kind] ?? [item.kind, "quiet"];
  return (
    <NavLink href={item.href} data-desk-item={item.kind} className="nd-press flex min-h-[74px] items-center gap-3 border-t border-border py-2.5 last:border-b">
      <Tag tone={tone} className="min-w-[78px]">
        {tag}
      </Tag>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold leading-snug">{item.title}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {item.line}
          {item.at ? ` · ${agoOf(item.at)}` : ""}
        </small>
      </span>
      {item.faces && item.faces.length > 0 && (
        <span className="flex flex-none" aria-hidden>
          {item.faces.map((f, i) => (
            <span key={f.id} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-1.5" : ""}`}>
              <Avatar id={f.id} name={f.name} size={26} colour={colourOf(f.id, f.colour)} />
            </span>
          ))}
        </span>
      )}
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

const WEEK_SHOWN = 5;

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** "Tonight", "Today", else "Thu"; "8:05" and "PM": an airing in the phone's own time. */
function whenOf(iso: string, now = new Date()) {
  const d = new Date(iso);
  const today = d.toDateString() === now.toDateString();
  // The parts, not a split on a space: some engines put a narrow no-break space before PM.
  const parts = TIME.formatToParts(d);
  const hm = parts.filter((p) => (p.type !== "dayPeriod" && p.type !== "literal") || p.value === ":").map((p) => p.value).join("");
  const ap = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return { day: today ? (d.getHours() >= 17 ? "Tonight" : "Today") : d.toLocaleDateString("en-US", { weekday: "short" }), hm, ap, today };
}

const HOW_ICON: Record<ComingUp["how"], typeof Zap> = { auto: Zap, espn: Check, talk: Users, couch: Users, admin: Check };

/** One episode this week (the mock's .dk-run): day and time, the season, the episode, how its results come in. */
function WeekRow({ c }: { c: ComingUp }) {
  const w = whenOf(c.airAt);
  const Icon = HOW_ICON[c.how];
  return (
    <NavLink href={paths.deskItem("season", c.seasonId)} data-week-row={c.season} className="nd-press flex min-h-[72px] items-center gap-3 border-b border-border py-2.5">
      <span className={`flex w-[58px] flex-none flex-col gap-[3px] ${w.today ? "pl-2 shadow-[inset_2px_0_0_var(--foreground)]" : ""}`}>
        <small className={`type-caption text-[12px] tracking-[0.06em] ${w.today ? "text-foreground" : "text-muted-foreground"}`}>{w.day}</small>
        <b className="type-num whitespace-nowrap text-[24px] leading-none">
          {w.hm}
          <i className="ml-0.5 text-[11px] font-bold not-italic text-muted-foreground">{w.ap}</i>
        </b>
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[16px] font-semibold leading-snug">{c.season}</b>
        <small className="mt-px block text-[13px] text-muted-foreground">{c.title ?? `Episode ${c.episode}`}</small>
        <em data-week-how={c.how} className="mt-1 flex items-center gap-1.5 text-[12.5px] not-italic text-muted-foreground">
          <Icon className="size-3.5 flex-none" aria-hidden />
          {c.line}
        </em>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/**
 * The Inbox (the mock's desk-inbox.js): Needs you, one list most urgent first, each opening the page that deals with it;
 * Coming up, the week as a rundown; and what settled on its own this week.
 */
function InboxTab({ data, loading }: { data: Inbox | undefined; loading: boolean }) {
  const [allWeek, setAllWeek] = useState(false);
  if (loading || !data) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const week = allWeek ? data.coming : data.coming.slice(0, WEEK_SHOWN);
  const none = data.unscheduled;
  return (
    <>
      <Section title="Needs you" aside={data.items.length || "Nothing"}>
        {data.items.length ? (
          <div data-inbox>
            {data.items.map((i, k) => (
              <InboxRow key={`${i.href}-${k}`} item={i} />
            ))}
          </div>
        ) : (
          <div data-inbox-empty className="flex flex-col items-center rounded-[4px] bg-card px-4 py-8 text-center">
            <Check className="size-8 text-good" strokeWidth={2.6} aria-hidden />
            <b className="type-caption mt-2 text-[22px]">Nothing needs you</b>
            <small className="text-[14px] text-muted-foreground">The couches are handling it.</small>
          </div>
        )}
      </Section>
      <Section title="Coming up" aside="This week">
        {data.coming.length ? (
          <div data-coming className="border-t border-border">
            {week.map((c) => (
              <WeekRow key={`${c.seasonId}-${c.episode}`} c={c} />
            ))}
          </div>
        ) : (
          <p data-coming-none className="rounded-[4px] bg-card p-3.5 text-[14px] text-muted-foreground">Nothing airs this week.</p>
        )}
        {!allWeek && data.coming.length > WEEK_SHOWN && (
          <button type="button" data-week-all onClick={() => setAllWeek(true)} className="mt-1 inline-flex min-h-11 items-center text-[15px] font-bold underline decoration-input underline-offset-[3px]">
            All {data.coming.length} this week
          </button>
        )}
        {none.length > 0 && (
          <p data-coming-unscheduled className="mt-2.5 text-[13px] leading-snug text-muted-foreground">
            {andList(none)} {none.length > 1 ? "have" : "has"} no schedule, so {none.length > 1 ? "they aren't" : "it isn't"} here.
          </p>
        )}
      </Section>
      <Section title="This week, on its own">
        <div className="grid grid-cols-2 gap-2.5" data-week>
          {(
            [
              [data.week.researched, "episodes researched by couches"],
              [data.week.confirmed, "confirmed by 2+ sources"],
              [data.week.settled, "disputes settled without you"],
              [data.week.rulings, "house rulings kept"],
            ] as const
          ).map(([n, l]) => (
            <div key={l} className="rounded-[4px] bg-card p-3.5">
              <b className="type-num block text-[34px] leading-none">{n}</b>
              <small className="mt-1.5 block text-[14px] leading-snug text-muted-foreground">{l}</small>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">Facts settle when sources agree. A dispute reaches you when another answer couldn&apos;t settle it, or nobody checked a flag within a day (with the tie-break run on, once it has had its try).</p>
      </Section>
    </>
  );
}

// ---------- Find ----------

const ICONS: Record<FoundItem["kind"], string> = { show: "Show", season: "Season", castaway: "Cast", couch: "Couch", person: "Person", rulebook: "Rulebook", fact: "Fact" };

interface Found {
  found: FoundItem[];
  /** With nothing typed: Browse's lines. */
  browse?: { people: { all: number; waiting: number }; library: { templates: number; inUse: number; unchecked: number }; reports: { open: number; done: number } };
  /** With a search: the first few people who match, and how many do; the same for reports. */
  people?: { people: PersonRow[]; total: number };
  reports?: { reports: ReportRow[]; total: number };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** What's worth knowing on a Browse line, in bold (the mock's .dk-wn). */
const Worth = ({ children }: { children: ReactNode }) => <b className="font-bold text-foreground">{children}</b>;

/** A list's small heading inside a section (the mock's .dk-sub). */
function SubHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline justify-between gap-3 first:mt-3.5">
      <h2 className="type-caption text-[17px] tracking-[0.04em] text-muted-foreground">{title}</h2>
      {aside != null && <span className="text-[13px] text-muted-foreground">{aside}</span>}
    </div>
  );
}

/**
 * Find (the mock's desk.js dkBrowse and admFindList): one search. With nothing typed, Browse: a row for each kind with
 * its own list (People, the library and Reports now; Couches, Games and Shows come with their steps), then what you
 * opened lately, then what's airing (until Shows has its list, step 7). With a search: the first three people who match,
 * and All N in People, searched; then everything else it finds.
 */
function FindTab() {
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 200);
  const found = useDesk<Found>(`/find?q=${encodeURIComponent(term)}`);
  const recent = useRecentlyOpened();
  const b = found.data?.browse;
  const people = found.data?.people;
  const reports = found.data?.reports;
  return (
    <Section>
      <label className="flex h-12 items-center gap-2 rounded-[3px] bg-card px-3 outline-1 -outline-offset-1 outline-input focus-within:outline-2 focus-within:outline-chyron">
        <Search className="size-5 flex-none text-muted-foreground" aria-hidden />
        <input data-find type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="A show, season, castaway, couch or person" aria-label="Find anything" autoComplete="off" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none" />
      </label>
      <p className="mb-1 mt-2 text-[13px] leading-snug text-muted-foreground">Everything can be changed from its page. Changes show their reach before you save, and every one is in its history.</p>
      {q.trim() === "" ? (
        <>
          <SubHead title="Browse" />
          <div data-browse>
            <DeskRow
              href={paths.deskPeople()}
              data="browse-people"
              lead={<IconLead icon={User} />}
              title="People"
              line={b ? <>{plural(b.people.all, "account", "accounts")}{b.people.waiting ? <> · <Worth>{b.people.waiting} waiting to get in</Worth></> : null}</> : " "}
            />
            <NavLink href={paths.desk("library")} data-desk-library-link className="nd-press flex min-h-[62px] w-full items-center gap-3 border-t border-border py-2.5 text-left">
              <IconLead icon={BookOpen} />
              <span className="min-w-0 flex-1">
                <b className="block text-[16px] font-semibold leading-snug">Library</b>
                <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {b ? (
                    <>
                      {plural(b.library.templates, "starting point", "starting points")} · {b.library.inUse} in use
                      {b.library.unchecked ? <> · <Worth>{b.library.unchecked} nobody&apos;s checked</Worth></> : null}
                    </>
                  ) : (
                    " "
                  )}
                </small>
              </span>
            </NavLink>
            <DeskRow
              href={paths.deskReports()}
              data="browse-reports"
              lead={<IconLead icon={Flag} />}
              title="Reports"
              line={b ? <>{b.reports.open ? <Worth>{b.reports.open} open</Worth> : "None open"} · {b.reports.done} done</> : " "}
            />
          </div>
          <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">Seasons, episodes, castaways and results are inside their show. The search finds them all.</p>
          {recent.length > 0 && (
            <>
              <SubHead title="Recently opened" />
              <div data-recent>
                {recent.map((r) => (
                  <ItemRow key={r.href} data="recent" href={r.href} tag={r.kind} title={r.label} />
                ))}
              </div>
            </>
          )}
          <SubHead title="Airing now" />
          <div data-found>
            {(found.data?.found ?? []).map((f, i) => (
              <ItemRow key={`${f.href}-${i}`} data={f.kind} href={f.href} tag={ICONS[f.kind]} title={f.title} line={f.line} />
            ))}
            {found.data && !found.data.found.length && <p className="mt-1 text-[14px] text-muted-foreground">Nothing&apos;s airing.</p>}
          </div>
        </>
      ) : (
        <div data-found className="mt-2">
          {/* While typing pauses, nothing: the empty search's rows aren't what you're looking for. */}
          {term !== "" && (
            <>
              {people?.people.map((p) => (
                <NavLink key={p.id} href={paths.deskItem("person", p.id)} data-desk-item="person" className="nd-press flex min-h-[64px] items-center gap-3 border-t border-border py-2.5 first:border-t-0">
                  <Avatar id={p.id} name={p.name} size={40} colour={colourOf(p.id, p.colour)} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px] font-semibold leading-snug">
                      {p.name}
                      <PersonTags p={p} />
                    </b>
                    <small className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">Person · {p.email ?? "no email"}</small>
                  </span>
                </NavLink>
              ))}
              {people && people.total > people.people.length && (
                <NavLink href={paths.deskPeople({ q: term })} data-find-all-people className="flex min-h-12 items-center border-t border-border text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                  All {people.total} people matching &ldquo;{term}&rdquo;
                </NavLink>
              )}
              {(found.data?.found ?? []).map((f, i) => (
                <ItemRow key={`${f.href}-${i}`} data={f.kind} href={f.href} tag={ICONS[f.kind]} title={f.title} line={f.line} />
              ))}
              {reports?.reports.map((r) => (
                <ReportListRow key={r.id} r={r} found />
              ))}
              {reports && reports.total > reports.reports.length && (
                <NavLink href={paths.deskReports({ q: term })} data-find-all-reports className="flex min-h-12 items-center border-t border-border text-[14px] font-bold underline decoration-input underline-offset-[3px]">
                  All {reports.total} reports matching &ldquo;{term}&rdquo;
                </NavLink>
              )}
              {found.data && !found.data.found.length && !people?.total && !reports?.total && <p className="mt-3 text-[14px] text-muted-foreground">Nothing matches.</p>}
            </>
          )}
        </div>
      )}
    </Section>
  );
}

// ---------- Settings ----------

/** Who gets in (src/lib/signups.ts): the desk's three ways, each with what it means. */
const SIGNUPS = [
  ["approve", "You let each one in", "Every new account waits until a site admin lets it in, invited or not. Early access as it was."],
  ["invites", "Invites let people in", "Someone who joins a couch with its code gets in straight away. Anyone else waits for you."],
  ["open", "Anyone gets in", "Every new account plays straight away."],
] as const;

type SheetKey = "signups" | "confirm" | "tiebreak" | "couches" | "autopilot" | "rulebooks" | "history";

/** A section of Settings: its question, then its rows (the mock's desk-pages.js dkSetSec). */
function SetSection({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <p className="-mt-1 mb-2 text-[13px] leading-snug text-muted-foreground">{line}</p>
      <div className="border-b border-border">{children}</div>
    </Section>
  );
}

const WAITING_SHOWN = 25;

/** Who gets in's Waiting (the mock's dkWhoSheet): each with Let in, newest first; past 25, the rest in People. */
function WaitingList({ open, onClose }: { open: boolean; onClose: () => void }) {
  const q = useDesk<PeopleList>(open ? `/people?f=waiting&sort=new&limit=${WAITING_SHOWN}&counts=0` : null);
  if (!q.data) return open ? <div aria-busy className="mt-4 h-24 animate-pulse rounded-[4px] bg-background" /> : null;
  const { people, total } = q.data;
  return (
    <div data-signups-waiting className="mt-4">
      <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-border pb-2">
        <h3 className="type-caption text-[20px] text-muted-foreground">Waiting</h3>
        <span className="text-[13px] text-muted-foreground">{total || ""}</span>
      </div>
      {people.length ? (
        people.map((p) => (
          <div key={p.id} data-waiting-row={p.name} className="flex items-center gap-2.5 border-b border-border">
            <NavLink href={paths.deskItem("person", p.id)} onClick={onClose} className="nd-press flex min-h-[62px] min-w-0 flex-1 items-center gap-3 py-2">
              <Avatar id={p.id} name={p.name} size={36} colour={colourOf(p.id, p.colour)} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[16px] font-semibold">{p.name}</b>
                <small className="block truncate text-[13px] text-muted-foreground">Signed up {agoOf(p.joinedAt)}</small>
              </span>
            </NavLink>
            <LetInButton p={p} />
          </div>
        ))
      ) : (
        <p className="py-3 text-[14px] text-muted-foreground">Nobody&apos;s waiting.</p>
      )}
      {total > people.length && (
        <NavLink href={paths.deskPeople({ f: "waiting" })} data-signups-all onClick={onClose} className="mt-1 inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]">
          All {total} waiting, in People
        </NavLink>
      )}
    </div>
  );
}

function ResetLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" data-reset-recommended onClick={onClick} className="mt-2 inline-flex min-h-11 items-center text-[14px] font-bold underline decoration-input underline-offset-[3px]">
      Reset to recommended
    </button>
  );
}

/**
 * Settings (the mock's desk-pages.js admSettings), grouped by the question you have: People (who gets in), Results (how a
 * result becomes everyone's), Our bot (Autopilot), Rulebooks (which rules games play by), Changes (Settings history) and
 * Not on the desk yet. Each row says its value, with a dot when it's off its recommended setting; its sheet has Reset to
 * recommended; each change is a toast with Undo and a line in Settings history. Which AI our bot asks and What's New
 * join with step 7.
 */
function SettingsTab() {
  const q = useDesk<{ settings: DeskSettings; history: DeskLine[] }>("/settings");
  const after = useAfterDesk();
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  if (!q.data) return <div aria-busy className="mx-4 mt-6 h-64 animate-pulse rounded-[4px] bg-card" />;
  const s = q.data.settings;
  const history = q.data.history;
  const close = () => setSheet(null);
  const put = async (body: Record<string, unknown>, done: string) => {
    try {
      const out = await deskSend<{ changeIds: string[] }>("/settings", body, "PUT");
      await after();
      setSheet(null);
      // Undo takes back every change the save made, the last first.
      const ids = [...(out.changeIds ?? [])].reverse();
      toast(
        done,
        ids.length
          ? {
              undo: async () => {
                try {
                  for (const id of ids) await deskSend(`/changes/${id}/undo`, {});
                  await after();
                  toast("Undone");
                } catch (e) {
                  toast.quiet((e as Error).message);
                }
              },
            }
          : {}
      );
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const mode = SIGNUPS.find(([m]) => m === s.signups.mode);
  const disputed = (on: boolean) => (on ? "The bot asks again after a day" : "It waits for a couch to check again");
  const fill = (anyone: boolean) => (anyone ? "Anyone on the couch" : "Only people who run games");
  const rb = s.rulebooks;
  return (
    <>
      <SetSection title="People" line="When someone makes an account, and who's waiting.">
        <DeskRow
          data="signups"
          onClick={() => setSheet("signups")}
          lead={<IconLead icon={User} />}
          title="Who gets in"
          dot={s.signups.mode !== "invites"}
          line={
            <>
              {mode?.[1]}
              {s.signups.waiting ? <> · <Worth>{s.signups.waiting} waiting</Worth></> : null}
            </>
          }
        />
      </SetSection>
      <SetSection title="Results" line="How a result becomes everyone's. Who went home is always checked for free.">
        <DeskRow data="confirm" onClick={() => setSheet("confirm")} lead={<IconLead icon={CheckCheck} />} title="Sources to confirm a result" dot={s.confirmAt !== 2} line={`${s.confirmAt} that agree${s.confirmAt === 2 ? " · recommended" : ""}`} />
        <DeskRow data="tiebreak" onClick={() => setSheet("tiebreak")} lead={<IconLead icon={RotateCcw} />} title="When a result is disputed" line={disputed(s.tiebreak.on)} />
        <DeskRow data="couches" onClick={() => setSheet("couches")} lead={<IconLead icon={Users} />} title="Who fills in results on new couches" dot={!s.newCouchesAnyone} line={`${fill(s.newCouchesAnyone)}${s.newCouchesAnyone ? " · recommended" : ""}`} />
      </SetSection>
      <SetSection title="Our bot" line="What it looks up on its own.">
        <DeskRow
          data="autopilot"
          onClick={() => setSheet("autopilot")}
          lead={<IconLead icon={Zap} />}
          title="Autopilot"
          line={s.autopilot.length ? `On for ${plural(s.autopilot.length, "season", "seasons")}: ${s.autopilot.map((a) => a.name).join(", ")}` : "Off for every season"}
        />
      </SetSection>
      <SetSection title="Rulebooks" line="Which rules each season's games play by.">
        <div data-rulebooks-status>
          <DeskRow
            data="rulebooks"
            onClick={() => setSheet("rulebooks")}
            lead={<IconLead icon={BookOpen} />}
            title="Games on their season's rulebook"
            line={rb.everywhere ? "Every season at once" : rb.seasons.length ? `On ${plural(rb.seasons.length, "season", "seasons")}: ${rb.seasons.map((x) => x.name).join(", ")} · every season at once: off` : "Off · games play by their show's rules"}
          />
        </div>
        <DeskRow data="library" href={paths.desk("library")} lead={<IconLead icon={BookOpen} />} title="The library" line="Every rulebook and starting point" />
      </SetSection>
      <SetSection title="Changes" line="Every setting changed here, with Undo.">
        <DeskRow
          data="history"
          onClick={() => setSheet("history")}
          lead={<IconLead icon={RotateCcw} />}
          title="Settings history"
          line={history[0] ? `${history[0].text} · ${new Date(history[0].at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Nothing changed yet"}
        />
      </SetSection>
      {/* Until classic's admin retires (docs/PLAN-desk-parity.md step 8), what the desk can't do yet is done there. */}
      <SetSection title="Not on the desk yet" line="Until classic's admin retires.">
        <DeskRow data="classic" href="/admin" lead={<IconLead icon={KeyRound} />} title="Classic admin" line="Games, a season's research and cast, shows' details, until the desk has them" />
      </SetSection>

      <Sheet open={sheet === "signups"} onOpenChange={(o) => !o && close()} title="Who gets in" subtitle="When someone makes an account">
        <div className="flex flex-col gap-2">
          {SIGNUPS.map(([v, t, d]) => (
            <ChoiceCard key={v} attrs={{ "data-signups": v }} on={s.signups.mode === v} title={t} line={d} recommended={v === "invites"} onClick={() => v !== s.signups.mode && put({ signups: v }, `Who gets in: ${t.toLowerCase()}`)} />
          ))}
        </div>
        {s.signups.mode !== "invites" && <ResetLink onClick={() => put({ signups: "invites" }, "Who gets in: invites let people in")} />}
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">Changing this never lets in anyone already waiting.</p>
        <WaitingList open={sheet === "signups"} onClose={close} />
      </Sheet>
      <Sheet open={sheet === "confirm"} onOpenChange={(o) => !o && close()} title="Sources to confirm a result" subtitle="How many sources that agree make a result everyone's">
        <div className="flex flex-col gap-2">
          {([
            [2, "Two people's answers agreeing"],
            [3, "Stricter: fewer results reach every league on their own"],
            [4, "Strictest: most results wait for more answers"],
          ] as const).map(([n, d]) => (
            <ChoiceCard key={n} attrs={{ "data-confirm-at": String(n) }} on={s.confirmAt === n} title={`${n} sources`} line={d} recommended={n === 2} onClick={() => n !== s.confirmAt && put({ confirmAt: n }, `Sources to confirm a result: ${n} that agree`)} />
          ))}
        </div>
        {s.confirmAt !== 2 && <ResetLink onClick={() => put({ confirmAt: 2 }, "Sources to confirm a result: 2 that agree")} />}
        <p className="mt-3 text-[13px] text-muted-foreground">Every shared result is settled again with the new number.</p>
      </Sheet>
      <Sheet open={sheet === "tiebreak"} onOpenChange={(o) => !o && close()} title="When a result is disputed" subtitle={`A result two sources disagree on, for ${s.tiebreak.hours} hours`}>
        <div className="flex flex-col gap-2">
          {([
            [true, "Our bot asks that episode's full results once more, as a source of its own. Most disputes settle; what doesn't comes to your Inbox. Free: about 2 minutes of the bot each."],
            [false, "Someone on a couch checks it again. A flag nobody checks within a day comes to your Inbox."],
          ] as const).map(([v, d]) => (
            <ChoiceCard key={String(v)} attrs={{ "data-tiebreak": String(v) }} on={s.tiebreak.on === v} title={disputed(v)} line={d} onClick={() => v !== s.tiebreak.on && put({ tiebreak: v }, `When a result is disputed: ${disputed(v).toLowerCase()}`)} />
          ))}
        </div>
        <p data-tiebreak-reach className="mt-3 text-[13px] leading-snug text-muted-foreground">
          {s.tiebreak.reach.length ? `It reaches every season with shared results. Airing now: ${s.tiebreak.reach.join(", ")}.` : "It reaches every season with shared results. Nothing is airing now."}
        </p>
      </Sheet>
      <Sheet open={sheet === "couches"} onOpenChange={(o) => !o && close()} title="Who fills in results on new couches" subtitle="Until a couch changes it">
        <div className="flex flex-col gap-2">
          {([
            [true, "Whoever has seen the episode can fill in its full results."],
            [false, "Players can still flag a result that looks wrong."],
          ] as const).map(([v, d]) => (
            <ChoiceCard key={String(v)} attrs={{ "data-new-couches": String(v) }} on={s.newCouchesAnyone === v} title={fill(v)} line={d} recommended={v} onClick={() => v !== s.newCouchesAnyone && put({ newCouchesAnyone: v }, `New couches: ${fill(v).toLowerCase()}`)} />
          ))}
        </div>
        {!s.newCouchesAnyone && <ResetLink onClick={() => put({ newCouchesAnyone: true }, "New couches: anyone on the couch")} />}
      </Sheet>
      <Sheet open={sheet === "autopilot"} onOpenChange={(o) => !o && close()} title="Autopilot" subtitle="The bot's schedule, season by season">
        <p className="mb-2 text-[13px] leading-snug text-muted-foreground">Couches see &ldquo;Autopilot · On for this season&rdquo; while it checks results. Each season&apos;s Research and the bot changes it.</p>
        <div data-autopilot>
          {s.autopilot.length ? (
            s.autopilot.map((a) => <ItemRow key={a.id} data="season" href={paths.deskSeasonPage(a.id, "research")} tag="On" title={a.name} line={a.line} />)
          ) : (
            <p className="rounded-[4px] bg-background p-3.5 text-[14px] text-muted-foreground">No season&apos;s bot is on. Switch one on from its page (Find › a season).</p>
          )}
        </div>
      </Sheet>
      <Sheet open={sheet === "rulebooks"} onOpenChange={(o) => !o && close()} title="Games on their rulebook" subtitle="Season by season">
        <p className="mb-2 text-[13px] leading-snug text-muted-foreground">
          {rb.everywhere ? "Every season's games play by its rulebook." : "Everywhere else, games play by their show's built-in rules. A season is switched on from its rulebook's page."}
        </p>
        <div data-rulebooks-seasons>
          {rb.seasons.map((x) => (
            <ItemRow key={x.id} data="season" href={paths.deskItem("season", x.id)} tag="On" title={x.name} line="Its games play by its rulebook" />
          ))}
        </div>
        <DeskRow lead={<IconLead icon={Lock} />} title="Every season at once" line={rb.everywhere ? "On · switched from the server only" : "Off · switched from the server only"} />
      </Sheet>
      <Sheet open={sheet === "history"} onOpenChange={(o) => !o && close()} title="Settings history" subtitle="Every change here, newest first">
        <History lines={history} emptyLine="No settings changed yet." />
      </Sheet>
    </>
  );
}
