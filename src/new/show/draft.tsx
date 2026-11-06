"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Check, Eye, Hand, Lock, Settings, Shuffle, Star, Undo2, Users, X } from "lucide-react";
import { airTime, calm, timeOf, ticks } from "../clock";
import { backstage, draftAct, useSeasonDraft, type DraftAction, type DraftFace, type DraftGame, type DraftSeat } from "../data";
import { gameColour } from "../games";
import { useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, useShow, type ShowData } from "../screens/show-space";
import { Avatar, useNow } from "../ui/bars";
import { Btn, BtnLink, EmptyState } from "../ui/parts";
import { useShown } from "../ui/loaded";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { first } from "./moves";
import { Face } from "./parts";

// The draft room and the blind draft (docs/PLAN-new-design.md step 7; the mock's draft.js), pushed over a show from
// Tonight's move card, the dock and the show's ⋯ menu. Casual first: no timer unless the Commissioner sets one, nobody
// picked for automatically, and whoever runs the game can always pick for someone (helping a friend over the phone): a
// pick made for someone is a line in Recent changes, with Undo while it's the draft's last.
//
// The draft room (a turn-based draft: each castaway on one team): the ticker of recent picks, who's on the clock, the
// order as faces, then Available (the cast by tribe, Show taken, a star to queue someone), Teams and Your queue; tap a
// castaway when you're up, then Draft. Before it starts: the order and the cast to star, and the Commissioner's Start.
// The blind draft (castaways on several teams): pick your whole team in private, lock in, then everyone's teams turn
// over together. Nobody's picks are ever read before then, the Commissioner's included: picking for someone starts empty.
//
// Polled while open (data.ts draftPoll: 4 s live, 15 s waiting); every write goes through /api/seasons/[id]/draft.

const SLOW_MS = 3 * 60 * 1000;
const pts = (n: number) => `${Math.round(n * 10) / 10} ${Math.abs(n) === 1 ? "pt" : "pts"}`;

/** What the draft page shows: `?game=`, else the first draft of this kind that needs you, else the first. */
function pickGame(games: DraftGame[], asked: string | null): DraftGame | null {
  return (
    games.find((g) => g.leagueId === asked) ??
    games.find((g) => g.phase === "live" && (g.kind === "snake" ? g.clock?.playerId === g.you : !g.locked.includes(g.you ?? ""))) ??
    games.find((g) => g.phase !== "done") ??
    games[0] ??
    null
  );
}

function useAfterDraft(seasonId: string) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["new-design", "draft", seasonId] }),
      client.invalidateQueries({ queryKey: ["new-design", "home"] }),
      client.invalidateQueries({ queryKey: ["new-design", "games", seasonId] }),
      client.invalidateQueries({ queryKey: ["new-design", "changes", seasonId] }),
    ]);
}

/** A draft write with its toast (and the toast's Undo when it made a line in Recent changes); false when it failed. */
function useDraftWrite(seasonId: string, show: ShowData) {
  const after = useAfterDraft(seasonId);
  return async (leagueId: string, body: DraftAction, said?: string): Promise<boolean> => {
    try {
      const out = await draftAct(seasonId, leagueId, body);
      await after();
      if (said) {
        const couchId = show.couch?.id;
        const batch = out.batch;
        toast(
          said,
          batch && couchId
            ? {
                undo: async () => {
                  try {
                    await backstage.undo(seasonId, couchId, batch);
                    await after();
                    toast("Undone");
                  } catch (e) {
                    toast.quiet((e as Error).message);
                  }
                },
              }
            : {}
        );
      }
      return true;
    } catch (e) {
      await after();
      toast.quiet((e as Error).message);
      return false;
    }
  };
}

// ---------- the page ----------

