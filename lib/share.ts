// Hosted app links. Browser and server safe: just the numbers both sides agree on.

/**
 * A link works for 30 days after the last time it was opened, and never more than 60 days after it was made. An app
 * added to a home screen opens the link every time, so it keeps working while it is used; the cap keeps storage bounded.
 */
export const SHARE_IDLE_DAYS = 30;
export const SHARE_MAX_DAYS = 60;
export const SHARE_IDLE_SECONDS = SHARE_IDLE_DAYS * 24 * 3600;
export const SHARE_MAX_SECONDS = SHARE_MAX_DAYS * 24 * 3600;

/** The most data one hosted app may keep on a visitor's device (keys and values together, in characters). */
export const HOSTED_STORAGE_MAX = 256 * 1024;

/** The most a link request may carry: an app's files as JSON, where every quote and line break takes two bytes. */
export const MAX_SHARE_BODY_BYTES = 400 * 1024;

/** The biggest app a link will keep. Real apps are 10 to 100 KB (each file the agents write is capped at 16 KB). */
export const MAX_SHARE_BYTES = 128 * 1024;

/** The same bytes for the same files whatever order they were written in, so a signature can be checked later. */
export function canonicalFiles(files: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(files)
      .sort()
      .map((name) => [name, files[name]]),
  );
}

/** The most files, and the longest file name, a link will take. Real apps have about 10 files with short names. */
export const MAX_SHARE_FILES = 24;
export const MAX_SHARE_NAME = 120;
