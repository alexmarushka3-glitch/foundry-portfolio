// Single source of truth for the portfolio copy. Edit this file to update the site.

export const profile = {
  siteUrl: "https://foundry-portfolio.vercel.app",
  name: "Alex Marushka",
  /** The big title at the top of the page. */
  headline: "Foundry",
  /** The paragraph under it. Keep it honest: a pull request draft checked by other agents, on a small sample app. */
  intro:
    "Foundry is a team of eight AI agents. Give it a rough idea for a small task-tracker app and it hands back a pull request draft, already checked by other agents. One agent reads the code, two plan the change, two build it side by side, two check the result and can send it back, and one writes up the pull request.",
  /** The one-line version, used for the page description in search results and link previews. */
  title: "Student at the University of Chicago",
  pitch:
    "I build teams of AI agents. Hand them a rough idea and they hand back a pull request draft, already checked by other agents.",
  email: "alex.marushka3@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a student at the University of Chicago, and one question has kept me busy: how much of building software can you hand to a team of AI agents, and how do you know the work is any good? Foundry is my answer so far.",
    "I built it with Claude Code. One agent reads the code, two more write the story and the blueprint, two build in parallel, and two check the result before a pull request gets written. It's rough in places. The sample app is small, and the three recorded examples came from an earlier version, where the end-to-end check was an agent walking through the flows. In a live run today a real headless browser runs a test the verifier writes.",
    "I'm recruiting for consulting and tech roles. I like projects where I can say what it does, how well it works, and what it costs.",
  ],
  projects: [
    {
      name: "Foundry: multi-agent software factory",
      blurb:
        "Eight agents turn a rough idea into a pull request draft checked by other agents: a read-only researcher, story writer, project manager, parallel backend and frontend engineers, an end-to-end verifier, a validator and a release agent. On this page you can watch it work: the three examples replay real recorded runs, and your own ideas run live on Claude models when the live switch is on.",
      tags: ["Claude API", "TypeScript", "Next.js", "Streaming", "Multi-agent"],
    },
    {
      name: "Personal AI workflow",
      blurb:
        "A set of custom Claude Code skills and plugins I wrote for myself: a Canvas deadline checker, a writing-voice chain, a LinkedIn networking tracker, and a skill publisher that syncs skills to claude.ai.",
      tags: ["Claude Code", "Skills", "Automation"],
    },
    {
      name: "Second Brain",
      blurb:
        "One living doc and an Obsidian vault that hold my projects, deadlines and notes, kept current by Claude sessions.",
      tags: ["Obsidian", "Claude Docs", "Workflow design"],
    },
  ],
};
