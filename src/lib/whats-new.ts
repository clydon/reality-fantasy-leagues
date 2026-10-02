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
    { title: "Never miss a pick", detail: "A bar at the top shows anything waiting on you, in any league. Tap it to go there." },
    { title: "No Spoilers! - Results stay hidden until you're ready", detail: "Tap “Results are in!” to see them. Turn this off in Account settings." },
    { title: "Push notification reminders before each episode", detail: "If your lineup, pick or a prediction is still open. Turn on notifications in Account settings." },
    { title: "Redesigned lineup screen", detail: "Spot empty slots, see your roster by tribe and how starters score — and everyone's starters on Overview." },
    { title: "Redesigned scoreboard", detail: "What each castaway earned you, week by week." },
    { title: "New scoring: jury votes, fire-making, reward picks" },
  ] as { title: string; detail?: string }[],
};
