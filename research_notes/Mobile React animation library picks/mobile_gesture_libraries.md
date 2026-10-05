# Mobile Gesture-Handling & Native-Feel Interaction Libraries for React/Next.js (2025-2026)

## What do real developers say on Reddit/HN about Vaul and @use-gesture — reliability, mobile performance, edge cases, maintenance?

### Takeaway
Direct Reddit threads on r/reactjs, r/nextjs, r/webdev, r/PWA, or r/Frontend specifically discussing Vaul or @use-gesture could not be located despite multiple targeted searches. The strongest "real developer" sentiment found lives on Hacker News and in GitHub Discussions on shadcn/ui's own repo, and it is almost entirely about Vaul's *maintenance status*, not its mobile touch performance.

### Cited Findings
- HN comment by user sreekanth850 (Oct 26, 2025), posted under a "Show HN: Shadcn/UI theme editor" thread: "shadcn drawer is built on the top of vaul which is unmintained [sic], so who ever use this in production, keep this in your mind." — [Hacker News item 45709139](https://news.ycombinator.com/item?id=45709139)
- On shadcn/ui's GitHub Discussions, user timothyis opened "Vaul is unmaintained" (Dec 8, 2025), writing it's "a bit uncomfortable to know that this component may contain bugs...and there may not be fixes coming for them." — [GitHub Discussion #8982](https://github.com/shadcn-ui/ui/discussions/8982)
- Commenter nico-martinucci (Dec 15, 2025) on the same thread said they'd hit a bug in the Drawer, checked the repo, and found Vaul's README now confirms abandonment: "Always sad to see a well-used project fall by the wayside." — [GitHub Discussion #8982](https://github.com/shadcn-ui/ui/discussions/8982)
- Contributor oliviertassinari (Jan 17, 2026) noted this concern duplicates an existing tracked issue. — [GitHub Issue #8455 "switch drawer to maintained dependency"](https://github.com/shadcn-ui/ui/issues/8455)
- No alternative drawer libraries were recommended within Discussion #8982 itself — the thread ends without a resolution. — [GitHub Discussion #8982](https://github.com/shadcn-ui/ui/discussions/8982)

### Inferences
- The "real developer" conversation about Vaul has largely moved from general Reddit/HN-style discussion to GitHub Issues/Discussions directly on shadcn/ui's repo — likely because most developers encounter Vaul as "the thing inside shadcn's Drawer," not as a standalone library they'd discuss on its own subreddit thread.
- The sentiment found is concerned with maintenance/bug-fix risk, not mobile performance/jank specifically — nobody in the threads found complained about touch responsiveness; the complaint is entirely "will this get fixed if it breaks."

### Gaps
- No Reddit threads (r/reactjs, r/nextjs, r/webdev, r/PWA, r/Frontend) specifically about Vaul or @use-gesture were found via WebSearch across several phrasings (e.g., `site:reddit.com vaul drawer performance`, `reddit vaul bottom sheet mobile jank`, `reddit "use-gesture" react swipe performance`). This may reflect search-tool/indexing limitations rather than a confirmed absence of discussion — flagging as an open gap rather than asserting "no one talks about this."
- No Hacker News discussion of @use-gesture's reliability or mobile performance was found; HN Algolia search for "use-gesture" returned only unrelated hits (gesture-recognition hardware, elephant gestures, keyboard trivia). — [HN Algolia search: use-gesture](https://hn.algolia.com/api/v1/search?query=use-gesture)

## Is Vaul still a sensible standalone pick now that shadcn/ui's Drawer has reportedly moved to Base UI? What is Base UI, who makes it, and what's the sentiment?

### Takeaway
Vaul's own README now explicitly states the project is unmaintained, and shadcn/ui's current official docs already show a Drawer built on Base UI rather than Vaul. Base UI is a well-pedigreed, actively-staffed successor/sibling to Radix, built by MUI's team (including people who built Radix, Material UI, and Floating UI) — making it a credible alternative, though direct "feel" comparisons for touch/drag quality weren't found.

### Cited Findings
- Vaul's GitHub README displays a maintenance notice: "This repo is unmaintained. I might come back to it at some point, but not in the near future. This was and always will be a hobby project and I simply don't have the time or will to work on it right now." — [github.com/emilkowalski/vaul](https://github.com/emilkowalski/vaul)
- As checked, Vaul had 136 open issues and 28 open pull requests against 274 total commits on its main branch. — [github.com/emilkowalski/vaul](https://github.com/emilkowalski/vaul)
- shadcn/ui's current official Drawer documentation lives at a "Base"-prefixed path and is built on Base UI rather than Vaul. — [ui.shadcn.com/docs/components/base/drawer](https://ui.shadcn.com/docs/components/base/drawer)
- Base UI is described as an unstyled React component library "from the creators of Radix, Material UI, and Floating UI," MIT-licensed, built by MUI, with a named team of seven working on it full-time (Colm Tuite, Marija Najdova, Flavien Delangle, James Nelson, Jenna Smith, Michał Dudak, Aarón García), prioritizing accessibility (WAI-ARIA), performance, and developer experience; it also ships its own Drawer primitive. — [base-ui.com/react/overview/about](https://base-ui.com/react/overview/about)
- A separate GitHub Discussion (opened by michaelparkadze, Apr 5, 2026) proposed that — short of a full Base UI migration — the Drawer should at least swap from `vaul` to `vaul-base`, described as "a port of vaul that uses Base UI's Dialog instead of Radix's," because `vaul`'s dependency on Radix's Dialog focus-trap breaks Base UI's own Select/Combobox when opened inside a vaul Drawer (the portaled popup either loses focus or has pointer events blocked). The fix is framed as a one-line import swap and "drop-in replacement with the same API." — [GitHub Discussion #10297](https://github.com/shadcn-ui/ui/discussions/10297)
- That discussion got light but positive engagement (evrazi "+1" Apr 8, 2026; catchellers reporting related nested-dialog issues May 17, 2026; Gabriel-Vasconcelos support May 21, 2026), with no visible official shadcn maintainer reply in the thread. — [GitHub Discussion #10297](https://github.com/shadcn-ui/ui/discussions/10297)
- `vaul-base` on npm/GitHub is attributed to a third-party maintainer (borabaloglu), not to Vaul's original author Emil Kowalski — i.e., it is a community fork/port, not an officially blessed successor. — [npmjs.com/package/vaul-base](https://www.npmjs.com/package/vaul-base); [github.com/borabaloglu/vaul-base](https://github.com/borabaloglu/vaul-base)

### Inferences
- There appear to be two distinct "Base UI" tracks for the Drawer in the shadcn ecosystem: (1) shadcn's own newer "Base" component set, built directly on Base UI's native Dialog/Drawer primitives, and (2) a community-proposed stopgap (`vaul-base`) for projects still on the classic vaul-backed Drawer that need Base UI's Select/Combobox to coexist inside it. Secondary sources don't fully disambiguate which is "the" current default path — treat shadcn's live docs site as the most authoritative current answer, and `vaul-base` as a narrower compatibility shim rather than shadcn's primary recommended route.
- Given Vaul's own maintainer has publicly stepped back, picking stock Vaul today for new work means accepting unpatched bugs indefinitely. Teams already invested in it are effectively being pushed toward either `vaul-base` (community-maintained) or Base UI's native Drawer (vendor-maintained by MUI's team).

### Gaps
- No explicit community sentiment comparing Vaul's drawer physics/drag feel against Base UI's own Drawer's feel was found — everything found is about maintenance status and a Select/Combobox focus-trap bug, not which one feels better on a touchscreen. This is a meaningful gap given this task's "native feel" framing.
- Exact release-date history for Vaul (e.g., when the last real feature commit landed vs. just the README edit announcing unmaintained status) wasn't retrieved — the npm registry and GitHub pages didn't surface clean timestamps through the fetch tool used. Latest npm dist-tag is `1.1.2`, but its publish date is unconfirmed.
- A search for "best react bottom sheet library 2026" surfaced almost exclusively React Native results (e.g., `@gorhom/bottom-sheet`, built on Reanimated + Gesture Handler) rather than web-React options. This is out of scope for a web-only (not React Native) app, but it also means no third 2025-2026 web-specific bottom-sheet/drawer library beyond Vaul, `vaul-base`, and Base UI's own Drawer was surfaced as gaining notable traction.

## What's the real community take on @use-gesture's complexity/learning curve, and is it overkill vs. building simpler custom touch handlers?

### Takeaway
No direct Reddit/HN sentiment specifically weighing "@use-gesture vs. a hand-rolled swipe handler" was found. What is confirmed: @use-gesture is intentionally broad (drag/pinch/wheel/scroll/move/hover in one hook), the library's own docs flag a real bundle-size cost for the all-in-one hook versus importing just one gesture action, and simpler swipe-only libraries exist as a middle ground between raw custom code and full @use-gesture.

### Cited Findings
- @use-gesture's own docs state the combined `useGesture` hook "conveniently offers all gestures out of the box, though this comes at the expense of one or two kb of extra gzipped javascript," and recommend building a custom hook importing only the specific gesture actions needed (e.g., `dragAction`, `pinchAction`) to avoid that cost. — [use-gesture.netlify.app/docs/options](https://use-gesture.netlify.app/docs/options/)
- @use-gesture (`pmndrs/use-gesture`) is maintained under the pmndrs (Poimandres) GitHub organization, the same group behind react-spring, zustand, and drei. The repo shows 9.6k stars, 335 forks, 44 open issues, 14 open pull requests, and 1,360 commits on the main branch. — [github.com/pmndrs/use-gesture](https://github.com/pmndrs/use-gesture)
- Lighter, swipe-only alternatives exist specifically for simpler cases: react-swipeable is described as a "lightweight swipe gesture handler" and is commonly compared against react-swipe and react-swipeable-views as narrower, single-purpose tools rather than a full gesture suite. — [codingcops.com/react-swipeable](https://codingcops.com/react-swipeable/); [npm-compare.com: react-swipe vs react-swipeable vs react-swipeable-views](https://npm-compare.com/react-swipe,react-swipeable,react-swipeable-views)

### Inferences
- Because @use-gesture's complexity/bundle-size cost comes specifically from supporting many gesture types at once, and a swipe-between-pages feature only needs one (horizontal drag), the library's own documented escape hatch — importing only `dragAction` — is probably the fairer comparison point against custom code, not the full `useGesture` hook. Whether that's still simpler than an already-tuned custom implementation isn't answered by any source found; this is a judgment call, not a cited fact.
- No evidence was found either way that adopting @use-gesture would resolve this kind of app's "jank on older phones" complaint on its own — the library's documented value proposition is gesture-detection ergonomics and cross-device pointer normalization, not rendering/paint performance, which is a separate concern (see performance-gotchas section below).

### Gaps
- No Reddit/HN/blog source was found directly debating "@use-gesture vs. custom touch handlers" as a reliability or performance question — every query phrasing tried returned only official docs, unrelated React Native content, or generic tutorials. This is the single biggest gap relative to this key question as posed.
- No source quantified @use-gesture's real-world learning curve (time-to-productivity reports, onboarding complaints, etc.) from teams that adopted it.

## Are there documented real-world performance gotchas (scroll-jank, touch-event conflicts with native gestures, battery/paint issues on Android) for these libraries?

### Takeaway
The strongest, most concrete material found in this entire research task is platform-level, not library-specific: touch/scroll jank from non-passive event listeners, and conflicts between in-app swipe gestures and the browser/OS's own native edge-swipe-to-navigate-back gesture, are well-documented, long-standing problems independent of which gesture library is used — and the back-swipe conflict in particular has no fully reliable fix. This is directly relevant to a hand-rolled swipe-between-pages gesture with a known jank complaint.

### Cited Findings
- Chrome's engineering blog explains a touchmove/wheel handler "is allowed to call preventDefault() and stop the normal scroll, so until the handler has run, the browser cannot know whether scrolling is still permitted" — the root cause of input-handler-induced scroll jank. Marking listeners `{passive: true}` lets the browser start scrolling immediately without waiting on JS. Chrome has made touchstart/touchmove/wheel passive by default at the document/window level since Chrome 56. — [Chrome Developers: Making touch scrolling fast by default](https://developer.chrome.com/blog/scrolling-intervention)
- A live interactive demo built by Chrome engineer Rick Byers shows scroll jank caused specifically by touch/wheel handlers, letting you compare passive vs. non-passive listener behavior directly. — [rbyers.github.io/scroll-latency.html](https://rbyers.github.io/scroll-latency.html)
- A supporting explainer on passive event listeners and scroll performance corroborates the same mechanism. — [johnkavanagh.co.uk: Passive Event Listeners and Scroll Performance](https://johnkavanagh.co.uk/articles/improving-scroll-performance-with-passive-event-listeners/)
- Native browser edge-swipe navigation (back/forward) generally "cannot be intercepted using event.preventDefault()," and sites using edge swipes for their own UI (menus, custom back gestures) routinely collide with it — sometimes triggering both the in-app gesture and a real browser navigation at once. This remains an open platform-level gap. — [WHATWG HTML Issue #12374: Expose cancellable event or API to disable browser swipe navigation](https://github.com/whatwg/html/issues/12374)
- A documented, open iOS Safari PWA bug: "cannot disable Safari swipe to go back when running as PWA." — [Ionic Framework Issue #22299](https://github.com/ionic-team/ionic-framework/issues/22299)
- A developer-written workaround (intercepting `touchstart` near the screen edge and calling `preventDefault()`) is reported to work reliably only in Safari, with "inconsistent effectiveness on Chrome iOS." — [Medium: Prevent edge-swipe gestures in your HTML game… but only in Safari](https://medium.com/@joelmalone/prevent-edge-swipe-gestures-in-your-html-game-but-only-in-safari-fba815a529a2)
- On Android specifically, when OS-level gesture-navigation mode is enabled, both left- and right-edge swipes act as back navigation, which can override an app's own left/right swipe design — reflected in a reported real-world conflict between an app's menu drawer and Android's back gesture. — [GitHub home-assistant/frontend Issue #14468: Menu conflicts with Android back gesture](https://github.com/home-assistant/frontend/issues/14468)

### Inferences
- Given this kind of app already has a hand-rolled swipe-between-pages gesture with a "jank on older phones" complaint, the platform-level passive-listener issue above is a very plausible contributing factor worth checking directly — i.e., whether existing touch handlers are registered passive wherever they don't call `preventDefault()`, and non-passive only where swipe-cancellation is actually required — independent of adopting any library at all.
- Because no JS library (including Vaul or @use-gesture) can fully solve the native-back-swipe-edge conflict — it's a platform limitation, not a library limitation — switching gesture libraries is unlikely by itself to resolve edge-swipe conflicts. Dead-zone/edge-detection tuning (which an app like this already does) is the standard mitigation referenced across these sources, not a library swap.

### Gaps
- No source found specifically benchmarked Vaul's or @use-gesture's paint/battery cost on Android (old or new devices); all performance material found is about touch-event/scroll fundamentals generally, not about either named library's own rendering pipeline (e.g., whether Vaul's drag-to-dismiss uses transform-only animations vs. layout-triggering properties). This is a direct gap on the task's central question ("does this actually fix jank on real/older phones") and was not resolved by this research pass — flagging explicitly rather than guessing.
- No device-specific report (e.g., "tested on a Moto G" or similar low-end Android device) was found for either library.

## Current maintenance health (commits, releases, GitHub activity) for Vaul and @use-gesture

### Takeaway
The two libraries are in starkly different maintenance states: Vaul is explicitly self-declared unmaintained by its author, while @use-gesture shows no such red flag and sits inside the actively-maintained pmndrs ecosystem — though exact last-commit recency for @use-gesture itself wasn't independently confirmed with a timestamp.

### Cited Findings
- Vaul's README: "This repo is unmaintained... This was and always will be a hobby project [and I simply don't have the time or will to work on it right now]." 136 open issues, 28 open PRs, 274 total commits. — [github.com/emilkowalski/vaul](https://github.com/emilkowalski/vaul)
- Latest Vaul npm dist-tag is `1.1.2` (exact publish date not retrieved — the registry fetch didn't surface the `time` field). — [registry.npmjs.org/vaul](https://registry.npmjs.org/vaul)
- @use-gesture shows no unmaintained notice in its README; latest `@use-gesture/react` npm dist-tag is `10.3.1` (exact publish date likewise not retrieved). — [registry.npmjs.org/@use-gesture/react](https://registry.npmjs.org/@use-gesture/react)
- @use-gesture repo stats: 9.6k stars, 335 forks, 44 open issues, 14 open pull requests, 1,360 commits, maintained under the pmndrs org (which also maintains react-spring and zustand). — [github.com/pmndrs/use-gesture](https://github.com/pmndrs/use-gesture)
- shadcn/ui's community is actively tracking Vaul's status via a dedicated open issue, "[feat]: switch drawer to maintained dependency." — [GitHub Issue #8455](https://github.com/shadcn-ui/ui/issues/8455)

### Inferences
- Vaul's 136-open-issues/28-open-PRs backlog against a self-declared "unmaintained" status means any bug a team hits in production is likely to stay unfixed unless they patch it themselves or move to a fork (`vaul-base`) — a materially higher maintenance risk than @use-gesture currently shows.

### Gaps
- Exact last-commit date for @use-gesture wasn't confirmed — star/fork/issue counts are a maintenance proxy, not direct proof of current activity. Treat "no red flag found" as weaker evidence than a confirmed recent commit/release date would be.
- npm publish timestamps for both packages' latest versions were not retrieved (registry JSON responses didn't surface the `time` field through the fetch tool used in this pass).

## Pull-to-refresh and haptic-feedback options for mobile web (secondary coverage)

### Takeaway
Several small, single-purpose pull-to-refresh React components exist and describe themselves well on npm, but no strong Reddit/HN community recommendation converging on one specific library was found. For haptics, the only broadly-documented option for mobile web is the native Vibration API (`navigator.vibrate()`), which requires genuine user-activation and has adoption caveats that weren't independently reconfirmed here.

### Cited Findings
- `react-simple-pull-to-refresh` bills itself as a "Simple Pull-To-Refresh Component for React Application with 0 dependency," latest version 1.3.4. — [npmjs.com/package/react-simple-pull-to-refresh](https://www.npmjs.com/package/react-simple-pull-to-refresh)
- `react-awesome-ptr` explicitly markets itself as behaving "like almost native app," "suitable for all of mobile browsers and web views," and "automatically disable[s] mobile browser's default pull-to-refresh (only in Android)," with a customizable spinner and TypeScript support. — [github.com/eunvanz/react-awesome-ptr](https://github.com/eunvanz/react-awesome-ptr)
- `pull-to-refresh-react` is positioned specifically for PWA use cases. — [github.com/cuongdevjs/pull-to-refresh-react](https://github.com/cuongdevjs/pull-to-refresh-react)
- The Vibration API works via `navigator.vibrate()`, taking either a single duration in milliseconds or an array describing a vibrate/pause/vibrate... pattern (e.g., `navigator.vibrate([500, 200, 1000])`); it targets mobile devices with vibration hardware, and "browsers usually require user activation to vibrate" (must be triggered from a real tap, not programmatically on page load or from a timer). — [OpenReplay: Haptic Feedback for Web Apps with the Vibration API](https://blog.openreplay.com/haptic-feedback-for-web-apps-with-the-vibration-api/); [dev.to: How To Use Vibration API in Your Website](https://dev.to/bibekkakati/how-to-use-vibration-api-in-your-website-4dp4); [SkillStuff: How to Use the Vibration API to Add Haptic Feedback to Mobile Web Apps](https://skillstuff.com/how-to-use-the-vibration-api-to-add-haptic-feedback-to-mobile-web-apps/)
- A personal/low-authority Medium post surfaced a wrapper package called "Web Haptics," framed by its own title as something "everyone's adding" for haptic feedback — this adoption claim comes from a single informal blog post, isn't corroborated elsewhere in this research, and should be treated skeptically rather than as a confirmed trend. — [Medium: Web Haptics: The NPM Package Everyone's Adding for Haptic Feedback](https://medium.com/@springmusk/web-haptics-the-npm-package-everyones-adding-for-haptic-feedback-4c774f10caaa)

### Inferences
- None of the pull-to-refresh packages found have a strong, independently-corroborated popularity/trust signal (no Reddit/HN threads recommending one specifically were found) — treat the npm search results as "these exist and describe themselves well," not "developers have converged on this one."
- For haptics, iOS Safari has historically had limited/no support for the Vibration API — this is general web-platform knowledge, not something re-confirmed by a source in this research pass. Any haptic feature built on `navigator.vibrate()` should be assumed Android-only with a graceful no-op fallback elsewhere, and this assumption should be verified independently before shipping.

### Gaps
- No Reddit/HN developer thread recommending a specific pull-to-refresh library for web (as opposed to React Native) was found.
- iOS Safari's current (2025-2026) Vibration API support status was not directly reconfirmed by any source fetched in this pass.
- No case study or blog post specifically benchmarking pull-to-refresh libraries' performance on Android was found.
