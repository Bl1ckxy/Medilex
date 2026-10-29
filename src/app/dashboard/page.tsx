import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const user = await requireUser();
    const supabase = createSupabaseServerClient();
    const { data: profile } = await (supabase as any).from('users').select('id, firm_id, full_name').eq('auth_id', user.id).maybeSingle();
    const userName = profile?.full_name ?? user.email ?? 'Counsel';
    const firmScope = profile?.firm_id ?? profile?.id;
    if (!firmScope) return <DashboardOverview cases={[]} userName={userName} />;
    const { data: cases, error } = await (supabase as any).from('cases').select('id,case_number,patient_name,hospital_name,status,claim_amount,limitation_deadline,created_at').eq('firm_id', firmScope).order('created_at', { ascending: false }).limit(8);
    if (error) {
        // Degrade to an empty overview rather than a 500: a transient DB error
        // must not blank the whole dashboard during a demo.
        console.error('[DASHBOARD] Database query failed', { userId: user.id, error: error.message });
        return <DashboardOverview cases={[]} userName={userName} />;
    }
    return <DashboardOverview cases={cases ?? []} userName={userName} />;
}
