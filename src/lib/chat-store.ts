import { create } from "zustand";
import type { ChatMessage, ChatRead } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";

// Chat lives in its own tables server-side (chat_messages/chat_reactions), not the JSONB league
// state, so it gets its own store rather than folding into useLeagueStore. Same mock-vs-live
// branch as everywhere else in this POC, read from useLeagueStore at call time rather than
// duplicating `mode`/`leagueId` here.
//
// Polling: ChatTab itself polls every 5s while mounted (matches the live app's loadChatMessages
// interval); the unread badge shown elsewhere is updated by the same 15s poll that drives
// Notifications (use-league-poll.ts), exactly like pollForNotifications()'s own chat-unread check
// in public/app.js. lastSeenAt is in-memory only here, not localStorage-persisted per user+league
// like the original's chatSeenStorageKey() -- a real port would want that; this POC doesn't carry
// it across page reloads. See README.
export const DEMO_VISITOR_ID = "demo_visitor";

const MOCK_SEED: ChatMessage[] = [
  { id: "seed_1", user_id: null, author_name: "System", type: "system", text: "Welcome to the league chat! 👋", created_at: new Date(Date.now() - 3600_000).toISOString(), edited_at: null, reactions: {} },
  { id: "seed_2", user_id: "demo_p_annie", author_name: "Annie", type: "message", text: "draft's done, let's gooo 🔥", created_at: new Date(Date.now() - 3000_000).toISOString(), edited_at: null, reactions: { "🔥": { count: 1, userIds: ["demo_p_joey"] } } },
  { id: "seed_3", user_id: DEMO_VISITOR_ID, author_name: "You", type: "message", text: "I feel really good about my team ngl", created_at: new Date(Date.now() - 2900_000).toISOString(), edited_at: null, reactions: {} },
];

interface ChatStore {
  messages: ChatMessage[];
  /** Every member's read position, from the server (demo: everyone else has read the seed). */
  reads: ChatRead[];
  /** The newest message time already reported to the server, so markSeen doesn't re-post it. */
  reportedReadAt: string | null;
  loading: boolean;
  loaded: boolean;
  unreadCount: number;
  lastSeenAt: string | null;
  // Both return a real value (not implicit undefined) since they double as TanStack Query
  // queryFns (ChatTab's poll, and the background chat-unread poll respectively) -- a queryFn may
  // not resolve to undefined. Callers that just want the side effect can ignore the return.
  load: () => Promise<true>;
  pollUnread: () => Promise<number | null>;
  markSeen: () => void;
  send: (text: string) => Promise<void>;
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  react: (id: string, emoji: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  reads: [],
  reportedReadAt: null,
  loading: false,
  loaded: false,
  unreadCount: 0,
  lastSeenAt: null,

  async load() {
    const { mode, leagueId, state } = useLeagueStore.getState();
    if (mode === "mock") {
      // Demo: the other players have read the seeded conversation, so it shows "Read by all";
      // anything the visitor sends afterwards stays unread, which is honest -- nobody's there.
      const seededAt = MOCK_SEED[MOCK_SEED.length - 1].created_at;
      set({
        messages: MOCK_SEED,
        reads: state.players.map((p) => ({ userId: p.id, playerId: p.id, lastReadAt: seededAt })),
        loaded: true,
      });
      return true;
    }
    if (!leagueId) return true;
    set({ loading: true });
    try {
      const { messages, reads } = await api.getChat(leagueId);
      set({ messages, reads: reads ?? [], loaded: true });
      get().markSeen();
      return true;
    } finally {
      set({ loading: false });
    }
  },

  async pollUnread() {
    // TanStack Query's queryFn may not return undefined -- these two branches both return a
    // real value (rather than an implicit `undefined`) purely to satisfy that; the actual result
    // lives in this store's own state (unreadCount), same pattern as load() below.
    const { mode, leagueId, userId } = useLeagueStore.getState();
    if (mode !== "live" || !leagueId) return null;
    const { messages } = await api.getChat(leagueId);
    const lastSeenAt = get().lastSeenAt;
    const unread = messages.filter((m) => m.user_id !== userId && (!lastSeenAt || new Date(m.created_at) > new Date(lastSeenAt))).length;
    set({ unreadCount: unread });
    return unread;
  },

  markSeen() {
    const { messages, reportedReadAt } = get();
    const last = messages[messages.length - 1];
    set({ unreadCount: 0, lastSeenAt: last ? last.created_at : new Date().toISOString() });
    // Tell the server (for everyone else's "Read by"), once per new message rather than every poll.
    const { mode, leagueId } = useLeagueStore.getState();
    if (mode === "live" && leagueId && last && last.created_at !== reportedReadAt) {
      set({ reportedReadAt: last.created_at });
      api.markChatRead(leagueId, last.created_at).catch(() => set({ reportedReadAt }));
    }
  },

  async send(text) {
    const { mode, leagueId } = useLeagueStore.getState();
    if (mode === "mock") {
      set({
        messages: [
          ...get().messages,
          { id: "mock_msg_" + Date.now(), user_id: DEMO_VISITOR_ID, author_name: "You", type: "message", text, created_at: new Date().toISOString(), edited_at: null, reactions: {} },
        ],
      });
      return;
    }
    const { message } = await api.sendChatMessage(leagueId!, text);
    set({ messages: [...get().messages, message] });
  },

  async edit(id, text) {
    const { mode, leagueId } = useLeagueStore.getState();
    if (mode === "mock") {
      set({ messages: get().messages.map((m) => (m.id === id ? { ...m, text, edited_at: new Date().toISOString() } : m)) });
      return;
    }
    const { message } = await api.editChatMessage(leagueId!, id, text);
    set({ messages: get().messages.map((m) => (m.id === id ? message : m)) });
  },

  async remove(id) {
    const { mode, leagueId } = useLeagueStore.getState();
    if (mode !== "mock") await api.deleteChatMessage(leagueId!, id);
    set({ messages: get().messages.filter((m) => m.id !== id) });
  },

  async react(id, emoji) {
    const { mode, leagueId, userId } = useLeagueStore.getState();
    const mine = mode === "mock" ? DEMO_VISITOR_ID : userId;
    if (mode !== "mock") await api.reactToChatMessage(leagueId!, id, emoji);
    set({
      messages: get().messages.map((m) => {
        if (m.id !== id) return m;
        const reactions = { ...m.reactions };
        const bucket = reactions[emoji];
        if (bucket && mine && bucket.userIds.includes(mine)) {
          const userIds = bucket.userIds.filter((u) => u !== mine);
          if (userIds.length === 0) delete reactions[emoji];
          else reactions[emoji] = { count: userIds.length, userIds };
        } else if (mine) {
          const userIds = [...(bucket?.userIds || []), mine];
          reactions[emoji] = { count: userIds.length, userIds };
        }
        return { ...m, reactions };
      }),
    });
  },
}));
