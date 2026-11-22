"use client";

// Bands (the design round's step 7; the user picked it over the posters, Your week, the couch first and Previously on): Your shows
// as bands, each a show's art with its season as a ruler and the couch's faces at their episodes, each episode's number under the
// faces standing there, someone away (behind, and not on since the latest aired: the home read's `away`) faded with a dotted trail
// to the latest episode; finished seasons (for the whole couch) folded at the foot. Sports left for the scores strip under the
// guide bar (docs/PLAN-sports-couch.md A1: hub/scores-strip.tsx), with the Scoreboard's ask (Show the score, or Watch it as if
// live); each league you follow through a team, or play in, is a quieter card among the bands (A2: hub/league-cards.tsx).

import { useState } from "react";
import { Plus } from "lucide-react";
import { type Couch, type CouchHub, type Home, type HomeShow } from "../data";
import { plainName } from "../couch/where";
import { airTime } from "../clock";
import { ordinal } from "../games";
import { NavLink } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { SectionHead } from "../ui/parts";
import { ShowArt } from "../ui/show-bar";
import { openWatching } from "../watching/sheets";
import { showWords } from "@/lib/game/show-words";
import { usePracticeShows } from "../tour/practice-shows";
import { FinishedFold, finishedFor, GamesMark, shelfOrder, showOfMove } from "./sections";
import { LeagueCard, useLeagueCards } from "./league-cards";

const nameOf = (s: { show: { name: string }; seasonNumber: number | null }) => `${plainName(s.show.name)}${s.seasonNumber ? ` ${s.seasonNumber}` : ""}`;
const epOf = (s: HomeShow) => {
  const w = showWords(s.show.terms);
  return w.ep.length > 1 ? w.ep : w.episode;
};

/** Where each person is on a season: you from the home read, the couch's from what they share. */
function marksOn(home: Home, couch: Couch | null, s: HomeShow) {
  const me = home.user.id;
  const out: { userId: string; name: string; seen: number; you: boolean; away: boolean }[] = [];
  if (s.seenThrough != null && (s.following || s.games.length)) out.push({ userId: me, name: home.user.name, seen: s.seenThrough, you: true, away: false });
  for (const m of couch?.members ?? []) {
    if (m.userId === me || !m.watching.includes(s.seasonId)) continue;
    const at = m.at?.[s.seasonId];
    if (at != null) out.push({ userId: m.userId, name: m.name, seen: at, you: false, away: !!m.away?.includes(s.seasonId) });
  }
  return out;
}

// ---------- bands: Your shows, each a band with its ruler ----------

