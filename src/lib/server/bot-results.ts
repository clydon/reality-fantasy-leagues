import { QUICK_DOUBTS, quickVerdict } from "@/lib/game/results-changes";
import type { BotSend } from "@db/bot-research.js";
import { researchItems } from "@db/episode-research.js";
import { sendResults, withNobodyOut, type SubmittedFact } from "./community-results";
import { pool } from "./db";
import { closeWaits, keepWait } from "./quick-waits";

// The bot's own scheduled runs as sources (docs/PLAN-new-design.md step 6c; db/bot-research.js runJob's `send`): what
// Autopilot will be, and what an admin's schedule for a season does today. Each answer is a submission like anyone's
// (community-results.ts), source 'autopilot' with nobody behind it, so every scheduled run is one voice ("bot:autopilot":
// a later run's answer replaces an earlier one's, as the 9-hour run was always meant to). A tie-break run (part 2: a
// result disputed for a day, the desk's switch) is the full research again as a voice of its own ("bot:tiebreak").
// What's trusted reaches every league on the season through the season sync; no couch gets an arrival line (like another
// couch's answer), only the corrections everyone gets. Who went home that can't be trusted yet waits in every couch's Backstage (quick_waits with
// no couch) and the run counts as a failed try, so the bot asks again.

/** What researchFromPaste hands back that a submission reads. */
interface PastedRun {
  showId: string;
  season: number;
  episodeNumber: number;
  format: unknown;
  castNames: string[];
  submitted: unknown;
  provenance: Record<string, unknown>;
}

export const botSend: BotSend = {
  async quick({ seasonId, episode, answer, castNames, exitMethods }) {
    const verdict = quickVerdict(answer, exitMethods);
    if (!verdict.trusted) {
      const doubt = verdict.doubt!;
      if (doubt !== "not-found") await keepWait({ seasonId, episode, couchId: null, sentBy: null, via: "autopilot", answer, doubt });
      return { applied: false, doubt, line: QUICK_DOUBTS[doubt] };
    }
    const facts: SubmittedFact[] = verdict.out.map((o) => ({ kind: "elimination", castawayName: o.name, method: o.method, confidence: "high", sources: answer.sources }));
    const sent = await sendResults(
      { seasonId, episode, source: "autopilot", userId: null, couchId: null, covers: { people: castNames, kinds: ["elimination"] }, facts, payload: answer, provenance: { via: "bot", run: "quick" } },
      { kind: "results.quick", text: () => `Who went home in Episode ${episode} came in on its own`, detail: { own: true, via: "autopilot" } }
    );
    await closeWaits({ seasonId, episode, couchId: null }, "replaced", null);
    return { applied: true, leagues: sent.leagues, researchId: sent.researchId };
  },

  async full({ seasonId, episode, run, source }) {
    const r = run as PastedRun;
    const items = await researchItems(pool, seasonId, r, r.submitted);
    const facts: SubmittedFact[] = withNobodyOut(
      items.map((i) => ({ kind: i.kind, castawayName: i.name, method: i.method, eventType: i.eventType, units: i.units, juryVotes: i.juryVotes, postMerge: i.postMerge, confidence: i.confidence, sources: i.sources })),
      r.format as { exitMethods?: string[] }
    );
    const { pastedNotes, ...provenance } = r.provenance;
    const sent = await sendResults(
      {
        seasonId,
        episode,
        source,
        userId: null,
        couchId: null,
        covers: { people: r.castNames, kinds: null },
        facts,
        payload: r.submitted,
        provenance: { ...provenance, run: source === "tiebreak" ? "tiebreak" : "full", pasted: typeof pastedNotes === "string" ? pastedNotes.length : null },
      },
      { kind: "results.full", text: (count) => `Episode ${episode}'s results came in on their own (${count})`, detail: { own: true, via: source } }
    );
    return { researchId: sent.researchId, facts: facts.length, count: sent.count };
  },
};
