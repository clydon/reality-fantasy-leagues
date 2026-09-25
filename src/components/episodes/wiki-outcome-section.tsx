"use client";

import { useState } from "react";
import type { Castaway, Episode, LeagueState, WikiProposalItem, ResearchProposalItem } from "@/lib/game/types";
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

// Research never proposes an elimination (see db/episode-research.js's fan-out comment), so this
// only ever sees 'event' or 'exiled' -- sharing the same event-type catalog as the wiki connector's
// labelFor above is what makes "idol found" read identically whichever source produced it.
function labelForResearch(item: ResearchProposalItem): string {
  if (item.kind === "exiled") return "Exile Island";
  return StateLogic.ACTIVE_ROSTER_EVENTS.find((d) => d.id === item.event_type)?.label ?? item.event_type;
}


// Confidence as a small coloured dot whose level shows on hover -- present on every row (not only
// the low ones) so it can be read consistently, and kept out of the way until wanted. These levels
// are also what a future auto-accept would key on.
const CONFIDENCE_MEANING: Record<"high" | "medium" | "low", string> = {
  high: "stated plainly by the source",
  medium: "implied by the source",
  low: "inferred or from a single weak source — worth a look before accepting",
};
function ConfidenceDot({ level }: { level: "high" | "medium" | "low" }) {
  const color = level === "high" ? "bg-good" : level === "medium" ? "bg-[#c99a3e]" : "bg-destructive";
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-border bg-card"
      title={`Confidence: ${level} — ${CONFIDENCE_MEANING[level]}`}
      aria-label={`Confidence: ${level}`}
    >
      <span className={`h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

// A decided row stays on the card, tinted, with its buttons dimmed but still live -- so a misclick
// or a change of mind is one click away (the routes undo what the earlier decision applied).
function rowTint(status: "pending" | "accepted" | "rejected") {
  return status === "accepted" ? "bg-good/10 ring-1 ring-good/30" : status === "rejected" ? "bg-destructive/10 ring-1 ring-destructive/25" : "bg-secondary/40";
}
function decidedButtonClass(status: "pending" | "accepted" | "rejected") {
  return status === "pending" ? "" : "opacity-45 hover:opacity-100";
}
function StatusNote({ status }: { status: "pending" | "accepted" | "rejected" }) {
  if (status === "pending") return null;
  return (
    <span className={`text-[0.65rem] font-semibold uppercase tracking-wide ${status === "accepted" ? "text-good" : "text-destructive"}`}>
      {status}
    </span>
  );
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

  const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, item.applied?.castawayName || item.castaway_name);
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
      const res = await api.rejectWikiItem(leagueId!, item.id);
      setState(res.state);
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
    <div className={`rounded-md px-2.5 py-2 ${rowTint(item.status)}`}>
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
        <ConfidenceDot level={item.confidence} />
        <StatusNote status={item.status} />
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={() => accept()}>
            Accept
          </Button>
          <Button variant="secondary" size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={() => setEditing((v) => !v)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={reject}>
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

// One reviewable decision from the RESEARCH connector's per-episode fan-out
// (db/migrations/0015_episode_research_items.sql) -- the research counterpart to WikiItemRow above.
// Same controls (Accept / Edit / Reject), with two differences that follow from what research is:
// no method to edit (there's no elimination kind here), and the sources it cited are always shown --
// unlike a wiki row, which has a revision id backing it implicitly, this one has nothing behind it
// except whatever's linked here, so hiding the links would hide the only way to check the claim.
function ResearchItemRow({ item, state, onResolved }: { item: ResearchProposalItem; state: LeagueState; onResolved: () => void }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const setState = useLeagueStore((s) => s.setState);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { castaway, ambiguous } = StateLogic.Core.findCastawayByName(state, item.applied?.castawayName || item.castaway_name);
  const activeCast = state.castaways.filter((c) => c.status === "active");
  const [castawayId, setCastawayId] = useState(castaway?.id ?? "");
  const [eventType, setEventType] = useState(item.event_type || StateLogic.ACTIVE_ROSTER_EVENTS[0].id);

  async function accept(edits?: { castawayName?: string; eventType?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await api.acceptResearchItem(leagueId!, item.id, edits);
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
      const res = await api.rejectResearchItem(leagueId!, item.id);
      setState(res.state);
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
    accept({ castawayName: chosen.name, eventType: item.kind === "event" ? eventType : undefined });
  }

  return (
    <div className={`rounded-md px-2.5 py-2 ${rowTint(item.status)}`}>
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
        <span className="text-sm text-muted-foreground">{labelForResearch(item)}</span>
        <ConfidenceDot level={item.confidence} />
        <StatusNote status={item.status} />
        {/* The only thing standing behind this claim -- there's no revision id the way a wiki item
            has, so these ARE the provenance, not supplementary to it. */}
        {item.sources.length ? (
          <span className="text-xs text-muted-foreground">
            {item.sources.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="ml-1 underline underline-offset-2" title={url}>
                [{i + 1}]
              </a>
            ))}
          </span>
        ) : (
          <span className="text-xs font-semibold text-destructive">no source</span>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={() => accept()}>
            Accept
          </Button>
          <Button variant="secondary" size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={() => setEditing((v) => !v)}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" className={decidedButtonClass(item.status)} disabled={busy} onClick={reject}>
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

// Groups one episode's review the way it's actually read: by tribe (how an episode happens -- this
// tribe went to Tribal, that one won immunity), then by player, with whoever left the game at the top
// of their tribe. Each player's rows stay together; every ACTIVE castaway gets a row, whether or not
// anything was reported for them (see NoResultRow). Decided rows stay in place, tinted.
//
// Tribe groups follow the league's own tribe order; anyone without a tribe (a league that hasn't
// been given the division yet, or a name that didn't resolve) goes last under no header.
// `item` and `researchItem` are mutually exclusive (a Row is either a wiki decision, a research
// decision, or a no-result placeholder) -- kept as two optional fields rather than a tagged union so
// the render below can stay a simple `row.item ? ... : row.researchItem ? ... : ...` without a
// switch, matching how NoResultRow's `castaway`-or-nothing check already reads.
type Row = {
  key: string;
  item: WikiProposalItem | null;
  researchItem: ResearchProposalItem | null;
  castaway: Castaway | null;
  sort: [number, string, number, string];
};

function buildGroups(items: WikiProposalItem[], researchItems: ResearchProposalItem[], state: LeagueState, ep: Episode) {
  const rows: { tribeId: string | null; row: Row }[] = [];
  const spokenFor = new Set<string>();
  const resolve = (name: string) => StateLogic.Core.findCastawayByName(state, name).castaway ?? null;

  // Who left the game this episode: an elimination proposed and not rejected, or one already
  // recorded on the episode. They go to the top of their tribe, since everything else in the group
  // reads as context for that.
  const exited = new Set<string>();
  for (const it of items) {
    if (it.kind !== "elimination" || it.status === "rejected") continue;
    const c = resolve(it.applied?.castawayName || it.castaway_name);
    exited.add(c ? c.id : it.castaway_name.toLowerCase());
  }
  for (const e of ep.events || []) exited.add(e.castawayId);
  const exitTier = (c: Castaway | null, name: string) => (exited.has(c ? c.id : name.toLowerCase()) ? 0 : 1);

  // Sort key within a tribe: [exited first, player name, this row's place within the player (an
  // elimination first, then their other results, then "no result"), result label]. So each player's
  // rows sit together, players run alphabetically, and whoever went home heads their tribe.
  for (const item of items) {
    const name = item.applied?.castawayName || item.castaway_name;
    const castaway = resolve(name);
    if (castaway) spokenFor.add(castaway.id);
    rows.push({
      tribeId: castaway?.tribeId ?? null,
      row: {
        key: `w-${item.id}`,
        item,
        researchItem: null,
        castaway,
        sort: [exitTier(castaway, name), castaway?.name ?? name, item.kind === "elimination" ? 0 : 1, labelFor(item)],
      },
    });
  }
  for (const item of researchItems) {
    const name = item.applied?.castawayName || item.castaway_name;
    const castaway = resolve(name);
    if (castaway) spokenFor.add(castaway.id);
    rows.push({
      tribeId: castaway?.tribeId ?? null,
      row: {
        key: `r-${item.id}`,
        item: null,
        researchItem: item,
        castaway,
        sort: [exitTier(castaway, name), castaway?.name ?? name, 1, labelForResearch(item)],
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
      row: { key: `none-${castaway.id}`, item: null, researchItem: null, castaway, sort: [exitTier(castaway, castaway.name), castaway.name, 2, ""] },
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
// whole-payload Apply/Reject with (see wiki-connector-section.tsx). Both item lists are already
// filtered to this one episode by the caller (episodes-tab.tsx fetches each once for the whole
// league and groups). `researchItems` defaults to empty so a league that has never run research
// costs this component nothing new to render.
export function WikiOutcomeSection({
  items,
  researchItems = [],
  state,
  ep,
  onResolved,
}: {
  items: WikiProposalItem[];
  researchItems?: ResearchProposalItem[];
  state: LeagueState;
  ep: Episode;
  onResolved: () => void;
}) {
  // Only once a connector has said something about this episode. With nothing revealed there is no
  // review to do, and listing the whole cast under "Reveal Outcome" would be noise on every episode
  // card of every league, connector or not.
  if (items.length === 0 && researchItems.length === 0) return null;
  const groups = buildGroups(items, researchItems, state, ep);
  // No header over a single unnamed pile -- a league that hasn't been given the tribe division yet
  // would otherwise get a meaningless bar across the top of its only group.
  const showHeaders = groups.some((g) => g.tribe);
  const pending = [...items, ...researchItems].filter((i) => i.status === "pending").length;
  const unreported = groups.reduce((n, g) => n + g.rows.filter((r) => !r.item && !r.researchItem).length, 0);

  return (
    <div className="mb-4 border-t border-border pt-3">
      <h4 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">
        Reveal Outcome{" "}
        <span className="ml-1 font-normal text-muted-foreground">
          — {researchItems.length > 0 && items.length > 0 ? "wiki + research" : researchItems.length > 0 ? "research" : "wiki connector"}
          {pending > 0 ? `, ${pending} to review` : ", all reviewed"}
        </span>
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
                  {group.rows.filter((r) => r.item || r.researchItem).length} result
                  {group.rows.filter((r) => r.item || r.researchItem).length === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {group.rows.map((row) =>
              row.item ? (
                <WikiItemRow key={row.key} item={row.item} state={state} onResolved={onResolved} />
              ) : row.researchItem ? (
                <ResearchItemRow key={row.key} item={row.researchItem} state={state} onResolved={onResolved} />
              ) : (
                <NoResultRow key={row.key} castaway={row.castaway!} ep={ep} onResolved={onResolved} />
              )
            )}
          </div>
        ))}
      </div>
      {unreported > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {unreported} {unreported === 1 ? "castaway has" : "castaways have"} no result from {researchItems.length > 0 ? "either connector" : "the wiki"}.
          That&rsquo;s expected for anyone who went to Tribal and took votes without it being researched yet — so check
          them against the episode before you finish.
        </p>
      )}
    </div>
  );
}
