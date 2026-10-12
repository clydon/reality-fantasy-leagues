"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, X } from "lucide-react";
import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import { api, ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";
import { confirm } from "@/lib/confirm-store";
import { useShowTerms } from "@/lib/use-show-terms";
import { CastTile, TileGrid, shortNames, useTribeFilter } from "@/components/draft/draft-ui";
import { PrimaryButton } from "@/components/setup/settings-ui";
import { m, AnimatePresence } from "@/components/motion";
import { cn } from "cn";

// A late joiner's way in (StateLogic.GhostLogic, docs/PLAN-late-joiners.md), full screen at
// /late-join. AuthGate sends them here until they've started.
//
//   1. What have you watched: the season as a strip of episode numbers (never titles -- a title can
//      give an episode away). Tapping the last one you've finished marks everything up to it watched,
//      and you start right after it. One answer, so there's no second number to get off by one.
//      Starting later than that is a separate, deliberate step ("Start somewhere else"), and the only
//      way to see results you haven't watched -- with a confirm that names them.
//   2. Draft (league types with a draft): a team from the cast as it stood before that episode.
//
// Then the league opens on their start episode as if it airs tonight.
//
// Linked leagues (docs/PLAN-linked-late-join.md): how far they've watched is a fact about them and the
// season, so step 1 is asked once for every linked league they still have to start, and drafts follow
// one per league with a draft. Already playing a linked league? Its mark is the answer, prefilled.

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

  const choices = StateLogic.GhostLogic.startChoices(raw) as number[];
  const live = choices[choices.length - 1];
  const latest = live - 1;

  // The linked group: the other leagues this answer starts (with their own state, for their drafts),
  // and the answer they've already given in one they're playing. Null until loaded.
  const [group, setGroup] = useState<{ others: GroupLeague[]; prior: { name: string; mark: number } | null } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const leagues: GroupLeague[] = useMemo(
    () => (leagueId ? [{ id: leagueId, name: leagueName ?? "", raw }, ...(group?.others ?? [])] : []),
    [leagueId, leagueName, raw, group],
  );
  const drafts = leagues.filter((l) => StateLogic.GhostLogic.teamSize(l.raw) > 0);
  const hasDraft = drafts.length > 0;
  const steps = 1 + drafts.length;

  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  // The last episode they've finished (0 = none yet). Null until they answer: nothing is guessed.
  const [watched, setWatched] = useState<number | null>(null);
  // "Start somewhere else": a start they chose over the one their answer gives.
  const [elsewhere, setElsewhere] = useState(false);
  const [override, setOverride] = useState<number | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Right after what they've watched -- or the league's own first episode, if it starts later.
  const natural = watched === null ? null : (choices.find((n) => n >= watched + 1) ?? live);
  const start = override ?? natural;

  const draft = step > 1 ? drafts[step - 2] : null;
  const draftStart = draft && start !== null ? startIn(draft.raw, start) : null;
  // The cast as it stood before their start episode: who's still in, in the groups they were in then.
  const before = useMemo(
    () => (!draft || draftStart === null ? null : (StateLogic.SpoilerLogic.viewThrough(draft.raw, Math.max(0, draftStart - 1)) as LeagueState)),
    [draft, draftStart],
  );
  const pool = useMemo(() => {
    if (!before || !draft || draftStart === null) return [];
    const ids = new Set(StateLogic.GhostLogic.draftPool(draft.raw, draftStart));
    return before.castaways.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [before, draft, draftStart]);
  const need = draft ? needFor(draft.raw, draftStart) : 0;
  const picked = (draft && picks[draft.id]) || [];
  const names = useMemo(() => shortNames(pool), [pool]);
  const { shown, chips } = useTribeFilter(pool, before ?? raw);

  const needed = !!me && StateLogic.GhostLogic.needsStart(raw, me);

  useEffect(() => {
    if (!leagueId || !needed) return;
    let gone = false;
    (async () => {
      let others: GroupLeague[] = [];
      let prior: { name: string; mark: number } | null = null;
      try {
        const { leagues: all } = await api.lateJoinGroup(leagueId);
        const pending = all.filter((l) => l.pending && l.id !== leagueId);
        others = await Promise.all(pending.map(async (l) => ({ id: l.id, name: l.name, raw: (await api.leagueState(l.id)).state })));
        // Already playing more than one? The least they've watched: never assume more.
        for (const l of all) if (!l.pending && l.mark !== null && (!prior || l.mark < prior.mark)) prior = { name: l.name, mark: l.mark };
      } catch {
        // Just this league, asked as before.
      }
      if (gone) return;
      setGroup({ others, prior });
      if (prior) setWatched(Math.min(prior.mark, latest));
    })();
    return () => {
      gone = true;
    };
    // Loaded once per league: the answer is theirs to change after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, needed]);
  // Nothing to choose (already started, or not a late joiner): back to the league.
  useEffect(() => {
    if (!needed && !busy) router.replace("/");
  }, [needed, busy, router]);
  if (!needed || !group) return null;

  // Episodes their start would show them that they haven't watched.
  // Only a start they chose over their answer can do that: the league's own later first episode can't.
  const spoiled = override !== null && watched !== null && override - 1 > watched ? { a: watched + 1, b: override - 1 } : null;
  const spoiledText = spoiled ? (spoiled.a === spoiled.b ? `episode ${spoiled.a}` : `episodes ${spoiled.a} to ${spoiled.b}`) : "";

  // Said plainly, once, before it happens.
  async function spoilsOk() {
    if (!spoiled || start === null) return true;
    return confirm(`Starting at episode ${start} shows you the results of ${spoiledText}, which you haven't watched. You can't undo this.`, {
      title: "See results you haven't watched?",
      confirmLabel: `Start at episode ${start}`,
      cancelLabel: "Go back",
      danger: true,
    });
  }

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError(null);
  };

  const answer = (w: number) => {
    setWatched(w);
    setOverride(null);
    setElsewhere(false);
    setPicks({});
  };

  const toggle = (id: string) => {
    if (!draft) return;
    const p = picked;
    setPicks({ ...picks, [draft.id]: p.includes(id) ? p.filter((x) => x !== id) : p.length < need ? [...p, id] : p });
  };

  async function begin() {
    if (start === null || !leagueId) return;
    if (!hasDraft && !(await spoilsOk())) return;
    setBusy(true);
    setError(null);
    try {
      // Every league this answer starts, this one first; one that failed before is tried again,
      // one that already started isn't.
      for (const l of leagues) {
        if (done.includes(l.id)) continue;
        await api.beginLateJoin(l.id, startIn(l.raw, start), picks[l.id] ?? []);
        setDone((d) => [...d, l.id]);
      }
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
  const last = step === steps;
  const others = group.others;
  // Their answer, reused from a linked league they're playing, untouched so far.
  const reused = group.prior && !override && watched === Math.min(group.prior.mark, latest) ? group.prior : null;

  // The answer, read back in a sentence: what they said, and what happens because of it.
  const saidWatched =
    watched === null
      ? null
      : watched === 0
        ? "You haven't watched any yet."
        : watched === latest
          ? `You've watched all ${latest}.`
          : watched === 1
            ? "You've watched episode 1."
            : `You've watched episodes 1 to ${watched}.`;
  const startsAt = start === null ? null : start === live ? "You'll join live, with the league." : `You'll start at episode ${start}.`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col">
      <header className="sticky top-0 z-10 bg-background pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 py-2.5 pl-1 pr-4">
          {step > 1 ? (
            <IconButton label="Back" onClick={() => go(step - 1)}>
              <ChevronLeft className="size-6" strokeWidth={2.2} />
            </IconButton>
          ) : (
            <IconButton label="Close" onClick={() => router.push("/dashboard")}>
              <X className="size-[22px]" strokeWidth={2.2} />
            </IconButton>
          )}
          <span className="min-w-0 flex-1 truncate text-base font-semibold">{draft?.name ?? leagueName}</span>
          {hasDraft && (
            <span className="text-sm text-muted-foreground">
              {step} of {steps}
            </span>
          )}
        </div>
        {hasDraft && (
          <div className="flex gap-1.5 px-4" aria-hidden>
            {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
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
              elsewhere && watched !== null ? (
                <StartElsewhere
                  choices={choices}
                  live={live}
                  watched={watched}
                  start={start}
                  onPick={(n) => setOverride(n === natural ? null : n)}
                  onBack={() => {
                    setOverride(null);
                    setElsewhere(false);
                  }}
                />
              ) : (
                <>
                  <h1 className="type-caption text-balance text-[30px] leading-none">Which episodes have you watched?</h1>
                  <p className="mt-2.5 text-pretty text-[16px] leading-snug">
                    Tap the last one you&rsquo;ve finished. You&rsquo;ll start right after it.
                  </p>
                  {others.length > 0 && (
                    <p className="mt-2 text-pretty text-[15px] font-semibold leading-snug">
                      This sets where you start in all {others.length + 1} linked leagues: {leagues.map((l) => l.name).join(", ")}.
                    </p>
                  )}
                  <p className="mt-2 text-pretty text-[14px] leading-snug text-muted-foreground">
                    <b className="font-semibold text-foreground">Not sure? Pick fewer.</b> Rewatching costs nothing; picking too many shows you
                    results you haven&rsquo;t seen.
                  </p>
                  <SeasonStrip latest={latest} watched={watched} start={start} live={live} onAnswer={answer} />
                  <p className="mt-5 text-[13px] leading-snug text-muted-foreground">
                    The rest of the league won&rsquo;t see you until your commissioner adds you. Episodes before your start don&rsquo;t score for you.
                  </p>
                </>
              )
            ) : (
              <>
                {leagues.length > 1 && (
                  <p className="type-caption mb-2 truncate text-[14px] tracking-[0.04em] text-muted-foreground">
                    {drafts.length > 1 ? `Draft ${step - 1} of ${drafts.length} · ` : ""}
                    {draft?.name}
                  </p>
                )}
                <h1 className="type-caption text-[30px] leading-none">Draft your team</h1>
                <p className="mt-2.5 text-[15px] leading-snug text-muted-foreground">
                  Pick {need} from the {terms.castaways} still in before episode {draftStart}. Your team is your own: anyone can be on it,
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
                          state={before ?? draft?.raw ?? raw}
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

      <footer className="sticky bottom-0 z-10 border-t border-border bg-background px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-3">
        {error && (
          <p role="alert" className="mb-2.5 text-sm font-semibold text-live">
            {error}
          </p>
        )}
        {step === 1 && (
          <div className="mb-3 min-h-[42px] text-[15px] leading-snug" aria-live="polite">
            {watched === null ? (
              <p className="text-muted-foreground">Tap the last episode you&rsquo;ve finished.</p>
            ) : reused ? (
              <p>
                <span className="text-muted-foreground">
                  Same as in {reused.name}: {saidWatched ? saidWatched.charAt(0).toLowerCase() + saidWatched.slice(1, -1) : ""}.
                </span>{" "}
                <span className="font-semibold">{startsAt}</span>
              </p>
            ) : (
              <>
                <p className="text-muted-foreground">{saidWatched}</p>
                <p className="font-semibold">
                  {startsAt}
                  {spoiled && <span className="font-normal text-live"> That shows you the results of {spoiledText}.</span>}
                  {!override && natural !== null && natural - 1 > watched && natural !== live && (
                    <span className="font-normal text-muted-foreground"> This league starts there.</span>
                  )}
                </p>
              </>
            )}
          </div>
        )}
        {step === 2 && (
          <p className="mb-2 text-sm text-muted-foreground" aria-live="polite">
            {picked.length} of {need} picked
          </p>
        )}
        <PrimaryButton
          className="min-h-[52px] w-full text-base"
          disabled={!canNext || busy}
          onClick={last ? begin : async () => (step > 1 || (await spoilsOk())) && go(step + 1)}
        >
          {busy
            ? "Starting…"
            : step === 1 && start === null
              ? "Choose an episode"
              : !last
                ? drafts.length > 1
                  ? `Next: draft for ${drafts[step - 1].name}`
                  : "Next: draft your team"
                : start === live
                  ? "Join live"
                  : `Start at episode ${start}`}
        </PrimaryButton>
        {step === 1 && watched !== null && !elsewhere && natural !== live && (
          <button
            type="button"
            onClick={() => setElsewhere(true)}
            className="mx-auto mt-1 flex min-h-11 items-center px-3 text-[15px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-3 focus-visible:outline-chyron-line"
          >
            Start somewhere else
          </button>
        )}
      </footer>
    </div>
  );
}

interface GroupLeague {
  id: string;
  name: string;
  raw: LeagueState;
}

// Where an answer starts them in one league: the same episode, unless that league's own first episode
// is later (it starts there) or it hasn't reached it (they join it live).
function startIn(raw: LeagueState, start: number): number {
  const choices = StateLogic.GhostLogic.startChoices(raw) as number[];
  return choices.find((n) => n >= start) ?? choices[choices.length - 1];
}

// How many they draft there: the roster, or everyone left late in a season.
function needFor(raw: LeagueState, start: number | null): number {
  if (start === null) return 0;
  return Math.min(StateLogic.GhostLogic.teamSize(raw), StateLogic.GhostLogic.draftPool(raw, start).length);
}

// The season as a strip: "None yet", each aired episode, and the latest as "All N". Tapping a row
// answers "I've finished up to here": the rows up to it fill in as watched along a track, and the next
// one carries the "You start here" tag.
function SeasonStrip({
  latest,
  watched,
  start,
  live,
  onAnswer,
}: {
  latest: number;
  watched: number | null;
  start: number | null;
  live: number;
  onAnswer: (w: number) => void;
}) {
  const rows = Array.from({ length: latest + 1 }, (_, i) => i);
  const filled = (i: number) => watched !== null && i >= 1 && i <= watched;
  return (
    <div role="radiogroup" aria-label="The last episode you've finished" className="mt-5 flex flex-col">
      {rows.map((i) => {
        const on = watched === i;
        const startsHere = start !== null && start === i && start !== live;
        const label = i === 0 ? "None yet" : i === latest ? `All ${latest}` : `Episode ${i}`;
        const sub = i === latest ? "Up to date · join live" : null;
        const aria =
          i === 0
            ? "None yet. Start at episode 1"
            : i === latest
              ? `All ${latest}, up to date. Join live`
              : `Watched through episode ${i}. Start at episode ${i + 1}`;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={aria}
            onClick={() => onAnswer(i)}
            className={cn(
              "group relative flex min-h-14 items-center gap-3 rounded-[3px] pr-3 text-left outline-none transition-colors focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line",
              on ? "bg-plate text-plate-foreground shadow-plate" : "hover:bg-accent/50",
            )}
          >
            {/* The track: a line through the rows they've watched, a dot per row. */}
            <span aria-hidden className="relative flex w-10 shrink-0 justify-center self-stretch">
              {i > 0 && (
                <span
                  className={cn(
                    "absolute left-1/2 top-0 h-1/2 w-[2px] -translate-x-1/2",
                    filled(i) && filled(i - 1) ? (on ? "bg-plate-foreground" : "bg-foreground") : "bg-border",
                  )}
                />
              )}
              {i < latest && (
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-1/2 w-[2px] -translate-x-1/2",
                    filled(i) && filled(i + 1) ? (on ? "bg-plate-foreground" : "bg-foreground") : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative my-auto rounded-full transition-all duration-200",
                  filled(i) || (on && i === 0)
                    ? cn("size-3", on ? "bg-plate-foreground" : "bg-foreground")
                    : startsHere
                      ? "size-3.5 border-[3px] border-chyron-line bg-background"
                      : "size-2.5 border-2 border-input bg-background",
                )}
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col py-2">
              <span className={cn("type-caption text-[19px] leading-tight", !on && !filled(i) && !startsHere && "text-muted-foreground")}>
                {label}
              </span>
              {sub && <span className={cn("text-[13px]", on ? "text-plate-muted" : "text-muted-foreground")}>{sub}</span>}
            </span>
            {filled(i) && (
              <span className={cn("flex shrink-0 items-center gap-1 text-[13px] font-semibold", on ? "text-plate-muted" : "text-muted-foreground")}>
                <Check className="size-4" strokeWidth={2.8} aria-hidden />
                Watched
              </span>
            )}
            {startsHere && (
              <span className="type-caption shrink-0 bg-chyron px-2.5 py-1 text-[13px] tracking-[0.04em] text-chyron-foreground" aria-hidden>
                You start here
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// The deliberate way to start past what you've watched: every start the league allows, the ones
// you've watched marked, and the cost said on the row before you choose it.
function StartElsewhere({
  choices,
  live,
  watched,
  start,
  onPick,
  onBack,
}: {
  choices: number[];
  live: number;
  watched: number;
  start: number | null;
  onPick: (n: number) => void;
  onBack: () => void;
}) {
  return (
    <>
      <h1 className="type-caption text-balance text-[30px] leading-none">Where do you want to start?</h1>
      <p className="mt-2.5 text-pretty text-[16px] leading-snug">
        Starting after episode {watched + 1} shows you results you haven&rsquo;t watched.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-1 flex min-h-11 items-center gap-1 self-start text-[15px] font-semibold text-chyron-line underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-chyron-line"
      >
        <ChevronLeft className="size-4" strokeWidth={2.6} aria-hidden />
        Back to what I&rsquo;ve watched
      </button>
      <div role="radiogroup" aria-label="Start episode" className="mt-3 flex flex-col">
        {choices.map((n) => {
          const on = start === n;
          const seen = n <= watched;
          const spoils = n - 1 > watched;
          const label = n === live ? "Join live" : `Episode ${n}`;
          const sub = seen
            ? "Watched already"
            : !spoils
              ? "The first one you haven't watched"
              : n - 1 === watched + 1
                ? `Shows you episode ${watched + 1}`
                : `Shows you episodes ${watched + 1} to ${n - 1}`;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(n)}
              className={cn(
                "flex min-h-14 items-center gap-3 border-b border-border px-3 text-left outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-chyron-line",
                on && "rounded-[3px] border-transparent bg-plate text-plate-foreground shadow-plate",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col py-2">
                <span className={cn("type-caption text-[19px] leading-tight", !on && seen && "text-muted-foreground")}>{label}</span>
                <span className={cn("text-[13px]", on ? "text-plate-muted" : spoils ? "text-live" : "text-muted-foreground")}>{sub}</span>
              </span>
              {on && (
                <span className="type-caption shrink-0 bg-chyron px-2.5 py-1 text-[13px] tracking-[0.04em] text-chyron-foreground" aria-hidden>
                  You start here
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
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
