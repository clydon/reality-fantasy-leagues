"use client";

import { useState } from "react";
import { ChevronRight, CircleQuestionMark, Plus, Tv, Users } from "lucide-react";
import { useMyTrivia, useSolo, type Home, type SoloSeason } from "../data";
import { openCouchSheet } from "../couch/couch-sheets";
import { GAME_STYLE, type GameName } from "../games";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { Btn, SectionHead } from "../ui/parts";
import { Sheet } from "../ui/sheet";
import { PoolCard, PracticeCard, PracticeSheet, poolShown, practiceShown, type PracticeSeason } from "../show/solo";
import { openTrivia } from "../show/trivia";
import { Foot, nextShow, StatusLine, UpNext, YourShows } from "./sections";
import { Guide } from "./guide";

// The solo hub (docs/PLAN-new-design.md step 9 part 3; the mock's round2.js soloHub + solo.js): someone on no couch, first
// run's "Just me for now". Welcome, Watching solo (start a couch), what's due and Up next when something is, the guide
// (step 11), your shows, Play on your own (each show's public pool and your practice couch: real), On your own (Watch along on
// one of your shows since step 13 part 1; this week's trivia on one of your shows since step 12 part 3; Who's scoring is the cast), Better with
// friends (the season games, and Start a couch), the foot.

