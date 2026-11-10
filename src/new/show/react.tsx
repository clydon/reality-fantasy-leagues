"use client";

import { useState, useSyncExternalStore } from "react";
import { ChevronRight } from "lucide-react";
import { episodeGifsApi, useAfterGif, useEpisodeGifs, type EpisodeGifLine, type GifHit } from "../data";
import type { ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { GifPicker } from "../ui/gif-sheet";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import type { Gif } from "@/lib/game/watch-along";

// React with a GIF (docs/PLAN-gif-reactions.md; the user, 2026-11-01, in place of Rate it's stars, shelved that day), opened from
// anywhere signed in with openGif: "How was Episode 5?", the GIF picker (anything you search for, KLIPY's: ui/gif-sheet.tsx), a
// tap posts it, then yours big and the couch's so far. It opens by itself once you say you watched an episode (Tonight's I
// watched it), and from the rows that open it (Tonight, Episodes, a watch along's last screen); the reveal has its own slide
// (GifsBeat, below). Only for an episode you've seen: the server refuses the rest (episode-gifs.ts). Solo (no couch, or a couch
// of one), yours is only yours.

export type GifTarget = {
  seasonId: string;
  couchId: string | null;
  episode: number;
  /** "Survivor 51". */
  label: string;
  solo: boolean;
  /** Opened because you just said you watched it: the sheet says so. */
  just?: boolean;
};

type Store = { target: GifTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open React with a GIF for an episode you've seen. */
export function openGif(target: GifTarget) {
  store = { ...store, target: null };
  emit();
  setTimeout(() => {
    store = { target, n: store.n + 1 };
    emit();
  }, 30);
}

const close = () => {
  store = { ...store, target: null };
  emit();
};

/** Close the GIF sheet (Up next's Undo: the episode it asks about isn't yours to react to any more). */
export const closeGif = close;

function useGifTarget(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** The sheet's host, in the signed-in layout. */
export function EpisodeGifSheets() {
  const { target, n } = useGifTarget();
  return <EpisodeGifSheet key={n} target={target} onOpenChange={(o) => !o && close()} />;
}

/** "Survivor 51": the show as the episode sheets name it (this one, Call it, bingo, polls). */
export const showLabel = (show: ShowData) =>
  show.header ? `${show.header.show.name.replace(/^The /, "").replace(/\s*\([^)]*\)\s*$/, "")}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : "";

// ---------- the sheet ----------

function EpisodeGifSheet({ target, onOpenChange }: { target: GifTarget | null; onOpenChange: (open: boolean) => void }) {
  const open = !!target;
  const v = useEpisodeGifs(target?.seasonId ?? null, target?.couchId ?? null, target?.episode ?? null, open);
  const afterGif = useAfterGif();
  // Choosing again over the one you have ("Pick another").
  const [again, setAgain] = useState(false);
  const [saving, setSaving] = useState(false);
  const n = target?.episode ?? "";
  const post = async (g: GifHit) => {
    if (!target || saving) return;
    setSaving(true);
    try {
      afterGif(await episodeGifsApi.react(target.seasonId, target.couchId, target.episode, g), target.couchId);
      setAgain(false);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const status = (v.error as { status?: number } | null)?.status;
  const mine = v.data?.mine ?? null;
  const picking = !mine || again;
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={picking ? `How was Episode ${n}?` : `Your GIF for Episode ${n}`}
      subtitle={target ? (picking ? `${target.label} · ${target.solo ? "a GIF just for you" : "the couch sees it once they've watched"}` : target.label) : undefined}
    >
      {v.isPending && open ? (
        <div aria-busy className="h-[260px] animate-pulse rounded-[4px] bg-secondary" />
      ) : !v.data ? (
        <p className="py-4 text-sm text-muted-foreground">{status === 403 ? `You haven't seen Episode ${n} yet.` : "Couldn't load it. Try again in a moment."}</p>
      ) : picking ? (
        <div data-gif-react="pick" aria-busy={saving || undefined}>
          {target?.just && !mine && (
            <span className="type-caption tag-cut mb-3 inline-block bg-chyron py-1 pl-2 pr-5 text-xs tracking-[0.06em] text-chyron-foreground">You watched Episode {n}</span>
          )}
          {v.data.people.length > 0 && !mine && (
            <p className="mb-2.5 text-[13px] text-muted-foreground">
              {v.data.people.length} on the couch already did · yours, then theirs
            </p>
          )}
          {v.data.search ? (
            <GifPicker active={open && picking} onPick={post} placeholder="Search any GIF" />
          ) : (
            <p className="py-4 text-sm text-muted-foreground">GIFs aren&apos;t on here yet.</p>
          )}
          <Btn wide className="mt-3" onClick={() => (again ? setAgain(false) : onOpenChange(false))}>
            {again ? "Keep the one I had" : "Not now"}
          </Btn>
        </div>
      ) : (
        <div data-gif-react="posted">
          <GifTile gif={mine!} you wide />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Posted · change it any time</span>
            <button type="button" data-gif-again onClick={() => setAgain(true)} className="min-h-11 px-1 text-sm font-semibold text-chyron-line">
              Pick another
            </button>
          </div>
          {!target?.solo && <CouchGifs people={v.data.people} of={v.data.of} />}
          <Btn tone="ink" wide className="mt-4" onClick={() => onOpenChange(false)}>
            Done
          </Btn>
        </div>
      )}
    </Sheet>
  );
}

