"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EyeOff, Plus } from "lucide-react";
import { episodeLine, eveningAt, guideWeek, nextUpAfter, type GuideCard, type GuideDay, type GuideShow } from "@/lib/game/guide";
import { alsoOn, hitOfListing, listingLine, type AlsoOnDay, type AlsoOnItem } from "@/lib/game/tv-listings";
import { guide as guideApi, useListingsWeek, useSetGuideHidden, type Couch, type CouchShow, type HiddenShow, type Home } from "../data";
import { PEOPLE } from "../fixtures/people";
import { RAIL } from "../fixtures/streaming";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { airTime, timeOf } from "../clock";
import { avatarColour } from "../ui/bars";
import { Btn } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { ListingsCredit } from "../watching/search";
import { openWatching } from "../watching/sheets";
import { namesOf, showOfMove } from "./sections";

// "This week on the couch", the TV guide (the mock's index.html guideDays / card, tvguide.js, streaming.js's drop days), and
// Streaming on the couch (streaming.js) under it. The guide is real since step 11 part 1: your shows and the couch's, from
// the home read's `week` (when each episode airs, never a title), laid out by the pure src/lib/game/guide.ts in the phone's
// own time zone; Hide from guide (guide.ts on the server). Since part 2, Also on: the rest of TV each evening, from the
// week's listings (/api/listings/week, the same for everyone; src/lib/game/tv-listings.ts leaves out your shows, the
// couch's and what you've hidden), the most watched few and "N more on TV". The rail is step 14's.

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/**
 * The guide rolls on its own once you reach it (not while it's the first thing you see: the critique, 2026-10-23),
 * and stops for a few seconds whenever you touch it. Reduced motion: it never rolls.
 */
function useRoll(reel: React.RefObject<HTMLDivElement | null>) {
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    const el = reel.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let started = false;
    let holdUntil = 0;
    let x = 0;
    const step = (t: number) => {
      if (t > holdUntil) {
        x = Math.max(x, el.scrollLeft) + 0.35;
        if (x >= el.scrollWidth - el.clientWidth) {
          setRolling(false);
          return;
        }
        el.scrollLeft = x;
      } else x = el.scrollLeft;
      raf = requestAnimationFrame(step);
    };
    const hold = () => (holdUntil = performance.now() + 4000);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started) {
          started = true;
          setRolling(true);
          raf = requestAnimationFrame(step);
          io.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    el.addEventListener("touchstart", hold, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchstart", hold);
    };
  }, [reel]);
  return rolling;
}

/** The clock the guide is drawn at, moved on each minute (the Now line, On now); nothing is read again. */
function useMinute(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Whether a hidden row is this show (by the show, or by its listing). */
const hides = (h: HiddenShow, show: { id: string; tvmazeId?: number | null }) => (h.showId != null && h.showId === show.id) || (h.tvmazeId != null && h.tvmazeId === show.tvmazeId);

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
    }));
  return [...yours, ...theirs];
}

/** What's hidden, less anything that's yours now (your own shows always show). */
function hiddenNow(home: Home): HiddenShow[] {
  const mine = home.shows.filter((s) => s.following || s.games.length).map((s) => s.show);
  return (home.guideHidden ?? []).filter((h) => !mine.some((s) => hides(h, s)));
}

/** "Tonight" (from 5 PM until the guide's day ends at 3 AM) or "Today", "Tomorrow", then the weekday. */
function dayLabel(d: GuideDay, now: number): string {
  if (d.offset === 0) return eveningAt(now) ? "Tonight" : "Today";
  return d.offset === 1 ? "Tomorrow" : DAY[new Date(d.start).getDay()];
}

/** Who's on a card: their initials on their colours, four at most. */
function Faces({ faces }: { faces: GuideCard["faces"] }) {
  if (!faces.length) return null;
  return (
    <span className="flex flex-none pl-[3px]" aria-label={`${namesOf(faces.map((f) => f.name))} watch it`}>
      {faces.slice(0, 4).map((f) => (
        <span
          key={f.userId}
          className="-ml-[3px] grid size-3.5 place-items-center rounded-[2px] text-[8px] font-extrabold text-[#121018] shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]"
          style={{ background: avatarColour(f.userId) }}
        >
          {f.name[0]?.toUpperCase()}
        </span>
      ))}
    </span>
  );
}

