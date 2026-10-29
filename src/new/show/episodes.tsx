"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Clock, Eye } from "lucide-react";
import { airTime, dayOf } from "../clock";
import { useEpisodeResults, useSeasonWaivers, type EpisodeRow, type GameNight, type WaiverWeek } from "../data";
import { midLine, useFinalLine } from "../final-words";
import { gameInk, ordinal } from "../games";
import { episodesOf, type ShowData } from "../screens/show-space";
import { PushedPage, usePushedPage } from "../ui/page";
import { ShowArt } from "../ui/show-bar";
import { first } from "./moves";
import { Block, Face } from "./parts";
import { useOpenReveal } from "./reveal";
import { CouchMomentsCard } from "./couch-moments";
import { openRate, rateLabel, RateRow, VerdictMark, type RateTarget } from "./rate";
import { CallResults } from "./calls";
import { SheetResultRow } from "./questions";
import { BingoResults } from "./bingo";
import { ShowChangeCard } from "./show-change";
import { CorrectionPlates, CorrectionRow, SomethingWrong } from "./something-wrong";
import { playsWaivers, WaiverEpisodeRow } from "./waivers";
import { RecapsCard } from "./recaps";

// Episodes (the mock's show.js tabEpisodes and episodePage, episode.js's locked row, waivers.js's row): this week's
// episode and who's set for it, the next results to reveal, then every episode: one whose results are in but hidden
// until you reveal (Reveal), one that's aired and waiting for results, and each one you've seen with who went home
// and your line, opening its own page (?page=ep4: who went home, your games, the top scorers, what happened). Real
// (GET /api/seasons/[id]/episodes, through the guard). A waiver week sits between the two episodes it falls between
// (waivers.js's row): open, it goes to the Waivers page; run, to its own page in picking order (step 6a). A correction the
// shared check made to the couch's games is a line of its own at the top, and a plate on the episode's page, which ends
// with "Something wrong in this episode?" (step 6b, something-wrong.tsx). Each episode you've seen carries the couch's verdict
// and your stars (step 12 part 1, rate.tsx): a show you only watch opens Rate it from the row, a show you play from its page.
// A streaming season (step 14; the mock's streaming.js wEpisodes): the drop instead of this week's episode, "All 8 out ·
// Netflix", and a season you only watch from Episode 1 down, the way you'll watch it.

/** "3 of 4 lineups set · 2 of 4 picked": who's set for the next episode in your games here, a line per kind. */
function progressLine(show: ShowData): string | null {
  const seen = new Set<string>();
  const parts = (show.play ?? [])
    .map((g) => g.progress)
    .filter((p) => !!p && !seen.has(p.label) && !!seen.add(p.label))
    .map((p) => `${p!.done} of ${p!.of} ${p!.label}`);
  return parts.length ? parts.join(" · ") : null;
}

/** An episode row's one line: your night in Weekly Lineup if you play it ("You +6 in Weekly Lineup"), else your first
 *  game's, else how they left. Read-only (`ro`, the desk's Open it: nobody's night), whether the game counted it. */
function rowLine(e: EpisodeRow, ro?: ReadOnlyLine | null): string {
  if (ro) return ro.from === null || e.number < ro.from ? `Before ${ro.name} started` : ro.to !== null && e.number > ro.to ? `After ${ro.name} ended` : `Scored in ${ro.name}`;
  const l = e.lines?.find((x) => x.gameType === "active-roster") ?? e.lines?.[0];
  if (!l) return e.out?.length ? (e.out[0].method ?? "Out") : "Nothing recorded";
  if (l.line === "Before the game started") return "Before your games started";
  if (l.gameType === "active-roster") return `You ${l.big} in ${l.gameName}`;
  if (l.gameType === "pickem") return l.big === "Survived" ? `Your ${l.gameName} pick survived` : `${l.gameName}: ${l.big.toLowerCase()}`;
  return `${l.gameName}: ${l.big}`;
}

