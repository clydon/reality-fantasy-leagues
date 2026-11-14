# Tonight review

**Superseded after user review:** the compact-only pass below retained too much content and omitted watching/participation/pace branches. Use the [six-situation redesign](tonight-scenarios-review.md) and [content contract](tonight-content-contract.md). Tonight is still the only page being redesigned; all further rollout remains paused for the user's review.

2026-11-10. Work is paused for the user's review of one page. Do not continue the design across other screens until the user requests changes or says to continue. Retain the earlier studies, screenshots, fixtures and generated assets as comparison material.

Open [Tonight A/B](http://127.0.0.1:4303/#tonight). A uses the current application layout. B restores a compact composition over the same recorded results and real action handlers. Other board destinations remain earlier studies, not newly completed redesigns.

| Lens | Tonight decision | Reason |
| --- | --- | --- |
| Intent | All required and saved controls in one vertical list | Each task can be discovered without swiping; original eligibility and handlers remain authoritative. |
| Impeccable | Shorter full-color show stage, strong condensed headings, white angled first-action plate | Retain the television character and real art while giving the actual actions space. |
| Perception-First Design | Show/episode context, moves, watching, then detailed recap | Reduce reconciliation between separate summaries and make the next actions visible together. |

The full last-episode game breakdown opens from a named disclosure. Watch along moves directly beneath the action list. Participant progress still opens the original couch sheet. The rich individual game pages remain intact.

The read-only prototype passed five captures: current Tonight, proposed Tonight, the existing pick editor opened from the proposal, a 360×700 view and the desktop comparison board. All four move controls are above the tabs at 390×844 with at least 44px height. That first-view assertion does not extend to every smaller viewport. Search/source semantics and save behavior have not been changed; saves are blocked by the review gateway. Browser errors and horizontal overflow were zero in these checks.

Evidence: `captures/fidelity-2026-11-10/tonight-redesign-checks.json` and `screens/review-tonight-*.png`. Reproduce with `node scripts/dev-test/check-tonight-redesign.js` while the review gateway and local app are running.

The existing [PFD requirements](perception-first.md) remain the derivation for the broader work. Skill sources: [Intent Journey](https://github.com/ghaida/intent/blob/main/skills/journey/SKILL.md), [Impeccable](C:/Users/conor/.claude/skills/impeccable/SKILL.md), [Perception-First Design](https://github.com/skovalik/perception-first-design/blob/main/skills/pfd/SKILL.md). These are design hypotheses for user review, not measured usability findings.