export function SoloHub({ home }: { home: Home }) {
  const due = home.moves.length > 0 || home.shows.some((s) => s.results?.reveal || s.results?.final);
  const up = nextShow(home);
  return (
    <div data-solo-hub>
      <p className="mx-4 mb-3 mt-1 text-[15px] leading-snug text-muted-foreground" data-solo-hello>
        <b className="text-foreground">Welcome, {home.user.name}.</b> Your shows, spoiler-safe, ready when you are.
      </p>
      {due && <StatusLine home={home} />}
      <button
        type="button"
        onClick={() => openCouchSheet({ kind: "new" })}
        data-solo-invite
        className="nd-press mx-4 flex w-[calc(100%-32px)] items-center gap-3 rounded-[4px] border border-dashed border-input bg-card p-3 text-left"
      >
        <span className="flex flex-none gap-1" aria-hidden>
          <Avatar id={home.user.id} name={home.user.name} size={30} />
          {[0, 1].map((i) => (
            <span key={i} className="grid size-[30px] place-items-center rounded-[3px] bg-secondary text-muted-foreground">
              <Plus className="size-4" />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] font-semibold">Watching solo</b>
          <small className="block text-[13px] leading-snug text-muted-foreground">Start a couch and play these with friends</small>
        </span>
        <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
      </button>
      {up && (due || up.upNext) && (
        <div className="mt-6">
          <UpNext home={home} show={up} couch={null} />
        </div>
      )}
      <Guide home={home} couch={null} />
      <YourShows home={home} hub={undefined} />
      <PlayOnYourOwn home={home} />
      <OnYourOwn home={home} />
      <BetterWithFriends />
      <Foot />
    </div>
  );
}

/** Each of your shows' public pool (two at most here, soonest first) and your practice couch. */
function PlayOnYourOwn({ home }: { home: Home }) {
  const nav = useNav();
  const { data } = useSolo();
  const [sheet, setSheet] = useState(false);
  if (!data) return <div aria-busy className="mx-4 mt-8 h-44 animate-pulse rounded-[4px] bg-card" />;
  const pools = data.seasons.filter((s) => poolShown(s.pool)).slice(0, 2);
  const yours = data.seasons.find((s) => s.practice.leagueId);
  const open = data.seasons.filter((s) => practiceShown(s.practice));
  if (!pools.length && !open.length) return null;
  const art = (s: SoloSeason) => home.shows.find((h) => h.seasonId === s.seasonId)?.show.artUrl ?? null;
  const sheetFor = (s: SoloSeason): PracticeSeason => {
    const h = home.shows.find((x) => x.seasonId === s.seasonId);
    return { info: s.practice, seenThrough: h ? h.seenThrough : 0, latestAired: h?.latestAired ?? 0 };
  };
  return (
    <section className="mt-8" data-play-solo>
      <SectionHead title="Play on your own" aside="No couch needed" />
      <div className="px-4">
        {pools.map((s) => (
          <PoolCard key={s.seasonId} info={s.pool} art={art(s)} onOpen={() => nav.push(`${paths.show(s.seasonId, "games")}?page=pool`)} />
        ))}
        {(yours || open.length > 0) && <PracticeCard info={(yours ?? open[0]).practice} onOpen={() => setSheet(true)} />}
      </div>
      <PracticeSheet open={sheet} onOpenChange={setSheet} seasons={yours ? [sheetFor(yours)] : open.map(sheetFor)} />
    </section>
  );
}

/** Things to do alone: Watch along (13), this week's trivia on one of your shows (step 12 part 3), and the cast ranked up to your
 *  episode. */
function OnYourOwn({ home }: { home: Home }) {
  const first = home.shows[0];
  const round = useMyTrivia(null).data?.rounds[0] ?? null;
  // Watch along (step 13): the first of your shows with an episode out you haven't seen, else what's on next.
  const watch = home.shows.find((s) => s.following && s.seenThrough !== null && s.seenThrough < s.latestAired) ?? nextShow(home) ?? first ?? null;
  const art = (watch ?? first)?.show.artUrl ?? null;
  const tile = "flex w-[176px] flex-none flex-col overflow-hidden rounded-[4px] bg-card text-left";
  const pic = (icon: typeof Tv, colour: string) => {
    const Icon = icon;
    return (
      <span className="relative block h-[96px] bg-secondary">
        {art && (
          // eslint-disable-next-line @next/next/no-img-element -- the show's key art, any host
          <img src={art} alt="" className="size-full object-cover opacity-80" />
        )}
        <span className="absolute bottom-0 left-2.5 grid size-9 place-items-center rounded-t-[3px]" style={{ background: colour }}>
          <Icon className="size-5 text-background" aria-hidden />
        </span>
      </span>
    );
  };
  return (
    <section className="mt-8">
      <SectionHead title="On your own" />
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {watch && (
          <NavLink href={paths.watch(watch.seasonId)} className={`${tile} nd-press`} data-solo-watch={watch.seasonId}>
            {pic(Tv, "var(--good)")}
            <span className="p-3">
              <b className="block text-[15px] font-semibold">Watch along</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">Pause, rewind, react, rate it after</small>
            </span>
          </NavLink>
        )}
        {round && (
          <button type="button" className={`${tile} nd-press`} data-solo-trivia={round.showId} onClick={() => openTrivia({ seasonId: round.seasonId, couchId: null })}>
            {pic(CircleQuestionMark, "var(--chyron)")}
            <span className="p-3">
              <b className="block text-[15px] font-semibold">{round.title}</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">{round.played ? `You got ${round.played.score} of ${round.played.of} this week` : round.line}</small>
            </span>
          </button>
        )}
        {first && (
          <NavLink href={paths.show(first.seasonId, "cast")} className={`${tile} nd-press`} data-solo-cast>
            {pic(Users, "#8f84d8")}
            <span className="p-3">
              <b className="block text-[15px] font-semibold">Who&apos;s scoring</b>
              <small className="block text-[13px] leading-snug text-muted-foreground">The cast, ranked up to your episode</small>
            </span>
          </NavLink>
        )}
      </div>
    </section>
  );
}

/** The season games, what each is, and Start a couch: they're played with friends. */
function BetterWithFriends() {
  const [shown, setShown] = useState<GameName | null>(null);
  const [last, setLast] = useState<GameName | null>(null);
  if (shown && shown !== last) setLast(shown);
  const g = shown ?? last;
  const games = Object.keys(GAME_STYLE) as GameName[];
  return (
    <section className="mt-8" data-better-with-friends>
      <SectionHead title="Better with friends" />
      <div className="flex flex-col gap-2 px-4">
        {games.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setShown(name)}
            data-friends-game={name}
            className="nd-press flex min-h-[60px] items-center rounded-[3px] border-l-[3px] bg-card px-3.5 py-2.5 text-left"
            style={{ borderLeftColor: GAME_STYLE[name].colour }}
          >
            <span>
              <b className="type-caption block text-[20px]">{name}</b>
              <small className="block text-[13px] text-muted-foreground">{GAME_STYLE[name].line}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="mx-4 mt-3.5">
        <Btn wide onClick={() => openCouchSheet({ kind: "new" })} data-solo-start-couch>
          Start a couch
        </Btn>
      </div>
      <Sheet open={!!shown} onOpenChange={(o) => !o && setShown(null)} title={g ?? ""} subtitle={g ? GAME_STYLE[g].line : undefined}>
        {g && (
          <div className="mt-2 pb-2">
            <p className="text-[15px] leading-snug">{FRIENDS[g]}</p>
            <Btn tone="ink" wide className="mt-4" onClick={() => (setShown(null), openCouchSheet({ kind: "new" }))}>
              Start a couch
            </Btn>
          </div>
        )}
      </Sheet>
    </section>
  );
}

const FRIENDS: Record<GameName, string> = {
  Outlast: "Everyone drafts a team from the cast. Each time someone goes home, the teams still holding people move up; the last one standing carries you. Start a couch, send the code, draft together.",
  "Weekly Lineup": "Draft a team, then start your best three before each episode. Points come from what they do on the night. Play against your couch, or practise against computer players first.",
  "Survival Pool": "No draft: each episode, pick someone you think survives, never the same person twice. Play with your couch, or against everyone in a season's public pool.",
  "Weekly Calls": "A talk show's game: before each show, two calls about what will happen in it (a surprise cameo? someone breaks?). The couch says what happened as it watches; most right by the finale wins.",
  "Weekly Bingo": "A talk show's other game: a new bingo card every show, nine of its moments. Tick them as they happen; three in a row is a line, and the couch agreeing it happened makes it count. Most lines by the finale wins.",
};
