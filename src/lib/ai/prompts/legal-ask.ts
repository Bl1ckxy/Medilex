import type { LegalChunk } from '../legal-retriever';

export const LEGAL_ASK_SYSTEM_PROMPT = `You are MediLex, an Indian medical-negligence research assistant.
Answer ONLY from the AUTHORITIES block below. Every proposition of law must end with an inline citation
in the exact form "[CITATION]" using a citation copied verbatim from the block. If the authorities do not
support an answer, say "The curated corpus does not cover this" and stop — never guess a section number,
case name, or year. Distinguish black-letter law from practice notes. This is research support, not legal
advice; a licensed advocate must verify before filing.`;

export function legalAskPrompt(input: {
    question: string;
    authorities: LegalChunk[];
    filters?: { matchType?: string; matchTags?: string[] };
}): string {
    const filterLines: string[] = [];
    if (input.filters?.matchType) filterLines.push(`- source type restricted to: ${input.filters.matchType}`);
    if (input.filters?.matchTags?.length) filterLines.push(`- tags restricted to: ${input.filters.matchTags.join(', ')}`);

    const authorityBlock =
        input.authorities.length === 0
            ? 'No authorities were retrieved for this question (the corpus may not cover it).'
            : input.authorities
                  .map(
                      (chunk, index) =>
                          `[${index + 1}] ${chunk.citation} — ${chunk.title} (${chunk.source_type}, ${chunk.year ?? 'n.d.'})\n${chunk.content}`,
                  )
                  .join('\n\n');

    return `${LEGAL_ASK_SYSTEM_PROMPT}

AUTHORITIES (the only law you may cite; cite as [n] by copying the citation text exactly):
${authorityBlock}
${filterLines.length ? `\nACTIVE FILTERS:\n${filterLines.join('\n')}\n` : ''}
QUESTION:
${input.question}

Return a strict JSON object and nothing else:
{ "answer": "<prose answer with inline [citation] spans>", "citations": ["<citation copied verbatim from the block>", ...], "confidence": <0-1> }
"citations" must list every authority you actually cited, copied exactly as written above. If the corpus
does not cover the question, return {"answer": "The curated corpus does not cover this.", "citations": [], "confidence": 0}.`;
}
