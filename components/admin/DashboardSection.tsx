"use client";

import dynamic from "next/dynamic";

// Loaded after the page is interactive, so the charts and sample generator stay out of the first load.
// The slot keeps its height while it loads so nothing below it jumps.
const DemoDashboard = dynamic(() => import("./DemoDashboard"), {
  ssr: false,
  loading: () => <div className="dash-slot" aria-busy="true" />,
});

/** The sample admin dashboard, shown on the home page. */
export default function DashboardSection() {
  return (
    <div className="dash-frame">
      <DemoDashboard embedded />
    </div>
  );
}
