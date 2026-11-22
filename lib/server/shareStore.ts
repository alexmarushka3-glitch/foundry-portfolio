import { SHARE_IDLE_SECONDS, SHARE_MAX_SECONDS } from "@/lib/share";
import { upstashConfig, upstashPipeline, type UpstashConfig } from "./upstash";

// Where hosted app links keep the finished app (one .html file) until they expire. A link only makes sense if
// every server instance can serve it, so the button is offered only when the store is `persistent` (Upstash Redis,
// the same database the run log and live brake use). Memory is for tests and local development. There is no memory
// fallback around Redis on purpose: a link that works on one instance and 404s on another would be worse than
// saying "could not make a link".

/** A link id is 16 random bytes, base64url (22 characters). Anyone holding it can open the app, so it is unguessable. */
export const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;

/** Pulls the link id out of a pasted link (https://…/a/<id>) or a bare id. Returns null when it is neither. */
export function shareIdFrom(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  const id = /\/a\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/.exec(text)?.[1] ?? text;
  return SHARE_ID.test(id) ? id : null;
}

export function newShareId(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
}

export interface ShareLimits {
  /** Seconds a link lives after its last open. */
  idleSeconds: number;
  /** Seconds a link lives at most, counted from when it was made. */
  maxSeconds: number;
}

export const DEFAULT_SHARE_LIMITS: ShareLimits = {
  idleSeconds: SHARE_IDLE_SECONDS,
  maxSeconds: SHARE_MAX_SECONDS,
};

export interface ShareStore {
  /** True when saved apps survive a restart and every instance can read them. */
  readonly persistent: boolean;
  put(id: string, html: string, limits?: ShareLimits): Promise<void>;
  /** The app for an open, or null when the id is unknown or has expired. An open starts the idle clock again. */
  get(id: string): Promise<string | null>;
  /** The app without starting the idle clock again (for the manifest, which is not an open). */
  peek(id: string): Promise<string | null>;
  /** True when something was removed. */
  remove(id: string): Promise<boolean>;
}

export class MemoryShareStore implements ShareStore {
  readonly persistent = false;
  private items = new Map<
    string,
    { html: string; createdAt: number; expiresAt: number; limits: ShareLimits }
  >();

  constructor(
    private capacity = 50,
    private now: () => number = Date.now,
    private limits: ShareLimits = DEFAULT_SHARE_LIMITS,
  ) {}

  async put(id: string, html: string, limits: ShareLimits = this.limits): Promise<void> {
    this.items.delete(id);
    const now = this.now();
    this.items.set(id, {
      html,
      limits, // each app keeps the limits it was made with
      createdAt: now,
      expiresAt: now + Math.min(limits.idleSeconds, limits.maxSeconds) * 1000,
    });
    while (this.items.size > this.capacity) {
      const oldest = this.items.keys().next().value;
      if (oldest === undefined) break;
      this.items.delete(oldest);
    }
  }

  private live(id: string) {
    const item = this.items.get(id);
    if (!item) return null;
    if (item.expiresAt <= this.now()) {
      this.items.delete(id);
      return null;
    }
    return item;
  }

  async get(id: string): Promise<string | null> {
    const item = this.live(id);
    if (!item) return null;
    // Starts the idle clock again, but never past the hard cap.
    item.expiresAt = Math.min(
      this.now() + item.limits.idleSeconds * 1000,
      item.createdAt + item.limits.maxSeconds * 1000,
    );
    return item.html;
  }

  async peek(id: string): Promise<string | null> {
    return this.live(id)?.html ?? null;
  }

  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

const KEY = "foundry:app:";
// When the link was made (milliseconds), kept for the hard cap. It expires with the cap, so nothing is left behind.
const MADE = "foundry:appmade:";

export class RedisShareStore implements ShareStore {
  readonly persistent = true;
  constructor(
    private config: UpstashConfig,
    private now: () => number = Date.now,
  ) {}

  async put(id: string, html: string, limits: ShareLimits = DEFAULT_SHARE_LIMITS): Promise<void> {
    await upstashPipeline(this.config, [
      ["SET", KEY + id, html, "EX", Math.min(limits.idleSeconds, limits.maxSeconds)],
      ["SET", MADE + id, String(this.now()), "EX", limits.maxSeconds],
    ]);
  }

  async get(id: string, limits: ShareLimits = DEFAULT_SHARE_LIMITS): Promise<string | null> {
    // One request: read the app and start the idle clock again, and read when the link was made.
    const [value, made] = await upstashPipeline(this.config, [
      ["GETEX", KEY + id, "EX", limits.idleSeconds],
      ["GET", MADE + id],
    ]);
    if (typeof value !== "string") return null;
    const now = this.now();
    // A link made before the cap existed has no date: it counts from its first open from now on.
    const madeAt = made === null || made === undefined ? now : Number(made);
    const left = Math.floor((madeAt + limits.maxSeconds * 1000 - now) / 1000);
    if (!Number.isFinite(left) || left <= 0) {
      await upstashPipeline(this.config, [
        ["DEL", KEY + id],
        ["DEL", MADE + id],
      ]);
      return null;
    }
    const fix: (string | number)[][] = [];
    if (made === null || made === undefined)
      fix.push(["SET", MADE + id, String(now), "NX", "EX", limits.maxSeconds]); // NX: two first opens do not fight
    if (left < limits.idleSeconds) fix.push(["EXPIRE", KEY + id, left]); // never live past the cap
    if (fix.length) await upstashPipeline(this.config, fix);
    return value;
  }

  async peek(id: string): Promise<string | null> {
    const [value] = await upstashPipeline(this.config, [["GET", KEY + id]]);
    return typeof value === "string" ? value : null;
  }

  async remove(id: string): Promise<boolean> {
    const [count] = await upstashPipeline(this.config, [
      ["DEL", KEY + id],
      ["DEL", MADE + id],
    ]);
    return Number(count) > 0;
  }
}

/** Redis when the Upstash REST variables are set, memory otherwise. */
export function createShareStore(
  env: Record<string, string | undefined> = process.env,
): ShareStore {
  const config = upstashConfig(env);
  return config ? new RedisShareStore(config) : new MemoryShareStore();
}
