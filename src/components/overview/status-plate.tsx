"use client";

import { useCanManage, useLeagueStore, useMyPlayerId } from "@/lib/store";
import { statusPlate } from "@/lib/game/status-plate";
import { useNowMinute } from "@/components/episodes/episode-status";
import { CaptionPlate } from "@/components/ui/caption-plate";

// Overview's opener when nothing in this league needs you (docs/PLAN-ux-declutter.md, O1): the
// league's next beat on a caption plate in the alert strip's slot, its size, so the page keeps its
// shape. Its tag is quiet, never chyron: "now" stays the alert's colour. What it says is
// lib/game/status-plate.ts. Rendered by the alert strip (action-bar.tsx), which knows when it's empty.
export function StatusPlate() {
  const state = useLeagueStore((s) => s.state);
  const me = useMyPlayerId();
  const isCommissioner = useCanManage();
  const now = useNowMinute();
  const plate = statusPlate(state, { me, isCommissioner, now });
  if (!plate) return null;
  return (
    <CaptionPlate
      className="mb-4"
      size="sm"
      tone="quiet"
      tag={plate.tag}
      title={plate.title}
      subtitle={plate.detail}
      // A chevron, like the alert strip's: the whole plate is the link, and a word there would cost the
      // title its room on a phone. The word stays for screen readers.
      action={plate.href ? <span className="sr-only">{plate.action}</span> : undefined}
      href={plate.href}
    />
  );
}
