import type { AgentName } from "./types";

export type AgentInfo = {
  id: AgentName;
  label: string;
  job: string;
};

// Order matters: this is the left to right order of the pipeline.
export const AGENT_LIST: AgentInfo[] = [
  { id: "researcher", label: "Researcher", job: "Explores the sample app with read-only tools: it can list, read and search files and can never change them." },
  { id: "story", label: "Story Writer", job: "Turns the request into a user story with acceptance criteria." },
  { id: "pm", label: "Project Manager", job: "Writes the blueprint: data, API, page and tests." },
  { id: "backend", label: "Backend", job: "Writes the data and API changes as real files, and can run the tests." },
  { id: "frontend", label: "Frontend", job: "Writes the page change as real files, with empty and error states, and can run the tests." },
  { id: "e2e", label: "E2E Verifier", job: "Walks full user flows. In a live run it writes a Playwright test for a real headless browser to run." },
  { id: "validator", label: "Validator", job: "Audits the result against the story's acceptance criteria." },
  { id: "release", label: "Release", job: "Writes the pull request title and description. A run that passes both checks opens it as a real draft." },
];

export const AGENT_BY_ID = Object.fromEntries(AGENT_LIST.map((a) => [a.id, a])) as Record<AgentName, AgentInfo>;
