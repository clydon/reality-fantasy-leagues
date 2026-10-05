# Plan: new-user onboarding — landing, signup, and create-a-league

Companion to `docs/PLAN-ai-generated-show-formats.md` — the "+ Don't see it? Add it" tile below is the
one seam the two plans share. A clickable prototype is deferred to implementation; this plan fixes the
structure and content, not the final visual design.

## The problem

`LoginScreen` (`src/components/login-screen.tsx`) is the entire cold-start experience: banner logo, a
login form, **"🎬 Take a Tour (Preview a Mock Season)"**, "Create an account." No pitch, nothing about
Survivor/Traitors/Challenge, nothing about the three ways to play — the tour is the only taste a
stranger gets before committing to an account.

`Dashboard`'s **"Create a League"** (`src/components/dashboard/dashboard.tsx`) is deliberately just a
name field. The code comment explains why: *"a league you just CREATED has nothing to show on
Overview: no show, no season, no cast. It goes to League Settings instead."* That was the right call
for the app's actual audience so far — you, explaining it yourself to people who already trust you.
It's the wrong shape for a cold visitor: their first real decision shouldn't be typing a name for a
thing they don't understand yet, and the moment with the most "wow, this does *what*" potential (show
+ mode selection) is currently buried a screen later, inside a five-question wizard.

## The idea: two moments, not one

**A — Before signup**, inside `LoginScreen`: a lightweight showcase above the login card. Not a
redesign of the login mechanics, just an addition.

```
┌──────────────────────────────────────┐
│            [ banner logo ]             │
│                                        │
│  Draft a show's cast. Score what      │
│  actually happens to them.            │
│                                        │
│   🏝️ Survivor   🔪 Traitors   🧗 Challenge │
│  draft & hold · weekly start/sit ·    │
│  pick to survive each week            │
├────────────────────────────────────────┤
│  LOG IN                               │
│  [ Username or email             ]    │
│  [ Password                      ]    │
│  [           Log In               ]   │
├────────────────────────────────────────┤
│  [ 🎬 Take a Tour (Preview a Mock     │
│         Season)                   ]   │
│  New here? Create an account          │
└────────────────────────────────────────┘
```

Copy for the three mode blurbs already exists, pulled straight from the user manual's game-modes
section.

**B — After signup, "Create a League,"** restructured from one field into three short steps. Season,
ownership mode, invites, and roster size stay exactly where they are today, on `/setup` — only the two
identity-defining choices move forward.

```
Step 1 of 3 — What are you playing?
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 🏝️ Survivor  │ 🔪 Traitors  │ 🧗 Challenge │  + Add it    │
│              │              │              │ don't see    │
│              │              │              │ your show?   │
└─────────────┴─────────────┴─────────────┴─────────────┘

Step 2 of 3 — How do you want to play?
┌────────────────────┬────────────────────┬────────────────────┐
│ Classic             │ Active Roster       │ Eliminator Pool     │
│ Draft & hold — your │ Draft a roster,     │ No draft. Pick one  │
│ score is how far    │ start/bench part of │ survivor a week,    │
│ your picks go.      │ it each week.       │ build a streak.     │
└────────────────────┴────────────────────┴────────────────────┘

Step 3 of 3 — Name it
┌────────────────────────────────────────┐
│ League name: [______________________]  │
│             [ Create League ]           │
└────────────────────────────────────────┘
```

The "+ Add it" tile is where `docs/PLAN-ai-generated-show-formats.md`'s research flow gets reached by a
normal user for the first time, and where the free-DIY-vs-paid-one-click choice first surfaces outside
Admin.

## Open points this forces a decision on

- **Self-serve show visibility.** Resolved jointly with the format-generation plan: a show a
  commissioner researches is usable in their own league right away, not published to the picker for
  everyone until reviewed.
- **Show artwork.** Real tiles want an image; `shows` has no such field today. Cheap addition, or ship
  v1 with a per-format icon/emoji and add art later.
- **Does step 2 belong here at all, versus staying on `/setup`?** Recommendation: yes, front-load it —
  league type changes what the whole league feels like, and burying it in a five-question wizard
  undersells it. Name is the one field genuinely safe to leave for later; everything else that's
  genuinely exciting earns a moment up front.

## Phases

1. **LoginScreen showcase strip.** Pure copy/layout, no backend dependency — ships independently of
   everything else in either plan, and first.
2. **Create-League steps 1–2, using only the three existing formats.** No dependency on the AI
   pipeline yet — the show tile grid just reads today's admin-curated catalog.
3. **Wire the "+ Add it" tile** to `docs/PLAN-ai-generated-show-formats.md`'s flow once it exists.
4. **Show artwork**, replacing the icon fallback.
5. **Monetization gating** (multi-league ceiling, AI-credit upsell on "+ Add it") once a pricing model
   is decided.

## Risks and open points

- Phases 1–2 have zero dependency on the show-format-generation plan and can ship first — good, since
  it means something visible and branded exists well before the harder AI-pipeline work is done.
- Needs real show art, or a deliberate decision to ship icon-only for longer than planned.
