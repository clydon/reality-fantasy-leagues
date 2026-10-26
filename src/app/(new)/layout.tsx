import type { Viewport } from "next";
import { cookies } from "next/headers";
import "./new.css";
import { NewShell } from "@/new/shell";
import { GROUND, THEME_COOKIE, isTheme } from "@/lib/appearance";

// The new design's routes (docs/PLAN-new-design.md step 0c; src/new/routes.ts lists them). Classic's AuthGate
// (root layout) passes these straight through; the signed-in ones check the session in (in)/layout.tsx.

// The browser's bars match the ground of this device's Appearance (step 15 part 4: the `gys_theme` cookie, src/lib/appearance.ts):
// Night, Studio, or Match phone's two.
export async function generateViewport(): Promise<Viewport> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(v) ? v : "night";
  if (theme === "phone") {
    return {
      themeColor: [
        { media: "(prefers-color-scheme: light)", color: GROUND.studio },
        { media: "(prefers-color-scheme: dark)", color: GROUND.night },
      ],
    };
  }
  return { themeColor: theme === "studio" ? GROUND.studio : GROUND.night };
}

export default function NewDesignLayout({ children }: { children: React.ReactNode }) {
  return <NewShell>{children}</NewShell>;
}
