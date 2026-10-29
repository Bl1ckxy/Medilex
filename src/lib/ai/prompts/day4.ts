export const DAY4_SYSTEM_PROMPT = `You are MediLex, an Indian medical-negligence litigation assistant.
Use only the supplied case facts and evidence. Do not invent facts or authorities. Distinguish
facts, reasonable inferences, and missing evidence. Cite supplied evidence using
[document_id:<id>, chunk_index:<index>] when relying on it. Give conservative, reviewable outputs
and state that a licensed lawyer must make the final decision.`;

export interface LegalGrounding {
    chunks: Array<{
        id: string; citation: string; title: string; source_type: string;
        court: string | null; year: number | null; content: string; similarity: number;
    }>;
    retrieval: { strategy: string; queryEmbeddingMs: number; totalMs: number };
    query: string;
    skippedReason: string | null;
}

function renderGroundingBlock(grounding?: LegalGrounding | null): string {
    if (!grounding || !grounding.chunks || grounding.chunks.length === 0) {
        return '\nAUTHORITIES: none retrieved — return authorities: [] rather than naming any statute or case.';
    }
    const lines = grounding.chunks.map((c, i) => `[A${i + 1}] ${c.citation} — ${c.title} (${c.source_type}, ${c.year ?? 'n.d.'})\n${c.content}`).join('\n\n');
    return `\n=== RETRIEVED AUTHORITIES (only permitted citations) ===\n${lines}\n=== END AUTHORITIES ===\n\nRules:\n- Cite only from AUTHORITIES using [A1] tags, copying citation text exactly.\n- Any authority you name not listed is flagged unverified; do not invent gaps.`;
}

export function strengthPrompt(input: unknown, grounding?: LegalGrounding | null) {
    const base = `${DAY4_SYSTEM_PROMPT}\n\nAssess case strength using the five pillars: evidence, breach, causation, damages, and procedure.\nReturn JSON with score (0-100), label (Weak|Moderate|Strong|Very Strong), pillars (each 0-100),\nstrengths, weaknesses, missingEvidence, nextSteps, authorities (only from block; empty [] if none support),\ndeviationReason (if midpoint differs from formulaic estimate by >25%), and confidence (0-1).\n\nCASE MATERIAL:\n${JSON.stringify(input)}`;
    return `${base}${renderGroundingBlock(grounding)}`;
}

export function compensationPrompt(input: unknown, grounding?: LegalGrounding | null) {
    const base = `${DAY4_SYSTEM_PROMPT}\n\nEstimate compensation in INR. Return JSON with low, high, midpoint, assumptions, breakdown,\nauthorities (only from block; empty [] if none support), missingEvidence, and confidence (0-1).\nNever present as guaranteed; actual damages depend on proof and adjudication.\n\nCASE MATERIAL:\n${JSON.stringify(input)}`;
    return `${base}${renderGroundingBlock(grounding)}`;
}

export function verificationPrompt(input: unknown, grounding?: LegalGrounding | null) {
    const base = `${DAY4_SYSTEM_PROMPT}\n\nVerify the supplied analysis against the case material. Return JSON with verdict (verified|needs_review|contradicted),\nchecks (array of {claim, status, reason, evidence}), corrections, authorities (only from block), and confidence (0-1).\n\nCASE MATERIAL AND ANALYSIS:\n${JSON.stringify(input)}`;
    return `${base}${renderGroundingBlock(grounding)}`;
}

export function lawyerReviewPrompt(input: unknown, grounding?: LegalGrounding | null) {
    const base = `${DAY4_SYSTEM_PROMPT}\n\nPrepare a concise lawyer review checklist. Return JSON with summary, issues (array of {severity,\nissue, recommendation}), evidenceToRequest, proceduralRisks, and questionsForClient. Do not give\nconclusive legal advice.\n\nCASE MATERIAL:\n${JSON.stringify(input)}`;
    return `${base}${renderGroundingBlock(grounding)}`;
}
