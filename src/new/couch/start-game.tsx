"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bell, Bot, Check, ChevronRight, Plus, Radio, RotateCcw, Sparkles, Trophy, Users } from "lucide-react";
import { airTime, calmWhen } from "../clock";
import { LEVEL_WORDS, type BotLevel } from "@/lib/game/computer-players";
import { spanName } from "@/lib/game/spans";
import { gamesApi, useAfterReveal, useCurrentCouch, useHome, useStartOptions, useWizardOptions, type HomeShow, type StartChoice, type StartOptions } from "../data";
import { gameColour } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import { keepToPath, PracticeFinish, PracticeStrip, said, shake, useNudge } from "../tour/practice";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { openCouchSheet } from "./couch-sheets";
import { setReopen, WizardSheet, type Screen } from "./start-wizard";

// Start a game (docs/PLAN-new-design.md step 10 part 2b; the mock's rulebook.js newGameW and hubplus.js startGamePicker),
// opened from anywhere signed in with openStartGame:
//   - with a season: the games that fit that show (start-game.ts: rulebook-fits.js gamesFor), the kind's first recommended,
//     each in a line in the show's own words ("Draft five drivers, start three each race"); what doesn't fit, in a line; a
//     talk show's Weekly Bingo (step 12 part 3: a card a show, bingo.tsx) and Weekly Calls (part 2: two calls a show); How long
//     (docs/PLAN-sports-data.md step 6, spans.ts: the rest of the season, just the next one, this series for a sport, or
//     through any later episode the listing has); Starts (step A3 of docs/PLAN-start-a-game-gpt.md: with the next episode, or any
//     later listed one: it waits until then); Computer players (none to three, at one level, in the drafts and Survival
//     Pool: computer-players.ts; Backstage › Members adds more or takes them out); Include it (an episode on now: the game
//     starts there, its lineups and picks open past its start, Backstage › Settings' lock on Override); Tell the couch (one
//     alert, on by default); Start it.
//   - without one (the hub's foot, Commercial break, Get the couch going with nothing to suggest): Pick the show first, from
//     your shows still airing; one that isn't a game yet goes to Make it a game.
//   - `again` (Run it back): the same game, its name and settings, on the show's next season.
// Starting it takes you to the show's Games tab, where the couch joins it.
//   - `practice` (the first-time tour's, docs/PLAN-first-time-tour.md version 2): the same sheets with a Practice strip, the show
//     the tour practice-added first in Pick the show, a moment "getting its rules" (they're in already: the user wants the bot's
//     wait felt, briefly), the Prediction Sheet chosen, and Start it ending in the practice finish: nothing is started.
// Under the games, Create a game with AI, coming soon (the user, 2026-11-01; docs/PLAN-start-a-game-gpt.md).

/** The tour's practice: the show to offer first (the one it practice-added; not on your list), and what to do once it closes. */
export type StartPractice = { seasonId: string | null; label: string | null; artUrl: string | null; onClose: () => void };

export type StartTarget = {
  seasonId?: string | null;
  couchId?: string | null;
  again?: string | null;
  practice?: StartPractice;
  /** The wizard's screen to open on (an AI wait's See it: "ask" or "moments"). */
  screen?: Screen;
};

