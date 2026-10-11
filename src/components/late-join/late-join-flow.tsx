"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastTile, TileGrid, shortNames, useTribeFilter } from "@/components/draft/draft-ui";
import { PrimaryButton } from "@/components/setup/settings-ui";
import { m, AnimatePresence } from "@/components/motion";
import { cn } from "cn";

// A late joiner's way in (StateLogic.GhostLogic, docs/PLAN-late-joiners.md), full screen at
// /late-join. AuthGate sends them here until they've started.
//
//   1. Where to start: an episode number, nothing more -- titles can give an episode away.
//   2. Draft (league types with a draft): a team from the cast as it stood before that episode.
//
// Then the league opens on their start episode as if it airs tonight.

const STEP_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

export function LateJoinFlow() {
  const router = useRouter();
  const raw = useLeagueStore((s) => s.rawState);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const me = useLeagueStore((s) => s.membership?.playerId ?? null);
  const setState = useLeagueStore((s) => s.setState);
  const terms = useShowTerms();

  const choices = StateLogic.GhostLogic.startChoices(raw);
  const live = choices[choices.length - 1];
  const teamSize = StateLogic.GhostLogic.teamSize(raw);
  const hasDraft = teamSize > 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [dir, setDir] = useState(1);
  const [start, setStart] = useState<number | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The cast as it stood before their start episode: who's still in, in the groups they were in then.
  const before = useMemo(
    () => (start === null ? null : (StateLogic.SpoilerLogic.viewThrough(raw, Math.max(0, start - 1)) as LeagueState)),
    [raw, start],
  );
  const pool = useMemo(() => {
    if (!before || start === null) return [];
    const ids = new Set(StateLogic.GhostLogic.draftPool(raw, start));
    return before.castaways.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [before, raw, start]);
  const need = Math.min(teamSize, pool.length);
  const names = useMemo(() => shortNames(pool), [pool]);
  const { shown, chips } = useTribeFilter(pool, before ?? raw);

  const needed = !!me && StateLogic.GhostLogic.needsStart(raw, me);
  // Nothing to choose (already started, or not a late joiner): back to the league.
  useEffect(() => {
    if (!needed && !busy) router.replace("/");
  }, [needed, busy, router]);
  if (!needed) return null;

  const go = (next: 1 | 2) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
  };

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < need ? [...p, id] : p));

  async function begin() {
    if (start === null || !leagueId) return;
    setBusy(true);
    setError(null);
    try {
      await api.beginLateJoin(leagueId, start, hasDraft ? picked : []);
      // The whole league again, with their new mark: the view opens on their start episode.
      const res = await api.leagueState(leagueId);
      useLeagueStore.setState({ membership: res.membership });
      setState(res.state);
      router.replace("/");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start. Try again.");
      setBusy(false);
    }
  }

  const canNext = step === 1 ? start !== null : picked.length === need;
  const last = step === 2 || !hasDraft;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <header className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 py-2.5 pl-1 pr-4">
          {step === 2 ? (
            <IconButton label="Back" onClick={() => go(1)}>
              <ChevronLeft className="size-6" strokeWidth={2.2} />
            </IconButton>
          ) : (
            <IconButton label="Close" onClick={() => router.push("/dashboard")}>
              <X className="size-[22px]" strokeWidth={2.2} />
            </IconButton>
          )}
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{leagueName}</span>
          {hasDraft && <span className="text-sm text-muted-foreground">{step} of 2</span>}
        </div>
        {hasDraft && (
          <div className="flex gap-1.5 px-4" aria-hidden>
            {[1, 2].map((n) => (
              <span key={n} className={cn("h-1 flex-1 rounded-full", n <= step ? "bg-chyron-line" : "bg-input")} />
            ))}
          </div>
        )}
      </header>

      <main className="relative flex flex-1 flex-col overflow-x-clip px-4 pb-6 pt-5">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <m.div
            key={step}
            custom={dir}
            variants={STEP_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col"
          >
            {step === 1 ? (
              <>
                <h1 className="type-caption text-[30px] leading-none">Where do you start?</h1>
                <p className="mt-2.5 text-[15px] leading-snug text-muted-foreground">
                  Pick the episode after the last one you&rsquo;ve watched. You&rsquo;ll play it as if it airs tonight: make your picks, watch
                  it, then reveal it. One episode at a time until you&rsquo;re caught up.
                </p>
                <div role="radiogroup" aria-label="Start episode" className="mt-5 flex flex-col">
                  {choices.map((n) => {
                    const on = start === n;
                    const note = n === choices[0] ? "From the start" : n === live ? "Live, with the league" : null;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setStart(n);
                          setPicked([]);
                        }}
                        className={cn(
                          "flex min-h-14 items-center gap-4 border-b border-border px-1 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-chyron-line",
                          on && "bg-plate text-plate-foreground",
                        )}
                      >
                        <span className={cn("type-caption type-num w-12 shrink-0 text-right text-[30px] leading-none", !on && "text-muted-foreground")}>
                          {n}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="type-caption text-[17px]">Episode {n}</span>
                          {note && <span className={cn("text-[13px]", on ? "text-plate-muted" : "text-muted-foreground")}>{note}</span>}
                        </span>
                        {on && (
                          <span className="type-caption shrink-0 bg-chyron px-2.5 py-1 text-[13px] text-chyron-foreground" aria-hidden>
                            Start here
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
                  The rest of the league won&rsquo;t see you until your commissioner adds you. Episodes before your start don&rsquo;t score for you.
                </p>
              </>
            ) : (
              <>
                <h1 className="type-caption text-[30px] leading-none">Draft your team</h1>
                <p className="mt-2.5 text-[15px] leading-snug text-muted-foreground">
                  Pick {need} from the {terms.castaways} still in before episode {start}. Your team is your own: anyone can be on it,
                  whoever else has them.
                </p>
                {chips && <div className="mt-4">{chips}</div>}
                <div className="mt-4">
                  <TileGrid>
                    {shown.map((c) => {
                      const on = picked.includes(c.id);
                      return (
                        <CastTile
                          key={c.id}
                          castaway={c}
                          label={names.get(c.id) ?? c.name}
                          state={before ?? raw}
                          mark={on ? "add" : undefined}
                          dim={!on && picked.length >= need}
                          onClick={() => toggle(c.id)}
                        />
                      );
                    })}
                  </TileGrid>
                </div>
              </>
            )}
          </m.div>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-border bg-background px-4 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-3">
        {error && (
          <p role="alert" className="mb-2.5 text-sm font-semibold text-live">
            {error}
          </p>
        )}
        {step === 2 && (
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {picked.length} of {need} picked
          </p>
        )}
        <PrimaryButton className="min-h-[52px] w-full text-base" disabled={!canNext || busy} onClick={last ? begin : () => go(2)}>
          {busy ? "Starting…" : last ? (start === live ? "Join live" : `Start at episode ${start ?? ""}`) : "Next: draft your team"}
        </PrimaryButton>
      </footer>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-[3px] text-foreground focus-visible:outline-3 focus-visible:outline-chyron-line"
    >
      {children}
    </button>
  );
}
