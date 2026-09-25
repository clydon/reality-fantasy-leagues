"use client";

import { useState } from "react";
import type { LeagueDecisionSync, SeasonDecision, SeasonDecisionsResponse } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { api, ApiError } from "@/lib/api";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfidenceDot, StatusNote, decidedButtonClass, rowTint } from "@/components/review-bits";
import { cn } from "cn";

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

function labelFor(d: SeasonDecision): string {
  if (d.kind === "elimination") return d.applied?.method || d.method;
  if (d.kind === "exiled") return "Exile Island";
  const type = d.applied?.eventType || d.event_type;
  return StateLogic.ACTIVE_ROSTER_EVENTS.find((e) => e.id === type)?.label ?? type;
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
  onSynced,
}: {
  seasonId: string;
  episode: number;
  decisions: SeasonDecision[];
  cast: Cast[];
  leagueCount: number;
  onSynced: (leagues: LeagueDecisionSync[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = decisions.filter((d) => d.status === "pending").length;

  async function acceptAll() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminAcceptEpisode(seasonId, episode);
      onSynced(res.leagues);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't accept those.");
    } finally {
      setBusy(false);
    }
  }

  // Grouped by tribe, then by player, with whoever left the game at the top of their tribe -- the
  // way an episode is read. Everyone on a tribe's rows stay together.
  const exited = new Set(
    decisions.filter((d) => d.kind === "elimination" && d.status !== "rejected").map((d) => nameOf(d).toLowerCase())
  );
  const tribes = [...new Set(cast.map((c) => c.tribeName).filter(Boolean))] as string[];
  const groups = new Map<string | null, SeasonDecision[]>();
  for (const d of decisions) {
    const tribe = castFor(cast, nameOf(d))?.tribeName ?? null;
    const list = groups.get(tribe);
    if (list) list.push(d);
    else groups.set(tribe, [d]);
  }
  const kindOrder = (d: SeasonDecision) => (d.kind === "elimination" ? 0 : 1);
  const sortRows = (a: SeasonDecision, b: SeasonDecision) =>
    Number(!exited.has(nameOf(a).toLowerCase())) - Number(!exited.has(nameOf(b).toLowerCase())) ||
    nameOf(a).localeCompare(nameOf(b)) ||
    kindOrder(a) - kindOrder(b) ||
    labelFor(a).localeCompare(labelFor(b));
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => (a === null ? 999 : tribes.indexOf(a)) - (b === null ? 999 : tribes.indexOf(b))
  );
  const showHeaders = ordered.some(([t]) => t);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-2">
      {pending > 0 && (
        <div className="flex items-center gap-2">
          <Button size="xs" disabled={busy} onClick={acceptAll}>
            {busy ? "Accepting…" : `Accept all ${pending} pending`}
          </Button>
          <span className="text-[0.65rem] text-muted-foreground">as proposed — check the low-confidence ones first</span>
        </div>
      )}
      {error && <p className="font-semibold text-destructive">{error}</p>}
      {ordered.map(([tribe, rows]) => (
        <div key={tribe ?? "none"} className="flex flex-col gap-1">
          {showHeaders && (
            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{tribe ?? "No tribe"}</span>
          )}
          {[...rows].sort(sortRows).map((d) => (
            <DecisionRow key={d.id} seasonId={seasonId} decision={d} cast={cast} leagueCount={leagueCount} onSynced={onSynced} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DecisionRow({
  seasonId,
  decision: d,
  cast,
  leagueCount,
  onSynced,
}: {
  seasonId: string;
  decision: SeasonDecision;
  cast: Cast[];
  leagueCount: number;
  onSynced: (leagues: LeagueDecisionSync[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = castFor(cast, nameOf(d));
  const [castawayName, setCastawayName] = useState(member?.name ?? "");
  const [method, setMethod] = useState(d.applied?.method || d.method || StateLogic.EXIT_METHODS[0]);
  const [eventType, setEventType] = useState(d.applied?.eventType || d.event_type || StateLogic.ACTIVE_ROSTER_EVENTS[0].id);

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
          <CastawayAvatar
            castaway={{ name: member.name, photoUrl: member.photoUrl ?? undefined }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6rem] font-bold"
          />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-bold text-white">?</span>
        )}
        <span className="text-sm font-medium">{nameOf(d)}</span>
        {!member && <span className="font-semibold text-destructive">not in the cast</span>}
        <span className="text-sm text-muted-foreground">{labelFor(d)}</span>
        {d.applied && (
          <span className="text-[0.65rem] text-muted-foreground" title="Corrected before accepting">
            (was {d.castaway_name}
            {d.kind === "elimination" && d.applied.method && d.applied.method !== d.method ? `, ${d.method}` : ""}
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
          {d.kind === "elimination" && (
            <Select size="sm" value={method} onChange={(e) => setMethod(e.target.value)}>
              {StateLogic.EXIT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
          {d.kind === "event" && (
            <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {StateLogic.ACTIVE_ROSTER_EVENTS.map((e) => (
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
                method: d.kind === "elimination" ? method : undefined,
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
