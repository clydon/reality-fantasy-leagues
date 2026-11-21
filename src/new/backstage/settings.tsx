"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, CalendarDays, Check, ChevronRight, KeyRound, Lock, LockOpen, RotateCcw, Trash2 } from "lucide-react";
import { airTime } from "../clock";
import { backstage, gameAdmin, gamesApi, useEndGames, type DeletePreview, type EndGame, type GameSettings, type LockState } from "../data";
import { Choice } from "../manage/choice";
import { spanName } from "@/lib/game/spans";
import { gameColour } from "../games";
import type { ShowData } from "../screens/show-space";
import { HoldSheet } from "../ui/guards";
import { Recommended } from "../ui/recommended";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Stepper } from "./waivers";

// Backstage › Game settings (the mock's settings.js bsSettings, docs/PLAN-new-design.md step 6a): organised by the question
// people have, in plain words, each choice saying what it does, Recommended marked, a dot on anything changed from it and
// "Reset to recommended" beside it. Every change saves at once with Undo on the toast (tier 1) and a line in Recent changes.
// What everyone drafted is fixed once the draft starts: a Weekly Lineup's team size (more starters come off the bench) and
// Outlast's team. Replacing people who leave is the Waivers page. Last, folded away (the mock's details.danger: a toggle): archive or
// delete a game (step 10 part 2b: archive is tier 1 with Undo, delete tier 3 after a hold, restorable for 30 days from Recent
// changes). A Commissioner changes these; a Game admin reads them. Competitive mode (step 15 part 4, the mock's Lock it down):
// one switch for every game you run here; while it's on, nobody new joins and the lineup sizes, Who can join and Scoring rules
// are frozen for the season. First in each game with lineups or picks, its lock (2026-10-27): the icon and label say whether
// this episode's are locked; Auto locks them at its start, Override (whoever runs the game: Commissioner or Game admin) does
// the opposite: open past the start (the honour system, for a couch that sat down late) or locked early. Results lock it for good.

export function useAfter() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["new-design"] });
}

/** The toast's Undo for a change the server logged with a typed undo (Settings Round 3b, rule 6): the same route as Recent changes'
 *  Undo, so it works after a reload too. Null batch: nothing changed, so no Undo. */
export function useServerUndo(seasonId: string, couchId: string | null) {
  const after = useAfter();
  return (batch: string | null | undefined, done = "Undone") =>
    batch && couchId
      ? {
          undo: async () => {
            try {
              await backstage.undo(seasonId, couchId, batch);
              await after();
              toast(done);
            } catch (e) {
              toast.quiet((e as Error).message);
            }
          },
        }
      : undefined;
}

export const Dot = ({ on }: { on: boolean }) => (on ? <i data-changed className="ml-1.5 inline-block size-2 rounded-full bg-chyron-line align-middle" title="Changed from recommended" /> : null);

/** A setting saved at once, with Undo on the toast (tier 1) and a line in Recent changes: Backstage's Game settings and a game's own
 *  (Round 4). Only a Commissioner changes these. */
