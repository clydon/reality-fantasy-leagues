// A username as the app's sign-up has it (Better Auth's username plugin, auth.ts: 3 to 30 letters, numbers, underscores
// or dots, kept in lower case). Shared by Settings' rename (profile.ts) and the desk's Name and email, server and sheet.

export const USERNAME_RULE = "A name is 3 to 30 letters, numbers, underscores or dots.";

/** A name, already trimmed and lower-cased, that sign-up would take (taken or not). */
export const isUsername = (n: string) => /^[a-z0-9_.]{3,30}$/.test(n);
