"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Hand, Lock, Search, Settings, Shuffle, Star, Undo2, Users, X } from "lucide-react";
import { airTime, calm, timeOf, ticks } from "../clock";
import { backstage, draftAct, useRoster, useSeasonDraft, type DraftAction, type DraftFace, type DraftGame, type DraftSeat } from "../data";
import { gameColour } from "../games";
import { POSITION_ORDER, slotWord } from "./game-week";
import { useNav } from "../nav";
import { paths } from "../routes";
import { isTabOf, useShow, type ShowData } from "../screens/show-space";
import { Avatar, useNow } from "../ui/bars";
import { Btn, BtnLink, EmptyState } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { toast } from "../ui/toast";
import { first } from "./moves";
import { useCastNames } from "../sports/faces";
import { Face } from "./parts";
import { AthleteSheetBody, CastSheetBody } from "./cast-sheet";
import { useGameDrill } from "./game-sheets";

// The draft room and the blind draft (docs/PLAN-new-design.md step 7; the mock's draft.js), pushed over a show from
// Tonight's move card, the dock and the show's ⋯ menu. Casual first: no timer unless the Commissioner sets one, nobody
// picked for automatically, and whoever runs the game can always pick for someone (helping a friend over the phone): a
// pick made for someone is a line in Recent changes, with Undo while it's the draft's last.
//
// The draft room (a turn-based draft: each castaway on one team; the design round's step 6, docs/design-round/step6-games-spec.md):
// the clock (who's up, how many picks until yours, the last pick in a line), your team's slots (with room for what it still
// needs: docs/PLAN-cast-properties.md), then Available (step 5's face wall by tribe; a sport's searchable list at a pool's size),
// Picks (the draft board: a column per person, a row per round) and your Queue. When you're up a tap selects, then Draft; when
// you're not, a tap queues. Before it starts: the order and the cast to star, and the Commissioner's Start.
// The blind draft (castaways on several teams): pick your whole team in private, lock in, then everyone's teams turn
// over together. Nobody's picks are ever read before then, the Commissioner's included: picking for someone starts empty.
//
// Polled while open (data.ts draftPoll: 4 s live, 15 s waiting); every write goes through /api/seasons/[id]/draft.

