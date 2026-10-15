import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/layout/app-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const user = await requireUser();
    const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined;
    const userName = metadata?.full_name ?? metadata?.name ?? user.email?.split('@')[0] ?? 'Counsel';
    const supabase = createSupabaseServerClient();
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .maybeSingle<{ role: string }>();
    const isAdmin = profile?.role === 'firm_admin';
    return <AppShell userName={userName} userEmail={user.email ?? ''} isAdmin={isAdmin}>{children}</AppShell>;
}
