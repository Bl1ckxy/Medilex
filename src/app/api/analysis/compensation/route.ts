import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { getCaseMaterial } from '@/lib/legal/day4-case';
import { compensationPrompt } from '@/lib/ai/prompts/day4';
import { generateJsonWithMetadata } from '@/lib/ai/json';
import { buildEvidenceGrounding } from '@/lib/ai/grounding';

export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const body = await request.json().catch(() => null);
    const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
    if (!caseId) return apiError(422, 'VALIDATION_ERROR', 'caseId is required');
    const material = await getCaseMaterial(supabase, caseId, profile.firm_id ?? profile.id);
    if (!material) return apiError(404, 'NOT_FOUND', 'Case not found');
    const evidence = await buildEvidenceGrounding(supabase, material, profile.firm_id ?? profile.id);

    let result: Record<string, unknown>;
    try {
        const generated = await generateJsonWithMetadata<Record<string, unknown>>(compensationPrompt({
            case: { ...material, documents: undefined, evidence }, inputs: body?.inputs ?? {},
        }));
        result = generated.result;
        const { error: analysisError } = await (supabase as any).from('ai_analyses').insert({
            case_id: caseId, analysis_type: 'compensation_estimate', model_used: generated.model,
            result: { ...result, _ai_metadata: { provider: generated.provider, fallbackUsed: generated.fallbackUsed } },
            created_by: profile.id,
        });
        if (analysisError) return apiError(500, 'INTERNAL_ERROR', 'Failed to save analysis');
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Compensation analysis failed';
        console.error('[ANALYSIS/COMPENSATION] LLM error:', message);
        return apiError(503, 'LLM_UNAVAILABLE', 'Compensation analysis unavailable', { reason: message });
    }

    const midpoint = typeof result.midpoint === 'number' ? result.midpoint : Number(material.claim_amount);
    const { error: caseError } = await (supabase as any).from('cases').update({ ai_compensation_estimate: midpoint }).eq('id', caseId).eq('firm_id', profile.firm_id ?? profile.id);
    if (caseError) return apiError(500, 'INTERNAL_ERROR', caseError.message);
    return apiSuccess(result);
}
