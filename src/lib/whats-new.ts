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
    { icon: "🧭", title: "A helpful guide to what's next", detail: "A bar at the top shows what you still need to do, in any league. Tap it to go there." },
    { icon: "🙈", title: "No Spoilers! - Results stay hidden until you're ready", detail: "Tap “Results are in!” when you've watched. Rather see them right away? You can change this in Account settings." },
    { icon: "🔔", title: "Push notification reminders before each episode", detail: "If your lineup, pick or a prediction is still open. Turn on notifications in Account settings." },
    { icon: "📋", title: "Redesigned lineup screen", detail: "Spot empty slots, see your roster by tribe and how starters score — and everyone's starters on Overview." },
    { icon: "📊", title: "Redesigned scoreboard", detail: "What each castaway earned you, week by week." },
    { icon: "🔥", title: "New scoring: jury votes, fire-making, reward picks" },
  ] as { icon: string; title: string; detail?: string }[],
};