const SLOW_MS = 3 * 60 * 1000;
// A draftee's name where room is short, and their position (BACKLOG 88): an athlete by surname, a defense by its nickname, as the
// game page names them (sports/faces.ts useCastNames); a show's cast by first name, no position.
const NO_CAST: DraftFace[] = [];
const CastNames = createContext<{ name: (n: string | null | undefined) => string; role: (n: string | null | undefined) => string | null }>({ name: (n) => (n ? first(n) : ""), role: () => null });
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
  const sport = show.header?.show.kind === "sport";
  const names = useCastNames(seasonId, sport, game?.cast ?? NO_CAST);
  const sub = game ? [game.name, show.header ? `${name.replace(/^The /, "")}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : null, kind === "snake" ? "snake" : "shared"].filter(Boolean).join(" · ") : "";

  return (
    <CastNames.Provider value={names}>
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
          <DraftDone key={game.leagueId} seasonId={seasonId} show={show} game={game} sport={sport} />
        ) : (
          <SnakeRoom key={game.leagueId} seasonId={seasonId} show={show} game={game} onSettings={() => setSettings(true)} sport={sport} />
        )
      ) : game.phase === "done" ? (
        <BlindReveal key={game.leagueId} seasonId={seasonId} show={show} game={game} />
      ) : (
        <BlindRoom key={game.leagueId} seasonId={seasonId} show={show} game={game} onSettings={() => setSettings(true)} sport={sport} />
      )}

      {game && <DraftSettings seasonId={seasonId} show={show} game={game} open={settings} onOpenChange={setSettings} />}
    </div>
    </CastNames.Provider>
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

/** The clock (step 6): who's up as a face and a sentence, where you stand ("3 picks until yours"), and the last pick in a line. On
 *  your turn it's the room's one plate; otherwise a plain band (a dashed outline once a turn drags on). */
function ClockCard({ tone, lead, kick, line, sub, end }: { tone: "you" | "away" | "quiet"; lead: ReactNode; kick: ReactNode; line: ReactNode; sub?: ReactNode; end?: ReactNode }) {
  return (
    <div
      data-clock={tone}
      className={`relative mx-4 mt-3 flex items-center gap-3 overflow-hidden rounded-[4px] ${tone === "you" ? "nd-onclock bg-plate px-3 py-3 text-plate-foreground" : "px-0.5 py-1.5"} ${
        tone === "away" ? "px-3 outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input" : ""
      }`}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <b className="type-caption block text-[22px] leading-none">{kick}</b>
        <span className={`mt-1 block text-[14px] font-semibold leading-snug ${tone === "you" ? "text-plate-muted" : "text-muted-foreground"}`}>{line}</span>
        {sub && <small className={`mt-0.5 block truncate text-[13px] ${tone === "you" ? "text-plate-muted" : "text-muted-foreground"}`}>{sub}</small>}
      </div>
      {end}
    </div>
  );
}

/** Your team as it fills (step 6): numbered slots, faces as they're drafted, and the line under them for what it still needs ("Needs:
 *  1 Interior": docs/PLAN-cast-properties.md, after the round). Until that rule exists a sport says what it holds by position. */
function YourSlots({ game, ids, needs, onFace }: { game: DraftGame; ids: string[]; needs?: string | null; onFace?: (c: DraftFace) => void }) {
  const nm = useContext(CastNames);
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  // Past eight (a sport's fifteen), the faces drafted and the count: empty boxes would push the pool a third of a screen down.
  const many = Math.max(game.size, ids.length) > 8;
  const slots = many ? ids.length : Math.max(game.size, ids.length);
  return (
    <section data-your-slots className="mx-4 mt-3">
      <div className="flex items-baseline justify-between">
        <b className="type-caption text-[15px] tracking-[0.04em] text-muted-foreground">Your team</b>
        <small className="type-num text-[14px] text-muted-foreground">
          {ids.length} of {game.size}
        </small>
      </div>
      <div className={`mt-1.5 grid gap-[5px] ${many ? "grid-cols-9" : slots > 5 ? "grid-cols-6" : "grid-cols-5"}`}>
        {Array.from({ length: slots }, (_, k) => {
          const c = faces.get(ids[k]);
          return c ? (
            <button key={k} type="button" className="nd-press min-w-0 text-left" data-slot-filled={c.id} data-door-cast={c.name} aria-label={`${c.name}: their season`} disabled={!onFace} onClick={() => onFace?.(c)}>
              <Face src={c.photo} name={c.name} title={c.name} className="aspect-square w-full rounded-[3px] text-xs" />
              {!many && <small className="mt-0.5 block truncate text-[11px] text-muted-foreground">{nm.name(c.name)}</small>}
            </button>
          ) : (
            <span key={k} className="type-num grid aspect-square place-items-center rounded-[3px] text-[15px] text-muted-foreground outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input">
              {k + 1}
            </span>
          );
        })}
      </div>
      {needs && (
        <p data-team-needs className="mt-1.5 truncate text-[13px] text-muted-foreground">
          {needs}
        </p>
      )}
    </section>
  );
}

/** What a sport's team holds by position ("1 QB · 2 WR"), the stand-in for "Needs" until a team's rules say what it needs. */
function holds(ids: string[], cast: DraftFace[], role: (n: string) => string | null): string | null {
  const count = new Map<string, number>();
  for (const id of ids) {
    const r = role(cast.find((c) => c.id === id)?.name ?? "");
    if (r) count.set(r, (count.get(r) ?? 0) + 1);
  }
  return count.size ? `Yours: ${[...count.entries()].map(([r, n]) => `${n} ${r}`).join(" · ")}` : null;
}

/** A castaway on the wall (step 5's face wall, four to a row): the photo, a star on its corner, the first name, and a line. */
function WallTile({ face, selected, taken, starred, onTap, onStar, disabled }: { face: DraftFace; selected?: boolean; taken?: { name: string; id: string } | null; starred?: boolean; onTap?: () => void; onStar?: () => void; disabled?: boolean }) {
  const nm = useContext(CastNames);
  const sub = taken ? first(taken.name) : face.points != null ? pts(face.points) : nm.role(face.name);
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        data-tile={face.id}
        aria-pressed={selected}
        aria-label={`${face.name}${taken ? `, taken by ${taken.name}` : ""}`}
        disabled={disabled}
        onClick={onTap}
        className="nd-press block w-full min-w-0 text-left disabled:opacity-100"
      >
        <Face
          src={face.photo}
          name={face.name}
          className={`mb-1 aspect-[4/5] w-full rounded-[3px] transition-shadow duration-200 ${taken ? "opacity-45 grayscale" : ""} ${selected ? "shadow-[0_0_0_3px_var(--chyron-line)]" : ""}`}
        />
        <b className={`type-caption block truncate text-[14px] leading-tight ${taken ? "text-muted-foreground" : ""}`}>{nm.name(face.name)}</b>
        {sub && <small className="block truncate text-[12px] leading-tight text-muted-foreground">{sub}</small>}
      </button>
      {!taken && onStar && (
        <button
          type="button"
          data-star={face.id}
          aria-pressed={starred}
          aria-label={starred ? `Take ${nm.name(face.name)} out of your queue` : `Queue ${nm.name(face.name)}`}
          onClick={onStar}
          className="absolute right-0 top-0 grid size-9 place-items-center"
        >
          <span className={`grid size-[26px] place-items-center rounded-full ${starred ? "bg-chyron-line text-chyron-foreground" : "bg-[rgba(16,14,21,.62)] text-white/80"}`}>
            <Star className="size-[14px]" fill={starred ? "currentColor" : "none"} aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}

/** Who's free, on a show: the wall by tribe (step 5), taken ones only when asked. */
function Wall({ list, tribes, render, aside }: { list: DraftFace[]; tribes: boolean; render: (c: DraftFace) => ReactNode; aside?: ReactNode }) {
  const groups: [string, string | null, DraftFace[]][] = [];
  for (const c of list) {
    const key = tribes ? (c.tribe?.name ?? "") : "";
    const g = groups.find((x) => x[0] === key);
    if (g) g[2].push(c);
    else groups.push([key, c.tribe?.colour ?? null, [c]]);
  }
  return (
    <div data-draft-wall className="px-4 pb-5">
      {groups.map(([name, colour, faces], i) => (
        <div key={name || "all"} className="mt-3.5" data-group={name || undefined}>
          {(name || (i === 0 && aside)) && (
            <div className="mb-2 flex min-h-9 items-center gap-2">
              {colour && <i className="size-2.5 rounded-[2px]" style={{ background: colour }} aria-hidden />}
              {name && <b className="type-caption text-[17px] leading-none">{name}</b>}
              {name && <small className="text-[13px] text-muted-foreground">{faces.length}</small>}
              {i === 0 && aside && <span className="ml-auto">{aside}</span>}
            </div>
          )}
          <div className="grid grid-cols-4 gap-x-2 gap-y-2.5">{faces.map(render)}</div>
        </div>
      ))}
    </div>
  );
}

const PAGE = 40;

/** Who's free, on a sport (step 5's list at a pool's size): search, positions, then rows 40 at a time, best first by the pool's
 *  own order; each with its headshot, name, position and team, the season's line where the box scores have one, and a star. */
function DraftList({ seasonId, list, render }: { seasonId: string; list: DraftFace[]; render: (c: DraftFace, line: string | null) => ReactNode }) {
  const nm = useContext(CastNames);
  const roster = useRoster(seasonId);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState("all");
  const [shown, setShown] = useState(PAGE);
  const lines = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of roster.data?.groups ?? []) for (const p of g.people) if (p.stats?.soFar?.length) m.set(p.name.toLowerCase(), p.stats.soFar.slice(0, 3).map((i) => `${i.value} ${i.label}`).join(" · "));
    return m;
  }, [roster.data]);
  // Positions in the sport's own order (QB, RB, WR, TE, K, DEF), the pool best first by its own list.
  const posOf = (c: DraftFace) => slotWord((nm.role(c.name) ?? "").toUpperCase());
  const at = (r: string) => (POSITION_ORDER.indexOf(r) < 0 ? 99 : POSITION_ORDER.indexOf(r));
  const positions = [...new Set(list.map(posOf).filter(Boolean))].sort((a, b) => at(a) - at(b));
  const term = q.trim().toLowerCase();
  const found = list
    .filter((c) => (pos === "all" || posOf(c) === pos) && (!term || c.name.toLowerCase().includes(term) || (c.tribe?.name ?? "").toLowerCase().includes(term)))
    .sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  return (
    <div data-draft-list className="px-4 pb-5 pt-3">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          data-draft-search
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Find a player or team"
          aria-label="Find a player or team"
          className="h-11 w-full rounded-[4px] bg-card pl-9 pr-3 text-base outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground focus:outline-2 focus:outline-foreground"
        />
      </label>
      {positions.length > 1 && (
        <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Position">
          {["all", ...positions].map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              data-draft-pos={p}
              aria-checked={pos === p}
              onClick={() => {
                setPos(p);
                setShown(PAGE);
              }}
              className={`h-9 flex-none rounded-[3px] px-3 text-[13px] font-bold ${pos === p ? "bg-foreground text-background" : "text-muted-foreground outline-1 -outline-offset-1 outline-edge"}`}
            >
              {p === "all" ? "All" : p}
            </button>
          ))}
        </div>
      )}
      <p className="mb-1 mt-3 text-[12.5px] text-muted-foreground">{found.length === list.length ? `${list.length} free` : `${found.length} of ${list.length} free`}</p>
      {found.length === 0 && (
        <div className="py-6 text-center text-[14px] text-muted-foreground">
          <p>{pos === "all" ? "Nobody free" : `No ${pos} free`} matches “{q.trim()}”.</p>
          {pos !== "all" && (
            <button type="button" onClick={() => setPos("all")} className="mt-2 h-10 px-3 font-bold text-foreground underline underline-offset-2">
              Search every position
            </button>
          )}
        </div>
      )}
      <div>{found.slice(0, shown).map((c) => render(c, lines.get(c.name.toLowerCase()) ?? null))}</div>
      {found.length > shown && (
        <button type="button" data-show-more onClick={() => setShown((n) => n + PAGE)} className="nd-press mt-3 h-11 w-full rounded-[6px] text-[14px] font-bold outline-1 -outline-offset-1 outline-edge">
          Show {Math.min(PAGE, found.length - shown)} more
        </button>
      )}
    </div>
  );
}

/** An athlete's row in the sport list: headshot, name, position and team, their line, and a star. */
function ListRow({ face, line, selected, starred, onTap, onStar }: { face: DraftFace; line: string | null; selected?: boolean; starred?: boolean; onTap: () => void; onStar?: () => void }) {
  const nm = useContext(CastNames);
  return (
    <div className={`flex min-h-14 items-center gap-3 border-b border-border ${selected ? "-mx-2 rounded-[3px] bg-secondary px-2 shadow-[inset_0_0_0_2px_var(--chyron-line)]" : ""}`}>
      <button type="button" data-tile={face.id} aria-pressed={selected} onClick={onTap} className="nd-press flex min-h-14 min-w-0 flex-1 items-center gap-3 py-1.5 text-left">
        <Face src={face.photo} name={face.name} className="size-9 flex-none rounded-[3px] bg-card" />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[15px] font-semibold">{face.name}</b>
          <small className="block truncate text-[13px] text-muted-foreground">{[nm.role(face.name), face.tribe?.name, line].filter(Boolean).join(" · ")}</small>
        </span>
      </button>
      {onStar && (
        <button type="button" data-star={face.id} aria-pressed={starred} aria-label={starred ? `Take ${face.name} out of your queue` : `Queue ${face.name}`} onClick={onStar} className="grid size-11 flex-none place-items-center">
          <span className={`grid size-[28px] place-items-center rounded-full ${starred ? "bg-chyron-line text-chyron-foreground" : "text-muted-foreground outline-1 -outline-offset-1 outline-edge"}`}>
            <Star className="size-[14px]" fill={starred ? "currentColor" : "none"} aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}

/** The draft board (step 6): a column per person in the order, a row per round, each cell the face taken (the pick number in an
 *  empty one, so the snake's direction reads), the cell on the clock outlined. It stands for the ticker, the order strip and Teams. */
function PicksBoard({ game, onFace }: { game: DraftGame; onFace?: (c: DraftFace) => void }) {
  const nm = useContext(CastNames);
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const order = game.turns.slice(0, game.seats.length);
  const rounds = Math.ceil(game.turns.length / Math.max(1, order.length));
  // The overall pick for this seat in this round, by the draft's own turns (a snake goes back up the order in even rounds).
  const cell = (round: number, col: number) => {
    const from = round * order.length;
    const k = game.turns.slice(from, from + order.length).indexOf(order[col]);
    return k < 0 ? -1 : from + k;
  };
  return (
    <div data-picks-board className="px-2 pb-6 pt-3">
      <div className="grid gap-x-1 gap-y-1.5" style={{ gridTemplateColumns: `22px repeat(${order.length}, minmax(0, 1fr))` }}>
        <span />
        {order.map((p) => {
          const s = seatOf(game, p);
          return (
            <span key={p} className="flex min-w-0 flex-col items-center gap-1 pb-1">
              <SeatFace game={game} playerId={p} size={28} />
              <b className={`max-w-full truncate text-[12px] ${s?.you ? "text-foreground" : "text-muted-foreground"}`}>{s?.you ? "You" : first(s?.name ?? "")}</b>
            </span>
          );
        })}
        {Array.from({ length: rounds }, (_, r) => (
          <PicksRow key={r} r={r} cols={order.length} at={(c) => cell(r, c)} game={game} faces={faces} name={nm.name} onFace={onFace} />
        ))}
      </div>
    </div>
  );
}

function PicksRow({ r, cols, at, game, faces, name, onFace }: { r: number; cols: number; at: (c: number) => number; game: DraftGame; faces: Map<string, DraftFace>; name: (n: string) => string; onFace?: (c: DraftFace) => void }) {
  return (
    <>
      <span className="type-num self-center text-[13px] text-muted-foreground">R{r + 1}</span>
      {Array.from({ length: cols }, (_, c) => {
        const n = at(c);
        if (n < 0) return <span key={c} />;
        const pick = game.picks[n];
        const face = pick?.castawayId ? faces.get(pick.castawayId) : null;
        const now = n === game.made && game.phase === "live";
        return (
          <span key={c} data-pick-cell={n + 1} data-now={now || undefined} className={`flex min-w-0 flex-col items-center rounded-[3px] py-1 ${now ? "outline-2 -outline-offset-2 outline-chyron-line" : ""}`}>
            {face ? (
              <button type="button" data-door-cast={face.name} disabled={!onFace} onClick={() => onFace?.(face)} className="nd-press flex w-full min-w-0 flex-col items-center">
                <Face src={face.photo} name={face.name} className="size-9 rounded-[3px] text-xs" />
                <small className="mt-0.5 max-w-full truncate text-[11px]">{name(face.name)}</small>
              </button>
            ) : (
              <span className={`type-num grid size-9 place-items-center text-[13px] ${now ? "text-chyron-line" : "text-muted-foreground/60"}`}>{n + 1}</span>
            )}
          </span>
        );
      })}
    </>
  );
}

/** Your queue: a star adds or takes someone out, shown at once and saved straight away (then the server's copy again). */
function useQueue(seasonId: string, show: ShowData, game: DraftGame) {
  const nm = useContext(CastNames);
  const [pending, setPending] = useState<string[] | null>(null);
  const write = useDraftWrite(seasonId, show);
  const queue = pending ?? game.queue;
  const toggle = async (id: string, name: string) => {
    const next = queue.includes(id) ? queue.filter((x) => x !== id) : [...queue, id];
    setPending(next);
    toast(next.includes(id) ? `${nm.name(name)} queued` : `${nm.name(name)} unqueued`);
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

/**
 * A castaway's or athlete's sheet in the draft (step 6; the user, 2026-11-15: tapping one "should" open it; "Sports it's important
 * to get historical stats"): who they are and what they've done (step 5's person sheet on a show; on a sport the athlete's sheet,
 * past seasons first before this one has a game), with the draft's own actions in its foot.
 */
function DraftFaceSheet({ seasonId, show, sport, face, onClose, foot }: { seasonId: string; show: ShowData; sport: boolean; face: DraftFace | null; onClose: () => void; foot: ReactNode }) {
  const nm = useContext(CastNames);
  const [last, setLast] = useState(face);
  if (face && face !== last) setLast(face);
  const f = face ?? last;
  // The sheet's own doors (a stat's board, a holder, a compare) open over it, as levels of one path (game-sheets.tsx).
  const drill = useGameDrill(show);
  return (
    <>
      <Sheet open={!!face} onOpenChange={(o) => !o && onClose()} title={f?.name ?? ""} subtitle={f ? [nm.role(f.name), f.tribe?.name].filter(Boolean).join(" · ") || undefined : undefined} foot={f ? foot : undefined}>
        {f && (
          <div data-draft-sheet-body={f.id}>
            {sport ? (
              <AthleteSheetBody seasonId={seasonId} show={show} p={{ name: f.name, role: nm.role(f.name), photoUrl: f.photo, team: f.tribe?.name ?? "", line: null }} go={drill} />
            ) : (
              <CastSheetBody seasonId={seasonId} show={show} name={f.name} go={drill} />
            )}
          </div>
        )}
      </Sheet>
      {drill.sheets}
    </>
  );
}

/** The sheet's foot: what you can do with them in the draft, the yellow only when it's your pick. */
function SheetFoot({ children, line }: { children: ReactNode; line?: ReactNode }) {
  return (
    <div data-draft-sheet-foot className="flex flex-col gap-2 pt-1">
      {line && <p className="text-[13px] text-muted-foreground">{line}</p>}
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

// ---------- the turn-based draft ----------

function SnakeRoom({ seasonId, show, game, onSettings, sport }: { seasonId: string; show: ShowData; game: DraftGame; onSettings: () => void; sport: boolean }) {
  const nm = useContext(CastNames);
  const write = useDraftWrite(seasonId, show);
  const live = game.phase === "live";
  const clock = game.clock;
  // Seconds only while a pick timer counts down; without one, a minute is enough to see a turn dragging on.
  const now = useNow(!!clock?.endsAt);
  const [view, setView] = useState<"board" | "picks" | "queue">("board");
  const [showTaken, setShowTaken] = useState(false);
  const [picking, setForWho] = useState<string | null>(null);
  const [sel, setSel] = useState<{ n: number; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState<DraftFace | null>(null);
  const { queue, toggle } = useQueue(seasonId, show, game);
  const mine = !!clock && clock.playerId === game.you;
  // Picking for someone lasts their turn: once anyone picks, it's over.
  const forWho = picking && clock?.playerId === picking ? picking : null;
  const acting = !!clock && (mine || forWho === clock.playerId);
  const selectedFace = sel && clock && sel.n === clock.n && !game.owners[sel.id] ? game.cast.find((c) => c.id === sel.id) : null;
  const selected = selectedFace;
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

  async function draft(pick?: DraftFace) {
    const selected = pick ?? selectedFace;
    if (!selected || !clock || busy) return;
    setBusy(true);
    const forName = forWho ? onClock : null;
    const ok = await write(game.leagueId, { action: "pick", castawayId: selected.id, n: clock.n }, forName ? `${nm.name(selected.name)} drafted for ${forName}` : `You drafted ${nm.name(selected.name)}`);
    setBusy(false);
    if (ok) {
      setSel(null);
      setForWho(null);
      setLooking(null);
    }
  }

  // A tap opens their sheet (the user, 2026-11-15); when you're acting it also selects them, so the bar below still offers Draft
  // once the sheet is closed. The star queues in one tap.
  const tap = (c: DraftFace) => {
    if (live && acting && !ownerOf(c.id)) setSel({ n: clock!.n, id: c.id });
    setLooking(c);
  };

  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const list = showTaken ? game.cast : available;
  // Where you stand in the order: picks until yours (0: you're up), and the last pick in a line.
  const until = game.you ? game.turns.slice(game.made).indexOf(game.you) : -1;
  const lastPick = game.picks.at(-1);
  const lastLine = lastPick?.castawayId
    ? `${seatOf(game, lastPick.playerId)?.you ? "You" : first(seatOf(game, lastPick.playerId)?.name ?? "someone")} took ${nm.name(faces.get(lastPick.castawayId)?.name)} with pick ${lastPick.n}${lastPick.by ? `, made by ${lastPick.by}` : ""}${lastPick.auto ? ", from their queue" : ""}`
    : live
      ? "The draft is open"
      : null;
  const whereYou = until === 1 ? "You're next" : until > 1 ? `${until} picks until yours` : game.you ? "Your team is full" : null;
  const mineIds = game.teams.find((t) => t.playerId === game.you)?.castawayIds ?? [];
  const tile = (c: DraftFace) => {
    const owner = ownerOf(c.id);
    return (
      <WallTile
        key={c.id}
        face={c}
        selected={selected?.id === c.id}
        taken={owner ? { id: seatOf(game, owner)?.userId ?? owner, name: seatOf(game, owner)?.name ?? "someone" } : null}
        starred={queue.includes(c.id)}
        onTap={() => tap(c)}
        onStar={game.you ? () => void toggle(c.id, c.name) : undefined}
      />
    );
  };

  return (
    <>
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
                : [whereYou, ends != null ? `${calm(ends, now)} left` : `Round ${clock.round} · no timer`].filter(Boolean).join(" · ")
          }
          sub={lastLine}
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

      {/* Your team as it fills, with the line for what it still needs (cast properties, after the round). */}
      {live && game.you && <YourSlots game={game} ids={mineIds} needs={game.needs ?? (sport ? holds(mineIds, game.cast, (n) => nm.role(n)) : null)} onFace={tap} />}

      <Segments
        value={view}
        onChange={setView}
        items={[
          ["board", <>Available <b className="type-num ml-0.5 text-[15px]">{available.length}</b></>],
          ...(live ? [["picks", "Picks"] as ["picks", ReactNode]] : []),
          ["queue", <>Queue <b className="type-num ml-0.5 text-[15px]">{queue.filter((id) => !ownerOf(id)).length}</b></>],
        ]}
      />

      {view === "board" && live && !acting && game.you && queue.length === 0 && (
        <p data-queue-hint className="px-4 pt-2.5 text-[13px] text-muted-foreground">
          Tap a {sport ? "player" : "face"} to see them; the star queues them for your turn.
        </p>
      )}
      {view === "board" &&
        (sport ? (
          <DraftList
            seasonId={seasonId}
            list={available}
            render={(c, line) => <ListRow key={c.id} face={c} line={line} selected={selected?.id === c.id} starred={queue.includes(c.id)} onTap={() => tap(c)} onStar={game.you ? () => void toggle(c.id, c.name) : undefined} />}
          />
        ) : (
          <>
            <Wall
              list={list}
              tribes
              render={tile}
              aside={
                game.made > 0 ? (
                  <button type="button" data-show-taken aria-pressed={showTaken} onClick={() => setShowTaken((v) => !v)} className="h-9 text-[13px] font-bold text-muted-foreground aria-pressed:text-foreground">
                    {showTaken ? "Hide taken" : "Show taken"}
                  </button>
                ) : null
              }
            />
            {!list.length && <p className="px-4 py-6 text-sm text-muted-foreground">Everyone&rsquo;s been drafted.</p>}
          </>
        ))}

      {view === "picks" && <PicksBoard game={game} onFace={tap} />}

      <DraftFaceSheet
        seasonId={seasonId}
        show={show}
        sport={sport}
        face={looking}
        onClose={() => setLooking(null)}
        foot={(() => {
          const c = looking;
          if (!c) return null;
          const owner = ownerOf(c.id);
          if (owner) return <SheetFoot line={owner === game.you ? "On your team" : `Taken by ${seatName(game, owner)}`}>{null}</SheetFoot>;
          const queued = queue.includes(c.id);
          const star = game.you ? (
            <Btn data-sheet-queue onClick={() => void toggle(c.id, c.name)} className="h-12 flex-1">
              <Star className="size-4" fill={queued ? "currentColor" : "none"} aria-hidden />
              {queued ? "Queued" : "Queue"}
            </Btn>
          ) : null;
          return live && acting ? (
            <SheetFoot>
              {star}
              <Btn tone="must" data-sheet-draft disabled={busy} onClick={() => void draft(c)} className="h-12 flex-[2]">
                {forWho ? `Draft for ${first(onClock)}` : `Draft ${nm.name(c.name)}`}
              </Btn>
            </SheetFoot>
          ) : (
            <SheetFoot line={live ? [`${onClock} is picking`, whereYou].filter(Boolean).join(" · ") : "The draft hasn't started"}>{star}</SheetFoot>
          );
        })()}
      />

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
                  {/* The row opens their sheet (Draft at its foot when you're up); its Draft button keeps its one tap. */}
                  <button type="button" data-door-cast={c.name} onClick={() => tap(c)} className="nd-press flex min-h-[62px] min-w-0 flex-1 items-center gap-2.5 text-left">
                    <span className="type-num w-5 text-[20px] text-muted-foreground">{i + 1}</span>
                    <Face src={c.photo} name={c.name} className="size-[42px] rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[15px]">{c.name}</b>
                      <small className="block text-xs text-muted-foreground">{owner ? `Taken by ${seatName(game, owner)}` : [nm.role(c.name), c.tribe?.name, c.points != null ? pts(c.points) : null].filter(Boolean).join(" · ")}</small>
                    </span>
                  </button>
                  {!owner && acting && (
                    <button
                      type="button"
                      data-queue-draft
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
                <b className="type-caption block truncate text-[22px]">{nm.name(selected.name)}</b>
              </span>
              <Btn tone="must" data-draft-go disabled={busy} onClick={() => void draft()} className="h-12">
                Draft {nm.name(selected.name)}
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
          <span className="grid size-11 flex-none place-items-center rounded-[3px] bg-secondary text-foreground">
            {game.kind === "blind" ? <Eye className="size-5" aria-hidden /> : <Users className="size-5" aria-hidden />}
          </span>
        }
        kick={game.kind === "blind" ? "Blind draft" : "The draft"}
        line={
          at != null
            ? `Starts ${airTime(at)} · ${calm(at, now)}`
            : game.waits
              ? game.waits
              : game.commissioner
                ? "Nobody can pick until you start it"
                : `Waiting for ${game.runBy ?? "whoever runs the game"} to start the draft`
        }
      />
      {game.commissioner && (
        <div className="mx-4 mt-3 flex gap-2">
          <Btn data-pick-time onClick={onSettings} className="flex-none">
            {at != null ? "Change time" : "Pick a time"}
          </Btn>
          <Btn
            // With a time set it starts by itself: starting it now is optional, so never the yellow (the One Chyron Rule).
            tone={at != null && !game.late ? "optional" : "must"}
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

function DraftDone({ seasonId, show, game, sport }: { seasonId: string; show: ShowData; game: DraftGame; sport: boolean }) {
  const name = showName(show);
  // The board's faces open their sheet, whose team they're on at its foot (the drill pass, 2026-11-17).
  const [looking, setLooking] = useState<DraftFace | null>(null);
  const owner = looking ? game.owners[looking.id]?.[0] : null;
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
      {/* The board is the teams: a column each, in the order they picked (step 6). */}
      <div className="nd-team-in" style={{ ["--d" as string]: "0.1s" }}>
        <PicksBoard game={game} onFace={setLooking} />
      </div>
      <DraftFaceSheet seasonId={seasonId} show={show} sport={sport} face={looking} onClose={() => setLooking(null)} foot={owner ? <SheetFoot line={owner === game.you ? "On your team" : `On ${seatName(game, owner)}'s team`}>{null}</SheetFoot> : null} />
      <div className="px-4 pt-6">
        <BtnLink tone="ink" wide href={paths.show(seasonId)} replace>
          Go to {name}
        </BtnLink>
      </div>
    </div>
  );
}

