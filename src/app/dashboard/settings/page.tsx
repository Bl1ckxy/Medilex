import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/server-user';
import { SettingsForm } from '@/components/settings/settings-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const { authUser: user, profile } = await getProfile();
    if (!user) redirect('/auth/login');
    const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined;
    const name = profile?.full_name ?? metadata?.full_name ?? metadata?.name ?? user.email?.split('@')[0] ?? 'Counsel';
    return <SettingsForm userName={name} email={user.email ?? ''} />;
}
