// A feature request as a few fixed choices instead of free text. The server rebuilds the request sentence
// from these fields, so what the agents see is always a clear, specific ask and never raw visitor text.
// Browser and server safe.

export const KINDS = [
  { id: "field", label: "Add a field to tasks", nameLabel: "Field name", example: "due date" },
  { id: "filter", label: "Add a filter to the task list", nameLabel: "Filter by", example: "priority" },
  { id: "sort", label: "Add a sort option to the task list", nameLabel: "Sort by", example: "due date" },
  { id: "bulk", label: "Add a button that acts on many tasks", nameLabel: "Button name", example: "clear completed" },
] as const;

export const VALUE_TYPES = ["text", "date", "number", "yes/no"] as const;

export type Kind = (typeof KINDS)[number]["id"];
export type ValueType = (typeof VALUE_TYPES)[number];

export type FeatureSpec = {
  kind: Kind;
  /** Two to a hundred characters: letters, numbers, spaces and hyphens. */
  name: string;
  /** Only used by the "field" kind. */
  valueType?: ValueType;
  /** Only used by the "field" kind. */
  required?: boolean;
};

export const NAME_MIN = 2;
export const NAME_MAX = 100;

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]*$/;

export function cleanName(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

export type SpecResult = { ok: true; spec: FeatureSpec } | { ok: false; error: string };

/** Check a spec from the browser (or anywhere else) against the allowed choices. */
export function validateSpec(raw: unknown): SpecResult {
  const s = (raw ?? {}) as Partial<Record<keyof FeatureSpec, unknown>>;
  const kind = KINDS.find((k) => k.id === s.kind)?.id;
  if (!kind) return { ok: false, error: "Pick what kind of change you want." };

  const name = cleanName(s.name);
  if (name.length < NAME_MIN) return { ok: false, error: "Give it a name of at least two characters." };
  if (name.length > NAME_MAX) return { ok: false, error: `Keep the name under ${NAME_MAX} characters.` };
  if (!NAME_PATTERN.test(name)) return { ok: false, error: "Use only letters, numbers, spaces and hyphens in the name." };

  if (kind !== "field") return { ok: true, spec: { kind, name } };

  const valueType = VALUE_TYPES.find((v) => v === s.valueType);
  if (!valueType) return { ok: false, error: "Pick a type for the field." };
  return { ok: true, spec: { kind, name, valueType, required: s.required === true } };
}

/** The one-sentence request the agents get. */
export function buildRequest(spec: FeatureSpec): string {
  const name = `"${spec.name}"`;
  switch (spec.kind) {
    case "field":
      return `Add a ${name} field to tasks (type: ${spec.valueType}, ${spec.required ? "required" : "optional"}).`;
    case "filter":
      return `Add a filter by ${name} to the task list.`;
    case "sort":
      return `Add a sort option by ${name} to the task list.`;
    case "bulk":
      return `Add a ${name} button that acts on many tasks at once.`;
  }
}
