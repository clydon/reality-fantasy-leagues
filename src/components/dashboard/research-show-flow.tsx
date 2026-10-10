"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FormatResearchPanel } from "@/components/admin/format-research-panel";
import { FormatReviewScreen } from "@/components/admin/format-review-screen";

// The create-league wizard's "+ Add it" tile (docs/PLAN-rollout-order.md stage 4): the same
// research-prompt-then-review loop Admin's "Research a new show" uses (admin/new-show-page.tsx), reused
// rather than forked, but self-serve -- any signed-in user, scoped to formats they created, and
// never able to switch an EXISTING show onto the result (see FormatReviewScreen's `allowExisting`
// and src/app/api/formats/[id]/create-show/route.ts for why that boundary holds). Always starts
// "researching": unlike Admin, there's no list of past drafts to show first.
export function ResearchShowFlow({
  onCreated,
  onCancel,
}: {
  onCreated: (show: { id: string; slug: string; name: string }) => void;
  onCancel: () => void;
}) {
  const [formatId, setFormatId] = useState<string | null>(null);

  const formatQuery = useQuery({
    queryKey: ["my-format", formatId],
    queryFn: () => api.getFormat(formatId!),
    enabled: !!formatId,
  });

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
