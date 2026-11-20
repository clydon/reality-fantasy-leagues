// The gallery's Try it, handed to the preview's wait page (docs/PLAN-preview-release.md, step 15): kept tiny so the gallery doesn't
// load the story's code to say what it wants. The game as set up, on the season and couch it would be made on, and where Back goes.

export interface PreviewAsk {
  season: string;
  couch: string | null;
  game: { base: string; spec?: Record<string, unknown> };
  name: string;
  back: string;
}

/** The tab's session storage key the ask travels under. */
export const PREVIEW_ASK = "gys-preview-ask";

/** The wait page for an ask (src/app/(new)/start/preview-story/live/page.tsx). */
export const PREVIEW_PAGE = "/start/preview-story/live?from=gallery";

/** Hand an ask to the wait page and go there; false when the tab can't keep it (storage refused), so the caller can say so. */
export function tryPreview(ask: PreviewAsk): boolean {
  try {
    sessionStorage.setItem(PREVIEW_ASK, JSON.stringify(ask));
  } catch {
    return false;
  }
  window.location.assign(PREVIEW_PAGE);
  return true;
}

/** What the allowance route answers: whether Try it is offered at all (the desk's switch), and how many are left today. */
export interface PreviewAllowance {
  open: boolean;
  left: number;
  perDay: number;
}

/** Try it's line: the count first, never on the button (the flow spec's §1). */
export const allowanceLine = (a: PreviewAllowance) => (a.left > 0 ? `${a.left} preview${a.left === 1 ? "" : "s"} left today` : "No previews left today: more tomorrow");
