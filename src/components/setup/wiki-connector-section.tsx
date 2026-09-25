"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeagueState, WikiProposal } from "@/lib/game/types";
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
// Both the cast and the per-episode results are decided once per season by an admin (db/migrations/
// 0011 and 0019) and reach the league on their own. What's left here is the season picker and any
// cast proposal left over from before that change.
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
      setNote(describeApplied(res.applied, terms));
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
  // Cast proposals aren't FILED any more -- the cast is season data an admin approves once
  // (db/migrations/0011) -- but a league that ran the connector before that change can still have
  // one sitting pending, and applying it is still the right thing to do with it. So this list keeps
  // working and simply stops filling up. Eliminations/scoringEvents proposals are filtered out for
  // the same "left over from an older shape" reason.
  const proposals = (data?.proposals ?? []).filter((p) => p.kind === "cast");

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Wiki Connector</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Your league&rsquo;s cast comes from {showLabel}&rsquo;s wiki, reviewed and approved once by an admin for the
        whole season — it arrives here on its own, and picking a season that already has one brings it with you.
        Episode results (eliminations, scoring events, exiles) are reviewed once for the whole season too, and land on
        each episode&rsquo;s card automatically — nothing for you to confirm.
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
              A scheduled job reads every season any league is tracking once and shares the result — nothing to run
              yourself. To fetch on demand instead, run{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                node db/wiki-sync.js cast {leagueId}
              </code>{" "}
              for the cast, or{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                node db/wiki-sync.js episodes {leagueId}
              </code>{" "}
              for per-episode results (add <code className="font-mono">--dry</code> to preview without filing).
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Per-episode results are matched by name against the {terms.castaways} already in your league, so the
              season&rsquo;s cast has to be approved before they can land.
            </p>
          </div>

          {proposals.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No proposals waiting.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {proposals.map((p) => (
                <div key={p.id} className="rounded-md border border-border p-2.5">
                  <CastSummary proposal={p} state={state} terms={terms} />
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

// One place that turns an apply response into a sentence. The proposal list above only ever shows
// 'cast' proposals now (eliminations/scoringEvents moved to per-item review -- see this file's top
// comment), so that's the only shape this needs to describe.
function describeApplied(applied: Awaited<ReturnType<typeof api.applyWikiProposal>>["applied"], terms: ShowTerms): string {
  if (!applied || !("castaways" in applied)) return "Applied.";
  return (
    `Added ${applied.castaways.length} ${applied.castaways.length === 1 ? terms.castaway : terms.castaways} and ` +
    `${applied.tribes.length} ${applied.tribes.length === 1 ? terms.tribe : terms.tribes}` +
    (applied.skipped.length
      ? `; left ${applied.skipped.length} existing ${applied.skipped.length === 1 ? terms.castaway : terms.castaways} untouched.`
      : ".")
  );
}
