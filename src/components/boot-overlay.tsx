// AuthGate's initial-load and league-switch screen (auth-gate.tsx): the app's lower-third mark built
// the way a broadcast chyron comes on. The plate wipes in, the yellow tag drops onto it, a light
// sweep crosses the plate, then it all clears and runs again. Same shapes as the app icon
// (public/icons, wordmark.tsx), drawn in theme colours so it sits right on either ground. The
// keyframes live in globals.css; with reduced motion it's the finished mark, still.
export function BootOverlay() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background" role="status" aria-label="Loading">
      <svg viewBox="-1 0 32 20" className="boot-mark h-auto w-[104px] overflow-visible" aria-hidden>
        <clipPath id="boot-plate-clip">
          <rect x="8" y="8" width="22" height="10" rx="1" />
        </clipPath>
        <g className="boot-plate">
          <rect x="8" y="8" width="22" height="10" rx="1" className="fill-foreground" />
          <rect x="0" y="6" width="4" height="14" className="boot-sweep fill-background/25" clipPath="url(#boot-plate-clip)" />
        </g>
        <path
          d="M0 2h15l-2.4 12H0z"
          className="boot-tag fill-chyron stroke-background"
          strokeWidth={1.2}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </svg>
    </div>
  );
}