export function Episodes({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const up = show.upNext;
  const t = up?.airAt ? Date.parse(up.airAt) : null;
  const eps = show.episodes;
  const openReveal = useOpenReveal();
  const finalWords = useFinalLine(eps?.reveal?.stage, eps?.reveal?.finalAt);
  // Read-only: the game open (by its id), who's set in it, or that a game still going has nothing to set (the mock's
  // "Outlast: nothing to set before it airs").
  const roGame = show.readOnly ? show.play?.find((g) => g.leagueId === show.readOnly!.leagueId) : undefined;
  const ro: ReadOnlyLine | null = show.readOnly && roGame ? { name: show.readOnly.name, from: roGame.from, to: roGame.to } : null;
  const progress = progressLine(show) ?? (ro && roGame && !roGame.over && !roGame.archived ? `${ro.name}: nothing to set before it airs` : null);
  const wv = useSeasonWaivers(seasonId, show.couch?.id ?? null, playsWaivers(show) && !show.readOnly);
  const rateFor = (n: number): RateTarget => ({ seasonId, couchId: show.couch?.id ?? null, episode: n, label: rateLabel(show), solo: show.solo });
  // Each waiver week after the episode that opened it: in a newest-first list, just above that episode's row.
  const weeks = (n: number) => (wv.data?.games ?? []).filter((w) => (w.run?.episode ?? w.period?.episode) === n && (w.run || (w.stage === "open" && (w.replace.length || w.swapsAllowed))));
  const waiverRows = (list: WaiverWeek[]) =>
    list.map((w) => <WaiverEpisodeRow key={w.leagueId} seasonId={seasonId} week={w} many={(wv.data?.games.length ?? 0) > 1} />);
  const n = episodesOf(show);
  const network = show.header?.show.network;
  // A streaming season: Up next is its drop, until it's out (schedule.ts upNext); then, watched without a game of yours, the
  // episodes in the order you'll watch them.
  const drop = show.streaming && up && t != null;
  const list = eps ? (show.streaming && !show.plays ? [...eps.episodes].reverse() : eps.episodes) : [];
  const aside = show.streaming
    ? drop
      ? `${n ? `All ${n} drop` : "Drops"} ${dayOf(t!)}`
      : `${n ? `All ${n} out` : "All out"}${network ? ` · ${network}` : ""}`
    : eps?.stillIn != null
      ? `${eps.stillIn} still in`
      : null;
  return (
    <>
      {/* A streaming season's drop is the list's own line (below), not this week's episode. */}
      {up && show.header && !drop && (
        <Block title={`${show.words.episode} ${up.number}`} aside={up.live ? "On now" : "This week"}>
          <div className="flex items-center gap-3 rounded-[4px] bg-card p-2.5" data-ep-up={up.number}>
            <ShowArt seasonId={seasonId} artUrl={show.header.show.artUrl} name={show.header.show.name} className="h-[60px] w-24 flex-none rounded-[3px] text-[13px]" />
            <div className="min-w-0">
              <b className="type-caption block text-[19px]">{up.live ? "On air now" : t != null ? `Airs ${airTime(t)}` : "Up next"}</b>
              {progress && <small className="block text-[13px] text-muted-foreground">{progress}</small>}
            </div>
          </div>
        </Block>
      )}
      {eps?.reveal && (
        <section className="mt-[26px] px-4">
          <button
            type="button"
            data-reveal-plate
            onClick={() => openReveal(eps.reveal!.episode)}
            className="nd-press flex min-h-14 w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate"
          >
            <span className="type-caption -mr-[13px] flex items-center whitespace-nowrap bg-chyron py-0 pl-[11px] pr-[22px] text-sm tracking-[0.04em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              {show.words.ep} {eps.reveal.episode}
            </span>
            <span className="flex flex-1 flex-col justify-center gap-[3px] py-[7px] pl-5 pr-2.5">
              <span className="type-caption text-[19px]">{eps.reveal.stage === "early" ? "Early results are in" : "Final results are in"}</span>
              <span className="text-[13px] text-plate-muted">{eps.reveal.stage === "early" && finalWords ? `Hidden until you reveal · ${midLine(finalWords)}` : "Hidden until you reveal"}</span>
            </span>
            <span className="grid place-items-center px-3">
              <ChevronRight className="size-5" aria-hidden />
            </span>
          </button>
        </section>
      )}
      {eps && <RecapsCard seasonId={seasonId} show={show} eps={eps} />}
      <section className="mt-[26px] px-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="type-caption text-[24px]">Every {show.words.episode.toLowerCase()}</h2>
          {aside && (
            <span data-episodes-aside className="text-[13px] text-muted-foreground">
              {aside}
            </span>
          )}
        </div>
        {!eps ? (
          <div aria-busy className="h-56 animate-pulse rounded-[4px] bg-card" />
        ) : (
          <>
            {(eps.corrections ?? []).map((c) => (
              <CorrectionRow key={`${c.episode}-${c.decisionId}`} c={c} />
            ))}
            {list.map((e) => (
              <div key={e.number} className="contents">
                {waiverRows(weeks(e.number))}
                {e.status === "hidden" ? (
                  <HiddenRow e={e} onReveal={() => openReveal(e.number)} />
                ) : e.status === "waiting" ? (
                  <WaitingRow e={e} />
                ) : e.status === "aired" ? (
                  <AiredRow e={e} solo={show.solo} streaming={show.streaming} word={show.words.episode} onRate={() => openRate(rateFor(e.number))} />
                ) : (
                  <SeenRow e={e} solo={show.solo} ro={ro} />
                )}
              </div>
            ))}
            {eps.episodes.length === 0 && !(drop && eps.toAir) && <p className="border-t border-border py-4 text-sm text-muted-foreground">Nothing has aired yet.</p>}
            {eps.toAir && (
              <div data-ep-to-air={drop ? "drop" : eps.toAir.from} className="flex min-h-[68px] items-center gap-3 border-y border-border opacity-(--nd-dim)">
                <span className="type-num w-7 text-[28px] text-muted-foreground">{eps.toAir.from}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-base font-semibold">
                    {drop
                      ? `Drops ${airTime(t!)}`
                      : eps.toAir.to
                        ? `+ ${eps.toAir.to - eps.toAir.from + 1} still to air`
                        : "More to come"}
                  </b>
                  {/* The row is dimmed already: muted on top of it fell under 4.5:1. */}
                  {eps.toAir.to && eps.toAir.to > eps.toAir.from && (
                    <small className="mt-0.5 block text-[13px] text-foreground/85">
                      {show.words.episodes} {eps.toAir.from} to {eps.toAir.to}
                    </small>
                  )}
                </span>
              </div>
            )}
          </>
        )}
      </section>
      <EpisodePage seasonId={seasonId} show={show} />
    </>
  );
}

function HiddenRow({ e, onReveal }: { e: EpisodeRow; onReveal: () => void }) {
  const finalWords = useFinalLine(e.stage, e.finalAt);
  return (
    <button
      type="button"
      data-ep-hidden={e.number}
      onClick={onReveal}
      className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border bg-[repeating-linear-gradient(135deg,transparent_0_10px,color-mix(in_srgb,var(--foreground)_3%,transparent)_10px_20px)] text-left"
    >
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e.number}</span>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-chyron-line">
        <Eye className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{e.stage === "early" ? "Early results are in" : "Final results are in"}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">{e.stage === "early" && finalWords ? `Hidden until you reveal · ${midLine(finalWords)}` : "Hidden until you reveal"}</small>
      </span>
      <span className="text-[15px] font-semibold text-chyron-line">Reveal</span>
    </button>
  );
}

