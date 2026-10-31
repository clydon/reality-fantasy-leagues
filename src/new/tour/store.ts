// Settings' Take the tour (docs/PLAN-first-time-tour.md): asks Home to play the tour again, once, on its next visit. Not the
// address, so going back to Home leaves no ?tour in the history (`/home?tour=1` also plays it, for a link); this tab's
// sessionStorage as well as this page, because Back to Home can be the browser's own back to a page loaded before (a full
// load, which starts the page's flags over). Home reads it as it mounts (`tourAsked`) and clears it once taken.

const KEY = "gys.tour.ask";
let asked = false;

export function askTour() {
  asked = true;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* this tab keeps nothing: the flag in this page still asks */
  }
}

export function tourAsked() {
  if (asked) return true;
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearTourAsk() {
  asked = false;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing kept */
  }
}
