// The "what's real and what isn't" columns. Keep these in step with the Honesty rules in CLAUDE.md.

export const REALITY = [
  {
    heading: "Real",
    items: [
      "Each stage in the three example runs was its own Claude agent, fed the previous stage's real output. Those runs came from an earlier version, where the agents only read pasted text and wrote code in their replies.",
      "In a live run the Researcher uses read-only tools on a copy of a real repository, and the two engineers write real files into that in-memory copy. Their tool calls show in the output.",
      "In a live run the sample app's real test suite runs on the agents' files in a throwaway sandbox with the network switched off. A failing suite sends the work back, whatever the agents say.",
      "In a live run the E2E Verifier writes a Playwright test for a real headless Chromium to run against the app inside the sandbox. Pictures from that browser show in the verifier's panel, and the real pass or fail decides the gate. If the browser cannot start, the panel says so and the verifier only reads the code.",
      "A live run that passes both checks opens a real draft pull request on the public taskly-sample repo, with the agents' files. It is closed automatically after about a day.",
      "The pipeline code, the streaming, and the stage you just watched.",
      "Typed ideas run on live Claude models when the live switch is on. The badge on the stage says which mode you are in.",
      "Three recorded runs. All passed both of the pipeline's AI checks on the first round, in 72 to 94 seconds each.",
    ],
  },
  {
    heading: "Simulated",
    items: [
      "A request built in the form with the live switch off runs scripted text. The badge says Simulated.",
      "The task-tracker app the agents work on. It is a real but tiny repository, about 240 lines, and the agents change a copy of it in memory.",
      "The admin dashboard section above. Its runs, visitors and costs are made up to show the layout. The real dashboard needs a login.",
    ],
  },
  {
    heading: "Not done yet",
    items: [
      "The recordings and the simulation never run any code. In a live run the sample app is started only inside the sandbox, for its tests and one browser test; nobody uses it.",
      "In the recordings and the simulation the E2E Verifier is an agent reasoning through flows. It does not drive a browser.",
      "None of the three recordings needed the send-back round. Live runs sometimes do, and the simulation always shows it.",
      "No human reviews the pull requests. The recordings and the simulation open none. Three recorded runs is a demo, not a success rate.",
    ],
  },
];
