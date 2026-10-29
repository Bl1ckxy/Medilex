import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { getCaseMaterial } from '@/lib/legal/day4-case';
import { lawyerReviewPrompt } from '@/lib/ai/prompts/day4';
import { generateJson } from '@/lib/ai/json';
import { LawyerReviewRequestSchema } from '@/lib/legal/day4';
import { buildEvidenceGrounding } from '@/lib/ai/grounding';

export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const parsed = LawyerReviewRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'Invalid lawyer review request', parsed.error.flatten());
    const material = await getCaseMaterial(supabase, parsed.data.caseId, profile.firm_id ?? profile.id);
    if (!material) return apiError(404, 'NOT_FOUND', 'Case not found');
    const evidence = await buildEvidenceGrounding(supabase, material, profile.firm_id ?? profile.id);
    try {
        const result = await generateJson(lawyerReviewPrompt({ case: { ...material, documents: undefined, evidence }, focus: parsed.data.focus }));
        return apiSuccess(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Lawyer review failed';
        console.error('[ANALYSIS/LAWYER_REVIEW] LLM error:', message);
        return apiError(503, 'LLM_UNAVAILABLE', 'Lawyer review analysis unavailable', { reason: message });
    }
}
