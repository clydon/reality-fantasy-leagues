"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { colourOf, pictureUrl } from "@/lib/people";
import { usePerson } from "../data";
import { useNav } from "../nav";

// The new design's top bars: the hub's (the wordmark, notifications, you) and a pushed page's (back, a centred
// title, an action on the right). A show's own bar is show-bar.tsx.

/**
 * Someone's square (the mock's .av): their picture, else their initial on their colour (step 15 part 1: the colour and picture
 * they chose in their profile, which come with the home read for you and everyone on your couches; anyone else, and anyone
 * before the home is read, is on the colour their id picks). `colour` sets it outright (a computer player).
 */
export function Avatar({ id, name, size = 34, colour }: { id: string; name: string; size?: number; colour?: string }) {
  const face = usePerson(id);
  const [broken, setBroken] = useState<number | null>(null);
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

/** The hub's top: the wordmark, notifications (`bell`: the hub's NotesBell), and you (your profile: your couch, your numbers, Settings). */
export function TopBar({ me, onProfile, bell }: { me: { id: string; name: string }; onProfile: () => void; bell?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-4 pb-1 pt-[calc(14px+env(safe-area-inset-top,0px))]">
      <Wordmark />
      <div className="flex items-center gap-1.5">
        {bell}
        <button type="button" onClick={onProfile} aria-label="Your profile" className="nd-press grid size-11 place-items-center rounded-[3px]">
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
    <header className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-[rgba(22,20,29,.92)] px-2.5 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
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
