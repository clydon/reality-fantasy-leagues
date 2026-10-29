import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isSuperAdminUser } from "@/lib/server/auth-helpers";
import { paths } from "@/new/routes";

// Classic's admin retired (docs/PLAN-desk-parity.md step 8): every old /admin address sends a site admin to the desk's page
// for the same thing (a person, a game, a show, a season and the pages under it, Reports, Settings), else the Inbox. Signed
// out, you sign in and come back here; anyone else goes home, as classic's admin gate only ever refused them. A route, not
// a page: a real redirect, before classic's shell (AuthGate) would hold the page back.
export async function GET(req: NextRequest, ctx: RouteContext<"/admin/[[...path]]">) {
  const { path = [] } = await ctx.params;
  const session = await auth.api.getSession({ headers: req.headers });
  const to = !session
    ? paths.signin(`/admin${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`)
    : !isSuperAdminUser(session.user)
      ? "/"
      : deskFor(path);
  return NextResponse.redirect(new URL(to, req.url), 307);
}

/** The desk's page for one of classic's admin addresses. */
function deskFor(path: string[]): string {
  const [first, id, sub, n, last] = path;
  const e = id ? encodeURIComponent(id) : "";
  switch (first) {
    case "users":
      return id ? paths.deskItem("person", e) : paths.deskPeople();
    case "leagues":
      return id ? paths.deskItem("game", e) : paths.deskGames();
    case "shows":
      if (id === "new") return paths.deskNew();
      return id ? paths.deskItem("show", e) : paths.deskShows();
    case "seasons":
      if (!id) return paths.deskShows();
      if (sub === "setup" || sub === "cast") return paths.deskSeasonPage(e, sub);
      if (sub === "episodes" && /^[1-9][0-9]{0,3}$/.test(n ?? "") && (!last || last === "review")) return paths.deskEpisode(e, Number(n));
      return paths.deskItem("season", e);
    case "reports":
      return paths.deskReports();
    case "site":
      return paths.desk("settings");
    default:
      return paths.desk();
  }
}
