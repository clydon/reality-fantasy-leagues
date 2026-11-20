/** FNV-1a over a string, as an unsigned 32-bit number. */
export function fnv1a(text: string): number;
/** FNV-1a scaled to [0, 1). */
export function fnvUnit(text: string): number;
