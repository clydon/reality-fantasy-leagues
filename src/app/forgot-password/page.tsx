"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-[360px]">
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Reset password</h2>
      <div className="rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        {sent ? (
          <p className="text-sm">
            If an account exists for <b>{email}</b>, a reset link has been sent. In local dev with no email provider
            configured, check the server console instead (see <code className="rounded bg-secondary px-1 py-0.5">src/lib/auth.ts</code>).
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <p className="mb-1 text-sm text-muted-foreground">Enter your account email and we&rsquo;ll send a reset link.</p>
            <input
              className="rounded-md border border-border bg-card px-2.5 py-[7px] text-[0.88rem]"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
