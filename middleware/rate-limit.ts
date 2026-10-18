import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkIpLimit, classifyPath, CLASS_LIMITS } from './rate-limit-core';

export { classifyPath, CLASS_LIMITS };

export function rateLimit(request: NextRequest) {
  // Test/dev escape hatch. Only the limiter is bypassed — auth, session and
  // suspension checks in the middleware body still run.
  if (process.env.RATE_LIMIT_DISABLED === 'true') return null;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const pathClass = classifyPath(request.nextUrl.pathname);
  const result = checkIpLimit(`${ip}:${pathClass}`, CLASS_LIMITS[pathClass]);

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
      { status: 429, headers: { 'Retry-After': String(result.resetSec) } }
    );
  }

  return null;
}
