# Perception-first requirements for the revised study

2026-11-10. A design derivation for Game Your Show, before editing the revised visual study. These are hypotheses to test with people, not findings from a usability study.

The user wants a beautiful, inviting place to watch, react, chat and optionally play, with strong artwork, useful information at a glance and serious analysis available on demand. The earlier compact concept made the task list legible but weakened the pleasure of being here.

We use [Intent](https://github.com/ghaida/intent) for goals, journeys and state correctness; [Impeccable](C:/Users/conor/.claude/skills/impeccable/SKILL.md) for visual composition and craft; and [Perception-First Design by Stefan Kovalik / Aurochs](https://github.com/skovalik/perception-first-design) for the order in which the experience becomes understandable and inviting. PFD's five-layer model is a practitioner synthesis. It does not establish that this particular layout, or a numerical limit on its buttons, is scientifically optimal. Its [citation standards](https://github.com/skovalik/perception-first-design/blob/main/skills/pfd/references/citation-standards.md) explicitly distinguish those claims.

## Requirements, in dependency order

### R1 · Make the current situation a recognizable group

The present screen distributes personal progress, the airing schedule and individual game progress across competing plates. A person has to reconcile them before acting. The revised screen must present show identity, personal episode and the relevant next action together. Additional games may expose additional due actions, with explicit deadlines. Grouping is the goal; shrinking every element is not.

**Citations:** Cowan (2010), working-memory limits; Sweller (1988), avoidable task-processing demands. These are references supplied by the [PFD framework](https://github.com/skovalik/perception-first-design/blob/main/framework/PERCEPTION-FIRST-DESIGN.md), not studies of this app.

### R2 · Make the first visual impression feel like the show and its people

The compact concept's uniform utility rows obscure the reason to return. The revised opening must give recognizable show art and expressive typography meaningful space, then show the people and reactions that make this personal. Artwork must not push the next action off the first view. The first impression we are testing is “my show, my people, something I want to do.”

**Citations:** Lindgaard et al. (2006), rapid visual-appeal judgments; Leder et al. (2004), a model of aesthetic appreciation. Neither establishes that visitors understand a whole interface in 50 milliseconds.

### R3 · Give the same signal the same meaning

Progress, a deadline, a saved choice and a revealed outcome must remain visually distinct and use consistent language. A strong action plate must reliably lead somewhere useful. Keep show-specific terms, legible text and the established five destinations. In sports, hiding a result must also hide status cues that reveal it indirectly.

**Citations:** Forster, Leder & Ansorge (2013), felt processing fluency; Clark (2013), predictive processing as a theoretical account. The concrete UI requirements are our application of these ideas.

### R4 · Make watching feel complete; validate behavior across participation levels

Treating a watcher as an unfinished game player contradicts the user's brief. The screen must offer progress, company, chat and watch-along without requiring a game. Participation changes which actions appear; people should not have to identify as “casual” or “expert.” The earlier mock's clarity does not prove it would feel enjoyable or welcoming.

**Citations:** Nisbett & Wilson (1977), limits of introspective explanations. Our watcher-first hypothesis comes from the product brief and source review, not a scientific claim about all fans.

### R5 · Let the next action lead to a satisfying return

A person must be able to watch, mark an episode watched, react and return to their people. Players must be able to make an immediate gut choice, inspect evidence if wanted, and return without losing a draft choice. Revealing sports scores must be separate from moving a viewing clock. Saved viewing progress must survive leaving the companion screen. Expert pages must retain useful density and comparison tools.

**Citations:** Trope & Liberman (2010), concrete language and psychological distance as theoretical guidance. PFD explicitly qualifies option reduction: expert and reference tools may benefit from many visible options.

## The proposal these requirements permit

Use an art-led opening, a compact personal-progress line, the next watch or game action, and a visible social payoff. Keep full cast imagery, deeper statistics, game setup and other capabilities in reachable destinations. The first viewport carries necessary actions; optional material may continue below it. A whole page fitting into 844 pixels is not the success metric.

The revised study will show watching only, active multiplayer, solo/own-pace and a sports session. Those are review scenarios, not a new mode picker inside the product. The biggest unresolved gap is behavioral evidence: can people identify their episode, find the action, avoid spoilers and enjoy returning? Follow with short task-based sessions across watchers and committed players. Do not assign fabricated perception scores or claim dopamine measurements.

*Initial findings. Ralph Loop a requirement, cite further, switch to analyze / evaluate, or ask any follow-up to dig deeper.*
