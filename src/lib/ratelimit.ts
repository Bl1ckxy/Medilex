// src/lib/ratelimit.ts
// Dual-driver rate limiter: Upstash REST (if env vars are present) or a
// route-level in-memory fallback. Middleware does not use this fallback.

export interface RateLimitResult {
    ok: boolean;
    limit: number;
    remaining: number;
    resetSec: number;
}

interface Driver {
    limit(key: string, max: number, windowSec: number): Promise<RateLimitResult>;
}

// --- Upstash REST Driver (Production) ---
// Two deviations from the original sketch, both required for correct Redis
// semantics: (1) EXPIRE returns 1/0, never a TTL, so the window countdown
// comes from a TTL command; (2) running EXPIRE on every request would restart
// the window on each hit (an idle timeout, not a fixed window), so the key is
// expired only when it is first created.
const upstashDriver: Driver | null =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? {
              async limit(key, max, windowSec) {
                  const url = process.env.UPSTASH_REDIS_REST_URL;
                  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
                  const headers = {
                      Authorization: `Bearer ${token}`,
                      'Content-Type': 'application/json',
                  };

                  // Pipeline: INCR key, then read the remaining TTL.
                  const pipeline = [
                      ['incr', key],
                      ['ttl', key],
                  ];

                  const res = await fetch(`${url}/pipeline`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify(pipeline),
                  });

                  if (!res.ok) throw new Error(`Upstash rate limit failed: ${res.status}`);
                  const data = (await res.json()) as Array<{ result: number | string | null }>;

                  const count = Number(data[0]?.result ?? 1);
                  let ttl = Number(data[1]?.result ?? -1);

                  if (count === 1 || ttl < 0) {
                      const expireRes = await fetch(`${url}`, {
                          method: 'POST',
                          headers,
                          body: JSON.stringify(['expire', key, windowSec.toString()]),
                      });
                      if (expireRes.ok) ttl = windowSec;
                  }

                  return {
                      ok: count <= max,
                      limit: max,
                      remaining: Math.max(0, max - count),
                      resetSec: ttl > 0 ? ttl : windowSec,
                  };
              },
          }
        : null;

// --- Tiers & Public API ---
export const TIERS = {
    'legal-ask': { max: 10, windowSec: 60 },
    'legal-search': { max: 30, windowSec: 60 },
    'analysis': { max: 5, windowSec: 60 },
    'auth': { max: 3, windowSec: 60 },
} as const;

export type Tier = keyof typeof TIERS;

export async function checkRateLimit(tier: Tier, key: string): Promise<RateLimitResult> {
    const config = TIERS[tier];
    return (upstashDriver ?? memoryDriver).limit(key, config.max, config.windowSec);
}
const memoryStore = new Map<string, { count: number; resetAt: number }>();

const memoryDriver: Driver = {
    async limit(key, max, windowSec) {
        const now = Date.now();
        const record = memoryStore.get(key);
        if (!record || record.resetAt <= now) {
            memoryStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
            return { ok: true, limit: max, remaining: max - 1, resetSec: windowSec };
        }
        record.count += 1;
        return {
            ok: record.count <= max,
            limit: max,
            remaining: Math.max(0, max - record.count),
            resetSec: Math.ceil((record.resetAt - now) / 1000),
        };
    },
};
