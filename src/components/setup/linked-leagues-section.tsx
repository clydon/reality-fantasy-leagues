"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLeagueStore, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { confirm } from "@/lib/confirm-store";
import { Button } from "@/components/ui/button";

type Candidate = Awaited<ReturnType<typeof api.getLeagueLinks>>["candidates"][number];

// League Settings > Linked leagues (league-groups.ts): the same friends playing several leagues on
// one season can link them -- one shared chat, and revealing an episode in one reveals it in all.
// Everyone sees what this league is linked with; a commissioner of every league involved links and
// unlinks. Linking says first who'd newly share the conversation, so it's a choice, not a surprise.
export function LinkedLeaguesSection() {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const canManage = useCanManage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = mode === "live" && !!leagueId;
  const { data, refetch } = useQuery({
    queryKey: ["league-link", leagueId],
    queryFn: () => api.getLeagueLinks(leagueId!),
    enabled: live,
  });
  if (!live || !data) return null;
  const available = data.candidates.filter((c) => !c.problem);
  if (data.linked.length === 0 && (!canManage || data.candidates.length === 0)) return null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["chat-active-poll"] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function link(c: Candidate) {
    const lines = [
      `${c.name} will share this league's chat, and revealing an episode in one reveals it in both.`,
      c.joiningUs.length ? `New to this chat: ${c.joiningUs.join(", ")}.` : "",
      c.joiningThem.length ? `New to ${c.name}'s chat: ${c.joiningThem.join(", ")}.` : "",
    ].filter(Boolean);
    if (!(await confirm(lines.join("\n\n"), { title: `Link with ${c.name}?`, confirmLabel: "Link" }))) return;
    await run(() => api.linkLeague(leagueId!, c.id));
  }

  async function unlink() {
    if (!(await confirm("This league's chat goes back to just its own messages, and its reveals stop following the others.", { title: "Unlink this league?", confirmLabel: "Unlink", danger: true }))) return;
    await run(() => api.unlinkLeague(leagueId!));
  }

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Linked leagues</h3>
      {data.linked.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="flex-1">
            Shares its chat and reveals with <b>{data.linked.map((l) => l.name).join(", ")}</b>.
          </span>
          {canManage && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={unlink}>
              Unlink this league
            </Button>
          )}
        </div>
      ) : (
        <p className="mb-2 text-sm text-muted-foreground">
          Playing several leagues on this season with the same friends? Link them: one shared chat, and revealing an
          episode in one reveals it in all.
        </p>
      )}
      {canManage && data.candidates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {available.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-semibold">{c.name}</span>
              <Button size="sm" disabled={busy} onClick={() => link(c)}>
                Link
              </Button>
            </div>
          ))}
          {data.candidates
            .filter((c) => c.problem)
            .map((c) => (
              <div key={c.id} className="text-xs text-muted-foreground">
                <b>{c.name}</b> — {c.problem}
              </div>
            ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-destructive">{error}</p>}
    </div>
  );
}
