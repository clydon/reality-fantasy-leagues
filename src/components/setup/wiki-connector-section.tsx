"use client";

import { useQuery } from "@tanstack/react-query";
import type { LeagueState, WikiProposal } from "@/lib/game/types";
import { useLeagueStore, useIsSuperAdmin } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShowTerms, type ShowTerms } from "@/lib/use-show-terms";

// Leftover wiki-connector cast proposals (db/wiki-sync.js), admin-only and live-mode only. Both the
// cast and the per-episode results are decided once per season by an admin now (db/migrations/0011
// and 0019) and reach the league on their own; the season is picked in League Info. All this still
// does is let an admin apply or clear a cast proposal filed before that change -- and it renders
// nothing at all when there isn't one.
export function WikiConnectorSection({ state }: { state: LeagueState }) {
  const terms = useShowTerms();
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const setState = useLeagueStore((s) => s.setState);
  const isSuperAdmin = useIsSuperAdmin();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const live = mode === "live" && !!leagueId;
  const { data, refetch } = useQuery({
    queryKey: ["wiki-proposals", leagueId],
    queryFn: () => api.listWikiProposals(leagueId!),
    enabled: live && isSuperAdmin,
  });
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

  if (!isSuperAdmin) return null;

  // Cast proposals aren't FILED any more -- the cast is season data an admin approves once
  // (db/migrations/0011) -- but a league that ran the connector before that change can still have
  // one sitting pending, and applying it is still the right thing to do with it. So this list keeps
  // working and simply stops filling up. Eliminations/scoringEvents proposals are filtered out for
  // the same "left over from an older shape" reason.
  const proposals = (data?.proposals ?? []).filter((p) => p.kind === "cast");

  // Nothing left over (the normal case): no section at all. It used to show a season-number field
  // (League Info picks the season now) and command-line instructions (admin tooling, not league
  // settings), which read as something a league had to set up when nothing was needed.
  if (!live || proposals.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Leftover cast proposal</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        From before the season&rsquo;s cast was approved once for every league. Apply it to bring in anyone missing,
        or reject it to clear it. Only admins see this.
      </p>
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
