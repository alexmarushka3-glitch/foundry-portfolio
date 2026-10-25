"use client";

import { MAX_INPUT } from "@/lib/limits";
import { EXAMPLE_REQUESTS } from "@/lib/run";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (request: string) => void;
  busy: boolean;
  /** The example whose replay is on screen, if any. */
  activeExample?: string;
  /** Null while the server hasn't said whether live runs are on. */
  liveAvailable: boolean | null;
};

/** The idea box, the recorded examples, and a line saying what a typed idea will do. */
export default function IdeaForm({ value, onChange, onSubmit, busy, activeExample, liveAvailable }: Props) {
  const hint =
    liveAvailable === null
      ? ""
      : liveAvailable
        ? "The examples replay real recorded runs. Any other idea runs live on real Claude models."
        : "The examples replay real recorded runs. Any other idea runs a labelled simulation.";

  return (
    <form
      className="idea"
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) onSubmit(value);
      }}
    >
      <label htmlFor="idea">A feature idea for a small task-tracker app</label>
      <div className="idea-row">
        <input
          id="idea"
          name="idea"
          autoComplete="off"
          value={value}
          maxLength={MAX_INPUT}
          onChange={(e) => onChange(e.target.value)}
          placeholder="For example, add a due date to tasks…"
        />
        <button className="run" type="submit" disabled={busy || !value.trim()}>
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      <div className="examples" role="group" aria-label="Recorded examples">
        {EXAMPLE_REQUESTS.map((ex) => (
          <button
            key={ex}
            type="button"
            className="example"
            disabled={busy}
            aria-pressed={activeExample === ex}
            onClick={() => {
              onChange(ex);
              onSubmit(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>
      <p className="hint">{hint}</p>
    </form>
  );
}
