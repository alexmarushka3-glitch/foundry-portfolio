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

export interface ShareStore {
  /** True when saved apps survive a restart and every instance can read them. */
  readonly persistent: boolean;
  put(id: string, html: string, ttlSeconds: number): Promise<void>;
  /** The app, or null when the id is unknown or has expired. */
  get(id: string): Promise<string | null>;
  /** True when something was removed. */
  remove(id: string): Promise<boolean>;
}

export class MemoryShareStore implements ShareStore {
  readonly persistent = false;
  private items = new Map<string, { html: string; expiresAt: number }>();

  constructor(
    private capacity = 50,
    private now: () => number = Date.now,
  ) {}

  async put(id: string, html: string, ttlSeconds: number): Promise<void> {
    this.items.delete(id);
    this.items.set(id, { html, expiresAt: this.now() + ttlSeconds * 1000 });
    while (this.items.size > this.capacity) {
      const oldest = this.items.keys().next().value;
      if (oldest === undefined) break;
      this.items.delete(oldest);
    }
  }

  async get(id: string): Promise<string | null> {
    const item = this.items.get(id);
    if (!item) return null;
    if (item.expiresAt <= this.now()) {
      this.items.delete(id);
      return null;
    }
    return item.html;
  }

  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }
}

const KEY = "foundry:app:";

export class RedisShareStore implements ShareStore {
  readonly persistent = true;
  constructor(private config: UpstashConfig) {}

  async put(id: string, html: string, ttlSeconds: number): Promise<void> {
    await upstashPipeline(this.config, [["SET", KEY + id, html, "EX", ttlSeconds]]);
  }

  async get(id: string): Promise<string | null> {
    const [value] = await upstashPipeline(this.config, [["GET", KEY + id]]);
    return typeof value === "string" ? value : null;
  }

  async remove(id: string): Promise<boolean> {
    const [count] = await upstashPipeline(this.config, [["DEL", KEY + id]]);
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
