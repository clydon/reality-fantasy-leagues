"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { couches, draftAct, gamesApi, useAfterCouch, type CatchUpReveal, type GameView } from "../data";
import { aheadWords } from "../couch/pace";
import { namesLine } from "../couch/where";
import { ordinal } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { epName, type GameLabel } from "@/lib/game/show-words";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { faceIn, first, openMoves } from "./moves";
import { PaceRevealScreen } from "./reveal";
import { Face } from "./parts";

// A game at your own pace on Tonight (docs/PLAN-own-pace-games.md, "The UI, mocked": the user's pick, 2026-11-05). Its weekly loop
// (Pick · Watch · Reveal) is folded into the show's two parts since the design round's step 3 (the user, 2026-11-15: "fold"): the
// move for your next episode is the strip's (strip.tsx), and watching it and its reveal are the progress control's (progress.tsx),
// through usePaceReveal below: "Reveal Ep 4" there, the gap small on it past one ahead ("2 ahead of riley": the words are the
// guardrail, nothing locks), and revealing without your move asks once. The reveal opens what happened, with "Pick for Episode N"
// as the way on and "Done for now" as the quiet way out. Plates stay only for what isn't the weekly loop: drafting together,
// picking your team, a waiver moment, and how you finished. "Catching up" is the engine's word and never shows here.

/** "1st", "Tied 2nd": a table rank ("1", "T2") as people say it. */
function placeWords(rank: string): string {
  const n = parseInt(rank.replace(/^T/, ""), 10);
  if (!Number.isFinite(n)) return rank;
  return rank.startsWith("T") ? `Tied ${ordinal(n)}` : ordinal(n);
}

/** Whether a game shows a plate of its own on Tonight: own pace with a sync point or an end to say (drafting together, picking
 *  your team, a waiver moment, how you finished). Its weekly loop is the strip's and the control's (catchingUpIn). A caught-up
 *  seat on a season still airing has nothing of its own: its move is the strip's, as any game's (PRODUCT.md principle 11). */
export const hasPacePlate = (g: GameView) => !!(g.ownPace && g.pace && (g.pace.draft || g.pace.team || g.pace.gather || (!g.catchUp && g.over)));

/** A game at your own pace with an aired episode to play next: its move is the strip's, its reveal the control's. A waiver moment
 *  asks you to wait on its plate, but nothing locks: the control still reveals it. */
export const catchingUpIn = (g: GameView) => !!(g.ownPace && g.pace && !g.pace.draft && !g.pace.team && !g.archived && g.catchUp && g.catchUp.latest >= g.catchUp.week);

/** Your move for that episode is in (a game with no weekly move has nothing to make). */
export const movedIn = (g: GameView) => (g.pick ? !!g.pick.pick : g.lineup ? g.lineup.set : true);
const lineupIn = (g: GameView | undefined) => !!g?.lineup && !g?.pick;

export interface PaceReveal {
  /** The episode next: the earliest any of your own-pace games is on. */
  n: number;
  /** Your games on it. */
  games: GameView[];
  /** Every move for it is in. */
  moved: boolean;
  /** A waiver moment asks you to wait first (its plate). */
  waits: boolean;
  /** "2 ahead of riley": the gap past one ahead, without the "you'll be" the button has no room for. */
  ahead: string | null;
}

