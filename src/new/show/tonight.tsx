"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, EyeOff, MessageCircle, Plus, Tv, Users } from "lucide-react";
import { airTime, calm, justAired, ticks } from "../clock";
import { AskAiSheet, checkFull } from "../backstage/ask-ai";
import { backstage, useAfterResults, useSeasonPolls, type GameView, type PasteResult } from "../data";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { episodesOf, openWhere, type ShowData } from "../screens/show-space";
import { useMe } from "../session";
import { namesOf } from "../hub/sections";
import { PlayIt } from "./games";
import { Avatar, useNow } from "../ui/bars";
import { useFinalWhen } from "../final-words";
import { Btn } from "../ui/parts";
import { toast } from "../ui/toast";
import { openMoves } from "./moves";
import { Block, Face } from "./parts";
import { WaiversRanPlate } from "./waivers";
import { useGameDrill, type Door } from "./game-sheets";
import { CatchUpSheet, CatchUpStrips } from "../couch/join-game";
import { OwnPacePlates } from "./pace-plate";
import { openPlan, PlanPlates } from "../couch/watch-plans";
import { useOpenMorning } from "./reveal";
import { StatOfTheWeek, StatsCard } from "./stats";
import { EpisodeGifStrip, showLabel } from "./react";
import { CallResultRow, CallRow } from "./calls";
import { SheetResultRow, SheetRow } from "./questions";
import { PollRow } from "./polls";
import { bingoEpisode as toBingo, BingoRow, openBingo, type BingoTarget } from "./bingo";
import { RemindRow } from "./remind";
import { SeenItCard } from "./seen-it";
import { useOpenWatch } from "./watch-along";
import { TonightNights } from "./whats-on";
import { EpisodeExtras, JoinRows, latestSeen, YourNight } from "./night";

// Tonight (the design round's step 3: docs/design-round/step3-tonight-spec.md, its first view step3-tonight-first-view.md, its
// look step3-tonight-shape.md). Where you are, the couch and the one watching action are the show bar's progress control
// (progress.tsx); what's yours to set is the strip under it (strip.tsx), on every tab. The page under them: Last time (the last
// episode you've watched: who left, the couch's GIFs, its talk and recap), or the wait for an episode's results in its place; then
// Your games (one mini per game, an excerpt of its page's This week card, its lineup's points one tap open: data round 3's
// ledger); then the next episode's plans (watch along, together, your bingo card); then the show's stats. Since 2026-11-21 Your
// games is Your night (night.tsx: docs/design-round/tonight-night-spec.md): each game's last episode for you and everyone in it, the
// night's quick games, the couch's bingo and trivia; the next episode's block gains its quick games and the couch's to join. Kept as they were this
// round, above Last time: the own-pace plates and catch-up strips, the waivers-ran plate, the reminder ask, Fill it in, Seen it?,
// a streaming season's drop, and a show you don't follow's Add to my shows.