const CARD =
  "relative isolate flex w-full flex-col justify-end overflow-hidden rounded-[3px] bg-card px-[9px] py-2 text-left text-white transition-transform duration-300 active:scale-[.97]";
// The fade ladder (tvguide.css): yours in full, dashed when you watch without playing, faded a step more when it isn't yours.
const DASHED = "outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-white/45";
const FADED = "opacity-80 [filter:saturate(.3)_brightness(.78)]";

/** A card's art, or with none (a show added by name, a listing without a poster) its first letter, faint (tvguide.css g-noart). */
function GuideArt({ id, c, className = "" }: { id: string; c: Pick<GuideCard, "artUrl" | "name" | "drop">; className?: string }) {
  return c.artUrl ? (
    <ShowArt seasonId={id} artUrl={c.artUrl} name={c.name} position={c.drop ? "center 25%" : "center"} className={`absolute inset-0 -z-[2] size-full ${className}`} />
  ) : (
    <span data-art={id} aria-hidden className="type-caption absolute inset-0 -z-[2] grid place-items-center bg-[linear-gradient(150deg,#3a3548,#16141d)] text-[34px] text-white/20">
      {c.name.replace(/^the\s+/i, "")[0]?.toUpperCase()}
    </span>
  );
}

function CardBody({ c, now }: { c: GuideCard; now: number }) {
  return (
    <>
      <GuideArt id={`guide-${c.key}`} c={c} className={c.tie !== "plays" ? "[filter:saturate(.35)_brightness(.8)]" : ""} />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.15)_0%,rgba(10,8,14,.55)_48%,rgba(10,8,14,.92)_100%)]" />
      <span
        className={`absolute left-2 top-[7px] flex items-center gap-[5px] rounded-[2px] px-1.5 py-[3px] text-[11px] font-extrabold backdrop-blur-sm ${
          c.live ? "bg-live text-live-foreground" : "bg-[rgba(10,8,14,.72)]"
        }`}
      >
        {c.live && <i className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
        {c.live ? "On now" : timeOf(c.at)}
      </span>
      {c.due && <i data-due className="absolute right-2 top-2 size-[9px] rounded-full bg-live shadow-[0_0_0_2px_rgba(255,255,255,.8)]" aria-label="A move is due" />}
      {c.drop != null && (
        <span className="type-caption mb-1 self-start bg-secondary py-[3px] pl-1.5 pr-2.5 text-[10px] tracking-[0.06em] text-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]">
          All {c.drop} drop
        </span>
      )}
      <span className="type-caption line-clamp-2 text-[17px] leading-[.95] [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{c.name}</span>
      <span className="mt-[3px] flex items-center justify-between gap-1 text-[11px] font-semibold opacity-85">
        <span className="truncate">{c.at < now && !c.live && !c.drop ? `${episodeLine(c)} · aired` : episodeLine(c)}</span>
        <Faces faces={c.faces} />
      </span>
    </>
  );
}

/** A card: your show opens it (its art grows into the show bar); a couch show you don't follow opens its sheet. */
function Card({ c, now, height = 104, onCouch }: { c: GuideCard; now: number; height?: number; onCouch: (c: GuideCard) => void }) {
  const cls = `${CARD} ${c.tie !== "plays" ? DASHED : ""} ${c.tie === "couch" ? FADED : ""}`;
  const data = { "data-guide-card": c.key, "data-tie": c.tie, "data-live": c.live || undefined, "data-drop": c.drop ?? undefined };
  const label = `${c.name}, ${c.drop ? `all ${c.drop} episodes drop` : episodeLine(c)}, ${c.live ? "on now" : airTime(c.at)}${c.tie === "couch" ? ", not on your shows" : ""}`;
  return c.tie === "couch" ? (
    <button type="button" {...data} aria-label={label} className={cls} style={{ height }} onClick={() => onCouch(c)}>
      <CardBody c={c} now={now} />
    </button>
  ) : (
    <NavLink href={paths.show(c.seasonId)} channel {...data} aria-label={label} className={cls} style={{ height }}>
      <CardBody c={c} now={now} />
    </NavLink>
  );
}

