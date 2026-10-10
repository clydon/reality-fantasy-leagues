import { useEffect } from "react";
import { create } from "zustand";
import type { LeagueState } from "@/lib/game/types";
import StateLogic from "@/lib/game/state-logic.js";
import { useLeagueStore } from "@/lib/store";
import { useChatStore } from "@/lib/chat-store";
import {
  TOUR_BEN,
  TOUR_KAT,
  TOUR_LEAGUE_NAME,
  TOUR_ME,
  afterDraft,
  benLine,
  afterPickup,
  botsDraft,
  buildTourState,
  scriptEpisode,
  startPickups,
} from "./rise-and-fall";
import { PLAYER_TOUR } from "./steps";

// Which step of the guided tour is showing (null: no tour running). The steps themselves are
// steps.ts; the host plate that shows them is components/tour/tour-host.tsx; the league they run on is
// rise-and-fall.ts, in the store's mock mode (`touring`).
interface TourStore {
  step: number | null;
  /** The tour's league replaces whatever was showing, and the first step starts. */
  start: () => void;
  goTo: (step: number) => void;
  /** Skip or finish: the host leaves; the league stays to play with. */
  stop: () => void;
}

export const useTourStore = create<TourStore>((set) => ({
  step: null,
  start: () => {
    useLeagueStore.getState().startTour(buildTourState(), TOUR_LEAGUE_NAME, TOUR_ME);
    seedChat();
    set({ step: 0 });
  },
  goTo: (step) => set({ step }),
  stop: () => set({ step: null }),
}));

/** The step showing now, or null. */
export function useTourStep() {
  return useTourStore((s) => (s.step === null ? null : (PLAYER_TOUR[s.step] ?? null)));
}

/** True while the host is on screen: the Demo bar, alert strip and other urgency marks stand down. */
export function useTourRunning() {
  return useTourStore((s) => s.step !== null);
}

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

function seedChat() {
  const players = useLeagueStore.getState().fullState.players;
  useChatStore.setState({
    messages: [
      { id: "tour_1", user_id: null, author_name: "System", type: "system", text: "Welcome to the Rise & Fall league chat.", created_at: at(30), edited_at: null, reactions: {} },
      { id: "tour_2", user_id: TOUR_KAT, author_name: "Kat", type: "message", text: "good luck all, may your sponges rise 🧁", created_at: at(25), edited_at: null, reactions: {} },
    ],
    reads: players.map((p) => ({ userId: p.id, playerId: p.id, lastReadAt: at(25) })),
    loaded: true,
    unreadCount: 0,
    shownIds: [],
  });
}

function gloat(s: LeagueState) {
  const chat = useChatStore.getState();
  if (chat.messages.some((m) => m.id === "tour_gloat")) return;
  useChatStore.setState({
    messages: [
      ...chat.messages,
      { id: "tour_gloat", user_id: TOUR_BEN, author_name: "Ben", type: "message", text: benLine(s), created_at: at(0), edited_at: null, reactions: {} },
    ],
    unreadCount: chat.unreadCount + 1,
  });
}

const episode = (s: LeagueState, n: number) => s.episodes.find((e) => e.number === n);

// The rest of the league, reacting to what you did -- the steps advance on these state changes, not
// on clicks. Every rule is idempotent on the state, so running it again after its own change does
// nothing. Returns whether it changed the league.
function direct(s: LeagueState, seen: number): boolean {
  const turn = StateLogic.currentDraftTurn(s);
  if (turn && !turn.isComplete && turn.playerId !== TOUR_ME) {
    botsDraft(s);
    return true;
  }
  const ep1 = episode(s, 1);
  if (!turn?.isComplete || !ep1) return false;
  if (!ep1.lineups?.[TOUR_BEN]) {
    afterDraft(s);
    return true;
  }
  if (!StateLogic.episodeHasResults(ep1)) {
    // Episode 1 airs the moment your lineup is set.
    if ((ep1.lineups?.[TOUR_ME] ?? []).length < 2) return false;
    scriptEpisode(s, 1);
    return true;
  }
  if (seen < 1) return false;
  const pickedUp = s.castaways.some((c) => c.ownerIds.includes(TOUR_ME) && c.acquiredVia === "replenish");
  if (!pickedUp) {
    if (s.midSeason.replenish || StateLogic.replenishNeed(s, TOUR_ME) === 0) return false;
    startPickups(s);
    gloat(s);
    return true;
  }
  if (s.midSeason.replenish && !StateLogic.currentReplenishTurn(s)?.isComplete) return false;
  const ep2 = episode(s, 2);
  if (s.midSeason.replenish || (ep2 && !StateLogic.episodeHasResults(ep2))) {
    // Your pickup's in: Episode 2 airs.
    afterPickup(s);
    scriptEpisode(s, 2);
    return true;
  }
  return false;
}

/** Runs the tour league's other players and its broadcast schedule. Mounted once, in AuthGate. */
export function useTourDirector() {
  useEffect(() => {
    const run = () => {
      const st = useLeagueStore.getState();
      if (!st.touring) return;
      const full = st.fullState;
      if (direct(full, st.membership?.resultsSeenThrough ?? 0)) st.setState(full);
    };
    run();
    return useLeagueStore.subscribe(run);
  }, []);
}
