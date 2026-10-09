"use client";

import { useState } from "react";
import type { LeagueDecisionSync, SeasonDecision, SeasonDecisionsResponse } from "@/lib/game/types";
import type { GameFormat } from "@/lib/game/formats/index.js";
import { api, ApiError } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ConfidenceDot, ResultGroup, StatusNote, decidedButtonClass, rowTint } from "@/components/review-bits";
import { cn } from "cn";
import { useShowSpoilers } from "@/lib/paid-ai-store";

// One episode's results, decided once here for every league playing the season (db/migrations/0019).
// Embedded under each episode in season-episodes.tsx.
//
// Both connectors stage into this list -- the wiki's tables and web research -- and a fact they both
// report is one row marked with both. Accepting applies it to every league on the season right away
// (a catching-up league gets it when it reveals that episode); rejecting or correcting an accepted
// row undoes it everywhere. Decided rows stay listed, tinted, with their buttons live, so this is
// also the season's permanent record: every row says who decided it, when, and how many leagues
// it's in.

type Cast = SeasonDecisionsResponse["cast"][number];

function nameOf(d: SeasonDecision) {
  return d.applied?.castawayName || d.castaway_name;
}

function labelFor(d: SeasonDecision, format: GameFormat): string {
  if (d.kind === "elimination") {
    const method = d.applied?.method || d.method;
    return typeof d.jury_votes === "number" ? `${method} · ${d.jury_votes} jury vote${d.jury_votes === 1 ? "" : "s"}` : method;
  }
  if (d.kind === "exiled") return "Exile Island";
  if (d.kind === "role") return `Became ${d.applied?.method || d.method}`;
  if (d.kind === "group") {
    const group = d.applied && d.applied.method !== undefined ? d.applied.method : d.method;
    return group ? `→ ${group}` : "→ no team (on their own)";
  }
  const type = d.applied?.eventType || d.event_type;
  return format.events.find((e) => e.id === type)?.label ?? type;
}

function castFor(cast: Cast[], name: string): Cast | null {
  const lower = name.trim().toLowerCase();
  return cast.find((c) => c.name.toLowerCase() === lower) ?? null;
}