/** The couch's so far: how many of how many, then their GIFs (or that you're first). */
function CouchGifs({ people, of }: { people: { userId: string; name: string; gif: Gif }[]; of: number }) {
  return (
    <div data-couch-gifs className="mt-2">
      <div className="flex items-baseline justify-between">
        <span className="type-caption text-[15px] tracking-[0.06em] text-muted-foreground">The couch so far</span>
        {of > 1 && (
          <span className="text-[13px] text-muted-foreground">
            {people.length + 1} of {of}
          </span>
        )}
      </div>
      {people.length ? (
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {people.map((p) => (
            <GifTile key={p.userId} gif={p.gif} name={p.name} />
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">You&apos;re first. Theirs land here as they watch.</p>
      )}
    </div>
  );
}

/** One GIF with whose it is on a lower third: yours on the chyron's yellow, everyone else's on a plate. */
export function GifTile({ gif, name, you, wide }: { gif: Gif; name?: string; you?: boolean; wide?: boolean }) {
  return (
    <div data-gif-tile={you ? "you" : name} className={`relative overflow-hidden rounded-[4px] bg-secondary ${wide ? "col-span-2 aspect-[2/1]" : "aspect-[4/3]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- KLIPY's own picture */}
      <img src={gif.url} alt={`${you ? "Your" : `${name}'s`} GIF${gif.title ? `: ${gif.title}` : ""}`} className="absolute inset-0 size-full object-cover" loading="lazy" />
      <span
        className={`type-caption tag-cut absolute bottom-0 left-0 py-1.5 pl-2.5 pr-5 text-[15px] ${you ? "bg-chyron text-chyron-foreground" : "bg-plate text-plate-foreground"}`}
      >
        {you ? "You" : name}
      </span>
    </div>
  );
}

// ---------- where it opens from ----------

/** A row that opens React with a GIF (Tonight, the episode page): React, or yours and how many on the couch too. */
export function GifRow({ target, line }: { target: GifTarget; line: EpisodeGifLine | undefined }) {
  const others = (line?.n ?? 0) - (line?.mine ? 1 : 0);
  return (
    <button
      type="button"
      data-gif-row={target.episode}
      data-reacted={line?.mine ? "yes" : "no"}
      onClick={() => openGif(target)}
      className="nd-press flex min-h-[64px] w-full items-center gap-3 border-t border-border py-2 text-left"
    >
      {!line?.urls.length && <span className="type-num grid size-11 flex-none place-items-center rounded-[4px] bg-chyron text-[17px] text-chyron-foreground">GIF</span>}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{line?.mine ? `Your GIF for Episode ${target.episode}` : `React to Episode ${target.episode}`}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {line?.mine
            ? target.solo
              ? "Just for you"
              : others > 0
                ? `${others} on the couch too`
                : "You're first on the couch"
            : others > 0 && !target.solo
              ? `${others} on the couch already did`
              : "How was it? Any GIF you like"}
        </small>
        {/* Everyone's GIFs in a row (yours first), the couch's reactions at a glance (the user, 2026-11-09). */}
        {!!line?.urls.length && (
          <span className="mt-2 flex gap-1.5 overflow-hidden">
            {line.urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- KLIPY's own picture
              <img key={i} src={u} alt="" className="size-14 flex-none rounded-[4px] object-cover" />
            ))}
          </span>
        )}
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">{line?.mine ? "See all" : "React"}</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** An episode's GIFs on Episodes: a few stacked (yours first), or React where the row opens React with a GIF. */
export function GifStack({ line, react }: { line: EpisodeGifLine | undefined; react?: boolean }) {
  if (!line?.n) return react ? <span className="flex-none text-[15px] font-semibold text-muted-foreground">React</span> : null;
  return (
    <span data-gif-stack={line.n} className="flex flex-none items-center gap-1.5">
      <span className="flex pl-3" aria-hidden>
        {line.urls.map((u) => (
          // eslint-disable-next-line @next/next/no-img-element -- KLIPY's own picture
          <img key={u} src={u} alt="" className="-ml-3 size-7 rounded-[4px] border-2 border-background object-cover" loading="lazy" />
        ))}
      </span>
      <small className="min-w-4 text-right text-[13px] font-semibold text-muted-foreground">
        {line.mine ? line.n : react ? <span className="text-chyron-line">React</span> : line.n}
      </small>
    </span>
  );
}

// ---------- the reveal's slide ----------

/** The most of the couch's GIFs the reveal's slide shows (the rest are a count): it fits a phone with yours above them. */
const BEAT_MAX = 4;

/**
 * The reveal's "The couch reacts" (reveal.tsx Beats: after who went home, before your games): yours wide (or where it goes), then
 * the couch's so far. Read once the reveal has moved where you are (Broadcast asks for it then). No buttons in it: the stage is
 * one big Next; Add your GIF is the slide's action under it (GifsAction).
 */
export function GifsBeat({ target }: { target: GifTarget }) {
  const v = useEpisodeGifs(target.seasonId, target.couchId, target.episode);
  const d = v.data;
  const shown = d?.people.slice(0, BEAT_MAX) ?? [];
  const more = (d?.people.length ?? 0) - shown.length;
  const line = !d
    ? ""
    : target.solo
      ? d.mine
        ? "Yours, just for you"
        : "How was it? Any GIF you like, just for you"
      : d.people.length
      ? `${d.people.length + (d.mine ? 1 : 0)} of ${d.of} on the couch${more > 0 ? ` · ${more} more on Tonight` : ""}`
      : d.mine
        ? "You're first. Theirs land here as they watch"
        : "Nobody on the couch has yet. Be the first";
  return (
    <div data-gifs-beat={d ? d.people.length : "loading"}>
      <span className="type-caption mb-3 block text-[15px] tracking-[0.06em] text-muted-foreground">
        {target.label} · Episode {target.episode}
      </span>
      <h2 className="type-caption text-[52px] leading-[.92]">{target.solo ? "Your reaction" : "The couch reacts"}</h2>
      {!d ? (
        <div aria-busy className="mt-4 h-[300px] animate-pulse rounded-[4px] bg-card" />
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {d.mine ? (
            <GifTile gif={d.mine} you wide />
          ) : (
            <div data-gif-yours-empty className="col-span-2 flex aspect-[3/1] flex-col items-center justify-center gap-1 rounded-[4px] border-2 border-dashed border-input">
              <b className="text-[17px]">Yours goes here</b>
              <small className="text-[13px] text-muted-foreground">How was it? Any GIF you like</small>
            </div>
          )}
          {shown.map((p) => (
            <GifTile key={p.userId} gif={p.gif} name={p.name} />
          ))}
        </div>
      )}
      <p className="mt-2.5 text-[14px] text-muted-foreground">{line ? `${line} · tap anywhere to go on` : "Tap anywhere to go on"}</p>
    </div>
  );
}

/** The slide's action under it: Add your GIF until yours is in. */
export function GifsAction({ target }: { target: GifTarget }) {
  const v = useEpisodeGifs(target.seasonId, target.couchId, target.episode);
  if (!v.data || v.data.mine || !v.data.search) return null;
  return (
    <Btn tone="must" wide data-gifs-add onClick={() => openGif(target)}>
      Add your GIF
    </Btn>
  );
}
