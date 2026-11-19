"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, BookOpen, Check, ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { airTime, lockTime } from "../clock";
import { backstage, gamesApi, useAfterReveal, useCouchGames, useHowItWorks, useSeasonDraft, useSeasonPolls, useSeasonWaivers, useStartOptions, type DraftGame, type GameView, type JoinGame, type TableRow, type WaiverWeek } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { openStartGame } from "../couch/start-game";
import { toast } from "../ui/toast";
import { JoinGameRow, JoinGameSheet } from "../couch/join-game";
import { spanName } from "@/lib/game/spans";
import { gameColour, gameInk, GAME_STYLE, isGameName } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Chip, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { castName, faceIn, first, openMoves } from "./moves";
import { matchSlots } from "@/lib/lineup-slots";
import { yourMove, type YourMove } from "./your-move";
import { placeOf, sheetAsks } from "./tonight";
import { Block, Face } from "./parts";
import { playsWaivers, WaiversHowBody } from "./waivers";
import { SoloGames } from "./solo";
import { useOpenMake } from "./make-game";
import { CallRow } from "./calls";
import { SheetRow } from "./questions";
import { PollRow, StartPollRow } from "./polls";
import { showLabel } from "./react";
import { bingoEpisode, BingoRow } from "./bingo";
import { TriviaRow } from "./trivia";
import { nextWeek, signed } from "./lineup-sheet";
import { opensSheet, totalWords, useGameDrill } from "./game-sheets";
import { oneGame, thisWeek } from "./this-week";
import { WhatsOn } from "./whats-on";

// Games (the mock's show.js tabStandings, gamestab.js, rulebook.js rbHowRow): where you play. Since the design round's step 6
// (docs/design-round/step6-games-spec.md) one row per game: your place, its move, a mini leaderboard and Last picks (GameRows
// below); the full tables live on each game's page. Before that it was a pill per game, then each table; a row opens that person's team, Rules each game in plain words),
// How it works, this week's one-night games and Start a game; a show you don't play gets Play it. Real: the tables
// (your games through the guard: game-view.ts), each game's rules (its settings: game-rules.ts), How it works' row.
// This week's bingo, Call it, the couch's polls and trivia are real (step 12). Make it a game (10 part 2a) and Start a game, Run
// it back and an archived game's Bring it back (10 part 2b) are real.
// What everyone's doing (the 2026-10-30 mock): every table names its columns; Weekly Lineup's rows show who each player started
// last episode and that week's points (its episode chips went 2026-10-31: the player sheet's weeks do that now). A player's sheet
// steps through the table (‹ ›, or a swipe on its header) and, for Weekly Lineup, through their weeks (lineup-sheet.tsx). A
// game's line on Tonight or an episode page lands here (?game=<id>&ep=N), on that game's table. Your move in each game is a card
// under its name (the user, 2026-10-31: your-move.ts): what you've set or what's due, the draft and the mid-season draft
// included, one tap to Your moves on that game or to its page; a game that needs you gets a dot on its pill. No dock here.

/** A game's line under its name: what it is, for a game the new design knows. */
const lineOf = (g: GameView) => (isGameName(g.gameName) ? GAME_STYLE[g.gameName].line : g.name);
/** A game over a span (step 6 of docs/PLAN-sports-data.md), in the show's words: "Games 4–6", "Final · Game 4"; a season game
 *  that starts later than the next episode to air (step A3 of docs/PLAN-start-a-game-gpt.md), by the schedule, not by what
 *  you've seen: "Starts with Episode 9"; one waiting for a phase of the season: "Starts when Merged starts"; else null. */
const spanOf = (g: GameView, words: ShowData["words"], aired: number) =>
  g.from === null
    ? g.over
      ? null
      : `Starts when ${g.phase ?? "its phase"} starts`
    : g.to === null
    ? g.from > aired + 1 && !g.over
      ? `Starts with ${words.episode} ${g.from}`
      : null
    : `${g.over ? "Final · " : ""}${spanName(g.from, g.to, { singular: words.episode.toLowerCase(), plural: words.episodes.toLowerCase() })}`;
const anchor = (g: GameView) => `game-${g.leagueId}`;

export function Games({ show }: { show: ShowData }) {
  if (show.readOnly) return <ReadOnlyGames show={show} />;
  return <YourGamesHere show={show} />;
}

/**
 * Read-only (the desk's Open it, src/new/read-only.tsx; the mock's dgRoGames): the one game's table as anyone on the couch
 * sees it, at your own mark, nobody marked "you"; Rules and a person's team open as ever. Nothing to join, start or reveal.
 */
function ReadOnlyGames({ show }: { show: ShowData }) {
  const people = useGameDrill(show);
  const [rules, setRules] = useState<GameView | null>(null);
  const ro = show.readOnly!;
  if (!show.play) return <div aria-busy className="mx-4 mt-4 h-72 animate-pulse rounded-[4px] bg-card" />;
  // The game open read-only, by its id: were the server to answer as yourself (it was deleted meanwhile, say), not yours.
  const g = show.play.find((x) => x.leagueId === ro.leagueId);
  if (!g) return <p className="px-4 pt-6 text-[15px] text-muted-foreground">{ro.name} can&apos;t be read right now.</p>;
  const seats = `${g.players} ${g.players === 1 ? "player" : "players"}${ro.runBy?.length ? ` · run by ${ro.runBy.join(", ")}` : ""}`;
  return (
    <>
      <Standings play={[g]} words={show.words} aired={show.latestAired} scope={null} onPlayer={people.openPerson} onRules={setRules} readOnly />
      <p data-read-only-foot className="px-4 pt-4 text-[13px] text-muted-foreground">
        {g.through ? `Through ${show.words.episode} ${g.through}, where you are.` : "Nothing counted yet, as far as you've watched."} {seats}.
      </p>
      {people.sheets}
      <RulesSheet game={rules} play={[g]} onGame={setRules} waivers={[]} />
    </>
  );
}

