"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Plus, RotateCcw, Trophy, Users } from "lucide-react";
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
//     talk show's Weekly Calls (step 12 part 2: two calls a show, Call it) and Weekly Bingo, shown coming with part 3; Tell the
//     couch (one alert, on by default); Start it.
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

/** The bingo and calls colours (the mock's GAMES.wbingo / wcalls), beside the three season games'. */
const DOT: Record<string, string> = {
  weeklyBingo: "#a76bb0",
  weeklyCalls: "#e0b23a",
};
const dotOf = (g: StartChoice) => DOT[g.key] ?? gameColour(g.name);

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
  const opts = useStartOptions(target?.seasonId ?? null, couchId, target?.again ?? null, !!target);
  const o = opts.data;
  const nav = useNav();
  const pathname = usePathname();
  const refresh = useAfterReveal();
  const fits = (o?.games ?? []).filter((g) => g.fits);
  const startable = fits.filter((g) => !g.soon);
  const [picked, setPicked] = useState<string | null>(null);
  const [tell, setTell] = useState(true);
  const [busy, setBusy] = useState(false);
  const pick = picked ?? o?.again?.key ?? startable[0]?.key ?? null;
  const me = home?.user.name ?? "you";
  const again = o?.again;

  const start = async () => {
    if (!o || !couchId || !pick) return;
    setBusy(true);
    try {
      const r = await gamesApi.start(o.seasonId, couchId, {
        game: pick,
        tell,
        again: target?.again ?? null,
      });
      await refresh();
      toast(`${r.gameName} started${r.told ? " · the couch has been told" : ""}`);
      close();
      const games = paths.show(o.seasonId, "games");
      if (pathname !== games) nav.push(games);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!asked}
      onOpenChange={onOpenChange}
      title={again ? "Run it back" : "Start a game"}
      subtitle={o ? (again ? `${o.label} · the same ${again.gameName} as ${again.label}` : `${o.show} · from ${partAt(o)}`) : undefined}
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
                  className={`flex w-full items-start gap-3 rounded-[4px] p-3 text-left disabled:opacity-60 ${on ? "bg-plate text-plate-foreground outline-[3px] -outline-offset-[3px] outline-chyron" : "bg-secondary/60"}`}
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
            <Btn tone="must" wide data-start-go disabled={busy || !pick || !startable.some((g) => g.key === pick)} onClick={start} className="mt-2">
              {again ? <RotateCcw className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
              {busy ? "Starting…" : startable.length ? "Start it" : "Coming soon"}
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** "riley", "riley and sam", "riley, sam and jordan". */
function names(list: string[]) {
  return list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : (list[0] ?? "");
}
