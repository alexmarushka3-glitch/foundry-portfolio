import { afterEach } from "vitest";
import { resetServerState } from "@/lib/server/state";

// Every test starts with no run log, fresh limits, live runs un-paused, and no API key or admin token.
afterEach(() => {
  resetServerState();
  for (const name of ["ANTHROPIC_API_KEY", "FOUNDRY_LIVE", "ADMIN_TOKEN", "FOUNDRY_LIVE_PER_HOUR", "FOUNDRY_LIVE_PER_DAY"]) {
    delete process.env[name];
  }
});
