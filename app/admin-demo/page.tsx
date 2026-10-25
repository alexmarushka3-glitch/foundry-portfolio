import type { Metadata } from "next";
import DemoDashboard from "@/components/admin/DemoDashboard";

export const metadata: Metadata = {
  title: "Foundry admin: sample data",
  description: "A look at Foundry's admin dashboard using made-up sample data.",
};

/** A public, read-only copy of the admin dashboard that runs on made-up data. It needs no token and reads nothing from the server. */
export default function AdminDemoPage() {
  return (
    <main>
      <DemoDashboard />
    </main>
  );
}