// ---------- the blind draft ----------

function BlindRoom({ seasonId, show, game, onSettings, sport }: { seasonId: string; show: ShowData; game: DraftGame; onSettings: () => void; sport: boolean }) {
  const nm = useContext(CastNames);
  const write = useDraftWrite(seasonId, show);
  const live = game.phase === "live";
  const youLocked = !!game.you && game.locked.includes(game.you);
  const [picking, setForWho] = useState<string | null>(null);
  const [team, setTeam] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState<DraftFace | null>(null);
  // Picking for someone ends once they're in (they locked in themselves, or someone else did it for them).
  const forWho = picking && !game.locked.includes(picking) ? picking : null;
  const acting = forWho ?? game.you;
  const lockedHere = !forWho && youLocked;
  const shown = lockedHere ? (game.mine ?? []) : team;
  const faces = new Map(game.cast.map((c) => [c.id, c]));
  const waiting = game.seats.filter((s) => !game.locked.includes(s.playerId));
  const forName = forWho ? (seatOf(game, forWho)?.name ?? "someone") : null;

  // How many the sheet names: a team, or everyone left to pick when that's fewer (BACKLOG 60: a later stage's draft from who's
  // still in; the engine's BlindDraftLogic.sheetSize). `game.cast` is who can be drafted.
  const need = Math.min(game.size, game.cast.length || game.size);
  const short = need < game.size;

  const toggle = (id: string) => {
    if (!live) return toast.quiet("The draft hasn't started yet");
    if (lockedHere) return toast.quiet("You're locked in. Change it to pick again.");
    if (team.includes(id)) setTeam(team.filter((x) => x !== id));
    else if (team.length < need) setTeam([...team, id]);
    else toast.quiet("Take someone out first");
  };

  async function lockIn() {
    if (!acting || team.length !== need || busy) return;
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
              <EyeOff className="size-5" aria-hidden />
            </span>
          }
          kick={forName ? `Picking for ${forName}` : "Pick in private"}
          line={lockedHere ? "Locked in · waiting for the couch" : short ? `Only ${need} left to pick: choose ${need === 1 ? "them" : `all ${need}`}. Nobody sees until everyone's in.` : `Choose ${game.size}. Nobody sees until everyone's in.`}
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
              <b className="max-w-[72px] truncate text-[12px] font-semibold">{s.you ? "You" : first(s.name)}</b>
              <small className={isIn ? "font-bold text-good" : "text-muted-foreground"}>{isIn ? "In" : live ? "Picking" : game.phase === "waiting" ? "Joined" : "Waiting"}</small>
            </span>
          );
        })}
      </div>

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
        <div data-my-team className={`grid gap-[7px] px-4 pt-3 ${need > 5 ? "grid-cols-5" : need === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
          {Array.from({ length: need }, (_, i) => {
            const c = faces.get(shown[i]);
            return c ? (
              <button
                key={i}
                type="button"
                data-slot={c.id}
                data-door-cast={c.name}
                onClick={() => setLooking(c)}
                aria-label={c.name}
                className="relative isolate flex aspect-square items-end overflow-hidden rounded-[3px] p-1 text-white"
              >
                <Face src={c.photo} name={c.name} className="absolute inset-0 -z-10 size-full" />
                <b className="type-caption truncate text-[12px] [text-shadow:0_1px_4px_#000]">{nm.name(c.name)}</b>
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
      {sport ? (
        <DraftList seasonId={seasonId} list={game.cast} render={(c, line) => <ListRow key={c.id} face={c} line={line} selected={shown.includes(c.id)} onTap={() => setLooking(c)} />} />
      ) : (
        <Wall list={game.cast} tribes render={(c) => <WallTile key={c.id} face={c} selected={shown.includes(c.id)} onTap={() => setLooking(c)} />} />
      )}
      <DraftFaceSheet
        seasonId={seasonId}
        show={show}
        sport={sport}
        face={looking}
        onClose={() => setLooking(null)}
        foot={
          looking && live && !lockedHere ? (
            <SheetFoot line={`${team.length} of ${need} picked`}>
              <Btn
                data-sheet-pick
                tone={shown.includes(looking.id) ? "optional" : "must"}
                onClick={() => {
                  toggle(looking.id);
                  setLooking(null);
                }}
                className="h-12 flex-1"
              >
                {shown.includes(looking.id) ? "Take them out" : team.length < need ? "Add to your team" : "Your team is full"}
              </Btn>
            </SheetFoot>
          ) : looking ? (
            <SheetFoot line={lockedHere ? "You're locked in. Change it to pick again." : "The draft hasn't started"}>{null}</SheetFoot>
          ) : null
        }
      />

      {live && game.runs && waiting.some((s) => !s.you) && !forWho && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-6 pt-1 text-[13px] text-muted-foreground">
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
                  {team.length} of {need}
                </small>
                <b className="type-caption block truncate text-[22px]">{team.length < need ? `Pick ${need - team.length} more` : "Ready"}</b>
              </span>
              <Btn tone={team.length === need ? "must" : "optional"} data-lock disabled={busy || team.length !== need} onClick={lockIn} className="h-12">
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
  const nm = useContext(CastNames);
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
                    if (await write(game.leagueId, { action: "undoLast" }, `Took back ${last?.playerId === game.you ? "your" : `${seatName(game, last?.playerId)}'s`} pick${c ? ` (${nm.name(c.name)})` : ""}`)) onOpenChange(false);
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
