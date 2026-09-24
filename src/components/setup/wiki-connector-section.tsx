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

// Review queue for the wiki connector (db/wiki-sync.js). Commissioner-only, and live-mode only --
// proposals live in their own table, so there's nothing for mock mode to show, same as Invites.
//
// The connector never writes to league state itself; it files proposals here and this is where they
// get confirmed. That's the whole point of the design (see the plan doc: "every extraction is a
// pending proposal, never auto-applied"), and it matters more than usual because extraction is
// LLM-based -- which is also why each proposal shows its provenance (which wiki page, which revision,
// which model, when) rather than asking you to trust it blind.
export function WikiConnectorSection({ state }: { state: LeagueState }) {
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
      const a = res.applied;
      setNote(
        a
          ? `Added ${a.castaways.length} castaway${a.castaways.length === 1 ? "" : "s"} and ` +
            `${a.tribes.length} tribe${a.tribes.length === 1 ? "" : "s"}` +
            (a.skipped.length ? `; left ${a.skipped.length} existing castaway${a.skipped.length === 1 ? "" : "s"} untouched.` : ".")
          : "Applied."
      );
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
  const proposals = data?.proposals ?? [];

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Wiki Connector</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Pulls this season&rsquo;s cast from the Survivor wiki. Everything it finds arrives here as a proposal for you to
        confirm — it never writes to your league on its own.
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
          {season ? `Tracking “Survivor ${season}” on the wiki.` : "Set this before running the connector."}
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
              (add <code className="font-mono">--dry</code> to preview without filing). Needs{" "}
              <code className="font-mono">ANTHROPIC_API_KEY</code> set, since extraction uses Claude. Schedule it with
              Task Scheduler to have proposals waiting for you.
            </p>
          </div>

          {proposals.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No proposals waiting.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {proposals.map((p) => {
                const cast = p.payload.castaways ?? [];
                const tribes = p.payload.tribes ?? [];
                const existing = new Set(state.castaways.map((c) => c.name.trim().toLowerCase()));
                const newOnes = cast.filter((c) => !existing.has(c.name.trim().toLowerCase()));
                const withPhotos = cast.filter((c) => c.photoUrl).length;
                return (
                  <div key={p.id} className="rounded-md border border-border p-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{p.kind}</Badge>
                      <span className="text-sm font-semibold">
                        {newOnes.length} new castaway{newOnes.length === 1 ? "" : "s"}, {tribes.length} tribe
                        {tribes.length === 1 ? "" : "s"}
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
                    {/* Provenance: extraction is LLM-based, so what it read is part of the review. */}
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
                );
              })}
            </div>
          )}
        </>
      )}

      {note && <p className="mt-2 text-sm font-semibold text-good">{note}</p>}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
