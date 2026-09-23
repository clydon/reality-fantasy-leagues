import type { LeagueState } from "@/lib/game/types";

// Thin fetch wrapper for the live Express API (see SurvivorDraft/server/routes/*.js). Requires
// that API's dev-only CORS middleware (server/index.js) to be running and configured to allow
// this app's origin -- see that repo's README/CLAUDE.md. `credentials: "include"` sends the
// session cookie; the API's CORS config must echo back this exact origin with
// `credentials: true` (not "*") for the browser to accept it.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8934";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface MeResponse {
  user: { id: string; username: string; isSuperAdmin: boolean };
  leagues: { id: string; name: string; join_code: string; role: string }[];
}

export interface LeagueStateResponse {
  league: { id: string; name: string };
  membership: unknown;
  state: LeagueState;
  playerAccounts: { player_id: string; role: string; username: string }[];
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<{ user: MeResponse["user"] }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiFetch<MeResponse>("/api/auth/me"),
  leagueState: (leagueId: string) =>
    apiFetch<LeagueStateResponse>(`/api/leagues/${leagueId}/state`),
};
