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
    { label: "Resume", href: "/Alex-Marushka-Resume.pdf" },
    { label: "GitHub", href: "https://github.com/alexmarushka3-glitch" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/alex-marushka-4bb1113b9/" },
  ],
  about: [
    "I'm a student at the University of Chicago. I wanted to find out how much of software work a team of AI agents can take on, and how you tell whether the result is any good. Foundry is where I've gotten so far.",
    "I built it with Claude Code. One agent reads the code. Two more write the story and the plan, two build in parallel, and two check the result before a pull request is written. It is still rough. The sample app is small, and the three examples are replays of real live runs, each recorded once, with no pull request opened. In a live run, the verifier writes a test that a real headless browser runs. If the browser can't start, the run says so.",
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
        "Custom Claude Code skills I wrote for my own use: a Canvas deadline checker, a writing chain that drafts in my voice and then runs cleanup passes, a LinkedIn networking tracker, a skill bus that passes one skill's output to the next, and a skill publisher that syncs my skills to claude.ai.",
      tags: ["Claude Code", "Skills", "Automation"],
      /** Private: never link it. The image is a recreation with made-up courses and dates. */
      private: true,
      note: "Personal tool, private. The image recreates it with sample data.",
      images: [
        {
          src: "/projects/personal-ai-workflow-sample.png",
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
      images: [
        {
          src: "/projects/second-brain-sample.png",
          alt: "The Second Brain doc with sample data: a task table with made-up classes, due dates and statuses, a projects table, and a this-week list.",
        },
      ],
    },
  ],
};
