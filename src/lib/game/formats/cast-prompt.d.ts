// Types for formats/cast-prompt.js: the "Import a cast" paste flow (docs/PLAN-cast-import-prompt.md).
import type { GameFormat } from "./index";

/** What the cast flow reads off a format -- a whole GameFormat, or one with the show's own terms swapped in. */
export type CastFormat = Pick<GameFormat, "terms" | "hasGroups" | "roles"> & { name?: string };

export interface CastRow {
  name: string;
  photoUrl: string;
  /** Only present when the format has groups. */
  startingGroup?: string;
  /** Only present when the format has roles: the default or one of format.roles.values. */
  startingRole?: string;
  /** Why this row won't be imported; empty when it will. */
  problems: string[];
}

export interface ParsedCast {
  castaways: CastRow[];
  repairs: { at: string; message: string }[];
  sources: string[];
}

export function buildCastPrompt(format: CastFormat, opts?: { seasonName?: string; showName?: string }): string;
export function parseCastImport(raw: unknown, format: CastFormat): ParsedCast;
export function toCastImport(parsed: ParsedCast): {
  tribes: { name: string }[];
  castaways: { name: string; photoUrl: string; tribeName: string | null }[];
};
export function toCastRoles(parsed: ParsedCast, format: CastFormat): { castaways: { name: string; role: string }[] };
export function roleChoices(format: CastFormat): string[];
