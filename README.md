# Foundry Portfolio

A personal portfolio site with a live demo of **Foundry**, a multi-agent software factory. Visitors give a rough feature idea for a small task-tracker app and watch eight agents turn it into a reviewed pull request.

Live site: https://foundry-portfolio.vercel.app

## The pipeline

1. **Researcher** reads the sample codebase. It is read-only: it only receives the repo text and has no tools.
2. **Story Writer** turns the rough idea into a user story with acceptance criteria.
3. **Project Manager** writes the technical blueprint: data, API and UI.
4. **Backend** and **Frontend** engineers work in parallel.
5. **E2E Verifier** walks full user flows instead of running unit tests.
6. **Validator** audits the result against the story's acceptance criteria.
7. **Release** writes the pull request.

If the E2E Verifier or the Validator rejects the work, it goes back to Backend and Frontend for a second round.

## Three modes

| Mode | When | What visitors see |
| --- | --- | --- |
| Replay | One of the three example requests | Genuine Claude output from a real run, played back faster than it ran |
| Live | Custom request and `ANTHROPIC_API_KEY` is set | Each agent calls a real Claude model |
| Simulated | Custom request, no key | Scripted text, labelled as such |

The deployed site has no API key, so custom requests use the simulation. The page labels the mode on every run.

## What is real and what is not

- The three recorded runs were made with a separate Claude agent for every stage. The raw outputs are in `recordings-src/`, and `scripts/build-recordings.mjs` assembles them into `lib/recordings.json`. All three passed E2E and validation on the first round.
- The agents worked from a small bundled sample app (`lib/sampleRepo.ts`), not a real codebase. Their code is plausible but was never run.
- The E2E Verifier is an agent reasoning through flows. It does not drive a real browser.

## Run it locally

```bash
npm install
npm run dev
```

To try live mode, copy `.env.example` to `.env.local` and add an Anthropic API key. Live runs are limited to 5 per hour per IP.

## Stack

Next.js, React, TypeScript, streaming NDJSON from a route handler, the Anthropic SDK, deployed on Vercel.
