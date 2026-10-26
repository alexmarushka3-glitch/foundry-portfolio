// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DemoDashboard from "@/components/admin/DemoDashboard";

afterEach(cleanup);

describe("DemoDashboard (public sample-data page)", () => {
  it("says loudly that the data is made up, and shows the dashboard", async () => {
    render(<DemoDashboard />);
    expect(await screen.findByText(/Everything on this page is made up/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("sample data");
    expect(screen.getByLabelText("Key numbers")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Runs table" })).toBeTruthy();
  });

  it("makes no network requests and has no sign-out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DemoDashboard />);
    await screen.findByText(/Everything on this page is made up/);
    fireEvent.click(screen.getByRole("button", { name: "Pause live runs" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    vi.unstubAllGlobals();
  });

  it("lets a visitor try the controls on their own screen: pause, resume, clear", async () => {
    render(<DemoDashboard />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause live runs" }));
    expect(await screen.findByText("Paused from this dashboard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume live runs" }));
    expect(await screen.findByText("On")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Clear the run log" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, clear it" }));
    await waitFor(() => expect(screen.getByText(/No runs match/)).toBeTruthy());
  });

  it("filters the sample table", async () => {
    render(<DemoDashboard />);
    const search = await screen.findByPlaceholderText("Search ideas");
    fireEvent.change(search, { target: { value: "zzz-no-such-idea" } });
    expect(await screen.findByText(/No runs match/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    await waitFor(() => expect(screen.queryByText(/No runs match/)).toBeNull());
  });
});

describe("DemoDashboard embedded on the home page", () => {
  it("keeps the made-up label, hides the heavy parts, and shows the runs table on request", async () => {
    render(<DemoDashboard embedded />);
    expect(await screen.findByText(/Made up to show the layout/)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Foundry admin");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByText("Recorded examples")).toBeNull();
    expect(screen.queryByRole("region", { name: "Runs table" })).toBeNull();

    // it opens as the key numbers only: four cards, with the charts, controls and runs table behind a button
    expect(screen.getByLabelText("Key numbers").querySelectorAll("li")).toHaveLength(4);
    const more = screen.getByRole("button", { name: "Show the full sample dashboard" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("#dash-more")?.hasAttribute("hidden")).toBe(true);
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Hide the full sample dashboard" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("#dash-more")?.hasAttribute("hidden")).toBe(false);
    // the cards below the dashboard title are one level down from it, so the outline stays in order
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toContain("Runs over time");

    fireEvent.click(screen.getByRole("button", { name: /Show the runs table/ }));
    expect(await screen.findByRole("region", { name: "Runs table" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide the runs table" }));
    expect(screen.queryByRole("region", { name: "Runs table" })).toBeNull();
  });
});
