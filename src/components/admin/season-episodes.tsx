"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LeagueDecisionSync, SeasonDecision, ShowSeason } from "@/lib/game/types";
import * as Air from "@/lib/game/air-schedule.js";
import { api, ApiError } from "@/lib/api";
import { AI_MODELS, estimate } from "@/lib/ai-cost";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EpisodeDecisions } from "./season-decisions-review";
import { cn } from "cn";

// A season's episodes as a list -- aired ones with what to do about them, the next upcoming one with
// when it airs -- and the season's auto-research schedule (db/migrations/0020).
//
// Each aired episode offers what it needs: Review results when there's anything staged for it (the
// admin's main job here), Research when it hasn't been researched. An episode that hasn't aired has
// nothing to research, so it has no buttons -- just its air time, and when auto-research will pick it
// up if that's on.
//
// "Aired" comes from the season's air schedule (premiere date + air time, weekly, with the wiki's own
// air dates overriding). Without one, an episode counts as aired once there's data for it, and the
// next one's air date is unknown -- so it keeps a Research button, with a nudge to set the schedule.

type EpisodeRow = {
  n: number;
  airsAt: Date | null;
  aired: boolean;
  researched: boolean;
  decisions: SeasonDecision[];
};

const TIME_ZONES = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
  ["Europe/London", "UK"],
  ["UTC", "UTC"],
];

