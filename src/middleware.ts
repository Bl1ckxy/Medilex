import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/env';
import type { Database } from '@/types/supabase';
import { rateLimit } from '../middleware/rate-limit';

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] };

const ADMIN_PATHS = ['/dashboard/admin', '/api/admin'];

function isAdminPath(pathname: string) {
  return ADMIN_PATHS.some(p => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  if (request.nextUrl.pathname === '/api/health') return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values: CookieToSet[]) => values.forEach(({ name, value, options }) => {
        request.cookies.set(name, value);
        response = NextResponse.next({ request });
        response.cookies.set(name, value, options);
      }),
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  if ((pathname.startsWith('/dashboard') || pathname.startsWith('/api/')) && !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL(`/auth/login?returnTo=${encodeURIComponent(pathname)}`, request.url));
  }

  if (pathname.startsWith('/auth/') && !pathname.startsWith('/auth/callback') && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Suspended accounts lose dashboard access immediately (session cleared);
  // admin paths additionally require the firm_admin role.
  if (pathname.startsWith('/dashboard') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('auth_id', user.id)
      .maybeSingle<{ role: string; is_active: boolean }>();

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/auth/login?error=account_suspended', request.url));
    }

    if (isAdminPath(pathname) && (!profile || profile.role !== 'firm_admin')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  if (isAdminPath(pathname) && pathname.startsWith('/api/') && user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle<{ role: string }>();

    if (!profile || profile.role !== 'firm_admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = { matcher: ['/dashboard/:path*', '/auth/:path*', '/api/:path*'] };