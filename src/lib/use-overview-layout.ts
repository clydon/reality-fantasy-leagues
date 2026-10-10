"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useIsSuperAdmin } from "@/lib/store";
import { defaultOverviewOrder, withNewSections, type OverviewLeagueTypeId, type OverviewSectionId } from "./overview-layout";

export interface OverviewLayoutValue {
  order: OverviewSectionId[];
  hidden: Record<string, boolean>;
}

function swap(order: OverviewSectionId[], id: OverviewSectionId, dir: -1 | 1): OverviewSectionId[] {
  const idx = order.indexOf(id);
  const target = idx + dir;
  if (idx < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

// App-wide Overview layout, ONE PER LEAGUE TYPE (see overview-layout.ts's OVERVIEW_LEAGUE_TYPE_IDS
// comment for why one shared layout doesn't fit all three): a super admin's reorder/hide choices,
// applied to every user's Overview of THIS league type, real leagues and demo mode alike -- server
// state via react-query (db/migrations/0027_app_settings.sql), not a per-browser preference.
//
// Every component that renders Overview calls this with the CURRENT league's type and reads through
// the same underlying query (one fetch covers all 3 types), so an edit from the customize panel is
// visible immediately everywhere it's open, not just after a refetch -- including if the demo bar's
// game-type dropdown switches to the type just edited.
//
// The three mutator functions silently no-op for anyone who isn't a super admin (mirroring the
// server's own requireSuperAdmin check) -- there's no UI that calls them otherwise, since
// overview-customize-panel.tsx itself is admin-only, but a stale client shouldn't be able to fire a
// PATCH that's just going to 403 anyway.
export function useOverviewLayout(leagueTypeId: OverviewLeagueTypeId) {
  const queryClient = useQueryClient();
  const isSuperAdmin = useIsSuperAdmin();
  const { data, isLoading } = useQuery({
    queryKey: ["overview-layout"],
    queryFn: () => api.getOverviewLayout(),
    staleTime: 60_000,
  });
  const saved = data?.layouts?.[leagueTypeId] as OverviewLayoutValue | undefined;
  const defaults: OverviewLayoutValue = { order: defaultOverviewOrder(leagueTypeId), hidden: {} };
  const value: OverviewLayoutValue = saved ? { ...saved, order: withNewSections(saved.order, leagueTypeId) } : defaults;

  async function save(next: OverviewLayoutValue) {
    queryClient.setQueryData(["overview-layout"], (prev: { layouts?: Record<string, OverviewLayoutValue> } | undefined) => ({
      layouts: { ...prev?.layouts, [leagueTypeId]: next },
    }));
    try {
      await api.updateOverviewLayout(leagueTypeId, next.order, next.hidden);
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
    save(defaults);
  }

  return { order: value.order, hidden: value.hidden, isLoading, moveUp, moveDown, toggleHidden, reset };
}
