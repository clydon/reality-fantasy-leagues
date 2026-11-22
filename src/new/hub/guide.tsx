"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, EyeOff, Gamepad2, Plus, UserPlus } from "lucide-react";
import { episodeLine, eveningAt, guideWeek, nextUpAfter, type GuideCard, type GuideDay, type GuidePlan, type GuideShow } from "@/lib/game/guide";
import { alsoOn, hitOfListing, listingLine, type AlsoOnDay, type AlsoOnItem } from "@/lib/game/tv-listings";
import { guide as guideApi, useListingsWeek, useOnNow, useSetGuideHidden, type Couch, type CouchShow, type HiddenShow, type Home } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { airTime, timeOf } from "../clock";
import { Avatar, TinyFace } from "../ui/bars";
import { PushedPage, usePushedPage } from "../ui/page";
import { SwipePager, type PagerHandle } from "../ui/swipe-pager";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { openPlan, PlanPlates } from "../couch/watch-plans";
import { plainName as plain } from "../couch/where";
import { usePracticeShows } from "../tour/practice-shows";
import { ListingsCredit } from "../watching/search";
import { openWatching } from "../watching/sheets";
import { SportsGuide } from "../sports/guide";
import { useHideSports } from "../sports/scores";
import { namesOf, showOfMove } from "./sections";
import { StreamingRail } from "./streaming";

// The TV guide, its own place since the design round's step 7 (docs/design-round/step7-hub-spec.md; Phase 0's decision 7): a page
// pushed over the hub (GuidePage: the week as seven cells, the day as a rundown, Also on, At your own pace), opened from the hub's
// On TV row (OnTvRow: a channel bug and this week's cards crawling by). Before, "This week on the couch", the TV guide (the mock's index.html guideDays / card, tvguide.js, streaming.js's drop days), and
// Streaming on the couch (streaming.js) under it. The guide is real since step 11 part 1: your shows and the couch's, from
// the home read's `week` (when each episode airs, never a title), laid out by the pure src/lib/game/guide.ts in the phone's
// own time zone; Hide from guide (guide.ts on the server). Since part 2, Also on: the rest of TV each evening, from the
// week's listings (/api/listings/week, the same for everyone; src/lib/game/tv-listings.ts leaves out your shows, the
// couch's and what you've hidden), the most watched few and "N more on TV". Since part 3, the couch's planned nights: a watch
// along planned for an airing tags its card, one at a time of its own is a card of its own (it opens the plan); a couch
// show's sheet and a listing's plan one. The rail under it is streaming.tsx (step 14).

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** What the guide shows under your shows and the couch's (2026-10-27): nothing more (to begin with), the competitions on TV
 *  (tv-listings.ts competitionOf), or all of TV. Per phone; held for the visit when the phone won't keep it. */
type OnTv = "couch" | "comps" | "all" | "sports";
const ON_TV_KEY = "gys.guideTv";
const onTvListeners = new Set<() => void>();
let onTvHere: OnTv | null = null;

function readOnTv(): OnTv {
  if (onTvHere) return onTvHere;
  try {
    const v = localStorage.getItem(ON_TV_KEY);
    return v === "comps" || v === "all" || v === "sports" ? v : "couch";
  } catch {
    return "couch";
  }
}

function setOnTv(v: OnTv) {
  onTvHere = v;
  try {
    localStorage.setItem(ON_TV_KEY, v);
  } catch {
    /* kept for this visit only */
  }
  onTvListeners.forEach((l) => l());
}

const useOnTv = () =>
  useSyncExternalStore(
    (l) => {
      onTvListeners.add(l);
      return () => onTvListeners.delete(l);
    },
    readOnTv,
    (): OnTv => "couch"
  );

/** The guide's switch, at its top: My shows · Competitions · Sports (this week's games by team) · All TV (the user, 2026-11-01 and
 *  2026-11-15; U1's sports slice, 2026-11-09: sports/guide.tsx). */
