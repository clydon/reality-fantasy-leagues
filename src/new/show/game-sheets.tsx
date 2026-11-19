"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Bot, Check, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEpisodeBingo, useEpisodeCalls, useGameQuestions, useRoster, useSeasonStats, type GameView, type QuestionFace, type TableRow } from "../data";
import { NavLink } from "../nav";
import { paths } from "../routes";
import type { ShowData } from "../screens/show-space";
import { gameColour, ordinal } from "../games";
import { Avatar } from "../ui/bars";
import { Sheet } from "../ui/sheet";
import { nightKind, type NightKind, type Square } from "@/lib/game/game-plays";
import { useWithRoles } from "../sports/faces";
import { CompareCounts } from "./cast";
import { AthleteSheet, CastSheet, ComparePick, StatBoard, lensGamesFor, type Athlete } from "./cast-sheet";
import { LATE_SET, LateMark, LineupSheet, signed } from "./lineup-sheet";
import { castName, faceIn, first } from "./moves";
import { Face } from "./parts";
import { answerWords, verdictWords } from "./questions";
import { statValue } from "./stats";
import { BetsBody, CompareBody, EpisodeGames, GameTable, MatchupBody, MatchupTitle, PersonSeason, slotWord } from "./game-week";
import { oneGame } from "./this-week";
import { PriceEnd } from "./price-end";

// The sheet family on a game's page and every tab (docs/PLAN-start-a-game-gpt.md U1, "Step 2 brief": the sheet family, once;
// U0's canvas v58, boards R4 and R6, `make_person_sheet.js` and `make_hybrid.js`). Every name, square, episode, face and number is a
// door to the next view down, keeping the episode you were on: a person's sheet (their strip of weeks in the game's own terms, the
// chosen episode's plays in their scored state, then the season), an episode's sheet (everyone's plays that night, ‹ › through the
// episodes), a castaway's sheet (cast-sheet.tsx: one sheet from every way in, counted by the show or a game), a stat's board
// (everyone ranked on it), a compare, the rules. Each opens as a sheet over the last with the path back on top ("Survival Pool ›
// Joanna ›", each part a way back); the phone's back takes the top one down (sheet-history.ts), Close shuts them all. A drill may
// have no game of its own (the Cast tab's, useGameDrill): each door then names the game it reads (`game`), and doors opened from a
// level read that level's game unless they name another. The squares come from GameView.plays (game-plays.ts), only as far as you've
// seen; anyone's next move says only whether it's set. A lineup's sheet is today's (lineup-sheet.tsx), kept as it is.

/** `game`: the game a door reads, when it isn't the drill's own (a person from a castaway's In your games, any door on the Cast
 *  tab). A castaway: by `id` in that game or by `name`; `lens` the game their sheet counts by (null: the show; left out: the game
 *  it was opened from, when that game counts people week by week). A stat's board: `from` the castaway whose sheet opened it. */
type In = { game?: string };
export type Door =
  | ({ kind: "person"; playerId: string; episode: number | null } & In)
  | ({ kind: "episode"; episode: number } & In)
  | ({ kind: "night"; episode: number } & In)
  | ({ kind: "cast"; id?: string; name?: string; lens?: string | null; episode?: number } & In)
  | ({ kind: "rules" } & In)
  | ({ kind: "matchup"; playerId: string; episode: number } & In)
  | ({ kind: "bets" } & In)
  | ({ kind: "compare"; a: string; b: string; episode?: number } & In)
  | ({ kind: "table" } & In)
  | ({ kind: "stat"; key: string; title?: string; from: string | null; lens: string | null } & In)
  | ({ kind: "pick"; name: string; lens: string | null } & In)
  | ({ kind: "versus"; a: string; b: string; lens: string | null; episode?: number } & In);
type Level = { key: number; door: Door; open: boolean };
export type Drill = { open: (d: Door) => void };

/** The stack of sheets a game's doors open, over whatever's on screen. */
export function useDrill() {
  const [levels, setLevels] = useState<Level[]>([]);
  const n = useRef(0);
  const gone = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A closed sheet stays mounted for its slide down, then goes.
  const tidy = () => {
    if (gone.current) clearTimeout(gone.current);
    gone.current = setTimeout(() => setLevels((ls) => ls.filter((l) => l.open)), 450);
  };
  useEffect(() => () => void (gone.current && clearTimeout(gone.current)), []);
  return {
    levels,
    open: (door: Door) => setLevels((ls) => [...ls.filter((l) => l.open), { key: ++n.current, door, open: true }]),
    /** The top sheet becomes another (‹ › through the couch or the episodes, a castaway's lens): no new level, no new entry. */
    swap: (key: number, door: Door) => setLevels((ls) => ls.map((l) => (l.key === key ? { ...l, door } : l))),
    /** Down to this level (a part of the path): everything above it closes. */
    to: (key: number) => {
      setLevels((ls) => ls.map((l) => (l.key > key ? { ...l, open: false } : l)));
      tidy();
    },
    close: (key: number) => {
      setLevels((ls) => ls.map((l) => (l.key >= key ? { ...l, open: false } : l)));
      tidy();
    },
    closeAll: () => {
      setLevels((ls) => ls.map((l) => ({ ...l, open: false })));
      tidy();
    },
  };
}
export type DrillState = ReturnType<typeof useDrill>;

/** `g`: the drill's game (null: a tab's drill, each door naming its game); `wg`: the game this week is read from (a game in stages:
 *  the stage being played now; else the game itself); `runs`: you run the game (you settle its side bets); `onFlag`: Something
 *  wrong on a story's episode; `onRank`: a stat's board's foot sorts the tab's own table (else it links to the Cast tab). */
type Ctx = { g: GameView | null; show: ShowData; seasonId: string; rules: string[]; wg?: GameView; runs?: boolean; onFlag?: ((episode: number, who: string) => void) | null; onRank?: ((key: string) => void) | null };
/** A level that reads a game. */
type GameCtx = Omit<Ctx, "g"> & { g: GameView };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** The game a door reads: its own when it names one that isn't the drill's, else the drill's. */
const gameOf = (d: Door, ctx: Ctx): GameView | null => (d.game && d.game !== ctx.g?.leagueId ? (ctx.show.play?.find((x) => x.leagueId === d.game) ?? null) : ctx.g);

/** Every open level as its own sheet, the newest on top. */
export function DrillSheets({ drill, ...ctx }: Ctx & { drill: DrillState }) {
  const open = drill.levels.filter((l) => l.open);
  // The path's root: the drill's game, else the game its first sheet opened in (closing them all); the Cast tab's own sheets
  // have none.
  const root = ctx.g ?? (open[0] ? gameOf(open[0].door, ctx) : null);
  return (
    <>
      {drill.levels.map((l) => {
        const at = open.findIndex((x) => x.key === l.key);
        const below = at > 0 ? open.slice(0, at) : [];
        const parts = [...(root ? [{ key: -1, name: root.gameName }] : []), ...below.map((b) => ({ key: b.key, name: titleOf(b.door, ctx) }))];
        const crumb = l.open && parts.length ? (
          <span className="flex flex-wrap items-center gap-x-1">
            {parts.map((b) => (
              <span key={b.key} className="flex items-center gap-1">
                <button type="button" data-crumb={b.key} onClick={() => (b.key < 0 ? drill.closeAll() : drill.to(b.key))} className="-my-2 py-2 font-semibold text-foreground underline underline-offset-[3px]">
                  {b.name}
                </button>
                <span aria-hidden>›</span>
              </span>
            ))}
          </span>
        ) : null;
        return <Level key={l.key} level={l} drill={drill} crumb={crumb} plain={at > 0} {...ctx} />;
      })}
    </>
  );
}

function titleOf(d: Door, ctx: Ctx): string {
  const g = gameOf(d, ctx);
  const { show } = ctx;
  if (d.kind === "person") return g?.table.find((r) => r.playerId === d.playerId)?.name ?? "";
  if (d.kind === "episode" || d.kind === "night") return `${show.words.episode} ${d.episode}`;
  if (d.kind === "cast") {
    if (d.name) return show.header?.show.kind === "sport" ? d.name : first(d.name);
    const c = g && d.id ? faceIn(g, d.id) : undefined;
    return c?.role ? c.name : castName(c, g);
  }
  if (d.kind === "matchup") return `${show.words.ep} ${d.episode}`;
  if (d.kind === "bets") return "Side bets";
  if (d.kind === "compare") return g ? `${castName(faceIn(g, d.a), g)} vs ${castName(faceIn(g, d.b), g)}` : "Side by side";
  if (d.kind === "table") return "Everyone";
  if (d.kind === "stat") return d.title ?? "The ranking";
  if (d.kind === "pick") return "Compare";
  if (d.kind === "versus") return `${first(d.a)} vs ${first(d.b)}`;
  return "How it plays";
}

