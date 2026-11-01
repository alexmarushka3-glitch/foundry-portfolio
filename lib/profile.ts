// Single source of truth for the portfolio copy. Edit this file to update the site.

export const profile = {
  siteUrl: "https://alexmarushka.vercel.app",
  name: "Alex Marushka",
  /** The big title at the top of the page. */
  headline: "Foundry",
  /** The one line under the title: what it does, in plain verbs. */
  tagline: "Describe a small app. Eight AI agents build it, test it, and hand it to you.",
  /** The paragraph under it. Keep it honest: small one-page apps, checked by real tests, no human review. */
  intro:
    "Type an idea like \"a tip calculator\" and watch them plan, write and test it in a couple of minutes. Then use the app right on the page, or save it as one file that opens in any browser.",
  /** Who does what, shown as the caption under the pipeline drawing. */
  how: "One agent reads the starter kit, two plan, two build, two check the work (and can send it back), and one writes it up.",
  /** The one-line version, used for the page description in search results and link previews. */
  title: "Student at the University of Chicago",
  pitch: "Describe a small app and eight AI agents build it, test it in a real browser, and hand it to you as one file.",
  email: "alex.marushka3@gmail.com",
  links: [
    { label: "Resume", href: "/Alex-Marushka-Resume.pdf" },
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a Business Economics student at the University of Chicago. I built Foundry with Claude Code to see how much of a software job a team of AI agents can do on its own, and how to check their work.",
    "The apps are small on purpose: one page, no accounts, no internet. That keeps them safe to run and quick to build.",
    "I'm recruiting for consulting and tech roles.",
  ],
  /** "What building it taught me": each item is a decision made in the code, stated as it is. Keep it factual. */
  lessons: [
    {
      title: "Let the tests decide, not the agents",
      body: "An agent saying it's done proves nothing. Real unit tests and a real browser test decide, and a failure sends the work back.",
    },
    {
      title: "Put limits on everything",
      body: "One send-back at most, a $0.60 spending cap per run, and limits per visitor and per day.",
    },
    {
      title: "Keep the agents in a box",
      body: "No shell, no internet, and each agent may write only its own files. The app's code runs only in a sealed sandbox, and on this page in a sealed frame.",
    },
  ],
};
