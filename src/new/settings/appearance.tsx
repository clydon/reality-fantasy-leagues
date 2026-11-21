"use client";

import { Moon } from "lucide-react";
import type { Theme } from "@/lib/appearance";
import { profileApi, useAfterTheme, type Profile } from "../data";
import { showTheme, themeNow, useNight, useTheme } from "../appearance";
import { toast } from "../ui/toast";
import { Choice, Fold } from "./controls";

// Your settings' Appearance (docs/PLAN-new-design.md step 15 part 4; settings Round 1, C12): one row with its value, opening in
// place to Dark · Light · Same as my phone (the looks are Night and Studio in DESIGN.md; on screen they're plain words: Round 0's
// names). Per account: a tap draws it at once on this phone (appearance.tsx: the cookie, the page, the bars) and saves it, so your
// other phones follow on their next visit; Undo puts the last one back.

const THEMES: { id: Theme; title: string; line: string }[] = [
  { id: "night", title: "Dark", line: "" },
  { id: "studio", title: "Light", line: "" },
  { id: "phone", title: "Same as my phone", line: "Dark or light, as your phone is set" },
];

export function AppearanceRow({ p, initial }: { p: Profile | undefined; initial?: boolean }) {
  const theme = useTheme();
  const night = useNight();
  const after = useAfterTheme();

  const pick = async (t: Theme, undo = true) => {
    const before = themeNow();
    if (t === before) return;
    showTheme(t);
    try {
      after(await profileApi.save({ theme: t }));
      const label = THEMES.find((x) => x.id === t)!.title;
      toast(`Appearance: ${label}`, undo ? { undo: () => pick(before, false) } : {});
    } catch (e) {
      showTheme(before);
      toast.quiet((e as Error).message);
    }
  };

  const on = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  return (
    <div data-settings-appearance data-theme-on={theme} className="border-t border-border first:border-t-0">
      <Fold id="appearance" icon={Moon} title="Appearance" value={theme === "phone" ? `Same as my phone · ${night ? "dark" : "light"} now` : on.title} initial={initial}>
        <div role="radiogroup" aria-label="Appearance" aria-disabled={!p || undefined} className="pl-[52px]">
          {THEMES.map((t) => (
            <Choice key={t.id} data={`theme-${t.id}`} on={theme === t.id} title={t.title} line={t.line} recommended={t.id === "night"} onPick={() => p && pick(t.id)} />
          ))}
        </div>
        <small className="mt-1 block pl-[52px] text-[13px] leading-snug text-muted-foreground">Every phone you sign in on follows it.</small>
      </Fold>
    </div>
  );
}
