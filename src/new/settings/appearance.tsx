"use client";

import type { Theme } from "@/lib/appearance";
import { profileApi, useAfterTheme, type Profile } from "../data";
import { showTheme, themeNow, useNight, useTheme } from "../appearance";
import { toast } from "../ui/toast";

// Settings' Appearance (docs/PLAN-new-design.md step 15 part 4; the mock's settings.js accountRoute .segm): Night · Studio · Match
// phone, per account. A tap draws it at once on this phone (appearance.tsx: the cookie, the page, the bars) and saves it to the
// account, so your other phones follow on their next visit; Undo puts the last one back.

const THEMES: { id: Theme; label: string; line: string }[] = [
  { id: "night", label: "Night", line: "Dark, for the evening couch" },
  { id: "studio", label: "Studio", line: "Light, for daytime" },
  { id: "phone", label: "Match phone", line: "Night or Studio, as your phone is set" },
];

export function AppearanceSection({ p }: { p: Profile | undefined }) {
  const theme = useTheme();
  const night = useNight();
  const after = useAfterTheme();

  const pick = async (t: Theme, undo = true) => {
    const before = themeNow();
    if (t === before) return;
    showTheme(t);
    try {
      after(await profileApi.save({ theme: t }));
      const label = THEMES.find((x) => x.id === t)!.label;
      toast(`Saved: ${label}`, undo ? { undo: () => pick(before, false) } : {});
    } catch (e) {
      showTheme(before);
      toast.quiet((e as Error).message);
    }
  };

  const on = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  return (
    <div className="px-4" data-settings-appearance data-theme-on={theme}>
      <div role="radiogroup" aria-label="Appearance" className="flex gap-[3px] rounded-[3px] bg-card p-[3px]">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            data-theme-choice={t.id}
            disabled={!p}
            onClick={() => pick(t.id)}
            className={`nd-press h-11 flex-1 rounded-[2px] text-[14px] font-bold transition-colors ${theme === t.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <small className="mt-2 block text-[13px] leading-snug text-muted-foreground">
        {on.line}
        {theme === "phone" && ` · ${night ? "Night" : "Studio"} now`}. Every phone you sign in on follows it.
      </small>
    </div>
  );
}
