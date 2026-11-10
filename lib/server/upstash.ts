// A tiny Upstash Redis client for the REST pipeline and multi-exec (transaction) endpoints, shared by the run log and the live brake.
// It uses fetch, so no extra package. Vercel's Marketplace sets the `KV_*` names; Upstash's own names also work.

export type UpstashConfig = { url: string; token: string; fetchFn?: typeof fetch };
export type RedisCommand = (string | number)[];

export function upstashConfig(
  env: Record<string, string | undefined> = process.env,
): UpstashConfig | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * Sends the commands in one request and returns each result. Throws if the request or any command fails.
 * With `atomic`, Upstash runs them as one MULTI/EXEC transaction, so nothing else runs in between.
 */
export async function upstashPipeline(
  { url, token, fetchFn = fetch }: UpstashConfig,
  commands: RedisCommand[],
  atomic = false,
): Promise<unknown[]> {
  const res = await fetchFn(`${url.replace(/\/+$/, "")}/${atomic ? "multi-exec" : "pipeline"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Database answered ${res.status}.`);
  const body: unknown = await res.json();
  // A failed transaction can answer with one `{ error }` object instead of a list.
  if (!Array.isArray(body))
    throw new Error(`Database error: ${(body as { error?: string })?.error ?? "unexpected reply"}`);
  const out = body as { result?: unknown; error?: string }[];
  const failed = out.find((o) => o.error);
  if (failed) throw new Error(`Database error: ${failed.error}`);
  return out.map((o) => o.result);
}

/** Like `upstashPipeline`, but Upstash runs the commands as one MULTI/EXEC transaction. */
export const upstashTransaction = (config: UpstashConfig, commands: RedisCommand[]) =>
  upstashPipeline(config, commands, true);
