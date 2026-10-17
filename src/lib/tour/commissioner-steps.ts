import StateLogic from "@/lib/game/state-logic.js";
import type { LeagueState } from "@/lib/game/types";
import type { TourCtx, TourStep } from "./steps";

// The commissioner's tour (docs/PLAN-commissioner-tour.md), on Survivor 51. Five acts, in the order a
// real commissioner meets them: pick the show and create the league, open League Settings (the cast,
// the points, waivers, the draft), run the draft, then the weekly job of getting an episode's results
// in. Wherever a real commissioner would ask an AI chat, the tour copies the question and gives you an
// answer to paste: nobody searches anything.
//
// Steps end on what the screens record (`tourMark`, the store's `did`) or on what happened to the
// league, never on a click, so moving a button doesn't break the tour -- only removing a `data-tour`
// target does.

const at = (path: string) => (p: string) => p === path;
const under = (path: string) => (p: string) => p === path || p.startsWith(path + "/");
const did = (key: string) => (c: TourCtx) => !!c.tour.did[key];
const episode1 = (s: LeagueState) => s.episodes.find((e) => e.number === 1);
const hasResults = (s: LeagueState) => {
  const e = episode1(s);
  return !!e && StateLogic.episodeHasResults(e);
};
const draftDone = (s: LeagueState) => !!StateLogic.currentDraftTurn(s)?.isComplete;
/** Whether any event is worth something other than its recommended points. */
const pointsChanged = (s: LeagueState) => {
  const rec = StateLogic.defaultEventPoints(s);
  return Object.keys(rec).some((id) => StateLogic.ActiveRosterLogic.pointsFor(s, id) !== rec[id]);
};

type Draft = Omit<TourStep, "progress">;

/** An act's steps, each labelled "Act · n of N" on the plate. */
function act(name: string, steps: Draft[]): TourStep[] {
  return steps.map((s, i) => ({ ...s, progress: `${name} · ${i + 1} of ${steps.length}` }));
}

// Back to the settings list from one of its pages: the step's own `nav`.
const backToSettings = (line: string) => ({ line: () => line, detail: undefined, targets: ["back"] });

const SHOW = act("Add show", [
  {
    id: "add-open",
    route: at("/new-league"),
    line: () => "Your show isn't on the list. Tap here.",
    detail: () =>
      "Any show can become a game. You ask an AI chat to research its rules, then paste the answer back. Pretend Survivor isn't listed: we'll add it this way. Or skip ahead.",
    targets: ["show-add"],
    cta: "Skip: use a listed show",
    ctaTo: "show",
    ctaMark: "add-skipped",
    done: did("add-open"),
  },
  {
    id: "add-build",
    route: at("/new-league"),
    line: () => "We typed Survivor in. Build the prompt.",
    detail: () => "The prompt tells the chat exactly what to look up, so its answer comes back in a shape the app can read.",
    targets: ["add-build"],
    done: did("add-built"),
  },
  {
    id: "add-copy",
    route: at("/new-league"),
    line: () => "Copy the prompt.",
    detail: () =>
      "Then paste it into ChatGPT, Claude or Gemini: any chat that can search the web. Free. Today you can skip the chat.",
    targets: ["add-copy"],
    done: did("add-copy"),
  },
  {
    id: "add-paste",
    route: at("/new-league"),
    line: () => "The chat answers. Tap Paste.",
    detail: () => "Normally Paste drops in what you copied from the chat. We've made an answer up for you.",
    targets: ["add-paste"],
    done: did("add-paste"),
  },
  {
    id: "add-create",
    route: at("/new-league"),
    line: () => "Create the draft.",
    targets: ["add-create"],
    done: did("add-created"),
  },
  {
    id: "add-approve",
    route: at("/new-league"),
    line: () => "Check the rules it found, then approve.",
    detail: () => "These are the things that score, and how much. You can change any of the points for your own league later.",
    targets: ["add-approve"],
    look: ["add-review"],
    done: did("add-approved"),
  },
]);

