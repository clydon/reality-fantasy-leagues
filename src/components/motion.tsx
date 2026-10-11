"use client";

// The house convention for Motion (reports/Mobile React animation library picks.md): import `m`
// instead of `motion`, and load its feature set lazily instead of bundling the full ~34kb engine
// into every page. `MotionProvider` wraps the app once so every call site can just use `m.div`
// etc. without importing its own `LazyMotion`. `domMax` (not `domAnimation`) because drag and
// layout animation are both on the roadmap (reports/Mobile React animation library picks.md's
// ordering) and swapping the loaded feature set later would mean re-auditing every call site.
import { LazyMotion, m, AnimatePresence, useReducedMotion } from "motion/react";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}

export { m, AnimatePresence, useReducedMotion };
