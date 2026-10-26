// The TV guide, the pure half (docs/PLAN-new-design.md step 11; the mock's index.html guideDays and card, tvguide.js and
// streaming.js's drop days): your shows' and the couch's episodes laid out over seven days from today, in the viewer's own
// time zone (the browser's), each day running from 3 AM to 3 AM as TV listings do (a talk show at 12:37 AM is the night
// before's: step 11 part 2, from Noticed), each in time order with the Now line, shows starting at the same moment side by side as
// "Same time", and a streaming season that drops every episode at once as one card ("All 8 drop"). Planned nights (step 11
// part 3): a watch along planned for an airing tags that airing's card ("Watch along"); one at a time of its own is a card of
// its own. Only when things air: never a title or a result (the home read sends neither for the guide). Checked by
// tests/guide.test.js.

/** How you're tied to a show: you play it (a game of yours), you watch it (on your list, no game), or it's the couch's. */
export type GuideTie = "plays" | "watches" | "couch";

export interface GuideFace {
  userId: string;
  name: string;
}

/** A show as the guide is given it (the home read's shows and couch shows). */
export interface GuideShow {
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  release?: "weekly" | "nightly" | "binge";
  /** Its episodes airing around this week (the home read's `week`): when each starts and how long it runs. */
  week: { number: number; airAt: string; runtimeMin: number | null }[];
  tie: GuideTie;
  /** Who on the couch watches or plays it (you among them when you do). */
  faces: GuideFace[];
  /** The episode one of your moves is due for, or null. */
  dueEpisode: number | null;
}

/** A planned night (step 11 part 3) as the guide is given it: the couch's watch along for one episode. */
export interface GuidePlan {
  id: string;
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  episode: number;
  how: "live" | "start";
  at: number;
  endsAt: number;
  /** Who's in, whoever planned it first. */
  faces: GuideFace[];
  /** You planned it, you're in, or you're invited; null: the couch's, and you could join it. */
  you: "host" | "in" | "invited" | null;
}

export interface GuideCard {
  /** "<season>:<first episode>" for an airing, "plan:<id>" for a planned night of its own. */
  key: string;
  seasonId: string;
  name: string;
  seasonNumber: number | null;
  artUrl: string | null;
  tie: GuideTie;
  faces: GuideFace[];
  /** The episodes starting at this time: one, or a streaming season's whole drop (or a double episode). */
  numbers: number[];
  at: number;
  endsAt: number;
  /** On the air now. */
  live: boolean;
  /** Every episode of a streaming season at once: how many ("All 8 drop"). */
  drop: number | null;
  /** One of your moves is due for it. */
  due: boolean;
  /** The couch's watch along planned for it (an airing it tags), or the night itself (a card of its own); null: none. */
  plan: GuidePlan | null;
}

/** One card, or several starting at the same moment ("Same time"). */
export type GuideSlot = GuideCard | GuideCard[];

export interface GuideDay {
  /** Days from today: 0 is today. */
  offset: number;
  /** When it starts (ms): 3 AM local, the guide's day (DAY_STARTS_AT). */
  start: number;
  slots: GuideSlot[];
  /** Today only: the Now line goes before slots[nowAt] (slots.length: after them all). Null on other days. */
  nowAt: number | null;
}

export const GUIDE_DAYS = 7;
/** The hour the guide's day starts, as TV listings run theirs: what's on after midnight is the night before's. */
export const DAY_STARTS_AT = 3;
/** How long an episode is taken to run when nobody says (schedule.ts' DEFAULT_RUNTIME_MIN). */
const RUNTIME_MIN = 60;
const TIE_ORDER: Record<GuideTie, number> = { plays: 0, watches: 1, couch: 2 };

/** When the guide's day that `t` falls in started: 3 AM local (before 3 AM, the day before's). */
export function startOfLocalDay(t: number): number {
  const d = new Date(t);
  if (d.getHours() < DAY_STARTS_AT) d.setDate(d.getDate() - 1);
  d.setHours(DAY_STARTS_AT, 0, 0, 0);
  return d.getTime();
}

/** The guide's day `n` days after `start` (a calendar day, so a clock change doesn't shift it). */
export function addLocalDays(start: number, n: number): number {
  const d = new Date(start);
  d.setDate(d.getDate() + n);
  d.setHours(DAY_STARTS_AT, 0, 0, 0);
  return d.getTime();
}

/** The evening, as the guide names it: from 5 PM until its day ends at 3 AM ("Tonight", "Nothing tonight"). */
export function eveningAt(t: number): boolean {
  const h = new Date(t).getHours();
  return h >= 17 || h < DAY_STARTS_AT;
}

