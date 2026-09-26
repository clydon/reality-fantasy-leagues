"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useIsSuperAdmin } from "@/lib/store";
import { DEFAULT_OVERVIEW_ORDER, type OverviewSectionId } from "./overview-layout";

export interface OverviewLayoutValue {
  order: OverviewSectionId[];
  hidden: Record<string, boolean>;
}

const DEFAULT_VALUE: OverviewLayoutValue = { order: DEFAULT_OVERVIEW_ORDER, hidden: {} };

function swap(order: OverviewSectionId[], id: OverviewSectionId, dir: -1 | 1): OverviewSectionId[] {
  const idx = order.indexOf(id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

// App-wide Overview layout: a super admin's reorder/hide choices, applied to every user's Overview
// (real leagues and demo mode alike) -- server state via react-query (db/migrations/
// 0027_app_settings.sql), not a per-browser preference. Every component that renders Overview reads
// through this same hook/queryKey, so an edit from the customize panel is visible immediately
// everywhere it's open, not just after a refetch.
//
// The three mutator functions silently no-op for anyone who isn't a super admin (mirroring the
// server's own requireSuperAdmin check) -- there's no UI that calls them otherwise, since
// overview-customize-panel.tsx itself is admin-only, but a stale client shouldn't be able to fire a
// PATCH that's just going to 403 anyway.
export function useOverviewLayout() {
  const queryClient = useQueryClient();
  const isSuperAdmin = useIsSuperAdmin();
  const { data, isLoading } = useQuery({
    queryKey: ["overview-layout"],
    queryFn: () => api.getOverviewLayout(),
    staleTime: 60_000,
  });
  const value: OverviewLayoutValue = (data?.layout as OverviewLayoutValue | null) ?? DEFAULT_VALUE;

  async function save(next: OverviewLayoutValue) {
    queryClient.setQueryData(["overview-layout"], { layout: next });
    try {
      await api.updateOverviewLayout(next.order, next.hidden);
    } catch (e) {
      // Roll the optimistic write back to whatever the server actually has.
      queryClient.invalidateQueries({ queryKey: ["overview-layout"] });
      throw e;
    }
  }

  function moveUp(id: OverviewSectionId) {
    if (!isSuperAdmin) return;
    save({ ...value, order: swap(value.order, id, -1) });
  }
  function moveDown(id: OverviewSectionId) {
    if (!isSuperAdmin) return;
    save({ ...value, order: swap(value.order, id, 1) });
  }
  function toggleHidden(id: OverviewSectionId) {
    if (!isSuperAdmin) return;
    save({ ...value, hidden: { ...value.hidden, [id]: !value.hidden[id] } });
  }
  function reset() {
    if (!isSuperAdmin) return;
    save(DEFAULT_VALUE);
  }

  return { order: value.order, hidden: value.hidden, isLoading, moveUp, moveDown, toggleHidden, reset };
}
