"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminAction } from "@/lib/admin/actions";
import type { AdminOverview } from "@/lib/admin/overview";
import { sampleOverview } from "@/lib/admin/sampleData";
import type { AdminData } from "./useAdminData";

/**
 * The same shape as useAdminData, but fed by made-up sample data and with no server behind it.
 * The key actions only change what is on this visitor's screen. Nothing is sent anywhere.
 */
export function useDemoData(): AdminData {
  const [data, setData] = useState<AdminOverview | null>(null);

  // Generated in the browser, after load, so the "last hour" and "last 24 hours" views match the visitor's clock.
  useEffect(() => setData(sampleOverview(Date.now())), []);

  const refresh = useCallback(async () => setData(sampleOverview(Date.now())), []);

  const act = useCallback(async (action: AdminAction) => {
    setData((d) => {
      if (!d) return d;
      switch (action) {
        case "pause-live":
          return { ...d, server: { ...d.server, livePaused: true, liveEnabled: false } };
        case "resume-live":
          return { ...d, server: { ...d.server, livePaused: false, liveEnabled: true } };
        case "reset-limits":
          return { ...d, server: { ...d.server, limits: { ...d.server.limits, usedToday: 0, visitorsTracked: 0 } } };
        case "clear-log":
          return { ...d, runs: [] };
      }
    });
  }, []);

  return { data, error: null, loading: data === null, pending: null, refresh, act };
}
