"use client";

// The hub's scores strip (docs/PLAN-sports-couch.md A1; the shape: docs/design-round/hub-scorebug-shape.md, idea round 3): your
// games, live and coming up, right under the guide bar and at its exact height (88 px), never taller. Its form is the guide bar's
// own: a slanted lead tile ("Scores", the live count and the total) and a row of broadcast scorebugs that scroll-snap behind its
// slant, the next one peeking under a fade, swiped by hand (nothing moves by itself: the user, 2026-11-15). It replaces the
// Scoreboard that sat inside Your shows and the sports cards in On TV's reel, so a game is on the hub once.
//
// Which games and their order are strip.ts's (yours only: your teams' and the games you play). Nothing here tells a game to
// someone it's hidden from (Sports scores too, or watching it as if live: hide.ts's rule, the user's 2026-11-09 call): a hidden
// game that has begun says "Started" and its time, never live or final, a clock, a score or a record; a tap asks first.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  useCouchTeams,
  useMySportsGames,
  useSportsRecordings,
  useSportsWeek,
  useYourTeams,
  type Couch,
  type Home,
  type WeekGame,
} from "../data";
import { Sheet } from "../ui/sheet";
import { AskSheet, Scorebug, type Bug, type Fan } from "../sports/scorebug";
import { seenBefore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { needsLaterWeek, stripGames } from "@/lib/sports/strip";

const localDay = (at: string | number) => new Date(at).toLocaleDateString("en-CA");
const plusDays = (now: number, n: number) => localDay(now + n * 86_400_000);

/** The strip's games: yours (your teams' and the games you play), from the couch's teams or, solo, your own follows. */
function useStripGames(home: Home, couch: Couch | null) {
  const now = useNow();
  const couchTeams = useCouchTeams(couch?.id ?? null).data?.teams;
  const ownTeams = useYourTeams(!couch).data?.teams;
  const me = { id: home.user.id, name: home.user.name };
  const teams = useMemo(
    () => (couch ? (couchTeams ?? []) : (ownTeams ?? []).map((t) => ({ ...t, followers: [me], you: true, plays: false }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [couch, couchTeams, ownTeams, me.id]
  );
  const mine = useMySportsGames(true).data?.games;
  const yours = useMemo(() => new Set(teams.filter((t) => t.you).map((t) => `${t.league}|${t.id}`)), [teams]);
  const leagues = [...new Set([...teams.filter((t) => t.you).map((t) => t.league), ...(mine ?? []).map((g) => g.league)])];
  const any = yours.size > 0 || (mine?.length ?? 0) > 0;
  // From yesterday: a game that finished last night is still just finished.
  const first = useSportsWeek(plusDays(now, -1), leagues, any).data;
  const firstGames = useMemo(() => (first?.days ?? []).flatMap((d) => d.games), [first]);
  // A team of yours with nothing left this week (a bye): the week after, for its next game.
  const later = useSportsWeek(plusDays(now, 6), leagues, any && !!first && needsLaterWeek(firstGames, yours, now)).data;
  const recordings = useSportsRecordings(any).data?.recordings;
  const hide = useHideSports();
  const shownNow = useShownScores();
  const games = [...firstGames, ...(later?.days ?? []).flatMap((d) => d.games)];
  const played = new Map((mine ?? []).map((m) => [m.event, m]));
  const recorded = new Set((recordings ?? []).map((r) => r.game));
  const listed = stripGames({
    games,
    yours,
    played,
    hidden: (g) => recorded.has(g.id) || (hide && !shownNow.has(g.id)),
    seen: seenBefore,
    now,
    dayOf: localDay,
  });
  const byKey = new Map(teams.map((t) => [`${t.league}|${t.id}`, t]));
  const fansOf = (g: WeekGame, i: number): Fan[] => {
    const f = byKey.get(`${g.league}|${g.sides[i].id}`)?.followers ?? [];
    return [...f.filter((x) => x.id === me.id), ...f.filter((x) => x.id !== me.id)];
  };
  const bugs: Bug[] = listed.map(({ g, bucket }) => {
    const p = played.get(g.id) ?? null;
    const due = !!p && home.moves.some((m) => m.leagueId === p.leagueId && (m.episode == null || m.episode === p.episode));
    return { g, bucket, fans: [fansOf(g, 0), fansOf(g, 1)], played: p, due };
  });
  return { bugs, now, meId: me.id };
}

export function ScoresStrip({ home, couch }: { home: Home; couch: Couch | null }) {
  const { bugs, now, meId } = useStripGames(home, couch);
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const [all, setAll] = useState(false);
  if (!bugs.length) return null;
  const live = bugs.filter((b) => b.bucket === "live").length;
  const total = `${bugs.length} ${bugs.length === 1 ? "game" : "games"}`;
  const due = bugs.filter((b) => b.due).length;
  return (
    <section data-scores-strip={bugs.length} data-live={live || undefined} aria-label="Scores" className="mx-4 mt-2 flex h-[88px] items-stretch overflow-hidden rounded-[4px] bg-card">
      {/* The lead tile, the guide bar's own: its count is the "there's more" (the user's ask), its chevron the way to every game, and
          a move due anywhere on the strip shows here too (the check: what's yours was off screen behind the first bugs). Live's
          words in the foreground, its dot red (red text this small misses 4.5:1). Its ring is inset: the slant clips an outline. */}
      <button
        type="button"
        data-scores-open
        onClick={() => setAll(true)}
        aria-label={`Scores: ${total}${live ? `, ${live} live` : ""}${due ? `, ${due} ${due === 1 ? "move" : "moves"} due` : ""}. Open them all`}
        className="nd-press relative z-[1] flex w-[88px] flex-none flex-col justify-center gap-1 bg-secondary pl-3 pr-4 text-left [clip-path:polygon(0_0,100%_0,calc(100%_-_10px)_100%,0_100%)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--foreground)]"
      >
        <span className="type-caption flex items-center text-[21px] leading-none">
          Scores
          <ChevronRight className="size-4 flex-none" strokeWidth={2.6} aria-hidden />
        </span>
        <span className="flex flex-col whitespace-nowrap text-[13px] font-semibold leading-[1.2] text-muted-foreground">
          {live > 0 && (
            <span data-scores-live className="flex items-center gap-1 font-bold text-foreground">
              <i className="size-[7px] flex-none animate-pulse rounded-full bg-live motion-reduce:animate-none" aria-hidden />
              {live} live
            </span>
          )}
          {due > 0 && (
            <span data-scores-due className="flex items-center gap-1 text-foreground">
              <i className="size-[7px] flex-none rounded-full bg-chyron-line" aria-hidden />
              {due} due
            </span>
          )}
          <span>{total}</span>
        </span>
      </button>
      {/* A spacer at the end lets the last bug snap flush to the slant too, so no fragment of the one before sits behind the fade. */}
      <div
        data-scores-reel
        className="-ml-2 flex min-w-0 flex-1 snap-x snap-mandatory scroll-pl-3.5 items-center gap-2 overflow-x-auto py-1 pl-3.5 [scrollbar-width:none] [mask-image:linear-gradient(90deg,transparent,#000_14px,#000_calc(100%_-_36px),transparent)]"
      >
        {bugs.map((b) => (
          <Scorebug key={b.g.id} bug={b} meId={meId} now={now} onAsk={() => setAsking(b.g)} />
        ))}
        {/* The reel's width less a bug and the gap: room for the last bug to snap to the start. */}
        {bugs.length > 1 && <span aria-hidden className="h-px w-[calc(100%_-_216px)] flex-none" />}
      </div>
      <AllScores open={all} onOpenChange={setAll} bugs={bugs} meId={meId} now={now} onAsk={(g) => (setAll(false), setAsking(g))} total={total} live={live} />
      <AskSheet g={asking} onClose={() => setAsking(null)} />
    </section>
  );
}

/** Every game of the strip's, by league: the tile's tap. */
function AllScores({ open, onOpenChange, bugs, meId, now, onAsk, total, live }: { open: boolean; onOpenChange: (o: boolean) => void; bugs: Bug[]; meId: string; now: number; onAsk: (g: WeekGame) => void; total: string; live: number }) {
  const leagues = [...new Set(bugs.map((b) => b.g.leagueName))];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Scores" subtitle={live ? `${live} live · ${total}` : total}>
      <div data-scores-all className="flex flex-col gap-5 pb-2">
        {leagues.map((l) => (
          <section key={l}>
            <h3 className="type-caption mb-2 text-[17px] text-muted-foreground">{l}</h3>
            <div className="flex flex-col gap-2">
              {bugs
                .filter((b) => b.g.leagueName === l)
                .map((b) => (
                  <Scorebug key={b.g.id} bug={b} meId={meId} now={now} onAsk={() => onAsk(b.g)} wide onOpened={() => onOpenChange(false)} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
