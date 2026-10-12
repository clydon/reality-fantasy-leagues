---
version: 1
slug: "src-components-login-screen-tsx"
primary_target: "src/components/login-screen.tsx"
related_targets: ["src/components/account/account-panel.tsx","src/app/forgot-password/page.tsx","src/app/reset-password/page.tsx"]
---

# Front door: sign in / create account

Scope: the signed-out screen (`/` and `/account` before a session) plus forgot/reset password. Mode: Operate, with one line of pitch. A proper home screen that explains the app is planned separately.

Audience: strangers arriving from a friend's invite or a link, and returning players signing in on a phone. Job: sign in, create an account, or take the 3-minute tour. Constraints: no invented claims (users, reviews, affiliation); show names appear as text only, no network art. Name: Game Your Show (decided 2026-10-12); the wordmark is logo direction C, "Insert", in its in-app colourway (PRODUCT.md, Brand Commitments).

## Direction contract

THESIS: The front door is a show's cold open: a title card that says what this is, with the form rising underneath as the app's own bottom sheet. Refuses the centred logo-over-a-boxed-form card.

OWN-WORLD: Lower Third, unchanged. Ground, one white caption plate with a quiet angled tag, condensed Archivo caps, the bottom sheet's 14px top corners and sheet shadow, chyron only on the one primary button.

STORY: In one glance: any show you watch becomes a league for your group. Then: sign in, switch to create account, or take the tour.

FIRST VIEWPORT (390x844): top bar with the wordmark left and "Take the tour" right. Title card in the upper half: "TURN" / a plate whose show name flips through shows / "INTO A LEAGUE." in 44px+ condensed caps, one muted sentence under it. Bottom: the sheet (no grab handle: it can't be dragged, so a handle would be a false affordance), Sign in / Create account switch, fields, Forgot password, full-width chyron button. Signature move: the plate's show name rolls to the next show every few seconds, ending on "Your show"; static under reduced motion.

FORM: Cold open + sheet, position 2 on the ordered list, seed key 4260f6bb.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
