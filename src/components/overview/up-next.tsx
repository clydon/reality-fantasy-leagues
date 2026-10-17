"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { cn } from "cn";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { byDue, type ActionItem } from "@/lib/game/action-items.js";
import { statusPlate } from "@/lib/game/status-plate";
import { useNowMinute } from "@/components/episodes/episode-status";
import { useLinkedGroup } from "@/components/league-strip";

export type UpItem = ActionItem & { leagueId: string; leagueName: string };
/** A commissioner's job, from either source: the league's results (action-items.js) or commissioner-items.ts. */
export interface Job {
  leagueId: string;
  leagueName: string;
  title: string;
  href: string;
}

/** The tag each kind of to-do wears, on the alert strip and Up next alike. */
export const ACTION_TAGS: Record<string, string> = {
  invite: "Invite",
  notifications: "Alerts",
  draftTurn: "Your pick",
  blindDraft: "Draft",
  lineup: "Lineup",
  pick: "Pick",
  prediction: "Predict",
  lateJoin: "Start",
  results: "Results",
  pickup: "Replace",
};

// Motion (docs/PLAN-league-tabs.md's animate + delight pass). Only transform and opacity, only for
// changes you watch happen -- nothing plays on first paint or a league switch, and everything is off
// under reduced motion (.chat-in / .tag-slide in globals.css):
// - the plate's text and the "+N" count rise 6px and fade when they change (a move done, the next one up);
// - the "+N more" rows drop in from above, staggered 25ms for the first four;
// - "All set": when the last move clears, the quiet tag slides in from behind the plate's edge, once.
// Keyboard focus, drawn inside the plate: they clip their own overflow, so an outer ring would be cut off.
const FOCUS = "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line";
// On a white plate chyron-line is the yellow itself on Night, which vanishes: the plate's own amber.
const FOCUS_PLATE = "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-plate-line";
// On the control room's inverse strip the ring is the strip's own ink: chyron-line (a deep amber on Studio) is too dark on it.
const FOCUS_STRIP = "focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-quiet-tag-foreground";
const RISE: CSSProperties = { "--rise": "6px", "--dur": "160ms" } as CSSProperties;
const rowIn = (i: number): CSSProperties => ({ "--rise": "-6px", "--dur": "160ms", animationDelay: `${Math.min(i, 3) * 25}ms` }) as CSSProperties;

/** How many times `sig` has changed since `scope` (the league and page) began: 0 until it does, and back to 0 in another.
 *  Keyed on that, an element animates for a change you watched, never on arrival. `counts` says which changes
 *  count; by default a swap of one thing for another, not something appearing from or vanishing into nothing. */
function useChangeCount(sig: string, scope: string, counts: (prev: string, next: string) => boolean = (a, b) => a !== "" && b !== ""): number {
  const [s, setS] = useState({ scope, sig, n: 0 });
  if (s.scope !== scope) setS({ scope, sig, n: 0 });
  else if (s.sig !== sig) setS({ scope, sig, n: counts(s.sig, sig) ? s.n + 1 : s.n });
  return s.scope === scope ? s.n : 0;
}
/** A count only counts when it goes down: a move done. Going up is data arriving (other leagues' moves are fetched). */
const fewer = (prev: string, next: string) => Number(next) < Number(prev);

// "All set" can be waved away: per device and per game, until what it says changes (the next thing this
// game asks of you, or a move turning up in another game). A move here always shows; only the quiet plate goes.
// Kept in memory too, so a dismissal holds for the visit where storage is blocked.
const ALL_SET_KEY = "rfl.allSetDismissed";
let allSetRaw: string | null = null;
const allSetListeners = new Set<() => void>();
function allSetSnapshot(): string {
  if (allSetRaw === null) {
    try {
      allSetRaw = localStorage.getItem(ALL_SET_KEY) ?? "";
    } catch {
      allSetRaw = "";
    }
  }
  return allSetRaw;
}
function subscribeAllSet(cb: () => void) {
  allSetListeners.add(cb);
  return () => void allSetListeners.delete(cb);
}
function parseAllSet(raw: string): Record<string, string> {
  try {
    const s = JSON.parse(raw || "null");
    if (s && typeof s === "object") return s;
  } catch {
    /* fall through */
  }
  return {};
}
function dismissAllSetFor(id: string, sig: string) {
  allSetRaw = JSON.stringify({ ...parseAllSet(allSetSnapshot()), [id]: sig });
  try {
    localStorage.setItem(ALL_SET_KEY, allSetRaw);
  } catch {
    /* not remembered past this visit */
  }
  allSetListeners.forEach((cb) => cb());
}

