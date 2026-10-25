/** The dashboard's key actions, shared by the API route and the page. */
export const ADMIN_ACTIONS = ["pause-live", "resume-live", "reset-limits", "clear-log"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];
