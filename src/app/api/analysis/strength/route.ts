import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { getCaseMaterial } from '@/lib/legal/day4-case';
import { strengthPrompt } from '@/lib/ai/prompts/day4';
import { buildLegalGrounding } from '@/lib/ai/grounding';
import { checkCitations } from '@/lib/ai/citation-checker';
import { computeLimitation } from '@/lib/legal/limitation';
import { computeForum } from '@/lib/legal/forum';
import { calculateCompensation } from '@/lib/legal/compensation';
import { generateJson } from '@/lib/ai/json';
import { StrengthResultSchema, type StrengthResult } from '@/lib/legal/day4';
import { env } from '@/env';
import type { SeverityLevel } from '@/types/legal';

export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');
    const body = await request.json().catch(() => null);
    const caseId = typeof body?.caseId === 'string' ? body.caseId : '';
    if (!caseId) return apiError(422, 'VALIDATION_ERROR', 'caseId is required');
    const material = await getCaseMaterial(supabase, caseId, profile.firm_id ?? profile.id);
    if (!material) return apiError(404, 'NOT_FOUND', 'Case not found');

    const grounding = await buildLegalGrounding(supabase, material);

    let result: StrengthResult;
    try {
        result = await generateJson(strengthPrompt(material, grounding), StrengthResultSchema);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed';
        console.error('[ANALYSIS/STRENGTH] LLM error:', message);
        return apiError(503, 'LLM_UNAVAILABLE', 'Case strength analysis unavailable', { reason: message });
    }

    const limitation = computeLimitation(new Date(material.incident_date));
    const forum = computeForum(Number(material.claim_amount));
    const formulaic = calculateCompensation(
        Number(material.patient_age ?? 0),
        (material.severity ?? 'prolonged_suffering') as SeverityLevel,
        0,
        0,
        0,
    );

    const engine = {
        limitation: {
            deadline: limitation.deadline.toISOString(),
            daysRemaining: limitation.daysRemaining,
            isExpired: limitation.isExpired,
            isWarningZone: limitation.isWarningZone,
            isCriticalZone: limitation.isCriticalZone,
            condonationPossible: limitation.condonationPossible,
        },
        forum,
        compensation: {
            total: formulaic.total,
            scope: 'Severity-table heads — economic heads need income and treatment inputs.',
        },
    };

    const citationCheck = grounding.chunks.length > 0 ? await checkCitations(result.authorities.join('\n'), grounding.chunks) : null;

    const aiMidpoint = material.ai_compensation_estimate === null || material.ai_compensation_estimate === undefined
        ? Number.NaN
        : Number(material.ai_compensation_estimate);
    const deltaRatio = Number.isFinite(aiMidpoint) && formulaic.total > 0 ? (aiMidpoint - formulaic.total) / formulaic.total : Number.NaN;
    const deviation = Number.isFinite(deltaRatio)
        ? {
              aiMidpoint,
              engineTotal: formulaic.total,
              deltaPercent: Math.round(deltaRatio * 100),
              exceedsThreshold: Math.abs(deltaRatio) > 0.25,
              reason: result.deviationReason ?? null,
          }
        : null;

    const { error: analysisError } = await (supabase as any).from('ai_analyses').insert({
        case_id: caseId, analysis_type: 'case_strength', model_used: env.GROQ_MODEL ?? 'openai/gpt-oss-20b',
        result, confidence: result.confidence * 100, created_by: profile.id,
    });
    if (analysisError) return apiError(500, 'INTERNAL_ERROR', analysisError.message);
    const { error: caseError } = await (supabase as any).from('cases').update({ ai_strength_score: result.score, status: 'analysis' }).eq('id', caseId).eq('firm_id', profile.firm_id ?? profile.id);
    if (caseError) return apiError(500, 'INTERNAL_ERROR', caseError.message);
    return apiSuccess({ ...result, engine, grounding, citationCheck, deviation });
}
