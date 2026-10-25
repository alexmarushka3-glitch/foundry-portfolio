"use client";

import { useState } from "react";
import AdminView from "./AdminView";
import { useAdminData } from "./useAdminData";

/** The real dashboard: loads runs from the server and refreshes them on a timer. */
export default function AdminDashboard() {
  const [auto, setAuto] = useState(true);
  const admin = useAdminData(auto);
  return <AdminView admin={admin} auto={auto} onAuto={setAuto} />;
}
