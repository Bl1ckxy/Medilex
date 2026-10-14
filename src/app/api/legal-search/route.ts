import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api';
import { getProfile } from '@/lib/server-user';
import { retrieveLegalChunks } from '@/lib/ai/legal-retriever';

export const runtime = 'nodejs';
export const maxDuration = 30;

const RequestSchema = z.object({
    query: z.string().min(2).max(2000),
    matchType: z.enum(['statute', 'case', 'doctrine', 'guideline', 'practice']).nullish(),
    matchTags: z.array(z.string().min(1).max(50)).max(10).nullish(),
    limit: z.number().int().min(1).max(25).nullish(),
});

/** Pure retrieval — no LLM call, no persistence. */
export async function POST(request: NextRequest) {
    const { supabase, authUser, profile } = await getProfile();
    if (!authUser || !profile) return apiError(401, 'UNAUTHORIZED', 'Authentication required');

    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return apiError(422, 'VALIDATION_ERROR', 'query (2-2000 chars) is required');
    const { query, matchType, matchTags, limit } = parsed.data;

    const retrieval = await retrieveLegalChunks(supabase, query, {
        limit: limit ?? 8,
        matchType: matchType ?? null,
        matchTags: matchTags ?? null,
    });

    return apiSuccess({
        chunks: retrieval.chunks,
        retrieval: {
            strategy: retrieval.strategy,
            queryEmbeddingMs: retrieval.queryEmbeddingMs,
            totalMs: retrieval.totalMs,
        },
    });
}
