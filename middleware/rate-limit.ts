import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;
// Auth-path requests here are page views (login/signup/prefetch); the actual
// credential check goes directly to Supabase, which applies its own brute-force
// throttling. 20/min broke the 11-test e2e suite from a single IP (each login
// costs ~2 requests incl. Link prefetch).
const AUTH_MAX_REQUESTS = 120; // raised to allow signup retries; Supabase auth handles credential brute-force

const ipStore = new Map<string, { count: number; resetAt: number }>();
const _userStore = new Map<string, { count: number; resetAt: number }>();

function getKey(store: Map<string, { count: number; resetAt: number }>, key: string) {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    const newEntry = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, newEntry);
    return newEntry;
  }
  return entry;
}

export function rateLimit(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const pathname = request.nextUrl.pathname;
  const isAuth = pathname.startsWith('/api/auth') || pathname.startsWith('/auth/');
  const limit = isAuth ? AUTH_MAX_REQUESTS : MAX_REQUESTS;

  const ipEntry = getKey(ipStore, ip);
  ipEntry.count++;
  if (ipEntry.count > limit) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((ipEntry.resetAt - Date.now()) / 1000)) } }
    );
  }

  return null;
}