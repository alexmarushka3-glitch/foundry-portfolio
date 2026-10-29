"use client";

import { useRef, useState } from "react";
import { EXAMPLE_REQUESTS } from "@/lib/exampleRequests";
import { KINDS, NAME_MAX, VALUE_TYPES, buildRequest, validateSpec, type FeatureSpec, type Kind, type ValueType } from "@/lib/spec";

type Props = {
  /** `spec` is set for a request built from the fields; a recorded example sends only its text. */
  onSubmit: (request: string, spec?: FeatureSpec) => void;
  busy: boolean;
  /** The example whose replay is on screen, if any. */
  activeExample?: string;
  /** Null while the server hasn't said whether live runs are on. */
  liveAvailable: boolean | null;
};

/** The request fields, the recorded examples, and a line saying what a built request will do. */
export default function IdeaForm({ onSubmit, busy, activeExample, liveAvailable }: Props) {
  const [kind, setKind] = useState<Kind>("field");
  const [name, setName] = useState("");
  const [valueType, setValueType] = useState<ValueType>("date");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A live run spends real money and opens a public pull request, so the first press asks and the second runs.
  const [confirming, setConfirming] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const kindInfo = KINDS.find((k) => k.id === kind)!;
  const checked = validateSpec({ kind, name, valueType, required });
  const preview = checked.ok ? buildRequest(checked.spec) : "";

  const hint =
    liveAvailable === null
      ? ""
      : liveAvailable
        ? "The examples replay real live runs. Anything you build here runs live on real Claude models. A live run that passes both checks opens a public draft pull request that includes your request."
        : "The examples replay real live runs. Anything you build here runs a labelled simulation.";

  return (
    <form
      className="idea"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy) return;
        // Not ready: say why next to the field and put the cursor there, instead of a dead button.
        if (!checked.ok) {
          setError(checked.error);
          nameRef.current?.focus();
          return;
        }
        setError(null);
        if (liveAvailable && !confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onSubmit(buildRequest(checked.spec), checked.spec);
      }}
    >
      <div className="idea-fields">
        <label className="idea-field">
          What to add
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setConfirming(false);
            }}
            disabled={busy}
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="idea-field idea-name">
          {kindInfo.nameLabel}
          <input
            ref={nameRef}
            name="name"
            aria-invalid={error ? true : undefined}
            aria-describedby="idea-preview"
            autoComplete="off"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setConfirming(false);
            }}
            placeholder={`For example, ${kindInfo.example}`}
            disabled={busy}
          />
        </label>
        {kind === "field" && (
          <>
            <label className="idea-field">
              Type
              <select
                value={valueType}
                onChange={(e) => {
                  setValueType(e.target.value as ValueType);
                  setConfirming(false);
                }}
                disabled={busy}
              >
                {VALUE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="idea-check">
              <input type="checkbox" checked={required} onChange={(e) => {
                  setRequired(e.target.checked);
                  setConfirming(false);
                }}
                disabled={busy}
              />
              Required
            </label>
          </>
        )}
        <button className="run" type="submit" disabled={busy}>
          {busy ? "Running…" : confirming ? "Run live" : "Run"}
        </button>
      </div>
      <p id="idea-preview" className="idea-preview" aria-live="polite">
        {error ? (
          <span className="idea-error">{error}</span>
        ) : confirming ? (
          <span className="idea-confirm">
            This calls real Claude models and opens a public draft pull request with your request. Press Run live to start.
          </span>
        ) : preview ? (
          `The agents will get: ${preview}`
        ) : (
          "Fill in a name and the agents get one clear sentence to build from."
        )}
      </p>
      <div className="examples" role="group" aria-label="Recorded examples">
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
      <p className="hint">{hint}</p>
    </form>
  );
}