/** Today with nothing on: what's next this week ("Nothing tonight · Next up"). */
function NextUpCard({ c, evening, onCouch }: { c: GuideCard; evening: boolean; onCouch: (c: GuideCard) => void }) {
  const body = (
    <>
      <GuideArt id={`guide-next-${c.key}`} c={c} className="[filter:saturate(.5)_brightness(.7)]" />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.3)_0%,rgba(10,8,14,.92)_100%)]" />
      <span className="absolute left-2 top-[7px] rounded-[2px] bg-[rgba(10,8,14,.72)] px-1.5 py-[3px] text-[11px] font-extrabold backdrop-blur-sm">
        Nothing {evening ? "tonight" : "today"}
      </span>
      <span className="type-caption text-[11px] tracking-[0.06em] text-muted-foreground">Next up</span>
      <span className="type-caption line-clamp-2 text-[17px] leading-[.95]">{c.name}</span>
      <span className="mt-[3px] truncate text-[11px] font-semibold opacity-85">{airTime(c.at)}</span>
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
          className="nd-press flex h-11 items-center justify-center rounded-[3px] text-[12px] font-semibold text-muted-foreground outline-1 -outline-offset-1 outline-dashed outline-border"
        >
          {more} more on TV
        </button>
      )}
    </div>
  );
}

function Day({
  d,
  i,
  now,
  week,
  also,
  onCouch,
  onListing,
  onMore,
}: {
  d: GuideDay;
  i: number;
  now: number;
  week: GuideDay[];
  also: AlsoOnDay | undefined;
  onCouch: (c: GuideCard) => void;
  onListing: (l: AlsoOnItem) => void;
  onMore: (d: GuideDay) => void;
}) {
  const date = new Date(d.start);
  const evening = eveningAt(now);
  const onTv = !!also?.all.length;
  const next = d.offset === 0 && !d.slots.length ? nextUpAfter(week, 0) : null;
  const nowLine = (
    <div data-guide-now className="type-caption flex h-3.5 flex-none items-center gap-1.5 text-[11px] tracking-[0.06em] text-chyron-line after:h-0.5 after:flex-1 after:bg-chyron-line">
      Now {timeOf(now)}
    </div>
  );
  return (
    <div data-guide-day={d.offset} className={`flex flex-none flex-col gap-[7px] border-l border-border px-[5px] ${i ? "w-[162px]" : "w-[165px] border-l-0 pl-2"}`}>
      <div className="flex h-6 items-baseline gap-1.5 whitespace-nowrap px-[3px] pb-1 pt-0.5">
        <b
          className={`type-caption text-[17px] ${i ? "" : "bg-chyron py-[3px] pl-1.5 pr-3 text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]"}`}
        >
          {dayLabel(d, now)}
        </b>
        <span className="text-xs font-semibold text-muted-foreground">
          {d.offset < 2 ? `${DAY[date.getDay()]} ` : ""}
          {MON[date.getMonth()]} {date.getDate()}
        </span>
      </div>
      {d.slots.map((sl, k) => (
        <div key={Array.isArray(sl) ? sl[0].key : sl.key} className="contents">
          {d.nowAt === k && nowLine}
          {Array.isArray(sl) ? (
            <div data-guide-same className="flex flex-col gap-[5px] border-l-[3px] border-chyron-line pl-2">
              <em className="type-caption flex h-3 justify-between text-[11px] not-italic tracking-[0.06em] text-chyron-line">
                <span>Same time</span>
                <span>{timeOf(sl[0].at)}</span>
              </em>
              {sl.map((c) => (
                <Card key={c.key} c={c} now={now} height={86} onCouch={onCouch} />
              ))}
            </div>
          ) : (
            <Card c={sl} now={now} onCouch={onCouch} />
          )}
        </div>
      ))}
      {d.nowAt != null && d.nowAt >= d.slots.length && d.slots.length > 0 && nowLine}
      {!d.slots.length &&
        (next ? (
          <>
            {nowLine}
            <NextUpCard c={next} evening={evening} onCouch={onCouch} />
          </>
        ) : (
          // A day with only the rest of TV drops its "Nothing on" (tvguide.js); "Next up" stays.
          !onTv && <div className="grid h-14 place-items-center rounded-[3px] border border-dashed border-border text-[13px] text-muted-foreground">Nothing on</div>
        ))}
      {also && <AlsoOn day={also} label={d.slots.length ? "Also on" : "On TV"} onOpen={onListing} onMore={() => onMore(d)} />}
    </div>
  );
}

