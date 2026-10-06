import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api-route";
import { requireSuperAdmin, isUuid } from "@/lib/server/auth-helpers";
import { pool, HttpError } from "@/lib/server/db";
import { approveFormat } from "@db/show-formats.js";
import { pushShowFormat } from "@/lib/server/show-formats";

type RouteParams = { id: string };

// "Approve & create show": re-derives the draft on the server, refuses unless it's approvable, stores its
// data, and then either creates a show playing by it or switches an existing show to it (pushing the new
// rules into that show's leagues). `domains` are the research domains the admin ticked on the review
// screen; suggestions are never applied without that.
export const POST = apiRoute(async (req, { params }: { params: Promise<RouteParams> }) => {
  const { id } = await params;
  const user = await requireSuperAdmin(req);
  const body = (await req.json().catch(() => ({}))) as { createShow?: boolean; showId?: unknown; domains?: unknown };
  const domains = Array.isArray(body.domains) ? body.domains.map(String).filter((d) => d.includes(".")) : [];
  if (body.showId !== undefined && !(typeof body.showId === "string" && isUuid(body.showId))) throw new HttpError(400, "showId must be a show's id");

  const approved = await approveFormat(pool, id, user.id);
  if (!approved) throw new HttpError(404, "Format not found");
  if (approved.refused) {
    return NextResponse.json({ format: approved, error: "It can't be approved yet: fix the problems listed first." }, { status: 409 });
  }
  const data = approved.data!;

  let show: { id: string; slug: string; name: string } | null = null;
  let leaguesUpdated = 0;
  if (body.createShow) {
    const slug = data.id.slice(0, 40);
    try {
      const { rows } = await pool.query(
        `INSERT INTO shows (slug, name, castaway_term, tribe_term, format, research_domains)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, slug, name`,
        [slug, data.name, data.terms.castaway, data.terms.tribe, data.id, domains.length ? domains : null]
      );
      show = rows[0];
    } catch (e) {
      if ((e as { code?: string }).code === "23505") {
        // The format is approved either way; the show just needs a different name.
        throw new HttpError(409, `The format is approved, but a show with the slug "${slug}" already exists. Switch that show to it, or rename one.`);
      }
      throw e;
    }
  } else if (typeof body.showId === "string") {
    const { rows } = await pool.query(
      `UPDATE shows SET format=$2, research_domains=COALESCE($3, research_domains), updated_at=now() WHERE id=$1 RETURNING id, slug, name`,
      [body.showId, data.id, domains.length ? domains : null]
    );
    if (!rows.length) throw new HttpError(404, "Show not found");
    show = rows[0];
    leaguesUpdated = await pushShowFormat(show!.slug);
  }
  return NextResponse.json({ format: approved, show, leaguesUpdated });
});
