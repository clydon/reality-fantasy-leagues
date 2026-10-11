"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import { Field, FrontDoor, FrontDoorTitle, SubmitButton } from "@/components/auth/front-door";
import { BackToSignIn } from "@/components/auth/back-to-sign-in";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await requestPasswordReset({ email, redirectTo: "/reset-password" });
    } finally {
      // Always show the same confirmation regardless of whether the email is registered --
      // matches Better Auth's own user-enumeration-prevention behavior on the server side.
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <FrontDoor
      aside={<BackToSignIn />}
      title={
        <FrontDoorTitle
          detail={
            sent
              ? undefined
              : "Enter your account’s email and we’ll send you a link to set a new one."
          }
        >
          {sent ? "Check your email" : "Forgot your password?"}
        </FrontDoorTitle>
      }
    >
      {sent ? (
        <div className="text-base">
          <p>
            If an account uses <b className="break-all">{email}</b>, a reset link is on its way. It can take a minute or two.
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Local dev with no email provider: the link is in the server console (see{" "}
              <code className="rounded bg-secondary px-1 py-0.5">src/lib/auth.ts</code>).
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <p className="mt-3 text-sm text-muted-foreground">
            Signed up with only a username? Ask the site admin for a temporary password instead.
          </p>
          <SubmitButton disabled={loading}>{loading ? "Sending…" : "Send reset link"}</SubmitButton>
        </form>
      )}
    </FrontDoor>
  );
}