const CREATE = act("Create", [
  {
    id: "show",
    route: at("/new-league"),
    line: (c) => (c.tour.did["add-skipped"] ? "Survivor is on the list. Pick it." : "Survivor is added. Pick it."),
    detail: (c) =>
      c.tour.did["add-skipped"]
        ? "Survivor, The Traitors and The Challenge come ready, with rules and casts."
        : "Shows you add are yours to use. (Survivor is already listed for everyone in the real app, so you won't need this step.)",
    targets: ["show-survivor"],
    done: did("create-show"),
  },
  {
    id: "season",
    route: at("/new-league"),
    line: () => "Pick Season 51, then Next.",
    detail: () => "It's airing now. Pick a finished season and your league can catch up, with each episode's results held back until you reveal them.",
    targets: ["season-51", "create-next"],
    done: did("create-step-2"),
  },
  {
    id: "type",
    route: at("/new-league"),
    line: () => "Pick Active Roster, then Next.",
    detail: () =>
      "Classic: draft a team, earn points as castaways outlast each other. Active Roster: set a lineup every week. Eliminator Pool: no draft, one pick per episode.",
    targets: ["type-active-roster", "create-next"],
    done: did("create-step-3"),
  },
  {
    id: "name",
    route: at("/new-league"),
    line: () => "Name it. Friends see this when they join.",
    targets: [],
    look: ["create-name"],
    cta: "Next",
    done: (c) => c.tour.created,
  },
  {
    id: "draft",
    route: at("/new-league"),
    line: () => "Start the draft yourself, or pick a time.",
    detail: () =>
      "The draft is a snake: picks reverse each round, and each castaway goes to one team. Prefer everyone picking in private? Switch to a blind draft in League Settings.",
    targets: [],
    look: ["create-draft", "create-teams"],
    cta: "Next",
    done: (c) => c.tour.created,
  },
  {
    id: "waivers",
    route: at("/new-league"),
    line: () => "Waivers: how people who go home get replaced.",
    detail: () => "Pick a feel and the app suggests the rules to match. Fine-tune them in League Settings.",
    targets: [],
    look: ["create-waivers"],
    cta: "Next",
    done: (c) => c.tour.created,
  },
  {
    id: "create",
    route: at("/new-league"),
    line: () => "Create your league.",
    detail: () => "You'll be the commissioner and a player. Nothing is saved on this tour.",
    targets: ["create-league"],
    done: (c) => c.tour.created,
  },
  {
    id: "invite",
    route: at("/new-league"),
    line: () => "Friends join with this code. Copy it.",
    detail: () => "Send it in a text or group chat. Friends type it into the app. Ben and Kat are computer players standing in for friends.",
    targets: ["invite-copy"],
    look: ["invite-players"],
    done: (c) => c.tour.copied,
  },
  {
    id: "to-settings",
    route: at("/new-league"),
    line: () => "Now set the league up. Open League Settings.",
    targets: ["invite-enter"],
    done: (c) => c.pathname.startsWith("/setup"),
  },
]);

