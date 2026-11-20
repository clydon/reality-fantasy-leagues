import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

// A live preview's viewer signed in on the preview host with no password (docs/PLAN-preview-release.md, step 4): Better Auth's own
// session for that user, made on the server once its one-use way in checks out (src/lib/server/preview-live.ts). The endpoint is
// server-only (the router never serves SERVER_ONLY endpoints: `auth.api.previewSession` is the only way to call it), and it signs in
// only a preview's made-up people (the live tier's usernames, `<name>_ztgb<hex>`), never anyone real.
export const PREVIEW_USER = /^[a-z0-9]{1,12}_ztgb[0-9a-f]{8}[0-9]{1,2}$/;

export const previewSession = () =>
  ({
    id: "preview-session",
    endpoints: {
      previewSession: createAuthEndpoint("/preview-session", { method: "POST", metadata: { SERVER_ONLY: true } }, async (ctx) => {
        const userId = (ctx.body as { userId?: unknown } | undefined)?.userId;
        if (typeof userId !== "string") throw new APIError("BAD_REQUEST", { message: "Which user?" });
        const user = await ctx.context.internalAdapter.findUserById(userId);
        const name = (user as { username?: string | null } | null)?.username ?? "";
        if (!user || !PREVIEW_USER.test(name)) throw new APIError("FORBIDDEN", { message: "Not a preview's person" });
        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ ok: true });
      }),
    },
  }) satisfies BetterAuthPlugin;
