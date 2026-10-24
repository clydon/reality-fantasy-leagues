"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronRight, CircleQuestionMark, Grid3x3, Plus } from "lucide-react";
import { dayOf, timeOf } from "../clock";
import { castaway, CAST } from "../fixtures/cast";
import { THIS_WEEK } from "../fixtures/episode-games";
import { HOW } from "../fixtures/how-it-works";
import type { Demo } from "../fixtures/people";
import { LINEUP, POOL, RULES, TEAMS, THROUGH, outlastPoints, standing } from "../fixtures/standings";
import { GAME_STYLE, ordinal, type GameName } from "../games";
import { DemoAvatar } from "../hub/sections";
import type { ShowData } from "../screens/show-space";
import { usePushedPage } from "../ui/page";
import { Chip, Row } from "../ui/parts";
import { Preview } from "../ui/preview";
import { Sheet } from "../ui/sheet";
import { gamesPlayed } from "./tonight";
import { Block, Face, IconBox } from "./parts";

// Games (the mock's show.js tabStandings, gamestab.js, rulebook.js rbHowRow): where you play. Your games' tables when
// you're in one (a pill per game, then each table; a row opens that person's team, Rules each game in plain words),
// How it works, this week's one-night games and Start a game; a show you don't play gets Play it. Real: How it works'
// row (the page is step 1's). On fixtures behind Preview: the tables (step 1), the episode games (12), Start a game
// and Play it (10).

