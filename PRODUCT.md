# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Three audiences, confirmed by Alex on Oct 26, 2026. The first is the one the site is built for.

- **Recruiters and hiring managers** (consulting and tech) deciding, usually in a couple of minutes, whether to talk to Alex Marushka, a University of Chicago student recruiting for consulting and tech roles.
- **Technical peers and developers** who want to know how an AI agent pipeline works and whether it is real.
- **Classmates, professors and personal contacts** following the project.

## Product Purpose
A portfolio site whose centerpiece is Foundry, an eight-agent app builder. A visitor types an idea for a small one-page app (or replays a recorded example), watches eight Claude agents plan, build and test it, and, in a live run that passes both checks, uses the finished app on the page and can save it as one .html file. (Changed Nov 1, 2026, after friends and family said the old to-do-app demo gave visitors nothing real and was too wordy.) The site exists to show what Alex can build and how honestly he measures it. Success: a visitor can say what Foundry does and what it does not do after a short visit, and contacts Alex.

## Positioning
The checks are real and the work can be sent back. In a live run the app's unit tests run in an isolated sandbox, a real headless browser runs a Playwright test, and the result decides the gate regardless of what the agents say; a failing check sends the work back for another round. (Alex named these two as what sets Foundry apart. Openness about limits is a standing project rule, see Constraints, but he did not pick it as the differentiator.)

## Operating Context
- Live site: https://alexmarushka.vercel.app. Code: https://github.com/alexmarushka3-glitch/foundry-portfolio.
- Three modes, always labelled on the page: replay (three recorded runs), live (real Claude models, tools, sandbox, browser, the finished app) and simulated (scripted text).
- A live run takes a couple of minutes (cap $0.60). Limits: 2 live runs per visitor per hour and 12 per day for the site; the Anthropic credit is capped at $10. Hosting is Vercel Hobby.
- A public sample-data dashboard is at /admin-demo (not on the home page); every number on it is made up and says so. The real admin dashboard is behind a login.

## Capabilities and Constraints
Capabilities (Nov 1, 2026): one text box for the idea; eight agents with tools on an in-memory starter kit; real unit tests in a Vercel Sandbox with the network off; a Playwright test in headless Chromium against the bundled app, with screenshots on the page; the finished app in a sandboxed, offline frame, and a one-file download.

Constraints future work must keep (confirmed by Alex):
- **Accessibility:** meet WCAG AA (contrast, keyboard use, labels, reduced motion).
- **Brand:** keep the Foundry name and the F logo mark with the amber dot.
- **Fast and light:** the home page ships about 125 kB of first-load JavaScript; no heavy libraries or video.

Standing project rules, already recorded in CLAUDE.md (not re-confirmed in this interview): the honesty wording rules. Never say "reviewed", "success rate" or "reliable"; say no human reviews the apps; the recorded examples are recordings of real live runs; keep the copy short.

Undecided: a custom domain; a measured success rate; whether to keep the run log in a database.

## Brand Commitments
Name: Foundry. Mark: the F with an amber dot (components/Logo.tsx, app/icon.svg). Written voice is short and plain.

## Evidence on Hand
- Three recordings of real live runs of the app builder (recordings-src/live/), kept as they came out. The older to-do-app recordings are in recordings-src/archive-taskly/.
- The 23 measured runs in lib/eval/results.json are of the old to-do version, so the card is off the page.
- No testimonials, customers, benchmarks or success rate exist. Do not invent any. No human reviews the apps.

## Product Principles
1. Real checks over claimed checks: any statement that work was verified must point to something that actually ran.
2. Work can be rejected: the pipeline's value is checks that can send a result back, so show them doing it.
3. Say plainly what is simulated, recorded or limited, in words a recruiter can repeat.
4. Fast and light by default; a visitor should reach the demo without waiting.
5. Accessible to everyone: keyboard, screen reader and reduced motion work, not only mouse and sight.

## Accessibility & Inclusion
WCAG AA is the required standard (confirmed). Already met or fixed in the Oct 26, 2026 audit: text contrast at least 5.2:1 on both the light page and the dark stage; control outlines at least 3:1; visible focus rings; tap targets at least 40px; reduced-motion respected; labelled charts and live regions.
