"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const result = await resetPassword({ newPassword: password, token });
      if (result.error) setError(result.error.message || "Couldn't reset your password.");
      else setDone(true);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-destructive">This reset link is missing its token — use the link from your email directly.</p>;
  }

  if (done) {
    return (
      <div>
        <p className="mb-3 text-sm text-good">Password updated.</p>
        <Button onClick={() => router.push("/account")}>Sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <p className="mb-1 text-sm text-muted-foreground">Choose a new password (8+ characters).</p>
      <Input
        placeholder="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-[360px]">
      <h2 className="mb-[18px] text-2xl font-bold tracking-tight">Set a new password</h2>
      <div className="rounded-lg border border-border bg-card p-[18px_20px] shadow-sm">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        <Link href="/account" className="font-semibold text-chyron-line hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
