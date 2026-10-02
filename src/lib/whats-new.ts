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
  items: [
    { title: "What needs you, at a glance", detail: "A bar at the top lists anything waiting on you in any league — lineup, pick, prediction, draft turn or invite. Tap to go there." },
    { title: "No more spoilers", detail: "New results stay hidden until you tap “Results are in!”. Turn it off in Account settings." },
    { title: "Episode reminders", detail: "A heads-up a day and 2 hours before an episode airs if your lineup, pick or a prediction is still open." },
    { title: "Lineups lock at air time", detail: "Change your lineup any time until the episode starts. Starters carry over each week." },
    { title: "New lineup screen", detail: "Empty slots are easy to spot, your roster is grouped by tribe, and “How starters score” shows what each event is worth." },
    { title: "See everyone's starters", detail: "The Board on Overview shows who each player is starting this week." },
    { title: "Clearer scoreboard", detail: "See what each castaway earned you, week by week — including what your benched players would have scored." },
    { title: "Scoring updates", detail: "Every jury vote at Final Tribal now scores, plus winning fire-making and being picked for a reward." },
    { title: "“Bets” are now “Predictions”", detail: "Same thing, better name." },
    { title: "Easier on the eyes", detail: "A lighter dark mode, and a season-results card when it's all over." },
  ],
};
