"use client";

import AdminView from "./AdminView";
import { useDemoData } from "./useDemoData";

/** The public sample-data dashboard. No server, no sign-in, no real data. */
export default function DemoDashboard() {
  return <AdminView admin={useDemoData()} sample />;
}
