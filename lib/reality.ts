// The "Scope and limits" columns. Keep these in step with the Honesty rules in CLAUDE.md.
// `tone` picks the column's color; the headings can be reworded freely.

export type RealityTone = "working" | "simulated" | "limits";

/** `short[i]` is the one-line version of `items[i]`; the page shows it and folds the full text behind it. */
export const REALITY: { tone: RealityTone; heading: string; items: string[]; short: string[] }[] = [
  {
    tone: "working",
    heading: "What works today",
    items: [
      "Eight Claude agents, each starting from the previous agent's actual output. The backend and frontend agents run in parallel.",
      "In a live run, the Researcher explores a real repository with read-only tools. The two engineers write real files into an in-memory copy of it. Every tool call shows up in the output.",
      "The sample app's own tests run on those files in an isolated sandbox with no network. If they fail, the work goes back for another round, whatever the agents say about it.",
      "The E2E Verifier writes a Playwright test and a headless Chromium runs it against the app in the sandbox. The browser's result decides the gate, and its screenshots appear in the verifier's panel. If the browser can't start, the panel says so and the verifier reads the code instead.",
      "A live run that passes both checks opens a draft pull request on the public taskly-sample repository. These drafts are closed automatically after about a day.",
      "Requests built in the form run on live Claude models while live mode is on. The badge on the stage always shows which mode ran.",
      "The three examples replay real live runs, played back faster than they ran. Each request was recorded once and kept as it came out. Each includes the sample app's real unit tests and a real headless Chromium test in the sandbox, with screenshots from that browser. All three passed both of the pipeline's checks in the first round, in 67 to 75 seconds, for $0.19 to $0.22.",
    ],
    short: [
      "Eight Claude agents, each building on the previous agent's real output.",
      "In a live run the agents read and write a real repository copy with tools, and every call is shown.",
      "The sample app's own tests run in an isolated sandbox, and a failure sends the work back.",
      "A real headless browser runs a test the E2E Verifier writes, and its result decides the gate.",
      "A live run that passes both checks opens a draft pull request on taskly-sample.",
      "Requests built in the form run live while live mode is on, and a badge shows which mode ran.",
      "The three examples replay real live runs: 67 to 75 seconds, $0.19 to $0.22, approved in round one.",
    ],
  },
  {
    tone: "simulated",
    heading: "Simulated",
    items: [
      "If live mode is off or the daily limit has been reached, a request returns scripted text. The badge reads Simulated and no model runs.",
      "The dashboard section above. Its runs, visitors and costs are made up to show the layout. The working dashboard is behind a login.",
    ],
    short: [
      "With live mode off or the daily limit reached, a request returns scripted text and no model runs.",
      "The dashboard section is made-up data that shows the layout.",
    ],
  },
  {
    tone: "limits",
    heading: "Limitations",
    items: [
      "The simulation never runs any code. In a live run, and so in the recordings of live runs, the sample app starts only inside the sandbox, for its tests and one browser test.",
      "In the simulation, the E2E Verifier is an agent reasoning through user flows. It does not drive a browser.",
      "The sample app is a real repository, but a small one, about 240 lines. The results say little about large codebases.",
      "None of the three recordings includes a send-back round. All three were approved in round one. Live runs are sometimes sent back, and the simulation always shows a send-back.",
      "No human reviews the pull requests, and the recordings and the simulation open none. Three recorded runs make a demo, not a success rate.",
      "I did check three of the eight draft pull requests the pipeline has opened so far (#5, #6 and #8), by reading their diffs on GitHub. Each did what its request said, touched only the expected files and included tests. The written descriptions were sometimes loose, though. One mentioned a browser test that is not in the pull request. Three of eight is a spot check, not a review.",
    ],
    short: [
      "The simulation never runs any code.",
      "In the simulation, the E2E Verifier is an agent reasoning through flows, not a browser.",
      "The sample app is small, about 240 lines.",
      "None of the three recordings includes a send-back round.",
      "No human reviews the pull requests, and three recorded runs are a demo, not a success rate.",
      "I spot-checked three of the eight draft pull requests by hand. That is a spot check, not a review.",
    ],
  },
];
