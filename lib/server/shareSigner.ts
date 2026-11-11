import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { canonicalFiles } from "@/lib/share";
import { upstashConfig, upstashPipeline, type UpstashConfig } from "./upstash";

// Ties a hosted link to a real Foundry run. When a run finishes, the server signs the app's files; the link endpoint
// accepts only files that carry that signature (or that match a shipped recording). Without this, anyone could post a
// hand-written page and get a link on this site's address.
//
// The signing key lives in the same Redis database as the links, created on first use, so there is nothing to set up
// and every server instance signs and checks with the same key. Deleting the key (or flushing the database) makes
// every earlier signature invalid, which is harmless: the visitor just builds the app again.

const KEY_NAME = "foundry:share:key";

export interface ShareSigner {
  /** Loads the key (once). Resolves false when it cannot, and the run then simply carries no signature. */
  prepare(): Promise<boolean>;
  /** A signature for these files, or null when the key is not loaded. Synchronous so a run's event stream can use it. */
  sign(files: Record<string, string>): string | null;
  /** True when `sig` was made by `sign` for exactly these files. */
  verify(files: Record<string, string>, sig: unknown): boolean;
  /**
   * Reads the key again, for when a signature does not match: the key may have been deleted and made anew by another
   * instance. At most once a minute. Resolves true when the key changed.
   */
  refresh(): Promise<boolean>;
}

/** Waits for the key, but not longer than `ms`: a slow database must not hold up a run that does not need it yet. */
export async function prepareWithin(signer: ShareSigner, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([signer.prepare(), late]);
  } finally {
    clearTimeout(timer);
  }
}

export class HmacShareSigner implements ShareSigner {
  private key: Buffer | null = null;
  private loading: Promise<boolean> | null = null;
  private lastRefresh = 0;

  constructor(
    private loadKey: () => Promise<Buffer>,
    private now: () => number = Date.now,
  ) {}

  async refresh(): Promise<boolean> {
    if (this.now() - this.lastRefresh < 60_000) return false;
    this.lastRefresh = this.now();
    try {
      const fresh = await this.loadKey();
      const changed = !this.key || !this.key.equals(fresh);
      this.key = fresh;
      return changed;
    } catch {
      return false;
    }
  }

  prepare(): Promise<boolean> {
    if (this.key) return Promise.resolve(true);
    this.loading ??= this.loadKey().then(
      (key) => {
        this.key = key;
        return true;
      },
      () => {
        this.loading = null; // try again on the next run
        return false;
      },
    );
    return this.loading;
  }

  private mac(files: Record<string, string>): Buffer | null {
    return this.key ? createHmac("sha256", this.key).update(canonicalFiles(files)).digest() : null;
  }

  sign(files: Record<string, string>): string | null {
    return this.mac(files)?.toString("hex") ?? null;
  }

  verify(files: Record<string, string>, sig: unknown): boolean {
    const expected = this.mac(files);
    if (!expected || typeof sig !== "string" || !/^[0-9a-f]{64}$/.test(sig)) return false;
    return timingSafeEqual(expected, Buffer.from(sig, "hex"));
  }
}

/** The key every instance shares: created if missing (SET NX), then read back so a race has one winner. */
export async function redisKey(config: UpstashConfig): Promise<Buffer> {
  const fresh = randomBytes(32).toString("hex");
  const [, stored] = await upstashPipeline(config, [
    ["SET", KEY_NAME, fresh, "NX"],
    ["GET", KEY_NAME],
  ]);
  if (typeof stored !== "string" || !/^[0-9a-f]{64}$/.test(stored))
    throw new Error("Could not read the signing key.");
  return Buffer.from(stored, "hex");
}

/** Redis-backed when the Upstash variables are set; otherwise a key that lives and dies with this process (local work). */
export function createShareSigner(
  env: Record<string, string | undefined> = process.env,
): ShareSigner {
  const config = upstashConfig(env);
  return new HmacShareSigner(config ? () => redisKey(config) : async () => randomBytes(32));
}
