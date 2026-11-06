"use client";

import { useState } from "react";
import { couches, useAfterCouch, type CatchUpReveal, type GameView } from "../data";
import { CatchUpResult } from "../couch/join-game";
import { aheadWords, allHere } from "../couch/pace";
import { namesLine } from "../couch/where";
import { ordinal } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { faceIn, first, openMoves } from "./moves";
import { Face } from "./parts";

// A game at your own pace on Tonight (docs/PLAN-own-pace-games.md, "The UI, mocked": the user's pick, 2026-11-05): one plate per
// game for your next episode, in place of the catching-up strip and that game's Your moves card. The plate is the move: its
// steps (Pick · Watch · Reveal) teach the loop without words, and its one button is always the next step (Pick who survives,
// then I've watched it · Reveal, the gap words small inside it past one ahead). Revealing without a pick asks once, on the
// plate. The reveal opens what happened, with "Pick for Episode N" as the way on and "Done for now" as the quiet way out. Once
// you've seen the last episode, the plate says how you finished; anyone behind still has it hidden. Nothing locks: the words
// are the guardrail. "Catching up" is the engine's word and never shows here.

/** "1st", "Tied 2nd": a table rank ("1", "T2") as people say it. */
function placeWords(rank: string): string {
  const n = parseInt(rank.replace(/^T/, ""), 10);
  if (!Number.isFinite(n)) return rank;
  return rank.startsWith("T") ? `Tied ${ordinal(n)}` : ordinal(n);
}

/** Who's behind you, or on this one with you, in one quiet line; nothing when everyone else is ahead (quiet unless it matters). */
function nearLine(week: number, others: { name: string; week: number | null }[]): string | null {
  const going = others.filter((o) => o.week !== null) as { name: string; week: number }[];
  if (!going.length) return null;
  if (allHere(week, going)) return `${namesLine(going.map((o) => o.name))} ${going.length === 1 ? "is" : "are"} on this one too.`;
  const behind = going.filter((o) => o.week < week).sort((a, b) => a.week - b.week);
  if (!behind.length) return null;
  return behind.map((o) => `${o.name} is on Episode ${o.week}`).join(" · ") + ".";
}

/** Every own-pace game of yours here, one plate each. */
export function OwnPacePlates({ show }: { show: ShowData }) {
  const games = (show.play ?? []).filter((g) => g.ownPace && g.pace);
  const [done, setDone] = useState<{ game: GameView; reveal: CatchUpReveal } | null>(null);
  if (!games.length && !done) return null;
  return (
    <section className="mt-4 flex flex-col gap-3 px-4">
      {games.map((g) => (g.catchUp ? <PacePlate key={g.leagueId} show={show} g={g} onRevealed={(reveal) => setDone({ game: g, reveal })} /> : <FinishPlate key={g.leagueId} show={show} g={g} />))}
      <RevealedSheet show={show} done={done} onClose={() => setDone(null)} />
    </section>
  );
}

const TAG = "type-caption self-start bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]";