export function Games({ show }: { show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  const [player, setPlayer] = useState<{ who: Demo; game: GameName } | null>(null);
  const [rules, setRules] = useState<GameName | null>(null);
  const name = (show.header?.show.name ?? "This show").replace(/^The /, "");
  return (
    <>
      {playing ? <Standings games={gamesPlayed(show)} onPlayer={(who, game) => setPlayer({ who, game })} onRules={setRules} /> : <PlayIt name={name} />}
      <HowRow name={name} />
      <ThisWeek show={show} />
      <Preview id="show.start-game" className="mx-4 mt-[26px]">
        <button type="button" className="flex w-full items-center gap-3 p-4 text-left">
          <Plus className="size-6 flex-none" aria-hidden />
          <span>
            <b className="block text-base">Start a game</b>
            <small className="block text-[13px] leading-snug text-muted-foreground">A season game, bingo, a poll or trivia. Anyone on the couch can.</small>
          </span>
        </button>
      </Preview>
      <PlayerSheet open={player} onClose={() => setPlayer(null)} />
      <RulesSheet game={rules} onGame={setRules} />
    </>
  );
}

// ---------- the tables ----------

function Standings({ games, onPlayer, onRules }: { games: GameName[]; onPlayer: (who: Demo, game: GameName) => void; onRules: (g: GameName) => void }) {
  return (
    <Preview id="show.standings" className="mx-2 mt-4 pb-4 pt-3">
      <div className="flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
        {games.map((g) => (
          <button
            key={g}
            type="button"
            data-try
            onClick={() => document.getElementById(`game-${g.replace(/ /g, "-")}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex h-10 flex-none items-center gap-2 rounded-[3px] border-l-[3px] bg-card px-3 text-sm font-semibold"
            style={{ borderLeftColor: GAME_STYLE[g].colour }}
          >
            {g}
            <b className="type-num text-[20px]">{ordinal(standing(g).find((r) => r.who === "alex")!.place)}</b>
          </button>
        ))}
      </div>
      {games.map((g) => (
        <section key={g} id={`game-${g.replace(/ /g, "-")}`} className="mt-[26px] scroll-mt-28 px-2">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="w-1 self-stretch rounded-[2px]" style={{ background: GAME_STYLE[g].colour }} aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="type-caption text-[26px]">{g}</h2>
              <small className="mt-1 block text-[13px] text-muted-foreground">{GAME_STYLE[g].line}</small>
            </div>
            <button type="button" data-try onClick={() => onRules(g)} className="px-1 py-2 text-[15px] font-semibold">
              Rules
            </button>
          </div>
          {standing(g).map((r) => {
            const me = r.who === "alex";
            return (
              <button
                key={r.who}
                type="button"
                data-try
                data-player={r.who}
                onClick={() => onPlayer(r.who, g)}
                className={`flex min-h-14 items-center gap-2.5 border-t text-left ${me ? "-mx-2 w-[calc(100%+16px)] rounded-[2px] border-transparent bg-secondary px-2" : "w-full border-border"}`}
              >
                <span className="type-num w-[30px] text-[22px] text-muted-foreground">
                  {r.tie ? "T" : ""}
                  {r.place}
                </span>
                <DemoAvatar who={r.who} size={28} />
                <span className="flex min-w-[62px] items-center gap-1.5 text-[15px] font-semibold">
                  {r.who}
                  {me && <span className="type-caption rounded-[2px] bg-foreground px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-background">You</span>}
                </span>
                <span className="ml-auto flex gap-[3px]">
                  {g === "Outlast" &&
                    TEAMS[r.who].map((n) => {
                      const c = castaway(n);
                      return <Face key={n} src={c.photo} className={`size-[26px] rounded-[2px] ${c.out ? "opacity-40 grayscale" : ""}`} />;
                    })}
                  {g === "Survival Pool" &&
                    POOL[r.who].picks.slice(-3).map((n) => <Face key={n} src={castaway(n).photo} className="size-[26px] rounded-[2px]" />)}
                  {g === "Weekly Lineup" && <span className="text-[13px] text-muted-foreground">+{r.week}</span>}
                </span>
                <b className="type-num min-w-[34px] text-right text-[24px]">{r.total}</b>
              </button>
            );
          })}
        </section>
      ))}
      <p className="px-2 pt-4 text-[13px] text-muted-foreground">Through Episode {THROUGH}. Standings move when you reveal.</p>
    </Preview>
  );
}

function PlayerSheet({ open, onClose }: { open: { who: Demo; game: GameName } | null; onClose: () => void }) {
  const [last, setLast] = useState(open);
  if (open && open !== last) setLast(open);
  const shown = open ?? last;
  const row = shown && standing(shown.game).find((r) => r.who === shown.who);
  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => !o && onClose()}
      title={shown?.who ?? ""}
      subtitle={shown && row ? `${shown.game} · ${ordinal(row.place)} of ${Object.keys(TEAMS).length}` : undefined}
    >
      {shown && (
        <Preview id="show.standings" className="-mx-2 mt-3 px-2 pb-2 pt-3">
          {shown.game === "Survival Pool" && (
            <>
              <p className="type-caption mb-2 text-[13px] text-muted-foreground">Picks, oldest first</p>
              <div className="grid grid-cols-4 gap-2">
                {POOL[shown.who].picks.map((n, i) => (
                  <div key={n} className="relative">
                    <Face src={castaway(n).photo} className="aspect-square w-full rounded-[3px]" />
                    <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-good text-good-foreground">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                    <small className="mt-1 block text-xs text-muted-foreground">Ep {i + 2}</small>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">Streak {POOL[shown.who].streak}. Picks stay hidden from the couch until the episode airs.</p>
            </>
          )}
          {shown.game === "Weekly Lineup" && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  [LINEUP[shown.who].total, "Season"],
                  [`+${LINEUP[shown.who].week}`, "Last episode"],
                  [(LINEUP[shown.who].total / THROUGH).toFixed(1), "A week"],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-[3px] bg-background p-2.5 text-center">
                    <b className="type-num block text-[26px]">{n}</b>
                    <small className="block text-xs text-muted-foreground">{label}</small>
                  </div>
                ))}
              </div>
              <p className="type-caption mb-2 mt-4 text-[13px] text-muted-foreground">Last lineup</p>
              <div className="grid grid-cols-3 gap-2">
                {LINEUP[shown.who].last.map((n) => {
                  const c = castaway(n);
                  return (
                    <div key={n}>
                      <Face src={c.photo} className="aspect-[4/5] w-full rounded-[3px]" />
                      <b className="type-caption mt-1 block text-[15px]">{n}</b>
                      <small className="block text-xs text-muted-foreground">{c.perEp.reduce((a, b) => a + b, 0)} pts</small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {shown.game === "Outlast" && (
            <>
              <p className="type-caption mb-2 text-[13px] text-muted-foreground">The team</p>
              {TEAMS[shown.who].map((n) => {
                const c = castaway(n);
                const place = c.out ? CAST.length - CAST.filter((x) => x.out && x.out < c.out!).length : null;
                return (
                  <div key={n} className={`flex min-h-14 items-center gap-3 border-t border-border py-1.5 ${c.out ? "opacity-60" : ""}`}>
                    <Face src={c.photo} out={!!c.out} className="size-10 rounded-[3px]" />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px] font-semibold">{c.name}</b>
                      <small className="block text-[13px] text-muted-foreground">{c.out ? `Out · Episode ${c.out} · finished ${ordinal(place!)}` : "Still in"}</small>
                    </span>
                    <b className="type-num text-[22px]">{outlastPoints(n)}</b>
                  </div>
                );
              })}
            </>
          )}
        </Preview>
      )}
    </Sheet>
  );
}

function RulesSheet({ game, onGame }: { game: GameName | null; onGame: (g: GameName | null) => void }) {
  const [last, setLast] = useState(game);
  if (game && game !== last) setLast(game);
  const shown = game ?? last;
  return (
    <Sheet open={!!game} onOpenChange={(o) => !o && onGame(null)} title={shown ?? ""} subtitle={shown ? GAME_STYLE[shown].line : undefined}>
      {shown && (
        <Preview id="show.standings" className="-mx-2 mt-3 px-2 pb-2 pt-3">
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-[15px] leading-normal marker:font-bold marker:text-muted-foreground">
            {RULES[shown].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(GAME_STYLE) as GameName[]).map((g) => (
              <Chip key={g} data-try on={g === shown} onClick={() => onGame(g)}>
                {g}
              </Chip>
            ))}
          </div>
        </Preview>
      )}
    </Sheet>
  );
}

// ---------- a show you don't play ----------

function PlayIt({ name }: { name: string }) {
  return (
    <Preview id="show.make-it-a-game" className="mx-4 mt-[26px]">
      <div className="rounded-[4px] bg-plate p-4 text-plate-foreground shadow-plate">
        <span className="type-caption inline-block bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          Play it
        </span>
        <h3 className="type-caption mt-2 text-[28px]">{name} with your couch</h3>
        <p className="mt-1 text-sm leading-snug text-plate-muted">Survival Pool starts from the next episode, no draft. Or draft a team from this cast.</p>
        <button type="button" className="nd-press mt-3 flex h-[52px] items-center justify-center rounded-[3px] bg-plate-foreground px-4 text-[15px] font-bold text-plate">
          Start a game
        </button>
      </div>
    </Preview>
  );
}

// ---------- How it works, this week ----------

function HowRow({ name }: { name: string }) {
  const how = usePushedPage("how-it-works");
  const parts = HOW.jump
    .map((j) => j.label)
    .filter(Boolean)
    .slice(0, 3)
    .map((l, i) => (i ? l!.toLowerCase() : l));
  return (
    <section className="mt-[26px] px-4">
      <Row icon={BookOpen} title={`How ${name} works`} detail={parts.join(", ")} onClick={how.show} />
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
