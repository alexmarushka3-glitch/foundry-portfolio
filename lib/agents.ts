import type { AgentName } from "./types";

export type AgentInfo = {
  id: AgentName;
  label: string;
  job: string;
};

// Order matters: this is the left to right order of the pipeline.
export const AGENT_LIST: AgentInfo[] = [
  {
    id: "researcher",
    label: "Researcher",
    job: "Reads the starter kit with read-only tools and notes what the idea needs from it.",
  },
  {
    id: "story",
    label: "Story Writer",
    job: "Turns the idea into a short story with checks a person can see on the page, or turns down ideas Foundry won't build.",
  },
  {
    id: "pm",
    label: "Project Manager",
    job: "Writes the blueprint both engineers follow: function names, page elements and tests.",
  },
  {
    id: "backend",
    label: "Logic",
    job: "Writes the app's logic and its unit tests as real files, and can run the tests.",
  },
  {
    id: "frontend",
    label: "Interface",
    job: "Writes the page, its look and the code that connects it to the logic.",
  },
  {
    id: "e2e",
    label: "Browser Tester",
    job: "In a live run, writes a test that a real headless browser runs on the finished app.",
  },
  {
    id: "validator",
    label: "Validator",
    job: "Checks the result against the story, the tests and basic safety.",
  },
  {
    id: "release",
    label: "Release",
    job: "Writes a short how-to note for the person who asked for the app.",
  },
];

export const AGENT_BY_ID = Object.fromEntries(AGENT_LIST.map((a) => [a.id, a])) as Record<
  AgentName,
  AgentInfo
>;
