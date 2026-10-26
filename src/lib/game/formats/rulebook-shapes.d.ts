// Types for formats/rulebook-shapes.js: the library's proposed shapes and show families (step 10 part 3).
import type { RulebookBlocks, RulebookKind } from "./rulebook-schema";

export type ShapeId = "brackets" | "auditions" | "gameShow" | "docuseries" | "awards" | "playoffs" | "bracket" | "race";

export interface Shape {
  id: ShapeId;
  kind: RulebookKind;
  name: string;
  /** The shows it's for, as people say them. */
  like: string[];
  /** How it plays, in a line. */
  line: string;
  fits(blocks: Partial<RulebookBlocks>): boolean;
}

export const SHAPES: Shape[];
export function shapesOf(blocks: Partial<RulebookBlocks> | null | undefined): ShapeId[];
export function shapeById(id: string): Shape | null;
export function familyOf(name: string | null | undefined): string;
export function sameFamily(a: string | null | undefined, b: string | null | undefined): boolean;