/** The control's own-pace reveal, or null. */
export function paceReveal(show: ShowData): PaceReveal | null {
  const all = (show.play ?? []).filter(catchingUpIn);
  if (!all.length) return null;
  const n = Math.min(...all.map((g) => g.catchUp!.week));
  const games = all.filter((g) => g.catchUp!.week === n);
  // Each other person once, at the furthest-behind week any of these games has them on.
  const others = new Map<string, number | null>();
  for (const g of games)
    for (const o of g.pace!.others) {
      const had = others.get(o.name) ?? null;
      others.set(o.name, o.week == null ? had : had == null ? o.week : Math.min(o.week, had));
    }
  const ahead = aheadWords(n, [...others].map(([name, week]) => ({ name, week })));
  return { n, games, moved: games.every(movedIn), waits: games.some((g) => !!g.pace!.gather && !g.pace!.gather.open), ahead: ahead?.replace(/^you'll be /, "") ?? null };
}

/** The control's reveal for games at your own pace: `start()` reveals each game on the episode (couches.catchUp, one each), or
 *  first asks once when a move for it isn't in; `node` holds that ask and what the reveal did. */
export function usePaceReveal(show: ShowData, r: PaceReveal | null) {
  const after = useAfterCouch();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<{ games: GameView[]; reveals: CatchUpReveal[] } | null>(null);
  const run = async () => {
    if (!r || busy) return;
    setBusy(true);
    try {
      const reveals: CatchUpReveal[] = [];
      for (const g of r.games) reveals.push(await couches.catchUp(show.header?.seasonId ?? "", show.couch?.id ?? null, g.leagueId));
      setAsking(false);
      await after();
      setDone({ games: r.games, reveals });
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const start = () => (r && !r.moved ? setAsking(true) : run());
  const missing = r?.games.filter((g) => !movedIn(g)) ?? [];
  const lineup = missing.length > 0 && missing.every(lineupIn);
  const node = (
    <>
      <Sheet open={asking} onOpenChange={setAsking} title={`No ${lineup ? "lineup" : "pick"} for ${r ? epName(show.words, r.n, "short") : `${show.words.ep} `}`} subtitle={missing.map((g) => g.gameName).join(" · ")}>
        <div data-pace-ask className="flex flex-col gap-2">
          <p className="text-[15px] leading-normal text-muted-foreground">
            Without one, {r ? epName(show.words, r.n, "short") : show.words.ep} counts for nothing for you{missing.length > 1 ? " in those games" : ""}.
          </p>
          <Btn
            tone="ink"
            wide
            className="mt-2"
            data-pace-move
            onClick={() => {
              setAsking(false);
              if (missing[0]) openMoves(lineupIn(missing[0]) ? "lineup" : "pool", missing[0].leagueId);
            }}
          >
            {lineupIn(missing[0]) ? "Set your lineup first" : "Pick first"}
          </Btn>
          <Btn wide data-pace-reveal-anyway disabled={busy} onClick={run}>
            {busy ? "Revealing…" : "Reveal anyway"}
          </Btn>
        </div>
      </Sheet>
      <RevealedSheet show={show} done={done} onClose={() => setDone(null)} />
    </>
  );
  return { start, busy, node };
}

/** Every own-pace game of yours here with a plate of its own (hasPacePlate), one plate each. */
export function OwnPacePlates({ show }: { show: ShowData }) {
  const games = (show.play ?? []).filter(hasPacePlate);
  if (!games.length) return null;
  return (
    <section className="mt-4 flex flex-col gap-3 px-4">
      {games.map((g) =>
        g.pace?.draft ? (
          <DraftPlate key={g.leagueId} show={show} g={g} />
        ) : g.pace?.team ? (
          <TeamPlate key={g.leagueId} g={g} names={show.words.names} />
        ) : g.pace?.gather ? (
          <GatherPlate key={g.leagueId} show={show} g={g} />
        ) : (
          <FinishPlate key={g.leagueId} show={show} g={g} />
        )
      )}
    </section>
  );
}

/** "Episode 4" as these plates say it, a team's game by name ("Chiefs at Bills", a tag "KC @ BUF"): show-words.ts epName. */
const epOf = (names: Record<number, GameLabel> | null | undefined, n: number, form: "short" | "tag" = "short") => epName({ episode: "Episode", ep: "Episode", names }, n, form);

const TAG = "type-caption self-start bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]";

/** Exclusive teams at your own pace (sync point 1): before anyone plays, everyone drafts together in the usual draft room, on the
 *  cast as it stood before the start. Whoever runs the game starts it; then it's the draft room for everyone. */
function DraftPlate({ show, g }: { show: ShowData; g: GameView }) {
  const names = show.words.names;
  const nav = useNav();
  const after = useAfterCouch();
  const [busy, setBusy] = useState(false);
  const week = g.catchUp?.week ?? 1;
  const runs = g.yourRole === "commissioner" || g.yourRole === "admin";
  const live = g.pace!.draft === "live";
  const seasonId = show.header?.seasonId ?? "";
  const go = () => nav.push(paths.showPage(seasonId, "draft"));
  const start = async () => {
    setBusy(true);
    try {
      await draftAct(seasonId, g.leagueId, { action: "start" });
      await after();
      go();
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const people = [{ name: "You", bot: false }, ...g.pace!.others.map((o) => ({ name: o.name, bot: false }))];
  const bots = g.table.filter((r) => r.bot).map((r) => r.name);
  return (
    <div data-pace-draft-plate={g.leagueId} data-pace-draft={g.pace!.draft} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        Before {epOf(names, week, "tag")} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">{live ? "The draft's on" : "Draft together"}</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        Take turns picking from who was still in before {epOf(names, week)}. Each person on one team. Then everyone plays at their own pace.
      </p>
      <p className="text-[13px] leading-snug text-plate-muted">
        {namesLine([...people.map((p) => p.name), ...bots.map((b) => `${b} (computer)`)], 5)}
      </p>
      {live || !runs ? (
        <Btn tone={live ? "must" : "ink"} wide data-pace-draft-go onClick={go}>
          {live ? "Go to the draft" : "See the draft room"}
        </Btn>
      ) : (
        <Btn tone="must" wide data-pace-draft-start disabled={busy} onClick={start}>
          {busy ? "Starting…" : "Start the draft"}
        </Btn>
      )}
      {!live && !runs && <small className="text-[13px] text-plate-muted">Whoever started the game starts the draft, once you&rsquo;re all here.</small>}
    </div>
  );
}

/**
 * A waiver moment (sync point 2): someone's team lost a person in an episode you've reached. Until everyone's there, it asks you
 * to wait, in words only (the user's pick): "OK, I'll wait"; the next episode's reveal stays in the progress control. Once
 * everyone's there, its waiver week is on: the usual waivers page.
 */
function GatherPlate({ show, g }: { show: ShowData; g: GameView }) {
  const nav = useNav();
  const [waits, setWaits] = useState(false);
  const gather = g.pace!.gather!;
  const lost = gather.lost.map((l) => `${first(l.name)} went home from ${l.yours ? "your" : `${l.team}'s`} team`).join(" · ");
  if (gather.open) {
    return (
      <div data-pace-waivers={g.leagueId} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
        <span className={TAG}>
          After {epOf(show.words.names, gather.episode, "tag")} · {g.gameName}
        </span>
        <b className="type-caption text-[28px] leading-none">Everyone&rsquo;s here: waivers</b>
        <p className="text-[14px] leading-snug text-plate-muted">{lost}. Claims settle once everyone owed a replacement has put theirs in.</p>
        {show.header && (
          <Btn tone="must" wide data-pace-waivers-go onClick={() => nav.push(paths.showPage(show.header!.seasonId, "waivers"))}>
            Go to waivers
          </Btn>
        )}
      </div>
    );
  }
  return (
    <div data-pace-gather={g.leagueId} data-pace-gather-episode={gather.episode} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        After {epOf(show.words.names, gather.episode, "tag")} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">Waivers after {epOf(show.words.names, gather.episode)}</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        {lost}. Wait for everyone else before watching more episodes, so the waivers are fair.
      </p>
      <p className="text-[13px] leading-snug text-plate-muted">
        Waiting on {namesLine(gather.waiting)}.
      </p>
      {waits ? (
        <small className="text-[13px] text-plate-muted">Thanks: the waivers open once everyone&rsquo;s on {epOf(show.words.names, gather.episode)}.</small>
      ) : (
        <Btn tone="ink" wide data-pace-gather-wait onClick={() => setWaits(true)}>
          OK, I&rsquo;ll wait
        </Btn>
      )}
      {g.catchUp && <small className="text-[13px] text-plate-muted">Going on anyway? Reveal {epName(show.words, g.catchUp.week, "short")} at the top.</small>}
    </div>
  );
}

/** A game with teams where yours isn't picked yet (part 3a): the plate's first step, before Pick · Watch · Reveal. */
function TeamPlate({ g, names }: { g: GameView; names?: Record<number, GameLabel> | null }) {
  const [open, setOpen] = useState(false);
  const team = g.pace!.team!;
  const week = g.catchUp?.week ?? 1;
  return (
    <div data-pace-team-plate={g.leagueId} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        Before {epOf(names, week, "tag")} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">Pick your team</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        {team.need} from who was still in before {epOf(names, week)}. They&rsquo;re yours for the whole game.
      </p>
      <Btn tone="must" wide data-pace-team-open onClick={() => setOpen(true)}>
        Pick your team
      </Btn>
      <TeamSheet g={g} open={open} onOpenChange={setOpen} names={names} />
    </div>
  );
}

/** Who you can have, as faces: tap to take, tap again to put back; the button counts down to your team. */
function TeamSheet({ g, open, onOpenChange, names }: { g: GameView; open: boolean; onOpenChange: (o: boolean) => void; names?: Record<number, GameLabel> | null }) {
  const after = useAfterCouch();
  const [team, setTeam] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { need, pool } = g.pace!.team!;
  const save = async () => {
    setBusy(true);
    try {
      await gamesApi.team(g.leagueId, team);
      await after();
      onOpenChange(false);
      toast("Your team's in");
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Pick your team" subtitle={`${need} · from who was still in before ${epOf(names, g.catchUp?.week ?? 1)}`}>
      <div data-pace-team-pick className="grid grid-cols-4 gap-2">
        {pool.map((id) => {
          const c = faceIn(g, id);
          const on = team.includes(id);
          return (
            <button
              key={id}
              type="button"
              data-castaway={id}
              aria-pressed={on}
              onClick={() => setTeam(on ? team.filter((x) => x !== id) : team.length < need ? [...team, id] : team)}
              className={`relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground ${on ? "shadow-[0_0_0_3px_var(--good)]" : ""}`}
            >
              <Face src={c?.photo ?? null} name={c?.name ?? "?"} className="aspect-[4/4.2] w-full text-[28px]" />
              {on && (
                <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-good-foreground">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                </span>
              )}
              <span className="block px-1.5 pb-1.5 pt-1">
                <b className="type-caption block truncate text-[14px]">{first(c?.name ?? "?")}</b>
              </span>
            </button>
          );
        })}
      </div>
      <Btn tone="must" wide className="sticky bottom-0 mt-4" data-pace-team-save disabled={busy || team.length !== need} onClick={save}>
        {busy ? "Saving…" : team.length === need ? `This is my team` : `Pick ${need - team.length} more`}
      </Btn>
    </Sheet>
  );
}

/** The reveal, full screen (reveal.tsx PaceRevealScreen: the same beats as the show's), and its end: where each game stands now,
 *  then the way on: the next episode's move, Done for now, or how you finished. */
function RevealedSheet({ show, done, onClose }: { show: ShowData; done: { games: GameView[]; reveals: CatchUpReveal[] } | null; onClose: () => void }) {
  // Each game as it reads now (the reveal refreshed it), for its place.
  const now = (x: GameView) => (show.play ?? []).find((y) => y.leagueId === x.leagueId) ?? x;
  const games = done?.games.map(now) ?? [];
  const r = done?.reveals[0];
  // The way on: the first game with a next episode (the strip lists the rest).
  const k = done ? Math.max(0, done.reveals.findIndex((x) => x.next != null)) : 0;
  const g = games[k] ?? null;
  const next = done?.reveals[k]?.next ?? null;
  const lineup = !!g?.lineup && !g?.pick;
  const end =
    r && g ? (
      <div data-pace-revealed={r.episode} className="flex flex-col gap-2.5">
        {games.map((x, i) =>
          x.you ? (
            <p key={x.leagueId} className="text-center text-[14px] text-muted-foreground">
              {games.length > 1 ? `${x.gameName}: through` : "Through"} {epOf(show.words.names, done!.reveals[i]?.episode ?? r.episode)}, you&rsquo;re {placeWords(x.you.rank)} of {x.players}.
            </p>
          ) : null
        )}
        {next ? (
          <>
            <Btn
              tone="ink"
              wide
              data-pace-next
              onClick={() => {
                onClose();
                openMoves(lineup ? "lineup" : "pool", g.leagueId);
              }}
            >
              {lineup ? "Set your lineup" : "Pick"} for {epOf(show.words.names, next)}
            </Btn>
            <button type="button" data-pace-later onClick={onClose} className="h-11 text-[15px] font-semibold text-muted-foreground">
              Done for now
            </button>
          </>
        ) : games.every((x) => x.over) ? (
          <Btn tone="ink" wide data-pace-finished onClick={onClose}>
            See how you finished
          </Btn>
        ) : (
          // Caught up on a season still airing: you play the next one as it airs, like everyone there.
          <>
            <p data-pace-caught-up className="text-center text-[14px] text-muted-foreground">
              You&rsquo;re caught up: {epName(show.words, r.episode + 1, "short")} is next, as it airs.
            </p>
            <Btn tone="ink" wide data-pace-done onClick={onClose}>
              Done
            </Btn>
          </>
        )}
      </div>
    ) : null;
  return <PaceRevealScreen show={show} reveals={done?.reveals ?? null} end={end} onClose={onClose} />;
}

/** You've seen the last episode: how you finished, and that anyone behind still has it hidden. */
function FinishPlate({ show, g }: { show: ShowData; g: GameView }) {
  const nav = useNav();
  const behind = g.pace!.others.filter((o) => o.week !== null) as { name: string; week: number }[];
  const line = behind.length
    ? `${behind.map((o) => `${o.name} is on ${epOf(show.words.names, o.week)}`).join(" · ")}: the final standings stay hidden from ${behind.length === 1 ? "them" : "them all"} until they get there.`
    : g.pace!.others.length
      ? "Everyone's finished it."
      : null;
  return (
    <div data-pace-finish={g.leagueId} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className="type-caption self-start bg-good py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-good-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
        You finished it · {g.gameName}
      </span>
      <b className="type-caption text-[34px] leading-none">{g.you ? `${placeWords(g.you.rank)} of ${g.players}` : "Finished"}</b>
      {line && <p className="text-[14px] leading-snug text-plate-muted">{line}</p>}
      {show.header && (
        <Btn tone="ink" wide onClick={() => nav.push(paths.show(show.header!.seasonId, "games"))}>
          See the standings
        </Btn>
      )}
    </div>
  );
}
