"use client";

import type { Theme } from "@/lib/appearance";
import { profileApi, useAfterTheme, type Profile } from "../data";
import { showTheme, themeNow, useNight, useTheme } from "../appearance";
import { toast } from "../ui/toast";
import { Segmented, SettingBlock } from "./controls";

// Settings' Appearance (docs/PLAN-new-design.md step 15 part 4; in Quick settings since the 2026-10-31 redesign): Night ·
// Studio · Match phone, each with the plain word under it (Dark, Light, Auto), per account. A tap draws it at once on this
// phone (appearance.tsx: the cookie, the page, the bars) and saves it to the account, so your other phones follow on their
// next visit; Undo puts the last one back.

const THEMES: { id: Theme; title: string; sub: string; line: string }[] = [
  { id: "night", title: "Night", sub: "Dark", line: "Dark, for the evening couch" },
  { id: "studio", title: "Studio", sub: "Light", line: "Light, for daytime" },
  { id: "phone", title: "Match phone", sub: "Auto", line: "Night or Studio, as your phone is set" },
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
      const label = THEMES.find((x) => x.id === t)!.title;
      toast(`Saved: ${label}`, undo ? { undo: () => pick(before, false) } : {});
    } catch (e) {
      showTheme(before);
      toast.quiet((e as Error).message);
    }
  };

  const on = THEMES.find((x) => x.id === theme) ?? THEMES[0];
  return (
    <div data-settings-appearance data-theme-on={theme} className="border-t border-border first:border-t-0">
      <SettingBlock
        data="settings-look"
        title="Appearance"
        line={
          <>
            {on.line}
            {theme === "phone" && ` · ${night ? "Night" : "Studio"} now`}. Every phone you sign in on follows it.
          </>
        }
      >
        <Segmented label="Appearance" options={THEMES} value={theme} onPick={(t) => pick(t)} attrs={(id) => ({ "data-theme-choice": id })} disabled={!p} />
      </SettingBlock>
    </div>
  );
}
