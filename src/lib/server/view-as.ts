import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// A site admin's View as (the desk header's eye): the app as a player or a commissioner sees it, on the admin's own
// account and data. Nobody's impersonated and nothing's logged. The `gys_view_as` cookie holds `<lens>.<userId>`; it only
// ever takes power away, so a forged one can't do harm, and it's read only for the account it names (an admin acting as
// someone, or a cookie left behind by another account on this device, reads nothing).
//   commissioner -- no site admin: each game at your own role in it (a Commissioner where you run it).
//   player       -- that, and a member in every game you're in.
// Server side it's requireSession (auth-helpers.ts: no admin), requireLeagueRole and show-space.ts games() (a member);
// the signed-in layout tells the screens (session.tsx viewingAs), and the profile menu's Admin row is the way back.

export type ViewAs = "player" | "commissioner";
export const VIEW_AS_COOKIE = "gys_view_as";

function parse(value: string | undefined, userId: string): ViewAs | null {
  const [lens, id] = (value ?? "").split(".");
  return id === userId && (lens === "player" || lens === "commissioner") ? lens : null;
}

/** The lens this request's cookie names for this account, from a Request's own headers. */
export function viewAsOf(req: Request, userId: string): ViewAs | null {
  const raw = req.headers.get("cookie") ?? "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(`${VIEW_AS_COOKIE}=`));
  return parse(hit ? decodeURIComponent(hit.slice(VIEW_AS_COOKIE.length + 1)) : undefined, userId);
}

/** The same, from the request being handled (a layout, or a read with no Request to hand); null outside a request. */
export async function viewAsFor(userId: string): Promise<ViewAs | null> {
  try {
    return parse((await cookies()).get(VIEW_AS_COOKIE)?.value, userId);
  } catch {
    return null;
  }
}

export function withViewAs<T extends NextResponse>(res: T, lens: ViewAs | null, userId: string): T {
  if (lens) {
    res.cookies.set(VIEW_AS_COOKIE, `${lens}.${userId}`, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
    });
  } else {
    res.cookies.delete(VIEW_AS_COOKIE);
  }
  return res;
}
