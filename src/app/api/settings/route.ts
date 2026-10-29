import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';

const SettingsSchema = z.object({
    displayName: z.string().trim().min(1).max(200).regex(/^[^\u0000-\u001F\u007F]+$/, 'Display name contains invalid control characters'),
});

export async function PATCH(request: Request) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = SettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Invalid settings', parsed.error.flatten());
    const { data, error } = await (supabase as any)
        .from('users')
        .update({ full_name: parsed.data.displayName })
        .eq('id', profile.id)
        .eq('auth_id', authUser.id)
        .select('id,full_name,email')
        .single();
    if (error || !data) {
        console.error('[API/SETTINGS] Profile update failed', { userId: authUser.id, error: error?.message });
        return apiError(500, 'INTERNAL_ERROR', 'Unable to save settings');
    }
    return apiSuccess(data);
}
