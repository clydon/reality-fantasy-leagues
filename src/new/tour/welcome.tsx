"use client";

import type { ReactNode } from "react";
import { Avatar } from "../ui/bars";
import { Btn } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import type { Couch, Home } from "../data";

// The first-time tour's first step (docs/PLAN-first-time-tour.md version 2): a card over Home saying what the app is and its three
// ideas, each with a picture of your own where there is one (your couch's faces, your shows' art), then Show me around. A wall of
// show art across its top: yours and your couch's first, the tour's own after.

const OWN_ART = ["/tour/survivor.jpg", "/tour/traitors.jpg", "/tour/pluribus.jpg"];

export function Welcome({ home, couch, count, shown, onGo, onSkip }: { home: Home; couch: Couch | null; count: string; shown: boolean; onGo: () => void; onSkip: () => void }) {
  const faces = (couch?.members ?? []).filter((m) => m.userId !== home.user.id).slice(0, 3);
  const art = [...home.shows, ...(home.couchShows ?? [])].map((s) => ({ key: s.seasonId, url: s.show.artUrl, name: s.show.name })).filter((a) => a.url);
  const wall = Array.from({ length: 9 }, (_, i) => art[i] ?? { key: `own-${i}`, url: OWN_ART[i % OWN_ART.length], name: "" });
  const posters = (art.length ? art : wall).slice(0, 2);
  return (
    <div
      data-tour-welcome
      role="dialog"
      aria-modal="true"
      aria-labelledby="nd-tour-welcome"
      className={`nd-fixed-x fixed inset-y-0 z-[86] flex flex-col bg-background text-foreground transition-[opacity,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div aria-hidden className="relative h-[clamp(130px,calc(100dvh-470px),360px)] flex-none overflow-hidden">
        <div className="absolute -inset-x-[70px] -top-[46px] grid grid-cols-3 gap-2 [transform:rotate(-8deg)]">
          {wall.map((a, i) => (
            <ShowArt key={`${a.key}-${i}`} seasonId={`tour-wall-${i}`} artUrl={a.url} name={a.name} className="aspect-video w-full rounded-[4px] text-[22px]" />
          ))}
        </div>
        <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--background)_45%,transparent)_55%,var(--background)_100%)]" />
      </div>
      <div className="absolute inset-x-4 top-[calc(12px+env(safe-area-inset-top,0px))] flex items-center justify-between">
        <span className="tag-cut type-num grid h-[30px] place-items-center bg-quiet-tag pl-[9px] pr-4 text-[15px] text-quiet-tag-foreground [--tag-slant:9px]">{count}</span>
        <button type="button" data-tour-skip onClick={onSkip} className="-mr-1.5 grid h-11 place-items-center px-1.5">
          <span className="grid h-[30px] place-items-center rounded-full bg-background px-3.5 text-[13px] font-bold shadow-plate outline-1 -outline-offset-1 outline-edge">Skip tour</span>
        </button>
      </div>
      <div className="relative -mt-[30px] flex min-h-0 flex-1 flex-col px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
        <p className="type-caption text-[14px] tracking-[0.07em] text-muted-foreground">Welcome to</p>
        <h1 id="nd-tour-welcome" className="type-caption mt-1.5 flex items-center text-[46px] leading-[.95]" aria-label="Game Your Show">
          <span aria-hidden className="text-transparent [-webkit-text-stroke:2px_var(--foreground)]">Game</span>
          <span aria-hidden className="mx-1 bg-foreground pb-0 pl-[11px] pr-[16px] pt-[3px] text-background [clip-path:polygon(9px_0,100%_0,calc(100%_-_9px)_100%,0_100%)]">
            Your
          </span>
          <span aria-hidden className="text-transparent [-webkit-text-stroke:2px_var(--foreground)]">Show</span>
        </h1>
        <p className="mt-2.5 text-[16px] leading-snug text-muted-foreground">Watch with your people. Make any show a game.</p>
        <ul className="mt-[18px] flex flex-col gap-3">
          <Idea title="Your couch" line="Your people, and what everyone's watching.">
            <span className="flex">
              {(faces.length ? faces : [{ userId: home.user.id, name: home.user.name }]).map((m, i) => (
                <span key={m.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-2" : ""}`}>
                  <Avatar id={m.userId} name={m.name} size={28} />
                </span>
              ))}
            </span>
          </Idea>
          <Idea title="Your shows" line="Anything you watch. Nothing past your episode shows.">
            <span className="relative block h-12 w-16">
              {posters.map((p, i) => (
                <ShowArt
                  key={p.key}
                  seasonId={`tour-idea-${p.key}`}
                  artUrl={p.url}
                  name={p.name}
                  className={`absolute aspect-video w-12 rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "left-3.5 top-[17px] rotate-[5deg]" : "left-0 top-1 -rotate-[7deg]"}`}
                />
              ))}
            </span>
          </Idea>
          <Idea title="Games" line="Optional, on any show. Picks lock when it airs.">
            <span className="flex h-[26px] w-16 overflow-hidden rounded-[2px] bg-plate">
              <i className="tag-cut type-caption grid place-items-center bg-chyron pl-1.5 pr-3 text-[11px] not-italic text-chyron-foreground [--tag-slant:6px]">Pick</i>
            </span>
          </Idea>
        </ul>
        <Btn tone="ink" wide data-tour-go onClick={onGo} className="mt-auto">
          Show me around
        </Btn>
      </div>
    </div>
  );
}

function Idea({ title, line, children }: { title: string; line: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5">
      <span aria-hidden className="grid h-12 w-16 flex-none place-items-start content-center">
        {children}
      </span>
      <span className="min-w-0">
        <b className="type-caption block text-[19px] leading-none">{title}</b>
        <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">{line}</small>
      </span>
    </li>
  );
}
