import data from "../liveRecordings.json";
import { findLiveRecording } from "../liveReplay";
import type { LiveRecording } from "../recorder/capture";

// Server only: the route and the pipeline read the recordings directly. The browser loads them on demand.
const recordings = data.recordings as unknown as LiveRecording[];

export const findServerRecording = (request: string): LiveRecording | undefined => findLiveRecording(recordings, request);
