/**
 * Pure ranking/normalisation helpers for legal-corpus retrieval.
 *
 * Kept free of provider imports so the logic is unit-testable with plain
 * `node --test` (see tests/unit/legal-rank.test.mjs) without env/network.
 */

export type LegalChunk = {
    id: string;
    citation: string;
    title: string;
    source_type: 'statute' | 'case' | 'doctrine' | 'guideline' | 'practice';
    court: string | null;
    year: number | null;
    tags: string[];
    content: string;
    similarity: number;
};

/** Raw row shape returned by the match_legal_chunks RPC. */
export type LegalChunkRow = {
    id: string;
    citation: string;
    title: string;
    source_type: string;
    court: string | null;
    year: number | null;
    tags: string[];
    content: string;
    similarity: number | null;
};

/**
 * The RPC column is named `similarity` but match_legal_chunks selects
 * `embedding <=> query_embedding` — cosine DISTANCE (0 = identical,
 * ascending = closer). Convert to true cosine similarity so callers and the
 * UI can reason with higher-is-better values.
 */
export function mapLegalRows(rows: LegalChunkRow[]): LegalChunk[] {
    return rows.map((row) => ({
        id: row.id,
        citation: row.citation,
        title: row.title,
        source_type: row.source_type as LegalChunk['source_type'],
        court: row.court ?? null,
        year: row.year ?? null,
        tags: row.tags ?? [],
        content: row.content,
        similarity: row.similarity === null || row.similarity === undefined ? 0 : 1 - row.similarity,
    }));
}

/** Minimum cosine similarity for a chunk to be considered relevant. */
export const SIMILARITY_FLOOR = 0.15;

/**
 * Drop chunks below the similarity floor, but if that empties the result,
 * keep the top 2 anyway — the caller can still say "nothing confident
 * found" with evidence rather than showing an empty panel.
 */
export function applySimilarityFloor(chunks: LegalChunk[]): LegalChunk[] {
    const passing = chunks.filter((chunk) => chunk.similarity >= SIMILARITY_FLOOR);
    if (passing.length > 0) return passing;
    return chunks
        .slice()
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 2);
}

export type RerankHit = { index: number; relevanceScore: number };

/**
 * Reorder chunks to match Cohere's ranking; the relevance score replaces the
 * vector similarity so downstream UI shows the score actually used for order.
 * Hits pointing beyond the candidate list are ignored.
 */
export function lexicalScore(query: string, chunks: LegalChunk[]): LegalChunk[] {
    const qWords = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    return chunks.slice().sort((a, b) => {
        const sa = a.content.toLowerCase().split(/[^a-z0-9]+/).filter(w => qWords.has(w)).length;
        const sb = b.content.toLowerCase().split(/[^a-z0-9]+/).filter(w => qWords.has(w)).length;
        return sb - sa;
    });
}

export function mergeRerankOrder(chunks: LegalChunk[], hits: RerankHit[]): LegalChunk[] {
    const ordered: LegalChunk[] = [];
    for (const hit of hits) {
        const chunk = chunks[hit.index];
        if (!chunk) continue;
        ordered.push({ ...chunk, similarity: hit.relevanceScore });
    }
    return ordered;
}
