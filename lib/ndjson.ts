import type { FoundryEvent } from "./types";

// The run API streams one JSON event per line (newline-delimited JSON).

export const encodeEvent = (e: FoundryEvent): string => JSON.stringify(e) + "\n";

function parseLine(line: string): FoundryEvent {
  try {
    return JSON.parse(line) as FoundryEvent;
  } catch {
    throw new Error("The server sent an update the page could not read.");
  }
}

/**
 * Read a streamed response and call `onEvent` for every complete line.
 * A last line with no trailing newline is still delivered.
 */
export async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (e: FoundryEvent) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(parseLine(line));
    }
  }
  buf += decoder.decode();
  const rest = buf.trim();
  if (rest) onEvent(parseLine(rest));
}
