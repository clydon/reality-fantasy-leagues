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
// (the More menu on a phone; the full list on desktop, which has no More menu). Anything else is a
// page path ("/scoreboard").
//
// When a new item makes an older one wrong (the feature it announced is gone or works the opposite
// way now), delete the OLD ITEM -- never its release. A player's "last seen" is a release id, and
// one that no longer exists reads as "never seen anything", re-showing every release. A release
// left with no items is fine.
export type WhatsNewItem = { icon: string; title: string; detail?: string; link?: { label: string; to: "whatsNewMenu" | "/scoreboard" } };
export type WhatsNewRelease = { id: string; date: string; items: WhatsNewItem[] };

export const RELEASES: WhatsNewRelease[] = [
  {
    id: "2026-10-16",
    date: "2026-10-16",
    items: [
      {
        icon: "🔄",
        title: "Pickups are now waivers: no more waiting your turn",
        detail:
          "When you're owed a pickup, choose it in private: anyone still in the game who isn't already yours. Everyone's choices go through at once the day before the next episode. Swaps are now called add/drops.",
      },
    ],
  },
  {
    id: "2026-10-11b",
    date: "2026-10-11",
    items: [
      {
        icon: "🎮",
        title: "Try a practice round",
        detail: "Play a 2-minute practice game with your league's real cast and rules, against computer players, with made-up results. Find it at the end of \"How this league works\", or in More.",
      },
    ],
  },
  {
    id: "2026-10-11",
    date: "2026-10-11",
    items: [
      {
        icon: "⏪",
        title: "Friends can join after the season starts",
        detail: "Someone who joins late picks an episode to start from, drafts a team, and catches up one episode at a time without spoilers. Your commissioner adds them to the league when they're ready.",
      },
      {
        icon: "🔎",
        title: "Research has its own tab",
        detail: "See how every cast member is scoring, who's still a free agent and who's on each team, right from the tab bar.",
      },
      {
        icon: "🧭",
        title: "Take the tour",
        detail: "A three-minute walk through a season on a made-up baking show, as a player or as a commissioner. It's under More.",
        link: { label: "Show me", to: "whatsNewMenu" },
      },
    ],
  },
  {
    id: "2026-10-10",
    date: "2026-10-10",
    items: [
      {
        icon: "📺",
        title: "A whole new look",
        detail: "The app is redesigned top to bottom: easier to read on your phone, in light and dark. A cleaner Overview, a page for every episode and every team, and simpler league setup for commissioners.",
      },
      {
        icon: "🎬",
        title: "Reveal results one moment at a time",
        detail: "When you're ready, tap through each challenge, who went home, then how your team did.",
      },
    ],
  },
  {
    id: "2026-10-03",
    date: "2026-10-03",
    items: [
      {
        icon: "📂",
        title: "Linked leagues sit together in your league list",
        detail: "Leagues that share a chat are grouped under one name. Tap the group to see its leagues.",
      },
    ],
  },
  {
    id: "2026-10-02e",
    date: "2026-10-02",
    items: [
      {
        icon: "🗞️",
        title: "What your week meant, in a line",
        detail: "After each episode, every team on the Scoreboard gets a short line on what set its week apart. Yours shows on Overview too.",
        link: { label: "Show me", to: "/scoreboard" },
      },
      { icon: "🔍", title: "Tap a photo for a closer look", detail: "Not sure who's who? Tap a cast member's photo to see it full size." },
      {
        icon: "🤖",
        title: "Computer players",
        detail: "Commissioners can add bots to a league, from Casual to Sharp. They draft, set lineups and make picks on their own.",
      },
      {
        icon: "🗡️",
        title: "New Traitors scoring",
        detail: "Points for the Round Table (catching a Traitor, leading the case, a Traitor sacrificing a partner), murder shortlists and mission moments. Winning is worth 6, so one finale can't decide your league.",
      },
    ],
  },
  {
    id: "2026-10-02d",
    date: "2026-10-02",
    items: [
      {
        icon: "🎯",
        title: "Your best calls, on the Scoreboard",
        detail: "Your scoreboard card calls out a standout start, a costly one and a smart benching, and gives you a Perfect lineup when you start your best possible team.",
        link: { label: "Show me", to: "/scoreboard" },
      },
      {
        icon: "📈",
        title: "See who's catching up",
        detail: "The small ▲ or ▼ under each total is how much the last episode gained or lost that team on 1st place.",
      },
    ],
  },
  {
    id: "2026-10-02c",
    date: "2026-10-02",
    items: [
      { icon: "🎬", title: "Episodes now open with a recap", detail: "Who won reward and immunity, and who went home, at a glance." },
      {
        icon: "🪑",
        title: "See what your bench would have scored",
        detail: "Each episode shows everyone's starters and their points, plus the bench players who would have scored.",
      },
    ],
  },
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
