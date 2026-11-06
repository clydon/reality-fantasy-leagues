"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { couches, draftAct, gamesApi, useAfterCouch, type CatchUpReveal, type GameView } from "../data";
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
      {games.map((g) =>
        g.pace?.draft ? (
          <DraftPlate key={g.leagueId} show={show} g={g} />
        ) : g.pace?.team ? (
          <TeamPlate key={g.leagueId} g={g} />
        ) : g.pace?.gather ? (
          <GatherPlate key={g.leagueId} show={show} g={g} onRevealed={(reveal) => setDone({ game: g, reveal })} />
        ) : g.catchUp ? (
          <PacePlate key={g.leagueId} show={show} g={g} onRevealed={(reveal) => setDone({ game: g, reveal })} />
        ) : (
          <FinishPlate key={g.leagueId} show={show} g={g} />
        )
      )}
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

/** Exclusive teams at your own pace (sync point 1): before anyone plays, everyone drafts together in the usual draft room, on the
 *  cast as it stood before the start. Whoever runs the game starts it; then it's the draft room for everyone. */
function DraftPlate({ show, g }: { show: ShowData; g: GameView }) {
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
        Before Episode {week} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">{live ? "The draft's on" : "Draft together"}</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        Take turns picking from who was still in before Episode {week}. Each person on one team. Then everyone plays at their own pace.
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
 * to wait, in words only (the user's pick): "OK, I'll wait", and the next episode's plate stays a tap away under Go on. Once
 * everyone's there, its waiver week is on: the usual waivers page.
 */
function GatherPlate({ show, g, onRevealed }: { show: ShowData; g: GameView; onRevealed: (r: CatchUpReveal) => void }) {
  const nav = useNav();
  const [goOn, setGoOn] = useState(false);
  const [waits, setWaits] = useState(false);
  const gather = g.pace!.gather!;
  const lost = gather.lost.map((l) => `${first(l.name)} went home from ${l.yours ? "your" : `${l.team}'s`} team`).join(" · ");
  if (gather.open) {
    return (
      <div data-pace-waivers={g.leagueId} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
        <span className={TAG}>
          After Episode {gather.episode} · {g.gameName}
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
  if (goOn && g.catchUp) return <PacePlate show={show} g={g} onRevealed={onRevealed} />;
  return (
    <div data-pace-gather={g.leagueId} data-pace-gather-episode={gather.episode} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        After Episode {gather.episode} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">Waivers after Episode {gather.episode}</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        {lost}. Wait for everyone else before watching more episodes, so the waivers are fair.
      </p>
      <p className="text-[13px] leading-snug text-plate-muted">
        Waiting on {namesLine(gather.waiting)}.
      </p>
      {waits ? (
        <small className="text-[13px] text-plate-muted">Thanks: the waivers open once everyone&rsquo;s on Episode {gather.episode}.</small>
      ) : (
        <Btn tone="ink" wide data-pace-gather-wait onClick={() => setWaits(true)}>
          OK, I&rsquo;ll wait
        </Btn>
      )}
      {g.catchUp && (
        <button type="button" data-pace-gather-go onClick={() => setGoOn(true)} className="min-h-11 text-[14px] font-semibold text-plate-muted">
          Go on to Episode {g.catchUp.week} anyway
        </button>
      )}
    </div>
  );
}

/** A game with teams where yours isn't picked yet (part 3a): the plate's first step, before Pick · Watch · Reveal. */
function TeamPlate({ g }: { g: GameView }) {
  const [open, setOpen] = useState(false);
  const team = g.pace!.team!;
  const week = g.catchUp?.week ?? 1;
  return (
    <div data-pace-team-plate={g.leagueId} className="flex flex-col gap-2.5 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
      <span className={TAG}>
        Before Episode {week} · {g.gameName}
      </span>
      <b className="type-caption text-[28px] leading-none">Pick your team</b>
      <p className="text-[14px] leading-snug text-plate-muted">
        {team.need} from who was still in before Episode {week}. They&rsquo;re yours for the whole game.
      </p>
      <Btn tone="must" wide data-pace-team-open onClick={() => setOpen(true)}>
        Pick your team
      </Btn>
      <TeamSheet g={g} open={open} onOpenChange={setOpen} />
    </div>
  );
}

/** Who you can have, as faces: tap to take, tap again to put back; the button counts down to your team. */
function TeamSheet({ g, open, onOpenChange }: { g: GameView; open: boolean; onOpenChange: (o: boolean) => void }) {
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
    <Sheet open={open} onOpenChange={onOpenChange} title="Pick your team" subtitle={`${need} · from who was still in before Episode ${g.catchUp?.week ?? 1}`}>
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
