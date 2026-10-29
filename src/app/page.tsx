import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
    const { data: { user } } = await createSupabaseServerClient().auth.getUser();
    redirect(user ? '/dashboard' : '/auth/login');
}
