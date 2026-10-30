// Words a game's seats share between the desk's server and its screens (docs/PLAN-desk-parity.md part 6b).

/** Why no account can be linked to a seat in a game on no couch, else null: a practice game, a public pool. */
export const noLinkFor = (solo: string | null | undefined): string | null =>
  solo === "practice" ? "A practice game is its maker's alone" : solo === "public" ? "A public pool is joined from its show's Games tab" : null;
