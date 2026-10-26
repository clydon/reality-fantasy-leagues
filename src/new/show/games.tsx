"use client";

import { useState } from "react";
import { Archive, BookOpen, Check, Eye, Plus, RotateCcw, X } from "lucide-react";
import { backstage, gamesApi, useAfterReveal, useCouchGames, useHowItWorks, useSeasonPolls, useSeasonWaivers, useStartOptions, type GameView, type JoinGame, type TableRow, type WaiverWeek } from "../data";
import { openStartGame } from "../couch/start-game";
import { toast } from "../ui/toast";
import { JoinGameRow, JoinGameSheet } from "../couch/join-game";
import { gameColour, GAME_STYLE, isGameName, ordinal } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Chip, Row } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { faceIn, first } from "./moves";
import { placeOf } from "./tonight";
import { Block, Face, IconBox } from "./parts";
import { playsWaivers, WaiversHowBody } from "./waivers";
import { useOpenReveal } from "./reveal";
import { SoloGames } from "./solo";
import { useOpenMake } from "./make-game";
import { CallRow } from "./calls";
import { PollRow, StartPollRow } from "./polls";
import { rateLabel } from "./rate";
import { bingoEpisode, BingoRow } from "./bingo";
import { TriviaRow } from "./trivia";

// Games (the mock's show.js tabStandings, gamestab.js, rulebook.js rbHowRow): where you play. Your games' tables when
// you're in one (a pill per game, then each table; a row opens that person's team, Rules each game in plain words),
// How it works, this week's one-night games and Start a game; a show you don't play gets Play it. Real: the tables
// (your games through the guard: game-view.ts), each game's rules (its settings: game-rules.ts), How it works' row.
// This week's bingo, Call it, the couch's polls and trivia are real (step 12). Make it a game (10 part 2a) and Start a game, Run
// it back and an archived game's Bring it back (10 part 2b) are real.

/** A game's line under its name: what it is, for a game the new design knows. */
const lineOf = (g: GameView) => (isGameName(g.gameName) ? GAME_STYLE[g.gameName].line : g.name);
const anchor = (g: GameView) => `game-${g.leagueId}`;

