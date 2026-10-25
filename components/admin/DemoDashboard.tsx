"use client";

import AdminView from "./AdminView";
import { useDemoData } from "./useDemoData";

/** The sample-data dashboard. No server, no sign-in, no real data. `embedded` is the compact version used on the home page. */
export default function DemoDashboard({ embedded = false }: { embedded?: boolean }) {
  return <AdminView admin={useDemoData()} sample embedded={embedded} />;
}
