# Foundry Portfolio

Portfolio site built around Foundry, an eight-agent web app builder. Visitors type an idea for a small one-page app (or pick a recorded example), watch eight agents plan, build and test it, then use the finished app on the page or save it as one .html file. Live at https://alexmarushka.vercel.app (the old address, https://foundry-portfolio.vercel.app, still works).

## Workflow

For any change bigger than a small fix: explore first, make a plan and wait for Alex's OK, implement test first, verify with `npm run typecheck` and `npm test`, then commit on a branch and open a PR.

The Superpowers plugin (brainstorm, plan, test first, verify before claiming done) can help with this, but it is off by default; Alex turns it on with `/superpowers on`. It is a dev workflow only: the site never runs it, and the site copy does not claim it.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # vitest, no network or key needed
npm run build
npm run test:ui      # Playwright in Chrome (e2e/), starts the dev server; BASE_URL=<site> tests the live site; recorded examples only
npm run test:ui:browsers   # @lock tests in Firefox and WebKit; once: npx.cmd playwright install firefox webkit
npm run recordings:live    # rebuild the generated recording files from recordings-src/live/
npx.cmd vite-node scripts/record-live-runs.ts -- --requests 3 --confirm   # records live runs, costs money
npx.cmd vite-node scripts/run-eval.ts -- --runs 8 --confirm   # real live runs, costs money
```

On Windows PowerShell, run `npx.cmd` instead of `npx` (the `npx.ps1` script is blocked by the execution policy).

Run `npm run typecheck` and `npm test` before pushing. The Stop hook runs the typecheck and `tests/copy.test.ts` for you when source files changed, not the full suite.

## Layout

File map, data flow and recipes: `docs/ARCHITECTURE.md`. To add a recorded example, use the `add-recorded-example` skill.

## Modes

1. **Replay:** the request matches one of the three recorded examples. The full event stream of a real live run (real Claude output, the app's real unit tests, a real headless-Chromium test and its screenshots, and the finished app's files), played back faster than it ran. No model is called at replay time.
2. **Live:** typed idea and `ANTHROPIC_API_KEY` is set (and `FOUNDRY_LIVE` is not `off`). Each agent calls a real model. Costs money (cap $0.60 a run): keep the Anthropic console spend limit in place. Live models need thinking switched off and effort low (see `modelParams` in `lib/pipeline/config.ts`), or thinking tokens eat the short output limit.
3. **Simulated:** typed idea with no key, or over the live limits. Scripted text, labelled as such on the page. No app is built.

## Honesty rules

- Wording: call what the visitor gets a "web app" (once per section, then "it"; Nov 21, 2026). Keep "sample app", "taskly-sample" and "no app built" (simulations). Never call it an App Store app; say it is a web page that can be added to a home screen. The diagram box and share picture say "Your web app" and "Describe a small web app" (Nov 23, 2026); the Figma frames and LinkedIn's cached preview must match.
- The page must always say which mode ran. Never present simulated text as model output.
- Never hand-edit `recordings-src/live/` events or the archive folders: replay is only honest if it is the real output. Keep each recording as it came out.
- In a live run the agents work on an in-memory copy of the starter kit; its unit tests and one Playwright browser test (written by the Browser Tester, run in real headless Chromium against the bundled file) run in a Vercel Sandbox from `FOUNDRY_SANDBOX_SNAPSHOT`, network off. The simulation runs no code and builds no app. No human reviews the apps; never say "reviewed", "success rate" or "reliable". Three examples are a demo, not a success rate.
- The app preview runs in a sealed frame and keeps nothing; the saved file uses the browser's own storage. A hosted link keeps the file 30 days after its last open, 60 days at most, then deletes it. The app on it is sealed (no cookies, no network) and keeps its data only on the visitor's own device (256 KB, that link only). It can be added to a home screen or installed (a web page that opens full screen, not an App Store app; it needs a connection). Say so. Don't promise the apps are bug-free, and never say a hosted app was reviewed, published by Alex, or hosted by him.
- Never serve agent-written html from any route other than the hosted-link routes, or without their security headers (see `docs/ARCHITECTURE.md`).
- Runs open no pull request any more. Don't describe the output as a pull request. (Only a daily cron, `app/api/cron/close-stale-prs`, still touches old drafts on taskly-sample; see `docs/ARCHITECTURE.md`.)
- `/admin-demo` shows made-up data. It must always say so, and never be described as real usage, visitors or spend.
- Do not commit `.env*` files (only `.env.example`) or `.vercel/`.

## Deploying

Pushes to `main` redeploy automatically through the Vercel GitHub integration (project `foundry-portfolio`). Manual deploy: `npx.cmd vercel@latest deploy --prod --yes`.

Never merge a PR or push to main yourself. Open the PR, give Alex the link, and wait for Alex to merge.
