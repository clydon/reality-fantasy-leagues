// The couch chat's fold (docs/PLAN-new-design.md step 4; the mock's show.js tabChat and watching.js wChat): once an
// episode you haven't seen has aired, people who watched it may be talking about it, so everyone else's messages
// from its airtime on are folded for you: the server sends who said something and when, never what (couch-chat.ts).
// Your own messages and the reveal lines ("riley revealed episode 5") always show. It's classic's rule
// (SpoilerLogic.chatWindow) on the season's schedule rather than one league's episodes, so a show the couch only
// watches folds the same way.
//
// "Show them" unfolds through the latest episode that had aired when you tapped (`unfold`): what's said once the
// next one airs folds again, so one tap never lets a later episode through.
//
// By progress (step 14 part 2): on a season watched at its own pace (a streaming drop, or a finished season with no game in
// the conversation: streaming.ts ownPace), everything is out at once, so airtime says nothing about what people have seen and
// folded everything said after the drop until you finished. There a message keeps its author's mark when they wrote it
// (chat_messages.author_seen, written by chat.ts insertMessage: `marksAuthor` says when), and it's folded for you while its
// author had seen more than you (or than you've unfolded through). A message without one (a weekly season's, or from
// before 0134) folds by airtime as ever.
//
// Pure (no database): tests/chat-fold.test.js.

import { ownPace } from "./streaming";

export interface AirTime {
  number: number;
  /** When it starts (UTC ISO), or null when nothing says. */
  airAt: string | null;
}

export interface Fold {
  /** The first episode you haven't seen that has aired: what the folded messages may be about. */
  episode: number;
  /** The latest episode that has aired: what "Show them" unfolds through. */
  latest: number;
  /** Others' messages from this moment on are folded (ISO); null when nothing is, after an unfold to the end. */
  from: string | null;
  /** For a message that carries its author's mark: folded while that's past this (where you are, or what you've unfolded
   *  through). */
  mark: number;
}

const aired = (e: AirTime, now: number) => !!e.airAt && Date.parse(e.airAt) <= now;

/**
 * The fold for someone who has seen through episode `seen` (Infinity: spoiler protection off), having unfolded
 * through episode `unfold` (null: not), at `now`. Null when there's nothing they haven't seen on the air.
 */
export function foldFor(episodes: AirTime[], seen: number, unfold: number | null, now = Date.now()): Fold | null {
  if (!Number.isFinite(seen)) return null;
  const on = episodes.filter((e) => aired(e, now)).sort((a, b) => a.number - b.number);
  const first = on.find((e) => e.number > seen);
  if (!first) return null;
  const latest = on[on.length - 1].number;
  let from: string | null = first.airAt;
  let mark = seen;
  if (Number.isInteger(unfold) && (unfold as number) >= first.number) {
    // Unfolded through `unfold`: folded again from when the episode after it airs (nothing after the last one).
    from = episodes.find((e) => e.number === (unfold as number) + 1)?.airAt ?? null;
    mark = unfold as number;
  }
  return { episode: first.number, latest, from, mark };
}

export interface FoldableMessage {
  user_id: string | null;
  type: string;
  created_at: string | Date;
  /** How far its author had seen when they wrote it, on a season watched at its own pace; null or absent: fold by airtime. */
  author_seen?: number | null;
}

/** Whether the fold goes by this message's author's mark (rather than airtime). */
export const byAuthorMark = (m: FoldableMessage) => Number.isInteger(m.author_seen);

/**
 * Whether this message is folded for `me` under `fold`: someone else's message whose author had seen past where you are (or
 * have unfolded through), or, carrying no mark, posted from `fold.from` on.
 */
export function isFolded(m: FoldableMessage, fold: Fold | null, me: string): boolean {
  if (!fold || m.type !== "message" || m.user_id === me) return false;
  if (byAuthorMark(m)) return (m.author_seen as number) > fold.mark;
  if (!fold.from) return false;
  return new Date(m.created_at).getTime() >= Date.parse(fold.from);
}

/** A finished weekly season's first week after its last episode is still its finale's: people watched it as it aired. */
export const SETTLED_MS = 7 * 24 * 3600 * 1000;

/**
 * Whether a message written now keeps its author's mark (chat_messages.author_seen): on a season watched at its own pace
 * (streaming.ts ownPace; `played`: a game in this conversation), where nobody is watching an airing ahead of their mark. A
 * drop from the start; a finished weekly season once a week has passed since its last episode aired (before that, people
 * talk about the finale they saw on the night, whatever their marks say, so the airtime fold keeps those).
 */
export function marksAuthor(
  season: { release?: "weekly" | "nightly" | "binge"; status: string | null; played: boolean },
  episodes: AirTime[],
  now = Date.now()
): boolean {
  if (!ownPace(season)) return false;
  if (season.release === "binge") return true;
  const last = Math.max(-Infinity, ...episodes.map((e) => (e.airAt ? Date.parse(e.airAt) : -Infinity)));
  return !Number.isFinite(last) || now - last >= SETTLED_MS;
}

/** The episode a reveal line says its author has revealed through ("… revealed episode 9", "… episodes 4–6"). */
export function revealedThrough(text: string): number | null {
  const m = /revealed episodes? (\d+)(?:\s*[–-]\s*(\d+))?\s*$/i.exec(text);
  return m ? Number(m[2] ?? m[1]) : null;
}

/** Who the conversation's own reveal lines say has revealed episode `episode` (or past it), other than `me`. */
export function revealedBy(messages: (FoldableMessage & { author_name: string; text?: string })[], episode: number, me: string): string[] {
  const names = new Map<string, string>();
  for (const m of messages) {
    if (m.type !== "reveal" || !m.user_id || m.user_id === me || !m.text) continue;
    const n = revealedThrough(m.text);
    if (n !== null && n >= episode) names.set(m.user_id, m.author_name);
  }
  return [...names.values()];
}
