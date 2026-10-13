"use client";

import { useState } from "react";
import { signInWithIdentifier, signUp } from "@/lib/auth-client";
import { placeholderEmail } from "@/lib/no-email";
import { Field, FORM_ERROR_ID, FormError, SubmitButton } from "./front-door";

// Creating an account: a username, an email, or both (sign-in takes either), a password, and an
// optional display name. Lives on the front door's Create account side, and on /account for a
// visitor touring without an account.
export function SignUpForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const u = username.trim();
    const em = email.trim();
    // Either is enough; both is fine. Sign-in later takes whichever they gave.
    if (!u && !em) {
      setError("Enter a username, an email, or both.");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp.email({
        // Display name defaults to the username, or the email's first part, and can be changed later.
        name: name.trim() || u || em.split("@")[0],
        ...(u ? { username: u } : {}),
        email: em || placeholderEmail(u),
        password,
      });
      if (result.error) {
        setError(result.error.message || "Something went wrong.");
        return;
      }
      // requireEmailVerification (auth.ts) means a real-email signup gets no session until they
      // click the link. Better Auth skips auto-sign-in for EVERY signup once that's on, though,
      // even a username-only one that databaseHooks (auth.ts) already marked verified at creation
      // -- its emailVerified:true says it doesn't need to wait, so sign it in explicitly rather
      // than bounce it back to a blank sign-in form with no session and no explanation either.
      if (!result.data.user.emailVerified) {
        setCheckEmail(true);
        return;
      }
      if (!result.data.token) {
        const signedIn = await signInWithIdentifier(u || em, password);
        if (signedIn.error) {
          setError(signedIn.error.message || "Account created, but couldn't sign you in -- try signing in.");
          return;
        }
      }
      // Deliberately a full load, not router.refresh(): AuthGate decides between the front door
      // and the app shell once, on mount, from its own session check (see auth-gate.tsx). Without
      // this the new account would sit on a page rendered for a signed-out visitor.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/account";
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }

  const invalid = error ? { "aria-invalid": true, "aria-describedby": FORM_ERROR_ID } : {};

  if (checkEmail) {
    return (
      <p className="text-sm text-muted-foreground">
        Check <strong className="text-foreground">{email.trim()}</strong> for a link to verify your account. Once
        you click it you&rsquo;ll be signed in.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <p className="mb-4 text-sm text-muted-foreground">
        Give a username, an email, or both, and sign in with either. Without an email, a forgotten password can&rsquo;t
        be reset by email.
      </p>
      <div className="flex flex-col gap-3.5">
        <Field label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} {...invalid} />
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" {...invalid} />
        <Field label="Display name" hint="(optional)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <Field
          label="Password"
          hint="(8 or more characters)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          {...invalid}
        />
      </div>
      {error && <FormError>{error}</FormError>}
      <SubmitButton disabled={loading}>{loading ? "Creating account…" : "Create account"}</SubmitButton>
    </form>
  );
}
