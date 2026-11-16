// Types for formats/cast-prompt.js: the "Import a cast" paste flow (docs/PLAN-cast-import-prompt.md).
import type { GameFormat } from "./index";
import type { RulebookCastProperty } from "./rulebook-schema";

/** What the cast flow reads off a format -- a whole GameFormat, or one with the show's own terms swapped in. */
export type CastFormat = Pick<GameFormat, "terms" | "hasGroups" | "roles"> & { name?: string; properties?: RulebookCastProperty[] };

/** Who someone is, as the show bills them (season_cast.bio): only what's stated. */
export interface CastBio {
  hometown?: string;
  residence?: string;
  age?: number;
  occupation?: string;
  line?: string;
  source?: string;
}

export interface CastRow {
  name: string;
  photoUrl: string;
  /** Only present when the format has groups. */
  startingGroup?: string;
  /** Only present when the format has roles: the default or one of format.roles.values. */
  startingRole?: string;
  /** Each declared property's value by key (season_cast.props), only those stated. */
  props: Record<string, string>;
  /** Their bio as billed, or null. */
  bio: CastBio | null;
  /** Why this row won't be imported; empty when it will. */
  problems: string[];
}

export interface ParsedCast {
  castaways: CastRow[];
  repairs: { at: string; message: string }[];
  sources: string[];
}

/** `year`: when the season premiered; `known`: who the TV listings credit in it (server/show-art.ts castAnchor), so an older season
 *  with the same name isn't the answer. */
export function buildCastPrompt(format: CastFormat, opts?: { seasonName?: string; showName?: string; year?: number | null; known?: string[] }): string;
export function parseCastImport(raw: unknown, format: CastFormat): ParsedCast;
export function toCastImport(parsed: ParsedCast): {
  tribes: { name: string }[];
  castaways: { name: string; photoUrl: string; tribeName: string | null; props: Record<string, string>; bio: CastBio | null }[];
};
export function toCastRoles(parsed: ParsedCast, format: CastFormat): { castaways: { name: string; role: string }[] };
export function roleChoices(format: CastFormat): string[];
export function cleanBio(raw: unknown, repairs: { at: string; message: string }[], at: string): CastBio | null;
export function cleanProps(raw: unknown, props: RulebookCastProperty[], repairs: { at: string; message: string }[], at: string): Record<string, string>;
export const BIO_KEYS: (keyof CastBio)[];
