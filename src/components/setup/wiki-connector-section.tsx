"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeagueState, WikiProposal, ProposalEpisode } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { useMutate } from "@/lib/use-mutate";
import { api, ApiError } from "@/lib/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShowTerms, type ShowTerms } from "@/lib/use-show-terms";

// Review queue for the wiki connector (db/wiki-sync.js). Commissioner-only, and live-mode only --
// proposals live in their own table, so there's nothing for mock mode to show, same as Invites.
//
// The connector never writes to league state itself; it files proposals here and this is where they
// get confirmed. That's the whole point of the design (see the plan doc: "every extraction is a
// pending proposal, never auto-applied"), and it matters more than usual because extraction is
// LLM-based -- which is also why each proposal shows its provenance (which wiki pages, which
// revisions, which model, when) rather than asking you to trust it blind.
//
// THREE KINDS now, and they are deliberately NOT presented alike:
//   cast          - the season's cast and starting groups. Read off one well-formed table.
//   eliminations  - who left each episode and how. Read off the guide's Finish column; high trust.
//   scoringEvents - immunity/reward wins, idol plays, zero-vote-safes. Inference over rowspan-heavy
//                   tables and footnote markers, so each event carries its own confidence and the
//                   low-confidence ones are called out. The plan asks for exactly this distinction.
export function WikiConnectorSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const canManage = useCanManage();
  const mutate = useMutate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const live = mode === "live" && !!leagueId;
  const { data, refetch } = useQuery({
    queryKey: ["wiki-proposals", leagueId],
    queryFn: () => api.listWikiProposals(leagueId!),
    enabled: live && canManage,
  });

  async function updateSeason(value: number | null) {
    await mutate(
      (s) => StateLogic.updateSettings(s, "wikiSeason", value),
      () => api.updateLeagueSettings(leagueId!, "wikiSeason", value)
    );
  }

  async function apply(p: WikiProposal) {
    setBusyId(p.id);
    setError(null);
    setNote(null);
    try {
      const res = await api.applyWikiProposal(leagueId!, p.id);
      setState(res.state);
      setNote(describeApplied(res.kind, res.applied, terms));
      refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not apply that proposal.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(p: WikiProposal) {
    setBusyId(p.id);
    setError(null);
    setNote(null);
    try {
      await api.rejectWikiProposal(leagueId!, p.id);
      refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reject that proposal.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canManage) return null;

  const season = state.settings.wikiSeason;
  const showLabel = terms.showName ?? state.settings.showId ?? "the show";
  const proposals = data?.proposals ?? [];

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Wiki Connector</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Pulls this season&rsquo;s cast and per-episode results from {showLabel}&rsquo;s wiki. Everything it finds arrives
        here as a proposal for you to confirm — it never writes to your league on its own.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          Wiki season number:
          <Input
            type="number"
            className="w-20"
            defaultValue={season ?? ""}
            placeholder="44"
            onBlur={(e) => {
              const v = e.target.value.trim();
              const n = v === "" ? null : parseInt(v);
              if (n !== season) updateSeason(Number.isFinite(n as number) ? n : null);
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">
          {season ? `Tracking ${showLabel} season ${season} on the wiki.` : "Set this before running the connector."}
        </span>
      </div>

      {!live ? (
        <p className="text-sm italic text-muted-foreground">Proposals are a live-league feature — not available in demo mode.</p>
      ) : (
        <>
          <div className="mb-2 rounded-md border border-dashed border-border bg-secondary/40 p-2.5">
            <p className="text-xs text-muted-foreground">
              To fetch, run{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                node db/wiki-sync.js cast {leagueId}
              </code>{" "}
              for the cast, or{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                node db/wiki-sync.js episodes {leagueId}
              </code>{" "}
              for per-episode results (add <code className="font-mono">--dry</code> to preview without filing). Needs{" "}
              <code className="font-mono">ANTHROPIC_API_KEY</code> set, since extraction uses Claude. Schedule it with
              Task Scheduler to have proposals waiting for you.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run <code className="font-mono">cast</code> first — per-episode results are matched to the{" "}
              {terms.castaways} already in your league by name.
            </p>
          </div>

          {proposals.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No proposals waiting.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {proposals.map((p) => (
                <div key={p.id} className="rounded-md border border-border p-2.5">
                  {p.kind === "cast" ? (
                    <CastSummary proposal={p} state={state} terms={terms} />
                  ) : p.kind === "eliminations" ? (
                    <EliminationsSummary proposal={p} state={state} terms={terms} />
                  ) : (
                    <EventsSummary proposal={p} state={state} terms={terms} />
                  )}
                  {/* Provenance: extraction is LLM-based, so what it read is part of the review. Every
                      page is listed, transcluded templates included -- with transclusion the season
                      page's own revision id no longer pins the content that was extracted. */}
                  <p className="mb-2 text-[0.7rem] text-muted-foreground">
                    From {p.provenance.pages.map((pg) => `${pg.title}${pg.revisionId ? ` (rev ${pg.revisionId})` : ""}`).join(", ")} ·{" "}
                    {p.provenance.model} · {new Date(p.provenance.extractedAt).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" disabled={busyId === p.id} onClick={() => apply(p)}>
                      Apply
                    </Button>
                    <Button variant="secondary" size="sm" disabled={busyId === p.id} onClick={() => reject(p)}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {note && <p className="mt-2 text-sm font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}

// ---------- per-kind summaries ----------

function CastSummary({ proposal, state, terms }: { proposal: WikiProposal; state: LeagueState; terms: ShowTerms }) {
  const cast = proposal.payload.castaways ?? [];
  const tribes = proposal.payload.tribes ?? [];
  const existing = new Set(state.castaways.map((c) => c.name.trim().toLowerCase()));
  const newOnes = cast.filter((c) => !existing.has(c.name.trim().toLowerCase()));
  const withPhotos = cast.filter((c) => c.photoUrl).length;
  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">cast</Badge>
        <span className="text-sm font-semibold">
          {newOnes.length} new {newOnes.length === 1 ? terms.castaway : terms.castaways}, {tribes.length}{" "}
          {tribes.length === 1 ? terms.tribe : terms.tribes}
        </span>
        {cast.length !== newOnes.length && (
          <span className="text-xs text-muted-foreground">
            ({cast.length - newOnes.length} already in your league — those stay as they are)
          </span>
        )}
        {withPhotos > 0 && <span className="text-xs text-muted-foreground">· {withPhotos} with photos</span>}
      </div>
      <p className="mb-1.5 text-xs text-muted-foreground">
        {newOnes.slice(0, 8).map((c) => c.name).join(", ")}
        {newOnes.length > 8 ? `, +${newOnes.length - 8} more` : ""}
      </p>
    </>
  );
}

// Eliminations are the high-trust half: read off the episode guide's Finish column. The one thing
// worth surfacing per row is whether it's NEW, since applying is additive and anything already
// eliminated is left exactly as it is (including its placement order).
function EliminationsSummary({ proposal, state, terms }: { proposal: WikiProposal; state: LeagueState; terms: ShowTerms }) {
  const episodes = (proposal.payload.episodes ?? []) as ProposalEpisode[];
  const rows = episodes.flatMap((ep) =>
    (ep.eliminations ?? []).map((el) => {
      const { castaway } = StateLogic.Core.findCastawayByName(state, el.name);
      return { episode: ep.number, name: el.name, method: el.method, isNew: !!castaway && castaway.status !== "eliminated" };
    })
  );
  const newRows = rows.filter((r) => r.isNew);
  const existingEpisodes = new Set(state.episodes.map((e) => e.number));
  const toCreate = episodes.filter((ep) => !existingEpisodes.has(ep.number)).map((ep) => ep.number);
  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">eliminations</Badge>
        <span className="text-sm font-semibold">
          {newRows.length} new across {episodes.length} episode{episodes.length === 1 ? "" : "s"}
        </span>
        {rows.length !== newRows.length && (
          <span className="text-xs text-muted-foreground">
            ({rows.length - newRows.length} already recorded — those stay as they are)
          </span>
        )}
        {toCreate.length > 0 && (
          <span className="text-xs text-muted-foreground">
            · will create episode{toCreate.length === 1 ? "" : "s"} {toCreate.join(", ")}
          </span>
        )}
      </div>
      <ul className="mb-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
        {rows.slice(0, 10).map((r, i) => (
          <li key={i} className={r.isNew ? "" : "opacity-50"}>
            Ep {r.episode}: {r.name} — {r.method}
            {r.isNew ? "" : " (already recorded)"}
          </li>
        ))}
        {rows.length > 10 && <li>+{rows.length - 10} more</li>}
      </ul>
      {/* An unresolvable name is the one failure mode worth warning about before Apply: the connector
          refuses to file a proposal with one, but the cast can change while a proposal sits pending. */}
      {rows.some((r) => !StateLogic.Core.findCastawayByName(state, r.name).castaway) && (
        <p className="mb-1.5 text-xs font-semibold text-destructive">
          Some names no longer match a {terms.castaway} in this league — those rows will be skipped and reported.
        </p>
      )}
    </>
  );
}

// The low-trust half. Grouped by type and with the low-confidence count called out, because
// "immunity was individual not tribal" and "this person received zero votes" are inferences, not
// reads -- see the plan's own recommendation to visually distinguish these.
function EventsSummary({ proposal, state, terms }: { proposal: WikiProposal; state: LeagueState; terms: ShowTerms }) {
  const episodes = (proposal.payload.episodes ?? []) as ProposalEpisode[];
  const all = episodes.flatMap((ep) => (ep.events ?? []).map((e) => ({ ...e, episode: ep.number })));
  const low = all.filter((e) => e.confidence === "low");
  const byType = new Map<string, number>();
  all.forEach((e) => byType.set(e.type, (byType.get(e.type) ?? 0) + 1));
  const labelFor = (type: string) =>
    StateLogic.ACTIVE_ROSTER_EVENTS.find((d) => d.id === type)?.label ?? type;
  const unresolved = all.filter((e) => !StateLogic.Core.findCastawayByName(state, e.name).castaway);
  return (
    <>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">scoring events</Badge>
        <span className="text-sm font-semibold">
          {all.length} event{all.length === 1 ? "" : "s"} across {episodes.length} episode
          {episodes.length === 1 ? "" : "s"}
        </span>
        {low.length > 0 && (
          <span
            className="rounded bg-[#c99a3e] px-1.5 py-0.5 text-[0.65rem] font-bold text-white"
            title="Inferred rather than stated outright — worth a look before applying"
          >
            {low.length} to verify
          </span>
        )}
      </div>
      <ul className="mb-1.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
        {[...byType.entries()].map(([type, n]) => (
          <li key={type}>
            {labelFor(type)}: {n}
          </li>
        ))}
      </ul>
      {low.length > 0 && (
        <p className="mb-1.5 text-[0.7rem] text-muted-foreground">
          Lower-confidence ones are read from footnote markers or worked out by counting votes — for example{" "}
          {low.slice(0, 3).map((e) => `${e.name} (${labelFor(e.type)}, ep ${e.episode})`).join("; ")}
          {low.length > 3 ? `; +${low.length - 3} more` : ""}.
        </p>
      )}
      {unresolved.length > 0 && (
        <p className="mb-1.5 text-xs font-semibold text-destructive">
          {unresolved.length} name{unresolved.length === 1 ? "" : "s"} no longer match a {terms.castaway} in this league
          — those will be skipped and reported.
        </p>
      )}
    </>
  );
}

// One place that turns an apply response into a sentence. Narrows on `kind` rather than probing the
// payload's shape, since the server already told us which of the three it was.
function describeApplied(
  kind: "cast" | "eliminations" | "scoringEvents",
  applied: Awaited<ReturnType<typeof api.applyWikiProposal>>["applied"],
  terms: ShowTerms
): string {
  if (!applied) return "Applied.";
  const tail = (skipped: string[], unresolved: string[]) =>
    (skipped.length ? ` Left ${skipped.length} already-recorded item${skipped.length === 1 ? "" : "s"} untouched.` : "") +
    (unresolved.length ? ` Could not match ${unresolved.length} name${unresolved.length === 1 ? "" : "s"}: ${unresolved.slice(0, 5).join(", ")}.` : "");

  if (kind === "cast" && "castaways" in applied) {
    return (
      `Added ${applied.castaways.length} ${applied.castaways.length === 1 ? terms.castaway : terms.castaways} and ` +
      `${applied.tribes.length} ${applied.tribes.length === 1 ? terms.tribe : terms.tribes}` +
      (applied.skipped.length
        ? `; left ${applied.skipped.length} existing ${applied.skipped.length === 1 ? terms.castaway : terms.castaways} untouched.`
        : ".")
    );
  }
  if (kind === "eliminations" && "eliminations" in applied) {
    const created = applied.episodesCreated.length ? ` Created episode${applied.episodesCreated.length === 1 ? "" : "s"} ${applied.episodesCreated.join(", ")}.` : "";
    return `Recorded ${applied.eliminations.length} elimination${applied.eliminations.length === 1 ? "" : "s"}.${created}${tail(applied.skipped, applied.unresolved)}`;
  }
  if (kind === "scoringEvents" && "events" in applied) {
    const created = applied.episodesCreated.length ? ` Created episode${applied.episodesCreated.length === 1 ? "" : "s"} ${applied.episodesCreated.join(", ")}.` : "";
    return `Logged ${applied.events.length} scoring event${applied.events.length === 1 ? "" : "s"}.${created}${tail(applied.skipped, applied.unresolved)}`;
  }
  return "Applied.";
}
