import data from "../liveRecordings.json";
import { findLiveRecording } from "../liveReplay";
import { canonicalFiles } from "../share";
import type { LiveRecording } from "../recorder/capture";

// Server only: the route and the pipeline read the recordings directly. The browser loads them on demand.
const recordings = data.recordings as unknown as LiveRecording[];

export const findServerRecording = (request: string): LiveRecording | undefined =>
  findLiveRecording(recordings, request);

/**
 * The apps in the shipped recordings, as the canonical text of their files. A replay of a recording has no signature
 * (it was never produced by this server), so its files are recognised by matching a recording exactly.
 */
const shippedApps = new Set<string>();
for (const rec of recordings) {
  for (const { event } of rec.events as unknown as {
    event: { type: string; files?: Record<string, string> };
  }[]) {
    if (event.type === "files" && event.files) shippedApps.add(canonicalFiles(event.files));
  }
}

export const isShippedApp = (files: Record<string, string>): boolean =>
  shippedApps.has(canonicalFiles(files));