const SETTINGS = act("Settings", [
  {
    id: "settings-intro",
    route: at("/setup"),
    line: () => "This is where you run the league.",
    detail: () => "Players, rules, waivers, the cast. Everyone can look; only you can change things. We'll do the important ones.",
    targets: [],
    look: ["settings-list"],
    cta: "Let's go",
    done: (c) => c.pathname.startsWith("/setup/") || did("cast-opened")(c),
  },
  {
    id: "cast-open",
    route: at("/setup"),
    line: () => "The league has no cast yet. Open Tribes & castaways.",
    targets: ["setup-cast"],
    done: (c) => under("/setup/cast")(c.pathname),
  },
  {
    id: "cast-toggle",
    route: under("/setup/cast"),
    line: () => "Open Import a cast.",
    detail: () =>
      "For some shows the cast arrives by itself. For any other, you ask an AI chat for it and paste the answer. Same idea as before.",
    targets: ["cast-import-toggle"],
    nav: { targets: ["setup-cast"] },
    done: did("cast-opened"),
  },
  {
    id: "cast-copy",
    route: under("/setup/cast"),
    line: () => "Copy the prompt.",
    detail: () => "It asks for every castaway, their tribe and a photo. Paste it into any AI chat that can search the web.",
    targets: ["cast-copy"],
    done: did("cast-copy"),
  },
  {
    id: "cast-paste",
    route: under("/setup/cast"),
    line: () => "Tap Paste to drop in the chat's answer.",
    detail: () => "We've made one up: Survivor 51's 21 castaways.",
    targets: ["cast-paste"],
    done: did("cast-paste"),
  },
  {
    id: "cast-review",
    route: under("/setup/cast"),
    line: () => "Tap Review.",
    targets: ["cast-review"],
    done: did("cast-reviewed"),
  },
  {
    id: "cast-import",
    route: under("/setup/cast"),
    line: () => "Check the names, then import.",
    detail: () => "Fix a spelling or a photo here before it goes in. Anyone already in the league is left alone.",
    targets: ["cast-import-go"],
    done: did("cast-imported"),
  },
  {
    id: "rules-open",
    route: at("/setup"),
    line: () => "Now the scoring. Open Scoring & rules.",
    targets: ["setup-rules"],
    nav: backToSettings("Back to League Settings, then Scoring & rules."),
    done: (c) => under("/setup/rules")(c.pathname),
  },
  {
    id: "rules-event",
    route: at("/setup/rules"),
    line: () => "Every event has a point value. Tap one.",
    detail: () => "Survivor scores things like immunity wins and idols found. Starters score; the bench doesn't.",
    targets: ["rule-first"],
    nav: backToSettings("Back to Scoring & rules."),
    done: did("rule-sheet"),
  },
  {
    id: "rules-edit",
    route: at("/setup/rules"),
    line: () => "Make it worth more. Tap +, then Done.",
    detail: () => "Any value works, decimals too. 0 switches an event off.",
    targets: ["rule-points", "rule-done"],
    done: (c) => pointsChanged(c.full),
  },
  {
    id: "rules-menu",
    route: at("/setup/rules"),
    line: () => "This menu resets the points, or edits the rules.",
    detail: () =>
      "Customise lets you change when an event scores, not just how much. Most leagues never need it.",
    targets: [],
    look: ["rules-menu"],
    cta: "Next",
    done: (c) => c.pathname !== "/setup/rules",
  },
  {
    id: "waivers-open",
    route: at("/setup"),
    line: () => "Next, waivers. Open them.",
    detail: () => "Waivers decide who replaces a castaway once they're voted out.",
    targets: ["setup-waivers"],
    nav: backToSettings("Back to League Settings, then Waivers."),
    done: (c) => under("/setup/waivers")(c.pathname),
  },
  {
    id: "waivers-rule",
    route: under("/setup/waivers"),
    line: () => "Pick how replacements work.",
    detail: () =>
      "Right away: first to claim wins. Only when short: once your roster is thin. A waiver window: everyone claims, then they process together. Or none.",
    targets: ["waiver-rules"],
    cta: "Keep it as it is",
    done: did("waiver-rule"),
  },
  {
    id: "waivers-windows",
    route: under("/setup/waivers"),
    line: () => "Windows also let players swap someone still in.",
    detail: () => "Open one every episode, every few, or only when you say. Swapped castaways take their points with them.",
    targets: [],
    look: ["waiver-windows"],
    cta: "Next",
    done: (c) => !under("/setup/waivers")(c.pathname),
  },
  {
    id: "draft-open",
    route: at("/setup"),
    line: () => "Last one: how the draft works. Open League setup.",
    targets: ["setup-league"],
    nav: backToSettings("Back to League Settings, then League setup."),
    done: (c) => under("/setup/league")(c.pathname),
  },
  {
    id: "draft-type",
    route: under("/setup/league"),
    line: () => "Snake or blind draft? It's in More options.",
    detail: () =>
      "Snake: take turns, and each castaway goes to one team. Blind: everyone picks in private, then all picks are revealed together, and the same castaway can be on several teams.",
    targets: ["more-options"],
    look: ["ownership"],
    cta: "Next",
    done: (c) => c.pathname === "/draft",
  },
]);

const DRAFT = act("Draft", [
  {
    id: "to-draft",
    line: () => "Time to draft. Tap Draft.",
    targets: ["tab-draft"],
    done: (c) => c.pathname === "/draft",
  },
  {
    id: "start-draft",
    route: at("/draft"),
    line: () => "Everyone's in. Start the draft.",
    detail: () => "Only you can start it. Then everyone picks in turn.",
    targets: ["draft-start", "confirm-accept"],
    nav: { targets: ["tab-draft"] },
    done: (c) => StateLogic.isDraftStarted(c.full),
  },
  {
    id: "draft",
    route: at("/draft"),
    line: () => "You play too. Pick 3: tap one, then Draft.",
    detail: () => "Ben and Kat pick right after you. Lineups are set for everyone on this tour.",
    targets: ["picker-tiles", "picker-confirm"],
    nav: { targets: ["tab-draft"] },
    done: (c) => draftDone(c.full),
  },
]);