export function DraftScreen({ seasonId, kind }: { seasonId: string; kind: "snake" | "blind" }) {
  const show = useShow(seasonId);
  const nav = useNav();
  const couchId = show.couch?.id ?? null;
  const data = useSeasonDraft(seasonId, couchId, { poll: true, enabled: !!show.home });
  const asked = useSearchParams().get("game");
  const [chosen, setChosen] = useState<string | null>(asked);
  const [settings, setSettings] = useState(false);
  const games = (data.data?.games ?? []).filter((g) => g.kind === kind);
  const game = pickGame(games, chosen);
  const name = show.header?.show.name ?? "Show";
  const leave = () => nav.back(paths.show(seasonId), isTabOf(seasonId));
  const sub = game ? [game.name, show.header ? `${name.replace(/^The /, "")}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : null, kind === "snake" ? "snake" : "shared"].filter(Boolean).join(" · ") : "";

  return (
    <div className="flex min-h-dvh flex-col pb-28" data-draft={kind}>
      <header className="sticky top-0 z-20 grid h-14 grid-cols-[44px_1fr_44px] items-center gap-1.5 border-b border-border bg-background/95 px-1.5 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md">
        <button type="button" onClick={leave} aria-label="Leave the draft" className="grid size-11 place-items-center rounded-[3px]">
          <X className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 text-center leading-tight">
          <b className="type-caption block truncate text-[19px]">{game ? `${kind === "blind" ? "Blind" : game.gameName} draft` : kind === "blind" ? "Blind draft" : "Draft room"}</b>
          <small className="block truncate text-xs text-muted-foreground">{sub}</small>
        </div>
        {game?.commissioner && game.phase !== "done" ? (
          <button type="button" onClick={() => setSettings(true)} aria-label="Draft settings" data-draft-settings className="grid size-11 place-items-center rounded-[3px]">
            <Settings className="size-5" aria-hidden />
          </button>
        ) : (
          <span />
        )}
      </header>

      {games.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]" role="group" aria-label="Game">
          {games.map((g) => (
            <button
              key={g.leagueId}
              type="button"
              data-draft-game={g.leagueId}
              aria-pressed={g.leagueId === game?.leagueId}
              onClick={() => setChosen(g.leagueId)}
              className={`flex h-9 flex-none items-center gap-2 rounded-[2px] px-3 text-sm font-semibold ${g.leagueId === game?.leagueId ? "bg-foreground text-background" : "bg-secondary"}`}
            >
              <i className="size-2.5 rounded-full" style={{ background: gameColour(g.gameName) }} aria-hidden />
              {g.name}
            </button>
          ))}
        </div>
      )}

      {data.error ? (
        <EmptyState icon={Users} title="Couldn't load the draft" line={(data.error as Error).message} />
      ) : !data.data ? (
        <div aria-busy className="mx-4 mt-4 flex flex-col gap-3">
          <div className="h-16 animate-pulse rounded-[4px] bg-card" />
          <div className="h-72 animate-pulse rounded-[4px] bg-card" />
        </div>
      ) : !game ? (
        <EmptyState
          icon={Users}
          title={kind === "blind" ? "No blind draft here" : "No draft room here"}
          line={kind === "blind" ? "None of your games on this show picks teams in private." : "None of your games on this show drafts in turn."}
        />
      ) : game.revealFirst ? (
        <EmptyState
          icon={Eye}
          title={`Reveal Episode ${game.revealFirst} first`}
          line="Who's left to draft would give away who went home."
          action={
            // Ways out of the draft replace it (back to the show's tab when it's right behind): back from the show never returns here.
            <BtnLink tone="must" wide href={paths.show(seasonId)} replace>
              To Episode {game.revealFirst}&apos;s results
            </BtnLink>
          }
        />
      ) : !game.castReady && game.phase === "waiting" ? (
        <EmptyState icon={Users} title="The cast isn't in yet" line="Once the season's cast is in, the draft can start. Whoever runs the game adds it." />
      ) : game.kind === "snake" ? (
        game.phase === "done" ? (
          <DraftDone key={game.leagueId} seasonId={seasonId} show={show} game={game} />
        ) : (
          <SnakeRoom key={game.leagueId} seasonId={seasonId} show={show} game={game} onSettings={() => setSettings(true)} />
        )
      ) : game.phase === "done" ? (
        <BlindReveal key={game.leagueId} seasonId={seasonId} show={show} game={game} />
      ) : (
        <BlindRoom key={game.leagueId} seasonId={seasonId} show={show} game={game} onSettings={() => setSettings(true)} />
      )}

      {game && <DraftSettings seasonId={seasonId} show={show} game={game} open={settings} onOpenChange={setSettings} />}
    </div>
  );
}

// ---------- shared parts ----------

/** "Survivor 51": the show and its season, for Go to. */
const showName = (show: ShowData) => `${(show.header?.show.name ?? "the show").replace(/^The /, "")}${show.header?.seasonNumber ? ` ${show.header.seasonNumber}` : ""}`;
const seatOf = (game: DraftGame, playerId: string | null | undefined): DraftSeat | undefined => game.seats.find((s) => s.playerId === playerId);
const seatName = (game: DraftGame, playerId: string | null | undefined) => {
  const s = seatOf(game, playerId);
  return s?.you ? "You" : (s?.name ?? "someone");
};

function SeatFace({ game, playerId, size = 30 }: { game: DraftGame; playerId: string; size?: number }) {
  const s = seatOf(game, playerId);
  return <Avatar id={s?.userId ?? playerId} name={s?.name ?? "?"} size={size} />;
}

/** The clock card (the mock's .clock): who's up and what they're doing, an icon or face on its left. */
function ClockCard({ tone, lead, kick, line, end }: { tone: "you" | "away" | "quiet"; lead: ReactNode; kick: ReactNode; line: ReactNode; end?: ReactNode }) {
  return (
    <div
      data-clock={tone}
      className={`relative mx-4 mt-3 flex items-center gap-3 overflow-hidden rounded-[4px] px-3 py-2.5 ${
        tone === "you" ? "nd-onclock bg-plate text-plate-foreground" : "bg-card"
      } ${tone === "away" ? "outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input" : ""}`}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <span className={`type-caption block text-[13px] tracking-[0.06em] ${tone === "you" ? "text-plate-line" : "text-muted-foreground"}`}>{kick}</span>
        <b className="mt-[3px] block text-[15px] leading-snug">{line}</b>
      </div>
      {end}
    </div>
  );
}

/** A castaway's tile on the board (the mock's .dtile): photo, tribe, name, points or tribe; a star to queue them. */
function Tile({
  face,
  selected,
  taken,
  starred,
  onTap,
  onStar,
  disabled,
}: {
  face: DraftFace;
  selected?: boolean;
  taken?: { name: string; id: string } | null;
  starred?: boolean;
  onTap?: () => void;
  onStar?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        data-tile={face.id}
        aria-pressed={selected}
        aria-label={`${face.name}${taken ? `, taken by ${taken.name}` : ""}`}
        disabled={disabled}
        onClick={onTap}
        className={`relative isolate flex aspect-[3/4] w-full flex-col justify-end overflow-hidden rounded-[3px] p-1.5 text-left text-white transition-[transform,box-shadow] duration-300 ${
          selected ? "-translate-y-0.5 shadow-[0_0_0_3px_var(--chyron-line)]" : ""
        }`}
      >
        <Face src={face.photo} name={face.name} className={`absolute inset-0 -z-20 size-full ${taken ? "brightness-[.45] grayscale" : ""}`} />
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_45%,rgba(10,8,14,.92))]" aria-hidden />
        {face.tribe && <span className="absolute left-1.5 top-1.5 size-[9px] rounded-[1px]" style={{ background: face.tribe.colour }} aria-hidden />}
        <b className="type-caption block truncate text-[15px]">{first(face.name)}</b>
        <small className="block truncate text-[10.5px] opacity-85">{face.points != null ? `${pts(face.points)} so far` : (face.tribe?.name ?? "")}</small>
      </button>
      {taken ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5">
          <Avatar id={taken.id} name={taken.name} size={22} />
        </span>
      ) : onStar ? (
        <button
          type="button"
          data-star={face.id}
          aria-pressed={starred}
          aria-label={starred ? `Take ${first(face.name)} out of your queue` : `Queue ${first(face.name)}`}
          onClick={onStar}
          className={`absolute right-1 top-1 grid size-[30px] place-items-center rounded-full ${starred ? "bg-chyron text-chyron-foreground" : "bg-[rgba(16,14,21,.6)] text-white/75"}`}
        >
          <Star className="size-[15px]" fill={starred ? "currentColor" : "none"} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Tribe chips (All and each tribe), and Show taken where there's something taken to show. */
function useFilter(cast: DraftFace[]) {
  const [tribe, setTribe] = useState("All");
  const tribes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of cast) if (c.tribe && !seen.has(c.tribe.name)) seen.set(c.tribe.name, c.tribe.colour);
    return [...seen.entries()];
  }, [cast]);
  const chips = (extra?: ReactNode) =>
    tribes.length > 1 || extra ? (
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
        {tribes.length > 1 &&
          [["All", ""] as [string, string], ...tribes].map(([t, colour]) => (
            <button
              key={t}
              type="button"
              aria-pressed={tribe === t}
              onClick={() => setTribe(t)}
              className={`flex h-9 flex-none items-center gap-1.5 rounded-[2px] px-3 text-sm font-semibold ${tribe === t ? "bg-foreground text-background" : "bg-secondary"}`}
            >
              {colour && <i className="size-2.5 rounded-[1px]" style={{ background: colour }} aria-hidden />}
              {t}
            </button>
          ))}
        {extra}
      </div>
    ) : null;
  return { keep: (c: DraftFace) => tribe === "All" || c.tribe?.name === tribe, chips };
}

/** Your queue: a star adds or takes someone out, shown at once and saved straight away (then the server's copy again). */
function useQueue(seasonId: string, show: ShowData, game: DraftGame) {
  const [pending, setPending] = useState<string[] | null>(null);
  const write = useDraftWrite(seasonId, show);
  const queue = pending ?? game.queue;
  const toggle = async (id: string, name: string) => {
    const next = queue.includes(id) ? queue.filter((x) => x !== id) : [...queue, id];
    setPending(next);
    toast(next.includes(id) ? `${first(name)} queued` : `${first(name)} unqueued`);
    await write(game.leagueId, { action: "queue", castawayIds: next });
    setPending(null);
  };
  return { queue, toggle };
}

function Segments<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, ReactNode][] }) {
  return (
    <div className="mx-4 mt-3 flex gap-[3px] rounded-[3px] bg-card p-[3px]" role="tablist">
      {items.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          data-seg={k}
          onClick={() => onChange(k)}
          className={`h-9 flex-1 rounded-[2px] text-[13px] font-bold ${value === k ? "bg-foreground text-background" : "text-muted-foreground"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** A team as a row of faces (the mock's .dteam): picked faces, then dashed empty slots up to the team's size. */
function TeamRow({ game, playerId, ids, big }: { game: DraftGame; playerId: string; ids: string[]; big?: boolean }) {
  const s = seatOf(game, playerId);
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const slots = Math.max(game.size, ids.length);
  const box = big ? "size-11" : "size-10";
  return (
    <div data-team={playerId} className={`flex min-h-16 items-center gap-2.5 border-t border-border ${s?.you ? "-mx-2 rounded-[3px] border-transparent bg-secondary px-2" : ""}`}>
      <SeatFace game={game} playerId={playerId} size={big ? 36 : 30} />
      <b className="w-[72px] flex-none truncate text-[15px]">{s?.name ?? "someone"}</b>
      <span className="ml-auto flex min-w-0 flex-wrap justify-end gap-[5px] py-2">
        {Array.from({ length: slots }, (_, k) => {
          const c = faces.get(ids[k]);
          return c ? (
            <Face key={k} src={c.photo} name={c.name} out={c.left} title={c.name} className={`${box} rounded-[3px]`} />
          ) : (
            <i key={k} className={`${box} rounded-[3px] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input`} aria-hidden />
          );
        })}
      </span>
    </div>
  );
}

// ---------- the turn-based draft ----------

function SnakeRoom({ seasonId, show, game, onSettings }: { seasonId: string; show: ShowData; game: DraftGame; onSettings: () => void }) {
  const write = useDraftWrite(seasonId, show);
  const live = game.phase === "live";
  const clock = game.clock;
  // Seconds only while a pick timer counts down; without one, a minute is enough to see a turn dragging on.
  const now = useNow(!!clock?.endsAt);
  const [view, setView] = useState<"board" | "teams" | "queue">("board");
  const [showTaken, setShowTaken] = useState(false);
  const [picking, setForWho] = useState<string | null>(null);
  const [sel, setSel] = useState<{ n: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { queue, toggle } = useQueue(seasonId, show, game);
  const { keep, chips } = useFilter(game.cast);

  const mine = !!clock && clock.playerId === game.you;
  // Picking for someone lasts their turn: once anyone picks, it's over.
  const forWho = picking && clock?.playerId === picking ? picking : null;
  const acting = !!clock && (mine || forWho === clock.playerId);
  const selected = sel && clock && sel.n === clock.n && !game.owners[sel.id] ? game.cast.find((c) => c.id === sel.id) : null;
  const ownerOf = (id: string) => game.owners[id]?.[0];
  const available = game.cast.filter((c) => !ownerOf(c.id));
  const since = clock?.since ? Date.parse(clock.since) : null;
  const ends = clock?.endsAt ? Date.parse(clock.endsAt) : null;
  const timeUp = ends != null && now >= ends;
  const slow = !!clock && !mine && (timeUp || (ends == null && since != null && now - since > SLOW_MS));
  const onClock = clock ? (seatOf(game, clock.playerId)?.name ?? "someone") : "";

  // The pick timer ran out and the game picks from their queue: anyone here says so, and the server checks the clock.
  const expired = useRef<number | null>(null);
  useEffect(() => {
    if (!clock || ends == null || game.away !== "queue" || expired.current === clock.n) return;
    const wait = Math.max(0, ends - Date.now()) + 800;
    const t = setTimeout(() => {
      expired.current = clock.n;
      void draftAct(seasonId, game.leagueId, { action: "expire", n: clock.n }).catch(() => {});
    }, wait);
    return () => clearTimeout(t);
  }, [clock, ends, game.away, game.leagueId, seasonId]);

  // The order strip keeps the pick on the clock in view.
  const strip = useRef<HTMLDivElement>(null);
  // Once it's on screen (ui/loaded.tsx).
  const shown = useShown();
  useEffect(() => {
    if (shown) strip.current?.querySelector<HTMLElement>("[data-now]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [clock?.n, shown]);

  async function draft() {
    if (!selected || !clock || busy) return;
    setBusy(true);
    const forName = forWho ? onClock : null;
    const ok = await write(game.leagueId, { action: "pick", castawayId: selected.id, n: clock.n }, forName ? `${first(selected.name)} drafted for ${forName}` : `You drafted ${first(selected.name)}`);
    setBusy(false);
    if (ok) {
      setSel(null);
      setForWho(null);
    }
  }

  const tap = (c: DraftFace) => {
    if (!live) return toast.quiet("The draft hasn't started. Star castaways to queue them.");
    if (!acting) return toast.quiet(`It's ${onClock}'s pick. Star castaways to queue them.`);
    setSel(sel?.id === c.id ? null : { n: clock!.n, id: c.id });
  };

  const latest = game.picks.slice(-6).reverse();
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const list = (showTaken ? game.cast : available).filter(keep);

  return (
    <>
      {live && (
        <div data-ticker className="flex gap-4 overflow-hidden whitespace-nowrap border-b border-border bg-panel-menu px-4 py-2 text-xs text-muted-foreground [mask-image:linear-gradient(90deg,#000_80%,transparent)]">
          {latest.length ? (
            latest.map((p, i) => (
              <span key={p.n} className={i === 0 ? "nd-rise text-foreground" : ""}>
                R{p.round}·{p.inRound} <b className="font-bold text-foreground">{seatOf(game, p.playerId)?.name ?? "someone"}</b> {p.castawayId ? first(faces.get(p.castawayId)?.name ?? "") : ""}
                {p.by && <em className="not-italic text-chyron-line"> by {p.by}</em>}
                {p.auto && <em className="not-italic text-chyron-line"> from their queue</em>}
              </span>
            ))
          ) : (
            <span>The draft is open. {seatName(game, game.turns[0])} {game.turns[0] === game.you ? "pick" : "picks"} first.</span>
          )}
        </div>
      )}

      {live && clock ? (
        <ClockCard
          tone={mine ? "you" : slow ? "away" : "quiet"}
          lead={<SeatFace game={game} playerId={clock.playerId} size={44} />}
          kick={mine ? "You're up" : slow ? `${onClock} hasn't picked yet` : `${onClock} is picking`}
          line={
            mine
              ? `Round ${clock.round} · pick ${clock.n}${ends != null ? ` · ${timeUp ? "time's up" : `${calm(ends, now)} left`}` : ""}`
              : slow
                ? `${clock.nudged ? "Nudged · waiting for them" : timeUp ? "Time's up · waiting for them" : `Their turn since ${timeOf(since!)}`}`
                : ends != null
                  ? `Round ${clock.round} · ${calm(ends, now)} left`
                  : `Round ${clock.round} · no rush, no timer`
          }
          end={
            !mine && game.runs && slow ? (
              <div className="flex flex-none flex-col gap-1.5">
                {!clock.nudged && (
                  <button
                    type="button"
                    data-nudge
                    onClick={async () => {
                      if (await write(game.leagueId, { action: "nudge", n: clock.n })) toast(`Nudged ${onClock}: "You're up in the ${game.gameName} draft"`);
                    }}
                    className="h-9 rounded-[3px] bg-card px-3 text-[13px] font-bold outline-1 -outline-offset-1 outline-input"
                  >
                    Nudge
                  </button>
                )}
                {forWho !== clock.playerId && (
                  <button
                    type="button"
                    data-pick-for={clock.playerId}
                    onClick={() => {
                      setForWho(clock.playerId);
                      setView("board");
                    }}
                    className="h-9 rounded-[3px] bg-card px-3 text-[13px] font-bold outline-1 -outline-offset-1 outline-input"
                  >
                    Pick for {first(onClock)}
                  </button>
                )}
              </div>
            ) : null
          }
        />
      ) : (
        <WaitingCard seasonId={seasonId} show={show} game={game} onSettings={onSettings} />
      )}

      {/* Whoever runs the game can always pick for someone; it's a button on the clock once their turn drags on. */}
      {live && clock && !mine && game.runs && !slow && !forWho && (
        <p className="px-4 pt-1.5 text-right text-[13px] text-muted-foreground">
          Helping {first(onClock)}?{" "}
          <button
            type="button"
            data-pick-for={clock.playerId}
            onClick={() => {
              setForWho(clock.playerId);
              setView("board");
            }}
            className="h-8 font-bold text-foreground underline underline-offset-2"
          >
            Pick for them
          </button>
        </p>
      )}

      {forWho && (
        <div data-for-bar className="mx-4 mt-2 flex items-center gap-2 rounded-[3px] bg-[rgba(255,197,49,.12)] px-2.5 py-2 text-[13px] outline-1 -outline-offset-1 outline-chyron-line">
          <Hand className="size-4 flex-none text-chyron-line" aria-hidden />
          <span className="flex-1">
            Picking for <b>{onClock}</b> · on the phone with them?
          </span>
          <button
            type="button"
            onClick={() => {
              setForWho(null);
              setSel(null);
            }}
            className="font-bold text-chyron-line"
          >
            Cancel
          </button>
        </div>
      )}

      {!live && <OrderList seasonId={seasonId} show={show} game={game} />}

      {live && (
        <div ref={strip} data-order-strip className="flex gap-1 overflow-x-auto px-4 pb-0.5 pt-2.5 [scrollbar-width:none]" aria-label="Pick order">
          {game.turns.map((p, i) => {
            const made = game.picks[i];
            const c = made?.castawayId ? faces.get(made.castawayId) : null;
            const cur = i === game.made;
            return (
              <span
                key={i}
                data-now={cur || undefined}
                title={`Pick ${i + 1}: ${seatOf(game, p)?.name ?? ""}`}
                className={`relative grid size-[26px] flex-none place-items-center overflow-hidden rounded-[3px] ${cur ? "opacity-100 outline-2 outline-offset-1 outline-chyron" : made ? "opacity-90" : p === game.you ? "opacity-90" : "opacity-55"}`}
              >
                {c ? <Face src={c.photo} name={c.name} className="size-full" /> : <SeatFace game={game} playerId={p} size={22} />}
              </span>
            );
          })}
        </div>
      )}

      <Segments
        value={view}
        onChange={setView}
        items={[
          ["board", <>Available <b className="type-num ml-0.5 text-[15px]">{available.length}</b></>],
          ...(live ? [["teams", "Teams"] as ["teams", ReactNode]] : []),
          ["queue", <>Your queue <b className="type-num ml-0.5 text-[15px]">{queue.filter((id) => !ownerOf(id)).length}</b></>],
        ]}
      />

      {view === "board" && (
        <>
          {chips(
            game.made > 0 ? (
              <button type="button" aria-pressed={showTaken} onClick={() => setShowTaken((v) => !v)} className={`flex h-9 flex-none items-center rounded-[2px] px-3 text-sm font-semibold ${showTaken ? "bg-foreground text-background" : "bg-secondary"}`}>
                Show taken
              </button>
            ) : undefined
          )}
          <div className="grid grid-cols-3 gap-[7px] px-4 pb-5 pt-3">
            {list.map((c) => {
              const owner = ownerOf(c.id);
              return (
                <Tile
                  key={c.id}
                  face={c}
                  selected={selected?.id === c.id}
                  taken={owner ? { id: seatOf(game, owner)?.userId ?? owner, name: seatOf(game, owner)?.name ?? "someone" } : null}
                  starred={queue.includes(c.id)}
                  disabled={!!owner}
                  onTap={() => tap(c)}
                  onStar={game.you ? () => void toggle(c.id, c.name) : undefined}
                />
              );
            })}
          </div>
          {!list.length && <p className="px-4 py-6 text-sm text-muted-foreground">Nobody here: everyone in this tribe has gone.</p>}
        </>
      )}

      {view === "teams" && (
        <div className="px-4 pt-2">
          {game.seats.map((s) => (
            <TeamRow key={s.playerId} game={game} playerId={s.playerId} ids={game.teams.find((t) => t.playerId === s.playerId)?.castawayIds ?? []} />
          ))}
        </div>
      )}

      {view === "queue" && (
        <div className="pt-3">
          <p className="px-4 text-[13px] leading-snug text-muted-foreground">
            Star castaways on the board. When you&rsquo;re up, your queue is ready.{" "}
            {game.timer && game.away === "queue" ? "If your time runs out, the first of them still free is drafted for you." : "Nobody auto-picks from it."}
          </p>
          <div className="mt-2">
            {queue.map((id, i) => {
              const c = faces.get(id);
              if (!c) return null;
              const owner = ownerOf(id);
              return (
                <div key={id} data-queue-row={id} className={`mx-4 flex min-h-[62px] items-center gap-2.5 border-t border-border ${owner ? "opacity-45" : ""}`}>
                  <span className="type-num w-5 text-[20px] text-muted-foreground">{i + 1}</span>
                  <Face src={c.photo} name={c.name} className="size-[42px] rounded-[3px]" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px]">{c.name}</b>
                    <small className="block text-xs text-muted-foreground">{owner ? `Taken by ${seatName(game, owner)}` : [c.tribe?.name, c.points != null ? pts(c.points) : null].filter(Boolean).join(" · ")}</small>
                  </span>
                  {!owner && acting && (
                    <button
                      type="button"
                      onClick={() => {
                        setSel({ n: clock!.n, id });
                        setView("board");
                      }}
                      className="h-9 rounded-[3px] bg-card px-3 text-[13px] font-bold outline-1 -outline-offset-1 outline-input"
                    >
                      Draft
                    </button>
                  )}
                </div>
              );
            })}
            {!queue.length && <p className="px-4 py-4 text-muted-foreground">Nobody queued yet.</p>}
          </div>
        </div>
      )}

      {acting && clock && (
        <div data-confirm className="nd-fixed-x nd-dock fixed bottom-0 z-30 flex items-center gap-2.5 border-t border-border bg-card px-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-10px_24px_rgba(0,0,0,.35)]">
          {selected ? (
            <>
              <Face src={selected.photo} name={selected.name} className="size-[46px] rounded-[3px]" />
              <span className="min-w-0 flex-1">
                <small className="block text-xs text-muted-foreground">{forWho ? `For ${onClock} · round ${clock.round}` : `Your round ${clock.round} pick`}</small>
                <b className="type-caption block truncate text-[22px]">{first(selected.name)}</b>
              </span>
              <Btn tone="must" data-draft-go disabled={busy} onClick={draft} className="h-12">
                Draft {first(selected.name)}
              </Btn>
            </>
          ) : (
            <span className="flex-1">
              <small className="block text-xs text-muted-foreground">{forWho ? `Picking for ${onClock}` : "You're up"}</small>
              <b className="text-base">Tap a castaway</b>
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** Before the draft starts: when it does, and the Commissioner's Start and Pick a time (Draft settings). */
function WaitingCard({ seasonId, show, game, onSettings }: { seasonId: string; show: ShowData; game: DraftGame; onSettings: () => void }) {
  const write = useDraftWrite(seasonId, show);
  const at = game.scheduledAt ? Date.parse(game.scheduledAt) : null;
  const now = useNow(at != null && ticks(at));
  return (
    <>
      <ClockCard
        tone="quiet"
        lead={
          <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-secondary text-chyron-line">
            {game.kind === "blind" ? <Eye className="size-5" aria-hidden /> : <Users className="size-5" aria-hidden />}
          </span>
        }
        kick={game.kind === "blind" ? "Blind draft" : "The draft"}
        line={at != null ? `Starts ${airTime(at)} · ${calm(at, now)}` : game.commissioner ? "Start it when everyone's in" : "Not started yet · whoever runs the game starts it"}
      />
      {game.commissioner && (
        <div className="mx-4 mt-3 flex gap-2">
          <Btn data-pick-time onClick={onSettings} className="flex-none">
            {at != null ? "Change time" : "Pick a time"}
          </Btn>
          <Btn
            tone="must"
            className="flex-1"
            data-draft-start
            onClick={async () => {
              if (await write(game.leagueId, { action: "start" })) toast(game.kind === "blind" ? "The draft is open: everyone can pick" : `The draft is open: ${seatName(game, game.turns[0])} ${game.turns[0] === game.you ? "pick" : "picks"} first`);
            }}
          >
            Start the draft now
          </Btn>
        </div>
      )}
    </>
  );
}

/** Before a turn-based draft starts: the order, picks going down the list and back up; the Commissioner can shuffle it. */
function OrderList({ seasonId, show, game }: { seasonId: string; show: ShowData; game: DraftGame }) {
  const write = useDraftWrite(seasonId, show);
  return (
    <section className="mt-6 px-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="type-caption text-[24px]">The order</h2>
        {game.commissioner && (
          <button
            type="button"
            data-shuffle
            onClick={() => {
              const order = [...game.seats.map((s) => s.playerId)];
              for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
              }
              void write(game.leagueId, { action: "order", order }, "Shuffled the order");
            }}
            className="flex h-9 items-center gap-1.5 text-[13px] font-bold"
          >
            <Shuffle className="size-4" aria-hidden />
            Shuffle
          </button>
        )}
      </div>
      <p className="mb-2 text-[13px] text-muted-foreground">
        {game.size} {game.size === 1 ? "pick" : "picks"} each. Picks go down the list, then back up: 1, 2, 3, then 3, 2, 1.
      </p>
      <ol>
        {game.seats.map((s, i) => (
          <li key={s.playerId} data-seat={s.playerId} className="flex min-h-12 items-center gap-3 border-t border-border">
            <span className="type-num w-6 text-center text-[22px] text-muted-foreground">{i + 1}</span>
            <SeatFace game={game} playerId={s.playerId} />
            <b className="min-w-0 flex-1 truncate text-[15px]">{s.name}</b>
            {s.you && <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em]">You</span>}
            {s.bot && <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-muted-foreground">Computer</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DraftDone({ seasonId, show, game }: { seasonId: string; show: ShowData; game: DraftGame }) {
  const name = showName(show);
  const picks = game.teams.reduce((n, t) => n + t.castawayIds.length, 0);
  return (
    <div data-draft-done className="pb-6">
      <div className="px-4 pb-4 pt-10">
        <span className="type-caption inline-block bg-chyron py-[5px] pl-[9px] pr-[18px] text-[13px] tracking-[0.06em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%-9px)_100%,0_100%)]">
          Draft complete
        </span>
        <h1 className="type-caption mt-3 text-[52px] leading-[.9]">
          {game.name}
          <br />
          is set
        </h1>
        <p className="mt-2 text-muted-foreground">
          {picks} {picks === 1 ? "pick" : "picks"}
          {game.madeFor ? ` · ${game.madeFor} made for someone else` : ""}
        </p>
      </div>
      <div className="px-4">
        {game.seats.map((s, i) => (
          <div key={s.playerId} className="nd-team-in" style={{ ["--d" as string]: `${i * 0.15}s` }}>
            <TeamRow game={game} playerId={s.playerId} ids={game.teams.find((t) => t.playerId === s.playerId)?.castawayIds ?? []} big />
          </div>
        ))}
      </div>
      <div className="px-4 pt-6">
        <BtnLink tone="ink" wide href={paths.show(seasonId)} replace>
          Go to {name}
        </BtnLink>
      </div>
    </div>
  );
}

// ---------- the blind draft ----------

function BlindRoom({ seasonId, show, game, onSettings }: { seasonId: string; show: ShowData; game: DraftGame; onSettings: () => void }) {
  const write = useDraftWrite(seasonId, show);
  const live = game.phase === "live";
  const youLocked = !!game.you && game.locked.includes(game.you);
  const [picking, setForWho] = useState<string | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { keep, chips } = useFilter(game.cast);
  // Picking for someone ends once they're in (they locked in themselves, or someone else did it for them).
  const forWho = picking && !game.locked.includes(picking) ? picking : null;
  const acting = forWho ?? game.you;
  const lockedHere = !forWho && youLocked;
  const shown = lockedHere ? (game.mine ?? []) : team;
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const waiting = game.seats.filter((s) => !game.locked.includes(s.playerId));
  const forName = forWho ? (seatOf(game, forWho)?.name ?? "someone") : null;

  const toggle = (id: string) => {
    if (!live) return toast.quiet("The draft hasn't started yet");
    if (lockedHere) return toast.quiet("You're locked in. Change it to pick again.");
    if (team.includes(id)) setTeam(team.filter((x) => x !== id));
    else if (team.length < game.size) setTeam([...team, id]);
    else toast.quiet("Take someone out first");
  };

  async function lockIn() {
    if (!acting || team.length !== game.size || busy) return;
    setBusy(true);
    const ok = await write(game.leagueId, { action: "lock", playerId: acting, castawayIds: team }, forName ? `Locked in for ${forName}` : "Locked in. You can change it until everyone is in.");
    setBusy(false);
    if (ok) {
      setTeam([]);
      setForWho(null);
    }
  }

  return (
    <>
      {live ? (
        <ClockCard
          tone="quiet"
          lead={
            <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-secondary text-chyron-line">
              <Eye className="size-5" aria-hidden />
            </span>
          }
          kick={forName ? `Picking for ${forName}` : "Pick in private"}
          line={lockedHere ? "Locked in · waiting for the couch" : `Choose ${game.size}. Nobody sees until everyone's in.`}
        />
      ) : (
        <WaitingCard seasonId={seasonId} show={show} game={game} onSettings={onSettings} />
      )}

      <div data-in-row className="flex justify-around px-4 pt-3">
        {game.seats.map((s) => {
          const isIn = game.locked.includes(s.playerId);
          return (
            <span key={s.playerId} data-in={isIn || undefined} className={`flex flex-col items-center gap-1 text-[11px] ${isIn ? "" : "opacity-55"}`}>
              <Avatar id={s.userId ?? s.playerId} name={s.name} size={30} />
              <small className={isIn ? "font-bold text-good" : "text-muted-foreground"}>{isIn ? "In" : s.you ? "You" : live ? "Picking" : s.name}</small>
            </span>
          );
        })}
      </div>

      {live && game.runs && waiting.some((s) => !s.you) && !forWho && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 text-[13px] text-muted-foreground">
          <span>Someone away?</span>
          {waiting
            .filter((s) => !s.you)
            .map((s) => (
              <button
                key={s.playerId}
                type="button"
                data-pick-for={s.playerId}
                onClick={() => {
                  setForWho(s.playerId);
                  setTeam([]);
                }}
                className="h-8 rounded-[3px] bg-card px-2.5 text-[13px] font-bold text-foreground outline-1 -outline-offset-1 outline-input"
              >
                Pick for {first(s.name)}
              </button>
            ))}
        </div>
      )}

      {forWho && (
        <div data-for-bar className="mx-4 mt-2 flex items-center gap-2 rounded-[3px] bg-[rgba(255,197,49,.12)] px-2.5 py-2 text-[13px] outline-1 -outline-offset-1 outline-chyron-line">
          <Hand className="size-4 flex-none text-chyron-line" aria-hidden />
          <span className="flex-1">
            Picking for <b>{forName}</b>. You won&rsquo;t see anything they picked.
          </span>
          <button
            type="button"
            onClick={() => {
              setForWho(null);
              setTeam([]);
            }}
            className="font-bold text-chyron-line"
          >
            Cancel
          </button>
        </div>
      )}

      {live && (
        <div data-my-team className={`grid gap-[7px] px-4 pt-3 ${game.size > 5 ? "grid-cols-5" : game.size === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {Array.from({ length: game.size }, (_, i) => {
            const c = faces.get(shown[i]);
            return c ? (
              <button
                key={i}
                type="button"
                data-slot={c.id}
                onClick={() => !lockedHere && setTeam(team.filter((x) => x !== c.id))}
                aria-label={lockedHere ? c.name : `Take ${first(c.name)} out`}
                className="relative isolate flex aspect-square items-end overflow-hidden rounded-[3px] p-1 text-white"
              >
                <Face src={c.photo} name={c.name} className="absolute inset-0 -z-10 size-full" />
                <b className="type-caption truncate text-[12px] [text-shadow:0_1px_4px_#000]">{first(c.name)}</b>
              </button>
            ) : (
              <span key={i} className="type-num grid aspect-square place-items-center rounded-[3px] text-[20px] text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input">
                {i + 1}
              </span>
            );
          })}
        </div>
      )}

      <p className="px-4 pt-3 text-[13px] text-muted-foreground">Shared ownership: the same castaway can be on several teams.</p>
      {chips()}
      <div className="grid grid-cols-3 gap-[7px] px-4 pb-5 pt-3">
        {game.cast.filter(keep).map((c) => (
          <Tile key={c.id} face={c} selected={shown.includes(c.id)} onTap={() => toggle(c.id)} />
        ))}
      </div>

      {live && acting && (
        <div data-confirm className="nd-fixed-x nd-dock fixed bottom-0 z-30 flex items-center gap-2.5 border-t border-border bg-card px-4 pb-[calc(18px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-10px_24px_rgba(0,0,0,.35)]">
          {lockedHere ? (
            <>
              <span className="min-w-0 flex-1">
                <small className="block text-xs text-muted-foreground">
                  {game.locked.length} of {game.seats.length} in
                </small>
                <b className="type-caption block truncate text-[22px]">{waiting.length ? `Waiting for ${waiting.length === 1 ? first(waiting[0].name) : `${waiting.length} more`}` : "Revealing…"}</b>
              </span>
              <Btn
                data-unlock
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await write(game.leagueId, { action: "unlock", playerId: game.you! });
                  setBusy(false);
                  if (ok) setTeam(game.mine ?? []);
                }}
                className="h-12"
              >
                Change
              </Btn>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <small className="block text-xs text-muted-foreground">
                  {team.length} of {game.size}
                </small>
                <b className="type-caption block truncate text-[22px]">{team.length < game.size ? `Pick ${game.size - team.length} more` : "Ready"}</b>
              </span>
              <Btn tone={team.length === game.size ? "must" : "optional"} data-lock disabled={busy || team.length !== game.size} onClick={lockIn} className="h-12">
                <Lock className="size-4" aria-hidden />
                {forName ? `Lock in for ${first(forName)}` : "Lock in"}
              </Btn>
            </>
          )}
        </div>
      )}
    </>
  );
}

// The reveal turns over once per device: after that the page opens with the teams face up.
const REVEAL_KEY = "gys.blind-seen";
const revealListeners = new Set<() => void>();
const readRevealSeen = () => {
  try {
    return localStorage.getItem(REVEAL_KEY) ?? "";
  } catch {
    return "";
  }
};
function markRevealSeen(leagueId: string) {
  try {
    const list = readRevealSeen().split(",").filter(Boolean);
    if (!list.includes(leagueId)) localStorage.setItem(REVEAL_KEY, [...list.slice(-20), leagueId].join(","));
  } catch {
    // Private mode: it turns over each time.
  }
  revealListeners.forEach((l) => l());
}

function BlindReveal({ seasonId, show, game }: { seasonId: string; show: ShowData; game: DraftGame }) {
  const seenRaw = useSyncExternalStore(
    (l) => {
      revealListeners.add(l);
      return () => revealListeners.delete(l);
    },
    readRevealSeen,
    () => ""
  );
  // Whether it had been seen when the page opened: the animation plays this once, then the mark is set.
  const [still] = useState(() => readRevealSeen().split(",").includes(game.leagueId));
  useEffect(() => {
    if (!seenRaw.split(",").includes(game.leagueId)) {
      const t = setTimeout(() => markRevealSeen(game.leagueId), 1500);
      return () => clearTimeout(t);
    }
  }, [game.leagueId, seenRaw]);
  // The reveal starts at the top, wherever the picking left the page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const teams = [...game.teams].sort((a, b) => (a.playerId === game.you ? -1 : b.playerId === game.you ? 1 : 0));
  const count = new Map<string, number>();
  for (const t of teams) for (const id of t.castawayIds) count.set(id, (count.get(id) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  const topFace = top && top[1] > 1 ? faces.get(top[0]) : null;
  const name = showName(show);
  const cols = game.size > 5 ? "grid-cols-5" : game.size === 5 ? "grid-cols-5" : "grid-cols-4";
  return (
    <div data-blind-reveal className={`dark -mb-28 flex-1 bg-[#0b0a10] px-4 pb-36 pt-6 text-foreground ${still ? "nd-still" : ""}`}>
      <span className="type-caption text-xs tracking-[0.06em] text-muted-foreground">
        {game.gameName} · {name}
      </span>
      <h1 className="type-caption mb-4 mt-1.5 text-[52px] leading-none">The teams</h1>
      {teams.map((t, i) => {
        const s = seatOf(game, t.playerId);
        return (
          <div key={t.playerId} data-team={t.playerId} className="nd-team-in mb-4" style={{ ["--d" as string]: `${i * 0.9}s` }}>
            <div className="mb-2 flex items-center gap-2">
              <SeatFace game={game} playerId={t.playerId} size={32} />
              <b className="type-caption text-[18px]">
                {s?.name ?? "someone"}
                {s?.you ? " · you" : ""}
              </b>
            </div>
            <div className={`grid gap-[7px] ${cols}`}>
              {t.castawayIds.map((id, k) => {
                const c = faces.get(id);
                const n = count.get(id) ?? 1;
                return (
                  <div key={id} className="nd-flip aspect-[3/4]" style={{ ["--k" as string]: `${i * 0.9 + k * 0.18}s` }}>
                    <div>
                      <div className="nd-flip-front flex items-end p-[5px] text-white">
                        <Face src={c?.photo ?? null} name={c?.name} out={c?.left} className="absolute inset-0 -z-10 size-full" />
                        <span className="absolute inset-0 -z-10 bg-[linear-gradient(transparent_50%,rgba(10,8,14,.9))]" aria-hidden />
                        <b className="type-caption relative truncate text-[13px]">{first(c?.name ?? "")}</b>
                        {n > 1 && <span className="absolute right-1 top-1 rounded-[2px] bg-chyron px-[5px] py-0.5 text-[11px] font-extrabold text-chyron-foreground">×{n}</span>}
                      </div>
                      <div className="nd-flip-back" aria-hidden />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="nd-team-in mt-2.5" style={{ ["--d" as string]: `${teams.length * 0.9 + 0.6}s` }}>
        {topFace && (
          <p className="mb-3.5 text-sm leading-snug text-muted-foreground">
            <b className="text-foreground">{first(topFace.name)}</b> is on {top![1]} teams. Shared ownership: everyone who has them scores with them.
          </p>
        )}
        <BtnLink tone="ink" wide href={paths.show(seasonId)} replace>
          Go to {name}
        </BtnLink>
      </div>
    </div>
  );
}

// ---------- the Commissioner's draft settings ----------

/** When the draft starts: a time on this device's clock, saved as an instant (empty: no start time). */
function StartsAt({ initial, onSave }: { initial: string; onSave: (iso: string | null) => void }) {
  const [when, setWhen] = useState(initial);
  return (
    <div className="flex gap-2">
      <input
        type="datetime-local"
        aria-label="When the draft starts"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="h-12 min-w-0 flex-1 rounded-[3px] bg-secondary px-3 text-base"
      />
      <Btn data-save-when onClick={() => onSave(when ? new Date(when).toISOString() : null)}>
        Save
      </Btn>
    </div>
  );
}

function DraftSettings({ seasonId, show, game, open, onOpenChange }: { seasonId: string; show: ShowData; game: DraftGame; open: boolean; onOpenChange: (o: boolean) => void }) {
  const write = useDraftWrite(seasonId, show);
  const local = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const snake = game.kind === "snake";
  const waiting = game.phase === "waiting";
  const label = (t: string) => <p className="type-caption mb-2 mt-5 text-[13px] tracking-[0.06em] text-muted-foreground first:mt-1">{t}</p>;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Draft settings" subtitle={`${game.name} · ${game.gameName} · you run this game`}>
      <div data-draft-sheet>
        {waiting && (
          <>
            {label("Starts")}
            <StartsAt key={game.scheduledAt ?? "none"} initial={local(game.scheduledAt)} onSave={(when) => void write(game.leagueId, { action: "settings", scheduledAt: when }, when ? `The draft starts ${airTime(Date.parse(when))}` : "No start time")} />
            <small className="mt-1.5 block text-[13px] text-muted-foreground">It opens on its own then. Or start it now, from the draft.</small>
          </>
        )}
        {snake && (
          <>
            {label("Pick timer")}
            <div className="flex gap-[3px] rounded-[3px] bg-secondary p-[3px]" role="radiogroup" aria-label="Pick timer">
              {(
                [
                  [0, "Off"],
                  [120, "2 min"],
                  [60, "60 sec"],
                ] as const
              ).map(([t, l]) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={game.timer === t}
                  data-timer={t}
                  onClick={() => void write(game.leagueId, { action: "settings", timer: t }, t ? `Pick timer: ${l}` : "Pick timer off")}
                  className={`h-10 flex-1 rounded-[2px] text-sm font-bold ${game.timer === t ? "bg-foreground text-background" : "text-muted-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <small className="mt-1.5 block text-[13px] text-muted-foreground">Off by default. A timer suits a competitive draft; a casual one goes at its own pace.</small>
            {game.timer > 0 && (
              <>
                {label("When the timer runs out")}
                {(
                  [
                    ["wait", "Wait for them", "Nobody gets picked for automatically (recommended)"],
                    ["queue", "Pick from their queue", "The first castaway they starred who's still free"],
                  ] as const
                ).map(([k, t, d]) => (
                  <button
                    key={k}
                    type="button"
                    data-away={k}
                    aria-pressed={game.away === k}
                    onClick={() => void write(game.leagueId, { action: "settings", away: k }, t)}
                    className={`mb-2 flex w-full items-center gap-3 rounded-[3px] p-3 text-left ${game.away === k ? "bg-foreground text-background" : "bg-secondary"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px]">{t}</b>
                      <small className={`block text-[13px] ${game.away === k ? "opacity-75" : "text-muted-foreground"}`}>{d}</small>
                    </span>
                    {game.away === k && <Check className="size-5 flex-none" aria-hidden />}
                  </button>
                ))}
              </>
            )}
            {(waiting || game.made === 0 || game.canUndo) && label("Order")}
            {game.made === 0 && (
              <div className="flex gap-1.5">
                {game.seats.map((s) => (
                  <Avatar key={s.playerId} id={s.userId ?? s.playerId} name={s.name} size={34} />
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {game.made === 0 && (
                <Btn
                  className="flex-1"
                  data-shuffle-sheet
                  onClick={() => {
                    const order = [...game.seats.map((s) => s.playerId)];
                    for (let i = order.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [order[i], order[j]] = [order[j], order[i]];
                    }
                    void write(game.leagueId, { action: "order", order }, "Shuffled the order");
                  }}
                >
                  <Shuffle className="size-4" aria-hidden />
                  Shuffle order
                </Btn>
              )}
              {game.canUndo && (
                <Btn
                  className="flex-1"
                  data-undo-last
                  onClick={async () => {
                    const last = game.picks[game.picks.length - 1];
                    const c = game.cast.find((x) => x.id === last?.castawayId);
                    if (await write(game.leagueId, { action: "undoLast" }, `Took back ${last?.playerId === game.you ? "your" : `${seatName(game, last?.playerId)}'s`} pick${c ? ` (${first(c.name)})` : ""}`)) onOpenChange(false);
                  }}
                >
                  <Undo2 className="size-4" aria-hidden />
                  Undo last pick
                </Btn>
              )}
            </div>
          </>
        )}
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">
          {snake
            ? "Whoever runs the game can always pick for anyone. That's how you help someone over the phone."
            : "Whoever runs the game can lock in for someone who's away. Nobody sees anyone's picks until everyone's in, you included."}
        </p>
      </div>
    </Sheet>
  );
}
