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
// step:  the plan's step that replaces it. Placeholders for whole screens are "0d" (hub and show space ported on
//        fixtures) or the step that builds that screen.
// title: what it is, in the words a player would use ("The TV guide"); the toast says "Coming soon: <title>".
// line:  what will be there, for the empty placeholder.

export interface PreviewEntry {
  step: string;
  title: string;
  line: string;
}

export const PREVIEWS = {
  // ---- the hub (ported in 0d; fixtures in src/new/fixtures/) ----
  "hub.notifications": { step: "15", title: "Notifications", line: "What's happened on your couch since you last looked." },
  "hub.couch-switcher": { step: "9", title: "Your couches", line: "Switch couches, start one, or invite people to this one." },
  "hub.profile": { step: "8", title: "Your numbers", line: "Titles, ranking points, your best show, your taste twin." },
  "hub.upnext-progress": { step: "1", title: "Who's set", line: "How many of the couch have made this episode's move." },
  "hub.watch-along": { step: "13", title: "Watch along", line: "Watch with the couch, live or on your own time." },
  "hub.on-now": { step: "13", title: "On now", line: "Who's watching right now, and joining them." },
  "hub.add-show": { step: "10", title: "Add a show", line: "Tell the couch what you're watching." },
  "hub.nudge": { step: "10", title: "You both watch", line: "A show you and someone on the couch watch, nobody's playing yet." },
  "hub.guide": { step: "11", title: "The TV guide", line: "This week on the couch, and the rest of TV." },
  "hub.streaming": { step: "14", title: "Streaming on the couch", line: "Shows without an airtime, at your own pace." },
  "hub.couch-watching": { step: "10", title: "The couch is watching", line: "What the couch watches that you don't, yet." },
  "hub.feed": { step: "8", title: "On the couch", line: "What the couch has been up to, and what they said." },
  "hub.grow-note": { step: "8", title: "What comes next", line: "More of the hub shows up as the couch plays." },
  "hub.get-going": { step: "9", title: "Get the couch going", line: "A new couch's first steps." },
  "hub.foot": { step: "9", title: "New league, Join a couch", line: "Start a game or join another couch." },
  "hub.rankings": { step: "8", title: "Power rankings", line: "Where everyone stands this year." },
  "hub.break": { step: "8", title: "Commercial break", line: "Every game on the couch." },
  "hub.numbers": { step: "8", title: "By the numbers", line: "Cast stats and couch accolades." },
  "hub.verdicts": { step: "8", title: "Couch verdicts", line: "How the couch rated each episode." },
  "hub.previously": { step: "8", title: "Previously on", line: "The story so far, up to where you are." },
  "hub.trophies": { step: "8", title: "Trophy shelf", line: "Every season the couch has finished." },

  // ---- a show space ----
  "show.tonight": {
    step: "0d",
    title: "Tonight",
    line: "Your moves for this episode as cards, extras this week, and when it's on.",
  },
  "show.episodes": { step: "0d", title: "Episodes", line: "This week's episode, then every episode with who went home." },
  "show.games": { step: "0d", title: "Games", line: "Your standings in each game, and this week's episode games." },
  "show.cast": { step: "0d", title: "Cast", line: "The cast by group, ranked by any stat, episode by episode." },
  "show.chat": { step: "0d", title: "Chat", line: "The couch's chat about this show, folded at where you are." },
  "show.how-it-works": {
    step: "0d",
    title: "How it works",
    line: "The show's premise, an episode as a rundown, the season, ways out, twists and what scores.",
  },
  "show.where": { step: "10", title: "Where you are", line: "Tell us how far you've watched; nothing past it shows." },
  "show.invite": { step: "9", title: "Invite to this show", line: "A code for this show; they join the couch too." },
  "show.start-game": { step: "10", title: "Start a game", line: "A season game or an episode game for this show." },
  "show.notifications": { step: "15", title: "Notifications for this show", line: "Lineup reminders, results, chat." },

  // ---- pushed over a show ----
  "show.waivers": { step: "6a", title: "Waivers", line: "Replace whoever's out, and swaps if your game allows them." },
  "show.draft": { step: "7", title: "The draft room", line: "Pick your team in turn; nobody's auto-picked." },
  "show.blind": { step: "7", title: "The blind draft", line: "Pick in private, then reveal together." },

  // ---- Backstage ----
  "backstage.needs": { step: "5", title: "Needs you", line: "The jobs waiting for whoever runs a game here." },
  "backstage.results": { step: "5", title: "Results", line: "How results get in, and what's applied to each game." },
  "backstage.history": { step: "5", title: "Recent changes", line: "Everything changed in these games, with undo." },
  "backstage.waivers": { step: "6a", title: "Waivers", line: "Open a waiver window, and how waivers run." },
  "backstage.rules": { step: "6a", title: "Scoring rules", line: "The rulebook these games follow, or the couch's own." },
  "backstage.members": { step: "6a", title: "Members & roles", line: "Who plays, who runs each game, join requests." },
  "backstage.settings": { step: "6a", title: "Game settings", line: "Lineup size, joining, lock it down, end a game." },

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