type Store = { target: StartTarget | null; n: number };
let store: Store = { target: null, n: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const SERVER: Store = { target: null, n: 0 };

/** Open Start a game: for a season, or Pick the show first. */
export function openStartGame(target: StartTarget = {}) {
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

function useStartTarget(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
    () => SERVER
  );
}

/** The sheets' host, in the signed-in layout. */
export function StartGameSheets() {
  const { target, n } = useStartTarget();
  const onOpenChange = (o: boolean) => {
    if (o) return;
    const practice = target?.practice;
    close();
    practice?.onClose();
  };
  // An AI wait's See it reopens the wizard on its screen (start-wizard.tsx).
  useEffect(() => {
    setReopen((seasonId, couchId, screen) => openStartGame({ seasonId, couchId, screen }));
    return () => setReopen(null);
  }, []);
  return (
    <>
      <PickShowSheet key={`pick-${n}`} open={!!target && !target.seasonId} couchId={target?.couchId ?? null} practice={target?.practice} onOpenChange={onOpenChange} />
      <StartRouter key={`start-${n}`} target={target?.seasonId ? target : null} onOpenChange={onOpenChange} />
    </>
  );
}

/**
 * Which Start a game a season gets (docs/PLAN-start-a-game-gpt.md U1): the wizard (start-wizard.tsx) for every season with an
 * episode still to air, and for a show that isn't a game yet (it chains Make it a game); today's list for Run it back and a season
 * that's aired (at your own pace: Starts' where you are and from the top), until the wizard takes them (BACKLOG 42).
 */
function StartRouter({ target: asked, onOpenChange }: { target: StartTarget | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const current = useCurrentCouch(home);
  const [shown, setShown] = useState(asked);
  if (asked && asked !== shown) setShown(asked);
  const target = asked ?? shown;
  const couchId = target?.couchId ?? current?.id ?? null;
  const [late, setLate] = useState(false);
  const wizardWanted = !!target?.seasonId && !target.again;
  const wiz = useWizardOptions(target?.seasonId ?? null, couchId, wizardWanted, late);
  const list = !!target?.again || (wizardWanted && !!wiz.data && !wiz.data.wizard && !wiz.data.blocked);
  if (list || !target) return <StartSheet target={asked} onOpenChange={onOpenChange} />;
  return (
    <WizardSheet
      open={!!asked}
      onOpenChange={onOpenChange}
      o={wiz.data}
      loading={wiz.isLoading || (wiz.isPlaceholderData && wiz.isFetching)}
      error={(wiz.error as Error | null) ?? null}
      couchId={couchId}
      practice={target.practice ? { seasonId: target.practice.seasonId, label: target.practice.label, onClose: target.practice.onClose } : undefined}
      late={late}
      setLate={setLate}
      first={target.screen}
    />
  );
}

/** "Survivor 51". */
const labelOf = (s: HomeShow) => `${s.show.name.replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Pick the show (the mock's startGamePicker): your shows still to finish, soonest first; how many games the couch has on each. In
 *  the tour's practice, the show it practice-added comes first. */
function PickShowSheet({ open, couchId, practice, onOpenChange }: { open: boolean; couchId: string | null; practice?: StartPractice; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const nav = useNav();
  const shows = (home?.shows ?? [])
    .filter((s) => (s.following || s.games.length) && s.status !== "completed" && s.release !== "binge")
    .sort((a, b) => (a.upNext?.airAt ? Date.parse(a.upNext.airAt) : Infinity) - (b.upNext?.airAt ? Date.parse(b.upNext.airAt) : Infinity));
  const practiceShow = practice?.seasonId && !shows.some((s) => s.seasonId === practice.seasonId) ? practice : null;
  // The tour's practice is on its own show: another one tapped shakes that row instead (the tour shows what to tap: the user,
  // 2026-11-01, picked their own show and got a sheet the tour's words didn't match).
  const practiceRow = useRef<HTMLButtonElement>(null);
  const toPractice = () => {
    shake(practiceRow.current);
    toast.quiet(`For practice, pick ${practiceShow?.label ?? "the one you just added"}`);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle="Pick the show">
      <div data-start-pick className="flex flex-col pb-2">
        {practice && <PracticeStrip />}
        {practiceShow && (
          <button
            ref={practiceRow}
            type="button"
            data-pick-show={practiceShow.seasonId}
            data-pick-practice
            onClick={() => openStartGame({ seasonId: practiceShow.seasonId, couchId, practice })}
            className="nd-press relative z-[1] flex min-h-[72px] w-full items-center gap-3 rounded-[3px] px-2 py-2 text-left outline-2 outline-offset-2 outline-foreground"
          >
            <ShowArt seasonId={`pick-${practiceShow.seasonId}`} artUrl={practiceShow.artUrl} name={practiceShow.label ?? ""} className="size-14 flex-none rounded-[3px] text-[14px]" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-semibold">{practiceShow.label}</b>
              <small className="block text-[13px] text-muted-foreground">The one you just added · practice</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        )}
        {shows.length || practiceShow ? (
          shows.map((s) => {
            const have = (couch?.games ?? []).filter((g) => g.seasonId === s.seasonId && !g.archived).length;
            const ready = s.ready !== false;
            return (
              <button
                key={s.seasonId}
                type="button"
                data-pick-show={s.seasonId}
                onClick={() => {
                  if (practiceShow) toPractice();
                  else if (ready) openStartGame({ seasonId: s.seasonId, couchId, practice });
                  // The tour's practice stays in its sheets: Make it a game would really ask the bot.
                  else if (practice) toast.quiet("For practice, pick a show that's a game already");
                  else {
                    close();
                    nav.push(`${paths.show(s.seasonId, "games")}?page=make&then=start${couchId ? `&couch=${couchId}` : ""}`);
                  }
                }}
                className="nd-press flex min-h-[72px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0"
              >
                <ShowArt seasonId={`pick-${s.seasonId}`} artUrl={s.show.artUrl} name={labelOf(s)} className="size-14 flex-none rounded-[3px] text-[14px]" />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[16px] font-semibold">{s.show.name}</b>
                  <small className="block text-[13px] text-muted-foreground">
                    {[
                      s.seasonNumber ? `Season ${s.seasonNumber}` : null,
                      !ready ? "Not a game yet · Make it a game" : have ? `${have} ${have === 1 ? "game" : "games"} already` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
              </button>
            );
          })
        ) : (
          <p className="py-3 text-sm leading-normal text-muted-foreground">Add the shows you watch first: games start on a show.</p>
        )}
      </div>
    </Sheet>
  );
}

/** Each game's colour (games.ts GAME_STYLE: Weekly Calls the predictions pink, Weekly Bingo the mock's purple; never the yellow,
 *  which is only for what you must do). */
const dotOf = (g: StartChoice) => gameColour(g.name);

/** "Episode 6", "Race 19". */
const partAt = (o: StartOptions) => `${o.part.singular.replace(/^./, (c) => c.toUpperCase())} ${o.from}`;

function StartSheet({ target: asked, onOpenChange }: { target: StartTarget | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const current = useCurrentCouch(home);
  // The last one asked about, kept while the sheet slides away.
  const [shown, setShown] = useState(asked);
  if (asked && asked !== shown) setShown(asked);
  const target = asked ?? shown;
  const couchId = target?.couchId ?? current?.id ?? null;
  const practice = target?.practice;
  // The tour's practice show: its rules are in already, but the wait for them is shown, long enough to read (the user, 2026-11-01).
  // A pause, not a movement: reduced motion keeps it (its spinner stands still).
  const [warming, setWarming] = useState(!!practice?.seasonId && target?.seasonId === practice.seasonId);
  useEffect(() => {
    if (!warming) return;
    const t = setTimeout(() => setWarming(false), 2000);
    return () => clearTimeout(t);
  }, [warming]);
  // The practice's finish: the game it would have started.
  const [practiced, setPracticed] = useState<string | null>(null);
  // Include it: the options again from the episode on now (its spans, How long), when there is one. Starts: from a later
  // listed episode instead (null: the next to air), the options again from there.
  const [late, setLate] = useState(false);
  const [startAt, setStartAt] = useState<number | null>(null);
  // Or when a phase of the season starts (step A3): its id; undefined until chosen (Run it back starts where it did).
  const [phaseChosen, setPhase] = useState<string | null | undefined>(undefined);
  const opts = useStartOptions(target?.seasonId ?? null, couchId, target?.again ?? null, !!target, late, startAt);
  const o = opts.data;
  const nav = useNav();
  const pathname = usePathname();
  const refresh = useAfterReveal();
  const fits = (o?.games ?? []).filter((g) => g.fits);
  const startable = fits.filter((g) => !g.soon);
  const [picked, setPicked] = useState<string | null>(null);
  // The last episode it plays: null to the season's end (the default); Run it back on a span starts on the next one.
  const [toPicked, setTo] = useState<number | null | undefined>(undefined);
  const to = toPicked !== undefined ? toPicked : (o?.again?.to ?? null);
  const [tell, setTell] = useState(true);
  const [bots, setBots] = useState(0);
  const [level, setLevel] = useState<BotLevel>("normal");
  // A Prediction Sheet's questions (step A4 part 2 of docs/PLAN-start-a-game-gpt.md): the ones switched on (null: the defaults).
  const [asks, setAsks] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The tour's practice makes a Prediction Sheet (the easiest to start: the user, 2026-11-01) where the show has one.
  const pick = picked ?? o?.again?.key ?? (practice && startable.some((g) => g.key === "questions") ? "questions" : startable[0]?.key) ?? null;
  const phaseId = late ? null : phaseChosen !== undefined ? phaseChosen : (o?.again?.phase ?? null);
  const phase = (phaseId && o?.phases.find((p) => p.id === phaseId)) || null;
  const me = home?.user.name ?? "you";
  const botsHere = !!fits.find((g) => g.key === pick)?.bots;
  const again = o?.again;
  const sheet = pick === "questions";
  // The season's questions (who wins) only in a game to the season's end: a phase start runs to it, How long may not.
  const toEnd = !!phase || to === null;
  // Run it back asks what it asked; else the ones on by default.
  const askOn = (asks ?? (again?.key === "questions" && again.questions?.length ? again.questions : (o?.questions ?? []).filter((q) => q.on).map((q) => q.id))).filter(
    (id) => toEnd || !o?.questions.find((q) => q.id === id)?.season
  );

  const start = async () => {
    if (!o || !couchId || !pick) return;
    // The tour's practice starts nothing: its finish stands in.
    if (practice) return setPracticed(fits.find((g) => g.key === pick)?.name ?? "Your game");
    setBusy(true);
    try {
      const r = await gamesApi.start(o.seasonId, couchId, {
        game: pick,
        tell,
        again: target?.again ?? null,
        // The start you chose, not the options on screen (they may still be the last start's while they reload); a phase runs to
        // the season's end.
        ...(phase ? { phase: phase.id } : !late && startAt !== null ? { from: startAt } : {}),
        ...(phase ? {} : { to }),
        ...(botsHere && bots ? { bots, level } : {}),
        ...(sheet ? { questions: askOn } : {}),
        ...(late && o.late ? { late: true } : {}),
      });
      await refresh();
      toast(`${r.gameName} started${r.told ? " · the couch has been told" : ""}`);
      close();
      const games = paths.show(o.seasonId, "games");
      if (pathname !== games) nav.push(games);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Start it, in the sheet's foot: in sight however long the options run (the user, 2026-11-01).
  const go =
    !practiced && !warming && couchId && !opts.error && o && !o.blocked ? (
      <Btn
        tone="must"
        wide
        data-start-go
        // Not while the options reload for a new start (Include it, Starts): what's on screen is still the last one's.
        disabled={busy || opts.isPlaceholderData || !pick || !startable.some((g) => g.key === pick) || (sheet && !askOn.length)}
        onClick={start}
      >
        {again ? <RotateCcw className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
        {busy ? "Starting…" : startable.length ? "Start it" : "Coming soon"}
      </Btn>
    ) : null;
  // The practice: down the options to their end, then Start it shakes (the user, 2026-11-01: "scroll down then shake Start it").
  useNudge(!!practice && !!go, "[data-start-go]", "[data-start-sheet]");

  return (
    <Sheet
      open={!!asked}
      onOpenChange={onOpenChange}
      foot={go}
      title={practiced ? "That's how a game starts" : again ? "Run it back" : "Start a game"}
      subtitle={
        practiced
          ? "Practice run"
          : o
            ? again
              ? `${o.label}${to === null ? "" : ` · ${spanName(o.from, to, o.part)}`} · the same ${again.gameName} as ${again.label}`
              : o.pace && !o.starts.length
                ? `${o.label} · all ${o.pace.aired} ${o.part.plural} are out`
                : `${o.show} · ${phase ? `when ${phase.name} starts` : to === null ? `from ${partAt(o)}` : spanName(o.from, to, o.part)}${o.ownPace ? ", at your own pace" : ""}`
            : undefined
      }
    >
      <div
        data-start-sheet={practiced ? "practiced" : warming ? "warming" : (o?.kind ?? "loading")}
        // The practice's one path: the Prediction Sheet's chosen, so only Start it (the sheet's foot) goes on; what's chosen
        // here isn't yellow, since it can't be changed (new.css).
        data-practice-path={practice && !practiced ? "" : undefined}
        onClickCapture={keepToPath(
          practice && !practiced && !warming ? { on: "[data-start-go]", next: () => document.querySelector("[role=dialog][data-open] [data-start-go]"), word: "Practice: just tap Start it" } : null
        )}
        className="flex flex-col gap-2 pb-2"
      >
        {practice && !practiced && <PracticeStrip />}
        {practiced ? (
          <PracticeFinish line={`${practiced}${o ? ` for ${said(o.show)}` : ""} isn't saved: this was just to show you how.`} onDone={() => onOpenChange(false)}>
            <ComingSoonAI />
          </PracticeFinish>
        ) : warming ? (
          <div data-start-warming className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-[4px] bg-secondary/60 p-4 text-center" aria-busy>
            <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent motion-reduce:animate-none" aria-hidden />
            <span className="text-[15px] font-semibold">Getting {practice?.label ?? "the show"}&rsquo;s rules&hellip;</span>
          </div>
        ) : !couchId ? (
          <>
            <p className="text-[15px] leading-snug text-muted-foreground">Games are played on a couch. Start one and send the code, or join one with a code.</p>
            {!practice && (
              <Btn tone="must" wide onClick={() => openCouchSheet({ kind: "new" })}>
                <Users className="size-5" aria-hidden />
                Start a couch
              </Btn>
            )}
          </>
        ) : opts.error ? (
          <p className="text-[15px] text-muted-foreground">{(opts.error as Error).message}</p>
        ) : !o ? (
          <div aria-busy className="h-48 animate-pulse rounded-[4px] bg-secondary" />
        ) : o.blocked ? (
          <>
            <p data-start-blocked className="text-[15px] leading-snug text-muted-foreground">
              {o.blocked}.
            </p>
            {/Make .* a game first/.test(o.blocked) && (
              <Btn
                tone="must"
                wide
                onClick={() => {
                  close();
                  nav.push(`${paths.show(o.seasonId, "games")}?page=make&then=start`);
                }}
              >
                Make it a game
              </Btn>
            )}
          </>
        ) : (
          <>
            {fits.map((g, i) => {
              const on = g.key === pick;
              return (
                <button
                  key={g.key}
                  type="button"
                  data-start-game={g.key}
                  aria-pressed={on}
                  disabled={!!g.soon}
                  onClick={() => setPicked(g.key)}
                  className={`flex w-full items-start gap-3 rounded-[4px] p-3 text-left disabled:opacity-60 ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
                >
                  <i className="mt-[5px] size-3 flex-none rounded-full" style={{ background: dotOf(g) }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[16px]">
                      {g.name}
                      {i === 0 && fits.length > 1 && !g.soon && <span className={on ? "text-plate-muted" : "text-muted-foreground"}> · Recommended</span>}
                    </b>
                    <small className={`block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>
                      {g.soon ? `${g.line}. Comes with this week's episode games, soon` : g.line}
                    </small>
                  </span>
                </button>
              );
            })}
            {o.noFit && (
              <p data-no-fit className="flex items-start gap-2.5 py-1 text-[13px] leading-snug text-muted-foreground">
                <Trophy className="mt-px size-4 flex-none" aria-hidden />
                <span>{o.noFit}</span>
              </p>
            )}
            {!again && !o.ownPace && <ComingSoonAI />}
            {startable.length > 0 && o.onAir && (
              <button
                type="button"
                role="switch"
                aria-checked={late}
                data-start-late={late ? "on" : "off"}
                onClick={() => {
                  setLate(!late);
                  setStartAt(null);
                  setPhase(null);
                  setTo(undefined);
                }}
                className="flex min-h-[64px] w-full items-center gap-3 border-t border-border pt-2 text-left"
              >
                <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-live">
                  <Radio className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">
                    Include {o.part.singular.replace(/^./, (c) => c.toUpperCase())} {o.onAir.number} · on now
                  </b>
                  <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    It started {airTime(Date.parse(o.onAir.airAt))}. Picks stay open past the start, on the honour system, until you lock them in Backstage or its results are in.
                  </small>
                </span>
                <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${late ? "bg-chyron" : "bg-secondary"}`}>
                  <i className={`absolute top-[3px] size-6 rounded-full bg-foreground transition-[left] ${late ? "left-[25px]" : "left-[3px]"}`} />
                </span>
              </button>
            )}
            {startable.length > 0 && !o.late && (o.starts.length > 1 || o.phases.length > 0 || (!!o.pace && (o.starts.length === 0 || o.pace.here !== null))) && (
              <Starts
                o={o}
                phase={phase?.id ?? null}
                setAt={(n) => {
                  setStartAt(n);
                  setPhase(null);
                  setTo(undefined);
                }}
                setPhase={(id) => {
                  setPhase(id);
                  setStartAt(null);
                  setTo(undefined);
                }}
              />
            )}
            {/* At your own pace it's the rest of the season: a span on a rewatch is an edge nobody casual needs (the mock). */}
            {startable.length > 0 && !phase && !o.ownPace && (o.spans.length > 1 || o.ends.length > 0) && <HowLong o={o} to={to} setTo={setTo} />}
            {botsHere && <Computers n={bots} setN={setBots} level={level} setLevel={setLevel} />}
            {sheet && <SheetQuestions o={o} on={askOn} toEnd={toEnd} setOn={setAsks} />}
            {startable.length > 0 && (
              <button
                type="button"
                role="switch"
                aria-checked={tell}
                data-start-tell={tell ? "on" : "off"}
                onClick={() => setTell(!tell)}
                className="flex min-h-[64px] w-full items-center gap-3 border-t border-border pt-2 text-left"
              >
                <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
                  <Bell className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-semibold">Tell the couch</b>
                  <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                    One alert: &ldquo;{me} started a game for {o.show} · Join&rdquo;.
                    {o.watchers.length ? ` ${names(o.watchers)} ${o.watchers.length === 1 ? "watches" : "watch"} it.` : ""}
                  </small>
                </span>
                <span aria-hidden className={`relative h-[30px] w-[52px] flex-none rounded-full transition-colors ${tell ? "bg-chyron" : "bg-secondary"}`}>
                  <i className={`absolute top-[3px] size-6 rounded-full bg-foreground transition-[left] ${tell ? "left-[25px]" : "left-[3px]"}`} />
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "Sat, Nov 22": a later episode's day, weeks out, where a weekday alone wouldn't say which. */
const dateOf = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** "Game 6: Rays at Brewers" when its title says which, else "Episode 6 · its title" (or nothing more). */
const episodeLine = (o: StartOptions, e: { number: number; title: string | null }) => {
  const P = o.part.singular.replace(/^./, (c) => c.toUpperCase());
  return e.title?.toLowerCase().startsWith(`${o.part.singular} ${e.number}`) ? e.title : `${P} ${e.number}${e.title ? ` · ${e.title}` : ""}`;
};

/** What you've seen, so nobody has to remember it: "You haven't watched any yet.", "You've seen 1 and 2.", "You've seen 1 to 6." */
const seenWords = (n: number, P: string) =>
  n <= 0 ? "You haven't watched any yet." : n === 1 ? `You've seen ${P} 1.` : n === 2 ? "You've seen 1 and 2." : `You've seen 1 to ${n}.`;

/**
 * Where the game starts (docs/PLAN-start-a-game-gpt.md step A3): with the next episode to air, when a phase of the season still to
 * come starts (each with its summary, and the episode once that's known), or any later episode the listing has, from a list. It
 * waits until then (nothing before it counts), and its draft can happen first. A phase start runs to the season's end.
 */
function Starts({ o, phase, setAt, setPhase }: { o: StartOptions; phase: string | null; setAt: (n: number | null) => void; setPhase: (id: string) => void }) {
  const P = o.part.singular.replace(/^./, (c) => c.toUpperCase());
  const chosen = o.phases.find((p) => p.id === phase) ?? null;
  const tile = (on: boolean) => `flex min-h-[52px] w-full flex-col justify-center rounded-[4px] px-3 py-2 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`;
  const sub = (on: boolean) => `block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`;
  // A game at your own pace (docs/PLAN-own-pace-games.md): where you are, or the top. On a finished season those are the only
  // starts; on one you're behind on, where you are sits under the live starts.
  const pace = o.pace;
  const finished = !!pace && o.starts.length === 0;
  const paceTiles = pace && (finished || pace.here !== null) && (
    <>
      {pace.here !== null && (
        <button type="button" role="radio" aria-checked={o.ownPace && o.from === pace.here} data-start-from-choice="here" onClick={() => setAt(pace.here)} className={tile(o.ownPace && o.from === pace.here)}>
          <b className="block text-[15px]">
            {P} {pace.here}
            {pace.here === 1 && finished ? "" : " · where you are"}
          </b>
          <small className={sub(o.ownPace && o.from === pace.here)}>
            {seenWords(pace.here - 1, P)}
            {finished ? "" : " Catch up one at a time, then play live with everyone."}
          </small>
        </button>
      )}
      {finished && pace.here !== 1 && (
        <button type="button" role="radio" aria-checked={o.from === pace.top} data-start-from-choice="top" onClick={() => setAt(pace.top)} className={tile(o.from === pace.top)}>
          <b className="block text-[15px]">
            {P} {pace.top} · from the top
          </b>
          <small className={sub(o.from === pace.top)}>{pace.here === null ? "You've seen it all: a rewatch." : "A rewatch."}</small>
        </button>
      )}
    </>
  );
  if (finished) {
    return (
      <section data-start-from className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3" role="radiogroup" aria-label="Start from">
        <b className="text-[15px] font-semibold">Start from</b>
        {paceTiles}
        <small data-start-pace-line className="text-[13px] leading-snug text-muted-foreground">
          Everyone plays one {o.part.singular} at a time, whenever they watch. Friends who join start wherever they are.
        </small>
      </section>
    );
  }
  const later = !phase && !o.ownPace && o.from !== o.nextEpisode;
  const first = o.starts[0];
  return (
    <section data-start-from className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3" role="radiogroup" aria-label="Starts">
      <b className="text-[15px] font-semibold">Starts</b>
      <button
        type="button"
        role="radio"
        aria-checked={!later && !chosen && !o.ownPace}
        data-start-from-choice="next"
        onClick={() => setAt(null)}
        className={tile(!later && !chosen && !o.ownPace)}
      >
        <b className="block text-[15px]">
          With the next one · {P} {o.nextEpisode}
        </b>
        <small className={`truncate ${sub(!later && !chosen && !o.ownPace)}`}>
          {first?.airAt ? calmWhen(Date.parse(first.airAt)) : `The next ${o.part.singular} to air`}
        </small>
      </button>
      {o.phases.map((p) => {
        const on = p.id === phase;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-start-from-choice={`phase:${p.id}`}
            onClick={() => setPhase(p.id)}
            className={`flex min-h-[52px] w-full flex-col justify-center rounded-[4px] px-3 py-2 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
          >
            <b className="block text-[15px]">
              When {p.name} starts{p.at !== null ? ` · ${P} ${p.at}` : ""}
            </b>
            {p.summary && <small className={`block text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>{p.summary}</small>}
          </button>
        );
      })}
      <label
        data-start-from-choice="later"
        className={`flex min-h-[52px] w-full items-center gap-2 rounded-[4px] px-3 py-2 ${later ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
      >
        <b className="flex-none text-[15px]">Later</b>
        <select
          data-start-from-later
          value={later ? String(o.from) : ""}
          onChange={(e) => setAt(e.target.value ? Number(e.target.value) : null)}
          className="min-w-0 flex-1 truncate rounded-[3px] bg-transparent py-1.5 text-[15px] font-semibold outline-none"
        >
          <option value="">A later {o.part.singular}…</option>
          {o.starts.slice(1).map((e) => (
            <option key={e.number} value={e.number}>
              {episodeLine(o, e)}
              {e.airAt ? ` · ${dateOf(Date.parse(e.airAt))}` : ""}
            </option>
          ))}
        </select>
      </label>
      {paceTiles}
      {later && (
        <small data-start-from-note className="text-[13px] leading-snug text-muted-foreground">
          It waits for {P} {o.from}: nothing before it counts, and the draft can happen any time before then.
        </small>
      )}
      {chosen && (
        <small data-start-from-note className="text-[13px] leading-snug text-muted-foreground">
          {chosen.at !== null
            ? `It waits for ${chosen.name}, from ${P} ${chosen.at}: nothing before it counts, and the draft can happen any time before then. It runs to the season's end.`
            : `It waits for ${chosen.name} to start, then plays from the first ${o.part.singular} it can: nothing before then counts, and the draft can happen any time before. It runs to the season's end.`}
        </small>
      )}
    </section>
  );
}

/**
 * How long the game runs (spans.ts): the rest of the season, just the next one, this series (a sport's games between the same
 * teams), or through any later episode the listing has, from a list. Nothing after its last one scores.
 */
function HowLong({ o, to, setTo }: { o: StartOptions; to: number | null; setTo: (to: number | null) => void }) {
  const preset = o.spans.some((sp) => sp.to === to);
  return (
    <section data-start-span className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3" role="radiogroup" aria-label="How long">
      <b className="text-[15px] font-semibold">How long</b>
      {o.spans.map((sp) => {
        const on = sp.to === to;
        return (
          <button
            key={sp.kind}
            type="button"
            role="radio"
            aria-checked={on}
            data-start-span-choice={sp.kind}
            onClick={() => setTo(sp.to)}
            className={`flex min-h-[52px] w-full flex-col justify-center rounded-[4px] px-3 py-2 text-left ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
          >
            <b className="block text-[15px]">{sp.label}</b>
            <small className={`block truncate text-[13px] leading-snug ${on ? "text-plate-muted" : "text-muted-foreground"}`}>{sp.line}</small>
          </button>
        );
      })}
      {o.ends.length > 0 && (
        <label
          data-start-span-choice="through"
          className={`flex min-h-[52px] w-full items-center gap-2 rounded-[4px] px-3 py-2 ${!preset ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
        >
          <b className="flex-none text-[15px]">Through</b>
          <select
            data-start-span-through
            value={!preset && to !== null ? String(to) : ""}
            onChange={(e) => setTo(e.target.value ? Number(e.target.value) : null)}
            className="min-w-0 flex-1 truncate rounded-[3px] bg-transparent py-1.5 text-[15px] font-semibold outline-none"
          >
            <option value="">A later {o.part.singular}…</option>
            {o.ends.map((e) => (
              <option key={e.number} value={e.number}>
                {episodeLine(o, e)}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

/**
 * A Prediction Sheet's questions (step A4 part 2 of docs/PLAN-start-a-game-gpt.md): what the show's moments can ask, each settled by
 * its results, the recommended ones on. A tap switches one; at least one stays. The season's (who wins) need a game that runs to
 * the season's end. Backstage › Game settings changes them until the game starts.
 */
function SheetQuestions({ o, on, toEnd, setOn }: { o: StartOptions; on: string[]; toEnd: boolean; setOn: (ids: string[]) => void }) {
  return (
    <section data-start-questions className="mt-1 flex flex-col border-t border-border pt-3" aria-label="The questions">
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[15px] font-semibold">The questions</b>
        <span className="text-[13px] text-muted-foreground">{on.length} on</span>
      </div>
      <small className="mb-1 mt-0.5 text-[13px] leading-snug text-muted-foreground">
        The results settle every one. Each {o.part.singular}&rsquo;s questions lock as it starts, the season&rsquo;s as the game does.
      </small>
      {o.questions.map((q) => {
        const can = toEnd || !q.season;
        const ticked = can && on.includes(q.id);
        return (
          <button
            key={q.id}
            type="button"
            role="checkbox"
            aria-checked={ticked}
            disabled={!can}
            data-start-question={q.id}
            onClick={() => {
              if (ticked && on.length === 1) return toast.quiet("A Prediction Sheet asks at least one question");
              setOn(ticked ? on.filter((x) => x !== q.id) : [...on, q.id]);
            }}
            className="flex min-h-[56px] w-full items-center gap-3 border-t border-border py-2 text-left first-of-type:border-t-0 disabled:opacity-50"
          >
            <span
              aria-hidden
              className={`grid size-6 flex-none place-items-center rounded-[3px] ${ticked ? "bg-foreground text-background" : "outline-[1.5px] -outline-offset-[1.5px] outline-input"}`}
            >
              {ticked && <Check className="size-4" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold leading-snug">{q.ask}</b>
              <small className="block text-[13px] text-muted-foreground">{can ? q.line : "Only in a game that runs to the season's end"}</small>
            </span>
          </button>
        );
      })}
    </section>
  );
}

/** A row of choices, one picked (the practice couch's level picker's look). */
function Pills<T extends string | number>({ label, value, items, onChange, data }: { label: string; value: T; items: [T, string][]; onChange: (v: T) => void; data: string }) {
  return (
    <div className="grid gap-1 rounded-[3px] bg-secondary/60 p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {items.map(([v, word]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          {...{ [data]: String(v) }}
          className={`h-11 rounded-[2px] text-[15px] font-semibold ${value === v ? "bg-foreground text-background" : ""}`}
        >
          {word}
        </button>
      ))}
    </div>
  );
}

/** Computer players (computer-players.ts): how many fill seats, and how sharp they play. */
function Computers({ n, setN, level, setLevel }: { n: number; setN: (n: number) => void; level: BotLevel; setLevel: (l: BotLevel) => void }) {
  return (
    <section data-start-bots className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3">
      <b className="flex items-center gap-2 text-[15px] font-semibold">
        <Bot className="size-4" aria-hidden />
        Computer players
      </b>
      <small className="text-[13px] leading-snug text-muted-foreground">
        They take seats and make their own moves. Add more or take them out in Backstage, any time but while the draft&rsquo;s open.
      </small>
      <Pills label="How many computer players" value={n} items={[[0, "None"], [1, "1"], [2, "2"], [3, "3"]]} onChange={setN} data="data-start-bots-count" />
      {n > 0 && (
        <Pills
          label="How sharp they play"
          value={level}
          items={(Object.keys(LEVEL_WORDS) as BotLevel[]).map((l) => [l, LEVEL_WORDS[l]])}
          onChange={setLevel}
          data="data-start-bots-level"
        />
      )}
    </section>
  );
}

/** Create a game with AI, coming soon (the user, 2026-11-01; docs/PLAN-start-a-game-gpt.md): what it'll be, nothing to tap yet. */
function ComingSoonAI() {
  return (
    <div data-coming-soon-ai className="flex items-start gap-3 rounded-[4px] p-3 outline-1 -outline-offset-1 outline-dashed outline-input">
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
          Create a game with AI
          <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-muted-foreground">Coming soon</span>
        </b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">Describe the game you want, and AI sets it up for your couch.</small>
      </span>
    </div>
  );
}

/** "riley", "riley and sam", "riley, sam and jordan". */
function names(list: string[]) {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}
