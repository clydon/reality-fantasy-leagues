// The Preview registry (docs/PLAN-new-design.md, "The Preview system"): every piece of the new design that isn't on
// real data yet, with the step that makes it real. A screen wraps such a piece in <Preview id="...">
// (src/new/ui/preview.tsx), which draws a dashed outline and a "Preview" tag and turns its taps into a "Coming
// soon" toast. Each step deletes its entries (and its fixtures in src/new/fixtures/) as it lands; at step C this
// file is empty and goes, with the component and the fixtures folder.
//
// `node scripts/dev-test/check-preview.js` lists what's still previewed per step, and fails when a step marked
// done in the plan's Status still has entries here, or an entry is never used (or a <Preview> names one that
// isn't here).
//
// step:  the plan's step that replaces it: the step that builds that screen, or makes that part real.
// title: what it is, in the words a player would use ("The TV guide"); the toast says "Coming soon: <title>".
// line:  what will be there, for the empty placeholder.

export interface PreviewEntry {
  step: string;
  title: string;
  line: string;
}

export const PREVIEWS = {
  // ---- the hub (ported in 0d; fixtures in src/new/fixtures/; its status line, Up next, your shows, the feed, your
  // numbers and More on the couch's pages are real since step 8) ----
  "hub.notifications": { step: "15", title: "Notifications", line: "What's happened on your couch since you last looked." },
  "hub.couch-switcher": { step: "9", title: "Your couches", line: "Switch couches, start one, or invite people to this one." },
  "hub.taste-twin": { step: "12", title: "Your taste twin", line: "Who on the couch rates episodes most like you." },
  "hub.watch-along": { step: "13", title: "Watch along", line: "Watch with the couch, live or on your own time." },
  "hub.on-now": { step: "13", title: "On now", line: "Who's watching right now, and joining them." },
  "hub.add-show": { step: "10", title: "Add a show", line: "Tell the couch what you're watching." },
  "hub.nudge": { step: "10", title: "You both watch", line: "A show you and someone on the couch watch, nobody's playing yet." },
  "hub.guide": { step: "11", title: "The TV guide", line: "This week on the couch, and the rest of TV." },
  "hub.streaming": { step: "14", title: "Streaming on the couch", line: "Shows without an airtime, at your own pace." },
  "hub.couch-watching": { step: "10", title: "The couch is watching", line: "What the couch watches that you don't, yet." },
  "hub.get-going": { step: "9", title: "Get the couch going", line: "A new couch's first steps." },
  "hub.foot": { step: "9", title: "New league, Join a couch", line: "Start a game or join another couch." },
  "hub.verdicts": { step: "12", title: "Couch verdicts", line: "How the couch rated each episode." },
  "hub.episode-games": { step: "12", title: "This week's games", line: "Bingo, Who goes home?, polls and trivia, one night each." },
  "hub.start-game": { step: "10", title: "Start a game", line: "A season game, bingo, a poll or trivia. Anyone on the couch can." },

  // ---- a show space (ported in 0d; fixtures in src/new/fixtures/) ----
  "show.episode-games": { step: "12", title: "This week's games", line: "Bingo, Who goes home? and trivia for each episode." },
  "show.make-it-a-game": { step: "10", title: "Make it a game", line: "Play this show with your couch." },
  "show.watch-along": { step: "13", title: "Watch along", line: "Watch with the couch, live or on your own time." },
  "show.where": { step: "10", title: "Where you are", line: "Tell us how far you've watched; nothing past it shows." },
  "show.invite": { step: "9", title: "Invite to this show", line: "A code for this show; they join the couch too." },
  "show.start-game": { step: "10", title: "Start a game", line: "A season game or an episode game for this show." },
  "show.notifications": { step: "15", title: "Notifications for this show", line: "Lineup reminders, results, chat." },

  // ---- Backstage (Results and Recent changes are real since step 5; Waivers, Scoring rules, Members & roles and Game
  // settings since 6a; How results get in since 6c) ----
  "backstage.end-game": { step: "10", title: "Archive or delete a game", line: "Keep it on the trophy shelf and stop scoring, or remove it for everyone." },

  // ---- you ----
  "settings.profile": { step: "15", title: "Your profile", line: "Your name, picture and colour." },
  "settings.account": {
    step: "15",
    title: "Account settings",
    line: "Notifications by moment, spoiler safety, your preferred AI, appearance and help.",
  },
  "settings.couches": { step: "9", title: "Your couches", line: "The couches you're on, and leaving one." },

  // ---- getting in ----
  "start.steps": { step: "9", title: "First run", line: "Pick your shows, say where you are, save them, bring your people." },
  "join.couch": { step: "9", title: "Joining a couch", line: "The couch you're invited to, then where you are in its shows." },
} satisfies Record<string, PreviewEntry>;

export type PreviewId = keyof typeof PREVIEWS;
