import { cohereRerank } from './providers';
import { embedText } from './embeddings';
import { buildGroundingQuery } from './query-transformer';
import {
    applySimilarityFloor,
    mapLegalRows,
    mergeRerankOrder,
    lexicalScore,
    type LegalChunk,
    type LegalChunkRow,
} from './legal-rank';

export type { LegalChunk } from './legal-rank';

export type LegalRetrieval = {
    chunks: LegalChunk[];
    strategy: 'vector' | 'vector+rerank' | 'lexical-fallback' | 'empty';
    queryEmbeddingMs: number;
    totalMs: number;
};

export type LegalRetrievalOptions = {
    limit?: number;
    matchType?: LegalChunk['source_type'] | null;
    matchTags?: string[] | null;
};

/**
 * Minimal client contract: any object with an rpc method resolving to
 * { data, error }. Declared with method shorthand on purpose — TS checks
 * method parameters bivariantly, which is what lets the typed Supabase
 * client (whose rpc generic resolves to `args?: undefined` for functions
 * absent from Database types) satisfy this contract.
 */
export type LegalRpcClient = {
    rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown[] | null; error: unknown }>;
};

/**
 * Retrieve legal-corpus chunks for a query: embed → match_legal_chunks RPC →
 * Cohere rerank (with graceful degradation to vector order) → similarity floor.
 *
 * Never throws — a failure returns an empty result with strategy 'empty' and
 * real timings so callers can degrade honestly in the UI.
 *
 * Note: lexical fallback scans chunk content from the retrieved set only (no
 * un-embedded corpus copy exists), applied generically when vector results
 * are empty or weak, never injecting case-specific terms.
 */
export async function retrieveLegalChunks(
    supabase: LegalRpcClient,
    query: string,
    opts: LegalRetrievalOptions = {},
): Promise<LegalRetrieval> {
    const startedAt = Date.now();
    const limit = Math.max(1, Math.min(opts.limit ?? 6, 25));
    let queryEmbeddingMs = 0;

    let embedding: number[];
    try {
        const embedStart = Date.now();
        embedding = await embedText(buildGroundingQuery(query), { taskType: 'RETRIEVAL_QUERY' });
        queryEmbeddingMs = Date.now() - embedStart;
    } catch (error) {
        console.error('[LEGAL_RETRIEVER] Embedding failed:', error instanceof Error ? error.message : error);
        return { chunks: [], strategy: 'empty', queryEmbeddingMs, totalMs: Date.now() - startedAt };
    }

    let rows: LegalChunkRow[];
    try {
        const { data, error } = await supabase.rpc('match_legal_chunks', {
            query_embedding: embedding,
            match_count: Math.max(limit * 4, 16),
            match_type: opts.matchType ?? null,
            match_tags: opts.matchTags ?? null,
        });
        if (error) throw error instanceof Error ? error : new Error(JSON.stringify(error));
        rows = (data ?? []) as LegalChunkRow[];
    } catch (error) {
        console.error('[LEGAL_RETRIEVER] match_legal_chunks failed:', error instanceof Error ? error.message : error);
        return { chunks: [], strategy: 'empty', queryEmbeddingMs, totalMs: Date.now() - startedAt };
    }

    if (rows.length === 0) {
        return { chunks: [], strategy: 'empty', queryEmbeddingMs, totalMs: Date.now() - startedAt };
    }

    let chunks = applySimilarityFloor(mapLegalRows(rows));
    let strategy: LegalRetrieval['strategy'] = 'vector';
    if (chunks.length === 0 && rows.length > 0) {
        const mapped = mapLegalRows(rows);
        chunks = lexicalScore(query, mapped).slice(0, limit);
        strategy = 'lexical-fallback';
    } else {
        strategy = 'vector';
    }
    try {
        const ranked = await cohereRerank(
            query,
            chunks.map((chunk) => chunk.content),
            chunks.length,
        );
        if (ranked.length > 0) {
            chunks = mergeRerankOrder(chunks, ranked);
            strategy = 'vector+rerank';
        }
    } catch (error) {
        // Rerank is an enhancement, not a dependency: vector order stays usable.
        console.warn('[LEGAL_RETRIEVER] Rerank unavailable, using vector order:', error instanceof Error ? error.message : error);
    }

    return {
        chunks: chunks.slice(0, limit),
        strategy,
        queryEmbeddingMs,
        totalMs: Date.now() - startedAt,
    };
}
