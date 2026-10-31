// The first-time tour's steps (docs/PLAN-first-time-tour.md, shaped with the user 2026-10-31): the couch first (your people,
// adding any show, seeing theirs, bringing people in), then the game (your move, the reveal, inside a show), then what brings
// you back (Couch points, reminders). One line each; the example in the lower third does the explaining (scenes.tsx).
//
// Each step lights the first of its `targets` that's on Home (a CSS selector), else nothing: its words and example stand on
// their own. Solo players (no couch) get the couch pitched and no Couch points (there's no couch to count on). The reminders
// step is there only while this phone could start getting them: "off" (Turn on), or "install" (an iPhone outside the Home
// Screen app: the Add to Home Screen pictures first).

export type StepId = "couch" | "add" | "theirs" | "invite" | "move" | "reveal" | "show" | "points" | "remind";

/** What this phone can do about reminders (settings/notify.tsx PhoneState): only these two ask. */
export type TourReminders = "off" | "install" | null;

export interface TourStep {
  id: StepId;
  title: string;
  line: string;
  /** Where it is on Home, in order of preference. */
  targets: string[];
}

export function tourSteps({ solo, reminders }: { solo: boolean; reminders: TourReminders }): TourStep[] {
  const steps: (TourStep | null)[] = [
    solo
      ? { id: "couch", title: "Your couch", line: "A couch is your people. See what they watch.", targets: ["[data-solo-invite]"] }
      : { id: "couch", title: "Your couch", line: "Your people, and what everyone's watching this week.", targets: ["[data-guide]"] },
    { id: "add", title: "Add any show", line: "Game or not. No spoilers past your episode.", targets: ["[data-add-show-poster]", "[data-guide-add]"] },
    solo
      ? { id: "theirs", title: "See what they watch", line: "On a couch, add what friends watch in a tap.", targets: [] }
      : { id: "theirs", title: "See what they watch", line: "They see yours too. Add theirs in a tap.", targets: ["[data-couch-watching]"] },
    solo
      ? { id: "invite", title: "Bring people in", line: "Start a couch, or join one with a code.", targets: ["[data-solo-start-couch]", "[data-solo-invite]"] }
      : { id: "invite", title: "Bring people in", line: "Your couch lives up here. Invite friends anytime.", targets: ['[data-tour="you"]'] },
    {
      id: "move",
      title: "Yellow means your move",
      line: "Some shows are games. Moves lock when the episode airs.",
      targets: ['[data-upnext-plate="move"]', '[data-status="moves"]', "[data-status]"],
    },
    { id: "reveal", title: "Results wait for you", line: "Tap Reveal when you've watched. Chat waits too.", targets: ['[data-upnext-plate="reveal"]', '[data-status="reveal"]'] },
    { id: "show", title: "Inside each show", line: "Tap one for its cast, stats and standings.", targets: ["[data-poster]"] },
    solo ? null : { id: "points", title: "Couch points", line: "Play, watch and chat to climb the power rankings.", targets: ['[data-tour="rankings"]', '[data-more="rankings"]'] },
    reminders === "off"
      ? { id: "remind", title: "Never miss a move", line: "We'll remind you before your moves lock.", targets: [] }
      : reminders === "install"
        ? { id: "remind", title: "Never miss a move", line: "Add it to your Home Screen, and we'll remind you.", targets: [] }
        : null,
  ];
  return steps.filter((s): s is TourStep => s !== null);
}
