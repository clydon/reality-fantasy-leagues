"use client";

import { useState } from "react";
import { ArrowLeftRight, Check, ChevronRight, Lock, Plus } from "lucide-react";
import { airTime, calm, ticks } from "../clock";
import { CAST, castaway } from "../fixtures/cast";
import { MOVES } from "../fixtures/moves";
import { outlastPoints } from "../fixtures/standings";
import { NavLink } from "../nav";
import { paths, type ShowTab } from "../routes";
import type { ShowData } from "../screens/show-space";
import { useNow } from "../ui/bars";
import { Btn, Chip } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { closeMoves, dockWords, openMoves, tabOf, useMovesSheet, type MovesTab } from "./moves";
import { Face, IconBox } from "./parts";

// The moves dock (the mock's dock.js, option D): above the tab bar on Episodes, Games and Cast while you play a game
// here, until airtime. Needs you (the one yellow: Set) → all set (Edit, change until airtime) → locked once it's on
// (scores stay hidden). Real: its state and words come from your moves due here and the schedule. It opens "Your
// moves", one sheet for the lineup, the pool pick, predictions and the Outlast team, still on fixtures (step 1
// writes through the lineup, pick and bet endpoints). Saving never locks; airtime does.

/** Whether the dock shows on this tab: not on Chat, and on Tonight only once it's on (Tonight has its own cards). */
export function dockShows(show: ShowData, tab: ShowTab) {
  if (!show.upNext || !show.games.some((g) => g.yourRole) || tab === "chat") return false;
  return tab !== "tonight" || show.upNext.live;
}

export function Dock({ show }: { show: ShowData }) {
  const up = show.upNext!;
  const t = up.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  const when = t != null ? `${airTime(t)} · ${calm(t, now)}` : null;
  const base = "nd-dock nd-fixed-x fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-[28] mx-2.5 flex items-center gap-2.5 overflow-hidden rounded-[4px] py-[7px] pl-[9px] pr-[7px] text-left shadow-[0_12px_28px_rgba(0,0,0,.5)]";

  if (up.live) {
    return (
      <div className={`${base} bg-secondary text-foreground`} aria-live="polite">
        <span className="grid size-[34px] flex-none place-items-center rounded-[3px] bg-background/60">
          <Lock className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <b className="block text-sm">Locked for Episode {up.number}</b>
          <small className="block text-[11.5px] text-muted-foreground">Scores stay hidden until you reveal</small>
        </span>
      </div>
    );
  }
  const need = show.moves.length > 0;
  return (
    <button type="button" onClick={() => openMoves(tabOf(show.moves[0]))} className={`${base} nd-press bg-plate text-plate-foreground`}>
      <span
        className={`grid size-[34px] flex-none place-items-center rounded-[3px] ${need ? "text-plate-muted outline-2 -outline-offset-2 outline-dashed outline-plate-muted/60" : "bg-good/20 text-good"}`}
        aria-hidden
      >
        {need ? <Plus className="size-4" /> : <Check className="size-4" strokeWidth={2.6} />}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block truncate text-sm">{need ? dockWords(show.moves) : `All set for Episode ${up.number}`}</b>
        {when && (
          <small className="block text-[11.5px] tabular-nums text-plate-muted">
            {need ? "Locks" : "Change until"} {when}
          </small>
        )}
      </span>
      <span className={`grid h-[38px] place-items-center rounded-[3px] px-3.5 text-sm font-extrabold ${need ? "bg-chyron text-chyron-foreground" : "bg-background text-foreground"}`}>
        {need ? "Set" : "Edit"}
      </span>
    </button>
  );
}

// ---------- the "Your moves" sheet ----------

const SEGMENTS: [MovesTab, string][] = [
  ["lineup", "Weekly Lineup"],
  ["pool", "Survival Pool"],
  ["predict", "Predictions"],
  ["outlast", "Outlast"],
];

export function MovesSheet({ show, seasonId }: { show: ShowData; seasonId: string }) {
  const { open, tab } = useMovesSheet();
  const up = show.upNext;
  const until = up?.airAt ? airTime(Date.parse(up.airAt)) : null;
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && closeMoves()}
      title="Your moves"
      subtitle={up ? `Episode ${up.number}${until ? ` · change anything until ${until}` : ""}` : undefined}
    >
      <Preview id="show.moves" className="-mx-2 mt-3 px-2 pb-2 pt-3">
        {/* A fresh body each time it opens, at the tab it was opened for. */}
        <MovesBody key={`${open}-${tab}`} initial={tab} seasonId={seasonId} />
      </Preview>
    </Sheet>
  );
}

