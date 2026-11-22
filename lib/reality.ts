// The "Scope and limits" columns. Keep these in step with the Honesty rules in CLAUDE.md.
// `tone` picks the column's color; the headings can be reworded freely.

export type RealityTone = "working" | "simulated" | "limits";

/** `short[i]` is the one-line version of `items[i]`; the page shows it and folds the full text behind it. */
export const REALITY: { tone: RealityTone; heading: string; items: string[]; short: string[] }[] = [
  {
    tone: "working",
    heading: "Real",
    items: [
      "Your idea goes to eight Claude agents in turn. Each one works from the previous one's actual output, and every file it reads or writes is shown.",
      "The app's unit tests and a browser test the agents write run in a real headless Chrome, in an isolated sandbox with no internet. If either fails, the work goes back for one more round.",
      "When both pass and the Validator agent approves, the web app appears on the page. You can use it there or save it as one .html file that works offline.",
      "The three examples are recordings of real live runs, recorded once each on Nov 5, 2026 and kept as they came out, played back faster. All three passed both checks in the first round, in 54 to 60 seconds, for $0.15 to $0.17 each.",
    ],
    short: [
      "Eight Claude agents build your idea, each from the last one's real output.",
      "Real unit tests and a real browser test check the app, and a failure sends it back.",
      "If it is approved, you can use it here or save it as one file.",
      "The examples are recordings of real runs: about a minute and under 20 cents each.",
    ],
  },
  {
    tone: "simulated",
    heading: "Simulated",
    items: [
      "If live mode is off or a limit is reached (per browser, per network or per day), your idea gets scripted text instead. The badge says Simulated, no model runs and no app is built.",
    ],
    short: ["Over a limit, you see scripted text, labelled Simulated, and no app."],
  },
  {
    tone: "limits",
    heading: "Limits",
    items: [
      "Web apps are one page with no accounts, no internet and no server. Data is saved only in your own browser.",
      "No human reviews them. Passing the agents' tests doesn't mean they have no bugs.",
      "Some ideas fail or are refused, such as anything that asks for passwords or payment details. Three examples are a demo, not a success rate.",
      "On this page it runs in a sealed frame that keeps nothing. The saved file uses your browser's normal storage.",
      "A real run makes a link to its web app by itself. The file stays on the server 30 days after the link is last opened (60 at most), then it is deleted. What you save in it stays on your own device.",
    ],
    short: [
      "Web apps are one page: no accounts, no internet, no server.",
      "No human reviews them, and tests don't catch every bug.",
      "Some ideas fail or are refused. Three examples are a demo, not a success rate.",
      "Here it keeps nothing; the saved file remembers your data.",
      "A link lasts 30 days after its last open, 60 at most.",
    ],
  },
];
