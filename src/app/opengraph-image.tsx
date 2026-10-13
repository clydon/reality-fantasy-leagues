import { ImageResponse } from "next/og";

export const alt = "Game Your Show";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated rather than a static asset: no logo file exists yet (icon-512.png is app-icon-shaped,
// not a wide card), and this keeps the share card in sync with the brand colors in globals.css
// (night ground + chyron yellow) without hand-exporting a PNG every time either changes.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#16141d",
          color: "#f4f2f8",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -2,
            display: "flex",
          }}
        >
          Game Your Show
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 32,
            color: "#ffc531",
            display: "flex",
          }}
        >
          Draft, score and trash-talk your reality TV fantasy league.
        </div>
      </div>
    ),
    { ...size }
  );
}
