// Single source of truth for the portfolio copy. Edit this file to update the site.

export const profile = {
  siteUrl: "https://foundry-portfolio.vercel.app",
  name: "Alex Marushka",
  /** The big title at the top of the page. */
  headline: "Foundry",
  /** The one line under the title: what it does, in plain verbs. */
  tagline: "I built eight AI agents that plan, build, test and write up a code change.",
  /** The paragraph under it. Keep it honest: a draft pull request checked by other agents, on a small sample app. */
  intro:
    "Foundry is a pipeline of eight AI agents. Choose a change to a small task-tracker app. A live run can end in a draft pull request, checked by other agents and by real tests.",
  /** Who does what, shown as the caption under the pipeline drawing. */
  how: "One agent reads the code and two plan the change. Two build it side by side. Two check the result: one with a real browser test, one by auditing the files and the test results. They can send it back. The last agent writes up the pull request.",
  /** The one-line version, used for the page description in search results and link previews. */
  title: "Student at the University of Chicago",
  pitch:
    "I build teams of AI agents. Give them a specific change and they produce a draft pull request, checked by other agents and by real tests.",
  email: "alex.marushka3@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a student at the University of Chicago. I wanted to find out how much of software work a team of AI agents can take on, and how you tell whether the result is any good. Foundry is where I've gotten so far.",
    "I built it with Claude Code. One agent reads the code. Two more write the story and the plan, two build in parallel, and two check the result before a pull request is written. It is still rough. The sample app is small, and the three examples are replays of real live runs, each recorded once, with no pull request opened. In a live run, the verifier writes a test that a real headless browser runs. If the browser can't start, the run says so.",
    "I'm recruiting for consulting and tech roles. I like projects where I can say what the thing does, how well it works and what it costs.",
  ],
  projects: [
    {
      name: "Foundry: multi-agent software factory",
      blurb:
        "Eight agents turn a specific request into a draft pull request, checked by other agents and by real tests. They are a read-only researcher, a story writer, a project manager, backend and frontend engineers who work in parallel, an end-to-end verifier, a validator and a release agent. On this page you can watch it work. The three examples replay real live runs, sped up. A request built in the form runs live on Claude models when live mode is on, and ends in a real draft pull request on a sample repo. No human reviews that pull request.",
      tags: ["Claude API", "TypeScript", "Next.js", "Streaming", "Multi-agent"],
      links: [
        { label: "View the code", href: "https://github.com/alexmarushka3-glitch/foundry-portfolio" },
        { label: "Sample app the agents change", href: "https://github.com/alexmarushka3-glitch/taskly-sample" },
        { label: "A real draft pull request from a live run (#8)", href: "https://github.com/alexmarushka3-glitch/taskly-sample/pull/8" },
      ],
    },
    {
      name: "Personal AI workflow",
      blurb:
        "Custom Claude Code skills and plugins I wrote for my own use: a Canvas deadline checker, a writing-voice chain, a LinkedIn networking tracker, and a skill publisher that syncs skills to claude.ai.",
      tags: ["Claude Code", "Skills", "Automation"],
    },
    {
      name: "Second Brain",
      blurb:
        "A single doc and an Obsidian vault where I keep my projects, deadlines and notes. Claude sessions keep them up to date.",
      tags: ["Obsidian", "Claude Docs", "Workflow design"],
    },
  ],
};
