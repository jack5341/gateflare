import type { RateLimitConfig } from "./types";

interface RateLimitState {
  count: number;
  window_start: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  kv: KVNamespace
): Promise<RateLimitResult> {
  const kvKey = `rl:${key}`;
  const now = Date.now();
  const windowMs = config.window_seconds * 1000;

  const raw = await kv.get(kvKey);
  let state: RateLimitState = raw
    ? (JSON.parse(raw) as RateLimitState)
    : { count: 0, window_start: now };

  if (now - state.window_start > windowMs) {
    state = { count: 0, window_start: now };
  }

  if (state.count >= config.requests) {
    return { allowed: false, remaining: 0 };
  }

  state.count += 1;

  await kv.put(kvKey, JSON.stringify(state), {
    expirationTtl: config.window_seconds + 60,
  });

  return { allowed: true, remaining: config.requests - state.count };
}

export function buildRateLimitKey(
  config: RateLimitConfig,
  routePath: string | null,
  ip: string
): string {
  const scope = routePath ? `route:${routePath}` : "global";
  const subject = config.by === "global" ? "global" : ip;
  return `${scope}:${subject}`;
}
