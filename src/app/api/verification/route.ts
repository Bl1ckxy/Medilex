import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { getCaseMaterial } from '@/lib/legal/day4-case';
import { verificationPrompt } from '@/lib/ai/prompts/day4';
import { generateJson } from '@/lib/ai/json';
import { VerificationRequestSchema } from '@/lib/legal/day4';
import { buildEvidenceGrounding } from '@/lib/ai/grounding';

export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = VerificationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Invalid verification request', parsed.error.flatten());
    const material = await getCaseMaterial(supabase, parsed.data.caseId, profile.firm_id ?? profile.id);
    if (!material) return apiError(404, 'NOT_FOUND', 'Case not found');
    const evidence = await buildEvidenceGrounding(supabase, material, profile.firm_id ?? profile.id);
    try {
        const result = await generateJson(verificationPrompt({ case: { ...material, documents: undefined, evidence }, analysis: parsed.data.analysis }));
        return apiSuccess(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        console.error('[ANALYSIS/VERIFICATION] LLM error:', message);
        return apiError(503, 'LLM_UNAVAILABLE', 'Verification analysis unavailable', { reason: message });
    }
}
