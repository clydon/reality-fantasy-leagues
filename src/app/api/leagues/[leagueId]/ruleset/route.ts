import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireLeagueRole } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { isBuiltInFormat, DEFAULT_FORMAT } from "@/lib/game/formats/index.js";
import { getLeagueRuleset } from "@db/league-rulesets.js";
import { forkLeagueRuleset, editLeagueRuleset, abandonLeagueRuleset } from "@/lib/server/league-rulesets";
import type { FormatData } from "@/lib/game/formats/index";

type RouteParams = { leagueId: string };
const FORK_KINDS = ["builtin", "show_format", "league_ruleset", "scratch"];

// Read-only: anyone in the league can see whether it's on its own ruleset or following its show's
// format as-is (the vast majority). Writing one is commissioner-only, below.
export const GET = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "member");
  const custom = await getLeagueRuleset(pool, leagueId);
  if (custom) return NextResponse.json({ custom });
  const { rows } = await pool.query("SELECT state->'settings'->>'showFormat' AS format FROM leagues WHERE id=$1", [leagueId]);
  const id = rows[0]?.format || DEFAULT_FORMAT;
  return NextResponse.json({ custom: null, following: { kind: isBuiltInFormat(id) ? "builtin" : "show_format", id } });
});

// Forks a new copy for this league -- from a built-in, an approved show format, another league's
// shared ruleset, or from scratch -- and switches the league onto it immediately.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId } = await params;
  const { user } = await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as {
    from?: string;
    sourceId?: string;
    name?: string;
    data?: unknown;
  };
  if (!body.from || !FORK_KINDS.includes(body.from)) {
    throw new HttpError(400, `from must be one of ${FORK_KINDS.join(", ")}`);
  }
  if (body.from === "scratch") {
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new HttpError(400, "data required to start from scratch");
  } else if (!body.sourceId) {
    throw new HttpError(400, "sourceId required");
  }
  const source =
    body.from === "scratch"
      ? { from: "scratch" as const, name: body.name, data: body.data as FormatData }
      : { from: body.from as "builtin" | "show_format" | "league_ruleset", sourceId: body.sourceId!, name: body.name };
  const result = await forkLeagueRuleset(leagueId, source, user.id);
  if ("refused" in result) return NextResponse.json({ error: "Those rules aren't usable yet", problems: result.refused }, { status: 409 });
  return NextResponse.json({ ruleset: result.created }, { status: 201 });
});

// Edits this league's own copy. 404 if it doesn't have one yet -- fork first.
export const PATCH = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const body = (await req.json().catch(() => ({}))) as { data?: unknown };
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new HttpError(400, "data required");
  const result = await editLeagueRuleset(leagueId, body.data as FormatData);
  if ("notFound" in result) throw new HttpError(404, "This league doesn't have its own ruleset yet");
  if ("refused" in result) return NextResponse.json({ error: "Those rules aren't usable yet", problems: result.refused }, { status: 409 });
  return NextResponse.json({ ruleset: result.updated });
});

// Abandons this league's own copy and reverts to following its show's format as-is.
export const DELETE = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { leagueId } = await params;
  await requireLeagueRole(req, leagueId, "commissioner");
  const outcome = await abandonLeagueRuleset(leagueId);
  return NextResponse.json(outcome);
});