export function EpisodeDecisions({
  seasonId,
  episode,
  decisions,
  cast,
  leagueCount,
  format,
  onSynced,
}: {
  seasonId: string;
  episode: number;
  decisions: SeasonDecision[];
  cast: Cast[];
  leagueCount: number;
  /** The show's rules: which exit methods and events a correction may pick. */
  format: GameFormat;
  onSynced: (leagues: LeagueDecisionSync[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSpoilers = useShowSpoilers();
  // Opened for this episode only, with the Admin-wide "Show episode results" switch off.
  const [revealed, setRevealed] = useState(false);
  const pending = decisions.filter((d) => d.status === "pending").length;

  async function acceptAll(ids?: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminAcceptEpisode(seasonId, episode, ids);
      onSynced(res.leagues);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't accept those.");
    } finally {
      setBusy(false);
    }
  }

  const groups = groupByScoringEvent(decisions, cast, format);

  // Spoiler-free: the episode's results by the count -- eliminations, events, roles and tribe/team
  // changes alike -- with Accept all, and nothing that says who or what until asked for.
  if (!showSpoilers && !revealed) {
    const accepted = decisions.filter((d) => d.status === "accepted").length;
    const rejected = decisions.filter((d) => d.status === "rejected").length;
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
        <p className="text-[0.7rem] text-muted-foreground">
          {decisions.length} result{decisions.length === 1 ? "" : "s"}
          {[pending && `${pending} pending`, accepted && `${accepted} accepted`, rejected && `${rejected} rejected`]
            .filter(Boolean)
            .map((t) => ` · ${t}`)
            .join("")}{" "}
          — hidden while spoilers are off.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {pending > 0 && (
            <Button size="xs" disabled={busy} onClick={() => acceptAll()}>
              {busy ? "Accepting…" : `Accept all ${pending} pending`}
            </Button>
          )}
          <Button size="xs" variant="secondary" onClick={() => setRevealed(true)}>
            Show this episode&rsquo;s results
          </Button>
        </div>
        {error && <p className="font-semibold text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
      {pending > 0 && (
        <div className="flex items-center gap-2">
          <Button size="xs" disabled={busy} onClick={() => acceptAll()}>
            {busy ? "Accepting…" : `Accept all ${pending} pending`}
          </Button>
          <span className="text-[0.65rem] text-muted-foreground">as proposed — check the low-confidence ones first</span>
        </div>
      )}
      {error && <p className="font-semibold text-destructive">{error}</p>}
      {groups.map((g) => {
        const pendingIds = g.rows.filter((d) => d.status === "pending").map((d) => d.id);
        const accepted = g.rows.filter((d) => d.status === "accepted").length;
        const rejected = g.rows.filter((d) => d.status === "rejected").length;
        // Small groups and anything that needs a look start open; a big shared event (a tribe's reward
        // win) starts as one line. Team changes always start shut -- a reshuffle can move everyone.
        const needsLook = g.rows.some((d) => !castFor(cast, nameOf(d)) || (d.status === "pending" && d.confidence === "low"));
        return (
          <ResultGroup
            key={g.key}
            title={g.title}
            names={g.rows.map(nameOf)}
            noun={["person", "people"]}
            detail={[pendingIds.length && `${pendingIds.length} pending`, accepted && `${accepted} accepted`, rejected && `${rejected} rejected`]
              .filter(Boolean)
              .join(", ")}
            defaultOpen={g.key !== "group" && (g.key === "elimination" || g.rows.length <= 2 || needsLook)}
            action={
              pendingIds.length > 1 && (
                <Button size="xs" disabled={busy} onClick={() => acceptAll(pendingIds)}>
                  Accept {pendingIds.length}
                </Button>
              )
            }
          >
            {g.rows.map((d) => (
              <DecisionRow key={d.id} seasonId={seasonId} decision={d} cast={cast} leagueCount={leagueCount} format={format} onSynced={onSynced} />
            ))}
          </ResultGroup>
        );
      })}
    </div>
  );
}

// An episode's results grouped by what happened -- who left, then each scoring event in the show's
// rule order, then team changes -- so an event a whole tribe shares reads as one group. Within a group,
// by tribe then name.
function groupByScoringEvent(decisions: SeasonDecision[], cast: Cast[], format: GameFormat) {
  const tribes = [...new Set(cast.map((c) => c.tribeName).filter(Boolean))] as string[];
  const tribeRank = (d: SeasonDecision) => {
    const t = castFor(cast, nameOf(d))?.tribeName;
    return t ? tribes.indexOf(t) : 999;
  };
  const groups = new Map<string, { key: string; title: string; rank: number; rows: SeasonDecision[] }>();
  for (const d of decisions) {
    let key: string, title: string, rank: number;
    if (d.kind === "elimination") [key, title, rank] = ["elimination", "Left the game", 0];
    else if (d.kind === "role") {
      const role = d.applied?.method || d.method;
      [key, title, rank] = [`role:${role}`, `Became ${role}`, 1];
    } else if (d.kind === "exiled") [key, title, rank] = ["exiled", "Exile Island", 2];
    else if (d.kind === "group") [key, title, rank] = ["group", "Team changes", 10_000];
    else {
      const type = d.applied?.eventType || d.event_type;
      const i = format.events.findIndex((e) => e.id === type);
      [key, title, rank] = [`event:${type}`, labelFor(d, format), 3 + (i < 0 ? 5_000 : i)];
    }
    const g = groups.get(key);
    if (g) g.rows.push(d);
    else groups.set(key, { key, title, rank, rows: [d] });
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
    .map((g) => ({ ...g, rows: g.rows.sort((a, b) => tribeRank(a) - tribeRank(b) || nameOf(a).localeCompare(nameOf(b))) }));
}

function DecisionRow({
  seasonId,
  decision: d,
  cast,
  leagueCount,
  format,
  onSynced,
}: {
  seasonId: string;
  decision: SeasonDecision;
  cast: Cast[];
  leagueCount: number;
  format: GameFormat;
  onSynced: (leagues: LeagueDecisionSync[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = castFor(cast, nameOf(d));
  const [castawayName, setCastawayName] = useState(member?.name ?? "");
  // An exit method for an elimination, a role value for a role; a group change's name is typed, since a
  // correction can name a group the season hasn't had yet.
  const methodChoices = d.kind === "role" ? format.roles?.values ?? [] : format.exitMethods;
  const eventChoices = format.events.filter((e) => !e.implied);
  const [method, setMethod] = useState(
    d.kind === "group"
      ? (d.applied && d.applied.method !== undefined ? d.applied.method : d.method) ?? ""
      : d.applied?.method || d.method || methodChoices[0]
  );
  const [eventType, setEventType] = useState(d.applied?.eventType || d.event_type || eventChoices[0]?.id);

  async function decide(action: "accept" | "reject", edits?: { castawayName?: string; method?: string; eventType?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminDecide(seasonId, d.id, action, edits);
      setEditing(false);
      onSynced(res.leagues);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const decidedTitle =
    d.status === "pending"
      ? undefined
      : `${d.status === "accepted" ? "Accepted" : "Rejected"}${d.decided_by_name ? ` by ${d.decided_by_name}` : ""}${
          d.decided_at ? ` on ${new Date(d.decided_at).toLocaleString()}` : ""
        }`;

  return (
    <div className={cn("rounded-md px-2 py-1.5", rowTint(d.status))}>
      <div className="flex flex-wrap items-center gap-1.5">
        {member ? (
          <CastawayAvatar expandable
            castaway={{ name: member.name, photoUrl: member.photoUrl ?? undefined }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-[0.6rem] font-bold"
          />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-destructive text-[0.6rem] font-bold text-white">?</span>
        )}
        <span className="text-sm font-medium">{nameOf(d)}</span>
        {!member && <span className="font-semibold text-destructive">not in the cast</span>}
        {/* An event row sits under its event's group heading, so it doesn't repeat it. */}
        {d.kind !== "event" && d.kind !== "exiled" && <span className="text-sm text-muted-foreground">{labelFor(d, format)}</span>}
        {d.applied && (
          <span className="text-[0.65rem] text-muted-foreground" title="Corrected before accepting">
            (was {d.castaway_name}
            {(d.kind === "elimination" || d.kind === "role") && d.applied.method && d.applied.method !== d.method ? `, ${d.method}` : ""}
            {d.kind === "event" && d.applied.eventType && d.applied.eventType !== d.event_type ? `, ${d.event_type}` : ""})
          </span>
        )}
        <ConfidenceDot level={d.confidence} />
        <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground" title="Which source reported this">
          {[d.from_wiki && "wiki", d.from_research && "research"].filter(Boolean).join(" + ")}
        </span>
        {d.sources.length > 0 && (
          <span className="text-muted-foreground">
            {d.sources.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-0.5 underline underline-offset-2" title={url}>
                [{i + 1}]
              </a>
            ))}
          </span>
        )}
        <span title={decidedTitle} className={cn(decidedTitle && "cursor-help")}>
          <StatusNote status={d.status} />
        </span>
        {d.status === "accepted" && (
          <span className="text-[0.65rem] text-muted-foreground" title="Leagues this result has been applied to">
            in {d.applied_leagues}/{leagueCount} league{leagueCount === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <Button size="xs" className={decidedButtonClass(d.status)} disabled={busy} onClick={() => decide("accept")}>
            Accept
          </Button>
          <Button variant="secondary" size="xs" className={decidedButtonClass(d.status)} disabled={busy} onClick={() => setEditing((v) => !v)}>
            Edit
          </Button>
          <Button variant="destructive" size="xs" className={decidedButtonClass(d.status)} disabled={busy} onClick={() => decide("reject")}>
            Reject
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-1.5">
          <Select size="sm" value={castawayName} onChange={(e) => setCastawayName(e.target.value)}>
            <option value="">— who was it? —</option>
            {cast.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
          {(d.kind === "elimination" || d.kind === "role") && (
            <Select size="sm" value={method} onChange={(e) => setMethod(e.target.value)}>
              {methodChoices.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
          {d.kind === "group" && (
            <Input
              size="sm"
              className="w-[160px]"
              placeholder="team — blank for none"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />
          )}
          {d.kind === "event" && (
            <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {eventChoices.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Select>
          )}
          <Button
            size="xs"
            disabled={busy || !castawayName}
            onClick={() =>
              decide("accept", {
                castawayName,
                method: d.kind === "elimination" || d.kind === "role" || d.kind === "group" ? method : undefined,
                eventType: d.kind === "event" ? eventType : undefined,
              })
            }
          >
            Confirm &amp; accept
          </Button>
        </div>
      )}
      {error && <p className="mt-1 font-semibold text-destructive">{error}</p>}
    </div>
  );
}
