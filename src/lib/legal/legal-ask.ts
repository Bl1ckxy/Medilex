import { z } from 'zod';

/** Shape of a legal-ask LLM response, parsed before the citation gate runs. */
export const LegalAskResultSchema = z.object({
    answer: z.string().min(1),
    citations: z.array(z.string()),
    confidence: z.number().min(0).max(1),
});
export type LegalAskResult = z.infer<typeof LegalAskResultSchema>;

/**
 * Retry wrapper for the legal-ask LLM call. Providers flake (Groq occasionally
 * emits malformed JSON, Gemini hits 503 under demand) — a single transient
 * failure should not surface as LLM_UNAVAILABLE to the user. Re-invokes the
 * supplied generator up to `attempts` times; the generator must be a closure
 * so each attempt makes a fresh provider call.
 */
export async function generateWithRetry<T>(
    generate: () => Promise<T>,
    opts: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
    const attempts = Math.max(1, opts.attempts ?? 3);
    const delayMs = opts.delayMs ?? 1000;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await generate();
        } catch (error) {
            lastError = error;
            if (attempt < attempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
            }
        }
    }
    throw lastError instanceof Error ? lastError : new Error('LLM generation failed');
}
