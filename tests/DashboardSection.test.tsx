// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import DashboardSection from "@/components/admin/DashboardSection";

afterEach(cleanup);

describe("DashboardSection (home page)", () => {
  it("loads the sample dashboard after the page, with the made-up label", async () => {
    render(<DashboardSection />);
    expect(await screen.findByText(/Made up to show the layout/, undefined, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByLabelText("Key numbers")).toBeTruthy();
  });
});