export function Tonight({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const playing = show.games.some((g) => g.yourRole);
  const [catchUp, setCatchUp] = useState<GameView | null>(null);
  // A castaway on Tonight opens their sheet over it (the drill pass, 2026-11-17), through the one drill.
  const drill = useGameDrill(show);
  return (
    <>
      <BingoLink show={show} />
      {playing && <WaiversRanPlate seasonId={seasonId} show={show} />}
      {playing && <OwnPacePlates show={show} />}
      {playing && <CatchUpStrips show={show} onOpen={setCatchUp} />}
      <CatchUpSheet show={show} game={catchUp} onOpenChange={(o) => !o && setCatchUp(null)} />
      <DropPlate show={show} />
      {!playing && <SeenItCard show={show} />}
      {!playing && <Following show={show} />}
      {playing && <RemindRow seasonId={seasonId} show={show} />}
      {playing && <FillItIn seasonId={seasonId} show={show} />}
      <OnTonight show={show} />
      <AfterEpisode show={show} />
      <LastTime seasonId={seasonId} show={show} open={drill.open} />
      <YourNight show={show} open={drill.open} />
      <NextEpisode seasonId={seasonId} show={show} />
      <StatsCard seasonId={seasonId} show={show} />
      {!playing && (!show.solo || !show.ready) && <PlayIt show={show} />}
      {drill.sheets}
    </>
  );
}

/** Before a streaming season drops (step 14; the mock's b-dropbox): every episode at once, when, the countdown (calm days, then
 *  the clock inside the last day), the service, and who on the couch is waiting for it (who follows it openly: nothing more). */
function DropPlate({ show }: { show: ShowData }) {
  const me = useMe();
  const at = show.dropAt;
  const now = useNow(at != null && ticks(at));
  if (at == null || at <= now || !show.header) return null;
  const n = episodesOf(show);
  const who = (show.people ?? []).filter((p) => p.userId !== me.id && p.watching).map((p) => p.name);
  const line = [show.header.show.network, show.solo ? null : who.length ? `${namesOf(who)} ${who.length === 1 ? "is" : "are"} waiting for it` : "Be the first on the couch"];
  return (
    <section className="mt-[18px] px-4">
      <div data-drop-plate className="flex flex-col gap-1 rounded-[4px] bg-plate p-3.5 text-plate-foreground shadow-plate">
        <span className="type-caption self-start bg-plate-foreground py-1 pl-[7px] pr-3.5 text-[11px] tracking-[0.06em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_8px)_100%,0_100%)]">
          {n ? `All ${n} episodes at once` : "Every episode at once"}
        </span>
        <b className="type-caption mt-1 text-[30px] leading-none">Drops {airTime(at)}</b>
        <span data-drop-countdown className="type-num text-[34px] leading-none">
          {calm(at, now)}
        </span>
        <small className="text-[13px] leading-snug text-plate-muted">{line.filter(Boolean).join(" · ")}</small>
      </div>
    </section>
  );
}

// ---------- a show you don't play (step 10) ----------

/** Not on your shows: who on the couch watches it, and Add to my shows. On them, watching privately: a line saying so (where you
 *  are is the progress control's). */
function Following({ show }: { show: ShowData }) {
  const me = useMe();
  if (!show.following) {
    const who = (show.people ?? []).filter((p) => p.userId !== me.id && (p.watching || p.playing.length)).map((p) => p.name);
    return (
      <section className="mt-[18px] px-4">
        <div data-follow-card className="flex flex-col gap-2 rounded-[4px] bg-card p-4 outline-1 -outline-offset-1 outline-border">
          {who.length > 0 && (
            <span className="flex">
              {(show.people ?? [])
                .filter((p) => p.userId !== me.id && (p.watching || p.playing.length))
                .slice(0, 6)
                .map((p, i) => (
                  <span key={p.userId} className={`rounded-[3px] shadow-[0_0_0_2px_var(--card)] ${i ? "-ml-1.5" : ""}`}>
                    <Avatar id={p.userId} name={p.name} size={30} />
                  </span>
                ))}
            </span>
          )}
          <b className="text-[17px] leading-tight">
            {who.length ? `${namesOf(who)} ${show.streaming ? (who.length === 1 ? "is streaming" : "are streaming") : who.length === 1 ? "watches" : "watch"} this` : "Not on your shows"}
          </b>
          <small className="text-[13.5px] leading-snug text-muted-foreground">
            {/* A streaming season has an Up next only before its drop (schedule.ts upNext). */}
            {show.streaming && show.dropAt != null && show.upNext
              ? `All ${episodesOf(show) || "its"} episodes drop ${airTime(show.dropAt)}. Add it and it's on your list, ready; nothing past your episode ever shows.`
              : show.streaming && who.length
                ? `All ${episodesOf(show) || "its"} episodes are out. Add it to watch along with their reactions, at your own pace.`
                : "Add it and the couch sees you watch it (or watch privately). Nothing past your episode ever shows."}
          </small>
          <Btn wide className="mt-1" data-follow-add onClick={() => openWhere(show)}>
            <Plus className="size-5" aria-hidden />
            Add to my shows
          </Btn>
        </div>
      </section>
    );
  }
  if (!show.watchingPrivately) return null;
  return (
    <p data-private-line className="mx-4 mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <EyeOff className="size-4 flex-none" aria-hidden />
      Watching privately: the couch doesn&rsquo;t see this on your list
    </p>
  );
}

// ---------- after an episode, before you've seen its results ----------

/** The three stages of an episode's results, for the wait and early results. */
function StageBar({ episode, stage, airAt, finalAt }: { episode: number; stage: "waiting" | "early" | "final"; airAt: string | null; finalAt: string | null }) {
  // When the final results come (final-words.ts: 12:00 noon the day after it airs, in your own time).
  const finalWhen = useFinalWhen(stage === "final" ? null : finalAt);
  const steps: [typeof stage, string, string][] = [
    ["waiting", "Aired", airAt ? (justAired(airAt) ? "Just now" : airTime(Date.parse(airAt))) : "It's out"],
    ["early", "Early results", "Who went home"],
    ["final", "Final results", finalWhen ?? "Every point"],
  ];
  const at = steps.findIndex((s) => s[0] === stage);
  return (
    <div data-stage-bar={stage} className="mt-3 rounded-[4px] p-3.5 outline-1 -outline-offset-1 outline-border">
      <span className="type-caption block text-[13px] tracking-[0.04em] text-muted-foreground">Episode {episode} results</span>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {steps.map(([k, title, line], i) => (
          <div key={k} aria-current={i === at ? "step" : undefined}>
            <i className={`block h-1 rounded-[2px] ${i < at ? "bg-foreground/70" : i === at ? "bg-foreground" : "bg-secondary"}`} />
            <b className={`mt-2 block text-[15px] ${i <= at ? "" : "text-muted-foreground"}`}>{title}</b>
            <small className="block text-xs leading-snug text-muted-foreground">{line}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/** An episode's results on their way, in Last time's place: waiting for them, early ones in (still to reveal), or the morning
 *  update's final scores after an early reveal. The reveal itself is the progress control's. */
function AfterEpisode({ show }: { show: ShowData }) {
  const openMorning = useOpenMorning();
  const eps = show.episodes;
  if (!eps || !show.plays || show.upNext?.live) return null;
  if (eps.reveal?.stage === "early") {
    const r = eps.reveal;
    return (
      <Block title={`${show.words.ep} ${r.episode}`} aside="Early results">
        <StageBar episode={r.episode} stage="early" airAt={eps.episodes.find((e) => e.number === r.episode)?.airAt ?? null} finalAt={r.finalAt} />
      </Block>
    );
  }
  if (eps.reveal) return null;
  if (eps.waiting) {
    return (
      <Block title={`${show.words.ep} ${eps.waiting.episode}`} aside={justAired(eps.waiting.airAt) ? "Just aired" : "Aired"}>
        <div data-waiting={eps.waiting.episode} className="flex items-start gap-3 rounded-[4px] bg-card p-4">
          <span className="mt-1 grid size-6 flex-none place-items-center rounded-full bg-foreground/10">
            <i className="size-2.5 animate-pulse rounded-full bg-foreground/70" />
          </span>
          <span>
            <b className="type-caption block text-[24px] leading-none">Waiting for results</b>
            <small className="mt-1.5 block text-sm leading-snug text-muted-foreground">Who went home usually lands a little after the episode ends. Nothing is spoiled in the meantime.</small>
          </span>
        </div>
        <StageBar episode={eps.waiting.episode} stage="waiting" airAt={eps.waiting.airAt} finalAt={eps.waiting.finalAt ?? null} />
      </Block>
    );
  }
  if (eps.final) {
    const n = eps.final.episode;
    return (
      <section className="mt-[26px] px-4">
        <button
          type="button"
          data-morning={n}
          onClick={() => openMorning(n)}
          className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
        >
          <span className="type-caption -mr-[13px] flex items-center whitespace-nowrap bg-plate-foreground py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] text-plate [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
            Morning update
          </span>
          <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
            <span className="text-[17px] font-bold">Final results are in</span>
            <span className="text-[13px] text-plate-muted">Episode {n} · every point counted</span>
          </span>
          <span className="grid place-items-center px-3">
            <ChevronRight className="size-5" aria-hidden />
          </span>
        </button>
      </section>
    );
  }
  return null;
}

/** A player's quiet ask (step 6b): Episode N's full scores need one paste, and anyone on the couch can do it. */
function FillItIn({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const [open, setOpen] = useState(false);
  const refresh = useAfterResults();
  const n = show.episodes?.fill?.episode ?? null;
  const couchId = show.couch?.id ?? null;
  if (!n || !couchId) return null;
  // Pasted, or fetched by One tap: the same thanks.
  const thanks = async (r: PasteResult) => {
    setOpen(false);
    await refresh();
    if (r.kind !== "full") return;
    toast(r.applied ? "Thanks! Every game on the couch is scored" : `Thanks! ${r.waiting} ${r.waiting === 1 ? "result waits" : "results wait"} for whoever runs the games`);
  };
  return (
    <section className="mt-[26px] px-4">
      <button type="button" data-fill-it={n} onClick={() => setOpen(true)} className="nd-press flex min-h-[64px] w-full items-center gap-3 rounded-[4px] bg-card p-3.5 text-left outline-1 -outline-offset-1 outline-input">
        <span className="min-w-0 flex-1">
          <b className="block text-[16px]">Full scores need one paste</b>
          <small className="block text-[13px] text-muted-foreground">Episode {n} · anyone on the couch can do it · about 2 minutes</small>
        </span>
        <span className="text-[15px] font-bold">Fill it in</span>
      </button>
      <AskAiSheet
        open={open}
        onOpenChange={setOpen}
        title={`Fill in Episode ${n}`}
        what={`An AI searches the web for everything that happened in Episode ${n}, then answers in a format we can read: every game on the couch scores.`}
        seasonId={seasonId}
        couchId={couchId}
        episode={n}
        kind="full"
        check={checkFull}
        onUse={async (answer, opts) => thanks(await backstage.paste(seasonId, couchId, { episode: n, kind: "full", answer, ...opts }))}
        onTapped={thanks}
        seasonName={show.header ? `${show.header.show.name} ${show.header.seasonNumber}` : "this season"}
      />
    </section>
  );
}

// ---------- Last time ----------

/**
 * Last time · Ep N: the last episode you've watched, once it has aired. Who left (the show's own Out plate), the couch's GIFs
 * (yours first, or a dashed tile to add one), then its two doors: the talk about it, and its recap on Episodes. Each game's
 * result for it is that game's mini, under Your games.
 */
function LastTime({ seasonId, show, open }: { seasonId: string; show: ShowData; open: (d: Door) => void }) {
  const n = latestSeen(show);
  const couchId = show.couch?.id ?? null;
  if (!n || !show.header) return null;
  const e = show.episodes?.episodes.find((x) => x.number === n);
  const ep = show.words.ep;
  const target = { seasonId, couchId, episode: n, label: showLabel(show), solo: show.solo };
  return (
    <Block title={`Last time · ${ep} ${n}`} aside={e?.stage === "early" ? "Early results" : undefined}>
      <div data-last-time={n} className="flex flex-col gap-3">
        {(e?.out ?? []).map((c) => (
          <button key={c.id} type="button" data-last-out={c.name} data-door-cast={c.name} onClick={() => open({ kind: "cast", name: c.name })} className="nd-press flex min-h-[64px] w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate">
            <Face src={c.photo} name={c.name} className="w-16 flex-none text-2xl" />
            <span className="type-caption -mr-[13px] flex items-center bg-live py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              Out
            </span>
            <span className="flex flex-1 flex-col justify-center py-2 pl-5 pr-1">
              <b className="type-caption text-[19px]">{c.name}</b>
              <small className="block text-[13px] text-plate-muted">{[c.method, c.place ? `finished ${ordinal(c.place)}` : null].filter(Boolean).join(" · ")}</small>
            </span>
            <ChevronRight className="mr-3 size-4 flex-none self-center text-plate-muted" aria-hidden />
          </button>
        ))}
        {show.ready && show.header.show.kind !== "sport" && e && e.out?.length === 0 && <p className="text-[15px] text-muted-foreground">Nobody left in {ep} {n}.</p>}
        {/* The stat of the week: picked from this episode, so it's part of what happened (stats.tsx; the rest of Stats stays below). */}
        <StatOfTheWeek seasonId={seasonId} show={show} />
        {/* The couch's GIFs for it, your slot first (react.tsx: the same strip ends each recap). */}
        {!show.readOnly && <EpisodeGifStrip target={target} ep={ep} />}
        <div className="grid grid-cols-2 gap-2">
          {!show.solo && couchId && !show.readOnly && (
            <NavLink href={paths.show(seasonId, "chat")} data-last-discuss className="nd-press flex h-12 items-center justify-center gap-2 rounded-[4px] font-bold outline-1 -outline-offset-1 outline-edge">
              <MessageCircle className="size-[18px]" aria-hidden />
              Discuss {ep} {n}
            </NavLink>
          )}
          <NavLink
            href={`${paths.show(seasonId, "episodes")}?page=ep${n}`}
            data-last-recap
            className={`nd-press flex h-12 items-center justify-center gap-1 rounded-[4px] font-bold outline-1 -outline-offset-1 outline-edge ${show.solo || !couchId || show.readOnly ? "col-span-2" : ""}`}
          >
            {ep} {n} recap
            <ChevronRight className="size-4" aria-hidden />
          </NavLink>
        </div>
        {/* Bingo and trivia come with every episode for everyone who follows it: one quiet row, opened in place (night.tsx). */}
        <EpisodeExtras show={show} n={n} />
      </div>
    </Block>
  );
}

// ---------- Your night (night.tsx) ----------

export { countedYet, placeOf, yourLine } from "./night";

// ---------- the next episode ----------

/** At your own pace, your next episode (your mark plus one) while there is one out; else null. */
export const paceNext = (show: ShowData): number | null => {
  if (!show.ownPace) return null;
  const n = (show.seenThrough ?? 0) + 1;
  return n <= show.latestAired ? n : null;
};

/** A Prediction Sheet of yours here asks about episode `n` this week (its questions for it, as the Games read says). */
export const sheetAsks = (show: ShowData, n: number) => (show.play ?? []).some((g) => g.gameType === "questions" && !g.archived && g.sheet?.episode === n);

/** Your game here still asks for episode `n` (a game over a span asks for nothing past its last: step 6 of PLAN-sports-data.md). */
const asksFor = (g: ShowData["games"][number], n: number) => !g.span || n <= g.span.to;

/** The episode Call it asks about: the next to air (step 12 part 2), on a show that's a game you follow or play, unless your Weekly
 *  Calls game here already asks for it as a move. */
function toCall(show: ShowData): number | null {
  const up = show.upNext;
  const playing = show.games.some((g) => g.yourRole);
  if (!show.header || !show.ready || (!show.following && !playing)) return null;
  // At your own pace (every episode out: docs/PLAN-own-pace-games.md part 2), your next episode's calls, open until you've seen it.
  const next = paceNext(show);
  if (next !== null) return sheetAsks(show, next) ? null : next;
  if (!up || up.live) return null;
  if (show.games.some((g) => g.yourRole && g.gameType === "weekly-calls" && asksFor(g, up.number))) return null;
  // A Prediction Sheet here asks about it already (step A4 part 2): the couch answers its sheet, not Call it as well.
  if (sheetAsks(show, up.number)) return null;
  return up.number;
}

/**
 * The next episode, while it's still to come: only what plans it. Watch along (it opens at airtime), watching it together with the
 * couch (planned nights), and your bingo card. Once it's out or on air, Watch along is the progress control's. The other extras'
 * rows (predictions, Call it, finales, polls, how your calls went) stay off until a session on extras brings them back (the user,
 * 2026-11-09).
 */
function NextEpisode({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const me = useMe();
  const up = show.upNext;
  const openWatch = useOpenWatch();
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const now = useNow(t != null && ticks(t));
  const couchId = show.couch?.id ?? null;
  const seen = latestSeen(show);
  const call = toCall(show);
  const predictions = show.moves.filter((m) => m.kind === "prediction");
  const finales = (show.play ?? []).filter((g) => g.sheet?.finale && !g.revealFirst);
  const sheets = seen && show.header ? show.games.filter((g) => g.yourRole && g.gameType === "questions" && !g.archived) : [];
  const polls = useSeasonPolls(show.header?.seasonId ?? null, couchId, !show.solo && !!couchId);
  const more = false;
  const bingo = show.games.some((g) => g.yourRole && g.gameType === "weekly-bingo" && asksFor(g, up?.number ?? show.latestAired)) ? null : toBingo(show);
  if (!show.header || show.readOnly || !up || up.live || (show.dropAt != null && show.dropAt > now)) return null;
  // Behind on a show you only watch: what's out comes first (the control's I watched it); planning the next airing waits.
  if (!show.plays && show.seenThrough != null && show.seenThrough < show.latestAired) return null;
  const plans = (show.home?.plans ?? []).filter((p) => p.couchId === couchId && p.seasonId === seasonId);
  const together = !show.solo && couchId && !plans.some((p) => p.episode === up.number);
  return (
    <Block title={`Next · ${show.words.ep} ${up.number}`}>
      <div data-next-episode={up.number} className="flex flex-col">
        <button type="button" data-next-watch onClick={() => openWatch(up.number)} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0">
          <Tv className="size-5 flex-none text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-semibold">Watch along</b>
            <small className="block text-[13px] text-muted-foreground">Opens at airtime · a clock beside your TV, the couch&rsquo;s reactions in step</small>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
        </button>
        {couchId && <PlanPlates plans={plans} me={me.id} />}
        {together && (
          <button type="button" data-next-together onClick={() => openPlan({ kind: "new", seasonId, couchId: couchId!, episode: up.number })} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
            <Users className="size-5 flex-none text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Watch it together</b>
              <small className="block text-[13px] text-muted-foreground">{show.ownPace || show.streaming ? "Pick a time, start at the same moment, anyone can pause" : "Ask the couch for the live airing, or pick a time"}</small>
            </span>
            <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
          </button>
        )}
        {bingo && <BingoRow target={bingoTarget(show, bingo)} title={bingo === up.number ? "Your bingo card" : undefined} />}
        {/* Its quick games (tonight-night-spec.md block 5): yours with your move's state, then the couch's you could join. */}
        <TonightNights show={show} part="next" />
        <JoinRows show={show} ep={up.number} />
        {more && predictions.map((m) => <PredictionRow key={m.leagueId} title={m.text} line={`Closes at airtime · ${m.leagueName}`} />)}
        {more && call && <CallRow target={{ seasonId, couchId, episode: call, label: showLabel(show), solo: show.solo }} />}
        {more && finales.map((g) => <SheetRow key={g.leagueId} move={g.sheet!} target={{ seasonId, leagueId: g.leagueId, episode: null, game: g.name, finale: true }} />)}
        {more && couchId && (polls.data?.polls ?? []).filter((p) => p.open).map((p) => <PollRow key={p.id} p={p} couchId={couchId} />)}
        {more && seen && <CallResultRow target={{ seasonId, couchId, episode: seen, label: showLabel(show), solo: show.solo }} need="mine" />}
        {more && seen && sheets.map((g) => <SheetResultRow key={g.leagueId} target={{ seasonId, leagueId: g.leagueId, episode: seen, game: g.name }} />)}
      </div>
    </Block>
  );
}

/** A prediction still open (off with the other extras: see NextEpisode). */
function PredictionRow({ title, line }: { title: string; line: string }) {
  return (
    <button type="button" onClick={() => openMoves("predict")} className="nd-press flex min-h-[60px] w-full items-center gap-3 border-t border-border py-2 text-left">
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{line}</small>
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground">Open</span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

const bingoTarget = (show: ShowData, episode: number): BingoTarget => ({
  seasonId: show.header!.seasonId,
  couchId: show.couch?.id ?? null,
  episode,
  label: showLabel(show),
  solo: show.solo,
});

/**
 * The BINGO notice's link ("riley called BINGO · Look at their card", docs/PLAN-bingo-bank.md step 3): `?bingo=<episode>&of=<user>`
 * opens their card once the show's here, then leaves the URL (the server decides what of it you may see yet).
 */
function BingoLink({ show }: { show: ShowData }) {
  const params = useSearchParams();
  const n = Number(params.get("bingo")) || null;
  const of = params.get("of");
  const done = useRef<string | null>(null);
  useEffect(() => {
    const asked = `${n}:${of}`;
    if (!n || !show.header || done.current === asked) return;
    done.current = asked;
    openBingo({ ...bingoTarget(show, n), of: of ? { userId: of } : null });
    const url = new URL(window.location.href);
    url.searchParams.delete("bingo");
    url.searchParams.delete("of");
    window.history.replaceState(null, "", url);
  }, [n, of, show]);
  return null;
}

/** While the episode's on (the mock's during phase): your bingo card, tick it as it happens. */
function OnTonight({ show }: { show: ShowData }) {
  const up = show.upNext;
  if (!up?.live || toBingo(show) !== up.number || !show.header) return null;
  return (
    <Block title={`${show.words.ep} ${up.number}`} aside="On air">
      <BingoRow target={bingoTarget(show, up.number)} />
    </Block>
  );
}
