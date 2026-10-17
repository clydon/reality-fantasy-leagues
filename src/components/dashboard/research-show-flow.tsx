"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FormatResearchPanel } from "@/components/admin/format-research-panel";
import { FormatReviewScreen } from "@/components/admin/format-review-screen";
import { TourFormatReview } from "@/components/tour/tour-format-review";
import { tourMark } from "@/lib/tour/tour-store";
import type { StoredFormat } from "@/lib/game/types";

// The create-league wizard's "+ Add it" tile (docs/PLAN-rollout-order.md stage 4): the same
// research-prompt-then-review loop Admin's "Research a new show" uses (admin/new-show-page.tsx), reused
// rather than forked, but self-serve -- any signed-in user, scoped to formats they created, and
// never able to switch an EXISTING show onto the result (see FormatReviewScreen's `allowExisting`
// and src/app/api/formats/[id]/create-show/route.ts for why that boundary holds). Always starts
// "researching": unlike Admin, there's no list of past drafts to show first.
export function ResearchShowFlow({
  onCreated,
  onCancel,
  tour,
}: {
  onCreated: (show: { id: string; slug: string; name: string }) => void;
  onCancel: () => void;
  /** The commissioner's tour: nothing is sent or saved. The answer is read, and the rules shown for approval. */
  tour?: boolean;
}) {
  const [formatId, setFormatId] = useState<string | null>(null);
  const [tourRead, setTourRead] = useState(false);

  const formatQuery = useQuery({
    queryKey: ["my-format", formatId],
    queryFn: () => api.getFormat(formatId!),
    enabled: !!formatId,
  });

  if (tour) {
    if (tourRead) return <TourFormatReview onApprove={() => onCreated({ id: "tour", slug: "survivor", name: "Survivor" })} />;
    return (
      <FormatResearchPanel
        tour
        promptFn={async (q) => ({ prompt: tourFormatPrompt(q.name) })}
        createFn={async () => {
          tourMark("add-created");
          setTourRead(true);
          return { format: { id: "tour" } as unknown as StoredFormat };
        }}
        onCreated={() => {}}
        onCancel={onCancel}
      />
    );
  }

  if (!formatId) {
    return (
      <FormatResearchPanel
        promptFn={api.formatPrompt}
        createFn={api.createFormat}
        onCreated={(f) => setFormatId(f.id)}
        onCancel={onCancel}
      />
    );
  }

  if (formatQuery.isLoading || !formatQuery.data) {
    return <p className="text-xs italic text-muted-foreground">Loading…</p>;
  }

  return (
    <FormatReviewScreen
      format={formatQuery.data.format}
      saveFn={api.saveFormat}
      approveFn={(id, body) => api.createShowFromFormat(id, { domains: body.domains })}
      allowExisting={false}
      onClose={onCancel}
      onChanged={() => formatQuery.refetch()}
      onShowCreated={onCreated}
    />
  );
}

// A short stand-in for the long prompt the server builds: enough to read, and to copy.
function tourFormatPrompt(name: string): string {
  return [
    `Research the rules of the TV show "${name}" and describe how a fantasy game on it could be scored.`,
    "",
    "RULES",
    "  - Search for the show's wiki and recent recaps. Name every page you actually read in sources.",
    "  - List what happens each episode that is worth points (wins, safe, eliminated...), with a suggested value.",
    "  - Don't guess. Leave out anything you haven't seen reported.",
    "",
    "Answer with ONE JSON object and nothing else.",
  ].join("\n");
}