function OnTvSwitch({ on }: { on: OnTv }) {
  const choices: [OnTv, string][] = [
    // The user's order (2026-11-15): my shows, competitions, sports, all TV. "My shows" holds the couch's shows too, as before.
    ["couch", "My shows"],
    ["comps", "Competitions"],
    ["sports", "Sports"],
    ["all", "All TV"],
  ];
  const choice = "nd-press h-11 flex-auto rounded-[2px] px-2 text-[15px] font-semibold transition-colors";
  return (
    <div role="radiogroup" aria-label="What the guide shows" data-guide-tv={on} className="flex flex-1 gap-[2px] rounded-[3px] p-[2px] outline-1 -outline-offset-1 outline-border">
      {choices.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={on === id}
          data-guide-tv-choice={id}
          onClick={() => setOnTv(id)}
          className={`${choice} ${on === id ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The clock the guide is drawn at, moved on each minute (the Now line, On now); nothing is read again. */
export function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Whether a hidden row is this show (by the show, or by its listing). */
export const hides = (h: HiddenShow, show: { id: string; tvmazeId?: number | null }) => (h.showId != null && h.showId === show.id) || (h.tvmazeId != null && h.tvmazeId === show.tvmazeId);

/** Your shows (what you follow or play) and the couch's you don't follow (what its people watch openly), as the guide takes them. */
export function guideShows(home: Home, couch: Couch | null): GuideShow[] {
  const members = couch?.members ?? [];
  const facesOf = (seasonId: string) => members.filter((m) => m.watching.includes(seasonId)).map((m) => ({ userId: m.userId, name: m.name }));
  // The episode each of your moves is for (Up next's when the move doesn't say).
  const due = new Map<string, number>();
  for (const m of home.moves) {
    const s = showOfMove(home, m);
    const n = m.episode ?? s?.upNext?.number;
    if (s && n != null && !(due.get(s.seasonId)! <= n)) due.set(s.seasonId, n);
  }
  // A game's going on a season: one of yours, or the couch's (not archived).
  const gamesOn = (seasonId: string, mine: Home["shows"][number]["games"] = []) =>
    [...mine, ...(couch?.games ?? [])].some((g) => g.seasonId === seasonId && !g.archived);
  const yours: GuideShow[] = home.shows
    .filter((s) => s.following || s.games.length)
    .map((s) => ({
      seasonId: s.seasonId,
      name: plain(s.show.name),
      seasonNumber: s.seasonNumber,
      artUrl: s.show.artUrl,
      release: s.release,
      week: s.week ?? [],
      tie: s.games.length ? "plays" : "watches",
      faces: facesOf(s.seasonId),
      dueEpisode: due.get(s.seasonId) ?? null,
      games: gamesOn(s.seasonId, s.games),
    }));
  const hidden = home.guideHidden ?? [];
  const theirs: GuideShow[] = (home.couchShows ?? [])
    .filter((s) => members.some((m) => m.userId !== home.user.id && m.watching.includes(s.seasonId)) && !hidden.some((h) => hides(h, s.show)))
    .map((s) => ({
      seasonId: s.seasonId,
      name: plain(s.show.name),
      seasonNumber: s.seasonNumber,
      artUrl: s.show.artUrl,
      release: s.release,
      week: s.week ?? [],
      tie: "couch",
      faces: facesOf(s.seasonId),
      dueEpisode: null,
      games: gamesOn(s.seasonId),
    }));
  return [...yours, ...theirs];
}

/** The couch's planned nights as the guide takes them: not one you can't make, nor (unless you're in it) one for a show you hid. */
export function guidePlans(home: Home, couch: Couch | null): GuidePlan[] {
  if (!couch) return [];
  const hidden = home.guideHidden ?? [];
  return (home.plans ?? [])
    .filter((p) => p.couchId === couch.id && p.you !== "out" && (p.you || !hidden.some((h) => h.showId === p.showId)))
    .map((p) => ({
      id: p.id,
      seasonId: p.seasonId,
      name: p.name,
      seasonNumber: p.seasonNumber,
      artUrl: p.artUrl,
      episode: p.episode,
      how: p.how,
      at: Date.parse(p.startsAt),
      endsAt: Date.parse(p.endsAt),
      faces: p.people.filter((x) => x.answer === "in").map((x) => ({ userId: x.userId, name: x.name })),
      you: p.you === "out" ? null : p.you,
    }));
}

/** A planned night's people, on its card: "you + 2", "riley + jordan". */
function planWho(p: GuidePlan, me: string): string {
  const others = p.faces.filter((f) => f.userId !== me);
  if (p.you === "host" || p.you === "in") return others.length ? `you + ${others.length}` : "you";
  return others.map((f) => f.name).slice(0, 2).join(" + ") + (others.length > 2 ? ` + ${others.length - 2}` : "");
}

/** What's hidden, less anything that's yours now (your own shows always show). */
function hiddenNow(home: Home): HiddenShow[] {
  const mine = home.shows.filter((s) => s.following || s.games.length).map((s) => s.show);
  return (home.guideHidden ?? []).filter((h) => !mine.some((s) => hides(h, s)));
}

/** Who's on a card: their initials on their colours, four at most. */
function Faces({ faces }: { faces: GuideCard["faces"] }) {
  if (!faces.length) return null;
  return (
    <span role="img" className="flex flex-none pl-[3px]" aria-label={`${namesOf(faces.map((f) => f.name))} watch it`}>
      {faces.slice(0, 4).map((f) => (
        <TinyFace
          key={f.userId}
          id={f.userId}
          name={f.name}
          className="-ml-[3px] grid size-[18px] place-items-center rounded-[2px] text-[10px] font-extrabold text-[#121018] shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]"
        />
      ))}
    </span>
  );
}

const CARD =
  "relative isolate flex w-full flex-col justify-end overflow-hidden rounded-[3px] bg-card px-[9px] py-2 text-left text-white transition-transform duration-300 active:scale-[.97]";
// The fade ladder (tvguide.css): yours in full, faded a step more when it isn't yours. A game going on it is the controller in
// the corner (2026-10-27: it replaced the dashed edge for a show you watch without playing, and the foot's legend).
/** A day's cards, in order. */
export const cardsOf = (d: GuideDay) => d.slots.flatMap((sl) => (Array.isArray(sl) ? sl : [sl]));

const FADED = "opacity-80 [filter:saturate(.3)_brightness(.78)]";

/** A card's art, or with none (a show added by name, a listing without a poster) its first letter, faint (tvguide.css g-noart). */
/** `bare`: no letter on a card without art (a small card, where it sat under the time chip). */
function GuideArt({ id, c, className = "", bare = false }: { id: string; c: Pick<GuideCard, "artUrl" | "name" | "drop">; className?: string; bare?: boolean }) {
  return c.artUrl ? (
    <ShowArt seasonId={id} artUrl={c.artUrl} name={c.name} position={c.drop ? "center 25%" : "center"} className={`absolute inset-0 -z-[2] size-full ${className}`} />
  ) : (
    <span data-art={id} aria-hidden className="type-caption absolute inset-0 -z-[2] grid place-items-center bg-[linear-gradient(150deg,#3a3548,#16141d)] text-[34px] text-white/20">
      {bare ? null : c.name.replace(/^the\s+/i, "")[0]?.toUpperCase()}
    </span>
  );
}

/** Sports scores too (U1's sports slice): the sports seasons whose cards say only when a game started, never On now or aired. */
const HiddenSports = createContext<Set<string>>(new Set());

function CardBody({ c, now, me, noTime = false }: { c: GuideCard; now: number; me: string; noTime?: boolean }) {
  const own = c.key.startsWith("plan:");
  const quiet = useContext(HiddenSports).has(c.seasonId) && c.at < now && !own;
  if (quiet) c = { ...c, live: false };
  return (
    <>
      <GuideArt id={`guide-${c.key}`} c={c} className={c.tie !== "plays" ? "[filter:saturate(.35)_brightness(.8)]" : ""} />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.15)_0%,rgba(10,8,14,.55)_48%,rgba(10,8,14,.92)_100%)]" />
      {(!noTime || c.live || quiet) && (
        <span
          className={`absolute left-2 top-[7px] flex items-center gap-[5px] rounded-[2px] px-1.5 py-[3px] text-[13px] font-extrabold backdrop-blur-sm ${
            c.live ? "bg-live text-live-foreground" : "bg-[rgba(10,8,14,.72)]"
          }`}
        >
          {c.live && <i className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />}
          {c.live ? "On now" : quiet ? `Started ${timeOf(c.at)}` : timeOf(c.at)}
        </span>
      )}
      {/* A game's going on it: a white controller, with a move due its red dot. */}
      {c.games ? (
        <span data-games className="absolute right-[7px] top-[7px] grid size-[22px] place-items-center text-white [filter:drop-shadow(0_1px_3px_rgba(0,0,0,.8))]">
          <Gamepad2 className="size-[19px]" strokeWidth={2.2} aria-hidden />
          {c.due && <i data-due className="absolute -right-0.5 top-0 size-2 rounded-full bg-chyron-line shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]" />}
        </span>
      ) : (
        c.due && <i data-due className="absolute right-2 top-2 size-[9px] rounded-full bg-chyron-line shadow-[0_0_0_2px_rgba(10,8,14,.8)]" />
      )}
      {c.drop != null && (
        <span className="type-caption mb-1 self-start bg-secondary py-[3px] pl-1.5 pr-2.5 text-[10px] tracking-[0.06em] text-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
          All {c.drop} drop
        </span>
      )}
      {/* One the first-time tour's practice added (tour/practice-shows.ts): here for the tour, not saved. */}
      {c.key.startsWith("tour-") && (
        <span data-practice-tag className="type-caption mb-1 self-start bg-quiet-tag py-[3px] pl-1.5 pr-2.5 text-[11px] tracking-[0.06em] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
          Practice
        </span>
      )}
      {/* A planned night (part 3): teal, good news rather than a duty (the mock's b-tag good). */}
      {c.plan && (
        <span data-plan-tag className="type-caption mb-1 self-start bg-good py-[3px] pl-1.5 pr-2.5 text-[10px] tracking-[0.06em] text-good-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
          Watch along{own ? ` · Ep ${c.plan.episode}` : ""}
        </span>
      )}
      <span className="type-caption line-clamp-2 text-[17px] leading-[.95] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{c.name}</span>
      <span className="mt-1 flex items-center justify-between gap-1 text-[13px] font-semibold opacity-90">
        <span className="truncate">{own ? planWho(c.plan!, me) : c.at < now && !c.live && !c.drop && !quiet ? `${episodeLine(c)} · aired` : episodeLine(c)}</span>
        <Faces faces={c.faces} />
      </span>
    </>
  );
}

/** A card: your show opens it (its art grows into the show bar); a couch show you don't follow opens its sheet; a planned night
 *  of its own opens the plan. A planned night (or the airing it's for) has a solid teal edge (the mock's b-plan / b-together),
 *  not faded while you're in it. */
function Card({ c, now, me, height = 104, onCouch, noTime = false }: { c: GuideCard; now: number; me: string; height?: number; onCouch: (c: GuideCard) => void; noTime?: boolean }) {
  const own = c.key.startsWith("plan:");
  const edge = c.plan ? "outline-[1.5px] -outline-offset-[1.5px] outline-solid outline-good" : "";
  const cls = `${CARD} ${edge} ${c.tie === "couch" && !c.plan?.you ? FADED : ""}`;
  const data = { "data-guide-card": c.key, "data-tie": c.tie, "data-live": c.live || undefined, "data-drop": c.drop ?? undefined, "data-plan": c.plan?.id };
  const extra = `${c.games ? ", a game's on" : ""}${c.due ? ", a move is due" : ""}`;
  const label = own
    ? `${c.name}, watch along for Episode ${c.plan!.episode}, ${c.live ? "on now" : airTime(c.at)}${extra}`
    : `${c.name}, ${c.drop ? `all ${c.drop} episodes drop` : episodeLine(c)}, ${c.live ? "on now" : airTime(c.at)}${c.plan ? ", a watch along" : ""}${c.tie === "couch" ? ", not on your shows" : ""}${extra}`;
  if (own) {
    return (
      <button type="button" {...data} aria-label={label} className={cls} style={{ height }} onClick={() => openPlan({ kind: "plan", planId: c.plan!.id })}>
        <CardBody c={c} now={now} me={me} noTime={noTime} />
      </button>
    );
  }
  return c.tie === "couch" ? (
    <button type="button" {...data} aria-label={label} className={cls} style={{ height }} onClick={() => onCouch(c)}>
      <CardBody c={c} now={now} me={me} noTime={noTime} />
    </button>
  ) : (
    <NavLink href={paths.show(c.seasonId)} channel {...data} aria-label={label} className={cls} style={{ height }}>
      <CardBody c={c} now={now} me={me} noTime={noTime} />
    </NavLink>
  );
}

/** Today with nothing on: what's next this week ("Nothing tonight · Next up"). */
function NextUpCard({ c, evening, today = true, onCouch }: { c: GuideCard; evening: boolean; today?: boolean; onCouch: (c: GuideCard) => void }) {
  const body = (
    <>
      <GuideArt id={`guide-next-${c.key}`} c={c} className="[filter:saturate(.5)_brightness(.7)]" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.3)_0%,rgba(10,8,14,.92)_100%)]" />
      <span className="absolute left-2 top-[7px] rounded-[2px] bg-[rgba(10,8,14,.72)] px-1.5 py-[3px] text-[13px] font-extrabold backdrop-blur-sm">
        {today ? `Nothing ${evening ? "tonight" : "today"}` : "Nothing on"}
      </span>
      <span className="type-caption text-[11px] tracking-[0.06em] text-white/70">Next up</span>
      <span className="type-caption line-clamp-2 text-[17px] leading-[.95]">{c.name}</span>
      <span className="mt-1 truncate text-[13px] font-semibold opacity-90">{airTime(c.at)}</span>
    </>
  );
  const cls = `${CARD} h-[104px]`;
  return c.tie === "couch" ? (
    <button type="button" data-guide-next className={cls} onClick={() => onCouch(c)}>
      {body}
    </button>
  ) : (
    <NavLink href={paths.show(c.seasonId)} data-guide-next className={cls}>
      {body}
    </NavLink>
  );
}

/** A listing's time ("8:00 PM"), or a drop's "Streaming" (it has no time). */
const listingTime = (l: AlsoOnItem) => (l.binge ? "Streaming" : timeOf(l.at));

/** A listing's art, or its first letter, faint. */
function ListingArt({ l, className = "" }: { l: AlsoOnItem; className?: string }) {
  return l.art ? (
    // eslint-disable-next-line @next/next/no-img-element -- TVmaze's image CDN (hotlinking is allowed)
    <img src={l.art} alt="" className={`object-cover ${className}`} />
  ) : (
    <span aria-hidden className={`type-caption grid place-items-center bg-[linear-gradient(150deg,#3a3548,#16141d)] text-[30px] text-white/20 ${className}`}>
      {l.name.replace(/^the\s+/i, "")[0]?.toUpperCase()}
    </span>
  );
}

/** Also on (tvguide.js): the evening's most watched few on TV, shorter and faded a step more than a couch show, and "N more on
 *  TV". "On TV" when none of your shows or the couch's are on that day. A card opens the listing's sheet. */
function AlsoOn({ day, label, onOpen, onMore }: { day: AlsoOnDay; label: string; onOpen: (l: AlsoOnItem) => void; onMore: () => void }) {
  if (!day.all.length) return null;
  const more = day.all.length - day.few.length;
  return (
    <div data-also-on={day.offset} className="flex flex-col gap-[7px]">
      <div className="type-caption mt-0.5 flex h-3.5 items-center gap-1.5 text-[10px] tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">{label}</div>
      {day.few.map((l) => (
        <button
          key={l.key}
          type="button"
          data-listing={l.key}
          data-tvmaze={l.tvmazeId}
          onClick={() => onOpen(l)}
          aria-label={`${l.name}, ${l.binge ? "streaming" : airTime(l.at)}, not on your shows`}
          className={`relative isolate flex h-[66px] w-full flex-col justify-end overflow-hidden rounded-[3px] bg-card px-2 py-1.5 text-left text-white outline-1 -outline-offset-1 outline-white/10 transition-[transform,filter,opacity] duration-300 hover:opacity-100 hover:[filter:none] focus-visible:opacity-100 focus-visible:[filter:none] active:scale-[.97] ${FADED}`}
        >
          <ListingArt l={l} className="absolute inset-0 -z-[2] size-full" />
          <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.15)_0%,rgba(10,8,14,.55)_48%,rgba(10,8,14,.92)_100%)]" />
          <span className="mb-0.5 self-start rounded-[2px] bg-[rgba(10,8,14,.72)] px-[5px] py-0.5 text-[10px] font-extrabold">{listingTime(l)}</span>
          <span className="type-caption truncate text-sm leading-[.95]">{l.name}</span>
          <span className="mt-px truncate text-[10px] font-semibold opacity-85">{listingLine(l)}</span>
        </button>
      ))}
      {more > 0 && (
        <button
          type="button"
          data-also-more={day.offset}
          onClick={onMore}
          className="nd-press flex h-11 items-center justify-center rounded-[3px] text-[13px] font-semibold text-muted-foreground outline-1 -outline-offset-1 outline-dashed outline-border"
        >
          {more} more on TV
        </button>
      )}
    </div>
  );
}

/** A day's label in the week's cells: "Today", else the weekday. */
const cellLabel = (d: GuideDay) => (d.offset === 0 ? "Today" : DAY[new Date(d.start).getDay()]);

/** The week (the design round's step 7): seven cells across, each the day, its date, the art of your shows that night in small and
 *  a live dot on today's when something's on; the chosen one on the foreground fill (it inverts with the ground, as the switch
 *  does), today's label in the chyron line. */
/**
 * The day bar (the user, 2026-11-15: "the only thing that animates a transition is the main section and the today, mon, tue bar"):
 * one white highlight that slides from day to day with the pager, following the finger mid-swipe (`highlight`: the pager's onMove
 * moves it directly, no re-render), over the seven cells' own grounds.
 */
function WeekCells({ week, day, onDay, highlight }: { week: GuideDay[]; day: number; onDay: (n: number) => void; highlight: React.RefObject<HTMLSpanElement | null> }) {
  return (
    <div role="tablist" aria-label="This week" data-guide-week className="relative mx-4 mt-3">
      <div aria-hidden className="absolute inset-0 grid grid-cols-7 gap-1">
        {week.map((d) => (
          <span key={d.offset} className="rounded-[3px] bg-card" />
        ))}
      </div>
      <span
        ref={highlight}
        aria-hidden
        data-guide-highlight
        className="absolute inset-y-0 left-0 z-[1] w-[calc((100%-24px)/7)] rounded-[3px] bg-foreground will-change-transform"
        style={{ transform: `translateX(calc(${day} * (100% + 4px)))` }}
      />
      <div className="relative z-[2] grid grid-cols-7 gap-1">
        {week.map((d) => {
          const cards = cardsOf(d);
          const art = [...new Map(cards.filter((c) => c.tie !== "couch").map((c) => [c.seasonId, c])).values()].slice(0, 3);
          const on = d.offset === day;
          const live = cards.some((c) => c.live);
          const date = new Date(d.start);
          return (
            <button
              key={d.offset}
              type="button"
              role="tab"
              aria-selected={on}
              data-guide-cell={d.offset}
              aria-label={`${d.offset === 0 ? "Today" : DAY_LONG[date.getDay()]} ${MON[date.getMonth()]} ${date.getDate()}, ${cards.length} on${live ? ", on now" : ""}`}
              onClick={() => onDay(d.offset)}
              className={`nd-press relative flex min-h-[74px] flex-col items-center gap-1 rounded-[3px] pb-1.5 pt-2 transition-colors duration-200 ${on ? "text-background" : ""}`}
            >
              <span className={`type-caption text-[13px] tracking-[0.04em] ${on ? "" : d.offset === 0 ? "text-chyron-line" : "text-muted-foreground"}`}>{cellLabel(d)}</span>
              <span className="type-num text-[19px] leading-none">{date.getDate()}</span>
              <span className="flex h-3 items-center gap-[2px]" aria-hidden>
                {live && <i className="mr-[2px] size-1.5 rounded-full bg-live" />}
                {art.map((c) =>
                  c.artUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the show's key art, any host
                    <img key={c.seasonId} src={c.artUrl} alt="" className="size-3 rounded-[2px] object-cover" />
                  ) : (
                    <i key={c.seasonId} className={`size-3 rounded-[2px] ${on ? "bg-background/40" : "bg-secondary"}`} />
                  )
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One day as a rundown (step 7): a time gutter on the left, the cards on the right (two at the same time side by side), the Now
 *  line across both; a day with nothing of yours, what's next this week. A swipe across it turns the day. */
function DayRundown({
  d,
  now,
  me,
  week,
  also,
  onCouch,
  onListing,
  onMore,
}: {
  d: GuideDay;
  now: number;
  me: string;
  week: GuideDay[];
  also: AlsoOnDay | undefined;
  onCouch: (c: GuideCard) => void;
  onListing: (l: AlsoOnItem) => void;
  onMore: (d: GuideDay) => void;
}) {
  const date = new Date(d.start);
  const evening = eveningAt(now);
  const onTv = !!also?.all.length;
  const next = !d.slots.length ? nextUpAfter(week, d.offset) : null;
  // The day's list keeps a fixed height so At your own pace stays on the page (the user, 2026-11-15); when it holds more, the last
  // card in view is cut off part-way and fades out at the bottom, until it's scrolled to its end.
  const list = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const [above, setAbove] = useState(false);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    // Today opens at the Now line: what's aired is a scroll up, behind a fade at the top.
    const nowEl = el.querySelector<HTMLElement>("[data-guide-now]");
    if (d.offset === 0 && nowEl) el.scrollTop = Math.max(0, nowEl.offsetTop - 4);
    const check = () => {
      setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
      setAbove(el.scrollTop > 6);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro.disconnect();
    };
    // Once, as the day opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = more && above ? "linear-gradient(180deg, transparent 0%, #000 14%, #000 72%, transparent 100%)" : more ? "linear-gradient(180deg, #000 72%, transparent 100%)" : above ? "linear-gradient(180deg, transparent 0%, #000 14%)" : null;
  const nowLine = (
    <div data-guide-now className="type-caption flex h-4 items-center gap-2 text-[13px] tracking-[0.06em] text-chyron-line after:h-0.5 after:flex-1 after:bg-chyron-line">
      Now {timeOf(now)}
    </div>
  );
  const title = d.offset === 0 ? (evening ? "Tonight" : "Today") : d.offset === 1 ? "Tomorrow" : DAY_LONG[date.getDay()];
  return (
    <div data-guide-day={d.offset} className="mt-5 px-4" style={{ minHeight: "calc(max(232px, 100svh - 470px) + 52px)" }}>
      <h2 className="type-caption mb-3 flex items-baseline gap-2 text-[24px]">
        {title}
        <span className="text-[14px] font-semibold normal-case tracking-normal text-muted-foreground [font-stretch:100%]">
          {DAY[date.getDay()]} {MON[date.getMonth()]} {date.getDate()}
        </span>
      </h2>
      <div
        ref={list}
        data-guide-list
        data-more={more || undefined}
        data-above={above || undefined}
        className="relative -mx-1 flex max-h-[max(232px,calc(100svh-470px))] flex-col gap-2.5 overflow-y-auto overscroll-contain px-1 pb-1 [scrollbar-width:none]"
        style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
      >
        {d.slots.map((sl, k) => {
          const cards = Array.isArray(sl) ? sl : [sl];
          const live = cards.some((c) => c.live);
          return (
            <div key={cards[0].key} className="contents">
              {d.nowAt === k && nowLine}
              <div data-guide-slot className="grid flex-none grid-cols-[58px_1fr] items-start gap-2">
                <span className={`type-caption pt-1 text-[15px] leading-tight ${live ? "text-live" : cards[0].at < now ? "text-muted-foreground" : ""}`}>
                  {timeOf(cards[0].at).replace(":00", "")}
                </span>
                <div className={`flex min-w-0 gap-2 ${cards.length > 2 ? "flex-wrap" : ""}`} data-guide-same={cards.length > 1 || undefined}>
                  {cards.map((c) => (
                    <div key={c.key} className={cards.length > 2 ? "w-[calc(50%-4px)]" : "min-w-0 flex-1"}>
                      <Card c={c} now={now} me={me} height={cards.length > 1 ? 96 : 112} onCouch={onCouch} noTime />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {d.nowAt != null && d.nowAt >= d.slots.length && d.slots.length > 0 && nowLine}
        {!d.slots.length &&
          (next ? (
            <>
              {d.offset === 0 && nowLine}
              <NextUpCard c={next} evening={evening && d.offset === 0} today={d.offset === 0} onCouch={onCouch} />
            </>
          ) : (
            !onTv && <div className="grid h-14 place-items-center rounded-[3px] border border-dashed border-border text-[13px] text-muted-foreground">Nothing on</div>
          ))}
        {also && <AlsoOn day={also} label={d.slots.length ? "Also on" : "On TV"} onOpen={onListing} onMore={() => onMore(d)} />}
      </div>
    </div>
  );
}

/** The guide's week as the hub's On TV row and the guide's page both read it: your shows and the couch's, its planned nights. */
export function useGuideWeek(read: Home, couch: Couch | null) {
  const now = useMinute();
  // The first-time tour's demo shows (tour/practice-shows.ts), as yours while it shows where shows you add go.
  const practice = usePracticeShows();
  const home = useMemo(() => (practice.length ? { ...read, shows: [...read.shows, ...practice] } : read), [read, practice]);
  const shows = useMemo(() => guideShows(home, couch), [home, couch]);
  const plans = useMemo(() => guidePlans(home, couch), [home, couch]);
  const week = useMemo(() => guideWeek(shows, now, undefined, plans), [shows, now, plans]);
  const hideSports = useHideSports();
  const quietSports = useMemo(
    () => new Set(hideSports ? [...home.shows, ...(home.couchShows ?? [])].filter((s) => s.show.kind === "sport").map((s) => s.seasonId) : []),
    [hideSports, home]
  );
  return { home, now, week, quietSports };
}

/** A card in miniature, for On TV's crawl: the art, the time (or On now, or the day past today), the name; whoever on the couch is
 *  watching along with it now, as their face. It opens the show (the user, 2026-11-19: not the guide), its art growing into the
 *  show bar like the guide's own cards; the first-time tour's practice cards, not real shows, open the guide on their day. */
function MiniCard({ c, offset, now, along, onOpen }: { c: GuideCard; offset: number; now: number; along: { userId: string; name: string }[]; onOpen: () => void }) {
  const quiet = useContext(HiddenSports).has(c.seasonId) && c.at < now;
  const live = c.live && !quiet;
  const when = live ? "On now" : quiet ? "Started" : offset === 0 ? timeOf(c.at).replace(":00", "") : `${DAY[new Date(c.at).getDay()]} ${timeOf(c.at).replace(":00", "")}`;
  const practice = c.key.startsWith("tour-");
  const props = {
    "data-guide-card": c.key,
    "data-live": live || undefined,
    "data-tie": c.tie,
    "aria-label": `${c.name}, ${episodeLine(c)}, ${live ? "on now" : airTime(c.at)}${along.length ? `, ${namesOf(along.map((a) => a.name))} watching along` : ""}. ${practice ? "Opens the guide" : "Opens the show"}`,
    className: `relative isolate flex h-[72px] w-[124px] flex-none flex-col justify-end overflow-hidden rounded-[3px] bg-secondary px-2 pb-1.5 text-left text-white active:scale-[.97] ${c.tie === "couch" ? FADED : ""}`,
  };
  const body = (
    <>
      <GuideArt id={`ontv-${c.key}`} c={c} bare />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.1)_0%,rgba(10,8,14,.5)_45%,rgba(10,8,14,.92)_100%)]" />
      <span
        className={`absolute left-1.5 top-1.5 flex items-center gap-1 rounded-[2px] px-1.5 py-[2px] text-[13px] font-extrabold backdrop-blur-sm ${live ? "bg-live text-live-foreground" : "bg-[rgba(10,8,14,.72)]"}`}
      >
        {live && <i className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" aria-hidden />}
        {when}
      </span>
      {along.length > 0 && (
        <span className="absolute right-1.5 top-1.5 flex" aria-hidden>
          {along.slice(0, 2).map((a) => (
            <span key={a.userId} className="-ml-1 rounded-[3px] shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]">
              <Avatar id={a.userId} name={a.name} size={18} />
            </span>
          ))}
        </span>
      )}
      {/* One the first-time tour's practice added: here for the tour, not saved. */}
      {c.key.startsWith("tour-") && (
        <span data-practice-tag className="type-caption mb-1 self-start bg-quiet-tag py-[2px] pl-1.5 pr-2.5 text-[11px] tracking-[0.06em] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
          Practice
        </span>
      )}
      <span className="type-caption truncate text-[15px] leading-[.95] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{c.name}</span>
    </>
  );
  return practice ? (
    <button type="button" {...props} onClick={onOpen}>
      {body}
    </button>
  ) : (
    <NavLink href={paths.show(c.seasonId)} channel {...props}>
      {body}
    </NavLink>
  );
}

/**
 * On TV (Phase 0's decision 7, the design round's step 7): the hub's door to the guide, a channel bug and a crawl, the Lower
 * Third's own form. The bug ("On TV", a live dot while something's on, "Guide") opens the guide on today; the row is this week's
 * cards in miniature, from what's on now or next, still (the motion is the guide's: the user, 2026-11-15), swiped by hand; a
 * card opens its show (the user, 2026-11-19). The first-time tour lights it (`data-guide`).
 * Sports games aren't here: they're on the scores strip right under it (docs/PLAN-sports-couch.md A1: hub/scores-strip.tsx), so a
 * game is on the hub once.
 */
export function OnTvRow({ home: read, couch }: { home: Home; couch: Couch | null }) {
  const page = usePushedPage("guide", ["day"]);
  // Still (the user, 2026-11-15: "I did not mean the widget on the hub to be animated, I meant the TV guide once we click into
  // it"): the motion is the guide's own (its marquee, its grid drifting through the evening). The cards still swipe by hand.
  const reel = useRef<HTMLDivElement>(null);
  const { home, now, week, quietSports } = useGuideWeek(read, couch);
  const along = useOnNow(couch?.id ?? null).data?.now ?? [];
  // A sport's games are on the scores strip under this row (hub/scores-strip.tsx): a game is on the hub once.
  const sport = new Set([...home.shows, ...(home.couchShows ?? [])].filter((s) => s.show.kind === "sport").map((s) => s.seasonId));
  const cards = week.flatMap((d) => cardsOf(d).filter((c) => (d.offset > 0 || c.endsAt > now) && !sport.has(c.seasonId)).map((c) => ({ c, offset: d.offset })));
  const live = cards.some(({ c }) => c.live && !(quietSports.has(c.seasonId) && c.at < now));
  return (
    <HiddenSports.Provider value={quietSports}>
      <section data-guide data-on-tv={cards.length} className="mx-4 mt-3 flex h-[88px] items-stretch overflow-hidden rounded-[4px] bg-card">
        <button
          type="button"
          data-on-tv-open
          onClick={() => page.show()}
          aria-label={`On TV${live ? ", something's on now" : ""}: open the guide`}
          className="nd-press relative z-[1] flex w-[104px] flex-none flex-col justify-center gap-2 bg-secondary pl-3 pr-4 text-left [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)]"
        >
          <span className="type-caption flex items-center gap-1.5 whitespace-nowrap text-[22px] leading-none">
            {live && <i className="size-[7px] flex-none rounded-full bg-live" aria-hidden />}
            On TV
          </span>
          {/* The way into the full guide (the user, 2026-11-15: grey "Guide >" too subtle, a white plate too loud): the system's
              secondary control, an outline at the control edge's 3:1 with bone words and an arrow. The white plate stays the move's. */}
          <span className="flex h-8 w-fit items-center gap-1 rounded-[3px] px-2 text-[14px] font-semibold text-foreground outline-1 -outline-offset-1 outline-edge">
            Guide
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </button>
        {cards.length ? (
          <div
            ref={reel}
            data-guide-reel
            className="-ml-2 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pl-3 pr-6 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_12px,#000_calc(100%_-_28px),transparent)]"
          >
            {cards.map(({ c, offset }) => (
              <span key={c.key} data-guide-day={offset} className="contents">
                <MiniCard
                  c={c}
                  offset={offset}
                  now={now}
                  along={c.live ? along.filter((w) => w.seasonId === c.seasonId && w.userId !== home.user.id) : []}
                  onOpen={() => page.showWith({ day: String(offset) })}
                />
              </span>
            ))}
            {/* The row's end is a door too: the whole week. */}
            <button
              type="button"
              data-on-tv-week
              onClick={() => page.show()}
              className="nd-press flex h-[72px] w-[104px] flex-none flex-col items-start justify-center gap-1 rounded-[3px] px-2.5 text-left outline-1 -outline-offset-1 outline-edge"
            >
              <span className="type-caption text-[17px] leading-none">The whole week</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                Guide
                <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => page.show()} className="flex min-w-0 flex-1 items-center px-3 text-left text-[14px] leading-snug text-muted-foreground">
            Nothing of yours on this week. See what&rsquo;s on TV
          </button>
        )}
      </section>
    </HiddenSports.Provider>
  );
}

/** The guide (Phase 0's decision 7, the design round's step 7): its own place, pushed over the hub (`?page=guide`, `&day=` the day
 *  it opens on), so back closes it. */
export function GuidePage({ home, couch }: { home: Home; couch: Couch | null }) {
  const page = usePushedPage("guide", ["day"]);
  return (
    <PushedPage
      open={page.open}
      onClose={page.close}
      title="On TV"
      back="Home"
      end={
        <button
          type="button"
          data-guide-add
          onClick={() => openWatching({ kind: "add" })}
          className="nd-press flex h-11 flex-none items-center gap-1 rounded-[3px] px-3 text-[15px] font-semibold text-foreground outline-1 -outline-offset-1 outline-input"
        >
          <Plus className="size-4" aria-hidden />
          Add a show
        </button>
      }
    >
      <GuideBody home={home} couch={couch} />
    </PushedPage>
  );
}

/** The guide's page: the switch and Add a show, the week, the day as a rundown with Also on under it (or a sport's week), At your
 *  own pace (streaming.tsx's rail, moved here from the hub), what's hidden, and its sheets. */
function GuideBody({ home: read, couch }: { home: Home; couch: Couch | null }) {
  const { home, now, week, quietSports } = useGuideWeek(read, couch);
  const asked = Number(useSearchParams().get("day") ?? 0);
  const [day, setDay] = useState(() => (Number.isInteger(asked) && asked >= 0 && asked < week.length ? asked : 0));
  const hidden = hiddenNow(home);
  const listings = useListingsWeek().data?.listings;
  const onTv = useOnTv();
  // Also on leaves out your shows, the couch's and what you've hidden: by their listing, or by name for a show here that
  // hasn't one yet (the daily job links them). The switch leaves out all of it, or all but the competitions.
  const also = useMemo(() => {
    if (!listings?.length || onTv === "couch" || onTv === "sports") return [];
    const ids = new Set<number>();
    const names: string[] = [];
    const leave = (show: { tvmazeId?: number | null; name: string }) => (show.tvmazeId ? ids.add(show.tvmazeId) : names.push(show.name));
    for (const s of home.shows) if (s.following || s.games.length) leave(s.show);
    for (const s of home.couchShows ?? []) leave(s.show);
    for (const h of home.guideHidden ?? []) if (h.tvmazeId) ids.add(h.tvmazeId);
    return alsoOn(onTv === "comps" ? listings.filter((l) => l.competition) : listings, week, { ids, names }, now);
  }, [listings, home, week, now, onTv]);
  const [couchCard, setCouchCard] = useState<GuideCard | null>(null);
  const [listing, setListing] = useState<AlsoOnItem | null>(null);
  const [evening, setEvening] = useState<GuideDay | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const pager = useRef<PagerHandle>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  const d = week[Math.min(day, week.length - 1)];
  return (
    <HiddenSports.Provider value={quietSports}>
      <div data-guide-page className="pb-[110px]">
        <div className="flex px-4 pt-3">
          <OnTvSwitch on={onTv} />
        </div>
        {onTv === "sports" ? (
          <div className="mt-4">
            <SportsGuide couchId={couch?.id ?? null} />
          </div>
        ) : (
          <>
            <WeekCells week={week} day={d.offset} onDay={(n) => pager.current?.go(n)} highlight={highlight} />
            {/* The days as pages you swipe (the user, 2026-11-15): the page follows the finger and lands with a little overshoot. */}
            <SwipePager
              ref={pager}
              count={week.length}
              index={d.offset}
              onIndex={setDay}
              onMove={(at, ms, easing) => {
                const el = highlight.current;
                if (!el) return;
                el.style.transition = ms ? `transform ${ms}ms ${easing}` : "none";
                el.style.transform = `translateX(calc(${at} * (100% + 4px)))`;
              }}
              label="The guide's days: swipe between them, or use the arrow keys"
              peek="gys.guide-days.peeked"
              attrs={{ "data-guide-days": true }}
              // A mouse drag on a card turns the day too, instead of picking up the link or its picture.
              className="[&_a]:[-webkit-user-drag:none] [&_img]:[-webkit-user-drag:none]"
              page={(i) => (
                // The rundown (the user, 2026-11-15: "let's go back to this, but we can swipe on the page to go to the next day").
                <DayRundown d={week[i]} now={now} me={home.user.id} week={week} also={also[i]} onCouch={setCouchCard} onListing={setListing} onMore={setEvening} />
              )}
            />
          </>
        )}
        <StreamingRail home={home} couch={couch} />
        {hidden.length > 0 && (
          <div className="px-4 pt-4">
            <button type="button" data-guide-hidden onClick={() => setHiddenOpen(true)} className="flex h-10 items-center gap-1.5 text-[14px] font-bold text-foreground underline-offset-2 hover:underline">
              <EyeOff className="size-4" aria-hidden />
              {hidden.length} hidden
            </button>
          </div>
        )}
        <CouchShowSheet home={home} couch={couch} card={couchCard} onOpenChange={(o) => !o && setCouchCard(null)} />
        <ListingSheet l={listing} couchId={couch?.id ?? null} onOpenChange={(o) => !o && setListing(null)} />
        <EveningSheet day={evening} also={evening ? also[evening.offset] : undefined} now={now} onOpenChange={(o) => !o && setEvening(null)} />
        <HiddenSheet open={hiddenOpen} onOpenChange={setHiddenOpen} hidden={hidden} />
      </div>
    </HiddenSports.Provider>
  );
}

/** Hide a show here from your guide (or bring it back), with Undo. */
function useHide() {
  const setHidden = useSetGuideHidden();
  const run = async (show: { seasonId: string } | { showId: string }, name: string, hidden: boolean) => {
    try {
      setHidden((await guideApi.hide(show, hidden)).hidden);
      toast(hidden ? `${name} is hidden from your guide` : `${name} is back on your guide`, hidden ? { undo: () => void run(show, name, false) } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return run;
}

/** A couch show you don't follow (the mock's tvShowSheet and episode sheet): when it's on, who watches it, the couch's planned
 *  nights for it (part 3: I'm in), Add to my shows, Plan a watch along, Hide from guide, or open it. */
function CouchShowSheet({ home, couch, card, onOpenChange }: { home: Home; couch: Couch | null; card: GuideCard | null; onOpenChange: (o: boolean) => void }) {
  const hide = useHide();
  // The last one asked about, kept while the sheet slides away.
  const [shown, setShown] = useState(card);
  if (card && card !== shown) setShown(card);
  const c = card ?? shown;
  const show: CouchShow | undefined = c ? home.couchShows.find((s) => s.seasonId === c.seasonId) : undefined;
  const who = c ? (couch?.members ?? []).filter((m) => m.userId !== home.user.id && m.watching.includes(c.seasonId)).map((m) => m.name) : [];
  const when = c ? `${c.drop ? `All ${c.drop} drop` : "On"} ${airTime(c.at)} · ${c.seasonNumber != null ? `Season ${c.seasonNumber} · ` : ""}${c.drop ? `${c.drop} episodes` : `Episode ${c.numbers[0]}`}` : undefined;
  const plans = c && couch ? (home.plans ?? []).filter((p) => p.couchId === couch.id && p.seasonId === c.seasonId) : [];
  return (
    <Sheet open={!!card} onOpenChange={onOpenChange} title={c?.name ?? ""} subtitle={when}>
      {c && (
        <div data-guide-sheet={c.seasonId}>
          <div className="relative isolate mb-3 flex h-[150px] items-end overflow-hidden rounded-[4px] p-3">
            <ShowArt seasonId={`guide-sheet-${c.seasonId}`} artUrl={c.artUrl} name={c.name} className="absolute inset-0 -z-[2] size-full" />
            {/* With no art, the art is the name already. */}
            {c.artUrl && (
              <>
                <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.05),rgba(16,14,21,.85))]" />
                <b className="type-caption text-[26px] text-white">{c.name}</b>
              </>
            )}
          </div>
          <p className="mb-3 text-[15px] leading-snug text-muted-foreground">
            {who.length ? `${namesOf(who)} ${who.length === 1 ? "watches" : "watch"} it.` : "Someone on the couch watches it."} Add it to your shows and the couch sees you do.
          </p>
          {plans.length > 0 && (
            <div className="mb-3">
              <PlanPlates plans={plans} me={home.user.id} />
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            <Btn
              tone="ink"
              wide
              data-guide-follow
              disabled={!show}
              onClick={() => {
                if (!show) return;
                onOpenChange(false);
                openWatching({
                  kind: "where",
                  target: {
                    seasonId: show.seasonId,
                    label: `${plain(show.show.name)}${show.seasonNumber ? ` ${show.seasonNumber}` : ""}`,
                    show: plain(show.show.name),
                    artUrl: show.show.artUrl,
                    artPosition: "center",
                    aired: show.latestAired,
                    status: show.status === "upcoming" || show.status === "completed" ? show.status : "airing",
                    premiere: show.premiereDate,
                    seen: 0,
                    following: false,
                    plays: false,
                  },
                });
              }}
            >
              <Plus className="size-5" aria-hidden />
              Add to my shows
            </Btn>
            {couch && !plans.some((p) => c.numbers.includes(p.episode)) && (
              <Btn
                wide
                data-guide-plan
                onClick={() => {
                  onOpenChange(false);
                  openPlan({ kind: "new", seasonId: c.seasonId, couchId: couch.id, episode: c.numbers[0] });
                }}
              >
                <UserPlus className="size-5" aria-hidden />
                Plan a watch along
              </Btn>
            )}
            <Btn
              wide
              data-guide-hide
              onClick={() => {
                onOpenChange(false);
                void hide({ seasonId: c.seasonId }, c.name, true);
              }}
            >
              <EyeOff className="size-5" aria-hidden />
              Hide from guide
            </Btn>
            <NavLink href={paths.show(c.seasonId)} className="grid h-11 place-items-center text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline">
              Open the show
            </NavLink>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Hide a TV listing from your guide (or bring it back), with Undo. */
function useHideListing() {
  const setHidden = useSetGuideHidden();
  const run = async (l: { tvmazeId: number; name: string }, hidden: boolean) => {
    try {
      setHidden((await guideApi.hideListing(l.tvmazeId, l.name, hidden)).hidden);
      toast(hidden ? `${l.name} is hidden from your guide` : `${l.name} is back on your guide`, hidden ? { undo: () => void run(l, false) } : {});
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  return run;
}

/** Add a TV listing to your shows: where you are in its season (read from the listing), then it's yours; `then`, once it's here. */
const addListing = (l: AlsoOnItem, then?: (seasonId: string) => void) => openWatching({ kind: "listing", hit: hitOfListing(l), then });

/** A TV listing (the mock's tvShowSheet): when it's on, Add to my shows, Plan a watch along (on a couch: it's added to your shows
 *  first, as a plan needs the show here), Hide from guide. Nobody on the couch watches it. */
function ListingSheet({ l, couchId, onOpenChange }: { l: AlsoOnItem | null; couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const couch = !!couchId;
  const hide = useHideListing();
  const [shown, setShown] = useState(l);
  if (l && l !== shown) setShown(l);
  const c = l ?? shown;
  const when = c ? `${c.binge ? `Streaming ${DAY[new Date(c.at).getDay()]}` : `On TV ${airTime(c.at)}`} · ${listingLine(c)}` : undefined;
  return (
    <Sheet open={!!l} onOpenChange={onOpenChange} title={c?.name ?? ""} subtitle={when}>
      {c && (
        <div data-listing-sheet={c.tvmazeId}>
          <div className="relative isolate mb-3 flex h-[150px] items-end overflow-hidden rounded-[4px] p-3">
            <ListingArt l={c} className="absolute inset-0 -z-[2] size-full" />
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.05),rgba(16,14,21,.85))]" />
            <b className="type-caption text-[26px] text-white">{c.name}</b>
          </div>
          <p className="mb-3 text-[15px] leading-snug text-muted-foreground">
            {couch ? <>Nobody on the couch watches it yet. Add it to your shows and they&rsquo;ll see you do.</> : <>Add it to your shows and it joins your guide.</>}
          </p>
          <div className="flex flex-col gap-2.5">
            <Btn
              tone="ink"
              wide
              data-listing-follow
              onClick={() => {
                onOpenChange(false);
                addListing(c);
              }}
            >
              <Plus className="size-5" aria-hidden />
              Add to my shows
            </Btn>
            {couchId && (
              <Btn
                wide
                data-listing-plan
                onClick={() => {
                  onOpenChange(false);
                  addListing(c, (seasonId) => openPlan({ kind: "new", seasonId, couchId }));
                }}
              >
                <UserPlus className="size-5" aria-hidden />
                Plan a watch along
              </Btn>
            )}
            <Btn
              wide
              data-listing-hide
              onClick={() => {
                onOpenChange(false);
                void hide(c, true);
              }}
            >
              <EyeOff className="size-5" aria-hidden />
              Hide from guide
            </Btn>
          </div>
          <ListingsCredit />
        </div>
      )}
    </Sheet>
  );
}

/** "N more on TV": the whole evening on TV (drops first, then by time), each with Add to my shows and Hide from guide. */
function EveningSheet({ day, also, now, onOpenChange }: { day: GuideDay | null; also: AlsoOnDay | undefined; now: number; onOpenChange: (o: boolean) => void }) {
  const hide = useHideListing();
  const [shown, setShown] = useState<{ day: GuideDay; also: AlsoOnDay | undefined } | null>(day ? { day, also } : null);
  if (day && (day !== shown?.day || also !== shown?.also)) setShown({ day, also });
  const d = day ?? shown?.day ?? null;
  const rows = (day ? also : shown?.also)?.all ?? [];
  useEffect(() => {
    if (day && !rows.length) onOpenChange(false);
  }, [day, rows.length, onOpenChange]);
  const date = d ? new Date(d.start) : null;
  const title = d ? `${d.offset === 0 ? (eveningAt(now) ? "Tonight" : "Today") : d.offset === 1 ? "Tomorrow" : DAY_LONG[date!.getDay()]} on TV` : "";
  return (
    <Sheet open={!!day} onOpenChange={onOpenChange} title={title} subtitle={date ? `${DAY[date.getDay()]} ${MON[date.getMonth()]} ${date.getDate()} · not on your shows` : undefined}>
      <div data-evening-sheet={d?.offset}>
        {rows.map((l) => (
          <div key={l.key} data-evening-row={l.key} data-tvmaze={l.tvmazeId} className="flex min-h-[64px] items-center gap-3 border-b border-border py-1.5">
            <ListingArt l={l} className="h-[54px] w-10 flex-none rounded-[3px]" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px]">{l.name}</b>
              <span className="block truncate text-[13px] text-muted-foreground">
                {listingTime(l)} · {listingLine(l)}
              </span>
            </span>
            <button
              type="button"
              data-evening-add
              aria-label={`Add ${l.name} to my shows`}
              onClick={() => {
                onOpenChange(false);
                addListing(l);
              }}
              className="nd-press grid size-11 flex-none place-items-center rounded-full bg-secondary"
            >
              <Plus className="size-[18px]" strokeWidth={2.6} aria-hidden />
            </button>
            <button
              type="button"
              data-evening-hide
              aria-label={`Hide ${l.name} from your guide`}
              onClick={() => void hide(l, true)}
              className="nd-press grid size-11 flex-none place-items-center rounded-full text-muted-foreground outline-1 -outline-offset-1 outline-input"
            >
              <EyeOff className="size-[17px]" aria-hidden />
            </button>
          </div>
        ))}
        <ListingsCredit />
      </div>
    </Sheet>
  );
}

/** "N hidden" (the mock's hiddenSheet): each hidden show with Show again. */
function HiddenSheet({ open, onOpenChange, hidden }: { open: boolean; onOpenChange: (o: boolean) => void; hidden: HiddenShow[] }) {
  const setHidden = useSetGuideHidden();
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (open && !hidden.length) onOpenChange(false);
  }, [open, hidden.length, onOpenChange]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Hidden from your guide" subtitle="They stay off the guide until you bring them back">
      <div data-guide-hidden-list>
        {hidden.map((h) => {
          const key = h.showId ?? `tv:${h.tvmazeId}`;
          return (
            <div key={key} data-hidden-row={h.name} className="flex min-h-[58px] items-center gap-3 border-b border-border">
              <b className="min-w-0 flex-1 truncate text-[15px]">{h.name}</b>
              <button
                type="button"
                disabled={busy === key}
                onClick={async () => {
                  setBusy(key);
                  try {
                    const out = h.showId ? await guideApi.hide({ showId: h.showId }, false) : await guideApi.hideListing(h.tvmazeId!, h.name, false);
                    setHidden(out.hidden);
                    toast(`${h.name} is back on your guide`);
                  } catch (e) {
                    toast.quiet((e as Error).message);
                  } finally {
                    setBusy(null);
                  }
                }}
                className="nd-press h-10 flex-none rounded-[3px] px-3 text-sm font-semibold outline-1 -outline-offset-1 outline-input disabled:opacity-50"
              >
                Show again
              </button>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}
