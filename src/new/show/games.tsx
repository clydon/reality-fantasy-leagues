"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronRight, CircleQuestionMark, Eye, Grid3x3, Plus, X } from "lucide-react";
import { dayOf, timeOf } from "../clock";
import { THIS_WEEK } from "../fixtures/episode-games";
import { useCouchGames, useHowItWorks, useSeasonWaivers, type GameView, type JoinGame, type TableRow, type WaiverWeek } from "../data";
import { JoinGameRow, JoinGameSheet } from "../couch/join-game";
import { gameColour, GAME_STYLE, isGameName, ordinal } from "../games";
import type { ShowData } from "../screens/show-space";
import { Avatar } from "../ui/bars";
import { usePushedPage } from "../ui/page";
import { Chip, Row } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { faceIn, first } from "./moves";
import { placeOf } from "./tonight";
import { Block, Face, IconBox } from "./parts";
import { playsWaivers, WaiversHowBody } from "./waivers";
import { useOpenReveal } from "./reveal";
import { SoloGames } from "./solo";

// Games (the mock's show.js tabStandings, gamestab.js, rulebook.js rbHowRow): where you play. Your games' tables when
// you're in one (a pill per game, then each table; a row opens that person's team, Rules each game in plain words),
// How it works, this week's one-night games and Start a game; a show you don't play gets Play it. Real: the tables
// (your games through the guard: game-view.ts), each game's rules (its settings: game-rules.ts), How it works' row.
// On fixtures behind Preview: the episode games (12), Start a game and Play it (10).

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
          <Standings play={show.play} onPlayer={(row, game) => setPlayer({ row, game })} onRules={setRules} />
        ) : (
          <div aria-busy className="mx-4 mt-4 h-72 animate-pulse rounded-[4px] bg-card" />
        )
      ) : others.length || show.solo ? null : (
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
      {!show.solo && (
        <Preview id="show.start-game" className="mx-4 mt-[26px]">
          <button type="button" className="flex w-full items-center gap-3 p-4 text-left">
            <Plus className="size-6 flex-none" aria-hidden />
            <span>
              <b className="block text-base">Start a game</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">A season game, bingo, a poll or trivia. Anyone on the couch can.</small>
            </span>
          </button>
        </Preview>
      )}
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

function Standings({ play, onPlayer, onRules }: { play: GameView[]; onPlayer: (row: TableRow, game: GameView) => void; onRules: (g: GameView) => void }) {
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
              disabled={g.solo === "public" && !r.you}
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
        {through ? `Through Episode ${through}. Standings move when you reveal.` : "No results yet. Standings start once an episode's in and you've revealed it."}
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

/** A show with no game of yours (the mock's playplate): Play it when it's set up as a game, else Make it a game. Both are
 *  part 2's (still Preview). */
export function PlayIt({ show }: { show: ShowData }) {
  const h = show.header;
  const name = (h?.show.name ?? "This show").replace(/\s*\([^)]*\)\s*$/, "").replace(/^The /, "");
  const label = `${name}${h?.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
  const watchers = (show.people ?? []).filter((p) => p.watching).length;
  return (
    <Preview id="show.make-it-a-game" className="mx-4 mt-[26px]">
      <div data-play-it={show.ready ? "play" : "make"} className="rounded-[4px] bg-plate p-4 text-plate-foreground shadow-plate">
        <span className="type-caption inline-block bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          {show.ready ? "Play it" : "Not a game yet"}
        </span>
        <h3 className="type-caption mt-2 text-[28px]">{show.ready ? `${label} with your couch` : `Make ${label} a game`}</h3>
        <p className="mt-1 text-sm leading-snug text-plate-muted">
          {show.ready
            ? "Survival Pool starts from the next episode, no draft. Or draft a team from this cast."
            : `One question to ChatGPT finds the cast and what scores. Then pick a game that fits.${watchers > 1 ? " Everyone who watches it can play." : " Every couch can play it after."}`}
        </p>
        <button type="button" className="nd-press mt-3 flex h-[52px] items-center justify-center rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate">
          {show.ready ? "Start a game" : "Make it a game"}
        </button>
      </div>
    </Preview>
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
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const rows = [
    ...(up ? [{ icon: "bingo" as const, title: `Episode ${up.number} bingo`, line: `Opens ${t != null ? `${dayOf(t)} ${timeOf(t)}` : "at airtime"} · tap squares as it happens` }] : []),
    ...THIS_WEEK,
  ];
  return (
    <Block title="This week" aside="One night each">
      <Preview id="show.episode-games" tag={false} className="-mx-2 px-2">
        {rows.map((r) => (
          <button key={r.title} type="button" className="flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
            <IconBox icon={r.icon === "bingo" ? Grid3x3 : CircleQuestionMark} />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">{r.title}</b>
              <small className="mt-0.5 block text-[13px] text-muted-foreground">{r.line}</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        ))}
      </Preview>
    </Block>
  );
}
