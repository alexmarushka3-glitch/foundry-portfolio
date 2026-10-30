// Single source of truth for the portfolio copy. Edit this file to update the site.

/** A project picture. `animated` plays only when the visitor allows motion; the size defaults to 1800 by 990. */
type ProjectImage = { src: string; alt: string; animated?: string; width?: number; height?: number };

export const profile = {
  siteUrl: "https://alexmarushka.vercel.app",
  name: "Alex Marushka",
  /** The big title at the top of the page. */
  headline: "Foundry",
  /** The one line under the title: what it does, in plain verbs. */
  tagline: "A demo: eight AI agents work as a team to add a feature to an app.",
  /** The paragraph under it. Keep it honest: a draft pull request checked by other agents, on a small sample app. */
  intro:
    "Pick an example and watch them plan, build and test a change to a small task-tracker app (a practice to-do list) in about a minute. A live run ends in a draft pull request, a proposed code change, checked by other agents and by real tests.",
  /** Who does what, shown as the caption under the pipeline drawing. */
  how: "One agent reads the code, two plan, two build, two check the work (and can send it back), and one writes it up.",
  /** The one-line version, used for the page description in search results and link previews. */
  title: "Student at the University of Chicago",
  pitch:
    "I build teams of AI agents. Give them a specific change and they produce a draft pull request, checked by other agents and by real tests.",
  email: "alex.marushka3@gmail.com",
  links: [
    { label: "Resume", href: "/Alex-Marushka-Resume.pdf" },
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a student at the University of Chicago. I wanted to find out how much of software work a team of AI agents can take on, and how you tell whether the result is any good. Foundry is where I've gotten so far.",
    "I built it with Claude Code. It is a demo, not a product: the app the agents change is a small practice one, and the three examples are recordings of real runs.",
    "I'm recruiting for consulting and tech roles. I like projects where I can say what the thing does, how well it works and what it costs.",
  ],
  /** "What building it taught me": each item is a decision made in the code, stated as it is. Keep it factual. */
  lessons: [
    {
      title: "Let the checks decide, not the agents",
      body: "An agent's own report can't tell you whether the work is done. The sample app's tests and a real browser test decide, and a failing result sends the work back whatever the agents say about it.",
    },
    {
      title: "Put a limit on the loop",
      body: "A send-back gets one extra round at most, and only if the run is still under 75 seconds. A run also stops at a $0.25 spending cap, and there are per-visitor and daily limits. One of the 23 measured runs failed its first round and hit the time limit before a second, so it ended unapproved. I would rather show that than hide it.",
    },
    {
      title: "Keep the agents in a box",
      body: "They work on an in-memory copy of a small repository, can only write to allowed folders, and have no shell. The sample app's code runs only in an isolated sandbox with the network off.",
    },
    {
      title: "Settings can fail a run quietly",
      body: "In my first live tests the answers were cut off at the output limit and the browser step failed. I raised the limits and loosened that prompt. The models also need thinking switched off and effort set low, or the thinking uses up the short output limit.",
    },
  ],
  projects: [
    {
      name: "Foundry: multi-agent software factory",
      blurb:
        "Eight AI agents turn a small request into a draft pull request, checked by other agents and by real tests. The examples replay real runs, sped up. A request you build runs live and opens a real draft pull request on a sample app. No human reviews it.",
      tags: ["Claude API", "TypeScript", "Next.js", "Streaming", "Multi-agent"],
      links: [
        { label: "View the code", href: "https://github.com/alexmarushka3-glitch/foundry-portfolio" },
        { label: "Sample app the agents change", href: "https://github.com/alexmarushka3-glitch/taskly-sample" },
        { label: "A real draft pull request from a live run (#8)", href: "https://github.com/alexmarushka3-glitch/taskly-sample/pull/8" },
      ],
      note: "The demo on this page at the end of a replay of a recorded live run (the estimate field example).",
      images: <ProjectImage[]>[
        {
          src: "/projects/foundry-replay.png",
          alt: "The Foundry demo after a replay of a recorded live run: all eight agents checked off, passed both checks in one round, 8 unit tests and 2 browser tests passed, and a picture from the real browser of the new estimate field.",
        },
      ],
    },
    {
      name: "Personal AI workflow",
      blurb:
        "Custom Claude Code skills I wrote for my own use: a Canvas deadline checker, a writing chain that drafts in my voice and then runs cleanup passes, a LinkedIn networking tracker, a skill bus that passes one skill's output to the next, and a skill publisher that syncs my skills to claude.ai.",
      tags: ["Claude Code", "Skills", "Automation"],
      /** Private: never link it. The image is a recreation with made-up courses and dates. */
      private: true,
      note: "Personal tool, private. The image recreates it with sample data.",
      images: <ProjectImage[]>[
        {
          src: "/projects/personal-ai-workflow-sample.png",
          /** Same sample data, animated. Shown only when the visitor allows motion. */
          animated: "/projects/personal-ai-workflow-sample.gif",
          alt: "A Claude Code session with sample data: the Canvas checker lists five made-up assignments due in the next two weeks and one missing one, then a tutor skill turns the calculus dates into a three-day study plan.",
        },
      ],
    },
    {
      name: "Second Brain",
      blurb:
        "One Claude doc that holds my projects, tasks, schedule and docs, plus an Obsidian vault for notes. A daily check refreshes the doc from Canvas, Google Calendar and Google Drive, and any Claude session can read or update it.",
      tags: ["Obsidian", "Claude Docs", "Workflow design"],
      /** Private: it holds my real schedule. Never link it. The image is a recreation with made-up tasks. */
      private: true,
      note: "Personal tool, private. The image recreates it with sample data.",
      images: <ProjectImage[]>[
        {
          src: "/projects/second-brain-sample.png",
          /** Same sample data, animated. Shown only when the visitor allows motion. */
          animated: "/projects/second-brain-sample.gif",
          alt: "The Second Brain doc with sample data: a task table with made-up classes, due dates and statuses, a projects table, and a this-week list.",
        },
      ],
    },
  ],
};
