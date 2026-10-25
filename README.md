# Foundry Portfolio

A personal portfolio site with a live demo of **Foundry**, a multi-agent software factory. Visitors give a rough feature idea for a small task-tracker app and watch eight agents turn it into a pull request draft checked by other agents.

Live site: https://foundry-portfolio.vercel.app

## The pipeline

1. **Researcher** reads the sample codebase. It is read-only: it only receives the repo text and has no tools.
2. **Story Writer** turns the rough idea into a user story with acceptance criteria.
3. **Project Manager** writes the technical blueprint: data, API and UI.
4. **Backend** and **Frontend** engineers work in parallel.
5. **E2E Verifier** walks full user flows instead of running unit tests.
6. **Validator** audits the result against the story's acceptance criteria.
7. **Release** writes the pull request description.

If the E2E Verifier or the Validator rejects the work, it goes back to Backend and Frontend for a second round. All three recorded runs passed on the first round, so no recording has used the send-back yet. Only the simulated mode shows it.

## The stage

The page's centerpiece is a drawing of the pipeline. The active agent glows, finished agents turn green, and a failed check draws a send-back arc. Click any agent to read its full output. Finished runs can be paused, sped up and scrubbed.

## Three modes

| Mode | When | What visitors see |
| --- | --- | --- |
| Replay | One of the three example requests | Genuine Claude output from a real run, played back faster than it ran. Runs in the browser, free, scrubbable. |
| Live | Any typed idea, when `ANTHROPIC_API_KEY` is set | Each agent calls a real Claude model. The page shows an estimated cost when the run ends. |
| Simulated | Any typed idea, with no key or over the limits | Scripted text, labelled as such. |

The page labels the mode on every run.

## What is real and what is not

- The three recorded runs were made with a separate Claude agent for every stage. The raw outputs are in `recordings-src/`, and `scripts/build-recordings.mjs` assembles them into `lib/recordings.json`. All three passed on the first round.
- The agents worked from a small bundled sample app (`lib/sampleRepo.ts`), not a real codebase. Their code is plausible but was never run.
- The E2E Verifier is an agent reasoning through flows. It does not drive a real browser.

## Live runs and cost

Live runs use Haiku 5.5 for the researcher and release agent, and Sonnet 5.5 for the rest, with thinking switched off and short outputs. Prices come from the Claude API reference. A run is meant to cost a few cents, and the page shows the estimate for each run. Safeguards:

- A run stops if it passes a $0.25 spending cap.
- Best-effort limits per visitor and per day (`FOUNDRY_LIVE_PER_HOUR`, `FOUNDRY_LIVE_PER_DAY`). Serverless hosting keeps these counters per instance, so they are a brake and not a hard cap.
- The hard cap is the spend limit set in the Anthropic console. Set one.
- Input is limited to 200 characters, and `FOUNDRY_LIVE=off` turns live runs off at any time.

## Run it locally

```bash
npm install
npm run dev
```

To try live mode, copy `.env.example` to `.env.local` and add an Anthropic API key.

## Deploys

Pushes to `main` redeploy the live site automatically through Vercel's GitHub integration.

## Stack

Next.js, React, TypeScript, streaming NDJSON from a route handler, the Anthropic SDK, deployed on Vercel.
