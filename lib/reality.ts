// The "Scope and limits" columns. Keep these in step with the Honesty rules in CLAUDE.md.
// `tone` picks the column's color; the headings can be reworded freely.

export type RealityTone = "working" | "simulated" | "limits";

export const REALITY: { tone: RealityTone; heading: string; items: string[] }[] = [
  {
    tone: "working",
    heading: "What works today",
    items: [
      "Eight Claude agents, each working from the previous agent's real output. Backend and frontend run in parallel.",
      "In a live run, the Researcher explores a real repository with read-only tools, and the two engineers write real files into an in-memory copy of it. Every tool call appears in the output.",
      "The sample app's own tests run on those files in an isolated sandbox with the network disabled. If the tests fail, the work goes back for another round, whatever the agents report.",
      "The E2E Verifier writes a Playwright test, and a headless Chromium runs it against the app inside the sandbox. The browser's pass or fail decides the gate, and its screenshots appear in the verifier's panel. If the browser cannot start, the panel says so and the verifier reads the code instead.",
      "A live run that passes both checks opens a draft pull request on the public taskly-sample repository. Drafts are closed automatically after about a day.",
      "Requests built in the form run on live Claude models while live mode is on. The badge on the stage always shows which mode ran.",
      "The three examples replay real live runs, played back faster than they ran. Each request was recorded once and kept as it came out. Each includes the sample app's real unit tests and a real headless Chromium test in the sandbox, with screenshots from that browser. Each passed both of the pipeline's checks in the first round, in 67 to 75 seconds, for $0.19 to $0.22.",
    ],
  },
  {
    tone: "simulated",
    heading: "Simulated",
    items: [
      "With live mode off, or the daily limit reached, a request returns scripted text. The badge reads Simulated, and no model runs.",
      "The dashboard section above. Its runs, visitors and costs are made up to show the layout. The working dashboard sits behind a login.",
    ],
  },
  {
    tone: "limits",
    heading: "Limitations",
    items: [
      "The simulation never runs any code. In a live run, and so in the recordings of live runs, the sample app starts only inside the sandbox, for its tests and one browser test.",
      "In the simulation, the E2E Verifier is an agent reasoning through user flows. It does not drive a browser.",
      "The sample app is a real but small repository of about 240 lines. The results say little about large codebases.",
      "None of the three recordings includes a send-back round: all three were approved in round one. Live runs sometimes do, and the simulation always shows it.",
      "No human reviews the pull requests, and the recordings and the simulation open none. Three recorded runs make a demo, not a success rate.",
      "After the fact, I checked three of the eight draft pull requests the pipeline has opened so far (#5, #6 and #8) by reading their diffs on GitHub. Each did what its request said, touched only the expected files and included tests, but the written descriptions were sometimes loose: one mentioned a browser test that is not in the pull request. Three of eight is a spot check, not a review.",
    ],
  },
];
