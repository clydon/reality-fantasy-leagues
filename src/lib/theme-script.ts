// The theme's storage key and the inline <head> script that applies it before the first paint.
// Separate from theme.ts (a client module) because the root layout, a Server Component, needs the
// script as a plain string.
export const THEME_KEY = "rfl.theme";

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;