/** The guide: the week rolling by, the foot (what dashed and faded mean, what's hidden, Add a show), and its sheets. */
export function Guide({ home, couch }: { home: Home; couch: Couch | null }) {
  const reel = useRef<HTMLDivElement>(null);
  const rolling = useRoll(reel);
  const now = useMinute();
  const shows = useMemo(() => guideShows(home, couch), [home, couch]);
  const week = useMemo(() => guideWeek(shows, now), [shows, now]);
  const hidden = hiddenNow(home);
  const listings = useListingsWeek().data?.listings;
  // Also on leaves out your shows, the couch's and what you've hidden: by their listing, or by name for a show here that
  // hasn't one yet (the daily job links them).
  const also = useMemo(() => {
    if (!listings?.length) return [];
    const ids = new Set<number>();
    const names: string[] = [];
    const leave = (show: { tvmazeId?: number | null; name: string }) => (show.tvmazeId ? ids.add(show.tvmazeId) : names.push(show.name));
    for (const s of home.shows) if (s.following || s.games.length) leave(s.show);
    for (const s of home.couchShows ?? []) leave(s.show);
    for (const h of home.guideHidden ?? []) if (h.tvmazeId) ids.add(h.tvmazeId);
    return alsoOn(listings, week, { ids, names }, now);
  }, [listings, home, week, now]);
  const [couchCard, setCouchCard] = useState<GuideCard | null>(null);
  const [listing, setListing] = useState<AlsoOnItem | null>(null);
  const [evening, setEvening] = useState<GuideDay | null>(null);
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const ties = new Set(week.flatMap((d) => d.slots.flatMap((sl) => (Array.isArray(sl) ? sl : [sl]).map((c) => c.tie))));
  const legend = [ties.has("watches") ? "Dashed: not playing yet" : null, ties.has("couch") ? "Faded: not on your shows" : null].filter(Boolean).join(" · ");
  return (
    <section className="mt-8" data-guide>
      <div className="mb-2.5 flex items-baseline justify-between px-4">
        <h2 className="type-caption text-[24px]">{couch ? "This week on the couch" : "This week"}</h2>
        <span className="flex h-8 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <i className={`size-[7px] rounded-full ${rolling ? "bg-good" : "bg-input"}`} aria-hidden />
          {rolling ? "Rolling" : "Paused"}
        </span>
      </div>
      <div
        ref={reel}
        className="mx-2 flex overflow-x-auto pb-1.5 pt-2 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_14px,#000_calc(100%_-_24px),transparent)]"
      >
        {week.map((d, i) => (
          <Day key={d.offset} d={d} i={i} now={now} week={week} also={also[i]} onCouch={setCouchCard} onListing={setListing} onMore={setEvening} />
        ))}
      </div>
      <div data-guide-foot className="flex items-center justify-between gap-3 px-4 pt-1 text-[13px] text-muted-foreground">
        <span className="flex min-w-0 flex-col items-start">
          {legend && <span className="leading-snug">{legend}</span>}
          {also.some((d) => d.all.length) && (
            <span data-guide-credit className="text-[12px] leading-snug">
              TV listings from{" "}
              <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">
                TVmaze
              </a>
            </span>
          )}
          {hidden.length > 0 && (
            <button type="button" data-guide-hidden onClick={() => setHiddenOpen(true)} className="flex h-9 items-center gap-1.5 font-bold text-foreground underline-offset-2 hover:underline">
              <EyeOff className="size-4" aria-hidden />
              {hidden.length} hidden
            </button>
          )}
        </span>
        <button
          type="button"
          data-guide-add
          onClick={() => openWatching({ kind: "add" })}
          className="nd-press flex h-10 flex-none items-center gap-1 rounded-[3px] px-2.5 text-sm font-semibold text-foreground outline-1 -outline-offset-1 outline-input"
        >
          <Plus className="size-4" aria-hidden />
          Add a show
        </button>
      </div>
      <CouchShowSheet home={home} couch={couch} card={couchCard} onOpenChange={(o) => !o && setCouchCard(null)} />
      <ListingSheet l={listing} couch={!!couch} onOpenChange={(o) => !o && setListing(null)} />
      <EveningSheet day={evening} also={evening ? also[evening.offset] : undefined} now={now} onOpenChange={(o) => !o && setEvening(null)} />
      <HiddenSheet open={hiddenOpen} onOpenChange={setHiddenOpen} hidden={hidden} />
    </section>
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
      toast((e as Error).message);
    }
  };
  return run;
}

