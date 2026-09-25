"use client";

import { useState } from "react";
import type { Castaway, Episode, LeagueState, WikiProposalItem } from "@/lib/game/types";
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

// A castaway the wiki reported NOTHING about this episode.
//
// This row exists because of a real case: someone who went to Tribal and took two votes without
// being voted out. That isn't immunity, isn't a reward, isn't an idol, and isn't "safe with zero
// votes against" -- there is no event in the vocabulary that describes it, so the extraction
// correctly produced nothing for her, and she simply wasn't in the list. Nobody could tell whether
// the connector had missed her or there was genuinely nothing to say.
//
// So the review list shows the whole active roster, and the ones with no result say so. What can be
// done about it depends on the league type: a league with scoring events gets an inline add here,
// and one without (classic draft scores on elimination order alone) gets the statement on its own,
// with eliminations handled by "Add Eliminated Player" just above.
function NoResultRow({ castaway, ep, onResolved }: { castaway: Castaway; ep: Episode; onResolved: () => void }) {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const state = useLeagueStore((s) => s.state);
  const setState = useLeagueStore((s) => s.setState);
  const [type, setType] = useState(StateLogic.ACTIVE_ROSTER_EVENTS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canLogEvents = StateLogic.getLeagueType(state).hasActiveRoster;

  async function add() {
    setBusy(true);
    setError(null);
    try {
      setState(await api.addScoringEvent(leagueId!, ep.id, type, castaway.id));
      onResolved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-1.5">
      <CastawayAvatar castaway={castaway} className="h-7 w-7 flex-none rounded-full bg-secondary text-[0.6rem] font-bold leading-7 text-center text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{castaway.name}</span>
      <span className="text-xs italic text-muted-foreground">no result reported</span>
      {canLogEvents && (
        <span className="ml-auto flex items-center gap-1.5">
          <Select size="sm" value={type} disabled={busy} onChange={(e) => setType(e.target.value)}>
            {StateLogic.ACTIVE_ROSTER_EVENTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
          <Button size="xs" variant="secondary" disabled={busy} onClick={add}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </span>
      )}
      {error && <span className="text-xs font-semibold text-destructive">{error}</span>}
    </div>
  );
}

// Groups one episode's review the way it's actually read: by tribe, because that's how an episode
// happens (this tribe went to Tribal, that one won immunity), and within a tribe by what kind of
// thing each row is.
//
// Every ACTIVE castaway gets a row, whether the wiki reported anything for them or not -- see
// NoResultRow for why that matters. Ordering inside a group, in order of precedence:
//   1. eliminations first -- the one decision that changes the season, and the one everything else
//      in the group is context for;
//   2. then by event, alphabetically, so the same kind of result reads as a block rather than being
//      scattered through the list;
//   3. then confidence, high before low, so anything inferred sits at the bottom of its block where
//      it gets the closer look it deserves;
//   4. then name, so the order is stable between renders and between reveals;
//   5. and castaways with no result at all last within their tribe, since they're what's left over
//      rather than something to review.
//
// Tribe groups follow the league's own tribe order; anyone without a tribe (a league catching up
// that hasn't been given the division yet, or a name that didn't resolve) goes last under no header.
type Row = { key: string; item: WikiProposalItem | null; castaway: Castaway | null; sort: [number, string, number, string] };

function buildGroups(items: WikiProposalItem[], state: LeagueState, ep: Episode) {
  const rows: { tribeId: string | null; row: Row }[] = [];
  const spokenFor = new Set<string>();

  for (const item of items) {
    const { castaway } = StateLogic.Core.findCastawayByName(state, item.castaway_name);
    if (castaway) spokenFor.add(castaway.id);
    rows.push({
      tribeId: castaway?.tribeId ?? null,
      row: {
        key: item.id,
        item,
        castaway: castaway ?? null,
        sort: [
          item.kind === "elimination" ? 0 : 1,
          labelFor(item),
          // "high" before "low" -- compared explicitly rather than leaning on the alphabet, since a
          // third confidence level would silently break that coincidence.
          item.confidence === "high" ? 0 : 1,
          item.castaway_name,
        ],
      },
    });
  }

  // Already ON the episode counts as spoken for, not just a pending item. Without this, ACCEPTING a
  // result moved that castaway straight into the "no result reported" pile -- the item leaves the
  // pending list the moment it's applied -- and adding one by hand below did nothing visible. The
  // three places an episode records a castaway: an elimination (`events`), a scoring event, an exile.
  for (const e of ep.events || []) spokenFor.add(e.castawayId);
  for (const e of ep.scoringEvents || []) spokenFor.add(e.castawayId);
  for (const e of ep.exiled || []) spokenFor.add(e.castawayId);

  for (const castaway of state.castaways) {
    if (castaway.status === "eliminated" || spokenFor.has(castaway.id)) continue;
    rows.push({
      tribeId: castaway.tribeId ?? null,
      row: { key: `none-${castaway.id}`, item: null, castaway, sort: [2, "", 0, castaway.name] },
    });
  }

  const groups = new Map<string | null, Row[]>();
  for (const { tribeId, row } of rows) {
    const list = groups.get(tribeId);
    if (list) list.push(row);
    else groups.set(tribeId, [row]);
  }

  const bySort = (a: Row, b: Row) =>
    a.sort[0] - b.sort[0] || a.sort[1].localeCompare(b.sort[1]) || a.sort[2] - b.sort[2] || a.sort[3].localeCompare(b.sort[3]);

  return [...groups.entries()]
    .map(([tribeId, list]) => ({
      tribeId,
      tribe: state.tribes.find((t) => t.id === tribeId) ?? null,
      rows: [...list].sort(bySort),
    }))
    .sort((a, b) => {
      const ia = a.tribe ? state.tribes.indexOf(a.tribe) : Number.MAX_SAFE_INTEGER;
      const ib = b.tribe ? state.tribes.indexOf(b.tribe) : Number.MAX_SAFE_INTEGER;
      return ia - ib;
    });
}

// Per-episode review panel -- the "Reveal Outcome" surface this replaces League Settings' old
// whole-payload Apply/Reject with (see wiki-connector-section.tsx). `items` is already filtered to
// this one episode by the caller (episodes-tab.tsx fetches once for the whole league and groups).
export function WikiOutcomeSection({
  items,
  state,
  ep,
  onResolved,
}: {
  items: WikiProposalItem[];
  state: LeagueState;
  ep: Episode;
  onResolved: () => void;
}) {
  // Only once the connector has said something about this episode. With nothing revealed there is
  // no review to do, and listing the whole cast under "Reveal Outcome" would be noise on every
  // episode card of every league, connector or not.
  if (items.length === 0) return null;
  const groups = buildGroups(items, state, ep);
  // No header over a single unnamed pile -- a league that hasn't been given the tribe division yet
  // would otherwise get a meaningless bar across the top of its only group.
  const showHeaders = groups.some((g) => g.tribe);
  const unreported = groups.reduce((n, g) => n + g.rows.filter((r) => !r.item).length, 0);

  return (
    <div className="mb-4 border-t border-border pt-3">
      <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        Reveal Outcome <span className="ml-1 font-normal text-muted-foreground">— from the wiki connector, unreviewed</span>
      </h4>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.tribeId ?? "none"} className="flex flex-col gap-1.5">
            {showHeaders && (
              <div className="flex items-center gap-1.5">
                {group.tribe ? (
                  <>
                    <span className="h-2 w-2 rounded-full" style={{ background: group.tribe.color }} />
                    <span className="text-[0.7rem] font-bold uppercase tracking-wide">{group.tribe.name}</span>
                  </>
                ) : (
                  <span className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">No tribe</span>
                )}
                <span className="text-[0.7rem] text-muted-foreground">
                  {group.rows.filter((r) => r.item).length} result{group.rows.filter((r) => r.item).length === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {group.rows.map((row) =>
              row.item ? (
                <WikiItemRow key={row.key} item={row.item} state={state} onResolved={onResolved} />
              ) : (
                <NoResultRow key={row.key} castaway={row.castaway!} ep={ep} onResolved={onResolved} />
              )
            )}
          </div>
        ))}
      </div>
      {unreported > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {unreported} {unreported === 1 ? "castaway has" : "castaways have"} no result from the wiki. That&rsquo;s
          expected for anyone who went to Tribal and took votes — the connector has no event for that — so check them
          against the episode before you finish.
        </p>
      )}
    </div>
  );
}
