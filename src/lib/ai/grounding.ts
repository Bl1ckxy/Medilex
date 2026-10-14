/**
 * Grounding query builder + retrieval wrapper.
 * Pure query construction; retrieval is best-effort (never throws).
 */
import type { LegalChunk, LegalRetrieval } from './legal-retriever';
import { buildGroundingQuery as buildGroundingQueryImpl } from './query-transformer.ts';

export type LegalGrounding = {
    chunks: LegalChunk[];
    retrieval: Pick<LegalRetrieval, 'strategy' | 'queryEmbeddingMs' | 'totalMs'> & { strategy: 'vector' | 'vector+rerank' | 'lexical-fallback' | 'empty' | 'skipped' };
    query: string;
    skippedReason: string | null;
};

export function buildGroundingQuery(material: Record<string, unknown>): string {
  const raw = `${typeof material.negligence_type === 'string' ? material.negligence_type.replace(/_/g, ' ') : ''} ${typeof material.incident_description === 'string' ? material.incident_description.slice(0, 400) : ''}`.trim();
  return buildGroundingQueryImpl(raw);
}

export async function buildLegalGrounding(
    supabase: any,
    material: Record<string, unknown>,
): Promise<LegalGrounding> {
    const query = buildGroundingQuery(material);
    if (!query) {
        return { chunks: [], retrieval: { strategy: 'empty', queryEmbeddingMs: 0, totalMs: 0 }, query: '', skippedReason: 'no case facts' };
    }
    try {
        const { retrieveLegalChunks } = await import('./legal-retriever');
        const retrieval = await (retrieveLegalChunks as any)(supabase, query, { limit: 6 });
        return {
            chunks: retrieval.chunks,
            retrieval: { strategy: retrieval.strategy, queryEmbeddingMs: retrieval.queryEmbeddingMs, totalMs: retrieval.totalMs },
            query,
            skippedReason: retrieval.strategy === 'empty' ? 'corpus does not cover this query' : null,
        };
    } catch (e) {
        return {
            chunks: [], retrieval: { strategy: 'empty', queryEmbeddingMs: 0, totalMs: 0 }, query,
            skippedReason: e instanceof Error ? e.message : 'retrieval failure',
        };
    }
}