const EPISODE = act("Episode 1", [
  {
    id: "results-open",
    route: at("/episodes/1/research"),
    line: () => "Episode 1 aired. Its results are due.",
    detail: () => "This is your weekly job: get the results in, check them, apply them.",
    targets: ["tab-episodes", "results-check"],
    done: (c) => c.pathname === "/episodes/1/research",
  },
  {
    id: "results-copy",
    route: at("/episodes/1/research"),
    line: () => "Copy the question.",
    detail: () => "It asks an AI chat what happened to everyone this episode. Paste it into any chat that can search the web.",
    targets: ["results-copy-1"],
    done: did("results-copy-1"),
  },
  {
    id: "results-paste",
    route: at("/episodes/1/research"),
    line: () => "Tap Paste to drop in the answer.",
    detail: () => "These results are made up for the tour, not the real Episode 1.",
    targets: ["results-paste-1"],
    done: did("results-paste-1"),
  },
  {
    id: "results-read",
    route: at("/episodes/1/research"),
    line: () => "Read the answer.",
    targets: ["results-read"],
    done: (c) => !!c.tour.staged[1],
  },
  {
    id: "results-rule-change",
    route: at("/episodes/1/research"),
    line: () => "Research can also spot a rule change.",
    detail: () =>
      "If an episode has a twist the rules don't cover, research proposes a change. It waits under Scoring & rules for you to accept or turn down.",
    targets: [],
    look: ["results-list"],
    cta: "Next",
    done: (c) => hasResults(c.full),
  },
  {
    id: "results-apply",
    route: at("/episodes/1/research"),
    line: () => "Check each result, then apply.",
    detail: () => "Jenna's idol has a low-confidence flag: only one source. Untick anything you doubt. Nothing scores until you apply.",
    targets: ["results-apply"],
    done: (c) => hasResults(c.full),
  },
]);

// Episode 1's results are in; replacing who went home and swapping who's still in happen in a waiver
// window, which the commissioner can open any week. Then Episode 2 airs, and the job starts again.
const WAIVERS = act("Waivers", [
  {
    id: "waivers-go",
    route: at("/waivers"),
    line: () => "Mike was voted out. Open Lineup, then Waivers.",
    detail: () => "Replacing castaways who've gone home, and swapping ones still in, happens through waivers.",
    targets: [],
    nav: { targets: ["tab-lineup", "team-waivers"] },
    done: (c) => under("/waivers")(c.pathname),
  },
  {
    id: "window-open",
    route: at("/waivers"),
    line: () => "Open a waiver window.",
    detail: () =>
      "Some leagues open one every episode, some every few. As commissioner you can open one any week once results are in.",
    targets: ["window-open"],
    nav: { line: () => "Back to Waivers.", targets: ["tab-lineup", "team-waivers"] },
    done: did("window-sheet-open"),
  },
  {
    id: "window-sheet",
    route: at("/waivers"),
    line: () => "Choose what players can do, then open it.",
    detail: () => "Replace everyone who's out, and how many swaps each player gets. Players are told it's open.",
    targets: ["window-go"],
    done: did("window-opened"),
  },
  {
    id: "window-claims",
    route: at("/waivers"),
    line: () => "Claims are private, even from you.",
    detail: () => "Each player picks their moves in secret. You see who has claimed, and you can nudge anyone who hasn't.",
    targets: [],
    look: ["window-claims"],
    cta: "Next",
    done: did("window-processed"),
  },
  {
    id: "window-process",
    route: at("/waivers"),
    line: () => "Process the claims.",
    detail: () => "They process by themselves at the deadline, a day before the next episode. Process now ends it early.",
    targets: ["waivers-process", "confirm-accept"],
    done: did("window-processed"),
  },
]);

const EPISODE2 = act("Episode 2", [
  {
    id: "ep2-open",
    route: at("/episodes/2/research"),
    line: () => "Episode 2 aired. Same job again.",
    detail: () =>
      "Every episode: copy the question, paste the answer, check, apply. Your players reveal results when they're ready. Applying counts as seeing them for you.",
    targets: ["tab-episodes", "results-check"],
    done: (c) => c.pathname === "/episodes/2/research",
  },
  {
    id: "ep2-copy",
    route: at("/episodes/2/research"),
    line: () => "Copy the question.",
    targets: ["results-copy-2"],
    done: did("results-copy-2"),
  },
  {
    id: "ep2-paste",
    route: at("/episodes/2/research"),
    line: () => "Tap Paste.",
    targets: ["results-paste-2"],
    done: did("results-paste-2"),
  },
  {
    id: "ep2-read",
    route: at("/episodes/2/research"),
    line: () => "Read the answer.",
    targets: ["results-read"],
    done: (c) => !!c.tour.staged[2],
  },
  {
    id: "ep2-apply",
    route: at("/episodes/2/research"),
    line: () => "Check, then apply.",
    targets: ["results-apply"],
    done: (c) => {
      const e = c.full.episodes.find((x) => x.number === 2);
      return !!e && StateLogic.episodeHasResults(e);
    },
  },
]);

const END: TourStep = {
  id: "end",
  progress: "Done",
  line: () => "That's the commissioner's job.",
  targets: [],
  done: () => false,
  end: true,
};

export const COMMISSIONER_TOUR: TourStep[] = [...SHOW, ...CREATE, ...SETTINGS, ...DRAFT, ...EPISODE, ...WAIVERS, ...EPISODE2, END];
