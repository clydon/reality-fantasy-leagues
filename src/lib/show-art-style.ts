import type { CSSProperties } from "react";

// How a show's art looks behind Overview's header (shows.art_style, migration 0056). Every key is
// optional: one left out takes the default look, which is what every show had before this existed --
// greyscale at the theme's strength, centred a little above the middle.
export type ArtStyle = {
  /** Share of the art's color kept, 0 (greyscale) to 1. */
  color?: number;
  /** Multiplier on the theme's own strength (--art-opacity). */
  strength?: number;
  /** Scale-up before cropping to the header. */
  zoom?: number;
  /** The point the crop centres on, in % of the image. */
  x?: number;
  y?: number;
};

export const ART_STYLE_DEFAULTS: Required<ArtStyle> = { color: 0, strength: 1, zoom: 1, x: 50, y: 40 };

export const ART_STYLE_RANGES: Record<keyof ArtStyle, { min: number; max: number; step: number }> = {
  color: { min: 0, max: 1, step: 0.05 },
  strength: { min: 0.5, max: 3, step: 0.1 },
  zoom: { min: 1, max: 3, step: 0.05 },
  x: { min: 0, max: 100, step: 1 },
  y: { min: 0, max: 100, step: 1 },
};

export function resolveArtStyle(style: ArtStyle | null | undefined): Required<ArtStyle> {
  return { ...ART_STYLE_DEFAULTS, ...(style ?? {}) };
}

// The PATCH body's artStyle: numbers clamped into range, defaults dropped, null when nothing's left.
export function cleanArtStyle(value: unknown): ArtStyle | null {
  if (!value || typeof value !== "object") return null;
  const out: ArtStyle = {};
  for (const key of Object.keys(ART_STYLE_RANGES) as (keyof ArtStyle)[]) {
    const n = Number((value as Record<string, unknown>)[key]);
    if (!Number.isFinite(n)) continue;
    const { min, max } = ART_STYLE_RANGES[key];
    const v = Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
    if (v !== ART_STYLE_DEFAULTS[key]) out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

// The CSS custom properties .show-art reads (globals.css).
export function artStyleVars(style: ArtStyle | null | undefined): CSSProperties {
  const s = resolveArtStyle(style);
  return {
    "--art-grey": String(1 - s.color),
    "--art-strength": String(s.strength),
    "--art-zoom": String(s.zoom),
    "--art-pos": `${s.x}% ${s.y}%`,
  } as CSSProperties;
}