export function ShowBands({ home, couch, hub }: { home: Home; couch: Couch | null; hub: CouchHub | undefined }) {
  // With what the first-time tour's practice added, for the tour (tour/practice-shows.ts; each says Practice).
  const practice = usePracticeShows();
  const mine = [...home.shows, ...practice].filter((s) => s.following || s.games.length || s.seasonId.startsWith("tour-"));
  const shows = shelfOrder(mine.filter((s) => !finishedFor(home, couch, hub, s)));
  const finished = shelfOrder(mine.filter((s) => finishedFor(home, couch, hub, s)));
  const [open, setOpen] = useState(false);
  const due = new Set(home.moves.map((m) => showOfMove(home, m)?.seasonId).filter(Boolean));
  // A league is one card among the bands (docs/PLAN-sports-couch.md A2: hub/league-cards.tsx), in its place by its next game as a
  // show is by its next episode (a stable sort: ties keep the shelf's order, the leagues after the shows). The bands wait for the
  // cards' few small reads, so everything lands once, in its place, rather than the bands jumping as a card slots in (the check).
  const cards = useLeagueCards(home, couch, hub);
  const airAt = (s: HomeShow) => (s.upNext?.airAt ? Date.parse(s.upNext.airAt) : Infinity);
  const rows = !cards
    ? []
    : [
        ...shows.filter((s) => s.show.kind !== "sport").map((s) => ({ key: s.seasonId, at: airAt(s), show: s, card: null })),
        ...cards.map((c) => ({ key: `league:${c.league}`, at: c.at, show: null, card: c })),
      ].sort((a, b) => a.at - b.at);
  return (
    <section className="mt-7" data-look="bands" data-your-shows>
      <SectionHead title="Your shows" aside={couch ? "Where everyone is" : undefined} />
      <div className="flex flex-col gap-2.5 px-4">
        {/* TV shows as bands, each league a card among them; a sport's games themselves are on the scores strip under the guide bar
            (hub/scores-strip.tsx). */}
        {rows.map((r) =>
          r.show ? <ShowBand key={r.key} home={home} couch={couch} show={r.show} due={due.has(r.show.seasonId)} hub={hub} /> : <LeagueCard key={r.key} card={r.card!} />
        )}
        <button
          type="button"
          data-add-show-poster
          onClick={() => openWatching({ kind: "add" })}
          className="nd-press flex h-14 items-center justify-center gap-1.5 rounded-[4px] text-[15px] font-semibold text-muted-foreground outline-2 -outline-offset-2 outline-dashed outline-input"
        >
          <Plus className="size-4" aria-hidden />
          Add a show
        </button>
      </div>
      {finished.length > 0 && (
        <div className="mt-3">
          <FinishedFold n={finished.length} open={open} onToggle={() => setOpen((o) => !o)} />
          {open && (
            <div data-finished className="nd-rise mt-2.5 flex flex-col gap-2.5 px-4">
              {finished.map((s) => (
                <ShowBand key={s.seasonId} home={home} couch={couch} show={s} due={false} hub={hub} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ShowBand({ home, couch, show, due, hub }: { home: Home; couch: Couch | null; show: HomeShow; due: boolean; hub: CouchHub | undefined }) {
  const total = Math.max(show.episodeCount ?? 0, show.latestAired, show.upNext?.number ?? 0, 1);
  const marks = marksOn(home, couch, show);
  const ranked = (hub?.games ?? []).filter((g) => g.seasonId === show.seasonId && g.rank).map((g) => Number(g.rank!.replace(/^T/, "")));
  const best = ranked.length ? Math.min(...ranked) : null;
  const ep = epOf(show);
  const at = (n: number) => Math.min(96, Math.max(4, (n / total) * 100));
  const byMark = new Map<number, typeof marks>();
  for (const m of marks) byMark.set(m.seen, [...(byMark.get(m.seen) ?? []), m]);
  const when = show.upNext?.live
    ? "On now"
    : show.upNext?.airAt
      ? `${ep} ${show.upNext.number} · ${airTime(Date.parse(show.upNext.airAt))}`
      : show.status === "completed"
        ? `All ${total} out`
        : null;
  return (
    <NavLink
      href={paths.show(show.seasonId)}
      channel
      data-band={show.seasonId}
      className="nd-press relative isolate block h-[126px] overflow-hidden rounded-[4px] bg-card text-white"
    >
      <ShowArt seasonId={`band-${show.seasonId}`} artUrl={show.show.backdropUrl || show.show.artUrl} name={show.show.name} className="absolute inset-0 -z-[2] size-full" bare />
      <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(90deg,rgba(16,14,21,.94)_0%,rgba(16,14,21,.8)_55%,rgba(16,14,21,.45)_100%)]" />
      <span className="flex items-start gap-2 px-3 pt-2.5">
        <span className="min-w-0 flex-1">
          <b className="type-caption block truncate text-[22px] leading-none">{nameOf(show)}</b>
          {when && <span className={`mt-1 block text-[13px] font-semibold ${show.upNext?.live ? "text-live" : "text-white/75"}`}>{when}</span>}
        </span>
        {/* One the first-time tour's practice added (tour/practice-shows.ts): here for the tour, not saved. */}
        {show.seasonId.startsWith("tour-") && (
          <span data-practice-tag className="type-caption flex-none bg-quiet-tag py-1 pl-2 pr-3 text-[13px] text-quiet-tag-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            Practice
          </span>
        )}
        {best != null && (
          <span className="type-caption flex-none bg-plate py-1 pl-2 pr-3 text-[13px] text-plate-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
            Best {ordinal(best)}
          </span>
        )}
        {show.games.length > 0 && <GamesMark due={due} className="relative -mr-1 -mt-0.5 flex-none" />}
      </span>
      {/* The season as a ruler: the aired run solid, the next airing dashed, each face at the last episode they've seen with that
          episode's number under it (the user, 2026-11-15: "a little fidelity into what episode other people are on"). Someone away
          (behind, and not on since the latest aired: the home read's `away`) is faded, with a dotted trail from their mark to the
          latest episode: somewhere in there, maybe up to date. */}
      <span
        className="absolute inset-x-3 bottom-2 block h-[52px]"
        role="img"
        aria-label={marks
          .map((m) => `${m.you ? "You" : m.name} on ${ep} ${m.seen}${m.away ? ", not on since the latest aired" : ""}`)
          .join("; ")}
      >
        <span className="absolute inset-x-0 bottom-[14px] h-[3px] rounded-full bg-white/20" />
        <span className="absolute left-0 bottom-[14px] h-[3px] rounded-full bg-white/80" style={{ width: `${(show.latestAired / total) * 100}%` }} />
        {show.upNext && !show.upNext.live && (
          <i className="absolute bottom-[10px] h-[11px] border-l-2 border-dashed border-white" style={{ left: `${(show.upNext.number / total) * 100}%` }} />
        )}
        {marks
          .filter((m) => m.away && show.latestAired > m.seen)
          .map((m) => (
            <i
              key={`trail-${m.userId}`}
              data-away-trail={m.name}
              className="absolute bottom-[19px] h-0 border-t-2 border-dotted border-white/55"
              style={{ left: `${at(m.seen)}%`, width: `${Math.max(0, at(show.latestAired) - at(m.seen))}%` }}
            />
          ))}
        {/* The ends' numbers, unless a mark's number stands there. */}
        {![...byMark.keys()].some((n) => at(n) < 9) && <small className="type-num absolute bottom-0 left-0 text-[12px] leading-none text-white/55">1</small>}
        {![...byMark.keys()].some((n) => at(n) > 91) && <small className="type-num absolute bottom-0 right-0 text-[12px] leading-none text-white/55">{total}</small>}
        {[...byMark.entries()].map(([seen, people]) => {
          const shown = [...people.filter((p) => p.you), ...people.filter((p) => !p.you)].slice(0, 2);
          const more = people.length - shown.length;
          const caught = seen >= show.latestAired;
          return (
            <span key={seen} className="contents">
              <span className="absolute bottom-[19px] flex -translate-x-1/2 items-end" style={{ left: `${at(seen)}%` }}>
                {shown.map((p, i) => (
                  <span
                    key={p.userId}
                    data-band-face={p.you ? "you" : p.name}
                    data-away={p.away || undefined}
                    className={`rounded-[3px] shadow-[0_2px_6px_rgba(0,0,0,.5)] ${p.you ? "outline-2 outline-offset-1 outline-white" : ""} ${p.away ? "opacity-55 [filter:saturate(.4)]" : ""} ${i ? "-ml-1.5" : ""}`}
                  >
                    <Avatar id={p.userId} name={p.name} size={24} />
                  </span>
                ))}
                {more > 0 && <span className="type-num -ml-1 grid size-6 place-items-center rounded-[3px] bg-[rgba(16,14,21,.85)] text-[11px] font-bold">+{more}</span>}
              </span>
              <small
                aria-hidden
                className={`type-num absolute bottom-0 -translate-x-1/2 text-[12px] leading-none ${caught ? "text-white" : "text-white/70"}`}
                style={{ left: `${at(seen)}%` }}
              >
                {seen}
              </small>
            </span>
          );
        })}
      </span>
    </NavLink>
  );
}