// Up next (docs/PLAN-league-tabs.md), Overview's opener in the alert strip's place:
//
// - **The control room** first, when you run a league with a job waiting (the results, a draft to
//   schedule, the next episode to reveal): one slim strip in the inverse fill with a knocked-out
//   "Commish" tag -- the backstage slate, apart from the white on-air plates, with no new hue so the
//   one yellow stays the player's. "+1" opens the rest in place.
// - **The plate**: this game's most urgent move, with how long is left. Its right column is the
//   alert strip's pager column, but a count: "+3 more" opens every other move you have, in any league,
//   soonest first, one hairline row each. Commissioner jobs never pad it.
// - **Nothing to do in this game**: "Nothing to do in Pool" with the next thing this game will ask of
//   you under it (lib/game/status-plate.ts: the draft's time, who's on the clock, "4 of 5 claims in",
//   when the next episode airs), still with the count when other games need you. That line is Overview's
//   alone (`quiet`); on any other page a quiet game shows nothing, unless another game needs you.
//   Its x waves it away until what it says changes (ALL_SET_KEY below).
//
// It's on every page of the app but Team / Lineup when a waiver banner leads them (their own plate says
// it) -- the alert strip (action-bar.tsx) decides where, and what the page itself already shows.
//
// The alert strip (action-bar.tsx) gathers the items and does the opening: `go` switches game when a
// row is in another one and opens the page the move lives on.
export function UpNext({
  here,
  others,
  jobs,
  hereId,
  hereName,
  quiet: allowQuiet,
  go,
  allSetCue = 0,
  onAllSet,
}: {
  /** This game's items (the alert strip computes them from the state on screen). */
  here: UpItem[];
  /** Every other league's, from /api/me/actions. */
  others: UpItem[];
  jobs: Job[];
  hereId: string;
  hereName: string;
  /** Overview: say what's next when this game has nothing. Elsewhere that line would only be noise. */
  quiet: boolean;
  go: (leagueId: string, href: string) => void;
  /** Non-zero when this game's last move has just cleared and "All set" hasn't played yet (action-bar.tsx counts clears). */
  allSetCue?: number;
  onAllSet?: (cue: number) => void;
}) {
  const now = useNowMinute();
  const state = useLeagueStore((s) => s.state);
  const me = useMyPlayerId();
  const group = useLinkedGroup();
  const pathname = usePathname();
  const [movesOpen, setMovesOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(false);
  // The server has no localStorage: it renders nothing dismissed, and the client catches up after hydrating.
  const dismissedRaw = useSyncExternalStore(subscribeAllSet, allSetSnapshot, () => "");
  const dismissed = useMemo(() => parseAllSet(dismissedRaw), [dismissedRaw]);

  // A game in your linked group goes by its chip's name ("Pool"); any other league by its own.
  const gameName = (id: string, name: string) => group?.games.find((g) => g.id === id)?.label ?? name;
  const hereGame = gameName(hereId, hereName);

  const mine = (it: UpItem) => (it.who ?? "you") === "you";
  const [top = null, ...hereRest] = here.filter(mine).sort(byDue);
  const rest = [...hereRest, ...others.filter(mine)].sort(byDue);
  const next = top || !allowQuiet ? null : statusPlate(state, { me, now });

  const row = (key: string, game: string, title: string, when: When | null, onClick: () => void, i: number) => (
    <li key={key} className="chat-in" style={rowIn(i)}>
      <button
        type="button"
        onClick={onClick}
        className={cn("grid min-h-11 w-full grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-border py-2.5 text-left hover:bg-secondary/40 active:bg-secondary/40", FOCUS)}
      >
        <span className="truncate text-xs text-muted-foreground">{game}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug">{title}</span>
          {when && <span className={cn("block text-xs", when.soon ? "font-semibold text-chyron-line" : "text-muted-foreground")}>{when.row}</span>}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );

  // What the quiet plate says, minus anything that ticks by on its own (the detail's "in 3 days").
  const quietSig = [next ? `${next.tag}|${next.title}` : "", ...rest.map((it) => `${it.leagueId}:${it.kind}`)].join("|");
  const allSetHidden = !top && dismissed[hereId] === quietSig;
  const quietShown = !top && !allSetHidden && !!(next || rest.length);
  function dismissAllSet() {
    setMovesOpen(false);
    dismissAllSetFor(hereId, quietSig);
  }
  // Scoped to the page too: this stays mounted from page to page, and a plate that differs because the page
  // dropped a move that points at itself is arriving, not changing.
  const scope = `${hereId}|${pathname}`;
  const plateCue = useChangeCount(top ? `${top.leagueId}|${top.kind}|${top.text}` : quietShown ? "quiet" : "", scope);
  const countCue = useChangeCount(String(rest.length), scope, fewer);
  const jobsCue = useChangeCount(String(jobs.length), scope, fewer);
  // "All set" plays once per clear, and keeps its class for as long as that plate stays up.
  const [slid, setSlid] = useState(0);
  if (quietShown && allSetCue && slid !== allSetCue) setSlid(allSetCue);
  else if (!quietShown && slid) setSlid(0);
  useEffect(() => {
    if (slid && quietShown) onAllSet?.(slid);
  }, [slid, quietShown, onAllSet]);

  const control = jobs.length > 0 && (
    <div className="mb-2" data-control-room>
      <div className="flex min-h-11 items-stretch overflow-hidden rounded-[3px] bg-quiet-tag text-quiet-tag-foreground dark:ring-1 dark:ring-inset dark:ring-input">
        <button
          type="button"
          onClick={() => go(jobs[0].leagueId, jobs[0].href)}
          className={cn("flex min-w-0 flex-1 items-center gap-2.5 pr-2 text-left hover:bg-white/5 active:bg-white/10", FOCUS_STRIP)}
        >
          <span className="type-caption tag-cut flex shrink-0 items-center self-stretch bg-quiet-tag-foreground pl-2.5 pr-[18px] text-[13px] tracking-[0.04em] text-quiet-tag [--tag-slant:10px]">
            Commish
          </span>
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 py-2">
            <span className="type-caption text-[16px] leading-[1.05]">{jobs[0].title}</span>
            <span className="text-xs opacity-70">{gameName(jobs[0].leagueId, jobs[0].leagueName)}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-80" strokeWidth={2.4} aria-hidden />
        </button>
        {jobs.length > 1 && (
          <button
            type="button"
            onClick={() => setJobsOpen((o) => !o)}
            aria-expanded={jobsOpen}
            aria-label={`${jobs.length - 1} more commissioner ${jobs.length === 2 ? "job" : "jobs"}`}
            className={cn("flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-quiet-tag-foreground/20 hover:bg-white/5 active:bg-white/10", FOCUS_STRIP)}
          >
            <span key={jobsCue} className={cn("type-num text-[15px] leading-none", jobsCue > 0 && "chat-in")} style={RISE}>
              +{jobs.length - 1}
            </span>
            <span className="text-[11px] font-semibold leading-none opacity-70">{jobsOpen ? "less" : "more"}</span>
          </button>
        )}
      </div>
      {jobsOpen && jobs.length > 1 && (
        <ul className="mt-1">
          {jobs.slice(1).map((j, i) =>
            row(`${j.leagueId}:${i}`, j.leagueId === hereId ? "Here" : gameName(j.leagueId, j.leagueName), j.title, null, () => go(j.leagueId, j.href), i),
          )}
        </ul>
      )}
    </div>
  );

  const count = rest.length > 0 && (
    <button
      type="button"
      onClick={() => setMovesOpen((o) => !o)}
      aria-expanded={movesOpen}
      aria-label={`${rest.length} more to do`}
      className={cn("flex min-h-11 w-12 shrink-0 flex-col items-center justify-center gap-0.5 border-l border-plate-muted/20 bg-plate text-plate-foreground hover:bg-[#f1eff6] active:bg-[#f1eff6]", FOCUS_PLATE)}
    >
      <span key={countCue} className={cn("type-num text-[15px] font-bold leading-none", countCue > 0 && "chat-in")} style={RISE}>
        +{rest.length}
      </span>
      <span className="text-[11px] font-semibold leading-none text-plate-muted">{movesOpen ? "less" : "more"}</span>
    </button>
  );

  let plate: ReactNode = null;
  if (top) {
    const when = whenFor(top, now);
    plate = (
      <Plate tag={ACTION_TAGS[top.kind] ?? "Now"} count={count} cue={plateCue} onClick={() => go(top.leagueId, top.href)}>
        <PlateText title={top.text} subtitle={when ? when.plate : top.detail} soon={!!when?.soon} />
      </Plate>
    );
  } else if (allSetHidden) {
    plate = null;
  } else if (next) {
    // The status plate's own words, under "Nothing to do": its tag and title say what comes, its detail when.
    plate = (
      <Plate tone="quiet" tag="All set" count={count} cue={plateCue} slide={slid > 0} href={next.href} label={next.action} onDismiss={dismissAllSet}>
        <PlateText title={`Nothing to do in ${hereGame}`} subtitle={[`${STATE_NOW.test(next.title) ? "" : "Next: "}${next.tag}`, next.title, next.detail].filter(Boolean).join(" · ")} wrap />
      </Plate>
    );
  } else if (rest.length) {
    const first = rest[0];
    const when = whenFor(first, now);
    plate = (
      <Plate tone="quiet" tag="All set" count={count} cue={plateCue} slide={slid > 0} onDismiss={dismissAllSet}>
        <PlateText title={`Nothing to do in ${hereGame}`} subtitle={`Next: ${gameName(first.leagueId, first.leagueName)}${when ? ` · ${when.row}` : ""}`} wrap />
      </Plate>
    );
  }

  if (!control && !plate) return null;
  return (
    <div className="mb-4" data-up-next>
      {control}
      {plate}
      {movesOpen && rest.length > 0 && !allSetHidden && (
        <ul className="mt-1">
          {rest.map((it, i) =>
            row(`${it.leagueId}:${it.kind}:${i}`, it.leagueId === hereId ? "Here" : gameName(it.leagueId, it.leagueName), it.text, whenFor(it, now), () => go(it.leagueId, it.href), i),
          )}
        </ul>
      )}
    </div>
  );
}

/** Status plates that say where things stand ("Lineup set"), not what comes next: no "Next:" in front. */
const STATE_NOW = /^(You picked|Lineup set|Aired|Claims are on hold)/;

/** The alert strip's plate, 52px: a tag, the message (a button or a link, or nothing to tap), and an optional count column. */
function Plate({
  tag,
  tone = "chyron",
  count,
  cue,
  slide,
  onClick,
  href,
  label,
  onDismiss,
  children,
}: {
  tag: string;
  tone?: "chyron" | "quiet";
  count: ReactNode;
  /** Changes of what the plate says since it appeared: above 0 its text rises into place. */
  cue: number;
  /** "All set" just arrived: the tag slides in. */
  slide?: boolean;
  onClick?: () => void;
  href?: string;
  /** Screen readers' word for a linked plate ("Waivers"); the chevron says it to the eye. */
  label?: string;
  /** A close at the plate's right end ("All set" only: a move to make isn't yours to wave away). */
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const body = (
    <>
      <span key={cue} className={cn("min-w-0 flex-1", cue > 0 && "chat-in")} style={RISE}>
        {children}
      </span>
      {(onClick || href) && (
        <>
          {label && <span className="sr-only">{label}</span>}
          <ChevronRight className="size-[18px] shrink-0" strokeWidth={2.4} aria-hidden />
        </>
      )}
    </>
  );
  const cls = "flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 text-left";
  const press = cn("hover:bg-[#f1eff6] active:bg-[#f1eff6]", FOCUS_PLATE);
  return (
    <div role="status" className="isolate flex min-h-[52px] items-stretch overflow-hidden rounded-[3px] bg-plate shadow-plate">
      <span
        className={cn(
          "type-caption tag-cut flex shrink-0 items-center pl-3 pr-5 text-[13px] tracking-[0.04em]",
          slide && "tag-slide",
          tone === "quiet" ? "bg-quiet-tag text-quiet-tag-foreground" : "bg-chyron text-chyron-foreground",
        )}
      >
        {tag}
      </span>
      <div className="tag-tuck flex min-w-0 flex-1 items-stretch bg-plate text-plate-foreground">
        {onClick ? (
          <button type="button" className={cn(cls, press)} onClick={onClick}>
            {body}
          </button>
        ) : href ? (
          <Link href={href} className={cn(cls, press)}>
            {body}
          </Link>
        ) : (
          <div className={cls}>{body}</div>
        )}
        {count}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className={cn("flex min-h-11 w-11 shrink-0 items-center justify-center border-l border-plate-muted/20 text-plate-muted hover:bg-[#f1eff6] hover:text-plate-foreground active:bg-[#f1eff6]", FOCUS_PLATE)}
          >
            <X className="size-[18px]" strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function PlateText({ title, subtitle, soon, wrap }: { title: string; subtitle?: string | null; soon?: boolean; wrap?: boolean }) {
  return (
    <>
      <span className="type-caption line-clamp-2 text-[19px] leading-[1.05] [overflow-wrap:anywhere] [text-wrap:pretty]">{title}</span>
      {subtitle && <span className={cn("mt-0.5 block text-[13px]", wrap ? "line-clamp-2 leading-tight" : "truncate", soon ? "font-semibold text-plate-line" : "text-plate-muted")}>{subtitle}</span>}
    </>
  );
}

interface When {
  /** Under the plate's title: "3 hours left" when it's close, else "Locks Wed 8:05 PM". */
  plate: string;
  /** A list row: "Locks Today 1:33 PM · 3 hours left". */
  row: string;
  /** Under 24 hours: the waiting-on-you colour (not red, which means someone went home). */
  soon: boolean;
}

const VERB: Record<string, string> = { lineup: "Locks", pick: "Locks", pickup: "Due", prediction: "Airs" };
const NOW_WORDS: Record<string, string> = {
  draftTurn: "The draft is waiting on you",
  blindDraft: "Picks reveal when everyone's in",
  lateJoin: "Then you're in",
  results: "Everyone's week waits on it",
};

/** How long a to-do has, in the viewer's own time. Null when nothing says (and it isn't a "now" kind). */
function whenFor(it: ActionItem, now: number | null): When | null {
  if (NOW_WORDS[it.kind]) return { plate: NOW_WORDS[it.kind], row: "Now", soon: false };
  const t = it.deadline ? Date.parse(it.deadline) : NaN;
  if (!Number.isFinite(t) || now === null) return null;
  const verb = VERB[it.kind] ?? "Due";
  const at = `${verb} ${dayTime(t, now)}`;
  const ms = t - now;
  if (ms <= 0) return { plate: `${verb} now`, row: `${verb} now`, soon: true };
  if (ms >= 86_400_000) return { plate: at, row: at, soon: false };
  const mins = Math.floor(ms / 60_000);
  const left = mins < 60 ? `${Math.max(1, mins)} min left` : `${Math.floor(mins / 60)} hour${mins < 120 ? "" : "s"} left`;
  return { plate: left, row: `${at} · ${left}`, soon: true };
}

/** "Today 1:33 PM", "Tomorrow 8 PM", "Tue 8:05 PM" within the week, else "Oct 21, 8 PM". */
function dayTime(t: number, now: number): string {
  const d = new Date(t);
  // "5:35 PM" mustn't break between the time and PM when a plate wraps (some engines return a plain space).
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined }).replace(/ +(?=[AP]M$)/i, String.fromCharCode(160));
  const dayOf = (x: number) => {
    const y = new Date(x);
    return Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) / 86_400_000;
  };
  const days = dayOf(t) - dayOf(now);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days > 1 && days < 6) return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
