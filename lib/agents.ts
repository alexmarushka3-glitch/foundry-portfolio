import type { AgentName } from "./types";

export type AgentInfo = {
  id: AgentName;
  label: string;
  job: string;
};

// Order matters: this is the left to right order of the pipeline.
export const AGENT_LIST: AgentInfo[] = [
  { id: "researcher", label: "Researcher", job: "Reads the sample app. Read-only: it gets the code as text and no tools." },
  { id: "story", label: "Story Writer", job: "Turns the rough idea into a user story with acceptance criteria." },
  { id: "pm", label: "Project Manager", job: "Writes the blueprint: data, API and UI." },
  { id: "backend", label: "Backend", job: "Writes the migration and the API changes." },
  { id: "frontend", label: "Frontend", job: "Writes the UI change, with empty and error states." },
  { id: "e2e", label: "E2E Verifier", job: "Walks full user flows. In a live run it writes a Playwright test and a real headless browser runs it." },
  { id: "validator", label: "Validator", job: "Audits the result against the story's acceptance criteria." },
  { id: "release", label: "Release", job: "Writes the pull request title and description." },
];

export const AGENT_BY_ID = Object.fromEntries(AGENT_LIST.map((a) => [a.id, a])) as Record<AgentName, AgentInfo>;
