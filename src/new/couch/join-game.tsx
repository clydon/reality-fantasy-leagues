"use client";

import { useState } from "react";
import { Check, ChevronLeft, KeyRound, Play, RotateCcw } from "lucide-react";
import { couches, useAfterCouch, useJoinOptions, type CatchUpReveal, type GameView, type JoinGame } from "../data";
import { gameColour } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { Btn, BtnLink } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { Face } from "../show/parts";
import { faceIn, first, openMoves } from "../show/moves";

// Joining a game on the couch (docs/PLAN-new-design.md step 9; the mock's round2.js joinRoute, catchupSheet, catchupStrip
// and catchupStep): each game says who may join it (anyone on the couch, ask first, or nobody new), a game underway asks
// where you start (live, or catching up from the first episode when castaways can be on several teams) and has you
// pick your team, and someone catching up plays one episode at a time from Tonight's strip: make the move, watch it,
// reveal it.

/** The game's one line on the join page or Commercial break: who may join, in plain words. */
export function joinLine(g: JoinGame): string {
  const runner = g.runners[0] ?? "whoever runs it";
  if (g.you?.playing) return "You're in it.";
  if (g.mode === "locked" && g.lockedDown) return `Locked down for the season${g.runners[0] ? ` by ${g.runners[0]}` : ""} (competitive).`;
  if (g.mode === "locked") return `Nobody new this season${g.runners[0] ? `: ${g.runners[0]} closed it` : ""}.`;
  if (g.mode === "ask") {
    if (g.you?.letIn) return `${runner} let you in. Pick where you start.`;
    return g.shared ? `${runner} lets new players in.` : `Players own their castaways, so ${runner} lets new players in.`;
  }
  if (!g.underway) return g.teamSize ? "Anyone on the couch can join. You'll draft with everyone." : "Anyone on the couch can join.";
  return g.shared ? `Anyone can join. Catch up on what you missed, or start from Episode ${g.latest + 1}.` : `Anyone can join from Episode ${g.latest + 1}.`;
}

/**
 * One game you might join: its colour and name, shared or exclusive, who may join, and its button (Join, Ask to join,
 * Asked, Locked, or Open once you're in). `strong`: Join is the one yellow (the invite page, where joining is the point).
 */
