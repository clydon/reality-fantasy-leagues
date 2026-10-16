"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Sparkles } from "lucide-react";
import type { ShowSeason } from "@/lib/game/types";
import { api } from "@/lib/api";
import { useShowPaidAi } from "@/lib/paid-ai-store";
import { airLine, autoResearchNote, episodeRows, scheduleLine } from "@/lib/admin-season";
import { useNowMinute } from "@/components/episodes/episode-status";
import { ActButton, Notice, Row, Rows, Section, count, errorText } from "./admin-ui";
import { modelLabel } from "./admin-results";
import { SeasonFrame } from "./season-frame";
import { cn } from "cn";

// A season's Episodes tab (docs/PLAN-ux-redesign.md 3b): how the season airs and whether research runs
// on its own, as one-line summaries; then one row per
// episode with its date, one status and one action. Everything else about an episode -- research,
// pasting, clearing it -- is on that episode's own page, and reviewing its results on the review page.

export function SeasonEpisodes({ seasonId }: { seasonId: string }) {
  return <SeasonFrame seasonId={seasonId}>{({ season, refetch }) => <EpisodesTab season={season} refetch={refetch} />}</SeasonFrame>;
}

function EpisodesTab({ season, refetch }: { season: ShowSeason; refetch: () => unknown }) {
  const { data } = useQuery({ queryKey: ["season-decisions", season.id], queryFn: () => api.adminListDecisions(season.id) });
  const nowMs = useNowMinute();
  const showPaid = useShowPaidAi();
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingAuto, setSavingAuto] = useState(false);

  const curator = season.resultsBy === "leagues";
  const approved = !!season.castApprovedAt;
  // A league-decided season's results are a curator view (docs/PLAN-universal-season-cast.md, piece
  // 5): nothing is pushed, so they don't wait on an approved cast. An admin-decided one does: results
  // are matched to people by name, and before approval there are no names in any league to match.
  const open = approved || curator;
  const base = `/admin/seasons/${season.id}`;

  // Auto-research spends on a schedule, not a click, so hiding paid actions can't just hide it: one
  // that's already on keeps charging. With paid actions hidden it can only be switched off here.
  async function switchOffAuto() {
    setSavingAuto(true);
    try {
      await api.adminUpdateSeason(season.id, { autoResearch: false });
      await refetch();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSavingAuto(false);
    }
  }

  const completed = season.status === "completed";
  const needsCount = completed && !season.episodeCount;
  const needsSchedule = !completed && !season.premiereDate && !Object.keys(season.wikiAirDates || {}).length;
  const now = nowMs === null ? null : new Date(nowMs);
  const rows = now && data ? episodeRows(season, data.decisions, now) : [];
  // A finished season's 13 episodes are history: the latest three, then "Show all".
  const shown = completed && !showAll ? rows.slice(0, 3) : rows;
  const firstPending = rows.find((r) => r.pending > 0)?.n;

  return (
    <>
      {!open && (
        <Notice tone="quiet">
          Approve the cast first: results are matched to it by name.{" "}
          <Link href={`${base}/cast`} className="font-semibold text-foreground underline underline-offset-2">
            Go to Cast
          </Link>
        </Notice>
      )}

      <Rows>
        <Row
          icon={CalendarClock}
          title="Schedule"
          detail={
            <>
              {scheduleLine(season)}
              {(needsCount || needsSchedule) && (
                <span className="block font-semibold text-foreground">
                  {needsCount ? "Set the episode count: until then only episodes with data are listed." : "Set the premiere date so the list knows what's aired."}
                </span>
              )}
            </>
          }
          trailing={<ActButton href={`${base}/setup`}>Edit</ActButton>}
        />
        <Row
          icon={Sparkles}
          title="Auto research"
          detail={
            season.autoResearch
              ? `On · ${season.researchDelayHours ?? 12} h after each episode airs · ${modelLabel(season.researchModel)}${showPaid ? "" : " · runs even with paid actions hidden"}`
              : showPaid
                ? "Off · research only when you ask"
                : "Off · turn on paid AI in Site to use it"
          }
          trailing={
            showPaid ? (
              <ActButton href={`${base}/setup`}>Edit</ActButton>
            ) : season.autoResearch ? (
              <ActButton disabled={savingAuto} onClick={switchOffAuto}>
                Switch off
              </ActButton>
            ) : undefined
          }
        />
      </Rows>

      {error && <Notice tone="bad">{error}</Notice>}

      {open && (
        <Section title="Episodes" aside={rows.length > 0 && <span className="pb-1 text-sm text-muted-foreground">{count(rows.length, "episode")}</span>}>
          {!data || !now ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground">No episodes yet. Set the schedule so the list knows when they air.</p>
          ) : (
            <Rows>
              {shown.map((row) => {
                const accepted = row.decisions.filter((d) => d.status === "accepted").length;
                const auto = autoResearchNote(season, row, now);
                const status = !row.aired
                  ? null
                  : row.pending > 0
                    ? `${row.pending} to review`
                    : row.decisions.length > 0
                      ? `${accepted} of ${row.decisions.length} accepted`
                      : row.researched
                        ? "Researched, nothing new"
                        : "No results yet";
                return (
                  <Row
                    key={row.n}
                    href={`${base}/episodes/${row.n}`}
                    dim={!row.aired}
                    lead={<span className="type-num w-9 shrink-0 text-center text-[26px] text-muted-foreground">{row.n}</span>}
                    title={`Episode ${row.n}`}
                    detail={
                      <>
                        {airLine(row, season)}
                        {status && ` · ${status}`}
                        {auto && <span className={cn("block", auto.bad && "font-semibold text-destructive")}>{auto.text}</span>}
                      </>
                    }
                    trailing={
                      row.pending > 0 ? (
                        <ActButton tone={row.n === firstPending ? "chyron" : "plain"} href={`${base}/episodes/${row.n}/review`}>
                          Review
                        </ActButton>
                      ) : undefined
                    }
                  />
                );
              })}
            </Rows>
          )}
          {completed && rows.length > 3 && (
            <button type="button" className="min-h-11 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show the latest three" : `Show all ${rows.length}`}
            </button>
          )}
          {data && (
            <p className="text-[13px] leading-snug text-muted-foreground">
              {curator
                ? "Each league decides this season's results: its commissioner applies them. Checking a result here changes what every commissioner sees, never a league."
                : `Accepted results go to all ${count(data.leagueCount, "league")} on this season (a league catching up gets them when it reveals the episode). Any decision can be changed later.`}
            </p>
          )}
        </Section>
      )}
    </>
  );
}