function PacePlate({ show, g, onRevealed }: { show: ShowData; g: GameView; onRevealed: (r: CatchUpReveal) => void }) {
  const after = useAfterCouch();
  const [busy, setBusy] = useState(false);
  // Revealing with no move asks once, here (the mock's "No pick for Episode 3 · Pick first / Reveal anyway").
  const [asking, setAsking] = useState(false);
  const week = g.catchUp!.week;
  const last = g.pace!.last || g.catchUp!.latest;
  const others = g.pace!.others;
  const lineup = !!g.lineup && !g.pick;
  const moved = g.pick ? !!g.pick.pick : g.lineup ? g.lineup.set : true;
  const hasMove = !!(g.pick || g.lineup);
  const picked = g.pick?.pick ? faceIn(g, g.pick.pick) : undefined;
  const ahead = aheadWords(week, others);
  const near = nearLine(week, others);
  const move = () => openMoves(lineup ? "lineup" : "pool", g.leagueId);
  const reveal = async () => {
    setBusy(true);
    try {
      const r = await couches.catchUp(show.header?.seasonId ?? "", show.couch?.id ?? null, g.leagueId);
      setAsking(false);
      await after();
      onRevealed(r);
    } catch (e) {
      toast.quiet((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const step = (on: "done" | "now" | "later", label: string) => (
    <span className={`flex flex-col gap-1.5 text-[12px] font-semibold ${on === "now" ? "text-plate-foreground" : "text-plate-muted"}`}>
      <i className={`h-1 rounded-full ${on === "done" ? "bg-plate-foreground" : on === "now" ? "bg-plate-foreground/45" : "bg-plate-foreground/12"}`} />
      {label}
    </span>
  );
  return (
    <div data-pace-plate={g.leagueId} data-pace-week={week} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        Episode {week} of {last} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">{moved ? `Watch Episode ${week}` : lineup ? "Set your lineup" : "Pick who survives"}</b>
      {hasMove && (
        <span className="grid grid-cols-3 gap-1.5" aria-label={moved ? "Picked. Now watch it, then reveal" : "Pick, then watch it, then reveal"}>
          {step(moved ? "done" : "now", lineup ? "Set" : "Pick")}
          {step(moved ? "now" : "later", "Watch")}
          {step("later", "Reveal")}
        </span>
      )}
      {picked && (
        <span className="flex items-center gap-2.5">
          <Face src={picked.photo} name={picked.name} className="size-11 flex-none rounded-[3px] text-[18px]" />
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[16px]">{first(picked.name)}</b>
            <small className="block text-[13px] text-plate-muted">Your pick to survive</small>
          </span>
          <button type="button" data-pace-change onClick={move} className="min-h-11 px-1 text-[14px] font-bold underline underline-offset-4">
            Change
          </button>
        </span>
      )}
      {lineup && g.lineup?.set && <small className="text-[13px] text-plate-muted">Your lineup&rsquo;s set · change it until you reveal</small>}
      {!moved && asking ? (
        <>
          <p data-pace-ask className="text-[14px] leading-snug text-plate-muted">
            <b className="text-plate-foreground">No {lineup ? "lineup" : "pick"} for Episode {week}.</b> It counts for nothing for you.
          </p>
          <Btn tone="must" wide onClick={move}>
            {lineup ? "Set it first" : "Pick first"}
          </Btn>
          <button type="button" data-pace-reveal-anyway disabled={busy} onClick={reveal} className="min-h-11 text-[15px] font-semibold text-plate-muted">
            {busy ? "Revealing…" : "Reveal anyway"}
          </button>
        </>
      ) : !moved ? (
        <>
          <Btn tone="must" wide data-pace-move onClick={move}>
            {lineup ? "Set your lineup" : "Pick who survives"}
          </Btn>
          <button type="button" data-pace-watched onClick={() => setAsking(true)} className="min-h-11 text-[15px] font-semibold text-plate-muted">
            I&rsquo;ve already watched it
          </button>
        </>
      ) : (
        <Btn tone="must" wide data-pace-reveal data-pace-ahead={ahead ?? undefined} disabled={busy} onClick={reveal} className={ahead ? "h-auto min-h-[52px] py-2" : ""}>
          {busy ? (
            "Revealing…"
          ) : (
            <span className="flex flex-col items-center leading-tight">
              <span>I&rsquo;ve watched it · Reveal</span>
              {ahead && <small className="text-[12px] font-semibold opacity-80">{ahead}</small>}
            </span>
          )}
        </Btn>
      )}
      {near && (
        <small data-pace-near className="-mb-0.5 text-[13px] leading-snug text-plate-muted">
          {near}
        </small>
      )}
    </div>
  );
}

/** What the reveal did, then the way on: the next episode's move, or how you finished. */
function RevealedSheet({ show, done, onClose }: { show: ShowData; done: { game: GameView; reveal: CatchUpReveal } | null; onClose: () => void }) {
  // The game as it reads now (the reveal refreshed it), for its place.
  const g = done ? ((show.play ?? []).find((x) => x.leagueId === done.game.leagueId) ?? done.game) : null;
  const r = done?.reveal;
  const lineup = !!g?.lineup && !g?.pick;
  return (
    <Sheet open={!!done} onOpenChange={(o) => !o && onClose()} title={r ? `Episode ${r.episode}` : ""} subtitle={g?.gameName}>
      {r && g && (
        <div data-pace-revealed={r.episode} className="flex flex-col gap-3 pb-1">
          <CatchUpResult done={r} />
          {g.you && (
            <p className="text-[14px] text-muted-foreground">
              Through Episode {r.episode}: you&rsquo;re {placeWords(g.you.rank)} of {g.players}.
            </p>
          )}
          {r.next ? (
            <>
              <Btn
                tone="must"
                wide
                data-pace-next
                onClick={() => {
                  onClose();
                  openMoves(lineup ? "lineup" : "pool", g.leagueId);
                }}
              >
                {lineup ? "Set your lineup" : "Pick"} for Episode {r.next}
              </Btn>
              <button type="button" data-pace-later onClick={onClose} className="min-h-11 text-[15px] font-semibold text-muted-foreground">
                Done for now
              </button>
            </>
          ) : (
            <Btn tone="must" wide data-pace-finished onClick={onClose}>
              See how you finished
            </Btn>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** You've seen the last episode: how you finished, and that anyone behind still has it hidden. */
function FinishPlate({ show, g }: { show: ShowData; g: GameView }) {
  const nav = useNav();
  const behind = g.pace!.others.filter((o) => o.week !== null) as { name: string; week: number }[];
  const line = behind.length
    ? `${behind.map((o) => `${o.name} is on Episode ${o.week}`).join(" · ")}: the final standings stay hidden from ${behind.length === 1 ? "them" : "them all"} until they get there.`
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
