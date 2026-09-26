// Sign-up takes a username, an email, or both. Better Auth needs every account to have a unique
// email, so a username-only account is stored with a stand-in on the reserved `.invalid` domain
// (RFC 2606: guaranteed never to resolve), which can never receive mail. Everywhere that shows or
// sends to an email treats it as "no email".
export const NO_EMAIL_DOMAIN = "no-email.invalid";

// A random suffix, not just the username: emails must be unique, and a plain `name@...` could be
// claimed by someone else first (or be left behind when a username changes) and block that name.
export function placeholderEmail(username: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${username.trim().toLowerCase()}.${suffix}@${NO_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${NO_EMAIL_DOMAIN}`);
}

/** The email to show a person, or null when the account has none. */
export function realEmail(email: string | null | undefined): string | null {
  return email && !isPlaceholderEmail(email) ? email : null;
}
