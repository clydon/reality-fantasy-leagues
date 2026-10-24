"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { GUIDE, type GuideCard } from "../fixtures/guide";
import { PEOPLE } from "../fixtures/people";
import { RAIL } from "../fixtures/streaming";
import { Preview } from "../ui/preview";

// "This week on the couch", the TV guide (the mock's index.html guideDays / card, tvguide.js), and Streaming on the
// couch (streaming.js) under it. Both on fixtures until steps 11 and 14.

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function Card({ c, short, height }: { c: GuideCard; short?: boolean; height?: number }) {
  return (
    <button
      type="button"
      className={`relative isolate flex flex-col justify-end overflow-hidden rounded-[3px] bg-card text-left text-white ${
        short ? "h-[66px] px-2 py-1.5 opacity-80 outline-1 -outline-offset-1 outline-white/10 [filter:saturate(.3)_brightness(.78)]" : "px-[9px] py-2"
      } ${c.watchOnly ? "outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-white/45" : ""}`}
      style={{ height: short ? undefined : (height ?? 104) }}
    >
      {c.art ? (
        // eslint-disable-next-line @next/next/no-img-element -- fixture art from the published mock
        <img
          src={c.art}
          alt=""
          className={`absolute inset-0 -z-[2] size-full object-cover ${c.watchOnly ? "[filter:saturate(.35)_brightness(.8)]" : ""}`}
          style={{ objectPosition: c.position }}
        />
      ) : (
        <span className="type-caption absolute inset-0 -z-[2] grid place-items-center bg-[linear-gradient(150deg,#3a3548,#16141d)] text-[34px] text-white/20">
          {c.name[0]}
        </span>
      )}
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(10,8,14,.15)_0%,rgba(10,8,14,.55)_48%,rgba(10,8,14,.92)_100%)]" />
      <span
        className={`rounded-[2px] bg-[rgba(10,8,14,.72)] font-extrabold backdrop-blur-sm ${short ? "mb-0.5 self-start px-[5px] py-0.5 text-[10px]" : "absolute left-2 top-[7px] px-1.5 py-[3px] text-[11px]"}`}
      >
        {c.time}
      </span>
      {c.due && <i className="absolute right-2 top-2 size-[9px] rounded-full bg-live shadow-[0_0_0_2px_rgba(255,255,255,.8)]" aria-label="A move is due" />}
      {c.tag && (
        <span
          className={`type-caption mb-1 self-start py-[3px] pl-1.5 pr-2.5 text-[10px] tracking-[0.06em] [clip-path:polygon(0_0,100%_0,calc(100%_-_6px)_100%,0_100%)] ${
            c.tag.tone === "good" ? "bg-good text-good-foreground" : "bg-secondary text-foreground"
          }`}
        >
          {c.tag.text}
        </span>
      )}
      <span className={`type-caption leading-[.95] [text-shadow:0_1px_8px_rgba(0,0,0,.5)] ${short ? "text-sm" : "text-[17px]"}`}>{c.name}</span>
      <span className={`mt-[3px] flex items-center justify-between gap-1 font-semibold opacity-85 ${short ? "text-[10px]" : "text-[11px]"}`}>
        <span>{c.sub}</span>
        {c.faces && (
          <span className="flex">
            {c.faces.map((p) => (
              <span
                key={p}
                className="-ml-[3px] grid size-3.5 place-items-center rounded-[2px] text-[8px] font-extrabold text-[#121018] shadow-[0_0_0_1.5px_rgba(10,8,14,.9)]"
                style={{ background: PEOPLE[p] }}
              >
                {p[0].toUpperCase()}
              </span>
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

export function Guide() {
  const reel = useRef<HTMLDivElement>(null);
  const rolling = useRoll(reel);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const evening = new Date().getHours() >= 17;
  const nowLabel = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (
    <section className="mt-8">
      <div className="mb-2.5 flex items-baseline justify-between px-4">
        <h2 className="type-caption text-[24px]">This week on the couch</h2>
        <span className="flex h-8 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <i className={`size-[7px] rounded-full ${rolling ? "bg-good" : "bg-input"}`} aria-hidden />
          {rolling ? "Rolling" : "Paused"}
        </span>
      </div>
      <Preview id="hub.guide" className="mx-2">
        <div
          ref={reel}
          className="flex overflow-x-auto pb-1.5 pt-2 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_14px,#000_calc(100%_-_24px),transparent)]"
        >
          {GUIDE.map((d, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() + d.offset);
            const label = d.offset === 0 ? (evening ? "Tonight" : "Today") : d.offset === 1 ? "Tomorrow" : DAY[date.getDay()];
            return (
              <div key={d.offset} className={`flex flex-none flex-col gap-[7px] border-l border-border px-[5px] ${i ? "w-[162px]" : "w-[165px] border-l-0 pl-2"}`}>
                <div className="flex h-6 items-baseline gap-1.5 whitespace-nowrap px-[3px] pb-1 pt-0.5">
                  <b
                    className={`type-caption text-[17px] ${i ? "" : "bg-chyron py-[3px] pl-1.5 pr-3 text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]"}`}
                  >
                    {label}
                  </b>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {d.offset < 2 ? `${DAY[date.getDay()]} ` : ""}
                    {MON[date.getMonth()]} {date.getDate()}
                  </span>
                </div>
                {d.mine.map((m, k) => (
                  <div key={k} className="contents">
                    {d.nowBefore === k && (
                      <div className="type-caption flex h-3.5 items-center gap-1.5 text-[11px] tracking-[0.06em] text-chyron-line after:h-0.5 after:flex-1 after:bg-chyron-line">
                        Now {nowLabel}
                      </div>
                    )}
                    {Array.isArray(m) ? (
                      <div className="flex flex-col gap-[5px] border-l-[3px] border-chyron-line pl-2">
                        <em className="type-caption flex h-3 justify-between text-[11px] not-italic tracking-[0.06em] text-chyron-line">
                          <span>Same time</span>
                          <span>{m[0].time}</span>
                        </em>
                        {m.map((c) => (
                          <Card key={c.name} c={c} height={86} />
                        ))}
                      </div>
                    ) : (
                      <Card c={m} />
                    )}
                  </div>
                ))}
                <div className="type-caption mt-0.5 flex h-3.5 items-center gap-1.5 text-[10px] tracking-[0.08em] text-muted-foreground after:h-px after:flex-1 after:bg-border">
                  Also on
                </div>
                {d.also.map((c) => (
                  <Card key={c.name} c={c} short />
                ))}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-2 pb-1 pt-1 text-[13px] text-muted-foreground">
          <span>Faded: not on your shows</span>
          <span className="flex h-10 items-center gap-1 rounded-[3px] px-2.5 text-sm font-semibold text-foreground outline-1 -outline-offset-1 outline-input">
            <Plus className="size-4" aria-hidden />
            Add a show
          </span>
        </div>
      </Preview>
    </section>
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
