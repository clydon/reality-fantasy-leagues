// A lineup's slots matched in the browser (docs/PLAN-cast-properties.md chunk 5): the lineup sheet edits starters before saving,
// so it matches them to slots itself, from what the server says each player can fill (LineupMove.lineupSlots.fits). The engine's
// own matching is StateLogic.SlotLogic (the same rule: each starter in a slot that takes them, one each); this one only labels.

/** Who fills which slot: slot index -> id or null, starters in their order, a narrower slot to an earlier starter. */
export function matchSlots(starters: string[], fits: Record<string, number[]>, widths: number[]): (string | null)[] {
  const owner: (string | null)[] = widths.map(() => null);
  const tryId = (id: string, seen: Set<number>): boolean => {
    for (const i of fits[id] ?? []) {
      if (seen.has(i)) continue;
      seen.add(i);
      if (owner[i] === null || tryId(owner[i]!, seen)) {
        owner[i] = id;
        return true;
      }
    }
    return false;
  };
  starters.forEach((id) => tryId(id, new Set()));
  // Tidied as the engine tidies it: an earlier starter in the narrower slot, where each fits the other's.
  const rank = (id: string | null) => (id === null ? Infinity : starters.indexOf(id));
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (let i = 0; i < owner.length; i++)
      for (let j = 0; j < owner.length; j++) {
        const a = owner[i];
        const b = owner[j];
        if (i === j || a === null || b === null) continue;
        const narrower = widths[i] < widths[j] || (widths[i] === widths[j] && i < j);
        if (narrower && rank(b) < rank(a) && (fits[b] ?? []).includes(i) && (fits[a] ?? []).includes(j)) {
          owner[i] = b;
          owner[j] = a;
          changed = true;
        }
      }
  }
  return owner;
}

/** Whether adding `id` to `starters` still gives everyone a slot. */
export function fitsWith(starters: string[], id: string, fits: Record<string, number[]>, widths: number[]): boolean {
  const owner = matchSlots([...starters, id], fits, widths);
  return owner.filter((x) => x !== null).length === starters.length + 1;
}
