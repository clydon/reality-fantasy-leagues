import Image from "next/image";

// Port of SurvivorDraft's boot overlay (public/index.html + public/styles.css's .boot-overlay) --
// a pulsing app icon and three staggered bouncing dots, for AuthGate's initial-load and
// league-switch loading states (auth-gate.tsx) instead of a bare "Loading…" line. The original
// existed to cover a pre-JS flash of mismatched chrome, which doesn't apply here (this whole shell
// is already client-rendered React) -- so this is just the same visual treatment, not the same
// "first thing in <body>, no JS dependency" trick; the keyframes themselves live in globals.css.
export function BootOverlay() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <Image src="/icon.png" alt="" width={72} height={72} className="boot-overlay-logo rounded-2xl opacity-90" priority />
      <div className="flex gap-2">
        <span className="boot-overlay-dot h-2 w-2 rounded-full bg-primary" />
        <span className="boot-overlay-dot h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "0.15s" }} />
        <span className="boot-overlay-dot h-2 w-2 rounded-full bg-primary" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}
