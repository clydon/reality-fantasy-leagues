// Types for formats/rulebook-describe.js: the How it works page's view model and its pieces.
import type { FormatData } from "./index";
import type { BlockKey, RulebookAliases, RulebookBlocks, RulebookKind, RulebookPhase, RulebookSegment, RulebookTwist } from "./rulebook-schema";

export interface PointItem {
  id: string;
  label: string;
  /** Absent on a talk show: its moments don't score. */
  points?: number;
  /** Known without asking: how they left, a role. */
  auto: boolean;
  /** The league answers it. */
  league: boolean;
}
export interface PointGroup {
  id: string;
  label: string;
  items: PointItem[];
}

export interface RulebookUpdate {
  episode: number;
  /** start: where the rules (and a game) start; end: a game over a span's last episode; fix, showChanged: the rulebook's edits. */
  kind: "start" | "end" | "fix" | "showChanged";
  title?: string;
  detail?: string;
}

export interface PointsOpts {
  /** The format data the league or season plays by: its catalog and points. */
  compiled?: FormatData;
  aliases?: RulebookAliases;
  /** A league's own points (settings.eventPoints). */
  points?: Record<string, number>;
  ownership?: "exclusive" | "shared";
  /** The last episode the reader may be told about (guard.ts seenThrough); Infinity = everything. */
  seen?: number;
}

export interface HowItWorksOpts extends PointsOpts {
  episodeCount?: number | null;
  phaseStarts?: Record<string, number>;
  castCount?: number;
  updates?: RulebookUpdate[];
  lineage?: string | null;
}

export interface HowItWorks {
  kind: { key: RulebookKind; name: string; start: string | null; line: string };
  show: string | null;
  tagline: string | null;
  premise: string | null;
  jump: { key: "rundown" | "season" | "who" | "points"; label: string | null }[];
  rundown: {
    label: string | null;
    segments: {
      n: number;
      id: string;
      name: string;
      summary: string | null;
      decided: string | null;
      often: string | null;
      stake: { key: string; label: string } | null;
    }[];
  };
  season: {
    label: string | null;
    unit: string;
    total: number | null;
    /** How far the reader has seen, capped at the season's length; null when unknown. */
    you: number | null;
    cells: { n: number; seen: boolean; next: boolean; finale: boolean }[];
    phases: { id: string; name: string; when: string; started: boolean; summary: string | null; finale?: true }[];
    finale: string | null;
  };
  who: { label: string | null; count: number | null; line: string; groups: string | null };
  waysOut: { label: string; out: { id: string; name: string; means: string }[]; finish: { id: string; name: string; means: string }[]; end: string | null } | null;
  twists: { label: string; items: { id: string; name: string; type: string; typeLabel: string; line: string }[] } | null;
  points: { label: string | null; aside: string; noPoints: boolean; groups: PointGroup[] };
  updates: {
    shown: { episode: number; kind: string; title: string; detail: string; tag: string | null }[];
    hidden: { count: number; from: number; title: string; detail: string } | null;
  };
  lineage: string | null;
  results: string;
  games: { key: string; name: string }[];
}

export function howItWorks(blocks: RulebookBlocks, opts?: HowItWorksOpts): HowItWorks;
export function pointGroups(blocks: RulebookBlocks, opts?: PointsOpts): PointGroup[];
export function updatesFor(blocks: RulebookBlocks, updates: RulebookUpdate[] | undefined, seen?: number): HowItWorks["updates"];
export function blockSummaries(blocks: RulebookBlocks): { block: BlockKey; label: string; summary: string }[];
export function decidedLine(segment: RulebookSegment, blocks?: RulebookBlocks): string | null;
export function stakeOf(segment: RulebookSegment): { key: string; label: string } | null;
export function oftenLine(segment: RulebookSegment, blocks: RulebookBlocks): string | null;
export function segmentLine(segment: RulebookSegment, blocks: RulebookBlocks): string;
export function startText(phase: RulebookPhase, blocks: RulebookBlocks, opts?: { phaseStarts?: Record<string, number>; seen?: number }): string;
export function phaseStart(phase: RulebookPhase, phaseStarts?: Record<string, number>): number | null;
export function whoLine(blocks: RulebookBlocks, count?: number): string;
export function groupsLine(blocks: RulebookBlocks): string | null;
export function finaleLine(blocks: RulebookBlocks): string | null;
export function twistLine(twist: RulebookTwist): string;
