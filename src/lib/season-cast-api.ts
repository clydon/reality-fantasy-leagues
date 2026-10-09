import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LeagueState } from "@/lib/game/types";
import { ApiError } from "@/lib/api";
import { useLeagueStore } from "@/lib/store";

// The client half of a season's shared cast (docs/PLAN-universal-season-cast.md;
// src/app/api/leagues/[leagueId]/season-cast/route.ts, src/lib/server/season-cast-write.ts). Kept out
// of api.ts so the cast screens' calls sit together.

/** Which situation League Settings' cast controls are in -- mirrors season-cast-write.ts's CastMode. */
export type SeasonCastMode =
  | { kind: "own" }
  | { kind: "create"; seasonNumber: number }
  | {
      kind: "creating";
      seasonId: string;
      seasonNumber: number;
      tribesFromEpisode: number | null;
      tribesConfirmed: boolean;
      otherLeagues: number;
      cast: { id: string; name: string; tribeName: string | null }[];
    }
  | { kind: "shared"; seasonId: string; seasonNumber: number; reason: "admin" | "finished" | "other-league" | "under-review" };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const seasonCastApi = {
  mode: (leagueId: string) => call<SeasonCastMode>(`/api/leagues/${leagueId}/season-cast`),
  finish: (leagueId: string) =>
    call<LeagueState>(`/api/leagues/${leagueId}/season-cast`, { method: "POST", body: JSON.stringify({ action: "finish" }) }),
  setTribesHold: (leagueId: string, tribesFromEpisode: number | null) =>
    call<LeagueState>(`/api/leagues/${leagueId}/season-cast`, {
      method: "POST",
      body: JSON.stringify({ action: "tribes", tribesFromEpisode }),
    }),
  // "Import a cast" on a league with a season: as api.importCast, plus the starting-tribes answer (null =
  // public before the premiere, N = held until episode N, omitted = not asked).
  importCast: (leagueId: string, proposal: unknown, tribesFromEpisode?: number | null) =>
    call<{
      state: LeagueState;
      added: { tribes: string[]; castaways: string[]; skipped: string[] };
      roles: { recorded: string[]; unchanged: string[]; unresolved: string[] };
    }>(`/api/leagues/${leagueId}/castaways/import`, { method: "POST", body: JSON.stringify({ proposal, tribesFromEpisode }) }),
  // Admin > Shows & Seasons: fix one person in a season's cast, in place in every league on it.
  adminEdit: (
    seasonId: string,
    edit: { rename: { id: string; name: string } } | { photo: { id: string; photoUrl: string | null } } | { tribe: { id: string; tribeName: string | null } }
  ) => call<{ applied: unknown[] }>(`/api/admin/seasons/${seasonId}/cast`, { method: "PATCH", body: JSON.stringify(edit) }),
};

/**
 * The league's cast mode, live leagues only (a demo league's cast is always its own). `refresh` is
 * for after any cast write -- the first one turns "create" into "creating".
 */
export function useSeasonCastMode() {
  const leagueId = useLeagueStore((s) => s.leagueId);
  const mode = useLeagueStore((s) => s.mode);
  const qc = useQueryClient();
  const key = ["league-season-cast", leagueId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => seasonCastApi.mode(leagueId!),
    enabled: mode !== "mock" && !!leagueId,
  });
  const data: SeasonCastMode = query.data ?? { kind: "own" };
  return { mode: data, refresh: () => qc.invalidateQueries({ queryKey: key }) };
}