export function Games({ show }: { show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  // Games on the couch here you're not in (step 9): join, ask, or see it's closed.
  const couchGames = useCouchGames(show.couch?.id ?? null, show.games.some((g) => !g.yourRole));
  const others = (couchGames.data?.games ?? []).filter((g) => g.seasonId === show.header?.seasonId && !g.ended && !g.you?.playing);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const [player, setPlayer] = useState<{ row: TableRow; game: GameView } | null>(null);
  const [rules, setRules] = useState<GameView | null>(null);
  const name = (show.header?.show.name ?? "This show").replace(/^The /, "");
  // How waivers work, under the rules of a game that has them (step 6a).
  const wv = useSeasonWaivers(show.header?.seasonId ?? "", show.couch?.id ?? null, !!show.header && playsWaivers(show));
  return (
    <>
      {playing && show.episodes?.reveal && <AsOf show={show} />}
      {playing ? (
        show.play ? (
          <Standings
            play={show.play}
            scope={show.header && show.couch ? { seasonId: show.header.seasonId, couchId: show.couch.id } : null}
            onPlayer={(row, game) => setPlayer({ row, game })}
            onRules={setRules}
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
      <ThisWeek show={show} />
      {!show.solo && show.ready && <StartRow show={show} />}
      <PlayerSheet open={player} onClose={() => setPlayer(null)} />
      <RulesSheet game={rules} play={show.play ?? []} onGame={setRules} waivers={wv.data?.games ?? []} />
    </>
  );
}

/** Results are in that the tables don't show yet: they're as of your episode until you reveal. */
function AsOf({ show }: { show: ShowData }) {
  const openReveal = useOpenReveal();
  const n = show.episodes!.reveal!.episode;
  return (
    <section className="mt-4 px-4">
      <button type="button" data-as-of={n} onClick={() => openReveal(n)} className="nd-press flex min-h-[60px] w-full items-center gap-3 rounded-[4px] bg-card px-3 text-left">
        <IconBox icon={Eye} className="bg-background text-chyron-line" />
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold">As of Episode {show.seenThrough ?? n - 1}</b>
          <small className="block text-[13px] text-muted-foreground">Episode {n} is in. Reveal to update every table.</small>
        </span>
        <span className="text-[15px] font-semibold text-chyron-line">Reveal</span>
      </button>
    </section>
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

function Standings({ play, scope, onPlayer, onRules }: { play: GameView[]; scope: Scope; onPlayer: (row: TableRow, game: GameView) => void; onRules: (g: GameView) => void }) {
  const twin = (g: GameView) => play.filter((x) => x.gameType === g.gameType).length > 1;
  const through = Math.min(...play.map((g) => g.through));
  return (
    <div className="mt-4">
      <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {play.map((g) => (
          <button
            key={g.leagueId}
            type="button"
            onClick={() => document.getElementById(anchor(g))?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex h-10 flex-none items-center gap-2 rounded-[3px] border-l-[3px] bg-card px-3 text-sm font-semibold"
            style={{ borderLeftColor: gameColour(g.gameName) }}
          >
            {g.solo === "public" ? "Everyone" : twin(g) ? g.name : g.gameName}
            <b className="type-num text-[20px]">{placeOf(g)}</b>
          </button>
        ))}
      </div>
      {play.map((g) => (
        <section key={g.leagueId} id={anchor(g)} data-table={g.leagueId} className="mt-[26px] scroll-mt-28 px-4">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="w-1 self-stretch rounded-[2px]" style={{ background: gameColour(g.gameName) }} aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="type-caption text-[26px]">{g.gameName}</h2>
              <small className="mt-1 block text-[13px] text-muted-foreground">
                {g.solo === "public" ? `Everyone · ${g.players} ${g.players === 1 ? "person" : "people"}` : g.solo === "practice" ? "Practice couch · against computer players" : twin(g) ? g.name : lineOf(g)}
              </small>
              {g.archived && <Archived g={g} scope={scope} />}
            </div>
            <button type="button" onClick={() => onRules(g)} className="px-1 py-2 text-[15px] font-semibold">
              Rules
            </button>
          </div>
          {g.table.length === 0 && <p className="border-t border-border py-3 text-sm text-muted-foreground">Nobody on the table yet.</p>}
          {g.table.map((r) => (
            <button
              key={r.playerId}
              type="button"
              data-player={r.name}
              // A public pool's strangers, and the talk show's games (a count of right calls or lines, nothing more to open: step 12).
              disabled={(g.solo === "public" && !r.you) || g.gameType === "weekly-calls" || g.gameType === "weekly-bingo"}
              onClick={() => onPlayer(r, g)}
              className={`flex min-h-14 items-center gap-2.5 border-t text-left ${r.you ? "-mx-2 w-[calc(100%+16px)] rounded-[2px] border-transparent bg-secondary px-2" : "w-full border-border"}`}
            >
              <span className="type-num w-[30px] flex-none text-[22px] text-muted-foreground">{r.rank}</span>
              <Avatar id={r.userId ?? r.playerId} name={r.name} size={28} />
              <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
                <span className="truncate">{r.name}</span>
                {r.you && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-background">You</span>}
                {r.bot && <span className="type-caption rounded-[2px] bg-secondary px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-muted-foreground">Computer</span>}
              </span>
              <span className="ml-auto flex flex-none gap-[3px]">
                <RowExtras g={g} r={r} />
              </span>
              <b className="type-num min-w-[34px] flex-none text-right text-[24px]">{r.total}</b>
            </button>
          ))}
        </section>
      ))}
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
    </div>
  );
}

function PlayerSheet({ open, onClose }: { open: { row: TableRow; game: GameView } | null; onClose: () => void }) {
  const [last, setLast] = useState(open);
  if (open && open !== last) setLast(open);
  const shown = open ?? last;
  const g = shown?.game;
  const r = shown?.row;
  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => !o && onClose()}
      title={r?.name ?? ""}
      subtitle={g && r ? `${g.gameName} · ${r.rank.startsWith("T") ? r.rank : ordinal(r.place)} of ${g.table.length}` : undefined}
    >
      {g && r && (
        <div className="mt-3 pb-2">
          {g.gameType === "pickem" && (
            <>
              <p className="type-caption mb-2 text-[13px] text-muted-foreground">Picks, oldest first</p>
              {r.picks.length === 0 && <p className="text-sm text-muted-foreground">No picks decided yet.</p>}
              <div className="grid grid-cols-4 gap-2">
                {r.picks.map((p) => {
                  const c = p.castawayId ? faceIn(g, p.castawayId) : undefined;
                  return (
                    <div key={p.episode} className="relative">
                      <Face src={c?.photo ?? null} name={c?.name ?? "No pick"} className={`aspect-square w-full rounded-[3px] text-[26px] ${p.correct === false ? "opacity-50 grayscale" : ""}`} />
                      {p.correct !== null && (
                        <span className={`absolute right-1 top-1 grid size-5 place-items-center rounded-full ${p.correct ? "bg-good text-good-foreground" : "bg-live text-live-foreground"}`}>
                          {p.correct ? <Check className="size-3" strokeWidth={3} aria-label="Survived" /> : <X className="size-3" strokeWidth={3} aria-label="Went home" />}
                        </span>
                      )}
                      <small className="mt-1 block truncate text-xs text-muted-foreground">
                        Ep {p.episode} · {c ? first(c.name) : "no pick"}
                      </small>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Best streak {r.total}, streak now {r.week ?? 0}. {r.you ? "Your pick for the next episode is yours alone until it's decided." : "Picks stay hidden from the couch until they're decided."}
              </p>
            </>
          )}
          {g.gameType === "active-roster" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  [r.total, "Season"],
                  [r.week != null ? `${r.week >= 0 ? "+" : "−"}${Math.abs(r.week)}` : "—", "Last episode"],
                  [g.through ? (r.total / g.through).toFixed(1) : "—", "A week"],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-[3px] bg-background p-2.5 text-center">
                    <b className="type-num block text-[26px]">{n}</b>
                    <small className="block text-xs text-muted-foreground">{label}</small>
                  </div>
                ))}
              </div>
              {r.last.length > 0 && (
                <>
                  <p className="type-caption mb-2 mt-4 text-[13px] text-muted-foreground">Last lineup</p>
                  <div className="grid grid-cols-3 gap-2">
                    {r.last.map((id) => {
                      const c = faceIn(g, id);
                      return (
                        <div key={id}>
                          <Face src={c?.photo ?? null} name={c?.name} className="aspect-[4/5] w-full rounded-[3px] text-[30px]" />
                          <b className="type-caption mt-1 block truncate text-[15px]">{first(c?.name ?? "")}</b>
                          <small className="block text-xs text-muted-foreground">{c?.points ?? 0} pts</small>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
          {g.gameType !== "pickem" && g.gameType !== "active-roster" && <TeamList g={g} team={r.team} />}
          {g.gameType === "active-roster" && r.team.length > 0 && (
            <>
              <p className="type-caption mb-0 mt-4 text-[13px] text-muted-foreground">The team</p>
              <TeamList g={g} team={r.team} label={false} />
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function TeamList({ g, team, label = true }: { g: GameView; team: string[]; label?: boolean }) {
  return (
    <>
      {label && <p className="type-caption mb-2 text-[13px] text-muted-foreground">The team</p>}
      {team.map((id) => {
        const c = faceIn(g, id);
        if (!c) return null;
        return (
          <div key={id} className={`flex min-h-14 items-center gap-3 border-t border-border py-1.5 ${c.knocked ? "opacity-60" : ""}`}>
            <Face src={c.photo} name={c.name} out={c.knocked} className="size-10 rounded-[3px]" />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{c.name}</b>
              <small className="block text-[13px] text-muted-foreground">
                {c.left ? `Out${c.out ? ` · Episode ${c.out}` : ""}${c.place ? ` · finished ${ordinal(c.place)}` : ""}` : "Still in"}
              </small>
            </span>
            <b className="type-num text-[22px]">{c.points ?? 0}</b>
          </div>
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
          ? (PLAY_LINE[h?.show.kind ?? "competition"] ?? PLAY_LINE.competition)
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
  const next = opts.data?.next ?? null;
  if (over && !next) return null;
  const again = over && next;
  return (
    <button
      type="button"
      data-start-row={again ? "again" : "start"}
      onClick={() => openStartGame(again ? { seasonId: next.seasonId, couchId: show.couch?.id ?? null, again: finished?.leagueId ?? null } : { seasonId: h?.seasonId, couchId: show.couch?.id ?? null })}
      className="nd-press mx-4 mt-[26px] flex w-[calc(100%-32px)] items-center gap-3 rounded-[4px] p-4 text-left outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-input"
    >
      {again ? <RotateCcw className="size-6 flex-none" aria-hidden /> : <Plus className="size-6 flex-none" aria-hidden />}
      <span>
        <b className="block text-base">{again ? `Run it back · ${next.label}` : "Start a game"}</b>
        <small className="block text-[13px] leading-snug text-muted-foreground">
          {again ? `${finished?.gameName ?? "The same game"} again, from its first episode. The couch hears about it.` : "A season game for this show. Anyone on the couch can."}
        </small>
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
              toast((e as Error).message);
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
      <Row icon={BookOpen} title={`How ${name} works`} detail={parts.length ? parts.join(", ") : "The show, the games and what scores"} onClick={how.show} />
    </section>
  );
}

function ThisWeek({ show }: { show: ShowData }) {
  const up = show.upNext;
  const couchId = show.couch?.id ?? null;
  const seasonId = show.header?.seasonId ?? null;
  const playing = show.games.some((g) => g.yourRole);
  // Call it for the next episode (step 12 part 2), on a show that's a game you follow or play.
  const call = seasonId && show.ready && up && !up.live && (show.following || playing) ? up.number : null;
  // The couch's polls on this show, and Start a poll (part 2): a couch's, so not solo.
  const onCouch = !!couchId && !show.solo && !!seasonId;
  const polls = useSeasonPolls(seasonId, couchId, onCouch);
  // Your bingo card for the episode (step 12 part 3), and this week's trivia on the show.
  const bingo = bingoEpisode(show);
  return (
    <Block title="This week" aside="One night each">
      <div data-this-week>
        {bingo && seasonId && <BingoRow icon target={{ seasonId, couchId, episode: bingo, label: rateLabel(show), solo: show.solo }} />}
        {call && seasonId && <CallRow icon target={{ seasonId, couchId, episode: call, label: rateLabel(show), solo: show.solo }} />}
        {onCouch && (polls.data?.polls ?? []).map((p) => <PollRow key={p.id} icon p={p} couchId={couchId!} />)}
        {seasonId && <TriviaRow icon target={{ seasonId, couchId: show.solo ? null : couchId }} />}
        {onCouch && <StartPollRow seasonId={seasonId!} couchId={couchId!} label={rateLabel(show)} />}
      </div>
    </Block>
  );
}