/** Every show's episodes as cards: one per show and start time (a drop's episodes, or a double episode, are one card). */
export function guideCards(shows: GuideShow[], now: number): GuideCard[] {
  const cards: GuideCard[] = [];
  for (const s of shows) {
    const byTime = new Map<number, { numbers: number[]; runtime: number }>();
    for (const e of s.week) {
      const at = Date.parse(e.airAt);
      if (!Number.isFinite(at)) continue;
      const slot = byTime.get(at) ?? { numbers: [], runtime: 0 };
      slot.numbers.push(e.number);
      slot.runtime = Math.max(slot.runtime, e.runtimeMin ?? RUNTIME_MIN);
      byTime.set(at, slot);
    }
    for (const [at, { numbers, runtime }] of byTime) {
      numbers.sort((a, b) => a - b);
      const endsAt = at + runtime * 60_000;
      const drop = s.release === "binge" && numbers.length >= 2 ? numbers.length : null;
      cards.push({
        key: `${s.seasonId}:${numbers[0]}`,
        seasonId: s.seasonId,
        name: s.name,
        seasonNumber: s.seasonNumber,
        artUrl: s.artUrl,
        tie: s.tie,
        faces: s.faces,
        numbers,
        at,
        endsAt,
        // A streaming season is never on the air (step 14), not even a one-episode drop.
        live: s.release !== "binge" && at <= now && now < endsAt,
        drop,
        due: s.dueEpisode != null && numbers.includes(s.dueEpisode),
        plan: null,
      });
    }
  }
  return cards.sort((a, b) => a.at - b.at || TIE_ORDER[a.tie] - TIE_ORDER[b.tie] || a.name.localeCompare(b.name));
}

/**
 * Planned nights into the cards: a plan for an episode at the moment it airs (or drops) tags that card; any other (a shared
 * start, or a show that isn't on this guide) is a card of its own at its time, tied as its show is (the couch's when it isn't
 * on the guide).
 */
export function withPlans(cards: GuideCard[], plans: GuidePlan[], now: number, shows: GuideShow[] = []): GuideCard[] {
  const out = cards.map((c) => ({ ...c }));
  for (const p of plans) {
    const airing = out.find((c) => !c.plan && c.seasonId === p.seasonId && c.numbers.includes(p.episode) && Math.abs(c.at - p.at) < 60_000);
    if (airing) {
      airing.plan = p;
      continue;
    }
    const s = shows.find((x) => x.seasonId === p.seasonId);
    out.push({
      key: `plan:${p.id}`,
      seasonId: p.seasonId,
      name: p.name,
      seasonNumber: p.seasonNumber,
      artUrl: p.artUrl,
      tie: s?.tie ?? "couch",
      faces: p.faces,
      numbers: [p.episode],
      at: p.at,
      endsAt: p.endsAt,
      live: p.at <= now && now < p.endsAt,
      drop: null,
      due: false,
      plan: p,
    });
  }
  return out.sort((a, b) => a.at - b.at || TIE_ORDER[a.tie] - TIE_ORDER[b.tie] || a.name.localeCompare(b.name));
}

/** The week: `days` columns from today, each in time order, shows starting together grouped, the Now line on today; planned
 *  nights tag their airing or sit at their own time. */
export function guideWeek(shows: GuideShow[], now: number, days = GUIDE_DAYS, plans: GuidePlan[] = []): GuideDay[] {
  const cards = plans.length ? withPlans(guideCards(shows, now), plans, now, shows) : guideCards(shows, now);
  const today = startOfLocalDay(now);
  const out: GuideDay[] = [];
  for (let offset = 0; offset < days; offset++) {
    const start = addLocalDays(today, offset);
    const end = addLocalDays(today, offset + 1);
    const slots: GuideSlot[] = [];
    for (const c of cards.filter((x) => x.at >= start && x.at < end)) {
      const last = slots[slots.length - 1];
      const lastAt = last ? (Array.isArray(last) ? last[0].at : last.at) : null;
      if (lastAt === c.at) slots[slots.length - 1] = Array.isArray(last) ? [...last, c] : [last as GuideCard, c];
      else slots.push(c);
    }
    let nowAt: number | null = null;
    if (offset === 0) {
      // Before the first thing still to come (or on now); after them all once everything today has finished.
      const i = slots.findIndex((sl) => (Array.isArray(sl) ? sl : [sl]).some((c) => c.endsAt > now));
      nowAt = i === -1 ? slots.length : i;
    }
    out.push({ offset, start, slots, nowAt });
  }
  return out;
}

const cardsOf = (d: GuideDay) => d.slots.flatMap((sl) => (Array.isArray(sl) ? sl : [sl]));

/** For a day with nothing on: the next thing on after it this week ("Nothing tonight · Next up"), or null. */
export function nextUpAfter(week: GuideDay[], offset: number): GuideCard | null {
  for (const d of week) if (d.offset > offset && cardsOf(d).length) return cardsOf(d)[0];
  return null;
}

/** Whether the week has anything at all on it. */
export const guideEmpty = (week: GuideDay[]) => week.every((d) => d.slots.length === 0);

/** "S51 · Ep 5", "S51 · Ep 5–6", or a drop's "S1 · 8 episodes". */
export function episodeLine(c: Pick<GuideCard, "seasonNumber" | "numbers" | "drop">): string {
  const s = c.seasonNumber != null ? `S${c.seasonNumber} · ` : "";
  if (c.drop) return `${s}${c.drop} episodes`;
  const first = c.numbers[0];
  const last = c.numbers[c.numbers.length - 1];
  return `${s}Ep ${first}${last !== first ? `–${last}` : ""}`;
}
