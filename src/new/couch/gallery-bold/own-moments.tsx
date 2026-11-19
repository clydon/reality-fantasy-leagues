"use client";

import { useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { ChipRow, Label } from "./parts";

// Your own moments (the user, 2026-11-18: "i do want sports to include custom moments. in all likelyhood the espn api wont capture
// oddities like fan ran on field, or overturned ABS calls (mlb), so giving the user freedom to do something similar to shows (custom
// moments) is a unique touch"). One screen for shows and sports alike: a moment in a few words, its points, and who settles it. The
// couch settles one the results won't carry (whoever sees it taps it, the others confirm); our research asks after each episode or
// game for one recaps report. TEMP (the bold pass): kept with the game being made and said on Start; the engine's step that
// carries a couch-settled moment into a sport's game is in docs/PLAN-start-a-game-redo.md.

export interface OwnMoment {
  label: string;
  points: number;
  by: "couch" | "research";
}

/** Suggestions in each world's own oddities: what its data never records. */
export function suggestionsFor(flavor: string): string[] {
  const f = flavor.toLowerCase();
  if (/mlb|baseball/.test(f)) return ["An ABS challenge overturns a call", "A fan runs onto the field", "A barehanded foul-ball catch in the stands", "A position player pitches"];
  if (/nfl|football/.test(f)) return ["A fan runs onto the field", "A trick play goes for a touchdown", "A coach wins a challenge", "A kicker makes a tackle"];
  if (/nba|wnba|basketball/.test(f)) return ["A fan runs onto the court", "A half-court shot at the buzzer", "A coach is thrown out", "A player loses a shoe"];
  if (/nhl|hockey/.test(f)) return ["Hats on the ice", "A goalie scores", "A fight", "A puck over the glass"];
  if (/soccer|mls|epl|football club/.test(f)) return ["A fan on the pitch", "A goal from their own half", "A goalkeeper scores", "A manager sent off"];
  if (/sport/.test(f)) return ["A fan runs onto the field", "A replay overturns a call", "A coach is thrown out", "A record falls"];
  if (/series|story|talk/.test(f)) return ["A big fight", "Someone cries", "A surprise return", "A cliffhanger ending"];
  return ["Someone cries", "A blindside", "A secret alliance is named", "Someone quits"];
}

export function OwnMomentsBody({ flavor, unit, moments, onChange }: { flavor: string; unit: string; moments: OwnMoment[]; onChange: (m: OwnMoment[]) => void }) {
  const [text, setText] = useState("");
  const add = (label: string) => {
    const l = label.trim();
    if (!l || moments.some((m) => m.label.toLowerCase() === l.toLowerCase())) return;
    onChange([...moments, { label: l, points: 3, by: "couch" }]);
    setText("");
  };
  const set = (i: number, m: Partial<OwnMoment>) => onChange(moments.map((x, j) => (j === i ? { ...x, ...m } : x)));
  const sugg = suggestionsFor(flavor).filter((s) => !moments.some((m) => m.label === s));
  return (
    <div data-gallery-own-moments className="flex flex-col">
      <p className="text-[16px] leading-snug">Something the results won&rsquo;t catch? Add it, and it scores like any other moment.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(text);
        }}
      >
        <label className="flex h-11 min-w-0 flex-1 items-center rounded-[4px] border border-input bg-background px-3 focus-within:border-chyron-line">
          <input data-gallery-own-input value={text} onChange={(e) => setText(e.target.value)} placeholder="A moment, in a few words" aria-label="A moment, in a few words" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground" />
        </label>
        <button type="submit" data-gallery-own-add disabled={!text.trim()} className="nd-press h-11 flex-none rounded-[3px] px-4 text-[15px] font-bold outline-1 -outline-offset-1 outline-input disabled:opacity-40">
          Add
        </button>
      </form>
      {sugg.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-gallery-own-suggest>
          {sugg.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex min-h-11 items-center gap-1.5 rounded-[2px] bg-secondary px-3 text-left text-[14px] font-semibold outline-1 -outline-offset-1 outline-border">
              <Plus className="size-4 flex-none" aria-hidden /> {s}
            </button>
          ))}
        </div>
      )}
      {moments.length > 0 && (
        <div className="mt-6" data-gallery-own-list>
          <Label>Added</Label>
          {moments.map((m, i) => (
            <div key={m.label} className="border-t border-border py-3 first-of-type:border-t-0">
              <div className="flex items-center gap-3">
                <b className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{m.label}</b>
                <span className="flex flex-none items-center gap-1" aria-label={`${m.points} points`}>
                  <button type="button" aria-label="Fewer points" onClick={() => set(i, { points: Math.max(1, m.points - 1) })} className="grid size-11 place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input">
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="type-caption w-12 text-center text-[20px] tabular-nums">{m.points}</span>
                  <button type="button" aria-label="More points" onClick={() => set(i, { points: Math.min(20, m.points + 1) })} className="grid size-11 place-items-center rounded-[3px] outline-1 -outline-offset-1 outline-input">
                    <Plus className="size-4" aria-hidden />
                  </button>
                </span>
                <button type="button" aria-label={`Take off ${m.label}`} onClick={() => onChange(moments.filter((_, j) => j !== i))} className="grid size-11 flex-none place-items-center text-muted-foreground">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <div className="mt-2">
                <ChipRow
                  data="gallery-own-by"
                  items={[
                    { id: "couch", label: "The couch settles it", ok: true },
                    { id: "research", label: "Research settles it", ok: true },
                  ]}
                  value={m.by}
                  onPick={(by) => set(i, { by: by as OwnMoment["by"] })}
                />
              </div>
            </div>
          ))}
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">The couch settles it: whoever sees it taps it, and the others confirm. Our research asks recaps after each {unit}, for moments they report.</p>
        </div>
      )}
    </div>
  );
}