/** A couch show you don't follow (the mock's tvShowSheet and episode sheet): when it's on, who watches it, Add to my shows,
 *  Hide from guide, or open it. */
function CouchShowSheet({ home, couch, card, onOpenChange }: { home: Home; couch: Couch | null; card: GuideCard | null; onOpenChange: (o: boolean) => void }) {
  const hide = useHide();
  // The last one asked about, kept while the sheet slides away.
  const [shown, setShown] = useState(card);
  if (card && card !== shown) setShown(card);
  const c = card ?? shown;
  const show: CouchShow | undefined = c ? home.couchShows.find((s) => s.seasonId === c.seasonId) : undefined;
  const who = c ? (couch?.members ?? []).filter((m) => m.userId !== home.user.id && m.watching.includes(c.seasonId)).map((m) => m.name) : [];
  const when = c ? `${c.drop ? `All ${c.drop} drop` : "On"} ${airTime(c.at)} · ${c.seasonNumber != null ? `Season ${c.seasonNumber} · ` : ""}${c.drop ? `${c.drop} episodes` : `Episode ${c.numbers[0]}`}` : undefined;
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
      toast((e as Error).message);
    }
  };
  return run;
}

/** Add a TV listing to your shows: where you are in its season (read from the listing), then it's yours. */
const addListing = (l: AlsoOnItem) => openWatching({ kind: "listing", hit: hitOfListing(l) });

/** A TV listing (the mock's tvShowSheet): when it's on, Add to my shows, Hide from guide. Nobody on the couch watches it. */
function ListingSheet({ l, couch, onOpenChange }: { l: AlsoOnItem | null; couch: boolean; onOpenChange: (o: boolean) => void }) {
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
                    toast((e as Error).message);
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


const RAIL_TAG = {
  you: "bg-chyron py-0.5 pl-[5px] pr-[9px] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]",
  new: "text-chyron-line",
  good: "text-good",
};

export function StreamingRail() {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <span className="type-caption text-[17px]">Streaming on the couch</span>
        <small className="text-xs text-muted-foreground">Your own pace</small>
      </div>
      <Preview id="hub.streaming" className="mx-2">
        <div className="flex gap-2 overflow-x-auto p-2 [scrollbar-width:none]">
          {RAIL.map((r) => {
            const yours = r.progress != null;
            return (
              <div
                key={r.name}
                className={`relative w-[244px] flex-none overflow-hidden rounded-[4px] outline-1 -outline-offset-1 ${yours ? "bg-card outline-border" : "outline-dashed outline-input"}`}
              >
                <span className="flex w-full items-stretch gap-2.5 py-1.5 pl-1.5 pr-11 text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock */}
                  <img src={r.art} alt="" className="h-[72px] w-[54px] flex-none rounded-[3px] object-cover" style={{ objectPosition: r.position }} />
                  <span className="flex min-w-0 flex-col justify-center gap-1">
                    <b className="type-caption truncate text-[17px]">{r.name}</b>
                    <span className={`type-caption self-start text-[11px] tracking-[0.04em] ${r.tag.tone ? RAIL_TAG[r.tag.tone] : "text-muted-foreground"}`}>
                      {r.tag.text}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="flex flex-none">
                        {r.faces.map((p) => (
                          <span
                            key={p}
                            className="-mr-1 grid size-4 place-items-center rounded-[2px] text-[9px] font-extrabold text-[#121018] shadow-[0_0_0_1.5px_var(--card)]"
                            style={{ background: PEOPLE[p] }}
                          >
                            {p[0].toUpperCase()}
                          </span>
                        ))}
                      </span>
                      <small className="ml-1 truncate text-[11px] text-muted-foreground">{r.who}</small>
                    </span>
                  </span>
                </span>
                {yours ? (
                  r.progress! > 0 && (
                    <span className="absolute inset-x-0 bottom-0 h-[3px] bg-border">
                      <i className="block h-full bg-chyron-line" style={{ width: `${r.progress! * 100}%` }} />
                    </span>
                  )
                ) : (
                  <span className="absolute right-2 top-1/2 grid size-[34px] -translate-y-1/2 place-items-center rounded-full bg-secondary" aria-label={`Add ${r.name} to my shows`}>
                    <Plus className="size-[18px]" strokeWidth={2.8} aria-hidden />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Preview>
    </section>
  );
}
