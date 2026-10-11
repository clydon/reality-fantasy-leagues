"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Lock, Plus } from "lucide-react";
import type { Castaway, Episode, LeagueState, Player } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api } from "@/lib/api";
import { sortByTribe } from "@/lib/game/sort-by-tribe";
import { castawayEpisodeStats } from "@/lib/game/active-roster-rows";
import { latestScoredEpisode } from "@/lib/game/episode-team-summary";
import { lineupStatus, lockLine, signed, topStarters } from "@/lib/game/lineup-view";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { CastTile, SectionHead, shortNames } from "@/components/draft/draft-ui";
import { RevealFirst, useHiddenResults } from "@/components/results-in-banner";
import { cn } from "cn";

// Active Roster's Lineup page (the canvas's "A · Active Roster": AR-Lineup and AR-Starters). Two
// views of this week's episode (StateLogic.currentEpisode):
//   Mine     -- your starters as tiles (tap one to bench it) and your bench as rows with Start. Each
//               change saves as it's made; there's no Save step.
//   Everyone -- every player's starters, set or not, then last week's best starters.
// Lineups lock when the episode starts airing (ActiveRosterLogic.isLineupLocked). Self-service only:
// this sets YOUR lineup; nobody sets one for someone else here.
export function LineupPage() {
  const state = useLeagueStore((s) => s.state);
  const myPlayerId = useMyPlayerId();
  const { blocksChoices } = useHiddenResults();
  const hasRoster = !!myPlayerId && state.castaways.some((c) => c.ownerIds.includes(myPlayerId));
  const [view, setView] = useState<"mine" | "everyone">(hasRoster ? "mine" : "everyone");
  const shownView = hasRoster ? view : "everyone";
  const ep = StateLogic.currentEpisode(state);

  if (!StateLogic.getLeagueType(state).hasActiveRoster) {
    return (
      <p className="text-base text-muted-foreground">
        This league doesn&rsquo;t use lineups.{" "}
        <Link href="/" className="font-semibold text-chyron-line">
          Go to Overview
        </Link>
      </p>
    );
  }

  const locked = !ep || StateLogic.ActiveRosterLogic.isLineupLocked(state, ep.id);
  const players = state.players.filter((p) => p.active !== false);
  const setCount = ep ? players.filter((p) => lineupStatus(state, ep, p.id).set).length : 0;
  const when = ep ? lockLine(ep) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex min-h-11 items-center gap-3 max-nav:-mb-2 max-nav:min-h-0">
        <h2 className="type-caption flex-1 text-[28px] max-nav:hidden">Lineup</h2>
        {ep && <span className="text-sm text-muted-foreground max-nav:hidden">Episode {ep.number}</span>}
      </div>

      {hasRoster && (
        <div role="tablist" aria-label="Whose lineup" className="flex rounded-[3px] bg-card p-[3px]">
          {(
            [
              ["mine", "Mine"],
              ["everyone", "Everyone"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={shownView === v}
              className={cn(
                "min-h-10 flex-1 rounded-[2px] text-sm font-semibold",
                shownView === v ? "bg-foreground font-bold text-background" : "text-foreground hover:bg-muted"
              )}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {blocksChoices ? (
        <RevealFirst what={shownView === "mine" ? "set your next lineup" : "see this week's lineups"} />
      ) : !ep ? (
        <p className="text-base text-muted-foreground">There&rsquo;s no episode to set a lineup for yet.</p>
      ) : (
        <>
          <p className="-mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            {locked ? <Lock className="size-[18px] shrink-0" aria-hidden /> : <Clock className="size-[18px] shrink-0" aria-hidden />}
            <span>
              {locked
                ? `Episode ${ep.number} has started. Lineups are locked.`
                : shownView === "everyone"
                  ? `${when ? when.split(" · ")[0] + " · " : ""}${setCount} of ${players.length} set`
                  : (when ?? `Locks when Episode ${ep.number} starts`)}
            </span>
          </p>
          {shownView === "mine" ? (
            <MyLineup state={state} ep={ep} playerId={myPlayerId!} locked={locked} />
          ) : (
            <EveryonesLineups state={state} ep={ep} players={players} myPlayerId={myPlayerId} locked={locked} />
          )}
        </>
      )}
    </div>
  );
}

// ---- Mine ----

function MyLineup({ state, ep, playerId, locked }: { state: LeagueState; ep: Episode; playerId: string; locked: boolean }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mutate = useMutate();
  const { starters, need, activeSlots } = lineupStatus(state, ep, playerId);
  const lineup = starters.map((c) => c.id);
  const roster = state.castaways.filter((c) => c.ownerIds.includes(playerId));
  const bench = [
    ...sortByTribe(roster.filter((c) => !lineup.includes(c.id) && c.status !== "eliminated"), state),
    ...roster.filter((c) => !lineup.includes(c.id) && c.status === "eliminated"),
  ];
  const names = shortNames(roster);
  const full = lineup.length >= activeSlots;
  const missing = Math.max(0, need - lineup.length);
  // What each did in the last scored episode, and whether it counted -- the reason to start them.
  const lastEp = latestScoredEpisode(state);
  const lastLineup = lastEp ? StateLogic.activeRosterLineupFor(state, lastEp.id, playerId) : [];

  // "Saved" for a moment after each change lands.
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  async function save(next: string[]) {
    if (locked) return;
    const ok = await mutate(
      (s) => StateLogic.setActiveRosterLineup(s, ep.id, playerId, next),
      () => api.setActiveRosterLineup(leagueId!, ep.id, playerId, next)
    );
    if (!ok) return;
    setSaved(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setSaved(false), 1500);
  }

  const lastLine = (c: Castaway) => {
    if (!lastEp) return null;
    const pts = castawayEpisodeStats(state, lastEp.id, c.id).total;
    return `Ep ${lastEp.number}: ${signed(pts)}${lastLineup.includes(c.id) ? "" : " on the bench"}`;
  };

  return (
    <>
      <section className="flex flex-col gap-2" data-tour="lineup-starting">
        <SectionHead
          aside={
            <span className="pb-1.5 text-[13px] text-muted-foreground">
              {lineup.length} of {activeSlots}
              {!locked && lineup.length > 0 && " · tap to bench"}
            </span>
          }
        >
          Starting
        </SectionHead>
        {/* Locked with nobody in it: say so, rather than dashed boxes that look like you could still
            fill them. */}
        {locked && starters.length === 0 ? (
          <p className="border-y border-border py-3 text-base text-muted-foreground">No starters for Episode {ep.number}</p>
        ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {Array.from({ length: Math.max(activeSlots, lineup.length) }, (_, i) => {
            const c = starters[i];
            return c ? (
              <CastTile
                key={c.id}
                castaway={c}
                label={names.get(c.id) ?? c.name}
                state={state}
                photoHeight={112}
                onClick={locked ? undefined : () => save(lineup.filter((id) => id !== c.id))}
              />
            ) : locked ? (
              <div key={`open-${i}`} className="min-h-[152px] rounded-[3px] border-2 border-dashed border-border" aria-label="Empty slot" />
            ) : (
              <div
                key={`open-${i}`}
                className="flex min-h-[152px] flex-col items-center justify-center gap-1.5 rounded-[3px] border-2 border-dashed border-plate-muted text-[13px] text-muted-foreground"
              >
                <Plus className="size-[22px]" aria-hidden />
                Open slot
              </div>
            );
          })}
        </div>
        )}
      </section>

      <section className="flex flex-col" data-tour="lineup-bench">
        <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">Benched points don&rsquo;t count</span>}>Bench</SectionHead>
        {bench.length === 0 ? (
          <p className="border-t border-border py-3 text-sm text-muted-foreground">Everyone on your roster is starting.</p>
        ) : (
          <div className="flex flex-col border-b border-border">
            {bench.map((c) => {
              const out = c.status === "eliminated";
              const tribe = c.tribeId ? state.tribes.find((t) => t.id === c.tribeId) : null;
              const detail = out ? "Out of the game" : [tribe?.name, lastLine(c)].filter(Boolean).join(" · ");
              return (
                <div key={c.id} className={cn("flex min-h-[62px] items-center gap-3 border-t border-border py-2", out && "opacity-55")}>
                  <CastawayAvatar
                    castaway={c}
                    className="flex size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-xs font-bold text-muted-foreground [&_img]:object-top"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-semibold">{c.name}</span>
                    {detail && <span className="truncate text-[13px] text-muted-foreground">{detail}</span>}
                  </span>
                  {!out && !locked && (
                    <button
                      type="button"
                      disabled={full}
                      onClick={() => save([...lineup, c.id])}
                      aria-label={full ? undefined : `Start ${c.name}`}
                      className={cn(
                        "min-h-11 shrink-0 rounded-[3px] px-4 text-sm font-bold",
                        full ? "border border-border text-muted-foreground" : "bg-chyron text-chyron-foreground hover:brightness-105"
                      )}
                    >
                      {full ? "Full" : "Start"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!locked && (
        <p role="status" className="-mt-2 flex items-center gap-2 text-sm">
          {missing === 0 ? (
            <>
              <Check className="size-[18px] shrink-0 text-good" strokeWidth={2.6} aria-hidden />
              <span>{saved ? "Saved." : "Lineup set."} Changes save as you go.</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              {saved && <span className="font-semibold text-good">Saved. </span>}
              Start {missing} more before it locks, or {missing === 1 ? "that slot scores" : "those slots score"} nothing.
            </span>
          )}
        </p>
      )}

      <Link href="/setup/rules" className="self-start text-sm font-semibold text-chyron-line hover:underline">
        What each event scores
      </Link>
    </>
  );
}

// ---- Everyone ----

function EveryonesLineups({
  state,
  ep,
  players,
  myPlayerId,
  locked,
}: {
  state: LeagueState;
  ep: Episode;
  players: Player[];
  myPlayerId: string | null;
  locked: boolean;
}) {
  // A courtesy the commissioner can switch on (settings.hideStartersUntilLock): while the episode is
  // open, other players' rows say only whether they're set. Not a secret -- every lineup is in the
  // league state the client already holds.
  const hideOthers = !locked && !!state.settings.hideStartersUntilLock;
  const ordered = [...players.filter((p) => p.id === myPlayerId), ...players.filter((p) => p.id !== myPlayerId)];
  const scored = StateLogic.ActiveRosterLogic.episodeEvents(state, ep).length > 0;
  const top = topStarters(state);

  return (
    <>
      <div className="flex flex-col border-b border-border">
        {ordered.map((p) => (
          <EveryoneRow
            key={p.id}
            state={state}
            ep={ep}
            player={p}
            me={p.id === myPlayerId}
            hidden={hideOthers && p.id !== myPlayerId}
            scored={scored}
          />
        ))}
      </div>
      {hideOthers && <p className="-mt-2 text-[13px] text-muted-foreground">Everyone else&rsquo;s starters show once it airs.</p>}

      {top.ep && top.rows.length > 0 && (
        <section className="flex flex-col gap-1">
          <SectionHead aside={<span className="pb-1.5 text-[13px] text-muted-foreground">Episode {top.ep.number}</span>}>Top starters</SectionHead>
          {top.rows.map(({ castaway: c, players: by, stats }) => (
            <div key={c.id} className="flex min-h-[52px] items-center gap-3">
              <CastawayAvatar
                castaway={c}
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[2px] bg-muted text-xs font-bold text-muted-foreground [&_img]:object-top"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{c.name}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {startedByLine(by, myPlayerId)} · {stats.byType.map((t) => t.label.toLowerCase()).join(", ")}
                </span>
              </span>
              <span className="type-num shrink-0 text-[24px] text-good">{signed(stats.total)}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

/** "Your starter", "Josie's starter", "Started by you and Josie", "Started by 3 players". */
function startedByLine(by: Player[], myPlayerId: string | null) {
  if (by.length === 1) return by[0].id === myPlayerId ? "Your starter" : `${by[0].name}'s starter`;
  if (by.length > 2) return `Started by ${by.length} players`;
  const names = [...by.filter((p) => p.id === myPlayerId), ...by.filter((p) => p.id !== myPlayerId)].map((p) => (p.id === myPlayerId ? "you" : p.name));
  return `Started by ${names.join(" and ")}`;
}

function EveryoneRow({
  state,
  ep,
  player,
  me,
  hidden,
  scored,
}: {
  state: LeagueState;
  ep: Episode;
  player: Player;
  me: boolean;
  hidden: boolean;
  scored: boolean;
}) {
  const { starters, empty, set } = lineupStatus(state, ep, player.id);
  const total = scored
    ? StateLogic.roundPoints(starters.reduce((sum, c) => sum + castawayEpisodeStats(state, ep.id, c.id).total, 0))
    : null;
  const square = "size-11 shrink-0 rounded-[2px]";
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-t border-border py-2">
      <span className="flex w-[104px] shrink-0 flex-col items-start gap-1.5">
        <span className="flex max-w-full items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: player.color }} aria-hidden />
          <span className="truncate text-base font-semibold">{me ? "You" : player.name}</span>
        </span>
        {total !== null ? (
          <span className="type-num text-[20px]">{signed(total)}</span>
        ) : (
          <span
            className={cn(
              "rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide",
              set ? "bg-good text-good-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {set ? "Set" : starters.length > 0 ? `${starters.length} of ${starters.length + empty}` : "Not set"}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {starters.length === 0 && empty > 0 && !hidden ? (
          <span className="text-[13px] text-muted-foreground">Nothing set yet.</span>
        ) : (
          <>
            {starters.map((c) =>
              hidden ? (
                <span
                  key={c.id}
                  className={cn(square, "flex items-center justify-center bg-muted font-bold text-muted-foreground")}
                  title="Hidden until the episode airs"
                >
                  ?
                </span>
              ) : (
                <CastawayAvatar
                  key={c.id}
                  castaway={c}
                  expandable
                  className={cn(square, "flex items-center justify-center overflow-hidden bg-muted text-[11px] font-bold text-muted-foreground [&_img]:object-top")}
                />
              )
            )}
            {Array.from({ length: empty }, (_, i) => (
              <span key={i} className={cn(square, "border-2 border-dashed border-border")} aria-label="Open slot" />
            ))}
          </>
        )}
      </span>
    </div>
  );
}
