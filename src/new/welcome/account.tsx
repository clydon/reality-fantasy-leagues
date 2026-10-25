"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { MailCheck } from "lucide-react";
import { signIn, signInWithIdentifier, signUp, updateUser } from "@/lib/auth-client";
import { placeholderEmail } from "@/lib/no-email";
import { usernameFrom } from "../way-in";
import { Btn } from "../ui/parts";
import { Sheet } from "../ui/sheet";

// Making an account in the new design (docs/PLAN-new-design.md step 9 part 2; the mock's landing.js socialHTML,
// formHTML and usernameSheet): Continue with Google when its OAuth app is set up (no keys, no button: way-in.ts
// googleOn), else a username, an optional email and a password through Better Auth's username plugin, the way
// classic's sign-up makes them (a username alone is stored with a stand-in email, no-email.ts). Apple needs a paid
// developer account, so it isn't offered. An email given has to be verified before the account signs in (auth.ts):
// the link comes back to `callbackURL` signed in.

const GOOGLE = (
  <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.4 7.2-17.6z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-8-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

/** Continue with Google: off to Google and back to `callbackURL` signed in (`newUser` for an account it just made). */
export function GoogleButton({ callbackURL, newUserCallbackURL, errorCallbackURL }: { callbackURL: string; newUserCallbackURL?: string; errorCallbackURL: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Btn
      wide
      data-google
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await signIn.social({ provider: "google", callbackURL, newUserCallbackURL: newUserCallbackURL ?? callbackURL, errorCallbackURL }).catch(() => null);
        if (!r || r.error) setBusy(false);
      }}
    >
      {GOOGLE}
      {busy ? "Opening Google…" : "Continue with Google"}
    </Btn>
  );
}

/** "or use email" between the provider and the form. */
export function OrLine({ children = "or use email" }: { children?: ReactNode }) {
  return (
    <div className="my-1 flex items-center gap-2.5 text-[13px] text-muted-foreground" aria-hidden>
      <i className="h-px flex-1 bg-border" />
      {children}
      <i className="h-px flex-1 bg-border" />
    </div>
  );
}

/** A form field: its label (and something on its right), the input at 16px so a phone doesn't zoom. */
export function Field({ label, aside, hint, id, ...input }: ComponentProps<"input"> & { label: string; aside?: ReactNode; hint?: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-semibold">
          {label}
          {hint && <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span>}
        </label>
        {aside}
      </div>
      <input
        id={id}
        {...input}
        className="h-[52px] w-full rounded-[3px] bg-background px-3.5 text-[16px] outline-1 -outline-offset-1 outline-input placeholder:text-muted-foreground/70 focus:outline-2 focus:outline-chyron-line aria-[invalid=true]:outline-live"
      />
    </div>
  );
}

/** Better Auth's words for what went wrong, in ours. */
export function authError(e: { code?: string; message?: string } | null | undefined, fallback: string): string {
  switch (e?.code) {
    case "USERNAME_IS_ALREADY_TAKEN":
      return "That username's taken. Try another.";
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "INVALID_USERNAME":
      return "A username is 3 to 30 letters, numbers, underscores or dots.";
    case "PASSWORD_TOO_SHORT":
      return "Make the password at least 8 characters.";
    case "INVALID_EMAIL":
      return "That email doesn't look right.";
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That username or password isn't right.";
    case "EMAIL_NOT_VERIFIED":
      return "Verify your email first: the link is in your inbox.";
    default:
      return e?.message || fallback;
  }
}

export type Made = { signedIn: true } | { checkEmail: string };

/**
 * The account form: a username (the name the couch sees), an email if you'd like one (for resetting a password), a
 * password. Made: signed in at once (a username alone), or waiting on the emailed link.
 */
export function AccountForm({ callbackURL, cta = "Create account", onMade }: { callbackURL: string; cta?: string; onMade: (m: Made) => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invalid = error ? { "aria-invalid": true, "aria-describedby": "acct-error" } : {};
  return (
    <form
      className="flex flex-col gap-3"
      data-account-form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const u = username.trim();
        const em = email.trim();
        if (!u) return setError("Pick a username: it's the name your couch sees.");
        if (password.length < 8) return setError("Make the password at least 8 characters.");
        setBusy(true);
        setError(null);
        try {
          const made = await signUp.email({ name: u, username: u, email: em || placeholderEmail(u), password, callbackURL });
          if (made.error) return setError(authError(made.error, "Couldn't make the account. Try again."));
          // An email has to be verified before the account signs in (auth.ts requireEmailVerification).
          if (!made.data.user.emailVerified) return onMade({ checkEmail: em });
          const signedIn = await signInWithIdentifier(u, password);
          if (signedIn.error) return setError(authError(signedIn.error, "Made the account, but couldn't sign you in. Try signing in."));
          onMade({ signedIn: true });
        } catch {
          setError("Couldn't reach the server. Try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="acct-username" label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="alex" maxLength={30} {...invalid} />
      <Field id="acct-email" label="Email" hint="(optional, for resetting your password)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
      <Field id="acct-password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" {...invalid} />
      {error && (
        <p id="acct-error" role="alert" className="text-[14px] font-semibold text-live">
          {error}
        </p>
      )}
      <Btn type="submit" tone="must" wide className="type-caption mt-1 h-14 text-[20px]" disabled={busy}>
        {busy ? "Making it…" : cta}
      </Btn>
    </form>
  );
}

/** The emailed link's wait: where it went, and that it comes back here signed in. */
export function CheckEmail({ email, line }: { email: string; line: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[4px] bg-card p-3.5" data-check-email role="status">
      <MailCheck className="mt-0.5 size-6 flex-none text-good" aria-hidden />
      <p className="text-[15px] leading-snug">
        Check <b className="break-all">{email}</b> for a link to confirm it. {line}
      </p>
    </div>
  );
}

/** After Google: the name the couch sees (Google gives a name, not a username). Closing it keeps Google's name for now. */
export function UsernameSheet({ open, email, onDone }: { open: boolean; email: string | null; onDone: (username: string | null) => void }) {
  const [username, setUsername] = useState(() => usernameFrom(email ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onDone(null)} title="Pick a username" subtitle={email ? `Signed in with Google as ${email}` : "Signed in with Google"}>
      <form
        className="flex flex-col gap-3"
        data-username-sheet
        onSubmit={async (e) => {
          e.preventDefault();
          const u = username.trim();
          if (busy || !u) return;
          setBusy(true);
          setError(null);
          const r = await updateUser({ username: u } as Parameters<typeof updateUser>[0]).catch(() => null);
          setBusy(false);
          if (!r || r.error) return setError(authError(r?.error, "Couldn't save it. Try again."));
          onDone(u);
        }}
      >
        <Field id="pick-username" label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={30} aria-invalid={!!error} />
        <p className="text-[13px] leading-snug text-muted-foreground">This is the name your couch sees.</p>
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-live">
            {error}
          </p>
        )}
        <Btn type="submit" tone="must" wide disabled={busy || !username.trim()}>
          {busy ? "Saving…" : "Continue"}
        </Btn>
      </form>
    </Sheet>
  );
}
