import { THEME_COOKIE } from "./appearance";
import { NEW_DESIGN_PREFIXES } from "@/new/routes";

// The theme's storage key and the inline <head> script that applies it before the first paint.
// Separate from theme.ts (a client module) because the root layout, a Server Component, needs the
// script as a plain string.
export const THEME_KEY = "rfl.theme";

// Two designs, two choices (docs/PLAN-new-design.md step 15 part 4). On the new design's routes, the account's Appearance as this
// device's `gys_theme` cookie has it (src/lib/appearance.ts): Night unless it says studio, or phone (the phone's own setting);
// `data-nd-theme` on <html> says which, for the new design's shell to keep following. Everywhere else, classic's per-browser
// choice (theme.ts). The `dark` class on <html> is what both designs' styles key off.
const NEW_ROUTE = `^(${NEW_DESIGN_PREFIXES.map((p) => p.replace(/\//g, "\\/")).join("|")})(\\/|$)`;

export const THEME_BOOT_SCRIPT = `(function(){try{var h=document.documentElement,q=window.matchMedia("(prefers-color-scheme: dark)").matches,d;if(new RegExp("${NEW_ROUTE.replace(/\\/g, "\\\\")}").test(location.pathname)){var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/),t=m?m[1]:"night";if(t!=="studio"&&t!=="phone")t="night";h.setAttribute("data-nd-theme",t);d=t==="night"||(t==="phone"&&q)}else{var c=localStorage.getItem("${THEME_KEY}");d=c==="dark"||(c==="system"&&q)}if(d)h.classList.add("dark")}catch(e){}})()`;
