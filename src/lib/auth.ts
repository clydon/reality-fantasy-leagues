import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import { Pool } from "pg";
import { isPlaceholderEmail } from "@/lib/no-email";
import { signupModeOf } from "@/lib/signups";

const authPool = new Pool({
  connectionString: process.env.AUTH_DATABASE_URL,
});

// Google sign-in (docs/PLAN-new-design.md step 9 part 2), only once its OAuth app's keys are in the environment: without
// them there's no provider, and the way in shows no Google button (way-in.ts googleOn). Its redirect URI is
// BETTER_AUTH_URL + /api/auth/callback/google. Apple needs a paid developer account, so it waits.
function socialProviders() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { google: { clientId, clientSecret, prompt: "select_account" as const } } : {};
}

// Who gets in (src/lib/signups.ts, the desk's Settings): with sign-ups open, a new account is let in as it's made.
async function openSignups(): Promise<boolean> {
  try {
    const { rows } = await authPool.query("SELECT value FROM app_settings WHERE key = 'signups'");
    return signupModeOf(rows[0]?.value) === "open";
  } catch {
    return false;
  }
}

// This app's OWN, and now ONLY, account system -- the real identity behind everything in this
// repo (leagues, players, admin), not a parallel system nobody's league memberships are attached
// to. That used to not be true (Better Auth was a standalone signup with nothing wired to it,
// while real league access went through a totally separate SurvivorDraft session over CORS) --
// see README for that history. It changed once this repo got its own backend instead of riding
// on SurvivorDraft's: at that point there was no reason for two logins to keep existing, so this
// one absorbed the job.
//
// Chosen per explicit direction: Better Auth (not NextAuth/Auth.js), traditional email+password
// with a real reset-password flow (not magic-link-only) -- researched as the better-supported
// 2026 community choice rather than defaulting to older training-data familiarity with NextAuth.
export const auth = betterAuth({
  database: authPool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "https://gameyourshow.com",
    "https://www.gameyourshow.com",
    "https://reality-fantasy-leagues.vercel.app",
  ],
  // Signed in for 60 days since you last used the app, renewed at most daily (updateAge's default).
  // The default 7 is about the gap between two episodes: a player who only opens the app on episode
  // night was signed out about one week in two, and in the installed app that reads as it having
  // forgotten them. Existing sessions move to the new length on their next request.
  session: {
    expiresIn: 60 * 24 * 60 * 60,
  },
  user: {
    additionalFields: {
      // Early access gate (db/migrations/0058_user_approval.sql): `input: false` keeps a signup
      // request from setting this itself -- only an admin's Let in (raw SQL, see
      // desk-person-actions.ts) flips it. defaultValue:false here overrides the
      // column's own DEFAULT true on every signup through this app, so an existing/seeded
      // account stays approved but a genuinely new one starts pending.
      approved: { type: "boolean", defaultValue: false, input: false },
    },
  },
  // A username-only account (no real email -- see no-email.ts) has nothing to verify and could
  // never satisfy requireEmailVerification below, so it's created pre-verified. Applies to every
  // creation path (signup, admin-created users) since this runs at the adapter level. An account
  // made with Google keeps Google's word on its email. With sign-ups open (the desk's Who gets in),
  // it's approved as it's made.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            emailVerified: isPlaceholderEmail(user.email) || user.emailVerified === true,
            ...((await openSignups()) ? { approved: true } : {}),
          },
        }),
      },
    },
  },
  socialProviders: socialProviders(),
  // Sign-in only needs who you are: the provider's tokens are kept (Better Auth stores them) but encrypted.
  // allowDifferentEmails: Settings' Link Google (docs/PLAN-new-design.md step 15 part 1) links a Google sign-in to the
  // account you're signed in to even when its email isn't the account's: a username-only account has no real email to
  // match. It only applies to that signed-in link; signing in with Google still finds an account by its own Google link.
  account: { encryptOAuthTokens: true, accountLinking: { allowDifferentEmails: true } },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Real transactional email is wired up now (Resend) -- see sendVerificationEmail below and
    // db/migrations/0059_backfill_email_verified.sql, which grandfathers in every account that
    // existed before this was turned on.
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      // A username-only account has no real address to send to (see no-email.ts).
      if (isPlaceholderEmail(user.email)) return;
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // Defaults to off: without it, clicking the emailed link verifies the account but leaves them
    // right back at the sign-in form with no session, which reads as the link having done nothing.
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      // Pre-verified by the databaseHooks above -- this shouldn't fire for one, but matches
      // sendResetPassword's own guard rather than assuming that always holds.
      if (isPlaceholderEmail(user.email)) return;
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your email",
        text: `Verify your email to finish creating your account: ${url}\n\nIf you didn't request this, ignore this email.`,
      });
    },
  },
  plugins: [
    // Adds `username`/`displayUsername` to the user model and a `/sign-in/username` endpoint --
    // signup is username + email + password, sign-in accepts either (the client picks which
    // endpoint to call based on whether the input looks like an email; see login-screen.tsx).
    username(),
    // Covers nearly all of the Admin user-management surface natively: list/create/update users,
    // set-password, impersonate/stop-impersonating, ban, sessions, remove -- see that endpoint
    // list in node_modules/better-auth/dist/plugins/admin/routes.mjs. League-scoped admin actions
    // (leagues/memberships) still need custom routes; this plugin has no concept of a league.
    // A stopped account (the desk's Stop them signing in: its ban) is told so plainly at sign-in.
    admin({ bannedUserMessage: "This account can't sign in right now." }),
  ],
});

// Dev-mode fallback: without a real RESEND_API_KEY, reset links are logged to the server
// console instead of emailed -- lets the whole flow be exercised locally with zero external
// dependency, while staying a one-line swap away from actually sending mail. Also the desk's
// Let in (desk-person-actions.ts: "You're in", to someone who was waiting).
export async function sendAuthEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`\n[auth email -- no RESEND_API_KEY set, logging instead of sending]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.AUTH_EMAIL_FROM || "onboarding@resend.dev",
    to,
    subject,
    text,
  });
}
