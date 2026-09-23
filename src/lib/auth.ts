import { betterAuth } from "better-auth";
import { Pool } from "pg";

// This app's OWN account system (email/password + reset), completely separate from the
// SurvivorDraft login elsewhere in this repo (src/lib/api.ts / auth-gate.tsx) -- that's a
// different app's session reached over CORS. Better Auth gets its own Postgres database
// (AUTH_DATABASE_URL, a plain pg.Pool -- no ORM, consistent with this project's conventions)
// rather than reusing SurvivorDraft's `users` table, which means something else entirely
// (friend-group league accounts, not this product's own signups). See README for why.
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
