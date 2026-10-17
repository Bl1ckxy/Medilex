import type { ZodType } from 'zod';
import { groqChat, geminiText } from '@/lib/ai/providers';
import { parseJsonWithRetry } from './json-parse';

/** Calls the configured provider, tolerates fenced JSON, retries once on malformed output or schema drift. */
export async function generateJson<T>(prompt: string, schema?: ZodType<T>): Promise<T> {
    // Try Groq first with fallback chain
    try {
        return await parseJsonWithRetry<T>(() => groqChat(prompt), 'Groq', schema);
    } catch (groqError) {
        console.warn('[GENERATE_JSON] Groq failed, falling back to Gemini:', groqError instanceof Error ? groqError.message : groqError);
    }

    // Fallback to Gemini with its own fallback chain
    try {
        return await parseJsonWithRetry<T>(() => geminiText(prompt), 'Gemini', schema);
    } catch (geminiError) {
        const detail = geminiError instanceof Error ? geminiError.message : String(geminiError);
        console.error('[GENERATE_JSON] Both Groq and Gemini failed:', detail);
        throw new Error(`All AI providers failed to return valid JSON: ${detail}`);
    }
}
