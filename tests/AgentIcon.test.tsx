// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import AgentIcon, { ICON_PATHS } from "@/components/AgentIcon";
import PipelineSvg from "@/components/PipelineSvg";
import { AGENT_LIST } from "@/lib/agents";
import type { AgentFrame } from "@/lib/run";

const frames = (status: AgentFrame["status"], passed?: boolean): AgentFrame[] =>
  AGENT_LIST.map((a) => ({ agent: a.id, status, round: 1, passed }) as AgentFrame);

describe("agent icons", () => {
  afterEach(cleanup);

  it("has a glyph for each of the eight agents", () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual(AGENT_LIST.map((a) => a.id).sort());
    for (const paths of Object.values(ICON_PATHS)) expect(paths.length).toBeGreaterThan(0);
  });

  it("draws on a 24px grid and is hidden from screen readers", () => {
    const { container } = render(
      <svg>
        <AgentIcon agent="validator" x={0} y={0} />
      </svg>,
    );
    const icon = container.querySelector("svg.node-icon");
    expect(icon?.getAttribute("width")).toBe("24");
    expect(icon?.getAttribute("height")).toBe("24");
    expect(icon?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it.each(["wide", "narrow"] as const)("puts one icon in each node in the %s layout", (layout) => {
    const { container } = render(
      <PipelineSvg
        frames={frames("pending")}
        layout={layout}
        selected={null}
        onSelect={() => {}}
        sentBack={false}
      />,
    );
    expect(container.querySelectorAll(".node")).toHaveLength(8);
    expect(container.querySelectorAll(".node .node-icon")).toHaveLength(8);
  });

  it("keeps the state on the node so the icon colour follows the run", () => {
    const { container } = render(
      <PipelineSvg
        frames={frames("done", false)}
        layout="wide"
        selected={null}
        onSelect={() => {}}
        sentBack
      />,
    );
    expect(container.querySelectorAll(".node.done.failed .node-icon")).toHaveLength(8);
  });

  it("renders a node in each of the four states with the class that colours its icon", () => {
    const states: [AgentFrame["status"], boolean | undefined, string][] = [
      ["pending", undefined, "node pending"],
      ["active", undefined, "node active"],
      ["done", true, "node done"],
      ["done", false, "node done failed"],
    ];
    for (const [status, passed, expected] of states) {
      const { container } = render(
        <PipelineSvg
          frames={frames(status, passed)}
          layout="wide"
          selected={null}
          onSelect={() => {}}
          sentBack={false}
        />,
      );
      const node = container.querySelector(".node");
      expect(node?.getAttribute("class")).toBe(expected);
      expect(node?.querySelector(".node-icon")).not.toBeNull();
      cleanup();
    }
  });

  it("never animates the icons themselves", async () => {
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("app/globals.css", "utf8");
    const rules = css.match(/\.node-icon[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toMatch(/animation/);
  });
});
