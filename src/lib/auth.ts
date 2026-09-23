import { betterAuth } from "better-auth";
import { username, admin } from "better-auth/plugins";
import { Pool } from "pg";

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
  database: new Pool({
    connectionString: process.env.AUTH_DATABASE_URL,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // No email-verification requirement in this POC -- see README. Real production use should
    // turn this on once a real transactional-email provider is wired in.
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password: ${url}\n\nIf you didn't request this, ignore this email.`,
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
    admin(),
  ],
});

// Dev-mode fallback: without a real RESEND_API_KEY, reset links are logged to the server
// console instead of emailed -- lets the whole flow be exercised locally with zero external
// dependency, while staying a one-line swap away from actually sending mail.
async function sendAuthEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
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
