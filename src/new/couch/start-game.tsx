"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bell, Bot, ChevronRight, Plus, Radio, RotateCcw, Trophy, Users } from "lucide-react";
import { airTime, calmWhen } from "../clock";
import { LEVEL_WORDS, type BotLevel } from "@/lib/game/computer-players";
import { spanName } from "@/lib/game/spans";
import { gamesApi, useAfterReveal, useCurrentCouch, useHome, useStartOptions, type HomeShow, type StartChoice, type StartOptions } from "../data";
import { gameColour } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { ShowArt } from "../ui/show-bar";
import { toast } from "../ui/toast";
import { openCouchSheet } from "./couch-sheets";

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

export type StartTarget = {
  seasonId?: string | null;
  couchId?: string | null;
  again?: string | null;
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
  const onOpenChange = (o: boolean) => !o && close();
  return (
    <>
      <PickShowSheet key={`pick-${n}`} open={!!target && !target.seasonId} couchId={target?.couchId ?? null} onOpenChange={onOpenChange} />
      <StartSheet key={`start-${n}`} target={target?.seasonId ? target : null} onOpenChange={onOpenChange} />
    </>
  );
}

/** "Survivor 51". */
const labelOf = (s: HomeShow) => `${s.show.name.replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "")}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;

/** Pick the show (the mock's startGamePicker): your shows still to finish, soonest first; how many games the couch has on each. */
function PickShowSheet({ open, couchId, onOpenChange }: { open: boolean; couchId: string | null; onOpenChange: (o: boolean) => void }) {
  const { data: home } = useHome();
  const couch = home?.couches.find((c) => c.id === couchId) ?? null;
  const nav = useNav();
  const shows = (home?.shows ?? [])
    .filter((s) => (s.following || s.games.length) && s.status !== "completed" && s.release !== "binge")
    .sort((a, b) => (a.upNext?.airAt ? Date.parse(a.upNext.airAt) : Infinity) - (b.upNext?.airAt ? Date.parse(b.upNext.airAt) : Infinity));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Start a game" subtitle="Pick the show">
      <div data-start-pick className="flex flex-col pb-2">
        {shows.length ? (
          shows.map((s) => {
            const have = (couch?.games ?? []).filter((g) => g.seasonId === s.seasonId && !g.archived).length;
            const ready = s.ready !== false;
            return (
              <button
                key={s.seasonId}
                type="button"
                data-pick-show={s.seasonId}
                onClick={() => {
                  if (ready) openStartGame({ seasonId: s.seasonId, couchId });
                  else {
                    close();
                    nav.push(`${paths.show(s.seasonId, "games")}?page=make`);
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
  // Include it: the options again from the episode on now (its spans, How long), when there is one. Starts: from a later
  // listed episode instead (null: the next to air), the options again from there.
  const [late, setLate] = useState(false);
  const [startAt, setStartAt] = useState<number | null>(null);
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
  const [busy, setBusy] = useState(false);
  const pick = picked ?? o?.again?.key ?? startable[0]?.key ?? null;
  const me = home?.user.name ?? "you";
  const botsHere = !!fits.find((g) => g.key === pick)?.bots;
  const again = o?.again;

  const start = async () => {
    if (!o || !couchId || !pick) return;
    setBusy(true);
    try {
      const r = await gamesApi.start(o.seasonId, couchId, {
        game: pick,
        tell,
        again: target?.again ?? null,
        // The start you chose, not the options on screen (they may still be the last start's while they reload).
        ...(!late && startAt !== null ? { from: startAt } : {}),
        to,
        ...(botsHere && bots ? { bots, level } : {}),
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

  return (
    <Sheet
      open={!!asked}
      onOpenChange={onOpenChange}
      title={again ? "Run it back" : "Start a game"}
      subtitle={
        o
          ? again
            ? `${o.label}${to === null ? "" : ` · ${spanName(o.from, to, o.part)}`} · the same ${again.gameName} as ${again.label}`
            : `${o.show} · ${to === null ? `from ${partAt(o)}` : spanName(o.from, to, o.part)}`
          : undefined
      }
    >
      <div data-start-sheet={o?.kind ?? "loading"} className="flex flex-col gap-2 pb-2">
        {!couchId ? (
          <>
            <p className="text-[15px] leading-snug text-muted-foreground">Games are played on a couch. Start one and send the code, or join one with a code.</p>
            <Btn tone="must" wide onClick={() => openCouchSheet({ kind: "new" })}>
              <Users className="size-5" aria-hidden />
              Start a couch
            </Btn>
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
                  nav.push(`${paths.show(o.seasonId, "games")}?page=make`);
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
            {startable.length > 0 && o.onAir && (
              <button
                type="button"
                role="switch"
                aria-checked={late}
                data-start-late={late ? "on" : "off"}
                onClick={() => {
                  setLate(!late);
                  setStartAt(null);
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
            {startable.length > 0 && !o.late && o.starts.length > 1 && (
              <Starts
                o={o}
                setAt={(n) => {
                  setStartAt(n);
                  setTo(undefined);
                }}
              />
            )}
            {startable.length > 0 && (o.spans.length > 1 || o.ends.length > 0) && <HowLong o={o} to={to} setTo={setTo} />}
            {botsHere && <Computers n={bots} setN={setBots} level={level} setLevel={setLevel} />}
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
            <Btn
              tone="must"
              wide
              data-start-go
              // Not while the options reload for a new start (Include it, Starts): what's on screen is still the last one's.
              disabled={busy || opts.isPlaceholderData || !pick || !startable.some((g) => g.key === pick)}
              onClick={start}
              className="mt-2"
            >
              {again ? <RotateCcw className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
              {busy ? "Starting…" : startable.length ? "Start it" : "Coming soon"}
            </Btn>
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

/**
 * Where the game starts (docs/PLAN-start-a-game-gpt.md step A3): with the next episode to air, or any later one the listing
 * has, from a list. It waits until then (nothing before it counts), and its draft can happen first.
 */
function Starts({ o, setAt }: { o: StartOptions; setAt: (n: number | null) => void }) {
  const P = o.part.singular.replace(/^./, (c) => c.toUpperCase());
  const later = o.from !== o.nextEpisode;
  const first = o.starts[0];
  return (
    <section data-start-from className="mt-1 flex flex-col gap-1.5 border-t border-border pt-3" role="radiogroup" aria-label="Starts">
      <b className="text-[15px] font-semibold">Starts</b>
      <button
        type="button"
        role="radio"
        aria-checked={!later}
        data-start-from-choice="next"
        onClick={() => setAt(null)}
        className={`flex min-h-[52px] w-full flex-col justify-center rounded-[4px] px-3 py-2 text-left ${!later ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron-line" : "bg-secondary/60"}`}
      >
        <b className="block text-[15px]">
          With the next one · {P} {o.nextEpisode}
        </b>
        <small className={`block truncate text-[13px] leading-snug ${!later ? "text-plate-muted" : "text-muted-foreground"}`}>
          {first?.airAt ? calmWhen(Date.parse(first.airAt)) : `The next ${o.part.singular} to air`}
        </small>
      </button>
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
      {later && (
        <small data-start-from-note className="text-[13px] leading-snug text-muted-foreground">
          It waits for {P} {o.from}: nothing before it counts, and the draft can happen any time before then.
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

/** "riley", "riley and sam", "riley, sam and jordan". */
function names(list: string[]) {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}
