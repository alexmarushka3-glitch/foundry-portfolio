"use client";

import { useRef, useState } from "react";
import { EXAMPLE_REQUESTS } from "@/lib/exampleRequests";
import { IDEA_MAX, validateIdea } from "@/lib/spec";

type Props = {
  /** `typed` is true for the visitor's own idea; a recorded example sends only its text. */
  onSubmit: (request: string, typed?: boolean) => void;
  busy: boolean;
  /** The example whose replay is on screen, if any. */
  activeExample?: string;
  /** Null while the server hasn't said whether live runs are on. */
  liveAvailable: boolean | null;
};

/** The recorded examples, then a box for the visitor's own idea. */
export default function IdeaForm({ onSubmit, busy, activeExample, liveAvailable }: Props) {
  const [idea, setIdea] = useState("");
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const hint =
    liveAvailable === null
      ? ""
      : liveAvailable
        ? "Your idea runs live on real AI models and takes about two minutes."
        : "Live runs are off right now, so your idea runs a labelled simulation and no app is built.";

  return (
    <form
      className="idea"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        const checked = validateIdea(idea);
        // Not ready: say why next to the box and put the cursor there, instead of a dead button.
        if (!checked.ok) {
          setError(checked.error);
          box.current?.focus();
          return;
        }
        setError(null);
        onSubmit(checked.idea, true);
      }}
    >
      <p className="idea-step">Watch an example (recorded earlier, free):</p>
      <div className="examples" role="group" aria-label="Examples">
        {EXAMPLE_REQUESTS.map((ex) => (
          <button
            key={ex}
            type="button"
            className="example"
            disabled={busy}
            aria-pressed={activeExample === ex}
            onClick={() => onSubmit(ex)}
          >
            {ex}
          </button>
        ))}
      </div>

      <label className="idea-step" htmlFor="idea-box">
        Or describe your own app:
      </label>
      <div className="idea-row">
        <textarea
          id="idea-box"
          ref={box}
          name="idea"
          rows={2}
          maxLength={IDEA_MAX}
          autoComplete="off"
          value={idea}
          aria-invalid={error ? true : undefined}
          aria-describedby="idea-note"
          placeholder="For example, a packing list for trips that I can check off…"
          disabled={busy}
          onChange={(e) => {
            setIdea(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button className="run" type="submit" disabled={busy}>
          {busy ? "Building…" : "Build it"}
        </button>
      </div>
      <p id="idea-note" className="idea-preview" aria-live="polite">
        {error ? <span className="idea-error">{error}</span> : hint}
      </p>
    </form>
  );
}
