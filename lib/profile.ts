// Single source of truth for the portfolio copy. Edit this file to update the site.
// Items marked TODO are guesses or placeholders: replace them with real details.

export const profile = {
  name: "Alex Marushka",
  title: "Student at the University of Chicago",
  pitch:
    "I build AI systems that do real work: agents that research, spec, build, verify and audit software, and the tooling around them.",
  email: "alex.marushka3@gmail.com",
  links: [
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a student at the University of Chicago interested in where AI, software and business meet. I use Claude Code daily and build my own tools instead of waiting for them to exist.",
    "I'm recruiting for consulting and tech roles, so I care about projects that are measurable: what it does, how well, and at what cost.",
  ],
  projects: [
    {
      name: "Foundry: multi-agent software factory",
      blurb:
        "Eight agents turn a rough idea into a reviewed pull request: a read-only researcher, story writer, project manager, parallel backend and frontend engineers, an end-to-end verifier, a validator and a release agent. The demo on this page replays real recorded runs, and falls back to a scripted simulation for custom requests.",
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
  stats: [
    { label: "Agents in the pipeline", value: "8" },
    { label: "Models used", value: "3" },
    { label: "Real runs recorded, all approved", value: "3 of 3" },
  ],
};