export function JoinGameRow({ couchId, g, strong, onJoin }: { couchId: string; g: JoinGame; strong?: boolean; onJoin: (g: JoinGame) => void }) {
  const after = useAfterCouch();
  const [busy, setBusy] = useState(false);
  const runner = g.runners[0] ?? "whoever runs it";
  const canJoin = !g.you?.playing && (g.mode === "open" || (g.mode === "ask" && !!g.you?.letIn));
  const act = async (fn: () => Promise<unknown>, said: string) => {
    setBusy(true);
    try {
      await fn();
      await after();
      toast(said);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-join-game={g.gameName} data-league={g.leagueId} className="border-t border-border py-3.5 first:border-t-0">
      <div className="flex items-center gap-2.5">
        <i className="size-3 flex-none rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
        <b className="type-caption flex-1 text-[20px]">{g.gameName}</b>
        <span className="rounded-[2px] bg-secondary px-2 py-0.5 text-[12px] font-semibold text-muted-foreground">{g.shared ? "Shared" : "Exclusive"}</span>
      </div>
      <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{joinLine(g)}</p>
      <div className="mt-2.5 flex items-center gap-3">
        {g.you?.playing ? (
          g.seasonId && (
            <BtnLink href={paths.show(g.seasonId, "games")} className="h-11">
              Open
            </BtnLink>
          )
        ) : canJoin ? (
          <Btn tone={strong ? "must" : "optional"} className="h-11 px-5" data-join-button onClick={() => onJoin(g)}>
            Join
          </Btn>
        ) : g.mode === "ask" ? (
          g.you?.asked ? (
            <>
              <Btn className="h-11" disabled data-asked>
                Asked · {runner} will see it
              </Btn>
              <button type="button" disabled={busy} className="text-[14px] font-semibold text-muted-foreground" onClick={() => act(() => couches.withdraw(couchId, g.leagueId), "Request taken back")}>
                Take back
              </button>
            </>
          ) : (
            <Btn className="h-11" disabled={busy} data-ask-button onClick={() => act(() => couches.ask(couchId, g.leagueId), `Request sent to ${runner}`)}>
              Ask to join
            </Btn>
          )
        ) : (
          <Btn className="h-11" disabled data-locked>
            <KeyRound className="size-4" aria-hidden />
            Locked
          </Btn>
        )}
      </div>
    </div>
  );
}

/** The episodes aired so far, in words: "Episode 1 has aired", "Episodes 1 to 4 have aired". */
const airedWords = (n: number) => (n === 1 ? "Episode 1 has aired" : `Episodes 1 to ${n} have aired`);

/**
 * Join a game: before it's started, one tap; underway, where you start (the mock's catchupSheet) and then your team
 * from who's left. Joined: the show it's on.
 */
export function JoinGameSheet({ couchId, game, onOpenChange }: { couchId: string; game: JoinGame | null; onOpenChange: (o: boolean) => void }) {
  const [start, setStart] = useState<number | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const opts = useJoinOptions(couchId, game?.leagueId ?? null, start);
  const after = useAfterCouch();
  const nav = useNav();
  // Closed: the next game starts from where you start.
  const openChange = (o: boolean) => {
    if (!o) {
      setStart(null);
      setTeam([]);
    }
    onOpenChange(o);
  };
  const o = opts.data;
  const need = o && o.start === start ? Math.min(o.team, o.pool.length) : 0;
  const picking = !!game && start !== null && !!o && o.start === start && o.team > 0;

  const join = async (s: number | null, picks: string[]) => {
    if (!game || busy) return;
    setBusy(true);
    try {
      const r = await couches.joinGame(couchId, game.leagueId, { start: s, team: picks });
      await after();
      openChange(false);
      toast(r.catchingUp ? `You're in. Catch-up starts at Episode ${r.start}.` : `You're in ${game.gameName}.`);
      if (r.seasonId) nav.push(paths.show(r.seasonId));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const behind = o?.seen !== null && o?.seen !== undefined && game ? o.seen < game.latest : false;
  return (
    <Sheet
      open={!!game}
      onOpenChange={openChange}
      title={picking ? "Pick your team" : `Join ${game?.gameName ?? ""}`}
      subtitle={
        !game
          ? undefined
          : picking
            ? `${need} ${need === 1 ? "castaway" : "castaways"} · from who's still in${game.shared ? "" : " nobody has"} before Episode ${start}`
            : game.underway
              ? `${airedWords(game.latest)}. How do you want to start?`
              : `${game.name} · ${game.players} playing`
      }
    >
      {!game || !o ? (
        <div aria-busy className="h-40 animate-pulse rounded-[3px] bg-background" />
      ) : picking ? (
        <div data-team-pick>
          <button type="button" onClick={() => setStart(null)} className="mb-2 flex items-center gap-1 text-[14px] font-semibold text-muted-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Where you start
          </button>
          <div className="grid grid-cols-4 gap-2">
            {o.pool.map((c) => {
              const on = team.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  data-castaway={c.id}
                  aria-pressed={on}
                  onClick={() => setTeam(on ? team.filter((x) => x !== c.id) : team.length < need ? [...team, c.id] : team)}
                  className={`relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground ${on ? "shadow-[0_0_0_3px_var(--good)]" : ""}`}
                >
                  <Face src={c.photo} name={c.name} className="aspect-[4/4.2] w-full text-[28px]" />
                  {on && (
                    <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-good-foreground">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                  <span className="block px-1.5 pb-1.5 pt-1">
                    <b className="type-caption block truncate text-[14px]">{first(c.name)}</b>
                    <small className="block truncate text-[11px] text-plate-muted">{c.tribe?.name ?? "Still in"}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <Btn tone="must" wide className="sticky bottom-0 mt-4" data-join-confirm disabled={busy || team.length !== need} onClick={() => join(start, team)}>
            {busy ? "Joining…" : team.length === need ? `Join with these ${need}` : `Pick ${need - team.length} more`}
          </Btn>
        </div>
      ) : !o.starts ? (
        <div data-join-simple>
          <p className="text-[15px] leading-snug">{game.teamSize ? "You'll draft with everyone when the draft starts." : "You're in from the next episode."}</p>
          <Btn tone="must" wide className="mt-4" data-join-confirm disabled={busy} onClick={() => join(null, [])}>
            {busy ? "Joining…" : `Join ${game.gameName}`}
          </Btn>
        </div>
      ) : (
        <div data-join-starts>
          <StartChoice
            icon={Play}
            data="live"
            title={`Start from Episode ${o.starts.live}`}
            line={game.teamSize ? "Pick your team from who's still in, and play from this week." : "Make your first pick now. Your streak starts this week."}
            warn={behind ? `You're on Episode ${o.seen}: this shows who's still in after Episode ${game.latest}.` : null}
            disabled={busy}
            onClick={() => (o.team ? setStart(o.starts!.live) : join(o.starts!.live, []))}
          />
          {o.starts.catchUp !== null && (
            <>
              <StartChoice
                icon={RotateCcw}
                data="catchup"
                title={`Catch up from Episode ${o.starts.catchUp}`}
                line="Pick for each episode you've missed, then reveal it, one at a time. Spoiler-free, on your schedule."
                disabled={busy}
                onClick={() => (o.team ? setStart(o.starts!.catchUp) : join(o.starts!.catchUp, []))}
              />
              <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">Catching up runs on the honor system: pick before you&rsquo;ve seen it. It&rsquo;s for fun; nobody&rsquo;s checking.</p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function StartChoice({
  icon: Icon,
  data,
  title,
  line,
  warn,
  disabled,
  onClick,
}: {
  icon: typeof Play;
  data: string;
  title: string;
  line: string;
  warn?: string | null;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-start={data}
      disabled={disabled}
      onClick={onClick}
      className="nd-press mb-2.5 flex w-full items-start gap-3.5 rounded-[3px] bg-background p-3.5 text-left outline-1 -outline-offset-1 outline-input"
    >
      <span className="grid size-12 flex-none place-items-center rounded-[3px] bg-secondary">
        <Icon className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[17px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[14px] leading-snug text-muted-foreground">{line}</small>
        {warn && <small className="mt-1.5 block text-[13px] leading-snug text-chyron-line">{warn}</small>}
      </span>
    </button>
  );
}

// ---------- catching up (Tonight) ----------

const catchUpVerb = (g: GameView) => (g.pick ? "Pick, watch it, then reveal" : g.lineup ? "Set your lineup, watch it, then reveal" : "Watch it, then reveal");

/** Tonight's strip for each game you're catching up in: "Catching up · Episode 2 of 4", and how far along you are. */
export function CatchUpStrips({ show, onOpen }: { show: ShowData; onOpen: (g: GameView) => void }) {
  const games = (show.play ?? []).filter((g) => g.catchUp);
  if (!games.length) return null;
  return (
    <section className="mt-4 flex flex-col gap-2 px-4">
      {games.map((g) => {
        const c = g.catchUp!;
        return (
          <button key={g.leagueId} type="button" data-catchup={g.leagueId} onClick={() => onOpen(g)} className="nd-press flex items-center gap-3 rounded-[4px] bg-card p-3 text-left">
            <span className="type-caption flex-none rounded-[2px] bg-foreground px-2 py-1 text-[11px] tracking-[0.06em] text-background">Catching up</span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">
                Episode {c.week} of {c.latest}
              </b>
              <small className="block text-[13px] leading-snug text-muted-foreground">
                {catchUpVerb(g)} · {g.gameName}
              </small>
            </span>
            <span className="flex w-14 flex-none gap-0.5" aria-hidden>
              {Array.from({ length: Math.min(c.latest, 12) }, (_, i) => (
                <i key={i} className={`h-1.5 flex-1 rounded-full ${i < c.week - 1 ? "bg-foreground" : i === c.week - 1 ? "bg-chyron-line" : "bg-secondary"}`} />
              ))}
            </span>
          </button>
        );
      })}
    </section>
  );
}

/**
 * One episode of your catch-up (the mock's catchupStep): your move for it (Your moves, at that game), then "I've watched
 * it" reveals it in that game alone, and what happened; then the next, until you're caught up and play live.
 */
export function CatchUpSheet({ show, game, onOpenChange }: { show: ShowData; game: GameView | null; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CatchUpReveal | null>(null);
  const after = useAfterCouch();
  const openChange = (o: boolean) => {
    if (!o) setDone(null);
    onOpenChange(o);
  };
  const g = game ? ((show.play ?? []).find((x) => x.leagueId === game.leagueId) ?? game) : null;
  const week = done ? done.episode : (g?.catchUp?.week ?? 0);
  const set = !g ? false : g.pick ? !!g.pick.pick : g.lineup ? g.lineup.set : true;
  const moveWord = !g ? "" : g.pick ? (g.pick.pick ? `Your pick: ${first(faceIn(g, g.pick.pick)?.name ?? "someone")}` : "No pick yet") : g.lineup ? (g.lineup.set ? "Your lineup's set" : "Your lineup isn't set") : "";
  return (
    <Sheet
      open={!!game}
      onOpenChange={openChange}
      title={done ? `Episode ${done.episode}` : `Catch up · Episode ${week}`}
      subtitle={done ? g?.gameName : g?.pick ? "Pick who survives, then reveal when you've watched" : g?.lineup ? "Set your lineup, then reveal when you've watched" : "Reveal when you've watched"}
    >
      {!g ? null : done ? (
        <div data-catchup-result={done.episode}>
          {done.out.length > 0 && (
            <div className="flex gap-2.5">
              {done.out.map((o) => (
                <div key={o.id} className="w-24 overflow-hidden rounded-[3px] bg-plate text-plate-foreground">
                  <Face src={o.photo} name={o.name} out className="aspect-[4/4.2] w-full text-[28px]" />
                  <b className="type-caption block truncate px-1.5 py-1 text-[14px]">{first(o.name)} out</b>
                </div>
              ))}
            </div>
          )}
          {done.game && (
            <p className="mt-3 text-[16px] leading-snug">
              <b className="block">{done.game.title}</b>
              <span className="text-muted-foreground">{done.game.line}</span>
            </p>
          )}
          {done.lineup && (
            <p className="mt-2 text-[15px] text-muted-foreground">
              Your lineup: <b className="text-foreground">{done.lineup.total >= 0 ? "+" : ""}{done.lineup.total}</b>
            </p>
          )}
          {done.next ? (
            <Btn tone="must" wide className="mt-4" data-catchup-next onClick={() => setDone(null)}>
              Next: Episode {done.next}
            </Btn>
          ) : (
            <>
              <p className="mt-4 text-[15px] leading-snug">All caught up. From here you play live with everyone.</p>
              <Btn tone="ink" wide className="mt-3" onClick={() => openChange(false)}>
                Done
              </Btn>
            </>
          )}
        </div>
      ) : (
        <div data-catchup-step={week}>
          {(g.pick || g.lineup) && (
            <button
              type="button"
              data-catchup-move
              onClick={() => {
                openChange(false);
                openMoves(g.pick ? "pool" : "lineup", g.leagueId);
              }}
              className="nd-press flex min-h-[60px] w-full items-center gap-3 rounded-[3px] bg-background px-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold">{moveWord}</b>
                <small className="block text-[13px] text-muted-foreground">For Episode {week} · {g.gameName}</small>
              </span>
              <span className="text-[15px] font-semibold text-chyron-line">{set ? "Change" : g.pick ? "Pick" : "Set"}</span>
            </button>
          )}
          {!set && <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">Reveal without one and this episode counts for nothing for you.</p>}
          <Btn
            tone={set ? "must" : "optional"}
            wide
            className="mt-4"
            data-catchup-reveal
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await couches.catchUp(show.header?.seasonId ?? "", show.couch?.id ?? null, g.leagueId);
                await after();
                setDone(r);
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Revealing…" : `I've watched it · Reveal Episode ${week}`}
          </Btn>
        </div>
      )}
    </Sheet>
  );
}
