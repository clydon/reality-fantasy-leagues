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
import { formatFor } from "@/lib/game/formats/index.js";
import { confirm } from "@/lib/confirm-store";
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
  onPasteResearch,
  onChanged,
}: {
  season: ShowSeason;
  /** The episode a research call is running for, if any. */
  researching: number | null;
  locked: boolean;
  onResearch: (episode: number, force: boolean) => void;
  /** Notes from the admin's own AI chat: prose (one cheap structuring call) or `structured` JSON (free). */
  onPasteResearch: (episode: number, notes: string, structured: boolean) => void;
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

  // Every episode that has aired or has data, plus the next one to air -- but only one upcoming
  // episode: if the latest with data hasn't aired yet (researched too early), it IS the next one.
  const airsAtOf = (n: number) => (hasSchedule ? Air.episodeAirTime(schedule, n, wikiAirDates) : null);
  const withData = Math.max(0, season.wikiEpisodesThrough ?? 0, ...researched, ...byEpisode.keys());
  let lastAired = 0;
  if (hasSchedule) {
    for (let n = 1; n <= 60; n++) {
      const t = airsAtOf(n);
      if (!t || t > now) break;
      lastAired = n;
    }
  }
  const known = Math.max(withData, lastAired);
  const knownAirsAt = airsAtOf(known);
  const knownIsUpcoming = !!knownAirsAt && knownAirsAt > now;
  const last = season.status === "completed" || knownIsUpcoming ? known : known + 1;
  const rows: EpisodeRow[] = [];
  for (let n = last; n >= 1; n--) {
    const airsAt = airsAtOf(n);
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
            onPasteResearch={(notes, structured) => onPasteResearch(row.n, notes, structured)}
            onDiscarded={() => {
              refetch();
              onChanged();
            }}
          >
            {open === row.n && data && row.decisions.length > 0 && (
              <EpisodeDecisions
                seasonId={season.id}
                episode={row.n}
                decisions={row.decisions}
                cast={data.cast}
                leagueCount={data.leagueCount}
                format={formatFor(data.format)}
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
  onPasteResearch,
  onDiscarded,
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
  onPasteResearch: (notes: string, structured: boolean) => void;
  onDiscarded: () => void;
  children?: React.ReactNode;
}) {
  const [pasting, setPasting] = useState(false);
  const tz = season.airTz || "America/New_York";
  const pending = row.decisions.filter((d) => d.status === "pending").length;
  const [discarding, setDiscarding] = useState(false);
  async function discard() {
    if (
      !(await confirm(
        `Discard episode ${row.n}'s research and its ${pending} undecided result${pending === 1 ? "" : "s"}? Anything you already accepted or rejected is kept.`,
        { danger: true, confirmLabel: "Discard" }
      ))
    )
      return;
    setDiscarding(true);
    try {
      await api.adminDiscardResearch(season.id, row.n);
      onDiscarded();
    } finally {
      setDiscarding(false);
    }
  }
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
          <span className="flex items-center gap-1 text-[0.65rem] text-destructive" title="Anything it found is probably about an earlier episode">
            researched before it aired
            <Button variant="destructive" size="xs" disabled={locked || discarding} onClick={discard}>
              {discarding ? "Discarding…" : "Discard research"}
            </Button>
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
          {(row.aired || !row.airsAt) && (
            <button
              className="text-[0.65rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              disabled={locked}
              title="Research it yourself in any AI chat with web search (free), then paste the answer back — one cheap call fits it to the checklist instead of a paid search"
              onClick={() => setPasting((v) => !v)}
            >
              {pasting ? "Cancel paste" : "Paste notes instead"}
            </button>
          )}
        </span>
      </div>
      {pasting && (
        <PasteImportPanel
          seasonId={season.id}
          episode={row.n}
          busy={locked || researching}
          model={model}
          onSubmit={(notes, structured) => {
            setPasting(false);
            onPasteResearch(notes, structured);
          }}
          onCancel={() => setPasting(false)}
        />
      )}
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}

// The paste path's UI: get the prompt (same rules this app would ask itself, worded for a one-box chat
// tool), copy it out to whatever AI chat the admin already has, paste the answer back. Fetching the
// prompt costs nothing (no model call, see buildPasteImportPrompt), so it's fetched on open.
//
// Structured (JSON) is the default: the prompt carries the exact schema plus a pre-filled skeleton
// (this episode's people, this show's answer options, any open side bets), and the answer is parsed
// directly -- free. Unticked, the chat answers in prose and one small model call structures it, for
// the chat that won't produce clean JSON.
function PasteImportPanel({
  seasonId,
  episode,
  busy,
  model,
  onSubmit,
  onCancel,
}: {
  seasonId: string;
  episode: number;
  busy: boolean;
  model: string;
  onSubmit: (notes: string, structured: boolean) => void;
  onCancel: () => void;
}) {
  const [structured, setStructured] = useState(true);
  const { data, isLoading, error } = useQuery({
    queryKey: ["paste-import-prompt", seasonId, episode, structured],
    queryFn: () => api.adminPasteImportPrompt(seasonId, episode, structured),
  });
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    if (!data?.prompt) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (permissions, non-HTTPS) -- the prompt's still selectable in the box below */
    }
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded border border-dashed border-border bg-secondary/40 p-1.5 text-[0.7rem]">
      <p className="text-muted-foreground">
        1. Copy this into any AI chat with web search (ChatGPT, Claude.ai, Gemini — whatever you already have). 2. Paste its
        answer into the box below. 3. Stage it.
      </p>
      <label className="flex items-center gap-1.5" title="Must match what the prompt you copied asked for — switching this rebuilds the prompt">
        <input type="checkbox" checked={structured} disabled={busy} onChange={(e) => setStructured(e.target.checked)} />
        <span>
          <b>Structured (JSON)</b> —{" "}
          {structured
            ? "the chat answers in this app's exact format and it's read directly. Free."
            : "the chat answers in prose and one small model call organizes it. For chats that won't give clean JSON."}
        </span>
      </label>
      {isLoading && <p className="italic text-muted-foreground">Building the prompt…</p>}
      {error && <p className="font-semibold text-destructive">{error instanceof ApiError ? error.message : "Couldn't build the prompt."}</p>}
      {data && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="xs" onClick={copyPrompt}>
              {copied ? "Copied!" : "Copy prompt"}
            </Button>
            <span className="text-muted-foreground">
              {data.castCount} people{data.betCount ? `, ${data.betCount} open side bet${data.betCount === 1 ? "" : "s"}` : ""}
            </span>
          </div>
          <textarea readOnly rows={3} value={data.prompt} className="w-full resize-y rounded border border-border bg-card p-1.5 font-mono text-[0.65rem] text-muted-foreground" />
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Paste the answer here</span>
        <textarea
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            structured
              ? "Paste the JSON the other chat wrote back (a code fence or a line of chatter around it is fine)."
              : "Paste whatever the other chat wrote back — prose, bullets, anything is fine."
          }
          className={cn("w-full resize-y rounded border border-border bg-card p-1.5 text-[0.75rem]", structured && "font-mono")}
        />
      </label>
      <div className="flex items-center gap-1.5">
        <Button size="xs" disabled={busy || !notes.trim()} onClick={() => onSubmit(notes, structured)}>
          {structured ? "Stage" : "Structure & stage"}
        </Button>
        <Button variant="secondary" size="xs" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        {/* JSON is parsed directly (no model). Prose is one non-search structuring call: small next to
            `research`'s estimate (no search fee), but a real charge. */}
        <span className="text-[0.6rem] tabular-nums text-muted-foreground" title={structured ? "Parsed directly — no model call" : "No web search — just fitting your pasted text to the checklist"}>
          {structured ? "free" : estimate("pasteResearch", model)}
        </span>
      </div>
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
