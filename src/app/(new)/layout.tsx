import type { Viewport } from "next";
import "./new.css";
import { NewShell } from "@/new/shell";

// The new design's routes (docs/PLAN-new-design.md step 0c; src/new/routes.ts lists them). Classic's AuthGate
// (root layout) passes these straight through; the signed-in ones check the session in (in)/layout.tsx.

// Night only until step 15 brings Studio back: the browser's bars match the ground.
export const viewport: Viewport = { themeColor: "#16141d" };

export default function NewDesignLayout({ children }: { children: React.ReactNode }) {
  return <NewShell>{children}</NewShell>;
}
