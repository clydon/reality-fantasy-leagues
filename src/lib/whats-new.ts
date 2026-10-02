// The one-time "What's New" popup's content (whats-new-modal.tsx). Releases, newest first. Each
// signed-in player sees every release newer than the last one they dismissed (stored on their
// account: user_settings.whats_new_seen), so someone who missed one still hears about it -- and none
// comes back on another device. An account created after a release's `date` skips it: it's all new
// to them anyway.
//
// To announce the next batch: add a release at the TOP with a new `id`. Written for players, not
// admins: a one-line title each, `detail` only where it earns a tap (shown behind a chevron) and
// short, most useful first, only what's worth interrupting someone for.
// `link`: a "Show me" under the item that takes you to it. "whatsNewMenu" = where What's New lives
// (the More menu on a phone; the full list on desktop, which has no More menu).
export type WhatsNewItem = { icon: string; title: string; detail?: string; link?: { label: string; to: "whatsNewMenu" } };
export type WhatsNewRelease = { id: string; date: string; items: WhatsNewItem[] };

export const RELEASES: WhatsNewRelease[] = [
  {
    id: "2026-10-02b",
    date: "2026-10-02",
    items: [
      {
        icon: "🗂️",
        title: "Catch up on every update, any time",
        detail: "It's in the More menu, under What's new.",
        link: { label: "Show me", to: "whatsNewMenu" },
      },
    ],
  },
  {
    id: "2026-10-02",
    date: "2026-10-02",
    items: [{ icon: "👆", title: "Swipe between your leagues", detail: "Swipe left or right to flip to the same page in your other leagues." }],
  },
  {
    id: "2026-10-01b",
    date: "2026-10-01",
    items: [
      { icon: "💬", title: "Your leagues now share one chat" },
      { icon: "👀", title: "See who's caught up", detail: "Chat shows when someone reveals an episode, so you know what's safe to talk about." },
      { icon: "⚡", title: "Reveal once, see it in every league" },
      { icon: "🎯", title: "Predictions are worth 1 to 3 points" },
    ],
  },
  {
    id: "2026-10-01",
    date: "2026-10-01",
    items: [
      { icon: "🧭", title: "A helpful guide to what's next", detail: "A bar at the top shows what you still need to do, in any league. Tap it to go there." },
      { icon: "🙈", title: "No Spoilers! - Results stay hidden until you're ready", detail: "Tap “Results are in!” when you've watched. Rather see them right away? You can change this in Account settings." },
      { icon: "🔔", title: "Push notification reminders before each episode", detail: "If your lineup, pick or a prediction is still open. Turn on notifications in Account settings." },
      { icon: "📋", title: "Redesigned lineup screen", detail: "Spot empty slots, see your roster by tribe and how starters score — and everyone's starters on Overview." },
      { icon: "📊", title: "Redesigned scoreboard", detail: "What each castaway earned you, week by week." },
      { icon: "🔥", title: "New scoring: jury votes, fire-making, reward picks" },
    ],
  },
];

/** The newest release's id -- what dismissing the popup records. */
export const LATEST_RELEASE_ID = RELEASES[0].id;

/**
 * What a player hasn't seen yet: every release newer than the one they last dismissed, minus any
 * that came out before their account was made. Newest first.
 */
export function unseenItems(lastSeen: string | null, accountCreatedAt: string | null): WhatsNewItem[] {
  const seenIdx = lastSeen ? RELEASES.findIndex((r) => r.id === lastSeen) : -1;
  const newer = seenIdx === -1 ? RELEASES : RELEASES.slice(0, seenIdx);
  const joined = accountCreatedAt ? accountCreatedAt.slice(0, 10) : null;
  return newer.filter((r) => !joined || joined <= r.date).flatMap((r) => r.items);
}
