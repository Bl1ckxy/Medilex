import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { retrieveLegalChunks } from '@/lib/ai/legal-retriever';
import { checkCitations, stripSentencesWithCitations } from '@/lib/ai/citation-checker';
import { legalAskPrompt } from '@/lib/ai/prompts/legal-ask';
import { generateJson } from '@/lib/ai/json';
import { LegalAskResultSchema, generateWithRetry, type LegalAskResult } from '@/lib/legal/legal-ask';

export const runtime = 'nodejs';
export const maxDuration = 30;

const RequestSchema = z.object({
    question: z.string().min(3).max(2000),
    matchType: z.enum(['statute', 'case', 'doctrine', 'guideline', 'practice']).nullish(),
    matchTags: z.array(z.string().min(1).max(50)).max(10).nullish(),
    limit: z.number().int().min(1).max(12).nullish(),
});

export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');

    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'question (3-2000 chars) is required');
    const { question, matchType, matchTags, limit } = parsed.data;

    const retrieval = await retrieveLegalChunks(supabase, question, {
        limit: limit ?? 6,
        matchType: matchType ?? null,
        matchTags: matchTags ?? null,
    });

    // Designed outcome, not an error: the corpus does not cover the question.
    if (retrieval.chunks.length === 0) {
        return apiSuccess({
            answer: null,
            insufficient: true,
            citations: [],
            citationCheck: null,
            retrieval,
            authorities: [],
        });
    }

    let result: LegalAskResult;
    try {
        result = await generateWithRetry(async () =>
            LegalAskResultSchema.parse(
                await generateJson(
                    legalAskPrompt({
                        question,
                        authorities: retrieval.chunks,
                        filters: {
                            ...(matchType ? { matchType } : {}),
                            ...(matchTags?.length ? { matchTags } : {}),
                        },
                    }),
                ),
            ),
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Analysis failed';
        console.error('[LEGAL-ASK] LLM error:', message);
        return apiError(503, 'LLM_UNAVAILABLE', 'Legal research unavailable', { reason: message });
    }

    // Citation gate: verify every citation against the retrieved set only.
    const checkInput = `${result.answer}\n${result.citations.join('\n')}`;
    let citationCheck = await checkCitations(checkInput, retrieval.chunks);
    let answer = result.answer;

    if (!citationCheck.allVerified) {
        const bad = citationCheck.verdicts
            .filter((v) => v.status !== 'verified')
            .map((v) => v.citation);
        answer = stripSentencesWithCitations(answer, bad);
        // Re-run the gate once on the stripped answer.
        citationCheck = await checkCitations(`${answer}\n${result.citations.join('\n')}`, retrieval.chunks);
    }

    return apiSuccess({
        answer: answer.trim() || null,
        insufficient: false,
        citations: result.citations,
        confidence: result.confidence,
        citationCheck,
        retrieval,
        authorities: retrieval.chunks,
    });
}
