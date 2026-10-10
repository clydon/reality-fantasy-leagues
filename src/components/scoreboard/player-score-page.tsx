"use client";

import type { Castaway, LeagueState, ScoreRow } from "@/lib/game/types";
import { useLeagueStore, useMyPlayerId } from "@/lib/store";
import StateLogic from "@/lib/game/state-logic.js";
import { playerBetRows } from "@/lib/game/bet-rows";
import { playerPickRows } from "@/lib/game/pickem-rows";
import { latestScoredEpisode, weekInRace } from "@/lib/game/episode-team-summary";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { SettingsPage, Chip } from "@/components/setup/settings-ui";
import { cn } from "cn";
import { EpisodeRows, RosterBreakdown, ScoreboardLegend, WeekTrend } from "./active-roster-detail";
import { classicKey, finishedPlace, ordinal, poolKey, rankLabels } from "./scoreboard-tab";

// One player's Scoreboard page (docs/PLAN-ux-redesign.md, 2f), opened from their row in the list:
// their place and total up top, then the detail behind it in the shape of the league type's scoring --
// a Classic team with where each one finished, Active Roster's episodes and roster, or an Eliminator
// Pool's picks -- then their predictions. Read from the viewer's trimmed state like the list, so
// nothing here gets ahead of their reveal.
export function PlayerScorePage({ playerId }: { playerId: string }) {
  const state = useLeagueStore((s) => s.state);
  const scores = StateLogic.computeScores(state);
  const i = scores.findIndex((r) => r.playerId === playerId);
  if (i < 0) {
    return (
      <SettingsPage title="Scoreboard" back={{ href: "/scoreboard", label: "Scoreboard" }}>
        <p className="text-base text-muted-foreground">That player isn&rsquo;t in this league.</p>
      </SettingsPage>
    );
  }
  return <PlayerView key={playerId} state={state} scores={scores} i={i} />;
}