export function useSettingsWrite(seasonId: string, couchId: string | null) {
  const after = useAfter();
  return async (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => {
    if (!g.commissioner || !couchId) return toast.quiet("Only a Commissioner changes these");
    try {
      const r = await gameAdmin.settings(seasonId, couchId, g.leagueId, body);
      await after();
      if (!r.batch) return;
      const batch = r.batch;
      toast(said, {
        undo: async () => {
          try {
            await backstage.undo(seasonId, couchId, batch);
            await after();
            toast("Undone");
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
}

/**
 * A Prediction Sheet's questions (step A4 part 2 of docs/PLAN-start-a-game-gpt.md): its own, then what else the show's moments can
 * ask, each with when it's asked and what it earns. A Commissioner switches them until the game starts (its first lock, when
 * answers are in), never while it's locked down; at least one stays on. Saved at once, with the server's Undo on the toast and in
 * Recent changes (Settings Round 3b: the list as it was, written back with the show's ctx).
 */
export function SheetQuestions({ seasonId, couchId, g, q }: { seasonId: string; couchId: string; g: GameSettings; q: NonNullable<GameSettings["questions"]> }) {
  const after = useAfter();
  const undo = useServerUndo(seasonId, couchId);
  const [busy, setBusy] = useState(false);
  const on = q.list.filter((x) => x.on).map((x) => x.id);
  const send = async (ids: string[], said: string) => {
    setBusy(true);
    try {
      const r = await gameAdmin.questions(seasonId, couchId, g.leagueId, ids);
      await after();
      toast(said, undo(r.batch));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-settings="questions" className="mb-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">The questions</h3>
        <span className="text-[13px] text-muted-foreground">{on.length} on</span>
      </div>
      <small className="mb-1.5 block text-[13px] leading-snug text-muted-foreground">
        {q.why ?? "The results settle every one. Switch them until the game starts: after that, answers are in."}
      </small>
      {q.list.map((x) => (
        <button
          key={x.id}
          type="button"
          role="checkbox"
          aria-checked={x.on}
          disabled={!q.editable || busy}
          data-settings-question={x.id}
          onClick={() => {
            if (x.on && on.length === 1) return toast.quiet("A Prediction Sheet asks at least one question");
            const ids = x.on ? on.filter((id) => id !== x.id) : [...on, x.id];
            void send(ids, x.on ? `Took off "${x.ask}"` : `Added "${x.ask}"`);
          }}
          className="mb-1.5 flex w-full items-center gap-3 rounded-[3px] bg-background p-2.5 text-left disabled:cursor-default"
        >
          <span
            aria-hidden
            className={`grid size-6 flex-none place-items-center rounded-[3px] ${x.on ? (q.editable ? "bg-foreground text-background" : "bg-muted-foreground text-background") : "outline-[1.5px] -outline-offset-[1.5px] outline-input"}`}
          >
            {x.on && <Check className="size-4" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] leading-snug">{x.ask}</b>
            <small className="text-[13px] text-muted-foreground">{x.line}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** How a Weekly Lineup works: who scores each week and the bench (its steppers), from the next episode on. Backstage's Game settings
 *  and a game's own settings (Round 4: game-settings.tsx). */
export function LineupControl({ g, can, write, compact }: { g: GameSettings; can: boolean; write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>; compact?: boolean }) {
  const L = g.lineup!;
  const lineupChanged = L.starters !== L.rec.starters || (!g.draftStarted && L.bench !== L.rec.bench);
  return (
    <div data-settings="lineup" className={compact ? "mb-2" : "mb-5"}>
      <div className={`mb-2 flex items-baseline justify-between ${compact && !(lineupChanged && can) ? "hidden" : ""}`}>
        <h3 className={`type-caption text-[15px] tracking-[0.04em] text-muted-foreground ${compact ? "invisible" : ""}`}>How Weekly Lineup works</h3>
        {lineupChanged && can && (
          <button type="button" data-reset="lineup" onClick={() => write(g, { reset: "lineup" }, `Back to recommended: ${L.rec.starters} score each week`)} className="text-[14px] font-bold">
            Reset to recommended
          </button>
        )}
      </div>
      <p className={`mb-2 rounded-[3px] bg-card p-3 text-[15px] leading-snug ${compact ? "hidden" : ""}`}>
        Each week, <b>{L.starters} of your {L.starters + L.bench}</b> score. You pick which before the episode.
      </p>
      <div className="flex flex-col gap-2">
        <Stepper
          title={
            <>
              Who scores each week
              <Dot on={L.starters !== L.rec.starters} />
            </>
          }
          line={g.lockedDown ? "Frozen for the season" : L.starters === L.rec.starters ? "Recommended" : `Recommended: ${L.rec.starters}`}
          value={String(L.starters)}
          disabled={!can}
          atMin={L.starters <= 1}
          atMax={L.starters >= L.max.starters}
          onStep={(d) => write(g, { set: { activeSlots: L.starters + d }, text: `Changed who scores each week to ${L.starters + d}` }, `${L.starters + d} score each week from Episode ${g.from ?? "next"}`)}
        />
        {g.draftStarted ? (
          <div className="flex items-center justify-between rounded-[3px] bg-background p-2.5">
            <span>
              <b className="block text-[15px]">On the bench</b>
              <small className="text-[13px] text-muted-foreground">Set at the draft: more starters come off the bench</small>
            </span>
            <b className="type-num w-11 text-center text-[22px]">{L.bench}</b>
          </div>
        ) : (
          <Stepper
            title={
              <>
                On the bench
                <Dot on={L.bench !== L.rec.bench} />
              </>
            }
            line={g.lockedDown ? "Frozen for the season" : "Backups who don't score until you start them"}
            value={String(L.bench)}
            disabled={!can}
            atMin={L.bench <= 0}
            atMax={L.bench >= L.max.bench}
            onStep={(d) => write(g, { set: { benchSlots: L.bench + d }, text: `Changed the bench to ${L.bench + d}` }, `${L.bench + d} on the bench`)}
          />
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden />
        {g.from ? `Changes start with Episode ${g.from}.` : "Changes start with the next episode."} Nobody loses points already scored.
      </p>
    </div>
  );
}

/** Who can join: the choices, Recommended marked, or the game's own rule when it decides (Round 4 reuses it). */
export function JoinControl({ g, can, write, compact }: { g: GameSettings; can: boolean; write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>; compact?: boolean }) {
  const joinChanged = !g.joining.fixed && g.joining.mode !== g.joining.rec;
  return (
  <div data-settings="joining" className={compact ? "mb-1" : "mb-5"}>
    <div className="mb-2 flex items-baseline justify-between">
      <h3 className={`type-caption text-[15px] tracking-[0.04em] text-muted-foreground ${compact ? "invisible" : ""}`}>
        Who can join
        <Dot on={joinChanged} />
      </h3>
      {joinChanged && can && (
        <button
          type="button"
          data-reset="joining"
          onClick={() => write(g, { reset: "joining" }, `Back to recommended: ${g.joining.rec === "open" ? "anyone on the couch can join" : "they ask first"}`)}
          className="text-[14px] font-bold"
        >
          Reset to recommended
        </button>
      )}
    </div>
    {g.joining.fixed && !g.lockedDown ? (
      // Its own teams at its own pace (BACKLOG 68): the game decides who joins, so it's said, not offered as a choice that does
      // nothing (StateLogic.GhostLogic.joinMode: anyone until its draft starts, nobody after).
      <div data-join-fixed={g.joining.mode} className="rounded-[3px] bg-background p-2.5">
        <b className="block text-[15px]">{g.joining.mode === "open" ? "Anyone on the couch, until the draft starts" : "Nobody new"}</b>
        <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
          {g.joining.mode === "open"
            ? "After that, nobody: players own their castaways and play at their own pace."
            : g.draftStarted
              ? "Since the draft started. Players own their castaways and play at their own pace."
              : "Closed to new players."}
        </small>
      </div>
    ) : (
      <>
    <small className="mb-2 block text-[13px] text-muted-foreground">
      {g.lockedDown
        ? "Frozen for the season: nobody new joins or catches up."
        : g.gameType === "pickem" || g.questions
          ? "There are no teams, so new players can jump in."
          : g.joining.rec === "open"
            ? "Castaways can be on several teams, so new players can jump in."
            : "Each castaway is on one team, so new players need your OK."}
    </small>
    {(
      [
        ["open", "Anyone on the couch", "They can catch up on missed episodes", "Let anyone on the couch join"],
        ["ask", "They ask first", "You get a request to let them in", "Asks new players to ask first"],
        ["locked", "Nobody new", "The game is full for the season", "Closed the game to new players"],
      ] as const
    )
      .filter(([mode]) => mode !== "open" || g.joining.rec === "open")
      .map(([mode, t, d, line]) => (
      <button
        key={t}
        type="button"
        data-join={mode}
        aria-pressed={g.joining.mode === mode}
        disabled={!can}
        onClick={() => g.joining.mode !== mode && write(g, { set: { joinMode: mode }, text: line }, `Saved: ${g.gameName} · ${t}`)}
        className="mb-1.5 flex w-full items-center gap-3 rounded-[3px] bg-background p-2.5 text-left"
      >
        <i className={`grid size-5 flex-none place-items-center rounded-full border-2 ${g.joining.mode === mode ? "border-foreground" : "border-input"}`} aria-hidden>
          {g.joining.mode === mode && <i className="size-2.5 rounded-full bg-foreground" />}
        </i>
        <span>
          <b className="block text-[15px]">
            {t}
            {mode === g.joining.rec && <Recommended className="ml-2" />}
          </b>
          <small className="text-[13px] text-muted-foreground">{d}</small>
        </span>
      </button>
    ))}
      </>
    )}
  </div>
  );
}

/**
 * This episode's lineups or picks (Settings Round 3b, BACKLOG 157): a line, value first, whose value is the state by its effect,
 * opened in place to the states reachable now, each a chosen-with-a-tick card saying what it does to people. Before the episode airs:
 * open until it does (the game's rule) or locked early; after: the game's rule (open to whoever hasn't watched, where late moves are
 * on; locked at airtime where they aren't), open to everyone, or locked for everyone; once its results are in, locked for good, with
 * nothing to choose. Each saves at once, with the server's Undo (backstage-games.ts lockWrite). A state that isn't the game's own rule
 * carries a quiet "By hand" tag, so a normal night reads calm and nothing competes with the yellow (PFD R2).
 */
export function LockRow({ seasonId, couchId, g, lock, word }: { seasonId: string; couchId: string; g: GameSettings; lock: NonNullable<GameSettings["lock"]>; word: string }) {
  const after = useAfter();
  const undo = useServerUndo(seasonId, couchId);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const ep = `${word} ${lock.episode}`;
  const at = lock.airsAt ? airTime(Date.parse(lock.airsAt)) : null;
  const final = lock.why === "results";
  const what = lock.what;
  const states = lockStates(lock, word, at);
  const now = states.find((x) => x.state === lock.state) ?? states[0];
  const value = final ? "Locked for good: its results are in" : now.title;
  const set = async (state: LockState) => {
    if (final || busy || state === lock.state) return;
    setBusy(true);
    try {
      const r = await gameAdmin.lock(seasonId, couchId, g.leagueId, state);
      await after();
      const said = states.find((x) => x.state === state)?.said ?? "saved";
      toast(`${ep}'s ${what}: ${said}`, undo(r.batch, `${ep}'s ${what}: back as they were`));
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unusual = !final && lock.state !== "auto";
  const Icon = lock.closed ? Lock : LockOpen;
  return (
    <div data-settings-lock={lock.closed ? "locked" : "open"} data-lock-state={final ? "final" : lock.state} className="mb-5 rounded-[10px] bg-card px-3.5">
      <button
        type="button"
        aria-expanded={open}
        disabled={final}
        onClick={() => setOpen(!open)}
        className="nd-press flex min-h-[64px] w-full items-center gap-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          {/* Changed by hand, named with the page's quiet tag (the check's fix: a tint here read as the house yellow). */}
          <span className="flex items-center gap-2">
            <span className="type-caption text-[13px] tracking-[0.05em] text-muted-foreground">
              {ep}&rsquo;s {what}
            </span>
            {unusual && <em data-lock-by-hand className="type-caption rounded-[2px] bg-quiet-tag px-1.5 text-[11px] not-italic tracking-[0.05em] text-quiet-tag-foreground">By hand</em>}
          </span>
          <b className="block text-[16px] font-semibold leading-snug">{value}</b>
          {!final && <small className="block text-[13px] leading-snug text-muted-foreground">{now.short}</small>}
        </span>
        {!final && <ChevronRight className={`size-5 flex-none text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden />}
      </button>
      {open && !final && (
        <div data-lock-choices className="flex flex-col gap-2 pb-3">
          {states.map((x) => (
            <Choice key={x.state} data={`lock-${x.state}`} title={x.title} line={x.line} tag={x.state === "auto" ? "The game's rule" : null} chosen={lock.state === x.state} onPick={() => void set(x.state)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The states a lock can take now, by their effect (BACKLOG 157): two before airtime, three after (two where late moves are off). */
export function lockStates(lock: NonNullable<GameSettings["lock"]>, word: string, at: string | null): { state: LockState; title: string; line: string; short: string; said: string }[] {
  const next = `the next ${word.toLowerCase() === "ep" ? "episode" : word.toLowerCase()}`;
  if (!lock.aired)
    return [
      { state: "auto", title: at ? `Open until ${at}` : "Open until it airs", line: "Moves lock themselves when it starts.", short: "Locks itself when it airs", said: "open until it airs" },
      { state: "locked", title: "Locked early", line: "Everyone's move is set now. Open it again any time before it airs.", short: "Nobody can change their move", said: "locked early" },
    ];
  const rule = lock.late
    ? { state: "auto" as const, title: "Open to whoever hasn't watched", line: `Anyone who's watched is locked. The rest have until they watch, or ${next} airs.`, short: "Locked for anyone who's watched", said: "open to whoever hasn't watched" }
    : { state: "auto" as const, title: "Locked at airtime", line: "This game has no late moves: everything locked when it aired.", short: "Locked when it aired", said: "locked at airtime" };
  return [
    rule,
    { state: "open", title: "Open to everyone", line: "For a couch that sat down late: everyone can still move, on the honour system.", short: "Anyone can still move", said: "open to everyone" },
    ...(lock.late ? [{ state: "locked" as const, title: "Locked for everyone", line: "Nobody moves now, watched or not.", short: "Nobody can change their move", said: "locked for everyone" }] : []),
  ];
}

/**
 * How long it runs (step 6 of docs/PLAN-sports-data.md): to the season's end or through an episode, changed before its end is
 * reached, to one still to come; frozen once it's over, or while it's locked down. Where it starts (step A3 of
 * docs/PLAN-start-a-game-gpt.md): any episode still to come, up to its end, or when a phase of the season still to come starts,
 * until its first one airs. A game waiting for its phase says so ("Starts when Merged starts") and has no end to choose until
 * its start is settled; once it is, "Starts with Merged, at Episode 9". `compact`: Round 4's line above it says what it is.
 */
export function HowLong({
  g,
  words,
  can,
  write,
  compact,
}: {
  g: GameSettings;
  words: ShowData["words"];
  can: boolean;
  write: (g: GameSettings, body: Parameters<typeof gameAdmin.settings>[3], said: string) => Promise<void>;
  compact?: boolean;
}) {
  const part = { singular: words.episode.toLowerCase(), plural: words.episodes.toLowerCase() };
  const sp = g.span;
  // Step 2.7: a sport's season that goes on into its playoffs: no end is through its final, and its regular season's end says so.
  const po = sp.playoffs;
  const say = (to: number | null) => (to === null ? (po ? `through ${po.final}` : "to the season's end") : `through ${words.episode} ${to}${po && to === po.through ? ", the regular season" : ""}`);
  // Settings Round 3b (A15): an end at a phase reads as one ("until Merged starts"), its last episode once that's known.
  const until = sp.endPhase ? `until ${sp.endPhase.name} starts${sp.to !== null ? ` (through ${words.episode} ${sp.to})` : ""}` : null;
  const now =
    sp.from === null
      ? `When ${sp.phase?.name ?? "its phase"} starts, ${until ?? say(sp.to)}`
      : until
        ? `${words.episode} ${sp.from} ${until}`
        : sp.to === null
          ? po ? `${words.episode} ${sp.from} through ${po.final}` : `${words.episode} ${sp.from} to the season's end`
          : spanName(sp.from, sp.to, part);
  // A phase start (step A3), waiting or settled (its first episode still to come, or aired).
  const phaseLine = sp.phase ? (sp.from === null ? `Starts when ${sp.phase.name} starts` : `${sp.started ? "Started" : "Starts"} with ${sp.phase.name}, at ${words.episode} ${sp.from}`) : null;
  const open = can && !sp.over;
  // The phases it can start with: those still to come, and the one it starts with now.
  const phases = sp.phase && !sp.phases.some((p) => p.id === sp.phase?.id) ? [{ ...sp.phase, at: sp.from }, ...sp.phases] : sp.phases;
  // Its start moves until its first episode airs, to another still to come, or to a phase.
  const moveStart = open && !sp.started && (sp.starts.some((e) => e.number !== sp.from || !!sp.phase) || phases.some((p) => p.id !== sp.phase?.id));
  const startValue = sp.phase ? `phase:${sp.phase.id}` : String(sp.from);
  return (
    <div data-settings="span" className={compact ? "mb-2" : "mb-5"}>
      {!compact && <h3 className="type-caption mb-2 text-[15px] tracking-[0.04em] text-muted-foreground">How long</h3>}
      <div className="rounded-[3px] bg-background p-2.5">
        <b data-span-now className="block text-[15px]">
          {sp.over ? `Final · ${now}` : now}
        </b>
        {phaseLine && sp.from !== null && (
          <small data-span-phase className="block text-[13px] leading-snug">
            {phaseLine}
          </small>
        )}
        <small className="block text-[13px] leading-snug text-muted-foreground">
          {sp.over
            ? sp.from === null
              ? "The season ended before its phase started."
              : "It's over: its last one is in, so its end stays."
            : g.lockedDown
              ? "Frozen for the season"
              : sp.from === null
                ? `It waits for ${sp.phase?.name ?? "its phase"} to start, then plays from the first ${part.singular} it can. Nothing before then counts; the draft can happen first.`
                : moveStart
                  ? `Move its start before ${words.episode} ${sp.from} airs, its end before it's reached. Only what's between them scores.`
                  : `Change its end before it's reached. Nothing after its last ${part.singular} scores.`}
        </small>
        {moveStart && (
          <label className="mt-2 flex min-h-11 items-center gap-2.5 border-t border-border pt-2">
            <span className="flex-none text-[14px] text-muted-foreground">Starts</span>
            <select
              data-span-start
              value={startValue}
              onChange={(e) => {
                const v = e.target.value;
                const p = v.startsWith("phase:") ? phases.find((x) => x.id === v.slice(6)) : undefined;
                if (p) {
                  void write(g, { set: { startPhase: p.id }, text: `Changed where ${g.gameName} starts: when ${p.name} starts` }, `${g.gameName} starts when ${p.name} starts`);
                  return;
                }
                const from = Number(v);
                void write(g, { set: { startEpisode: from }, text: `Changed where ${g.gameName} starts: ${words.episode} ${from}` }, `${g.gameName} starts with ${words.episode} ${from}`);
              }}
              className="min-w-0 flex-1 truncate rounded-[3px] bg-card px-2.5 py-2 text-[15px] font-semibold"
            >
              {phases.map((p) => (
                <option key={`phase:${p.id}`} value={`phase:${p.id}`}>
                  When {p.name} starts{p.at !== null ? ` · ${words.episode} ${p.at}` : ""}
                </option>
              ))}
              {sp.starts.map((e) => (
                <option key={e.number} value={e.number}>
                  With {words.episode} {e.number}
                </option>
              ))}
            </select>
          </label>
        )}
        {open && sp.from !== null && (
          <label className="mt-2 flex min-h-11 items-center gap-2.5 border-t border-border pt-2">
            <span className="flex-none text-[14px] text-muted-foreground">Ends</span>
            <select
              data-span-end
              value={sp.endPhase ? `phase:${sp.endPhase.id}` : sp.to === null ? "" : String(sp.to)}
              onChange={(e) => {
                const v = e.target.value;
                const p = v.startsWith("phase:") ? [...(sp.endPhase ? [sp.endPhase] : []), ...sp.endPhases].find((x) => x.id === v.slice(6)) : undefined;
                if (p) {
                  void write(g, { set: { endPhase: p.id }, text: `Changed how long ${g.gameName} runs: until ${p.name} starts` }, `${g.gameName} runs until ${p.name} starts`);
                  return;
                }
                const to = v ? Number(v) : null;
                void write(g, { set: { endEpisode: to }, text: `Changed how long ${g.gameName} runs: ${say(to)}` }, `${g.gameName} runs ${say(to)}`);
              }}
              className="min-w-0 flex-1 truncate rounded-[3px] bg-card px-2.5 py-2 text-[15px] font-semibold"
            >
              <option value="">{po ? `Through ${po.final}` : "At the season\u2019s end"}</option>
              {sp.endPhase && !sp.endPhases.some((p) => p.id === sp.endPhase?.id) && <option value={`phase:${sp.endPhase.id}`}>Until {sp.endPhase.name} starts</option>}
              {sp.endPhases.map((p) => (
                <option key={`phase:${p.id}`} value={`phase:${p.id}`}>
                  Until {p.name} starts{p.at !== null ? ` · after ${words.episode} ${p.at - 1}` : ""}
                </option>
              ))}
              {sp.ends.map((e) => (
                <option key={e.number} value={e.number}>
                  Through {words.episode} {e.number}
                  {po && e.number === po.through ? " · the regular season" : po && e.number === po.fantasy ? " · the fantasy season" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

// ---------- archive or delete a game (step 10 part 2b) ----------

type EndAction = "archive" | "delete";

/** The mock's "Archive or delete a game": two rows, each asking which game (when there's more than one of yours). */
export function EndGames({ seasonId, couchId, only, restoreOnly = false }: { seasonId: string; couchId: string; only?: string; restoreOnly?: boolean }) {
  const data = useEndGames(seasonId, couchId);
  const after = useAfter();
  const [asking, setAsking] = useState<EndAction | null>(null);
  // The picker's title stays put while it slides away.
  const [lastAsk, setLastAsk] = useState<EndAction>("archive");
  if (asking && asking !== lastAsk) setLastAsk(asking);
  const [hold, setHold] = useState<DeletePreview | null | false>(false);
  const [open, setOpen] = useState(false);
  // `only` (Round 4: a game's own settings): that game, its Stop named for it.
  // `restoreOnly` (Games you run, settings Round 3a): each game stops from its own page; this list only brings an archived one back.
  const mine = (data.data?.games ?? []).filter((g) => g.yours && (!only || g.leagueId === only) && (!restoreOnly || g.archived));
  if (!mine.length) return null;
  const live = mine.filter((g) => !g.archived);

  const archive = async (g: EndGame) => {
    try {
      const r = await gamesApi.archive(seasonId, couchId, g.leagueId);
      await after();
      toast(`${g.gameName} archived · still on the trophy shelf`, {
        undo: async () => {
          try {
            await backstage.undo(seasonId, couchId, r.batch);
            await after();
            toast("Undone");
          } catch (e) {
            toast.quiet((e as Error).message);
          }
        },
      });
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const unarchive = async (g: EndGame) => {
    try {
      await gamesApi.unarchive(seasonId, couchId, g.leagueId);
      await after();
      toast(`${g.gameName} is back: it scores again`);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const askDelete = async (g: EndGame) => {
    setHold(null);
    try {
      setHold(await gamesApi.deletePreview(seasonId, couchId, g.leagueId));
    } catch (e) {
      setHold(false);
      toast.quiet((e as Error).message);
    }
  };
  const choose = (action: EndAction) => {
    const list = mine;
    if (list.length === 1) {
      const g = list[0];
      if (action === "delete") void askDelete(g);
      else void (g.archived ? unarchive(g) : archive(g));
    } else setAsking(action);
  };

  return (
    <section className="mx-4 mt-8">
      <div data-end-games className="rounded-[4px] bg-card">
        <button
          type="button"
          data-end-toggle
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex min-h-[56px] w-full items-center gap-3 px-3 text-left text-[15px] font-semibold"
        >
          {only || restoreOnly ? <Archive className="size-5 flex-none" aria-hidden /> : <KeyRound className="size-5 flex-none" aria-hidden />}
          <span className="flex-1">{only && mine[0] ? "Stop this game" : restoreOnly ? `Archived · ${mine.length}` : "Archive or delete a game"}</span>
          <ChevronRight className={`size-5 flex-none text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open && (
          <div className="px-3 pb-2">
            <button type="button" data-end="archive" onClick={() => choose("archive")} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left">
              <Archive className="size-5 flex-none text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{only ? (live.length ? `Archive ${mine[0].name}` : `Bring ${mine[0].name} back`) : live.length ? "Archive a game" : "Bring a game back"}</b>
                <small className="block text-[13px] text-muted-foreground">
                  {live.length ? "Keeps it on the trophy shelf, stops scoring" : "It scores again, with what came in meanwhile"}
                </small>
              </span>
            </button>
            {!restoreOnly && <button type="button" data-end="delete" onClick={() => choose("delete")} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left">
              <Trash2 className="size-5 flex-none text-live" aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold text-live">{only ? `Delete ${mine[0].name}` : "Delete a game"}</b>
                <small className="block text-[13px] text-muted-foreground">Removes it for everyone. Restorable for 30 days</small>
              </span>
            </button>}
          </div>
        )}
      </div>
      <Sheet open={!!asking} onOpenChange={(o) => !o && setAsking(null)} title={lastAsk === "delete" ? "Delete a game?" : "Archive a game?"} subtitle="Pick which one">
        <div className="flex flex-col pb-2" data-end-pick={asking ?? ""}>
          {mine.map((g) => (
            <button
              key={g.leagueId}
              type="button"
              data-end-game={g.leagueId}
              onClick={() => {
                const action = asking;
                setAsking(null);
                if (action === "delete") void askDelete(g);
                else void (g.archived ? unarchive(g) : archive(g));
              }}
              className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border text-left first:border-t-0"
            >
              <i className="size-3 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{g.name === g.gameName ? g.gameName : `${g.name} · ${g.gameName}`}</b>
                {g.archived && <small className="block text-[13px] text-muted-foreground">{lastAsk === "delete" ? "Archived" : "Archived · tap to bring it back"}</small>}
              </span>
              {g.archived && lastAsk !== "delete" && <RotateCcw className="size-5 flex-none text-muted-foreground" aria-hidden />}
            </button>
          ))}
        </div>
      </Sheet>
      <HoldSheet
        open={hold !== false}
        onOpenChange={(o) => !o && setHold(false)}
        title={hold ? `Delete ${hold.gameName}?` : "Delete a game?"}
        consequence={hold ? hold.consequence : null}
        cta="delete"
        alt={
          hold && !mine.find((g) => g.leagueId === hold.leagueId)?.archived
            ? {
                label: "Archive it instead",
                line: "Keeps everything on the trophy shelf; just stops scoring.",
                onClick: () => {
                  const g = mine.find((x) => x.leagueId === hold.leagueId);
                  setHold(false);
                  if (g) void archive(g);
                },
              }
            : undefined
        }
        onConfirm={async () => {
          if (!hold) return;
          await gamesApi.delete(seasonId, couchId, hold.leagueId);
          await after();
          toast("Deleted · restore it from Recent changes for 30 days");
        }}
      />
    </section>
  );
}
