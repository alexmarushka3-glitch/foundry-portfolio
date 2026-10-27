import { RunLog, type RunRecord } from "./runLog";
import { upstashConfig, upstashPipeline, type RedisCommand, type UpstashConfig } from "./upstash";

// Where the admin run history lives. Memory by default (one server instance, resets on a cold start).
// With an Upstash Redis database connected (Vercel Marketplace), the history survives restarts and is
// shared by every instance. The Redis store talks to Upstash's REST API with fetch, so no extra package.

export interface RunStore {
  readonly capacity: number;
  /** True when records survive a server restart. */
  readonly persistent: boolean;
  add(record: RunRecord): Promise<void>;
  /** Newest first. */
  list(): Promise<RunRecord[]>;
  /** Drops every record and says how many there were. */
  clear(): Promise<number>;
}

export class MemoryRunStore implements RunStore {
  private log: RunLog;
  readonly capacity: number;
  readonly persistent = false;

  constructor(capacity = 500) {
    this.capacity = capacity;
    this.log = new RunLog(capacity);
  }

  async add(record: RunRecord): Promise<void> {
    this.log.add(record);
  }
  async list(): Promise<RunRecord[]> {
    return this.log.list();
  }
  async clear(): Promise<number> {
    return this.log.clear();
  }
}

const KEY = "foundry:runs";

type RedisOptions = UpstashConfig & { capacity?: number };

export class RedisRunStore implements RunStore {
  readonly capacity: number;
  readonly persistent = true;
  private config: UpstashConfig;

  constructor({ capacity = 500, ...config }: RedisOptions) {
    this.config = config;
    this.capacity = capacity;
  }

  private pipeline(commands: RedisCommand[]): Promise<unknown[]> {
    return upstashPipeline(this.config, commands);
  }

  async add(record: RunRecord): Promise<void> {
    await this.pipeline([
      ["LPUSH", KEY, JSON.stringify(record)],
      ["LTRIM", KEY, 0, this.capacity - 1],
    ]);
  }

  async list(): Promise<RunRecord[]> {
    const [items] = await this.pipeline([["LRANGE", KEY, 0, this.capacity - 1]]);
    const records: RunRecord[] = [];
    for (const raw of (items as string[] | null) ?? []) {
      try {
        records.push(JSON.parse(raw) as RunRecord);
      } catch {
        // skip a record that is not valid JSON
      }
    }
    return records;
  }

  async clear(): Promise<number> {
    const [count] = await this.pipeline([["LLEN", KEY], ["DEL", KEY]]);
    return Number(count) || 0;
  }
}

/** Redis when the Upstash REST variables are set (Vercel's `KV_*` or Upstash's own names), memory otherwise. */
export function createRunStore(env: Record<string, string | undefined> = process.env): RunStore {
  const config = upstashConfig(env);
  return config ? new RedisRunStore(config) : new MemoryRunStore();
}

/**
 * Keeps the dashboard and the run itself working when the database is down: every record also goes to
 * memory, and reads fall back to memory (with a note in the server log) if the database errors.
 */
export class FallbackRunStore implements RunStore {
  private memory: MemoryRunStore;
  readonly capacity: number;
  readonly persistent: boolean;

  constructor(
    private primary: RunStore,
    private warn: (message: string) => void = (m) => console.warn(m),
  ) {
    this.capacity = primary.capacity;
    this.persistent = primary.persistent;
    this.memory = new MemoryRunStore(primary.capacity);
  }

  async add(record: RunRecord): Promise<void> {
    await this.memory.add(record);
    try {
      await this.primary.add(record);
    } catch (err) {
      this.warn(`run log: could not save to the database (${err instanceof Error ? err.message : "unknown"})`);
    }
  }

  async list(): Promise<RunRecord[]> {
    try {
      return await this.primary.list();
    } catch (err) {
      this.warn(`run log: could not read the database, showing this instance's runs (${err instanceof Error ? err.message : "unknown"})`);
      return this.memory.list();
    }
  }

  async clear(): Promise<number> {
    const local = await this.memory.clear();
    try {
      return await this.primary.clear();
    } catch (err) {
      this.warn(`run log: could not clear the database (${err instanceof Error ? err.message : "unknown"})`);
      return local;
    }
  }
}