/** An episode of a show you only watch, with no results to show (step 10): when it aired, and whether you've seen it. One
 *  you've seen opens Rate it (step 12 part 1), with the couch's verdict on the row. */
function AiredRow({ e, solo, streaming, word = "Episode", onRate }: { e: EpisodeRow; solo: boolean; streaming?: boolean; word?: string; onRate: () => void }) {
  const body = (
    <>
      <span className={`type-num w-7 text-[28px] ${e.watched ? "" : "text-muted-foreground"}`}>{e.number}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">{e.title ?? `${word} ${e.number}`}</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {/* A streaming season's all came out at once: when isn't news. */}
          {e.airAt && !streaming ? `Aired ${airTime(Date.parse(e.airAt))} · ` : ""}
          {e.watched ? "You've seen it" : "Not seen yet"}
        </small>
        {e.summary && (
          <small data-ep-summary className="mt-1 block text-[13.5px] leading-snug text-foreground/90">
            {e.summary}
          </small>
        )}
      </span>
    </>
  );
  if (!e.watched) {
    return (
      <div data-ep-aired={e.number} data-watched="no" className="flex min-h-[68px] items-center gap-3 border-t border-border py-2">
        {body}
      </div>
    );
  }
  return (
    <button type="button" data-ep-aired={e.number} data-watched="yes" onClick={onRate} className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border py-2.5 text-left">
      {body}
      <VerdictMark v={e.verdict} solo={solo} rate />
    </button>
  );
}