function PlayerView({ state, scores, i }: { state: LeagueState; scores: ScoreRow[]; i: number }) {
  const me = useMyPlayerId();
  const r = scores[i];
  const type = StateLogic.getLeagueType(state);
  const pool = type.hasWeeklyPicks;
  const ar = type.hasActiveRoster && !pool;
  const rank = rankLabels(scores, pool ? poolKey : classicKey)[i];
  const place = `${rank.startsWith("T") ? "Tied " : ""}${ordinal(Number(rank.replace("T", "")))} of ${scores.length}`;
  const latest = ar ? latestScoredEpisode(state) : null;
  const sources = [
    !pool && [ar ? "Lineups" : "Boot order", r.locked],
    state.settings.bonusEnabled && r.bonus !== 0 && ["Predictions", r.bonus],
    r.finale !== 0 && ["Finale", r.finale],
  ].filter((x): x is [string, number] => !!x);

  return (
    <SettingsPage title={r.name} back={{ href: "/scoreboard", label: "Scoreboard" }}>
      {/* Place and total: the one big number on the page. */}
      <div className="flex items-end gap-4">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-base font-semibold">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
            {place}
            {r.playerId === me && (
              <span className="rounded-[2px] bg-foreground px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-background">You</span>
            )}
          </span>
          {sources.length > 1 && (
            <span className="text-[13px] text-muted-foreground">{sources.map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
          )}
        </span>
        <span className="flex flex-col items-end">
          {pool ? (
            <>
              <span className="type-num text-[44px] leading-none">{r.longestStreak ?? 0}</span>
              <span className="text-[13px] text-muted-foreground">
                best streak · now {r.currentStreak ?? 0} · {r.total} {r.total === 1 ? "pt" : "pts"}
              </span>
            </>
          ) : (
            <>
              <span className="type-num text-[44px] leading-none">{r.total}</span>
              {latest ? <WeekTrend race={weekInRace(state, latest.id, r.playerId)} ep={latest.number} /> : <span className="text-[13px] text-muted-foreground">pts</span>}
            </>
          )}
        </span>
      </div>

      {pool ? (
        <Picks state={state} playerId={r.playerId} mine={r.playerId === me} />
      ) : ar ? (
        <>
          <Section title="Episodes">
            <EpisodeRows state={state} playerId={r.playerId} />
          </Section>
          <Section title="Roster">
            <RosterBreakdown state={state} playerId={r.playerId} />
            <ScoreboardLegend />
          </Section>
        </>
      ) : (
        <Team state={state} r={r} />
      )}

      {state.settings.bonusEnabled && <Predictions state={state} playerId={r.playerId} />}
    </SettingsPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="type-caption text-[24px]">{title}</h3>
      {children}
    </section>
  );
}

/** A castaway as a row: photo, name, and where they stand; `lead` goes before the photo (an episode). */
function CastRow({ c, detail, out, lead }: { c: Castaway; detail: React.ReactNode; out?: boolean; lead?: React.ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 border-t border-border py-2">
      {lead}
      <CastawayAvatar
        castaway={c}
        expandable
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-[2px] bg-secondary text-xs font-bold [&_img]:object-top", out && "grayscale brightness-[.6]")}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("truncate text-base font-semibold", out && "text-muted-foreground")}>{c.name}</span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

// ---- Classic: the team, still in first, then who's out in the order they went ----

function Team({ state, r }: { state: LeagueState; r: ScoreRow }) {
  const winner = StateLogic.formatOf(state).winnerExitMethod;
  const epOf = (c: Castaway) => (c.exitEpisodeId ? state.episodes.find((e) => e.id === c.exitEpisodeId)?.number : undefined);
  const inGame = r.roster.filter((c) => c.status !== "eliminated").sort((a, b) => a.name.localeCompare(b.name));
  const out = r.roster.filter((c) => c.status === "eliminated").sort((a, b) => (b.placementOrder ?? 0) - (a.placementOrder ?? 0));
  const tribe = (c: Castaway) => state.tribes.find((t) => t.id === c.tribeId);
  // Someone swapped away and later back is on the team, not gone.
  const former = r.formerRoster.filter((c) => !r.roster.some((x) => x.id === c.id));
  return (
    <>
      <Section title="Team">
        {r.roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team yet.</p>
        ) : (
          <div className="flex flex-col border-b border-border">
            {inGame.map((c) => {
              const t = tribe(c);
              return (
                <CastRow
                  key={c.id}
                  c={c}
                  detail={
                    <>
                      {t && (
                        <span className="rounded-[2px] px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-white" style={{ background: t.color }}>
                          {t.name}
                        </span>
                      )}
                      Still in
                    </>
                  }
                />
              );
            })}
            {out.map((c) => {
              const place = finishedPlace(state, c);
              const ep = epOf(c);
              return (
                <CastRow
                  key={c.id}
                  c={c}
                  out={c.exitMethod !== winner}
                  detail={
                    c.exitMethod === winner ? (
                      <Chip tone="chyron">{winner}</Chip>
                    ) : (
                      <>
                        <Chip tone="live">Out</Chip>
                        {[ep && `Episode ${ep}`, place && `finished ${ordinal(place)}`, c.placementOrder && `+${c.placementOrder}`].filter(Boolean).join(" · ")}
                      </>
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Section>
      {former.length > 0 && (
        <Section title="No longer on the team">
          <div className="flex flex-col border-b border-border">
            {former.map((c) => (
              <CastRow
                key={c.id}
                c={c}
                out
                detail={c.departedVia === "trade" ? "Swapped away" : "Replaced after going out"}
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

// ---- Eliminator Pool: every pick, newest first ----

function Picks({ state, playerId, mine }: { state: LeagueState; playerId: string; mine: boolean }) {
  // Someone else's pick for an episode that hasn't played out stays theirs (pickem-pick-grid.tsx).
  const rows = playerPickRows(state, playerId)
    .filter((p) => mine || p.correct !== null)
    .reverse();
  return (
    <Section title="Picks">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No picks yet.</p>
      ) : (
        <div className="flex flex-col border-b border-border">
          {rows.map((p) => {
            const c = p.castawayId ? StateLogic.getCastaway(state, p.castawayId) : undefined;
            const result =
              p.correct === null ? (
                <Chip>Pending</Chip>
              ) : p.correct ? (
                <span className="rounded-[2px] bg-good px-1.5 py-px text-[11px] font-bold uppercase tracking-wide text-[#0e2b27]">Survived</span>
              ) : c ? (
                <Chip tone="live">Went home</Chip>
              ) : (
                <Chip>No pick</Chip>
              );
            const detail = (
              <>
                {result}
                {p.correct !== null && `streak ${p.streak}`}
              </>
            );
            const ep = <span className="type-num w-12 shrink-0 text-[19px] text-muted-foreground">Ep {p.episode}</span>;
            return c ? (
              <CastRow key={p.episode} c={c} lead={ep} out={p.correct === false} detail={detail} />
            ) : (
              <div key={p.episode} className="flex min-h-[60px] items-center gap-3 border-t border-border">
                {ep}
                <span className="flex flex-1 items-center gap-1.5 text-[13px] text-muted-foreground">{detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

// ---- Predictions, any league type ----

function Predictions({ state, playerId }: { state: LeagueState; playerId: string }) {
  const bets = playerBetRows(state, playerId).reverse();
  return (
    <Section title="Predictions">
      {bets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No predictions made.</p>
      ) : (
        <div className="flex flex-col border-b border-border">
          {bets.map((b, k) => (
            <div key={k} className="flex min-h-12 items-center gap-3 border-t border-border py-2">
              <span className="type-num w-12 shrink-0 text-[19px] text-muted-foreground">Ep {b.episode}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">{b.label}</span>
                <span className="text-[13px] text-muted-foreground">Guessed &ldquo;{b.guess}&rdquo;</span>
              </span>
              <span className={cn("type-num shrink-0 text-[22px]", b.correct !== true && "text-muted-foreground")}>
                {b.correct === true ? `+${b.points}` : b.correct === false ? "✗" : "…"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
