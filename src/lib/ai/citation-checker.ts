import type { LegalChunk } from './legal-retriever';

/**
 * Citation verification gate — the anti-hallucination mechanism.
 *
 * A model may only cite authorities that retrieval actually returned. Every
 * citation-shaped span in an answer is extracted, normalized, and matched
 * against the RETRIEVED set only — never the whole corpus, never the internet.
 */

export type CitationVerdict =
    | { status: 'verified'; citation: string; chunkId: string }
    | { status: 'unmatched'; citation: string; suggestion: string | null }
    | { status: 'malformed'; citation: string; reason: string };

export type CitationCheckResult = {
    verdicts: CitationVerdict[];
    verifiedCount: number;
    totalCount: number;
    allVerified: boolean;
};

export function normalizeCitation(raw: string): string {
    return raw
        .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
        .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
        .replace(/[\u2013\u2014\u2212]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\.+$/, '')
        .trim()
        .toLowerCase();
}

function tokenize(text: string): Set<string> {
    return new Set(
        normalizeCitation(text)
            .split(/[^a-z0-9]+/)
            .filter(Boolean),
    );
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
}

/** True when the candidate and a retrieved citation refer to the same text. */
function matchesRetrieved(candidateNorm: string, citationNorm: string): boolean {
    if (candidateNorm === citationNorm) return true;
    if (candidateNorm.length < 3) return false;
    return citationNorm.includes(candidateNorm) || candidateNorm.includes(citationNorm);
}

type Range = { start: number; end: number };

function overlaps(range: Range, consumed: Range[]): boolean {
    return consumed.some((c) => range.start < c.end && range.end > c.start);
}

type Candidate = { raw: string; norm: string; range?: Range; index?: number };

function extractCandidates(text: string): Candidate[] {
    const candidates: Candidate[] = [];
    const consumed: Range[] = [];
    const seen = new Set<string>();
    const push = (candidate: Candidate) => {
        if (seen.has(candidate.norm)) return;
        seen.add(candidate.norm);
        candidates.push(candidate);
    };

    // 1. Verbatim retrieved citations (the exact strings the model was handed).
    //    Ranges consumed here suppress sub-pattern double-extraction below.
    //    (Handled in checkCitations where the retrieved set is known.)

    // 2. Bracketed spans — the citation form legal-ask prompts require.
    const bracketRe = /\[([^\[\]]{1,120})\]/g;
    for (const match of text.matchAll(bracketRe)) {
        const inner = match[1] ?? '';
        const range: Range = { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length };
        if (overlaps(range, consumed)) continue;
        consumed.push(range);
        if (/^\d+$/.test(inner.trim())) {
            push({ raw: match[0], norm: inner.trim(), range, index: Number(inner.trim()) });
            continue;
        }
        if (!/\d/.test(inner)) {
            push({ raw: inner, norm: normalizeCitation(inner), range });
            continue; // malformed: no reference number — flagged in checkCitations
        }
        push({ raw: inner, norm: normalizeCitation(inner), range });
    }

    // 3. Pattern spans outside consumed ranges.
    const patterns: RegExp[] = [
        /\((?:19|20)\d{2}\)\s+\d{1,3}\s+SCC\s+\d{1,4}/g, // (2009) 4 SCC 386
        /(?<![A-Za-z])s{1,2}\.\s*\d+(?:\([a-z0-9]+\))?/gi, // s.69 / ss.5(2)
        /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+Act,?\s+\d{4}\b/g, // Limitation Act, 1963
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            const range: Range = { start: match.index ?? 0, end: (match.index ?? 0) + match[0].length };
            if (overlaps(range, consumed)) continue;
            consumed.push(range);
            push({ raw: match[0], norm: normalizeCitation(match[0]), range });
        }
    }

    return candidates;
}

export async function checkCitations(
    answerText: string,
    retrievedChunks: LegalChunk[],
): Promise<CitationCheckResult> {
    const verdicts: CitationVerdict[] = [];
    const retrieved = retrievedChunks.map((chunk) => ({
        id: chunk.id,
        citation: chunk.citation,
        norm: normalizeCitation(chunk.citation),
        tokens: tokenize(chunk.citation),
    }));

    // Pass 1: inject verbatim occurrences of retrieved citations as
    // candidates; the pattern pass above already consumed their ranges so
    // sub-patterns (s.69, Act year) cannot re-emit them separately.
    const candidates = extractCandidates(answerText);
    for (const item of retrieved) {
        if (answerText.toLowerCase().includes(item.norm)) {
            if (!candidates.some((c) => c.norm === item.norm || item.norm.includes(c.norm) || c.norm.includes(item.norm))) {
                candidates.push({ raw: item.citation, norm: item.norm });
            }
        }
    }

    for (const candidate of candidates) {
        // Numeric bracket: an authority-block reference like "[2]".
        if (candidate.index !== undefined) {
            const target = retrievedChunks[candidate.index - 1];
            if (target) {
                verdicts.push({ status: 'verified', citation: candidate.raw, chunkId: target.id });
            } else {
                verdicts.push({ status: 'unmatched', citation: candidate.raw, suggestion: null });
            }
            continue;
        }

        const hit = retrieved.find((item) => matchesRetrieved(candidate.norm, item.norm));
        if (hit) {
            verdicts.push({ status: 'verified', citation: candidate.raw, chunkId: hit.id });
            continue;
        }

        // Malformed: a bracketed span carrying no reference number at all.
        if (!/\d/.test(candidate.norm) && candidate.range !== undefined) {
            verdicts.push({
                status: 'malformed',
                citation: candidate.raw,
                reason: 'No reference number (year, section, or authority index) in citation span',
            });
            continue;
        }

        let suggestion: string | null = null;
        let best = 0;
        const candidateTokens = tokenize(candidate.raw);
        for (const item of retrieved) {
            const score = jaccard(candidateTokens, item.tokens);
            if (score >= 0.5 && score > best) {
                best = score;
                suggestion = item.citation;
            }
        }
        verdicts.push({ status: 'unmatched', citation: candidate.raw, suggestion });
    }

    const verifiedCount = verdicts.filter((v) => v.status === 'verified').length;
    const totalCount = verdicts.length;
    return {
        verdicts,
        verifiedCount,
        totalCount,
        allVerified: totalCount > 0 && verifiedCount === totalCount,
    };
}

/**
 * Drop every sentence that contains one of the supplied (non-verified)
 * citations. Used by the legal-ask gate to strip unverified propositions
 * before the answer reaches the UI.
 */
export function stripSentencesWithCitations(answerText: string, badCitations: string[]): string {
    if (badCitations.length === 0) return answerText;
    const badNorms = badCitations.map((c) => normalizeCitation(c)).filter(Boolean);
    return answerText
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => {
            const sentenceNorm = normalizeCitation(sentence);
            return !badNorms.some(
                (bad) =>
                    sentenceNorm.includes(bad) ||
                    (bad.length >= 3 && bad.includes(sentenceNorm) && sentenceNorm.length >= 3),
            );
        })
        .join(' ')
        .trim();
}
