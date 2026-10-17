import { create } from "zustand";

// A commissioner who applies an episode's results lands on that episode's page (episode-results-page.tsx
// replaces to it). This is the one-shot word between the two, so the page can confirm what just happened
// instead of arriving silently: how many results went in. In memory only, so a reload or a later visit
// shows nothing.
export const useAppliedResults = create<{ applied: { episode: number; count: number } | null }>(() => ({ applied: null }));

/** Called just before replacing to the episode's page. */
export function noteApplied(episode: number, count: number): void {
  useAppliedResults.setState({ applied: { episode, count } });
}

/** What was just applied to this episode, if anything -- read without clearing, so a re-run render sees it too. */
export function peekApplied(episode: number): number | null {
  const a = useAppliedResults.getState().applied;
  return a && a.episode === episode ? a.count : null;
}

export function clearApplied(): void {
  useAppliedResults.setState({ applied: null });
}
