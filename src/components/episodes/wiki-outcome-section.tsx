"use client";

import { useState } from "react";
import type { LeagueState, WikiProposalItem } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { CastawayAvatar } from "@/components/castaway-avatar";
import { useLeagueStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useShowTerms } from "@/lib/use-show-terms";

function labelFor(item: WikiProposalItem): string {
  if (item.kind === "elimination") return item.method;
  if (item.kind === "exiled") return "Exile Island";
  return StateLogic.ACTIVE_ROSTER_EVENTS.find((d) => d.id === item.event_type)?.label ?? item.event_type;
}

// One reviewable decision from the wiki connector's per-episode fan-out (db/migrations/0009) --
// see wiki-sync.js's fanOutEpisodes for how these get here. Accept commits it to league state via
// the per-item accept route (EpisodeLogic.addElimination/ActiveRosterLogic.addEvent/addExiled,
// dispatched server-side by kind); Reject just dismisses it; Edit lets the commissioner correct the
// castaway or the method/type before accepting, same controls as the "Add Eliminated Player"
// mini-form just above this in episode-card.tsx.
function WikiItemRow({ item, state, onResolved }: { item: WikiProposalItem; state: LeagueState; onResolved: () => void }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, item.castaway_name);
  const activeCast = state.castaways.filter((c) => c.status === "active");
  const [castawayId, setCastawayId] = useState(castaway?.id ?? "");
  const [method, setMethod] = useState(item.method || StateLogic.EXIT_METHODS[0]);
  const [eventType, setEventType] = useState(item.event_type || StateLogic.ACTIVE_ROSTER_EVENTS[0].id);

  async function accept(edits?: { castawayName?: string; method?: string; eventType?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.acceptWikiItem(leagueId!, item.id, edits);
      setState(res.state);
      onResolved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not accept that item.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await api.rejectWikiItem(leagueId!, item.id);
      onResolved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reject that item.");
    } finally {
      setBusy(false);
    }
  }

  function confirmEdit() {
    const chosen = state.castaways.find((c) => c.id === castawayId);
    if (!chosen) {
      setError(`Select which ${terms.castaway} this actually was.`);
      return;
    }
    accept({
      castawayName: chosen.name,
      method: item.kind === "elimination" ? method : undefined,
      eventType: item.kind === "event" ? eventType : undefined,
    });
  }

  return (
    <div className="rounded-md bg-secondary/40 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {castaway ? (
          <CastawayAvatar castaway={castaway} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.6rem] font-bold" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-[0.6rem] font-bold text-white">?</span>
        )}
        <span className="text-sm font-medium">{castaway?.name ?? item.castaway_name}</span>
        {!castaway && (
          <span className="text-xs font-semibold text-destructive">
            {ambiguous ? `matches more than one ${terms.castaway}` : `no longer matches a ${terms.castaway} in this league`}
          </span>
        )}
        <span className="text-sm text-muted-foreground">{labelFor(item)}</span>
        {item.kind === "event" && item.confidence === "low" && (
          <span
            className="rounded bg-[#c99a3e] px-1.5 py-0.5 text-[0.65rem] font-bold text-white"
            title="Inferred rather than stated outright -- worth a look before accepting"
          >
            low confidence
          </span>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" disabled={busy} onClick={() => accept()}>
            Accept
          </Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setEditing((v) => !v)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={reject}>
            Reject
          </Button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <Select value={castawayId} onChange={(e) => setCastawayId(e.target.value)}>
            <option value="">— Select {terms.castaway} —</option>
            {activeCast.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {item.kind === "elimination" && (
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {StateLogic.EXIT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
          {item.kind === "event" && (
            <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
              {StateLogic.ACTIVE_ROSTER_EVENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
          <Button size="sm" disabled={busy} onClick={confirmEdit}>
            Confirm &amp; Accept
          </Button>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs font-semibold text-destructive">{error}</p>}
    </div>
  );
}

// Per-episode review panel -- the "Reveal Outcome" surface this replaces League Settings' old
// whole-payload Apply/Reject with (see wiki-connector-section.tsx). `items` is already filtered to
// this one episode by the caller (episodes-tab.tsx fetches once for the whole league and groups).
export function WikiOutcomeSection({ items, state, onResolved }: { items: WikiProposalItem[]; state: LeagueState; onResolved: () => void }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-4 border-t border-border pt-3">
      <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        Reveal Outcome <span className="ml-1 font-normal text-muted-foreground">— from the wiki connector, unreviewed</span>
      </h4>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <WikiItemRow key={item.id} item={item} state={state} onResolved={onResolved} />
        ))}
      </div>
    </div>
  );
}
