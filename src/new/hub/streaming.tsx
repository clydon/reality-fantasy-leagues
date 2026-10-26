"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { railItems, RAIL_FEW, whoLine, type RailItem, type StreamShow } from "@/lib/game/streaming";
import { useOnNow, type Couch, type CouchShow, type Home } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { airTime } from "../clock";
import { TinyFace } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { openWatching } from "../watching/sheets";
import { hides, useMinute } from "./guide";

// Streaming on the couch (docs/PLAN-new-design.md step 14 part 1; the mock's streaming.js railHTML / railChip / allStreamingSheet,
// streaming.css): the rail under the guide, streaming's home on the hub, since a drop passes but the show stays. The pure
// src/lib/game/streaming.ts picks and orders it from the home read (your shows, the couch's, its people's open follows, its
// planned nights) and the hub's On now read: yours in progress, new drops, planned nights, the couch's most watched, upcoming
// drops. A chip opens the show; one not on your shows has a ＋ (where you are, then it's yours, staying on the hub). See all N
// past three. On the solo hub, "Streaming": your own shows. Never how far anyone else is (the guard); who's on now, yes. A couch
// show you've hidden from the guide is off the rail too (your own can't be hidden).

const plain = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "").trim() || name;

/** The home's seasons as the rail takes them: yours (followed or played), then the couch's you don't follow and haven't hidden. */
export function streamShows(home: Home, couch: Couch | null): StreamShow[] {
  const hidden = home.guideHidden ?? [];
  const playedHere = (seasonId: string) => !!couch?.games.some((g) => g.seasonId === seasonId);
  const mine: StreamShow[] = home.shows
    .filter((s) => s.following || s.games.length)
    .map((s) => ({
      seasonId: s.seasonId,
      name: plain(s.show.name),
      seasonNumber: s.seasonNumber,
      artUrl: s.show.artUrl,
      release: s.release,
      status: s.status,
      dropAt: s.dropAt ?? null,
      network: s.show.network ?? null,
      episodeCount: s.episodeCount,
      latestAired: s.latestAired,
      yours: true,
      // Null: spoiler protection off, so where you are isn't known.
      seen: s.seenThrough,
      played: s.games.length > 0 || playedHere(s.seasonId),
    }));
  const theirs: StreamShow[] = (couch ? (home.couchShows ?? []) : [])
    .filter((s) => !hidden.some((h) => hides(h, s.show)))
    .map((s) => ({
      seasonId: s.seasonId,
      name: plain(s.show.name),
      seasonNumber: s.seasonNumber,
      artUrl: s.show.artUrl,
      release: s.release,
      status: s.status,
      dropAt: s.dropAt ?? null,
      network: s.show.network ?? null,
      episodeCount: s.episodeCount,
      latestAired: s.latestAired,
      yours: false,
      seen: null,
      played: playedHere(s.seasonId),
    }));
  return [...mine, ...theirs];
}

/** The rail for this couch (or, with none, your own streaming shows). */
export function useRail(home: Home, couch: Couch | null): RailItem[] {
  const now = useMinute();
  const onNow = useOnNow(couch?.id ?? null).data?.now;
  return useMemo(() => {
    const members = couch?.members ?? [];
    const streamers = (seasonId: string) =>
      members.filter((m) => m.userId !== home.user.id && m.watching.includes(seasonId)).map((m) => ({ userId: m.userId, name: m.name }));
    const plans = couch
      ? (home.plans ?? []).filter((p) => p.couchId === couch.id && p.you !== "out").map((p) => ({ id: p.id, seasonId: p.seasonId, at: Date.parse(p.startsAt), episode: p.episode }))
      : [];
    return railItems(streamShows(home, couch), {
      streamers,
      plans,
      onNow: (onNow ?? []).map((w) => ({ userId: w.userId, name: w.name, seasonId: w.seasonId })),
      now,
    });
  }, [home, couch, onNow, now]);
}

/** A chip's tag (streaming.css b-t): your next episode (the one yellow: it's yours to do), a new drop, a planned night, a drop to come. */
function Tag({ item }: { item: RailItem }) {
  const t = item.tag;
  const [text, tone] =
    t.kind === "drops"
      ? [`Drops ${airTime(t.at)}`, "text-muted-foreground"]
      : t.kind === "continue"
        ? [`Continue · Ep ${t.episode}`, "bg-chyron py-0.5 pl-[5px] pr-[9px] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)]"]
        : t.kind === "new"
          ? [t.episodes ? `New · all ${t.episodes} out` : "New · all out", "text-chyron-line"]
          : t.kind === "plan"
            ? [`Watch along · ${airTime(t.at)}`, "text-good"]
            : t.kind === "finished"
              ? ["You finished it", "text-muted-foreground"]
              : [t.text, "text-muted-foreground"];
  return (
    <span data-rail-tag={t.kind} className={`type-caption self-start truncate text-[11px] tracking-[0.04em] ${tone}`}>
      {text}
    </span>
  );
}

