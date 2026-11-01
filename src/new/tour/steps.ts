// The first-time tour's steps (docs/PLAN-first-time-tour.md version 2, the user's own outline, 2026-11-01): welcome (what the app is,
// its three ideas), then your real Home: what needs you, adding a show (and where shows you add go: the TV guide), the reveal,
// starting a game, and you're set. Three can be tried for real, nothing saved (a practice run: watching/sheets.tsx, show/reveal.tsx
// TourReveal, couch/start-game.tsx).
//
// Each step lights the first of its `targets` that's on Home (a CSS selector), or with `union` every one of them together; none:
// nothing lit, its words stand on their own. `act` is its practice run: the plate says its label where Next is on the others, so the
// tap a thumb makes from habit tries it (a tap on what's lit does the same; Skip this step moves on without it: tour.tsx).

export type StepId = "welcome" | "home" | "add" | "guide" | "reveal" | "start" | "done";

/** What this phone can do about reminders (settings/notify.tsx PhoneState): only these two ask. */
export type TourReminders = "off" | "install" | null;

export type TourAct = "add" | "reveal" | "start";

export interface TourStep {
  id: StepId;
  title: string;
  line: string;
  /** Where it is on Home, in order of preference. */
  targets: string[];
  /** Light all of `targets` found, as one. */
  union?: boolean;
  /** Its practice run, and the plate's words for it (in Next's place). */
  act?: { kind: TourAct; label: string };
}

export interface TourContext {
  solo: boolean;
  reminders: TourReminders;
  /** The show the practice adds ("The Amazing Race"), when there's one to add. */
  show: string | null;
  /** Something of yours to reveal again; else a made-up one. */
  replay: boolean;
}

export function tourSteps({ solo, reminders, show, replay }: TourContext): TourStep[] {
  return [
    { id: "welcome", title: "Welcome", line: "Watch with your people. Make any show a game.", targets: [] },
    { id: "home", title: "Your Home", line: "What needs you is always up top.", targets: ["[data-status]", "[data-upnext]"], union: true },
    {
      id: "add",
      title: "Add a show",
      line: show ? `Let's add ${show}. Practice: it won't show up.` : "Add any show you watch. Practice: it won't show up.",
      targets: ["[data-add-show-poster]", "[data-guide-add]"],
      act: { kind: "add", label: "Try it" },
    },
    // Where shows you add go (the user, 2026-11-01): the TV guide, with what the demo added in it for a moment.
    {
      id: "guide",
      title: "Your couch sees it",
      line: solo ? "Shows you add land in your TV guide. On a couch, your people see them too." : "Shows you add land in the couch's TV guide, when you share what you watch.",
      targets: ["[data-guide]"],
    },
    {
      id: "reveal",
      title: "Results wait for you",
      line: replay ? "Nothing shows until you tap Reveal. Try it: this replays your last one." : "Nothing shows until you tap Reveal. Try a made-up one.",
      targets: ['[data-upnext-plate="reveal"]', '[data-status="reveal"]', "[data-upnext]"],
      act: { kind: "reveal", label: "Try it" },
    },
    solo
      ? { id: "start", title: "Start a game", line: "Games are played on a couch: start one, and bring your people.", targets: ["[data-solo-start-couch]", "[data-solo-invite]"] }
      : {
          id: "start",
          title: "Start a game",
          line: show ? `Make a Prediction Sheet for ${show}. Practice again: it won't show up.` : "Make a Prediction Sheet. Practice again: it won't show up.",
          targets: ["[data-foot-start]"],
          act: { kind: "start", label: "Try it" },
        },
    {
      id: "done",
      title: "You're set",
      line:
        reminders === "off"
          ? "Want a nudge before your picks lock?"
          : reminders === "install"
            ? "Add Game Your Show to your Home Screen, and we'll remind you before your picks lock."
            : "That's the tour. Take it again anytime in Settings.",
      targets: [],
    },
  ];
}
