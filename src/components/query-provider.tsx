"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// One QueryClient per browser session, created in useState (not module scope) so a value isn't
// accidentally shared across requests during SSR -- the standard Next.js App Router pattern.
// TanStack Query here is purely the polling mechanism (refetchInterval, pause when the tab is
// hidden, request dedup) for Notifications/Chat -- see use-league-poll.ts and chat-tab.tsx. It
// does not replace useLeagueStore as the source of truth the rest of this app reads from; that
// stays a deliberate, documented choice (see docs/HANDOFF.md's library-choice reasoning).
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
