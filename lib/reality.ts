// The "what's real and what isn't" columns. Keep these in step with the Honesty rules in CLAUDE.md.

export const REALITY = [
  {
    heading: "Real",
    items: [
      "Each stage in the three example runs was its own Claude agent, fed the previous stage's real output.",
      "The pipeline code, the streaming, and the stage you just watched.",
      "Typed ideas run on live Claude models when the live switch is on. The badge on the stage says which mode you are in.",
      "Three recorded runs. All passed both of the pipeline's AI checks on the first round, in 72 to 94 seconds each.",
    ],
  },
  {
    heading: "Simulated",
    items: [
      "A typed idea with the live switch off runs scripted text. The badge says Simulated.",
      "The task-tracker app the agents work on. It is a toy of about 36 lines.",
      "The admin dashboard section above. Its runs, visitors and costs are made up to show the layout. The real dashboard needs a login.",
    ],
  },
  {
    heading: "Not done yet",
    items: [
      "The generated code was never run.",
      "The E2E Verifier is an agent reasoning through flows. It does not drive a browser.",
      "None of the three recordings needed the send-back round. Live runs sometimes do, and the simulation always shows it.",
      "No real pull request is opened, and no human reviews it. Three runs is a demo, not a success rate.",
    ],
  },
];
