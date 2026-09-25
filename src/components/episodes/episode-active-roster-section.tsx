"use client";

import { useState } from "react";
import type { Episode, LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage, useMyPlayerId } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "cn";
import { useShowTerms } from "@/lib/use-show-terms";

// Active Roster's per-episode UI inside EpisodeCard: each player's active lineup for THIS episode,
// the commissioner's lineup lock, and the scoring-event log.
//
// Lineups are per-episode by design (see ActiveRosterLogic): this component only ever reads and
// writes `ep.lineups`, so there's no way for it to touch a different episode's lineup and change what
// that episode already scored.
//
// Doesn't use useMutate: lineup/lock/event calls have real validation messages worth showing inline
// rather than useMutate's generic alert(), and Active Roster isn't reachable in mock mode (the demo
// league is classic-draft), so a mock branch would be dead code.
export function EpisodeActiveRosterSection({ ep, state }: { ep: Episode; state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const myPlayerId = useMyPlayerId();

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [draftLineup, setDraftLineup] = useState<string[]>([]);
  const events = StateLogic.formatOf(state).events;
  const [eventType, setEventType] = useState(events[0].id);
  const [eventCastawayId, setEventCastawayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = !!ep.lineupsLocked;
  const activeSlots = state.settings.activeSlots;

  async function run(fn: () => Promise<LeagueState>) {
    setBusy(true);
    setError(null);
    try {
      setState(await fn());
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function startEditing(playerId: string) {
    setEditingPlayerId(playerId);
    setDraftLineup(StateLogic.activeRosterLineupFor(state, ep.id, playerId));
    setError(null);
  }

  function toggle(castawayId: string) {
    setDraftLineup((cur) =>
      cur.includes(castawayId)
        ? cur.filter((id) => id !== castawayId)
        : cur.length >= activeSlots
        ? cur
        : [...cur, castawayId]
    );
  }

  async function saveLineup(playerId: string) {
    const ok = await run(() => api.setActiveRosterLineup(leagueId!, ep.id, playerId, draftLineup));
    if (ok) setEditingPlayerId(null);
  }

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h4 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Lineups</h4>
        {locked ? (
          <Badge variant="secondary" className="bg-good/15 text-good">
            Locked
          </Badge>
        ) : (
          <Badge variant="secondary">Open</Badge>
        )}
        {canManage && (
          <Button
            variant="secondary"
            size="xs"
            disabled={busy}
            onClick={() => run(() => (locked ? api.unlockLineups(leagueId!, ep.id) : api.lockLineups(leagueId!, ep.id)))}
          >
            {locked ? "Reopen lineups" : "Lock lineups"}
          </Button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Only these {terms.castaways} earn points for this episode. Benched ones score nothing.
        {!locked && " Locking freezes them so later changes can't affect this episode's score."}
      </p>

      <div className="mb-3 flex flex-col gap-1.5">
        {state.players.map((p) => {
          const lineup = StateLogic.activeRosterLineupFor(state, ep.id, p.id);
          const owned = state.castaways.filter((c) => c.ownerIds.includes(p.id));
          const canEdit = !locked && (canManage || p.id === myPlayerId);
          const isEditing = editingPlayerId === p.id;
          return (
            <div key={p.id} className="rounded-md border border-border p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="text-white" style={{ background: p.color }}>
                  {p.name}
                </Badge>
                <span className="flex-1">
                  {lineup.length === 0 ? (
                    <span className="italic text-muted-foreground">no lineup set</span>
                  ) : (
                    lineup.map((id) => StateLogic.getCastaway(state, id)?.name || "?").join(", ")
                  )}
                </span>
                <span className="text-muted-foreground">
                  {lineup.length}/{activeSlots}
                </span>
                {canEdit && (
                  <Button variant="secondary" size="xs" onClick={() => (isEditing ? setEditingPlayerId(null) : startEditing(p.id))}>
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                )}
              </div>

              {isEditing && (
                <div className="mt-2 rounded-md border border-dashed border-border bg-secondary/40 p-2">
                  <p className="mb-1.5 text-xs text-muted-foreground">
                    Pick up to {activeSlots} of {p.name}&rsquo;s {owned.length} {terms.castaways} ({draftLineup.length} selected):
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {owned.map((c) => {
                      const on = draftLineup.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={cn(
                            "flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs",
                            on ? "border-primary bg-primary/10" : "border-border",
                            c.status === "eliminated" && "opacity-60"
                          )}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                          {c.name}
                          {c.status === "eliminated" && <span className="text-muted-foreground">(out)</span>}
                        </label>
                      );
                    })}
                    {owned.length === 0 && (
                      <span className="text-xs italic text-muted-foreground">No {terms.castaways} drafted yet.</span>
                    )}
                  </div>
                  <Button size="xs" disabled={busy} onClick={() => saveLineup(p.id)}>
                    Save lineup
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <h4 className="mb-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Events</h4>
      {(ep.scoringEvents || []).length === 0 ? (
        <div className="mb-2 text-sm italic text-muted-foreground">No events logged for this episode.</div>
      ) : (
        <div className="mb-2 flex flex-col gap-1.5">
          {(ep.scoringEvents || []).map((sev) => {
            const def = events.find((e) => e.id === sev.type);
            const c = StateLogic.getCastaway(state, sev.castawayId);
            const pts = StateLogic.ActiveRosterLogic.pointsFor(state, sev.type);
            // Who this actually scored for: every player who had that castaway active this episode.
            // In shared ownership that can be more than one.
            const scoredFor = state.players.filter((p) =>
              StateLogic.activeRosterLineupFor(state, ep.id, p.id).includes(sev.castawayId)
            );
            return (
              <div key={sev.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-secondary px-1.5 py-0.5 font-semibold">{def?.label || sev.type}</span>
                <span className="flex-1">{c?.name || "?"}</span>
                {scoredFor.length > 0 ? (
                  scoredFor.map((p) => (
                    <Badge key={p.id} className="text-white" style={{ background: p.color }} title={`Active for ${p.name}`}>
                      {p.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground" title={`Nobody had this ${terms.castaway} active this episode`}>
                    benched — no points
                  </span>
                )}
                <span className="font-mono font-bold">+{pts}</span>
                {canManage && (
                  <button title="Remove event" disabled={busy} onClick={() => run(() => api.removeScoringEvent(leagueId!, ep.id, sev.id))}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-1.5">
          <Select size="sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </Select>
          <Select size="sm" value={eventCastawayId} onChange={(e) => setEventCastawayId(e.target.value)}>
            <option value="">— {terms.castaway} —</option>
            {state.castaways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            disabled={busy || !eventCastawayId}
            onClick={async () => {
              const ok = await run(() => api.addScoringEvent(leagueId!, ep.id, eventType, eventCastawayId));
              if (ok) setEventCastawayId("");
            }}
          >
            + Log Event
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
