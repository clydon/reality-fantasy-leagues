"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { StoredFormat } from "@/lib/game/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm-store";
import { FormatResearchPanel } from "./format-research-panel";
import { FormatReviewScreen } from "./format-review-screen";

// "Research a new show" (docs/PLAN-stage-3-format-proposals.md step 3), sitting next to "Add a show"
// in Admin -- Shows & Seasons: research a show with any web-searching chat, review and edit the
// proposal, then approve it into a show (new or existing). Self-contained so shows-section.tsx just
// mounts it; everything else lives here and in format-research-panel.tsx / format-review-screen.tsx.
export function FormatsPanel() {
  const [open, setOpen] = useState(false);
  const [researching, setResearching] = useState(false);
  const [openFormatId, setOpenFormatId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, refetch } = useQuery({ queryKey: ["admin-formats"], queryFn: () => api.adminListFormats(), enabled: open });
  const queryClient = useQueryClient();
  const formats = data?.formats ?? [];

  const openFormatQuery = useQuery({
    queryKey: ["admin-format", openFormatId],
    queryFn: () => api.adminGetFormat(openFormatId!),
    enabled: !!openFormatId,
  });

  function closeReview() {
    setOpenFormatId(null);
  }

  async function onReviewChanged() {
    await refetch();
    if (openFormatId) await queryClient.invalidateQueries({ queryKey: ["admin-format", openFormatId] });
  }

  async function deleteFormat(f: { id: string; name: string }) {
    const ok = await confirm(`Delete "${f.name}"? This can't be undone.`, { danger: true, confirmLabel: "Delete" });
    if (!ok) return;
    setBusyId(f.id);
    setError(null);
    try {
      await api.adminDeleteFormat(f.id);
      if (openFormatId === f.id) setOpenFormatId(null);
      await refetch();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusyId(null);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          setResearching(true);
        }}
      >
        Research a new show
      </Button>
    );
  }

  const openFormat: StoredFormat | undefined = openFormatQuery.data?.format;

  return (
    <div className="rounded-md border border-border bg-secondary/20 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-[0.7rem] font-bold uppercase tracking-wide text-muted-foreground">Researched show formats</h4>
        <Button variant="secondary" size="xs" className="ml-auto" onClick={() => setOpen(false)}>
          Hide
        </Button>
      </div>

      {openFormat ? (
        <FormatReviewScreen format={openFormat} onClose={closeReview} onChanged={onReviewChanged} />
      ) : (
        <>
          {researching ? (
            <div className="mt-2">
              <FormatResearchPanel
                onCreated={(f) => {
                  setResearching(false);
                  setOpenFormatId(f.id);
                  refetch();
                }}
                onCancel={() => setResearching(false)}
              />
            </div>
          ) : (
            formats.length > 0 && (
              <div className="mt-2">
                <Button variant="secondary" size="xs" onClick={() => setResearching(true)}>
                  + Research another show
                </Button>
              </div>
            )
          )}

          {formats.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {formats.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs">
                  <b>{f.name}</b>
                  <Badge variant={f.status === "approved" ? "default" : "secondary"} className="text-[0.6rem]">
                    {f.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    v{f.version} · {f.showCount} show{f.showCount === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <Button variant="secondary" size="xs" disabled={busyId === f.id} onClick={() => setOpenFormatId(f.id)}>
                      Open
                    </Button>
                    <Button variant="destructive" size="xs" disabled={busyId === f.id} onClick={() => deleteFormat(f)}>
                      Delete
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-1.5 font-semibold text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