type SheetBits = { open: boolean; onOpenChange: (o: boolean) => void; crumb: ReactNode; plain: boolean };
const Waiting = () => <div aria-busy className="mt-3 h-40 animate-pulse rounded-[3px] bg-background" />;
// The night's body is the Episodes tab's own (episodes.tsx EpisodeNight), loaded when a night first opens: imported here outright, the
// Episodes tab's imports loop back to this file, and one of them reads it before it's set (the hub's rankings broke on it).
const EpisodeNight = dynamic(() => import("./episodes").then((m) => m.EpisodeNight), { loading: () => <Waiting /> });

function Level({ level, drill, crumb, plain, ...ctx }: Ctx & { level: Level; drill: DrillState; crumb: ReactNode; plain: boolean }) {
  const d = level.door;
  const sport = ctx.show.header?.show.kind === "sport";
  // The game this level reads (a sport's faces carry their positions), and the doors opened from it read it too unless they name
  // another.
  const own = gameOf(d, ctx);
  const g = useWithRoles(own, ctx.seasonId, sport);
  const go: Drill = { open: (x) => drill.open(g && !x.game ? { ...x, game: g.leagueId } : x) };
  const onOpenChange = (o: boolean) => !o && drill.close(level.key);
  const sheet: SheetBits = { open: level.open, onOpenChange, crumb, plain };
  const { show, seasonId } = ctx;
  if (d.kind === "cast") {
    const onFlag = ctx.onFlag
      ? (episode: number, who: string) => {
          drill.closeAll();
          ctx.onFlag!(episode, who);
        }
      : null;
    return <CastLevel show={show} seasonId={seasonId} g={g} d={d} sheet={sheet} go={go} onLens={(lens) => drill.swap(level.key, { ...d, lens })} onFlag={onFlag} />;
  }
  if (d.kind === "stat") {
    const onRank = ctx.onRank
      ? (key: string) => {
          drill.closeAll();
          ctx.onRank!(key);
        }
      : null;
    return <StatLevel show={show} seasonId={seasonId} d={d} sheet={sheet} go={go} onRank={onRank} />;
  }
  if (d.kind === "pick") return <PickLevel show={show} seasonId={seasonId} d={d} sheet={sheet} onPick={(b) => drill.swap(level.key, { kind: "versus", a: d.name, b, lens: d.lens, game: d.game })} />;
  // The night itself (no game of its own): its doors read the show, not the game the path started in.
  if (d.kind === "night") return <NightLevel show={show} seasonId={seasonId} d={d} sheet={sheet} open={drill.open} onStep={(n) => drill.swap(level.key, { ...d, episode: n })} />;
  if (d.kind === "versus") return <VersusLevel show={show} seasonId={seasonId} d={d} sheet={sheet} go={go} onEpisode={(n) => drill.swap(level.key, { ...d, episode: n })} />;
  if (!g) return null;
  // A level on the drill's own game keeps the page's week and rules; one on another game reads that game's.
  const gctx: GameCtx = { ...ctx, g, wg: own === ctx.g ? ctx.wg : undefined, rules: own === ctx.g ? ctx.rules : g.rules };
  if (d.kind === "person") {
    const people = g.table.filter((r) => opensSheet(g, r));
    const at = people.findIndex((r) => r.playerId === d.playerId);
    const r = people[at];
    const step = (dir: 1 | -1) => {
      const to = people[at + dir];
      if (to) drill.swap(level.key, { ...d, playerId: to.playerId });
    };
    return (
      <Sheet
        open={level.open && !!r}
        onOpenChange={onOpenChange}
        crumb={crumb}
        plain={plain}
        title={r?.name ?? ""}
        subtitle={r ? personLine(g, r) : undefined}
        stepper={people.length > 1 ? { prev: people[at - 1]?.name ?? null, next: people[at + 1]?.name ?? null, onStep: step } : undefined}
      >
        {r && (
          // Keyed by player: each one's sheet starts fresh (the sheet slides them in and out).
          <div key={r.playerId} data-sheet-player={r.playerId} className="mt-1">
            <PersonBody {...gctx} r={r} episode={d.episode} onEpisode={(n) => drill.swap(level.key, { ...d, episode: n })} go={go} onClose={drill.closeAll} />
          </div>
        )}
      </Sheet>
    );
  }
  if (d.kind === "episode") {
    const eps = g.plays.episodes;
    const at = eps.indexOf(d.episode);
    const step = (dir: 1 | -1) => {
      const to = eps[at + dir];
      if (to !== undefined) drill.swap(level.key, { ...d, episode: to });
    };
    return (
      <Sheet
        open={level.open}
        onOpenChange={onOpenChange}
        crumb={crumb}
        plain={plain}
        title={`${show.words.episode} ${d.episode}`}
        subtitle={episodeLine(g, d.episode)}
        stepper={eps.length > 1 ? { prev: at > 0 ? `${show.words.ep} ${eps[at - 1]}` : null, next: at >= 0 && at < eps.length - 1 ? `${show.words.ep} ${eps[at + 1]}` : null, onStep: step } : undefined}
      >
        <EpisodeBody key={d.episode} {...gctx} episode={d.episode} go={go} />
      </Sheet>
    );
  }
  if (d.kind === "matchup") {
    // A week of head to head, two lineups on one scale (game-week.tsx); ‹ › through the weeks played and the one to come.
    const wg = gctx.wg ?? g;
    const eps = [...wg.plays.episodes, ...(wg.plays.next && !wg.plays.episodes.includes(wg.plays.next.episode) ? [wg.plays.next.episode] : [])];
    const at = eps.indexOf(d.episode);
    const t = MatchupTitle(wg, d.playerId, d.episode, show.words);
    const step = (dir: 1 | -1) => {
      const to = eps[at + dir];
      if (to !== undefined) drill.swap(level.key, { ...d, episode: to });
    };
    return (
      <Sheet
        open={level.open}
        onOpenChange={onOpenChange}
        crumb={crumb}
        plain={plain}
        title={t.title}
        subtitle={t.subtitle}
        stepper={eps.length > 1 ? { prev: at > 0 ? `${show.words.ep} ${eps[at - 1]}` : null, next: at >= 0 && at < eps.length - 1 ? `${show.words.ep} ${eps[at + 1]}` : null, onStep: step } : undefined}
      >
        <MatchupBody key={`${d.playerId}:${d.episode}`} g={wg} pid={d.playerId} n={d.episode} words={show.words} sport={sport} onFace={(id) => go.open({ kind: "cast", id })} onCompare={(a, b) => go.open({ kind: "compare", a, b, episode: d.episode })} onPerson={(playerId) => go.open({ kind: "person", playerId, episode: d.episode })} />
      </Sheet>
    );
  }
  if (d.kind === "compare") {
    const wg = gctx.wg ?? g;
    return (
      <Sheet open={level.open} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title={titleOf(d, { ...ctx, g: wg })} subtitle="Points at this game's scoring">
        <CompareBody g={wg} a={d.a} b={d.b} episode={d.episode ?? null} words={show.words} onEpisode={(n) => drill.swap(level.key, { ...d, episode: n })} onFace={(id, n) => go.open({ kind: "cast", id, ...(n != null ? { episode: n } : {}) })} />
      </Sheet>
    );
  }
  if (d.kind === "table") {
    const wg = gctx.wg ?? g;
    return (
      <Sheet open={level.open} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title={`Everyone in ${wg.gameName}`} subtitle="Their points at this game's scoring, and who has them">
        <GameTable g={wg} words={show.words} onFace={(id, n) => go.open({ kind: "cast", id, ...(n != null ? { episode: n } : {}) })} ground="var(--card)" />
      </Sheet>
    );
  }
  if (d.kind === "bets") {
    const wg = gctx.wg ?? g;
    const open = wg.bets?.bets.find((x) => x.open);
    return (
      <Sheet open={level.open} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title="Side bets" subtitle={open ? `${show.words.episode} ${open.episode} · calls close when it starts` : (wg.bets?.postTo ?? null) !== null ? `${show.words.episode} ${wg.bets!.postTo}` : g.gameName}>
        <BetsBody g={wg} words={show.words} seasonId={seasonId} runs={!!gctx.runs} onPerson={(playerId) => go.open({ kind: "person", playerId, episode: null })} />
      </Sheet>
    );
  }
  return (
    <Sheet open={level.open} onOpenChange={onOpenChange} crumb={crumb} plain={plain} title="How it plays" subtitle={g.gameName}>
      <ol className="list-decimal pb-2 pl-[18px] text-[15px] leading-[1.45]" data-rules-sheet>
        {gctx.rules.map((x) => (
          <li key={x} className="mb-2 pl-1">
            {x}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

// ---------- the castaway, a stat, a compare: levels that need no game of their own (cast-sheet.tsx) ----------

/** A castaway's (or athlete's) sheet: the one part, at the lens its door asks for, else the game it was opened from when that
 *  game counts people week by week, else the show. The lens changes in place (the door swapped, no new step back). */
function CastLevel({ show, seasonId, g, d, sheet, go, onLens, onFlag }: { show: ShowData; seasonId: string; g: GameView | null; d: Extract<Door, { kind: "cast" }>; sheet: SheetBits; go: Drill; onLens: (lens: string | null) => void; onFlag: ((episode: number, who: string) => void) | null }) {
  const sport = show.header?.show.kind === "sport";
  const stats = useSeasonStats(seasonId, show.couch?.id ?? null, null, !sport);
  const roster = useRoster(seasonId, sport);
  const face = g && d.id ? faceIn(g, d.id) : undefined;
  const name = d.name ?? face?.name ?? "";
  const lenses = lensGamesFor(show, name);
  const lensId = d.lens !== undefined ? d.lens : g && lenses.some((x) => x.leagueId === g.leagueId) ? g.leagueId : null;
  const lens = lenses.find((x) => x.leagueId === lensId) ?? null;
  if (sport) {
    // By name and, for a face, its team: two players can share a name (step 1.3), each on their own team.
    const people = (roster.data?.groups ?? []).flatMap((grp) => grp.people.map((p) => ({ p, team: grp.name })));
    const found = people.find((x) => same(x.p.name, name) && (!face?.tribe?.name || x.team === face.tribe.name)) ?? people.find((x) => same(x.p.name, name));
    const soFar = found?.p.stats?.soFar ?? null;
    const p: Athlete = found
      ? { name, role: found.p.role, photoUrl: found.p.photoUrl, team: found.team, line: soFar?.length ? soFar.slice(0, 3).map((i) => `${i.value} ${i.label}`).join(" · ") : null }
      : { name, role: face?.role ?? null, photoUrl: face?.photo ?? null, team: face?.tribe?.name ?? "", line: null };
    return (
      <Sheet {...sheet} open={sheet.open && !!name} title={name} subtitle={[p.role ? slotWord(p.role.toUpperCase()) : null, p.team].filter(Boolean).join(" · ") || undefined}>
        {name && (
          <div key={name} data-sheet-cast={name}>
            <AthleteSheet seasonId={seasonId} show={show} p={p} lens={lens} lenses={lenses} onLens={onLens} go={go} from={g?.leagueId ?? null} />
          </div>
        )}
      </Sheet>
    );
  }
  // By their name, else (What happened names people by first name) by a first name only one of the cast has.
  const all = stats.data?.cast ?? [];
  const firsts = all.filter((x) => same(x.first, name));
  const c = all.find((x) => same(x.name, name)) ?? (firsts.length === 1 ? firsts[0] : null);
  const through = stats.data?.through ?? g?.through ?? 0;
  return (
    <Sheet {...sheet} open={sheet.open && !!name} title={c?.name ?? name} subtitle={through ? `${show.header?.show.name ?? ""} · up to ${show.words.ep} ${through}` : (show.header?.show.name ?? undefined)}>
      {!stats.data ? (
        <Waiting />
      ) : c ? (
        <div key={name} data-sheet-cast={name}>
          <CastSheet d={stats.data} c={c} show={show} seasonId={seasonId} lens={lens} go={go} onFlag={onFlag} from={g?.leagueId ?? null} episode={d.episode ?? null} />
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-muted-foreground">Nothing recorded for {name} yet.</p>
      )}
    </Sheet>
  );
}

const rankAll = "nd-press flex h-12 w-full items-center justify-center rounded-[6px] text-[15px] font-bold outline-1 -outline-offset-1 outline-edge";

/** A stat's board: everyone ranked on it, with who holds each in the game chosen at its head: any game you play that has teams,
 *  starting at the lens the sheet was counting by, else the game it was opened from. */
function StatLevel({ show, seasonId, d, sheet, go, onRank }: { show: ShowData; seasonId: string; d: Extract<Door, { kind: "stat" }>; sheet: SheetBits; go: Drill; onRank: ((key: string) => void) | null }) {
  const stats = useSeasonStats(seasonId, show.couch?.id ?? null);
  const s = stats.data?.stats.find((x) => x.key === d.key);
  const teams = (show.play ?? []).filter((g) => g.table.some((r) => r.team.length));
  const [holds, setHolds] = useState<string | null>(() => [d.lens, d.game].find((id) => id && teams.some((g) => g.leagueId === id)) ?? null);
  const lens = holds ? (teams.find((x) => x.leagueId === holds) ?? null) : null;
  const have = stats.data ? stats.data.cast.filter((c) => statValue(c, d.key) > 0).length : 0;
  const foot = (
    <div className="mt-5">
      {onRank ? (
        <button type="button" data-rank-all onClick={() => onRank(d.key)} className={rankAll}>
          See it beside every stat
        </button>
      ) : (
        <NavLink href={`${paths.show(seasonId, "cast")}?rank=${encodeURIComponent(d.key)}`} data-rank-all className={rankAll}>
          See it beside every stat
        </NavLink>
      )}
    </div>
  );
  return (
    <Sheet {...sheet} title={s?.name ?? d.title ?? ""} subtitle={stats.data ? `${show.header?.show.name ?? ""} · up to ${show.words.ep} ${stats.data.through} · ${have} of ${stats.data.cast.length} ${have === 1 ? "has" : "have"} it` : undefined}>
      {stats.data ? <StatBoard d={stats.data} statKey={d.key} from={d.from} lens={lens} games={teams} onLens={setHolds} onCast={(name) => go.open({ kind: "cast", name, lens: d.lens, ...(holds ?? d.lens ? { game: (holds ?? d.lens)! } : {}) })} foot={foot} /> : <Waiting />}
    </Sheet>
  );
}

/** Compare with…: the face wall; a face swaps this sheet for the two side by side. */
function PickLevel({ show, seasonId, d, sheet, onPick }: { show: ShowData; seasonId: string; d: Extract<Door, { kind: "pick" }>; sheet: SheetBits; onPick: (name: string) => void }) {
  const stats = useSeasonStats(seasonId, show.couch?.id ?? null);
  return (
    <Sheet {...sheet} title={`Compare ${first(d.name)} with…`} subtitle="Tap a face">
      {stats.data ? <ComparePick d={stats.data} from={d.name} onPick={onPick} /> : <Waiting />}
    </Sheet>
  );
}

/** Two side by side: in a game's lens their points at its scoring (game-week.tsx), else the show's counts. */
function VersusLevel({ show, seasonId, d, sheet, go, onEpisode }: { show: ShowData; seasonId: string; d: Extract<Door, { kind: "versus" }>; sheet: SheetBits; go: Drill; onEpisode: (n: number) => void }) {
  const stats = useSeasonStats(seasonId, show.couch?.id ?? null);
  const lens = d.lens ? (show.play?.find((x) => x.leagueId === d.lens) ?? null) : null;
  const ia = lens?.cast.find((x) => same(x.name, d.a))?.id;
  const ib = lens?.cast.find((x) => same(x.name, d.b))?.id;
  if (lens && ia && ib) {
    return (
      <Sheet {...sheet} title={`${first(d.a)} vs ${first(d.b)}`} subtitle="Points at this game's scoring">
        <CompareBody g={lens} a={ia} b={ib} episode={d.episode ?? null} words={show.words} onEpisode={onEpisode} onFace={(id, n) => go.open({ kind: "cast", id, game: lens.leagueId, lens: lens.leagueId, ...(n != null ? { episode: n } : {}) })} />
      </Sheet>
    );
  }
  const a = stats.data?.cast.find((x) => same(x.name, d.a));
  const b = stats.data?.cast.find((x) => same(x.name, d.b));
  return (
    <Sheet {...sheet} title="Side by side" subtitle={stats.data ? `${show.header?.show.name ?? ""} · ${show.words.ep} ${stats.data.from === stats.data.to ? stats.data.from : `${stats.data.from}–${stats.data.to}`}` : undefined}>
      {stats.data && a && b ? <CompareCounts d={stats.data} a={a} b={b} words={show.words} /> : <Waiting />}
    </Sheet>
  );
}

/** The night (the Episodes tab's page, one part: episodes.tsx EpisodeNight) as a level over whatever's open: who left, what
 *  happened, how it went, your games; ‹ › through the episodes you've seen. A castaway's story opens it (the drill pass,
 *  2026-11-17: a pushed page sits under every sheet, so the page's own body comes up as a sheet instead). */
function NightLevel({ show, seasonId, d, sheet, open, onStep }: { show: ShowData; seasonId: string; d: Extract<Door, { kind: "night" }>; sheet: SheetBits; open: (d: Door) => void; onStep: (n: number) => void }) {
  const seen = (show.episodes?.episodes ?? []).filter((x) => x.status === "seen").map((x) => x.number).sort((a, b) => a - b);
  const at = seen.indexOf(d.episode);
  const e = show.episodes?.episodes.find((x) => x.number === d.episode && x.status === "seen") ?? null;
  const season = show.header ? `${show.header.show.name}${show.header.seasonNumber ? ` ${show.header.seasonNumber}` : ""}` : null;
  const step = (dir: 1 | -1) => {
    const to = seen[at + dir];
    if (to !== undefined) onStep(to);
  };
  return (
    <Sheet
      {...sheet}
      title={`${show.words.episode} ${d.episode}`}
      subtitle={[e?.title, season].filter(Boolean).join(" · ") || undefined}
      stepper={seen.length > 1 ? { prev: at > 0 ? `${show.words.ep} ${seen[at - 1]}` : null, next: at >= 0 && at < seen.length - 1 ? `${show.words.ep} ${seen[at + 1]}` : null, onStep: step } : undefined}
    >
      {e ? (
        <div key={d.episode} data-night-sheet={d.episode}>
          <EpisodeNight seasonId={seasonId} show={show} e={e} open={open} flush />
        </div>
      ) : (
        <p className="pb-3 text-[15px] text-muted-foreground">Reveal this {show.words.episode.toLowerCase()} to see it.</p>
      )}
    </Sheet>
  );
}

/** Whether a row opens a sheet: not a public pool's strangers (usernames, nothing more to open). */
export const opensSheet = (g: GameView, r: TableRow) => !(g.solo === "public" && !r.you);

/** "Survival Pool · 2nd of 4 · streak 4", in the game's own terms. */
function personLine(g: GameView, r: TableRow): string {
  const place = r.rank.startsWith("T") ? r.rank : ordinal(r.place);
  return `${g.gameName} · ${place} of ${g.players} · ${totalWords(g, r)}`;
}

/** A row's total as the game counts it: "19 pts", "5–2", "best streak 4", "3 weeks won". */
export function totalWords(g: GameView, r: TableRow): string {
  const k = g.plays.kind;
  if (k === "result" && r.record) return `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""}`;
  if (k === "pick") return `best streak ${r.total}`;
  if (k === "won" && g.weeksWon) {
    const w = g.weeksWon[r.playerId] ?? 0;
    return `${fmt(w)} ${w === 1 ? "week" : "weeks"} won`;
  }
  return `${fmt(r.total)} ${g.linePoints === null && (g.gameType === "weekly-calls" || g.gameType === "weekly-bingo") ? (g.gameType === "weekly-bingo" ? "lines" : "right") : r.total === 1 ? "pt" : "pts"}`;
}

function episodeLine(g: GameView, n: number): string {
  const sq = g.table.map((r) => sqOf(g, r, n)).filter((s): s is Square => !!s);
  if (g.plays.kind === "pick") {
    const stayed = sq.filter((s) => s.pick?.correct === true).length;
    return `${g.gameName} · ${stayed} of ${sq.filter((s) => s.pick).length} picks stayed`;
  }
  const top = Math.max(0, ...sq.map((s) => s.points ?? 0));
  const best = g.table.filter((r) => sqOf(g, r, n)?.points === top && top > 0).map((r) => (r.you ? "You" : r.name));
  return `${g.gameName} · ${best.length ? `best: ${best.join(", ")} ${signed(top)}` : "nobody scored"}`;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
const sqOf = (g: GameView, r: TableRow, n: number) => g.plays.rows[r.playerId]?.find((s) => s.episode === n) ?? null;
/** A seat's first account, for their face. */
const userOfRow = (r: TableRow) => r.userId ?? r.playerId;

// ---------- the person ----------

/** A lineup's weeks are today's lineup sheet; any other game, the strip in its own terms, the chosen episode, then the season. */
export function PersonBody({ g, show, seasonId, r, episode, onEpisode, go, onClose, compact }: GameCtx & { r: TableRow; episode: number | null; onEpisode: (n: number) => void; go: Drill; onClose: () => void; compact?: boolean }) {
  const lineup = r.weeks.length > 0 || (g.gameType === "active-roster" && g.plays.blocks.includes("lineup"));
  if (lineup)
    return (
      <>
        <LineupSheet g={g} r={r} week={episode ?? r.weeks.at(-1)?.episode ?? null} onWeek={onEpisode} words={show.words} onClose={onClose} onFace={(id) => go.open({ kind: "cast", id })} openEpisode={(n) => go.open({ kind: "episode", episode: n })} noTeam={compact || r.weeks.length > 0} />
        {!compact && (
          <PersonSeason
            g={g}
            r={r}
            words={show.words}
            sport={show.header?.show.kind === "sport"}
            at={episode ?? r.weeks.at(-1)?.episode ?? null}
            onMatchup={(n) => go.open({ kind: "matchup", playerId: r.playerId, episode: n })}
            onWeek={onEpisode}
            onFace={(id, n) => go.open({ kind: "cast", id, ...(n != null ? { episode: n } : {}) })}
          />
        )}
      </>
    );
  const eps = g.plays.episodes;
  if (g.plays.kind === "staged") return <p className="mt-2 pb-2 text-[15px] leading-snug text-muted-foreground">Each stage is a game of its own with its own season: {r.you ? "your" : `${r.name}'s`} plays are on each stage&apos;s page. Here, {totalWords(g, r)} overall.</p>;
  const sel = episode !== null && eps.includes(episode) ? episode : (eps.at(-1) ?? null);
  return (
    <div data-person-sheet={r.playerId} className="pb-2">
      {/* Round 3: a one-episode game has no week by week: its one episode is the block under it. */}
      {!oneGame(g) && <Strip g={g} r={r} sel={sel} onPick={onEpisode} words={show.words} />}
      {sel !== null && <EpisodeBlock g={g} show={show} seasonId={seasonId} r={r} n={sel} go={go} />}
      {sel === null && <p className="mt-3 text-sm text-muted-foreground">Nothing counted yet. It fills in from the first {show.words.episode.toLowerCase()} with results.</p>}
      {!compact && <SeasonBlock g={g} r={r} go={go} words={show.words} />}
    </div>
  );
}

const BAR = 64;

/** The strip of their weeks, one column an episode through your mark, the next saying only whether it's set. */
function Strip({ g, r, sel, onPick, words }: { g: GameView; r: TableRow; sel: number | null; onPick: (n: number) => void; words: ShowData["words"] }) {
  const sq = g.plays.rows[r.playerId] ?? [];
  const next = g.plays.next;
  const set = next ? next.set[r.playerId] : undefined;
  const k = g.plays.kind;
  const many = sq.length + (next ? 1 : 0) > 8;
  const colour = gameColour(g.gameName);
  const vals = sq.map((s) => s.points ?? 0);
  // A week's size either way: a negative one is a hatched bar of its size (lineup-sheet.tsx draws it the same), never the dashed box
  // of a week still to come.
  const max = Math.max(1, ...vals.map((v) => Math.abs(v)));
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const best = vals.length ? Math.max(...vals) : 0;
  const right =
    k === "pick"
      ? `streak now ${r.week ?? 0}`
      : k === "result" && r.record
        ? `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""} · ${fmt(r.record.for)} for`
        : k === "won"
          ? `${sq.filter((s) => s.won).length} won`
          : vals.length
            ? `${fmt(avg)} a ${words.episode.toLowerCase()} · best ${signed(best)} (${words.ep} ${sq[vals.indexOf(best)].episode})`
            : null;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = ref.current;
    const col = c?.querySelector<HTMLElement>(`[data-strip-ep="${sel}"]`);
    if (c && col && c.scrollWidth > c.clientWidth) c.scrollLeft = col.offsetLeft - (c.clientWidth - col.offsetWidth) / 2;
  }, [sel]);
  const cols = sq.length + (next ? 1 : 0);
  return (
    <>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{k === "pick" ? "Picks, oldest first" : `${words.episode} by ${words.episode.toLowerCase()}`}</p>
        {right && <small className="text-right text-[13px] text-muted-foreground">{right}</small>}
      </div>
      <div ref={ref} className={`-mx-4 px-4 ${many ? "overflow-x-auto [scrollbar-width:none]" : ""}`}>
        <div className="relative mt-2 grid gap-1" style={{ gridTemplateColumns: many ? `repeat(${cols}, 44px)` : `repeat(${cols}, minmax(0, 1fr))`, width: many ? "max-content" : undefined }} data-strip={k}>
          {(k === "points" || k === "race" || k === "lives") && vals.some((v) => v !== 0) && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 z-[1] border-t border-dashed border-muted-foreground/60" style={{ top: 26 + (BAR - (Math.max(0, avg) / max) * BAR) }} />
          )}
          {sq.map((s) => {
            const on = s.episode === sel;
            return (
              <button key={s.episode} type="button" data-strip-ep={s.episode} aria-pressed={on} aria-label={`${words.episode} ${s.episode}${s.late ? `. ${LATE_SET}` : ""}`} onClick={() => onPick(s.episode)} className={`relative flex min-h-11 flex-col items-center rounded-[3px] py-1.5 ${on ? "bg-secondary" : ""}`}>
                <StripCell g={g} s={s} on={on} max={max} colour={colour} />
                {s.late && <LateMark className="right-0.5 top-0.5" />}
                <span className={`mt-1.5 text-[12px] ${on ? "font-bold" : "text-muted-foreground"}`}>{many ? s.episode : `${words.ep} ${s.episode}`}</span>
              </button>
            );
          })}
          {next && (
            <span className="flex flex-col items-center py-1.5" data-strip-next={set === true ? "set" : set === false ? "unset" : "unknown"}>
              <span className={`type-num h-4 text-[15px] leading-4 ${set ? "text-good" : "text-muted-foreground"}`}>{set === true ? "Set" : "—"}</span>
              <span className="mt-1 flex w-full items-end justify-center" style={{ height: k === "pick" || k === "result" ? 40 : BAR }}>
                <span className="h-[18px] w-6 rounded-t-[2px] border-[1.5px] border-dashed border-muted-foreground/60" />
              </span>
              <span className="mt-1.5 text-[12px] text-muted-foreground">{many ? next.episode : `${words.ep} ${next.episode}`}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function StripCell({ g, s, on, max, colour }: { g: GameView; s: Square; on: boolean; max: number; colour: string }) {
  const k = g.plays.kind;
  if (k === "pick" && s.pick) {
    // Round 5 (B2): the night's outcome, a counted second pick's pip at its foot; a skipped night a dash.
    const night = nightKind(s.pick);
    const deciding = s.pick.correct !== false && s.pick.second && !s.pick.second.void && s.pick.second.correct === false ? s.pick.second.id : s.pick.id;
    const c = deciding ? faceIn(g, deciding) : undefined;
    if (night === "skipped") return <span role="img" aria-label="skipped" className="mt-0.5 grid size-10 place-items-center text-[18px] text-muted-foreground">–</span>;
    return (
      <span className="relative mt-0.5 block size-10">
        {c ? <Face src={c.photo} name={c.name} className={`size-10 rounded-[3px] text-sm ${night && night !== "stayed" ? "opacity-50 grayscale" : ""} ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""}`} /> : <span aria-label="No pick" className="block size-10 rounded-[3px] border border-dashed border-edge" />}
        {night && <NightBadge kind={night} cost={s.pick.boughtBack} className="absolute -right-1 -top-1 size-4" />}
        {s.pick.second && !s.pick.second.void && <i role="img" aria-label="a second pick counted" className="absolute -bottom-[6px] left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-foreground" />}
      </span>
    );
  }
  if (k === "pick") return <span className="mt-0.5 block size-10 rounded-[3px] border border-dashed border-edge" />;
  if (k === "result") {
    const r = s.result;
    if (r && s.waiting) {
      return (
        <>
          <b data-waiting className="type-num mt-0.5 grid size-[30px] place-items-center rounded-[3px] border border-dashed border-edge text-[17px] text-muted-foreground">…</b>
          <span className="type-num mt-1 whitespace-nowrap text-[13px] text-foreground/85">&nbsp;</span>
        </>
      );
    }
    return (
      <>
        <b className={`type-num mt-0.5 grid size-[30px] place-items-center rounded-[3px] text-[17px] ${r?.r === "W" ? "bg-good text-good-foreground" : r ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>{r?.r ?? "–"}</b>
        <span className="type-num mt-1 whitespace-nowrap text-[13px] text-foreground/85">{r ? `${fmt(r.us)}–${r.them === null ? "·" : fmt(r.them)}` : ""}</span>
      </>
    );
  }
  const v = s.points ?? 0;
  const neg = k !== "race" && v < 0;
  const h = Math.max(3, Math.round((Math.abs(k === "race" ? (s.total ?? 0) : v) / Math.max(1, k === "race" ? (g.plays.target ?? max) : max)) * BAR));
  return (
    <>
      <span className={`type-num h-4 text-[15px] leading-4 ${on ? "" : "text-muted-foreground"}`}>{s.points === null ? "–" : k === "race" ? fmt(s.total ?? 0) : fmt(v)}</span>
      <span className="relative mt-1 flex w-full items-end justify-center" style={{ height: BAR }}>
        <span className={`w-6 rounded-t-[2px] ${neg ? "bg-[repeating-linear-gradient(135deg,var(--muted-foreground)_0_2px,transparent_2px_5px)]" : on ? "" : "bg-muted-foreground/35"}`} style={{ height: h, background: on && !neg ? colour : undefined }} />
        {s.won && <span className="type-caption absolute left-1/2 top-0.5 -translate-x-1/2 rounded-[2px] bg-good px-1 text-[11px] tracking-[0.04em] text-good-foreground">Won</span>}
      </span>
    </>
  );
}

/** Right or wrong. Red is for leaving: a pick that went home crosses in live red; a wrong answer or call (`quiet`) on the raised fill. */
function Tick({ ok, quiet, className = "" }: { ok: boolean; quiet?: boolean; className?: string }) {
  return (
    <span className={`grid place-items-center rounded-full shadow-[0_0_0_1.5px_var(--card)] ${ok ? "bg-good text-good-foreground" : quiet ? "bg-input text-foreground" : "bg-live text-live-foreground"} ${className}`}>
      {ok ? <Check className="size-[70%]" strokeWidth={3.5} aria-label="right" /> : <X className="size-[70%]" strokeWidth={3.5} aria-label="wrong" />}
    </span>
  );
}

/** The chosen episode: its heading (where it placed that week, the points), then its plays by kind. */
function EpisodeBlock({ g, show, seasonId, r, n, go }: { g: GameView; show: ShowData; seasonId: string; r: TableRow; n: number; go: Drill }) {
  const s = sqOf(g, r, n);
  const k = g.plays.kind;
  // Round 5 (B2): a pool's night in its own word (forgiven, bought back, skipped), the night's outcome counting a second pick that
  // counted.
  const night = k === "pick" && s?.pick ? nightWord(s.pick) : null;
  const head = night ? night.word : k === "pick" ? (s?.pick ? (s.pick.correct === null ? "Waiting" : s.pick.correct ? "Stayed" : "Went home") : "No pick") : k === "result" ? (s?.waiting ? "…" : s?.result ? s.result.r : "–") : s?.points === null || !s ? "–" : signed(s.points);
  return (
    <section data-episode-block={n} className="mt-[22px] border-t border-border pt-[18px]">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" data-door-episode={n} onClick={() => go.open({ kind: "episode", episode: n })} className="type-caption -my-1 py-1 text-left text-[26px] underline decoration-border decoration-2 underline-offset-[5px]">
            {show.words.episode} {n}
          </button>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {blockLine(g, r, n, s)}
            {s?.late && <span data-late-set> · {LATE_SET}</span>}
          </p>
        </div>
        <b data-night-word={night?.word} className={`type-num flex-none text-[34px] leading-none ${night ? (night.tone === "good" ? "text-good" : night.tone === "quiet" ? "text-muted-foreground" : "") : (k === "result" && s?.result?.r === "W") || (k === "pick" && s?.pick?.correct) ? "text-good" : ""}`}>{head}</b>
      </div>
      {g.plays.blocks.map((b) => (
        <Block key={b} kind={b} g={g} show={show} seasonId={seasonId} r={r} n={n} s={s} go={go} />
      ))}
    </section>
  );
}

/** Round 5 (B2): a pool's night in one word, and its tone: the night's outcome, a wrong second pick that counted included. */
function nightWord(pk: NonNullable<Square["pick"]>): { word: string; tone: "good" | "quiet" | "plain" } {
  const k = nightKind(pk);
  if (k === null) return { word: pk.id ? "Waiting" : "No pick", tone: "quiet" };
  if (k === "home" && pk.correct !== false) return { word: "Wrong", tone: "plain" };
  return { stayed: { word: "Stayed", tone: "good" as const }, home: { word: "Went home", tone: "plain" as const }, missed: { word: "Missed", tone: "plain" as const }, forgiven: { word: "Forgiven", tone: "quiet" as const }, bought: { word: "Bought back", tone: "plain" as const }, skipped: { word: "Skipped", tone: "quiet" as const } }[k];
}

/** Round 5 (B2): the episode sheet's badge for a person's night (none for a skipped one or one still to be decided). */
function PersonNight({ pk }: { pk: NonNullable<Square["pick"]> }) {
  const night = nightKind(pk);
  return night && night !== "skipped" ? <NightBadge kind={night} cost={pk.boughtBack} className="absolute -right-1 -top-1 size-4" /> : null;
}

/** Round 5 (B2): a pool's night as a badge on its face (the grid's square, the person's strip): one glyph a kind. */
export function NightBadge({ kind, cost, className = "" }: { kind: NightKind; cost?: number; className?: string }) {
  if (kind === "skipped") return null;
  const b = {
    stayed: { cls: "bg-good text-good-foreground", icon: <Check className="size-[62%]" strokeWidth={4} />, label: "stayed" },
    home: { cls: "bg-live text-live-foreground", icon: <X className="size-[62%]" strokeWidth={4} />, label: "went home" },
    missed: { cls: "bg-input text-foreground", icon: <X className="size-[62%]" strokeWidth={4} />, label: "no pick, missed" },
    forgiven: { cls: "bg-good text-good-foreground", icon: <ShieldCheck className="size-[72%]" strokeWidth={3} />, label: "wrong, forgiven" },
    bought: { cls: "bg-foreground text-background", icon: <RotateCcw className="size-[62%]" strokeWidth={4} />, label: `bought back in${cost ? ` for ${cost}` : ""}` },
  }[kind];
  return (
    <i role="img" aria-label={b.label} data-night={kind} className={`grid place-items-center rounded-full shadow-[0_0_0_1.5px_var(--card)] ${b.cls} ${className}`}>
      {b.icon}
    </i>
  );
}

function blockLine(g: GameView, r: TableRow, n: number, s: Square | null): string {
  const k = g.plays.kind;
  if (k === "result" && s?.result) {
    const wait = g.waiting?.find((w) => w.episode === n && (w.playerId === s.result!.against || w.playerId === r.playerId));
    if (wait) return `Waiting on ${wait.playerId === r.playerId && r.you ? "your" : `${wait.name}'s`} ${g.plays.blocks.some((b) => b === "pick" || b === "picks") ? "pick" : "lineup"}`;
    const who = s.result.against ? (g.table.find((x) => x.playerId === s.result!.against)?.name ?? s.result.against) : s.result.median ? "the couch's middle score" : "a bye";
    const by = s.result.them === null ? "" : ` by ${fmt(Math.abs(s.result.us - s.result.them))}`;
    return `${s.result.round ? `Playoffs, round ${s.result.round} · ` : ""}${s.result.r === "W" ? `Beat ${who}${by}` : s.result.r === "L" ? `Lost to ${who}${by}` : `Tied with ${who}`}`;
  }
  if (k === "pick" && s?.pick?.skipped) return "Nobody was left you hadn't picked: nothing counted";
  if (k === "pick" && s?.pick?.id && s.pick.second && s.pick.correct !== false && s.pick.second.correct === false) return `Your second pick, ${first(faceIn(g, s.pick.second.id)?.name ?? "someone")}, went home`;
  if (k === "pick" && s?.pick?.id && s.pick.second) return `Picked ${first(faceIn(g, s.pick.id)?.name ?? "someone")} and ${first(faceIn(g, s.pick.second.id)?.name ?? "someone")}`;
  if (k === "pick") return s?.pick?.id ? `Picked ${faceIn(g, s.pick.id)?.name ?? "someone"}` : s?.pick ? "No pick · missed" : "No pick counted";
  const of = g.table.map((x) => sqOf(g, x, n)?.points ?? 0);
  const mine = s?.points ?? 0;
  const above = of.filter((p) => p > mine).length;
  const tied = of.filter((p) => p === mine).length > 1;
  return `${tied ? "Tied " : ""}${ordinal(above + 1)} of ${g.table.length} that ${g.plays.kind === "won" ? "week" : "episode"}${s?.won ? " · won it" : ""}`;
}

type BlockProps = { kind: string; g: GameView; show: ShowData; seasonId: string; r: TableRow; n: number; s: Square | null; go: Drill };

function Block(p: BlockProps) {
  switch (p.kind) {
    case "pick":
      return <PickBlock {...p} />;
    case "boots":
      return <BootsBlock {...p} />;
    case "answers":
    case "slate":
      return <AnswersBlock {...p} />;
    case "calls":
      return <CallsBlock {...p} />;
    case "card":
      return <CardBlock {...p} />;
    default:
      return <TeamBlock {...p} />;
  }
}

const Caption = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-2 mt-[18px] flex items-baseline justify-between gap-2">
    <p className="type-caption text-[14px] tracking-[0.02em] text-muted-foreground">{children}</p>
    {right && <small className="text-right text-[13px] text-muted-foreground">{right}</small>}
  </div>
);

/** A castaway's row in a block: their face and name open them in this game. */
function CastRow({ g, id, line, end, dim, go }: { g: GameView; id: string; line?: ReactNode; end?: ReactNode; dim?: boolean; go: Drill }) {
  const c = faceIn(g, id);
  return (
    <button type="button" data-door-cast={id} onClick={() => go.open({ kind: "cast", id })} className={`nd-press flex min-h-14 w-full items-center gap-3 border-t border-border py-1.5 text-left ${dim ? "text-muted-foreground" : ""}`}>
      <Face src={c?.photo ?? null} name={c?.name} out={c?.knocked} className={`size-10 flex-none rounded-[3px] ${dim ? "opacity-55 grayscale-[0.5]" : ""}`} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-semibold">{c?.name ?? "Someone"}</b>
        {line && <small className="block truncate text-[13px] text-muted-foreground">{line}</small>}
      </span>
      {end}
    </button>
  );
}

function PickBlock({ g, r, s, go }: BlockProps) {
  if (s?.pick?.skipped) return null;
  if (!s?.pick?.id) return <p className="mt-3 text-sm text-muted-foreground">{r.you ? "You made no pick that counted." : "No pick that counted."}</p>;
  const pk = s.pick;
  const two = !!pk.second;
  const fate = fateLine(r, pk);
  return (
    <>
      <Caption>{two ? "The picks" : "The pick"}</Caption>
      <CastRow g={g} id={pk.id!} go={go} line={`${two ? "Your pick · " : ""}${pk.correct === null ? "Still to be decided" : pk.correct ? "Stayed in" : "Went home"}`} end={pk.correct !== null ? <Tick ok={pk.correct} className="size-5 flex-none" /> : undefined} dim={pk.correct === false} />
      {two && (
        <CastRow
          g={g}
          id={pk.second!.id}
          go={go}
          line={pk.second!.void ? "Second pick · didn't count: one went home" : `Second pick · counted · ${pk.second!.correct === null ? "still to be decided" : pk.second!.correct ? "stayed in" : "went home"}`}
          end={!pk.second!.void && pk.second!.correct !== null ? <Tick ok={pk.second!.correct} className="size-5 flex-none" /> : undefined}
          dim={pk.second!.void || pk.second!.correct === false}
        />
      )}
      {fate && (
        <p data-pick-fate className="mt-2 flex items-start gap-2 border-t border-border pt-2.5 text-[13px] leading-snug text-muted-foreground">
          {fate.icon}
          <span>{fate.text}</span>
        </p>
      )}
    </>
  );
}

/** Round 5 (B2): what a wrong night did, in words: forgiven by a mulligan, bought back in (its cost), a life lost. */
function fateLine(r: TableRow, pk: NonNullable<Square["pick"]>): { icon: ReactNode; text: string } | null {
  if (typeof pk.boughtBack === "number") return { icon: <RotateCcw className="mt-0.5 size-3.5 flex-none" aria-hidden />, text: `Out of lives: ${r.you ? "you" : first(r.name)} bought back in for ${pk.boughtBack} ${pk.boughtBack === 1 ? "point" : "points"}, with one life from the next one.` };
  if (pk.forgiven) return { icon: <ShieldCheck className="mt-0.5 size-3.5 flex-none" aria-hidden />, text: "A mulligan forgave it: the streak carried on." };
  if (pk.lifeLost) return { icon: null, text: "It cost a life." };
  return null;
}

function BootsBlock({ g, s, go, show }: BlockProps) {
  const held = s?.held ?? [];
  if (!held.length) return null;
  const left = new Set(s?.left ?? []);
  return (
    <>
      <Caption right={left.size ? `${left.size} left in ${show.words.ep} ${s?.episode}` : "Nobody left"}>The team that {show.words.episode.toLowerCase()}</Caption>
      {[...held].sort((a, b) => Number(left.has(b)) - Number(left.has(a))).map((id) => (
        <CastRow key={id} g={g} id={id} go={go} line={left.has(id) ? "Went home" : "Still in"} dim={left.has(id)} />
      ))}
    </>
  );
}

/** A game where the whole team (or the picks) count: the team as it stands, each opening its castaway. */
function TeamBlock({ g, r, go }: BlockProps) {
  if (!r.team.length) return null;
  const spent = g.prices ? g.prices.spent[r.playerId] : undefined;
  return (
    <>
      <Caption right={spent !== undefined ? `Spent ${spent} of ${g.prices!.budget} · points this season` : "Points this season"}>The team</Caption>
      {r.team.map((id) => {
        const c = faceIn(g, id);
        const paid = g.prices?.paid[id];
        return <CastRow key={id} g={g} id={id} go={go} line={c?.knocked ? `Out${c.out ? ` · Ep ${c.out}` : ""}` : c?.left ? `${c.place === 1 ? "Won" : "Finalist"}${c.out ? ` · Ep ${c.out}` : ""}` : "Still in"} dim={!!c?.knocked} end={c?.points != null ? <PriceEnd points={c.points} paid={paid} /> : undefined} />;
      })}
    </>
  );
}

/** Their answers that episode, in their scored state: the question, their answer, what was right, what it earned. Each shows once
 *  it's locked (the questions route's rule): before that, only that it's in. */
function AnswersBlock({ g, seasonId, r, n }: BlockProps) {
  const q = useGameQuestions(seasonId, g.leagueId, n);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-24 animate-pulse rounded-[3px] bg-background" />;
  if (!d) return <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load the answers. Try again in a moment.</p>;
  const cast = new Map<string, QuestionFace>([...d.cast, ...d.groups].map((c) => [c.id, c]));
  const asked = d.questions.filter((x) => x.episode === n);
  if (!asked.length) return <p className="mt-3 text-sm text-muted-foreground">Nothing was asked that episode.</p>;
  return (
    <>
      <Caption>{r.you ? "Your answers" : "Their answers"}</Caption>
      {asked.map((x) => {
        const me = x.people.find((p) => p.playerId === r.playerId);
        const closed = x.status === "closed";
        const words = closed ? (me ? answerWords(x, me.answer, cast) : "") : r.you ? answerWords(x, x.mine, cast) : "";
        return (
          <div key={x.id} data-answer={x.id} className="border-t border-border py-2.5">
            <p className="mb-1.5 flex justify-between gap-2.5 text-[14px] text-foreground/85">
              <span className="min-w-0">{x.ask}</span>
              <span className="flex-none text-[13px] text-muted-foreground">{x.points} {x.points === 1 ? "pt" : "pts"}</span>
            </p>
            <div className="flex items-center gap-2.5">
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">{words || (closed ? "No answer" : r.you ? "Not answered yet" : "Hidden until it locks")}</b>
                <small className="mt-0.5 block text-[13px] text-muted-foreground">{closed ? verdictWords(x, d, cast) : "Still open"}</small>
              </span>
              {closed && me && me.right !== null && <Tick ok={me.right} quiet className="size-5 flex-none" />}
              <b className={`type-num flex-none text-[22px] ${closed && me && me.earned ? "" : "text-muted-foreground"}`}>{closed && me ? (me.right === null ? "–" : signed(me.earned)) : "–"}</b>
            </div>
            {closed && x.bot?.called && x.bot.answer != null && (() => {
              // Round 5 (B2, Designs needed 21): the bot's call beside the answer it was played against.
              const said = answerWords(x, x.bot.answer, cast);
              const same = !!me && said === answerWords(x, me.answer, cast);
              const beat = !!me && me.right === true && (me.earned ?? 0) > 0;
              return (
                <small data-bot-call className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Bot className="size-3.5 flex-none" aria-hidden />
                  {`The bot said ${said}${same ? " too" : ""}${same && me?.right ? ", so it doesn't score" : beat ? `: ${r.you ? "you" : first(r.name)} beat it` : ""}`}
                </small>
              );
            })()}
          </div>
        );
      })}
    </>
  );
}

/** Their calls that episode (Call it's): each call, what they said, right or not. */
function CallsBlock({ show, seasonId, r, n }: BlockProps) {
  const q = useEpisodeCalls(seasonId, show.couch?.id ?? null, n);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-24 animate-pulse rounded-[3px] bg-background" />;
  if (!d) return <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load the calls. Try again in a moment.</p>;
  const me = d.people.find((p) => p.userId === r.userId);
  if (!me) return <p className="mt-3 text-sm text-muted-foreground">{d.status === "closed" ? `${r.you ? "You" : r.name} made no calls that ${show.words.episode.toLowerCase()}.` : "Calls show once it's aired and you've seen it."}</p>;
  return (
    <>
      <Caption right={`${me.right} right`}>{r.you ? "Your calls" : "Their calls"}</Caption>
      {d.questions.map((x) => {
        const said = me.calls[x.key];
        const v = d.verdicts?.[x.key];
        const ok = said == null || !v || v.state !== "known" ? null : v.right.includes(said);
        const label = said == null ? "No call" : (x.options.find((o) => o.key === said)?.label ?? (said === "yes" ? "Yes" : said === "no" ? "No" : said));
        return (
          <div key={x.key} data-call={x.key} className="flex min-h-14 items-center gap-2.5 border-t border-border py-2">
            <span className="min-w-0 flex-1">
              <small className="block text-[13px] text-muted-foreground">{[x.lead, x.what].filter(Boolean).join(" ")}</small>
              <b className="block text-[15px]">{label}</b>
              {v?.state === "off" && <small className="block text-[13px] text-muted-foreground">{v.why}: it doesn&apos;t count</small>}
            </span>
            {ok !== null && <Tick ok={ok} quiet className="size-5 flex-none" />}
          </div>
        );
      })}
    </>
  );
}

/** Their bingo card that episode, marked as they ticked it, a line that counts lit. */
function CardBlock({ show, seasonId, r, n }: BlockProps) {
  const q = useEpisodeBingo(seasonId, show.couch?.id ?? null, n, !!r.userId, r.you ? null : r.userId);
  const d = q.data;
  if (q.isPending) return <div aria-busy className="mt-4 h-40 animate-pulse rounded-[3px] bg-background" />;
  if (!d || d.catchUp !== null) return <p className="mt-3 text-sm text-muted-foreground">{d?.catchUp ? `See ${show.words.episode} ${d.catchUp} first.` : "Couldn't load the card. Try again in a moment."}</p>;
  const ticked = new Set(d.ticked);
  const size = Math.round(Math.sqrt(d.squares.length)) || 3;
  return (
    <>
      <Caption right={`${d.lines.standing} ${d.lines.standing === 1 ? "line" : "lines"}`}>{r.you ? "Your card" : "Their card"}</Caption>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} data-card-block>
        {d.squares.map((sq, i) => {
          const happened = d.truth?.[i] === "yes";
          const on = ticked.has(i);
          return (
            <span key={sq.key + i} className={`grid min-h-14 place-items-center rounded-[3px] p-1 text-center text-[12px] leading-tight ${on && happened ? "bg-foreground font-bold text-background" : on ? "bg-input text-foreground" : "bg-background text-muted-foreground"}`}>
              {sq.label}
            </span>
          );
        })}
      </div>
    </>
  );
}

/** Then the season: a pool's every pick, a draft's team, or their totals. */
function SeasonBlock({ g, r, go, words }: { g: GameView; r: TableRow; go: Drill; words: ShowData["words"] }) {
  const prices = g.prices;
  const sq = g.plays.rows[r.playerId] ?? [];
  if (g.plays.kind === "pick") {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Best streak {r.total}, streak now {r.week ?? 0}. {r.you ? "Your next pick is yours alone until it's decided." : "Picks stay hidden from the couch until they're decided."}
      </p>
    );
  }
  if (g.plays.blocks.includes("boots") || g.plays.blocks.includes("team") || g.plays.blocks.includes("counted")) {
    if (g.plays.blocks.includes("team") || !r.team.length) return null;
    return (
      <>
        <Caption right={`${prices?.spent[r.playerId] !== undefined ? `Spent ${prices.spent[r.playerId]} of ${prices.budget} · ` : ""}${fmt(r.total)} pts`}>The team now</Caption>
        {r.team.map((id) => {
          const c = faceIn(g, id);
          const paid = prices?.paid[id];
          return <CastRow key={id} g={g} id={id} go={go} line={c?.knocked ? `Out${c.out ? ` · ${words.episode} ${c.out}` : ""}${c.place ? ` · finished ${ordinal(c.place)}` : ""}` : c?.left ? `${c.place === 1 ? "Won" : `Finalist${c.place ? ` · finished ${ordinal(c.place)}` : ""}`}${c.out ? ` · ${words.episode} ${c.out}` : ""}` : "Still in"} dim={!!c?.knocked} end={<PriceEnd points={c?.points ?? 0} paid={paid} />} />;
        })}
      </>
    );
  }
  const played = sq.filter((s) => s.points !== null);
  if (!played.length) return null;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {fmt(played.reduce((t, s) => t + (s.points ?? 0), 0))} over {played.length} {played.length === 1 ? words.episode.toLowerCase() : `${words.episode.toLowerCase()}s`}
      {g.plays.target !== null ? `, ${fmt(Math.max(0, g.plays.target - (sq.at(-1)?.total ?? 0)))} short of ${fmt(g.plays.target)}` : ""}. {r.you ? "" : `${r.name}'s next move shows only once it's set, never what it is.`}
    </p>
  );
}

// ---------- an episode ----------

/** Everyone's plays that night, a row each: a name opens them on this episode, a face its castaway. */
function EpisodeBody({ g, show, episode, go }: GameCtx & { episode: number; go: Drill }) {
  const k = g.plays.kind;
  return (
    <div data-episode-sheet={episode} className="pb-2">
      <EpisodeGames g={g} episode={episode} onOpen={(pid) => go.open({ kind: "matchup", playerId: pid, episode })} />
      {k !== "result" && <Caption>{k === "pick" ? "Everyone's pick" : "Everyone's night"}</Caption>}
      {k !== "result" && g.table.filter((r) => opensSheet(g, r)).map((r) => {
        const s = sqOf(g, r, episode);
        const pickId = s?.pick?.id ?? null;
        const face = pickId ? faceIn(g, pickId) : undefined;
        return (
          <div key={r.playerId} className="flex min-h-14 items-center gap-3 border-t border-border py-1.5" data-episode-row={r.playerId}>
            <button type="button" data-door-person={r.playerId} onClick={() => go.open({ kind: "person", playerId: r.playerId, episode })} className="nd-press flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              <Avatar id={userOfRow(r)} name={r.name} size={28} />
              <span className="min-w-0 flex-1">
                <b className="flex items-center gap-1.5 text-[15px] font-semibold">
                  <span className="truncate">{r.name}</span>
                  {r.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-background">You</span>}
                </b>
                <small className="block truncate text-[13px] text-muted-foreground">
                  {k === "pick" && s?.pick ? `${nightWord(s.pick).word} · ${blockLine(g, r, episode, s)}` : k === "pick" ? (pickId ? `Picked ${face?.name ?? "someone"}${s?.pick?.correct === null ? "" : s?.pick?.correct ? ", who stayed" : ", who went home"}` : s?.pick ? "No pick · missed" : "No pick that counted") : blockLine(g, r, episode, s)}
                </small>
              </span>
            </button>
            {k === "pick" && pickId ? (
              <button type="button" data-door-cast={pickId} onClick={() => go.open({ kind: "cast", id: pickId })} className="relative flex-none">
                <Face src={face?.photo ?? null} name={face?.name} className={`size-10 rounded-[3px] ${s?.pick?.correct === false ? "opacity-50 grayscale" : ""}`} />
                {s?.pick && <PersonNight pk={s.pick} />}
              </button>
            ) : k === "pick" ? (
              <span aria-hidden className="block size-10 flex-none rounded-[3px] border border-dashed border-edge" />
            ) : (
              <b className={`type-num flex-none text-[22px] ${s?.best ? "" : "text-muted-foreground"}`}>{(k as string) === "result" ? (s?.result ? `${fmt(s.result.us)}` : "–") : s?.points == null ? "–" : signed(s.points)}</b>
            )}
          </div>
        );
      })}
      <p className="mt-3 text-[13px] text-muted-foreground">The arrows above step through the {show.words.episode.toLowerCase()}s. The next one&apos;s moves stay hidden until they&apos;re decided.</p>
    </div>
  );
}

/** A tab's drill (the Cast tab, the Games tab, the draft room, waivers): no game of its own, each door naming the game it reads, so
 *  a castaway, a stat's board, a compare and a person in any of your games open as levels of one path. Games are read fresh from
 *  the show each render, so a reveal under an open sheet moves it too. `onFlag` and `onRank` run after the drill has closed. */
export function useGameDrill(show: ShowData, opts: { onFlag?: ((episode: number, who: string) => void) | null; onRank?: ((key: string) => void) | null } = {}) {
  const drill = useDrill();
  return {
    open: drill.open,
    closeAll: drill.closeAll,
    openPerson: (row: TableRow, game: GameView, week: number | null) => drill.open({ kind: "person", playerId: row.playerId, episode: week, game: game.leagueId }),
    /** Someone in that game (the Cast tab's game lens): their sheet, counted by that game when it counts people week by week. */
    openCast: (game: GameView, castId: string, episode?: number) => drill.open({ kind: "cast", id: castId, game: game.leagueId, ...(episode != null ? { episode } : {}) }),
    sheets: <DrillSheets drill={drill} g={null} show={show} seasonId={show.header?.seasonId ?? ""} rules={[]} onFlag={opts.onFlag ?? null} onRank={opts.onRank ?? null} />,
  };
}