function YourGamesHere({ show }: { show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  // Games on the couch here you're not in (step 9): join, ask, or see it's closed.
  const couchGames = useCouchGames(show.couch?.id ?? null, show.games.some((g) => !g.yourRole));
  const others = (couchGames.data?.games ?? []).filter((g) => g.seasonId === show.header?.seasonId && !g.ended && !g.you?.playing);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const people = useGameDrill(show);
  const [rules, setRules] = useState<GameView | null>(null);
  const name = (show.header?.show.name ?? "This show").replace(/^The /, "");
  // From a game's line on Tonight or an episode page (?game=<id>&ep=N): once the tab has slid in, glide to that game's table.
  const params = useSearchParams();
  const asked = params.get("game");
  const askedEp = Number(params.get("ep")) || null;
  const ready = !!show.play;
  useEffect(() => {
    if (!asked || !ready) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = () => document.getElementById(`game-${asked}`);
    const go = (smooth: boolean) => el()?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    let t = 0;
    let tries = 0;
    let steady = 0;
    let last = NaN;
    // A finger or a wheel on the page meanwhile: the scroll is theirs.
    const stop = () => window.clearTimeout(t);
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    // A glide started while the tabs still slide (nav.tsx marks html[data-nav] until the transition has played), or while the
    // tables above still settle, gets cut short: wait for both, then glide, and finish it at once if it didn't land.
    const wait = () => {
      const top = el()?.getBoundingClientRect().top ?? NaN;
      steady = top === last ? steady + 1 : 0;
      last = top;
      if ((document.documentElement.dataset.nav || steady < 3) && tries++ < 60) {
        t = window.setTimeout(wait, 50);
        return;
      }
      go(!still);
      t = window.setTimeout(() => {
        const at = el();
        if (at && Math.abs(at.getBoundingClientRect().top - parseFloat(getComputedStyle(at).scrollMarginTop || "0")) > 24) go(false);
      }, 900);
    };
    t = window.setTimeout(wait, 50);
    return () => {
      stop();
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
    };
  }, [asked, askedEp, ready]);
  // How waivers work, under the rules of a game that has them (step 6a); and each game's mid-season draft for its card.
  const wv = useSeasonWaivers(show.header?.seasonId ?? "", show.couch?.id ?? null, !!show.header && playsWaivers(show));
  // The drafts, while a game with a team to draft hasn't started counting or you've no team yet (after that, the mid-season
  // draft is waivers').
  const drafting =
    !!show.play?.some((g) => (g.gameType === "classic-draft" || g.gameType === "active-roster") && !!g.you && (g.you.team.length === 0 || g.from === null || g.through < g.from)) ||
    show.moves.some((m) => m.kind === "draftTurn" || m.kind === "blindDraft");
  const drafts = useSeasonDraft(show.header?.seasonId ?? "", show.couch?.id ?? null, { enabled: !!show.header && drafting }).data?.games ?? [];
  const moves = new Map<string, YourMove>();
  for (const g of show.play ?? []) {
    const m = yourMove(g, {
      seasonId: show.header?.seasonId ?? "",
      episode: show.words.episode,
      when: (iso) => airTime(Date.parse(iso)),
      draft: drafts.find((d) => d.leagueId === g.leagueId),
      waivers: wv.data?.games.find((w) => w.leagueId === g.leagueId),
    });
    if (m) moves.set(g.leagueId, m);
  }
  return (
    <>
      {playing ? (
        show.play ? (
          // Round 3 (docs/design-round/round3-short-games-spec.md): what's on, by episode; the season's games as step 6's rows; the
          // newest results, Again, and the archive's door.
          <WhatsOn
              show={show}
              moves={moves}
              oneNight={<ThisWeek show={show} bare />}
              row={(g) => {
                const play = show.play ?? [];
                const twin = play.filter((x) => x.gameType === g.gameType && !oneGame(x)).length > 1;
                return (
                  <GameRow
                    key={g.leagueId}
                    show={show}
                    g={g}
                    name={g.solo === "public" ? "Everyone" : twin && g.name !== g.gameName ? g.name : g.gameName}
                    move={moves.get(g.leagueId) ?? null}
                    draft={drafts.find((d) => d.leagueId === g.leagueId && d.phase !== "done") ?? null}
                    onPlayer={people.openPerson}
                    onCast={people.openCast}
                  />
                );
              }}
            />
        ) : (
          <div aria-busy className="mx-4 mt-4 h-72 animate-pulse rounded-[4px] bg-card" />
        )
      ) : others.length || (show.solo && show.ready) ? null : (
        // Solo too, while nobody's set it up: anyone can make a show a game (step 10 part 2a).
        <PlayIt show={show} />
      )}
      {/* On your own (step 9 part 3): the season's public pool and your practice couch, when you're solo. */}
      {show.solo && <SoloGames show={show} />}
      {show.couch && others.length > 0 && (
        <Block title={playing ? "Also on the couch" : "Join a game"} aside={`${others.length} ${others.length === 1 ? "game" : "games"}`}>
          <div data-games-join>
            {others.map((g) => (
              <JoinGameRow key={g.leagueId} couchId={show.couch!.id} g={g} strong={!playing} onJoin={setJoining} />
            ))}
          </div>
          <JoinGameSheet couchId={show.couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />
        </Block>
      )}
      {show.ready && <HowRow show={show} name={name} />}
      {!playing && <ThisWeek show={show} />}
      {!show.solo && show.ready && <StartRow show={show} />}
      {people.sheets}
      <RulesSheet game={rules} play={show.play ?? []} onGame={setRules} waivers={wv.data?.games ?? []} />
    </>
  );
}

// ---------- a game's row (the design round's step 6: docs/design-round/step6-games-spec.md) ----------
// One row per game, the due one first: its name (the game's page), your place in its own unit, the line that changes with the
// situation, its one move (outlined: the strip owns the yellow), a mini leaderboard, and Last picks folded under it. A game mid-draft
// says the draft instead: who's picking, how many picks until yours, your slots. The full tables live on each game's page.

const short = (n: number) => String(Math.round(n * 10) / 10).replace("-", "−");
/** A leaderboard row's number, in the game's unit (the unit is said once, in your place line). */
function totalShort(g: GameView, r: TableRow): string {
  const k = g.plays.kind;
  if (k === "result" && r.record) return `${r.record.wins}–${r.record.losses}${r.record.ties ? `–${r.record.ties}` : ""}`;
  if (k === "won" && g.weeksWon) return short(g.weeksWon[r.playerId] ?? 0);
  return short(r.total);
}
/** Nothing has counted in this game yet (as far as you've seen): no ranking to show. */
const nothingYet = (g: GameView) => g.through < 1 || (g.table.every((r) => r.total === 0 && r.weeks.length === 0 && !r.record?.wins && !r.record?.losses) && g.plays.kind !== "pick");

function GameRow({ show, g, name, move, draft, onPlayer, onCast }: { show: ShowData; g: GameView; name: string; move: YourMove | null; draft: DraftGame | null; onPlayer: (row: TableRow, game: GameView, week: number | null) => void; onCast: (g: GameView, id: string) => void }) {
  const [open, setOpen] = useState(false);
  const seasonId = show.header?.seasonId ?? "";
  const href = seasonId ? paths.gamePage(seasonId, g.leagueId) : null;
  const ink = gameInk(g.gameName);
  const fresh = nothingYet(g);
  const last = lastPicks(g, show.words.ep);
  const me = g.you;
  const rows = g.table.length <= 5 ? g.table : [...g.table.slice(0, 3), ...(me && me.place > 3 ? [me] : [])];
  const more = g.table.length - rows.length;
  const latest = g.table[0]?.weeks.at(-1)?.episode ?? null;
  return (
    <section id={anchor(g)} data-table={g.leagueId} data-game-row={draft ? "draft" : "standing"} className="scroll-mt-28 rounded-[10px] bg-card px-3.5 pb-1.5 pt-1">
      {href ? (
        <NavLink href={href} data-game-open={g.leagueId} className="nd-press -mx-1 flex min-h-11 items-center gap-2 rounded-[3px] px-1">
          <i className="size-2 flex-none rounded-full" style={{ background: ink }} aria-hidden />
          <h2 className="type-caption min-w-0 flex-1 truncate text-[19px] leading-none">{name}</h2>
          <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
        </NavLink>
      ) : (
        <h2 className="type-caption flex min-h-11 items-center text-[19px]">{name}</h2>
      )}
      {draft ? (
        <DraftLine show={show} g={g} d={draft} move={move} />
      ) : (
        <>
          <Place show={show} g={g} fresh={fresh} />
          {g.archived && <Archived g={g} scope={show.header && show.couch ? { seasonId: show.header.seasonId, couchId: show.couch.id } : null} />}
          {/* Who you've got, at a glance (the user, 2026-11-18: "we mention Thien but never show her face plate"): Glance. */}
          <Glance g={g} m={move} onCast={onCast} />
          {g.table.length > 0 && (
            <div className="mt-1" data-leaderboard>
              {rows.map((r) => (
                <BoardRow key={r.playerId} g={g} r={r} fresh={fresh} extras={open && last ? last.faces(r) : null} onClick={() => onPlayer(r, g, g.gameType === "active-roster" ? latest : null)} />
              ))}
              {more > 0 && href && (
                <NavLink href={href} className="nd-press flex min-h-10 items-center border-t border-border text-[14px] font-semibold text-muted-foreground">
                  and {more} more
                </NavLink>
              )}
            </div>
          )}
          {last && (
            <button
              type="button"
              data-last-picks={open ? "open" : "closed"}
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex min-h-10 w-full items-center gap-1.5 border-t border-border text-[14px] font-semibold text-muted-foreground"
            >
              {last.label}
              <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Your place in the game's own unit, and the line that changes with the situation: the gap, this week's opponent, the end. */
function Place({ show, g, fresh }: { show: ShowData; g: GameView; fresh: boolean }) {
  const me = g.you;
  const w = thisWeek(g, {
    words: show.words,
    total: (r) => totalWords(g, r),
    next: show.upNext ? { number: show.upNext.number, when: show.upNext.airAt ? lockTime(Date.parse(show.upNext.airAt)) : null } : null,
    move: null,
    seen: show.seenThrough,
    locked: g.locked ?? null,
    reveal: show.episodes?.reveal ?? null,
    aired: show.latestAired,
  });
  const span = g.to !== null && g.over ? null : spanOf(g, show.words, show.latestAired);
  let line: string | null = null;
  const done = show.header?.status === "completed" || (g.to !== null && g.over);
  const top = g.table.find((r) => r.place === 1);
  if (done && !w?.champion && top) line = `Final · ${top.you ? "you" : top.name} won it`;
  else if (w?.champion) line = w.champion.name === "You" ? "You won it" : `${w.champion.name} won it`;
  else if (w?.kind === "matchup" && w.them) line = `${w.label.split(" · ")[0]} · vs ${w.them.name}${w.them.record ? ` ${w.them.record}` : ""}`;
  else if (me && !fresh && g.plays.kind !== "result") {
    const ahead = g.table.filter((r) => r.place < me.place).at(-1);
    const behind = g.table.find((r) => r.place > me.place);
    const points = g.plays.kind !== "pick";
    line = points ? (ahead ? `${short(ahead.total - me.total)} behind ${ahead.name}` : behind ? `${short(me.total - behind.total)} ahead of ${behind.name}` : null) : null;
  }
  const lines = [span, line].filter(Boolean).join(" · ");
  if (!me) return <p className="pb-1 text-[14px] text-muted-foreground">Not on the table yet</p>;
  return (
    <div className="-mt-1 flex items-baseline gap-3" data-place>
      <b className="type-num text-[30px] leading-none">{fresh ? "—" : placeOf(g)}</b>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{fresh ? `${g.players} ${g.players === 1 ? "player" : "players"} · nothing counted yet` : [g.players > 1 ? `of ${g.players}` : null, totalWords(g, me)].filter(Boolean).join(" · ")}</span>
        {lines && <small className="block truncate text-[14px] text-muted-foreground">{lines}</small>}
      </span>
    </div>
  );
}

/** The game's one move, quiet: a dot when it's due (the strip holds the yellow fill), what and when, and its outlined button. */
function MoveLine({ g, m }: { g: GameView; m: YourMove }) {
  const nav = useNav();
  return (
    <button
      type="button"
      data-your-move={m.kind}
      data-due={m.due}
      onClick={() => ("tab" in m.go ? openMoves(m.go.tab, g.leagueId) : nav.push(m.go.href))}
      className="nd-press -mx-1 mt-0.5 flex min-h-12 w-[calc(100%+8px)] items-center gap-2.5 rounded-[4px] px-1 text-left"
    >
      {m.due && <i data-move-due className="size-[7px] flex-none rounded-full bg-chyron-line" aria-label="Needs you" />}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[15px] font-bold leading-tight">{m.title}</b>
        <small className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted-foreground">{m.line}</small>
      </span>
      <span className="grid h-9 flex-none place-items-center whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">{m.action}</span>
    </button>
  );
}

/**
 * Episode night's at-a-glance (strip-night.ts): who you've got, in each game's own shape (the user, 2026-11-18: "different game
 * types should have different at a glance views"; "the UI should consider a large starting lineup"), one row a game however many the
 * couch has going ("keep the vertical real estate in check... who's to know how many games could be going on"). The move's own row,
 * its people leading as small cast tiles (Tonight's plate's rows, the same anatomy), at most three places (past them a "+N"):
 *   a lineup:   its starters (by slot where the game has slots), an empty slot dashed; set, the row names them;
 *   a pick:     the pick, ticked; set, the row names it;
 *   a claim:    who leaves (greyed) and who comes in;
 *   a team:     a game with a team and nothing weekly to set (Outlast), or swaps open on it: your team, whoever's out greyed.
 * The tiles open the detail in place: the face plates (a slot's tag, points, the bench, what a pick puts on the line), each opening
 * its sheet, and Show less. The words and the button open Your moves, as MoveLine's do.
 */
type GlanceFace = { id: string; sub: string; out?: boolean; tick?: boolean; slot?: string | null };
type GlanceShape = { kind: "lineup" | "pick" | "claim" | "team"; faces: GlanceFace[]; gaps: string[]; note: { title: string; body: string } | null };

/** The row's places: three, so a row of nine is the same height as a row of one. */
const CELLS = 3;
/** The detail's plates a row. */
const ROW = 4;
const pts = (n: number | null | undefined) => `${String(Math.round((n ?? 0) * 10) / 10).replace("-", "−")} pts`;
const listed = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

function glanceShape(g: GameView, m: YourMove | null): GlanceShape | null {
  if (m?.kind === "lineup" && g.lineup) {
    const L = g.lineup;
    const ls = L.lineupSlots;
    const owner = ls ? matchSlots(L.starters, ls.fits, ls.widths) : null;
    const slotOf = (id: string) => (ls && owner ? (ls.labels[owner.indexOf(id)] ?? null) : null);
    // By slot where the game has them (QB, RB, RB, WR...), else as set.
    const starters = [...m.faces].sort((a, b) => (owner ? owner.indexOf(a) - owner.indexOf(b) : 0));
    const gaps = ls && owner ? ls.labels.filter((_, i) => owner[i] === null).slice(0, m.empty) : Array.from({ length: m.empty }, () => "");
    while (gaps.length < m.empty) gaps.push("");
    const bench = L.roster.filter((id) => !m.faces.includes(id) && !faceIn(g, id)?.left);
    return {
      kind: "lineup",
      faces: starters.map((id) => {
        const c = faceIn(g, id);
        const slot = slotOf(id);
        return { id, slot, out: m.out.includes(id) || !!c?.left, sub: slot ? `${slot} · ${pts(c?.points)}` : pts(c?.points) };
      }),
      gaps,
      note: bench.length ? { title: "Bench", body: bench.map((id) => castName(faceIn(g, id), g)).join(", ") } : null,
    };
  }
  if (m?.kind === "pick" && g.pick) {
    const p = g.pick;
    const who = m.faces[0] ? first(faceIn(g, m.faces[0])?.name ?? "") : "";
    return {
      kind: "pick",
      faces: m.faces.map((id) => ({ id, tick: true, sub: p.streak ? `Streak ${p.streak}` : "Your pick" })),
      gaps: Array.from({ length: m.empty }, () => "Pick"),
      note: m.faces.length
        ? { title: "On the line", body: p.streak ? `Streak ${p.streak} → ${p.streak + 1} if ${who} survives` : "A right pick starts a streak" }
        : { title: "To pick from", body: `${p.available.length} you haven't used${p.streak ? ` · streak ${p.streak} on the line` : ""}` },
    };
  }
  if (m?.kind === "waivers" && m.faces.length === 2 && m.out.length === 1) {
    return {
      kind: "claim",
      faces: m.faces.map((id) => ({ id, out: m.out.includes(id), sub: m.out.includes(id) ? "Leaves" : "Comes in" })),
      gaps: [],
      note: null,
    };
  }
  // A game with a team and nothing weekly to set (or a swap to make with it): your team, still in first.
  const team = g.you?.team ?? [];
  if ((!m || m.kind === "swaps") && team.length && g.gameType !== "active-roster") {
    const ids = [...team].sort((a, b) => Number(!!faceIn(g, a)?.knocked) - Number(!!faceIn(g, b)?.knocked));
    return {
      kind: "team",
      faces: ids.map((id) => {
        const c = faceIn(g, id);
        return { id, out: !!c?.knocked, sub: c?.knocked ? (c.out ? `Out · Ep ${c.out}` : "Out") : "Still in" };
      }),
      gaps: [],
      note: null,
    };
  }
  return null;
}

/** The row's words: who you've got when it's set (the names are the glance: "Cristian, Danny and Devin", "Thien"), the move's own
 *  words when something's missing, or it's a claim or swaps on your team (the move is the news there); a lineup too big to name is
 *  counted ("9 starting"). */
function glanceWords(g: GameView, m: YourMove | null, s: GlanceShape): string {
  if (!m) return "Your team";
  if (m.due || s.kind === "claim" || s.kind === "team" || !s.faces.length) return m.kind === "pick" ? m.title.replace(/:\s.*$/, "") : m.title;
  if (s.faces.length > CELLS) return `${s.faces.length} starting`;
  return listed(s.faces.map((f) => castName(faceIn(g, f.id), g)));
}

function Glance({ g, m, onCast }: { g: GameView; m: YourMove | null; onCast: (g: GameView, id: string) => void }) {
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const s = glanceShape(g, m);
  if (!s) return m ? <MoveLine g={g} m={m} /> : null;
  const go = () => (m ? ("tab" in m.go ? openMoves(m.go.tab, g.leagueId) : nav.push(m.go.href)) : undefined);
  const stillIn = s.faces.filter((f) => !f.out).length;
  const words = glanceWords(g, m, s);
  const line = m ? m.line : `${stillIn} of ${s.faces.length} still in`;
  // The row's places: past three, the empty ones first (what's missing never hides), then faces, then "+N".
  const total = s.faces.length + s.gaps.length;
  const over = total > CELLS;
  const gapsShown = over ? Math.min(s.gaps.length, CELLS - 1) : s.gaps.length;
  const facesShown = over ? Math.max(0, CELLS - 1 - gapsShown) : s.faces.length;
  const hidden = total - gapsShown - facesShown;
  const hiddenGaps = s.gaps.length - gapsShown;
  const tile = "h-[34px] w-[26px] flex-none rounded-[2px]";
  const gap = (i: number) => (
    <span key={`g${i}`} data-glance-gap className={`grid ${tile} place-items-center text-muted-foreground outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-edge`}>
      <Plus className="size-3.5" aria-hidden />
    </span>
  );
  const faces = s.faces.slice(0, facesShown).map((f) => {
    const c = faceIn(g, f.id);
    return (
      <span key={f.id} data-glance-face={f.id} className="relative flex-none">
        <Face src={c?.photo ?? null} name={c?.name} className={`${tile} text-[13px] ${f.out ? "opacity-50 grayscale" : ""}`} />
        {f.tick && (
          <span className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-good text-good-foreground shadow-[0_0_0_2px_var(--card)]">
            <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
          </span>
        )}
      </span>
    );
  });
  const gaps = Array.from({ length: gapsShown }, (_, i) => gap(i));
  return (
    <div data-your-move={m?.kind ?? "team"} data-due={m?.due ?? false} data-move-plates data-glance={s.kind} data-glance-open={open || undefined} className="mt-0.5">
      <div className="-mx-1 flex min-h-[52px] w-[calc(100%+8px)] items-center gap-2.5 px-1">
        {m?.due && <i data-move-due className="size-[7px] flex-none rounded-full bg-chyron-line" aria-label="Needs you" />}
        {/* Who, as tiles: the way into the detail (bigger faces, slots, points, the bench), in place. */}
        <button
          type="button"
          data-glance-tiles
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} ${s.kind === "team" ? "your team" : s.kind === "pick" ? "your pick" : s.kind === "claim" ? "your claim" : "your lineup"}`}
          onClick={() => setOpen(!open)}
          className="nd-press -my-1 flex min-h-11 flex-none items-center gap-[3px] rounded-[4px] py-1"
        >
          {over ? [...gaps, ...faces] : [...faces, ...gaps]}
          {hidden > 0 && (
            <span
              data-glance-more
              className={`type-num grid ${tile} place-items-center text-[13px] font-bold ${hiddenGaps === hidden ? "text-muted-foreground outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-edge" : "bg-secondary"}`}
            >
              +{hidden}
            </span>
          )}
        </button>
        {m ? (
          <button type="button" onClick={go} className="nd-press flex min-h-11 min-w-0 flex-1 items-center gap-2 self-stretch rounded-[4px] text-left">
            <span className="min-w-0 flex-1">
              {/* Never cut a name: a long one takes a second line (the alert strip's rule: grow, don't truncate). */}
              <b className="line-clamp-2 text-pretty text-[15px] font-bold leading-tight">{words}</b>
              <small className="mt-0.5 line-clamp-2 text-pretty text-[13px] leading-snug text-muted-foreground">{line}</small>
            </span>
            {/* The verb as Tonight's plate says it (the outlined button took the names' room: four lines a row at 390). */}
            <span className="flex flex-none items-center gap-0.5 whitespace-nowrap text-[14px] font-bold">
              {m.action}
              <ChevronRight className="size-4" aria-hidden />
            </span>
          </button>
        ) : (
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-bold leading-tight">{words}</b>
            <small className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{line}</small>
          </span>
        )}
      </div>
      {open && <GlanceDetail g={g} s={s} go={go} onCast={onCast} close={() => setOpen(false)} />}
    </div>
  );
}

/** A glance opened: the face plates, four a row, each opening its sheet; an empty place dashed and named by its slot; the bench or
 *  what's on the line beside them; Show less. A lineup with nothing in it, bigger than a row, is one dashed line naming its slots. */
function GlanceDetail({ g, s, go, onCast, close }: { g: GameView; s: GlanceShape; go: () => void; onCast: (g: GameView, id: string) => void; close: () => void }) {
  const used = s.faces.length + s.gaps.length;
  const left = (ROW - (used % ROW)) % ROW;
  const emptyLine = s.faces.length === 0 && s.gaps.length > ROW;
  const plate = "relative overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground";
  return (
    <div data-glance-detail className="pb-1">
      {emptyLine ? (
        <button
          type="button"
          onClick={go}
          data-glance-empty
          className="nd-press mt-1 flex w-full items-center gap-3 rounded-[3px] px-3 py-3 text-left outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-edge"
        >
          <Plus className="size-5 flex-none text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <b className="type-caption block text-[15px]">{s.gaps.length} open</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">{s.gaps.filter(Boolean).join(", ") || "Nobody starting yet"}</small>
          </span>
        </button>
      ) : (
        <div className="mt-1 grid grid-cols-4 gap-2">
          {s.faces.map((f) => {
            const c = faceIn(g, f.id);
            const name = castName(c, g);
            return (
              <button key={f.id} type="button" data-glance-plate={f.id} onClick={() => onCast(g, f.id)} className={`nd-press ${plate} ${f.out ? "opacity-50 grayscale" : ""}`}>
                <Face src={c?.photo ?? null} name={c?.name} className="aspect-[4/4.2] w-full text-[24px]" />
                {f.slot && <span className="type-caption absolute left-1 top-1 rounded-[2px] bg-[rgba(16,14,21,.8)] px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-white">{f.slot}</span>}
                {f.tick && (
                  <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-good text-good-foreground">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                )}
                <span className="block px-1.5 pb-1.5 pt-1">
                  <b className={`type-caption block truncate ${name.length > 9 ? "text-[13px]" : "text-[15px]"}`}>{name}</b>
                  <small className="block truncate text-[11px] text-plate-muted">{f.sub}</small>
                </span>
              </button>
            );
          })}
          {s.gaps.map((label, i) => (
            <GapCell key={`g${i}`} label={label} kind={s.kind} onClick={go} />
          ))}
          {s.note && left > 0 && (
            <span className="flex flex-col justify-end rounded-[3px] px-2 pb-1.5 pt-2 outline-1 -outline-offset-1 outline-border" style={{ gridColumn: `span ${left}` }}>
              <b className="type-caption block text-[13px] tracking-[0.05em] text-muted-foreground">{s.note.title}</b>
              <span className="mt-0.5 block text-[14px] font-semibold leading-snug">{s.note.body}</span>
            </span>
          )}
        </div>
      )}
      {s.note && (left === 0 || emptyLine) && (
        <p className="mt-2 text-[14px] leading-snug">
          <b className="type-caption mr-1.5 text-[13px] tracking-[0.05em] text-muted-foreground">{s.note.title}</b>
          {s.note.body}
        </p>
      )}
      <button type="button" data-glance-less onClick={close} className="flex min-h-10 items-center gap-1 text-[14px] font-semibold text-muted-foreground">
        Show less
        <ChevronDown className="size-4 rotate-180" aria-hidden />
      </button>
    </div>
  );
}

/** An empty place in a glance's detail: dashed, named by its slot where the game has them ("Open · TE"); a tap goes to the move. */
function GapCell({ label, kind, onClick }: { label: string; kind: GlanceShape["kind"]; onClick: () => void }) {
  return (
    <button type="button" data-glance-gap onClick={onClick} className="nd-press grid aspect-[4/5.2] place-items-center rounded-[3px] text-center text-muted-foreground outline-dashed outline-[1.5px] -outline-offset-[1.5px] outline-edge">
      <span>
        <Plus className="mx-auto size-5" aria-hidden />
        <b className="type-caption mt-1 block text-[14px] text-foreground">{kind === "pick" ? "Pick" : "Open"}</b>
        {label && kind !== "pick" && <small className="block text-[12px]">{label}</small>}
      </span>
    </button>
  );
}

/** A leaderboard row: place, face, name, (Last picks' faces when open), the total in the game's unit. */
function BoardRow({ g, r, fresh, extras, onClick }: { g: GameView; r: TableRow; fresh: boolean; extras: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      data-player={r.name}
      disabled={!opens(g, r)}
      onClick={onClick}
      className={`flex min-h-[38px] items-center gap-2.5 border-t text-left ${r.you ? "-mx-2 w-[calc(100%+16px)] rounded-[3px] border-transparent bg-secondary px-2" : "w-full border-border"}`}
    >
      <span className="type-num w-6 flex-none text-[16px] text-muted-foreground">{fresh ? "" : r.rank}</span>
      <Avatar id={r.userId ?? r.playerId} name={r.name} size={24} />
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] font-semibold">
        <span className="truncate">{r.you ? "You" : r.name}</span>
        {r.bot && <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em] text-muted-foreground">Computer</span>}
      </span>
      {extras && <span className="flex flex-none items-center gap-[3px]" data-row-picks>{extras}</span>}
      <b className="type-num min-w-[34px] flex-none text-right text-[18px]">{fresh ? "–" : totalShort(g, r)}</b>
    </button>
  );
}

/** Last picks, by the game's kind: the pool's latest picks, the lineup's starters with the week's points, a team with who's still
 *  in; null for a game with nothing to show (calls, bingo, a sheet, a public pool's strangers). */
function lastPicks(g: GameView, ep: string): { label: string; faces: (r: TableRow) => ReactNode } | null {
  const face = (id: string, gone = false) => {
    const c = faceIn(g, id);
    return <Face key={id} src={c?.photo ?? null} name={c?.name} out={gone} className={`size-[30px] flex-none rounded-[3px] text-xs ${gone ? "opacity-45 grayscale" : ""}`} />;
  };
  if (g.solo === "public") return null;
  if (g.gameType === "pickem") {
    const n = Math.max(0, ...g.table.flatMap((r) => r.picks.filter((p) => p.correct !== null).map((p) => p.episode)));
    if (!n) return null;
    return { label: `Last picks · ${ep} ${n}`, faces: (r) => r.picks.filter((p) => p.castawayId && p.correct !== null).slice(-3).map((p) => face(p.castawayId!, p.correct === false)) };
  }
  if (g.gameType === "active-roster") {
    const n = g.table[0]?.weeks.at(-1)?.episode ?? null;
    if (n === null) return null;
    return {
      label: `Last lineups · ${ep} ${n}`,
      faces: (r) => {
        const w = r.weeks.find((x) => x.episode === n);
        return (
          <>
            {(w ? w.started.map((s) => s.id) : r.last).map((id) => face(id))}
            {w && <small className="type-num ml-1 w-9 text-right text-[13px] text-muted-foreground">{signed(w.total)}</small>}
          </>
        );
      },
    };
  }
  if (g.table.some((r) => r.team.length)) return { label: "Teams", faces: (r) => r.team.map((id) => face(id, !!faceIn(g, id)?.knocked)) };
  return null;
}

/** A game mid-draft: who's picking and how long until you are (or your private picks), your slots, and the way into the room. */
function DraftLine({ show, g, d, move }: { show: ShowData; g: GameView; d: DraftGame; move: YourMove | null }) {
  const nav = useNav();
  const seat = (id: string | null | undefined) => d.seats.find((s) => s.playerId === id);
  const castOf = (id: string | null | undefined) => d.cast.find((c) => c.id === id);
  const seasonId = show.header?.seasonId ?? "";
  const href = `${paths.showPage(seasonId, d.kind === "blind" ? "blind" : "draft")}?game=${g.leagueId}`;
  const mine = d.kind === "blind" ? (d.mine ?? []) : (d.teams.find((t) => t.playerId === d.you)?.castawayIds ?? []);
  let big = "The draft";
  let line: string | null = null;
  if (d.phase === "waiting") {
    big = "Draft · not started";
    line = d.scheduledAt ? `Starts ${airTime(Date.parse(d.scheduledAt))}` : "Whoever runs the game starts it";
  } else if (d.kind === "snake" && d.clock) {
    const up = d.clock.playerId === d.you;
    const until = d.you ? d.turns.slice(d.made).indexOf(d.you) : -1;
    big = up ? "You're up" : `${first(seat(d.clock.playerId)?.name ?? "Someone")} is picking`;
    line = up ? `Round ${d.clock.round} · pick ${d.clock.n}` : until === 1 ? "You're next" : until > 1 ? `${until} picks until yours` : "Your team is full";
    const p = d.picks.at(-1);
    if (p?.castawayId) line += ` · ${seat(p.playerId)?.you ? "You" : first(seat(p.playerId)?.name ?? "someone")} took ${first(castOf(p.castawayId)?.name ?? "")}`;
  } else if (d.kind === "blind") {
    const locked = !!d.you && d.locked.includes(d.you);
    const waiting = d.seats.filter((s) => !d.locked.includes(s.playerId));
    big = locked ? "Locked in" : `Pick ${d.size} in private`;
    line = locked ? (waiting.length ? `Waiting for ${waiting.length === 1 ? first(waiting[0].name) : `${waiting.length} more`}` : "Revealing") : `${d.locked.length} of ${d.seats.length} in · nobody sees until everyone's in`;
  }
  // Past eight (a sport's fifteen) the faces drafted and a count, as the room's own slots fold: empty boxes would fill the row.
  const team = d.kind === "snake" || d.kind === "blind";
  const many = Math.max(d.size, mine.length) > 8;
  const slots = !team ? 0 : many ? mine.length : Math.max(d.size, mine.length);
  return (
    <button type="button" data-draft-row={d.kind} onClick={() => nav.push(move && "href" in move.go ? move.go.href : href)} className="nd-press -mx-1 block w-[calc(100%+8px)] rounded-[4px] px-1 pb-2.5 text-left">
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <b className="type-caption block text-[22px] leading-none">{big}</b>
          {line && <small className="mt-1 block text-[14px] leading-snug text-muted-foreground">{line}</small>}
        </span>
        <span className="grid h-10 flex-none place-items-center whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-bold outline-[1.5px] -outline-offset-[1.5px] outline-input">
          {move?.action ?? "Open"}
        </span>
      </span>
      {(slots > 0 || (team && many)) && (
        <span className="mt-2.5 flex flex-wrap items-center gap-[5px]" aria-label="Your team so far">
          {Array.from({ length: slots }, (_, k) => {
            const c = castOf(mine[k]);
            return c ? <Face key={k} src={c.photo} name={c.name} className="size-[34px] rounded-[3px] text-xs" /> : <i key={k} className="size-[34px] rounded-[3px] outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input" aria-hidden />;
          })}
          {many && (
            <small className="type-num ml-1 text-[14px] text-muted-foreground" data-draft-count>
              {mine.length} of {d.size}
            </small>
          )}
        </span>
      )}
    </button>
  );
}

// ---------- the tables ----------

/** What sits at the end of a row before its total: Outlast's team, the pool's last picks, the lineup's last week. */
function RowExtras({ g, r }: { g: GameView; r: TableRow }) {
  // A public pool's strangers: a name and a streak (usernames only, step 9 part 3).
  if (g.solo === "public" && !r.you) return null;
  if (g.gameType === "pickem") {
    return (
      <>
        {r.picks
          .filter((p) => p.castawayId && p.correct !== null)
          .slice(-3)
          .map((p) => {
            const c = faceIn(g, p.castawayId!);
            return <Face key={p.episode} src={c?.photo ?? null} name={c?.name} className={`size-[26px] rounded-[2px] text-xs ${p.correct ? "" : "opacity-40 grayscale"}`} />;
          })}
      </>
    );
  }
  if (g.gameType === "active-roster") return r.week != null ? <span className="text-[13px] text-muted-foreground">{r.week >= 0 ? `+${r.week}` : `−${Math.abs(r.week)}`}</span> : null;
  return (
    <>
      {r.team.map((id) => {
        const c = faceIn(g, id);
        return <Face key={id} src={c?.photo ?? null} name={c?.name} className={`size-[26px] rounded-[2px] text-xs ${c?.knocked ? "opacity-40 grayscale" : ""}`} />;
      })}
    </>
  );
}

type Scope = { seasonId: string; couchId: string } | null;

function Standings({
  play,
  words,
  aired,
  scope,
  onPlayer,
  onRules,
  readOnly,
  moves,
}: {
  play: GameView[];
  words: ShowData["words"];
  /** The latest episode that's aired, by the schedule. */
  aired: number;
  scope: Scope;
  onPlayer: (row: TableRow, game: GameView, week: number | null) => void;
  onRules: (g: GameView) => void;
  /** One game, nobody's place in it to show: no pills, and the foot line is the caller's. */
  readOnly?: boolean;
  /** Your move in each game, by league (your-move.ts): its card under the game's name. */
  moves?: Map<string, YourMove>;
}) {
  const twin = (g: GameView) => play.filter((x) => x.gameType === g.gameType).length > 1;
  // A game over a span that's over stands at its last episode (it says Final): the line is the running games'.
  const running = play.filter((g) => g.to === null || !g.over);
  const through = Math.min(...(running.length ? running : play).map((g) => g.through));
  return (
    <div className="mt-4">
      {!readOnly && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {play.map((g) => (
            <button
              key={g.leagueId}
              type="button"
              onClick={() => document.getElementById(anchor(g))?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="relative flex h-10 flex-none items-center gap-2 rounded-[3px] border-l-[3px] bg-card px-3 text-sm font-semibold"
              style={{ borderLeftColor: gameColour(g.gameName) }}
            >
              {g.solo === "public" ? "Everyone" : twin(g) ? g.name : g.gameName}
              <b className="type-num text-[20px]">{placeOf(g)}</b>
              {moves?.get(g.leagueId)?.due && <i data-pill-due className="absolute right-1 top-[5px] size-[7px] rounded-full bg-chyron-line" aria-label="Needs you" />}
            </button>
          ))}
        </div>
      )}
      {play.map((g) => (
        <section key={g.leagueId} id={anchor(g)} data-table={g.leagueId} className={`${readOnly ? "mt-2" : "mt-4"} mx-2 scroll-mt-28 rounded-[14px] bg-card px-4 pb-3.5 pt-4`}>
          <div className="mb-2.5 flex items-center gap-3">
            <span className="w-1 self-stretch rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
            <div className="min-w-0 flex-1">
              {/* A game's own page (U1), over the show: its name opens it. */}
              {scope && !readOnly ? (
                <NavLink href={paths.gamePage(scope.seasonId, g.leagueId)} data-game-open={g.leagueId} className="nd-press -my-1 flex min-h-11 items-center gap-1">
                  <h2 className="type-caption text-[26px]">{g.gameName}</h2>
                  <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
                </NavLink>
              ) : (
                <h2 className="type-caption text-[26px]">{g.gameName}</h2>
              )}
              <small className="mt-1 block text-[13px] text-muted-foreground">
                {spanOf(g, words, aired) && (
                  <b data-span={g.leagueId} className="font-semibold text-foreground">
                    {spanOf(g, words, aired)}
                    {" · "}
                  </b>
                )}
                {g.solo === "public" ? `Everyone · ${g.players} ${g.players === 1 ? "person" : "people"}` : g.solo === "practice" ? "Practice couch · against computer players" : twin(g) ? g.name : lineOf(g)}
              </small>
              {g.archived && <Archived g={g} scope={scope} />}
            </div>
            <button type="button" onClick={() => onRules(g)} className="px-1 py-2 text-[15px] font-semibold">
              Rules
            </button>
          </div>
          {moves?.get(g.leagueId) && <YourMoveCard g={g} m={moves.get(g.leagueId)!} />}
          {g.table.length === 0 && <p className="border-t border-border py-3 text-sm text-muted-foreground">Nobody on the table yet.</p>}
          {weekly(g) ? (
            <LineupTable g={g} words={words} onPlayer={onPlayer} />
          ) : (
            <>
              {g.table.length > 0 && COLUMNS[g.gameType] && <Columns mid={COLUMNS[g.gameType][0]} end={COLUMNS[g.gameType][1]} />}
              {g.table.map((r) => (
                <PlayerRow key={r.playerId} g={g} r={r} extras={<RowExtras g={g} r={r} />} onClick={() => onPlayer(r, g, null)} />
              ))}
            </>
          )}
        </section>
      ))}
      {!readOnly && (
        <p className="px-4 pt-4 text-[13px] text-muted-foreground">
          {/* A talk show's games have nothing to reveal: they move as you watch and the couch says what happened (Noticed). */}
          {play.every((g) => g.gameType === "weekly-calls" || g.gameType === "weekly-bingo")
            ? through
              ? `Through Episode ${through}. Standings move as you watch and the couch says what happened.`
              : "Nothing counted yet. Standings start once a show's aired and you've watched it."
            : through
              ? `Through Episode ${through}. Standings move when you reveal.`
              : "No results yet. Standings start once an episode's in and you've revealed it."}
        </p>
      )}
    </div>
  );
}

/** Your move in a game (your-move.ts), under its name: the faces of what you've set (dashed places for what's still to fill, faded
 *  for who's out), what it is and when it locks, and its button: yellow only when it's due. It opens Your moves on this game, or the
 *  game's own page (the draft room, Waivers). */
function YourMoveCard({ g, m }: { g: GameView; m: YourMove }) {
  const nav = useNav();
  return (
    <button
      type="button"
      data-your-move={m.kind}
      data-due={m.due}
      onClick={() => ("tab" in m.go ? openMoves(m.go.tab, g.leagueId) : nav.push(m.go.href))}
      className="nd-press mb-1.5 flex min-h-[62px] w-full items-center gap-3 rounded-[4px] bg-background py-2 pl-2.5 pr-2 text-left"
    >
      {(m.faces.length > 0 || m.empty > 0) && (
        <span className="flex flex-none gap-[3px]" aria-hidden>
          {m.faces.map((id) => {
            const c = faceIn(g, id);
            return <Face key={id} src={c?.photo ?? null} name={c?.name} out={m.out.includes(id)} className={`h-9 w-7 rounded-[2px] text-xs ${m.out.includes(id) ? "opacity-45 grayscale" : ""}`} />;
          })}
          {Array.from({ length: m.empty }, (_, i) => (
            <span key={i} className="h-9 w-7 rounded-[2px] border-[1.5px] border-dashed border-muted-foreground/55" />
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-bold leading-tight">{m.title}</b>
        <small className="mt-[3px] block text-[13px] leading-snug text-muted-foreground">{m.line}</small>
      </span>
      <span
        className={`grid h-10 flex-none place-items-center whitespace-nowrap rounded-[3px] px-3.5 text-[15px] font-extrabold ${
          m.due ? "bg-chyron text-chyron-foreground" : "bg-background text-foreground outline-[1.5px] -outline-offset-[1.5px] outline-input"
        }`}
      >
        {m.action}
      </span>
    </button>
  );
}

/** Weekly Lineup with weeks to show (or one being set): its table shows last episode's lineups and points. */
const weekly = (g: GameView) => g.gameType === "active-roster" && (g.table.some((r) => r.weeks.length > 0) || !!nextWeek(g));

/** Whether a row opens a sheet: every game's (U1 step 2b, the sheet family: calls, bingo and questions too), not a public pool's
 *  strangers. Read when called, not when this file loads: game-sheets.tsx and the files it imports load in either order. */
const opens: typeof opensSheet = (g, r) => opensSheet(g, r);

/** What a table's two right-hand columns are, where a game's say it plainly (the pool's number is a streak, not points). */
const COLUMNS: Record<string, [string, string]> = { pickem: ["Last picks", "Streak"], "classic-draft": ["Team", "Points"] };

function Columns({ left, mid, end }: { left?: ReactNode; mid?: ReactNode; end: ReactNode }) {
  return (
    <div className="flex items-end gap-2.5 pb-1.5 text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted-foreground">
      <span className="min-w-0 flex-1 truncate">{left}</span>
      {mid && <span className="flex-none text-right">{mid}</span>}
      <span className="min-w-[34px] flex-none text-right">{end}</span>
    </div>
  );
}

/** A row on a game's table: place, face, name, what sits before the total, and the total; `below`, a second line. */
function PlayerRow({ g, r, rank, extras, total, below, onClick }: { g: GameView; r: TableRow; rank?: string; extras?: ReactNode; total?: ReactNode; below?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      data-player={r.name}
      disabled={!opens(g, r)}
      onClick={onClick}
      className={`block border-t text-left ${below ? "py-2.5" : ""} ${r.you ? "-mx-2 w-[calc(100%+16px)] rounded-[2px] border-transparent bg-secondary px-2" : "w-full border-border"}`}
    >
      <span className={`flex items-center gap-2.5 ${below ? "" : "min-h-14"}`}>
        <span className="type-num w-[30px] flex-none text-[22px] text-muted-foreground">{rank ?? r.rank}</span>
        <Avatar id={r.userId ?? r.playerId} name={r.name} size={28} />
        <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
          <span className="truncate">{r.name}</span>
          {r.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-background">You</span>}
          {r.bot && <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-muted-foreground">Computer</span>}
        </span>
        <span className="ml-auto flex flex-none items-center gap-[3px]">{extras}</span>
        {total === undefined ? <b className="type-num min-w-[34px] flex-none text-right text-[24px]">{r.total}</b> : total}
      </span>
      {below}
    </button>
  );
}

/**
 * Weekly Lineup's table: who each player started last episode and that week's points under their season total. A row opens that
 * player's sheet, on that week, where their weeks swipe by (lineup-sheet.tsx); the user dropped the table's episode chips for it
 * (2026-10-31).
 */
function LineupTable({ g, words, onPlayer }: { g: GameView; words: ShowData["words"]; onPlayer: (row: TableRow, game: GameView, week: number | null) => void }) {
  const next = nextWeek(g);
  const latest = g.table[0]?.weeks.at(-1)?.episode ?? null;
  const face = (id: string) => {
    const c = faceIn(g, id);
    return <Face key={id} src={c?.photo ?? null} name={c?.name} className="size-[26px] flex-none rounded-[2px] text-xs" />;
  };
  return (
    <>
      <Columns mid={latest !== null ? `Started ${words.ep} ${latest}` : undefined} end="Season" />
      {g.table.map((r) => {
        const w = latest === null ? undefined : r.weeks.find((x) => x.episode === latest);
        return (
          <PlayerRow
            key={r.playerId}
            g={g}
            r={r}
            extras={(w ? w.started.map((s) => s.id) : r.last).map((id) => face(id))}
            total={
              <span className="flex min-w-[34px] flex-none flex-col items-end gap-1">
                <b className="type-num text-[24px]">{r.total}</b>
                {w && <small className="text-[12px] leading-none text-muted-foreground">{signed(w.total)}</small>}
              </span>
            }
            onClick={() => onPlayer(r, g, latest ?? next?.episode ?? null)}
          />
        );
      })}
    </>
  );
}

function RulesSheet({ game, play, onGame, waivers }: { game: GameView | null; play: GameView[]; onGame: (g: GameView | null) => void; waivers: WaiverWeek[] }) {
  const [last, setLast] = useState(game);
  if (game && game !== last) setLast(game);
  const shown = game ?? last;
  const wv = shown ? waivers.find((w) => w.leagueId === shown.leagueId) : undefined;
  return (
    <Sheet open={!!game} onOpenChange={(o) => !o && onGame(null)} title={shown?.gameName ?? ""} subtitle={shown ? (shown.gameName === shown.name ? lineOf(shown) : shown.name) : undefined}>
      {shown && (
        <div className="mt-3 pb-2">
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[15px] leading-normal marker:font-bold marker:text-muted-foreground">
            {shown.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          {wv && (
            <div className="mt-5">
              <p className="type-caption mb-2 text-[15px] tracking-[0.04em]">Waivers here</p>
              <WaiversHowBody how={wv.how} />
            </div>
          )}
          {play.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {play.map((g) => (
                <Chip key={g.leagueId} on={g.leagueId === shown.leagueId} onClick={() => onGame(g)}>
                  {play.filter((x) => x.gameType === g.gameType).length > 1 ? g.name : g.gameName}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ---------- a show you don't play ----------

/** What the plate says a show of each kind could be (the mock's rbPlate), before it's a game. */
const MAKE_LINE: Record<string, string> = {
  competition: "One question to ChatGPT finds the cast and what scores. Then Survival Pool or a draft.",
  series: "Draft the cast, start three each week, and score what they get up to. One question to ChatGPT sets it up.",
  talk: "A bingo card and two calls every show, all season. One question to ChatGPT sets it up.",
  sport: "Draft who's competing and start some each event, or pick one to finish well. One question to ChatGPT sets it up.",
};

/** What a set-up show of each kind plays (the mock's rbPlate in play mode): its recommended game first. */
const PLAY_LINE: Record<string, string> = {
  competition: "Survival Pool starts from the next episode, no draft. Or draft a team from this cast.",
  series: "Weekly Lineup: draft the cast, start three each week, and score what they get up to.",
  talk: "Weekly Bingo and Weekly Calls: a card and two calls every show, all season. Coming with episode games.",
  sport: "Weekly Lineup: draft from the whole field, start some each event. Or Survival Pool: one pick to score each event.",
};

/** A season watched at your own pace (docs/PLAN-own-pace-games.md): the game plays the same way. */
const OWN_PACE_LINE = "Every episode is out. Pick who survives before you watch each one, reveal after.";

/** A show with no game of yours (the mock's playplate and rulebook.js rbPlate): Make it a game when nobody has set it up
 *  (step 10 part 2a), else Play it: Start a game (part 2b). */
export function PlayIt({ show }: { show: ShowData }) {
  const openMake = useOpenMake();
  const h = show.header;
  const name = (h?.show.name ?? "This show").replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "");
  const label = `${name}${h?.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
  const watchers = (show.people ?? []).filter((p) => p.watching).length;
  const button = "nd-press mt-3 flex h-[52px] items-center justify-center rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate";
  return (
    <div data-play-it={show.ready ? "play" : "make"} className="mx-4 mt-[26px] rounded-[4px] bg-plate p-4 text-plate-foreground shadow-plate">
      <span className="type-caption inline-block bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
        {show.ready ? "Play it" : "Not a game yet"}
      </span>
      <h3 className="type-caption mt-2 text-[28px]">{show.ready ? `${label} with your couch` : `Make ${label} a game`}</h3>
      <p className="mt-1 text-sm leading-snug text-plate-muted">
        {show.ready
          ? show.ownPace
            ? OWN_PACE_LINE
            : (PLAY_LINE[h?.show.kind ?? "competition"] ?? PLAY_LINE.competition)
          : `${MAKE_LINE[h?.show.kind ?? "competition"] ?? MAKE_LINE.competition}${watchers > 1 ? " Everyone who watches it can play." : " Every couch can play it after."}`}
      </p>
      {show.ready ? (
        <button type="button" data-play-start onClick={() => openStartGame({ seasonId: h?.seasonId, couchId: show.couch?.id ?? null })} className={button}>
          Start a game
        </button>
      ) : (
        <button type="button" data-make-it onClick={openMake} className={button}>
          Make it a game
        </button>
      )}
    </div>
  );
}

/**
 * Start a game, under the Games tab's games (the mock's cp-start): any game that fits this show, for anyone on the couch.
 * Once every episode has aired it's Run it back: the same game on the show's next season, when there's one to play.
 */
function StartRow({ show }: { show: ShowData }) {
  const h = show.header;
  const over = !!h && (h.status === "completed" || (!!h.episodeCount && show.latestAired >= h.episodeCount && !show.upNext));
  const opts = useStartOptions(h?.seasonId ?? null, show.couch?.id ?? null, null, over);
  const finished = (show.play ?? []).find((g) => !g.solo);
  const next = opts.data?.nextSeason ?? null;
  // A season that's over is still a game at your own pace (docs/PLAN-own-pace-games.md), and its next season Run it back.
  if (over) {
    return (
      <>
        <button
          type="button"
          data-start-row="pace"
          onClick={() => openStartGame({ seasonId: h?.seasonId, couchId: show.couch?.id ?? null })}
          className="nd-press mx-4 mt-[26px] flex w-[calc(100%-32px)] items-center gap-3 rounded-[4px] p-4 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
        >
          <Plus className="size-6 flex-none" aria-hidden />
          <span>
            <b className="block text-base">Start a game · at your own pace</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">Pick before each episode, reveal after. Anyone on the couch joins from wherever they are.</small>
          </span>
        </button>
        {next && (
          <button
            type="button"
            data-start-row="again"
            onClick={() => openStartGame({ seasonId: next.seasonId, couchId: show.couch?.id ?? null, again: finished?.leagueId ?? null })}
            className="nd-press mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3 rounded-[4px] p-4 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
          >
            <RotateCcw className="size-6 flex-none" aria-hidden />
            <span>
              <b className="block text-base">Run it back · {next.label}</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">{finished?.gameName ?? "The same game"} again, from its first episode. The couch hears about it.</small>
            </span>
          </button>
        )}
      </>
    );
  }
  return (
    <button
      type="button"
      data-start-row="start"
      onClick={() => openStartGame({ seasonId: h?.seasonId, couchId: show.couch?.id ?? null })}
      className="nd-press mx-4 mt-[26px] flex w-[calc(100%-32px)] items-center gap-3 rounded-[4px] p-4 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
    >
      <Plus className="size-6 flex-none" aria-hidden />
      <span>
        <b className="block text-base">Start a game</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">A season game for this show. Anyone on the couch can.</small>
      </span>
    </button>
  );
}

/** An archived game's line (step 10 part 2b): it stands as it was; its Commissioner can bring it back. */
function Archived({ g, scope: show }: { g: GameView; scope: Scope }) {
  const refresh = useAfterReveal();
  return (
    <span data-archived={g.leagueId} className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
      <span className="type-caption inline-flex items-center gap-1 rounded-[2px] bg-secondary px-1.5 py-0.5 text-[11px] tracking-[0.06em]">
        <Archive className="size-3" aria-hidden />
        Archived
      </span>
      Scores stopped. It stays on the trophy shelf.
      {g.yourRole === "commissioner" && show && (
        <button
          type="button"
          data-unarchive={g.leagueId}
          className="font-semibold text-foreground underline underline-offset-2"
          onClick={async () => {
            try {
              const r = await gamesApi.unarchive(show.seasonId, show.couchId, g.leagueId);
              await refresh();
              toast(`${g.gameName} is back: it scores again`, {
                undo: async () => {
                  await backstage.undo(show.seasonId, show.couchId, r.batch);
                  await refresh();
                },
              });
            } catch (e) {
              toast.quiet((e as Error).message);
            }
          }}
        >
          Bring it back
        </button>
      )}
    </span>
  );
}

// ---------- How it works, this week ----------

function HowRow({ show, name }: { show: ShowData; name: string }) {
  const how = usePushedPage("how-it-works");
  const page = useHowItWorks(show.header?.seasonId ?? "", show.couch?.id ?? null, !!show.header);
  const parts = (page.data?.how.jump ?? [])
    .map((j) => j.label)
    .filter(Boolean)
    .slice(0, 3)
    .map((l, i) => (i ? l!.toLowerCase() : l));
  return (
    <section className="mt-[26px] px-4">
      <Row icon={BookOpen} title={`How ${name} works`} detail={parts.length ? parts.join(", ").replace(/\bepisode\b/gi, (w) => (w[0] === "E" ? show.words.episode : show.words.episode.toLowerCase())) : "The show, the games and what scores"} onClick={how.show} />
    </section>
  );
}

function ThisWeek({ show, bare }: { show: ShowData; bare?: boolean }) {
  const up = show.upNext;
  const couchId = show.couch?.id ?? null;
  const seasonId = show.header?.seasonId ?? null;
  const playing = show.games.some((g) => g.yourRole);
  // Call it for the next episode (step 12 part 2), on a show that's a game you follow or play. At your own pace (every episode
  // out: docs/PLAN-own-pace-games.md part 2) there's no "this week", only your next episode: its calls, its card.
  const next = show.ownPace ? (show.seenThrough ?? 0) + 1 : null;
  const paced = next !== null && next <= show.latestAired;
  const call = seasonId && show.ready && (show.following || playing) ? (paced ? next : up && !up.live ? up.number : null) : null;
  // The couch's polls on this show, and Start a poll (part 2): a couch's, so not solo.
  const onCouch = !!couchId && !show.solo && !!seasonId;
  const polls = useSeasonPolls(seasonId, couchId, onCouch);
  // Your bingo card for the episode (step 12 part 3), and this week's trivia on the show.
  const bingo = bingoEpisode(show);
  // Each Prediction Sheet you play here with something to answer (step A4 part 2): this week's to fill in. One that asks about the
  // next episode stands in for Call it.
  // Round 3 (`bare`): the rows alone, inside the next episode's block, where a one-episode game's sheet is its night row.
  const sheets = (show.play ?? []).filter((g) => g.gameType === "questions" && !g.archived && !!g.sheet && !(bare && oneGame(g)));
  const rows = (
    <div data-this-week>
      {bingo && seasonId && <BingoRow icon target={{ seasonId, couchId, episode: bingo, label: showLabel(show), solo: show.solo }} />}
      {call && seasonId && !sheetAsks(show, call) && <CallRow icon target={{ seasonId, couchId, episode: call, label: showLabel(show), solo: show.solo }} />}
      {seasonId && sheets.map((g) => <SheetRow key={g.leagueId} icon move={g.sheet!} target={{ seasonId, leagueId: g.leagueId, episode: null, game: g.name }} />)}
      {onCouch && (polls.data?.polls ?? []).map((p) => <PollRow key={p.id} icon p={p} couchId={couchId!} />)}
      {seasonId && <TriviaRow icon target={{ seasonId, couchId: show.solo ? null : couchId }} />}
      {onCouch && <StartPollRow seasonId={seasonId!} couchId={couchId!} label={showLabel(show)} />}
    </div>
  );
  if (bare) return rows;
  return (
    <Block title={paced ? `Your Episode ${next}` : "This week"} aside={paced ? "Before you watch" : "One night each"}>
      {rows}
    </Block>
  );
}
