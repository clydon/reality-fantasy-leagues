"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/auth-client";
import { Field, FormError, FrontDoor, FrontDoorTitle, SubmitButton } from "@/components/auth/front-door";
import { BackToSignIn } from "@/components/auth/back-to-sign-in";

function ResetPassword() {
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

  const title = !token ? "This link is incomplete" : done ? "Password updated" : "Set a new password";
  const detail = !token
    ? "It’s missing part of its address. Open the link from your email directly, or ask for a new one."
    : done
      ? "Sign in with your new password."
      : undefined;

  return (
    <FrontDoor aside={<BackToSignIn />} title={<FrontDoorTitle detail={detail}>{title}</FrontDoorTitle>}>
      {!token ? (
        // A link styled as the sheet's action: there is nothing to submit here.
        <Link
          href="/forgot-password"
          className="type-caption flex h-[52px] w-full items-center justify-center rounded-[3px] bg-chyron text-[22px] text-chyron-foreground hover:brightness-[1.06]"
        >
          Get a new link
        </Link>
      ) : done ? (
        <Link
          href="/"
          className="type-caption flex h-[52px] w-full items-center justify-center rounded-[3px] bg-chyron text-[22px] text-chyron-foreground hover:brightness-[1.06]"
        >
          Sign in
        </Link>
      ) : (
        <form onSubmit={submit}>
          <Field
            label="New password"
            hint="(8 or more characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          {error && <FormError>{error}</FormError>}
          <SubmitButton disabled={loading}>{loading ? "Saving…" : "Set new password"}</SubmitButton>
        </form>
      )}
    </FrontDoor>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <ResetPassword />
    </Suspense>
  );
}
