// Pure rate-limit core: path classification + fixed-window counting. Kept free
// of next/server imports so it is unit-testable under plain node (the wrapper
// in middleware/rate-limit.ts owns the NextResponse mapping).

export const WINDOW_MS = 60_000;

// Per-path-class budgets, keyed `${ip}:${pathClass}`. A single aggregate
// counter made dashboard navigation (RSC payloads, page loads, prefetches)
// compete with API calls, so one busy SPA session — or everyone behind a
// corporate NAT — starved every other class. Tight on auth to slow brute
// force, generous on dashboard because page traffic is not abuse.
export const CLASS_LIMITS = {
    auth: 20,
    api: 100,
    dashboard: 200,
    default: 100,
} as const;

export type PathClass = keyof typeof CLASS_LIMITS;

export interface LimitResult {
    ok: boolean;
    limit: number;
    remaining: number;
    resetSec: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

export function classifyPath(pathname: string): PathClass {
    if (
        pathname.startsWith('/auth/') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/login' ||
        pathname === '/signup'
    ) {
        return 'auth';
    }
    if (pathname.startsWith('/api/')) return 'api';
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return 'dashboard';
    return 'default';
}

export function checkIpLimit(key: string, max: number, windowMs: number = WINDOW_MS): LimitResult {
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
    }

    entry.count += 1;
    const resetSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
        ok: entry.count <= max,
        limit: max,
        remaining: Math.max(0, max - entry.count),
        resetSec,
    };
}
