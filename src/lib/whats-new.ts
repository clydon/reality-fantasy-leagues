// The one-time "What's New" popup's content (whats-new-modal.tsx). Each signed-in player sees a
// release once: dismissing it stores `id` on their account (user_settings.whats_new_seen), so it
// doesn't come back on another device. An account created after `date` skips it -- it's all new to
// them anyway.
//
// To announce the next batch: replace `id`, `date` and `items`. Written for players, not admins:
// one line each, most useful first, only what's worth interrupting someone for.
export const WHATS_NEW = {
  id: "2026-10-01",
  date: "2026-10-01",
  // A one-line title each; `detail` only where it earns a tap (shown behind a chevron), and short.
  items: [
    { title: "A bar now shows what needs you", detail: "Lineups, picks, predictions, draft turns and invites — from any league. Tap to go there." },
    { title: "Results stay hidden until you're ready", detail: "Tap “Results are in!” to see them. Turn this off in Account settings." },
    { title: "Reminders before each episode", detail: "If your lineup, pick or a prediction is still open." },
    { title: "Lineups lock when the episode airs", detail: "Your starters carry over week to week." },
    { title: "Redesigned lineup screen", detail: "Empty slots, your roster by tribe, and how starters score." },
    { title: "See everyone's starters", detail: "On the Overview board." },
    { title: "Clearer scoreboard", detail: "What each castaway earned you, week by week." },
    { title: "New scoring: jury votes, fire-making, reward picks" },
    { title: "“Bets” are now “Predictions”" },
    { title: "Lighter dark mode" },
  ] as { title: string; detail?: string }[],
};
