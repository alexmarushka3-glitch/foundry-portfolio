// Hosted app links. Browser and server safe: just the numbers both sides agree on.

/** A link works for 7 days, then the app is deleted. */
export const SHARE_TTL_DAYS = 7;
export const SHARE_TTL_SECONDS = SHARE_TTL_DAYS * 24 * 3600;

/** The biggest app a link will keep. Real apps are 10 to 100 KB (each file the agents write is capped at 16 KB). */
export const MAX_SHARE_BYTES = 128 * 1024;
