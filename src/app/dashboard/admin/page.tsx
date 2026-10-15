import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/server-user';
import { AdminTabs } from './_components/admin-tabs';

export default async function AdminPage() {
    const { authUser, profile } = await getProfile();

    if (!authUser) redirect('/auth/login');
    if (!profile || profile.role !== 'firm_admin') redirect('/dashboard');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="font-serif text-2xl font-semibold text-navy">Firm Administration</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Manage team access, roles, and oversee firm-wide case metadata.
                </p>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <AdminTabs currentUserId={String(profile.id)} />
            </div>
        </div>
    );
}