/** One chip (the mock's b-chip): the show, its tag and who on the couch streams it; yours with your progress, not yours with a ＋. */
function Chip({ item, wide, onAdd }: { item: RailItem; wide?: boolean; onAdd: (item: RailItem) => void }) {
  const faces = item.faces.slice(0, 3);
  return (
    <div
      data-rail-chip={item.seasonId}
      data-rail-rank={item.rank}
      data-rail-yours={item.yours || undefined}
      className={`relative flex-none snap-start overflow-hidden rounded-[4px] outline-1 -outline-offset-1 ${wide ? "w-full" : "w-[244px]"} ${
        item.yours ? "bg-card outline-border" : "outline-dashed outline-input"
      }`}
    >
      <NavLink
        href={paths.show(item.seasonId)}
        channel
        aria-label={`${item.name}${item.yours ? "" : ", not on your shows"}`}
        className="nd-press flex w-full items-stretch gap-2.5 py-1.5 pl-1.5 pr-11 text-left"
      >
        <ShowArt seasonId={item.seasonId} artUrl={item.artUrl} name={item.name} className="h-[72px] w-[54px] flex-none rounded-[3px] text-[11px]" />
        <span className="flex min-w-0 flex-col justify-center gap-1">
          <b className="type-caption truncate text-[17px] leading-none">{item.name}</b>
          <Tag item={item} />
          <span className="flex min-w-0 items-center gap-1.5">
            {faces.length > 0 && (
              <span className="flex flex-none">
                {faces.map((p) => (
                  <TinyFace
                    key={p.userId}
                    id={p.userId}
                    name={p.name}
                    className="-mr-1 grid size-4 place-items-center rounded-[2px] text-[9px] font-extrabold text-[#121018] shadow-[0_0_0_1.5px_var(--card)]"
                  />
                ))}
              </span>
            )}
            <small data-rail-who={item.who.kind} className={`truncate text-[11px] ${faces.length ? "ml-1" : ""} ${item.who.kind === "on" ? "font-semibold text-good" : "text-muted-foreground"}`}>
              {whoLine(item.who)}
            </small>
          </span>
        </span>
      </NavLink>
      {item.yours ? (
        item.progress != null && (
          <span data-rail-progress={Math.round(item.progress * 100)} className="absolute inset-x-0 bottom-0 h-[3px] bg-border" aria-hidden>
            <i className="block h-full bg-chyron-line" style={{ width: `${item.progress * 100}%` }} />
          </span>
        )
      ) : (
        <button
          type="button"
          data-rail-add={item.seasonId}
          aria-label={`Add ${item.name} to my shows`}
          onClick={() => onAdd(item)}
          className="absolute right-2 top-1/2 grid size-[34px] -translate-y-1/2 place-items-center rounded-full bg-secondary shadow-[0_4px_12px_rgba(0,0,0,.35)] transition-transform active:scale-90"
        >
          <Plus className="size-[18px]" strokeWidth={2.8} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Add a couch show to your shows from the rail: where you are (nothing past it shows), then it's yours; you stay on the hub. */
function addFrom(home: Home, item: RailItem) {
  const s: CouchShow | undefined = home.couchShows.find((x) => x.seasonId === item.seasonId);
  if (!s) return;
  const name = plain(s.show.name);
  openWatching({
    kind: "where",
    target: {
      seasonId: s.seasonId,
      label: `${name}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`,
      show: name,
      artUrl: s.show.artUrl,
      artPosition: "center",
      aired: s.latestAired,
      status: s.status === "upcoming" || s.status === "completed" ? s.status : "airing",
      premiere: s.premiereDate,
      seen: 0,
      following: false,
      plays: false,
    },
  });
}

/** The rail (the mock's railHTML): nothing when there's nothing streaming. */
export function StreamingRail({ home, couch }: { home: Home; couch: Couch | null }) {
  const items = useRail(home, couch);
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const title = couch ? "Streaming on the couch" : "Streaming";
  const onAdd = (item: RailItem) => {
    setAll(false);
    addFrom(home, item);
  };
  return (
    <section className="mt-6" data-rail={items.length}>
      <div className="flex items-baseline justify-between px-4 pb-2 pt-3">
        <h2 className="type-caption text-[17px]">{title}</h2>
        {items.length > RAIL_FEW ? (
          <button type="button" data-rail-all onClick={() => setAll(true)} className="h-7 text-[13px] font-bold text-chyron-line">
            See all {items.length}
          </button>
        ) : (
          <small className="text-xs text-muted-foreground">Your own pace</small>
        )}
      </div>
      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {items.map((item) => (
          <Chip key={item.seasonId} item={item} onAdd={onAdd} />
        ))}
      </div>
      <Sheet open={all} onOpenChange={setAll} title={title} subtitle={couch ? "Every show the couch is streaming, at their own pace" : "Your shows without an airtime, at your own pace"}>
        <div data-rail-sheet className="flex flex-col gap-2">
          {items.map((item) => (
            <Chip key={item.seasonId} item={item} wide onAdd={onAdd} />
          ))}
        </div>
      </Sheet>
    </section>
  );
}
