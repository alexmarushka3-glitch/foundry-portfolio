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
      "Three recorded runs, played back faster than they ran. They come from an earlier version in which the agents read pasted text and wrote code in their replies. Each passed both of the pipeline's checks in the first round, in 72 to 94 seconds.",
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
      "The recordings and the simulation never run any code. In a live run, the sample app starts only inside the sandbox, for its tests and one browser test.",
      "In the recordings and the simulation, the E2E Verifier is an agent reasoning through user flows. It does not drive a browser.",
      "The sample app is a real but small repository of about 240 lines. The results say little about large codebases.",
      "None of the three recordings needed the send-back round. Live runs sometimes do, and the simulation always shows it.",
      "No human reviews the pull requests, and the recordings and the simulation open none. Three recorded runs make a demo, not a success rate.",
    ],
  },
];
