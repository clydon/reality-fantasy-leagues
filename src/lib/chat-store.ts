import { create } from "zustand";
import type { ChatMessage } from "@/lib/game/types";
import { useLeagueStore } from "@/lib/store";
import { api } from "@/lib/api";

// Chat lives in its own tables server-side (chat_messages/chat_reactions), not the JSONB league
// state, so it gets its own store rather than folding into useLeagueStore. Same mock-vs-live
// branch as everywhere else in this POC, read from useLeagueStore at call time rather than
// duplicating `mode`/`leagueId` here.
//
// No polling: this POC has no live-refresh anywhere yet (every tab fetches once via AuthGate),
// so Chat doesn't add a 5-second poll loop that nothing else here has either -- a manual Refresh
// button stands in for it. See README for the reasoning and what a real port would need.
export const DEMO_VISITOR_ID = "demo_visitor";

const MOCK_SEED: ChatMessage[] = [
  { id: "seed_1", user_id: null, author_name: "System", type: "system", text: "Welcome to the league chat! 👋", created_at: new Date(Date.now() - 3600_000).toISOString(), edited_at: null, reactions: {} },
  { id: "seed_2", user_id: "demo_p_annie", author_name: "Annie", type: "message", text: "draft's done, let's gooo 🔥", created_at: new Date(Date.now() - 3000_000).toISOString(), edited_at: null, reactions: { "🔥": { count: 1, userIds: ["demo_p_joey"] } } },
  { id: "seed_3", user_id: DEMO_VISITOR_ID, author_name: "You", type: "message", text: "I feel really good about my team ngl", created_at: new Date(Date.now() - 2900_000).toISOString(), edited_at: null, reactions: {} },
];

interface ChatStore {
  messages: ChatMessage[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  send: (text: string) => Promise<void>;
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  react: (id: string, emoji: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  loading: false,
  loaded: false,

  async load() {
    const { mode, leagueId } = useLeagueStore.getState();
    if (mode === "mock") {
      set({ messages: MOCK_SEED, loaded: true });
      return;
    }
    if (!leagueId) return;
    set({ loading: true });
    try {
      const { messages } = await api.getChat(leagueId);
      set({ messages, loaded: true });
    } finally {
      set({ loading: false });
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