export function SeasonEpisodes({
  season,
  researching,
  locked,
  onResearch,
  onChanged,
}: {
  season: ShowSeason;
  /** The episode a research call is running for, if any. */
  researching: number | null;
  locked: boolean;
  onResearch: (episode: number, force: boolean) => void;
  onChanged: () => void;
}) {
  const { data, refetch } = useQuery({
    queryKey: ["season-decisions", season.id],
    queryFn: () => api.adminListDecisions(season.id),
  });
  const [open, setOpen] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<{ text: string; problems: string[] } | null>(null);
  const now = new Date();

  const tz = season.airTz || "America/New_York";
  const wikiAirDates: Record<number, string> = {};
  for (const [k, v] of Object.entries(season.wikiAirDates || {})) wikiAirDates[Number(k)] = v;
  const schedule = {
    premiereDate: season.premiereDate,
    airTime: season.airTime,
    airTz: tz,
    researchWeekday: season.researchWeekday,
    researchTime: season.researchTime,
  };
  const hasSchedule = !!season.premiereDate || Object.keys(wikiAirDates).length > 0;

  const researched = new Set(season.researchedEpisodes ?? []);
  const byEpisode = new Map<number, SeasonDecision[]>();
  for (const d of data?.decisions ?? []) {
    const list = byEpisode.get(d.episode_number);
    if (list) list.push(d);
    else byEpisode.set(d.episode_number, [d]);
  }

  // Everything we know about, plus the next one to air.
  let known = Math.max(0, season.wikiEpisodesThrough ?? 0, ...researched, ...byEpisode.keys());
  if (hasSchedule) {
    for (let n = 1; n <= 60; n++) {
      const t = Air.episodeAirTime(schedule, n, wikiAirDates);
      if (!t || t > now) break;
      known = Math.max(known, n);
    }
  }
  const last = season.status === "completed" ? known : known + 1;
  const rows: EpisodeRow[] = [];
  for (let n = last; n >= 1; n--) {
    const airsAt = hasSchedule ? Air.episodeAirTime(schedule, n, wikiAirDates) : null;
    const hasData = researched.has(n) || byEpisode.has(n) || n <= (season.wikiEpisodesThrough ?? 0);
    rows.push({
      n,
      airsAt,
      aired: airsAt ? airsAt <= now : hasData,
      researched: researched.has(n),
      decisions: byEpisode.get(n) ?? [],
    });
  }

  function reportSync(leagues: LeagueDecisionSync[]) {
    const applied = leagues.reduce((n, l) => n + l.applied, 0);
    const undone = leagues.reduce((n, l) => n + l.undone, 0);
    const problems = [
      ...leagues.filter((l) => l.error).map((l) => `${l.leagueName}: ${l.error}`),
      ...leagues.flatMap((l) => l.skipped.map((s) => `${l.leagueName}: ${s.name} — ${s.why}`)),
    ];
    const parts = [applied && `${applied} applied`, undone && `${undone} undone`].filter(Boolean);
    setLastSync({
      text: leagues.length
        ? `${leagues.length} league${leagues.length === 1 ? "" : "s"} updated${parts.length ? ` (${parts.join(", ")})` : ""}.`
        : "No leagues play this season yet — they'll get these results when they pick it.",
      problems,
    });
    refetch();
    onChanged();
  }

  return (
    <div className="ml-6 mt-1.5 flex flex-col gap-1.5">
      <AutoResearchControls season={season} hasSchedule={hasSchedule} onSaved={onChanged} />
      {lastSync && (
        <div className="text-[0.7rem]">
          <span className="text-good">{lastSync.text}</span>
          {lastSync.problems.map((p) => (
            <p key={p} className="text-destructive">
              {p}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {rows.map((row) => (
          <EpisodeLine
            key={row.n}
            row={row}
            season={season}
            schedule={schedule}
            hasSchedule={hasSchedule}
            open={open === row.n}
            onToggle={() => setOpen(open === row.n ? null : row.n)}
            researching={researching === row.n}
            locked={locked}
            onResearch={(force) => onResearch(row.n, force)}
          >
            {open === row.n && data && row.decisions.length > 0 && (
              <EpisodeDecisions
                seasonId={season.id}
                episode={row.n}
                decisions={row.decisions}
                cast={data.cast}
                leagueCount={data.leagueCount}
                onSynced={reportSync}
              />
            )}
          </EpisodeLine>
        ))}
      </div>
      {data && (
        <p className="text-[0.65rem] text-muted-foreground">
          Accepted results go to all {data.leagueCount} league{data.leagueCount === 1 ? "" : "s"} on this season automatically
          (catching-up leagues get them when they reveal the episode). Any decision can be changed later.
        </p>
      )}
    </div>
  );
}

function EpisodeLine({
  row,
  season,
  schedule,
  hasSchedule,
  open,
  onToggle,
  researching,
  locked,
  onResearch,
  children,
}: {
  row: EpisodeRow;
  season: ShowSeason;
  schedule: Parameters<typeof Air.nextResearchSlot>[1];
  hasSchedule: boolean;
  open: boolean;
  onToggle: () => void;
  researching: boolean;
  locked: boolean;
  onResearch: (force: boolean) => void;
  children?: React.ReactNode;
}) {
  const tz = season.airTz || "America/New_York";
  const pending = row.decisions.filter((d) => d.status === "pending").length;
  const model = season.researchModel || AI_MODELS[0].id;

  // When auto-research will pick this episode up -- only for one it hasn't researched yet, and only
  // for slots after auto-research was switched on (older episodes are the manual button's).
  let autoNote: { text: string; bad?: boolean } | null = null;
  if (season.autoResearch && !row.researched && row.airsAt) {
    const slot = Air.nextResearchSlot(row.airsAt, schedule);
    const since = season.autoResearchSince ? new Date(season.autoResearchSince) : new Date();
    const attempt = season.lastAutoAttempts?.[String(row.n)];
    if (slot && slot >= since) {
      if (attempt && !attempt.ok) autoNote = { text: `Auto-research failed: ${attempt.message ?? "unknown error"}`, bad: true };
      else if (slot > new Date()) autoNote = { text: `Auto-research ${Air.formatInTz(slot, tz)}` };
      else autoNote = { text: "Auto-research due — runs within the hour" };
    }
  }

  return (
    <div className={cn("px-2 py-1.5", !row.aired && "bg-secondary/30")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-12 shrink-0 font-bold">Ep {row.n}</span>
        <span className="text-muted-foreground">
          {row.airsAt
            ? `${row.aired ? "Aired" : "Airs"} ${Air.formatInTz(row.airsAt, tz)}`
            : row.aired
              ? "Aired"
              : hasSchedule
                ? "Upcoming"
                : "Air date unknown"}
        </span>
        {row.researched && (
          <span className="rounded bg-secondary px-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">researched</span>
        )}
        {row.researched && !row.aired && row.airsAt && (
          <span className="text-[0.65rem] text-destructive" title="Anything it found is probably about an earlier episode">
            researched before it aired — reject its results
          </span>
        )}
        {autoNote && (
          <span className={cn("text-[0.65rem]", autoNote.bad ? "text-destructive" : "text-muted-foreground")}>{autoNote.text}</span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {row.decisions.length > 0 && (
            <Button size="xs" variant={pending > 0 ? "default" : "secondary"} onClick={onToggle}>
              {open ? "Hide results" : pending > 0 ? `Review ${pending} result${pending === 1 ? "" : "s"}` : `Results ✓ (${row.decisions.length})`}
            </Button>
          )}
          {(row.aired || !row.airsAt) && !row.researched && (
            <>
              <Button variant="secondary" size="xs" disabled={locked} onClick={() => onResearch(false)}>
                {researching ? "Researching…" : "Research"}
              </Button>
              <span className="text-[0.6rem] tabular-nums text-muted-foreground" title="Typical cost with the model picked at the top">
                {estimate("research", model)}
              </span>
            </>
          )}
          {row.researched && (row.aired || !row.airsAt) && (
            <button
              className="text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              disabled={locked}
              title="Search again — reads different pages each time"
              onClick={() => onResearch(true)}
            >
              {researching ? "Researching…" : "Research again"}
            </button>
          )}
        </span>
      </div>
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

// The season's research schedule, inline -- it's the thing that decides whether anyone needs to
// click Research at all, so it shouldn't be buried in Settings.
function AutoResearchControls({ season, hasSchedule, onSaved }: { season: ShowSeason; hasSchedule: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tz = season.airTz || "America/New_York";
  const tzLabel = TIME_ZONES.find(([id]) => id === tz)?.[1] ?? tz;

  async function save(changes: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api.adminUpdateSeason(season.id, changes);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  // Sensible first values when switching on: the day after the premiere's weekday, at noon.
  function turnOn() {
    const premiereDay = season.premiereDate ? new Date(`${season.premiereDate}T12:00:00Z`).getUTCDay() : 3;
    save({
      autoResearch: true,
      researchWeekday: season.researchWeekday ?? (premiereDay + 1) % 7,
      researchTime: season.researchTime ?? "12:00",
      researchModel: season.researchModel ?? AI_MODELS[0].id,
    });
  }

  return (
    <div className="flex flex-col gap-1 rounded-md bg-secondary/40 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">Auto-research</span>
        <Select
          size="sm"
          value={season.autoResearch ? "on" : "off"}
          disabled={busy}
          onChange={(e) => (e.target.value === "on" ? turnOn() : save({ autoResearch: false }))}
        >
          <option value="off">Off — manual only</option>
          <option value="on">On</option>
        </Select>
        {season.autoResearch && (
          <>
            <span className="text-muted-foreground">every</span>
            <Select
              size="sm"
              value={String(season.researchWeekday ?? "")}
              disabled={busy}
              onChange={(e) => save({ researchWeekday: Number(e.target.value) })}
            >
              {Air.WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </Select>
            <span className="text-muted-foreground">at</span>
            <Input
              type="time"
              size="sm"
              className="w-[108px]"
              defaultValue={season.researchTime ?? "12:00"}
              disabled={busy}
              onBlur={(e) => e.target.value && e.target.value !== season.researchTime && save({ researchTime: e.target.value })}
            />
            <span className="text-muted-foreground">{tzLabel} with</span>
            <Select
              size="sm"
              value={season.researchModel ?? AI_MODELS[0].id}
              disabled={busy}
              onChange={(e) => save({ researchModel: e.target.value })}
            >
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({estimate("research", m.id)} / episode)
                </option>
              ))}
            </Select>
          </>
        )}
      </div>
      {season.autoResearch && (
        <p className="text-[0.65rem] text-muted-foreground">
          Researches each episode at the first slot after it airs, starting from when this was switched on — older episodes
          use the Research button. Results still wait for your review.
        </p>
      )}
      <AirScheduleLine season={season} hasSchedule={hasSchedule} busy={busy} save={save} />
      {error && <p className="font-semibold text-destructive">{error}</p>}
    </div>
  );
}

// When the season airs: the premiere date and the time of day, weekly from there. The wiki's own
// dates take over for any episode it has dated.
function AirScheduleLine({
  season,
  hasSchedule,
  busy,
  save,
}: {
  season: ShowSeason;
  hasSchedule: boolean;
  busy: boolean;
  save: (changes: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn("font-semibold", !hasSchedule && "text-destructive")}>Airs</span>
      <span className="text-muted-foreground">weekly from</span>
      <Input
        type="date"
        size="sm"
        className="w-[140px]"
        defaultValue={season.premiereDate ?? ""}
        disabled={busy}
        onBlur={(e) => e.target.value !== (season.premiereDate ?? "") && save({ premiereDate: e.target.value || null })}
      />
      <span className="text-muted-foreground">at</span>
      <Input
        type="time"
        size="sm"
        className="w-[108px]"
        defaultValue={season.airTime ?? Air.DEFAULT_AIR_TIME}
        disabled={busy}
        onBlur={(e) => e.target.value && e.target.value !== season.airTime && save({ airTime: e.target.value })}
      />
      <Select size="sm" value={season.airTz || "America/New_York"} disabled={busy} onChange={(e) => save({ airTz: e.target.value })}>
        {TIME_ZONES.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      {!hasSchedule && (
        <span className="text-[0.65rem] text-destructive">Set the premiere date so the list knows which episodes have aired.</span>
      )}
    </div>
  );
}
