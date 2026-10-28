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
A portfolio site whose centerpiece is Foundry, an eight-agent software factory. A visitor picks a small change for a sample task-tracker app (or replays a recorded example), watches eight Claude agents plan, build and check it, and, in a live run that passes both checks, gets a real draft pull request on a public sample repository. The site exists to show what Alex can build and how honestly he measures it. Success: a visitor can say what Foundry does and what it does not do after a short visit, and contacts Alex.

## Positioning
The checks are real and the work can be sent back. In a live run the sample app's own unit tests run in an isolated sandbox, a real headless browser runs a Playwright test, and the result decides the gate regardless of what the agents say; a failing check sends the work back for another round. (Alex named these two as what sets Foundry apart. Openness about limits is a standing project rule, see Constraints, but he did not pick it as the differentiator.)

## Operating Context
- Live site: https://foundry-portfolio.vercel.app. Code: https://github.com/alexmarushka3-glitch/foundry-portfolio. Sample repo the agents change: https://github.com/alexmarushka3-glitch/taskly-sample.
- Three modes, always labelled on the page: replay (three recorded runs), live (real Claude models, tools, sandbox, browser, draft pull request) and simulated (scripted text).
- A live run takes about 55 to 90 seconds and costs about 18 to 31 cents. Limits: 1 live run per visitor per hour and 8 per day for the site; the Anthropic credit is capped at $10. Hosting is Vercel Hobby.
- Draft pull requests are closed automatically after about a day.
- A public sample-data dashboard sits on the home page; every number on it is made up and says so. The real admin dashboard is behind a login.

## Capabilities and Constraints
Capabilities (verified on the deployed site, Oct 26, 2026): structured request form; eight agents with tools on an in-memory copy of taskly-sample; real unit tests in a Vercel Sandbox with the network off; a Playwright test run in headless Chromium with screenshots shown on the page; a real draft pull request through a GitHub App scoped to taskly-sample.

Constraints future work must keep (confirmed by Alex):
- **Accessibility:** meet WCAG AA (contrast, keyboard use, labels, reduced motion).
- **Brand:** keep the Foundry name and the F logo mark with the amber dot.
- **Fast and light:** the home page ships about 125 kB of first-load JavaScript; no heavy libraries or video.

Standing project rules, already recorded in CLAUDE.md (not re-confirmed in this interview): the honesty wording rules. Say "draft pull request checked by other agents and by real tests", never "reviewed pull request" or "passed review"; always say it is a sample app and that no human reviews the pull requests; the recorded examples are recordings of real live runs (not of the older text-only version); do not claim a success rate.

Undecided: a custom domain; a measured success rate; whether to keep the run log in a database.

## Brand Commitments
Name: Foundry. Mark: the F with an amber dot (components/Logo.tsx, app/icon.svg). Written voice is short and plain.

## Evidence on Hand
- Three recordings of real live runs (recordings-src/live/), one per request, each recorded once and kept as it came out. All approved by the pipeline's checks on round 1, 67 to 75 seconds, $0.19 to $0.22 each. They ran the real unit tests and the real headless Chromium test in a sandbox. No pull request was opened and no human reviewed them.
- Several live runs on the deployed site, including draft pull requests on taskly-sample (for example #5). Some runs were sent back or not approved.
- No testimonials, customers, benchmarks or success rate exist. Do not invent any. No human reviews the pull requests.

## Product Principles
1. Real checks over claimed checks: any statement that work was verified must point to something that actually ran.
2. Work can be rejected: the pipeline's value is checks that can send a result back, so show them doing it.
3. Say plainly what is simulated, recorded or limited, in words a recruiter can repeat.
4. Fast and light by default; a visitor should reach the demo without waiting.
5. Accessible to everyone: keyboard, screen reader and reduced motion work, not only mouse and sight.

## Accessibility & Inclusion
WCAG AA is the required standard (confirmed). Already met or fixed in the Oct 26, 2026 audit: text contrast at least 5.2:1 on both the light page and the dark stage; control outlines at least 3:1; visible focus rings; tap targets at least 40px; reduced-motion respected; labelled charts and live regions.
