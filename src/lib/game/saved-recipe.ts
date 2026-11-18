// A saved game's recipe and its identity (docs/PLAN-start-a-game-redo.md B1; the gallery's heart beside Start): the game's rules
// without their dates, and a key from its base and those rules, written the same way whatever order the spec's fields came in. One
// definition for the phone (gallery-bold/saved.ts) and the server (saved-games.ts), so a save made on one is found on the other.

type Spec = Record<string, unknown>;

/** JSON with every object's keys sorted: the same rules always write the same text. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v) ?? "null";
}

/** The rules without their dates: the span, and a game in stages' first start. */
export function recipeOf<T extends Spec>(spec: T): T {
  const { span: _span, ...rest } = spec as Spec;
  void _span;
  if (!Array.isArray(rest.stages)) return rest as T;
  const stages = (rest.stages as Spec[]).map((st, i) => {
    const game = st.game as Spec | undefined;
    if (i !== 0 || !game?.span) return st;
    const { from: _from, ...span } = game.span as Spec;
    void _from;
    const g = { ...game };
    if (Object.keys(span).length) g.span = span;
    else delete g.span;
    return { ...st, game: g };
  });
  return { ...rest, stages } as unknown as T;
}

/** A recipe's identity: its base and its rules. */
export const recipeKey = (base: string, spec: Spec) => `${base}|${stable(recipeOf(spec))}`;
