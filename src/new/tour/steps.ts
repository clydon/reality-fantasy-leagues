// The first-time tour's steps (docs/PLAN-first-time-tour.md version 3, the user's own outline, 2026-11-01): welcome (what the app is,
// its three ideas), what needs you up top, then down Home a section at a time (one step, a beat each: Your shows, This week on the
// couch, On the couch, More on the couch), then hands on, back from the top: the top line to your moves for real, adding a show,
// flipping a show over to your games, the TV guide's filters, the reveal, starting a game; and you're set. Five are tried for real
// (`act`), three of them as practice runs that save nothing (watching/sheets.tsx, show/reveal.tsx TourReveal, couch/start-game.tsx).
//
// Each step lights the first of its `targets` that's on Home (a CSS selector), or with `union` every one of them together; none:
// nothing lit, its words stand on their own. On a step with an `act` the person taps the real thing that's lit; the plate's Try it
// (where Next is on the others) only shakes it (`tap`, when that's part of what's lit), and the skip pill moves on without it
// (tour.tsx). `play`: what's lit that takes taps of its own (the guide's filter switch). `part`: beats under one number, left out
// (`optional`) when the section isn't on this Home.

export type StepId = "welcome" | "home" | "shows" | "week" | "feed" | "more" | "moves" | "add" | "flip" | "guide" | "reveal" | "start" | "done";

/** What this phone can do about reminders (settings/notify.tsx PhoneState): only these two ask. */
export type TourReminders = "off" | "install" | null;

export type TourAct = "moves" | "add" | "flip" | "reveal" | "start";

export interface TourStep {
  id: StepId;
  title: string;
  line: string;
  /** Where it is on Home, in order of preference. */
  targets: string[];
  /** Light all of `targets` found, as one. */
  union?: boolean;
  /** One of a few beats under one number (Down Home), each a section of its own. */
  part?: string;
  /** Left out when it isn't on this Home as the tour starts (a section this Home hasn't got). */
  optional?: boolean;
  /** Its real thing to tap: the plate's words for Try it (in Next's place) and the skip pill's. */
  act?: { kind: TourAct; label: string; skip: string };
  /** What Try it shakes, inside what's lit (a show's flip corner); else all that's lit. */
  tap?: string;
  /** What's lit that takes taps of its own, through the tour (the guide's filters). */
  play?: string;
}

export interface TourContext {
  solo: boolean;
  reminders: TourReminders;
  /** The show the practice adds ("The Amazing Race"), when there's one to add. */
  show: string | null;
  /** Something of yours to reveal again; else a made-up one. */
  replay: boolean;
  /** The top line goes somewhere (a move due, results in), so the moves step goes there for real. */
  moves: boolean;
  /** A show on your shelf turns over to your games (it has the corner). */
  flip: boolean;
}

export function tourSteps({ solo, reminders, show, replay, moves, flip }: TourContext): TourStep[] {
  const steps: TourStep[] = [
    { id: "welcome", title: "Welcome", line: "Watch with your people. Make any show a game.", targets: [] },
    { id: "home", title: "Your Home", line: "What needs you is always up top.", targets: ["[data-status]", "[data-upnext]"], union: true },
    // Down Home (the user, 2026-11-01): a beat a section, in Home's order, Next from one to the next.
    { id: "shows", part: "down", optional: true, title: "Your shows", line: "Every show you watch, game or not.", targets: ["[data-your-shows]"] },
    {
      id: "week",
      part: "down",
      optional: true,
      title: solo ? "This week" : "This week on the couch",
      line: solo ? "What's on, night by night." : "What's on, night by night, for you and your couch.",
      targets: ["[data-guide]"],
    },
    { id: "feed", part: "down", optional: true, title: "On the couch", line: "What everyone's up to: picks, results, chat.", targets: ["[data-feed-list]"] },
    { id: "more", part: "down", optional: true, title: "More on the couch", line: "Rankings, every game and the numbers, when you want them.", targets: ["[data-more-couch]"] },
    // Back up top, hands on: the line goes to the moves you need to make, for real (the tour waits: tour/back.tsx).
    moves
      ? { id: "moves", title: "Your moves", line: "Tap the top line: it takes you straight to what needs you.", targets: ["[data-status]"], act: { kind: "moves", label: "Try it", skip: "Skip this step" } }
      : { id: "moves", title: "Your moves", line: "When something needs you, it shows up here. Tap it to go straight there.", targets: ["[data-status]", "[data-upnext]"] },
    {
      id: "add",
      title: "Add a show",
      line: show ? `Let's add ${show}. Practice: it won't show up.` : "Add any show you watch. Practice: it won't show up.",
      targets: ["[data-add-show-poster]", "[data-guide-add]"],
      act: { kind: "add", label: "Try it", skip: "Skip adding a show" },
    },
    ...(flip
      ? [
          {
            id: "flip" as const,
            title: "Flip a show",
            line: "Tap a show's corner to see your games on it.",
            targets: ["[data-poster]:has([data-flip])"],
            tap: "[data-flip]",
            act: { kind: "flip" as const, label: "Try it", skip: "Skip this step" },
          },
        ]
      : []),
    // Where shows you add go, with what the demo added in it for a moment, and its filters (Sports soon).
    {
      id: "guide",
      title: "The TV guide",
      line: solo ? "Shows you add land here. Filter it: yours, competitions or all of TV." : "Shows you add land here, for your couch too. Filter it below.",
      targets: ["[data-guide]"],
      play: "[data-guide-tv]",
    },
    {
      id: "reveal",
      title: "Results wait for you",
      line: replay ? "Nothing shows until you tap Reveal. Try it: this replays your last one." : "Nothing shows until you tap Reveal. Try a made-up one.",
      targets: ['[data-upnext-plate="reveal"]', '[data-status="reveal"]', "[data-upnext]"],
      act: { kind: "reveal", label: "Try it", skip: "Skip the reveal" },
    },
    solo
      ? { id: "start", title: "Start a game", line: "Games are played on a couch: start one, and bring your people.", targets: ["[data-solo-start-couch]", "[data-solo-invite]"] }
      : {
          id: "start",
          title: "Start a game",
          line: show ? `Make a Prediction Sheet for ${show}. Practice again: it won't show up.` : "Make a Prediction Sheet. Practice again: it won't show up.",
          targets: ["[data-foot-start]"],
          act: { kind: "start", label: "Try it", skip: "Skip starting a game" },
        },
    {
      id: "done",
      title: "You're set",
      line:
        reminders === "off"
          ? "Want a nudge before your picks lock?"
          : reminders === "install"
            ? "Add Game Your Show to your Home Screen, and we'll remind you before your picks lock."
            : "That's the tour. Take it again from your picture, up top.",
      targets: [],
    },
  ];
  return steps;
}

/** Each step's number, beats of one part sharing theirs, and how many there are. */
export function numbered(steps: TourStep[]): { nums: number[]; of: number } {
  let n = 0;
  const nums = steps.map((s, i) => (s.part && steps[i - 1]?.part === s.part ? n : ++n));
  return { nums, of: n };
}