function WaitingRow({ e }: { e: EpisodeRow }) {
  return (
    <div data-ep-waiting={e.number} className="flex min-h-[68px] items-center gap-3 border-t border-border">
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e.number}</span>
      <span className="grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-muted-foreground">
        <Clock className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">Waiting for results</b>
        <small className="mt-0.5 block text-[13px] text-muted-foreground">
          {e.airAt ? `Aired ${airTime(Date.parse(e.airAt))} · ` : ""}nothing is spoiled meanwhile
        </small>
      </span>
    </div>
  );
}

/** The game open read-only, for an episode row's line: its name, its first episode and its last (null: the season's end). */
/** `from` null: a game waiting for a phase of the season (step A3 of docs/PLAN-start-a-game-gpt.md), not started yet. */
type ReadOnlyLine = { name: string; from: number | null; to: number | null };

function SeenRow({ e, solo, ro }: { e: EpisodeRow; solo: boolean; ro: ReadOnlyLine | null }) {
  const page = usePushedPage(`ep${e.number}`);
  const out = e.out ?? [];
  return (
    <button type="button" data-ep={e.number} onClick={page.show} className="nd-press flex min-h-[68px] w-full items-center gap-3 border-t border-border text-left">
      <span className="type-num w-7 text-[28px] text-muted-foreground">{e.number}</span>
      {out.length > 0 && (
        <span className="flex flex-none">
          {out.slice(0, 3).map((c, i) => (
            <Face key={c.id} src={c.photo} name={c.name} out className={`size-10 rounded-[3px] shadow-[0_0_0_2px_var(--background)] ${i ? "-ml-3" : ""}`} />
          ))}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-base font-semibold">{out.length ? `${out.map((c) => first(c.name)).join(" and ")} out` : "No one out"}</b>
        <small className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {rowLine(e, ro)}
          {e.stage === "early" ? " · full scores to come" : ""}
        </small>
      </span>
      <VerdictMark v={e.verdict} solo={solo} />
      <ChevronRight className="size-5 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** The episode page open over the tab, whichever it is (?page=ep4). */
function EpisodePage({ seasonId, show }: { seasonId: string; show: ShowData }) {
  const asked = /^ep(\d+)$/.exec(useSearchParams().get("page") ?? "");
  const ep = asked ? Number(asked[1]) : null;
  // Keep the last one while it slides away.
  const [shown, setShown] = useState(ep);
  if (ep != null && ep !== shown) setShown(ep);
  const page = usePushedPage(`ep${shown}`);
  const e = show.episodes?.episodes.find((x) => x.number === shown && x.status === "seen") ?? null;
  return (
    <PushedPage open={ep != null} onClose={page.close} title={`${show.words.episode} ${shown ?? ""}`} back={show.words.episodesTab}>
      {e ? (
        <EpisodeBody
          seasonId={seasonId}
          couchId={show.couch?.id ?? null}
          e={e}
          seasonName={show.header ? `${show.header.show.name} ${show.header.seasonNumber}` : "this season"}
          rate={{ seasonId, couchId: show.couch?.id ?? null, episode: e.number, label: rateLabel(show), solo: show.solo }}
          sheets={show.games.filter((g) => g.yourRole && g.gameType === "questions" && !g.archived).map((g) => ({ leagueId: g.leagueId, name: g.name }))}
        />
      ) : (
        <p className="px-4 pt-6 text-sm text-muted-foreground">Reveal this episode to see it.</p>
      )}
    </PushedPage>
  );
}

function GameLine({ l }: { l: GameNight }) {
  return (
    <div className="grid grid-cols-[118px_1fr] gap-x-2.5 gap-y-0.5 border-t border-border py-3">
      <span
        className="type-caption row-span-2 self-center text-[13px] tracking-[0.04em]"
        style={{ color: l.gameType === "predictions" ? "var(--muted-foreground)" : gameInk(l.gameName) }}
      >
        {l.gameName}
      </span>
      <b className="text-lg">{l.big}</b>
      <small className="block text-[13px] text-muted-foreground">{l.line}</small>
    </div>
  );
}

function EpisodeBody({
  seasonId,
  couchId,
  e,
  seasonName,
  rate,
  sheets,
}: {
  seasonId: string;
  couchId: string | null;
  e: EpisodeRow;
  seasonName: string;
  rate: RateTarget;
  sheets: { leagueId: string; name: string }[];
}) {
  const out = e.out ?? [];
  const results = useEpisodeResults(seasonId, couchId, e.number);
  const finalWords = useFinalLine(e.stage, e.finalAt);
  return (
    <div data-episode-page={e.number} className="mb-10 mt-3 px-4 pb-4 pt-4">
      <CorrectionPlates results={results.data} />
      {e.stage === "early" && (
        <p className="mb-3 rounded-[3px] bg-card px-3 py-2.5 text-sm text-muted-foreground">Early results: who went home is in. {finalWords ? `${finalWords}.` : "Weekly Lineup’s full scores come later."}</p>
      )}
      <div className="flex flex-col gap-2.5">
        {out.map((c) => (
          <div key={c.id} className="flex min-h-[64px] items-stretch overflow-hidden rounded-[3px] bg-plate text-plate-foreground shadow-plate">
            <Face src={c.photo} name={c.name} out={c.knocked} className="w-16 flex-none text-2xl" />
            <span className="type-caption -mr-[13px] flex items-center bg-live py-0 pl-3 pr-[22px] text-sm tracking-[0.04em] text-live-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
              Out
            </span>
            <span className="flex flex-1 flex-col justify-center py-2 pl-5 pr-3">
              <b className="type-caption text-[19px]">{c.name}</b>
              <small className="block text-[13px] text-plate-muted">{[c.method, c.place ? `finished ${ordinal(c.place)}` : null].filter(Boolean).join(" · ")}</small>
            </span>
          </div>
        ))}
        {out.length === 0 && <p className="text-[15px] text-muted-foreground">Nobody went home this episode.</p>}
      </div>
      {(e.lines?.length ?? 0) > 0 && (
        <section className="mt-[26px]">
          <h2 className="type-caption mb-3 text-[24px]">Your games</h2>
          {e.lines!.map((l) => (
            <GameLine key={`${l.leagueId}-${l.gameType}`} l={l} />
          ))}
        </section>
      )}
      {(e.scorers?.length ?? 0) > 0 && (
        <section className="mt-[26px]">
          <h2 className="type-caption mb-3 text-[24px]">Top scorers</h2>
          {e.scorers!.map((c, i) => (
            <div key={c.name} className="flex h-[52px] items-center gap-2.5 border-t border-border text-[15px] font-semibold">
              <span className="type-num w-[22px] text-[22px] text-muted-foreground">{i + 1}</span>
              <Face src={c.photo} name={c.name} className="size-[34px] rounded-[3px] text-sm" />
              {c.name}
              <span className="type-num ml-auto text-[22px]">+{c.points}</span>
            </div>
          ))}
        </section>
      )}
      {(e.happened?.length ?? 0) > 0 && (
        <section className="mt-[26px]">
          <h2 className="type-caption mb-3 text-[24px]">What happened</h2>
          {e.happened!.map((h) => (
            <div key={h.label} className="flex min-h-12 flex-wrap items-center gap-2 border-t border-border py-2">
              <span className="type-caption w-[90px] text-sm text-muted-foreground">{h.label}</span>
              {h.winners.map((w) => (
                <span
                  key={w.name}
                  className={`rounded-[2px] px-2.5 py-1 text-sm font-bold ${w.colour ? "" : "bg-secondary"}`}
                  style={w.colour ? { background: w.colour, color: "#121018" } : undefined}
                >
                  {w.name}
                </span>
              ))}
            </div>
          ))}
        </section>
      )}
      <section className="mt-[26px]" data-episode-rate>
        <h2 className="type-caption mb-1 text-[24px]">How was it?</h2>
        <RateRow target={rate} verdict={e.verdict} />
      </section>
      <CallResults target={rate} />
      {/* Each Prediction Sheet of yours here (step A4 part 2): how its questions went on this episode, at your mark. */}
      {sheets.map((g) => (
        <SheetResultRow key={g.leagueId} heading target={{ seasonId, leagueId: g.leagueId, episode: e.number, game: g.name }} />
      ))}
      <BingoResults target={rate} />
      <CouchMomentsCard seasonId={seasonId} couchId={couchId} episode={e.number} />
      <ShowChangeCard seasonId={seasonId} couchId={couchId} episode={e.number} seasonName={seasonName} />
      <SomethingWrong seasonId={seasonId} couchId={couchId} episode={e.number} />
    </div>
  );
}
