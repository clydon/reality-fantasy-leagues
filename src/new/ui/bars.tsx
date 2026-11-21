"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bot, ChevronDown, ChevronLeft, Settings } from "lucide-react";
import { isBotSeat } from "./bot-seats";
import { colourOf, pictureUrl } from "@/lib/people";
import { usePerson } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";

// The new design's top bars: the hub's (the wordmark, notifications, you) and a pushed page's (back, a centred
// title, an action on the right). A show's own bar is show-bar.tsx.

/**
 * Someone's square (the mock's .av): their picture, else their initial on their colour (step 15 part 1: the colour and picture
 * they chose in their profile, which come with the home read for you and everyone on your couches; anyone else, and anyone
 * before the home is read, is on the colour their id picks). `colour` sets it outright (a computer player).
 */
export function Avatar({ id, name, size = 34, colour, bot }: { id: string; name: string; size?: number; colour?: string; bot?: boolean }) {
  const face = usePerson(id);
  const [broken, setBroken] = useState<number | null>(null);
  // A computer player (E1): a robot on a quiet tile, never an initial that reads as a person's (ui/bot-seats.ts).
  if (bot || isBotSeat(id))
    return (
      <span className="relative grid flex-none place-items-center overflow-hidden rounded-[3px] bg-secondary text-foreground outline-1 -outline-offset-1 outline-border" style={{ width: size, height: size }} data-face="bot" aria-hidden>
        <Bot style={{ width: Math.round(size * 0.62), height: Math.round(size * 0.62) }} strokeWidth={2} />
      </span>
    );
  const picture = face?.picture != null && face.picture !== broken ? face.picture : null;
  return (
    <span
      className="type-num relative grid flex-none place-items-center overflow-hidden rounded-[3px] text-[#121018]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46), background: colour ?? colourOf(id, face?.colour) }}
      data-face={picture != null ? "picture" : "initial"}
      aria-hidden
    >
      {(face?.name ?? name).slice(0, 1).toUpperCase()}
      {picture != null && (
        // eslint-disable-next-line @next/next/no-img-element -- a tiny private picture the browser keeps for good (?v=)
        <img src={pictureUrl(id, picture)} alt="" draggable={false} onError={() => setBroken(picture)} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  );
}

/** Up to four faces, overlapping (three and a count past that, so any number fits one width; `max` slots in all); yours ringed.
 *  `ground`: what they sit on, for their edge (on the raised fill of your own row, the count's tile takes the panel's). Episodes'
 *  who's-here and the game table's holders. */
export function Faces({ marks, ground = "var(--background)", size = 22, max = 4 }: { marks: { userId: string; name: string; you?: boolean }[]; ground?: string; size?: number; max?: number }) {
  const shown = marks.slice(0, marks.length > max ? max - 1 : max);
  return (
    <span className="flex flex-none items-center" aria-hidden>
      {shown.map((m, i) => (
        // The face after yours steps clear of your ring, so its initial isn't hidden between two.
        <span key={m.userId} className={`rounded-[3px] ${!i ? "" : shown[i - 1].you ? "ml-0.5" : "-ml-1.5"} ${m.you ? "relative z-[1] outline-2 outline-offset-1 outline-foreground" : ""}`} style={{ boxShadow: `0 0 0 2px ${ground}` }}>
          <Avatar id={m.userId} name={m.name} size={size} />
        </span>
      ))}
      {marks.length > shown.length && (
        <span
          className={`type-num -ml-1.5 grid place-items-center rounded-[3px] px-1 text-[11px] ${ground === "var(--secondary)" ? "bg-card" : "bg-secondary"}`}
          style={{ height: size, minWidth: size, boxShadow: `0 0 0 2px ${ground}` }}
        >
          +{marks.length - shown.length}
        </span>
      )}
    </span>
  );
}

/** A face too small for a picture (the guide's and the rail's): their initial on their colour. `className` sizes it. */
export function TinyFace({ id, name, className }: { id: string; name: string; className: string }) {
  const face = usePerson(id);
  return (
    <span className={className} style={{ background: colourOf(id, face?.colour) }}>
      {(face?.name ?? name)[0]?.toUpperCase()}
    </span>
  );
}

/** GAME [YOUR] SHOW: outlined words either side of a bone plate, like a channel ident. */
export function Wordmark() {
  return (
    <div className="type-caption flex items-center text-[22px]" aria-label="Game Your Show" role="img">
      <span className="text-transparent [-webkit-text-stroke:1.3px_var(--foreground)]">Game</span>
      <span className="mx-[3px] bg-foreground py-[3px] pl-[9px] pr-[13px] text-[18px] text-background [clip-path:polygon(7px_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
        Your
      </span>
      <span className="text-transparent [-webkit-text-stroke:1.3px_var(--foreground)]">Show</span>
    </div>
  );
}

/** The hub's top: the wordmark, notifications (`bell`: the hub's NotesBell), the gear (Your settings: settings Round 0's "one gear
 *  on every bar"), and you (your picture: your couch and your numbers). */
/** `couch`: the couch the hub shows, named under the wordmark (settings Round 2, C25): a tap opens Your couches. None solo. */
export function TopBar({ me, onProfile, bell, couch }: { me: { id: string; name: string }; onProfile: () => void; bell?: ReactNode; couch?: { name: string; onClick: () => void } | null }) {
  return (
    <header className="flex items-center justify-between px-4 pb-1 pt-[calc(14px+env(safe-area-inset-top,0px))]">
      {couch ? (
        <div className="min-w-0">
          <Wordmark />
          {/* A place, not a headline: muted, small, its tap target the full 44 px (the hub's Up next stays the first thing seen). */}
          <button
            type="button"
            data-hub-couch={couch.name}
            onClick={couch.onClick}
            aria-label={`${couch.name}: your couches`}
            className="relative -mb-1 flex h-7 max-w-[210px] items-center gap-0.5 text-[13px] font-semibold text-muted-foreground before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']"
          >
            <span className="truncate">{couch.name}</span>
            <ChevronDown className="size-4 flex-none" aria-hidden />
          </button>
        </div>
      ) : (
        <Wordmark />
      )}
      <div className="flex items-center gap-1">
        {bell}
        <NavLink href={paths.settings} aria-label="Your settings" data-gear className="nd-press grid size-11 place-items-center rounded-[3px] hover:bg-card">
          <Settings className="size-5" aria-hidden />
        </NavLink>
        <button type="button" onClick={onProfile} aria-label="Your profile" data-tour="you" className="nd-press grid size-11 place-items-center rounded-[3px]">
          <Avatar id={me.id} name={me.name} />
        </button>
      </div>
    </header>
  );
}

/**
 * A pushed page's header: back on the left (to `parent`, the browser's back when that's where you came from), the
 * title in the middle, an action on the right. Sticky.
 */
export function PageHeader({
  title,
  back,
  right,
}: {
  title: ReactNode;
  back: { label: string; parent: string; accepts?: (prev: string) => boolean };
  right?: ReactNode;
}) {
  const nav = useNav();
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background/92 px-2.5 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => nav.back(back.parent, back.accepts)}
        className="flex h-14 items-center gap-0.5 justify-self-start rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {back.label}
      </button>
      <h1 className="type-caption text-[20px]">{title}</h1>
      <div className="justify-self-end">{right}</div>
    </header>
  );
}

/** The time now, ticking every second while `fast` (a clock inside its last day), else every minute. */
export function useNow(fast: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), fast ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [fast]);
  return now;
}
