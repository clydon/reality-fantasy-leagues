"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "cn";

// A two-thumb slider over whole steps (0..count-1), in the Lower Third look: a flat hairline track, the
// chosen stretch filled in foreground like a selected segment, square-ish thumbs, a tick and a number
// per step underneath. Steps are indexes, so the caller labels them (Research's are episode numbers,
// which can skip). One `mark` step gets its tick and number in chyron-line, with a caption under it
// (Research marks the league's first episode). Drag a thumb, tap the track to move the nearer one,
// or use the arrow keys / Home / End on a focused thumb.

export function RangeSlider({
  count,
  value,
  onChange,
  label,
  stepLabel,
  mark,
  className,
}: {
  count: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  /** Names the pair for screen readers, e.g. "Episodes". */
  label: string;
  /** The number under each tick and in each thumb's spoken value. */
  stepLabel: (i: number) => string;
  mark?: { at: number; caption: string };
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<0 | 1 | null>(null);
  const [lo, hi] = value;
  const last = Math.max(1, count - 1);
  const pct = (i: number) => `${(i / last) * 100}%`;

  const stepAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * last);
  };
  const move = (thumb: 0 | 1, to: number) => {
    const next: [number, number] = thumb === 0 ? [Math.min(to, hi), hi] : [lo, Math.max(to, lo)];
    if (next[0] !== lo || next[1] !== hi) onChange(next);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    const at = stepAt(e.clientX);
    // The nearer thumb; on a tie (both on one step) whichever way you're heading.
    const thumb: 0 | 1 = Math.abs(at - lo) < Math.abs(at - hi) ? 0 : Math.abs(at - lo) > Math.abs(at - hi) ? 1 : at < lo ? 0 : 1;
    dragging.current = thumb;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(thumb, at);
  };
  const key = (thumb: 0 | 1) => (e: KeyboardEvent) => {
    const now = thumb === 0 ? lo : hi;
    const to = { ArrowLeft: now - 1, ArrowDown: now - 1, ArrowRight: now + 1, ArrowUp: now + 1, Home: 0, End: count - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    move(thumb, Math.min(count - 1, Math.max(0, to)));
  };
  // Every number when they fit, otherwise every few (always the ends and the mark).
  const every = count <= 14 ? 1 : count <= 26 ? 2 : 4;
  const numbered = (i: number) => i === 0 || i === count - 1 || i === mark?.at || i % every === 0;

  return (
    <div className={cn("select-none px-3.5", className)}>
      <div
        ref={track}
        className="relative h-11 touch-none cursor-pointer"
        onPointerDown={down}
        onPointerMove={(e) => dragging.current !== null && move(dragging.current, stepAt(e.clientX))}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-[1px] bg-muted" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 bg-foreground" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})` }} />
        {([0, 1] as const).map((t) => {
          const at = t === 0 ? lo : hi;
          return (
            <div
              key={t}
              role="slider"
              tabIndex={0}
              aria-label={`${label}: ${t === 0 ? "from" : "to"}`}
              aria-valuemin={0}
              aria-valuemax={count - 1}
              aria-valuenow={at}
              aria-valuetext={stepLabel(at)}
              onKeyDown={key(t)}
              className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[3px] border-2 border-background bg-foreground shadow-[0_1px_4px_rgb(0_0_0/0.35)] outline-none focus-visible:ring-2 focus-visible:ring-chyron-line"
              style={{ left: pct(at), zIndex: t === 0 && lo === count - 1 ? 2 : 1 }}
            >
              <span className="h-2.5 w-px bg-background/60" aria-hidden />
            </div>
          );
        })}
      </div>
      <div className="relative h-8" aria-hidden>
        {Array.from({ length: count }, (_, i) => {
          const marked = i === mark?.at;
          const inside = i >= lo && i <= hi;
          return (
            <div key={i} className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1" style={{ left: pct(i) }}>
              <span className={cn("h-1.5 w-px", marked ? "bg-chyron-line" : inside ? "bg-foreground/60" : "bg-border")} />
              {numbered(i) && (
                <span className={cn("type-num text-[13px]", marked ? "text-chyron-line" : inside ? "text-foreground" : "text-muted-foreground")}>
                  {stepLabel(i)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {mark && (
        <div className="relative h-4" aria-hidden>
          <span
            className="absolute top-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.05em] text-chyron-line"
            style={{ left: pct(mark.at), transform: `translateX(${mark.at === 0 ? "-14px" : mark.at === count - 1 ? "calc(-100% + 14px)" : "-50%"})` }}
          >
            {mark.caption}
          </span>
        </div>
      )}
    </div>
  );
}