function MovesBody({ initial, seasonId }: { initial: MovesTab; seasonId: string }) {
  const [seg, setSeg] = useState(initial);
  const [starters, setStarters] = useState<string[]>(MOVES.lineup.starters);
  const [pick, setPick] = useState<string | null>(null);
  const [calls, setCalls] = useState<Record<string, string>>({});
  const done: Record<MovesTab, boolean> = {
    lineup: starters.length >= MOVES.lineup.slots,
    pool: !!pick,
    predict: Object.keys(calls).length >= MOVES.predictions.length,
    outlast: true,
  };
  const toggle = (who: string) =>
    setStarters((s) => (s.includes(who) ? s.filter((x) => x !== who) : s.length < MOVES.lineup.slots ? [...s, who] : s));

  return (
    <>
      <div className="mb-3.5 flex gap-[3px] overflow-x-auto rounded-[3px] bg-background p-[3px] [scrollbar-width:none]" role="tablist">
        {SEGMENTS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={seg === k}
            data-try
            onClick={() => setSeg(k)}
            className={`relative h-9 flex-[1_0_auto] whitespace-nowrap rounded-[2px] px-2.5 text-[12.5px] font-bold ${seg === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {label}
            {!done[k] && <i className="absolute right-1 top-1.5 size-1.5 rounded-full bg-chyron-line" aria-label="To do" />}
          </button>
        ))}
      </div>

      {seg === "lineup" && (
        <>
          <p className="mb-2.5 text-[13px] text-muted-foreground">
            Start {MOVES.lineup.slots} of your {MOVES.lineup.roster.length}. Tap to start or bench.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {MOVES.lineup.roster.map((first) => {
              const c = castaway(first);
              const out = !!c.out;
              const on = starters.includes(first);
              return (
                <button
                  key={first}
                  type="button"
                  data-try={out ? undefined : true}
                  onClick={() => !out && toggle(first)}
                  aria-pressed={on}
                  className={`relative isolate flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[3px] p-1.5 text-left text-white transition-shadow ${on ? "shadow-[0_0_0_3px_var(--chyron)]" : ""}`}
                >
                  <Face src={c.photo} className={`absolute inset-0 -z-[2] size-full ${out ? "brightness-50 grayscale" : on ? "" : "brightness-[.7] saturate-[.35]"}`} />
                  <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,transparent_45%,rgba(10,8,14,.92))]" />
                  <span
                    className={`type-caption absolute left-1.5 top-1.5 rounded-[2px] px-1.5 py-0.5 text-[10px] tracking-[0.06em] ${
                      out ? "bg-live text-live-foreground" : on ? "bg-chyron text-chyron-foreground" : "bg-[rgba(16,14,21,.8)] text-muted-foreground"
                    }`}
                  >
                    {out ? "Out · replace" : on ? "Starting" : "Bench"}
                  </span>
                  <b className="type-caption text-[15px]">{first}</b>
                  <small className={`text-[11px] ${out ? "text-chyron-line" : "opacity-85"}`}>{out ? "Tap to replace" : `${c.perEp.reduce((a, b) => a + b, 0)} pts`}</small>
                </button>
              );
            })}
            {Array.from({ length: Math.max(0, MOVES.lineup.slots - starters.length) }, (_, i) => (
              <div
                key={i}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-[3px] text-center text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
              >
                <Plus className="size-[22px]" aria-hidden />
                <b className="type-caption text-[15px] text-foreground">Open slot</b>
                <small className="block text-[11px]">Start someone</small>
              </div>
            ))}
          </div>
          <NavLink data-try href={paths.showPage(seasonId, "waivers")} className="nd-press mt-2 flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
            <IconBox icon={ArrowLeftRight} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Replace {MOVES.lineup.replace.who}</b>
              <small className="block text-[13px] text-muted-foreground">Waivers · due {MOVES.lineup.replace.due}</small>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </NavLink>
        </>
      )}

      {seg === "pool" && (
        <>
          <p className="mb-2.5 text-[13px] text-muted-foreground">Who survives this episode? Streak {MOVES.pool.streak}. Not someone you&rsquo;ve used.</p>
          <div className="grid grid-cols-4 gap-2">
            {CAST.filter((c) => !c.out).map((c) => {
              const used = MOVES.pool.used.includes(c.first);
              const on = pick === c.first;
              return (
                <button
                  key={c.name}
                  type="button"
                  data-try={used ? undefined : true}
                  disabled={used}
                  onClick={() => setPick(c.first)}
                  aria-pressed={on}
                  className={`relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground ${used ? "opacity-45" : ""} ${on ? "shadow-[0_0_0_3px_var(--good)]" : ""}`}
                >
                  <Face src={c.photo} className="aspect-[4/4.2] w-full" />
                  {on && (
                    <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-good-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                  <span className="block px-1.5 pb-1.5 pt-1">
                    <b className="type-caption block text-[14px]">{c.first}</b>
                    <small className="block text-[11px] text-plate-muted">{used ? "Used" : c.tribe}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {seg === "predict" &&
        MOVES.predictions.map((p) => (
          <div key={p.key} className="mb-4">
            <b className="text-[15px]">{p.q}</b>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.options.map((o) => (
                <Chip key={o} data-try on={calls[p.key] === o} onClick={() => setCalls((c) => ({ ...c, [p.key]: o }))}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>
        ))}

      {seg === "outlast" && (
        <>
          <p className="mb-2.5 text-[13px] text-muted-foreground">Nothing to set in Outlast. Your four just have to last.</p>
          {MOVES.outlast.map((first) => {
            const c = castaway(first);
            return (
              <div key={first} className={`flex min-h-14 items-center gap-3 border-t border-border py-1.5 ${c.out ? "opacity-60" : ""}`}>
                <Face src={c.photo} out={!!c.out} className="size-10 rounded-[3px]" />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">{c.name}</b>
                  <small className="block text-[13px] text-muted-foreground">{c.out ? `Out · Episode ${c.out}` : "Still in"}</small>
                </span>
                <b className="type-num text-[22px]">{outlastPoints(first)}</b>
              </div>
            );
          })}
        </>
      )}

      <Btn tone="must" wide className="mt-3.5">
        Save
      </Btn>
      <p className="mt-2 text-center text-[13px] text-muted-foreground">Saving doesn&rsquo;t lock anything. Airtime does.</p>
    </>
  );
}
