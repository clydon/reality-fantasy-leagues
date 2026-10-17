"use client";

import { useEffect, useState } from "react";
import { Tv } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "@/components/motion";
import { api } from "@/lib/api";
import { publicMediaSrc } from "@/lib/game/selectors";
import { artStyleVars, type ArtStyle } from "@/lib/show-art-style";
import { cn } from "cn";

// The front door's title card: "Turn [a show] into a game." The show's name sits on a caption
// plate and rolls through shows people play, landing on "Your show" and staying there, so the
// point (any show) is the last thing it says and nothing moves while someone is typing. Under
// reduced motion it just says "Your show". Only competition shows research handles today;
// non-competition formats are still planned.
//
// Behind it, ShowRollArt fades in the art an admin chose for each show as its name comes up (a
// show without art leaves the plain ground). On "Your show" the art comes back as a wall: every
// show's poster tiled at an angle, dimmed and drifting slowly upward, so the last word lands on all
// of them rather than an empty ground. One cell in it is no poster but a standby monitor saying
// "Your show": the one slot not yet on air, placed once, so it never repeats in view. useShowRoll is the one clock both read.
const SHOWS = ["Survivor", "The Traitors", "Big Brother", "The Challenge", "Love Island", "Drag Race"];
const LAST = "Your show";
const STEP_MS = 1500;

const EASE = [0.16, 1, 0.3, 1] as const;

/** The show the roll is on right now. */
export function useShowRoll(): string {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const names = [...SHOWS, LAST];
  const done = i >= names.length - 1;

  useEffect(() => {
    if (reduce || done) return;
    const t = setTimeout(() => setI((n) => n + 1), i === 0 ? STEP_MS + 600 : STEP_MS);
    return () => clearTimeout(t);
  }, [i, reduce, done]);

  return reduce ? LAST : names[i];
}

export function ShowRoll({ name }: { name: string }) {
  return (
    <>
      <h1 className="sr-only">Turn any TV show into a game.</h1>
      <div aria-hidden className="type-caption text-[clamp(44px,12.5vw,60px)] leading-[0.95]">
        <div>Turn</div>
        <m.div layout transition={{ layout: { duration: 0.35, ease: EASE } }} className="isolate my-2.5 flex h-[1.4em] w-fit [--tag-slant:0.2em] max-w-full items-stretch rounded-[3px] shadow-plate">
          <m.span layout="position" className="tag-cut flex shrink-0 items-center bg-quiet-tag pr-[22px] pl-3 text-quiet-tag-foreground">
            <Tv className="size-[0.42em]" strokeWidth={2.4} />
          </m.span>
          <span className="tag-tuck relative flex min-w-0 items-center overflow-hidden rounded-r-[3px] bg-plate pr-4 pl-5 text-plate-foreground">
            <AnimatePresence mode="popLayout" initial={false}>
              <m.span
                key={name}
                initial={{ y: "70%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-70%", opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="block truncate pt-[0.06em] text-[0.8em]"
              >
                {name}
              </m.span>
            </AnimatePresence>
          </span>
        </m.div>
        <div>Into a game.</div>
      </div>
    </>
  );
}

type Art = { src: string; style: ArtStyle | null };

// A catalog name matches a roll name loosely: "The Traitors (US)" is The Traitors, "RuPaul's Drag
// Race" is Drag Race.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The roll's backdrop: each show's art, all loaded up front and crossfaded, so a name never waits on
 *  its picture. The same look as Overview's header art (.show-art), each show's own style included. */
export function ShowRollArt({ name }: { name: string }) {
  const [art, setArt] = useState<Record<string, Art>>({});
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    api
      .showArt()
      .then(({ shows }) => {
        const out: Record<string, Art> = {};
        for (const roll of SHOWS) {
          const hit = shows.find((s) => norm(s.name) === norm(roll)) ?? shows.find((s) => norm(s.name).includes(norm(roll)));
          const src = publicMediaSrc(hit?.artUrl);
          if (hit && src) out[roll] = { src, style: hit.artStyle };
        }
        if (live) setArt(out);
      })
      // No art is the plain ground: nothing to say.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const shown = Object.entries(art).filter(([roll]) => !failed.includes(roll));
  if (!shown.length) return null;
  return (
    <div aria-hidden className="show-art show-art-door pointer-events-none absolute inset-0">
      {shown.map(([roll, a]) => (
        <div
          key={roll}
          style={artStyleVars(a.style)}
          className={cn(
            "absolute inset-0 transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
            roll === name ? "scale-100 opacity-100" : "scale-[1.04] opacity-0",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
          <img src={a.src} alt="" onError={() => setFailed((f) => [...f, roll])} />
        </div>
      ))}
      <div className={cn("show-wall", name === LAST && "show-wall-on")}>
        <div className="show-wall-track">
          <div className="show-wall-tile show-wall-yours">
            <b>Your show here</b>
            <em>Standby</em>
          </div>
          {Array.from({ length: WALL_TILES }, (_, i) => {
            const [roll, a] = shown[(i * 5) % shown.length];
            return (
              <div key={i} style={artStyleVars(a.style)} className="show-wall-tile">
                {/* eslint-disable-next-line @next/next/no-img-element -- art_url can be an arbitrary external URL */}
                <img src={a.src} alt="" onError={() => setFailed((f) => (f.includes(roll) ? f : [...f, roll]))} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Enough tiles to cover a phone or a desktop at the wall's angle, with room to drift.
const WALL_TILES = 96;
