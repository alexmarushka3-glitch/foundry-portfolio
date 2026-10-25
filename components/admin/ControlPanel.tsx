"use client";

import { useState } from "react";
import type { AdminAction } from "@/lib/admin/actions";
import type { AdminOverview } from "@/lib/admin/overview";

type Props = {
  server: AdminOverview["server"];
  pending: AdminAction | null;
  onAct: (a: AdminAction) => void;
  onExport: () => void;
  exportCount: number;
  /** True on the sample-data page. */
  sample?: boolean;
};

/** The dashboard's key actions. Ones that throw data away ask twice. */
export default function ControlPanel({ server, pending, onAct, onExport, exportCount, sample = false }: Props) {
  const [confirm, setConfirm] = useState<AdminAction | null>(null);
  const { limits } = server;
  const dayShare = limits.perDay ? Math.min(1, limits.usedToday / limits.perDay) : 1;

  const destructive = (action: AdminAction, label: string, sure: string) =>
    confirm === action ? (
      <span className="confirm">
        <button
          type="button"
          className="danger"
          disabled={pending !== null}
          onClick={() => {
            setConfirm(null);
            onAct(action);
          }}
        >
          {sure}
        </button>
        <button type="button" onClick={() => setConfirm(null)}>
          Cancel
        </button>
      </span>
    ) : (
      <button type="button" disabled={pending !== null} onClick={() => setConfirm(action)}>
        {label}
      </button>
    );

  const status = !server.liveConfigured
    ? { text: "Off: no API key, or FOUNDRY_LIVE=off", tone: "off" }
    : server.livePaused
      ? { text: "Paused from this dashboard", tone: "warn" }
      : { text: "On", tone: "on" };

  return (
    <section className="card controls" aria-labelledby="controls-title">
      <h2 id="controls-title">Live runs</h2>
      <p className={`live-status ${status.tone}`}>
        <span className="dot" aria-hidden="true" /> {status.text}
      </p>

      <div className="meter" role="img" aria-label={`${limits.usedToday} of ${limits.perDay} live runs used today`}>
        <div className="meter-fill" style={{ width: `${dayShare * 100}%` }} />
      </div>
      <p className="meter-note">
        {limits.usedToday} of {limits.perDay} live runs used today. {limits.perHour} per visitor per hour.
      </p>

      <div className="actions">
        {server.livePaused ? (
          <button type="button" className="primary" disabled={pending !== null || !server.liveConfigured} onClick={() => onAct("resume-live")}>
            Resume live runs
          </button>
        ) : (
          <button type="button" disabled={pending !== null || !server.liveConfigured} onClick={() => onAct("pause-live")}>
            Pause live runs
          </button>
        )}
        {destructive("reset-limits", "Reset visitor limits", "Yes, reset")}
        <button type="button" onClick={onExport} disabled={exportCount === 0}>
          Export {exportCount} run{exportCount === 1 ? "" : "s"} (CSV)
        </button>
        {destructive("clear-log", "Clear the run log", "Yes, clear it")}
      </div>
      <p className="fine">
        Models: {server.models.fast} (fast), {server.models.build} (build), {server.models.smart} (smart).
      </p>
      <p className="fine">
        {sample ? (
          "In this sample, these buttons only change what is on your screen. Nothing is sent anywhere."
        ) : (
          <>
            Pausing is held in memory on this server instance. To turn live runs off for good, set <code>FOUNDRY_LIVE=off</code>.
          </>
        )}
      </p>
    </section>
  );
}
